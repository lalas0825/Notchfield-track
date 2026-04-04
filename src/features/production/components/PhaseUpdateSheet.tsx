import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { haptic } from '@/shared/lib/haptics';
import { localUpdate } from '@/shared/lib/powersync/write';
import { logger } from '@/shared/lib/logger';
import type { PhaseProgressRow } from '../utils/progressCalculation';

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
  phase: PhaseProgressRow;
  visible: boolean;
  onClose: () => void;
  onUpdated: () => void;
  userId: string;
};

export function PhaseUpdateSheet({ phase, visible, onClose, onUpdated, userId }: Props) {
  const [completedSf, setCompletedSf] = useState(String(Math.round(phase.completed_sf ?? 0)));
  const [showBlockReasons, setShowBlockReasons] = useState(false);
  const [saving, setSaving] = useState(false);

  const targetSf = phase.target_sf ?? 0;
  const isBinary = phase.is_binary;

  const handleUpdateSf = async (value: number) => {
    setSaving(true);
    const now = new Date().toISOString();
    const isComplete = value >= targetSf;

    await localUpdate('phase_progress', phase.id, {
      completed_sf: value,
      status: isComplete ? 'complete' : 'in_progress',
      ...(isComplete ? { completed_at: now, completed_by: userId } : {}),
      ...(!phase.started_at ? { started_at: now } : {}),
      updated_at: now,
    });

    haptic.success();
    logger.info('Phase', `Updated ${phase.phase_name}: ${value}/${targetSf} SF`);
    setSaving(false);
    onUpdated();
    if (isComplete) onClose();
  };

  const handleMarkComplete = async () => {
    if (isBinary) {
      await localUpdate('phase_progress', phase.id, {
        status: 'complete',
        completed_at: new Date().toISOString(),
        completed_by: userId,
        updated_at: new Date().toISOString(),
      });
    } else {
      await handleUpdateSf(targetSf);
      return;
    }
    haptic.success();
    onUpdated();
    onClose();
  };

  const handleBlock = async (reason: string) => {
    await localUpdate('phase_progress', phase.id, {
      status: 'blocked',
      blocked_reason: reason,
      updated_at: new Date().toISOString(),
    });
    haptic.error();
    logger.info('Phase', `Blocked ${phase.phase_name}: ${reason}`);
    setShowBlockReasons(false);
    onUpdated();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 justify-end bg-black/60">
        <Pressable onPress={() => {}} className="rounded-t-3xl border-t border-border bg-card">
          <View className="items-center py-3">
            <View className="h-1 w-10 rounded-full bg-slate-600" />
          </View>

          <View className="px-6 pb-10">
            {/* Header */}
            <Text className="text-xl font-bold text-white">
              {phase.sequence}. {phase.phase_name}
            </Text>
            {!isBinary && (
              <Text className="mt-1 text-sm text-slate-400">
                Target: {Math.round(targetSf)} SF
              </Text>
            )}

            {/* SF input (non-binary only) */}
            {!isBinary && !showBlockReasons && (
              <View className="mt-6">
                <Text className="mb-2 text-sm font-medium text-slate-400">Completed SF</Text>
                <View className="flex-row items-center gap-3">
                  <TextInput
                    value={completedSf}
                    onChangeText={setCompletedSf}
                    keyboardType="numeric"
                    className="h-14 flex-1 rounded-xl border border-border bg-background px-4 text-center text-xl font-bold text-white"
                  />
                  <Text className="text-base text-slate-400">/ {Math.round(targetSf)}</Text>
                </View>

                {/* Quick update button */}
                <Pressable
                  onPress={() => handleUpdateSf(parseFloat(completedSf) || 0)}
                  disabled={saving}
                  className="mt-3 h-12 items-center justify-center rounded-xl bg-brand-orange active:opacity-80"
                >
                  <Text className="text-base font-bold text-white">
                    {saving ? 'Saving...' : 'Update Progress'}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Mark Complete */}
            {!showBlockReasons && (
              <Pressable
                onPress={handleMarkComplete}
                className="mt-4 h-14 flex-row items-center justify-center rounded-xl bg-success active:opacity-80"
              >
                <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
                <Text className="ml-2 text-lg font-bold text-white">Mark Complete</Text>
              </Pressable>
            )}

            {/* Report Blocked */}
            {!showBlockReasons ? (
              <Pressable
                onPress={() => setShowBlockReasons(true)}
                className="mt-3 h-14 flex-row items-center justify-center rounded-xl border border-danger active:opacity-80"
              >
                <Ionicons name="close-circle" size={22} color="#EF4444" />
                <Text className="ml-2 text-lg font-bold text-danger">Report Blocked</Text>
              </Pressable>
            ) : (
              <View className="mt-4">
                <Text className="mb-3 text-base font-bold text-white">Select Block Reason</Text>
                {BLOCK_REASONS.map((r) => (
                  <Pressable
                    key={r.value}
                    onPress={() => handleBlock(r.value)}
                    className="mb-1.5 h-12 flex-row items-center rounded-lg border border-border px-4 active:opacity-80"
                  >
                    <Text className="text-base text-white">{r.label}</Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => setShowBlockReasons(false)}
                  className="mt-2 h-10 items-center justify-center"
                >
                  <Text className="text-sm text-slate-400">Cancel</Text>
                </Pressable>
              </View>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
