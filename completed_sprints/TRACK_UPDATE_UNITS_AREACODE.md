# TRACK UPDATE: Units + Area Code + Scope Import Alignment
# Pega en Claude Code en el repo de TRACK.
# Context: Takeoff added units table, area_code, description, area_type on production_areas.
# Track needs to sync these new columns and update UI to display them.

---

Lee CLAUDE_TRACK.md primero. Takeoff just added these DB changes to the shared Supabase:

1. New `units` table (optional grouping — residential floors have units, lobby/mechanical don't)
2. `production_areas` got new columns: unit_id (NULLABLE), area_code, description, area_type, parent_group_id
3. `production_area_objects` got new columns: material_code, quantity_sf

Track needs to sync these and update the UI. Execute these 4 changes:

---

## 1. PowerSync Schema — Add units table + new columns

**File:** `src/shared/lib/powersync/schema.ts`

Add the `units` table:
```typescript
units: new Table({
  organization_id: column.text,
  project_id: column.text,
  floor: column.text,
  name: column.text,           // "24A", "24B", "PH1"
  unit_type: column.text,      // 'standard', 'studio', 'luxury', 'office', 'common', 'custom'
  sort_order: column.integer,
}),
```

Add new columns to `production_areas`:
```typescript
// Add these to the existing production_areas table definition:
unit_id: column.text,          // NULLABLE — NULL for floor-level areas (lobby, mech), UUID for unit areas
area_code: column.text,        // from building plans, manual entry, NOT unique
description: column.text,      // "Master Bath - Marble, double vanity"
area_type: column.text,        // 'individual' | 'group' | 'group_exploded'
parent_group_id: column.text,  // link back to scope sheet group
```

Add new columns to `production_area_objects`:
```typescript
// Add these to the existing production_area_objects table definition:
material_code: column.text,    // "TL-04", "SC-03", etc.
quantity_sf: column.real,      // sqft for this surface in this specific area
```

---

## 2. PowerSync Sync Rules — Add units + filter area_type

**File:** `powersync/sync-rules.yaml`

Add under the `by_org.data` section:
```yaml
# Units table (new — for residential floor grouping)
- SELECT * FROM units WHERE organization_id = bucket.organization_id

# IMPORTANT: Update production_areas rule to only sync individual areas
# Foreman should NEVER see group rows like "(67) WASHROOMS"
# Change from:
#   SELECT * FROM production_areas WHERE organization_id = bucket.organization_id
# To:
- SELECT * FROM production_areas WHERE organization_id = bucket.organization_id AND (area_type = 'individual' OR area_type IS NULL)
```

The `OR area_type IS NULL` handles existing areas that don't have the column set yet.

Deploy sync rules after editing (PowerSync dashboard or CLI).

---

## 3. ReadyBoard Mobile — Group by Unit or Floor

**File:** `src/features/production/components/ReadyBoard.tsx`

Currently the ReadyBoard groups areas by floor only. Update to support the 3 patterns:

```
Pattern A — Residential floor with units:
  ▼ Floor 24
    ▼ Unit 24A
        Master Bath  🟡 83%
        Hall Bath    ⬜ 0%
    ▼ Unit 24B
        Master Bath  🟡 45%

Pattern B — Lobby (no units):
  ▼ Floor 1
      Main Lobby     ✅ 100%
      Mailroom       🟡 60%
      Restroom M     🟡 45%

Pattern C — Mixed floor:
  ▼ Floor 2
    ▼ Gym Complex
        Main Gym     🟡 70%
        Locker Room  ⬜ 0%
    ── Floor areas ──
        Corridor     ✅ 100%
        Kids Room    🟡 50%
```

### Create a grouping hook:

**File:** `src/features/production/hooks/useGroupedAreas.ts`

```typescript
import { usePowerSync } from '@powersync/react-native';

interface Unit {
  id: string;
  name: string;
  floor: string;
  unit_type: string;
}

interface GroupedFloor {
  floor: string;
  units: { unit: Unit; areas: ProductionArea[] }[];
  floorAreas: ProductionArea[];  // areas with unit_id = NULL
}

export function useGroupedAreas(projectId: string) {
  const powerSync = usePowerSync();
  const [grouped, setGrouped] = useState<GroupedFloor[]>([]);

  useEffect(() => {
    async function load() {
      // Get units for this project
      const units = await powerSync.getAll<Unit>(
        'SELECT * FROM units WHERE project_id = ? ORDER BY floor, sort_order, name',
        [projectId]
      );

      // Get all individual areas
      const areas = await powerSync.getAll<ProductionArea>(
        'SELECT * FROM production_areas WHERE project_id = ? AND (area_type = ? OR area_type IS NULL) ORDER BY floor, label',
        [projectId, 'individual']
      );

      // Group by floor
      const floorMap = new Map<string, GroupedFloor>();

      for (const area of areas) {
        const floor = area.floor || 'Unassigned';
        if (!floorMap.has(floor)) {
          floorMap.set(floor, { floor, units: [], floorAreas: [] });
        }
        const floorGroup = floorMap.get(floor)!;

        if (area.unit_id) {
          // Find the unit
          const unit = units.find(u => u.id === area.unit_id);
          if (unit) {
            let unitGroup = floorGroup.units.find(ug => ug.unit.id === unit.id);
            if (!unitGroup) {
              unitGroup = { unit, areas: [] };
              floorGroup.units.push(unitGroup);
            }
            unitGroup.areas.push(area);
          } else {
            floorGroup.floorAreas.push(area);
          }
        } else {
          // No unit — floor-level area
          floorGroup.floorAreas.push(area);
        }
      }

      setGrouped(Array.from(floorMap.values()));
    }
    load();
  }, [projectId]);

  return grouped;
}
```

### Update ReadyBoard.tsx to use grouping:

In the ReadyBoard component, replace the current flat floor grouping with:

```tsx
const grouped = useGroupedAreas(activeProject.id);

// Render:
{grouped.map(floorGroup => (
  <View key={floorGroup.floor}>
    {/* Floor header */}
    <FloorHeader floor={floorGroup.floor} ... />

    {/* Units (collapsible) */}
    {floorGroup.units.map(unitGroup => (
      <View key={unitGroup.unit.id}>
        <UnitHeader unit={unitGroup.unit} areaCount={unitGroup.areas.length} />
        {unitGroup.areas.map(area => (
          <AreaListItem key={area.id} area={area} />
        ))}
      </View>
    ))}

    {/* Floor-level areas (no unit) */}
    {floorGroup.floorAreas.length > 0 && floorGroup.units.length > 0 && (
      <Text style={styles.floorAreasLabel}>Floor areas</Text>
    )}
    {floorGroup.floorAreas.map(area => (
      <AreaListItem key={area.id} area={area} />
    ))}
  </View>
))}
```

### UnitHeader component:

```tsx
const UnitHeader = ({ unit, areaCount, expanded, onToggle }) => (
  <Pressable onPress={onToggle} style={{
    flexDirection: 'row', alignItems: 'center', 
    paddingHorizontal: 20, paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
  }}>
    <Text style={{ color: '#64748B', fontSize: 12, marginRight: 6 }}>
      {expanded ? '▼' : '▶'}
    </Text>
    <Text style={{ color: '#94A3B8', fontSize: 14, fontWeight: '600' }}>
      Unit {unit.name}
    </Text>
    <Text style={{ color: '#475569', fontSize: 12, marginLeft: 8 }}>
      {areaCount} areas
    </Text>
  </Pressable>
);
```

---

## 4. Area Code Badge — Show in area items and detail

### AreaListItem — add area_code badge

In the ReadyBoard area list items and any place that shows an area name, add the area_code:

```tsx
<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
  {area.area_code && (
    <Text style={{
      fontFamily: 'monospace',
      fontSize: 11,
      color: '#475569',
      backgroundColor: 'rgba(255,255,255,0.05)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    }}>
      {area.area_code}
    </Text>
  )}
  <Text style={{ fontSize: 16, fontWeight: '700', color: '#F8FAFC' }}>
    {area.label}
  </Text>
</View>
{area.description && (
  <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
    {area.description}
  </Text>
)}
```

### AreaDetail header — add area_code prominently

In `app/(tabs)/board/[areaId].tsx`, update the header:

```tsx
<View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
  {/* Floor + Unit context */}
  <Text style={{ fontSize: 12, color: '#64748B' }}>
    {area.floor}{area.unit_id ? ` · Unit ${unitName}` : ''}
  </Text>
  
  {/* Area code + name */}
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
    {area.area_code && (
      <Text style={{
        fontFamily: 'monospace', fontSize: 13,
        color: '#60A5FA',
        backgroundColor: 'rgba(96,165,250,0.1)',
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
      }}>
        {area.area_code}
      </Text>
    )}
    <Text style={{ fontSize: 20, fontWeight: '700', color: '#F8FAFC' }}>
      {area.label}
    </Text>
  </View>
  
  {area.description && (
    <Text style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
      {area.description}
    </Text>
  )}
</View>
```

### Also show area_code in:
- Daily report area checkboxes (so foreman confirms correct area)
- Report confirmation screen ("✓ Saved" → show area_code)
- Punch item creation (show which area the punch is for)

---

## VERIFICATION

1. Run `npx tsc --noEmit` — must pass
2. Check PowerSync schema has `units` table + new columns on production_areas + production_area_objects
3. Deploy sync rules to PowerSync dashboard
4. Test with a project that has:
   - Floor 1 with areas but NO units (lobby) → areas show directly under Floor 1
   - Floor 24 with Unit 24A + Unit 24B → areas grouped under unit headers
   - Mixed floor with both units and floor-level areas
5. Verify area_code shows as monospace badge where it exists, nothing where it doesn't
6. Verify foreman never sees "(67) WASHROOMS" group rows — only individual areas
