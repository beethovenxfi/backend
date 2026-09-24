import config from '../../config';
import { chainIdToChain } from '../../config/chain-id-to-chain';
import { SendMessageCommand, SendMessageCommandInput, SQSClient } from '@aws-sdk/client-sqs';
import { env } from '../env';

class WokerQueue {
    constructor(private readonly client: SQSClient, private readonly queueUrl?: string) {}

    public async sendWithInterval(json: string, intervalMs: number, deDuplicationId?: string): Promise<void> {
        try {
            if (this.queueUrl === undefined) {
                return;
            }

            if (this.queueUrl.startsWith('http') && !this.queueUrl.includes('sqs.')) {
                await this.sendLocalMessage(json);
            } else {
                await this.sendMessage(json, deDuplicationId);
            }
            console.log(`Sent message to schedule job on queue ${this.queueUrl}: ${json}`);
        } catch (error) {
            console.error(error);
        } finally {
            setTimeout(() => {
                this.sendWithInterval(json, intervalMs, deDuplicationId);
            }, intervalMs);
        }
    }

    public async sendLocalMessage(json: string): Promise<void> {
        if (this.queueUrl === undefined) {
            throw new Error('WORKER_QUEUE_URL is undefined');
        }

        const response = await fetch(this.queueUrl, {
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

    public async sendMessage(json: string, deDuplicationId?: string, delaySeconds?: number): Promise<void> {
        const input: SendMessageCommandInput = {
            QueueUrl: this.queueUrl,
            MessageBody: json,
            MessageDeduplicationId: deDuplicationId,
            DelaySeconds: delaySeconds,
        };
        const command = new SendMessageCommand(input);
        await this.client.send(command);
    }
}

const workerQueue = new WokerQueue(new SQSClient({}), env.WORKER_QUEUE_URL);

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
