/**
 * PowerSync Schema for NotchField Track
 * ======================================
 * Mirrors the REAL Supabase tables from Notchfield Takeoff.
 *
 * Key conventions (matching Takeoff):
 *   - `organization_id` (not org_id)
 *   - `profiles` (not users)
 *   - `production_areas` (not areas)
 *   - RLS uses user_org_id() and user_role()
 *
 * All columns use SQLite types: TEXT, INTEGER, REAL.
 */

import { column, Schema, TableV2 } from '@powersync/react-native';

// ============================================================
// TABLES TRACK READS (from Takeoff — never written by Track)
// ============================================================

const projects = new TableV2({
  organization_id: column.text,
  name: column.text,
  address: column.text,
  status: column.text,
  created_by: column.text,
  created_at: column.text,
  updated_at: column.text,
  // Sprint PTP — emergency info + safety distribution (read-only from web)
  emergency_hospital_name: column.text,
  emergency_hospital_address: column.text,
  emergency_hospital_distance: column.text,
  emergency_assembly_point: column.text,
  emergency_first_aid_location: column.text,
  emergency_contact_name: column.text,
  emergency_contact_phone: column.text,
  safety_distribution_emails: column.text, // text[] serialized as JSON
});

const organizations = new TableV2({
  name: column.text,
  slug: column.text,
  plan: column.text,
  logo_url: column.text,
  unit_system: column.text,
  mechanic_daily_rate: column.integer,
  helper_daily_rate: column.integer,
  currency: column.text,
  created_at: column.text,
  // Sprint PTP — trades used as fallback when profile has no trade
  primary_trades: column.text, // text[] serialized as JSON
});

const profiles = new TableV2({
  organization_id: column.text,
  full_name: column.text,
  role: column.text,
  avatar_url: column.text,
  locale: column.text,
  is_active: column.integer, // boolean
  created_at: column.text,
  updated_at: column.text,
  // sst_card_number + sst_expires_at moved to workers (Sprint MANPOWER).
  // Reading them from profiles errors out in production.
});

const production_areas = new TableV2({
  project_id: column.text,
  organization_id: column.text,
  template_id: column.text,
  name: column.text,
  floor: column.text,
  zone: column.text,
  quantity: column.real,
  unit_type: column.text,
  status: column.text,
  classification_id: column.text,
  notes: column.text,
  unit_id: column.text,
  area_code: column.text,
  drawing_reference: column.text,
  description: column.text,
  area_type: column.text, // 'individual' | 'group' | 'group_exploded'
  parent_group_id: column.text,
  room_type_id: column.text,
  acceptance_status: column.text,
  start_date: column.text,
  target_end_date: column.text,
  started_at: column.text,
  completed_at: column.text,
  created_by: column.text,
  blocked_reason: column.text,
  blocked_at: column.text,
  blocked_resolved_at: column.text,
  blocked_by: column.text,
  created_at: column.text,
  updated_at: column.text,
});

const production_area_objects = new TableV2({
  area_id: column.text,
  takeoff_object_id: column.text,
  organization_id: column.text,
  material_code: column.text,
  name: column.text,                  // surface position: "floor" | "wall" | "base" | "saddle" | etc
  surface_type: column.text,
  quantity_sf: column.real,           // DEPRECATED — kept for SQLite migration compatibility (was Sprint 41G)
  total_quantity_sf: column.real,     // SF for progress calc (real DB column, Sprint 43A)
  quantity_per_unit_sf: column.real,
  unit: column.text,
  created_at: column.text,
  // Sprint 41G — surface progress tracking
  status: column.text, // 'not_started' | 'in_progress' | 'completed' | 'blocked'
  started_at: column.text,
  completed_at: column.text,
  completed_by: column.text,
  blocked_reason: column.text,
  blocked_at: column.text,
  blocked_by: column.text,
  notes: column.text,
});

const production_templates = new TableV2({
  organization_id: column.text,
  name: column.text,
  created_at: column.text,
});

