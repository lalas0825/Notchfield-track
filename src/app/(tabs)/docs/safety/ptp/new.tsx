/**
 * New PTP entry — gathers foreman context, resolves trade, creates a draft,
 * then redirects to the wizard at `/(tabs)/docs/safety/ptp/[id]`.
 *
 * Auto-fill promise: the foreman writes nothing. Everything is either
 * derived or a single tap.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { supabase } from '@/shared/lib/supabase/client';
import { localQuery } from '@/shared/lib/powersync/write';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { useCrewStore } from '@/features/crew/store/crew-store';
import {
  createDraftPtp,
  getYesterdaysPtp,
  updatePtpContent,
} from '@/features/safety/ptp/services/ptpService';
import { getAvailableTradesForOrg } from '@/features/safety/ptp/services/jhaLibraryService';
import {
  PtpContentSchema,
  type PtpContent,
  type PtpEmergencySnapshot,
  type Trade,
} from '@/features/safety/ptp/types';

type ProjectEmergencyRow = {
  id: string;
  name: string;
  address: string | null;
  emergency_hospital_name: string | null;
  emergency_hospital_address: string | null;
  emergency_hospital_distance: string | null;
  emergency_assembly_point: string | null;
  emergency_first_aid_location: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  safety_distribution_emails: string | string[] | null;
};

type AreaRow = { id: string; name: string; floor: string | null };

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export default function NewPtpScreen() {
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const { activeProject } = useProjectStore();
  const { areas, assignments } = useCrewStore();

  const [project, setProject] = useState<ProjectEmergencyRow | null>(null);
  const [availableTrades, setAvailableTrades] = useState<Trade[]>([]);
  const [trade, setTrade] = useState<Trade | null>(null);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [yesterdayDocId, setYesterdayDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Today's foreman assignment pulls the area into scope automatically.
  const foremanAssignment = user
    ? assignments.find((a) => a.worker_id === user.id)
    : undefined;

  useEffect(() => {
    async function loadContext() {
      if (!profile || !activeProject) return;
      setLoading(true);
      try {
        // Load project with emergency fields — prefer PowerSync local, fall back
        // to Supabase REST.
        const local = await localQuery<ProjectEmergencyRow>(
          `SELECT * FROM projects WHERE id = ? LIMIT 1`,
          [activeProject.id],
        );
        let row: ProjectEmergencyRow | null = null;
        if (local && local.length > 0) {
          row = local[0];
        } else {
          const { data } = await supabase
            .from('projects')
            .select(
              'id, name, address, emergency_hospital_name, emergency_hospital_address, emergency_hospital_distance, emergency_assembly_point, emergency_first_aid_location, emergency_contact_name, emergency_contact_phone, safety_distribution_emails',
            )
            .eq('id', activeProject.id)
            .maybeSingle();
          row = (data ?? null) as ProjectEmergencyRow | null;
        }
        setProject(row);

        // Resolve trades. Sprint spec: profiles.trade first, fallback to
        // organizations.primary_trades. We don't have profiles.trade in
        // production, so just list every trade present in jha_library for
        // this org and let the foreman pick if >1.
        const trades = await getAvailableTradesForOrg(profile.organization_id);
        setAvailableTrades(trades);
        if (trades.length === 1) setTrade(trades[0]);

        // Pre-select area from current crew assignment
        if (foremanAssignment) setAreaId(foremanAssignment.area_id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load project');
      } finally {
        setLoading(false);
      }
    }
    loadContext();
  }, [profile, activeProject, foremanAssignment]);

  // Copy-from-yesterday lookup — fires whenever area + user are settled
  useEffect(() => {
    async function lookup() {
      if (!user || !areaId) return;
      const prev = await getYesterdaysPtp(user.id, areaId);
      setYesterdayDocId(prev?.id ?? null);
    }
    lookup();
  }, [user, areaId]);

  if (loading || !profile || !user || !activeProject) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#F97316" />
      </View>
    );
  }

  const buildEmergencySnapshot = (): PtpEmergencySnapshot | null => {
    if (!project) return null;
    const hasAny =
      project.emergency_hospital_name ||
      project.emergency_assembly_point ||
      project.emergency_first_aid_location ||
      project.emergency_contact_name;
    if (!hasAny) return null;
    return {
      hospital_name: project.emergency_hospital_name,
      hospital_address: project.emergency_hospital_address,
      hospital_distance: project.emergency_hospital_distance,
      assembly_point: project.emergency_assembly_point,
      first_aid_location: project.emergency_first_aid_location,
      contact_name: project.emergency_contact_name,
      contact_phone: project.emergency_contact_phone,
    };
  };

  const startFresh = async () => {
    if (!trade || !activeProject || !profile || !user) return;
    setBusy(true);
    setError(null);
    const area = areas.find((a) => a.id === areaId);
    const areaLabel = area
      ? `${area.floor ?? ''} · ${area.name}`.trim().replace(/^·\s*/, '')
      : '';
    const result = await createDraftPtp({
      organizationId: profile.organization_id,
      projectId: activeProject.id,
      foremanId: user.id,
      foremanName: profile.full_name ?? user.email ?? 'Foreman',
      trade,
      areaId,
      areaLabel,
      date: new Date().toISOString().slice(0, 10),
      shift: 'day',
      emergency: buildEmergencySnapshot() ?? undefined,
    });
    setBusy(false);
    if (!result.success || !result.id) {
      setError(result.error ?? 'Could not create PTP');
      return;
    }
    router.replace(`/(tabs)/docs/safety/ptp/${result.id}`);
  };

  const copyFromYesterday = async () => {
    if (!yesterdayDocId || !user || !profile || !activeProject) return;
    setBusy(true);
    setError(null);

    // Create a fresh draft
    const fresh = await createDraftPtp({
      organizationId: profile.organization_id,
      projectId: activeProject.id,
      foremanId: user.id,
      foremanName: profile.full_name ?? user.email ?? 'Foreman',
      trade: trade ?? ('tile' as Trade),
      areaId,
      areaLabel: '',
      date: new Date().toISOString().slice(0, 10),
      shift: 'day',
      emergency: buildEmergencySnapshot() ?? undefined,
    });

    if (!fresh.success || !fresh.id) {
      setError(fresh.error ?? 'Could not create PTP');
      setBusy(false);
      return;
    }

    // Load yesterday's doc and copy selected_tasks + additional_hazards +
    // osha_citations_included into the new draft. Reset signatures (new crew).
    const yesterday = await getYesterdaysPtp(user.id, areaId ?? '');
    if (yesterday) {
      const prevContent = yesterday.content as PtpContent;
      const nextContent: PtpContent = PtpContentSchema.parse({
        area_id: areaId,
        area_label: prevContent.area_label,
        ptp_date: new Date().toISOString().slice(0, 10),
        shift: prevContent.shift,
        weather: null,
        trade: prevContent.trade,
        selected_tasks: prevContent.selected_tasks ?? [],
        additional_hazards: prevContent.additional_hazards ?? [],
        emergency: buildEmergencySnapshot() ?? null,
        foreman_id: user.id,
        foreman_name: profile.full_name ?? user.email ?? 'Foreman',
        foreman_gps: null,
        additional_notes: prevContent.additional_notes ?? '',
        photo_urls: [],
        osha_citations_included: prevContent.osha_citations_included ?? true,
      });
      await updatePtpContent(fresh.id, nextContent);
    }

    setBusy(false);
    router.replace(`/(tabs)/docs/safety/ptp/${fresh.id}?step=review`);
  };

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <>
      <Stack.Screen
        options={{
          title: 'New PTP',
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#F8FAFC',
        }}
      />
      <ScrollView className="flex-1 bg-background px-4 pt-4" keyboardShouldPersistTaps="handled">
        {/* Context card */}
        <View className="mb-6 rounded-2xl border border-border bg-card p-4">
          <Context icon="location" label="Project" value={activeProject.name} />
          {project?.address ? (
            <Context icon="map" label="Address" value={project.address} indent />
          ) : null}
          <Context icon="calendar" label="Date" value={dateLabel} />
          <Context icon="person" label="Foreman" value={profile.full_name ?? user.email ?? ''} />
          <AreaPicker
            areas={areas as AreaRow[]}
            selectedId={areaId}
            onSelect={setAreaId}
          />
          <TradePicker
            available={availableTrades}
            selected={trade}
            onSelect={setTrade}
          />
        </View>

        {/* Copy from yesterday CTA */}
        {yesterdayDocId ? (
          <Pressable
            onPress={copyFromYesterday}
            disabled={busy}
            className="mb-3 rounded-2xl border border-brand-orange bg-brand-orange/10 p-4 active:opacity-80"
          >
            <View className="flex-row items-center">
              <Ionicons name="copy" size={22} color="#F97316" />
              <View className="ml-3 flex-1">
                <Text className="text-base font-bold text-brand-orange">Copy from yesterday</Text>
                <Text className="text-sm text-slate-400">
                  Tasks and hazards preloaded — new crew signs today
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#F97316" />
            </View>
          </Pressable>
        ) : null}

        {/* Start fresh */}
        <Pressable
          onPress={startFresh}
          disabled={busy || !trade}
          className="mb-4 h-14 items-center justify-center rounded-2xl bg-brand-orange active:opacity-80"
          style={{ opacity: !trade || busy ? 0.5 : 1 }}
        >
          <Text className="text-lg font-bold text-white">
            {busy ? 'Creating…' : trade ? 'Start fresh PTP' : 'Select a trade first'}
          </Text>
        </Pressable>

        {error ? (
          <View className="mb-4 rounded-xl bg-red-500/10 px-4 py-3">
            <Text className="text-center text-base text-danger">{error}</Text>
          </View>
        ) : null}

        <View className="h-24" />
      </ScrollView>
    </>
  );
}

