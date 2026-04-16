# SPRINT 47B — Track Drawing Viewer (Mobile + Hyperlinks)
# MODEL: /model claude-opus-4-6
# Repo: notchfield-track
# DEPENDS ON: Sprint 47A (drawing tables + hyperlinks + pins)

---

## Context

Read CLAUDE_TRACK.md before starting.

Sprint 47A built a full drawing management system in Takeoff web with 
hyperlinks between sheets. Track needs a mobile viewer so foremen can 
view plans in the field, navigate via hyperlinks, and see/add pins.

Track does NOT manage drawings (upload, revision, etc.) — that's Takeoff web.
Track is view + annotate only.

Key tables (already exist from 47A):
- drawings — sheets with page_number, sheet_number, title, discipline
- drawing_sets — set containers
- drawing_hyperlinks — clickable references between sheets
- drawing_pins — annotations (notes, RFI links, photos)

---

## CHANGE 1: PowerSync Schema

Add to `src/shared/lib/powersync/schema.ts`:

```typescript
drawing_sets: new TableV2({
  organization_id: column.text,
  project_id: column.text,
  name: column.text,
  discipline: column.text,
  revision_number: column.text,
  revision_date: column.text,
  pdf_url: column.text,
  is_current: column.integer,
  created_at: column.text,
}),

drawings: new TableV2({
  organization_id: column.text,
  drawing_set_id: column.text,
  project_id: column.text,
  page_number: column.integer,
  sheet_number: column.text,
  title: column.text,
  discipline: column.text,
  thumbnail_url: column.text,
  scale_factor: column.real,
  is_current: column.integer,
  created_at: column.text,
}),

drawing_hyperlinks: new TableV2({
  organization_id: column.text,
  source_drawing_id: column.text,
  target_sheet_number: column.text,
  target_drawing_id: column.text,
  position_x: column.real,
  position_y: column.real,
  width: column.real,
  height: column.real,
  reference_text: column.text,
  detection_type: column.text,
  created_at: column.text,
}),

drawing_pins: new TableV2({
  organization_id: column.text,
  drawing_id: column.text,
  project_id: column.text,
  pin_type: column.text,
  position_x: column.real,
  position_y: column.real,
  title: column.text,
  description: column.text,
  color: column.text,
  linked_rfi_id: column.text,
  photos: column.text,
  created_by: column.text,
  resolved: column.integer,
  created_at: column.text,
  updated_at: column.text,
}),
```

Add to Schema export + sync rules.

---

## CHANGE 2: Sync Rules

```yaml
- SELECT * FROM drawing_sets WHERE organization_id = bucket.organization_id
- SELECT * FROM drawings WHERE organization_id = bucket.organization_id
- SELECT * FROM drawing_hyperlinks WHERE organization_id = bucket.organization_id
- SELECT * FROM drawing_pins WHERE organization_id = bucket.organization_id
```

---

## CHANGE 3: Plans Tab (Sheet Browser)

The "Plans" bottom tab already exists. Update it to show the sheet browser.

