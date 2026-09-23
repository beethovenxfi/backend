# Beets backend re-host plan (Sonic only, Render)

Status: analysis done, decisions made, nothing implemented. Written 2026-09-16. Pick up here.

## 1. Decisions taken

| Topic | Decision |
|---|---|
| Scope | Beets only. Sonic only. Balancer side is not part of this. |
| Repo | Fork `balancer/backend` into the Beets org and strip there. `frontend-monorepo` stays shared; UI changes are tiny. |
| Hosting | Render: `api` web service, `sor` web service (private), `worker` background service, Render Postgres. Cloudflare in front. |
| Dropped | Fantom, all testnets, CoW AMM pools, veBAL (locking + voting), Stellate, all AWS services, all-time event and token-price history. |
| Kept | Sonic extras: stS, Loops, maBEETS/Reliquary, liquidity gauges (`balancer-gauges-sonic`), QuantAMM. SOR (separate service, same codebase). Sentry. Cloudflare. Ormi subgraphs unchanged. LBP create. |
| Retention | Events 90 d. Token prices 100 d. Pool snapshots forever. Reliquary/stS snapshots forever. quant_weights 1 y. |
| Cadence | Balances 120 s, pool sync 60 s, APRs 10 m, snapshots 15 m. |
| Preview | Render preview environments with ephemeral small DB, Sonic only. |
| Cutover | Parallel run, then DNS flip. Near-zero downtime. |

Open assumptions to confirm when resuming:
- Domain `backend-v3.beets-ftm-node.com` stays and re-points to Render. UI env var unchanged.
- AWS account `118697801881` also serves `api-v3.balancer.fi`. AWS teardown (phase 5) needs Balancer off that account first, or must be scoped to Beets-only resources. Owner of that decision unknown.

## 2. Current system (as mapped)

### Backend (`balancer/backend`, branch `v3-canary`)
- One Node binary, three roles by env var (`apps/main.ts`): API (Apollo 4 + Express), worker (HTTP job executor, `apps/worker/job-handlers.ts`), scheduler (`apps/scheduler/server.ts`).
- Scheduler is a self-rescheduling `setTimeout` loop that sends SQS messages; the Elastic Beanstalk `sqsd` daemon POSTs them to the worker. `apps/scheduler/job-queue.ts` already POSTs directly over HTTP when `WORKER_QUEUE_URL` contains `localhost`.
- ~268 job timers on prod across 11 active chains, roughly 12k job runs per hour. Fastest jobs every 20 s (user balances) and 30 s (pool sync).
- Postgres 14 via Prisma, 40 models, 228 migrations. No Redis. In-process `memory-cache` only; Stellate is the real cache layer.
- SOR: in-process when `SOR_INSTANCE=true`, otherwise the resolver proxies to `SOR_SERVICE_URL` (today an internal ALB running the same codebase). The separate deployment exists because SOR floods once took the whole API down.
- Global jobs (token prices, coingecko sync, token yields, categories, rate-provider/hook/erc4626 reviews, price purge) are attached only to `config/mainnet.ts`. They must move to `config/sonic.ts` when mainnet is dropped, otherwise pricing silently stops.
- Sonic config: `stakingServices: ['gauge', 'reliquary']`, job sets generic + v2 + v3 + quantAmm + sts + loops + reliquary, gauge subgraph `balancer-gauges-sonic` on Ormi, RPC via direct.dev (`DIRECT_API_KEY`).

### Load-bearing big tables
| Table | Used by |
|---|---|
| `PartitionedPoolEvent` (list-partitioned by chain, e.g. `events_sonic`) | block/timestamp lookups (`modules/block-numbers`), swap-based price handler (15 min window), daily snapshot volume/fees, `poolEvents` API |
| `PrismaPoolSnapshot` | `poolGetSnapshots` charts, `update-lifetime-values` |
| `PrismaTokenPrice` | snapshot TVL, 24h-ago liquidity. Beets UI never calls `tokenGetHistoricalPrices`. |

All reads of events and prices are within 90/100 days, so the retention rules are safe. ALL_TIME charts and lifetime values come from pool snapshots, which are kept.

