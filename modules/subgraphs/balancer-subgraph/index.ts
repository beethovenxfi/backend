import { GraphQLClient } from 'graphql-request';
import {
    getSdk,
    OrderDirection,
    BalancerSwapFragment,
    Swap_OrderBy,
    BalancerJoinExitFragment,
    JoinExit_OrderBy,
} from './generated/balancer-subgraph-types';
import { BalancerSubgraphService } from './balancer-subgraph.service';
import { Chain } from '@prisma/client';

export type V2SubgraphClient = ReturnType<typeof getV2SubgraphClient>;

export function getV2SubgraphClient(url: string, chain: Chain) {
    const sdk = getSdk(new GraphQLClient(url));
    const legacyService = new BalancerSubgraphService(url, chain);

    return {
        ...sdk,
        chain: chain,
        legacyService,
        lastSyncedBlock: legacyService.lastSyncedBlock.bind(legacyService),
        getAllPoolSharesWithBalance: legacyService.getAllPoolSharesWithBalance.bind(legacyService),
        async getJoinExitsFromBlock(fromBlockNumber: number): Promise<BalancerJoinExitFragment[]> {
            // Guard against missing syncs
            if (fromBlockNumber === 0) return [];

            const limit = 1000;
            let hasMore = true;
            let events: BalancerJoinExitFragment[] = [];
            let where = {
                id_gt: '0x',
            };

            while (hasMore) {
                const { joinExits } = await sdk.BalancerJoinExits({
                    where: { ...where, block_gt: `${fromBlockNumber}` },
                    orderBy: JoinExit_OrderBy.Id,
                    orderDirection: OrderDirection.Asc,
                    first: limit,
                });

                events = [...events, ...joinExits];

                if (joinExits.length < limit) {
                    hasMore = false;
                } else {
                    where = {
                        id_gt: joinExits[joinExits.length - 1].id,
                    };
                }
            }

            return events;
        },
        async getSwapsFromBlock(fromBlockNumber: number): Promise<BalancerSwapFragment[]> {
            // Guard against missing syncs
            if (fromBlockNumber === 0) return [];

            const limit = 1000;
            let hasMore = true;
            let events: BalancerSwapFragment[] = [];
            let where = {
                id_gt: '0x',
            };

            while (hasMore) {
                const { swaps } = await sdk.BalancerSwaps({
                    where: { ...where, block_gt: `${fromBlockNumber}` },
                    orderBy: Swap_OrderBy.Id,
                    orderDirection: OrderDirection.Asc,
                    first: limit,
                });

                events = [...events, ...swaps];

                if (swaps.length < limit) {
                    hasMore = false;
                } else {
                    where = {
                        id_gt: swaps[swaps.length - 1].id,
                    };
                }
            }

            return events;
        },
        async getAllSwapsForPool(poolId: string): Promise<BalancerSwapFragment[]> {
            const limit = 1000;
            let hasMore = true;
            let events: BalancerSwapFragment[] = [];
            let where = {
                id_gt: '0x',
            };

            while (hasMore) {
                const { swaps } = await sdk.BalancerSwaps({
                    where: { ...where, poolId: poolId },
                    orderBy: Swap_OrderBy.Id,
                    orderDirection: OrderDirection.Asc,
                    first: limit,
                });

                events = [...events, ...swaps];

                if (swaps.length < limit) {
                    hasMore = false;
                } else {
                    where = {
                        id_gt: swaps[swaps.length - 1].id,
                    };
                }
            }

            return events;
        },
    };
}
