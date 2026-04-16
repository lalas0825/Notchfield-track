/**
 * Work Ticket Evidence Photos — Track Mobile
 * ===========================================
 * Mirrors Takeoff Web's photo service. Uploads to the SHARED
 * `work-ticket-photos` Supabase Storage bucket and writes to the SAME
 * `work_tickets.evidence_photos` JSONB column. Photos taken in Track
 * appear instantly in Takeoff Web and vice-versa.
 *
 * Direct Supabase (not PowerSync) — same rule as signatures:
 * upload + JSONB array mutation must be read-after-write consistent,
 * PowerSync's sync lag breaks that.
 *
 * Photos are only editable while ticket.status === 'draft'.
 */

import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { supabase } from '@/shared/lib/supabase/client';
import type { WorkTicketPhoto } from '../types';

const BUCKET = 'work-ticket-photos';

// ─── Public API ────────────────────────────────────────────────

export async function takeTicketPhoto(
  ticketId: string,
  organizationId: string,
  userId: string,
  userName: string,
): Promise<WorkTicketPhoto | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Camera permission required');
  }

  const result = await ImagePicker.launchCameraAsync({
    quality: 0.8,
    allowsEditing: false,
    exif: true,
    base64: false,
  });
  if (result.canceled) return null;

  return captureAsset(result.assets[0], ticketId, organizationId, userId, userName);
}

export async function pickTicketPhotos(
  ticketId: string,
  organizationId: string,
  userId: string,
  userName: string,
): Promise<WorkTicketPhoto[]> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Photo library permission required');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsMultipleSelection: true,
    selectionLimit: 10,
    exif: true,
    legacy: true,
  } as any);
  if (result.canceled) return [];

  const out: WorkTicketPhoto[] = [];
  for (const asset of result.assets) {
    const photo = await captureAsset(asset, ticketId, organizationId, userId, userName);
    if (photo) out.push(photo);
  }
  return out;
}

export async function removeTicketPhoto(
  ticketId: string,
  photoId: string,
  organizationId: string,
): Promise<void> {
  const { data: ticket, error } = await supabase
    .from('work_tickets')
    .select('evidence_photos, status')
    .eq('id', ticketId)
    .single();
  if (error) throw error;
  if (ticket.status !== 'draft') {
    throw new Error('Cannot modify photos after ticket is sent for signature');
  }

  const photos: WorkTicketPhoto[] = parsePhotos(ticket.evidence_photos);
  const photo = photos.find((p) => p.id === photoId);

  if (photo?.url) {
    const fileName = `${organizationId}/${ticketId}/${photoId}.jpg`;
    await supabase.storage.from(BUCKET).remove([fileName]);
  }

  const updated = photos.filter((p) => p.id !== photoId);
  const { error: updErr } = await supabase
    .from('work_tickets')
    .update({ evidence_photos: updated })
    .eq('id', ticketId);
  if (updErr) throw updErr;
}

export async function updatePhotoCaption(
  ticketId: string,
  photoId: string,
  caption: string,
): Promise<void> {
  const { data: ticket, error } = await supabase
    .from('work_tickets')
    .select('evidence_photos, status')
    .eq('id', ticketId)
    .single();
  if (error) throw error;
  if (ticket.status !== 'draft') {
    throw new Error('Cannot modify photos after ticket is sent for signature');
  }

  const photos = parsePhotos(ticket.evidence_photos).map((p) =>
    p.id === photoId ? { ...p, caption } : p,
  );
  const { error: updErr } = await supabase
    .from('work_tickets')
    .update({ evidence_photos: photos })
    .eq('id', ticketId);
  if (updErr) throw updErr;
}

/**
 * Upload any photos stuck with `pending_upload = true`. Call on
 * connectivity restore or on screen focus. Returns number uploaded.
 */
