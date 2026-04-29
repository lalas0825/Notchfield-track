# AreaDetail — Future: Video Progress Capture

> **Status:** Deferred (2026-04-29). Pilot Jantile is asking for it, but
> we're holding to gather more feedback before adding surface area.
> **Estimate when pursued:** ~3h Track-side + 1h Web-side schema work.
> **Trigger to revisit:** ≥2 distinct foremen explicitly request video,
> OR pilot completes the current feature backlog (signoffs, payroll,
> deficiencies) and the team is steady on those flows.

## What it is

Add short video clips alongside photos in AreaDetail, used for the same
purpose: documenting progress on a room ("here's how the waterproofing
looks today"). NOT for evidence in formal docs, NOT for reporting
problems, NOT for time-lapse — those are bigger scopes that may build
on this base later if value is proven.

Single use case for v1: **"a foreman wants to capture a 5-15 second
clip of an area, view it later in the photo gallery, share via the
existing channels (Notes / signoffs / etc) — exactly the same UX as
photos."**

## Why we deferred

Three reasons:

1. **Photos already cover ~95% of the documentation use case.** Pilot
   has been productively using photos for weeks across deficiencies,
   sign-offs, daily reports. Video adds a marginal extra dimension
   that may or may not be valued — better to confirm with usage data.

2. **Each new feature surface = new bug surface.** Pilot is steady
   right now on the feature load (signoffs end-to-end, payroll
   weekly timesheet, deficiencies, crew). Adding video introduces a
   new media pipeline (capture, upload, playback, gallery
   integration). Risk-asymmetric for a "nice to have."

3. **Construction signal reality.** Field crews on bad mobile signal
   means a 30-second video upload (~5-8 MB compressed) takes
   30-90 seconds. If that fails mid-stream, foreman has to retry, may
   give up — net negative UX vs photos which upload in ~1-2s. Want
   to be sure the demand is real before adding this friction.

## What would need to be built

### Track-side

#### Capture

`expo-image-picker` already supports video — single-line change in
the existing camera launchers:

```ts
import * as ImagePicker from 'expo-image-picker';

const result = await ImagePicker.launchCameraAsync({
  mediaTypes: ImagePicker.MediaTypeOptions.All,  // currently: Images
  videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium, // ~480p
  videoMaxDuration: 15,                                                 // seconds cap
  quality: 0.7, // for photo path
});

if (result.assets[0].type === 'video') {
  // Video path
} else {
  // Photo path (unchanged)
}
```

15-second cap + 480p quality keeps file size 3-8 MB. No third-party
compression library needed, native iOS/Android encoder handles it.

#### Upload

Cannot reuse the base64 + ArrayBuffer pattern from photos — RN bridge
caps strings around 200-500 MB and even smaller videos take many
seconds to base64-encode. Must use multipart streaming via
`FileSystem.uploadAsync`:

```ts
import * as FileSystem from 'expo-file-system/legacy';

const { uri } = result.assets[0];
const filename = `${organizationId}/areas/${areaId}/${uuid()}.mp4`;
const uploadUrl = `${SUPABASE_URL}/storage/v1/object/field-photos/${filename}`;

await FileSystem.uploadAsync(uploadUrl, uri, {
  httpMethod: 'POST',
  headers: {
    Authorization: `Bearer ${supabaseAccessToken}`,
    'Content-Type': 'video/mp4',
    'x-upsert': 'false',
  },
});
```

This uses HTTP multipart streaming — file streamed off disk in
chunks, never fully loaded into JS memory. Works on big files.

#### Schema additions (Web team — 1h)

```sql
ALTER TABLE field_photos
  ADD COLUMN media_type TEXT NOT NULL DEFAULT 'photo'
    CHECK (media_type IN ('photo', 'video')),
  ADD COLUMN duration_sec NUMERIC NULL,
  ADD COLUMN thumbnail_url TEXT NULL;  -- for videos: server generates
                                         -- a poster frame; for photos:
                                         -- mobile-sized variant
```

`field-photos` bucket policies stay the same (already enforces
`{org_id}` first folder, same RLS shape works for video files).

#### Playback (no new native module needed)

Tap a video thumbnail in PhotoGallery → `Linking.openURL(publicUrl)`.
Opens the device's native video player (Android: Photos / Gallery,
iOS: Photos / Files). Returns to the app on back gesture. Out-of-app
playback skips the dep on `expo-av` or `react-native-video`,
keeping the native footprint flat for v1.

If pilot complains that out-of-app playback breaks flow, swap to
`expo-av` Video component:

```bash
npx expo install expo-av
```

About 8 KB of additional JS on top of native. Built into Expo SDK
canon — no third-party risk.

#### Gallery rendering

