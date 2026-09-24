<#
.SYNOPSIS
  Copies the Sonic slice of the production database into a freshly migrated target database.

.EXAMPLE
  $env:SRC_DATABASE_URL = 'postgresql://user:pass@localhost:5433/database'   # prod via tunnel
  $env:DST_DATABASE_URL = 'postgresql://backend:let-me-in@localhost:5431/database'
  .\scripts\copy-sonic-slice.ps1 -Mode all        # export then import (default)
  .\scripts\copy-sonic-slice.ps1 -Mode export     # only write .\slice\*.csv from SRC
  .\scripts\copy-sonic-slice.ps1 -Mode import     # only load .\slice\*.csv into DST

.NOTES
  - DST must already have the schema (prisma migrate deploy).
  - Column lists come from the TARGET schema, so dropped columns are never exported and order matches.
  - Rows are filtered to chain = SONIC and to enum values that still exist in the target.
  - History windows: events 90 d, token prices 100 d, snapshots complete.
  - Wallet/staked balances and their sync cursors ARE copied, so the worker continues incrementally.
    APR items are not copied; the update-pool-apr job rebuilds them within minutes.
    If you ever need a full balance reload instead, run the admin mutations
    userInitWalletBalancesForAllPools + userInitStakedBalances.
  - Requires psql on PATH (PostgreSQL client tools).
#>
param(
    [ValidateSet('all', 'export', 'import')]
    [string]$Mode = 'all',
    [string]$SliceDir = (Join-Path (Get-Location) 'slice')
)

$ErrorActionPreference = 'Stop'

# Defaults: local docker Postgres as target, the read-only TEST database (via tunnel on 5434) as source.
# Override with $env:DST_DATABASE_URL / $env:SRC_DATABASE_URL, e.g. to point SRC at production.
# NOTE: libpq does not accept Prisma-only URI params (?schema=, connection_limit=), leave them out here.
$dst = $env:DST_DATABASE_URL
if (-not $dst) { $dst = 'postgresql://backend:let-me-in@localhost:5431/database' }
$src = $env:SRC_DATABASE_URL
if (-not $src) { $src = 'postgresql://readonly:amB3bkGPnrWsYiFvLW87FFLwEc9DVmqa@localhost:5434/beetx' }

New-Item -ItemType Directory -Force -Path $SliceDir | Out-Null
$SliceDir = (Resolve-Path $SliceDir).Path

$now = [int][double]::Parse((Get-Date -UFormat %s))
$d90 = $now - 90 * 86400
$d100 = $now - 100 * 86400
$sonic = "chain = 'SONIC'"

