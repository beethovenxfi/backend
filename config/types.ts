import type { Chain } from '@prisma/client';
import type { GqlChain, GqlHookType } from '../apps/api/gql/generated-schema';
import { AprHandlerConfigs } from '../modules/aprs/handlers/types';

export interface WorkerJob {
    name: string;
    interval: number;
}

export type DeploymentEnv = 'canary' | 'main';

export type StakingServiceType = 'gauge' | 'reliquary';

export interface NetworkData {
    chain: {
        slug: string;
        id: number;
        nativeAssetAddress: string;
        wrappedNativeAssetAddress: string;
        prismaId: Chain;
        gqlId: GqlChain;
    };
    eth: {
        address: string;
        addressFormatted: string;
        symbol: string;
        name: string;
    };
    weth: {
        address: string;
        addressFormatted: string;
    };
    rpcUrl: string;
    rpcMaxBlockRange: number;
    acceptableSGLag: number;
    coingecko: {
        nativeAssetId: string;
        platformId: string;
        excludedTokenAddresses: string[];
    };
    subgraphs: {
        startDate: string;
        balancer: string;
        balancerV3?: string;
        balancerPoolsV3?: string;
        reliquary?: string;
        sts?: string;
        gauge?: string;
    };
    beets?: {
        address: string;
    };
    sts?: {
        address: string;
        sfcAddress: string;
        constantsManagerAddress: string;
        validatorFee: number;
    };
    loops?: {
        address: string;
        aavePoolDataProvider: string;
        aavePoolAddressesProvider: string;
    };
    balancer: {
        v2: {
            vaultAddress: string;
            defaultSwapFeePercentage: string;
            defaultYieldFeePercentage: string;
            balancerQueriesAddress: string;
        };
        v3: {
            vaultAddress: string;
            routerAddress: string;
            defaultSwapFeePercentage: string;
            defaultYieldFeePercentage: string;
        };
    };
    hooks?: Record<string, GqlHookType>;
    multicall: string;
    multicall3: string;
    aprHandlers: AprHandlerConfigs;
    reliquary?: {
        address: string;
        excludedFarmIds: string[];
    };
    avgBlockSpeed: number;
    monitoring: {
        [key in DeploymentEnv]: {
            alarmTopicArn: string;
        };
    };
    stakingServices: StakingServiceType[];
    workerJobs: WorkerJob[];
}
