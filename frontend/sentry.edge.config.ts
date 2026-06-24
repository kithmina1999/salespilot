import * as Sentry from "@sentry/nextjs";
import {
  isSentryEnabled,
  parseSentrySampleRate,
  scrubSentryEvent,
} from "@/lib/sentry";

const dsn = process.env.SENTRY_FRONTEND_DSN || process.env.NEXT_PUBLIC_SENTRY_FRONTEND_DSN;

Sentry.init({
  dsn,
  enabled: isSentryEnabled(process.env.SENTRY_ENABLED, dsn),
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  release: process.env.SENTRY_RELEASE,
  sendDefaultPii: false,
  tracesSampleRate: parseSentrySampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE),
  beforeSend: scrubSentryEvent,
});
