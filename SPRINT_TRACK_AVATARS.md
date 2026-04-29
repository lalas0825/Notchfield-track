# SPRINT 73B — Track Handoff: User Profile Avatars

> **Web team shipped user avatars (commit `6858106`). This doc is the Track-side
> spec to display + upload avatars in the mobile app. Backend is shared — Track
> consumes the same `profiles.avatar_url` column and writes to the same
> `profile-avatars` Storage bucket.**

## TL;DR

Three pieces of work for Track team:

| # | Task | Effort |
|---|---|---|
| **1** | **Display avatar** in Track top-bar (replace initials) | ~30 min |
| **2** | **Avatar component** — reusable RN component matching Web's 5 sizes | ~1 hr |
| **3** | **Profile screen** — upload via expo-image-picker → Supabase Storage → update profiles.avatar_url | ~2-3 hrs |

Everything is additive — won't break existing Track code. Foreman/worker accounts that don't upload anything continue to see initials (current behavior).

---

## Schema (already exists — no Track migration needed)

```sql
-- profiles.avatar_url TEXT NULL  -- has been there since Sprint 10
-- Sprint 73B added the bucket:

storage.buckets WHERE id = 'profile-avatars'
  public: true
  file_size_limit: 5 MB
  allowed_mime_types: image/jpeg, image/png, image/webp
```

**Path convention (CRITICAL):** `{auth.users.id}/avatar.{ext}`

The first path segment MUST equal the uploader's `auth.uid()`. RLS policies enforce this — any other path will be rejected with a permission error.

**RLS policies on `storage.objects` for this bucket:**
- `SELECT` → public (anyone reads)
- `INSERT/UPDATE/DELETE` → authenticated AND `(storage.foldername(name))[1] = auth.uid()::text`

So a foreman cannot overwrite their PM's avatar even if they know the PM's UUID — RLS blocks it.

---

## Task 1: Display avatar in top-bar

Track currently shows initials in the corner avatar circle. Replace with the user's `profiles.avatar_url` if set, fallback to initials.

```tsx
// Wherever Track renders the user header avatar today
import { useCurrentUser } from '@/hooks/useCurrentUser'  // or wherever auth state lives

const { profile } = useCurrentUser()  // already loaded via PowerSync

return (
  <Avatar
    name={profile.full_name ?? '?'}
    imageUrl={profile.avatar_url}
    size="md"
  />
)
```

`profile.avatar_url` already syncs via PowerSync — no schema change. The URL Web writes contains a `?t=<timestamp>` cache-buster, so a fresh upload on Web will appear in Track within sync interval (no manual cache invalidation needed on Track side).

---

## Task 2: Avatar component (RN equivalent of Web)

Web component lives at `src/shared/components/Avatar.tsx` (Web repo). Mirror the API for parity.

```tsx
// Track repo: src/components/Avatar.tsx
import { Image, Text, View } from 'react-native'
import { useState } from 'react'

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const SIZE_PX: Record<AvatarSize, number> = {
  xs: 20,
  sm: 28,
  md: 32,
  lg: 48,
  xl: 96,
}

const FONT_SIZE: Record<AvatarSize, number> = {
  xs: 10,
  sm: 12,
  md: 12,
  lg: 16,
  xl: 24,
}

export function Avatar({
  name,
  imageUrl,
  size = 'md',
}: {
  name: string
  imageUrl?: string | null
  size?: AvatarSize
}) {
  const [errored, setErrored] = useState(false)
  const px = SIZE_PX[size]
  const fontSize = FONT_SIZE[size]
  const initial = (name || '?').charAt(0).toUpperCase() || '?'

  if (imageUrl && !errored) {
    return (
      <View
        style={{
          width: px,
          height: px,
          borderRadius: px / 2,
          backgroundColor: '#f3f4f6',
          overflow: 'hidden',
        }}
      >
        <Image
          source={{ uri: imageUrl }}
          style={{ width: px, height: px }}
          onError={() => setErrored(true)}
        />
      </View>
    )
  }

  return (
    <View
      style={{
        width: px,
        height: px,
        borderRadius: px / 2,
        backgroundColor: '#1c1917', // brand-charcoal
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontSize, fontWeight: '700' }}>
        {initial}
      </Text>
    </View>
  )
}
```

Use this everywhere Track shows a user identity:
- Top-bar (Task 1)
- Profile screen
- Comments / activity feed
- Notification bell items
- Crew assignment cards
- Field photo "taken by" credit
- Work ticket signers
- PTP signature footer
- Time entry "assigned by" badge

