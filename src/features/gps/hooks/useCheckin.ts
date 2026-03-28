import { useCallback, useEffect, useState } from 'react';
import {
  getCurrentPosition,
  getTodayCheckins,
  isInsideGeofence,
  recordCheckin,
  requestLocationPermission,
  type CheckinType,
  type GpsPosition,
} from '../services/gps-service';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';

type CheckinState = {
  position: GpsPosition | null;
  isInsideFence: boolean | null;  // null = no geofence configured
  isCheckedIn: boolean;
  lastCheckin: { type: CheckinType; created_at: string } | null;
  permissionGranted: boolean;
  loading: boolean;
  error: string | null;
};

export function useCheckin() {
  const { user, profile } = useAuthStore();
  const { activeProject, geofence } = useProjectStore();

  const [state, setState] = useState<CheckinState>({
    position: null,
    isInsideFence: null,
    isCheckedIn: false,
    lastCheckin: null,
    permissionGranted: false,
    loading: true,
    error: null,
  });

  // Request permissions + get initial position + check today's status
  useEffect(() => {
    let mounted = true;

    async function init() {
      const granted = await requestLocationPermission();
      if (!mounted) return;

      if (!granted) {
        setState((s) => ({ ...s, permissionGranted: false, loading: false, error: 'Location permission denied' }));
        return;
      }

      setState((s) => ({ ...s, permissionGranted: true }));

      // Get position
      const pos = await getCurrentPosition();
      if (!mounted) return;

      // Check geofence
      let insideFence: boolean | null = null;
      if (pos && geofence) {
        insideFence = isInsideGeofence(
          pos,
          geofence.center_lat,
          geofence.center_lng,
          geofence.radius_meters,
        );
      }

      // Check today's checkins
      let isCheckedIn = false;
      let lastCheckin = null;
      if (user && activeProject) {
        const checkins = await getTodayCheckins(user.id, activeProject.id);
        if (checkins.length > 0) {
          lastCheckin = checkins[0];
          isCheckedIn = checkins[0].type === 'check_in' || checkins[0].type === 'auto_in';
        }
      }

      if (!mounted) return;
      setState({
        position: pos,
        isInsideFence: insideFence,
        isCheckedIn,
        lastCheckin,
        permissionGranted: true,
        loading: false,
        error: pos ? null : 'Could not determine location',
      });
    }

    init();
    return () => { mounted = false; };
  }, [user?.id, activeProject?.id, geofence?.id]);

  // Refresh position
  const refreshPosition = useCallback(async () => {
    const pos = await getCurrentPosition();
    let insideFence: boolean | null = null;
    if (pos && geofence) {
      insideFence = isInsideGeofence(pos, geofence.center_lat, geofence.center_lng, geofence.radius_meters);
    }
    setState((s) => ({
      ...s,
      position: pos,
      isInsideFence: insideFence,
      error: pos ? null : 'Could not determine location',
    }));
  }, [geofence]);

  // Perform check-in or check-out
  const toggleCheckin = useCallback(async (manualOverride = false) => {
    if (!user || !activeProject || !profile) {
      setState((s) => ({ ...s, error: 'Not authenticated or no project selected' }));
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    // Get fresh position (or use project center for manual override)
    let position = await getCurrentPosition();

    if (!position && manualOverride && geofence) {
      // Manual override: use geofence center
      position = {
        latitude: geofence.center_lat,
        longitude: geofence.center_lng,
        accuracy: null,
        timestamp: Date.now(),
      };
    }

    if (!position) {
      setState((s) => ({ ...s, loading: false, error: 'No GPS signal. Use Manual Override.' }));
      return;
    }

    const type: CheckinType = state.isCheckedIn ? 'check_out' : 'check_in';

    const result = await recordCheckin({
      userId: user.id,
      projectId: activeProject.id,
      organizationId: profile.organization_id,
      type,
      position,
      isManualOverride: manualOverride,
    });

    if (result.success) {
      const now = new Date().toISOString();
      setState((s) => ({
        ...s,
        isCheckedIn: type === 'check_in',
        lastCheckin: { type, created_at: now },
        position,
        loading: false,
      }));
    } else {
      setState((s) => ({ ...s, loading: false, error: result.error ?? 'Check-in failed' }));
    }
  }, [user, activeProject, profile, geofence, state.isCheckedIn]);

  return {
    ...state,
    refreshPosition,
    toggleCheckin,
    geofence,
    activeProject,
  };
}
