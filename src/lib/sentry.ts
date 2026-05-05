import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN;
const envSampleRate = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE);
const defaultSampleRate = import.meta.env.PROD ? 0.05 : 0;

const tracesSampleRate = Number.isFinite(envSampleRate)
  ? Math.min(1, Math.max(0, envSampleRate))
  : defaultSampleRate;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: import.meta.env.MODE,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate,
  sendDefaultPii: false,
  tracePropagationTargets: [
    /^https?:\/\/localhost(?::\d+)?/,
    /^\//,
  ],
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications.",
  ],
  initialScope: {
    tags: {
      app: "hubfy-web",
    },
  },
});

export { Sentry };
