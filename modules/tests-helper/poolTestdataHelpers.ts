import { Prisma, PrismaPoolType } from '@prisma/client';
import { prisma } from '../../prisma/prisma-client';
import moment from 'moment';
import _ from 'lodash';

export type DeepPartial<T> = {
    [P in keyof T]?: DeepPartial<T[P]>;
};

type DefaultToken = 'usdc' | 'ws' | 'weth' | 'beets' | 'sts' | 'scusd' | 'sceth' | 'loops';

export const defaultTokens: Record<DefaultToken, Prisma.PrismaTokenCreateInput> = {
    usdc: {
        address: '0x29219dd400f2bf60e5a23d13be72b486d4038894',
        symbol: 'USDC.e',
        name: 'Bridged USDC',
        decimals: 6,
        chain: 'SONIC',
    },
    ws: {
        address: '0x039e2fb66102314ce7b64ce5ce3e5183bc94ad38',
        symbol: 'wS',
        name: 'Wrapped Sonic',
        decimals: 18,
        chain: 'SONIC',
    },
    weth: {
        address: '0x50c42deacd8fc9773493ed674b675be577f2634b',
        symbol: 'wETH',
        name: 'Wrapped Ether',
        decimals: 18,
        chain: 'SONIC',
    },
    beets: {
        address: '0x2d0e0814e62d80056181f5cd932274405966e4f0',
        symbol: 'BEETS',
        name: 'Beethoven X',
        decimals: 18,
        chain: 'SONIC',
    },
    sts: {
        address: '0xe5da20f15420ad15de0fa650600afc998bbe3955',
        symbol: 'stS',
        name: 'Staked Sonic',
        decimals: 18,
        chain: 'SONIC',
    },
    scusd: {
        address: '0xd3dce716f3ef535c5ff8d041c1a41c3bd89b97ae',
        symbol: 'scUSD',
        name: 'Sonic USD',
        decimals: 6,
        chain: 'SONIC',
    },
    sceth: {
        address: '0x3bce5cb273f0f148010bbea2470e7b5df84c7812',
        symbol: 'scETH',
        name: 'Sonic ETH',
        decimals: 18,
        chain: 'SONIC',
    },
    loops: {
        address: '0xc76995054ce51dfbbc954840d699b2f33d2538ee',
        symbol: 'LOOPS',
        name: 'Loops',
        decimals: 18,
        chain: 'SONIC',
    },
};

export async function createTokens(tokens: Prisma.PrismaTokenCreateInput[]) {
    await prisma.prismaToken.createMany({
        data: tokens,
    });
}

const defaultWeightedPool: Prisma.PrismaPoolCreateInput = {
    id: '0xf3a602d30dcb723a74a0198313a7551feaca7dac00010000000000000000005f',
    chain: 'SONIC',
    createTime: moment().subtract(10, 'days').unix(),
    address: '0xf3a602d30dcb723a74a0198313a7551feaca7dac',
    symbol: 'BPT-QUARTET',
    name: 'A Late Quartet',
    decimals: 18,
    type: PrismaPoolType.WEIGHTED,
    swapFeeManager: '0x0000000000000000000000000000000000000000',
    factory: '0xba1333333333a1ba1108e8412f11850a5c319ba9',
    tokens: {},
    dynamicData: {
        create: {
            id: '0xf3a602d30dcb723a74a0198313a7551feaca7dac00010000000000000000005f',
            blockNumber: 13000000,
            swapFee: '0.0025',
            swapEnabled: true,
            totalShares: '98618',
            totalSharesNum: 98618,
            totalLiquidity: 6128429,
            volume24h: 650860,
            fees24h: 1626,
            volume48h: 1082006,
            fees48h: 2705,
        },
    },
    staking: {
        create: {
            id: '17',
            address: '0x973670ce19594f857a7cd85ee834c7a74a941684',
            type: 'RELIQUARY',
        },
    },
};

export async function createWeightedPoolFromDefault(
    pool: DeepPartial<Prisma.PrismaPoolCreateInput> & { id: string },
    tokens: Prisma.PrismaTokenCreateInput[],
) {
    await prisma.prismaToken.createMany({
        data: tokens,
        skipDuplicates: true,
    });

    if (defaultWeightedPool.dynamicData?.create) {
        defaultWeightedPool.dynamicData.create.id = pool.id;
    }

    if (defaultWeightedPool.staking?.create) {
        defaultWeightedPool.staking.create = {
            id: `${pool.id}-stake`,
            address: '0x973670ce19594f857a7cd85ee834c7a74a941684',
            type: 'RELIQUARY',
        };
    }

    const mergedPoolPartial = _.merge(defaultWeightedPool, pool);

    const data = [];
    let counter = 0;
    for (const token of tokens) {
        data.push({
            id: `${pool.id}-${token.address}`,
            address: token.address,
            index: counter,
            balance: '0',
            balanceUSD: 0,
            priceRate: '1',
        });
        counter += 1;
    }

    mergedPoolPartial.tokens = {
        createMany: { data },
    };

    await prisma.prismaPool.create({
        data: mergedPoolPartial,
    });

    return prisma.prismaPool.findFirstOrThrow({
        where: { id: pool.id },
        include: {
            staking: true,
            dynamicData: true,
            tokens: true,
        },
    });
}