const production_template_phases = new TableV2({
  template_id: column.text,
  organization_id: column.text,
  name: column.text,
  sequence: column.integer,
  description: column.text,
  estimated_duration_hours: column.real,
  requires_inspection: column.integer, // boolean (gate)
  crew_size: column.integer,
  crew_role: column.text,
  is_optional: column.integer, // boolean
  wait_hours_after: column.real,
  depends_on_phase: column.integer,
  setting_material: column.text,
  setting_coverage: column.real,
  applies_to_surface_types: column.text, // JSON string array
  is_binary: column.integer, // boolean
  binary_weight: column.real,
  created_at: column.text,
  updated_at: column.text,
});

const production_phase_progress = new TableV2({
  area_id: column.text,
  phase_id: column.text,
  organization_id: column.text,
  status: column.text,
  percent_complete: column.integer,
  started_at: column.text,
  completed_at: column.text,
  completed_by: column.text,
  inspector_id: column.text,
  inspection_result: column.text,
  notes: column.text,
  photo_urls: column.text, // ARRAY stored as text
  created_at: column.text,
  updated_at: column.text,
});

// T2 tables (Track-owned)
const daily_reports = new TableV2({
  organization_id: column.text,
  project_id: column.text,
  foreman_id: column.text,
  report_date: column.text,
  status: column.text,
  areas_worked: column.text, // JSONB
  progress_summary: column.text,
  total_man_hours: column.real,
  photos_count: column.integer,
  submitted_at: column.text,
  created_at: column.text,
  updated_at: column.text,
});

const field_messages = new TableV2({
  organization_id: column.text,
  project_id: column.text,
  area_id: column.text,
  sender_id: column.text,
  message_type: column.text,
  message: column.text,
  photos: column.text, // JSONB
  created_at: column.text,
});

const punch_items = new TableV2({
  organization_id: column.text,
  project_id: column.text,
  area_id: column.text,
  title: column.text,
  description: column.text,
  priority: column.text,
  status: column.text,
  photos: column.text, // JSONB
  resolution_photos: column.text, // JSONB
  assigned_to: column.text,
  created_by: column.text,
  resolved_at: column.text,
  verified_at: column.text,
  rejected_reason: column.text,
  plan_x: column.real,
  plan_y: column.real,
  drawing_id: column.text,
  created_at: column.text,
  updated_at: column.text,
});

const classifications = new TableV2({
  organization_id: column.text,
  code: column.text,
  name: column.text,
  unit: column.text,
  color: column.text,
  created_at: column.text,
});

// Drawing tables (exist in Takeoff)
const drawing_sets = new TableV2({
  project_id: column.text,
  organization_id: column.text,
  name: column.text,
  file_path: column.text,
  page_count: column.integer,
  created_by: column.text,
  content_hash: column.text,
  created_at: column.text,
});

const drawings = new TableV2({
  drawing_set_id: column.text,
  project_id: column.text,
  organization_id: column.text,
  page_number: column.integer,
  label: column.text,
  scale_factor: column.real,
  scale_line_pixels: column.real,
  scale_line_real: column.real,
  scale_unit: column.text,
  created_at: column.text,
});

const drawing_revisions = new TableV2({
  drawing_id: column.text,
  organization_id: column.text,
  revision_code: column.text,
  file_url: column.text,
  issued_at: column.text,
  description: column.text,
  uploaded_by: column.text,
  created_at: column.text,
});

// PM-side drawings (the table Takeoff's PM → Drawings tab writes to).
// Distinct from the `drawings` + `drawing_sets` pair above which backs
// the Estimator's takeoff polygons. Field work reads from here. Columns
// verified against information_schema on 2026-04-21 — do not add fields
// without re-checking the DB, per the PowerSync-column-missing rule.
const drawing_register = new TableV2({
  project_id: column.text,
  organization_id: column.text,
  number: column.text,              // sheet number, e.g. "SB-12"
  title: column.text,                // sheet title, e.g. "Page 2"
  discipline: column.text,           // "architectural" / "specialty" / ...
  status: column.text,               // "draft" | "current" | ...
  current_revision: column.text,     // e.g. "1"
  set_name: column.text,             // parent set label
  file_url: column.text,             // full public URL (bucket: documents)
  thumbnail_url: column.text,        // 200px preview URL
  revision_date: column.text,
  page_number: column.integer,
  pin_count: column.integer,
  tags: column.text,                 // jsonb serialized as JSON string
  rotation: column.integer,
  created_by: column.text,
  created_at: column.text,
  updated_at: column.text,
});

