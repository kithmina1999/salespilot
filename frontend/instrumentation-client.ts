import * as Sentry from "@sentry/nextjs";
import {
  isSentryEnabled,
  parseSentrySampleRate,
  scrubSentryEvent,
} from "@/lib/sentry";

const dsn = process.env.NEXT_PUBLIC_SENTRY_FRONTEND_DSN;

Sentry.init({
  dsn,
  enabled: isSentryEnabled(process.env.NEXT_PUBLIC_SENTRY_ENABLED, dsn),
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  sendDefaultPii: false,
  tracesSampleRate: parseSentrySampleRate(
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
  ),
  beforeSend: scrubSentryEvent,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
