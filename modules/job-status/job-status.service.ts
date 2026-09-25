import { Chain } from '@prisma/client';
import { prisma } from '../../prisma/prisma-client';
import config from '../../config';
import { chainIdToChain } from '../../config/chain-id-to-chain';

const STALE_AFTER_INTERVALS = 3;
const FIRST_RUN_GRACE_MS = 30 * 60 * 1000;

export type JobStatusUpdate = Partial<{
    lastStart: Date;
    lastSuccess: Date;
    lastDurationMs: number;
    lastError: Date;
    lastErrorMessage: string;
}>;

export interface JobStatusEntry {
    name: string;
    chain: Chain;
    intervalMs: number;
    stale: boolean;
    lastSuccess: Date | null;
    lastDurationMs: number | null;
    lastError: Date | null;
    lastErrorMessage: string | null;
}

export interface JobStatusReport {
    ok: boolean;
    checkedAt: Date;
    staleCount: number;
    stale: Pick<JobStatusEntry, 'name' | 'chain' | 'lastSuccess' | 'lastErrorMessage'>[];
    jobs: JobStatusEntry[];
}

export class JobStatusService {
    public recordStart(name: string, chainId: string): Promise<void> {
        return this.upsert(name, chainId, { lastStart: new Date() });
    }

    public recordSuccess(name: string, chainId: string, durationMs: number): Promise<void> {
        return this.upsert(name, chainId, { lastSuccess: new Date(), lastDurationMs: Math.round(durationMs) });
    }

    public recordError(name: string, chainId: string, message: string): Promise<void> {
        return this.upsert(name, chainId, { lastError: new Date(), lastErrorMessage: message.slice(0, 2000) });
    }

    public async report(): Promise<JobStatusReport> {
        const now = Date.now();
        const rows = await prisma.prismaJobStatus.findMany();
        const byKey = new Map(rows.map((row) => [`${row.name}-${row.chain}`, row]));

        const jobs: JobStatusEntry[] = Object.values(config).flatMap((network) =>
            network.workerJobs.map((job) => {
                const chain = network.chain.prismaId;
                const row = byKey.get(`${job.name}-${chain}`);
                const staleAfterMs = Math.max(job.interval * STALE_AFTER_INTERVALS, FIRST_RUN_GRACE_MS);
                const lastSuccessAgeMs = row?.lastSuccess ? now - row.lastSuccess.getTime() : undefined;
                const lastStartAgeMs = row?.lastStart ? now - row.lastStart.getTime() : undefined;

                const stale =
                    lastSuccessAgeMs !== undefined
                        ? lastSuccessAgeMs > staleAfterMs
                        : lastStartAgeMs === undefined || lastStartAgeMs > staleAfterMs;

                return {
                    name: job.name,
                    chain,
                    intervalMs: job.interval,
                    stale,
                    lastSuccess: row?.lastSuccess ?? null,
                    lastDurationMs: row?.lastDurationMs ?? null,
                    lastError: row?.lastError ?? null,
                    lastErrorMessage: row?.lastErrorMessage ?? null,
                };
            }),
        );

        const staleJobs = jobs.filter((job) => job.stale);

        return {
            ok: staleJobs.length === 0,
            checkedAt: new Date(now),
            staleCount: staleJobs.length,
            stale: staleJobs.map(({ name, chain, lastSuccess, lastErrorMessage }) => ({
                name,
                chain,
                lastSuccess,
                lastErrorMessage,
            })),
            jobs,
        };
    }

    private async upsert(name: string, chainId: string, data: JobStatusUpdate): Promise<void> {
        const chain = chainIdToChain[chainId];
        if (!chain) {
            return;
        }

        const intervalMs = this.intervalFor(name, chain);

        try {
            await prisma.prismaJobStatus.upsert({
                where: { name_chain: { name, chain } },
                create: { name, chain, intervalMs, ...data },
                update: { intervalMs, ...data },
            });
        } catch (e: any) {
            console.error(`job-status: failed to record ${name}-${chainId}`, e.message);
        }
    }

    private intervalFor(name: string, chain: Chain): number {
        return config[chain]?.workerJobs.find((job) => job.name === name)?.interval ?? 0;
    }
}

export const jobStatusService = new JobStatusService();
