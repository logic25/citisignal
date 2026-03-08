import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "https://088084156b657e7ecd4fb9a05f0519a0@o4511010485895168.ingest.us.sentry.io/4511010596978688",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 0.3,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  environment: import.meta.env.MODE,
  enabled: import.meta.env.PROD,
});

export default Sentry;
