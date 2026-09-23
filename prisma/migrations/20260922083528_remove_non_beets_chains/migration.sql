/*
  Warnings:

  - The values [MAINNET,POLYGON,ARBITRUM,FANTOM,OPTIMISM,GNOSIS,ZKEVM,AVALANCHE,BASE,SEPOLIA,FRAXTAL,MODE,HYPEREVM,PLASMA,XLAYER,MONAD] on the enum `Chain` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Chain_new" AS ENUM ('SONIC');
ALTER TABLE "PrismaLastBlockSynced" ALTER COLUMN "chain" DROP DEFAULT;
ALTER TABLE "PrismaLastBlockSynced" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaPool" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaPoolDynamicData" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaPoolToken" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaPoolAprItem" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaPoolExpandedTokens" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaPoolFilter" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaPoolFilterMap" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaPoolStaking" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaPoolStakingMasterChefFarm" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaPoolStakingMasterChefFarmRewarder" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaPoolStakingGauge" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaPoolStakingAura" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaPoolStakingVebal" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaPoolStakingGaugeReward" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaPoolStakingReliquaryFarm" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaPoolStakingReliquaryFarmLevel" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaPoolSnapshot" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaReliquaryFarmSnapshot" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaReliquaryLevelSnapshot" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PartitionedPoolEvent" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "quant_weights" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaTokenYield" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaToken" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaTokenCurrentPrice" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaTokenPrice" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaTokenDynamicData" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaTokenType" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaPriceRateProviderData" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaErc4626ReviewData" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaUserWalletBalance" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaUserStakedBalance" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaUserBalanceSyncStatus" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaUserPoolBalanceSnapshot" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaUserRelicSnapshot" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaVeBalUserBalanceSnapshot" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaVeBalUserBalance" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaVeBalTotalSupply" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TABLE "PrismaVotingGauge" ALTER COLUMN "chain" TYPE "Chain_new" USING ("chain"::text::"Chain_new");
ALTER TYPE "Chain" RENAME TO "Chain_old";
ALTER TYPE "Chain_new" RENAME TO "Chain";
DROP TYPE "Chain_old";
ALTER TABLE "PrismaLastBlockSynced" ALTER COLUMN "chain" SET DEFAULT 'SONIC';
COMMIT;

-- AlterTable
ALTER TABLE "PrismaLastBlockSynced" ALTER COLUMN "chain" SET DEFAULT 'SONIC';
