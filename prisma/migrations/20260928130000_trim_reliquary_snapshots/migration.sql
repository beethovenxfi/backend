-- AlterTable
ALTER TABLE "PrismaReliquaryFarmSnapshot" DROP COLUMN "dailyDeposited",
DROP COLUMN "dailyWithdrawn";

-- DropForeignKey
ALTER TABLE "PrismaReliquaryLevelSnapshot" DROP CONSTRAINT "PrismaReliquaryLevelSnapshot_farmSnapshotId_chain_fkey";

-- DropTable
DROP TABLE "PrismaReliquaryLevelSnapshot";
