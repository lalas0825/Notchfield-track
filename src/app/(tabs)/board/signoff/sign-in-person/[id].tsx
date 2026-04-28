/**
 * Sprint 72 — In-Person Sign screen.
 *
 * PM/foreman hands the iPad to the GC standing on site. The GC reviews
 * the body + evidence + notes and signs on-screen. On submit, signature
 * uploads to the `signatures` bucket via Web's `/api/signoffs/[id]/sign-in-person`
 * endpoint (same pattern as Sprint 45B work-tickets in-app sign).
 *
 * Auth: PM is authenticated; the endpoint flips status from
 * draft|pending_signature → signed directly with no public token. Server
 * renders the signed PDF fire-and-forget — pdf_url populates seconds later.
 *
 * Auto-blindaje §10: required evidence is enforced server-side BUT we also
 * check client-side here to fail fast with a friendly error before
 * burning a request.
 *
 * Requires online — signing cannot be deferred.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { localQuery } from '@/shared/lib/powersync/write';
import { signInPersonViaWeb } from '@/features/signoffs/services/signoffApiClient';
import { rowToSignoff } from '@/features/signoffs/hooks/useOrgSignoffs';
import type { SignoffDocument } from '@/features/signoffs/types';
import { haptic } from '@/shared/lib/haptics';

export default function SignSignoffInPersonScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [signoff, setSignoff] = useState<SignoffDocument | null>(null);
  const [loading, setLoading] = useState(true);

  const [signerName, setSignerName] = useState('');
  const [signerCompany, setSignerCompany] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    let cancel = false;
    if (!id) {
      setLoading(false);
      return;
    }
    (async () => {
      const rows = await localQuery<Record<string, unknown>>(
        `SELECT * FROM signoff_documents WHERE id = ? LIMIT 1`,
        [id],
      );
      if (cancel) return;
      setSignoff(rows && rows.length > 0 ? rowToSignoff(rows[0]) : null);
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [id]);

  /** Required evidence not yet attached — server will reject if any are missing. */
  const missingRequiredLabels = useMemo(() => {
    if (!signoff) return [];
    const presentLabels = new Set(
      (signoff.evidence_photos ?? []).map((p) => p.label),
    );
    return signoff.required_evidence_snapshot
      .filter((rule) => rule.required && !presentLabels.has(rule.label))
      .map((rule) => rule.label);
  }, [signoff]);

  const handleSubmit = useCallback(async () => {
    if (!signoff) return;
    if (!signerName.trim()) {
      Alert.alert('Name required', "Please enter the signer's name.");
      return;
    }
    if (!signatureDataUrl) {
      Alert.alert(
        'Signature required',
        'Please draw the signature before submitting.',
      );
      return;
    }
    if (missingRequiredLabels.length > 0) {
      Alert.alert(
        'Evidence missing',
        `Cannot sign — required photos still missing: ${missingRequiredLabels.join(
          ', ',
        )}`,
      );
      return;
    }

    setSubmitting(true);
    try {
      await signInPersonViaWeb(signoff.id, {
        signerName: signerName.trim(),
        signerCompany: signerCompany.trim() || undefined,
        signatureDataUrl,
      });
      haptic.success();
      Alert.alert(
        'Signed',
        'The sign-off has been signed successfully. PDF generates in the background.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ],
      );
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
  }, [
    signoff,
    signerName,
    signerCompany,
    signatureDataUrl,
    missingRequiredLabels,
    router,
  ]);

  if (loading || !signoff) {
    return (
      <>
        <Stack.Screen options={{ title: 'Sign In Person' }} />
        <View
          style={{
            flex: 1,
            backgroundColor: '#0F172A',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#94A3B8', fontSize: 14 }}>
            {loading ? 'Loading…' : 'Sign-off not found.'}
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: `Sign #${signoff.number}` }} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: '#0F172A' }}
      >
        <ScrollView
          style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!drawing}
        >
          {/* Hand-off banner */}
          <View
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#F59E0B40',
              backgroundColor: '#F59E0B1A',
            }}
          >
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <Ionicons name="hand-left-outline" size={20} color="#F59E0B" />
              <Text
                style={{ color: '#F59E0B', fontSize: 14, fontWeight: '700' }}
              >
                Hand the device to the signer
              </Text>
            </View>
            <Text style={{ color: '#CBD5E1', fontSize: 12, marginTop: 6 }}>
              Pass the iPad/phone to the GC (or authorized representative) to
              review and sign this acceptance.
            </Text>
          </View>

          {/* Doc summary */}
          <View
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#1E293B',
              backgroundColor: '#1E293B',
            }}
          >
            <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '700' }}>
              SIGN-OFF #{signoff.number}
            </Text>
            <Text
              style={{
                color: '#F8FAFC',
                fontSize: 16,
                fontWeight: '700',
                marginTop: 4,
              }}
            >
              {signoff.title}
            </Text>
            <Text
              style={{
                color: '#CBD5E1',
                fontSize: 13,
                marginTop: 8,
                lineHeight: 20,
              }}
            >
              {signoff.body}
            </Text>
            {signoff.notes ? (
              <View
                style={{
                  marginTop: 10,
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: '#0F172A',
                }}
              >
                <Text
                  style={{
                    color: '#64748B',
                    fontSize: 10,
                    fontWeight: '700',
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                  }}
                >
                  Additional notes
                </Text>
                <Text
                  style={{
                    color: '#E2E8F0',
                    fontSize: 13,
                    marginTop: 4,
                    lineHeight: 19,
                  }}
                >
                  {signoff.notes}
                </Text>
              </View>
            ) : null}
          </View>

          {missingRequiredLabels.length > 0 ? (
            <View
              style={{
                marginBottom: 16,
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#EF4444',
                backgroundColor: '#1F0F0F',
              }}
            >
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <Ionicons name="alert-circle" size={18} color="#EF4444" />
                <Text
                  style={{ color: '#FCA5A5', fontSize: 13, fontWeight: '700' }}
                >
                  Required evidence missing
                </Text>
              </View>
              <Text style={{ color: '#FCA5A5', fontSize: 12, marginTop: 4 }}>
                {missingRequiredLabels.join(', ')}
              </Text>
              <Text style={{ color: '#94A3B8', fontSize: 11, marginTop: 6 }}>
                Go back to the detail screen and attach the missing photos
                before signing.
              </Text>
            </View>
          ) : null}

          {/* Signer name */}
          <Text style={Label}>Signer name *</Text>
          <TextInput
            value={signerName}
            onChangeText={setSignerName}
            placeholder="Full name"
            placeholderTextColor="#64748B"
            style={Input}
          />

          {/* Company */}
          <Text style={Label}>Company (optional)</Text>
          <TextInput
            value={signerCompany}
            onChangeText={setSignerCompany}
            placeholder="ACME Construction"
            placeholderTextColor="#64748B"
            style={Input}
          />

          {/* Signature pad */}
          <Text style={[Label, { marginTop: 18 }]}>Draw signature *</Text>
          <SignaturePad
            signerName={signerName || 'Signer'}
            captured={!!signatureDataUrl}
            onBegin={() => setDrawing(true)}
            onEnd={() => setDrawing(false)}
            onCapture={(base64) => {
              setSignatureDataUrl(base64);
              haptic.light();
            }}
            onClear={() => setSignatureDataUrl(null)}
          />

          <Text style={{ color: '#64748B', fontSize: 11, marginTop: 12 }}>
            By signing, I confirm I have inspected the work and accept the
            terms described above.
          </Text>

          <Pressable
            onPress={handleSubmit}
            disabled={submitting || missingRequiredLabels.length > 0}
            style={[
              SubmitBtn,
              (submitting || missingRequiredLabels.length > 0) && {
                opacity: 0.5,
              },
            ]}
          >
            <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
            <Text style={SubmitBtnText}>
              {submitting ? 'Submitting…' : 'Submit Signature'}
            </Text>
          </Pressable>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const Label = {
  color: '#94A3B8',
  fontSize: 12,
  fontWeight: '700' as const,
  letterSpacing: 0.5,
  textTransform: 'uppercase' as const,
  marginTop: 12,
  marginBottom: 6,
};

const Input = {
  backgroundColor: '#1E293B',
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 12,
  color: '#F8FAFC',
  fontSize: 15,
  borderWidth: 1,
  borderColor: '#334155',
  minHeight: 52,
};

const SubmitBtn = {
  marginTop: 20,
  height: 56,
  borderRadius: 14,
  backgroundColor: '#22C55E',
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  gap: 8,
};

const SubmitBtnText = {
  color: '#FFFFFF',
  fontSize: 17,
  fontWeight: '700' as const,
};
