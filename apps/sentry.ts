import * as Sentry from '@sentry/node';
import { env } from './env';

// Imported first by apps/main.ts so Sentry is initialised before any other module loads.
//
// Kept deliberately small: errors only, no tracing/profiling, no console capture. Every event is sent
// explicitly (worker job failures via reportFailure, resolver errors via the Apollo plugin) and
// fingerprinted so one outage is one issue.

const role =
    process.env.SOR_INSTANCE === 'true'
        ? 'sor'
        : process.env.WORKER === 'true'
        ? 'worker'
        : process.env.SCHEDULER === 'true'
        ? 'scheduler'
        : 'api';

Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: `${role}-${env.DEPLOYMENT_ENV}`,
    enabled: env.NODE_ENV === 'production',
    tracesSampleRate: 0,
    ignoreErrors: [
        /Provide.*chain.*param/,
        /Unknown token:/,
        /SOR: invalid swap amount input/,
        /No potential swap paths provided/,
        /Variable "\$chains" of required type "\[GqlChain!\]!" was not provided/,
    ],
});
