# Sprint Track — Smart Calculator

> **Context:** Field crews (especially tile/marble installers — Jantile is the pilot) constantly do mixed-unit math on plans (`5'-3 1/4" + 2'-7 1/2"`), convert between imperial and metric, and estimate material orders (grout bags, thinset bags, sealer gallons). Today they use the phone's default calculator + a notepad + memory of formulas. This sprint puts all of it in one tool inside Track.
>
> **What Track builds:** A standalone calculator screen under More with a smart expression parser, multi-unit display, history, and 17 construction helpers (areas, materials, geometry, time). FAB shortcut on the Plans tab — the one place dimensions are read and someone needs the math right now. Universal — every role gets it.
>
> **Est:** 4-5 days end-to-end.
>
> **Prereq:** None. Pure feature, zero schema changes, zero new dependencies.
>
> **Sister sprint:** `SPRINT_TAKEOFF_CALCULATOR.md` ports the same feature to Takeoff Web (Next.js header button, modal overlay). Pure logic copied verbatim between repos.

---

## 1. TL;DR

```
NEW (no backend, no schema):
  ✅ src/features/calculator/                  — full feature module
  ✅ src/app/(tabs)/more/calculator.tsx        — main screen
  ✅ MenuItem in (tabs)/more/index.tsx         — universal entry
  ✅ CalculatorFab in (tabs)/plans/[id].tsx    — only on Plans
  ✅ i18n calculator namespace × 6 locales

NO new packages. Uses existing: zustand, AsyncStorage, expo-haptics, NativeWind.
```

---

## 2. Feature scope (Tier 1 + Tier 1.5 = 17 helpers)

Two surfaces:

**A. Smart expression input** — single text input that parses mixed units:
```
Input:   5'3 1/4 + 2'7 1/2
Output:  7'-10 3/4"           ← imperial (snap to chosen precision)
         94.75 in              ← decimal inches
         2.4067 m              ← metric
         240.67 cm
         2406.65 mm

Input:   5'3 1/4" * 8'2 1/2"
Output:  43.108 sqft
         4.005 sqm
```

**B. Helpers (bottom sheet grid with search)** — 17 mini-forms:

