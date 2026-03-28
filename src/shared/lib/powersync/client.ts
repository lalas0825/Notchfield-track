import '@azure/core-asynciterator-polyfill';
import { Platform } from 'react-native';

let powerSync: any = null;
let connector: any = null;

// Only initialize PowerSync on native (uses SQLite)
if (Platform.OS !== 'web') {
  const { PowerSyncDatabase } = require('@powersync/react-native');
  const { SupabaseConnector } = require('./supabase-connector');
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
  const { SyncStreamConnectionMethod } = require('@powersync/react-native');
  await powerSync.init();
  await powerSync.connect(connector, {
    connectionMethod: SyncStreamConnectionMethod.HTTP,
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
