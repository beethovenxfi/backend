import { captureException } from '@sentry/node';
import { ApolloServerPlugin } from '@apollo/server';
import { ResolverContext } from '../gql/resolver-context';

// Error codes raised for bad client input; not worth an event.
const IGNORED_CODES = [
    'GRAPHQL_PARSE_FAILED',
    'GRAPHQL_VALIDATION_FAILED',
    'BAD_USER_INPUT',
    'ACCOUNT_ADDRESS_REQUIRED',
    'ACCESS_DENIED',
    'NOT_FOUND',
];

export const apolloSentryPlugin: ApolloServerPlugin<ResolverContext> = {
    async requestDidStart({ request }) {
        return {
            async didEncounterErrors(ctx) {
                const operation = request.operationName || 'anonymous';

                for (const err of ctx.errors) {
                    if (IGNORED_CODES.includes(err.extensions?.code as string)) {
                        continue;
                    }

                    if (err.message === 'SOR queryBatchSwap failed') {
                        continue;
                    }

                    captureException(err.originalError ?? err, { tags: { operation } });
                }
            },
        };
    },
};