const defaultWeightedPoolSnapshot: Prisma.PrismaPoolSnapshotCreateInput = {
    id: '0xf3a602d30dcb723a74a0198313a7551feaca7dac00010000000000000000005f-1660089600',
    pool: {
        connect: {
            id_chain: { id: '0xf3a602d30dcb723a74a0198313a7551feaca7dac00010000000000000000005f', chain: 'SONIC' },
        },
    },
    timestamp: 1660089600,
    fees24h: 2515,
    volume24h: 1006335,
    swapsCount: 760976,
    sharePrice: 74.3,
    totalLiquidity: 7824300.8,
    totalShares: '105175.6',
    totalSharesNum: 105175.6,
    amounts: ['2168756.502379', '4663180.282740217636656087', '79.26189779', '1022.899752557829627982'],
};

export async function createWeightedPoolSnapshotFromDefault(
    snapshot: DeepPartial<Prisma.PrismaPoolSnapshotCreateInput> & { pool: { connect: { id: string } } },
) {
    await prisma.prismaPoolSnapshot.create({
        data: _.merge(defaultWeightedPoolSnapshot, snapshot),
    });
}

function randomNumberFromInterval(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

export async function createRandomSnapshotsForPoolForTimestamp(poolId: string, tokenCount: number, timestamp: number) {
    const totalShares = randomNumberFromInterval(100000, 3000000);
    const amounts = Array.from({ length: tokenCount }, () => randomNumberFromInterval(10, 50).toString());
    await prisma.prismaPoolSnapshot.create({
        data: {
            id: `${poolId}-${timestamp}`,
            pool: {
                connect: {
                    id_chain: { id: poolId, chain: 'SONIC' },
                },
            },
            timestamp,
            fees24h: randomNumberFromInterval(100, 5000),
            volume24h: randomNumberFromInterval(1000, 50000),
            swapsCount: randomNumberFromInterval(1000, 50000),
            sharePrice: randomNumberFromInterval(100, 500),
            totalLiquidity: randomNumberFromInterval(10000, 500000),
            totalShares: totalShares.toString(),
            totalSharesNum: totalShares,
            amounts,
        },
    });
}

export async function createRandomSnapshotsForPool(poolId: string, tokenCount: number, numSnapshots: number) {
    for (let i = 0; i < numSnapshots; i++) {
        const timestamp = moment().startOf('day').subtract(i, 'days').unix();
        const totalShares = randomNumberFromInterval(100000, 3000000);
        const amounts = Array.from({ length: tokenCount }, () => randomNumberFromInterval(10, 50).toString());
        await prisma.prismaPoolSnapshot.create({
            data: {
                id: `${poolId}-${timestamp}`,
                pool: {
                    connect: {
                        id_chain: { id: poolId, chain: 'SONIC' },
                    },
                },
                timestamp,
                fees24h: randomNumberFromInterval(100, 5000),
                volume24h: randomNumberFromInterval(1000, 50000),
                swapsCount: randomNumberFromInterval(1000, 50000),
                sharePrice: randomNumberFromInterval(100, 500),
                totalLiquidity: randomNumberFromInterval(10000, 500000),
                totalShares: totalShares.toString(),
                totalSharesNum: totalShares,
                amounts,
            },
        });
    }
}

const defaultUserBalanceSnapshot: Omit<Prisma.PrismaUserPoolBalanceSnapshotCreateInput, 'id'> = {
    timestamp: moment().unix(),
    user: {
        connect: {
            address: '0x0000000000000000000000000000000000000001',
        },
    },
    poolToken: '0x001',
    pool: { connect: { id_chain: { id: '0x001a', chain: 'SONIC' } } },
    walletBalance: '1',
    farmBalance: '1',
    gaugeBalance: '0',
    totalBalance: '2',
    percentShare: '0.01',
    totalValueUSD: '10',
    fees24h: '1',
};

export async function createUserPoolBalanceSnapshot(
    snapshot: DeepPartial<Prisma.PrismaUserPoolBalanceSnapshotCreateInput> & {
        id: string;
        pool: { connect: { id: string } };
        user: { connect: { address: string } };
    },
) {
    await prisma.prismaUserPoolBalanceSnapshot.create({
        data: _.merge(defaultUserBalanceSnapshot, snapshot),
    });
}
