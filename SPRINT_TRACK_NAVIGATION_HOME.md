# SPRINT — Track Navigation Reorganization + Home Optimization
# MODEL: /model claude-sonnet-4-6
# Repo: notchfield-track

---

## Context

Read CLAUDE.md before starting.

The Track app's bottom tab navigation needs reorganization. Currently the tabs
are disordered, labels are truncated ("hom...", "Work..."), and features like
Deliveries and Work Tickets are buried inside the "More" menu.

The Home screen shows "home/index" debug text in the header, has a typo
("Deliveryies"), and doesn't surface enough actionable data.

The Work Tickets screen has an oversized kanban visualization (tall vertical
bars) that wastes screen space and pushes the ticket list below the fold.

This sprint fixes all three issues.

---

## PART 1: Bottom Tab Bar Reorganization

### Current tab order (broken):
```
Board | Plans | More | hom... | Work...
```

### New tab order (6 tabs):
```
Home | Board | Plans | Tickets | Deliveries | More
```

Find the bottom tab navigator configuration (likely in `src/navigation/`,
`src/app/_layout.tsx`, or similar Expo Router layout file).

### Tab definitions:

| Tab | Route | Icon (lucide-react-native or @expo/vector-icons) | Label |
|-----|-------|------|-------|
| Home | home/index | `Home` or `House` icon | Home |
| Board | board | `LayoutGrid` or `Grid` icon | Board |
| Plans | plans | `Map` icon | Plans |
| Tickets | work-tickets | `ClipboardList` or `FileText` icon | Tickets |
| Deliveries | deliveries | `Truck` icon | Deliveries |
| More | more | `MoreHorizontal` or `Menu` icon | More |

### Implementation:

1. Reorder the tab screens so Home is FIRST (index/default tab)
2. Move Work Tickets from a More menu item to a top-level tab named "Tickets"
3. Move Deliveries from a More menu item to a top-level tab named "Deliveries"
4. Ensure labels are SHORT enough to not truncate on small screens:
   - "Home" (4 chars) ✓
   - "Board" (5 chars) ✓
   - "Plans" (5 chars) ✓
   - "Tickets" (7 chars) ✓
   - "Deliveries" (10 chars) — if truncates, use "Delivery" (8 chars)
   - "More" (4 chars) ✓