`PhotoGallery` already loops over `field_photos`. Add a small badge
overlay when `media_type === 'video'`:

```tsx
<View style={thumbContainer}>
  <Image source={{ uri: thumbnail_url ?? remote_url }} />
  {photo.media_type === 'video' ? (
    <View style={playBadge}>
      <Ionicons name="play-circle" size={28} color="#FFFFFF" />
      {photo.duration_sec ? <Text>{Math.round(photo.duration_sec)}s</Text> : null}
    </View>
  ) : null}
</View>
```

#### Capture button — action sheet

Today: `<Pressable onPress={takePhoto}>Take Photo</Pressable>`
After: tap → bottom-sheet picker with two options:

```
[ 📷 Photo ]
[ 🎥 Video (15s max) ]
[ Cancel ]
```

Keeps photo flow exactly as-is (1 extra tap), opens video flow when
explicitly requested. Defaults to photo behavior.

### Web-side (1h)

- Schema migration (above)
- Bucket file-size limit raise (`field-photos.file_size_limit` from
  default to 50 MB just to be safe — uncompressed worst case)
- Optional: server-side thumbnail generation for videos (poster frame
  at t=1s) — without it, the gallery shows a generic video icon.
  Trivial with ffmpeg in a Supabase Edge Function.

### What's out of scope for v1

- Embedding videos in PDF (signoffs / safety docs / etc). Videos
  CAN'T be embedded in PDFs — closest pattern is a thumbnail with
  a clickable link to the public URL. If pilot later wants this,
  Web team work to render the link with an "📹 Watch video" CTA in
  the PDF. Phase 2 territory.
- Background upload queue with retry. v1 is foreground-only — if
  upload fails, foreman re-taps. Fine for 15-second clips on decent
  signal. If pilot reports "I record, walk away, video doesn't sync,"
  add a queue similar to `photo-queue.ts` for videos.
- In-app trim / crop. iOS/Android picker has built-in trim before
  return. Good enough.
- Time-lapse / continuous record / progress comparison overlays.
  Different products. Don't blur the line.

## Edge cases to handle

| Case | Behavior |
|------|----------|
| Foreman records, app backgrounded mid-upload | Upload aborts, file stays local (existing photo-queue pattern handles same case for photos). Foreman re-taps to retry. |
| Picker returns 25-second video (user disabled cap) | Track caps to 15s post-pick (videoMaxDuration is a hint, not a hard server-side check). Use `expo-av` to programmatically truncate or reject + show toast "Max 15s". |
| File too large for bucket policy | Supabase returns 413. Show "Video too large — try a shorter clip." |
| Device runs out of storage during record | OS-level error from `expo-image-picker`. Show generic "Recording failed" with retry. |
| Public URL not accessible to GC (signed off doc) | Same as photos — bucket is already public. URL works for any anonymous viewer. |

## Validation criteria before pursuing

Before spending the 4 hours, confirm at least one of:

1. **Multiple foremen ask for it explicitly** ("necesito grabar"
   shows up in unprompted feedback from ≥2 different foremen).
2. **A specific use case becomes blocking** (e.g. GC asks for video
   evidence on a specific signoff and Track can't deliver).
3. **Photos prove insufficient for a recurring scenario** (e.g. moving
   problems like water dripping that a still photo can't capture).

If pilot completes the rest of the backlog without any of those
signals → don't build it. Photos are sufficient.

## Files that would change (rough map)

```
TRACK
├── src/features/photos/services/photo-queue.ts          (+ media_type col)
├── src/features/photos/components/PhotoGallery.tsx      (+ video badge)
├── src/features/photos/components/MediaPicker.tsx       (NEW — bottom sheet)
├── src/features/photos/services/video-upload.ts         (NEW — FileSystem.uploadAsync)
├── src/features/production/components/AreaDetail.tsx    (action-sheet on Take Photo)
├── src/shared/lib/powersync/schema.ts                   (media_type, duration_sec)
└── powersync/sync-rules.yaml                            (no change — auto-syncs)

WEB (server)
├── migrations/add_media_type_to_field_photos.sql        (NEW)
├── /api/storage/file-photos/limit-bump                  (config tweak)
└── (optional) supabase/functions/video-thumbnail/        (NEW edge function)
```

## Cross-references

- [photo-queue.ts](src/features/photos/services/photo-queue.ts) — existing photo upload
  background queue to mirror for videos when scaling beyond v1.
- [signoffPhotos.ts](src/features/signoffs/services/signoffPhotos.ts) — base64+ArrayBuffer
  pattern that does NOT scale to video (must use FileSystem.uploadAsync).
- [CREW_FUTURE_GPS_AUTOTRIGGER.md](CREW_FUTURE_GPS_AUTOTRIGGER.md) — same
  format and discipline of "deferred but documented" follow-ups.
