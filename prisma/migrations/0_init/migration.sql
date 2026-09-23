-- CreateEnum
CREATE TYPE "Chain" AS ENUM ('SONIC');

-- CreateEnum
CREATE TYPE "PrismaLastBlockSyncedCategory" AS ENUM ('POOLS', 'POOLS_V3', 'ADD_POOLS_V3', 'SNAPSHOTS', 'BPT_BALANCES_V2', 'BPT_BALANCES_V3', 'GAUGE_BALANCES', 'JOIN_EXITS_V2', 'SWAPS_V2', 'JOIN_EXITS_V3', 'SWAPS_V3');

-- CreateEnum
CREATE TYPE "PrismaPoolType" AS ENUM ('WEIGHTED', 'STABLE', 'COMPOSABLE_STABLE', 'UNKNOWN', 'LIQUIDITY_BOOTSTRAPPING', 'GYRO', 'GYRO3', 'GYROE', 'QUANT_AMM_WEIGHTED', 'RECLAMM', 'FIXED_LBP');

-- CreateEnum
CREATE TYPE "PrismaPoolAprType" AS ENUM ('DYNAMIC_SWAP_FEE_24H', 'SWAP_FEE_24H', 'IB_YIELD', 'VOTING', 'MERKL', 'QUANT_AMM_UPLIFT', 'STAKING', 'STAKING_BOOST', 'MABEETS_EMISSIONS');

-- CreateEnum
CREATE TYPE "PrismaPoolStakingType" AS ENUM ('GAUGE', 'RELIQUARY');

-- CreateEnum
CREATE TYPE "PrismaPoolStakingGaugeStatus" AS ENUM ('KILLED', 'ACTIVE', 'PREFERRED');

-- CreateEnum
CREATE TYPE "PoolEventType" AS ENUM ('JOIN', 'EXIT', 'SWAP');

-- CreateEnum
CREATE TYPE "PrismaTokenTypeOption" AS ENUM ('WHITE_LISTED', 'BLOCKED_V2', 'BLOCKED_V3', 'BPT', 'PHANTOM_BPT', 'ERC4626');

-- CreateEnum
CREATE TYPE "PrismaUserBalanceType" AS ENUM ('RELIQUARY');

-- CreateTable
CREATE TABLE "PrismaLastBlockSynced" (
    "category" "PrismaLastBlockSyncedCategory" NOT NULL,
    "chain" "Chain" NOT NULL DEFAULT 'SONIC',
    "blockNumber" INTEGER NOT NULL,

    CONSTRAINT "PrismaLastBlockSynced_pkey" PRIMARY KEY ("category","chain")
);

-- CreateTable
CREATE TABLE "PrismaLoopsData" (
    "id" TEXT NOT NULL,
    "nav" TEXT NOT NULL,
    "tvl" TEXT NOT NULL,
    "actualSupply" TEXT NOT NULL,
    "rate" TEXT NOT NULL,
    "collateralAmount" TEXT NOT NULL,
    "collateralAmountInEth" TEXT NOT NULL,
    "debtAmount" TEXT NOT NULL,
    "healthFactor" TEXT NOT NULL,
    "leverage" DOUBLE PRECISION NOT NULL,
    "totalApr" DOUBLE PRECISION NOT NULL,
    "stsAaveMarketSupplyCap" TEXT NOT NULL,
    "stsAaveMarketSupply" TEXT NOT NULL,
    "wSAaveMarketSupplyCap" TEXT NOT NULL,
    "wSAaveMarketBorrowCap" TEXT NOT NULL,
    "wSAaveMarketBorrowed" TEXT NOT NULL,

    CONSTRAINT "PrismaLoopsData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrismaPool" (
    "id" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "createTime" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PrismaPoolType" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "pauseManager" TEXT,
    "swapFeeManager" TEXT NOT NULL,
    "poolCreator" TEXT,
    "factory" TEXT,
    "protocolVersion" INTEGER NOT NULL DEFAULT 2,
    "search_vector" tsvector,
    "typeData" JSONB NOT NULL DEFAULT '{}',
    "liquidityManagement" JSONB NOT NULL DEFAULT '{}',
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hook" JSONB,

    CONSTRAINT "PrismaPool_pkey" PRIMARY KEY ("id","chain")
);

-- CreateTable
CREATE TABLE "PrismaPoolDynamicData" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "protocolYieldFee" TEXT,
    "protocolSwapFee" TEXT NOT NULL DEFAULT '0',
    "swapFee" TEXT NOT NULL DEFAULT '0',
    "aggregateSwapFee" TEXT NOT NULL DEFAULT '0',
    "aggregateYieldFee" TEXT NOT NULL DEFAULT '0',
    "swapEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "isInRecoveryMode" BOOLEAN NOT NULL DEFAULT false,
    "totalShares" TEXT NOT NULL,
    "totalSharesNum" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalLiquidity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "volume24h" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fees24h" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yieldCapture24h" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "protocolFees24h" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "protocolYieldCapture24h" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "apr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "volume48h" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fees48h" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yieldCapture48h" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "protocolFees48h" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "protocolYieldCapture48h" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalLiquidity24hAgo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalShares24hAgo" TEXT NOT NULL DEFAULT '0',
    "lifetimeVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lifetimeSwapFees" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "holdersCount" INTEGER NOT NULL DEFAULT 0,
    "swapsCount" INTEGER NOT NULL DEFAULT 0,
    "tokenPairsData" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "PrismaPoolDynamicData_pkey" PRIMARY KEY ("id","chain")
);

