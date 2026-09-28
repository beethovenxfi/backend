import { StakedSonicController } from '../../../../modules/sts/sts-controller';
import { Resolvers } from '../generated-schema';

const resolvers: Resolvers = {
    Query: {
        stsGetGqlStakedSonicData: async (parent, {}, context) => {
            return StakedSonicController().getStakingData();
        },
    },
};

export default resolvers;
