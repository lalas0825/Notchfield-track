import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ProductionArea, PhaseProgress, TemplatePhase } from '../store/production-store';

const BLOCK_REASONS = [
  { value: 'other_trade', label: 'Other trade' },
  { value: 'material_not_delivered', label: 'No material' },
  { value: 'inspection_pending', label: 'Pending inspection' },
  { value: 'access_denied', label: 'Access denied' },
  { value: 'rework_required', label: 'Rework needed' },
  { value: 'design_change', label: 'Design issue' },
  { value: 'other', label: 'Other' },
];

type Props = {
  area: ProductionArea;
  phases: PhaseProgress[];
  templatePhases: TemplatePhase[];
  onMarkStatus: (status: string, blockedReason?: string) => Promise<void>;
  onPhaseComplete: (progressId: string) => Promise<void>;
  /** Area-level camera — enqueues photo with phase_id = null */
  onTakePhoto: () => void;
  timeHours: number | null;
  renderBeforePhases?: React.ReactNode;
  renderAfterPhases?: React.ReactNode;
  renderPhotoGallery?: React.ReactNode;
  /** Sprint 53A — Communication thread for this area (notes between foreman/supervisor) */
  renderMessages?: React.ReactNode;
};

export function AreaDetail({
  area,
  phases,
  templatePhases,
  onMarkStatus,
  onPhaseComplete,
  onTakePhoto,
  timeHours,
  renderBeforePhases,
  renderAfterPhases,
  renderPhotoGallery,
  renderMessages,
}: Props) {
  const [showBlockReasons, setShowBlockReasons] = useState(false);

  // Match phases to template for ordering
  const orderedPhases = templatePhases
    .filter((tp) => tp.template_id === area.template_id)
    .map((tp) => {
      const progress = phases.find((p) => p.phase_id === tp.id);
      return { template: tp, progress };
    });

  // Find current phase (first non-complete)
  const currentPhaseIdx = orderedPhases.findIndex(
    (p) => !p.progress || p.progress.status !== 'completed',
  );

  return (
    <ScrollView className="flex-1 bg-background px-4 pt-4">
      {/* Area header */}
      <View className="mb-4 rounded-2xl border border-border bg-card p-4">
        <View className="flex-row items-start justify-between">
          <View>
            <View className="flex-row items-center">
              {(area as any).area_code && (
                <Text style={{ fontFamily: 'monospace', fontSize: 13, color: '#60A5FA', backgroundColor: 'rgba(96,165,250,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginRight: 8, overflow: 'hidden' }}>
                  {(area as any).area_code}
                </Text>
              )}
              <Text className="text-xl font-bold text-white">{area.name}</Text>
            </View>
            {(area as any).description && (
              <Text className="mt-1 text-sm text-slate-500">{(area as any).description}</Text>
            )}
            <Text className="mt-0.5 text-sm text-slate-400">
              {area.floor ?? ''} {area.zone ? `· ${area.zone}` : ''}
            </Text>
          </View>
          <StatusBadge status={area.status} />
        </View>

        {/* Time on area */}
        {timeHours !== null && (
          <View className="mt-3 flex-row items-center">
            <Ionicons name="time" size={14} color="#94A3B8" />
            <Text className="ml-1 text-sm text-slate-400">
              {timeHours.toFixed(1)} man-hours today
            </Text>
          </View>
        )}

        {/* Blocked info */}
        {area.status === 'blocked' && (
          <View className="mt-3 rounded-lg bg-red-500/10 px-3 py-2">
            <Text className="text-sm font-medium text-danger">
              Blocked: {area.blocked_reason ?? 'Unknown reason'}
            </Text>
            {area.blocked_at && (
              <Text className="mt-0.5 text-xs text-slate-500">
                Since {new Date(area.blocked_at).toLocaleDateString()}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* New sqft-weighted phase checklist (Sprint 23) */}
      {renderBeforePhases}

      {/* Legacy phase list (from production_phase_progress) */}
      {orderedPhases.length > 0 && (
        <View className="mb-4">
          <Text className="mb-2 text-sm font-bold uppercase text-slate-400">Phases</Text>
          {orderedPhases.map((item, idx) => {
            const isComplete = item.progress?.status === 'completed';
            const isCurrent = idx === currentPhaseIdx;
            const isLocked = idx > currentPhaseIdx && currentPhaseIdx >= 0;
            const isGate = item.template.requires_inspection;

            return (
              <Pressable
                key={item.template.id}
                onPress={() => {
                  if (isLocked) return;
                  if (isCurrent && item.progress) {
                    onPhaseComplete(item.progress.id);
                  }
                }}
                disabled={isLocked}
                accessibilityRole="button"
                accessibilityLabel={`${item.template.name} phase, ${isComplete ? 'completed' : isLocked ? 'locked' : isCurrent ? 'current' : 'pending'}`}
                className={`mb-1.5 flex-row items-center rounded-xl border px-4 py-3 ${
                  isCurrent
                    ? 'border-brand-orange bg-brand-orange/10'
                    : isComplete
                    ? 'border-border bg-card'
                    : 'border-border bg-card opacity-50'
                }`}
              >
                {/* Status icon */}
                <View className="h-6 w-6 items-center justify-center">
                  {isComplete ? (
                    <Ionicons name="checkmark-circle" size={22} color="#22C55E" />
                  ) : isGate && isComplete ? (
                    <Ionicons name="shield-checkmark" size={22} color="#22C55E" />
                  ) : isLocked ? (
                    <Ionicons name="lock-closed" size={18} color="#64748B" />
                  ) : isCurrent ? (
                    <Ionicons name="ellipse" size={18} color="#F97316" />
                  ) : (
                    <Ionicons name="ellipse-outline" size={18} color="#64748B" />
                  )}
                </View>

                <View className="ml-3 flex-1">
                  <Text
                    className={`text-base font-medium ${
                      isLocked ? 'text-slate-600' : 'text-white'
                    }`}
                  >
                    {item.template.name}
                  </Text>
                  {item.template.estimated_duration_hours && (
                    <Text className="text-xs text-slate-500">
                      Est. {item.template.estimated_duration_hours}h
                    </Text>
                  )}
                </View>

                {/* Gate badge */}
                {isGate && (
                  <View className="rounded-full bg-amber-500/20 px-2 py-0.5">
                    <Text className="text-xs font-bold text-warning">Gate</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Surface checklist (with camera icons per surface) */}
      {renderAfterPhases}

      {/* Photo gallery (rendered via renderPhotoGallery prop) */}
      {renderPhotoGallery}

      {/* Sprint 53A — Communication thread (notes between foreman/supervisor) */}
      {renderMessages}

      {/* Action buttons */}
      <View className="mb-4 gap-2">
        {/* Photo button */}
        <Pressable
          onPress={onTakePhoto}
          className="h-14 flex-row items-center justify-center rounded-xl border border-border bg-card active:opacity-80"
        >
          <Ionicons name="camera" size={22} color="#F97316" />
          <Text className="ml-2 text-base font-medium text-white">Take Photo</Text>
        </Pressable>

        {/* Status actions */}
        {area.status !== 'completed' && area.status !== 'blocked' && (
          <>
            <Pressable
              onPress={() => onMarkStatus('completed')}
              className="h-14 flex-row items-center justify-center rounded-xl bg-success active:opacity-80"
            >
              <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
              <Text className="ml-2 text-base font-bold text-white">Mark Complete</Text>
            </Pressable>

            <Pressable
              onPress={() => setShowBlockReasons(!showBlockReasons)}
              className="h-14 flex-row items-center justify-center rounded-xl border border-danger active:opacity-80"
            >
              <Ionicons name="close-circle" size={22} color="#EF4444" />
              <Text className="ml-2 text-base font-bold text-danger">Report Blocked</Text>
            </Pressable>
          </>
        )}

        {area.status === 'blocked' && (
          <Pressable
            onPress={() => onMarkStatus('in_progress')}
            className="h-14 flex-row items-center justify-center rounded-xl bg-brand-orange active:opacity-80"
          >
            <Ionicons name="play" size={22} color="#FFFFFF" />
            <Text className="ml-2 text-base font-bold text-white">Unblock — Resume Work</Text>
          </Pressable>
        )}
      </View>

      {/* Block reason picker */}
      {showBlockReasons && (
        <View className="mb-4 rounded-xl border border-border bg-card p-4">
          <Text className="mb-3 text-sm font-bold text-white">Select Block Reason</Text>
          {BLOCK_REASONS.map((reason) => (
            <Pressable
              key={reason.value}
              onPress={async () => {
                setShowBlockReasons(false);
                await onMarkStatus('blocked', reason.value);
              }}
              className="mb-1 h-12 flex-row items-center rounded-lg border border-border px-4 active:opacity-80"
            >
              <Text className="text-base text-white">{reason.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View className="h-24" />
    </ScrollView>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    complete: '#22C55E',
    in_progress: '#F59E0B',
    blocked: '#EF4444',
    not_started: '#9CA3AF',
  };
  const color = colors[status] ?? '#9CA3AF';

  return (
    <View className="rounded-full px-3 py-1" style={{ backgroundColor: `${color}20` }}>
      <Text className="text-xs font-bold capitalize" style={{ color }}>
        {status.replace('_', ' ')}
      </Text>
    </View>
  );
}
