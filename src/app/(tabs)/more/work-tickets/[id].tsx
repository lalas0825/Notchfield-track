/**
 * Work Ticket Detail — Sprint 45B
 * Realtime via useWorkTicket. Two signing modes:
 *   - Sign Now: hand phone to GC, opens SignaturePadScreen
 *   - Send Link: native Share sheet with public sign URL
 */

import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProjectStore } from '@/features/projects/store/project-store';
import { useWorkTicket } from '@/features/work-tickets/hooks/useWorkTicket';
import {
  cancelSignatureRequest,
  createSignatureRequest,
  deleteWorkTicketDraft,
  ensureLabor,
  ensureMaterials,
  getSigningUrl,
  updateWorkTicket,
} from '@/features/work-tickets/services/work-tickets-service';
import { totalHours } from '@/features/work-tickets/types';
import {
  generateWorkTicketPdf,
  shareWorkTicketPdf,
} from '@/features/work-tickets/services/workTicketPdf';
import { haptic } from '@/shared/lib/haptics';

const STATUS_CONFIG: Record<
  string,
  { color: string; label: string; icon: any }
> = {
  draft:    { color: '#9CA3AF', label: 'Draft',              icon: 'document-outline' },
  pending:  { color: '#F59E0B', label: 'Pending Signature',  icon: 'time-outline' },
  signed:   { color: '#22C55E', label: 'Signed',             icon: 'checkmark-circle' },
  declined: { color: '#EF4444', label: 'Declined',           icon: 'close-circle' },
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
    return d.toLocaleDateString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function WorkTicketDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const activeProject = useProjectStore((s) => s.activeProject);

  const { ticket, signature, loading, reload } = useWorkTicket(id ?? null);
  const [busy, setBusy] = useState(false);

  // ── Actions ────────────────────────────────────────────────────

  const handleDelete = useCallback(() => {
    if (!ticket) return;
    Alert.alert(
      'Delete draft?',
      'This will permanently delete the draft. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setBusy(true);
              await deleteWorkTicketDraft(ticket.id);
              haptic.success();
              router.back();
            } catch (err) {
              Alert.alert('Failed', (err as Error).message ?? 'Unknown error');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }, [ticket, router]);

  const handleCancelSignature = useCallback(() => {
    if (!ticket) return;
    Alert.alert(
      'Cancel signature request?',
      'The current sign link will be invalidated and the ticket returns to draft.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Request',
          style: 'destructive',
          onPress: async () => {
            try {
              setBusy(true);
              await cancelSignatureRequest(ticket.id);
              haptic.success();
              await reload();
            } catch (err) {
              Alert.alert('Failed', (err as Error).message ?? 'Unknown error');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }, [ticket, reload]);

  const handleSignNow = useCallback(async () => {
    if (!ticket) return;
    try {
      setBusy(true);
      // If there's no pending signature, create one first
      let sig = signature;
      if (!sig || sig.status !== 'pending') {
        sig = await createSignatureRequest({
          ticketId: ticket.id,
          organization_id: ticket.organization_id,
          project_id: ticket.project_id,
          signer_role: 'gc',
        });
      }
      router.push(
        `/(tabs)/more/work-tickets/sign/${ticket.id}?sigId=${sig.id}&token=${sig.token}` as any,
      );
    } catch (err) {
      Alert.alert(
        'Cannot start signing',
        (err as Error).message ?? 'Signing requires an internet connection.',
      );
    } finally {
      setBusy(false);
    }
  }, [ticket, signature, router]);

  const handleSendLink = useCallback(async () => {
    if (!ticket) return;
    try {
      setBusy(true);
      let sig = signature;
      if (!sig || sig.status !== 'pending') {
        sig = await createSignatureRequest({
          ticketId: ticket.id,
          organization_id: ticket.organization_id,
          project_id: ticket.project_id,
          signer_role: 'gc',
        });
      }
      const url = getSigningUrl(sig.token);
      const projectName = activeProject?.name ?? '';
      await Share.share({
        message: `Please sign Work Ticket #${ticket.number ?? ''}${projectName ? ` for ${projectName}` : ''}:\n\n${url}`,
        url,
        title: `Work Ticket #${ticket.number ?? ''}`,
      });
      haptic.success();
      await reload();
    } catch (err) {
      Alert.alert('Failed', (err as Error).message ?? 'Could not share sign link.');
    } finally {
      setBusy(false);
    }
  }, [ticket, signature, activeProject, reload]);

  const handleEditAndResend = useCallback(async () => {
    if (!ticket) return;
    try {
      setBusy(true);
      await updateWorkTicket(ticket.id, { status: 'draft' });
      router.push(`/(tabs)/more/work-tickets/create?id=${ticket.id}` as any);
    } catch (err) {
      Alert.alert('Failed', (err as Error).message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  }, [ticket, router]);

  const handleDownloadPdf = useCallback(async () => {
    if (!ticket) return;
    try {
      setBusy(true);
      const uri = await generateWorkTicketPdf(
        ticket,
        signature,
        activeProject?.name ?? 'Project',
        { name: 'NotchField', address: null, phone: null, logoUrl: null },
      );
      await shareWorkTicketPdf(uri, `Work Ticket #${ticket.number ?? ''}`);
      haptic.success();
    } catch (err) {
      Alert.alert('PDF Error', (err as Error).message ?? 'Could not generate PDF.');
    } finally {
      setBusy(false);
    }
  }, [ticket, signature, activeProject]);

  const handleVerifyHash = useCallback(() => {
    if (!signature?.content_hash) {
      Alert.alert('No hash', 'This signature has no integrity hash.');
      return;
    }
    Alert.alert(
      'Integrity Hash',
      `${signature.hash_algorithm ?? 'SHA-256'}\n\n${signature.content_hash}\n\nSigned: ${fmtDate(signature.signed_at)}\n\nFull re-verification requires fetching the signed PDF from server storage. Open the GC's signed copy on the Takeoff Web dashboard to recompute the hash.`,
      [{ text: 'OK' }],
    );
  }, [signature]);

  // ── Render ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Work Ticket' }} />
        <View className="flex-1 items-center justify-center bg-background">
          <ActivityIndicator size="large" color="#F97316" />
        </View>
      </>
    );
  }

  if (!ticket) {
    return (
      <>
        <Stack.Screen options={{ title: 'Work Ticket' }} />
        <View className="flex-1 items-center justify-center bg-background px-8">
          <Ionicons name="document-text-outline" size={48} color="#334155" />
          <Text className="mt-4 text-center text-base text-slate-400">
            Ticket not found.
          </Text>
        </View>
      </>
    );
  }

  const cfg = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.draft;
  const labor = ensureLabor(ticket.labor);
  const materials = ensureMaterials(ticket.materials);
  const hours = totalHours(labor);

  return (
    <>
      <Stack.Screen options={{ title: `Ticket #${ticket.number ?? ''}` }} />

      <View className="flex-1 bg-background">
        <ScrollView className="flex-1 px-4 pt-4">

          {/* Header card */}
          <View className="mb-4 rounded-2xl border border-border bg-card p-4">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-3">
                <Text
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 12,
                    fontWeight: '700',
                    color: '#0F172A',
                    backgroundColor: '#F8FAFC',
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 4,
                    alignSelf: 'flex-start',
                    overflow: 'hidden',
                  }}
                >
                  #{ticket.number ?? '—'}
                </Text>
                <Text className="mt-2 text-lg font-bold text-white">
                  {ticket.area_description ?? '—'}
                </Text>
                <Text className="mt-1 text-xs text-slate-500">
                  {fmtDate(ticket.service_date)} · {ticket.trade ?? '—'}
                </Text>
                {ticket.priority === 'urgent' && (
                  <View className="mt-1 self-start rounded-full bg-red-500/20 px-2 py-0.5">
                    <Text className="text-xs font-bold text-red-500">⚡ URGENT</Text>
                  </View>
                )}
              </View>
              <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: `${cfg.color}20` }}>
                <View className="flex-row items-center">
                  <Ionicons name={cfg.icon} size={12} color={cfg.color} />
                  <Text className="ml-1 text-[11px] font-bold" style={{ color: cfg.color }}>
                    {cfg.label}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Pending banner */}
          {ticket.status === 'pending' && (
            <View className="mb-4 flex-row items-center rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <Ionicons name="time-outline" size={20} color="#F59E0B" />
              <View className="ml-3 flex-1">
                <Text className="text-sm font-bold text-amber-500">
                  {signature?.signer_name
                    ? `Waiting for ${signature.signer_name} to sign`
                    : 'Waiting for signature'}
                </Text>
                {signature?.signer_email && (
                  <Text className="mt-0.5 text-xs text-slate-400">{signature.signer_email}</Text>
                )}
              </View>
            </View>
          )}

          {/* Signed banner */}
          {ticket.status === 'signed' && signature && (
            <View className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 p-3">
              <View className="flex-row items-center">
                <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-bold text-green-500">
                    Signed by {signature.signer_name ?? '—'}
                  </Text>
                  <Text className="text-xs text-slate-400">
                    {(signature.signer_role ?? 'gc').toUpperCase()} · {fmtDate(signature.signed_at)}
                  </Text>
                </View>
              </View>

              {signature.signature_url && (
                <View className="mt-3 items-center rounded-lg border border-border bg-white p-2">
                  <Image
                    source={{ uri: signature.signature_url }}
                    style={{ width: '100%', height: 100, resizeMode: 'contain' }}
                  />
                </View>
              )}

              {signature.content_hash && (
                <View className="mt-3 rounded-lg border border-green-500/30 bg-black/20 p-2">
                  <Text className="text-[10px] uppercase tracking-wide text-green-500">
                    ✅ Integrity hash
                  </Text>
                  <Text className="mt-1 font-mono text-[10px] text-slate-300" numberOfLines={1}>
                    {signature.content_hash}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Work description */}
          <Section label="Work Description">
            <View className="rounded-xl border border-border bg-card p-3">
              <Text className="text-sm text-white">{ticket.work_description ?? '—'}</Text>
            </View>
          </Section>

          {/* Labor */}
          <Section label={`Labor (${labor.length} workers · ${hours.toFixed(1)} hrs)`}>
            {labor.length === 0 ? (
              <Text className="text-xs text-slate-500">(none)</Text>
            ) : (
              labor.map((l, i) => (
                <View
                  key={i}
                  className="mb-2 flex-row items-center rounded-xl border border-border bg-card px-3 py-2"
                >
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-white">{l.name}</Text>
                    <Text className="text-xs text-slate-500">{l.classification}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-xs text-slate-400">
                      {Number(l.regular_hours).toFixed(1)} reg
                      {Number(l.overtime_hours) > 0
                        ? ` + ${Number(l.overtime_hours).toFixed(1)} OT`
                        : ''}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </Section>

          {/* Materials */}
          <Section label={`Materials (${materials.length})`}>
            {materials.length === 0 ? (
              <Text className="text-xs text-slate-500">(none)</Text>
            ) : (
              materials.map((m, i) => (
                <View
                  key={i}
                  className="mb-2 flex-row items-center rounded-xl border border-border bg-card px-3 py-2"
                >
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-white">{m.description}</Text>
                  </View>
                  <Text className="text-xs text-slate-400">
                    {m.quantity} {m.unit}
                  </Text>
                </View>
              ))
            )}
          </Section>

          {ticket.gc_notes && (
            <Section label="GC Notes">
              <View className="rounded-xl border border-border bg-card p-3">
                <Text className="text-sm text-slate-300">{ticket.gc_notes}</Text>
              </View>
            </Section>
          )}

          <Section label="Foreman">
            <Text className="text-sm text-slate-300">{ticket.foreman_name ?? '—'}</Text>
          </Section>

          <View className="h-32" />
        </ScrollView>

        {/* Sticky action bar */}
        <View className="border-t border-border bg-background px-4 py-3">
          {ticket.status === 'draft' && (
            <View>
              <View className="mb-2 flex-row gap-2">
                <Pressable
                  onPress={handleSignNow}
                  disabled={busy}
                  className="flex-1 flex-row items-center justify-center rounded-xl bg-success py-3 active:opacity-80"
                  style={{ minHeight: 52, opacity: busy ? 0.5 : 1 }}
                >
                  <Ionicons name="create" size={18} color="#FFFFFF" />
                  <Text className="ml-2 text-sm font-bold text-white">Sign Now</Text>
                </Pressable>
                <Pressable
                  onPress={handleSendLink}
                  disabled={busy}
                  className="flex-1 flex-row items-center justify-center rounded-xl bg-blue-600 py-3 active:opacity-80"
                  style={{ minHeight: 52, opacity: busy ? 0.5 : 1 }}
                >
                  <Ionicons name="share" size={18} color="#FFFFFF" />
                  <Text className="ml-2 text-sm font-bold text-white">Send Link</Text>
                </Pressable>
              </View>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => router.push(`/(tabs)/more/work-tickets/create?id=${ticket.id}` as any)}
                  className="flex-1 flex-row items-center justify-center rounded-xl border border-border bg-card py-3 active:opacity-80"
                  style={{ minHeight: 48 }}
                >
                  <Ionicons name="create-outline" size={18} color="#F8FAFC" />
                  <Text className="ml-2 text-sm font-bold text-white">Edit</Text>
                </Pressable>
                <Pressable
                  onPress={handleDelete}
                  disabled={busy}
                  className="flex-1 flex-row items-center justify-center rounded-xl border border-red-500/40 bg-card py-3 active:opacity-80"
                  style={{ minHeight: 48, opacity: busy ? 0.5 : 1 }}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  <Text className="ml-2 text-sm font-bold text-red-500">Delete</Text>
                </Pressable>
              </View>
            </View>
          )}

          {ticket.status === 'pending' && (
            <View>
              <View className="mb-2 flex-row gap-2">
                <Pressable
                  onPress={handleSignNow}
                  disabled={busy}
                  className="flex-1 flex-row items-center justify-center rounded-xl bg-success py-3 active:opacity-80"
                  style={{ minHeight: 52, opacity: busy ? 0.5 : 1 }}
                >
                  <Ionicons name="create" size={18} color="#FFFFFF" />
                  <Text className="ml-2 text-sm font-bold text-white">Sign Now</Text>
                </Pressable>
                <Pressable
                  onPress={handleSendLink}
                  disabled={busy}
                  className="flex-1 flex-row items-center justify-center rounded-xl bg-blue-600 py-3 active:opacity-80"
                  style={{ minHeight: 52, opacity: busy ? 0.5 : 1 }}
                >
                  <Ionicons name="share" size={18} color="#FFFFFF" />
                  <Text className="ml-2 text-sm font-bold text-white">Resend Link</Text>
                </Pressable>
              </View>
              <Pressable
                onPress={handleCancelSignature}
                disabled={busy}
                className="flex-row items-center justify-center rounded-xl border border-border bg-card py-3 active:opacity-80"
                style={{ minHeight: 48, opacity: busy ? 0.5 : 1 }}
              >
                <Ionicons name="close-circle-outline" size={18} color="#94A3B8" />
                <Text className="ml-2 text-sm font-bold text-white">Cancel Request</Text>
              </Pressable>
            </View>
          )}

          {ticket.status === 'signed' && (
            <View className="flex-row gap-2">
              <Pressable
                onPress={handleDownloadPdf}
                disabled={busy}
                className="flex-1 flex-row items-center justify-center rounded-xl bg-success py-3 active:opacity-80"
                style={{ minHeight: 52, opacity: busy ? 0.5 : 1 }}
              >
                <Ionicons name="download" size={18} color="#FFFFFF" />
                <Text className="ml-2 text-sm font-bold text-white">PDF</Text>
              </Pressable>
              {signature?.content_hash && (
                <Pressable
                  onPress={handleVerifyHash}
                  className="flex-1 flex-row items-center justify-center rounded-xl border border-border bg-card py-3 active:opacity-80"
                  style={{ minHeight: 52 }}
                >
                  <Ionicons name="shield-checkmark" size={18} color="#22C55E" />
                  <Text className="ml-2 text-sm font-bold text-white">Verify Hash</Text>
                </Pressable>
              )}
            </View>
          )}

          {ticket.status === 'declined' && (
            <Pressable
              onPress={handleEditAndResend}
              disabled={busy}
              className="flex-row items-center justify-center rounded-xl bg-amber-600 py-3 active:opacity-80"
              style={{ minHeight: 52, opacity: busy ? 0.5 : 1 }}
            >
              <Ionicons name="create-outline" size={18} color="#FFFFFF" />
              <Text className="ml-2 text-base font-bold text-white">Edit &amp; Resend</Text>
            </Pressable>
          )}
        </View>
      </View>
    </>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">{label}</Text>
      {children}
    </View>
  );
}
