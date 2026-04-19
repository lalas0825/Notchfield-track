/**
 * Sprint TOOLBOX — Weekly safety talks.
 *
 * Topics come from the shared `toolbox_library` table (3-tier: global/org/
 * project). Delivered talks live on `safety_documents` with
 * `doc_type='toolbox'` — same pattern as PTP. Content JSONB carries a deep
 * snapshot of the library topic so the PDF stays immutable if the library
 * is later edited.
 */

import { z } from 'zod';
import { Trade } from '@/features/safety/ptp/types';

export { Trade };

// ─── Library topic (read-only in Track) ──────────────────
export const ToolboxLibraryTopic = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid().nullable(),
  project_id: z.string().uuid().nullable(),
  trade: z.array(z.string()),
  title: z.string(),
  title_es: z.string().nullable(),
  slug: z.string(),
  why_it_matters: z.string(),
  why_it_matters_es: z.string().nullable(),
  key_points: z.array(z.string()),
  key_points_es: z.array(z.string()).nullable(),
  discussion_questions: z.array(z.string()),
  discussion_questions_es: z.array(z.string()).nullable(),
  osha_ref: z.string().nullable(),
  category: z.string(),
  tags: z.array(z.string()),
  season: z.array(z.string()),
  source: z.string().nullable(),
  active: z.boolean(),
});
export type ToolboxLibraryTopic = z.infer<typeof ToolboxLibraryTopic>;

// Snapshot stored inside content.topic_snapshot
export const ToolboxTopicSnapshot = z.object({
  toolbox_library_id: z.string().uuid(),
  title: z.string(),
  title_es: z.string().nullable(),
  slug: z.string(),
  why_it_matters: z.string(),
  why_it_matters_es: z.string().nullable(),
  key_points: z.array(z.string()),
  key_points_es: z.array(z.string()).nullable(),
  discussion_questions: z.array(z.string()),
  discussion_questions_es: z.array(z.string()).nullable(),
  osha_ref: z.string().nullable(),
  category: z.string(),
  source: z.string().nullable(),
});
export type ToolboxTopicSnapshot = z.infer<typeof ToolboxTopicSnapshot>;

export function snapshotOf(topic: ToolboxLibraryTopic): ToolboxTopicSnapshot {
  return {
    toolbox_library_id: topic.id,
    title: topic.title,
    title_es: topic.title_es,
    slug: topic.slug,
    why_it_matters: topic.why_it_matters,
    why_it_matters_es: topic.why_it_matters_es,
    key_points: [...topic.key_points],
    key_points_es: topic.key_points_es ? [...topic.key_points_es] : null,
    discussion_questions: [...topic.discussion_questions],
    discussion_questions_es: topic.discussion_questions_es
      ? [...topic.discussion_questions_es]
      : null,
    osha_ref: topic.osha_ref,
    category: topic.category,
    source: topic.source,
  };
}

// ─── Schedule override (PM forces a topic for a specific week) ───
export const ToolboxScheduleOverride = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  project_id: z.string().uuid(),
  week_start_date: z.string(),
  topic_id: z.string().uuid(),
  set_by: z.string().uuid().nullable(),
  reason: z.string().nullable(),
});
export type ToolboxScheduleOverride = z.infer<typeof ToolboxScheduleOverride>;

// ─── Delivered talk content (stored in safety_documents.content) ──
export const ToolboxWeather = z.object({
  temp_f: z.number().optional(),
  conditions: z.string().optional(),
  wind_mph: z.number().optional(),
});
export type ToolboxWeather = z.infer<typeof ToolboxWeather>;

export const ToolboxGps = z.object({
  latitude: z.number(),
  longitude: z.number(),
});
export type ToolboxGps = z.infer<typeof ToolboxGps>;

export const ToolboxContentSchema = z.object({
  topic_snapshot: ToolboxTopicSnapshot,
  scheduled_date: z.string(), // ISO yyyy-mm-dd (Monday of the week)
  delivered_date: z.string(), // ISO yyyy-mm-dd (the day the foreman presented)
  shift: z.enum(['day', 'night', 'weekend']).default('day'),
  weather: ToolboxWeather.nullable().optional(),
  foreman_id: z.string().uuid(),        // workers.id (Sprint MANPOWER convention)
  foreman_name: z.string(),
  foreman_gps: ToolboxGps.nullable().optional(),
  photo_urls: z.array(z.string()).default([]),
  discussion_notes: z.string().default(''),
  delivered_language: z.enum(['en', 'es', 'both']).default('en'),
  additional_notes: z.string().default(''),
  // Stamped by distributeService when /distribute succeeds. Same contract
  // as PtpContent.distribution — lets UI detect "already sent" without
  // relying on the status column.
  distribution: z
    .object({
      distributed_at: z.string(),
      distributed_to: z.array(z.string()).default([]),
      pdf_sha256: z.string().nullable().optional(),
      emails_sent: z.number().nullable().optional(),
    })
    .nullable()
    .optional(),
});
export type ToolboxContent = z.infer<typeof ToolboxContentSchema>;

// ─── Scheduler engine (pure functions) ──────────────────
// Input history row — just what the scheduler needs to compute rotation.
export const ToolboxDelivery = z.object({
  toolbox_library_id: z.string().uuid(),
  slug: z.string(),
  delivered_date: z.string(),
});
export type ToolboxDelivery = z.infer<typeof ToolboxDelivery>;

export type RankedTopic = {
  topic: ToolboxLibraryTopic;
  score: number;
  reasons: string[];
};

export type ScheduleResult = {
  suggested: ToolboxLibraryTopic | null;
  alternatives: ToolboxLibraryTopic[];
  explanation: string[];
  wasOverridden: boolean;
  ranked: RankedTopic[];
};
