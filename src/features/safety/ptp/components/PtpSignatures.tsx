/**
 * Screen 4 — Crew signatures.
 *
 * Crew list comes from `project_workers` JOIN `workers` (Sprint MANPOWER).
 * Foreman signs first (GPS captured). Then the device passes to each crew
 * member — sequential workflow, one canvas, one-shot sign per worker.
 * Walk-in workers (not on project manpower) are created as real `workers`
 * rows so the PM sees them on next sync.
 *
 * All signatures append to safety_documents.signatures JSONB array. The
 * signature's `worker_id` references `workers.id` (NOT profiles.id) so
 * Takeoff's Manpower analytics stay consistent.
 */
import { useMemo, useState } from 'react';
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
import { SignaturePad } from '@/features/safety/components/SignaturePad';
import { useProjectWorkers } from '@/features/workers/hooks/useProjectWorkers';
import { createWalkInWorker } from '@/features/workers/services/workerService';
import {
  classifyCertStatus,
  daysUntilExpiry,
  CERT_STATUS_COLOR,
  CERT_STATUS_LABEL,
  type CertStatus,
} from '@/features/workers/utils/certStatus';
import { workerFullName, type Worker } from '@/features/workers/types';
import { notifyAndForget } from '@/features/notifications/services/notifyApiClient';
import type { PtpSignature } from '../types';

type CandidateSigner = {
  worker_id: string;
  full_name: string;
  sst_card_number: string | null;
  sst_expires_at: string | null;
  photo_url: string | null;
  trade: string | null;
  is_walk_in: boolean;
};

type Props = {
  docId: string;
  projectId: string;
  foremanWorkerId: string;
  foremanWorkerName: string;
  foremanSstCardNumber: string | null;
  organizationId: string;
  createdBy: string;
  signatures: PtpSignature[];
  onAddSignature: (sig: PtpSignature) => Promise<{ success: boolean; error?: string }>;
  onRemoveSignature: (index: number) => Promise<{ success: boolean; error?: string }>;
  onContinue: () => void;
  onBack: () => void;
};

function workerToCandidate(w: Worker): CandidateSigner {
  return {
    worker_id: w.id,
    full_name: workerFullName(w),
    sst_card_number: w.sst_card_number ?? null,
    sst_expires_at: w.sst_expires_at ?? null,
    photo_url: w.photo_url ?? null,
    trade: w.trade ?? null,
    is_walk_in: w.profile_id === null,
  };
}

