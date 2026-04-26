/**
 * Sprint 70 — Todo list row.
 *
 * Layout (left → right):
 *   [priority bar]  [icon]  [title (bold) + body + due]  [⋯]
 *
 * Interactions:
 *   - Tap row → mark done (5s undo toast at screen level)
 *   - Tap ⋯   → open the action sheet (Snooze / Open / Dismiss)
 *
 * The spec calls for swipe right = done / swipe left = snooze, but the
 * project doesn't bundle react-native-gesture-handler. The tap+sheet
 * pattern preserves the same actions with no new native dependency. If
 * pilots ask for swipe specifically we'll add gesture-handler in a
 * follow-up sprint and re-enable it here.
 *
 * Priority colour mapping:
 *   - critical = red    bar  / red    text
 *   - high     = amber  bar  / amber  text
 *   - normal   = slate  bar  / slate  text
 *   - low      = muted  bar  / muted  text
 */

import { Pressable, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { resolveIcon } from '@/features/notifications/services/iconMapper';
import { resolveTodoType } from '../services/todoRegistry';
import { formatDueLabel, isOverdueOrToday } from '../services/dateHelpers';
import type { Todo, TodoPriority } from '../types';

type Props = {
  todo: Todo;
  onMarkDone: (todo: Todo) => void;
  onOpenActions: (todo: Todo) => void;
};

const PRIORITY_BAR: Record<TodoPriority, string> = {
  critical: '#EF4444',
  high: '#F59E0B',
  normal: '#475569',
  low: '#334155',
};

const PRIORITY_TEXT: Record<TodoPriority, string> = {
  critical: '#F87171',
  high: '#FBBF24',
  normal: '#94A3B8',
  low: '#64748B',
};

const PRIORITY_LABEL: Record<TodoPriority, string> = {
  critical: 'Critical',
  high: 'High',
  normal: 'Normal',
  low: 'Low',
};

export function TodoItem({ todo, onMarkDone, onOpenActions }: Props) {
  const def = resolveTodoType(todo.type);
  const icon = resolveIcon(def.icon);
  const dueLabel = formatDueLabel(todo.due_date);
  const overdue = isOverdueOrToday(todo.due_date);

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: '#1E293B',
        borderRadius: 12,
        marginHorizontal: 16,
        marginVertical: 6,
        overflow: 'hidden',
      }}
    >
      {/* Left priority bar */}
      <View style={{ width: 4, backgroundColor: PRIORITY_BAR[todo.priority] }} />

      {/* Body — primary tap target marks done */}
      <Pressable
        onPress={() => onMarkDone(todo)}
        android_ripple={{ color: '#334155' }}
        style={{
          flex: 1,
          flexDirection: 'row',
          paddingVertical: 14,
          paddingLeft: 12,
          paddingRight: 4,
          gap: 12,
          alignItems: 'flex-start',
        }}
      >
        {/* Icon disc */}
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: '#0F172A',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon.family === 'ionicons' ? (
            <Ionicons name={icon.name} size={18} color="#F8FAFC" />
          ) : (
            <MaterialCommunityIcons name={icon.name} size={18} color="#F8FAFC" />
          )}
        </View>

        {/* Title + body + meta */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={2}
            style={{
              color: '#F8FAFC',
              fontSize: 15,
              fontWeight: '700',
              lineHeight: 20,
            }}
          >
            {todo.title}
          </Text>
          {todo.description ? (
            <Text
              numberOfLines={2}
              style={{ color: '#94A3B8', fontSize: 13, marginTop: 2, lineHeight: 18 }}
            >
              {todo.description}
            </Text>
          ) : null}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 6,
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <Text
              style={{
                color: PRIORITY_TEXT[todo.priority],
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              {PRIORITY_LABEL[todo.priority]}
            </Text>
            {dueLabel ? (
              <Text
                style={{
                  color: overdue ? '#F87171' : '#64748B',
                  fontSize: 12,
                  fontWeight: '600',
                }}
              >
                {dueLabel}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>

      {/* Action menu button */}
      <Pressable
        onPress={() => onOpenActions(todo)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="More actions"
        style={{
          width: 44,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="ellipsis-horizontal" size={20} color="#64748B" />
      </Pressable>
    </View>
  );
}
