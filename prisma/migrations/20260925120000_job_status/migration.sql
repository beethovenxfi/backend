-- CreateTable
CREATE TABLE "PrismaJobStatus" (
    "name" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "intervalMs" INTEGER NOT NULL,
    "lastStart" TIMESTAMP(3),
    "lastSuccess" TIMESTAMP(3),
    "lastDurationMs" INTEGER,
    "lastError" TIMESTAMP(3),
    "lastErrorMessage" TEXT,

    CONSTRAINT "PrismaJobStatus_pkey" PRIMARY KEY ("name","chain")
);
