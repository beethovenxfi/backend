import { addressesMatch } from '../../../web3/addresses';
import { Chain, PrismaPoolStakingType } from '@prisma/client';
import _ from 'lodash';
import { prisma } from '../../../../prisma/prisma-client';
import { prismaBulkExecuteOperations } from '../../../../prisma/prisma-util';
import { Address } from 'viem';
import { fetchReliquaryData } from '../../../sources/contracts/fetch-reliquary-data';
import { getViemClient } from '../../../sources/viem-client';

export const syncReliquaryStakingForPools = async (
    chain: Chain,
    reliquaryAddress: string,
    excludedFarmIds: string[],
): Promise<void> => {
    if (chain !== 'SONIC') {
        return;
    }

    const reliquary = await fetchReliquaryData(chain, reliquaryAddress as Address, getViemClient(chain));
    const filteredFarms = reliquary.farms.filter((farm) => !excludedFarmIds.includes(farm.pid.toString()));
    const pools = await prisma.prismaPool.findMany({
        where: { chain: chain },
        include: { staking: { include: { reliquary: true } } },
    });
    const operations: any[] = [];

    for (const farm of filteredFarms) {
        const pool = pools.find((pool) => addressesMatch(pool.address, farm.poolTokenAddress));

        if (!pool) {
            console.warn(
                `Missing pool for farm with id ${farm.pid} with pool token ${farm.poolTokenAddress}. Skipping...`,
            );
            continue;
        }

        const farmId = `${farm.pid}`;
        const stakingId = `reliquary-${farm.pid}`;
        const farmAllocationPoints = farm.allocPoint;
        const reliquaryTotalAllocationPoints = reliquary.totalAllocPoint;

        const beetsPerSecond = (
            parseFloat(reliquary.rewardPerSecond) *
            (farmAllocationPoints / reliquaryTotalAllocationPoints)
        ).toString();

        operations.push(
            prisma.prismaPoolStaking.upsert({
                where: { id_chain: { id: stakingId, chain: chain } },
                create: {
                    id: stakingId,
                    chain: chain,
                    poolId: pool.id,
                    type: 'RELIQUARY',
                    address: reliquaryAddress,
                },
                update: {},
            }),
        );

        let totalBalance = `0`;
        let totalWeightedBalance = `0`;

        const levelOperations = [];
        for (let farmLevel of farm.levels) {
            const { allocationPoints, balance, level, requiredMaturity } = farmLevel;

            totalBalance = `${parseFloat(totalBalance) + parseFloat(balance)}`;
            totalWeightedBalance = `${parseFloat(totalWeightedBalance) + parseFloat(balance) * allocationPoints}`;

            levelOperations.push(
                prisma.prismaPoolStakingReliquaryFarmLevel.upsert({
                    where: { id_chain: { id: `${farmId}-${level}`, chain: chain } },
                    create: {
                        id: `${farmId}-${level}`,
                        chain: chain,
                        farmId,
                        allocationPoints,
                        balance,
                        level,
                        requiredMaturity,
                        // apr will be updated by apr service
                        apr: 0,
                    },
                    update: {
                        allocationPoints,
                        balance,
                        requiredMaturity,
                    },
                }),
            );
        }
        operations.push(
            prisma.prismaPoolStakingReliquaryFarm.upsert({
                where: { id_chain: { id: farmId, chain: chain } },
                create: {
                    id: farmId,
                    chain: chain,
                    stakingId: stakingId,
                    name: farm.name,
                    beetsPerSecond: beetsPerSecond,
                    totalBalance: totalBalance.toString(),
                    totalWeightedBalance: totalWeightedBalance.toString(),
                },
                update: {
                    beetsPerSecond: beetsPerSecond,
                    totalBalance: totalBalance.toString(),
                    totalWeightedBalance: totalWeightedBalance.toString(),
                    name: farm.name,
                },
            }),
        );
        operations.push(...levelOperations);
    }

    await prismaBulkExecuteOperations(operations, true);
};

// Farms stay: snapshots reference them and can't be rebuilt without the subgraph
export const deleteReliquaryStakingForAllPools = async (reloadStakingTypes: PrismaPoolStakingType[], chain: Chain) => {
    if (chain !== 'SONIC') {
        return;
    }
    if (reloadStakingTypes.includes('RELIQUARY')) {
        await prisma.prismaUserStakedBalance.deleteMany({
            where: { staking: { type: 'RELIQUARY' }, chain: chain },
        });
    }
};
