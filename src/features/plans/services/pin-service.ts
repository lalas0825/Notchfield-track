/**
 * Drawing Pin Service — Sprint 47B
 * ===================================
 * Pin CRUD on `drawing_pins` (Sprint 47A table). PowerSync local-first for
 * offline support; photos upload direct to Supabase Storage (online only).
 *
 * Column names mirror real DB (verified via information_schema):
 *   pin_type ('note' | 'photo' | 'rfi'), position_x, position_y, title,
 *   description, color, photos (jsonb), created_by, resolved (bool).
 */

import { supabase } from '@/shared/lib/supabase/client';
import {
  localQuery,
  localInsert,
  localUpdate,
  generateUUID,
} from '@/shared/lib/powersync/write';

export type PinType = 'note' | 'photo' | 'rfi';

export interface DrawingPin {
  id: string;
  organization_id: string;
  drawing_id: string;
  project_id: string;
  pin_type: PinType;
  position_x: number;
  position_y: number;
  title: string | null;
  description: string | null;
  color: string | null;
  linked_rfi_id: string | null;
  photos: string | null;                 // JSON array of storage paths
  created_by: string | null;
  resolved: number | boolean | null;     // SQLite int or bool
  resolved_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export function parsePinPhotos(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = typeof json === 'string' ? JSON.parse(json) : json;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isPinResolved(pin: Pick<DrawingPin, 'resolved'>): boolean {
  return pin.resolved === 1 || pin.resolved === true;
}

/** Default color per pin type. */
export function defaultPinColor(type: PinType): string {
  switch (type) {
    case 'note': return '#F59E0B';   // amber
    case 'photo': return '#0EA5E9';  // sky
    case 'rfi': return '#EF4444';    // red
  }
}

// ─── Read ─────────────────────────────────────────────────────

export async function fetchPinsForDrawing(drawingId: string): Promise<DrawingPin[]> {
  const local = await localQuery<DrawingPin>(
    `SELECT * FROM drawing_pins WHERE drawing_id = ? ORDER BY created_at DESC`,
    [drawingId],
  );
  if (local !== null) return local;

  const { data, error } = await supabase
    .from('drawing_pins')
    .select('*')
    .eq('drawing_id', drawingId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as DrawingPin[];
}

// ─── Create ───────────────────────────────────────────────────

export interface CreatePinInput {
  organization_id: string;
  project_id: string;
  drawing_id: string;
  pin_type: PinType;
  position_x: number;
  position_y: number;
  title: string;
  description: string;
  created_by: string;
  photos?: string[];                     // optional pre-uploaded storage paths
}

export async function createPin(
  input: CreatePinInput,
): Promise<{ success: boolean; id: string; error?: string }> {
  const now = new Date().toISOString();
  const id = generateUUID();
  return localInsert('drawing_pins', {
    id,
    organization_id: input.organization_id,
    project_id: input.project_id,
    drawing_id: input.drawing_id,
    pin_type: input.pin_type,
    position_x: input.position_x,
    position_y: input.position_y,
    title: input.title,
    description: input.description,
    color: defaultPinColor(input.pin_type),
    linked_rfi_id: null,
    photos: JSON.stringify(input.photos ?? []),
    created_by: input.created_by,
    resolved: 0,
    created_at: now,
    updated_at: now,
  });
}

// ─── Update ───────────────────────────────────────────────────

export async function resolvePin(
  pinId: string,
): Promise<{ success: boolean; error?: string }> {
  const now = new Date().toISOString();
  return localUpdate('drawing_pins', pinId, {
    resolved: 1,
    resolved_at: now,
    updated_at: now,
  });
}

export async function reopenPin(
  pinId: string,
): Promise<{ success: boolean; error?: string }> {
  return localUpdate('drawing_pins', pinId, {
    resolved: 0,
    resolved_at: null,
    updated_at: new Date().toISOString(),
  });
}

// ─── Photo upload ─────────────────────────────────────────────

/**
 * Upload a pin photo to the `drawing-pin-photos` bucket at
 * `{organization_id}/{pin_id}/{idx}_{timestamp}.jpg`.
 * Returns the storage path (private bucket — use createSignedUrl to display).
 */
export async function uploadPinPhoto(params: {
  localUri: string;
  organizationId: string;
  pinId: string;
  index: number;
}): Promise<{ success: boolean; path?: string; error?: string }> {
  const { localUri, organizationId, pinId, index } = params;
  try {
    const ext = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const filename = `${organizationId}/${pinId}/${index}_${Date.now()}.${ext}`;

    const response = await fetch(localUri);
    const blob = await response.blob();

    const { error } = await supabase.storage
      .from('drawing-pin-photos')
      .upload(filename, blob, {
        contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        upsert: false,
      });

    if (error) return { success: false, error: error.message };
    return { success: true, path: filename };
  } catch (err) {
    return { success: false, error: (err as Error).message ?? 'Upload failed' };
  }
}

export async function getPinPhotoSignedUrl(path: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('drawing-pin-photos')
      .createSignedUrl(path, 3600);
    if (error || !data) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}
