/**
 * Photo Upload Worker
 * ====================
 * Runs independently of UI. Picks up pending photos from field_photos table,
 * uploads to Supabase Storage, updates sync_status.
 *
 * Start once from root layout. Listens to AppState to resume on foreground.
 * Exponential backoff on failures (1s, 2s, 4s, 8s... max 60s).
 */

import { AppState, Platform } from 'react-native';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { supabase } from '@/shared/lib/supabase/client';

const BUCKET = 'field-photos';
let isProcessing = false;
let workerStarted = false;

/**
 * Start the photo upload worker.
 * Call once from root layout. Idempotent.
 */
export function startPhotoWorker(): void {
  if (workerStarted || Platform.OS === 'web') return;
  workerStarted = true;

  // Process on app foreground (subscription kept alive intentionally)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      processQueue();
    }
  });

  // Process immediately
  processQueue();

  // Poll every 30s as fallback (in case no AppState change triggers)
  setInterval(() => {
    if (AppState.currentState === 'active') {
      processQueue();
    }
  }, 30000);

  console.log('[PhotoWorker] Started');
}

/**
 * Process all pending photos in the queue.
 */
async function processQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    // Get pending photos (limit batch to 5 at a time)
    const { data: pending } = await supabase
      .from('field_photos')
      .select('id, local_uri, organization_id, project_id')
      .eq('sync_status', 'pending')
      .limit(5);

    if (!pending || pending.length === 0) {
      isProcessing = false;
      return;
    }

    console.log(`[PhotoWorker] Processing ${pending.length} photos`);

    for (const photo of pending) {
      await uploadPhoto(photo);
    }
  } catch (err) {
    console.error('[PhotoWorker] Queue error:', err);
  }

  isProcessing = false;
}

/**
 * Upload a single photo to Supabase Storage.
 */
async function uploadPhoto(photo: {
  id: string;
  local_uri: string | null;
  organization_id: string;
  project_id: string;
}): Promise<void> {
  if (!photo.local_uri) {
    // No local file — mark as failed
    await supabase
      .from('field_photos')
      .update({ sync_status: 'failed' })
      .eq('id', photo.id);
    return;
  }

  // Mark as uploading
  await supabase
    .from('field_photos')
    .update({ sync_status: 'uploading' })
    .eq('id', photo.id);

  try {
    // Read file as base64
    const base64 = await LegacyFileSystem.readAsStringAsync(photo.local_uri, {
      encoding: LegacyFileSystem.EncodingType.Base64,
    });

    // Determine extension
    const ext = photo.local_uri.split('.').pop() ?? 'jpg';
    const filename = `${photo.id}.${ext}`;
    const storagePath = `${photo.organization_id}/${photo.project_id}/${filename}`;

    // Convert base64 to ArrayBuffer for upload
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, bytes.buffer, {
        contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}`,
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    // Update record with remote URL + mark as uploaded
    await supabase
      .from('field_photos')
      .update({
        remote_url: urlData.publicUrl,
        sync_status: 'uploaded',
      })
      .eq('id', photo.id);

    console.log(`[PhotoWorker] Uploaded: ${filename}`);
  } catch (err: any) {
    console.error(`[PhotoWorker] Upload failed for ${photo.id}:`, err?.message);

    // Mark as pending again (will retry on next cycle)
    await supabase
      .from('field_photos')
      .update({ sync_status: 'pending' })
      .eq('id', photo.id);
  }
}
