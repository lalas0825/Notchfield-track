import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Worker } from '../store/crew-store';
import type { CertStatus } from '../hooks/useCertAlerts';

type Props = {
  worker: Worker;
  currentArea: string | null;
  selected: boolean;
  onPress: () => void;
  certStatus?: CertStatus | null; // from useCertAlerts
};

const CERT_BADGE: Record<string, { color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  expired: { color: '#EF4444', icon: 'alert-circle' },
  pending_renewal: { color: '#F59E0B', icon: 'warning' },
};

export function WorkerCard({ worker, currentArea, selected, onPress, certStatus }: Props) {
  const initials = worker.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '??';

  const certBadge = certStatus ? CERT_BADGE[certStatus] : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${worker.full_name}, ${worker.role}${certStatus === 'expired' ? ', certifications expired' : ''}`}
      className={`mb-2 flex-row items-center rounded-xl border px-4 py-3 active:opacity-80 ${
        selected
          ? 'border-brand-orange bg-brand-orange/10'
          : 'border-border bg-card'
      }`}
    >
      {/* Checkbox */}
      <View
        className={`h-7 w-7 items-center justify-center rounded-lg ${
          selected ? 'bg-brand-orange' : 'border border-slate-500'
        }`}
      >
        {selected && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
      </View>

      {/* Avatar with cert dot */}
      <View className="ml-3 relative">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-600">
          <Text className="text-sm font-bold text-white">{initials}</Text>
        </View>
        {/* Cert status dot — top-right of avatar */}
        {certBadge && (
          <View
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: certBadge.color,
              borderWidth: 2,
              borderColor: '#1E293B',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
        )}
      </View>

      {/* Info */}
      <View className="ml-3 flex-1">
        <Text className="text-base font-medium text-white">{worker.full_name}</Text>
        {currentArea && (
          <View className="mt-0.5 flex-row items-center">
            <Ionicons name="location" size={12} color="#F59E0B" />
            <Text className="ml-1 text-sm text-warning">{currentArea}</Text>
          </View>
        )}
        {certStatus === 'expired' && (
          <Text className="mt-0.5 text-xs text-danger">Cert expired</Text>
        )}
        {certStatus === 'pending_renewal' && (
          <Text className="mt-0.5 text-xs text-warning">Cert expiring soon</Text>
        )}
      </View>

      {/* Role badge */}
      <Text className="text-xs capitalize text-slate-500">{worker.role}</Text>
    </Pressable>
  );
}