// Sprint 47B — Hyperlinks between sheets (detected from PDF refs)
// Columns match real DB (verified via information_schema).
const drawing_hyperlinks = new TableV2({
  organization_id: column.text,
  source_drawing_id: column.text,
  target_sheet_number: column.text,
  target_drawing_id: column.text,      // nullable — may be resolved lazily
  position_x: column.real,              // PDF-point coords
  position_y: column.real,
  width: column.real,
  height: column.real,
  reference_text: column.text,          // e.g. "See A-501/3"
  detection_type: column.text,          // 'regex' | 'manual' | ...
  created_at: column.text,
});

// Sprint 47B — Pin annotations (notes, photos, RFI links)
const drawing_pins = new TableV2({
  organization_id: column.text,
  drawing_id: column.text,
  project_id: column.text,
  pin_type: column.text,                // 'note' | 'photo' | 'rfi'
  position_x: column.real,
  position_y: column.real,
  title: column.text,
  description: column.text,
  color: column.text,                   // hex like '#F59E0B'
  linked_rfi_id: column.text,
  photos: column.text,                  // JSONB as text (array of storage paths)
  created_by: column.text,
  resolved: column.integer,             // boolean 0/1
  resolved_at: column.text,
  created_at: column.text,
  updated_at: column.text,
});

const units = new TableV2({
  organization_id: column.text,
  project_id: column.text,
  floor: column.text,
  name: column.text,
  unit_type: column.text,
  sort_order: column.integer,
  created_at: column.text,
});

const takeoff_objects = new TableV2({
  drawing_id: column.text,
  classification_id: column.text,
  organization_id: column.text,
  geometry: column.text, // JSON
  quantity: column.real,
  unit: column.text,
  label: column.text,
  created_at: column.text,
});

// Sprint MANPOWER — workers (field crew HR, Takeoff PM curates)
// Foremen are linked via workers.profile_id. Walk-in workers have profile_id NULL.
const workers = new TableV2({
  organization_id: column.text,
  profile_id: column.text,
  first_name: column.text,
  last_name: column.text,
  phone: column.text,
  email: column.text,
  date_of_birth: column.text,
  photo_url: column.text,
  hire_date: column.text,
  active: column.integer, // boolean
  trade: column.text,
  trade_level: column.text, // 'mechanic' | 'helper' | 'apprentice' | 'foreman' | 'other'
  years_experience: column.integer,
  daily_rate_cents: column.integer,
  // Certs — NYC Local Law 196 compliance
  sst_card_number: column.text,
  sst_expires_at: column.text,
  osha_10_cert_number: column.text,
  osha_10_expires_at: column.text,
  osha_30_cert_number: column.text,
  osha_30_expires_at: column.text,
  swac_cert_number: column.text,
  swac_expires_at: column.text,
  silica_trained: column.integer, // boolean
  silica_trained_at: column.text,
  i9_verified: column.integer, // boolean
  i9_verified_at: column.text,
  // ICE
  emergency_contact_name: column.text,
  emergency_contact_phone: column.text,
  emergency_contact_relation: column.text,
  notes: column.text,
  created_by: column.text,
  created_at: column.text,
  updated_at: column.text,
});

// Sprint MANPOWER — project_workers (M:N assignment; supervisor writes, foreman reads)
const project_workers = new TableV2({
  organization_id: column.text,
  project_id: column.text,
  worker_id: column.text,
  assigned_at: column.text,
  assigned_by: column.text,
  removed_at: column.text,
  removed_by: column.text,
  active: column.integer, // boolean
  notes: column.text,
  created_at: column.text,
  updated_at: column.text,
});

// Sprint TOOLBOX — Toolbox library (3-tier: global/org/project, PM curates globals + org)
const toolbox_library = new TableV2({
  organization_id: column.text, // NULL for global topics
  project_id: column.text,      // NULL for org / global topics
  trade: column.text,           // text[] serialized as JSON
  title: column.text,
  title_es: column.text,
  slug: column.text,
  why_it_matters: column.text,
  why_it_matters_es: column.text,
  key_points: column.text,      // text[] → JSON
  key_points_es: column.text,   // text[] → JSON
  discussion_questions: column.text,    // text[] → JSON
  discussion_questions_es: column.text, // text[] → JSON
  osha_ref: column.text,
  category: column.text,
  tags: column.text,            // text[] → JSON
  season: column.text,          // text[] → JSON
  source: column.text,
  active: column.integer,       // boolean
  created_by: column.text,
  created_at: column.text,
  updated_at: column.text,
});