### AWS infra (`backend-cdk` + click-ops in `docs/infra.pdf`)
- Elastic Beanstalk on EC2, not ECS. Two full environments: canary (eu-central-1) and prod (ca-central-1). Each has 3 API envs (balancer / beets / cow) with own ALB, 1 worker env (2x r6g.large), 1 scheduler (t4g.small), Multi-AZ `db.r6g.xlarge` RDS 200 GB, NAT gateway, WAF, ~300 app-created CloudWatch alarms.
- RDS, NAT, WAF, Global Accelerator, SNS, certs are click-ops, not in CDK. No working `cdk destroy` path (package.json scripts point at deleted files).
- Migrations run inside CodeBuild in the VPC; that is why the NAT gateway exists.

### Bill (Aug 2026, USD/month)
RDS 866, EC2-Other 532, Tax 496, CloudWatch 404, EC2 314, ELB 191, VPC 134, WAF 108, Global Accelerator 71, Lambda 46, S3 39. Total 3,249.

### Observed load (1 week, CloudWatch status dashboard)
- Beets API ~24 req/min. Balancer API ~500 req/min at ~340 ms avg. COW env ~5x Balancer (solver traffic, going away).
- Workers ~44% CPU on 2x r6g.large, memory ~60%. DB ~38% CPU, ~260 write IOPS steady.

### DB size (165 GB)
| Relation | Size | Rows | Note |
|---|---|---|---|
| `PrismaTokenPrice` | 40 GB | 51M | all chains; Sonic 100 d slice is a few hundred MB |
| `events_gnosis/base/polygon/...` | ~105 GB | | gone |
| `events_sonic` | 10 GB | 9.2M | 90 d slice ~1–1.5 GB |
| `PrismaPoolSnapshot` | 4.2 GB | 6.4M | Sonic slice ~300–400 MB, copy all |
| `PrismaPoolDynamicData` | 2.2 GB | 18.5k | pure bloat from 20–30 s upserts |
| `PrismaPool` | 1.2 GB | 18k | bloat |
| `PrismaUserWalletBalance` | 527 MB | 183k | bloat |
| `quant_weights` | 147 MB | 560k | copy Sonic pools |

New DB estimate: 2–3 GB, stable. Render Postgres Basic-1gb to start.

### Subgraphs (Ormi, unchanged)
Both v2 and v3 subgraphs are "smol": no snapshots, no USD prices, `User` removed, and `storeEventsFrom` is set to chain head on every bump so Swap/JoinExit entities only exist since the last redeploy. They provide current state only (pools, params, balances, `PoolShare`, holder counts, v3 cumulative volume/fee counters). Backend keeps owning all history and pricing.

### Frontend (`frontend-monorepo`, Vercel)
- Beets app `apps/beets-frontend-v3`, chains `[SONIC]`, `networksForProtocolStats` adds `FANTOM`.
- All GraphQL documents in `packages/lib/shared/services/api/*.graphql`. Codegen introspects the live API at build time.
- Root fields used by Beets: `poolGetPool(s)`, `poolGetPoolsCount`, `poolGetFeaturedPools`, `poolGetSnapshots` (30/90/180/ALL), `poolEvents` (first 500), `tokenGetTokens`, `tokenGetCurrentPrices` (poll 3 min), `sorGetSwapPaths`, `protocolMetricsAggregated/Chain`, `lbpPriceChart`, `fixedLbpPriceChart`, `createLBP`, `stsGetGqlStakedSonicData`, `loopsGetData`, `beetsPoolGetReliquaryFarmSnapshots`.
- `packages/lib/shared/hooks/useApiHealth.ts` polls `veBalGetTotalSupply(MAINNET)` every 15 s as the NavBar health probe in both apps. Must be repointed when veBAL is removed.

## 3. Target architecture

| Piece | Render | Notes |
|---|---|---|
| `api` | web service, Standard (1 CPU / 2 GB) | `PROTOCOL=beethoven`, Apollo response cache plugin replaces Stellate |
| `sor` | web service, private, Starter or Standard | `SOR_INSTANCE=true`, reached over Render private network via `SOR_SERVICE_URL` |
| `worker` | background service, Standard | scheduler + worker in one process, `WORKER_QUEUE_URL=http://localhost:<port>` |
| Postgres | Basic-1gb, upgrade in place if needed | `prisma migrate deploy` as pre-deploy command |
| Preview | Render preview envs + ephemeral DB | per PR |
| Edge | Cloudflare CNAME to Render, per-IP rate-limit rule on `/graphql` | replaces WAF + nginx `limit_req` |
| Alerts | Sentry cron monitors per job | replaces CloudWatch alarms |

### Cost estimate (Render list prices as of 2026-09-16, USD/month)