```
┌─────────────────────────────────────────┐
│ Plans                          [Filter] │
├─────────────────────────────────────────┤
│ [All] [Arch] [Struct] [MEP] [Elec]     │
│                                         │
│ ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│ │ [thumb] │  │ [thumb] │  │ [thumb] │ │
│ │ A-101   │  │ A-102   │  │ A-103   │ │
│ │ Ground  │  │ 2nd Flr │  │ 3rd Flr │ │
│ │ 2 📌    │  │         │  │ 1 📌    │ │
│ └─────────┘  └─────────┘  └─────────┘ │
│                                         │
│ ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│ │ [thumb] │  │ [thumb] │  │ [thumb] │ │
│ │ A-201   │  │ A-301   │  │ A-501   │ │
│ │ Section │  │ Elevat  │  │ Details │ │
│ └─────────┘  └─────────┘  └─────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

- Grid of thumbnails (2 or 3 columns depending on screen width)
- Sheet number + title + pin count badge
- Filter chips by discipline
- Search by sheet number or title
- Tap thumbnail → opens Sheet Viewer
- Pull to refresh

---

## CHANGE 4: Mobile Sheet Viewer

Full-screen PDF viewer with hyperlinks and pins.

```
┌─────────────────────────────────────────┐
│ ← A-101 Ground Floor         [📌] [⋮] │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────────┐│
│  │                                     ││
│  │         PDF PAGE RENDERED           ││
│  │         (pinch zoom, pan)           ││
│  │                                     ││
│  │   ┌──────┐                          ││
│  │   │A-501 │ ← blue hyperlink hotspot ││
│  │   │Det A │   (tap to navigate)      ││
│  │   └──────┘                          ││
│  │                                     ││
│  │      📌 ← pin (tap for detail)     ││
│  │                                     ││
│  └─────────────────────────────────────┘│
│                                         │
│ [◀ A-100]  A-101  [A-102 ▶]           │
└─────────────────────────────────────────┘
```

### PDF Rendering on Mobile
Use `react-native-pdf` or `expo-print` WebView approach:
```bash
npm install react-native-pdf react-native-blob-util
```

Or use a WebView with PDF.js if react-native-pdf has issues:
```typescript
// Download PDF from Supabase Storage to local cache
// Render in WebView with PDF.js or native PDF viewer
```

The PDF URL comes from drawing_sets.pdf_url (Supabase Storage public URL).
For a specific page, render only that page from the multi-page PDF.

### Gestures
- Pinch to zoom (react-native-gesture-handler)
- Two-finger pan
- Double-tap to zoom to fit
- Single tap on hyperlink hotspot → navigate to target sheet
- Single tap on pin → show pin detail bottom sheet
- Long press → add new pin (if permitted)

### Hyperlink Hotspots on Mobile
Same concept as web — semi-transparent blue overlay on detected references.
Load hotspots from drawing_hyperlinks via PowerSync (offline-available).

```typescript
const hotspots = await db.getAll(
  'SELECT * FROM drawing_hyperlinks WHERE source_drawing_id = ?',
  [currentDrawingId]
);
```

Render as absolute-positioned touchable areas over the PDF:
```tsx
{hotspots.map(h => (
  <TouchableOpacity
    key={h.id}
    style={{
      position: 'absolute',
      left: h.position_x * scale,
      top: h.position_y * scale,
      width: h.width * scale,
      height: h.height * scale,
      backgroundColor: 'rgba(55, 138, 221, 0.15)',
      borderWidth: 1,
      borderColor: 'rgba(55, 138, 221, 0.5)',
      borderRadius: 4,
    }}
    onPress={() => navigateToSheet(h.target_sheet_number)}
  />
))}
```

### Sheet Navigation
- Swipe left/right to go to prev/next sheet
- Bottom bar shows current sheet with arrows
- Back button (←) returns to previous sheet in history stack
- If navigated via hyperlink, back returns to source sheet

```typescript
const [sheetStack, setSheetStack] = useState<string[]>([]);

function navigateToSheet(sheetNumber: string) {
  const target = drawings.find(d => d.sheet_number === sheetNumber);
  if (!target) {
    Alert.alert('Sheet not found', `${sheetNumber} is not in this project`);
    return;
  }
  setSheetStack(prev => [...prev, currentDrawingId]);
  setCurrentDrawingId(target.id);
}

function goBack() {
  if (sheetStack.length > 0) {
    setCurrentDrawingId(sheetStack[sheetStack.length - 1]);
    setSheetStack(prev => prev.slice(0, -1));
  } else {
    router.back(); // back to sheet browser
  }
}
```

---

## CHANGE 5: Pin Annotations (Mobile)

### View Pins
Pins from drawing_pins rendered as colored markers on the sheet.
Tap pin → bottom sheet with detail:

```
┌─────────────────────────────────────────┐
│ 📌 Note — Verify tile layout            │
│ Created by José Garcia · Apr 8          │
│                                         │
│ Check the tile pattern at the entrance  │
│ matches the approved sample board.      │
│                                         │
│ [📷 2 photos]                           │
│                                         │
│ [Mark Resolved]                         │
└─────────────────────────────────────────┘
```

### Add Pin (foreman + supervisor only)
Long press on the sheet → "Add Pin" option:

```
┌─────────────────────────────────────────┐
│ New Pin                                 │
│                                         │
│ Type: [📌 Note] [📷 Photo] [❓ RFI]    │
│                                         │
│ Title: [________________________]       │
│ Description: [__________________]       │
│                                         │
│ [📸 Add Photo]                          │
│                                         │
│ [Cancel]              [Save Pin]        │
└─────────────────────────────────────────┘
```

Pin data writes to drawing_pins via Supabase (online) or PowerSync (offline).
Photos upload to Supabase Storage.

---

## CHANGE 6: Offline Support

### What works offline (via PowerSync):
- Sheet browser (thumbnails cached locally)
- Sheet viewer (PDF cached after first view)
- Hyperlink navigation (hotspots from PowerSync)
- View existing pins
- Add pins (queued, syncs when online)

### What needs online:
- First PDF download
- Photo upload for pins
- Search (if server-side)

### PDF Caching
When a sheet is viewed, cache the PDF page locally:
```typescript
import * as FileSystem from 'expo-file-system';

