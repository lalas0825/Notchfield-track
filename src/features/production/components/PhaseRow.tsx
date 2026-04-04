import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PhaseProgressRow } from '../utils/progressCalculation';

const STATUS_ICONS: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  complete: { icon: 'checkmark-circle', color: '#22C55E' },
  in_progress: { icon: 'ellipse', color: '#F59E0B' },
  blocked: { icon: 'close-circle', color: '#EF4444' },
  not_started: { icon: 'ellipse-outline', color: '#9CA3AF' },
  skipped: { icon: 'remove-circle-outline', color: '#6B7280' },
};

type Props = {
  phase: PhaseProgressRow;
  isLocked: boolean;
  onPress: () => void;
};

export function PhaseRow({ phase, isLocked, onPress }: Props) {
  const statusConfig = isLocked
    ? { icon: 'lock-closed' as const, color: '#6B7280' }
    : STATUS_ICONS[phase.status] ?? STATUS_ICONS.not_started;

  const isBinary = phase.is_binary;
  const isGate = phase.requires_inspection;
  const tappable = !isLocked && phase.status !== 'complete' && phase.status !== 'skipped';

  return (
    <Pressable
      onPress={tappable ? onPress : undefined}
      disabled={!tappable}
      accessibilityRole="button"
      accessibilityLabel={`${phase.phase_name ?? 'Phase'}, ${phase.status}${isLocked ? ', locked' : ''}`}
      style={{ minHeight: 56 }}
      className={`flex-row items-center rounded-xl border px-4 py-3 mb-1.5 ${
        tappable
          ? 'border-border bg-card active:opacity-80'
          : isLocked
          ? 'border-border bg-card opacity-50'
          : 'border-border bg-card'
      }`}
    >
      {/* Status icon */}
      <View className="h-6 w-6 items-center justify-center">
        <Ionicons name={statusConfig.icon} size={22} color={statusConfig.color} />
      </View>

      {/* Sequence + name */}
      <View className="ml-3 flex-1">
        <View className="flex-row items-center">
          <Text
            className={`text-base font-medium ${isLocked ? 'text-slate-600' : 'text-white'}`}
            numberOfLines={1}
          >
            {phase.sequence}. {phase.phase_name ?? 'Phase'}
          </Text>
          {isGate && (
            <View className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5">
              <Text className="text-[10px] font-bold text-warning">Gate</Text>
            </View>
          )}
        </View>
      </View>

      {/* SF progress or binary indicator */}
      <View className="items-end">
        {isBinary ? (
          <Text className="text-sm text-slate-500">
            {phase.status === 'complete' ? '✓' : '—'}
          </Text>
        ) : (
          <Text
            className="text-sm"
            style={{ color: statusConfig.color }}
          >
            {Math.round(phase.completed_sf ?? 0)}/{Math.round(phase.target_sf ?? 0)} SF
          </Text>
        )}
      </View>

      {/* Tap indicator for tappable rows */}
      {tappable && (
        <Ionicons name="chevron-forward" size={16} color="#475569" style={{ marginLeft: 8 }} />
      )}
    </Pressable>
  );
}
