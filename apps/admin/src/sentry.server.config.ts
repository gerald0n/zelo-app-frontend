import * as Sentry from '@sentry/nextjs';
import { getAppEnv, getSentryDsn } from '@/config/env';

Sentry.init({
  dsn: getSentryDsn(),
  enabled: Boolean(getSentryDsn()),
  environment: getAppEnv(),
  tracesSampleRate: getAppEnv() === 'production' ? 0.1 : 1,
  sendDefaultPii: false,
  beforeSend(event) {
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
    }
    return event;
  },
});
