/**
 * Sprint 72 — Sign-Off photo upload helper.
 *
 * Path shape: `{organizationId}/signoffs/{YYYY-MM-DD}/{uuid}.{ext}`
 *
 * 2026-04-29 — Switched off `fetch(localUri).blob()` to base64 + ArrayBuffer
 * pattern from photo-worker.ts. The `fetch(file://...)` approach is
 * broken on Android RN: blob conversion silently produces empty/zero
 * data, the upload "succeeds" with 0 bytes, OR fetch errors and the
 * fallback returns the local URI. Pilot reported sign-off PDFs +
 * public sign pages showing broken images — DB inspection showed
 * `evidence_photos[].url` literally as `file:///data/user/0/...`.
 *
 * The same bug affects deficiencyPhotos + gc-punch-service — fixed in
 * the same commit. The reliable pattern is documented in
 * photo-worker.ts:140-170 and has been working in field-photos
 * background sync for months.
 */

import * as LegacyFileSystem from 'expo-file-system/legacy';
import { supabase } from '@/shared/lib/supabase/client';
import { generateUUID } from '@/shared/lib/powersync/write';
import { logger } from '@/shared/lib/logger';

export type UploadSignoffPhotoParams = {
  localUri: string;
  organizationId: string;
};

/** YYYY-MM-DD in local time. */
function todayBucket(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Upload one photo to field-photos/signoffs/. Returns the public URL on
 * success, or the original localUri on offline/error fallback (the
 * create endpoint will reject local file:// URIs server-side, surfacing
 * the failure to the caller — preferable to silently inserting unusable
 * URLs into evidence_photos).
 */
export async function uploadSignoffPhoto(
  params: UploadSignoffPhotoParams,
): Promise<string> {
  const { localUri, organizationId } = params;
  try {
    const ext = (localUri.split('.').pop() ?? 'jpg').toLowerCase();
    const filename = `${organizationId}/signoffs/${todayBucket()}/${generateUUID()}.${ext}`;

    // Read file as base64 → ArrayBuffer. The fetch(localUri).blob() path
    // is broken on Android RN for cache:// URIs (silent empty blob).
    const base64 = await LegacyFileSystem.readAsStringAsync(localUri, {
      encoding: LegacyFileSystem.EncodingType.Base64,
    });
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const { data, error } = await supabase.storage
      .from('field-photos')
      .upload(filename, bytes.buffer, {
        contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
        upsert: false,
      });

    if (error || !data) {
      logger.warn('[signoff-photos] upload failed, using localUri', error);
      return localUri;
    }

    const { data: urlData } = supabase.storage
      .from('field-photos')
      .getPublicUrl(filename);
    return urlData.publicUrl;
  } catch (e) {
    logger.warn('[signoff-photos] upload exception, using localUri', e);
    return localUri;
  }
}

/**
 * Batch upload — uploads N photos in parallel and returns the URL list in
 * the same order. Use this when the user staged multiple photos across
 * required-evidence slots before submitting.
 */
export async function uploadSignoffPhotos(
  localUris: string[],
  organizationId: string,
): Promise<string[]> {
  return Promise.all(
    localUris.map((uri) =>
      uploadSignoffPhoto({ localUri: uri, organizationId }),
    ),
  );
}
