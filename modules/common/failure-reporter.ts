import * as Sentry from '@sentry/node';

const failing = new Set<string>();

/**
 * Sends `error` to Sentry only when `key` flips from healthy to failing. While it keeps failing the caller's
 * logs and GET /health/jobs show it; Sentry gets exactly one event per outage. Call reportRecovery on the next
 * success so a later outage is reported again.
 */
export function reportFailure(key: string, error: unknown, tags: Record<string, string> = {}): void {
    if (failing.has(key)) {
        return;
    }
    failing.add(key);
    Sentry.captureException(error, { tags, fingerprint: [key] });
}

export function reportRecovery(key: string): void {
    failing.delete(key);
}
