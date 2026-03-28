import { View, Text, Platform } from 'react-native';
import type { GpsPosition } from '../services/gps-service';
import { distanceMeters } from '../services/gps-service';

type Geofence = {
  center_lat: number;
  center_lng: number;
  radius_meters: number;
  name: string | null;
};

type Props = {
  position: GpsPosition | null;
  geofence: Geofence | null;
  isInsideFence: boolean | null;
};

/**
 * Map showing user position relative to geofence.
 * Uses react-native-maps on native, falls back to text on web.
 */
export function GeofenceMap({ position, geofence, isInsideFence }: Props) {
  // Calculate distance to geofence center
  const distance =
    position && geofence
      ? distanceMeters(position.latitude, position.longitude, geofence.center_lat, geofence.center_lng)
      : null;

  // On web or if maps aren't available, show text fallback
  if (Platform.OS === 'web' || !position) {
    return (
      <View className="h-[200px] items-center justify-center rounded-2xl border border-border bg-card">
        {!position ? (
          <Text className="text-base text-slate-400">Waiting for GPS...</Text>
        ) : (
          <View className="items-center">
            <Text className="text-base text-slate-400">
              {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}
            </Text>
            {distance !== null && (
              <Text className="mt-2 text-lg font-bold text-white">
                {distance < 1000
                  ? `${Math.round(distance)}m from site`
                  : `${(distance / 1000).toFixed(1)}km from site`}
              </Text>
            )}
            {position.accuracy && (
              <Text className="mt-1 text-sm text-slate-500">
                Accuracy: ±{Math.round(position.accuracy)}m
              </Text>
            )}
          </View>
        )}
      </View>
    );
  }

  // Native: render MapView with geofence circle + user marker
  const MapView = require('react-native-maps').default;
  const { Circle, Marker } = require('react-native-maps');

  const region = geofence
    ? {
        latitude: geofence.center_lat,
        longitude: geofence.center_lng,
        latitudeDelta: (geofence.radius_meters / 111320) * 3,
        longitudeDelta: (geofence.radius_meters / 111320) * 3,
      }
    : {
        latitude: position.latitude,
        longitude: position.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };

  return (
    <View className="overflow-hidden rounded-2xl border border-border">
      <MapView
        style={{ height: 200, width: '100%' }}
        initialRegion={region}
        showsUserLocation={false}
        customMapStyle={darkMapStyle}
      >
        {/* User position marker */}
        <Marker
          coordinate={{
            latitude: position.latitude,
            longitude: position.longitude,
          }}
          title="You"
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: isInsideFence ? '#22C55E' : '#F59E0B',
              borderWidth: 3,
              borderColor: '#FFFFFF',
            }}
          />
        </Marker>

        {/* Geofence circle */}
        {geofence && (
          <Circle
            center={{
              latitude: geofence.center_lat,
              longitude: geofence.center_lng,
            }}
            radius={geofence.radius_meters}
            strokeColor="rgba(249, 115, 22, 0.8)"
            fillColor="rgba(249, 115, 22, 0.1)"
            strokeWidth={2}
          />
        )}
      </MapView>

      {/* Distance overlay */}
      {distance !== null && (
        <View className="absolute bottom-3 left-3 rounded-lg bg-background/80 px-3 py-1">
          <Text className="text-sm font-bold text-white">
            {distance < 1000
              ? `${Math.round(distance)}m`
              : `${(distance / 1000).toFixed(1)}km`}
          </Text>
        </View>
      )}
    </View>
  );
}

// Minimal dark map style for Google Maps
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1E293B' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94A3B8' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0F172A' }] },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#334155' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0F172A' }],
  },
];
