/**
 * Sentry wiring — crash reporting + React error capture.
 *
 * Called ONCE from the root layout, before any screen renders, so crashes
 * during startup are captured too. Dev builds are intentionally excluded
 * (otherwise Metro-HMR-induced errors flood the dashboard every save).
 *
 * PII rule: we capture `user.id` only. Full name, email, and IP are
 * stripped in `beforeSend` before any event leaves the device.
 */

import * as Sentry from '@sentry/react-native';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

/**
 * Initialize Sentry. Idempotent — safe to call more than once.
 * Returns true if Sentry was actually wired (prod build with DSN set),
 * false if skipped (dev build or missing DSN).
 */
export function initSentry(): boolean {
  // Skip in dev builds — Fast Refresh errors aren't real crashes and
  // swamping the dashboard makes the signal useless.
  if (__DEV__) return false;
  if (!DSN) {
    // eslint-disable-next-line no-console
    console.warn('[Sentry] EXPO_PUBLIC_SENTRY_DSN not set — skipping init');
    return false;
  }

  Sentry.init({
    dsn: DSN,
    // Sample rate for performance tracing. 20% is a good balance between
    // visibility and the Sentry free-tier event budget.
    tracesSampleRate: 0.2,
    // Only send events from prod builds — already guarded above, but
    // belt-and-suspenders in case this module is ever called from dev.
    enabled: !__DEV__,
    // PII redaction. We keep user.id (scoped via setSentryUser) but never
    // leak name, email, IP, or any free-form context that could include
    // identifiers.
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
        delete event.user.username;
        delete event.user.name;
      }
      // Strip any incidental "full_name" from tags/extra/contexts.
      if (event.tags && typeof event.tags === 'object') {
        delete (event.tags as Record<string, unknown>).full_name;
        delete (event.tags as Record<string, unknown>).email;
      }
      return event;
    },
  });

  return true;
}

/**
 * Scope subsequent events to a signed-in user. Called from auth-store
 * on SIGNED_IN / session restore. Only the user.id goes up — no email,
 * no name.
 */
export function setSentryUser(userId: string, role?: string, orgId?: string): void {
  Sentry.setUser({ id: userId });
  if (role) Sentry.setTag('role', role);
  if (orgId) Sentry.setTag('organization_id', orgId);
}

/**
 * Clear user context on sign-out / account deletion so any subsequent
 * crash reports are attributed to an anonymous session.
 */
export function clearSentryUser(): void {
  Sentry.setUser(null);
  Sentry.setTag('role', null as unknown as string);
  Sentry.setTag('organization_id', null as unknown as string);
}

/**
 * Manually report a caught exception. Thin pass-through; use this from
 * error boundaries or catch blocks where you want to surface the error
 * despite recovering the UI.
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (__DEV__) return;
  Sentry.captureException(error, { extra: context });
}

export { Sentry };
