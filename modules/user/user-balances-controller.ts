import { Chain, PrismaPoolStakingType } from '@prisma/client';
import config from '../../config';
import { prisma } from '../../prisma/prisma-client';
import { syncBptBalancesV2 } from './lib/bpt-balances/sync-bpt-balances-v2';
import { createUserStakedBalanceServices } from './lib/user-staked-balance-service.factory';
import { syncBptBalancesV3 } from './lib/bpt-balances/sync-bpt-balances-v3';

export function UserBalancesController() {
    return {
        /**
         * Full reload of wallet balances for a chain: drops all wallet balances and the balance sync cursors,
         * so the following sync fetches every pool share from the subgraph instead of only the recently changed ones.
         */
        async initBalances(chain: Chain) {
            await prisma.$transaction([
                prisma.prismaUserWalletBalance.deleteMany({ where: { chain } }),
                prisma.prismaLastBlockSynced.deleteMany({
                    where: { chain, category: { in: ['BPT_BALANCES_V2', 'BPT_BALANCES_V3'] } },
                }),
            ]);

            return this.syncBalances(chain);
        },
        async syncBalances(chain: Chain) {
            const {
                subgraphs: { balancer, balancerV3 },
            } = config[chain];

            // Run all syncs in parallel
            await Promise.all([
                config[chain].balancer.v2.vaultAddress !== '' ? syncBptBalancesV2(chain, balancer) : Promise.resolve(),
                config[chain].balancer.v3.vaultAddress !== ''
                    ? syncBptBalancesV3(chain, balancerV3)
                    : Promise.resolve(),
            ]);

            return true;
        },
        async syncUserBalancesFromV2Subgraph(chain: Chain) {
            const {
                subgraphs: { balancer },
            } = config[chain];

            // Guard against unconfigured chains
            if (!balancer) {
                throw new Error(`Chain not configured: ${chain}`);
            }

            const syncedBlocks = await syncBptBalancesV2(chain, balancer);
            return syncedBlocks;
        },
        async syncUserBalancesFromV3Subgraph(chain: Chain) {
            const {
                subgraphs: { balancerV3 },
            } = config[chain];

            // Guard against unconfigured chains
            if (!balancerV3) {
                return [];
            }

            const syncedBlocks = await syncBptBalancesV3(chain, balancerV3);
            return syncedBlocks;
        },

        async initStakedBalances(stakingTypes: PrismaPoolStakingType[], chain: Chain) {
            const services = createUserStakedBalanceServices(chain);
            await Promise.all(services.map((service) => service.initStakedBalances(stakingTypes, chain)));
        },

        async syncChangedStakedBalances(chain: Chain) {
            const services = createUserStakedBalanceServices(chain);
            await Promise.all(services.map((service) => service.syncChangedStakedBalances(chain)));
        },
    };
}
