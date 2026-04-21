/**
 * Screen 3 — Review.
 *
 * Consolidates hazards/controls/PPE across all selected tasks (dedupe,
 * preserve first-seen order) and shows them for the foreman to sanity-check.
 * The user can remove individual hazards, but the UI nudges them not to
 * (intentional friction for safety).
 */
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { consolidate } from '../services/consolidate';
import type { PtpSelectedTask } from '../types';

type Props = {
  selectedTasks: PtpSelectedTask[];
  onContinue: (tasks: PtpSelectedTask[]) => void;
  onBack: () => void;
};

export function PtpReview({ selectedTasks, onContinue, onBack }: Props) {
  const [tasks, setTasks] = useState<PtpSelectedTask[]>(selectedTasks);
  const rolled = useMemo(() => consolidate(tasks), [tasks]);

  const removeHazardByName = (name: string) => {
    Alert.alert(
      'Remove hazard?',
      'Most foremen leave all hazards in. Only remove if it genuinely does not apply.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const lower = name.toLowerCase().trim();
            setTasks((prev) =>
              prev.map((t) => ({
                ...t,
                hazards: t.hazards.filter((h) => h.name.toLowerCase().trim() !== lower),
              })),
            );
          },
        },
      ],
    );
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4 pt-2">
        {/* Tasks */}
        <Section icon="list" title={`Tasks (${tasks.length})`} tint="#3B82F6">
          {tasks.map((t) => (
            <Row key={t.jha_library_id} label={t.task_name} subLabel={t.category ?? undefined} />
          ))}
        </Section>

        {/* Hazards */}
        <Section icon="warning" title={`Hazards (${rolled.hazards.length})`} tint="#F59E0B">
          {rolled.hazards.length === 0 ? (
            <Text className="text-sm text-slate-400">No hazards captured</Text>
          ) : (
            rolled.hazards.map((h) => (
              <RemovableRow
                key={h.name}
                label={h.name}
                subLabel={h.osha_ref ?? undefined}
                onRemove={() => removeHazardByName(h.name)}
              />
            ))
          )}
        </Section>

        {/* Controls */}
        <Section icon="shield-checkmark" title={`Controls (${rolled.controls.length})`} tint="#22C55E">
          {rolled.controls.map((c) => (
            <Row key={c.name} label={c.name} subLabel={c.category ?? undefined} />
          ))}
        </Section>

        {/* PPE */}
        <Section icon="glasses-outline" title={`PPE Required (${rolled.ppe.length})`} tint="#8B5CF6">
          <View className="flex-row flex-wrap gap-2">
            {rolled.ppe.map((p) => (
              <View key={p} className="h-8 items-center justify-center rounded-lg bg-card px-3">
                <Text className="text-xs font-medium text-slate-200">{p}</Text>
              </View>
            ))}
          </View>
        </Section>

        <View className="h-24" />
      </ScrollView>

      <View className="flex-row items-center border-t border-border bg-card px-4 py-3">
        <Pressable
          onPress={onBack}
          className="mr-2 h-12 w-24 items-center justify-center rounded-xl border border-border"
        >
          <Text className="text-base text-slate-400">Back</Text>
        </Pressable>
        <Pressable
          onPress={() => onContinue(tasks)}
          className="ml-2 h-12 flex-1 items-center justify-center rounded-xl bg-brand-orange"
        >
          <Text className="text-base font-bold text-white">Continue to Signatures</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Section({
  icon,
  title,
  tint,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  tint: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-4 rounded-2xl border border-border bg-card p-4">
      <View className="mb-3 flex-row items-center">
        <Ionicons name={icon} size={18} color={tint} />
        <Text className="ml-2 text-sm font-bold uppercase" style={{ color: tint }}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

function Row({ label, subLabel }: { label: string; subLabel?: string }) {
  return (
    <View className="mb-1.5 flex-row items-start">
      <Ionicons name="checkmark" size={16} color="#22C55E" style={{ marginTop: 2 }} />
      <View className="ml-2 flex-1">
        <Text className="text-sm text-white" numberOfLines={3}>
          {label}
        </Text>
        {subLabel ? <Text className="text-xs text-slate-500">{subLabel}</Text> : null}
      </View>
    </View>
  );
}

function RemovableRow({
  label,
  subLabel,
  onRemove,
}: {
  label: string;
  subLabel?: string;
  onRemove: () => void;
}) {
  return (
    <View className="mb-1.5 flex-row items-start">
      <Ionicons name="checkmark" size={16} color="#22C55E" style={{ marginTop: 2 }} />
      <View className="ml-2 flex-1">
        <Text className="text-sm text-white" numberOfLines={3}>
          {label}
        </Text>
        {subLabel ? <Text className="text-xs text-slate-500">{subLabel}</Text> : null}
      </View>
      <Pressable
        onPress={onRemove}
        hitSlop={10}
        className="ml-2 h-6 w-6 items-center justify-center"
      >
        <Ionicons name="close-circle" size={16} color="#64748B" />
      </Pressable>
    </View>
  );
}
