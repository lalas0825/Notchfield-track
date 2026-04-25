/**
 * Sprint 53C — DelayCostCard.
 * Shows the crew × rate × days impact computed by costEngine.computeDelayCost.
 * Rendered inside NodSignModal (preview) and on the legal document detail
 * screen (historical record).
 */

import { ActivityIndicator, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCentsUsd, type DelayCost } from '../services/costEngine';

type Props = {
  cost: DelayCost | null;
  loading?: boolean;
};

export function DelayCostCard({ cost, loading }: Props) {
  if (loading) {
    return (
      <View
        style={{
          marginTop: 8,
          borderRadius: 12,
          backgroundColor: '#1E293B',
          padding: 14,
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="small" color="#EF4444" />
        <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 6 }}>
          Computing cost impact…
        </Text>
      </View>
    );
  }

  if (!cost) return null;

  const rows = [
    { label: 'Crew impacted', value: `${cost.crew_size} worker${cost.crew_size === 1 ? '' : 's'}` },
    { label: 'Avg daily rate', value: cost.daily_rate_cents > 0 ? formatCentsUsd(cost.daily_rate_cents) : '—' },
    { label: 'Days lost', value: `${cost.days_lost}` },
  ];

  return (
    <View
      style={{
        marginTop: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#EF444450',
        backgroundColor: '#EF44440F',
        padding: 14,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Ionicons name="cash" size={14} color="#EF4444" />
        <Text style={{ marginLeft: 6, color: '#FCA5A5', fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' }}>
          Delay Cost Impact
        </Text>
      </View>

      {rows.map((r) => (
        <View
          key={r.label}
          style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 }}
        >
          <Text style={{ color: '#94A3B8', fontSize: 13 }}>{r.label}</Text>
          <Text style={{ color: '#E2E8F0', fontSize: 13, fontWeight: '600' }}>{r.value}</Text>
        </View>
      ))}

      <View
        style={{
          marginTop: 10,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: '#334155',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <Text style={{ color: '#FCA5A5', fontSize: 12, fontWeight: '700' }}>Total documented impact</Text>
        <Text style={{ color: '#EF4444', fontSize: 18, fontWeight: '800' }}>
          {formatCentsUsd(cost.total_cost_cents)}
        </Text>
      </View>
    </View>
  );
}
