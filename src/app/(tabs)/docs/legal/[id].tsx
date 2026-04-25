/**
 * Legal Document Detail — Sprint 53C REWRITE
 * =============================================
 * Draft → Sign & Send (opens NodSignModal) → Sent → Opened.
 * Post-send: shows recipient info + signature + SHA-256 + PDF download.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth/store/auth-store';
import {
  getLegalDoc,
  type LegalDoc,
  type LegalDocStatus,
} from '@/features/legal/services/legal-service';
import { NodSignModal } from '@/features/legal/components/NodSignModal';
import { DelayCostCard } from '@/features/legal/components/DelayCostCard';
import { formatCentsUsd, type DelayCost } from '@/features/legal/services/costEngine';
import { localQuery } from '@/shared/lib/powersync/write';
import { formatUSDateTime } from '@/features/legal/services/nodBoilerplate';

const STATUS_STYLE: Record<LegalDocStatus, { bg: string; border: string; text: string; icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  draft:       { bg: '#F59E0B20', border: '#F59E0B', text: '#FDE68A', icon: 'document-text-outline', label: 'DRAFT' },
  sent:        { bg: '#22C55E20', border: '#22C55E', text: '#86EFAC', icon: 'paper-plane',           label: 'SENT' },
  opened:      { bg: '#3B82F620', border: '#3B82F6', text: '#93C5FD', icon: 'eye',                   label: 'OPENED' },
  no_response: { bg: '#EF444420', border: '#EF4444', text: '#FCA5A5', icon: 'alert-circle',          label: 'NO RESPONSE' },
};

export default function LegalDocDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuthStore();
  const [doc, setDoc] = useState<LegalDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSignModal, setShowSignModal] = useState(false);
  const [cost, setCost] = useState<DelayCost | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const result = await getLegalDoc(id);
    setDoc(result);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // After send, read the delay_cost_logs row this doc references
  useEffect(() => {
    if (!doc?.related_delay_log_id) {
      setCost(null);
      return;
    }
    (async () => {
      const rows = await localQuery<DelayCost>(
        `SELECT crew_size, daily_rate_cents, days_lost, total_cost_cents
           FROM delay_cost_logs WHERE id = ? LIMIT 1`,
        [doc.related_delay_log_id],
      );
      setCost((rows?.[0] as DelayCost | undefined) ?? null);
    })();
  }, [doc?.related_delay_log_id]);

  if (loading || !doc) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A' }}>
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  const statusCfg = STATUS_STYLE[doc.status] ?? STATUS_STYLE.draft;
  const isDraft = doc.status === 'draft';

  const sharePdf = async () => {
    if (!doc.pdf_url) return;
    try {
      await Share.share({
        message: `${doc.title}\n\nOpen the attached Notice of Delay:\n${doc.pdf_url}`,
        url: doc.pdf_url,
        title: doc.title,
      });
    } catch {
      // user cancelled
    }
  };

  const openPdf = async () => {
    if (!doc.pdf_url) return;
    const ok = await Linking.canOpenURL(doc.pdf_url);
    if (!ok) {
      Alert.alert('Cannot open', 'No app can open this URL.');
      return;
    }
    await Linking.openURL(doc.pdf_url);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: doc.document_type.toUpperCase(),
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#F8FAFC',
        }}
      />

      <ScrollView style={{ flex: 1, backgroundColor: '#0F172A' }} contentContainerStyle={{ padding: 16 }}>
        {/* Title + status chip */}
        <View
          style={{
            borderRadius: 16,
            backgroundColor: '#1E293B',
            padding: 16,
            borderLeftWidth: 4,
            borderLeftColor: statusCfg.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: '#F8FAFC' }} numberOfLines={2}>
              {doc.title}
            </Text>
            <View
              style={{
                marginLeft: 10,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: statusCfg.bg,
                borderWidth: 1,
                borderColor: statusCfg.border,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Ionicons name={statusCfg.icon} size={12} color={statusCfg.border} />
              <Text style={{ marginLeft: 4, color: statusCfg.text, fontSize: 11, fontWeight: '800', letterSpacing: 0.4 }}>
                {statusCfg.label}
              </Text>
            </View>
          </View>
          <Text style={{ marginTop: 6, fontSize: 12, color: '#94A3B8' }}>
            Created {formatUSDateTime(doc.created_at)}
          </Text>
        </View>

        {/* Send status timeline */}
        {!isDraft && (
          <View style={{ marginTop: 14, borderRadius: 14, backgroundColor: '#1E293B', padding: 14 }}>
            <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
              Delivery Timeline
            </Text>
            <TimelineRow icon="paper-plane"     label="Sent"    value={doc.sent_at}    color="#22C55E" />
            <TimelineRow icon="eye"             label="Opened"  value={doc.opened_at}  color="#3B82F6" />
            {doc.status === 'no_response' && (
              <TimelineRow icon="alert-circle" label="No response (48h elapsed)" value={null} color="#EF4444" />
            )}
            {doc.recipient_email && (
              <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#334155' }}>
                <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600' }}>Recipient</Text>
                <Text style={{ fontSize: 13, color: '#F8FAFC', marginTop: 2 }}>
                  {doc.recipient_name ? `${doc.recipient_name} · ` : ''}{doc.recipient_email}
                </Text>
              </View>
            )}
            {doc.receipt_ip && (
              <Text style={{ marginTop: 6, fontSize: 10, color: '#64748B' }}>
                Opened from {doc.receipt_ip}
              </Text>
            )}
          </View>
        )}

        {/* Description preview */}
        <View style={{ marginTop: 14, borderRadius: 14, backgroundColor: '#1E293B', padding: 14 }}>
          <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Document
          </Text>
          <Text style={{ fontSize: 14, color: '#F1F5F9', lineHeight: 22 }}>{doc.description}</Text>
        </View>

        {/* Cost impact card */}
        {cost && (
          <View style={{ marginTop: 14 }}>
            <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Documented Cost
            </Text>
            <DelayCostCard cost={cost} />
            <Text style={{ marginTop: 6, fontSize: 11, color: '#64748B' }}>
              Locked at sign-and-send. Source: delay_cost_logs / workers.daily_rate_cents × days_lost.
            </Text>
          </View>
        )}

        {/* SHA-256 hash (post-send) */}
        {doc.sha256_hash && (
          <View style={{ marginTop: 14, borderRadius: 14, backgroundColor: '#0B1220', padding: 14, borderWidth: 1, borderColor: '#1E293B' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="finger-print" size={14} color="#22C55E" />
              <Text style={{ marginLeft: 6, fontSize: 11, color: '#86EFAC', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                SHA-256 · Tamper Evident
              </Text>
            </View>
            <Text style={{ marginTop: 8, fontSize: 10, color: '#CBD5E1', fontFamily: 'monospace' }} selectable>
              {doc.sha256_hash}
            </Text>
            <Text style={{ marginTop: 8, fontSize: 10, color: '#64748B' }}>
              Re-hash the downloaded PDF to verify. Any change to the file produces a different hash.
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={{ marginTop: 20, gap: 10 }}>
          {isDraft ? (
            <Pressable
              onPress={() => setShowSignModal(true)}
              style={{
                height: 54,
                borderRadius: 14,
                backgroundColor: '#EF4444',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
              }}
            >
              <Ionicons name="shield-checkmark" size={20} color="#FFFFFF" />
              <Text style={{ marginLeft: 8, color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>
                Sign &amp; Send NOD
              </Text>
            </Pressable>
          ) : (
            <>
              {doc.pdf_url && (
                <Pressable
                  onPress={openPdf}
                  style={{
                    height: 52,
                    borderRadius: 14,
                    backgroundColor: '#1E293B',
                    borderWidth: 1,
                    borderColor: '#334155',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                  }}
                >
                  <Ionicons name="document" size={18} color="#F97316" />
                  <Text style={{ marginLeft: 8, color: '#F8FAFC', fontSize: 15, fontWeight: '700' }}>
                    Open signed PDF
                  </Text>
                </Pressable>
              )}
              {doc.pdf_url && (
                <Pressable
                  onPress={sharePdf}
                  style={{
                    height: 52,
                    borderRadius: 14,
                    backgroundColor: '#1E293B',
                    borderWidth: 1,
                    borderColor: '#334155',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                  }}
                >
                  <Ionicons name="share-outline" size={18} color="#F97316" />
                  <Text style={{ marginLeft: 8, color: '#F8FAFC', fontSize: 15, fontWeight: '700' }}>
                    Share link
                  </Text>
                </Pressable>
              )}
            </>
          )}
        </View>

        {/* Immutability notice */}
        {!isDraft && (
          <View
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 12,
              backgroundColor: '#22C55E0F',
              borderWidth: 1,
              borderColor: '#22C55E30',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="lock-closed" size={14} color="#22C55E" />
              <Text style={{ marginLeft: 6, color: '#86EFAC', fontSize: 12, fontWeight: '700' }}>
                Document Locked
              </Text>
            </View>
            <Text style={{ marginTop: 4, color: '#94A3B8', fontSize: 12, lineHeight: 18 }}>
              Cryptographically sealed. Title, description, hash, signer, and signature timestamp
              cannot be modified — enforced by the guard_legal_immutability database trigger.
            </Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Sign & Send modal (opens from draft) */}
      {profile && (
        <NodSignModal
          doc={doc}
          visible={showSignModal}
          onClose={() => setShowSignModal(false)}
          onSent={load}
        />
      )}
    </>
  );
}

function TimelineRow({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | null | undefined;
  color: string;
}) {
  const active = !!value;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: active ? `${color}22` : '#0B1220',
          borderWidth: 1,
          borderColor: active ? color : '#334155',
        }}
      >
        <Ionicons name={icon} size={11} color={active ? color : '#475569'} />
      </View>
      <Text style={{ marginLeft: 10, flex: 1, fontSize: 13, color: active ? '#F8FAFC' : '#64748B', fontWeight: active ? '600' : '500' }}>
        {label}
      </Text>
      <Text style={{ fontSize: 11, color: active ? '#94A3B8' : '#475569' }}>
        {value ? formatUSDateTime(value) : '—'}
      </Text>
    </View>
  );
}
