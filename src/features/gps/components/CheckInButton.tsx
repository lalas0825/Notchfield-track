import { Pressable, Text, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  isCheckedIn: boolean;
  isInsideFence: boolean | null;
  loading: boolean;
  onPress: () => void;
  onManualOverride: () => void;
  gpsError: string | null;
};

export function CheckInButton({
  isCheckedIn,
  isInsideFence,
  loading,
  onPress,
  onManualOverride,
  gpsError,
}: Props) {
  const outsideFence = isInsideFence === false;
  const noGps = gpsError !== null;
  const disabled = loading;

  return (
    <View className="items-center">
      {/* Main check-in/out button — 120dp circle */}
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={isCheckedIn ? 'Check out' : 'Check in'}
        className={`h-[120px] w-[120px] items-center justify-center rounded-full ${
          isCheckedIn
            ? 'bg-danger'         // Red = tap to check out
            : outsideFence
            ? 'bg-warning'        // Amber = outside fence
            : 'bg-success'        // Green = ready to check in
        } active:opacity-80`}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#FFFFFF" />
        ) : (
          <>
            <Ionicons
              name={isCheckedIn ? 'log-out-outline' : 'log-in-outline'}
              size={40}
              color="#FFFFFF"
            />
            <Text className="mt-1 text-base font-bold text-white">
              {isCheckedIn ? 'Check Out' : 'Check In'}
            </Text>
          </>
        )}
      </Pressable>

      {/* Status label */}
      <View className="mt-4 items-center">
        {isCheckedIn && (
          <View className="flex-row items-center rounded-full bg-success/20 px-4 py-2">
            <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
            <Text className="ml-2 text-base font-medium text-success">On Site</Text>
          </View>
        )}

        {outsideFence && !isCheckedIn && (
          <View className="flex-row items-center rounded-full bg-warning/20 px-4 py-2">
            <Ionicons name="warning" size={18} color="#F59E0B" />
            <Text className="ml-2 text-base font-medium text-warning">Outside job site</Text>
          </View>
        )}

        {isInsideFence === null && !isCheckedIn && !noGps && (
          <Text className="text-base text-slate-400">No geofence configured</Text>
        )}
      </View>

      {/* Manual override — shown when GPS fails */}
      {noGps && !loading && (
        <Pressable
          onPress={onManualOverride}
          className="mt-6 h-14 flex-row items-center justify-center rounded-xl border border-border bg-card px-6 active:opacity-80"
        >
          <Ionicons name="hand-left-outline" size={20} color="#F97316" />
          <Text className="ml-2 text-base font-medium text-brand-orange">
            Manual Override
          </Text>
        </Pressable>
      )}
    </View>
  );
}
