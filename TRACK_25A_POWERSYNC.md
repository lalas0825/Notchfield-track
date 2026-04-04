# TRACK SPRINT 25A — PowerSync Schema Update
# MODEL: /model claude-haiku-4-5
# Repo: notchfield-track

---

## Context
Takeoff Sprint 23 created 3 new tables in the shared Supabase.
Track needs to sync them via PowerSync.

## 1. Add to PowerSync schema (schema.ts)

### New tables:

```typescript
room_types: new Table({
  organization_id: column.text,
  project_id: column.text,
  name: column.text,
  description: column.text,
  template_id: column.text,
  created_at: column.text,
  updated_at: column.text,
}),

room_type_surfaces: new Table({
  room_type_id: column.text,
  organization_id: column.text,
  name: column.text,
  surface_type: column.text,
  material_code: column.text,
  material_name: column.text,
  default_qty: column.real,
  unit: column.text,
  sort_order: column.integer,
  created_at: column.text,
}),

phase_progress: new Table({
  organization_id: column.text,
  project_id: column.text,
  area_id: column.text,
  phase_id: column.text,
  status: column.text,
  target_sf: column.real,
  completed_sf: column.real,
  started_at: column.text,
  completed_at: column.text,
  blocked_reason: column.text,
  verified_at: column.text,
  verified_by: column.text,
  completed_by: column.text,
  created_at: column.text,
  updated_at: column.text,
}),
```

### Add columns to existing tables:

production_areas — add:
  room_type_id: column.text,
  acceptance_status: column.text,
  start_date: column.text,
  target_end_date: column.text,

production_template_phases — add:
  applies_to_surface_types: column.text,
  is_binary: column.integer,
  binary_weight: column.real,

field_photos — add:
  phase_id: column.text,

## 2. Update sync-rules.yaml

Add under by_org.data:

```yaml
- SELECT * FROM room_types WHERE organization_id = bucket.organization_id
- SELECT * FROM room_type_surfaces WHERE organization_id = bucket.organization_id
- SELECT * FROM phase_progress WHERE organization_id = bucket.organization_id
```

## 3. Verify

npx tsc --noEmit
