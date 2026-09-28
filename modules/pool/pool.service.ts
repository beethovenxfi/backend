import { Chain, PrismaPoolStakingType } from '@prisma/client';
import _ from 'lodash';
import {
    GqlChain,
    GqlPoolFeaturedPool,
    GqlPoolMinimal,
    GqlPoolSnapshotDataRange,
    GqlPoolUnion,
    QueryPoolGetPoolsArgs,
} from '../../apps/api/gql/generated-schema';
import { PoolGqlLoaderService } from './lib/pool-gql-loader.service';
import { PoolSnapshotService } from './lib/pool-snapshot.service';
import { reliquarySnapshotService } from './lib/reliquary-snapshot.service';
import {
    deleteGaugeStakingForAllPools,
    deleteReliquaryStakingForAllPools,
    syncGaugeStakingForPools,
    syncReliquaryStakingForPools,
} from '../actions/pool/staking';
import { GaugeSubgraphService } from '../subgraphs/gauge-subgraph/gauge-subgraph.service';
import config from '../../config';

export class PoolService {
    constructor(
        private readonly poolGqlLoaderService: PoolGqlLoaderService,
        private readonly poolSnapshotService: PoolSnapshotService,
    ) {}

    public async getGqlPool(fields: any, id: string, chain: GqlChain, userAddress?: string): Promise<GqlPoolUnion> {
        return this.poolGqlLoaderService.getPool(fields, id, chain, userAddress);
    }

    public async getGqlPools(args: QueryPoolGetPoolsArgs): Promise<GqlPoolMinimal[]> {
        return this.poolGqlLoaderService.getPools(args);
    }

    public async getPoolsCount(args: QueryPoolGetPoolsArgs): Promise<number> {
        return this.poolGqlLoaderService.getPoolsCount(args);
    }

    public async getFeaturedPools(chains: Chain[]): Promise<GqlPoolFeaturedPool[]> {
        return this.poolGqlLoaderService.getFeaturedPools(chains);
    }

    public async getSnapshotsForPool(poolId: string, chain: Chain, range: GqlPoolSnapshotDataRange) {
        return this.poolSnapshotService.getSnapshotsForPool(poolId, chain, range);
    }

    public async getSnapshotsForReliquaryFarm(id: number, range: GqlPoolSnapshotDataRange, chain: Chain) {
        return reliquarySnapshotService.getSnapshotsForFarm(id, range, chain);
    }

    public async reloadStakingForAllPools(stakingTypes: PrismaPoolStakingType[], chain: Chain): Promise<void> {
        await deleteReliquaryStakingForAllPools(stakingTypes, chain);
        await deleteGaugeStakingForAllPools(stakingTypes, chain);
        // reload it for all pools
        await this.syncStakingForPools([chain]);
    }

    /**
     * Deprecated in favor of StakingController().syncStaking(chain)
     */
    public async syncStakingForPools(chains: Chain[]) {
        for (const chain of chains) {
            const networkconfig = config[chain];
            if (networkconfig.reliquary) {
                await syncReliquaryStakingForPools(
                    chain,
                    networkconfig.reliquary.address,
                    networkconfig.reliquary.excludedFarmIds,
                );
            }
            if (networkconfig.subgraphs.gauge) {
                await syncGaugeStakingForPools(
                    new GaugeSubgraphService(networkconfig.subgraphs.gauge),
                    chain,
                );
            }
        }
    }

    public async syncLatestReliquarySnapshotsForAllFarms(chain: Chain) {
        await reliquarySnapshotService.syncLatestSnapshotsForAllFarms(chain);
    }
}

export const poolService = new PoolService(new PoolGqlLoaderService(), new PoolSnapshotService());
