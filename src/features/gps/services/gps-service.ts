import * as Location from 'expo-location';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '@/shared/lib/supabase/client';
import { localInsert, generateUUID } from '@/shared/lib/powersync/write';
import { haptic } from '@/shared/lib/haptics';
import { logger } from '@/shared/lib/logger';

export type GpsPosition = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
};

export type CheckinType = 'check_in' | 'check_out' | 'auto_in' | 'auto_out';

/**
 * Request location permissions.
 * Returns true if foreground permission is granted.
 */
export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

/**
 * Request background location permission (needed for geofence auto check-in).
 */
export async function requestBackgroundPermission(): Promise<boolean> {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  return status === 'granted';
}

/**
 * Get current position with high accuracy.
 * Falls back to last known position if GPS fails (e.g., inside a building).
 */
export async function getCurrentPosition(): Promise<GpsPosition | null> {
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      timestamp: location.timestamp,
    };
  } catch {
    // GPS failed — try last known position
    const last = await Location.getLastKnownPositionAsync();
    if (last) {
      return {
        latitude: last.coords.latitude,
        longitude: last.coords.longitude,
        accuracy: last.coords.accuracy,
        timestamp: last.timestamp,
      };
    }
    return null;
  }
}

/**
 * Calculate distance between two points using Haversine formula.
 * Returns distance in meters.
 */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Check if a position is inside a geofence circle.
 */
export function isInsideGeofence(
  position: GpsPosition,
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
): boolean {
  const distance = distanceMeters(
    position.latitude,
    position.longitude,
    centerLat,
    centerLng,
  );
  return distance <= radiusMeters;
}

/**
 * Record a check-in/out to the gps_checkins table via Supabase.
 * Works offline via PowerSync (writes to local SQLite, syncs when online).
 */
export async function recordCheckin(params: {
  userId: string;
  projectId: string;
  organizationId: string;
  type: CheckinType;
  position: GpsPosition;
  isManualOverride?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const { userId, projectId, organizationId, type, position } = params;

  // FIX 1: Local-first write via PowerSync
  const result = await localInsert('gps_checkins', {
    id: generateUUID(),
    user_id: userId,
    project_id: projectId,
    organization_id: organizationId,
    type,
    gps_lat: position.latitude,
    gps_lng: position.longitude,
    accuracy_meters: position.accuracy,
    device_id: Constants.deviceName ?? Platform.OS,
    created_at: new Date().toISOString(),
  });

  if (!result.success) {
    console.error('[GPS] Check-in failed:', result.error);
    return { success: false, error: result.error };
  }

  haptic.heavy();
  logger.info(`[GPS] ${type} recorded: ${position.latitude}, ${position.longitude}`);
  return { success: true };
}

/**
 * Get today's check-ins for a user on a project.
 */
export async function getTodayCheckins(
  userId: string,
  projectId: string,
): Promise<{ type: CheckinType; created_at: string }[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from('gps_checkins')
    .select('type, created_at')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false });

  return (data ?? []) as { type: CheckinType; created_at: string }[];
}
