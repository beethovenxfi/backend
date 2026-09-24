import config from '../../config';
import { chainIdToChain } from '../../config/chain-id-to-chain';
import { env } from '../env';

/**
 * Posts job messages to the worker over HTTP (WORKER_QUEUE_URL, e.g. http://localhost:4000 when the worker
 * runs in the same process) and re-schedules itself with the job's interval.
 */
class WorkerQueue {
    constructor(private readonly workerUrl?: string) {}

    public async sendWithInterval(json: string, intervalMs: number): Promise<void> {
        try {
            if (this.workerUrl === undefined) {
                return;
            }

            await this.send(json);
            console.log(`Sent message to schedule job on ${this.workerUrl}: ${json}`);
        } catch (error) {
            console.error(error);
        } finally {
            setTimeout(() => {
                this.sendWithInterval(json, intervalMs);
            }, intervalMs);
        }
    }

    private async send(json: string): Promise<void> {
        const response = await fetch(this.workerUrl!, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: json,
        });

        if (!response.ok) {
            throw new Error(`Failed to send message: ${response.status} ${response.statusText}`);
        }
    }
}

const workerQueue = new WorkerQueue(env.WORKER_QUEUE_URL);

const MAX_INITIAL_DELAY_MS = 5 * 60 * 1000;

export async function scheduleJobs(chainId: string): Promise<void> {
    for (const job of config[chainIdToChain[chainId]].workerJobs) {
        // Stagger the first run of each job over [0, min(interval, 5 min)) so a cold boot does not fire
        // every job at once. After the first run each job keeps its own interval.
        const initialDelay = Math.floor(Math.random() * Math.min(job.interval, MAX_INITIAL_DELAY_MS));
        console.log(`Initializing job ${job.name}-${chainId}-init, first run in ${Math.round(initialDelay / 1000)}s`);
        setTimeout(() => {
            workerQueue.sendWithInterval(JSON.stringify({ name: job.name, chain: chainId }), job.interval);
        }, initialDelay);
    }
}
