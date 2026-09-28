import { Address, formatEther } from 'viem';
import { Chain } from '@prisma/client';
import ReliquaryAbi from '../../web3/abi/Reliquary';
import { ViemClient } from '../types';
import config from '../../../config';

const multicallBatchSize = 32_768;

const emissionCurveAbi = [
    {
        inputs: [{ internalType: 'uint256', name: 'lastRewardTime', type: 'uint256' }],
        name: 'getRate',
        outputs: [{ internalType: 'uint256', name: 'rate', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

export interface ReliquaryFarmLevelData {
    level: number;
    balance: string;
    allocationPoints: number;
    requiredMaturity: number;
}

export interface ReliquaryFarmData {
    pid: number;
    name: string;
    allocPoint: number;
    poolTokenAddress: string;
    totalBalance: string;
    levels: ReliquaryFarmLevelData[];
}

export interface ReliquaryData {
    totalAllocPoint: number;
    rewardPerSecond: string;
    farms: ReliquaryFarmData[];
}

export interface RelicData {
    relicId: number;
    owner: string;
    pid: number;
    amount: string;
}

export async function fetchReliquaryData(
    chain: Chain,
    reliquaryAddress: Address,
    client: ViemClient,
): Promise<ReliquaryData> {
    const reliquary = { address: reliquaryAddress, abi: ReliquaryAbi } as const;
    const multicallAddress = config[chain].multicall3 as Address;

    const [poolLength, totalAllocPoint, emissionCurve] = await client.multicall({
        contracts: [
            { ...reliquary, functionName: 'poolLength' },
            { ...reliquary, functionName: 'totalAllocPoint' },
            { ...reliquary, functionName: 'emissionCurve' },
        ],
        allowFailure: false,
        multicallAddress,
    });

    const pids = Array.from({ length: Number(poolLength) }, (_, i) => BigInt(i));

    const rewardPerSecond = await client.readContract({
        address: emissionCurve,
        abi: emissionCurveAbi,
        functionName: 'getRate',
        args: [BigInt(Math.floor(Date.now() / 1000))],
    });

    const farmResults = await client.multicall({
        contracts: pids.flatMap((pid) => [
            { ...reliquary, functionName: 'getPoolInfo' as const, args: [pid] as const },
            { ...reliquary, functionName: 'getLevelInfo' as const, args: [pid] as const },
            { ...reliquary, functionName: 'poolToken' as const, args: [pid] as const },
        ]),
        allowFailure: false,
        multicallAddress,
    });

    const farms = pids.map((pid, i) => {
        const poolInfo = farmResults[i * 3] as { allocPoint: bigint; name: string };
        const levelInfo = farmResults[i * 3 + 1] as {
            requiredMaturities: readonly bigint[];
            multipliers: readonly bigint[];
            balance: readonly bigint[];
        };
        const poolToken = farmResults[i * 3 + 2] as string;

        return {
            pid: Number(pid),
            name: poolInfo.name,
            allocPoint: Number(poolInfo.allocPoint),
            poolTokenAddress: poolToken.toLowerCase(),
            totalBalance: formatEther(levelInfo.balance.reduce((total, balance) => total + balance, 0n)),
            levels: levelInfo.requiredMaturities.map((requiredMaturity, level) => ({
                level,
                balance: formatEther(levelInfo.balance[level]),
                allocationPoints: Number(levelInfo.multipliers[level]),
                requiredMaturity: Number(requiredMaturity),
            })),
        };
    });

    return {
        totalAllocPoint: Number(totalAllocPoint),
        rewardPerSecond: formatEther(rewardPerSecond),
        farms,
    };
}

// Pinned to one block, otherwise relics burned or minted between the calls shift the token indexes
export async function fetchAllRelics(
    chain: Chain,
    reliquaryAddress: Address,
    client: ViemClient,
    blockNumber: bigint,
): Promise<RelicData[]> {
    const reliquary = { address: reliquaryAddress, abi: ReliquaryAbi } as const;
    const multicallAddress = config[chain].multicall3 as Address;

    const totalSupply = await client.readContract({ ...reliquary, functionName: 'totalSupply', blockNumber });

    const relicIds = await client.multicall({
        contracts: Array.from({ length: Number(totalSupply) }, (_, i) => ({
            ...reliquary,
            functionName: 'tokenByIndex' as const,
            args: [BigInt(i)] as const,
        })),
        allowFailure: false,
        blockNumber,
        batchSize: multicallBatchSize,
        multicallAddress,
    });

    const relicResults = await client.multicall({
        contracts: relicIds.flatMap((relicId) => [
            { ...reliquary, functionName: 'ownerOf' as const, args: [relicId] as const },
            { ...reliquary, functionName: 'getPositionForId' as const, args: [relicId] as const },
        ]),
        allowFailure: false,
        blockNumber,
        batchSize: multicallBatchSize,
        multicallAddress,
    });

    return relicIds.map((relicId, i) => {
        const owner = relicResults[i * 2] as string;
        const position = relicResults[i * 2 + 1] as { amount: bigint; poolId: bigint };

        return {
            relicId: Number(relicId),
            owner: owner.toLowerCase(),
            pid: Number(position.poolId),
            amount: formatEther(position.amount),
        };
    });
}
