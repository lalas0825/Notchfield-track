# SPRINT — Work Ticket Evidence Photos (Track Mobile)
# MODEL: /model claude-sonnet-4-6
# Repo: notchfield-track
# DEPENDS ON: Takeoff sprint must run FIRST (creates DB column + storage bucket)
# DEPENDS ON: Track Sprint 45B (work tickets already implemented in Track)

---

## Context

Read CLAUDE.md before starting.

The Takeoff web sprint already ran and created:
- `evidence_photos JSONB` column on `work_tickets` table
- `work-ticket-photos` storage bucket with RLS policies
- `WorkTicketPhoto` type definition

Track needs to: capture photos from camera/gallery, upload to the same
storage bucket, and update the same `evidence_photos` JSONB column. Both
apps share the same Supabase database — photos uploaded from Track appear
instantly in Takeoff web, and vice versa.

**The flow in Track:**
1. Foreman creates ticket → status = `draft`
2. Foreman does the work
3. Foreman takes photos from the field → attaches to ticket
4. When ready → taps "Send for Signature" → photos LOCKED
5. GC opens link → sees photos + ticket → signs

**Key rule:** Photos can ONLY be added/removed while status is `draft`.
Once `pending_signature`, photos are locked.

**Offline handling:** If offline when taking a photo, save local URI with
a `pending_upload` flag. Upload when connectivity returns. Block "Send for
Signature" until all photos are uploaded.

---

## PART 1: PowerSync Schema Update

In `src/shared/lib/powersync/schema.ts`, check if the `work_tickets` table
definition already has `evidence_photos`. If NOT, add it:

```typescript
evidence_photos: column.text,  // JSON string of WorkTicketPhoto[]
```

If it's already there, skip this step.

---

## PART 2: Types

Create or update `src/features/work-tickets/types.ts` (or wherever work
ticket types live in Track):

```typescript
export interface WorkTicketPhoto {
  id: string;
  url: string;
  thumbnail_url?: string;
  caption?: string;
  taken_at: string;
  taken_by: string;
  taken_by_name: string;
  latitude?: number;
  longitude?: number;
  // Track-only field for offline support:
  local_uri?: string;        // set when photo is taken offline
  pending_upload?: boolean;   // true until uploaded to Storage
}
```

This matches the Takeoff web type but adds `local_uri` and `pending_upload`
for offline support.

---

## PART 3: Photo Service

Create `src/features/work-tickets/services/workTicketPhotoService.ts`:

Uses the EXISTING camera patterns from Track (expo-image-picker). Reference
the Camera Patterns section in CLAUDE.md.

### 3A. takeTicketPhoto(ticketId, organizationId, user)

```typescript
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/shared/lib/supabase';

export async function takeTicketPhoto(
  ticketId: string,
  organizationId: string,
  userId: string,
  userName: string,
): Promise<WorkTicketPhoto> {
  // Request camera permission
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

  const asset = result.assets[0];
  const photoId = crypto.randomUUID();

  // Try to upload immediately
  try {
    const uploaded = await uploadToStorage(
      photoId, ticketId, organizationId, asset, userId, userName
    );
    // Update the work_tickets row with new photo
    await appendPhotoToTicket(ticketId, uploaded);
    return uploaded;
  } catch (error) {
    // Offline — save locally with pending flag
    const pendingPhoto: WorkTicketPhoto = {
      id: photoId,
      url: '',  // will be set after upload
      local_uri: asset.uri,
      pending_upload: true,
      caption: '',
      taken_at: new Date().toISOString(),
      taken_by: userId,
      taken_by_name: userName,
      latitude: asset.exif?.GPSLatitude,
      longitude: asset.exif?.GPSLongitude,
    };
    await appendPhotoToTicket(ticketId, pendingPhoto);
    return pendingPhoto;
  }
}
```

### 3B. pickTicketPhotos(ticketId, organizationId, user)

Same pattern but uses `launchImageLibraryAsync` with:
```typescript
const result = await ImagePicker.launchImageLibraryAsync({
  quality: 0.8,
  allowsMultipleSelection: true,
  selectionLimit: 10,
  exif: true,
});
```

Loop through `result.assets` and upload each one. Return array of
WorkTicketPhoto objects.

### 3C. uploadToStorage (internal helper)