**Note:** `workers.photo_url` (field crew HR photos from Sprint 49) is a SEPARATE thing — those go through the `worker-photos` bucket and represent ID-card style photos. Don't confuse them with `profiles.avatar_url`. A foreman who logs in has BOTH (linked via `workers.profile_id`).

---

## Task 3: Profile screen — upload UI

Settings → Profile or wherever Track has user profile management.

### Required dependencies

```bash
expo install expo-image-picker
```

(Likely already installed — Track Sprint 49 used it for worker photo uploads.)

### Upload flow

```tsx
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase'  // your existing client

async function pickAndUploadAvatar(userId: string): Promise<{ url: string } | { error: string }> {
  // 1. Permission
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!perm.granted) return { error: 'permission_denied' }

  // 2. Pick + crop to square
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,                              // ~70-80% size reduction
    base64: false,
  })
  if (result.canceled) return { error: 'cancelled' }

  const asset = result.assets[0]

  // 3. Validate size
  if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
    return { error: 'file_too_large' }
  }

  // 4. Determine ext from URI / mime
  const mime = asset.mimeType ?? 'image/jpeg'
  const ext =
    mime === 'image/png' ? 'png'
    : mime === 'image/webp' ? 'webp'
    : 'jpg'

  // 5. Read file as ArrayBuffer (Track doesn't use Node's File)
  const response = await fetch(asset.uri)
  const blob = await response.blob()

  // 6. Path MUST be {userId}/avatar.{ext} per RLS policy
  const path = `${userId}/avatar.${ext}`

  // 7. Upload (upsert overwrites previous)
  const { error: uploadErr } = await supabase.storage
    .from('profile-avatars')
    .upload(path, blob, {
      contentType: mime,
      upsert: true,
      cacheControl: '3600',
    })

  if (uploadErr) {
    console.error('avatar upload', uploadErr)
    return { error: 'storage_failed' }
  }

  // 8. Clean up orphan ext (e.g. user had .jpg, now uploaded .png)
  const otherExts = ['jpg', 'png', 'webp'].filter(e => e !== ext)
  for (const otherExt of otherExts) {
    await supabase.storage
      .from('profile-avatars')
      .remove([`${userId}/avatar.${otherExt}`])
      .catch(() => {})  // best-effort, file may not exist
  }

  // 9. Get public URL with cache-bust (matches Web pattern)
  const { data } = supabase.storage.from('profile-avatars').getPublicUrl(path)
  const publicUrl = `${data.publicUrl}?t=${Date.now()}`

  // 10. Update profile
  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', userId)

  if (updateErr) {
    console.error('profile update', updateErr)
    return { error: 'profile_update_failed' }
  }

  return { url: publicUrl }
}

async function removeAvatar(userId: string): Promise<{ ok: true } | { error: string }> {
  const paths = ['jpg', 'png', 'webp'].map(e => `${userId}/avatar.${e}`)
  await supabase.storage.from('profile-avatars').remove(paths).catch(() => {})

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', userId)

  return error ? { error: 'profile_update_failed' } : { ok: true }
}
```

### UI pattern

```
┌──────────────────────────────────┐
│       Profile                    │
│                                  │
│       ┌──────┐                   │
│       │  JR  │  ← xl Avatar      │
│       └──────┘                   │
│                                  │
│   [ Change photo ]               │
│   [ Remove photo ]               │
│                                  │
│   Name: Juan Restrepo            │
│   Email: jr@jantile.com          │
└──────────────────────────────────┘
```

Match Web's UX:
- Tap "Change photo" → image picker → upload → toast success → avatar refreshes inline
- Tap "Remove photo" → confirm dialog → DELETE → avatar reverts to initials
- Show "JPG, PNG or WebP. Max 5 MB." hint underneath

### i18n keys (already in Web `messages/*.json` under `Settings.avatar.*`)

If Track uses next-intl-style i18n, mirror these keys. Otherwise hardcode EN/ES strings:

```
label: "Profile picture" / "Foto de perfil"
upload: "Upload photo" / "Subir foto"
change: "Change photo" / "Cambiar foto"
remove: "Remove" / "Eliminar"
uploaded: "Photo updated" / "Foto actualizada"
removed: "Photo removed" / "Foto eliminada"
hint: "JPG, PNG or WebP. Max 5 MB." / "JPG, PNG o WebP. Máx 5 MB."
errors:
  permission_denied: "Photo library permission required" / "Necesitamos permiso para galería"
  file_too_large: "File too large (max 5 MB)" / "Archivo muy grande (máx 5 MB)"
  storage_failed: "Upload failed — try again" / "Error al subir — reintentá"
  profile_update_failed: "Could not save photo" / "No se pudo guardar la foto"
  cancelled: (no toast — silent cancel)
```