// Sprint TOOLBOX — PM weekly override ("force this topic this week")
const toolbox_schedule_overrides = new TableV2({
  organization_id: column.text,
  project_id: column.text,
  week_start_date: column.text, // ISO date (Monday of the week)
  topic_id: column.text,        // → toolbox_library.id
  set_by: column.text,
  reason: column.text,
  created_at: column.text,
  updated_at: column.text,
});

// Sprint PTP — JHA library (Takeoff PM curates; Track reads)
const jha_library = new TableV2({
  organization_id: column.text,
  project_id: column.text,     // nullable = org-wide task
  trade: column.text,
  category: column.text,
  task_name: column.text,
  task_description: column.text,
  typical_scenarios: column.text,
  hazards: column.text,        // jsonb — array of { name, osha_ref? }
  controls: column.text,       // jsonb — array of { name, category }
  ppe_required: column.text,   // text[] serialized as JSON
  notes: column.text,
  active: column.integer,      // boolean
  created_by: column.text,
  created_at: column.text,
  updated_at: column.text,
});

// Safety + work tickets (exist in Takeoff)
const safety_documents = new TableV2({
  project_id: column.text,
  organization_id: column.text,
  number: column.integer,
  doc_type: column.text, // 'jha' | 'ptp' | 'toolbox' | 'sign_off'
  title: column.text,
  content: column.text, // JSONB stored as text
  status: column.text,
  signatures: column.text, // JSONB
  created_by: column.text,
  created_at: column.text,
  updated_at: column.text,
});

const document_signoffs = new TableV2({
  document_type: column.text,
  document_id: column.text,
  organization_id: column.text,
  token: column.text,
  signer_name: column.text,
  signer_company: column.text,
  signer_email: column.text,
  signature_data: column.text, // JSONB
  signed_at: column.text,
  notes: column.text,
  status: column.text,
  expires_at: column.text,
  created_at: column.text,
});

const work_tickets = new TableV2({
  project_id: column.text,
  organization_id: column.text,
  number: column.integer,           // real column is `number` not `ticket_number`
  title: column.text,
  description: column.text,
  status: column.text,               // 'draft' | 'pending_signature' | 'signed' | 'declined'
  floor: column.text,
  area: column.text,
  photos: column.text,               // JSONB as text
  signed_at: column.text,
  created_by: column.text,
  signed_by_id: column.text,
  signature_url: column.text,
  related_drawing_id: column.text,
  related_rfi_id: column.text,
  // Sprint 43B — T&M fields
  service_date: column.text,
  work_description: column.text,
  trade: column.text,
  labor: column.text,                // JSONB array [{ name, class, reg_hrs, ot_hrs }]
  materials: column.text,            // JSONB array [{ description, qty, unit }]
  gc_notes: column.text,
  foreman_name: column.text,
  area_description: column.text,
  priority: column.text,             // 'normal' | 'urgent'
  signature_token: column.text,
  evidence_photos: column.text,       // JSONB — WorkTicketPhoto[]
  created_at: column.text,
  updated_at: column.text,
});

const document_signatures = new TableV2({
  organization_id: column.text,
  document_type: column.text,        // 'work_ticket' | 'ptp' | 'jha' | ...
  document_id: column.text,
  project_id: column.text,
  signer_name: column.text,
  signer_email: column.text,
  signer_role: column.text,
  signature_url: column.text,
  status: column.text,               // 'pending' | 'signed' | 'declined' | 'expired'
  token: column.text,
  content_hash: column.text,
  hash_algorithm: column.text,
  hashed_at: column.text,
  ip_address: column.text,
  user_agent: column.text,
  signed_at: column.text,
  declined_at: column.text,
  decline_reason: column.text,
  expires_at: column.text,
  created_at: column.text,
});

// ============================================================
// TABLES TRACK CREATES (T1-owned — created by migration)
// ============================================================

