/**
 * Drawing Service — PDF download + offline cache
 * =================================================
 * Uses expo-file-system legacy API for SDK 55 compatibility.
 *
 * Strategy:
 *   1. Check if PDF exists locally in document directory
 *   2. If yes → return local URI (instant, works offline)
 *   3. If no → download from Supabase Storage → save locally
 *   4. If offline + not cached → return null
 */

import * as LegacyFileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { supabase } from '@/shared/lib/supabase/client';
import { logger } from '@/shared/lib/logger';

const CACHE_DIR = `${LegacyFileSystem.documentDirectory ?? ''}plans/`;

async function ensureCacheDir(): Promise<void> {
  if (Platform.OS === 'web') return;
  const info = await LegacyFileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await LegacyFileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

function localFilename(pathOrUrl: string): string {
  // Cache key must be stable across reruns. Strip query strings from URLs
  // (signed-URL expiry tokens change every call) and replace path slashes.
  const noQuery = pathOrUrl.split('?')[0] ?? pathOrUrl;
  return noQuery.replace(/[\\/]/g, '_').replace(/[^\w.\-_]/g, '_');
}

function isUrl(s: string): boolean {
  return /^https?:\/\//i.test(s);
}

/**
 * Get local URI for a cached PDF, or null if not cached.
 */
export async function getCachedPdfUri(storagePath: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  await ensureCacheDir();
  const localPath = `${CACHE_DIR}${localFilename(storagePath)}`;
  const info = await LegacyFileSystem.getInfoAsync(localPath);
  return info.exists ? localPath : null;
}

/**
 * Download a PDF and cache it locally. Accepts either:
 *   - A full public/private URL (starts with http) — used for `drawing_register.file_url`
 *     (Takeoff PM uploads to the `documents` bucket with public URLs).
 *   - A Supabase Storage path — legacy, backs the Estimator's `drawing_sets.file_path`.
 *     Signed via `supabase.storage.from(bucket).createSignedUrl` before download.
 */
export async function downloadAndCachePdf(
  pathOrUrl: string,
  bucket = 'drawings',
  onProgress?: (progress: number) => void,
): Promise<string | null> {
  if (Platform.OS === 'web') return pathOrUrl;
  await ensureCacheDir();

  let downloadUrl: string;

  if (isUrl(pathOrUrl)) {
    // Direct URL — public URL from Takeoff PM's `documents` bucket, or a
    // pre-signed URL. Use as-is. The file_url values in drawing_register
    // point to a public bucket so no signing needed.
    downloadUrl = pathOrUrl;
  } else {
    // Storage path — sign it with the given bucket.
    const { data: signedData, error: signError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(pathOrUrl, 3600);

    if (signError || !signedData?.signedUrl) {
      console.error('[Plans] Signed URL failed:', signError?.message);
      return null;
    }
    downloadUrl = signedData.signedUrl;
  }

  const localPath = `${CACHE_DIR}${localFilename(pathOrUrl)}`;

  try {
    const download = LegacyFileSystem.createDownloadResumable(
      downloadUrl,
      localPath,
      {},
      (downloadProgress) => {
        if (onProgress && downloadProgress.totalBytesExpectedToWrite > 0) {
          onProgress(
            downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite,
          );
        }
      },
    );

    const result = await download.downloadAsync();
    if (result?.uri) {
      logger.info(`[Plans] Cached: ${pathOrUrl.slice(0, 80)}`);
      return result.uri;
    }
    return null;
  } catch (err) {
    console.error('[Plans] Download failed:', err);
    return null;
  }
}

/**
 * Get PDF URI — cached first, then download.
 */
export async function getPdfUri(
  storagePath: string,
  bucket?: string,
  onProgress?: (progress: number) => void,
): Promise<string | null> {
  const cached = await getCachedPdfUri(storagePath);
  if (cached) return cached;
  return downloadAndCachePdf(storagePath, bucket, onProgress);
}

/**
 * Check if a PDF is available offline.
 */
export async function isPdfCached(storagePath: string): Promise<boolean> {
  return (await getCachedPdfUri(storagePath)) !== null;
}

/**
 * Delete a cached PDF.
 */
export async function deleteCachedPdf(storagePath: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const localPath = `${CACHE_DIR}${localFilename(storagePath)}`;
  const info = await LegacyFileSystem.getInfoAsync(localPath);
  if (info.exists) {
    await LegacyFileSystem.deleteAsync(localPath);
  }
}

/**
 * Get total cache size in bytes.
 */
export async function getCacheSize(): Promise<number> {
  if (Platform.OS === 'web') return 0;
  await ensureCacheDir();
  const files = await LegacyFileSystem.readDirectoryAsync(CACHE_DIR);
  let total = 0;
  for (const file of files) {
    const info = await LegacyFileSystem.getInfoAsync(`${CACHE_DIR}${file}`);
    if (info.exists && 'size' in info) total += (info as any).size ?? 0;
  }
  return total;
}

/**
 * Clear all cached plans.
 */
export async function clearCache(): Promise<void> {
  if (Platform.OS === 'web') return;
  await LegacyFileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
  await ensureCacheDir();
}