export function PtpSignatures({
  docId: _docId,
  projectId,
  foremanWorkerId,
  foremanWorkerName,
  foremanSstCardNumber,
  organizationId,
  createdBy,
  signatures,
  onAddSignature,
  onRemoveSignature,
  onContinue,
  onBack,
}: Props) {
  const { workers: projectWorkers, loading: workersLoading, reload: reloadWorkers } =
    useProjectWorkers(projectId);
  const [activeSigner, setActiveSigner] = useState<CandidateSigner | null>(null);
  const [busy, setBusy] = useState(false);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInFirstName, setWalkInFirstName] = useState('');
  const [walkInLastName, setWalkInLastName] = useState('');
  const [walkInSst, setWalkInSst] = useState('');

  // Build crew list excluding the foreman (they're surfaced in their own row)
  const crew = useMemo<CandidateSigner[]>(() => {
    return projectWorkers
      .filter((w) => w.id !== foremanWorkerId)
      .map(workerToCandidate);
  }, [projectWorkers, foremanWorkerId]);

  const foremanCandidate: CandidateSigner = {
    worker_id: foremanWorkerId,
    full_name: foremanWorkerName,
    sst_card_number: foremanSstCardNumber,
    sst_expires_at:
      projectWorkers.find((w) => w.id === foremanWorkerId)?.sst_expires_at ?? null,
    photo_url: projectWorkers.find((w) => w.id === foremanWorkerId)?.photo_url ?? null,
    trade: projectWorkers.find((w) => w.id === foremanWorkerId)?.trade ?? null,
    is_walk_in: false,
  };

  // Walk-ins already signed (not in project roster)
  const walkInsAlreadySigned = useMemo(() => {
    return signatures
      .map((s, i) => ({ sig: s, index: i }))
      .filter(({ sig }) => sig.is_walk_in);
  }, [signatures]);

  const signedIndexForWorker = (workerId: string): number => {
    return signatures.findIndex((s) => s.worker_id === workerId);
  };

  const confirmExpiredCertBeforeSign = async (cert: CertStatus, days: number | null): Promise<boolean> => {
    if (cert === 'valid' || cert === 'missing') return true;
    const message =
      cert === 'expired'
        ? `SST card expired ${days !== null ? `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago` : 'recently'}.`
        : `SST card expires in ${days ?? '?'} day${days === 1 ? '' : 's'}.`;

    return new Promise<boolean>((resolve) => {
      Alert.alert(
        cert === 'expired' ? 'Expired SST' : 'SST expiring soon',
        `${message}\n\nProceed anyway?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Proceed', style: 'destructive', onPress: () => resolve(true) },
        ],
      );
    });
  };

  const captureSignature = async (base64: string) => {
    if (!activeSigner) return;
    setBusy(true);

    const isForeman = activeSigner.worker_id === foremanWorkerId;
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

    // Snapshot SST at sign-time. The foreman's SST comes from props (already
    // resolved in the wizard via useMyWorker); crew SST comes from the
    // project_workers list we just loaded.
    const sig: PtpSignature = {
      worker_id: activeSigner.worker_id,
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

    // Sprint 69 — fire ptp_signed_to_pm only on foreman sign. Web's recipient
    // resolver decides who gets in_app/email/push (typically the project PM
    // and superintendent). Crew signatures don't trigger; they're snapshotted
    // into the same JSONB array but the "PTP is signed and ready for PM
    // attention" milestone is the foreman's signature. notifyAndForget swallows
    // errors per "auxiliary, not blocking" rule.
    if (isForeman) {
      notifyAndForget({
        type: 'ptp_signed_to_pm',
        entity: { type: 'safety_document', id: _docId },
        projectId,
        organizationId,
        actorId: createdBy,
      });
    }

    setActiveSigner(null);
  };

  const promptSigner = async (candidate: CandidateSigner) => {
    const cert = classifyCertStatus(candidate.sst_card_number, candidate.sst_expires_at);
    const days = daysUntilExpiry(candidate.sst_expires_at);
    const ok = await confirmExpiredCertBeforeSign(cert, days);
    if (!ok) return;
    setActiveSigner(candidate);
  };

  const startWalkIn = async () => {
    const first = walkInFirstName.trim();
    const last = walkInLastName.trim();
    if (!first) {
      Alert.alert('Name required', "Enter the walk-in worker's first name.");
      return;
    }
    setBusy(true);
    const result = await createWalkInWorker({
      organizationId,
      firstName: first,
      lastName: last || '—',
      sstCardNumber: walkInSst.trim() || null,
      createdBy,
    });
    setBusy(false);
    if (!result.success || !result.worker) {
      Alert.alert('Could not add walk-in', result.error ?? 'Unknown error');
      return;
    }

    // Immediately start the signing flow for the new walk-in
    setActiveSigner(workerToCandidate(result.worker));
    setWalkInFirstName('');
    setWalkInLastName('');
    setWalkInSst('');
    setWalkInOpen(false);

    // Refresh the roster so the walk-in appears in the list on the next pass
    reloadWorkers();
  };

  const foremanSigned = signedIndexForWorker(foremanWorkerId) >= 0;
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
          candidate={foremanCandidate}
          signedIndex={signedIndexForWorker(foremanWorkerId)}
          onSign={() => promptSigner(foremanCandidate)}
          onRemove={(idx) => onRemoveSignature(idx)}
        />

        {/* Crew — project_workers JOIN workers */}
        {workersLoading ? (
          <Text className="mt-4 text-sm text-slate-400">Loading project crew…</Text>
        ) : crew.length > 0 ? (
          <>
            <SectionHeader title={`Crew (${crew.length})`} />
            {crew.map((c) => (
              <SignerRow
                key={c.worker_id}
                candidate={c}
                signedIndex={signedIndexForWorker(c.worker_id)}
                onSign={() => promptSigner(c)}
                onRemove={(idx) => onRemoveSignature(idx)}
              />
            ))}
          </>
        ) : (
          <View className="mt-4 rounded-xl border border-border bg-card p-4">
            <Text className="text-sm text-slate-400">
              No workers assigned to this project yet. Ask the PM to add crew
              in Manpower, or add walk-ins below.
            </Text>
          </View>
        )}

        {/* Walk-ins already signed */}
        {walkInsAlreadySigned.length > 0 ? (
          <>
            <SectionHeader title="Walk-in workers" />
            {walkInsAlreadySigned.map(({ sig, index }) => (
              <SignerRow
                key={`walkin-${index}`}
                candidate={{
                  worker_id: sig.worker_id ?? `walkin-${index}`,
                  full_name: sig.worker_name,
                  sst_card_number: sig.sst_card_number ?? null,
                  sst_expires_at: null,
                  photo_url: null,
                  trade: null,
                  is_walk_in: true,
                }}
                signedIndex={index}
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
      <Modal
        visible={walkInOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setWalkInOpen(false)}
      >
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
              Worker not in today's crew list. Adding them here creates their
              Manpower record; the PM will fill in certs later.
            </Text>
            <TextInput
              value={walkInFirstName}
              onChangeText={setWalkInFirstName}
              placeholder="First name"
              placeholderTextColor="#64748B"
              className="mb-3 h-12 rounded-xl border border-border bg-background px-3 text-base text-white"
              autoFocus
            />
            <TextInput
              value={walkInLastName}
              onChangeText={setWalkInLastName}
              placeholder="Last name"
              placeholderTextColor="#64748B"
              className="mb-3 h-12 rounded-xl border border-border bg-background px-3 text-base text-white"
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
                disabled={busy}
                className="ml-2 flex-1 items-center justify-center rounded-xl bg-brand-orange py-3"
                style={{ opacity: busy ? 0.6 : 1 }}
              >
                <Text className="text-base font-bold text-white">
                  {busy ? 'Saving…' : 'Add & sign'}
                </Text>
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
  candidate,
  signedIndex,
  onSign,
  onRemove,
}: {
  candidate: CandidateSigner;
  signedIndex: number;
  onSign: () => void;
  onRemove: (idx: number) => void;
}) {
  const isSigned = signedIndex >= 0;
  const cert = classifyCertStatus(candidate.sst_card_number, candidate.sst_expires_at);
  const days = daysUntilExpiry(candidate.sst_expires_at);

  const certLabel = (() => {
    if (cert === 'missing') return 'No SST on file';
    if (cert === 'valid') return candidate.sst_card_number ? `SST ${candidate.sst_card_number}` : CERT_STATUS_LABEL.valid;
    if (cert === 'expiring') return `SST expires in ${days}d`;
    return `SST expired ${days !== null ? `${Math.abs(days)}d ago` : ''}`.trim();
  })();

  return (
    <View className="mb-2 rounded-xl border border-border bg-card p-3">
      <View className="flex-row items-center">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-700">
          <Ionicons name="person" size={18} color="#94A3B8" />
        </View>
        <View className="ml-3 flex-1">
          <View className="flex-row items-center">
            <Text className="text-base font-medium text-white" numberOfLines={1}>
              {candidate.full_name}
            </Text>
            {candidate.is_walk_in ? (
              <View className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5">
                <Text className="text-[10px] font-bold text-warning">WALK-IN</Text>
              </View>
            ) : null}
          </View>
          <View className="mt-0.5 flex-row items-center">
            {cert !== 'valid' && cert !== 'missing' ? (
              <View
                className="mr-2 rounded-full px-2 py-0.5"
                style={{ backgroundColor: `${CERT_STATUS_COLOR[cert]}20` }}
              >
                <Text className="text-[10px] font-bold" style={{ color: CERT_STATUS_COLOR[cert] }}>
                  {CERT_STATUS_LABEL[cert].toUpperCase()}
                </Text>
              </View>
            ) : null}
            <Text
              className="text-xs"
              style={{
                color: cert === 'missing' || cert === 'expired' ? CERT_STATUS_COLOR[cert] : '#64748B',
              }}
            >
              {certLabel}
            </Text>
          </View>
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