5. Tab bar icon size: 24px. Label font size: 10-11px.
6. Active tab color: orange (#F59E0B or whatever the app's accent color is)
7. Inactive tab color: gray (#6B7280 or existing inactive color)

### Tab bar style:
Keep the existing dark theme styling. Just reorder and add the new tabs.
If the tab bar component uses a custom renderer, update it to support 6 tabs
without overflow. On narrow screens (< 360px width), the icons + labels must
still fit — test this.

---

## PART 2: More Menu Cleanup

### Current More menu items (screenshot):
```
GC Punchlist
GPS Check-in
Crew Management
Deliveries        ← REMOVE (now a tab)
Safety & Docs
Report Issue      ← MOVE down
My Reports
Settings
Sign Out
```

### New More menu order:
```
1. GC Punchlist      - CheckCircle icon   - "Resolve punch items from the GC"
2. GPS Check-in      - MapPin icon        - "Clock in/out with GPS stamp"
3. Crew Management   - Users icon         - "Assign workers to areas"
4. Safety & Docs     - Shield icon        - "JHA, PTP, Toolbox Talk, Legal"
5. My Reports        - FileText icon      - "View your submitted reports"
6. Settings          - Settings icon      - "Language, notifications, profile"
7. Report Issue      - AlertTriangle icon - "Bug, feature request, or feedback"
8. Sign Out          - LogOut icon        - user name as subtitle
```

### Changes:
1. **Remove "Deliveries"** from More — it's now a top-level tab
2. **Remove "Work Tickets"** if it's listed here — it's now the "Tickets" tab
3. **Move "Report Issue"** to position 7 (after Settings, before Sign Out)
4. Update icons to match the table above if they differ
5. Remove the "index" debug text at the top of the More screen

If Work Tickets was accessed via More AND via a tab, remove it from More
to avoid duplication. The user should only access it via the Tickets tab.

---

## PART 3: Home Screen Optimization

### 3A. Fix Header

Remove "home/index" debug text from the Home screen header.

The header should show:
```
Good evening                    [PROJECT NAME ▼]
{User Name}
🏗️ {Project Name}
```

- Greeting is time-based: "Good morning" / "Good afternoon" / "Good evening"
- Project selector dropdown in top-right (already exists, keep it)
- User role NOT shown in header (it's in the More menu profile card)

### 3B. Quick Actions (keep as-is)

```
┌─────────────┐  ┌─────────────┐
│  📍         │  │  🛡️         │
│  Check In   │  │  Safety Doc │
└─────────────┘  └─────────────┘
```

These two quick action cards stay. They're the most frequent first-thing
actions for a supervisor arriving on site.

### 3C. PENDING Section (dynamic)

This is the key improvement. Make the PENDING section **dynamic** — it only
shows items that need attention. Each row is tappable and navigates to the
relevant screen.

```typescript
interface PendingItem {
  icon: string;        // emoji or icon component
  label: string;
  count?: number;
  route: string;       // navigation target
  visible: boolean;    // only show if true
}
```

**Pending items to show (in this order):**

1. **Crew not assigned** — show if no crew assignments exist for today
   - Icon: 👥 (Users icon)
   - Label: "No crew assigned yet today"
   - Tap → navigates to Crew Management
   - Query: check crew_assignments for today's date on current project
   - Hide if crew is already assigned

2. **Deliveries in transit** — show if any deliveries have status shipped/in_transit
   - Icon: 🚚 (Truck icon)
   - Label: "{count} Deliveries In Transit"
   - Tap → navigates to Deliveries tab
   - Query: delivery_tickets WHERE status IN ('shipped', 'in_transit') AND project_id = current
   - Hide if count === 0
   - **Fix typo: "Deliveryies" → "Deliveries"**

3. **Draft tickets** — show if any work tickets are still in draft
   - Icon: 📋 (ClipboardList icon)
   - Label: "{count} Tickets in Draft"
   - Tap → navigates to Tickets tab (filtered to Drafts)
   - Query: work_tickets WHERE status = 'draft' AND project_id = current
   - Hide if count === 0

4. **Open punch items** — show if any GC punch items are open/in_progress
   - Icon: 🔨 (Hammer icon)
   - Label: "{count} Open Punch Items"
   - Tap → navigates to More > GC Punchlist
   - Query: gc_punch_items WHERE status IN ('open', 'in_progress') AND project_id = current
   - Hide if count === 0

**If ALL items are hidden** (nothing pending), show a success state:
```
✅ All caught up — no pending items
```

**Each pending row:**
- Left: icon (colored)
- Middle: label text
- Right: chevron (›)
- Tappable → navigates to relevant screen
- Subtle border or card background matching existing style

### 3D. KPI Cards (keep, minor cleanup)

The existing cards stay with minor fixes:

**GPS STATUS card:**
```
📍 GPS STATUS
● Not Checked In          (gray dot = not checked in)
● Checked In at 8:02 AM   (green dot = checked in)
```
No changes needed, works fine.

**CREW card:**
```
👥 CREW                    ⏱️ HOURS
0 / 2 assigned             0.0h today
```
No changes needed.

**SAFETY card:**
```
🛡️ SAFETY
0 active documents
```
No changes needed.

### 3E. Data Fetching

The Home screen needs to fetch counts for the PENDING section. Use the
existing data fetching patterns in Track (PowerSync queries or Supabase
direct queries, whatever the app uses for other screens).

Fetch on:
- Screen mount
- Screen focus (useIsFocused or useFocusEffect)
- Pull-to-refresh (add RefreshControl if not already present)

Keep queries lightweight — just COUNT queries, not full data fetches.

---

## PART 4: Work Tickets Kanban Redesign

### Current (bad):
Tall vertical bars (~300px height) showing All/Drafts/Pending/Signed.
Wastes half the screen, pushes ticket list below the fold.

### New design — Horizontal filter chips:

Replace the vertical bars with a single row of selectable chips/pills:

```
┌──────────────────────────────────────────────────┐
│ [All (8)] [Drafts (3)] [Pending (0)] [Signed (5)]│
└──────────────────────────────────────────────────┘
```

### Chip specifications:
- Height: 36px
- Border radius: 18px (fully rounded)
- Horizontal padding: 16px
- Gap between chips: 8px
- Container: horizontal ScrollView (in case more statuses added later)
- Font size: 14px, medium weight
- Active chip: orange background (#F59E0B), dark text
- Inactive chip: dark gray background (existing card color), light gray text
- Count in parentheses: same color as label text

### Behavior:
- Tap a chip → filters the ticket list below to that status
- "All" shows everything (default selected)
- Counts update in real-time as tickets change status
- Single select only (one chip active at a time)
- The chip row sits between the search bar and the ticket list
- Total vertical space used: ~52px (36px chips + 8px top + 8px bottom padding)
  vs. current ~300px for the bars

### Layout after redesign:
```
┌──────────────────────────────────────────────────┐
│ Work Tickets                              [+]    │
│                                                   │
│ 🔍 Search by #, description, area...             │
│                                                   │
│ [All (8)] [Drafts (3)] [Pending (0)] [Signed (5)]│
│                                                   │
│ ┌───────────────────────────────────────────────┐│
│ │ #1007  Bajsnsjks                    Signed    ││
│ │ Apr 11, 2026 · Tile                           ││
│ │ 📍 Nsksnsn · Aiwkskwj                        ││
│ │ 👥 1 worker · 10.0 hrs                       ││
│ │ ✅ Signed by Naunansj — Naisn                 ││
│ └───────────────────────────────────────────────┘│
│ ┌───────────────────────────────────────────────┐│
│ │ #1006  Jakaisjskowkk                Signed    ││
│ │ ...                                           ││
│ └───────────────────────────────────────────────┘│
│                                                   │
│              [+ New Ticket]                       │
└──────────────────────────────────────────────────┘
```

Now the first ticket is visible WITHOUT scrolling. The foreman sees
actionable content immediately.

---

## PART 5: Navigation from Home to Tabs

When the user taps a PENDING item on Home, it should navigate to the
correct tab and optionally apply a filter:

1. **"Deliveries In Transit"** → switch to Deliveries tab
2. **"Tickets in Draft"** → switch to Tickets tab, auto-select "Drafts" chip
3. **"Open Punch Items"** → navigate to More > GC Punchlist
4. **"No crew assigned"** → navigate to More > Crew Management

For navigating to another tab, use the navigation API to switch tabs
programmatically. For "Tickets in Draft", pass a route param like
`{ initialFilter: 'draft' }` so the Tickets screen can auto-select
the Drafts chip on mount.

For More menu items (Punchlist, Crew), navigate into the More stack.

---

## Verify

### Navigation:
1. Bottom tab bar shows 6 tabs: Home | Board | Plans | Tickets | Deliveries | More
2. Tab labels are NOT truncated on any screen size
3. Home is the default/first tab when app opens
4. Active tab has orange icon + label, inactive has gray
5. Tab icons are appropriate and visually consistent

### More Menu:
6. Deliveries is NOT in the More menu (it's a tab now)
7. Work Tickets is NOT in the More menu (it's the Tickets tab now)
8. Report Issue is after Settings, before Sign Out
9. "index" debug text is not shown at top of More screen
10. All menu items have appropriate icons

### Home Screen:
11. No "home/index" debug text in header
12. Greeting is time-based (morning/afternoon/evening)
13. PENDING section shows dynamic items with correct counts
14. "Deliveries" spelled correctly (not "Deliveryies")
15. Draft tickets count shown when there are drafts
16. Open punch items count shown when there are open items
17. Tapping a pending item navigates to the correct screen
18. All-caught-up state shown when no pending items
19. Pull-to-refresh updates pending counts
20. KPI cards (GPS, Crew, Safety) display correctly

### Work Tickets:
21. Vertical bar kanban is GONE — replaced by horizontal filter chips
22. Chips show: All, Drafts, Pending, Signed with counts
23. Active chip is orange, inactive chips are dark gray
24. Tapping a chip filters the ticket list
25. First ticket is visible without scrolling
26. Navigating from Home with "draft" filter auto-selects Drafts chip

### General:
27. No TypeScript errors (type check passes)
28. All existing functionality still works (no regressions)
29. Tab navigation works on both iOS and Android
