import { prisma } from '../../../prisma/prisma-client';
import { GqlPoolSnapshotDataRange } from '../../../apps/api/gql/generated-schema';
import moment from 'moment-timezone';
import _ from 'lodash';
import { Address } from 'viem';
import { prismaBulkExecuteOperations } from '../../../prisma/prisma-util';
import { Chain } from '@prisma/client';
import { fetchAllRelics, fetchReliquaryData } from '../../sources/contracts/fetch-reliquary-data';
import { getViemClient } from '../../sources/viem-client';
import config from '../../../config';

export class ReliquarySnapshotService {
    public async getSnapshotsForFarm(farmId: number, range: GqlPoolSnapshotDataRange, chain: Chain) {
        const timestamp = this.getTimestampForRange(range);
        return prisma.prismaReliquaryFarmSnapshot.findMany({
            where: { farmId: `${farmId}`, timestamp: { gte: timestamp }, chain: chain },
            orderBy: { timestamp: 'asc' },
        });
    }

    // Past days keep their last synced value, recomputing them would need archive reads for every relic
    public async syncLatestSnapshotsForAllFarms(chain: Chain) {
        const reliquaryConfig = config[chain].reliquary;
        if (!reliquaryConfig) {
            return;
        }

        const client = getViemClient(chain);
        const reliquaryAddress = reliquaryConfig.address as Address;
        const blockNumber = await client.getBlockNumber();
        const { farms } = await fetchReliquaryData(chain, reliquaryAddress, client);
        const relics = await fetchAllRelics(chain, reliquaryAddress, client, blockNumber);

        const dbFarms = await prisma.prismaPoolStakingReliquaryFarm.findMany({
            where: { chain },
            include: { staking: true },
        });

        const timestamp = moment().utc().startOf('day').unix();
        const operations: any[] = [];

        for (const farm of farms) {
            const farmId = `${farm.pid}`;
            const dbFarm = dbFarms.find((dbFarm) => dbFarm.id === farmId);
            if (!dbFarm || reliquaryConfig.excludedFarmIds.includes(farmId)) {
                continue;
            }

            const relicsInFarm = relics.filter((relic) => relic.pid === farm.pid);

            const mostRecentPoolSnapshot = await prisma.prismaPoolSnapshot.findFirst({
                where: { poolId: dbFarm.staking.poolId, chain },
                orderBy: { timestamp: 'desc' },
            });
            const sharePercentage = mostRecentPoolSnapshot?.totalSharesNum
                ? parseFloat(farm.totalBalance) / mostRecentPoolSnapshot.totalSharesNum
                : 0;

            // snapshots synced from the subgraph have other ids, reuse them so a day never has two snapshots
            const existing = await prisma.prismaReliquaryFarmSnapshot.findFirst({
                where: { chain, farmId, timestamp },
                select: { id: true },
            });
            const id = existing?.id || `${farmId}-${timestamp}`;

            const data = {
                id,
                chain,
                farmId,
                timestamp,
                relicCount: relicsInFarm.length,
                userCount: _.uniq(relicsInFarm.map((relic) => relic.owner)).length,
                totalBalance: farm.totalBalance,
                totalLiquidity: `${(mostRecentPoolSnapshot?.totalLiquidity || 0) * sharePercentage}`,
            };

            operations.push(
                prisma.prismaReliquaryFarmSnapshot.upsert({
                    where: { id_chain: { id, chain } },
                    create: data,
                    update: data,
                }),
            );
        }

        await prismaBulkExecuteOperations(operations, true);
    }

    private getTimestampForRange(range: GqlPoolSnapshotDataRange): number {
        switch (range) {
            case 'THIRTY_DAYS':
                return moment().startOf('day').subtract(30, 'days').unix();
            case 'NINETY_DAYS':
                return moment().startOf('day').subtract(90, 'days').unix();
            case 'ONE_HUNDRED_EIGHTY_DAYS':
                return moment().startOf('day').subtract(180, 'days').unix();
            case 'ONE_YEAR':
                return moment().startOf('day').subtract(365, 'days').unix();
            case 'ALL_TIME':
                return 0;
        }
    }
}

export const reliquarySnapshotService = new ReliquarySnapshotService();