# Order matters for import (foreign keys). Each entry: table name, WHERE clause.
$tables = @(
    # --- current state (FK parents; the worker keeps these fresh afterwards)
    @('PrismaToken', $sonic),
    @('PrismaTokenType', $sonic),
    @('PrismaTokenCurrentPrice', $sonic),
    @('PrismaPriceRateProviderData', $sonic),
    @('PrismaErc4626ReviewData', $sonic),
    @('PrismaTokenYield', $sonic),
    @('PrismaPool', $sonic),
    @('PrismaPoolDynamicData', $sonic),
    @('PrismaPoolToken', $sonic),
    @('PrismaPoolStaking', "$sonic and type::text in ('GAUGE','RELIQUARY')"),
    @('PrismaPoolStakingGauge', $sonic),
    @('PrismaPoolStakingGaugeReward', $sonic),
    @('PrismaPoolStakingReliquaryFarm', $sonic),
    @('PrismaPoolStakingReliquaryFarmLevel', $sonic),
    @('PrismaLastBlockSynced', "$sonic and category::text in ('POOLS','POOLS_V3','ADD_POOLS_V3','SNAPSHOTS','BPT_BALANCES_V2','BPT_BALANCES_V3','GAUGE_BALANCES','JOIN_EXITS_V2','SWAPS_V2','JOIN_EXITS_V3','SWAPS_V3')"),
    @('PrismaUserBalanceSyncStatus', "$sonic and type::text = 'RELIQUARY'"),
    @('PrismaStakedSonicData', 'true'),
    @('PrismaStakedSonicDelegatedValidator', 'true'),
    @('PrismaLoopsData', 'true'),
    # --- user balances (+ their cursors above). PrismaUser has no chain column: only users with a Sonic balance.
    @('PrismaUser', "address in (select `"userAddress`" from `"PrismaUserWalletBalance`" where chain = 'SONIC' union select `"userAddress`" from `"PrismaUserStakedBalance`" where chain = 'SONIC')"),
    @('PrismaUserWalletBalance', $sonic),
    @('PrismaUserStakedBalance', "$sonic and `"stakingId`" in (select id from `"PrismaPoolStaking`" where chain = 'SONIC' and type::text in ('GAUGE','RELIQUARY'))"),
    # --- history
    @('PrismaPoolSnapshot', $sonic),
    @('PrismaTokenPrice', "$sonic and timestamp > $d100"),
    @('PrismaReliquaryFarmSnapshot', $sonic),
    @('PrismaReliquaryLevelSnapshot', $sonic),
    @('PrismaSonicStakingDataSnapshot', 'true'),
    @('quant_weights', $sonic),
    @('PartitionedPoolEvent', "$sonic and `"blockTimestamp`" > $d90")
)

# PowerShell 5.1 mangles embedded double quotes on native calls, so every statement goes through a temp .sql file.
function Invoke-Psql {
    param([string]$Url, [string[]]$Commands)
    $sqlFile = [System.IO.Path]::GetTempFileName() + '.sql'
    try {
        [System.IO.File]::WriteAllText($sqlFile, ($Commands -join "`n") + "`n", (New-Object System.Text.UTF8Encoding($false)))
        & psql $Url -v ON_ERROR_STOP=1 -f $sqlFile
        if ($LASTEXITCODE -ne 0) { throw "psql failed (exit $LASTEXITCODE)" }
    }
    finally { Remove-Item -Force $sqlFile -ErrorAction SilentlyContinue }
}

function Get-TargetColumns {
    param([string]$Table)
    $sqlFile = [System.IO.Path]::GetTempFileName() + '.sql'
    try {
        $q = "select string_agg(quote_ident(column_name), ',' order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name = '$Table';"
        [System.IO.File]::WriteAllText($sqlFile, $q + "`n", (New-Object System.Text.UTF8Encoding($false)))
        $out = & psql $dst -At -f $sqlFile
        if ($LASTEXITCODE -ne 0) { throw "psql failed reading columns of $Table" }
        return ($out | Out-String).Trim()
    }
    finally { Remove-Item -Force $sqlFile -ErrorAction SilentlyContinue }
}

function Export-Table {
    param([string]$Table, [string]$Where)
    $cols = Get-TargetColumns $Table
    if (-not $cols) { Write-Host "!! $Table not in target schema, skipping"; return }
    $file = (Join-Path $SliceDir "$Table.csv") -replace '\\', '/'
    Write-Host ">> export $Table"
    Invoke-Psql $src @("\copy (select $cols from `"$Table`" where $Where) to '$file' csv header")
}

function Import-Table {
    param([string]$Table)
    $file = Join-Path $SliceDir "$Table.csv"
    if (-not (Test-Path $file)) { Write-Host "!! $file missing, skipping"; return }
    $header = (Get-Content $file -TotalCount 1).Trim()
    $cols = ($header -split ',' | ForEach-Object { '"' + $_ + '"' }) -join ','
    $rows = (Get-Content $file | Measure-Object -Line).Lines - 1
    Write-Host ">> import $Table ($rows rows)"
    $f = $file -replace '\\', '/'
    Invoke-Psql $dst @("\copy `"$Table`" ($cols) from '$f' csv header")
}

if ($Mode -eq 'export' -or $Mode -eq 'all') {
    foreach ($t in $tables) { Export-Table $t[0] $t[1] }
}

if ($Mode -eq 'import' -or $Mode -eq 'all') {
    foreach ($t in $tables) { Import-Table $t[0] }
    Write-Host '>> fix sequences and analyze'
    Invoke-Psql $dst @(
        "select setval('quant_weights_id_seq', coalesce((select max(id) from quant_weights), 1));",
        'analyze;'
    )
}

Write-Host 'done'
