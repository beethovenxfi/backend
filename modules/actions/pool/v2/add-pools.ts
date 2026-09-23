import { Chain, PrismaPool } from '@prisma/client';
import { prisma } from '../../../../prisma/prisma-client';
import { V2SubgraphClient } from '../../../subgraphs/balancer-subgraph';
import { BalancerPoolFragment } from '../../../subgraphs/balancer-subgraph/generated/balancer-subgraph-types';
import { subgraphToPrismaCreate } from '../../../pool/subgraph-mapper';
import { syncBptBalancesFromSubgraph } from '../../../user/lib/bpt-balances/helpers/sync-bpt-balances-from-subgraph';

export const addPools = async (subgraphService: V2SubgraphClient, chain: Chain): Promise<string[]> => {
    const blockNumber = await subgraphService.legacyService.lastSyncedBlock();

    const existing = (await prisma.prismaPool.findMany({ where: { chain }, select: { id: true } })).map(
        (pool) => pool.id,
    );

    const subgraphPools = await subgraphService.legacyService.getAllPools({}, false);

    const newPools = subgraphPools
        .filter((pool) => !existing.includes(pool.id))
        .sort((a, b) => a.createTime - b.createTime);

    const createdPools: string[] = [];
    for (const subgraphPool of newPools) {
        const dbPool = await createPoolRecord(subgraphPool, chain, blockNumber);
        if (dbPool) {
            createdPools.push(subgraphPool.id);
        }
    }

    // Add user balances for new pools
    if (newPools.length > 0) {
        await syncBptBalancesFromSubgraph(
            newPools.map((pool) => pool.id),
            subgraphService,
            chain,
        );
    }

    return createdPools;
};

const createPoolRecord = async (
    pool: BalancerPoolFragment,
    chain: Chain,
    blockNumber: number,
): Promise<PrismaPool | undefined> => {
    const poolTokens = pool.tokens || [];

    await prisma.prismaToken.createMany({
        skipDuplicates: true,
        data: [
            ...poolTokens.map((token) => ({
                address: token.address,
                symbol: token.symbol,
                name: token.name,
                decimals: token.decimals,
                chain,
            })),
            {
                address: pool.address.toLowerCase(),
                symbol: pool.symbol || '',
                name: pool.name || '',
                decimals: 18,
                chain,
            },
        ],
    });

    const prismaPoolRecordWithAssociations = subgraphToPrismaCreate(pool, chain, blockNumber);

    try {
        const pool = await prisma.prismaPool.create(prismaPoolRecordWithAssociations);

        return pool;
    } catch (e) {
        console.error(`Could not create pool ${pool.id} on chain ${chain}. Skipping.`, e);
    }
};