const crew_assignments = new TableV2({
  organization_id: column.text,
  project_id: column.text,
  area_id: column.text,
  worker_id: column.text,
  assigned_by: column.text,
  assigned_at: column.text,
  created_at: column.text,
});

const area_time_entries = new TableV2({
  organization_id: column.text,
  project_id: column.text,
  area_id: column.text,
  worker_id: column.text,
  worker_role: column.text, // 'mechanic' | 'helper'
  started_at: column.text,
  ended_at: column.text,
  hours: column.real, // GENERATED column
  assigned_by: column.text,
  created_at: column.text,
});

const gps_checkins = new TableV2({
  user_id: column.text,
  project_id: column.text,
  organization_id: column.text,
  type: column.text, // 'check_in' | 'check_out' | 'auto_in' | 'auto_out'
  gps_lat: column.real,
  gps_lng: column.real,
  accuracy_meters: column.real,
  device_id: column.text,
  created_at: column.text,
});

const gps_geofences = new TableV2({
  project_id: column.text,
  organization_id: column.text,
  center_lat: column.real,
  center_lng: column.real,
  radius_meters: column.real,
  name: column.text,
  is_active: column.integer, // boolean
  created_by: column.text,
  created_at: column.text,
  updated_at: column.text,
});

const field_photos = new TableV2({
  organization_id: column.text,
  project_id: column.text,
  area_id: column.text,
  object_id: column.text,
  phase_id: column.text,
  context_type: column.text, // 'progress' | 'qc' | 'blocked' | 'delivery' | 'safety' | 'general'
  caption: column.text,
  local_uri: column.text,
  remote_url: column.text,
  thumbnail_url: column.text,
  gps_lat: column.real,
  gps_lng: column.real,
  taken_by: column.text,
  taken_at: column.text,
  sync_status: column.text, // 'pending' | 'uploading' | 'uploaded' | 'failed'
  created_at: column.text,
});

const production_block_logs = new TableV2({
  organization_id: column.text,
  project_id: column.text,
  area_id: column.text,
  blocked_reason: column.text,
  blocked_at: column.text,
  resolved_at: column.text,
  reported_by: column.text,
  resolved_by: column.text,
  created_at: column.text,
});

const worker_certifications = new TableV2({
  organization_id: column.text,
  worker_id: column.text,
  cert_type: column.text,
  cert_number: column.text,
  issued_at: column.text,
  expires_at: column.text,
  issuing_authority: column.text,
  status: column.text, // 'active' | 'pending_renewal' | 'expired' | 'revoked'
  document_url: column.text,
  created_at: column.text,
  updated_at: column.text,
});

// T3 — Delivery tables
const delivery_tickets = new TableV2({
  organization_id: column.text,
  project_id: column.text,
  supplier_name: column.text,
  supplier_po: column.text,
  ticket_number: column.text,
  status: column.text,
  delivery_date: column.text,
  received_at: column.text,
  received_by: column.text,
  requested_by: column.text,
  shipping_method: column.text,
  priority: column.text,
  shipped_by: column.text,
  approved_at: column.text,
  shipped_at: column.text,
  delivery_time: column.text,
  has_shortages: column.integer, // boolean 0/1
  ticket_photo_url: column.text,
  notes: column.text,
  created_by: column.text,
  created_at: column.text,
  updated_at: column.text,
});

const delivery_ticket_item_checks = new TableV2({
  organization_id: column.text,
  ticket_id: column.text,
  ticket_item_id: column.text,
  shipment_id: column.text,
  shipment_item_id: column.text,
  check_status: column.text, // 'pending' | 'verified' | 'short' | 'damaged' | 'unavailable'
  quantity_confirmed: column.real,
  quantity_short: column.real,
  shortage_reason: column.text,
  notes: column.text,
  checked_by: column.text,
  checked_at: column.text,
  created_at: column.text,
  updated_at: column.text,
});

// Sprint 40C — Track role enforcement
const project_assignments = new TableV2({
  organization_id: column.text,
  user_id: column.text,
  project_id: column.text,
  assigned_role: column.text,
  assigned_by: column.text,
  assigned_at: column.text,
  is_active: column.integer, // boolean 0/1
  notes: column.text,
  created_at: column.text,
  updated_at: column.text,
});