export async function processPendingUploads(
  ticketId: string,
  organizationId: string,
  verbose = false,
): Promise<number> {
  const { data: ticket, error } = await supabase
    .from('work_tickets')
    .select('evidence_photos, status')
    .eq('id', ticketId)
    .single();
  if (error) {
    if (verbose) console.error('[PhotoUpload] fetch ticket error:', error.message);
    return 0;
  }
  if (ticket.status !== 'draft') return 0;

  const photos = parsePhotos(ticket.evidence_photos);
  const pending = photos.filter((p) => p.pending_upload && p.local_uri);
  if (verbose) console.log('[PhotoUpload] pending:', pending.length, 'photos');
  if (pending.length === 0) return 0;

  let uploaded = 0;
  for (const photo of pending) {
    try {
      if (verbose) console.log('[PhotoUpload] uploading', photo.id, 'uri:', photo.local_uri?.substring(0, 80));
      const fileName = `${organizationId}/${ticketId}/${photo.id}.jpg`;
      const body = await uriToBody(photo.local_uri!);
      if (verbose) console.log('[PhotoUpload] blob size:', (body as any).size ?? 'unknown');
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, body, { contentType: 'image/jpeg', upsert: true });
      if (upErr) {
        if (verbose) console.error('[PhotoUpload] storage error:', upErr.message);
        continue;
      }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
      photo.url = urlData.publicUrl;
      photo.pending_upload = false;
      delete photo.local_uri;
      uploaded++;
      if (verbose) console.log('[PhotoUpload] success:', photo.id);
    } catch (err) {
      if (verbose) console.error('[PhotoUpload] exception:', (err as Error).message);
      continue;
    }
  }

  if (uploaded > 0) {
    await supabase
      .from('work_tickets')
      .update({ evidence_photos: photos })
      .eq('id', ticketId);
  }
  return uploaded;
}

/**
 * Upload a photo from a local URI (used during ticket creation when the
 * ticket ID wasn't available at capture time).
 */
export async function uploadPhotoFromUri(
  ticketId: string,
  organizationId: string,
  userId: string,
  userName: string,
  uri: string,
): Promise<WorkTicketPhoto> {
  const photoId = Crypto.randomUUID();
  const takenAt = new Date().toISOString();
  try {
    const fileName = `${organizationId}/${ticketId}/${photoId}.jpg`;
    const body = await uriToBody(uri);
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, body, { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    const photo: WorkTicketPhoto = {
      id: photoId,
      url: urlData.publicUrl,
      caption: '',
      taken_at: takenAt,
      taken_by: userId,
      taken_by_name: userName,
    };
    await appendPhotoToTicket(ticketId, photo);
    return photo;
  } catch {
    const photo: WorkTicketPhoto = {
      id: photoId,
      url: '',
      local_uri: uri,
      pending_upload: true,
      caption: '',
      taken_at: takenAt,
      taken_by: userId,
      taken_by_name: userName,
    };
    await appendPhotoToTicket(ticketId, photo);
    return photo;
  }
}

export function parsePhotos(raw: unknown): WorkTicketPhoto[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as WorkTicketPhoto[];
  if (typeof raw === 'string') {
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? (arr as WorkTicketPhoto[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

// ─── Internal helpers ──────────────────────────────────────────

async function captureAsset(
  asset: ImagePicker.ImagePickerAsset,
  ticketId: string,
  organizationId: string,
  userId: string,
  userName: string,
): Promise<WorkTicketPhoto> {
  const photoId = Crypto.randomUUID();
  const takenAt = new Date().toISOString();
  const exif = (asset.exif ?? {}) as Record<string, unknown>;
  const latitude = typeof exif.GPSLatitude === 'number' ? (exif.GPSLatitude as number) : undefined;
  const longitude = typeof exif.GPSLongitude === 'number' ? (exif.GPSLongitude as number) : undefined;

  try {
    const fileName = `${organizationId}/${ticketId}/${photoId}.jpg`;
    const body = await uriToBody(asset.uri);
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, body, { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    const photo: WorkTicketPhoto = {
      id: photoId,
      url: urlData.publicUrl,
      caption: '',
      taken_at: takenAt,
      taken_by: userId,
      taken_by_name: userName,
      latitude,
      longitude,
    };
    await appendPhotoToTicket(ticketId, photo);
    return photo;
  } catch {
    // Offline or upload failed — save locally and retry later
    const photo: WorkTicketPhoto = {
      id: photoId,
      url: '',
      local_uri: asset.uri,
      pending_upload: true,
      caption: '',
      taken_at: takenAt,
      taken_by: userId,
      taken_by_name: userName,
      latitude,
      longitude,
    };
    await appendPhotoToTicket(ticketId, photo);
    return photo;
  }
}

async function appendPhotoToTicket(ticketId: string, photo: WorkTicketPhoto): Promise<void> {
  const { data: ticket, error } = await supabase
    .from('work_tickets')
    .select('evidence_photos, status')
    .eq('id', ticketId)
    .single();
  if (error) throw error;
  if (ticket.status !== 'draft') {
    throw new Error('Cannot add photos after ticket is sent for signature');
  }
  const photos = parsePhotos(ticket.evidence_photos);
  photos.push(photo);
  const { error: updErr } = await supabase
    .from('work_tickets')
    .update({ evidence_photos: photos })
    .eq('id', ticketId);
  if (updErr) throw updErr;
}

async function uriToBody(uri: string): Promise<ArrayBuffer> {
  const base64 = await LegacyFileSystem.readAsStringAsync(uri, {
    encoding: LegacyFileSystem.EncodingType.Base64,
  });
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
