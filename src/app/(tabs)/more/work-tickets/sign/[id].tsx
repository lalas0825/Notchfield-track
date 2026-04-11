/**
 * In-app Signing — Sprint 45B
 * The foreman hands the phone to the GC. The GC reviews + signs on-screen.
 * On submit, signature uploads to the `signatures` bucket at
 * `{organization_id}/{token}.png`, SHA-256 hash is computed, and
 * document_signatures + work_tickets are updated (all direct Supabase).
 *
 * Requires online — signing cannot be deferred.
 */

import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SignaturePad } from '@/features/safety/components/SignaturePad';
import { useWorkTicket } from '@/features/work-tickets/hooks/useWorkTicket';
import { signTicketInApp } from '@/features/work-tickets/services/work-tickets-service';
import { haptic } from '@/shared/lib/haptics';

export default function SignTicketScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; sigId?: string; token?: string }>();
  const ticketId = params.id;
  const signatureId = params.sigId;
  const token = params.token;

  const { ticket, signature, loading } = useWorkTicket(ticketId ?? null);

  const [signerName, setSignerName] = useState('');
  const [signerTitle, setSignerTitle] = useState('');
  const [gcNotes, setGcNotes] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!signerName.trim()) {
      Alert.alert('Name required', 'Please enter the signer\'s name.');
      return;
    }
    if (!signatureDataUrl) {
      Alert.alert('Signature required', 'Please draw the signature before submitting.');
      return;
    }
    if (!signatureId || !token || !ticket) {
      Alert.alert(
        'Signing not ready',
        'Missing signature request context. Go back and try again.',
      );
      return;
    }

    setSubmitting(true);
    try {
      await signTicketInApp({
        signatureId,
        token,
        organizationId: ticket.organization_id,
        signerName: signerName.trim(),
        signerTitle: signerTitle.trim() || undefined,
        signatureDataUrl,
        gcNotes: gcNotes.trim() || undefined,
      });
      haptic.success();
      Alert.alert('Signed', 'The ticket has been signed successfully.', [
        {
          text: 'OK',
          onPress: () => {
            router.back();
          },
        },
      ]);
    } catch (err) {
      const msg = (err as Error).message ?? 'Unknown error';
      if (
        msg.toLowerCase().includes('network') ||
        msg.toLowerCase().includes('failed to fetch') ||
        msg.toLowerCase().includes('internet')
      ) {
        Alert.alert(
          'No connection',
          'Signing requires an active internet connection to upload the signature. Please reconnect and try again.',
        );
      } else {
        Alert.alert('Signing failed', msg);
      }
    } finally {
      setSubmitting(false);
    }
  }, [signerName, signerTitle, gcNotes, signatureDataUrl, signatureId, token, ticket, router]);

  if (loading || !ticket) {
    return (
      <>
        <Stack.Screen options={{ title: 'Sign Ticket' }} />
        <View className="flex-1 items-center justify-center bg-background">
          <Text className="text-base text-slate-400">Loading…</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: `Sign Ticket #${ticket.number ?? ''}` }} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-background"
      >
        <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">

          {/* Intro */}
          <View className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <View className="flex-row items-center">
              <Ionicons name="hand-left-outline" size={20} color="#F59E0B" />
              <Text className="ml-2 text-sm font-bold text-amber-500">Hand phone to GC</Text>
            </View>
            <Text className="mt-1 text-xs text-slate-300">
              Pass the device to the GC (or authorized representative) to review and sign this ticket.
            </Text>
          </View>

          {/* Ticket summary */}
          <View className="mb-4 rounded-xl border border-border bg-card p-3">
            <Text className="text-xs uppercase text-slate-500">Ticket</Text>
            <Text className="mt-1 text-base font-bold text-white">
              #{ticket.number ?? '—'} · {ticket.trade}
            </Text>
            {ticket.area_description && (
              <Text className="mt-0.5 text-xs text-slate-400">{ticket.area_description}</Text>
            )}
            <Text className="mt-2 text-sm text-slate-300" numberOfLines={4}>
              {ticket.work_description}
            </Text>
          </View>

          {/* Signer name */}
          <Text className="mb-1 text-xs font-semibold uppercase text-slate-400">
            Signer Name *
          </Text>
          <TextInput
            value={signerName}
            onChangeText={setSignerName}
            placeholder="Full name"
            placeholderTextColor="#64748B"
            className="mb-3 rounded-xl border border-border bg-card px-4 text-base text-white"
            style={{ minHeight: 52 }}
          />

          {/* Title */}
          <Text className="mb-1 text-xs font-semibold uppercase text-slate-400">
            Title (optional)
          </Text>
          <TextInput
            value={signerTitle}
            onChangeText={setSignerTitle}
            placeholder="e.g. Project Manager, Superintendent"
            placeholderTextColor="#64748B"
            className="mb-3 rounded-xl border border-border bg-card px-4 text-base text-white"
            style={{ minHeight: 52 }}
          />

          {/* GC notes */}
          <Text className="mb-1 text-xs font-semibold uppercase text-slate-400">
            Notes for Foreman (optional)
          </Text>
          <TextInput
            value={gcNotes}
            onChangeText={setGcNotes}
            placeholder="Any comments..."
            placeholderTextColor="#64748B"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            className="mb-4 rounded-xl border border-border bg-card px-4 py-3 text-base text-white"
            style={{ minHeight: 80 }}
          />

          {/* Signature pad */}
          <Text className="mb-2 text-xs font-semibold uppercase text-slate-400">
            Draw Signature *
          </Text>
          <SignaturePad
            signerName={signerName || 'Signer'}
            captured={!!signatureDataUrl}
            onCapture={(base64) => {
              // SignaturePad returns "data:image/png;base64,..." via onOK
              setSignatureDataUrl(base64);
              haptic.light();
            }}
            onClear={() => {
              setSignatureDataUrl(null);
            }}
          />

          <Text className="mt-4 text-xs text-slate-500">
            By signing, I confirm this work was performed as described above.
          </Text>

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            className="mb-8 mt-4 flex-row items-center justify-center rounded-2xl bg-success py-4 active:opacity-80"
            style={{ opacity: submitting ? 0.5 : 1, minHeight: 56 }}
          >
            <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
            <Text className="ml-2 text-lg font-bold text-white">
              {submitting ? 'Submitting…' : 'Submit Signature'}
            </Text>
          </Pressable>

          <View className="h-8" />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