```typescript
async function uploadToStorage(
  photoId: string,
  ticketId: string,
  organizationId: string,
  asset: ImagePicker.ImagePickerAsset,
  userId: string,
  userName: string,
): Promise<WorkTicketPhoto> {
  const fileName = `${organizationId}/${ticketId}/${photoId}.jpg`;

  // Read file as blob
  const response = await fetch(asset.uri);
  const blob = await response.blob();

  // Upload to Supabase Storage
  const { error } = await supabase.storage
    .from('work-ticket-photos')
    .upload(fileName, blob, { contentType: 'image/jpeg' });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('work-ticket-photos')
    .getPublicUrl(fileName);

  return {
    id: photoId,
    url: publicUrl,
    caption: '',
    taken_at: new Date().toISOString(),
    taken_by: userId,
    taken_by_name: userName,
    latitude: asset.exif?.GPSLatitude,
    longitude: asset.exif?.GPSLongitude,
  };
}
```

### 3D. appendPhotoToTicket (internal helper)

```typescript
async function appendPhotoToTicket(
  ticketId: string,
  photo: WorkTicketPhoto,
): Promise<void> {
  // Read current photos
  const { data: ticket } = await supabase
    .from('work_tickets')
    .select('evidence_photos, status')
    .eq('id', ticketId)
    .single();

  if (ticket.status !== 'draft') {
    throw new Error('Cannot modify photos after ticket is sent for signature');
  }

  const photos = ticket.evidence_photos || [];
  photos.push(photo);

  await supabase
    .from('work_tickets')
    .update({ evidence_photos: photos })
    .eq('id', ticketId);
}
```

### 3E. removePhoto(ticketId, photoId)

```typescript
export async function removeTicketPhoto(
  ticketId: string,
  photoId: string,
  organizationId: string,
): Promise<void> {
  // Check status
  const { data: ticket } = await supabase
    .from('work_tickets')
    .select('evidence_photos, status')
    .eq('id', ticketId)
    .single();

  if (ticket.status !== 'draft') {
    throw new Error('Cannot modify photos after ticket is sent for signature');
  }

  const photos: WorkTicketPhoto[] = ticket.evidence_photos || [];
  const photo = photos.find(p => p.id === photoId);

  // Delete from storage if it was uploaded
  if (photo?.url) {
    const fileName = `${organizationId}/${ticketId}/${photoId}.jpg`;
    await supabase.storage.from('work-ticket-photos').remove([fileName]);
  }

  // Remove from array
  const updated = photos.filter(p => p.id !== photoId);
  await supabase
    .from('work_tickets')
    .update({ evidence_photos: updated })
    .eq('id', ticketId);
}
```

### 3F. updateCaption(ticketId, photoId, caption)

```typescript
export async function updatePhotoCaption(
  ticketId: string,
  photoId: string,
  caption: string,
): Promise<void> {
  const { data: ticket } = await supabase
    .from('work_tickets')
    .select('evidence_photos, status')
    .eq('id', ticketId)
    .single();

  if (ticket.status !== 'draft') {
    throw new Error('Cannot modify photos after ticket is sent for signature');
  }

  const photos: WorkTicketPhoto[] = ticket.evidence_photos || [];
  const updated = photos.map(p =>
    p.id === photoId ? { ...p, caption } : p
  );

  await supabase
    .from('work_tickets')
    .update({ evidence_photos: updated })
    .eq('id', ticketId);
}
```

### 3G. processPendingUploads(ticketId, organizationId)

Call this when connectivity is restored (e.g., on app foreground or
on a NetInfo change event):

```typescript
export async function processPendingUploads(
  ticketId: string,
  organizationId: string,
): Promise<number> {
  const { data: ticket } = await supabase
    .from('work_tickets')
    .select('evidence_photos')
    .eq('id', ticketId)
    .single();

  const photos: WorkTicketPhoto[] = ticket.evidence_photos || [];
  const pending = photos.filter(p => p.pending_upload && p.local_uri);
  let uploaded = 0;

  for (const photo of pending) {
    try {
      const response = await fetch(photo.local_uri!);
      const blob = await response.blob();
      const fileName = `${organizationId}/${ticketId}/${photo.id}.jpg`;

      const { error } = await supabase.storage
        .from('work-ticket-photos')
        .upload(fileName, blob, { contentType: 'image/jpeg' });

      if (error) continue;

      const { data: { publicUrl } } = supabase.storage
        .from('work-ticket-photos')
        .getPublicUrl(fileName);

      // Update this photo in the array
      photo.url = publicUrl;
      photo.pending_upload = false;
      photo.local_uri = undefined;
      uploaded++;
    } catch {
      // Still offline or file missing — skip, try next time
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
```

---

## PART 4: Photo Gallery UI

In the existing work ticket detail/form screen in Track, add a photo section.

### 4A. WorkTicketPhotos Component

Create `src/features/work-tickets/components/WorkTicketPhotos.tsx`:

