/**
 * Sprint 70 — Today action queue header icon.
 *
 * Mirrors NotificationBell + ProjectNotesIcon: a 40dp circular tappable
 * with an unread/actionable badge in the top-right corner. Tap →
 * /(tabs)/today.
 *
 * Two-tier badge so the foreman can prioritise at a glance:
 *   - Critical-only count → red badge (matches the bell unread style)
 *   - Critical = 0 but other todos pending → orange badge (matches FAB)
 *   - All zero → no badge
 *
 * Hides when activeProject is null (same rule as the other header icons —
 * Welcome state has no header chrome).
 */

import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useProjectStore } from '@/features/projects/store/project-store';
import { useTodos } from '../hooks/useTodos';

export function TodayHeaderIcon() {
  const router = useRouter();
  const activeProject = useProjectStore((s) => s.activeProject);
  const { counts, actionableCount } = useTodos();

  if (!activeProject) return null;

  const criticalCount = counts.critical;
  const showBadge = actionableCount > 0;
  const badgeColor = criticalCount > 0 ? '#EF4444' : '#F97316';
  const badgeLabel = criticalCount > 0 ? criticalCount : actionableCount;

  return (
    <Pressable
      onPress={() => router.push('/(tabs)/today' as any)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={
        actionableCount > 0
          ? `Today: ${actionableCount} pending${criticalCount > 0 ? `, ${criticalCount} critical` : ''}`
          : 'Today'
      }
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#1E293B',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      <Ionicons name="checkbox-outline" size={20} color="#94A3B8" />
      {showBadge ? (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            borderRadius: 9,
            backgroundColor: badgeColor,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: '#0F172A',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>
            {Number(badgeLabel) > 99 ? '99+' : badgeLabel}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
