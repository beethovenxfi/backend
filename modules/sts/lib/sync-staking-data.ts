import { prisma } from '../../../prisma/prisma-client';
import { fetchSonicStakingData } from './fetch-sts-staking-data';
import { fetchDelegatedValidators } from './fetch-sts-validators';
import { fetchRewardsClaimed } from './fetch-sts-rewards-claimed';
import { Address } from 'viem';
import { ViemClient } from '../../sources/viem-client';
import { blockNumbers } from '../../block-numbers';
import moment from 'moment';
import config from '../../../config';

export async function syncStakingData(
    stakingContractAddress: Address,
    sfcContractAddress: Address,
    constantsContractAddress: Address,
    viemClient: ViemClient,
    validatorFee: number,
) {
    const stakingDataOnchain = await fetchSonicStakingData(
        stakingContractAddress,
        constantsContractAddress,
        sfcContractAddress,
        viemClient,
    );
    const validators = await fetchDelegatedValidators(stakingContractAddress, sfcContractAddress, viemClient);

    // 24h fee and rewards totals come from RewardsClaimed logs. Without a 24h-ago block we keep the stored values.
    let fees24h: { protocolFee24h: string; rewardsClaimed24h: string } | undefined;
    const block24HrsAgo = await blockNumbers().getBlock('SONIC', moment().unix() - 24 * 60 * 60);
    if (block24HrsAgo) {
        const latestBlock = Number(await viemClient.getBlockNumber());
        const claimed = await fetchRewardsClaimed(
            stakingContractAddress,
            viemClient,
            block24HrsAgo,
            latestBlock,
            config['SONIC'].rpcMaxBlockRange,
        );

        const sPrice = await prisma.prismaTokenCurrentPrice.findFirst({
            where: {
                chain: 'SONIC',
                tokenAddress: config['SONIC'].weth.address,
            },
        });

        fees24h = {
            protocolFee24h: `${claimed.protocolFee * (sPrice?.price || 0)}`,
            rewardsClaimed24h: `${claimed.rewardsClaimed * (sPrice?.price || 0)}`,
        };
    }

    const stakingApr =
        (parseFloat(stakingDataOnchain.totalDelegated) / parseFloat(stakingDataOnchain.totalAssets)) *
        ((parseFloat(stakingDataOnchain.apr) / 100) * (1 - validatorFee)) *
        (1 - parseFloat(stakingDataOnchain.protocolFee));

    const stakingData = {
        id: stakingContractAddress,
        totalAssets: stakingDataOnchain.totalAssets,
        totalAssetsDelegated: stakingDataOnchain.totalDelegated,
        totalAssetsPool: stakingDataOnchain.totalPool,
        exchangeRate: stakingDataOnchain.exchangeRate,
        stakingApr: `${stakingApr}`,
        ...fees24h,
    };

    await prisma.prismaStakedSonicData.upsert({
        where: { id: stakingContractAddress },
        create: stakingData,
        update: stakingData,
    });

    for (const validator of validators) {
        await prisma.prismaStakedSonicDelegatedValidator.upsert({
            where: { validatorId: validator.validatorId },
            create: { ...validator, sonicStakingId: stakingContractAddress },
            update: validator,
        });
    }

    // Validators stS fully undelegated from
    await prisma.prismaStakedSonicDelegatedValidator.deleteMany({
        where: { validatorId: { notIn: validators.map((validator) => validator.validatorId) } },
    });
}
