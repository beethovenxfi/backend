import {
    getSdk,
    BalancerPoolsQueryVariables,
    OrderDirection,
    BalancerPoolShareFragment,
    PoolShare_OrderBy,
    BalancerPoolFragment,
} from './generated/balancer-subgraph-types';
import { subgraphLoadAll } from '../subgraph-util';
import { Chain, Prisma } from '@prisma/client';
import { GraphQLClient } from 'graphql-request';

export class BalancerSubgraphService {
    private sdk: ReturnType<typeof getSdk>;

    constructor(subgraphUrl: string, private chain: Chain) {
        this.sdk = getSdk(new GraphQLClient(subgraphUrl));
    }

    public async lastSyncedBlock() {
        const { meta } = await this.sdk.BalancerGetMeta();

        if (!meta) {
            throw new Error('Missing meta data');
        }

        return Number(meta.block.number);
    }

    public async getAllPoolSharesWithBalance(
        poolIds: string[],
        excludedAddresses: string[],
        startBlock?: number,
    ): Promise<Prisma.PrismaUserWalletBalanceCreateManyInput[]> {
        const allPoolShares: BalancerPoolShareFragment[] = [];
        let hasMore = true;
        let id = `0`;
        const pageSize = 1000;

        while (hasMore) {
            const shares = await this.sdk.BalancerPoolShares({
                where: {
                    id_gt: id,
                    // Fetch all pools when requesting more than 100 pools
                    poolId_in: poolIds.length > 0 && poolIds.length < 100 ? poolIds : undefined,
                    userAddress_not_in: excludedAddresses,
                    _change_block: startBlock && startBlock > 0 ? { number_gte: startBlock } : undefined,
                },
                orderBy: PoolShare_OrderBy.Id,
                orderDirection: OrderDirection.Asc,
                first: pageSize,
            });

            if (shares.poolShares.length === 0) {
                break;
            }

            if (shares.poolShares.length < pageSize) {
                hasMore = false;
            }

            allPoolShares.push(...shares.poolShares);
            id = shares.poolShares[shares.poolShares.length - 1].id;
        }

        return allPoolShares
            .map((share) => ({
                ...share,
                poolId: share.poolId.id.toLowerCase(),
                chain: this.chain,
                //ensure the user balance isn't negative, unsure how the subgraph ever allows this to happen
                balance: parseFloat(share.balance) < 0 ? '0' : share.balance,
                balanceNum: Math.max(0, parseFloat(share.balance)),
                tokenAddress: share.id.toLowerCase().split('-')[0],
                userAddress: share.id.toLowerCase().split('-')[1],
            }))
            .filter((share) => (poolIds.length > 0 ? poolIds.includes(share.poolId) : true));
    }

    public async getAllPools(
        args: BalancerPoolsQueryVariables,
        applyTotalSharesFilter = true,
    ): Promise<BalancerPoolFragment[]> {
        return subgraphLoadAll<BalancerPoolFragment>(this.sdk.BalancerPools, 'pools', {
            ...args,
            where: {
                totalShares_not: applyTotalSharesFilter ? '0.00000000001' : undefined,
                poolType_not_contains_nocase: 'linear',
                ...args.where,
            },
        });
    }
}
