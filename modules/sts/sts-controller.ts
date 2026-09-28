import config from '../../config';
import { getViemClient } from '../sources/viem-client';
import { Address } from 'viem';
import { prisma } from '../../prisma/prisma-client';
import { GqlStakedSonicData } from '../../apps/api/gql/generated-schema';
import { syncStakingData } from './lib/sync-staking-data';

export function StakedSonicController(tracer?: any) {
    return {
        async syncSonicStakingData() {
            const stakingContractAddress = config['SONIC'].sts!.address;
            const validatorFee = config['SONIC'].sts!.validatorFee;
            const sfcContractAddress = config['SONIC'].sts!.sfcAddress;
            const constantsContractAddress = config['SONIC'].sts!.constantsManagerAddress;

            // Guard against unconfigured chains
            if (!stakingContractAddress || !sfcContractAddress || !constantsContractAddress || !validatorFee) {
                throw new Error(`Chain not configured for job sonic staking data`);
            }

            const viemClient = getViemClient('SONIC');

            await syncStakingData(
                stakingContractAddress as Address,
                sfcContractAddress as Address,
                constantsContractAddress as Address,
                viemClient,
                validatorFee,
            );
        },
        async getStakingData(): Promise<GqlStakedSonicData> {
            const stakingData = await prisma.prismaStakedSonicData.findFirstOrThrow({
                include: {
                    delegatedValidators: true,
                },
            });
            return stakingData;
        },
    };
}
