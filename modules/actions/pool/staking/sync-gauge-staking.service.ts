/**
 * Syncs liquidity gauges and their reward token rates (per second) from the gauge subgraph and chain.
 */
import { prisma } from '../../../../prisma/prisma-client';
import { prismaBulkExecuteOperations } from '../../../../prisma/prisma-util';
import { Chain, PrismaPoolStakingType } from '@prisma/client';
import { GaugeSubgraphService, LiquidityGaugeStatus } from '../../../subgraphs/gauge-subgraph/gauge-subgraph.service';
import childChainGaugeV2Abi from './abi/ChildChainGaugeV2.json';
import { BigNumber } from '@ethersproject/bignumber';
import { formatUnits } from '@ethersproject/units';
import type { JsonFragment } from '@ethersproject/abi';
import _ from 'lodash';
import { Multicaller3Viem } from '../../../web3/multicaller-viem';
import { formatEther } from 'viem';

interface GaugeRewardData {
    [address: string]: {
        rewardData: {
            [address: string]: {
                period_finish?: BigNumber;
                rate?: BigNumber;
            };
        };
    };
}

export const syncGaugeStakingForPools = async (
    gaugeSubgraphService: GaugeSubgraphService,
    chain: Chain,
): Promise<void> => {
    const supplyMulticaller = new Multicaller3Viem(chain, [
        ...childChainGaugeV2Abi.filter((abi) => abi.name === 'totalSupply'),
    ] as JsonFragment[]);

    const rewardsMulticaller = new Multicaller3Viem(chain, [
        ...childChainGaugeV2Abi.filter((abi) => abi.name === 'reward_data'),
    ]);

    // Getting data from the DB and subgraph

    const dbPools = await prisma.prismaPool.findMany({
        where: { chain },
        include: { staking: { include: { gauge: { include: { rewards: true } } } } },
    });

    const poolAddresses = dbPools.map((pool) => pool.address);
    const { liquidityGauges: subgraphGauges } = await gaugeSubgraphService.getAllGaugesForPoolAddresses(poolAddresses);

    /*
    TODO This can result in multiple preferential gauges for a pool 
    because its a manual two-step process to set them (set new preferential and unset old preferential)
    We are logginga sentry error if that happens.
    */
    const gaugesForDb = subgraphGauges.map((gauge) => ({
        id: gauge.id,
        poolId: gauge.poolId || gauge.poolAddress,
        status: gauge.isKilled
            ? 'KILLED'
            : !gauge.isPreferentialGauge
            ? 'ACTIVE'
            : ('PREFERRED' as LiquidityGaugeStatus),
        version: 2,
        tokens: gauge.tokens || [],
        createTime: gauge.gauge?.addedTimestamp,
    }));

    for (const gauge of gaugesForDb) {
        const preferredGaugesForPool = gaugesForDb.filter((g) => gauge.poolId === g.poolId && g.status === 'PREFERRED');
        if (preferredGaugesForPool.length > 1) {
            console.error(
                `Pool ${gauge.poolId} on ${chain} has multiple preferred gauges: ${preferredGaugesForPool.map(
                    (gauge) => gauge.id,
                )}`,
            );
        }
    }

    // Get tokens used for all reward tokens
    const prismaTokens = await prisma.prismaToken.findMany({
        where: {
            address: {
                in: subgraphGauges
                    .map((gauge) => gauge.tokens?.map((token) => token.id.split('-')[0].toLowerCase()))
                    .flat()
                    .filter((address): address is string => !!address),
            },
            chain,
        },
    });

    const onchainRates = await getOnchainRewardTokensData(gaugesForDb, rewardsMulticaller);
    const gaugeSupplies = await getOnchainGaugeSupplies(gaugesForDb, supplyMulticaller);

    // Prepare DB operations
    const operations: any[] = [];

    const allDbStakings = dbPools.map((pool) => pool.staking).flat();
    const allDbStakingGauges = dbPools
        .map((pool) => pool.staking)
        .flat()
        .map((gauge) => gauge.gauge);

    // DB operations for gauges
    for (const gauge of gaugesForDb) {
        const dbStaking = allDbStakings.find((staking) => staking.id === gauge.id);
        if (!dbStaking) {
            operations.push(
                prisma.prismaPoolStaking.upsert({
                    where: { id_chain: { id: gauge.id, chain } },
                    create: {
                        id: gauge.id,
                        chain,
                        poolId: gauge.poolId,
                        type: 'GAUGE',
                        address: gauge.id,
                    },
                    update: {},
                }),
            );
        }

        const dbStakingGauge = allDbStakingGauges.find((stakingGauge) => stakingGauge?.id === gauge.id);
        const totalSupply = gaugeSupplies[gauge.id] ?? '0';
        if (
            !dbStakingGauge ||
            dbStakingGauge.status !== gauge.status ||
            dbStakingGauge.version !== gauge.version ||
            dbStakingGauge.totalSupply !== totalSupply
        ) {
            operations.push(
                prisma.prismaPoolStakingGauge.upsert({
                    where: { id_chain: { id: gauge.id, chain } },
                    create: {
                        id: gauge.id,
                        stakingId: gauge.id,
                        gaugeAddress: gauge.id,
                        chain,
                        status: gauge.status,
                        version: gauge.version,
                        totalSupply,
                    },
                    update: {
                        status: gauge.status,
                        version: gauge.version,
                        totalSupply,
                    },
                }),
            );
        }
    }

    const allStakingGaugeRewards = allDbStakingGauges.map((gauge) => gauge?.rewards).flat();

    // DB operations for gauge reward tokens
    for (const { id, rewardPerSecond } of onchainRates) {
        const [gaugeId, tokenAddress] = id.toLowerCase().split('-');
        const token = prismaTokens.find((token) => token.address === tokenAddress);
        if (!token) {
            // Report missing tokens for active rewards only
            if (Number(rewardPerSecond) > 0) {
                const poolId = subgraphGauges.find((gauge) => gauge.id === gaugeId)?.poolId;
                console.error(
                    `Could not find reward token (${tokenAddress}) in DB for gauge ${gaugeId} of pool ${poolId} on chain ${chain}`,
                );
            }
            continue;
        }

        const dbStakingGaugeRewards = allStakingGaugeRewards.find((rewards) => rewards?.id === id);

        if (!dbStakingGaugeRewards || dbStakingGaugeRewards.rewardPerSecond !== rewardPerSecond) {
            operations.push(
                prisma.prismaPoolStakingGaugeReward.upsert({
                    create: {
                        id,
                        chain,
                        gaugeId,
                        tokenAddress,
                        rewardPerSecond,
                    },
                    update: {
                        rewardPerSecond,
                    },
                    where: { id_chain: { id, chain } },
                }),
            );
        }
    }

    await prismaBulkExecuteOperations(operations, true);
};

