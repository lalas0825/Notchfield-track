/**
 * Sprint 72 — One row in the area's sign-off list. Mirrors
 * DeficiencyListItem's compact card pattern: status pill on the left,
 * title + meta in the middle, chevron on the right.
 *
 * Status colors:
 *   draft              gray  (#9CA3AF)
 *   pending_signature  amber (#F59E0B)
 *   signed             green (#22C55E)
 */

import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SignoffDocStatus, SignoffDocument } from '../types';

const STATUS_COLOR: Record<SignoffDocStatus, string> = {
  draft: '#9CA3AF',
  pending_signature: '#F59E0B',
  signed: '#22C55E',
  declined: '#EF4444',
  expired: '#64748B',
  cancelled: '#64748B',
};

const STATUS_LABEL: Record<SignoffDocStatus, string> = {
  draft: 'Draft',
  pending_signature: 'Awaiting Sig',
  signed: 'Signed',
  declined: 'Declined',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

type Props = {
  signoff: SignoffDocument;
  onPress: (s: SignoffDocument) => void;
};

export function SignoffListItem({ signoff, onPress }: Props) {
  const color = STATUS_COLOR[signoff.status] ?? '#9CA3AF';
  const label = STATUS_LABEL[signoff.status] ?? signoff.status;

  const meta: string[] = [];
  if (signoff.number > 0) meta.push(`#${signoff.number}`);
  if (signoff.signed_by_name) meta.push(`by ${signoff.signed_by_name}`);
  else if (signoff.sent_to_email) meta.push(`sent ${signoff.sent_to_email}`);

  return (
    <Pressable
      onPress={() => onPress(signoff)}
      android_ripple={{ color: '#0F172A' }}
      style={{
        paddingVertical: 10,
        paddingHorizontal: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderTopWidth: 1,
        borderTopColor: '#0F172A',
      }}
    >
      <View
        style={{
          width: 4,
          alignSelf: 'stretch',
          borderRadius: 2,
          backgroundColor: color,
        }}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '600' }}
        >
          {signoff.title}
        </Text>
        {meta.length > 0 ? (
          <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 2 }}>
            {meta.join(' · ')}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
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
            <Text style={{ color, fontSize: 10, fontWeight: '700' }}>
              {label}
            </Text>
          </View>
          {signoff.created_by === null ? (
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
                backgroundColor: '#0F172A',
                borderWidth: 1,
                borderColor: '#334155',
              }}
            >
              <Text style={{ color: '#94A3B8', fontSize: 10, fontWeight: '700' }}>
                AUTO
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#475569" />
    </Pressable>
  );
}
