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
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SyncStreamConnectionMethod } = require('@powersync/react-native');
  // Open the local SQLite DB — fast, no network. We MUST await this so
  // localQuery() works immediately after init returns.
  await powerSync.init();
  // Kick off the network connection in the background. We do NOT await
  // this — on a flaky network it can hang for tens of seconds and we
  // would block app startup. PowerSync retries automatically.
  powerSync
    .connect(connector, { connectionMethod: SyncStreamConnectionMethod.HTTP })
    .catch((err: unknown) => {
      console.warn('[PowerSync] connect error (will retry):', err);
    });
}

export async function disconnectPowerSync(): Promise<void> {
  if (Platform.OS === 'web' || !powerSync) return;
  await powerSync.disconnectAndClear();
}

export async function forceSync(): Promise<void> {
  if (Platform.OS === 'web' || !connector || !powerSync) return;
  await connector.uploadData(powerSync);
}
