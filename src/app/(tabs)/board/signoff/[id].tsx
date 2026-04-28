/**
 * Sprint 72 — Sign-Off detail screen.
 *
 * Shows the rendered body, optional notes, area list (fetched separately
 * since signoff_areas isn't in PowerSync), evidence photo grid, and
 * status-dependent action buttons:
 *   - draft → Send for Signature, Sign in Person, Cancel
 *   - pending_signature → Sign in Person, Cancel pending
 *   - signed → Open PDF (if pdf_url ready), Preview formal PDF
 *
 * P0 stub: read-only display only — Send / In-Person / Cancel actions
 * surface as Alert placeholders. Full wiring lands in P1 (compliance) +
 * P2 (in-person sign screen with signature canvas).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { localQuery } from '@/shared/lib/powersync/write';
import { rowToSignoff } from '@/features/signoffs/hooks/useOrgSignoffs';
import { useSignoffAreas } from '@/features/signoffs/hooks/useSignoffAreas';
import { SendForSignatureModal } from '@/features/signoffs/components/SendForSignatureModal';
import { WEB_API_URL } from '@/shared/config/urls';
import type { SignoffDocStatus, SignoffDocument } from '@/features/signoffs/types';

const STATUS_COLOR: Record<SignoffDocStatus, string> = {
  draft: '#9CA3AF',
  pending_signature: '#F59E0B',
  signed: '#22C55E',
  declined: '#EF4444',
  expired: '#64748B',
  cancelled: '#64748B',
};

const STATUS_LABEL: Record<SignoffDocStatus, string> = {
  draft: 'Draft',
  pending_signature: 'Awaiting signature',
  signed: 'Signed',
  declined: 'Declined',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

export default function SignoffDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [signoff, setSignoff] = useState<SignoffDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const { areas, loading: areasLoading } = useSignoffAreas(id ?? null);

  const reload = useCallback(async () => {
    if (!id) {
      setSignoff(null);
      setLoading(false);
      return;
    }
    const rows = await localQuery<Record<string, unknown>>(
      `SELECT * FROM signoff_documents WHERE id = ? LIMIT 1`,
      [id],
    );
    setSignoff(rows && rows.length > 0 ? rowToSignoff(rows[0]) : null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  const statusColor = useMemo(
    () => (signoff ? STATUS_COLOR[signoff.status] : '#9CA3AF'),
    [signoff],
  );
  const statusLabel = useMemo(
    () => (signoff ? STATUS_LABEL[signoff.status] : ''),
    [signoff],
  );

  if (loading) {
    return (
      <View style={ScreenWrap}>
        <Stack.Screen options={{ title: 'Sign-Off' }} />
        <Text style={{ color: '#94A3B8', padding: 16 }}>Loading…</Text>
      </View>
    );
  }
  if (!signoff) {
    return (
      <View style={ScreenWrap}>
        <Stack.Screen options={{ title: 'Sign-Off' }} />
        <View style={{ padding: 24, alignItems: 'center' }}>
          <Ionicons name="document-text-outline" size={48} color="#475569" />
          <Text style={{ color: '#94A3B8', marginTop: 12, fontSize: 14 }}>
            Sign-off not found or not yet synced.
          </Text>
        </View>
      </View>
    );
  }

  const evidence = signoff.evidence_photos ?? [];

  const handleSend = () => setSendModalOpen(true);
  const handleSignInPerson = () => {
    router.push(`/(tabs)/board/signoff/sign-in-person/${signoff.id}` as any);
  };
  const handleOpenPdf = async () => {
    if (signoff.pdf_url) await Linking.openURL(signoff.pdf_url);
  };
  /**
   * Polish R2 — Preview formal PDF. The Web endpoint is token-gated:
   *   GET /api/sign/signoff/{token}/preview-pdf
   * The token is generated on send. For drafts (no token yet) we fall back
   * to a friendly hint. After send, the token is on signoff but Track only
   * has it via realtime — for now, link via the doc id and let the server
   * resolve. If signoff is signed already, the endpoint redirects to the
   * signed PDF URL automatically.
   */
  const handlePreviewPdf = async () => {
    if (signoff.pdf_url) {
      await Linking.openURL(signoff.pdf_url);
      return;
    }
    // No token surfaced to Track yet — defer. When Web exposes a Bearer-auth
    // preview endpoint for creators (not just public-token), wire it here.
    await Linking.openURL(
      `${WEB_API_URL}/api/sign/signoff/${signoff.id}/preview-pdf`,
    );
  };

  return (
    <ScrollView style={ScreenWrap} contentContainerStyle={{ padding: 16 }}>
      <Stack.Screen
        options={{ title: signoff.title || `Sign-Off #${signoff.number}` }}
      />

      {/* Status pill */}
      <View
        style={{
          alignSelf: 'flex-start',
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 6,
          backgroundColor: `${statusColor}20`,
          borderWidth: 1,
          borderColor: statusColor,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Text style={{ color: statusColor, fontSize: 11, fontWeight: '700' }}>
          {statusLabel.toUpperCase()}
        </Text>
        {signoff.created_by === null ? (
          <Text style={{ color: statusColor, fontSize: 11 }}> · AUTO</Text>
        ) : null}
      </View>

      <Text
        style={{
          color: '#F8FAFC',
          fontSize: 22,
          fontWeight: '700',
          marginTop: 10,
        }}
      >
        {signoff.title}
      </Text>
      <Text style={{ color: '#94A3B8', fontSize: 13, marginTop: 4 }}>
        #{signoff.number} · {signoff.signer_role.toUpperCase()}
        {signoff.trade ? ` · ${signoff.trade}` : ''}
      </Text>

      {/* Areas covered */}
      <Section title="Areas">
        {areasLoading ? (
          <Text style={{ color: '#64748B', fontSize: 13 }}>Loading areas…</Text>
        ) : areas.length === 0 ? (
          <Text style={{ color: '#64748B', fontSize: 13 }}>
            No areas linked.
          </Text>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {areas.map((a) => (
              <View key={`${a.signoff_id}-${a.area_id}`} style={Chip}>
                <Text style={ChipText}>
                  {a.area_label_snapshot ?? a.area_id.slice(0, 8)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Section>

      {/* Body */}
      <Section title="Body">
        <Text style={{ color: '#E2E8F0', fontSize: 14, lineHeight: 22 }}>
          {signoff.body}
        </Text>
      </Section>

      {/* Notes (if present) */}
      {signoff.notes ? (
        <Section title="Additional notes">
          <Text style={{ color: '#E2E8F0', fontSize: 13, lineHeight: 20 }}>
            {signoff.notes}
          </Text>
        </Section>
      ) : null}

      {/* Evidence photos */}
      <Section title={`Evidence (${evidence.length})`}>
        {evidence.length === 0 ? (
          <Text style={{ color: '#64748B', fontSize: 13 }}>
            No evidence attached.
          </Text>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {evidence.map((e, i) => (
              <View
                key={`${e.url}-${i}`}
                style={{
                  width: '48%',
                }}
              >
                <Image
                  source={{ uri: e.url }}
                  style={{
                    width: '100%',
                    aspectRatio: 1,
                    borderRadius: 8,
                    backgroundColor: '#1E293B',
                  }}
                  resizeMode="cover"
                />
                <Text
                  numberOfLines={2}
                  style={{
                    color: '#94A3B8',
                    fontSize: 11,
                    marginTop: 4,
                  }}
                >
                  {e.label}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Section>

      {/* Signed metadata */}
      {signoff.status === 'signed' ? (
        <Section title="Signed by">
          <Text style={{ color: '#E2E8F0', fontSize: 14, fontWeight: '600' }}>
            {signoff.signed_by_name ?? 'Unknown'}
          </Text>
          {signoff.signed_by_company ? (
            <Text style={{ color: '#94A3B8', fontSize: 13, marginTop: 2 }}>
              {signoff.signed_by_company}
            </Text>
          ) : null}
          {signoff.signed_at ? (
            <Text style={{ color: '#64748B', fontSize: 12, marginTop: 4 }}>
              {new Date(signoff.signed_at).toLocaleString()}
            </Text>
          ) : null}
          {signoff.sha256_hash ? (
            <Text
              style={{
                color: '#64748B',
                fontSize: 11,
                marginTop: 8,
                fontFamily: 'monospace',
              }}
            >
              SHA-256: {signoff.sha256_hash.slice(0, 16)}…
            </Text>
          ) : null}
        </Section>
      ) : null}

      {/* Actions */}
      <View style={{ marginTop: 24, gap: 10 }}>
        {signoff.status === 'draft' ? (
          <>
            <Pressable onPress={handleSend} style={PrimaryBtn}>
              <Ionicons name="mail" size={20} color="#FFFFFF" />
              <Text style={PrimaryBtnText}>Send for Signature</Text>
            </Pressable>
            <Pressable onPress={handleSignInPerson} style={SecondaryBtn}>
              <Ionicons name="create" size={20} color="#F97316" />
              <Text style={SecondaryBtnText}>Sign in Person</Text>
            </Pressable>
            <Pressable onPress={handlePreviewPdf} style={GhostBtn}>
              <Ionicons name="document-outline" size={18} color="#94A3B8" />
              <Text style={GhostBtnText}>Preview formal PDF</Text>
            </Pressable>
          </>
        ) : null}

        {signoff.status === 'pending_signature' ? (
          <>
            <Pressable onPress={handleSignInPerson} style={PrimaryBtn}>
              <Ionicons name="create" size={20} color="#FFFFFF" />
              <Text style={PrimaryBtnText}>Sign in Person</Text>
            </Pressable>
            <Pressable onPress={handlePreviewPdf} style={GhostBtn}>
              <Ionicons name="document-outline" size={18} color="#94A3B8" />
              <Text style={GhostBtnText}>Preview formal PDF</Text>
            </Pressable>
          </>
        ) : null}

        {signoff.status === 'signed' && signoff.pdf_url ? (
          <Pressable onPress={handleOpenPdf} style={PrimaryBtn}>
            <Ionicons name="document" size={20} color="#FFFFFF" />
            <Text style={PrimaryBtnText}>Open Signed PDF</Text>
          </Pressable>
        ) : null}

        {signoff.status === 'signed' && !signoff.pdf_url ? (
          <View style={InfoBox}>
            <Ionicons name="time" size={16} color="#94A3B8" />
            <Text style={{ color: '#94A3B8', fontSize: 13, marginLeft: 8 }}>
              Generating PDF… refresh in a few seconds.
            </Text>
          </View>
        ) : null}

        {signoff.status === 'declined' ? (
          <View style={[InfoBox, { borderColor: '#EF4444' }]}>
            <Ionicons name="close-circle" size={16} color="#FCA5A5" />
            <View style={{ marginLeft: 8, flex: 1 }}>
              <Text style={{ color: '#FCA5A5', fontSize: 13, fontWeight: '700' }}>
                Declined
              </Text>
              {signoff.declined_reason ? (
                <Text style={{ color: '#FCA5A5', fontSize: 12, marginTop: 4 }}>
                  {signoff.declined_reason}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>

      <View style={{ height: 32 }} />

      <SendForSignatureModal
        visible={sendModalOpen}
        signoffId={signoff.id}
        onClose={() => setSendModalOpen(false)}
        onSent={() => {
          setSendModalOpen(false);
          reload();
        }}
      />
    </ScrollView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: 24 }}>
      <Text
        style={{
          color: '#64748B',
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

const ScreenWrap = { flex: 1, backgroundColor: '#0F172A' };

const Chip = {
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: 6,
  backgroundColor: '#1E293B',
  borderWidth: 1,
  borderColor: '#334155',
};

const ChipText = {
  color: '#E2E8F0',
  fontSize: 12,
  fontWeight: '600' as const,
};

const PrimaryBtn = {
  height: 52,
  borderRadius: 12,
  backgroundColor: '#F97316',
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  gap: 8,
};

const PrimaryBtnText = {
  color: '#FFFFFF',
  fontSize: 16,
  fontWeight: '700' as const,
};

const SecondaryBtn = {
  height: 52,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: '#F97316',
  backgroundColor: 'transparent',
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  gap: 8,
};

const SecondaryBtnText = {
  color: '#F97316',
  fontSize: 16,
  fontWeight: '700' as const,
};

const GhostBtn = {
  height: 44,
  borderRadius: 10,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  gap: 6,
};

const GhostBtnText = {
  color: '#94A3B8',
  fontSize: 14,
  fontWeight: '600' as const,
};

const InfoBox = {
  padding: 12,
  borderRadius: 10,
  backgroundColor: '#1E293B',
  borderWidth: 1,
  borderColor: '#334155',
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
};
