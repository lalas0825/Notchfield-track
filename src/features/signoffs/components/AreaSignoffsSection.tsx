/**
 * Sprint 72 — Sign-Offs section for the AreaDetail screen.
 *
 * Mirrors AreaDeficienciesSection: card with header + list + inline
 * "+ New Sign-Off" button. Tap row → /(tabs)/board/signoff/<id>.
 *
 * The "+ New Sign-Off" button opens CreateSignoffModal which handles the
 * full 2-step flow (library picker → form → submit).
 *
 * Permissions: foreman + supervisor + worker can all VIEW. Only foreman
 * and supervisor can CREATE — same as deficiencies. Workers see a
 * read-only list (no button).
 */

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAreaSignoffs } from '../hooks/useAreaSignoffs';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { normalizeTrackRole } from '@/shared/lib/permissions/trackPermissions';
import { CreateSignoffModal } from './CreateSignoffModal';
import { SignoffListItem } from './SignoffListItem';
import type { SignoffDocument } from '../types';

type Props = {
  areaId: string;
  areaLabel: string;
  projectId: string;
};

export function AreaSignoffsSection({ areaId, areaLabel, projectId }: Props) {
  const router = useRouter();
  const { signoffs, reload } = useAreaSignoffs(areaId);
  const profile = useAuthStore((s) => s.profile);
  const [modalOpen, setModalOpen] = useState(false);

  const role = normalizeTrackRole(profile?.role);
  const canCreate = role === 'foreman' || role === 'supervisor';

  const onPress = (s: SignoffDocument) => {
    router.push(`/(tabs)/board/signoff/${s.id}` as any);
  };

  const openCount = signoffs.filter(
    (s) => s.status === 'draft' || s.status === 'pending_signature',
  ).length;
  const signedCount = signoffs.filter((s) => s.status === 'signed').length;

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
          <Ionicons name="document-text" size={18} color="#3B82F6" />
          <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: '700' }}>
            Sign-Offs
          </Text>
          <Text style={{ color: '#64748B', fontSize: 13 }}>
            {signoffs.length === 0
              ? 'None'
              : `${signoffs.length} total`}
          </Text>
        </View>
        {signoffs.length > 0 ? (
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {openCount > 0 ? <Chip color="#F59E0B" label={`${openCount} open`} /> : null}
            {signedCount > 0 ? <Chip color="#22C55E" label={`${signedCount} signed`} /> : null}
          </View>
        ) : null}
      </View>

      {signoffs.length === 0 ? (
        <View
          style={{
            paddingVertical: 16,
            paddingHorizontal: 8,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#64748B', fontSize: 13 }}>
            No sign-offs for this area.
          </Text>
        </View>
      ) : (
        signoffs.map((s) => (
          <SignoffListItem key={s.id} signoff={s} onPress={onPress} />
        ))
      )}

      {canCreate ? (
        <Pressable
          onPress={() => setModalOpen(true)}
          style={{
            marginTop: 8,
            height: 44,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: '#3B82F6',
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
          }}
          accessibilityRole="button"
          accessibilityLabel="Create new sign-off"
        >
          <Ionicons name="add-circle" size={18} color="#3B82F6" />
          <Text
            style={{ color: '#3B82F6', fontSize: 14, fontWeight: '700' }}
          >
            New Sign-Off
          </Text>
        </Pressable>
      ) : null}

      <CreateSignoffModal
        visible={modalOpen}
        projectId={projectId}
        defaultArea={{ areaId, label: areaLabel }}
        onClose={() => setModalOpen(false)}
        onCreated={() => {
          reload();
        }}
      />
    </View>
  );
}

function Chip({ color, label }: { color: string; label: string }) {
  return (
    <View
      style={{
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: `${color}20`,
        borderWidth: 1,
        borderColor: color,
      }}
    >
      <Text style={{ color, fontSize: 10, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}
