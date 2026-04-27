/**
 * Sprint 71 — Deficiencies section for the AreaDetail screen.
 *
 * Renders inside AreaDetail's `renderDeficiencies` slot. Shows:
 *   - Section header with count + severity chips
 *   - List of deficiencies (DeficiencyListItem rows) sorted critical → low
 *   - "+ Report Deficiency" button at bottom (inline button, not floating
 *     FAB — keeps interaction within the area context, no z-index issues
 *     with KeyboardAvoidingView wrapping AreaDetail's ScrollView).
 *
 * Tap on a row → /(tabs)/board/deficiency/<id>.
 *
 * Permissions: any Track role can report and view; resolve action lives
 * inside the detail screen (same component for foreman + supervisor).
 */

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAreaDeficiencies } from '../hooks/useAreaDeficiencies';
import { DeficiencyListItem } from './DeficiencyListItem';
import { ReportDeficiencyModal } from './ReportDeficiencyModal';
import { SEVERITY_COLOR } from '../types';
import type { Deficiency } from '../types';

type Props = {
  areaId: string;
  projectId: string;
  organizationId: string;
};

export function AreaDeficienciesSection({
  areaId,
  projectId,
  organizationId,
}: Props) {
  const router = useRouter();
  const { deficiencies, counts, reload } = useAreaDeficiencies(areaId);
  const [modalOpen, setModalOpen] = useState(false);

  const onPress = (d: Deficiency) => {
    router.push(`/(tabs)/board/deficiency/${d.id}` as any);
  };

  return (
    <View
      style={{
        marginBottom: 16,
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#1E293B',
        backgroundColor: '#0F172A',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
          paddingHorizontal: 4,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="warning" size={18} color="#F59E0B" />
          <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: '700' }}>
            Deficiencies
          </Text>
          <Text style={{ color: '#64748B', fontSize: 13 }}>
            {counts.openTotal === 0
              ? 'None'
              : `${counts.openTotal} open`}
          </Text>
        </View>
        {/* Severity dots */}
        {counts.openTotal > 0 ? (
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {(['critical', 'major', 'minor', 'cosmetic'] as const).map((s) =>
              counts[s] > 0 ? (
                <View
                  key={s}
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    backgroundColor: `${SEVERITY_COLOR[s]}20`,
                    borderWidth: 1,
                    borderColor: SEVERITY_COLOR[s],
                  }}
                >
                  <Text
                    style={{
                      color: SEVERITY_COLOR[s],
                      fontSize: 10,
                      fontWeight: '700',
                    }}
                  >
                    {counts[s]}
                  </Text>
                </View>
              ) : null,
            )}
          </View>
        ) : null}
      </View>

      {deficiencies.length === 0 ? (
        <View
          style={{
            paddingVertical: 16,
            paddingHorizontal: 8,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#64748B', fontSize: 13 }}>
            No deficiencies reported for this area.
          </Text>
        </View>
      ) : (
        deficiencies.map((d) => (
          <DeficiencyListItem key={d.id} deficiency={d} onPress={onPress} />
        ))
      )}

      <Pressable
        onPress={() => setModalOpen(true)}
        style={{
          marginTop: 8,
          height: 44,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: '#F59E0B',
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
        }}
        accessibilityRole="button"
        accessibilityLabel="Report new deficiency"
      >
        <Ionicons name="add-circle" size={18} color="#F59E0B" />
        <Text
          style={{
            color: '#F59E0B',
            fontSize: 14,
            fontWeight: '700',
          }}
        >
          Report Deficiency
        </Text>
      </Pressable>

      <ReportDeficiencyModal
        visible={modalOpen}
        projectId={projectId}
        areaId={areaId}
        organizationId={organizationId}
        onClose={() => setModalOpen(false)}
        onCreated={reload}
      />
    </View>
  );
}
