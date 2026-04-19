/**
 * Screen 2 — Task selection.
 *
 * Shows the JHA library filtered by trade. Tap to select/deselect. Shows a
 * preview of the first 3 hazards under each task. "Continue" deep-copies
 * hazards/controls/PPE into the PTP's selected_tasks snapshots.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { JhaLibraryItem, PtpSelectedTask } from '../types';

type Props = {
  items: JhaLibraryItem[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onContinue: (selected: PtpSelectedTask[]) => void;
  onBack: () => void;
  loading: boolean;
};

export function PtpTaskPicker({
  items,
  selectedIds,
  onToggle,
  onContinue,
  onBack,
  loading,
}: Props) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) if (it.category) set.add(it.category);
    return [...set].sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (categoryFilter && it.category !== categoryFilter) return false;
      if (!q) return true;
      const blob = [
        it.task_name,
        it.category ?? '',
        ...it.hazards.map((h) => h.name),
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [items, search, categoryFilter]);

  const handleContinue = () => {
    const selected: PtpSelectedTask[] = items
      .filter((it) => selectedIds.has(it.id))
      .map((it) => ({
        jha_library_id: it.id,
        task_name: it.task_name,
        category: it.category,
        hazards: it.hazards,
        controls: it.controls,
        ppe_required: it.ppe_required,
      }));
    onContinue(selected);
  };

  return (
    <View className="flex-1 bg-background">
      {/* Search */}
      <View className="px-4 pt-2">
        <View className="mb-2 flex-row items-center rounded-xl border border-border bg-card px-3">
          <Ionicons name="search" size={18} color="#94A3B8" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search tasks or hazards"
            placeholderTextColor="#64748B"
            className="h-12 flex-1 pl-2 text-base text-white"
          />
        </View>
      </View>

      {/* Category filter chips */}
      {categories.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4">
          <Pressable
            onPress={() => setCategoryFilter(null)}
            className={`mr-2 mb-2 h-9 items-center justify-center rounded-xl px-3 ${
              categoryFilter === null ? 'bg-brand-orange/20 border border-brand-orange' : 'border border-border'
            }`}
          >
            <Text className={`text-sm ${categoryFilter === null ? 'text-brand-orange' : 'text-slate-400'}`}>
              All
            </Text>
          </Pressable>
          {categories.map((c) => (
            <Pressable
              key={c}
              onPress={() => setCategoryFilter(c)}
              className={`mr-2 mb-2 h-9 items-center justify-center rounded-xl px-3 ${
                categoryFilter === c ? 'bg-brand-orange/20 border border-brand-orange' : 'border border-border'
              }`}
            >
              <Text className={`text-sm ${categoryFilter === c ? 'text-brand-orange' : 'text-slate-400'}`}>
                {c}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {/* Task list */}
      <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled">
        {loading ? (
          <Text className="mt-8 text-center text-slate-400">Loading library…</Text>
        ) : filtered.length === 0 ? (
          <Text className="mt-8 text-center text-slate-400">No tasks match</Text>
        ) : (
          filtered.map((it) => {
            const checked = selectedIds.has(it.id);
            const hazardPreview = it.hazards
              .slice(0, 3)
              .map((h) => h.name)
              .join(' · ');
            return (
              <Pressable
                key={it.id}
                onPress={() => onToggle(it.id)}
                className={`mb-2 rounded-xl border px-4 py-3 ${
                  checked ? 'border-brand-orange bg-brand-orange/10' : 'border-border bg-card'
                }`}
              >
                <View className="flex-row items-center">
                  <Ionicons
                    name={checked ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={checked ? '#F97316' : '#64748B'}
                  />
                  <View className="ml-3 flex-1">
                    <Text className="text-base font-medium text-white" numberOfLines={2}>
                      {it.task_name}
                    </Text>
                    {it.category ? (
                      <Text className="text-xs text-slate-500">{it.category}</Text>
                    ) : null}
                    {hazardPreview ? (
                      <View className="mt-1 flex-row items-center">
                        <Ionicons name="warning" size={12} color="#F59E0B" />
                        <Text className="ml-1 flex-1 text-xs text-amber-400" numberOfLines={1}>
                          {hazardPreview}
                          {it.hazards.length > 3 ? ` · +${it.hazards.length - 3} more` : ''}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
        <View className="h-32" />
      </ScrollView>

      {/* Footer */}
      <View className="flex-row items-center border-t border-border bg-card px-4 py-3">
        <Pressable
          onPress={onBack}
          className="mr-2 h-12 w-24 items-center justify-center rounded-xl border border-border"
        >
          <Text className="text-base text-slate-400">Back</Text>
        </Pressable>
        <Pressable
          onPress={handleContinue}
          disabled={selectedIds.size === 0}
          className="ml-2 h-12 flex-1 items-center justify-center rounded-xl bg-brand-orange"
          style={{ opacity: selectedIds.size === 0 ? 0.4 : 1 }}
        >
          <Text className="text-base font-bold text-white">
            {selectedIds.size === 0
              ? 'Select at least one task'
              : `Continue — ${selectedIds.size} task${selectedIds.size === 1 ? '' : 's'}`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