-- CreateTable
CREATE TABLE "PrismaPoolToken" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "address" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "priceRateProvider" TEXT,
    "exemptFromProtocolYieldFee" BOOLEAN NOT NULL DEFAULT false,
    "scalingFactor" TEXT,
    "balance" TEXT NOT NULL,
    "balanceUSD" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weight" TEXT,
    "priceRate" TEXT NOT NULL DEFAULT '1.0',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrismaPoolToken_pkey" PRIMARY KEY ("id","chain")
);

-- CreateTable
CREATE TABLE "PrismaPoolAprItem" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "title" TEXT NOT NULL,
    "rewardTokenAddress" TEXT,
    "rewardTokenSymbol" TEXT,
    "apr" DOUBLE PRECISION NOT NULL,
    "type" "PrismaPoolAprType",

    CONSTRAINT "PrismaPoolAprItem_pkey" PRIMARY KEY ("id","chain")
);

-- CreateTable
CREATE TABLE "PrismaPoolStaking" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "type" "PrismaPoolStakingType" NOT NULL,
    "address" TEXT NOT NULL,

    CONSTRAINT "PrismaPoolStaking_pkey" PRIMARY KEY ("id","chain")
);

-- CreateTable
CREATE TABLE "PrismaPoolStakingGauge" (
    "id" TEXT NOT NULL,
    "stakingId" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "gaugeAddress" TEXT NOT NULL,
    "status" "PrismaPoolStakingGaugeStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "workingSupply" TEXT NOT NULL DEFAULT '0.0',
    "totalSupply" TEXT NOT NULL DEFAULT '0.0',

    CONSTRAINT "PrismaPoolStakingGauge_pkey" PRIMARY KEY ("id","chain")
);

-- CreateTable
CREATE TABLE "PrismaPoolStakingGaugeReward" (
    "id" TEXT NOT NULL,
    "gaugeId" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "rewardPerSecond" TEXT NOT NULL,

    CONSTRAINT "PrismaPoolStakingGaugeReward_pkey" PRIMARY KEY ("id","chain")
);

-- CreateTable
CREATE TABLE "PrismaPoolStakingReliquaryFarm" (
    "id" TEXT NOT NULL,
    "stakingId" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "name" TEXT NOT NULL,
    "beetsPerSecond" TEXT NOT NULL,
    "totalBalance" TEXT NOT NULL DEFAULT '0',
    "totalWeightedBalance" TEXT NOT NULL DEFAULT '0',

    CONSTRAINT "PrismaPoolStakingReliquaryFarm_pkey" PRIMARY KEY ("id","chain")
);

-- CreateTable
CREATE TABLE "PrismaPoolStakingReliquaryFarmLevel" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "level" INTEGER NOT NULL,
    "balance" TEXT NOT NULL,
    "requiredMaturity" INTEGER NOT NULL,
    "allocationPoints" INTEGER NOT NULL,
    "apr" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PrismaPoolStakingReliquaryFarmLevel_pkey" PRIMARY KEY ("id","chain")
);

