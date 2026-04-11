# SPRINT 45B — Track Mobile Feedback Reporting
# MODEL: /model claude-opus-4-6
# Repo: notchfield-track
# DEPENDS ON: Sprint 45A (feedback_reports table)

---

## Context

Read CLAUDE_TRACK.md before starting.

Sprint 45A created the feedback_reports table and admin dashboard in Takeoff web.
This sprint adds the reporting capability to Track mobile so foremen, supervisors, 
and workers can report issues directly from the field app.

---

## CHANGE 1: PowerSync Schema

In `src/shared/lib/powersync/schema.ts`, add:

```typescript
feedback_reports: new TableV2({
  organization_id: column.text,
  project_id: column.text,
  reported_by: column.text,
  reporter_name: column.text,
  reporter_role: column.text,
  type: column.text,
  severity: column.text,
  title: column.text,
  description: column.text,
  page_url: column.text,
  page_name: column.text,
  app_source: column.text,
  device_info: column.text,
  browser_info: column.text,
  screen_size: column.text,
  screenshots: column.text,
  status: column.text,
  admin_response: column.text,
  created_at: column.text,
  updated_at: column.text,
}),
```

Add to Schema export.

---

## CHANGE 2: Sync Rules

In `powersync/sync-rules.yaml`, add:

```yaml
- SELECT * FROM feedback_reports WHERE organization_id = bucket.organization_id
```

---

## CHANGE 3: Feedback Button in Track

Add a "Report Issue" option in the Settings gear menu (top-right of the app)
OR as an item in the "More" tab menu.

**Recommended: Both places**

### Settings gear menu (accessible from every screen):
Add "Report Issue" with a bug icon to the settings/gear dropdown.

### More tab:
Add at the bottom of the More menu:
```
─────────────────
Report Issue  🐛
My Reports    📋
```

---

## CHANGE 4: Report Modal (React Native)

Create `src/shared/components/FeedbackModal.tsx`

```
┌─────────────────────────────────────────┐
│ Report an Issue                     ✕   │
├─────────────────────────────────────────┤
│                                         │
│ Type                                    │
│ [🐛 Bug] [💡 Feature] [💬 Feedback]    │
│                                         │
│ Severity (bugs only)                    │
│ [Low] [Medium] [High] [Critical]       │
│                                         │
│ Title *                                 │
│ [Brief description                 ]   │
│                                         │
│ Description *                           │
│ ┌─────────────────────────────────────┐ │
│ │ What happened?                      │ │
│ │                                     │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Screenshots                             │
│ [📸 Take Photo] [📁 From Gallery]      │
│ (max 3 photos)                          │
│                                         │
│ ───────────────────────────────────────  │
│ Context: Board > Washroom 01-032        │
│ Device: Samsung Galaxy S24 · Android 15 │
│ ───────────────────────────────────────  │
│                                         │
│ [         Submit Report         ]       │
└─────────────────────────────────────────┘
```

### Auto-captured context:
```typescript
import * as Device from 'expo-device';
import { usePathname } from 'expo-router';

const context = {
  page_url: pathname,
  page_name: getScreenName(pathname),
  app_source: 'mobile',
  device_info: `${Device.brand} ${Device.modelName} · ${Device.osName} ${Device.osVersion}`,
  screen_size: `${Dimensions.get('window').width}×${Dimensions.get('window').height}`,
  reporter_role: permissions.role,
  project_id: currentProjectId,
};
```

### Screenshots:
- "Take Photo" opens camera (use existing camera/photo service)
- "From Gallery" opens image picker
- Upload to Supabase Storage: `feedback-screenshots/{orgId}/{reportId}/{filename}`
- Show thumbnails with X to remove
- Max 3 photos

### On Submit:
1. Upload photos to Supabase Storage (need internet for this)
2. Insert into feedback_reports via PowerSync
3. Show success alert: "Report submitted! The admin will review it."
4. Close modal

### Offline handling:
- The text fields save via PowerSync (works offline)
- Screenshots require internet to upload — if offline, save locally and queue
- Show note: "Screenshots will upload when you're back online"

---

## CHANGE 5: My Reports Screen

Create `src/app/(tabs)/more/my-reports/index.tsx`

Shows the user's own submitted reports:

```
┌─────────────────────────────────────────┐
│ My Reports                              │
├─────────────────────────────────────────┤
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 🐛 Delivery time not showing       │ │
│ │ 2 hours ago              [New]     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 💡 Add export for timesheet        │ │
│ │ 1 day ago            [Reviewing]   │ │
│ │ Admin: "Good idea, we'll add it"   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 💬 App works great offline         │ │
│ │ 3 days ago           [Resolved]    │ │
│ │ Admin: "Thanks for the feedback!"  │ │
│ └─────────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

- Query: `feedback_reports WHERE reported_by = currentUserId`
- Show admin_response if exists
- Status badges with colors
- Tap to view full detail (read-only)

### Add to More menu:
```typescript
{
  title: 'My Reports',
  icon: 'clipboard-list-outline',
  href: '/more/my-reports',
}
```

This item is visible to ALL roles (everyone can see their own reports).

---

## CHANGE 6: Permissions

All roles can submit reports and view their own reports.
No permission gating needed — this is a universal feature.

---

## Styling (Field-First)

- Type selector: large toggle buttons (56dp touch targets)
- Severity: pill buttons, color-coded (low=gray, medium=amber, high=orange, critical=red)
- Description textarea: large, min-height 120px
- Screenshot thumbnails: 80×80, tap to preview full size
- Submit button: full width, 56dp, green
- Context section: muted text, small font (14sp)
- Status badges: consistent with rest of app

---

## Verify

1. feedback_reports table in PowerSync schema
2. Sync rules updated
3. "Report Issue" in settings gear menu
4. "Report Issue" in More tab menu
5. Report modal: type selector (bug/feature/feedback)
6. Severity only shows for bugs
7. Take Photo and From Gallery work
8. Max 3 screenshots enforced
9. Auto-captured context: pathname, device info, screen size, role
10. Submit creates report (works offline for text, queues photos)
11. Success alert shown
12. My Reports screen shows user's own reports
13. Admin response visible on My Reports
14. Status badges with correct colors
15. npx tsc --noEmit passes
