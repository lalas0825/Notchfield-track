import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/shared/lib/supabase/client';
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

  useEffect(() => {
    loadPhases();
  }, [loadPhases]);

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