-- CreateTable
CREATE TABLE "PrismaPoolSnapshot" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "totalLiquidity" DOUBLE PRECISION NOT NULL,
    "sharePrice" DOUBLE PRECISION NOT NULL,
    "volume24h" DOUBLE PRECISION NOT NULL,
    "fees24h" DOUBLE PRECISION NOT NULL,
    "totalShares" TEXT NOT NULL,
    "totalSharesNum" DOUBLE PRECISION NOT NULL,
    "swapsCount" INTEGER NOT NULL,
    "amounts" TEXT[],

    CONSTRAINT "PrismaPoolSnapshot_pkey" PRIMARY KEY ("id","chain")
);

-- CreateTable
CREATE TABLE "PrismaReliquaryFarmSnapshot" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "relicCount" INTEGER NOT NULL,
    "userCount" INTEGER NOT NULL,
    "totalBalance" TEXT NOT NULL,
    "dailyDeposited" TEXT NOT NULL,
    "dailyWithdrawn" TEXT NOT NULL,
    "totalLiquidity" TEXT NOT NULL DEFAULT '0',

    CONSTRAINT "PrismaReliquaryFarmSnapshot_pkey" PRIMARY KEY ("id","chain")
);

-- CreateTable
CREATE TABLE "PrismaReliquaryLevelSnapshot" (
    "id" TEXT NOT NULL,
    "farmSnapshotId" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "level" TEXT NOT NULL,
    "balance" TEXT NOT NULL,

    CONSTRAINT "PrismaReliquaryLevelSnapshot_pkey" PRIMARY KEY ("id","chain")
);

-- CreateTable
CREATE TABLE "PartitionedPoolEvent" (
    "id" TEXT NOT NULL,
    "tx" TEXT NOT NULL,
    "type" "PoolEventType" NOT NULL,
    "chain" "Chain" NOT NULL,
    "poolId" TEXT NOT NULL,
    "userAddress" TEXT NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "blockTimestamp" INTEGER NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "protocolVersion" INTEGER NOT NULL DEFAULT 2,
    "valueUSD" DOUBLE PRECISION NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "PartitionedPoolEvent_pkey" PRIMARY KEY ("id","chain")
);