| # | Helper | Inputs | Output |
|---|---|---|---|
| 1 | Area (rect / triangle / circle) | dims | sqft + sqm |
| 2 | Volume | L × W × H | cu ft + L |
| 3 | Linear feet | up to 6 sides | perimeter |
| 4 | Slope / pitch | rise + run | ° + % |
| 5 | Pythagorean / diagonal | a + b | c (out-of-square check) |
| 6 | Direct converter | value + from-unit | all other units |
| 7 | Tile order | sqft + box coverage + waste% | boxes |
| 8 | **Grout** (sanded / unsanded / **epoxy**) | sqft + tile size + joint w/d + bag size | bags + lbs |
| 9 | **Thinset** (standard / modified / **epoxy**) | sqft + trowel notch + bag size | bags |
| 10 | Sealer / waterproofing | sqft + cov/gal + coats | gallons |
| 11 | Self-leveler | sqft + depth | bags |
| 12 | Backer board | sqft + sheet size (3'×5' / 4'×8') | sheets |
| 13 | Caulk for movement joints | linear ft + joint w/d + tube oz | tubes |
| 14 | Shower pan slope | radius to drain + slope (¼"/ft default) | mud bed depth at perimeter |
| 15 | Uncoupling membrane | sqft + roll size + 2" overlap | rolls |
| 16 | Stair tile | # steps + tread + riser + nosing | total sqft + linear ft |
| 17 | Hours between times | start + end (+ break) | decimal hours |

Defaults: tile waste 10%, grout waste 15%, thinset waste 10%, sealer waste 10%, all editable.

---

## 3. Architecture — pure logic separated from UI

The whole point of separating `utils/` and `types/` from `components/` is so the **same files can be `cp`'d into Takeoff Web with zero changes**. Anything that imports `react-native` lives in `components/` or `hooks/` only.

```
src/features/calculator/
├── types/
│   ├── units.ts          ← BaseUnit = mm (integer), UnitDef table, conversion factors
│   ├── schemas.ts        ← zod: HistoryEntry, MaterialResult, HelperInput
│   └── materials.ts      ← MaterialPreset types (Grout/Thinset/Sealer/Leveler)
├── utils/                ← PURE TS — no RN imports — copy to Takeoff verbatim
│   ├── tokenize.ts       ← string → Token[]  (numbers, fractions, units, ops)
│   ├── parse.ts          ← Token[] → AST → number (mm)  (shunting-yard)
│   ├── format.ts         ← mm → "5'-3 1/4"" / "2.4067 m"  (snap to precision)
│   └── coverage.ts       ← material formulas (grout, thinset, sealer, ...)
├── hooks/                ← React hooks (Track-only, Takeoff has its own)
│   ├── useCalculator.ts  ← zustand: expression, result, error
│   └── useHistory.ts     ← AsyncStorage-backed last-10
├── components/           ← Track UI (NativeWind, Pressable, Ionicons)
│   ├── Display.tsx
│   ├── Keypad.tsx
│   ├── UnitToggle.tsx
│   ├── HistoryList.tsx
│   ├── HelperSheet.tsx           ← bottom sheet w/ search + 17-tile grid
│   ├── shared/
│   │   ├── HelperShell.tsx       ← title + close + scrollable body
│   │   ├── NumberField.tsx       ← labeled numeric input
│   │   ├── ChipRow.tsx           ← 2-4 chip selector (sanded/unsanded/epoxy)
│   │   └── ResultCard.tsx        ← big number + label + tap-to-copy
│   └── helpers/
│       ├── AreaHelper.tsx
│       ├── VolumeHelper.tsx
│       ├── LinearFtHelper.tsx
│       ├── SlopeHelper.tsx
│       ├── PythagoreanHelper.tsx
│       ├── ConverterHelper.tsx
│       ├── TileOrderHelper.tsx
│       ├── GroutHelper.tsx
│       ├── ThinsetHelper.tsx
│       ├── SealerHelper.tsx
│       ├── LevelerHelper.tsx
│       ├── BackerBoardHelper.tsx
│       ├── CaulkHelper.tsx
│       ├── ShowerPanHelper.tsx
│       ├── UncouplingHelper.tsx
│       ├── StairTileHelper.tsx
│       └── HoursBetweenHelper.tsx
└── CalculatorFab.tsx     ← floating button (only mounted in plans/[id].tsx)
```

Route: `src/app/(tabs)/more/calculator.tsx`

---

## 4. Math: integer mm as the base unit

All internal math uses **integer millimeters**. Avoids float drift on common construction values like `1/16"`.

```
1 inch       = 25.4 mm exact (then × 1000 = µm if we ever need sub-mm precision)
1 foot       = 304.8 mm
1 yard       = 914.4 mm
1 cm         = 10 mm
1 meter      = 1000 mm
```

For sqft / sqm / cu ft etc. we keep float (no point in micro-mm² for an area calc), but length math is always mm.

Imperial fraction snap: convert decimal inches to nearest 1/N (where N = chosen precision: 2, 4, 8, 16, 32). Display as `whole + fraction` with the fraction reduced.

---

## 5. Material formulas (what `coverage.ts` exports)

Each function returns `{ value, unit, formula }` so the UI can display "result + how we got it" for transparency.

### Grout — cementitious (sanded / unsanded)
```
volume_per_sqft (in³) = 144 × (tile_W + tile_L) / (tile_W × tile_L) × joint_W × joint_D

bags = sqft × volume_per_sqft / bag_volume_in³ × (1 + waste)
```

`bag_volume_in³` is derived from bag weight + density:
- Sanded grout density ≈ 110 lb/ft³ → 25 lb bag ≈ 392 in³
- Unsanded grout density ≈ 100 lb/ft³ → 10 lb bag ≈ 173 in³

### Grout — epoxy (different beast)
```
volume_per_sqft (in³) = same formula

bags = sqft × volume_per_sqft / bag_volume_in³ × (1 + waste)
```

But:
- Epoxy density ≈ 100 lb/ft³ (similar by volume)
- **Bags are 9-10 lb** (vs 25 for cementitious)
- Coverage way lower per unit weight; most published charts say ~50% of cementitious sqft per bag at same joint
- Default `bag_size_lb = 9` (Laticrete SpectraLOCK Pro Premium standard unit)

### Thinset — table lookup by trowel notch
```
THINSET_COVERAGE_BY_NOTCH = {
  "1/4_v":      90,   // sqft per 50 lb bag
  "1/4_square": 80,
  "3/8_square": 55,
  "1/2_square": 35,
  "3/4_square": 22,
}

bags = sqft / coverage × (1 + waste) × (bag_size_lb / 50)
```

For epoxy thinset: multiply coverage by 0.6 (industry rule of thumb — epoxy spreads thicker, covers less).

### Sealer / waterproofing
```
gallons = sqft × coats / coverage_per_gal × (1 + waste)
```
Default coverage 100 sqft/gal (RedGard / Hydroban typical for first coat).

### Self-leveler
```
volume_ft³ = sqft × (depth_inches / 12)
bags = volume_ft³ × density_lb_ft³ / bag_size_lb × (1 + waste)
```
Default density 125 lb/ft³, bag 50 lb.

### Backer board
```
sheets = ceil(sqft / sheet_sqft) × (1 + waste)
```
3'×5' = 15 sqft. 4'×8' = 32 sqft.

### Caulk for movement joints
```
joint_volume_in³ = linear_ft × 12 × joint_W × joint_D
tubes = joint_volume_in³ / tube_volume_in³ × (1 + waste)
```
10 oz tube ≈ 18 in³.

### Shower pan slope
```
mud_bed_depth_at_perimeter = drain_depth + radius_ft × slope_in_per_ft
```
Default slope ¼" per foot (TCNA standard).

### Uncoupling membrane
```
effective_coverage = roll_sqft × (1 - 2 × overlap_in / roll_width_in)
rolls = ceil(sqft / effective_coverage × (1 + waste))
```
Schluter Ditra full roll = 175 sqft (3'3" × 53'9"). Standard 2" overlap.

### Stair tile
```
total_sqft  = steps × (tread_W × tread_D + riser_W × riser_H) / 144
linear_ft   = steps × nosing_W / 12
```

### Hours between times
```
hours = (end - start - break) / 3600
```
Pure arithmetic; output in decimal hours (not HH:MM).

---

## 6. UX rules (per `CLAUDE.md` field-first)

- Numpad keys ≥ 64dp, dark theme background `#0F172A`, brand `#F97316` for `=`
- Haptic on every keypad tap (existing `@/shared/lib/haptics`)
- 5-unit result display — each row tappable to copy to clipboard with toast confirmation
- Precision toggle visible at all times (`1/2 · 1/4 · 1/8 · 1/16 · 1/32`)
- History persisted across app restarts via AsyncStorage (key: `@calculator/history`)
- Helper sheet opens as bottom modal with search bar at top — 17 helpers without search would be a wall of icons; search filters as you type
- Each helper screen has the result CARD pinned to top so it's always visible while editing inputs
- "Save to area" / "Attach to deficiency" buttons appear in helper footer when `activeProject` is set

---

## 7. Plans tab FAB

Mounted in `src/app/(tabs)/plans/[id].tsx` — NOT global. Per pilot scope: only on Plans because that's where dimensions are being read off PDFs and immediate math is needed.

```
plans/[id].tsx
└── ...existing PdfViewer + overlays...
    └── <CalculatorFab />        ← positioned bottom-left, above existing pin-add FAB
```

`CalculatorFab` renders a `Modal` (not a route) so the user keeps their place on the plan when they close it. No deep-link, no expo-router push.

---

## 8. i18n (6 locales)

New top-level namespace `calculator` in `src/shared/lib/i18n/locales/{en,es,fr,pt,it,de}.json`:

```json
"calculator": {
  "title": "Calculator",
  "result": "Result",
  "history": "History",
  "tools": "Tools",
  "search_helpers": "Search helpers",
  "precision": "Precision",
  "copied": "Copied",
  "expression_error": "Can't parse expression",
  "save_to_area": "Save to area",
  "attach_to_deficiency": "Attach to deficiency",
  "units": {
    "feet": "ft", "inches": "in", "yards": "yd",
    "millimeters": "mm", "centimeters": "cm", "meters": "m",
    "sqft": "sq ft", "sqm": "sq m", "cuft": "cu ft", "liters": "L",
    "bags": "bags", "tubes": "tubes", "sheets": "sheets",
    "rolls": "rolls", "gallons": "gal", "lbs": "lb",
    "degrees": "°", "percent": "%", "hours": "hrs"
  },
  "helpers": {
    "area": "Area", "volume": "Volume", "linear_ft": "Linear feet",
    "slope": "Slope / pitch", "pythagorean": "Diagonal",
    "converter": "Converter", "tile_order": "Tile order",
    "grout": "Grout", "thinset": "Thinset", "sealer": "Sealer",
    "leveler": "Self-leveler", "backer_board": "Backer board",
    "caulk": "Caulk", "shower_pan": "Shower pan slope",
    "uncoupling": "Uncoupling membrane", "stair_tile": "Stair tile",
    "hours_between": "Hours between"
  },
  "fields": {
    "sqft": "Square feet", "tile_width": "Tile width",
    "tile_length": "Tile length", "joint_width": "Joint width",
    "joint_depth": "Joint depth", "bag_size": "Bag size (lb)",
    "trowel_notch": "Trowel notch", "coverage_per_gal": "Coverage / gal",
    "coats": "Coats", "depth": "Depth", "sheet_size": "Sheet size",
    "linear_ft": "Linear feet", "tube_size": "Tube size (oz)",
    "slope": "Slope (\" per ft)", "drain_depth": "Drain depth",
    "radius_to_drain": "Radius to drain (ft)",
    "roll_width": "Roll width", "roll_length": "Roll length",
    "overlap": "Overlap (in)", "steps": "Number of steps",
    "tread_width": "Tread width", "tread_depth": "Tread depth",
    "riser_height": "Riser height", "nosing_width": "Nosing width",
    "start_time": "Start", "end_time": "End", "break_minutes": "Break (min)",
    "waste_percent": "Waste %"
  },
  "grout_types": { "sanded": "Sanded", "unsanded": "Unsanded", "epoxy": "Epoxy" },
  "thinset_types": { "standard": "Standard", "modified": "Modified", "epoxy": "Epoxy" },
  "shapes": { "rectangle": "Rectangle", "triangle": "Triangle", "circle": "Circle" }
}
```

ES translation gets the same shape with Spanish strings. FR/PT/IT/DE — translated. Unit symbols (`ft`, `mm`, `°`, `%`) usually stay in source language; localized only where convention differs.

---

## 9. Track integrations (Phase 3)

When `useProjectStore.activeProject` is set, helper footers show two buttons:

**Save to area** — opens area picker (project's `production_areas` list), writes a `field_messages` row:
```
content: "Calc: 5'-3 1/4" + 2'-7 1/2" = 7'-10 3/4"
         (94.75 in / 2.4067 m)"
context: "calculator"
```
Foreman + supervisor can read these on the area screen later.

**Attach to deficiency** — only enabled if user is on a deficiency screen (deep link). Pre-fills `deficiencies.description` with the calc result and pops back to the deficiency form.

Phase 3 is **shipped after pilot validates Phases 1+2**. If Jantile doesn't ask for it, it doesn't ship.

---

## 10. Build order

1. Sprint docs (this file + `SPRINT_TAKEOFF_CALCULATOR.md`)
2. Pure logic: `types/`, `utils/` (tokenize → parse → format → coverage)
3. Track UI shell: `Display`, `Keypad`, `UnitToggle`, `HistoryList`
4. Track helpers: shared (`HelperShell`, `NumberField`, `ChipRow`, `ResultCard`) → 17 helpers
5. Calculator screen + zustand store + history hook
6. Track wiring: `MenuItem`, `CalculatorFab` on Plans, i18n × 6
7. Takeoff: copy `utils/` + `types/`, build Web UI, wire `TopHeaderClient`, i18n × 6

---

## 11. What's intentionally NOT in this sprint

- **Cost / dollar amounts.** Per `CLAUDE.md` permission matrix, foreman never sees costs. Calculator gives quantities only.
- **Brand database.** Industry formulas are stable; brand coverage charts go out of date and vary by region. Defaults match well-known products but everything's editable.
- **Voice input.** Picovoice is reserved for the future AI agent, not this calculator.
- **Cloud sync of history.** History is per-device. AsyncStorage only.
- **Floating button on screens other than Plans.** Pilot scope. Easy to add later if requested.
- **Phase 3 Track integrations.** Built only if pilot uses Phases 1+2 and asks for them.

---

## 12. Cross-repo sync rule

The files under `src/features/calculator/utils/` and `src/features/calculator/types/` MUST stay byte-identical between Track and Takeoff. If you edit one, copy to the other in the same commit. Document this in both repos' `CLAUDE.md`.

A future sprint may extract to a private NPM package (`@notchfield/calculator`); for now, manual sync.
