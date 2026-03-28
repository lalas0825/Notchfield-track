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

function localFilename(storagePath: string): string {
  return storagePath.replace(/\//g, '_');
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
 * Download a PDF from Supabase Storage and cache it locally.
 */
export async function downloadAndCachePdf(
  storagePath: string,
  bucket = 'drawings',
  onProgress?: (progress: number) => void,
): Promise<string | null> {
  if (Platform.OS === 'web') return storagePath;
  await ensureCacheDir();

  const { data: signedData, error: signError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, 3600);

  if (signError || !signedData?.signedUrl) {
    console.error('[Plans] Signed URL failed:', signError?.message);
    return null;
  }

  const localPath = `${CACHE_DIR}${localFilename(storagePath)}`;

  try {
    const download = LegacyFileSystem.createDownloadResumable(
      signedData.signedUrl,
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
      logger.info(`[Plans] Cached: ${storagePath}`);
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
