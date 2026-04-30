import '@azure/core-asynciterator-polyfill';
import { Platform } from 'react-native';

let powerSync: any = null;
let connector: any = null;

/**
 * Sprint 73C Security Audit Item #2 — at-rest encryption status:
 * **NOT IMPLEMENTED ON THIS POWERSYNC VERSION.**
 *
 * Track runs `@powersync/react-native@1.33.x` which uses
 * `@journeyapps/react-native-quick-sqlite` as the SQLite adapter. That
 * adapter ships vanilla SQLite (NOT SQLCipher) — the constructor does
 * not accept an `encryptionKey`, no `setEncryptionKey`/`setKey` method
 * exists, and grepping the installed source confirms zero AES wiring.
 *
 * The audit spec assumed an API surface that PowerSync hasn't shipped
 * on this version. Real fixes available:
 *   1. Wait for PowerSync to ship SQLCipher support (issue tracked
 *      upstream — no ETA at the time of this audit).
 *   2. Fork the SQLite adapter to use SQLCipher source — multi-week
 *      native work, breaks the upgrade path for every PowerSync minor.
 *   3. Migrate to op-sqlite (RN SQLite alt with SQLCipher support) +
 *      replace PowerSync's adapter — major refactor.
 *
 * Mitigation in place TODAY (defense-in-depth):
 *   - `android:allowBackup="false"` in app.json blocks adb-backup
 *     extraction even on unrooted/locked devices (the realistic threat
 *     model — a stolen unlocked phone or a rooted attacker is already
 *     well past defendable surface).
 *   - iOS data protection class default (NSFileProtectionComplete /
 *     NSFileProtectionCompleteUntilFirstUserAuthentication) encrypts
 *     app sandbox at rest when the device has a passcode. Track adds
 *     no override.
 *   - Sensitive fields that DON'T need to live in PowerSync local DB
 *     (e.g. raw JWTs, refresh tokens) are already in expo-secure-store
 *     via Keychain/Keystore — see audit item #1.
 *
 * Open follow-up: when PowerSync ships encryption, replace this block
 * with the canonical wiring pattern + fresh-key migration.
 */

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
