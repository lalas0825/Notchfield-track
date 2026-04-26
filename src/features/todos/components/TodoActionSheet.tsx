/**
 * Sprint 70 — Bottom sheet of secondary actions on a todo row.
 *
 * Triggered by tapping the "..." button on a TodoItem. Surfaces:
 *   - Open    → navigates to link_url (Phase 1: best-effort no-op until
 *               the Web URL → Track route parser exists)
 *   - Snooze  → 4 presets (1h / End of today / Tomorrow 6 AM / dismiss)
 *               + handles all the timing math via dateHelpers
 *   - Dismiss → user-explicit "not relevant" (different from done)
 *
 * Same Modal-based bottom-sheet pattern as RequestChangesSheet so we
 * don't need react-native-gesture-handler.
 */

import { Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Todo } from '../types';
import { snoozePresetToIso, type SnoozePreset } from '../services/dateHelpers';

type Props = {
  visible: boolean;
  todo: Todo | null;
  onClose: () => void;
  onSnooze: (todo: Todo, untilIso: string, label: string) => void;
  onDismiss: (todo: Todo) => void;
  onOpen: (todo: Todo) => void;
};

type SnoozeOption = {
  preset: SnoozePreset;
  label: string;
  caption: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

const SNOOZE_OPTIONS: SnoozeOption[] = [
  { preset: '1h', label: '1 hour', caption: 'Hide for an hour', icon: 'time-outline' },
  { preset: 'eod', label: 'End of today', caption: '5:00 PM', icon: 'moon-outline' },
  { preset: 'tomorrow_6am', label: 'Tomorrow', caption: '6:00 AM', icon: 'sunny-outline' },
];

export function TodoActionSheet({
  visible,
  todo,
  onClose,
  onSnooze,
  onDismiss,
  onOpen,
}: Props) {
  if (!todo) {
    // Modal still needs to be rendered so animation runs. Empty body when no todo.
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable onPress={onClose} style={{ flex: 1 }} />
      </Modal>
    );
  }

  const handleSnooze = (opt: SnoozeOption) => {
    const iso = snoozePresetToIso(opt.preset);
    onSnooze(todo, iso, opt.label);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(0,0,0,0.6)',
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: '#1E293B',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderTopWidth: 1,
            borderColor: '#334155',
          }}
        >
          {/* Drag handle */}
          <View style={{ alignItems: 'center', paddingVertical: 12 }}>
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: '#475569',
              }}
            />
          </View>

          <View style={{ paddingHorizontal: 20, paddingBottom: 32 }}>
            <Text
              numberOfLines={2}
              style={{ color: '#F8FAFC', fontSize: 16, fontWeight: '700' }}
            >
              {todo.title}
            </Text>

            {/* Open action — only when link_url is set */}
            {todo.link_url ? (
              <ActionRow
                icon="open-outline"
                label="Open"
                caption="Go to the related screen"
                onPress={() => {
                  onOpen(todo);
                  onClose();
                }}
              />
            ) : null}

            {/* Snooze section header */}
            <Text
              style={{
                color: '#64748B',
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 1,
                textTransform: 'uppercase',
                marginTop: 20,
                marginBottom: 8,
              }}
            >
              Snooze
            </Text>
            {SNOOZE_OPTIONS.map((opt) => (
              <ActionRow
                key={opt.preset}
                icon={opt.icon}
                label={opt.label}
                caption={opt.caption}
                onPress={() => {
                  handleSnooze(opt);
                  onClose();
                }}
              />
            ))}

            {/* Dismiss section */}
            <Text
              style={{
                color: '#64748B',
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 1,
                textTransform: 'uppercase',
                marginTop: 20,
                marginBottom: 8,
              }}
            >
              Dismiss
            </Text>
            <ActionRow
              icon="close-circle-outline"
              label="Dismiss"
              caption="Not relevant — remove without marking done"
              destructive
              onPress={() => {
                onDismiss(todo);
                onClose();
              }}
            />

            <Pressable
              onPress={onClose}
              style={{
                marginTop: 16,
                height: 48,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#334155',
              }}
            >
              <Text style={{ color: '#94A3B8', fontSize: 15, fontWeight: '600' }}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ActionRow({
  icon,
  label,
  caption,
  onPress,
  destructive,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  caption?: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: '#0F172A' }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        gap: 14,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: destructive ? '#7F1D1D' : '#0F172A',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={18} color={destructive ? '#FCA5A5' : '#F8FAFC'} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: destructive ? '#FCA5A5' : '#F8FAFC',
            fontSize: 15,
            fontWeight: '600',
          }}
        >
          {label}
        </Text>
        {caption ? (
          <Text style={{ color: '#64748B', fontSize: 13, marginTop: 2 }}>{caption}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}