---

## Sync rules (data contract)

**Track MAY:**
- ✅ INSERT/UPDATE `storage.objects` in `profile-avatars` bucket WHERE path starts with `{auth.uid()}/`
- ✅ DELETE the same paths
- ✅ UPDATE `profiles.avatar_url` for the current user (auth.uid() match)
- ✅ SELECT any profile's `avatar_url` (already public via PowerSync)

**Track NEVER:**
- ❌ Tries to write to a path NOT prefixed with their auth.uid() — RLS rejects
- ❌ Writes to `profiles.avatar_url` for a different user — RLS rejects
- ❌ Mixes up `profile-avatars` (this bucket) with `worker-photos` (Sprint 49 HR photos)

**Web NEVER touches Track-uploaded avatars** beyond reading them. If Track uploads first, Web's display picks up the change automatically via the `?t=<timestamp>` cache-buster on the URL.

---

## Edge cases

**1. User uploads on Web AND Track in same minute.** Last-writer-wins on the storage upsert + the `profiles.avatar_url` UPDATE. Both clients refresh on next read; no consistency issue because both writes are atomic and idempotent.

**2. PowerSync stale read.** Track sees `avatar_url` from local SQLite snapshot. After Web upload, Track shows old avatar until PowerSync syncs (typically <1s). The `?t=...` cache-bust ensures the NEW URL bypasses any HTTP cache once it does sync — Track Image component does a fresh fetch.

**3. Worker (no login) needs photo.** That's `workers.photo_url` (Sprint 49), not this. Use the `worker-photos` bucket.

**4. Foreman with login has BOTH.** `profiles.avatar_url` for app identity (top-bar, comments), `workers.photo_url` for HR records (manpower module, ID card on PTP). Treat them as separate fields — both can have different images.

**5. Upload while offline.** PowerSync handles offline writes for `profiles.avatar_url` (queued INSERT/UPDATE). For Storage, expo-image-picker + Supabase storage client both work offline only if you bundle a queue — for MVP, surface a "no internet" toast and skip. Phase 2 could add an offline queue.

**6. Image too big from camera.** Set `quality: 0.85` in ImagePicker options to compress. iPhone HEIC photos can be 6-8MB raw — quality 0.85 typically gets them under 2MB. Add explicit size check before upload regardless.

**7. User deletes account.** Storage objects under their userId path stay orphaned (we don't run a cleanup cron). Acceptable — < 5 MB per orphan and deletion is rare. Phase 2 could add a daily cleanup job.

---

## Validation checklist (Track)

- [ ] Avatar component renders with imageUrl
- [ ] Avatar component falls back to initials when imageUrl is null
- [ ] Avatar component falls back to initials when image fails to load
- [ ] Top-bar avatar shows current user's photo
- [ ] Profile screen displays large preview (xl size)
- [ ] "Upload photo" opens image picker with 1:1 crop
- [ ] Upload succeeds for JPG / PNG / WebP files under 5 MB
- [ ] Upload rejects file > 5 MB with friendly error
- [ ] Upload rejects non-image MIME with friendly error
- [ ] After upload, top-bar refreshes inline (no app reload needed)
- [ ] "Remove photo" reverts to initials immediately
- [ ] Re-upload after remove works (orphan cleanup OK)
- [ ] Switching ext (jpg → png) doesn't leave orphan files in bucket
- [ ] Avatar visible in: time entry "assigned by", crew cards, notification bell items, comments, signers
- [ ] Web upload shows up in Track within ~1s (PowerSync sync)
- [ ] Track upload shows up in Web within ~1s (next page render or router.refresh)

---

## Questions / blockers for Web team

If Track team hits any of these, ping us — they may indicate Web-side bugs:

- RLS rejecting upload despite path being `{auth.uid()}/avatar.{ext}`
- `profiles.avatar_url` UPDATE returning 0 rows (user might not have a profile row — log out / log in)
- Image showing 404 in Track but URL is valid (storage policy might have changed — verify SELECT is public)
- Avatar appearing on Web but not Track after upload — PowerSync sync delay or cache issue

Web contact: this repo (`docs/sprints/SPRINT_TRACK_AVATARS.md`)
Web commit: `6858106` (avatar component + bucket + RLS + Settings UI)
