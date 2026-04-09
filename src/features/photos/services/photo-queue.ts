/**
 * Photo Upload Queue — Outbox Pattern
 * =====================================
 * Hook takes photo → saves to local filesystem → inserts queue row.
 * Worker (separate) picks up pending items and uploads to Supabase Storage.
 * If app closes mid-upload, queue rows persist in SQLite via Supabase.
 * On next app open, worker resumes.
 *
 * The hook and the worker are fully decoupled.
 */

import * as LegacyFileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { supabase } from '@/shared/lib/supabase/client';
import { localInsert, generateUUID } from '@/shared/lib/powersync/write';
import { logger } from '@/shared/lib/logger';

const PHOTOS_DIR = `${LegacyFileSystem.documentDirectory ?? ''}field-photos/`;

async function ensurePhotosDir(): Promise<void> {
  if (Platform.OS === 'web') return;
  const info = await LegacyFileSystem.getInfoAsync(PHOTOS_DIR);
  if (!info.exists) {
    await LegacyFileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
  }
}

/**
 * Enqueue a photo for upload.
 * 1. Copies the photo to a permanent local path (camera roll URIs are temporary)
 * 2. Inserts a row into field_photos with sync_status = 'pending'
 * Returns the local URI for immediate display.
 */
export async function enqueuePhoto(params: {
  sourceUri: string;
  organizationId: string;
  projectId: string;
  areaId?: string;
  objectId?: string | null;
  phaseId?: string | null;
  contextType: string;
  caption?: string;
  takenBy: string;
  gpsLat?: number;
  gpsLng?: number;
}): Promise<{ localUri: string; photoId: string | null }> {
  // On web, skip local copy
  if (Platform.OS === 'web') {
    return { localUri: params.sourceUri, photoId: null };
  }

  await ensurePhotosDir();

  // Generate unique filename
  const ext = params.sourceUri.split('.').pop() ?? 'jpg';
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const localUri = `${PHOTOS_DIR}${filename}`;

  // Copy from temp camera location to permanent local storage
  await LegacyFileSystem.copyAsync({
    from: params.sourceUri,
    to: localUri,
  });

  // Insert into field_photos table (PowerSync syncs this)
  const photoId = generateUUID();
  const result = await localInsert('field_photos', {
    id: photoId,
    organization_id: params.organizationId,
    project_id: params.projectId,
    area_id: params.areaId ?? null,
    object_id: params.objectId ?? null,
    phase_id: params.phaseId ?? null,
    context_type: params.contextType,
    caption: params.caption ?? null,
    local_uri: localUri,
    remote_url: null, // filled by worker after upload
    thumbnail_url: null,
    gps_lat: params.gpsLat ?? null,
    gps_lng: params.gpsLng ?? null,
    taken_by: params.takenBy,
    taken_at: new Date().toISOString(),
    sync_status: 'pending',
    created_at: new Date().toISOString(),
  });

  logger.info(`[PhotoQueue] Enqueued: ${filename} → ${params.contextType}`);

  return { localUri, photoId: result.success ? result.id : null };
}

/**
 * Get count of pending uploads.
 */
export async function getPendingCount(organizationId: string): Promise<number> {
  const { count } = await supabase
    .from('field_photos')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .in('sync_status', ['pending', 'uploading']);

  return count ?? 0;
}
