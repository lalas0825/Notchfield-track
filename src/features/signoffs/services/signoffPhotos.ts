/**
 * Sprint 72 — Sign-Off photo upload helper.
 *
 * Mirrors deficiencyPhotos.ts exactly — same field-photos bucket, same
 * org-first path convention (Sprint 53A.1 RLS lesson). The only difference
 * is the second folder: `signoffs/{YYYY-MM-DD}/...` instead of
 * `deficiencies/{id}/...`. Web spec §5 specifies date-based folder so PMs
 * can browse the Storage UI by day.
 *
 * Path shape: `{organizationId}/signoffs/{YYYY-MM-DD}/{uuid}.{ext}`
 *
 * Pre-create phase: signoff doesn't exist yet, so we don't have an id to
 * scope the folder. Web's spec uses date-bucketed folders instead — the
 * URL goes into the create endpoint's `evidence[]` payload and gets stored
 * verbatim in `signoff_documents.evidence_photos[]`.
 */

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
 * success, or the original localUri on offline failure (the create
 * endpoint will reject local file:// URIs, but the local URI is enough
 * for the in-memory preview while offline).
 */
export async function uploadSignoffPhoto(
  params: UploadSignoffPhotoParams,
): Promise<string> {
  const { localUri, organizationId } = params;
  try {
    const ext = (localUri.split('.').pop() ?? 'jpg').toLowerCase();
    const filename = `${organizationId}/signoffs/${todayBucket()}/${generateUUID()}.${ext}`;

    const response = await fetch(localUri);
    const blob = await response.blob();

    const { data, error } = await supabase.storage
      .from('field-photos')
      .upload(filename, blob, {
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
