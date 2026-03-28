import { ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useCheckin } from '@/features/gps/hooks/useCheckin';
import { CheckInButton } from '@/features/gps/components/CheckInButton';
import { GeofenceMap } from '@/features/gps/components/GeofenceMap';

export default function CheckinScreen() {
  const {
    position,
    isInsideFence,
    isCheckedIn,
    lastCheckin,
    loading,
    error,
    toggleCheckin,
    geofence,
    activeProject,
  } = useCheckin();

  const lastTime = lastCheckin
    ? new Date(lastCheckin.created_at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'GPS Check-in',
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#F8FAFC',
        }}
      />
      <ScrollView className="flex-1 bg-background px-6 pt-6">
        {/* Project name */}
        <View className="mb-6 items-center">
          <Text className="text-sm font-medium text-slate-400">Project</Text>
          <Text className="mt-1 text-xl font-bold text-white">
            {activeProject?.name ?? 'No project selected'}
          </Text>
          {activeProject?.address && (
            <Text className="mt-1 text-sm text-slate-500">{activeProject.address}</Text>
          )}
        </View>

        {/* Map */}
        <View className="mb-8">
          <GeofenceMap
            position={position}
            geofence={geofence}
            isInsideFence={isInsideFence}
          />
        </View>

        {/* Check-in button */}
        <CheckInButton
          isCheckedIn={isCheckedIn}
          isInsideFence={isInsideFence}
          loading={loading}
          gpsError={error}
          onPress={() => toggleCheckin(false)}
          onManualOverride={() => toggleCheckin(true)}
        />

        {/* Last check-in info */}
        {lastCheckin && (
          <View className="mt-8 items-center rounded-2xl border border-border bg-card px-4 py-4">
            <Text className="text-sm text-slate-400">
              Last {lastCheckin.type === 'check_in' || lastCheckin.type === 'auto_in' ? 'check-in' : 'check-out'}
            </Text>
            <Text className="mt-1 text-lg font-bold text-white">{lastTime}</Text>
          </View>
        )}

        {/* Error display */}
        {error && !loading && (
          <View className="mt-4 rounded-xl bg-red-500/10 px-4 py-3">
            <Text className="text-center text-base text-danger">{error}</Text>
          </View>
        )}

        {/* Spacer for bottom tab bar */}
        <View className="h-24" />
      </ScrollView>
    </>
  );
}
