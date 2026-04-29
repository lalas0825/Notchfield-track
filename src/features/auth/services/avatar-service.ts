/**
 * Sprint 73B Avatars — upload + remove user profile avatar.
 *
 * Path convention (RLS-enforced): `{auth.users.id}/avatar.{ext}`
 * Bucket: `profile-avatars` (public read, authenticated write where
 * the first folder == auth.uid()::text).
 *
 * Track refreshes `auth-store.profile.avatar_url` directly via
 * supabase.from('profiles').update(...) — Web's spec uses a cookie-
 * based supabase client; Track uses the bearer-authed one (same
 * client session as everywhere else in the app).
 *
 * 2026-04-29 — Switched off `fetch(localUri).blob()` to base64 +
 * ArrayBuffer per the same fix that landed in signoffPhotos /
 * deficiencyPhotos / gc-punch-service (commit bdfb98a). The fetch
 * path silently produces empty blobs on Android RN with cache:// URIs,
 * which would have stored 0-byte avatars. Reuse the proven pattern.
 */

import * as ImagePicker from 'expo-image-picker';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { supabase } from '@/shared/lib/supabase/client';
import { logger } from '@/shared/lib/logger';

const BUCKET = 'profile-avatars';
const MAX_BYTES = 5 * 1024 * 1024;

export type AvatarUploadResult =
  | { success: true; url: string }
  | { success: false; error: AvatarUploadError };

export type AvatarUploadError =
  | 'permission_denied'
  | 'cancelled'
  | 'file_too_large'
  | 'storage_failed'
  | 'profile_update_failed'
  | 'read_failed';

/**
 * Pick from gallery → square crop → upload → update profiles row.
 * Returns the public URL with cache-bust querystring on success.
 */
export async function pickAndUploadAvatar(
  userId: string,
): Promise<AvatarUploadResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { success: false, error: 'permission_denied' };

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
    base64: false,
  });
  if (result.canceled) return { success: false, error: 'cancelled' };

  const asset = result.assets[0];
  if (!asset) return { success: false, error: 'cancelled' };

  if (asset.fileSize && asset.fileSize > MAX_BYTES) {
    return { success: false, error: 'file_too_large' };
  }

  const mime = asset.mimeType ?? 'image/jpeg';
  const ext =
    mime === 'image/png'
      ? 'png'
      : mime === 'image/webp'
        ? 'webp'
        : 'jpg';
  const path = `${userId}/avatar.${ext}`;

  // Read → base64 → ArrayBuffer. The fetch(localUri).blob() approach
  // does NOT work for Android cache:// URIs (silent empty blob). Same
  // pattern as photo-worker / signoffPhotos / deficiencyPhotos.
  let uploadBuffer: ArrayBuffer;
  try {
    const base64 = await LegacyFileSystem.readAsStringAsync(asset.uri, {
      encoding: LegacyFileSystem.EncodingType.Base64,
    });
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    uploadBuffer = bytes.buffer as ArrayBuffer;
  } catch (e) {
    logger.warn('[avatar-service] read failed', e);
    return { success: false, error: 'read_failed' };
  }

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, uploadBuffer, {
      contentType: mime,
      upsert: true,
      cacheControl: '3600',
    });

  if (uploadErr) {
    logger.warn('[avatar-service] storage upload failed', uploadErr);
    return { success: false, error: 'storage_failed' };
  }

  // Clean up any orphan files from other extensions (user uploaded
  // .jpg before, now uploads .png — old .jpg should not linger).
  const orphans = (['jpg', 'png', 'webp'] as const)
    .filter((e) => e !== ext)
    .map((e) => `${userId}/avatar.${e}`);
  // Best-effort — older orphans may not exist; ignore failures.
  await supabase.storage
    .from(BUCKET)
    .remove(orphans)
    .catch(() => undefined);

  // Build the public URL with cache-bust querystring (matches Web).
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', userId);

  if (updateErr) {
    logger.warn('[avatar-service] profile update failed', updateErr);
    return { success: false, error: 'profile_update_failed' };
  }

  return { success: true, url: publicUrl };
}

/**
 * Remove avatar — deletes all extension variants from storage AND
 * clears profiles.avatar_url. Returns to initials fallback.
 */
export async function removeAvatar(
  userId: string,
): Promise<{ success: true } | { success: false; error: AvatarUploadError }> {
  const paths = (['jpg', 'png', 'webp'] as const).map(
    (e) => `${userId}/avatar.${e}`,
  );
  await supabase.storage
    .from(BUCKET)
    .remove(paths)
    .catch(() => undefined);

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', userId);
  if (error) {
    logger.warn('[avatar-service] profile update (remove) failed', error);
    return { success: false, error: 'profile_update_failed' };
  }
  return { success: true };
}

/** User-friendly message for each error code. */
export function avatarErrorMessage(code: AvatarUploadError): string {
  switch (code) {
    case 'permission_denied':
      return 'Photo library permission required.';
    case 'file_too_large':
      return 'File too large (max 5 MB).';
    case 'storage_failed':
      return 'Upload failed — try again.';
    case 'profile_update_failed':
      return 'Could not save photo. Try again.';
    case 'read_failed':
      return 'Could not read the photo. Try a different one.';
    case 'cancelled':
      return '';
  }
}
