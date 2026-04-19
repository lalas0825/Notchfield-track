import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/shared/lib/supabase/client';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { DOC_TYPE_LABELS, RISK_LEVELS } from '@/features/safety/types/schemas';
import { exportSafetyDoc } from '@/features/safety/services/safety-export';
import type { SafetyDocRow } from '@/features/safety/hooks/useSafetyDocs';

export default function SafetyDocDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuthStore();
  const { activeProject } = useProjectStore();
  const [doc, setDoc] = useState<SafetyDocRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    if (!doc || !activeProject) return;
    setExporting(true);
    setExportError(null);
    const result = await exportSafetyDoc(doc, activeProject.name, activeProject.organization_id);
    setExporting(false);
    if (!result.success) setExportError(result.error ?? 'Export failed');
  };

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
  // Normalize signatures so legacy (signer_name/signature_data) and new-shape
  // PTP (worker_name/signature_data_url) render through the same view.
  const signatures = (doc.signatures ?? []).map((raw: any) => ({
    signer_name: raw.signer_name ?? raw.worker_name ?? 'Unknown',
    signature_data: raw.signature_data ?? raw.signature_data_url ?? '',
    signed_at: raw.signed_at,
    sst_card_number: raw.sst_card_number ?? null,
    is_foreman: !!raw.is_foreman,
    is_walk_in: !!raw.is_walk_in,
  }));

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
        {/* Header card + Export button */}
        <View className="mb-4 rounded-2xl border border-border bg-card p-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <Text className="text-xl font-bold text-white">{doc.title}</Text>
              <Text className="mt-1 text-sm text-slate-400">
                Created {new Date(doc.created_at).toLocaleDateString()} · Status: {doc.status}
              </Text>
            </View>
            {/* Export PDF button — big, top-right, impossible to miss */}
            <Pressable
              onPress={handleExport}
              disabled={exporting}
              className="ml-3 h-12 flex-row items-center rounded-xl bg-brand-orange px-4 active:opacity-80"
            >
              <Ionicons name={exporting ? 'hourglass' : 'share-outline'} size={18} color="#FFFFFF" />
              <Text className="ml-2 text-sm font-bold text-white">
                {exporting ? 'Generating...' : 'Export PDF'}
              </Text>
            </Pressable>
          </View>
          {exportError && (
            <View className="mt-2 rounded-lg bg-red-500/10 px-3 py-2">
              <Text className="text-sm text-danger">{exportError}</Text>
            </View>
          )}
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
          <PtpDetailBody content={content} />
        )}

        {/* ─── Toolbox Talk Detail ─── */}
        {(doc.doc_type === 'toolbox' || doc.doc_type === 'toolbox_talk') && (
          <ToolboxDetailBody content={content} />
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
                  {sig.is_foreman ? (
                    <View className="ml-2 rounded-full bg-brand-orange/20 px-2 py-0.5">
                      <Text className="text-[10px] font-bold text-brand-orange">FOREMAN</Text>
                    </View>
                  ) : null}
                  {sig.is_walk_in ? (
                    <View className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5">
                      <Text className="text-[10px] font-bold text-warning">WALK-IN</Text>
                    </View>
                  ) : null}
                </View>
                <Text className="mt-1 text-sm text-slate-400">
                  {sig.sst_card_number ? `SST ${sig.sst_card_number} · ` : ''}
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

/**
 * PTP read-only renderer. Supports two shapes:
 *   - New wizard (post-Sprint PTP): selected_tasks with JHA library snapshots,
 *     optional emergency info, foreman_name, trade, ptp_date, area_label.
 *   - Legacy form: location + crew_members + tasks[{task,hazards,controls}].
 *
 * Detects the shape by the presence of `selected_tasks` (an array of objects).
 */
function PtpDetailBody({ content }: { content: Record<string, any> }) {
  const isNewShape = Array.isArray(content.selected_tasks);

  if (!isNewShape) {
    // Legacy render — preserved for any pre-wizard PTP rows still in the DB.
    return (
      <>
        <InfoRow label="Location" value={content.location} />
        <InfoRow label="Crew" value={(content.crew_members as string[] | undefined)?.join(', ')} />

        <Text className="mb-2 mt-4 text-lg font-bold text-white">
          Tasks ({(content.tasks as any[])?.length ?? 0})
        </Text>
        {(content.tasks as any[] | undefined)?.map((t: any, i: number) => (
          <View key={i} className="mb-3 rounded-xl border border-border bg-card p-4">
            <Text className="text-base font-medium text-white">{t.task}</Text>
            <Text className="mt-1 text-sm text-slate-400">Hazards: {t.hazards}</Text>
            <Text className="mt-1 text-sm text-slate-400">Controls: {t.controls}</Text>
          </View>
        ))}
      </>
    );
  }

  const tasks = content.selected_tasks as Array<{
    task_name: string;
    category?: string | null;
    hazards?: { name: string; osha_ref?: string }[];
    controls?: { name: string; category?: string }[];
    ppe_required?: string[];
  }>;
  const emergency = content.emergency as
    | {
        hospital_name?: string | null;
        hospital_address?: string | null;
        assembly_point?: string | null;
        first_aid_location?: string | null;
        contact_name?: string | null;
        contact_phone?: string | null;
      }
    | null
    | undefined;

  return (
    <>
      <InfoRow label="Date" value={content.ptp_date} />
      <InfoRow label="Shift" value={content.shift} />
      <InfoRow label="Trade" value={content.trade} />
      <InfoRow label="Area" value={content.area_label} />
      <InfoRow label="Foreman" value={content.foreman_name} />

      <Text className="mb-2 mt-4 text-lg font-bold text-white">
        Tasks ({tasks.length})
      </Text>
      {tasks.map((t, i) => (
        <View key={i} className="mb-3 rounded-xl border border-border bg-card p-4">
          <Text className="text-base font-medium text-white">{t.task_name}</Text>
          {t.category ? (
            <Text className="mt-0.5 text-xs text-slate-500">{t.category}</Text>
          ) : null}
          {t.hazards && t.hazards.length > 0 ? (
            <Text className="mt-2 text-sm text-amber-400">
              Hazards: {t.hazards.map((h) => h.name).join(' · ')}
            </Text>
          ) : null}
          {t.controls && t.controls.length > 0 ? (
            <Text className="mt-1 text-sm text-success">
              Controls: {t.controls.map((c) => c.name).join(' · ')}
            </Text>
          ) : null}
          {t.ppe_required && t.ppe_required.length > 0 ? (
            <View className="mt-2 flex-row flex-wrap gap-1">
              {t.ppe_required.map((p) => (
                <View key={p} className="rounded-lg bg-brand-orange/10 px-2 py-1">
                  <Text className="text-xs text-brand-orange">{p}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ))}

      {emergency && (emergency.hospital_name || emergency.assembly_point || emergency.contact_name) ? (
        <View className="mt-4 rounded-xl border border-border bg-card p-4">
          <Text className="mb-2 text-sm font-bold uppercase text-slate-400">Emergency</Text>
          {emergency.hospital_name ? (
            <Text className="text-sm text-white">
              🏥 {emergency.hospital_name}
              {emergency.hospital_address ? ` — ${emergency.hospital_address}` : ''}
            </Text>
          ) : null}
          {emergency.assembly_point ? (
            <Text className="mt-1 text-sm text-white">📍 Assembly: {emergency.assembly_point}</Text>
          ) : null}
          {emergency.first_aid_location ? (
            <Text className="mt-1 text-sm text-white">🩹 First aid: {emergency.first_aid_location}</Text>
          ) : null}
          {emergency.contact_name ? (
            <Text className="mt-1 text-sm text-white">
              ☎️ {emergency.contact_name}
              {emergency.contact_phone ? ` — ${emergency.contact_phone}` : ''}
            </Text>
          ) : null}
        </View>
      ) : null}

      {content.additional_notes ? (
        <View className="mt-4">
          <Text className="mb-1 text-sm font-bold uppercase text-slate-400">Notes</Text>
          <Text className="text-base text-white">{content.additional_notes}</Text>
        </View>
      ) : null}
    </>
  );
}

/**
 * Toolbox Talk read-only renderer. Supports two shapes:
 *   - New wizard: topic_snapshot (title/why_it_matters/key_points with EN+ES),
 *     scheduled_date, delivered_date, delivered_language, photo_urls,
 *     discussion_notes, foreman_name.
 *   - Legacy form: topic + discussion_points[] + attendance[].
 *
 * Detects shape by the presence of `topic_snapshot`.
 */
function ToolboxDetailBody({ content }: { content: Record<string, any> }) {
  const snap = content.topic_snapshot as
    | {
        title: string;
        title_es?: string | null;
        why_it_matters: string;
        why_it_matters_es?: string | null;
        key_points: string[];
        key_points_es?: string[] | null;
        discussion_questions?: string[];
        discussion_questions_es?: string[] | null;
        osha_ref?: string | null;
        category?: string | null;
      }
    | undefined;

  if (!snap) {
    // Legacy render — simple topic + discussion points + attendance
    return (
      <>
        <InfoRow label="Topic" value={content.topic} />
        <Text className="mb-2 mt-4 text-lg font-bold text-white">Discussion Points</Text>
        {(content.discussion_points as string[] | undefined)?.map((p: string, i: number) => (
          <View key={i} className="mb-1 flex-row items-start px-2">
            <Text className="mr-2 text-brand-orange">•</Text>
            <Text className="flex-1 text-base text-white">{p}</Text>
          </View>
        ))}
        <Text className="mb-2 mt-4 text-lg font-bold text-white">Attendance</Text>
        {(content.attendance as string[] | undefined)?.map((a: string, i: number) => (
          <View key={i} className="mb-1 flex-row items-center px-2">
            <Ionicons name="person" size={14} color="#94A3B8" />
            <Text className="ml-2 text-base text-white">{a}</Text>
          </View>
        ))}
      </>
    );
  }

  const lang = (content.delivered_language as string | undefined) ?? 'en';
  const showEs = lang === 'es' || lang === 'both';
  const keyPoints = showEs && snap.key_points_es?.length ? snap.key_points_es : snap.key_points;
  const whyItMatters =
    showEs && snap.why_it_matters_es ? snap.why_it_matters_es : snap.why_it_matters;
  const questions =
    showEs && snap.discussion_questions_es?.length
      ? snap.discussion_questions_es
      : snap.discussion_questions;

  return (
    <>
      <InfoRow label="Scheduled" value={content.scheduled_date} />
      <InfoRow label="Delivered" value={content.delivered_date} />
      <InfoRow
        label="Language"
        value={lang === 'both' ? 'EN + ES' : lang === 'es' ? 'Español' : 'English'}
      />
      <InfoRow label="Shift" value={content.shift} />
      <InfoRow label="Foreman" value={content.foreman_name} />
      <InfoRow label="Category" value={snap.category ?? undefined} />
      <InfoRow label="OSHA" value={snap.osha_ref ?? undefined} />

      <Text className="mb-2 mt-4 text-lg font-bold text-white">{snap.title}</Text>

      <View className="mb-4 rounded-xl border border-border bg-card p-4">
        <Text className="mb-1 text-xs font-bold uppercase text-slate-400">Why it matters</Text>
        <Text className="text-sm text-white">{whyItMatters}</Text>
      </View>

      <View className="mb-4 rounded-xl border border-border bg-card p-4">
        <Text className="mb-2 text-xs font-bold uppercase text-slate-400">
          Key points ({keyPoints.length})
        </Text>
        {keyPoints.map((p, i) => (
          <View key={i} className="mb-1 flex-row items-start">
            <Text className="mr-2 text-brand-orange">•</Text>
            <Text className="flex-1 text-sm text-white">{p}</Text>
          </View>
        ))}
      </View>

      {questions && questions.length > 0 ? (
        <View className="mb-4 rounded-xl border border-border bg-card p-4">
          <Text className="mb-2 text-xs font-bold uppercase text-slate-400">Discussion</Text>
          {questions.map((q, i) => (
            <View key={i} className="mb-1 flex-row items-start">
              <Text className="mr-2 text-amber-400">?</Text>
              <Text className="flex-1 text-sm text-white">{q}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {content.discussion_notes ? (
        <View className="mt-2 rounded-xl border border-border bg-card p-4">
          <Text className="mb-1 text-xs font-bold uppercase text-slate-400">Field notes</Text>
          <Text className="text-sm text-white">{content.discussion_notes}</Text>
        </View>
      ) : null}
    </>
  );
}
