import * as Sentry from '@sentry/react-native';
import type { ReactElement } from 'react';
import { config } from './config';

/** Sentry is a no-op unless EXPO_PUBLIC_SENTRY_DSN is set. */
export const sentryEnabled = config.sentryDsn.length > 0;

if (sentryEnabled) {
  Sentry.init({
    dsn: config.sentryDsn,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    enabled: !__DEV__,
  });
}

export function withSentry(component: () => ReactElement): () => ReactElement {
  return sentryEnabled ? (Sentry.wrap(component) as () => ReactElement) : component;
}

export function captureError(e: unknown): void {
  if (sentryEnabled) Sentry.captureException(e);
}
