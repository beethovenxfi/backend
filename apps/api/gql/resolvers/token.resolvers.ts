import { GqlChain, Resolvers } from '../generated-schema';
import { isAdminRoute } from '../../../../modules/auth/auth-context';
import { tokenService } from '../../../../modules/token/token.service';
import moment from 'moment';
import { TokenController } from '../../../../modules/controllers/token-controller';
import config from '../../../../config';
import { PricingService } from '../../../../modules/pricing';
import { ContentController } from '../../../../modules/content/content-controller';

const resolvers: Resolvers = {
    Query: {
        tokenGetTokens: async (parent, args, context) => {
            return tokenService.getTokenDefinitions(args);
        },
        tokenGetCurrentPrices: async (parent, { chains }, context) => {
            const prices = await tokenService.getCurrentTokenPrices(chains);

            return prices.map((price) => ({
                address: price.tokenAddress,
                price: price.price,
                chain: price.chain,
                updatedAt: moment(price.updatedAt).unix(),
                updatedBy: price.updatedBy,
            }));
        },
    },
    Mutation: {
        tokenReloadTokenPrices: async (parent, { chains }, context) => {
            isAdminRoute(context);

            const service = new PricingService(chains);
            for (const chain of chains) {
                await service.updatePrices(chain);
            }

            return true;
        },
        tokenSyncTokenDefinitions: async (parent, {}, context) => {
            isAdminRoute(context);

            await ContentController().syncTokenContentData();

            return 'success';
        },
        tokenDeleteTokenType: async (parent, args, context) => {
            isAdminRoute(context);

            await tokenService.deleteTokenType(args, args.chain);

            return 'success';
        },
        tokenReloadAllTokenTypes: async (parent, { chain }, context) => {
            isAdminRoute(context);

            await ContentController().reloadAllTokenTypes(chain);

            return 'success';
        },
        tokenReloadErc4626Tokens: async (parent, { chains }, context) => {
            isAdminRoute(context);

            const result: { type: string; chain: GqlChain; success: boolean; error: string | undefined }[] = [];

            for (const chain of chains) {
                try {
                    await TokenController().syncErc4626Tokens(chain);
                    result.push({ type: 'v3', chain, success: true, error: undefined });
                } catch (e) {
                    result.push({ type: 'v3', chain, success: false, error: `${e}` });
                    console.log(`Could not reload v3 pools for chain ${chain}: ${e}`);
                }
            }

            return result;
        },
    },
};

export default resolvers;
