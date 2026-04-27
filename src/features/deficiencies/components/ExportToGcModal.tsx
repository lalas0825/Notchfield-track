/**
 * Sprint 71 Phase 3 — Export to GC modal.
 *
 * Shared by two surfaces:
 *   1. Compliance bulk-select footer — N deficiencies selected
 *   2. DeficiencyDetailScreen "Send to GC" button — single deficiency
 *
 * Both call POST /api/deficiencies/bulk-export with the same shape:
 *   { deficiencyIds: [...], title?: string, sendTo?: {email,name,company} | null }
 *
 * Two modes (Web's recommended UX):
 *   A. Generate PDF only — title input + "Generate PDF" → success state
 *      with Open / Share / Copy Link buttons. Foreman/PM uses this for
 *      records or to share via WhatsApp/native share sheet later.
 *   B. Send by email — title input + "Send by Email" reveals 3 inputs
 *      (email required, name + company optional) → "Send" → success state
 *      shows recipient + same Open/Share buttons. Web's Hybrid Sender
 *      sends from PM identity; GC replies go to PM directly, not Track.
 *
 * Success state: green check + "X deficiencies bundled" + sha256 (16-char
 * truncated for display, full hash on copy) + Open/Share/Copy Link/Done.
 *
 * SHA-256 displayed for legal traceability — same pattern as NOD/REA in
 * Sprint 53C. Court-admissible integrity proof that the PDF wasn't
 * modified after generation.
 */

import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import {
  bulkExportDeficiencies,
  type BulkExportResult,
  type ExportRecipient,
} from '../services/deficiencyApiClient';

type Props = {
  visible: boolean;
  deficiencyIds: string[];
  onClose: () => void;
  /** Optional callback after a successful export — useful for clearing
   * selection in the Compliance bulk flow. */
  onExported?: (result: BulkExportResult) => void;
};