const cacheDir = `${FileSystem.cacheDirectory}drawings/`;
const cachedPath = `${cacheDir}${drawingId}_page${pageNumber}.pdf`;

// Check cache first
const cacheExists = await FileSystem.getInfoAsync(cachedPath);
if (cacheExists.exists) {
  return cachedPath; // use cached version
}

// Download and cache
await FileSystem.downloadAsync(pdfUrl, cachedPath);
return cachedPath;
```

---

## CHANGE 7: Plans Tab in More Menu

If "Plans" isn't a bottom tab, add it to More menu:

```typescript
{
  title: 'Plans',
  icon: 'map-outline',
  href: '/more/plans',
}
```

Or if Plans IS a bottom tab (it should be — it's a primary feature), 
make sure it loads the sheet browser.

Accessible to ALL roles (supervisor, foreman, worker).

---

## CHANGE 8: Permissions

| Role | View Sheets | Navigate Hyperlinks | View Pins | Add Pins |
|------|:-----------:|:-------------------:|:---------:|:--------:|
| supervisor | ✅ | ✅ | ✅ | ✅ |
| foreman | ✅ | ✅ | ✅ | ✅ |
| worker | ✅ | ✅ | ✅ | ❌ |

---

## File Structure

```
src/features/drawings/
├── screens/
│   ├── SheetBrowserScreen.tsx     — Grid of thumbnails with filters
│   └── SheetViewerScreen.tsx      — Full-screen PDF with hyperlinks + pins
├── components/
│   ├── SheetCard.tsx              — Thumbnail card for browser
│   ├── HyperlinkOverlay.tsx       — Touchable hotspots on PDF
│   ├── PinOverlay.tsx             — Pin markers on PDF
│   ├── PinDetailSheet.tsx         — Bottom sheet for pin detail
│   ├── AddPinSheet.tsx            — Bottom sheet for new pin
│   ├── SheetNavBar.tsx            — Bottom navigation (prev/current/next)
│   └── DisciplineFilter.tsx       — Filter chips
├── services/
│   ├── drawingService.ts          — Fetch drawings, cache PDFs
│   └── pinService.ts              — Pin CRUD
└── hooks/
    ├── useDrawings.ts             — Sheet list + filters
    ├── useSheetViewer.ts          — PDF loading + zoom state
    └── useHyperlinks.ts           — Hotspot data + navigation stack
```

---

## Dependencies

```bash
npm install react-native-pdf react-native-blob-util
# OR if PDF rendering issues:
# Use WebView + PDF.js approach
npx expo install expo-file-system
```

---

## Verify

1. Drawing tables in PowerSync schema + sync rules
2. Plans tab shows grid of sheet thumbnails
3. Filter by discipline works
4. Search by sheet number/title works
5. Tap thumbnail → opens full-screen viewer
6. PDF renders with pinch zoom + pan
7. **Hyperlink hotspots visible (blue overlay on references)**
8. **Tap hyperlink → navigates to target sheet**
9. **Back button returns to source sheet (history stack)**
10. Swipe left/right for prev/next sheet
11. Bottom nav shows current sheet with arrows
12. Pins visible as colored markers on sheet
13. Tap pin → bottom sheet with detail
14. Long press → add new pin (foreman/supervisor)
15. Pin photos uploadable
16. Offline: cached PDFs viewable without internet
17. Offline: hyperlinks work (data from PowerSync)
18. Offline: existing pins viewable
19. All roles can view, only foreman/supervisor can add pins
20. npx tsc --noEmit passes
