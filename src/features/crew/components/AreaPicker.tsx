import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Area, Worker } from '../store/crew-store';

type Props = {
  areas: Area[];
  selectedAreaId: string | null;
  onSelect: (areaId: string) => void;
  getAreaWorkers: (areaId: string) => Worker[];
};

export function AreaPicker({ areas, selectedAreaId, onSelect, getAreaWorkers }: Props) {
  if (areas.length === 0) {
    return (
      <View className="items-center rounded-xl border border-border bg-card px-4 py-8">
        <Ionicons name="grid-outline" size={32} color="#334155" />
        <Text className="mt-2 text-center text-base text-slate-400">
          No areas in this project yet.{'\n'}Areas are created in Takeoff web.
        </Text>
      </View>
    );
  }

  // Group by floor
  const floors = new Map<string, Area[]>();
  for (const area of areas) {
    const floor = area.floor ?? 'Unassigned';
    if (!floors.has(floor)) floors.set(floor, []);
    floors.get(floor)!.push(area);
  }

  return (
    <ScrollView horizontal={false}>
      {[...floors.entries()].map(([floor, floorAreas]) => (
        <View key={floor} className="mb-4">
          <Text className="mb-2 text-sm font-bold uppercase text-slate-500">
            {floor}
          </Text>
          {floorAreas.map((area) => {
            const workers = getAreaWorkers(area.id);
            const selected = selectedAreaId === area.id;

            return (
              <Pressable
                key={area.id}
                onPress={() => onSelect(area.id)}
                className={`mb-2 rounded-xl border px-4 py-3 active:opacity-80 ${
                  selected
                    ? 'border-brand-orange bg-brand-orange/10'
                    : 'border-border bg-card'
                }`}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={selected ? '#F97316' : '#64748B'}
                    />
                    <Text className="ml-2 text-base font-medium text-white">
                      {area.name}
                    </Text>
                  </View>
                  {workers.length > 0 && (
                    <View className="flex-row items-center">
                      <Ionicons name="people" size={14} color="#94A3B8" />
                      <Text className="ml-1 text-sm text-slate-400">{workers.length}</Text>
                    </View>
                  )}
                </View>
                {workers.length > 0 && (
                  <Text className="mt-1 ml-7 text-sm text-slate-500" numberOfLines={1}>
                    {workers.map((w) => w.full_name).join(', ')}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}
