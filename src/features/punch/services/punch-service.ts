/**
 * Punch List Service
 * ===================
 * Lifecycle: open → in_progress → resolved → verified | rejected
 *
 * Supervisor creates items (with photo).
 * Foreman resolves (with "after" photo — required).
 * Supervisor verifies or rejects.
 *
 * Photos use the existing photo-queue outbox pattern.
 */

import { supabase } from '@/shared/lib/supabase/client';
import { localInsert, localUpdate, generateUUID } from '@/shared/lib/powersync/write';
import { logger } from '@/shared/lib/logger';

export type PunchStatus = 'open' | 'in_progress' | 'resolved' | 'verified' | 'rejected';
export type PunchPriority = 'low' | 'medium' | 'high' | 'critical';

export type PunchItem = {
  id: string;
  organization_id: string;
  project_id: string;
  area_id: string;
  title: string;
  description: string | null;
  priority: PunchPriority;
  status: PunchStatus;
  photos: string[];
  resolution_photos: string[];
  assigned_to: string | null;
  created_by: string;
  resolved_at: string | null;
  verified_at: string | null;
  rejected_reason: string | null;
  plan_x: number | null;
  plan_y: number | null;
  drawing_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  area_name?: string;
  assigned_to_name?: string;
  created_by_name?: string;
};

/**
 * Fetch all punch items for a project.
 */
export async function fetchPunchItems(
  projectId: string,
  organizationId: string,
): Promise<PunchItem[]> {
  const { data } = await supabase
    .from('punch_items')
    .select('*')
    .eq('project_id', projectId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  return (data ?? []) as PunchItem[];
}

/**
 * Get punch items for a specific area.
 */
export async function fetchAreaPunchItems(areaId: string): Promise<PunchItem[]> {
  const { data } = await supabase
    .from('punch_items')
    .select('*')
    .eq('area_id', areaId)
    .order('created_at', { ascending: false });

  return (data ?? []) as PunchItem[];
}

/**
 * Create a punch item (supervisor only).
 */
export async function createPunchItem(params: {
  organizationId: string;
  projectId: string;
  areaId: string;
  title: string;
  description?: string;
  priority: PunchPriority;
  photos: string[];
  assignedTo?: string;
  createdBy: string;
  planX?: number;
  planY?: number;
  drawingId?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!params.title.trim()) {
    return { success: false, error: 'Title is required' };
  }

  if (params.photos.length === 0) {
    return { success: false, error: 'At least one photo is required to document the defect' };
  }

  const result = await localInsert('punch_items', {
    id: generateUUID(),
    organization_id: params.organizationId,
    project_id: params.projectId,
    area_id: params.areaId,
    title: params.title.trim(),
    description: params.description?.trim() ?? null,
    priority: params.priority,
    status: 'open',
    photos: params.photos,
    resolution_photos: [],
    assigned_to: params.assignedTo ?? null,
    created_by: params.createdBy,
    plan_x: params.planX ?? null,
    plan_y: params.planY ?? null,
    drawing_id: params.drawingId ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (!result.success) return { success: false, error: result.error };

  logger.info(`[Punch] Created: ${params.title}`);
  return { success: true, id: result.id };
}

/**
 * Resolve a punch item (foreman). Requires "after" photo.
 */
export async function resolvePunchItem(
  itemId: string,
  resolutionPhotos: string[],
): Promise<{ success: boolean; error?: string }> {
  if (resolutionPhotos.length === 0) {
    return { success: false, error: 'An "after" photo is required to resolve this item' };
  }

  const result = await localUpdate('punch_items', itemId, {
    status: 'resolved',
    resolution_photos: resolutionPhotos,
    resolved_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (!result.success) return { success: false, error: result.error };
  return { success: true };
}

/**
 * Verify a resolved punch item (supervisor approves).
 */
export async function verifyPunchItem(
  itemId: string,
): Promise<{ success: boolean; error?: string }> {
  const result = await localUpdate('punch_items', itemId, {
    status: 'verified',
    verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (!result.success) return { success: false, error: result.error };
  return { success: true };
}

/**
 * Reject a resolved punch item (supervisor sends back with reason).
 */
export async function rejectPunchItem(
  itemId: string,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  if (!reason.trim()) {
    return { success: false, error: 'Rejection reason is required' };
  }

  const result = await localUpdate('punch_items', itemId, {
    status: 'rejected',
    rejected_reason: reason.trim(),
    resolved_at: null,
    resolution_photos: [],
    updated_at: new Date().toISOString(),
  });

  if (!result.success) return { success: false, error: result.error };
  return { success: true };
}

/**
 * Get punch item counts by status for a project.
 */
export function getPunchCounts(items: PunchItem[]) {
  return {
    open: items.filter((i) => i.status === 'open' || i.status === 'rejected').length,
    inProgress: items.filter((i) => i.status === 'in_progress').length,
    resolved: items.filter((i) => i.status === 'resolved').length,
    verified: items.filter((i) => i.status === 'verified').length,
    total: items.length,
  };
}
