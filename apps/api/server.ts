import express from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import helmet from 'helmet';
import compression from 'compression';
import * as http from 'http';
import { env } from '../env';
import { loadRestRoutes } from './rest-routes';
import { corsMiddleware, lowerCaseMiddleware } from './middleware';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { ApolloServerPluginUsageReporting } from '@apollo/server/plugin/usageReporting';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { ApolloServerPluginCacheControl } from '@apollo/server/plugin/cacheControl';
import responseCachePlugin from '@apollo/server-plugin-response-cache';
import { schema } from './gql/generated-schema-ast';
import { resolvers } from './gql/resolvers';
import { ResolverContext, resolverContext } from './gql/resolver-context';
import { apolloSentryPlugin } from './apollo/sentry-plugin';

const configureHelmet = (app: express.Express) => {
    app.use(helmet.dnsPrefetchControl());
    app.use(helmet.expectCt());
    app.use(helmet.frameguard());
    app.use(helmet.hidePoweredBy());
    app.use(helmet.hsts());
    app.use(helmet.ieNoOpen());
    app.use(helmet.noSniff());
    app.use(helmet.originAgentCluster());
    app.use(helmet.permittedCrossDomainPolicies());
    app.use(helmet.referrerPolicy());
    app.use(helmet.xssFilter());
};

const configureMiddlewares = (app: express.Express) => {
    app.use(compression());
    app.use(corsMiddleware);
    app.use(lowerCaseMiddleware);
};

const configureApolloServer = async (httpServer: http.Server, app: express.Express) => {
    const plugins = [
        ApolloServerPluginDrainHttpServer({ httpServer }),
        apolloSentryPlugin,
        ApolloServerPluginCacheControl({ defaultMaxAge: 10 }),
        responseCachePlugin(),
    ];

    plugins.push(ApolloServerPluginLandingPageLocalDefault({ embed: true }));

    if (process.env.APOLLO_SCHEMA_REPORTING === 'true') {
        plugins.push(
            ApolloServerPluginUsageReporting({
                sendVariableValues: { all: true },
                sendHeaders: { all: true },
            }),
        );
    }

    const server = new ApolloServer<ResolverContext>({
        resolvers,
        typeDefs: schema,
        introspection: true,
        cache: 'bounded',
        plugins,
    });

    await server.start();

    const graphqlMiddleware = expressMiddleware(server, {
        context: async ({ req }) => resolverContext(req),
    });

    app.use('/graphql', express.json(), graphqlMiddleware);
    app.get('/', graphqlMiddleware);
    app.post('/', express.json(), graphqlMiddleware);

    return server;
};

export const startApiServer = async () => {
    const app = express();

    loadRestRoutes(app);
    configureHelmet(app);
    configureMiddlewares(app);

    const httpServer = http.createServer(app);

    await configureApolloServer(httpServer, app);

    await new Promise<void>((resolve) => httpServer.listen({ port: env.PORT }, resolve));
    console.log(`🚀 Server ready at http://localhost:${env.PORT}/graphql`);

    startMemoryLogging();
};

// rss vs heapUsed tells V8 heap growth apart from native memory (zlib, Prisma engine, malloc fragmentation)
const startMemoryLogging = () => {
    const toMb = (bytes: number) => Math.round(bytes / 1024 / 1024);
    setInterval(() => {
        const { rss, heapTotal, heapUsed, external, arrayBuffers } = process.memoryUsage();
        console.log(
            `memory rss=${toMb(rss)}MB heapTotal=${toMb(heapTotal)}MB heapUsed=${toMb(heapUsed)}MB external=${toMb(
                external,
            )}MB arrayBuffers=${toMb(arrayBuffers)}MB`,
        );
    }, 5 * 60 * 1000).unref();
};
