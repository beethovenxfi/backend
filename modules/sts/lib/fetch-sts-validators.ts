import { Address, formatEther } from 'viem';
import SFC from '../../sources/contracts/abis/SonicSFC';
import { ViemClient } from '../../sources/types';

export interface DelegatedValidator {
    validatorId: string;
    assetsDelegated: string;
}

export async function fetchDelegatedValidators(
    stakingContractAddress: Address,
    sfcContractAddress: Address,
    client: ViemClient,
): Promise<DelegatedValidator[]> {
    const lastValidatorId = await client.readContract({
        address: sfcContractAddress,
        abi: SFC,
        functionName: 'lastValidatorID',
    });

    const validatorIds = Array.from({ length: Number(lastValidatorId) }, (_, i) => BigInt(i + 1));

    const stakes = await client.multicall({
        contracts: validatorIds.map((validatorId) => ({
            address: sfcContractAddress,
            abi: SFC,
            functionName: 'getStake' as const,
            args: [stakingContractAddress, validatorId] as const,
        })),
        allowFailure: false,
        multicallAddress: '0xca11bde05977b3631167028862be2a173976ca11',
    });

    return validatorIds
        .map((validatorId, i) => ({ validatorId: validatorId.toString(), stake: stakes[i] as bigint }))
        .filter(({ stake }) => stake > 0n)
        .map(({ validatorId, stake }) => ({ validatorId, assetsDelegated: formatEther(stake) }));
}
