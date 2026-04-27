/**
 * Sprint 71 — Compact deficiency row for area-detail and supervisor lists.
 *
 * Layout (left → right):
 *   [severity bar] [title + meta + status] [photo thumb (or count)] [chevron]
 *
 * Meta line shows: severity label · responsibility · "N photos" · created
 * date (relative). Status pill on the right side communicates lifecycle
 * (Open / In Progress / Resolved / Verified). Closed rows never reach
 * Track because the sync rule excludes them.
 */

import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  SEVERITY_COLOR,
  SEVERITY_LABEL,
  STATUS_LABEL,
  RESPONSIBILITY_LABEL,
} from '../types';
import type { Deficiency, DeficiencyStatus } from '../types';

type Props = {
  deficiency: Deficiency;
  onPress: (d: Deficiency) => void;
};

const STATUS_STYLE: Record<
  DeficiencyStatus,
  { bg: string; fg: string; label: string }
> = {
  open: { bg: '#1F0F0F', fg: '#F87171', label: 'Open' },
  in_progress: { bg: '#1F1409', fg: '#FBBF24', label: 'In Progress' },
  resolved: { bg: '#0B1F1A', fg: '#34D399', label: 'Awaiting Verify' },
  verified: { bg: '#0B1A2E', fg: '#60A5FA', label: 'Verified' },
  closed: { bg: '#1E293B', fg: '#94A3B8', label: 'Closed' },
};

function relativeDate(iso: string, now: number = Date.now()): string {
  const t = new Date(iso).getTime();
  const diff = now - t;
  const day = 24 * 3600 * 1000;
  if (diff < 3600 * 1000) return `${Math.max(1, Math.floor(diff / 60000))}m`;
  if (diff < day) return `${Math.floor(diff / 3600000)}h`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d`;
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}`;
}

export function DeficiencyListItem({ deficiency, onPress }: Props) {
  const status = STATUS_STYLE[deficiency.status] ?? STATUS_STYLE.open;
  const photoCount = deficiency.photos.length;
  const firstPhoto = photoCount > 0 ? deficiency.photos[0] : null;

  return (
    <Pressable
      onPress={() => onPress(deficiency)}
      android_ripple={{ color: '#334155' }}
      style={{
        flexDirection: 'row',
        backgroundColor: '#1E293B',
        borderRadius: 12,
        marginVertical: 4,
        overflow: 'hidden',
      }}
    >
      {/* Severity bar */}
      <View
        style={{
          width: 4,
          backgroundColor: SEVERITY_COLOR[deficiency.severity],
        }}
      />

      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 12,
          paddingHorizontal: 12,
          gap: 10,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          {/* Status pill */}
          <View
            style={{
              alignSelf: 'flex-start',
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 4,
              backgroundColor: status.bg,
              marginBottom: 4,
            }}
          >
            <Text
              style={{
                color: status.fg,
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              {status.label}
            </Text>
          </View>

          <Text
            numberOfLines={2}
            style={{
              color: '#F8FAFC',
              fontSize: 14,
              fontWeight: '700',
              lineHeight: 18,
            }}
          >
            {deficiency.title}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: '#94A3B8',
              fontSize: 12,
              marginTop: 4,
            }}
          >
            <Text
              style={{
                color: SEVERITY_COLOR[deficiency.severity],
                fontWeight: '700',
              }}
            >
              {SEVERITY_LABEL[deficiency.severity]}
            </Text>
            {' · '}
            {RESPONSIBILITY_LABEL[deficiency.responsibility]}
            {photoCount > 0 ? ` · ${photoCount} 📷` : ''}
            {' · '}
            {relativeDate(deficiency.created_at)}
          </Text>
        </View>

        {/* Photo thumb */}
        {firstPhoto ? (
          <Image
            source={{ uri: firstPhoto }}
            style={{
              width: 56,
              height: 56,
              borderRadius: 6,
              backgroundColor: '#0F172A',
            }}
          />
        ) : null}

        <Ionicons name="chevron-forward" size={18} color="#475569" />
      </View>
    </Pressable>
  );
}
