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
  classification_id: column.text,
  label: column.text,
  quantity: column.real,
  unit: column.text,
  status: column.text,
  completed_at: column.text,
  completed_by: column.text,
  created_at: column.text,
  updated_at: column.text,
});

const production_templates = new TableV2({
  organization_id: column.text,
  name: column.text,
  area_type: column.text,
  created_at: column.text,
});

const production_template_phases = new TableV2({
  template_id: column.text,
  name: column.text,
  phase_order: column.integer,
  estimated_hours: column.real,
  is_gate: column.integer, // boolean
  created_at: column.text,
});

const production_phase_progress = new TableV2({
  area_id: column.text,
  phase_id: column.text,
  status: column.text,
  started_at: column.text,
  completed_at: column.text,
  actual_hours: column.real,
  skipped: column.integer, // boolean
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

// Safety + work tickets (exist in Takeoff)
const safety_documents = new TableV2({
  project_id: column.text,
  organization_id: column.text,
  number: column.integer,
  doc_type: column.text, // 'jha' | 'ptp' | 'toolbox_talk'
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
  number: column.integer,
  title: column.text,
  description: column.text,
  status: column.text,
  floor: column.text,
  area: column.text,
  photos: column.text, // JSONB
  signed_at: column.text,
  created_by: column.text,
  signed_by_id: column.text,
  signature_url: column.text,
  related_drawing_id: column.text,
  related_rfi_id: column.text,
  created_at: column.text,
  updated_at: column.text,
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

// ============================================================
// SCHEMA EXPORT
// ============================================================

export const AppSchema = new Schema({
  // Takeoff tables (read by Track)
  projects,
  organizations,
  profiles,
  production_areas,
  production_area_objects,
  production_templates,
  production_template_phases,
  production_phase_progress,
  classifications,
  drawing_sets,
  drawings,
  drawing_revisions,
  takeoff_objects,
  safety_documents,
  document_signoffs,
  work_tickets,
  // Track-owned tables
  crew_assignments,
  area_time_entries,
  gps_checkins,
  gps_geofences,
  field_photos,
});

export type Database = (typeof AppSchema)['types'];
export type ProjectRecord = Database['projects'];
export type ProfileRecord = Database['profiles'];
export type ProductionAreaRecord = Database['production_areas'];
export type SafetyDocRecord = Database['safety_documents'];
export type WorkTicketRecord = Database['work_tickets'];
export type CrewAssignmentRecord = Database['crew_assignments'];
export type TimeEntryRecord = Database['area_time_entries'];
export type GpsCheckinRecord = Database['gps_checkins'];
export type FieldPhotoRecord = Database['field_photos'];
export type DrawingRecord = Database['drawings'];
export type DrawingSetRecord = Database['drawing_sets'];
