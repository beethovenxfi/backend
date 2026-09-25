import { EnvType, load } from 'ts-dotenv';
import { resolve } from 'path';

type Env = EnvType<typeof schema>;

export const schema = {
    PORT: Number,
    NODE_ENV: String,
    DEPLOYMENT_ENV: String,
    ADMIN_API_KEY: String,
    DATABASE_URL: String,
    SENTRY_DSN: String,
    DIRECT_API_KEY: {
        optional: true,
        type: String,
    },
    COINGECKO_API_KEY: {
        optional: true,
        type: String,
    },
    MERKL_API_KEY: {
        type: String,
        optional: true,
    },
    WORKER_QUEUE_URL: {
        optional: true,
        type: String,
    },
    SOR_POOLS_CACHE_TTL_SECONDS: {
        type: String,
        default: '10',
    },
    SOR_SERVICE_URL: {
        type: String,
        default: 'http://localhost:4000/graphql',
    },
    SOR_INSTANCE: {
        type: Boolean,
        default: false,
    },
};

export const env: Env = load(schema, {
    path: resolve(__dirname, `../../.env`),
    overrideProcessEnv: true,
});
