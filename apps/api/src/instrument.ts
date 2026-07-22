// Sentry initialisation for the Fastify API.
//
// Imported as the VERY FIRST module in server.ts so Sentry's auto-instrumentation
// hooks are installed before any other module (Fastify, Prisma) is loaded.
//
// No-op when SENTRY_DSN is unset — local dev and any environment without the
// secret run completely unaffected. The DSN is set as a Coolify runtime secret
// in production (see docker-compose.yml `api` service).
import * as Sentry from '@sentry/node'

const dsn = process.env.SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    // Errors-only: no performance tracing (keeps overhead + quota minimal).
    tracesSampleRate: 0,
    // Explicit, not just the SDK default: never attach request bodies, headers,
    // cookies or IPs to events. This app handles encrypted patient PII (GDPR) —
    // error reports must not become a side channel for it.
    sendDefaultPii: false,
  })
}