const getOnchainGaugeSupplies = async (
    gauges: { id: string }[],
    supplyMulticaller: Multicaller3Viem,
): Promise<{ [gaugeAddress: string]: string }> => {
    for (const gauge of gauges) {
        supplyMulticaller.call(gauge.id, gauge.id, 'totalSupply', [], true);
    }
    const supplies = (await supplyMulticaller.execute()) as { [gaugeAddress: string]: bigint | undefined };

    return _.mapValues(supplies, (supply) => (supply !== undefined ? formatEther(supply) : '0'));
};

const getOnchainRewardTokensData = async (
    gauges: { id: string; tokens: { id: string; decimals: number }[] }[],
    rewardsMulticaller: Multicaller3Viem,
): Promise<{ id: string; rewardPerSecond: string }[]> => {
    // Get onchain data for reward tokens
    const decimals: { [address: string]: number } = {};
    for (const gauge of gauges) {
        for (const token of gauge.tokens ?? []) {
            const [address] = token.id.toLowerCase().split('-');
            decimals[address] = token.decimals;
            rewardsMulticaller.call(`${gauge.id}.rewardData.${address}`, gauge.id, 'reward_data', [address], true);
        }
    }
    const rewardsData = (await rewardsMulticaller.execute()) as GaugeRewardData;

    const now = Math.floor(Date.now() / 1000);

    // Format onchain rates for all the rewards
    return Object.keys(rewardsData).flatMap((gaugeAddress) =>
        Object.keys(rewardsData[gaugeAddress].rewardData).map((tokenAddress) => {
            const id = `${gaugeAddress}-${tokenAddress}-reward`.toLowerCase();
            const { rate, period_finish } = rewardsData[gaugeAddress].rewardData[tokenAddress];
            const rewardPerSecond =
                period_finish && Number(period_finish) > now ? formatUnits(rate!, decimals[tokenAddress]) : '0.0';

            return { id, rewardPerSecond };
        }),
    );
};

export const deleteGaugeStakingForAllPools = async (
    stakingTypes: PrismaPoolStakingType[],
    chain: Chain,
): Promise<void> => {
    if (stakingTypes.includes('GAUGE')) {
        await prisma.prismaUserStakedBalance.deleteMany({
            where: { staking: { type: 'GAUGE', chain: chain } },
        });
        await prisma.prismaPoolStakingGaugeReward.deleteMany({ where: { chain: chain } });
        await prisma.prismaPoolStakingGauge.deleteMany({ where: { chain: chain } });
        await prisma.prismaPoolStaking.deleteMany({ where: { chain: chain, type: 'GAUGE' } });
    }
};
