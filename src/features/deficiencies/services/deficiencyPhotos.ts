/**
 * Sprint 71 — Deficiency photo upload helper.
 *
 * Mirrors gc-punch-service.uploadResolutionPhoto exactly (same proven
 * pattern that survives the field-photos RLS check). Critical lesson
 * from Sprint 53A.1: `{org_id}` MUST be the first folder in the path,
 * otherwise the bucket policy returns 403 silently.
 *
 * Path shape: `{organizationId}/deficiencies/{deficiencyOrTempId}/{ts}.{ext}`
 *
 * Two phases:
 *   - Initial create: we don't yet have a deficiency UUID. Use a temp
 *     id (any UUID generated client-side) so the upload can proceed
 *     before the row exists. The URL returned is the public storage
 *     URL the create endpoint will store in `photos[]`.
 *   - Resolve: we DO have the deficiency id; pass it directly so the
 *     after-photos sit alongside the original report photos in the
 *     bucket folder.
 */

import * as LegacyFileSystem from 'expo-file-system/legacy';
import { supabase } from '@/shared/lib/supabase/client';
import { generateUUID } from '@/shared/lib/powersync/write';
import { logger } from '@/shared/lib/logger';

export type UploadPhotoParams = {
  localUri: string;
  organizationId: string;
  /** UUID of the deficiency, OR a client-generated temp id for the
   * pre-create upload phase. Becomes the second folder in the path. */
  deficiencyId: string;
};

/**
 * Upload one photo to field-photos bucket. Returns the public URL on
 * success, or the original localUri on offline failure (the create
 * endpoint will reject local file:// URIs, but the local URI is enough
 * for the in-memory preview while offline).
 */
export async function uploadDeficiencyPhoto(
  params: UploadPhotoParams,
): Promise<string> {
  const { localUri, organizationId, deficiencyId } = params;
  try {
    const ext = (localUri.split('.').pop() ?? 'jpg').toLowerCase();
    const filename = `${organizationId}/deficiencies/${deficiencyId}/${Date.now()}.${ext}`;

    // 2026-04-29 — Switched off `fetch(localUri).blob()` to base64 +
    // ArrayBuffer per photo-worker.ts:140 pattern. The fetch path
    // silently produces empty blobs on Android RN with cache:// URIs;
    // pilot's deficiency rows had `file:///` literals stored as URLs
    // because the upload "succeeded" with 0 bytes and the fallback
    // returned localUri. Same fix in signoffPhotos + gc-punch-service.
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
      logger.warn('[deficiency-photos] upload failed, using localUri', error);
      return localUri;
    }

    const { data: urlData } = supabase.storage
      .from('field-photos')
      .getPublicUrl(filename);
    return urlData.publicUrl;
  } catch (e) {
    logger.warn('[deficiency-photos] upload exception, using localUri', e);
    return localUri;
  }
}

/**
 * Batch upload — uploads N photos in parallel and returns the URL list
 * in the same order. Use this when the user staged multiple photos in
 * the modal before submitting.
 */
export async function uploadDeficiencyPhotos(
  localUris: string[],
  organizationId: string,
  deficiencyId: string,
): Promise<string[]> {
  return Promise.all(
    localUris.map((uri) =>
      uploadDeficiencyPhoto({ localUri: uri, organizationId, deficiencyId }),
    ),
  );
}

/**
 * Generate a stable temp id for a not-yet-created deficiency so the
 * pre-create photo uploads have a valid folder path. After the deficiency
 * is created server-side, photos are linked by URL — the temp id only
 * lives in storage paths; it never appears as a row id anywhere.
 */
export function tempDeficiencyId(): string {
  return `pending-${generateUUID()}`;
}