| Item | Lean | Comfortable | Render plan |
|---|---|---|---|
| Workspace (Pro needed for full-stack preview envs, unlimited seats) | 25 | 25 | Pro |
| `api` web service | 25 | 25 | 1c-2g |
| `sor` private web service | 7 | 25 | 0.5c-512mb / 1c-2g |
| `worker` background service | 25 | 85 | 1c-2g / 2c-4g |
| Postgres | 19 | 40 | 0.5c-1g / 1c-2g |
| Postgres extra storage (1 GB included, 0.30/GB) | 2 | 3 | ~5–10 GB |
| Bandwidth (25 GB included on Pro, then 0.15/GB) | 0 | 5 | ~15 GB/mo expected |
| Preview env while open (0.5c services + 256 MB DB, prorated by the second) | ~1/day | ~1/day | |
| **Total** | **~103** | **~208** | vs 3,249 today |

Included on Pro: 1K build minutes, 14 d log retention, PITR 7 d, private networking, zero-downtime deploys, pre-deploy command, horizontal autoscaling if ever needed. Full compute table: 0.5c-512mb 7, 1c-2g 25, 2c-4g 85, 2c-8g 135, 4c-8g 175. Postgres: 0.1c-256mb 6, 0.5c-1g 19, 1c-2g 40, 1c-4g 55, 2c-4g 75, 2c-8g 100.

## 4. Implementation phases

### Phase 0 progress (2026-09-23)
Done in the working tree (build green, not committed, DB not migrated): chains stripped to Sonic (user), veBAL/CoW/FX/datastudio/sftmx removed (user), dead code sweep + Prisma model trim + GQL trim + env/deps cleanup + migration squash to `prisma/migrations/0_init` (Claude). Still open from the list below: item 5 (AWS transport/metrics out), item 8 (Apollo response cache), item 9 (Dockerfile + render.yaml), item 10 (fix remaining test files that still use MAINNET/SEPOLIA/FANTOM literals). Frontend follow-ups are listed in section 7. Also removed on 2026-09-23 round 2: all `surplus*` fields (dynamic data, snapshots, protocol metrics, swap events); aggregator API kept. Round 3: nested-pool support removed internally (no nested pools on Sonic): `PrismaPoolExpandedTokens` table, `PrismaPoolToken.nestedPoolId`, nested includes, nested-pool APR handler. GraphQL surface unchanged: `hasNestedPool`/`nestedPool`/`hasNestedErc4626`/`GqlNestedPool` were then removed together with every other `@deprecated` field (round 4): `poolGetAggregatorPools`, deprecated `GqlAggregatorPoolFilter` inputs, `GqlPoolAggregator.owner`, `GqlHook.name` + 10 legacy flags + `dynamicData`/`GqlHookData`, `hasNestedErc4626`/`hasNestedPool`/`nestedPool`/`GqlNestedPool`/`NESTED`, `GqlPoolEventsFilter.poolIdIn/typeIn`, protocol `totalSwapVolume/totalSwapFee`, SOR `queryBatchSwap`/`callDataInput`/`callData`/`vaultVersion`, `GqlToken.rateProviderData`, `GqlTokenType.WHITE_LISTED`.

### Phase 0: fork + strip (one PR each)
1. **Chains.** Delete every `config/*.ts` except `sonic.ts`. Move `activeChainWorkerJobsGlobal` onto Sonic. Keep the Prisma and GQL `Chain` enums for now (they leak into UI enum guards and migrations); empty partitions for dead chains are harmless.
2. **Squash migrations** to a single baseline with `prisma migrate diff`. Fresh DB anyway.
3. **veBAL out.** `modules/vebal`, `apps/api/gql/schema/vebal.gql` + `vebal.resolvers.ts`, `sync-vebal-*` jobs, `modules/aprs/handlers/vebal-apr`, models `PrismaVeBalUserBalance`, `PrismaVeBalTotalSupply`, `PrismaVotingGauge`, `PrismaVeBalUserBalanceSnapshot`, `PrismaPoolStakingVebal`. Keep `liquidity-gauge-apr`, gauge staking sync, `beetswars-gauge-voting-apr-handler`.
4. **Dead weight.** CoW AMM module + jobs, fx jobs, sftmx/fbeets/pool-filter/user-snapshot models, datastudio module, Sanity dependency and env var, `user-snapshot-subgraph`.
5. **AWS out.** SQS SDK; `apps/main.ts` starts scheduler + worker together when both flags set; delete CloudWatch clients and `apps/scheduler/create-alerts.ts`; Secrets Manager; `.platform/`, `.ebextensions/`, `buildspec.yml`. Add Sentry cron check-ins in `job-handlers.ts`. Make `AWS_REGION` optional in `apps/env.ts`.
6. **Retention.** Daily jobs: delete `events_sonic` rows older than 90 d, delete `PrismaTokenPrice` rows older than 100 d (replace the current hourly-to-daily purge).
7. **Cadence.** `config/worker-jobs.ts` main intervals: balances 120 s, pool sync 60 s, APRs 10 m.
8. **Cache.** `@apollo/server-plugin-response-cache`, port maxAge/scope rules from `stellate/backend/stellate.js`.
9. **Deploy files.** Dockerfile (bun install, prisma generate, tsc) and `render.yaml` blueprint for the four services + preview envs.
10. **Tests.** Fix `modules/tests-helper/setupTestDatabase.ts` schema path (points at the removed `prisma/schema.prisma`), get vitest green for sor + Sonic modules, run tests in `checks.yml`.

