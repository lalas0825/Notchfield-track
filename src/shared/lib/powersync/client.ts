import '@azure/core-asynciterator-polyfill';
import { Platform } from 'react-native';

let powerSync: any = null;
let connector: any = null;

// Only initialize PowerSync on native (uses SQLite)
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PowerSyncDatabase } = require('@powersync/react-native');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SupabaseConnector } = require('./supabase-connector');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AppSchema } = require('./schema');

  powerSync = new PowerSyncDatabase({
    schema: AppSchema,
    database: { dbFilename: 'notchfield-track.db' },
  });

  connector = new SupabaseConnector();
}

export { powerSync, connector };

export async function initPowerSync(): Promise<void> {
  if (Platform.OS === 'web' || !powerSync) return;
  // Open the local SQLite DB — fast, no network. We MUST await this so
  // localQuery() works immediately after init returns.
  await powerSync.init();
  // Kick off the network connection in the background. We do NOT await
  // this — on a flaky network it can hang for tens of seconds and we
  // would block app startup. PowerSync retries automatically.
  // Use the default connection method (WebSocket). The explicit
  // SyncStreamConnectionMethod.HTTP override was hanging in handshake on
  // some networks — WebSocket is the PowerSync default and is more reliable.
  powerSync
    .connect(connector)
    .catch((err: unknown) => {
      console.warn('[PowerSync] connect error (will retry):', err);
    });
}

export async function disconnectPowerSync(): Promise<void> {
  if (Platform.OS === 'web' || !powerSync) return;
  await powerSync.disconnectAndClear();
}

/**
 * Force a reconnect attempt. Safe to call repeatedly — PowerSync no-ops if
 * already connected; if disconnected, it kicks off a fresh handshake (which
 * goes through fetchCredentials → forces JWT refresh if expiring).
 *
 * Used by the AppState foreground listener in src/app/_layout.tsx to recover
 * from "stuck offline" scenarios where the device has WiFi but PowerSync's
 * WebSocket gave up during the offline period and never retried.
 */
export async function reconnectPowerSync(): Promise<void> {
  if (Platform.OS === 'web' || !powerSync || !connector) return;
  try {
    await powerSync.connect(connector);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[PowerSync] reconnect attempt failed (will retry on next AppState change):', err);
  }
}

export async function forceSync(): Promise<void> {
  if (Platform.OS === 'web' || !connector || !powerSync) return;
  await connector.uploadData(powerSync);
}