function Context({
  icon,
  label,
  value,
  indent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  indent?: boolean;
}) {
  return (
    <View className={`flex-row items-center ${indent ? 'mt-0 ml-6' : 'mt-2 first:mt-0'}`}>
      {!indent ? <Ionicons name={icon} size={16} color="#94A3B8" /> : null}
      <Text className={`ml-${indent ? '0' : '2'} text-xs uppercase text-slate-500`}>{label}</Text>
      <Text className="ml-2 flex-1 text-base font-medium text-white" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function AreaPicker({
  areas,
  selectedId,
  onSelect,
}: {
  areas: AreaRow[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  if (areas.length === 0) return null;
  return (
    <View className="mt-3">
      <Text className="mb-1 text-xs uppercase text-slate-500">Area</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Pressable
          onPress={() => onSelect(null)}
          className={`mr-2 h-10 items-center justify-center rounded-xl px-3 ${
            selectedId === null ? 'bg-brand-orange/20 border border-brand-orange' : 'border border-border'
          }`}
        >
          <Text className={`text-sm ${selectedId === null ? 'text-brand-orange' : 'text-slate-400'}`}>
            General
          </Text>
        </Pressable>
        {areas.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => onSelect(a.id)}
            className={`mr-2 h-10 items-center justify-center rounded-xl px-3 ${
              selectedId === a.id ? 'bg-brand-orange/20 border border-brand-orange' : 'border border-border'
            }`}
          >
            <Text className={`text-sm ${selectedId === a.id ? 'text-brand-orange' : 'text-slate-400'}`}>
              {a.floor ? `${a.floor} · ${a.name}` : a.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function TradePicker({
  available,
  selected,
  onSelect,
}: {
  available: Trade[];
  selected: Trade | null;
  onSelect: (t: Trade) => void;
}) {
  if (available.length === 0) {
    return (
      <View className="mt-3">
        <Text className="text-xs uppercase text-slate-500">Trade</Text>
        <Text className="mt-1 text-sm text-slate-400">
          No JHA library tasks found — PM must seed library first
        </Text>
      </View>
    );
  }
  return (
    <View className="mt-3">
      <Text className="mb-1 text-xs uppercase text-slate-500">Trade</Text>
      <View className="flex-row flex-wrap gap-2">
        {available.map((t) => (
          <Pressable
            key={t}
            onPress={() => onSelect(t)}
            className={`h-9 items-center justify-center rounded-xl px-3 ${
              selected === t ? 'bg-brand-orange/20 border border-brand-orange' : 'border border-border'
            }`}
          >
            <Text className={`text-sm capitalize ${selected === t ? 'text-brand-orange' : 'text-slate-400'}`}>
              {t}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// Suppress unused import warning — buildEmergencySnapshot references this
// through field access; keep the type available for readers.
export type { PtpEmergencySnapshot };

// Utility kept for future use when we switch to safety_distribution_emails
// populated from the project row at draft creation.
export function parseDistributionEmails(value: unknown): string[] {
  return parseJson<string[]>(value, []);
}