// Sprint 39B — Shipments
const delivery_shipments = new TableV2({
  organization_id: column.text,
  ticket_id: column.text,
  shipment_number: column.integer,
  status: column.text, // 'pending' | 'preparing' | 'shipped' | 'delivered' | 'confirmed'
  ship_date: column.text,
  delivery_time: column.text,
  shipped_at: column.text,
  delivered_at: column.text,
  notes: column.text,
  created_at: column.text,
  updated_at: column.text,
});

const delivery_shipment_items = new TableV2({
  organization_id: column.text,
  shipment_id: column.text,
  ticket_item_id: column.text,
  quantity_shipped: column.real,
  created_at: column.text,
  updated_at: column.text,
});

const delivery_ticket_items = new TableV2({
  organization_id: column.text,
  ticket_id: column.text,
  area_id: column.text,
  material_name: column.text,
  material_code: column.text,
  quantity_ordered: column.real,
  quantity_received: column.real,
  unit: column.text,
  receipt_status: column.text, // 'pending' | 'received' | 'short' | 'damaged' | 'rejected'
  receipt_notes: column.text,
  receipt_photos: column.text, // ARRAY as text
  created_at: column.text,
  updated_at: column.text,
});

const material_consumption = new TableV2({
  organization_id: column.text,
  project_id: column.text,
  area_id: column.text,
  material_name: column.text,
  material_code: column.text,
  unit: column.text,
  target_qty: column.real,
  delivered_qty: column.real,
  installed_qty: column.real,
  surplus_qty: column.real,
  waste_pct: column.real,
  created_at: column.text,
  updated_at: column.text,
});

// Sprint 45B — Feedback reports (bug/feature/feedback from field)
const feedback_reports = new TableV2({
  organization_id: column.text,
  project_id: column.text,
  reported_by: column.text,
  reporter_name: column.text,
  reporter_role: column.text,
  type: column.text,              // 'bug' | 'feature' | 'feedback'
  severity: column.text,          // 'low' | 'medium' | 'high' | 'critical' (bugs only)
  title: column.text,
  description: column.text,
  page_url: column.text,
  page_name: column.text,
  app_source: column.text,        // 'mobile' | 'web'
  device_info: column.text,
  browser_info: column.text,
  screen_size: column.text,
  screenshots: column.text,       // JSON array of storage paths
  status: column.text,            // 'new' | 'reviewing' | 'resolved' | 'declined'
  admin_notes: column.text,
  admin_response: column.text,
  resolved_at: column.text,
  resolved_by: column.text,
  created_at: column.text,
  updated_at: column.text,
});

// Sprint 53A — Device tokens for Expo push notifications.
// Per-user (synced via by_user bucket, NOT by_org). active=false on sign-out
// so the fanout Edge Function skips stale tokens. UNIQUE constraint on
// (user_id, expo_push_token) means repeated registrations no-op cleanly.
const device_tokens = new TableV2({
  user_id: column.text,
  organization_id: column.text,
  expo_push_token: column.text,
  device_id: column.text,
  platform: column.text,          // 'ios' | 'android'
  app_version: column.text,
  active: column.integer,         // boolean (1 = true)
  last_seen_at: column.text,
  created_at: column.text,
});

// Sprint 69 — Notifications Hub. Per-user inbox synced via by_user bucket.
// Web team owns the table schema + RLS + INSERT pipeline (Track NEVER
// inserts directly — always POSTs to /api/notifications/notify). Track
// only READS rows scoped to its recipient_id.
const notifications = new TableV2({
  organization_id: column.text,
  recipient_id: column.text,
  type: column.text,              // matches NotificationEventType enum
  entity_type: column.text,       // e.g. 'safety_document', 'production_area'
  entity_id: column.text,
  project_id: column.text,
  title: column.text,
  body: column.text,
  icon: column.text,              // lucide-style name (mapped to Ionicons)
  severity: column.text,          // 'info' | 'warning' | 'critical'
  link_url: column.text,          // Web URL — Track parses to local route
  read_at: column.text,
  archived_at: column.text,
  email_sent_at: column.text,
  push_sent_at: column.text,
  created_at: column.text,
});