### Phase 1: Render up
Blueprint deploy. Env vars: `DATABASE_URL`, `DIRECT_API_KEY`, `COINGECKO_API_KEY`, `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `ADMIN_API_KEY`, plus whichever APR API keys the Sonic handlers use.

### Phase 2: history slice copy (one-shot script)
Over the existing DB tunnel, `\copy (SELECT ... WHERE chain='SONIC') TO file` then `\copy FROM` into Render:
- `PrismaPoolSnapshot` all Sonic rows
- `PrismaTokenPrice` Sonic, last 100 d
- `events_sonic` last 90 d
- `PrismaReliquaryFarmSnapshot` + `PrismaReliquaryLevelSnapshot`
- `PrismaSonicStakingDataSnapshot`
- `quant_weights` for Sonic pools

Everything else re-syncs from Ormi + RPC.

### Phase 3: parallel run
Fire the four admin bootstrap mutations (`poolSyncAllPoolsFromSubgraph`, `poolReloadStakingForAllPools`, `userInitWalletBalancesForAllPools`, `userInitStakedBalances`). Let it sync live for a few days. Diff script comparing old vs new API on the Beets root fields. Watch Sentry and Render metrics, adjust tiers.

### Phase 4: cutover
UI PR in `frontend-monorepo`: `useApiHealth` to `poolGetPoolsCount`, drop `FANTOM` from `networksForProtocolStats` in `packages/lib/config/projects/beets.ts`. Cloudflare: CNAME `backend-v3.beets-ftm-node.com` to Render custom domain, add rate-limit rule. No data delta needed; the new stack has produced its own snapshots since phase 2.

### Phase 5: AWS teardown (one week after cutover, only once Balancer is off the account or scoped to Beets resources)
Final RDS snapshot kept 30 d. Then EB envs, ALBs, Global Accelerator, WAF, NAT gateways, SQS queues, CodePipeline/CodeBuild, KMS keys, S3 artifact buckets, stale `DevEbs-22` / `DevCodePipeline-22` stacks, `cdk.context.json` references to eu-west-3 and account `837533371577`. Console work with a checklist; CDK destroy is broken.

Effort: phase 0 about 3–5 focused days; whole thing about 2 weeks wall-clock including the parallel run.

## 5. Security items found during mapping (fix regardless)
- `balancer-subgraph-v3/scripts/deploy-manual.ps1` has a hardcoded Ormi deploy key committed. Rotate it and remove from the file.
- `backend-cdk/lib/bastion-host-stack.ts` is dead code with SSH open to 0.0.0.0/0 and hardcoded keys. Verify no bastion stack is still deployed.
- RDS documented as unencrypted at rest, PostgreSQL 14.6 with auto-minor-upgrade disabled.
- `.ebextensions/authorized_keys.config` bakes two SSH public keys into the deploy artifact.
- `backend/.env` has a typo'd `COINGEKCO_API_KEY`.

## 6. Reference
- Cost export used: `Downloads/costs (4).csv` (Jun–Aug 2026).
- Load dashboard: CloudWatch shared dashboard `status-page-main-share`.
- Sizing query used:
  ```sql
  SELECT relname, pg_size_pretty(pg_total_relation_size(oid)) AS size, n_live_tup
  FROM pg_class c JOIN pg_stat_user_tables s USING (relname)
  WHERE relkind='r' ORDER BY pg_total_relation_size(oid) DESC LIMIT 25;
  ```
