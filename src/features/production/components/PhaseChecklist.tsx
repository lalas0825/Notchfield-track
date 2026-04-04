import { useCallback, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { supabase } from '@/shared/lib/supabase/client';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { enqueuePhoto } from '@/features/photos/services/photo-queue';
import { haptic } from '@/shared/lib/haptics';
import { PhaseRow } from './PhaseRow';
import { PhaseUpdateSheet } from './PhaseUpdateSheet';
import {
  calculateProgress,
  isPhaseLockedFn,
  type PhaseProgressRow,
} from '../utils/progressCalculation';

type Props = {
  areaId: string;
  templateId: string | null;
  userId: string;
};

export function PhaseChecklist({ areaId, templateId, userId }: Props) {
  const [phases, setPhases] = useState<PhaseProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhase, setSelectedPhase] = useState<PhaseProgressRow | null>(null);
  // Map of phase_id → photo count
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});

  const { user, profile } = useAuthStore();
  const { activeProject } = useProjectStore();

  const loadPhases = useCallback(async () => {
    if (!areaId) return;

    // Fetch phase_progress for this area
    const { data: progressData } = await supabase
      .from('phase_progress')
      .select('*')
      .eq('area_id', areaId)
      .order('created_at');

    if (!progressData || progressData.length === 0) {
      setPhases([]);
      setLoading(false);
      return;
    }

    // Fetch template phases for names + ordering
    const phaseIds = progressData.map((p: any) => p.phase_id);
    const { data: templatePhases } = await supabase
      .from('production_template_phases')
      .select('id, name, sequence, requires_inspection, is_binary, binary_weight, depends_on_phase')
      .in('id', phaseIds)
      .order('sequence');

    // Merge
    const templateMap = new Map(
      (templatePhases ?? []).map((tp: any) => [tp.id, tp]),
    );

    const enriched: PhaseProgressRow[] = (progressData as any[])
      .map((p) => {
        const tp = templateMap.get(p.phase_id);
        return {
          ...p,
          phase_name: tp?.name ?? 'Phase',
          sequence: tp?.sequence ?? 0,
          is_binary: tp?.is_binary ?? false,
          binary_weight: tp?.binary_weight ?? 20,
          requires_inspection: tp?.requires_inspection ?? false,
          depends_on_phase: tp?.depends_on_phase ?? null,
        };
      })
      .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));

    setPhases(enriched);
    setLoading(false);
  }, [areaId]);

  /** Load photo counts per phase for this area */
  const loadPhotoCounts = useCallback(async () => {
    if (!areaId) return;

    const { data } = await supabase
      .from('field_photos')
      .select('phase_id')
      .eq('area_id', areaId)
      .not('phase_id', 'is', null);

    if (!data) return;

    const counts: Record<string, number> = {};
    for (const row of data as any[]) {
      if (row.phase_id) {
        counts[row.phase_id] = (counts[row.phase_id] ?? 0) + 1;
      }
    }
    setPhotoCounts(counts);
  }, [areaId]);

  useEffect(() => {
    loadPhases();
    loadPhotoCounts();
  }, [loadPhases, loadPhotoCounts]);

  /** Handle camera tap from a specific phase row */
  const handlePhasePhoto = useCallback(
    async (phase: PhaseProgressRow) => {
      if (!user || !profile || !activeProject) return;

      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera access is required to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      if (result.canceled || !result.assets[0]) return;

      // Try to get GPS — non-blocking
      let gpsLat: number | undefined;
      let gpsLng: number | undefined;
      try {
        const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
        if (locStatus === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          gpsLat = loc.coords.latitude;
          gpsLng = loc.coords.longitude;
        }
      } catch {
        // GPS is best-effort — continue without it
      }

      await enqueuePhoto({
        sourceUri: result.assets[0].uri,
        organizationId: profile.organization_id,
        projectId: activeProject.id,
        areaId,
        phaseId: phase.id,
        contextType: 'progress',
        takenBy: user.id,
        gpsLat,
        gpsLng,
      });

      haptic.success();

      // Refresh counts inline
      setPhotoCounts((prev) => ({
        ...prev,
        [phase.id]: (prev[phase.id] ?? 0) + 1,
      }));
    },
    [user, profile, activeProject, areaId],
  );

  if (loading) return null;

  if (phases.length === 0) {
    return (
      <View className="mb-4 rounded-2xl border border-border bg-card px-4 py-4">
        <View className="flex-row items-center mb-2">
          <Ionicons name="layers-outline" size={16} color="#94A3B8" />
          <Text className="ml-2 text-sm font-bold uppercase text-slate-400">Phases</Text>
        </View>
        <Text className="text-sm text-slate-500">
          No phases assigned. PM needs to assign a template in Takeoff.
        </Text>
      </View>
    );
  }

  const progress = calculateProgress(phases);
  const progressPct = Math.round(progress * 100);

  return (
    <View className="mb-4">
      {/* Section header with progress */}
      <View className="mb-2 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Ionicons name="layers" size={16} color="#F97316" />
          <Text className="ml-2 text-sm font-bold uppercase text-slate-400">
            Phases ({phases.length})
          </Text>
        </View>
        <View className="flex-row items-center">
          <View className="mr-2 h-2 w-16 overflow-hidden rounded-full bg-slate-700">
            <View
              className="h-full rounded-full bg-brand-orange"
              style={{ width: `${progressPct}%` }}
            />
          </View>
          <Text className="text-sm font-bold text-brand-orange">{progressPct}%</Text>
        </View>
      </View>

      {/* Phase rows */}
      {phases.map((phase) => (
        <PhaseRow
          key={phase.id}
          phase={phase}
          isLocked={isPhaseLockedFn(phase, phases)}
          onPress={() => setSelectedPhase(phase)}
          onTakePhoto={() => handlePhasePhoto(phase)}
          photoCount={photoCounts[phase.id] ?? 0}
        />
      ))}

      {/* Bottom sheet for updating selected phase */}
      {selectedPhase && (
        <PhaseUpdateSheet
          phase={selectedPhase}
          visible={!!selectedPhase}
          onClose={() => setSelectedPhase(null)}
          onUpdated={loadPhases}
          userId={userId}
        />
      )}
    </View>
  );
}
