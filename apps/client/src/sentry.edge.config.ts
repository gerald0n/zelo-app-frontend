import * as Sentry from '@sentry/nextjs';
import { getAppEnv, getSentryDsn } from '@/config/env';

Sentry.init({
  dsn: getSentryDsn(),
  enabled: Boolean(getSentryDsn()),
  environment: getAppEnv(),
  tracesSampleRate: getAppEnv() === 'production' ? 0.1 : 1,
  sendDefaultPii: false,
});
