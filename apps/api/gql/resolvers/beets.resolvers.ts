import { Resolvers } from '../generated-schema';
import { poolService } from '../../../../modules/pool/pool.service';

const beetsResolvers: Resolvers = {
    Query: {
        beetsPoolGetReliquaryFarmSnapshots: async (parent, { id, range, chain }, context) => {
            const snapshots = await poolService.getSnapshotsForReliquaryFarm(parseFloat(id), range, chain);

            return snapshots.map((snapshot) => ({
                id: snapshot.id,
                farmId: snapshot.farmId,
                timestamp: snapshot.timestamp,
                relicCount: `${snapshot.relicCount}`,
                userCount: `${snapshot.userCount}`,
                totalBalance: snapshot.totalBalance,
                totalLiquidity: snapshot.totalLiquidity,
            }));
        },
    },
};

export default beetsResolvers;
