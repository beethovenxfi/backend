import { Chain, PrismaPoolStakingType } from '@prisma/client';
import { GaugeSubgraphService } from '../../../subgraphs/gauge-subgraph/gauge-subgraph.service';
import { deleteReliquaryStakingForAllPools, syncReliquaryStakingForPools } from './sync-reliquary-staking.service';
import { deleteGaugeStakingForAllPools, syncGaugeStakingForPools } from './sync-gauge-staking.service';
import config from '../../../../config';

export const syncStaking = async (chains: Chain[]) => {
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
};

export const reloadStakingForAllPools = async (stakingTypes: PrismaPoolStakingType[], chain: Chain): Promise<void> => {
    await deleteReliquaryStakingForAllPools(stakingTypes, chain);
    await deleteGaugeStakingForAllPools(stakingTypes, chain);
    // reload it for all pools
    await syncStaking([chain]);
};
