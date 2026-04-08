import '@azure/core-asynciterator-polyfill';
import '../../global.css';
import '@/shared/lib/i18n/config';

import { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { Redirect, Slot, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { SyncStatusBar } from '@/shared/components/SyncStatusBar';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { RoleGate } from '@/shared/components/RoleGate';
import { TrackPermissionsProvider } from '@/shared/lib/permissions/TrackPermissionsContext';
import { startPhotoWorker } from '@/features/photos/services/photo-worker';

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

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
    startPhotoWorker();
  }, [initialize]);

  return (
    <PowerSyncProvider>
      <TrackPermissionsProvider>
        <StatusBar style="light" />
        <SyncStatusBar />
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
