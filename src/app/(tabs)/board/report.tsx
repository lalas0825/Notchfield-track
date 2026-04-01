import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { useProduction } from '@/features/production/hooks/useProduction';
import { useCrewStore } from '@/features/crew/store/crew-store';
import {
  saveDraft,
  submitReport,
  getExistingReport,
  todayDateString,
} from '@/features/production/services/report-service';

export default function DailyReportScreen() {
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const { activeProject } = useProjectStore();
  const { areas } = useProduction();
  const { timeEntries } = useCrewStore();

  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [summary, setSummary] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = todayDateString();

  // Calculate total man-hours from today's time entries
  const totalManHours = timeEntries.reduce((sum, e) => {
    if (e.hours) return sum + e.hours;
    if (!e.ended_at) return sum + (Date.now() - new Date(e.started_at).getTime()) / 3600000;
    return sum;
  }, 0);

  const toggleArea = (areaId: string) => {
    setSelectedAreas((prev) =>
      prev.includes(areaId) ? prev.filter((id) => id !== areaId) : [...prev, areaId],
    );
  };

  const handleSubmit = async () => {
    if (!user || !profile || !activeProject) return;
    setError(null);

    if (selectedAreas.length === 0) {
      setError('Select at least one area worked today');
      return;
    }

    setSaving(true);

    // Check for existing report
    const existing = await getExistingReport(activeProject.id, user.id, today);
    if (existing?.status === 'submitted') {
      setError('A report has already been submitted for today');
      setSaving(false);
      return;
    }

    // Save draft
    const draftResult = await saveDraft({
      projectId: activeProject.id,
      organizationId: profile.organization_id,
      foremanId: user.id,
      reportDate: today,
      areasWorked: selectedAreas,
      progressSummary: summary,
      totalManHours: Math.round(totalManHours * 10) / 10,
      photosCount: 0,
    });

    if (!draftResult.success || !draftResult.id) {
      setError(draftResult.error ?? 'Failed to save draft');
      setSaving(false);
      return;
    }

    // Submit
    const submitResult = await submitReport(draftResult.id);
    setSaving(false);

    if (submitResult.success) {
      router.back();
    } else {
      setError(submitResult.error ?? 'Failed to submit');
    }
  };

  // Group areas by floor for display
  const floorMap = new Map<string, typeof areas>();
  for (const area of areas) {
    const floor = area.floor ?? 'Unassigned';
    if (!floorMap.has(floor)) floorMap.set(floor, []);
    floorMap.get(floor)!.push(area);
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Submit Daily Report',
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#F8FAFC',
        }}
      />
      <View className="flex-1 bg-background">
        <ScrollView className="flex-1 px-4 pt-4">
          {/* Date + hours summary */}
          <View className="mb-4 flex-row items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
            <View>
              <Text className="text-sm text-slate-400">Report Date</Text>
              <Text className="text-lg font-bold text-white">{today}</Text>
            </View>
            <View className="items-end">
              <Text className="text-sm text-slate-400">Total Hours</Text>
              <Text className="text-lg font-bold text-brand-orange">
                {totalManHours.toFixed(1)}h
              </Text>
            </View>
          </View>

          {/* Area selection — big checkboxes */}
          <Text className="mb-2 text-sm font-bold uppercase text-slate-400">
            Areas Worked Today
          </Text>
          {[...floorMap.entries()].map(([floor, floorAreas]) => (
            <View key={floor} className="mb-3">
              <Text className="mb-1 text-xs text-slate-500">{floor}</Text>
              {floorAreas.map((area) => {
                const selected = selectedAreas.includes(area.id);
                return (
                  <Pressable
                    key={area.id}
                    onPress={() => toggleArea(area.id)}
                    className={`mb-1 flex-row items-center rounded-xl border px-4 py-3 active:opacity-80 ${
                      selected ? 'border-brand-orange bg-brand-orange/10' : 'border-border bg-card'
                    }`}
                  >
                    <View
                      className={`h-7 w-7 items-center justify-center rounded-lg ${
                        selected ? 'bg-brand-orange' : 'border border-slate-500'
                      }`}
                    >
                      {selected && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
                    </View>
                    <View className="ml-3 flex-row items-center">
                      {(area as any).area_code && (
                        <Text style={{ fontFamily: 'monospace', fontSize: 10, color: '#475569', backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, marginRight: 6 }}>
                          {(area as any).area_code}
                        </Text>
                      )}
                      <Text className="text-base font-medium text-white">{area.name}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}

          {/* Summary note */}
          <Text className="mb-1 mt-4 text-sm font-bold uppercase text-slate-400">
            Notes (optional)
          </Text>
          <TextInput
            value={summary}
            onChangeText={setSummary}
            placeholder="Progress summary, issues, notes for PM..."
            placeholderTextColor="#64748B"
            multiline
            className="mb-4 h-24 rounded-xl border border-border bg-card px-4 pt-3 text-base text-white"
          />

          {/* Error */}
          {error && (
            <View className="mb-4 rounded-xl bg-red-500/10 px-4 py-3">
              <Text className="text-center text-base text-danger">{error}</Text>
            </View>
          )}

          <View className="h-32" />
        </ScrollView>

        {/* Submit button — sticky bottom */}
        <View className="border-t border-border bg-card px-4 pb-8 pt-3">
          <Pressable
            onPress={handleSubmit}
            disabled={saving}
            className="h-14 flex-row items-center justify-center rounded-xl bg-success active:opacity-80"
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#FFFFFF" />
                <Text className="ml-2 text-lg font-bold text-white">Submit Report</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </>
  );
}
