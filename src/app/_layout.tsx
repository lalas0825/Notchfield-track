import '@azure/core-asynciterator-polyfill';
import '../../global.css';
import '@/shared/lib/i18n/config';
// Sentry initialization MUST run before any component renders so startup
// crashes (PowerSync init, auth restore) are captured too.
import { initSentry, Sentry } from '@/shared/lib/sentry';
initSentry();

import { useEffect } from 'react';
import { ActivityIndicator, AppState, type AppStateStatus, Platform, View } from 'react-native';
import { Redirect, Slot, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { SyncStatusBar } from '@/shared/components/SyncStatusBar';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { RoleGate } from '@/shared/components/RoleGate';
import { TrackPermissionsProvider } from '@/shared/lib/permissions/TrackPermissionsContext';
import { startPhotoWorker } from '@/features/photos/services/photo-worker';
import { usePushPermission } from '@/features/notifications/hooks/usePushPermission';

/**
 * Auth gate using declarative <Redirect> instead of imperative router.replace().
 * The guide says router.replace() in useEffect crashes on native with
 * "Attempted to navigate before mounting Root Layout".
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, initialized } = useAuthStore();
  const segments = useSegments();

  if (!initialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' }}>
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  const inAuthGroup = segments[0] === '(auth)';

  // Not signed in and not on auth screen → redirect to login
  if (!session && !inAuthGroup) {
    return <Redirect href="/(auth)/login" />;
  }

  // Signed in but on auth screen → redirect to home
  if (session && inAuthGroup) {
    return <Redirect href="/(tabs)/home" />;
  }

  return <>{children}</>;
}

function PowerSyncProvider({ children }: { children: React.ReactNode }) {
  if (Platform.OS === 'web') {
    return <>{children}</>;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PowerSyncContext } = require('@powersync/react-native');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { powerSync } = require('@/shared/lib/powersync/client');

  return (
    <PowerSyncContext.Provider value={powerSync}>
      {children}
    </PowerSyncContext.Provider>
  );
}

/**
 * Bootstrap component that mounts side-effect-only hooks (push permission,
 * device token registration). Renders nothing. Lives inside the providers
 * so PowerSync + auth state are available to the hooks.
 */
function NotificationsBootstrap() {
  usePushPermission();
  return null;
}

function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
    startPhotoWorker();
  }, [initialize]);

  // Bug fix 2026-04-25 — Recover from "stuck offline" after device WiFi
  // returns. When the app comes to foreground:
  //   1. Refresh the Supabase auth session (forces a fresh JWT — needed
  //      because autoRefreshToken doesn't fire reliably on RN when the
  //      app was backgrounded)
  //   2. Trigger PowerSync reconnect (safe no-op if already connected)
  // Cheap, idempotent, no external deps.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let unsubFns: Array<() => void> = [];
    (async () => {
      const [{ supabase }, { reconnectPowerSync }] = await Promise.all([
        import('@/shared/lib/supabase/client'),
        import('@/shared/lib/powersync/client'),
      ]);
      const handler = (next: AppStateStatus) => {
        if (next !== 'active') return;
        // Fire-and-forget — don't block UI on either operation
        supabase.auth.refreshSession().catch(() => undefined);
        reconnectPowerSync().catch(() => undefined);
      };
      const sub = AppState.addEventListener('change', handler);
      unsubFns.push(() => sub.remove());
    })();
    return () => {
      unsubFns.forEach((fn) => fn());
    };
  }, []);

  return (
    <PowerSyncProvider>
      <TrackPermissionsProvider>
        <StatusBar style="light" />
        <SyncStatusBar />
        <NotificationsBootstrap />
        <AuthGate>
          <RoleGate>
            <ErrorBoundary>
              <Slot />
            </ErrorBoundary>
          </RoleGate>
        </AuthGate>
      </TrackPermissionsProvider>
    </PowerSyncProvider>
  );
}

// Sentry.wrap() adds native crash reporting + touch/navigation breadcrumbs.
// No-op in dev (initSentry short-circuits on __DEV__) but the wrap itself
// is always applied so the prod path is exercised on every build.
export default Sentry.wrap(RootLayout);
