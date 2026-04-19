/**
 * Screen 4 — Crew signatures.
 *
 * Foreman signs first (GPS captured). Then passes the device to each crew
 * member — sequential workflow, one canvas, one-shot sign per worker.
 * Walk-in workers (not in crew list) captured via a modal.
 *
 * All signatures append to safety_documents.signatures JSONB array.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { supabase } from '@/shared/lib/supabase/client';
import { localQuery } from '@/shared/lib/powersync/write';
import { SignaturePad } from '@/features/safety/components/SignaturePad';
import type { PtpSignature } from '../types';

type CrewMember = {
  id: string | null;
  full_name: string;
  sst_card_number: string | null;
  is_walk_in: boolean;
};

type Props = {
  docId: string;
  foremanId: string;
  foremanName: string;
  crewWorkerIds: string[]; // from crew_assignments
  organizationId: string;
  signatures: PtpSignature[];
  onAddSignature: (sig: PtpSignature) => Promise<{ success: boolean; error?: string }>;
  onRemoveSignature: (index: number) => Promise<{ success: boolean; error?: string }>;
  onContinue: () => void;
  onBack: () => void;
};

async function loadCrewMembers(
  workerIds: string[],
  organizationId: string,
): Promise<CrewMember[]> {
  if (workerIds.length === 0) return [];
  const inList = workerIds.map((id) => `'${id}'`).join(',');
  const local = await localQuery<{
    id: string;
    full_name: string | null;
    sst_card_number: string | null;
  }>(
    `SELECT id, full_name, sst_card_number FROM profiles WHERE id IN (${inList})`,
    [],
  );
  if (local && local.length > 0) {
    return local.map((r) => ({
      id: r.id,
      full_name: r.full_name ?? 'Unknown',
      sst_card_number: r.sst_card_number,
      is_walk_in: false,
    }));
  }

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, sst_card_number')
    .in('id', workerIds)
    .eq('organization_id', organizationId);
  return (data ?? []).map((r) => ({
    id: r.id,
    full_name: r.full_name ?? 'Unknown',
    sst_card_number: r.sst_card_number ?? null,
    is_walk_in: false,
  }));
}

export function PtpSignatures({
  docId: _docId,
  foremanId,
  foremanName,
  crewWorkerIds,
  organizationId,
  signatures,
  onAddSignature,
  onRemoveSignature,
  onContinue,
  onBack,
}: Props) {
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [activeSigner, setActiveSigner] = useState<CrewMember | null>(null);
  const [busy, setBusy] = useState(false);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInName, setWalkInName] = useState('');
  const [walkInSst, setWalkInSst] = useState('');

  const reloadCrew = useCallback(async () => {
    const members = await loadCrewMembers(crewWorkerIds, organizationId);
    // Foreman is captured separately; if foreman happens to be in crew list
    // drop them to avoid double-signing.
    setCrew(members.filter((m) => m.id !== foremanId));
  }, [crewWorkerIds, organizationId, foremanId]);

  useEffect(() => {
    reloadCrew();
  }, [reloadCrew]);

  const signerSigned = (signerId: string | null, name: string): number => {
    return signatures.findIndex((s) =>
      signerId ? s.worker_id === signerId : s.worker_name === name && s.is_walk_in,
    );
  };

  const captureSignature = async (base64: string) => {
    if (!activeSigner) return;
    setBusy(true);

    const isForeman = activeSigner.id === foremanId;
    let gps: { latitude: number; longitude: number } | null = null;

    if (isForeman) {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          gps = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        }
      } catch {
        // GPS is best-effort. Foreman signature still captured.
      }
    }

    const sig: PtpSignature = {
      worker_id: activeSigner.id,
      worker_name: activeSigner.full_name,
      sst_card_number: activeSigner.sst_card_number ?? null,
      signature_data_url: base64,
      signed_at: new Date().toISOString(),
      is_foreman: isForeman,
      is_walk_in: activeSigner.is_walk_in,
      gps,
    };

    const result = await onAddSignature(sig);
    setBusy(false);
    if (!result.success) {
      Alert.alert('Failed to save signature', result.error ?? 'Unknown error');
      return;
    }
    setActiveSigner(null);
  };

  const startWalkIn = () => {
    if (!walkInName.trim()) {
      Alert.alert('Name required', 'Enter the walk-in worker\'s name.');
      return;
    }
    setActiveSigner({
      id: null,
      full_name: walkInName.trim(),
      sst_card_number: walkInSst.trim() || null,
      is_walk_in: true,
    });
    setWalkInName('');
    setWalkInSst('');
    setWalkInOpen(false);
  };

  const foremanSigned = signerSigned(foremanId, foremanName) >= 0;
  const totalExpected = 1 + crew.length; // foreman + crew
  const totalSigned = signatures.length;

  // Active signer canvas — overrides the list view
  if (activeSigner) {
    return (
      <View className="flex-1 bg-background px-4 pt-4">
        <Text className="mb-3 text-sm text-slate-400">
          Pass the device to {activeSigner.full_name}
        </Text>
        <SignaturePad
          signerName={activeSigner.full_name}
          captured={false}
          onCapture={captureSignature}
          onClear={() => {}}
        />
        <Pressable
          onPress={() => setActiveSigner(null)}
          className="mt-3 h-12 items-center justify-center rounded-xl border border-border"
          disabled={busy}
        >
          <Text className="text-base text-slate-400">{busy ? 'Saving…' : 'Cancel'}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4 pt-4">
        <Text className="mb-3 text-sm text-slate-400">
          {totalSigned} of {totalExpected} signed — pass the device to each worker
        </Text>

        {/* Foreman */}
        <SectionHeader title="Foreman" />
        <SignerRow
          name={foremanName}
          subLabel="Foreman"
          signedIndex={signerSigned(foremanId, foremanName)}
          onSign={() =>
            setActiveSigner({
              id: foremanId,
              full_name: foremanName,
              sst_card_number: null, // foreman SST hydrated at read time via profile; left null here
              is_walk_in: false,
            })
          }
          onRemove={(idx) => onRemoveSignature(idx)}
        />

        {/* Crew */}
        {crew.length > 0 ? (
          <>
            <SectionHeader title={`Crew (${crew.length})`} />
            {crew.map((m) => (
              <SignerRow
                key={m.id ?? m.full_name}
                name={m.full_name}
                subLabel={m.sst_card_number ? `SST ${m.sst_card_number}` : 'No SST on file'}
                signedIndex={signerSigned(m.id, m.full_name)}
                onSign={() => setActiveSigner(m)}
                onRemove={(idx) => onRemoveSignature(idx)}
              />
            ))}
          </>
        ) : null}

        {/* Walk-ins already signed */}
        {signatures.some((s) => s.is_walk_in) ? (
          <>
            <SectionHeader title="Walk-in workers" />
            {signatures
              .map((s, i) => ({ s, i }))
              .filter(({ s }) => s.is_walk_in)
              .map(({ s, i }) => (
                <SignerRow
                  key={`walkin-${i}`}
                  name={s.worker_name}
                  subLabel={s.sst_card_number ? `SST ${s.sst_card_number}` : 'Walk-in'}
                  signedIndex={i}
                  onSign={() => {}}
                  onRemove={(idx) => onRemoveSignature(idx)}
                />
              ))}
          </>
        ) : null}

        <Pressable
          onPress={() => setWalkInOpen(true)}
          className="mt-4 h-12 flex-row items-center justify-center rounded-xl border border-dashed border-border"
        >
          <Ionicons name="person-add-outline" size={18} color="#94A3B8" />
          <Text className="ml-2 text-sm text-slate-400">Add walk-in worker</Text>
        </Pressable>

        <View className="h-24" />
      </ScrollView>

      <View className="flex-row items-center border-t border-border bg-card px-4 py-3">
        <Pressable
          onPress={onBack}
          className="mr-2 h-12 w-24 items-center justify-center rounded-xl border border-border"
        >
          <Text className="text-base text-slate-400">Back</Text>
        </Pressable>
        <Pressable
          onPress={onContinue}
          disabled={!foremanSigned}
          className="ml-2 h-12 flex-1 items-center justify-center rounded-xl bg-brand-orange"
          style={{ opacity: !foremanSigned ? 0.4 : 1 }}
        >
          <Text className="text-base font-bold text-white">
            {!foremanSigned
              ? 'Foreman must sign first'
              : totalSigned < totalExpected
              ? `Submit anyway — ${totalSigned} of ${totalExpected}`
              : 'Continue to Send'}
          </Text>
        </Pressable>
      </View>

      {/* Walk-in modal */}
      <Modal visible={walkInOpen} transparent animationType="fade" onRequestClose={() => setWalkInOpen(false)}>
        <Pressable
          onPress={() => setWalkInOpen(false)}
          className="flex-1 items-center justify-center bg-black/70 px-6"
        >
          <Pressable
            onPress={() => {}}
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-5"
          >
            <Text className="mb-3 text-lg font-bold text-white">Walk-in worker</Text>
            <Text className="mb-3 text-sm text-slate-400">
              Worker not in today's crew list. Their name is captured but no SST check is enforced.
            </Text>
            <TextInput
              value={walkInName}
              onChangeText={setWalkInName}
              placeholder="Full name"
              placeholderTextColor="#64748B"
              className="mb-3 h-12 rounded-xl border border-border bg-background px-3 text-base text-white"
              autoFocus
            />
            <TextInput
              value={walkInSst}
              onChangeText={setWalkInSst}
              placeholder="SST card number (optional)"
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              className="mb-4 h-12 rounded-xl border border-border bg-background px-3 text-base text-white"
            />
            <View className="flex-row">
              <Pressable
                onPress={() => setWalkInOpen(false)}
                className="mr-2 flex-1 items-center justify-center rounded-xl border border-border py-3"
              >
                <Text className="text-base font-bold text-white">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={startWalkIn}
                className="ml-2 flex-1 items-center justify-center rounded-xl bg-brand-orange py-3"
              >
                <Text className="text-base font-bold text-white">Capture signature</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="mb-2 mt-4 text-xs font-bold uppercase text-slate-500">{title}</Text>
  );
}

function SignerRow({
  name,
  subLabel,
  signedIndex,
  onSign,
  onRemove,
}: {
  name: string;
  subLabel: string;
  signedIndex: number;
  onSign: () => void;
  onRemove: (idx: number) => void;
}) {
  const isSigned = signedIndex >= 0;
  return (
    <View className="mb-2 rounded-xl border border-border bg-card p-3">
      <View className="flex-row items-center">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-700">
          <Ionicons name="person" size={18} color="#94A3B8" />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-base font-medium text-white" numberOfLines={1}>
            {name}
          </Text>
          <Text className="text-xs text-slate-500">{subLabel}</Text>
        </View>
        {isSigned ? (
          <Pressable
            onPress={() => onRemove(signedIndex)}
            className="h-10 items-center justify-center rounded-lg bg-green-500/10 px-3"
          >
            <View className="flex-row items-center">
              <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
              <Text className="ml-1 text-sm font-medium text-success">Signed</Text>
            </View>
          </Pressable>
        ) : (
          <Pressable
            onPress={onSign}
            className="h-10 items-center justify-center rounded-lg bg-brand-orange px-4"
          >
            <Text className="text-sm font-bold text-white">Tap Sign</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
