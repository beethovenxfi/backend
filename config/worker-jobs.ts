import { env } from '../apps/env';
import { every } from '../apps/scheduler/intervals';
import { DeploymentEnv, WorkerJob } from './types';

const isCanary = (env.DEPLOYMENT_ENV as DeploymentEnv) === 'canary';
const interval = (canary: number, main: number) => (isCanary ? canary : main);

export const activeChainWorkerJobsV2: WorkerJob[] = [
    { name: 'sync-new-pools-from-subgraph', interval: interval(every(10, 'minutes'), every(2, 'minutes')) },
    { name: 'sync-changed-pools', interval: interval(every(5, 'minutes'), every(1, 'minutes')) },
    { name: 'sync-join-exits-v2', interval: interval(every(15, 'minutes'), every(1, 'minutes')) },
    { name: 'sync-swaps-v2', interval: interval(every(15, 'minutes'), every(1, 'minutes')) },
    { name: 'update-liquidity-24h-ago-v2', interval: interval(every(20, 'minutes'), every(5, 'minutes')) },
];

export const activeChainWorkerJobsV3: WorkerJob[] = [
    { name: 'add-pools-v3', interval: interval(every(5, 'minutes'), every(1, 'minutes')) },
    { name: 'sync-pools-v3', interval: interval(every(5, 'minutes'), every(1, 'minutes')) },
    { name: 'sync-join-exits-v3', interval: interval(every(15, 'minutes'), every(1, 'minutes')) },
    { name: 'sync-swaps-v3', interval: interval(every(15, 'minutes'), every(1, 'minutes')) },
    { name: 'sync-hook-data', interval: interval(every(20, 'minutes'), every(1, 'hours')) },
    { name: 'update-liquidity-24h-ago-v3', interval: interval(every(20, 'minutes'), every(5, 'minutes')) },
    { name: 'sync-lbps', interval: interval(every(5, 'minutes'), every(2, 'minutes')) },
    { name: 'sync-fixed-lbps', interval: interval(every(5, 'minutes'), every(2, 'minutes')) },
];

export const activeChainWorkerJobsGeneric: WorkerJob[] = [
    { name: 'update-liquidity-for-inactive-pools', interval: interval(every(20, 'minutes'), every(10, 'minutes')) },
    { name: 'sync-staking-for-pools', interval: interval(every(10, 'minutes'), every(5, 'minutes')) },
    { name: 'sync-snapshots', interval: interval(every(45, 'minutes'), every(15, 'minutes')) },
    { name: 'user-sync-wallet-balances-for-all-pools', interval: interval(every(5, 'minutes'), every(2, 'minutes')) },
    { name: 'user-sync-staked-balances', interval: interval(every(5, 'minutes'), every(2, 'minutes')) },
    { name: 'update-fee-volume-yield-all-pools', interval: interval(every(60, 'minutes'), every(30, 'minutes')) },
    { name: 'update-pool-apr', interval: interval(every(10, 'minutes'), every(10, 'minutes')) },
    { name: 'sync-erc4626-onchain-data', interval: interval(every(60, 'minutes'), every(20, 'minutes')) },
    { name: 'update-lifetime-values', interval: interval(every(120, 'minutes'), every(60, 'minutes')) },
];

// Jobs that are not chain specific. Attached to the single configured chain.
export const activeChainWorkerJobsGlobal: WorkerJob[] = [
    { name: 'update-token-prices', interval: interval(every(10, 'minutes'), every(3, 'minutes')) },
    { name: 'global-purge-old-data', interval: every(1, 'days') },
    { name: 'sync-rate-provider-reviews', interval: interval(every(30, 'minutes'), every(15, 'minutes')) },
    { name: 'sync-hook-reviews', interval: interval(every(30, 'minutes'), every(15, 'minutes')) },
    { name: 'sync-erc4626-data', interval: interval(every(30, 'minutes'), every(15, 'minutes')) },
    { name: 'fetch-token-yields', interval: interval(every(40, 'minutes'), every(20, 'minutes')) },
    { name: 'sync-categories', interval: interval(every(30, 'minutes'), every(10, 'minutes')) },
    { name: 'post-subgraph-lag-metrics', interval: every(15, 'minutes') },
    { name: 'sync-token-tvl', interval: interval(every(60, 'minutes'), every(30, 'minutes')) },
    { name: 'sync-token-content-data', interval: interval(every(10, 'minutes'), every(5, 'minutes')) },
];

export const quantAmmWorkerJobs: WorkerJob[] = [
    { name: 'sync-weights', interval: interval(every(60, 'minutes'), every(10, 'minutes')) },
];

export const loopsWorkerJobs: WorkerJob[] = [
    { name: 'sync-loops-data', interval: interval(every(60, 'minutes'), every(10, 'minutes')) },
];

export const stsWorkerJobs: WorkerJob[] = [
    { name: 'sync-sts-staking-data', interval: interval(every(20, 'minutes'), every(1, 'minutes')) },
    { name: 'sync-sts-staking-snapshots', interval: interval(every(30, 'minutes'), every(10, 'minutes')) },
];

export const reliquaryWorkerJobs: WorkerJob[] = [
    { name: 'sync-latest-reliquary-snapshots', interval: interval(every(2, 'hours'), every(1, 'hours')) },
];