// Sprint 70 — Todos Hub. Per-user action queue synced via by_user bucket.
// Web team owns the table + RLS + auto-completion engine + cron creation;
// Track only READS active rows (status pending/in_progress/snoozed) and
// POSTs to /api/todos/{id}/{done|snooze|dismiss} or /api/todos/create for
// manual entries. Track NEVER inserts directly — the DB CHECK on `type`
// rejects unknown values and Web's recipient resolver decides the owner.
const todos = new TableV2({
  organization_id: column.text,
  owner_profile_id: column.text,
  type: column.text,              // matches TodoType union (Web team registry)
  entity_type: column.text,       // e.g. 'safety_document', 'production_area'
  entity_id: column.text,
  project_id: column.text,
  title: column.text,
  description: column.text,
  link_url: column.text,          // Web URL — Track parses to local route
  status: column.text,            // 'pending' | 'in_progress' | 'snoozed' (sync filter excludes done/dismissed)
  priority: column.text,          // 'critical' | 'high' | 'normal' | 'low'
  due_date: column.text,          // YYYY-MM-DD or full ISO timestamp
  snooze_until: column.text,
  done_at: column.text,
  done_by: column.text,
  dismissed_at: column.text,
  source: column.text,            // 'auto_event' | 'auto_cron' | 'manual'
  created_by: column.text,
  created_at: column.text,
  updated_at: column.text,
});

// Sprint 53C — Legal documents (NOD / REA / evidence).
// CHECK constraints verified in DB 2026-04-24:
//   document_type IN ('nod', 'rea', 'evidence')
//   status        IN ('draft', 'sent', 'opened', 'no_response')
// NOTE: there is NO 'signed' status. Sign + send is ONE transaction.
// signed_by + signed_at fill at the same moment status flips draft → sent.
const legal_documents = new TableV2({
  organization_id: column.text,
  project_id: column.text,
  document_type: column.text,     // 'nod' | 'rea' | 'evidence'
  status: column.text,            // 'draft' | 'sent' | 'opened' | 'no_response'
  related_area_id: column.text,
  related_delay_log_id: column.text,
  title: column.text,
  description: column.text,
  sha256_hash: column.text,
  pdf_url: column.text,
  signed_by: column.text,
  signed_at: column.text,
  sent_at: column.text,
  opened_at: column.text,
  recipient_email: column.text,
  recipient_name: column.text,    // Sprint 53C — Hybrid Sender display
  receipt_ip: column.text,
  receipt_device: column.text,
  tracking_token: column.text,    // Sprint 53C
  created_at: column.text,
  updated_at: column.text,
});

// Sprint 53C — Cost engine output. Track is source of truth (Web confirmed).
// Foreign-keyed from legal_documents.related_delay_log_id. Track computes
// from area_time_entries JOIN workers.daily_rate_cents at sign time.
const delay_cost_logs = new TableV2({
  organization_id: column.text,
  project_id: column.text,
  area_id: column.text,
  delay_log_id: column.text,      // self-reference / nullable
  crew_size: column.integer,
  daily_rate_cents: column.integer,
  days_lost: column.real,
  total_cost_cents: column.integer,
  calculated_at: column.text,
  created_at: column.text,
});

// Sprint 42B — GC Punch Items (synced from Procore / GC platforms)
const gc_punch_items = new TableV2({
  organization_id: column.text,
  gc_project_id: column.text,
  project_id: column.text,
  external_item_id: column.text,
  platform: column.text,
  title: column.text,
  description: column.text,
  item_number: column.text,
  location_description: column.text,
  floor: column.text,
  unit: column.text,
  status: column.text, // 'open' | 'in_progress' | 'ready_for_review' | 'closed'
  external_status: column.text,
  priority: column.text, // 'low' | 'medium' | 'high' | 'critical'
  assigned_to_user_id: column.text,
  assigned_to_name: column.text,
  external_assignee_id: column.text,
  external_assignee_name: column.text,
  due_date: column.text,
  created_externally_at: column.text,
  closed_at: column.text,
  hours_logged: column.real,
  resolution_notes: column.text,
  completed_at: column.text,
  completed_by: column.text,
  external_photos: column.text,    // JSON string (array of URLs from GC)
  resolution_photos: column.text,  // JSON string (array of URLs from polisher)
  external_data: column.text,      // JSON string (raw GC payload)
  synced_at: column.text,
  push_pending: column.integer,    // boolean as int — triggers gc-push-resolution
  last_push_at: column.text,
  last_push_status: column.text,
  created_at: column.text,
  updated_at: column.text,
});