-- CreateTable
CREATE TABLE "quant_weights" (
    "id" SERIAL NOT NULL,
    "pool" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "weight1" DOUBLE PRECISION NOT NULL,
    "weight2" DOUBLE PRECISION NOT NULL,
    "weight3" DOUBLE PRECISION,
    "weight4" DOUBLE PRECISION,
    "weight5" DOUBLE PRECISION,
    "weight6" DOUBLE PRECISION,
    "weight7" DOUBLE PRECISION,
    "weight8" DOUBLE PRECISION,

    CONSTRAINT "quant_weights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrismaStakedSonicData" (
    "id" TEXT NOT NULL,
    "totalAssets" TEXT NOT NULL,
    "totalAssetsDelegated" TEXT NOT NULL,
    "totalAssetsPool" TEXT NOT NULL,
    "stakingApr" TEXT NOT NULL,
    "exchangeRate" TEXT NOT NULL,
    "protocolFee24h" TEXT NOT NULL DEFAULT '0',
    "rewardsClaimed24h" TEXT NOT NULL DEFAULT '0',

    CONSTRAINT "PrismaStakedSonicData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrismaStakedSonicDelegatedValidator" (
    "validatorId" TEXT NOT NULL,
    "sonicStakingId" TEXT NOT NULL,
    "assetsDelegated" TEXT NOT NULL,

    CONSTRAINT "PrismaStakedSonicDelegatedValidator_pkey" PRIMARY KEY ("validatorId")
);

-- CreateTable
CREATE TABLE "PrismaSonicStakingDataSnapshot" (
    "id" TEXT NOT NULL,
    "sonicStakingId" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "totalAssetsPool" TEXT NOT NULL,
    "totalAssetsDelegated" TEXT NOT NULL,
    "totalAssets" TEXT NOT NULL,
    "exchangeRate" TEXT NOT NULL,
    "protocolFee24h" TEXT NOT NULL DEFAULT '0',
    "rewardsClaimed24h" TEXT NOT NULL DEFAULT '0',

    CONSTRAINT "PrismaSonicStakingDataSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrismaTokenYield" (
    "address" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "apr" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrismaTokenYield_pkey" PRIMARY KEY ("address","chain")
);

-- CreateTable
CREATE TABLE "PrismaToken" (
    "address" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "decimals" INTEGER NOT NULL,
    "logoURI" TEXT,
    "websiteUrl" TEXT,
    "discordUrl" TEXT,
    "telegramUrl" TEXT,
    "twitterUsername" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "coingeckoPlatformId" TEXT,
    "coingeckoTokenId" TEXT,
    "excludedFromCoingecko" BOOLEAN NOT NULL DEFAULT false,
    "underlyingTokenAddress" TEXT,
    "isBufferAllowed" BOOLEAN NOT NULL DEFAULT true,
    "unwrapRate" TEXT NOT NULL DEFAULT '1',
    "maxDeposit" TEXT NOT NULL DEFAULT '0',
    "maxWithdraw" TEXT NOT NULL DEFAULT '0',
    "tvl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bufferBalanceUnderlying" TEXT NOT NULL DEFAULT '0',
    "bufferBalanceWrapped" TEXT NOT NULL DEFAULT '0',

    CONSTRAINT "PrismaToken_pkey" PRIMARY KEY ("address","chain")
);

-- CreateTable
CREATE TABLE "PrismaTokenCurrentPrice" (
    "tokenAddress" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "timestamp" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PrismaTokenCurrentPrice_pkey" PRIMARY KEY ("tokenAddress","chain")
);

-- CreateTable
CREATE TABLE "PrismaTokenPrice" (
    "tokenAddress" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "timestamp" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PrismaTokenPrice_pkey" PRIMARY KEY ("tokenAddress","timestamp","chain")
);

-- CreateTable
CREATE TABLE "PrismaTokenType" (
    "id" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "type" "PrismaTokenTypeOption" NOT NULL,

    CONSTRAINT "PrismaTokenType_pkey" PRIMARY KEY ("id","chain")
);

-- CreateTable
CREATE TABLE "PrismaPriceRateProviderData" (
    "chain" "Chain" NOT NULL,
    "rateProviderAddress" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "reviewed" BOOLEAN NOT NULL,
    "name" TEXT,
    "summary" TEXT,
    "reviewUrl" TEXT,
    "warnings" TEXT,
    "upgradableComponents" JSONB,

    CONSTRAINT "PrismaPriceRateProviderData_pkey" PRIMARY KEY ("chain","rateProviderAddress")
);

-- CreateTable
CREATE TABLE "PrismaErc4626ReviewData" (
    "chain" "Chain" NOT NULL,
    "erc4626Address" TEXT NOT NULL,
    "assetAddress" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "reviewFile" TEXT NOT NULL,
    "warnings" TEXT NOT NULL,
    "canUseBufferForSwaps" BOOLEAN NOT NULL DEFAULT false,
    "useUnderlyingForAddRemove" BOOLEAN NOT NULL DEFAULT false,
    "useWrappedForAddRemove" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PrismaErc4626ReviewData_pkey" PRIMARY KEY ("chain","erc4626Address")
);

-- CreateTable
CREATE TABLE "PrismaUser" (
    "address" TEXT NOT NULL,

    CONSTRAINT "PrismaUser_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "PrismaUserWalletBalance" (
    "id" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "balance" TEXT NOT NULL,
    "balanceNum" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userAddress" TEXT NOT NULL,
    "poolId" TEXT,
    "tokenAddress" TEXT NOT NULL,

    CONSTRAINT "PrismaUserWalletBalance_pkey" PRIMARY KEY ("id","chain")
);

-- CreateTable
CREATE TABLE "PrismaUserStakedBalance" (
    "id" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "balance" TEXT NOT NULL,
    "balanceNum" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userAddress" TEXT NOT NULL,
    "poolId" TEXT,
    "tokenAddress" TEXT NOT NULL,
    "stakingId" TEXT NOT NULL,

    CONSTRAINT "PrismaUserStakedBalance_pkey" PRIMARY KEY ("id","chain")
);

-- CreateTable
CREATE TABLE "PrismaUserBalanceSyncStatus" (
    "type" "PrismaUserBalanceType" NOT NULL,
    "chain" "Chain" NOT NULL,
    "blockNumber" INTEGER NOT NULL,

    CONSTRAINT "PrismaUserBalanceSyncStatus_pkey" PRIMARY KEY ("type","chain")
);

-- CreateIndex
CREATE INDEX "PrismaPool_id_chain_idx" ON "PrismaPool"("id", "chain");

-- CreateIndex
CREATE INDEX "PrismaPool_categories_idx" ON "PrismaPool" USING GIN ("categories" array_ops);

-- CreateIndex
CREATE INDEX "PrismaPool_search_vector_idx" ON "PrismaPool" USING GIN ("search_vector");

-- CreateIndex
CREATE UNIQUE INDEX "PrismaPool_address_chain_key" ON "PrismaPool"("address", "chain");

-- CreateIndex
CREATE INDEX "PrismaPoolDynamicData_totalLiquidity_idx" ON "PrismaPoolDynamicData"("totalLiquidity");

-- CreateIndex
CREATE INDEX "PrismaPoolDynamicData_totalSharesNum_idx" ON "PrismaPoolDynamicData"("totalSharesNum" DESC);

-- CreateIndex
CREATE INDEX "PrismaPoolDynamicData_volume24h_idx" ON "PrismaPoolDynamicData"("volume24h");

-- CreateIndex
CREATE INDEX "PrismaPoolDynamicData_apr_idx" ON "PrismaPoolDynamicData"("apr");

-- CreateIndex
CREATE UNIQUE INDEX "PrismaPoolDynamicData_poolId_chain_key" ON "PrismaPoolDynamicData"("poolId", "chain");

-- CreateIndex
CREATE INDEX "PrismaPoolToken_id_chain_idx" ON "PrismaPoolToken"("id", "chain");

-- CreateIndex
CREATE INDEX "PrismaPoolToken_poolId_chain_idx" ON "PrismaPoolToken"("poolId", "chain");

-- CreateIndex
CREATE INDEX "PrismaPoolToken_address_chain_idx" ON "PrismaPoolToken"("address", "chain");

-- CreateIndex
CREATE INDEX "PrismaPoolAprItem_poolId_chain_idx" ON "PrismaPoolAprItem"("poolId", "chain");

-- CreateIndex
CREATE INDEX "PrismaPoolAprItem_chain_type_idx" ON "PrismaPoolAprItem"("chain", "type");

-- CreateIndex
CREATE INDEX "PrismaPoolStaking_poolId_chain_idx" ON "PrismaPoolStaking"("poolId", "chain");

-- CreateIndex
CREATE UNIQUE INDEX "PrismaPoolStakingGauge_stakingId_chain_key" ON "PrismaPoolStakingGauge"("stakingId", "chain");

-- CreateIndex
CREATE INDEX "PrismaPoolStakingGaugeReward_gaugeId_chain_idx" ON "PrismaPoolStakingGaugeReward"("gaugeId", "chain");

-- CreateIndex
CREATE UNIQUE INDEX "PrismaPoolStakingReliquaryFarm_stakingId_chain_key" ON "PrismaPoolStakingReliquaryFarm"("stakingId", "chain");

-- CreateIndex
CREATE INDEX "PrismaPoolStakingReliquaryFarmLevel_farmId_chain_idx" ON "PrismaPoolStakingReliquaryFarmLevel"("farmId", "chain");

-- CreateIndex
CREATE INDEX "PrismaPoolSnapshot_timestamp_idx" ON "PrismaPoolSnapshot"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "PrismaPoolSnapshot_poolId_chain_idx" ON "PrismaPoolSnapshot"("poolId", "chain");

-- CreateIndex
CREATE INDEX "PrismaReliquaryFarmSnapshot_farmId_chain_idx" ON "PrismaReliquaryFarmSnapshot"("farmId", "chain");

-- CreateIndex
CREATE INDEX "PrismaReliquaryLevelSnapshot_farmSnapshotId_chain_idx" ON "PrismaReliquaryLevelSnapshot"("farmSnapshotId", "chain");

-- CreateIndex
CREATE INDEX "PartitionedPoolEvent_chain_type_blockTimestamp_blockNumber__idx" ON "PartitionedPoolEvent"("chain", "type", "blockTimestamp" DESC, "blockNumber" DESC, "logIndex" DESC);

-- CreateIndex
CREATE INDEX "PartitionedPoolEvent_chain_poolId_blockTimestamp_blockNumbe_idx" ON "PartitionedPoolEvent"("chain", "poolId", "blockTimestamp" DESC, "blockNumber" DESC, "logIndex" DESC);

-- CreateIndex
CREATE INDEX "PartitionedPoolEvent_chain_userAddress_idx" ON "PartitionedPoolEvent"("chain", "userAddress");

-- CreateIndex
CREATE INDEX "quant_weights_pool_chain_timestamp_idx" ON "quant_weights"("pool", "chain", "timestamp");

-- CreateIndex
CREATE INDEX "PrismaTokenYield_chain_address_idx" ON "PrismaTokenYield"("chain", "address");

-- CreateIndex
CREATE INDEX "PrismaToken_address_chain_idx" ON "PrismaToken"("address", "chain");

-- CreateIndex
CREATE INDEX "PrismaToken_tvl_idx" ON "PrismaToken"("tvl" DESC);

-- CreateIndex
CREATE INDEX "PrismaTokenCurrentPrice_tokenAddress_idx" ON "PrismaTokenCurrentPrice"("tokenAddress");

-- CreateIndex
CREATE INDEX "PrismaTokenCurrentPrice_chain_idx" ON "PrismaTokenCurrentPrice"("chain");

-- CreateIndex
CREATE UNIQUE INDEX "PrismaTokenCurrentPrice_tokenAddress_chain_key" ON "PrismaTokenCurrentPrice"("tokenAddress", "chain");

-- CreateIndex
CREATE INDEX "PrismaTokenPrice_timestamp_chain_idx" ON "PrismaTokenPrice"("timestamp", "chain");

-- CreateIndex
CREATE INDEX "PrismaTokenPrice_tokenAddress_chain_idx" ON "PrismaTokenPrice"("tokenAddress", "chain");

-- CreateIndex
CREATE UNIQUE INDEX "PrismaTokenType_tokenAddress_type_chain_key" ON "PrismaTokenType"("tokenAddress", "type", "chain");

-- CreateIndex
CREATE INDEX "PrismaPriceRateProviderData_chain_rateProviderAddress_idx" ON "PrismaPriceRateProviderData"("chain", "rateProviderAddress");

-- CreateIndex
CREATE INDEX "PrismaPriceRateProviderData_tokenAddress_idx" ON "PrismaPriceRateProviderData"("tokenAddress");

-- CreateIndex
CREATE INDEX "PrismaErc4626ReviewData_chain_erc4626Address_idx" ON "PrismaErc4626ReviewData"("chain", "erc4626Address");

-- CreateIndex
CREATE INDEX "PrismaErc4626ReviewData_assetAddress_idx" ON "PrismaErc4626ReviewData"("assetAddress");

-- CreateIndex
CREATE INDEX "PrismaUserWalletBalance_userAddress_idx" ON "PrismaUserWalletBalance"("userAddress");

-- CreateIndex
CREATE INDEX "PrismaUserWalletBalance_poolId_chain_idx" ON "PrismaUserWalletBalance"("poolId", "chain");

-- CreateIndex
CREATE INDEX "PrismaUserStakedBalance_userAddress_idx" ON "PrismaUserStakedBalance"("userAddress");

-- CreateIndex
CREATE INDEX "PrismaUserStakedBalance_poolId_chain_idx" ON "PrismaUserStakedBalance"("poolId", "chain");

-- CreateIndex
CREATE INDEX "PrismaUserStakedBalance_stakingId_chain_idx" ON "PrismaUserStakedBalance"("stakingId", "chain");

-- AddForeignKey
ALTER TABLE "PrismaPoolDynamicData" ADD CONSTRAINT "PrismaPoolDynamicData_poolId_chain_fkey" FOREIGN KEY ("poolId", "chain") REFERENCES "PrismaPool"("id", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrismaPoolToken" ADD CONSTRAINT "PrismaPoolToken_poolId_chain_fkey" FOREIGN KEY ("poolId", "chain") REFERENCES "PrismaPool"("id", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrismaPoolToken" ADD CONSTRAINT "PrismaPoolToken_address_chain_fkey" FOREIGN KEY ("address", "chain") REFERENCES "PrismaToken"("address", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrismaPoolAprItem" ADD CONSTRAINT "PrismaPoolAprItem_poolId_chain_fkey" FOREIGN KEY ("poolId", "chain") REFERENCES "PrismaPool"("id", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrismaPoolStaking" ADD CONSTRAINT "PrismaPoolStaking_poolId_chain_fkey" FOREIGN KEY ("poolId", "chain") REFERENCES "PrismaPool"("id", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrismaPoolStakingGauge" ADD CONSTRAINT "PrismaPoolStakingGauge_stakingId_chain_fkey" FOREIGN KEY ("stakingId", "chain") REFERENCES "PrismaPoolStaking"("id", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrismaPoolStakingGaugeReward" ADD CONSTRAINT "PrismaPoolStakingGaugeReward_gaugeId_chain_fkey" FOREIGN KEY ("gaugeId", "chain") REFERENCES "PrismaPoolStakingGauge"("id", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrismaPoolStakingReliquaryFarm" ADD CONSTRAINT "PrismaPoolStakingReliquaryFarm_stakingId_chain_fkey" FOREIGN KEY ("stakingId", "chain") REFERENCES "PrismaPoolStaking"("id", "chain") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrismaPoolStakingReliquaryFarmLevel" ADD CONSTRAINT "PrismaPoolStakingReliquaryFarmLevel_farmId_chain_fkey" FOREIGN KEY ("farmId", "chain") REFERENCES "PrismaPoolStakingReliquaryFarm"("id", "chain") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrismaPoolSnapshot" ADD CONSTRAINT "PrismaPoolSnapshot_poolId_chain_fkey" FOREIGN KEY ("poolId", "chain") REFERENCES "PrismaPool"("id", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrismaReliquaryFarmSnapshot" ADD CONSTRAINT "PrismaReliquaryFarmSnapshot_farmId_chain_fkey" FOREIGN KEY ("farmId", "chain") REFERENCES "PrismaPoolStakingReliquaryFarm"("id", "chain") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrismaReliquaryLevelSnapshot" ADD CONSTRAINT "PrismaReliquaryLevelSnapshot_farmSnapshotId_chain_fkey" FOREIGN KEY ("farmSnapshotId", "chain") REFERENCES "PrismaReliquaryFarmSnapshot"("id", "chain") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrismaStakedSonicDelegatedValidator" ADD CONSTRAINT "PrismaStakedSonicDelegatedValidator_sonicStakingId_fkey" FOREIGN KEY ("sonicStakingId") REFERENCES "PrismaStakedSonicData"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrismaSonicStakingDataSnapshot" ADD CONSTRAINT "PrismaSonicStakingDataSnapshot_sonicStakingId_fkey" FOREIGN KEY ("sonicStakingId") REFERENCES "PrismaStakedSonicData"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrismaTokenCurrentPrice" ADD CONSTRAINT "PrismaTokenCurrentPrice_tokenAddress_chain_fkey" FOREIGN KEY ("tokenAddress", "chain") REFERENCES "PrismaToken"("address", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrismaTokenPrice" ADD CONSTRAINT "PrismaTokenPrice_tokenAddress_chain_fkey" FOREIGN KEY ("tokenAddress", "chain") REFERENCES "PrismaToken"("address", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrismaTokenType" ADD CONSTRAINT "PrismaTokenType_tokenAddress_chain_fkey" FOREIGN KEY ("tokenAddress", "chain") REFERENCES "PrismaToken"("address", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrismaUserWalletBalance" ADD CONSTRAINT "PrismaUserWalletBalance_userAddress_fkey" FOREIGN KEY ("userAddress") REFERENCES "PrismaUser"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrismaUserWalletBalance" ADD CONSTRAINT "PrismaUserWalletBalance_poolId_chain_fkey" FOREIGN KEY ("poolId", "chain") REFERENCES "PrismaPool"("id", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrismaUserWalletBalance" ADD CONSTRAINT "PrismaUserWalletBalance_tokenAddress_chain_fkey" FOREIGN KEY ("tokenAddress", "chain") REFERENCES "PrismaToken"("address", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrismaUserStakedBalance" ADD CONSTRAINT "PrismaUserStakedBalance_userAddress_fkey" FOREIGN KEY ("userAddress") REFERENCES "PrismaUser"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrismaUserStakedBalance" ADD CONSTRAINT "PrismaUserStakedBalance_poolId_chain_fkey" FOREIGN KEY ("poolId", "chain") REFERENCES "PrismaPool"("id", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrismaUserStakedBalance" ADD CONSTRAINT "PrismaUserStakedBalance_tokenAddress_chain_fkey" FOREIGN KEY ("tokenAddress", "chain") REFERENCES "PrismaToken"("address", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrismaUserStakedBalance" ADD CONSTRAINT "PrismaUserStakedBalance_stakingId_chain_fkey" FOREIGN KEY ("stakingId", "chain") REFERENCES "PrismaPoolStaking"("id", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Pool full-text search: tsvector generator + triggers (not expressible in Prisma)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_pool_search_vector(
    pool_id TEXT,
    chain_id TEXT
) RETURNS tsvector
LANGUAGE plpgsql
AS $$
DECLARE
  protocol_version_part TEXT;
  name_symbol_part TEXT;
  token_data_part TEXT;
  hook_data_part TEXT;
  chain_text TEXT := chain_id;
BEGIN
  -- Single fetch from PrismaPool
  SELECT
    CASE WHEN "protocolVersion" = 1 THEN 'COW' ELSE 'v' || COALESCE("protocolVersion"::TEXT, '') END,
    COALESCE(name, '') || ' ' ||
    COALESCE(symbol, '') || ' ' ||
    CASE WHEN "protocolVersion" = 2 THEN COALESCE(id, '') ELSE '' END || ' ' ||
    COALESCE(address::TEXT, '') || ' ' ||
    COALESCE(type::TEXT, '') || ' ' ||
    COALESCE(chain::TEXT, '') || ' ' ||
    COALESCE(array_to_string(categories, ' '), ''),
    COALESCE(hook->>'type', '')
  INTO protocol_version_part, name_symbol_part, hook_data_part
  FROM "PrismaPool"
  WHERE id = pool_id AND chain::TEXT = chain_text;

  -- Token string aggregation
  SELECT string_agg(
    COALESCE(tk.name, '') || ' ' ||
    COALESCE(tk.symbol, '') || ' ' ||
    COALESCE(t.address, '') || ' ' ||
    COALESCE(ut.name, '') || ' ' ||
    COALESCE(ut.symbol, '') || ' ' ||
    COALESCE(tk."underlyingTokenAddress", ''),
    ' '
  )
  INTO token_data_part
  FROM "PrismaPoolToken" t
  JOIN "PrismaToken" tk ON t.address = tk.address AND t.chain::TEXT = chain_text
  LEFT JOIN "PrismaToken" ut ON ut.address = tk."underlyingTokenAddress" AND ut.chain::TEXT = chain_text
  WHERE t."poolId" = pool_id AND t.chain::TEXT = chain_text;

  -- Final tsvector
  RETURN
    setweight(to_tsvector('simple', protocol_version_part), 'A') ||
    to_tsvector('simple', regexp_replace(name_symbol_part || ' ' || COALESCE(token_data_part, '') || ' ' || COALESCE(hook_data_part, ''), '[-/]', ' ', 'g'));
END;
$$;

CREATE OR REPLACE FUNCTION public.update_search_vector()
    RETURNS trigger
    LANGUAGE plpgsql
AS $BODY$
BEGIN
  -- Case 1: Called from PrismaPool trigger (AFTER INSERT/UPDATE)
  IF TG_TABLE_NAME ILIKE 'PrismaPool' THEN
    UPDATE "PrismaPool"
    SET search_vector = generate_pool_search_vector(id, chain::TEXT)
    WHERE id = NEW."id" AND chain::TEXT = NEW.chain::TEXT;
    RETURN NEW;

  -- Case 2: Called from PrismaPoolToken trigger (AFTER INSERT)
  ELSIF TG_TABLE_NAME ILIKE 'PrismaPoolToken' THEN
    UPDATE "PrismaPool"
    SET search_vector = generate_pool_search_vector(id, chain::TEXT)
    WHERE id = NEW."poolId" AND chain::TEXT = NEW.chain::TEXT;
    RETURN NEW;

  -- Case 3: Called from PrismaToken trigger (AFTER UPDATE)
  ELSIF TG_TABLE_NAME ILIKE 'PrismaToken' AND (TG_OP = 'UPDATE') THEN
    UPDATE "PrismaPool" p
    SET search_vector = generate_pool_search_vector(p.id, p.chain::TEXT)
    WHERE EXISTS (
      SELECT 1 FROM "PrismaPoolToken" pt
      WHERE pt.address = NEW.address
      AND pt.chain::TEXT = NEW.chain::TEXT
      AND pt."poolId" = p.id
      AND pt.chain::TEXT = p.chain::TEXT
    );
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$BODY$;

CREATE TRIGGER trig_update_pool_search_vector
AFTER INSERT OR UPDATE OF name, symbol, address, type, chain, categories, "protocolVersion", hook
ON "PrismaPool"
FOR EACH ROW
EXECUTE FUNCTION update_search_vector();

CREATE TRIGGER trig_update_pool_search_vector_on_token_change
AFTER INSERT ON "PrismaPoolToken"
FOR EACH ROW EXECUTE FUNCTION update_search_vector();

CREATE TRIGGER trig_update_pool_search_vector_on_prismatoken_change
AFTER UPDATE OF name, symbol ON "PrismaToken"
FOR EACH ROW EXECUTE FUNCTION update_search_vector();
