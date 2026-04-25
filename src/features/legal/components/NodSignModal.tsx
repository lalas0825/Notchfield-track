/**
 * Sprint 53C — NOD Sign & Send modal.
 *
 * Supervisor's flow:
 *   1. Opens from legal detail screen (draft status only)
 *   2. Reviews the NOD summary + delay cost
 *   3. Types the GC recipient email
 *   4. Optional GC company name + additional notes
 *   5. Signs via SignaturePad
 *   6. Taps "Sign & Send" → fires the whole pipeline:
 *      signature upload → PDF render + upload + hash → delay_cost_logs →
 *      Edge Function (email + tracking pixel) → DB UPDATE (draft → sent)
 *
 * Key UX points:
 *   - No separate "sign now, send later" step (matches DB enum)
 *   - Cost preview is computed locally BEFORE the send button is enabled
 *   - Requires online (email send can't be deferred)
 *   - SignaturePad from safety features is reused (same visual as PTP/work tickets)
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/shared/lib/supabase/client';
import { localQuery } from '@/shared/lib/powersync/write';
import { SignaturePad } from '@/features/safety/components/SignaturePad';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { signAndSendNod } from '../services/sendLegalDocument';
import { computeDelayCost, type DelayCost } from '../services/costEngine';
import type { LegalDoc } from '../services/legal-service';
import { DelayCostCard } from './DelayCostCard';

type Props = {
  doc: LegalDoc;
  visible: boolean;
  onClose: () => void;
  onSent: () => void;
};

type AreaInfo = {
  id: string;
  name: string;
  label: string | null;
  blocked_reason: string | null;
  blocked_at: string | null;
};

export function NodSignModal({ doc, visible, onClose, onSent }: Props) {
  const { user, profile } = useAuthStore();
  const { activeProject } = useProjectStore();

  const [area, setArea] = useState<AreaInfo | null>(null);
  const [orgName, setOrgName] = useState<string>('');
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null);
  const [gcCompany, setGcCompany] = useState<string>('');
  const [recipientEmail, setRecipientEmail] = useState<string>('');
  const [additionalNotes, setAdditionalNotes] = useState<string>('');
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [cost, setCost] = useState<DelayCost | null>(null);
  const [costLoading, setCostLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load area + org + project once the modal opens
  useEffect(() => {
    if (!visible || !doc.related_area_id) return;
    let cancelled = false;

    (async () => {
      // Area
      const areaLocal = await localQuery<Record<string, unknown>>(
        `SELECT id, name, label, blocked_reason, blocked_at
           FROM production_areas WHERE id = ? LIMIT 1`,
        [doc.related_area_id],
      );
      let areaRow: Record<string, unknown> | null = (areaLocal?.[0] as Record<string, unknown> | undefined) ?? null;
      if (!areaRow) {
        const { data } = await supabase
          .from('production_areas')
          .select('id, name, label, blocked_reason, blocked_at')
          .eq('id', doc.related_area_id)
          .maybeSingle();
        areaRow = (data ?? null) as Record<string, unknown> | null;
      }
      if (!cancelled && areaRow) {
        setArea({
          id: areaRow.id as string,
          name: areaRow.name as string,
          label: (areaRow.label as string | null) ?? null,
          blocked_reason: (areaRow.blocked_reason as string | null) ?? null,
          blocked_at: (areaRow.blocked_at as string | null) ?? null,
        });
      }

      // Org (name + logo_url)
      if (doc.organization_id) {
        const orgLocal = await localQuery<{ name: string; logo_url: string | null }>(
          `SELECT name, logo_url FROM organizations WHERE id = ? LIMIT 1`,
          [doc.organization_id],
        );
        let orgRow = orgLocal?.[0] ?? null;
        if (!orgRow) {
          const { data } = await supabase
            .from('organizations')
            .select('name, logo_url')
            .eq('id', doc.organization_id)
            .maybeSingle();
          orgRow = (data as typeof orgRow) ?? null;
        }
        if (!cancelled && orgRow) {
          setOrgName(orgRow.name ?? '');
          setOrgLogoUrl(orgRow.logo_url ?? null);
        }
      }
    })().catch((e) => console.warn('[NodSignModal] load failed', e));

    return () => {
      cancelled = true;
    };
  }, [visible, doc.related_area_id, doc.organization_id]);

  // Compute cost once area is loaded
  useEffect(() => {
    if (!area?.blocked_at) {
      setCost(null);
      return;
    }
    let cancelled = false;
    setCostLoading(true);
    computeDelayCost({ areaId: area.id, blockedAt: area.blocked_at })
      .then((c) => {
        if (!cancelled) setCost(c);
      })
      .catch(() => {
        if (!cancelled) setCost(null);
      })
      .finally(() => {
        if (!cancelled) setCostLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [area]);

  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim()), [recipientEmail]);
  const canSubmit = !submitting && emailValid && !!signatureData && !!area && !!profile && !!orgName;

  const reset = () => {
    setRecipientEmail('');
    setGcCompany('');
    setAdditionalNotes('');
    setSignatureData(null);
    setSubmitting(false);
  };

  const close = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit || !area || !profile || !user || !activeProject) return;
    setSubmitting(true);

    const result = await signAndSendNod({
      doc,
      area,
      organization: { name: orgName, logo_url: orgLogoUrl },
      project: { name: activeProject.name },
      gc: { name: gcCompany.trim() || 'General Contractor' },
      signer: {
        id: profile.id ?? user.id,
        name: profile.full_name ?? user.email ?? 'Supervisor',
        title: (profile.role as string | null) ?? null,
      },
      signatureDataUrl: signatureData!,
      recipientEmail: recipientEmail.trim(),
      additionalNotes: additionalNotes.trim() || undefined,
    });

    setSubmitting(false);

    if (result.success) {
      Alert.alert('Sent', `NOD delivered. Tracking: ${result.trackingToken.slice(0, 8)}...`, [
        { text: 'OK', onPress: () => { reset(); onSent(); onClose(); } },
      ]);
    } else {
      Alert.alert('Could not send', `${stageLabel(result.stage)}: ${result.error}`);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={close}
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
          }}
        />

        <View
          style={{
            backgroundColor: '#0F172A',
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            maxHeight: '94%',
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 18,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: '#1E293B',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="document-lock" size={20} color="#EF4444" />
              <Text style={{ marginLeft: 8, fontSize: 17, fontWeight: '800', color: '#F8FAFC' }}>
                Sign & Send NOD
              </Text>
            </View>
            <Pressable onPress={close} hitSlop={12}>
              <Ionicons name="close" size={24} color="#94A3B8" />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 18, paddingBottom: 32 }}
          >
            {/* Document preview summary */}
            <View style={{ borderRadius: 12, backgroundColor: '#1E293B', padding: 14, marginBottom: 14 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#F8FAFC' }}>{doc.title}</Text>
              <Text style={{ marginTop: 6, fontSize: 13, color: '#94A3B8', lineHeight: 18 }} numberOfLines={4}>
                {doc.description ?? ''}
              </Text>
            </View>

            {/* Cost card */}
            <DelayCostCard cost={cost} loading={costLoading} />

            {/* Recipient */}
            <View style={{ marginTop: 14 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Recipient
              </Text>
              <TextInput
                value={gcCompany}
                onChangeText={setGcCompany}
                placeholder="GC company name"
                placeholderTextColor="#475569"
                autoCapitalize="words"
                style={inputStyle}
              />
              <TextInput
                value={recipientEmail}
                onChangeText={setRecipientEmail}
                placeholder="gc-contact@example.com"
                placeholderTextColor="#475569"
                autoCapitalize="none"
                keyboardType="email-address"
                style={inputStyle}
              />
              {recipientEmail.length > 0 && !emailValid && (
                <Text style={{ color: '#FCA5A5', fontSize: 12, marginTop: 2 }}>
                  Invalid email format.
                </Text>
              )}
            </View>

            {/* Additional notes */}
            <View style={{ marginTop: 14 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Additional notes (optional)
              </Text>
              <TextInput
                value={additionalNotes}
                onChangeText={setAdditionalNotes}
                placeholder="Anything specific to add to this NOD..."
                placeholderTextColor="#475569"
                multiline
                style={[inputStyle, { minHeight: 64, paddingTop: 10 }]}
              />
            </View>

            {/* Signature */}
            <View style={{ marginTop: 18 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
                Authorized Signature
              </Text>
              <SignaturePad
                signerName={profile?.full_name ?? user?.email ?? 'Supervisor'}
                captured={signatureData !== null}
                onCapture={setSignatureData}
                onClear={() => setSignatureData(null)}
              />
            </View>

            {/* Warning */}
            <View
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#F59E0B50',
                backgroundColor: '#F59E0B15',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <Ionicons name="warning" size={16} color="#F59E0B" />
                <Text style={{ marginLeft: 8, flex: 1, color: '#FDE68A', fontSize: 12, lineHeight: 18 }}>
                  Once sent, this document is locked. SHA-256 hash is recorded for tamper detection.
                  Signed + sent happen in a single action — there is no "sign only" state.
                </Text>
              </View>
            </View>

            {/* Submit */}
            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit}
              style={{
                marginTop: 18,
                height: 54,
                borderRadius: 14,
                backgroundColor: canSubmit ? '#EF4444' : '#475569',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
              }}
            >
              <Ionicons name="shield-checkmark" size={20} color="#FFFFFF" />
              <Text style={{ marginLeft: 8, color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>
                {submitting ? 'Signing + Sending…' : 'Sign & Send NOD'}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const inputStyle = {
  marginTop: 8,
  minHeight: 44,
  borderRadius: 10,
  backgroundColor: '#1E293B',
  paddingHorizontal: 12,
  color: '#F8FAFC',
  fontSize: 15,
} as const;

function stageLabel(
  stage: 'upload-signature' | 'pdf' | 'cost-log' | 'email' | 'db-update',
): string {
  switch (stage) {
    case 'upload-signature': return 'Signature upload failed';
    case 'pdf':              return 'PDF generation failed';
    case 'cost-log':         return 'Cost log write failed';
    case 'email':            return 'Email delivery failed';
    case 'db-update':        return 'Database update failed';
  }
}
