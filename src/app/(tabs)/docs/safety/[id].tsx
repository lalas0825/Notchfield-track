import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/shared/lib/supabase/client';
import { DOC_TYPE_LABELS, RISK_LEVELS } from '@/features/safety/types/schemas';
import type { SafetyDocRow } from '@/features/safety/hooks/useSafetyDocs';

export default function SafetyDocDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [doc, setDoc] = useState<SafetyDocRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('safety_documents')
        .select('*')
        .eq('id', id)
        .single();
      setDoc(data as SafetyDocRow | null);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  if (!doc) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="text-base text-slate-400">Document not found</Text>
      </View>
    );
  }

  const content = doc.content as Record<string, any>;
  const signatures = (doc.signatures ?? []) as { signer_name: string; signature_data: string; signed_at: string }[];

  return (
    <>
      <Stack.Screen
        options={{
          title: `${DOC_TYPE_LABELS[doc.doc_type as keyof typeof DOC_TYPE_LABELS] ?? doc.doc_type} #${doc.number}`,
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#F8FAFC',
        }}
      />
      <ScrollView className="flex-1 bg-background px-4 pt-4">
        {/* Header card */}
        <View className="mb-4 rounded-2xl border border-border bg-card p-4">
          <Text className="text-xl font-bold text-white">{doc.title}</Text>
          <Text className="mt-1 text-sm text-slate-400">
            Created {new Date(doc.created_at).toLocaleDateString()} · Status: {doc.status}
          </Text>
        </View>

        {/* ─── JHA Detail ─── */}
        {doc.doc_type === 'jha' && content.hazards && (
          <>
            <InfoRow label="Location" value={content.location} />
            <InfoRow label="Weather" value={content.weather} />

            <Text className="mb-2 mt-4 text-lg font-bold text-white">
              Hazards ({(content.hazards as any[]).length})
            </Text>
            {(content.hazards as any[]).map((h: any, i: number) => {
              const riskConfig = RISK_LEVELS.find((r) => r.value === h.risk_level);
              return (
                <View key={i} className="mb-3 rounded-xl border border-border bg-card p-4">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-base font-medium text-white">
                      {h.description || `Hazard #${i + 1}`}
                    </Text>
                    <View
                      className="rounded-full px-2 py-0.5"
                      style={{ backgroundColor: `${riskConfig?.color ?? '#94A3B8'}20` }}
                    >
                      <Text className="text-xs font-bold" style={{ color: riskConfig?.color }}>
                        {riskConfig?.label ?? h.risk_level}
                      </Text>
                    </View>
                  </View>
                  <Text className="mt-2 text-sm text-slate-400">Controls: {h.controls}</Text>
                  {h.ppe?.length > 0 && (
                    <View className="mt-2 flex-row flex-wrap gap-1">
                      {h.ppe.map((p: string) => (
                        <View key={p} className="rounded-lg bg-brand-orange/10 px-2 py-1">
                          <Text className="text-xs text-brand-orange">{p}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}

        {/* ─── PTP Detail ─── */}
        {doc.doc_type === 'ptp' && (
          <>
            <InfoRow label="Location" value={content.location} />
            <InfoRow label="Crew" value={(content.crew_members as string[])?.join(', ')} />

            <Text className="mb-2 mt-4 text-lg font-bold text-white">
              Tasks ({(content.tasks as any[])?.length ?? 0})
            </Text>
            {(content.tasks as any[])?.map((t: any, i: number) => (
              <View key={i} className="mb-3 rounded-xl border border-border bg-card p-4">
                <Text className="text-base font-medium text-white">{t.task}</Text>
                <Text className="mt-1 text-sm text-slate-400">Hazards: {t.hazards}</Text>
                <Text className="mt-1 text-sm text-slate-400">Controls: {t.controls}</Text>
              </View>
            ))}
          </>
        )}

        {/* ─── Toolbox Talk Detail ─── */}
        {doc.doc_type === 'toolbox_talk' && (
          <>
            <InfoRow label="Topic" value={content.topic} />

            <Text className="mb-2 mt-4 text-lg font-bold text-white">Discussion Points</Text>
            {(content.discussion_points as string[])?.map((p: string, i: number) => (
              <View key={i} className="mb-1 flex-row items-start px-2">
                <Text className="mr-2 text-brand-orange">•</Text>
                <Text className="flex-1 text-base text-white">{p}</Text>
              </View>
            ))}

            <Text className="mb-2 mt-4 text-lg font-bold text-white">Attendance</Text>
            {(content.attendance as string[])?.map((a: string, i: number) => (
              <View key={i} className="mb-1 flex-row items-center px-2">
                <Ionicons name="person" size={14} color="#94A3B8" />
                <Text className="ml-2 text-base text-white">{a}</Text>
              </View>
            ))}
          </>
        )}

        {/* ─── Signatures ─── */}
        {signatures.length > 0 && (
          <View className="mt-6">
            <Text className="mb-3 text-lg font-bold text-white">
              Signatures ({signatures.length})
            </Text>
            {signatures.map((sig, i) => (
              <View key={i} className="mb-3 rounded-xl border border-border bg-card p-4">
                <View className="flex-row items-center">
                  <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
                  <Text className="ml-2 text-base font-medium text-white">{sig.signer_name}</Text>
                </View>
                <Text className="mt-1 text-sm text-slate-400">
                  Signed {new Date(sig.signed_at).toLocaleString()}
                </Text>
                {sig.signature_data && sig.signature_data.startsWith('data:') && (
                  <Image
                    source={{ uri: sig.signature_data }}
                    className="mt-2 h-16 w-full rounded-lg bg-white"
                    resizeMode="contain"
                  />
                )}
              </View>
            ))}
          </View>
        )}

        <View className="h-24" />
      </ScrollView>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <View className="mb-2 flex-row items-start">
      <Text className="w-20 text-sm text-slate-400">{label}</Text>
      <Text className="flex-1 text-base text-white">{value}</Text>
    </View>
  );
}
