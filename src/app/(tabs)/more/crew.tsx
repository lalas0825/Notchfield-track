import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCrew } from '@/features/crew/hooks/useCrew';
import { WorkerCard } from '@/features/crew/components/WorkerCard';
import { AreaPicker } from '@/features/crew/components/AreaPicker';

type Step = 'workers' | 'area';

export default function CrewScreen() {
  const {
    workers,
    areas,
    assignments,
    todayHours,
    assignWorker,
    endDay,
    getWorkerAssignment,
    getAreaWorkers,
  } = useCrew();

  const [step, setStep] = useState<Step>('workers');
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const toggleWorker = (id: string) => {
    setSelectedWorkers((prev) =>
      prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id],
    );
  };

  const handleAssign = async () => {
    if (!selectedArea || selectedWorkers.length === 0) return;

    setAssigning(true);
    for (const workerId of selectedWorkers) {
      await assignWorker(workerId, selectedArea);
    }
    setAssigning(false);
    setSelectedWorkers([]);
    setSelectedArea(null);
    setStep('workers');
  };

  const handleEndDay = () => {
    Alert.alert(
      'End Day',
      'Close all time entries and clear assignments? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Day',
          style: 'destructive',
          onPress: async () => {
            await endDay();
          },
        },
      ],
    );
  };

  // Area name lookup for display
  const areaName = (areaId: string) =>
    areas.find((a) => a.id === areaId)?.name ?? 'Unknown';

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Crew Management',
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#F8FAFC',
        }}
      />
      <View className="flex-1 bg-background">
        {/* Summary bar */}
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <View className="flex-row items-center">
            <Ionicons name="people" size={18} color="#F97316" />
            <Text className="ml-2 text-base font-medium text-white">
              {assignments.length} assigned
            </Text>
          </View>
          <View className="flex-row items-center">
            <Ionicons name="time" size={18} color="#22C55E" />
            <Text className="ml-2 text-base font-medium text-white">
              {todayHours.toFixed(1)}h today
            </Text>
          </View>
        </View>

        {/* Step indicator */}
        <View className="flex-row border-b border-border">
          <Pressable
            onPress={() => setStep('workers')}
            className={`flex-1 items-center py-3 ${step === 'workers' ? 'border-b-2 border-brand-orange' : ''}`}
          >
            <Text className={`text-base font-medium ${step === 'workers' ? 'text-brand-orange' : 'text-slate-400'}`}>
              1. Select Workers
            </Text>
          </Pressable>
          <Pressable
            onPress={() => selectedWorkers.length > 0 && setStep('area')}
            className={`flex-1 items-center py-3 ${step === 'area' ? 'border-b-2 border-brand-orange' : ''}`}
          >
            <Text className={`text-base font-medium ${step === 'area' ? 'text-brand-orange' : 'text-slate-400'}`}>
              2. Pick Area
            </Text>
          </Pressable>
        </View>

        {/* Content */}
        <ScrollView className="flex-1 px-4 pt-4">
          {step === 'workers' && (
            <>
              {workers.length === 0 ? (
                <View className="items-center py-12">
                  <Ionicons name="people-outline" size={48} color="#334155" />
                  <Text className="mt-4 text-center text-base text-slate-400">
                    No workers in your organization.
                  </Text>
                </View>
              ) : (
                workers.map((worker) => {
                  const assignment = getWorkerAssignment(worker.id);
                  return (
                    <WorkerCard
                      key={worker.id}
                      worker={worker}
                      currentArea={assignment ? areaName(assignment.area_id) : null}
                      selected={selectedWorkers.includes(worker.id)}
                      onPress={() => toggleWorker(worker.id)}
                    />
                  );
                })
              )}
            </>
          )}

          {step === 'area' && (
            <AreaPicker
              areas={areas}
              selectedAreaId={selectedArea}
              onSelect={setSelectedArea}
              getAreaWorkers={getAreaWorkers}
            />
          )}

          <View className="h-32" />
        </ScrollView>

        {/* Bottom action bar */}
        <View className="border-t border-border bg-card px-4 pb-8 pt-3">
          {step === 'workers' && selectedWorkers.length > 0 && (
            <Pressable
              onPress={() => setStep('area')}
              className="h-14 flex-row items-center justify-center rounded-xl bg-brand-orange active:opacity-80"
            >
              <Text className="text-lg font-bold text-white">
                Next — Pick Area ({selectedWorkers.length} selected)
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
            </Pressable>
          )}

          {step === 'area' && selectedArea && (
            <Pressable
              onPress={handleAssign}
              disabled={assigning}
              className="h-14 flex-row items-center justify-center rounded-xl bg-success active:opacity-80"
            >
              {assigning ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
                  <Text className="ml-2 text-lg font-bold text-white">
                    Assign {selectedWorkers.length} → {areaName(selectedArea)}
                  </Text>
                </>
              )}
            </Pressable>
          )}

          {step === 'workers' && selectedWorkers.length === 0 && assignments.length > 0 && (
            <Pressable
              onPress={handleEndDay}
              className="h-14 flex-row items-center justify-center rounded-xl border border-danger active:opacity-80"
            >
              <Ionicons name="moon" size={20} color="#EF4444" />
              <Text className="ml-2 text-lg font-bold text-danger">End Day</Text>
            </Pressable>
          )}
        </View>
      </View>
    </>
  );
}