type Mode = 'choose' | 'email_form' | 'submitting' | 'success';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ExportToGcModal({
  visible,
  deficiencyIds,
  onClose,
  onExported,
}: Props) {
  const [mode, setMode] = useState<Mode>('choose');
  const [title, setTitle] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [result, setResult] = useState<BulkExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setMode('choose');
    setTitle('');
    setEmail('');
    setName('');
    setCompany('');
    setResult(null);
    setError(null);
  }, []);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const submit = useCallback(
    async (sendTo: ExportRecipient | null) => {
      setMode('submitting');
      setError(null);
      try {
        const res = await bulkExportDeficiencies({
          deficiencyIds,
          title: title.trim() || undefined,
          sendTo,
        });
        setResult(res);
        setMode('success');
        onExported?.(res);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Could not export bundle';
        setError(msg);
        setMode(sendTo ? 'email_form' : 'choose');
      }
    },
    [deficiencyIds, title, onExported],
  );

  const handleGenerate = useCallback(() => submit(null), [submit]);

  const handleSendEmail = useCallback(() => {
    const trimmed = email.trim();
    if (!EMAIL_REGEX.test(trimmed)) {
      Alert.alert('Invalid email', 'Enter a valid GC email address.');
      return;
    }
    submit({
      email: trimmed,
      name: name.trim() || null,
      company: company.trim() || null,
    });
  }, [email, name, company, submit]);

  const handleOpen = useCallback(async () => {
    if (!result?.pdfUrl) return;
    await Linking.openURL(result.pdfUrl);
  }, [result]);

  const handleShare = useCallback(async () => {
    if (!result?.pdfUrl) return;
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      // iOS Simulator + some Android devices: fall back to opening in browser
      await Linking.openURL(result.pdfUrl);
      return;
    }
    // expo-sharing on iOS treats URLs as the file directly via the system
    // share sheet. On Android, the share sheet shows "Share link" — same
    // outcome (recipient gets the URL).
    try {
      await Sharing.shareAsync(result.pdfUrl, {
        dialogTitle: 'Share Deficiency Report',
        mimeType: 'application/pdf',
      });
    } catch {
      // User dismissed — no-op
    }
  }, [result]);

  const closeIfNotBusy = () => {
    if (mode !== 'submitting') close();
  };

  const count = deficiencyIds.length;
  const itemLabel = count === 1 ? 'deficiency' : 'deficiencies';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={closeIfNotBusy}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <Pressable
          onPress={closeIfNotBusy}
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(0,0,0,0.6)',
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: '#1E293B',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderTopWidth: 1,
              borderColor: '#334155',
              maxHeight: '92%',
            }}
          >
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: '#475569',
                }}
              />
            </View>

            <ScrollView
              style={{ paddingHorizontal: 20 }}
              contentContainerStyle={{ paddingBottom: 32 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* ─── Choose mode ─── */}
              {mode === 'choose' || mode === 'email_form' || mode === 'submitting' ? (
                <>
                  <Text style={Title}>Export to GC</Text>
                  <Text style={Subtitle}>
                    {count} {itemLabel} selected · sent via NotchField,
                    Reply-To = your email
                  </Text>

                  <Text style={Label}>Title (optional)</Text>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder={`Deficiency Report (${count} ${itemLabel})`}
                    placeholderTextColor="#64748B"
                    style={Input}
                    editable={mode !== 'submitting'}
                  />

                  {error ? (
                    <View style={ErrorBox}>
                      <Ionicons name="alert-circle" size={18} color="#F87171" />
                      <Text style={ErrorText}>{error}</Text>
                    </View>
                  ) : null}

                  {mode === 'choose' ? (
                    <View style={{ marginTop: 24, gap: 10 }}>
                      <Pressable
                        onPress={handleGenerate}
                        disabled={count === 0}
                        style={[PrimaryButton, count === 0 && Disabled]}
                      >
                        <Ionicons
                          name="document-text"
                          size={20}
                          color="#FFFFFF"
                        />
                        <Text style={PrimaryButtonText}>Generate PDF only</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => setMode('email_form')}
                        disabled={count === 0}
                        style={[SecondaryButton, count === 0 && Disabled]}
                      >
                        <Ionicons name="mail" size={20} color="#F97316" />
                        <Text style={SecondaryButtonText}>Send by email</Text>
                      </Pressable>
                    </View>
                  ) : null}

                  {mode === 'email_form' ? (
                    <>
                      <Text style={Label}>GC Email *</Text>
                      <TextInput
                        value={email}
                        onChangeText={setEmail}
                        placeholder="gc@company.com"
                        placeholderTextColor="#64748B"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={Input}
                        editable={mode !== ('submitting' as Mode)}
                      />

                      <Text style={Label}>Recipient name</Text>
                      <TextInput
                        value={name}
                        onChangeText={setName}
                        placeholder="John Smith (optional)"
                        placeholderTextColor="#64748B"
                        style={Input}
                      />

                      <Text style={Label}>Company</Text>
                      <TextInput
                        value={company}
                        onChangeText={setCompany}
                        placeholder="ACME Construction (optional)"
                        placeholderTextColor="#64748B"
                        style={Input}
                      />

                      <View style={{ marginTop: 24, gap: 10 }}>
                        <Pressable
                          onPress={handleSendEmail}
                          style={PrimaryButton}
                        >
                          <Ionicons
                            name="send"
                            size={18}
                            color="#FFFFFF"
                          />
                          <Text style={PrimaryButtonText}>Send Email</Text>
                        </Pressable>

                        <Pressable
                          onPress={() => setMode('choose')}
                          style={GhostButton}
                        >
                          <Text style={GhostButtonText}>← Back</Text>
                        </Pressable>
                      </View>
                    </>
                  ) : null}

                  {mode === 'submitting' ? (
                    <View
                      style={{
                        alignItems: 'center',
                        paddingVertical: 32,
                        gap: 12,
                      }}
                    >
                      <ActivityIndicator size="large" color="#F97316" />
                      <Text style={{ color: '#94A3B8', fontSize: 14 }}>
                        {email
                          ? 'Generating bundle + sending email…'
                          : 'Generating bundle…'}
                      </Text>
                      <Text
                        style={{ color: '#64748B', fontSize: 12 }}
                      >
                        This can take a few seconds for large bundles.
                      </Text>
                    </View>
                  ) : null}
                </>
              ) : null}

              {/* ─── Success state ─── */}
              {mode === 'success' && result ? (
                <>
                  <View style={{ alignItems: 'center', marginTop: 12 }}>
                    <View style={SuccessIcon}>
                      <Ionicons
                        name="checkmark"
                        size={32}
                        color="#22C55E"
                      />
                    </View>
                    <Text style={Title}>
                      {result.sentTo ? 'Sent to GC' : 'PDF Ready'}
                    </Text>
                    <Text style={Subtitle}>
                      {result.count} {result.count === 1 ? 'deficiency' : 'deficiencies'} bundled
                    </Text>
                  </View>

                  {result.sentTo ? (
                    <View style={InfoBox}>
                      <Text style={InfoLabel}>SENT TO</Text>
                      <Text style={InfoValue}>
                        {result.sentTo.name
                          ? `${result.sentTo.name} <${result.sentTo.email}>`
                          : result.sentTo.email}
                      </Text>
                      {result.sentTo.company ? (
                        <Text style={InfoValueSmall}>
                          {result.sentTo.company}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  <View style={InfoBox}>
                    <Text style={InfoLabel}>SHA-256 (integrity proof)</Text>
                    <Text
                      style={[
                        InfoValueSmall,
                        { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
                      ]}
                    >
                      {result.sha256.slice(0, 16)}…{result.sha256.slice(-8)}
                    </Text>
                  </View>

                  <View style={{ marginTop: 24, gap: 10 }}>
                    <Pressable onPress={handleShare} style={PrimaryButton}>
                      <Ionicons
                        name="share-outline"
                        size={20}
                        color="#FFFFFF"
                      />
                      <Text style={PrimaryButtonText}>Share PDF</Text>
                    </Pressable>

                    <Pressable onPress={handleOpen} style={SecondaryButton}>
                      <Ionicons
                        name="open-outline"
                        size={20}
                        color="#F97316"
                      />
                      <Text style={SecondaryButtonText}>Open PDF</Text>
                    </Pressable>

                    {/* Note: native Share sheet on iOS/Android already
                        offers "Copy" as a target, so we don't need a
                        separate Copy-link button (would require
                        expo-clipboard which isn't in the project). */}

                    <Pressable
                      onPress={close}
                      style={{
                        marginTop: 8,
                        height: 44,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: '#94A3B8', fontSize: 14 }}>
                        Done
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : null}

              {/* ─── Cancel button — only on initial / email_form modes ─── */}
              {mode === 'choose' || mode === 'email_form' ? (
                <Pressable
                  onPress={closeIfNotBusy}
                  style={{
                    marginTop: 12,
                    height: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#64748B', fontSize: 13 }}>
                    Cancel
                  </Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const Title = {
  color: '#F8FAFC',
  fontSize: 22,
  fontWeight: '700' as const,
  marginTop: 4,
  textAlign: 'center' as const,
};

const Subtitle = {
  color: '#94A3B8',
  fontSize: 13,
  marginTop: 6,
  marginBottom: 8,
  textAlign: 'center' as const,
};

const Label = {
  color: '#94A3B8',
  fontSize: 12,
  fontWeight: '700' as const,
  letterSpacing: 0.5,
  textTransform: 'uppercase' as const,
  marginTop: 18,
  marginBottom: 6,
};

const Input = {
  backgroundColor: '#0F172A',
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 12,
  color: '#F8FAFC',
  fontSize: 15,
  borderWidth: 1,
  borderColor: '#334155',
};

const PrimaryButton = {
  height: 52,
  borderRadius: 12,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  backgroundColor: '#F97316',
  flexDirection: 'row' as const,
  gap: 8,
};

const PrimaryButtonText = {
  color: '#FFFFFF',
  fontSize: 16,
  fontWeight: '700' as const,
};

const SecondaryButton = {
  height: 52,
  borderRadius: 12,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  backgroundColor: 'transparent',
  borderWidth: 1,
  borderColor: '#F97316',
  flexDirection: 'row' as const,
  gap: 8,
};

const SecondaryButtonText = {
  color: '#F97316',
  fontSize: 16,
  fontWeight: '700' as const,
};

const GhostButton = {
  height: 44,
  borderRadius: 10,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  flexDirection: 'row' as const,
  gap: 6,
};

const GhostButtonText = {
  color: '#94A3B8',
  fontSize: 14,
  fontWeight: '600' as const,
};

const Disabled = {
  opacity: 0.4,
};

const ErrorBox = {
  marginTop: 12,
  padding: 12,
  borderRadius: 10,
  backgroundColor: '#1F0F0F',
  borderWidth: 1,
  borderColor: '#7F1D1D',
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 8,
};

const ErrorText = {
  flex: 1,
  color: '#FCA5A5',
  fontSize: 13,
};

const InfoBox = {
  marginTop: 16,
  padding: 12,
  borderRadius: 10,
  backgroundColor: '#0F172A',
  borderWidth: 1,
  borderColor: '#334155',
};

const InfoLabel = {
  color: '#64748B',
  fontSize: 10,
  fontWeight: '700' as const,
  letterSpacing: 0.5,
  textTransform: 'uppercase' as const,
};

const InfoValue = {
  color: '#F8FAFC',
  fontSize: 14,
  fontWeight: '600' as const,
  marginTop: 4,
};

const InfoValueSmall = {
  color: '#94A3B8',
  fontSize: 12,
  marginTop: 4,
};

const SuccessIcon = {
  width: 64,
  height: 64,
  borderRadius: 32,
  backgroundColor: '#0B1F1A',
  borderWidth: 2,
  borderColor: '#22C55E',
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  marginBottom: 12,
};
