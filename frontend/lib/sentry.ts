import type { ErrorEvent } from "@sentry/nextjs";

const REDACTED = "[Filtered]";

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-csrf-token",
  "x-forwarded-for",
  "x-real-ip",
]);

const SENSITIVE_EXTRA_KEY_PATTERN =
  /(access[_-]?token|authorization|cookie|password|phone|secret|token|whatsapp)/i;

export function isSentryEnabled(enabled: string | undefined, dsn: string | undefined) {
  return enabled === "true" && Boolean(dsn);
}

export function parseSentrySampleRate(value: string | undefined, fallback = 0) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return fallback;
  }

  return parsed;
}

export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;

    if (event.request.headers) {
      for (const headerName of Object.keys(event.request.headers)) {
        if (SENSITIVE_HEADERS.has(headerName.toLowerCase())) {
          event.request.headers[headerName] = REDACTED;
        }
      }
    }
  }

  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
    delete event.user.username;
  }

  if (event.extra) {
    for (const key of Object.keys(event.extra)) {
      if (SENSITIVE_EXTRA_KEY_PATTERN.test(key)) {
        event.extra[key] = REDACTED;
      }
    }
  }

  return event;
}