```
┌──────────────────────────────────────────────────┐
│ Evidence Photos (3)                               │
│                                                   │
│ ┌───────┐ ┌───────┐ ┌───────┐                   │
│ │ photo │ │ photo │ │ ⏳    │                    │
│ │       │ │       │ │upload │                    │
│ └───────┘ └───────┘ └───────┘                    │
│ Marble     Grout     (uploading...)              │
│ patching   repair                                │
│                                                   │
│ [📷 Take Photo]  [🖼️ From Gallery]              │
│                                                   │
└──────────────────────────────────────────────────┘
```

Implementation notes:
- Use `ScrollView horizontal` for the photo thumbnails row
- Each thumbnail: `Image` component, ~100x100, rounded corners
- Show `ActivityIndicator` overlay on photos with `pending_upload === true`
- Show caption below each thumbnail in small gray text
- Tap photo → open a modal/bottom sheet with options:
  - "View Full Size" → full-screen Image viewer
  - "Edit Caption" → TextInput alert/modal
  - "Delete" → confirmation Alert then removeTicketPhoto()
- "Take Photo" button → calls takeTicketPhoto()
- "From Gallery" button → calls pickTicketPhotos()
- Both buttons: only render when `ticket.status === 'draft'`
- When status !== draft, show a subtle "Photos locked" text instead of buttons
- Empty state: "No photos yet. Take or select photos as evidence."

### 4B. Integration into Ticket Detail Screen

Find the existing ticket detail screen (created in Sprint 43B or Track 45B).
Add `<WorkTicketPhotos>` between the Materials section and the action buttons
(Send for Signature / status area).

Pass: ticket object, organizationId, current user, and a refetch/refresh callback.

---

## PART 5: Update "Send for Signature" Flow

In the existing send-for-signature logic in Track:

### 5A. Block if photos pending upload

Before allowing the send, check:
```typescript
const photos: WorkTicketPhoto[] = ticket.evidence_photos || [];
const hasPending = photos.some(p => p.pending_upload);

if (hasPending) {
  Alert.alert(
    'Photos Still Uploading',
    'Some photos haven\'t uploaded yet. Please wait for uploads to complete or check your internet connection.',
    [{ text: 'OK' }]
  );
  return;
}
```

### 5B. Warn if no photos

```typescript
if (photos.length === 0) {
  Alert.alert(
    'No Evidence Photos',
    'This ticket has no evidence photos attached. Send anyway?',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send Without Photos', onPress: () => proceedWithSend() },
    ]
  );
  return;
}
```

### 5C. Include photos in SHA-256 hash

In whatever hash generation function Track uses (likely a copy of Takeoff's
hashService), add the photo URLs to the hash input:

```typescript
// Sort photo URLs for deterministic hashing
const photoUrls = (ticket.evidence_photos || [])
  .filter((p: WorkTicketPhoto) => !p.pending_upload)  // only uploaded photos
  .map((p: WorkTicketPhoto) => p.url)
  .sort()
  .join('|');

// Append to content being hashed
contentToHash += `|photos:${photoUrls}`;
```

**The sort() is essential** — JSONB array order is not guaranteed, so we
sort for deterministic hashing. This must match exactly what Takeoff web does.

---

## PART 6: Process Pending Uploads on Connectivity Change

Add a connectivity listener that processes pending photo uploads. The best
place is wherever Track already handles "back online" events (likely in a
top-level provider or in the work tickets list screen).

```typescript
import NetInfo from '@react-native-community/netinfo';

// In the work ticket detail screen or a parent provider:
useEffect(() => {
  const unsubscribe = NetInfo.addEventListener(state => {
    if (state.isConnected && ticket?.id) {
      processPendingUploads(ticket.id, organizationId);
    }
  });
  return () => unsubscribe();
}, [ticket?.id]);
```

Also call `processPendingUploads` on screen focus (when foreman navigates
back to the ticket detail after being away).

---

## Verify

1. Ticket detail screen shows "Evidence Photos" section
2. "Take Photo" opens camera, captures with EXIF/GPS, uploads to Storage
3. "From Gallery" opens multi-select picker (limit 10), uploads selected
4. Uploaded photo appears as thumbnail with caption area
5. Tap photo → modal with View Full Size, Edit Caption, Delete options
6. Edit Caption updates caption text on the photo
7. Delete removes photo from Storage + JSONB array
8. Photo buttons hidden when ticket status !== draft
9. Upload progress: ActivityIndicator overlay on pending photos
10. Offline: photo saved with local_uri + pending_upload = true
11. When back online: pending photos auto-upload (processPendingUploads)
12. "Send for Signature" blocked if any photos still pending upload
13. "Send for Signature" warns if no photos (confirmation dialog)
14. SHA-256 hash includes sorted photo URLs (matches Takeoff web format)
15. Photos uploaded from Takeoff web appear in Track detail view
16. Photos uploaded from Track appear in Takeoff web detail view
17. Type check passes (npx expo lint or tsc equivalent)
