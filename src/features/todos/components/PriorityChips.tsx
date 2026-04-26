/**
 * Sprint 70 — Priority count chips for the Today screen header.
 *
 * Tappable filter chips. Tap one to filter the list to that priority,
 * tap again (or tap "All") to clear. Zero-count chips are dimmed but
 * still rendered so the user has a sense of the full priority spread.
 */

import { Pressable, Text, View } from 'react-native';
import type { TodoPriority } from '../types';
import type { TodoCounts } from '../hooks/useTodos';

type Props = {
  counts: TodoCounts;
  active: TodoPriority | null;
  onChange: (next: TodoPriority | null) => void;
};

const ROW: Array<{
  key: TodoPriority;
  label: string;
  bg: string;
  bgActive: string;
  fg: string;
}> = [
  { key: 'critical', label: 'Critical', bg: '#1F0F0F', bgActive: '#EF4444', fg: '#F87171' },
  { key: 'high', label: 'High', bg: '#1F1409', bgActive: '#F59E0B', fg: '#FBBF24' },
  { key: 'normal', label: 'Normal', bg: '#1E293B', bgActive: '#475569', fg: '#94A3B8' },
  { key: 'low', label: 'Low', bg: '#0F172A', bgActive: '#334155', fg: '#64748B' },
];

export function PriorityChips({ counts, active, onChange }: Props) {
  return (
    <View
      style={{
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
      }}
    >
      {ROW.map((p) => {
        const isActive = active === p.key;
        const count = counts[p.key];
        const dim = count === 0;
        return (
          <Pressable
            key={p.key}
            onPress={() => onChange(isActive ? null : p.key)}
            disabled={dim}
            style={{
              flex: 1,
              borderRadius: 999,
              paddingVertical: 8,
              paddingHorizontal: 4,
              backgroundColor: isActive ? p.bgActive : p.bg,
              opacity: dim ? 0.4 : 1,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: isActive ? p.bgActive : 'transparent',
            }}
          >
            <Text
              style={{
                color: isActive ? '#FFFFFF' : p.fg,
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              {p.label}
            </Text>
            <Text
              style={{
                color: isActive ? '#FFFFFF' : '#F8FAFC',
                fontSize: 16,
                fontWeight: '800',
                marginTop: 2,
              }}
            >
              {count}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
