import '@azure/core-asynciterator-polyfill';
import '../../global.css';

import { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/features/auth/store/auth-store';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, initialized } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)/home');
    }
  }, [session, initialized, segments]);

  if (!initialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' }}>
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  return <>{children}</>;
}

function PowerSyncProvider({ children }: { children: React.ReactNode }) {
  // PowerSync uses native SQLite — skip on web
  if (Platform.OS === 'web') {
    return <>{children}</>;
  }

  // Dynamic require to avoid web bundle crash
  const { PowerSyncContext } = require('@powersync/react-native');
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
  }, []);

  return (
    <PowerSyncProvider>
      <StatusBar style="light" />
      <AuthGate>
        <Slot />
      </AuthGate>
    </PowerSyncProvider>
  );
}
