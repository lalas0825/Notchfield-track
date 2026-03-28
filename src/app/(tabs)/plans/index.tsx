import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDrawings, type Drawing } from '@/features/plans/hooks/useDrawings';

export default function PlansScreen() {
  const router = useRouter();
  const { grouped, loading } = useDrawings();
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleCollapse = (discipline: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(discipline)) next.delete(discipline);
      else next.add(discipline);
      return next;
    });
  };

  // Filter by search
  const filtered = search.trim()
    ? grouped
        .map((g) => ({
          ...g,
          drawings: g.drawings.filter(
            (d) =>
              (d.label ?? '').toLowerCase().includes(search.toLowerCase()) ||
              d.set_name.toLowerCase().includes(search.toLowerCase()),
          ),
        }))
        .filter((g) => g.drawings.length > 0)
    : grouped;

  const totalSheets = filtered.reduce((sum, g) => sum + g.drawings.length, 0);

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="border-b border-border px-4 pb-3 pt-2">
        <Text className="text-sm text-slate-400">
          {totalSheets} sheet{totalSheets !== 1 ? 's' : ''}
        </Text>
        <View className="mt-2 flex-row items-center rounded-xl border border-border bg-card px-3">
          <Ionicons name="search" size={18} color="#64748B" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search sheets..."
            placeholderTextColor="#64748B"
            className="ml-2 h-12 flex-1 text-base text-white"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#64748B" />
            </Pressable>
          )}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#F97316" />
        </View>
      ) : filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="map-outline" size={48} color="#334155" />
          <Text className="mt-4 text-center text-base text-slate-400">
            {search ? 'No sheets match your search.' : 'No drawings uploaded yet.\nDrawings are added in Takeoff web.'}
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-4 pt-2">
          {filtered.map((group) => {
            const isCollapsed = collapsed.has(group.discipline);
            const cachedCount = group.drawings.filter((d) => d.is_cached).length;

            return (
              <View key={group.discipline} className="mb-4">
                {/* Discipline header */}
                <Pressable
                  onPress={() => toggleCollapse(group.discipline)}
                  className="mb-2 flex-row items-center justify-between"
                >
                  <View className="flex-row items-center">
                    <Ionicons
                      name={isCollapsed ? 'chevron-forward' : 'chevron-down'}
                      size={16}
                      color="#94A3B8"
                    />
                    <Text className="ml-1 text-sm font-bold uppercase text-slate-400">
                      {group.discipline}
                    </Text>
                    <Text className="ml-2 text-xs text-slate-600">
                      {group.drawings.length} sheet{group.drawings.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  {cachedCount > 0 && (
                    <View className="flex-row items-center">
                      <Ionicons name="cloud-done" size={12} color="#22C55E" />
                      <Text className="ml-1 text-xs text-slate-500">
                        {cachedCount}/{group.drawings.length}
                      </Text>
                    </View>
                  )}
                </Pressable>

                {/* Sheet rows */}
                {!isCollapsed &&
                  group.drawings.map((drawing) => (
                    <SheetRow
                      key={drawing.id}
                      drawing={drawing}
                      onPress={() =>
                        router.push({
                          pathname: '/(tabs)/plans/[id]' as any,
                          params: {
                            id: drawing.id,
                            filePath: drawing.file_path,
                            pageNumber: String(drawing.page_number),
                            label: drawing.label ?? drawing.set_name,
                          },
                        })
                      }
                    />
                  ))}
              </View>
            );
          })}
          <View className="h-24" />
        </ScrollView>
      )}
    </View>
  );
}

function SheetRow({ drawing, onPress }: { drawing: Drawing; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="mb-1.5 flex-row items-center rounded-xl border border-border bg-card px-4 py-3 active:opacity-80"
    >
      {/* Sheet icon + label */}
      <View className="h-10 w-10 items-center justify-center rounded-lg bg-slate-700">
        <Text className="text-xs font-bold text-white">
          {drawing.label?.slice(0, 4) ?? `P${drawing.page_number}`}
        </Text>
      </View>

      <View className="ml-3 flex-1">
        <Text className="text-base font-medium text-white">
          {drawing.label ?? `Page ${drawing.page_number}`}
        </Text>
        <Text className="text-sm text-slate-500">{drawing.set_name}</Text>
      </View>

      {/* Badges */}
      <View className="flex-row items-center gap-2">
        {/* Revision badge */}
        {drawing.latest_revision && (
          <View
            className={`rounded-full px-2 py-0.5 ${
              drawing.has_new_revision
                ? 'bg-warning/20'
                : 'bg-slate-700'
            }`}
          >
            <Text
              className={`text-xs font-bold ${
                drawing.has_new_revision ? 'text-warning' : 'text-slate-400'
              }`}
            >
              {drawing.latest_revision}
            </Text>
          </View>
        )}

        {/* Offline indicator */}
        <Ionicons
          name={drawing.is_cached ? 'cloud-done' : 'cloud-download-outline'}
          size={16}
          color={drawing.is_cached ? '#22C55E' : '#64748B'}
        />
      </View>
    </Pressable>
  );
}