// Sprint 23 — Room types + phase progress
const room_types = new TableV2({
  organization_id: column.text,
  project_id: column.text,
  name: column.text,
  description: column.text,
  template_id: column.text,
  created_at: column.text,
  updated_at: column.text,
});

const room_type_surfaces = new TableV2({
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
});

const phase_progress = new TableV2({
  organization_id: column.text,
  project_id: column.text,
  area_id: column.text,
  phase_id: column.text,
  status: column.text, // 'not_started' | 'in_progress' | 'blocked' | 'complete' | 'skipped'
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
});

// ============================================================
// SCHEMA EXPORT
// ============================================================

export const AppSchema = new Schema({
  // Takeoff tables (read by Track)
  projects,
  organizations,
  profiles,
  units,
  production_areas,
  production_area_objects,
  production_templates,
  production_template_phases,
  production_phase_progress,
  classifications,
  drawing_sets,
  drawings,
  drawing_revisions,
  drawing_register,
  drawing_hyperlinks,
  drawing_pins,
  takeoff_objects,
  safety_documents,
  jha_library,
  toolbox_library,
  toolbox_schedule_overrides,
  workers,
  project_workers,
  document_signoffs,
  work_tickets,
  // Track-owned tables (T1)
  crew_assignments,
  area_time_entries,
  gps_checkins,
  gps_geofences,
  field_photos,
  // Track-owned tables (T2)
  daily_reports,
  field_messages,
  punch_items,
  production_block_logs,
  worker_certifications,
  // Sprint 23 tables
  room_types,
  room_type_surfaces,
  phase_progress,
  // Track-owned tables (T3)
  delivery_tickets,
  delivery_ticket_items,
  delivery_ticket_item_checks,
  delivery_shipments,
  delivery_shipment_items,
  material_consumption,
  // Sprint 40C
  project_assignments,
  // Sprint 42B
  gc_punch_items,
  // Sprint 43B — Work Tickets with digital signatures
  document_signatures,
  // Sprint 45B — Feedback reports
  feedback_reports,
  // Sprint 53A — Push notification device tokens
  device_tokens,
  // Sprint 53C — Legal engine
  legal_documents,
  delay_cost_logs,
  // Sprint 69 — Notifications Hub
  notifications,
  // Sprint 70 — Todos Hub
  todos,
});

export type Database = (typeof AppSchema)['types'];
export type ProjectRecord = Database['projects'];
export type ProfileRecord = Database['profiles'];
export type UnitRecord = Database['units'];
export type ProductionAreaRecord = Database['production_areas'];
export type PhaseProgressRecord = Database['production_phase_progress'];
export type TemplatePhaseRecord = Database['production_template_phases'];
export type SafetyDocRecord = Database['safety_documents'];
export type WorkTicketRecord = Database['work_tickets'];
export type CrewAssignmentRecord = Database['crew_assignments'];
export type TimeEntryRecord = Database['area_time_entries'];
export type GpsCheckinRecord = Database['gps_checkins'];
export type FieldPhotoRecord = Database['field_photos'];
export type DailyReportRecord = Database['daily_reports'];
export type PunchItemRecord = Database['punch_items'];
export type DrawingRecord = Database['drawings'];
export type DrawingSetRecord = Database['drawing_sets'];
export type ProductionBlockLogRecord = Database['production_block_logs'];
export type GcPunchItemRecord = Database['gc_punch_items'];
export type DocumentSignatureRecord = Database['document_signatures'];
export type FeedbackReportRecord = Database['feedback_reports'];
export type DeviceTokenRecord = Database['device_tokens'];
export type NotificationRecord = Database['notifications'];
export type TodoRecord = Database['todos'];
export type LegalDocumentRecord = Database['legal_documents'];
export type DelayCostLogRecord = Database['delay_cost_logs'];
export type DrawingHyperlinkRecord = Database['drawing_hyperlinks'];
export type DrawingPinRecord = Database['drawing_pins'];
