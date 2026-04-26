/**
 * Sprint 70 — Manual todo create modal.
 *
 * Bottom sheet that lets the foreman or supervisor jot a self-note that
 * shows up on their Today screen. POSTs to /api/todos/create — Web
 * server-side enforces source='manual' regardless of what we send (per
 * SPRINT_TRACK_TODOS.md §5).
 *
 * Phase 1 fields (matches the spec):
 *   - title (required)
 *   - description (optional)
 *   - dueDate (optional, YYYY-MM-DD via the existing DatePickerModal)
 *   - priority (default 'normal')
 *
 * Errors surface as inline red text — the modal stays open so the user
 * can retry without retyping.
 */

import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createManualTodoViaWeb } from '../services/todoApiClient';
import type { TodoPriority } from '../types';

type Props = {
  visible: boolean;
  projectId: string | null;
  onClose: () => void;
  /** Called after a successful create. Use to reload() the list. */
  onCreated: () => void;
};

const PRIORITY_OPTIONS: Array<{ value: TodoPriority; label: string; color: string }> = [
  { value: 'critical', label: 'Critical', color: '#EF4444' },
  { value: 'high', label: 'High', color: '#F59E0B' },
  { value: 'normal', label: 'Normal', color: '#475569' },
  { value: 'low', label: 'Low', color: '#334155' },
];

export function ManualTodoModal({ visible, projectId, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TodoPriority>('normal');
  const [dueDate, setDueDate] = useState<string | null>(null); // YYYY-MM-DD
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setTitle('');
    setDescription('');
    setPriority('normal');
    setDueDate(null);
    setSubmitting(false);
  };

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      Alert.alert('Title required', 'Add a short title for the todo.');
      return;
    }
    setSubmitting(true);
    try {
      await createManualTodoViaWeb({
        title: trimmed,
        description: description.trim() || undefined,
        dueDate: dueDate ?? undefined,
        priority,
        projectId: projectId ?? undefined,
      });
      reset();
      onCreated();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not create todo';
      Alert.alert('Failed to create todo', msg);
      setSubmitting(false);
    }
  };

  const handleQuickDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setDueDate(d.toISOString().slice(0, 10));
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!submitting) onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <Pressable
          onPress={() => {
            if (!submitting) onClose();
          }}
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
              <Text style={{ color: '#F8FAFC', fontSize: 20, fontWeight: '700' }}>
                New Todo
              </Text>
              <Text style={{ color: '#94A3B8', fontSize: 13, marginTop: 4 }}>
                Add a self-reminder. Visible on your Today screen until done.
              </Text>

              {/* Title */}
              <Text style={LabelStyle}>Title *</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Order extra grout for L3-W4"
                placeholderTextColor="#64748B"
                style={InputStyle}
                editable={!submitting}
                autoFocus
              />

              {/* Description */}
              <Text style={LabelStyle}>Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Optional details"
                placeholderTextColor="#64748B"
                multiline
                style={[InputStyle, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
                editable={!submitting}
              />

              {/* Priority */}
              <Text style={LabelStyle}>Priority</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {PRIORITY_OPTIONS.map((opt) => {
                  const active = opt.value === priority;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setPriority(opt.value)}
                      disabled={submitting}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 8,
                        alignItems: 'center',
                        backgroundColor: active ? opt.color : '#0F172A',
                        borderWidth: 1,
                        borderColor: active ? opt.color : '#334155',
                      }}
                    >
                      <Text
                        style={{
                          color: active ? '#FFFFFF' : '#94A3B8',
                          fontSize: 12,
                          fontWeight: '700',
                        }}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Due date — quick-pick chips */}
              <Text style={LabelStyle}>Due date</Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <DateChip
                  label="None"
                  active={dueDate === null}
                  onPress={() => setDueDate(null)}
                  disabled={submitting}
                />
                <DateChip
                  label="Today"
                  active={!!dueDate && dueDate === new Date().toISOString().slice(0, 10)}
                  onPress={() => handleQuickDate(0)}
                  disabled={submitting}
                />
                <DateChip
                  label="Tomorrow"
                  active={
                    !!dueDate &&
                    dueDate ===
                      new Date(Date.now() + 86400000).toISOString().slice(0, 10)
                  }
                  onPress={() => handleQuickDate(1)}
                  disabled={submitting}
                />
                <DateChip
                  label="In 3 days"
                  active={
                    !!dueDate &&
                    dueDate ===
                      new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
                  }
                  onPress={() => handleQuickDate(3)}
                  disabled={submitting}
                />
              </View>

              {/* Submit */}
              <Pressable
                onPress={handleSubmit}
                disabled={submitting || !title.trim()}
                style={{
                  marginTop: 24,
                  height: 52,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor:
                    submitting || !title.trim() ? '#334155' : '#F97316',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
                  {submitting ? 'Creating...' : 'Create Todo'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  if (!submitting) onClose();
                }}
                style={{
                  marginTop: 8,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={16} color="#94A3B8" style={{ marginRight: 4 }} />
                <Text style={{ color: '#94A3B8', fontSize: 14 }}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function DateChip({
  label,
  active,
  onPress,
  disabled,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: active ? '#F97316' : '#0F172A',
        borderWidth: 1,
        borderColor: active ? '#F97316' : '#334155',
      }}
    >
      <Text
        style={{
          color: active ? '#FFFFFF' : '#94A3B8',
          fontSize: 13,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const LabelStyle = {
  color: '#94A3B8',
  fontSize: 12,
  fontWeight: '700' as const,
  letterSpacing: 0.5,
  textTransform: 'uppercase' as const,
  marginTop: 16,
  marginBottom: 6,
};

const InputStyle = {
  backgroundColor: '#0F172A',
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 10,
  color: '#F8FAFC',
  fontSize: 15,
  borderWidth: 1,
  borderColor: '#334155',
};
