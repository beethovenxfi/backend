import config from '../../config';
import { Chain } from '@prisma/client';
import { syncGaugeStakingForPools, syncReliquaryStakingForPools } from '../actions/pool/staking';
import { GaugeSubgraphService } from '../subgraphs/gauge-subgraph/gauge-subgraph.service';

export function StakingController() {
    return {
        async syncStaking(chain: Chain) {
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
        },
    };
}
