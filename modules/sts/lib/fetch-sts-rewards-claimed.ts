import { Address, formatEther } from 'viem';
import SonicStaking from '../../sources/contracts/abis/SonicStaking';
import { ViemClient } from '../../sources/types';

export interface RewardsClaimedTotals {
    rewardsClaimed: number;
    protocolFee: number;
}

export async function fetchRewardsClaimed(
    stakingContractAddress: Address,
    client: ViemClient,
    fromBlock: number,
    toBlock: number,
    rpcMaxBlockRange: number,
): Promise<RewardsClaimedTotals> {
    let rewardsClaimed = 0n;
    let protocolFee = 0n;
    // Some RPCs return the same log more than once; count each log once.
    const seen = new Set<string>();

    for (let from = fromBlock; from <= toBlock; from += rpcMaxBlockRange + 1) {
        const to = Math.min(from + rpcMaxBlockRange, toBlock);

        const logs = await client.getContractEvents({
            address: stakingContractAddress,
            abi: SonicStaking,
            eventName: 'RewardsClaimed',
            fromBlock: BigInt(from),
            toBlock: BigInt(to),
            strict: true,
        });

        for (const log of logs) {
            const key = `${log.transactionHash}:${log.logIndex}`;
            if (seen.has(key)) continue;
            seen.add(key);

            rewardsClaimed += log.args.amountClaimed;
            protocolFee += log.args.protocolFee;
        }
    }

    return {
        rewardsClaimed: parseFloat(formatEther(rewardsClaimed)),
        protocolFee: parseFloat(formatEther(protocolFee)),
    };
}
