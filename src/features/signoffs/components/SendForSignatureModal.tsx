/**
 * Sprint 72 — Send for Signature modal.
 *
 * Single-button → modal pattern (Polish R1 — Web team consolidated this
 * away from the inline two-step form). Mirrors ExportToGcModal shape:
 *   choose → submitting → success/error
 *
 * Calls `sendSignoffViaWeb(id, { recipientEmail, recipientName?, recipientCompany?, expiresInDays? })`
 * which:
 *   - Validates required evidence (server-side, label-exact-match)
 *   - Generates a sign token + persists sent_at, sent_to_email
 *   - Fans out: notification (signoff_request_sent + signoff_signature_due todo)
 *   - Sends polished email via Hybrid Sender (PM as sender, Reply-To = PM's email)
 *
 * On success: shows the public sign URL (informational — GC also gets it
 * via email) + "Done" button. PowerSync pushes the row update so the
 * detail screen re-renders to status='pending_signature' on its own.
 */

import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { sendSignoffViaWeb } from '../services/signoffApiClient';
import { WEB_URL } from '@/shared/config/urls';

type Mode = 'form' | 'submitting' | 'success';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  visible: boolean;
  signoffId: string;
  onClose: () => void;
  onSent?: () => void;
};

export function SendForSignatureModal({
  visible,
  signoffId,
  onClose,
  onSent,
}: Props) {
  const [mode, setMode] = useState<Mode>('form');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setMode('form');
    setEmail('');
    setName('');
    setCompany('');
    setToken(null);
    setError(null);
  }, []);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleSubmit = useCallback(async () => {
    const trimmed = email.trim();
    if (!EMAIL_REGEX.test(trimmed)) {
      Alert.alert('Invalid email', 'Enter a valid GC email address.');
      return;
    }
    setMode('submitting');
    setError(null);
    try {
      const res = await sendSignoffViaWeb(signoffId, {
        recipientEmail: trimmed,
        recipientName: name.trim() || undefined,
        recipientCompany: company.trim() || undefined,
      });
      setToken(res.token);
      setMode('success');
      onSent?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not send for signature.';
      setError(msg);
      setMode('form');
    }
  }, [email, name, company, signoffId, onSent]);

  const closeIfNotBusy = () => {
    if (mode !== 'submitting') close();
  };

  const signUrl = token ? `${WEB_URL}/sign/${token}` : '';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={closeIfNotBusy}
      statusBarTranslucent
    >
      {/* Same keyboard-flicker fix as CreateSignoffModal (commit 8e11f0b):
          KAV with behavior='height' + percentage-based sheet height
          oscillates per-frame on Android during keyboard dismiss. The
          inner ScrollView's keyboardShouldPersistTaps='handled' covers
          input visibility natively — no KAV needed. */}
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
              height: '92%',
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
              {mode === 'success' ? (
                <View style={{ alignItems: 'center', paddingTop: 8 }}>
                  <View style={SuccessIcon}>
                    <Ionicons name="mail" size={32} color="#22C55E" />
                  </View>
                  <Text style={Title}>Email Sent</Text>
                  <Text style={Subtitle}>
                    GC will receive a polished email with a link to review and
                    sign.
                  </Text>

                  {signUrl ? (
                    <View style={[InfoBox, { width: '100%' }]}>
                      <Text style={InfoLabel}>SIGN URL</Text>
                      <Text style={InfoValueSmall} numberOfLines={2}>
                        {signUrl}
                      </Text>
                    </View>
                  ) : null}

                  <Pressable
                    onPress={close}
                    style={[PrimaryButton, { width: '100%', marginTop: 24 }]}
                  >
                    <Text style={PrimaryButtonText}>Done</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <Text style={Title}>Send for Signature</Text>
                  <Text style={Subtitle}>
                    Sent via NotchField · Reply-To = your email · GC replies
                    come back to you, not us.
                  </Text>

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
                    editable={mode !== 'submitting'}
                  />

                  <Text style={Label}>Recipient name</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="John Smith (optional)"
                    placeholderTextColor="#64748B"
                    style={Input}
                    editable={mode !== 'submitting'}
                  />

                  <Text style={Label}>Company</Text>
                  <TextInput
                    value={company}
                    onChangeText={setCompany}
                    placeholder="ACME Construction (optional)"
                    placeholderTextColor="#64748B"
                    style={Input}
                    editable={mode !== 'submitting'}
                  />

                  {error ? (
                    <View style={ErrorBox}>
                      <Ionicons name="alert-circle" size={18} color="#F87171" />
                      <Text style={ErrorText} numberOfLines={4}>
                        {error}
                      </Text>
                    </View>
                  ) : null}

                  <View style={{ marginTop: 24, gap: 10 }}>
                    <Pressable
                      onPress={handleSubmit}
                      disabled={mode === 'submitting'}
                      style={[PrimaryButton, mode === 'submitting' && { opacity: 0.5 }]}
                    >
                      {mode === 'submitting' ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="send" size={18} color="#FFFFFF" />
                          <Text style={PrimaryButtonText}>Send Email</Text>
                        </>
                      )}
                    </Pressable>

                    <Pressable
                      onPress={close}
                      disabled={mode === 'submitting'}
                      style={{
                        height: 44,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: '#64748B', fontSize: 13 }}>
                        Cancel
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}
            </ScrollView>
          </Pressable>
      </Pressable>
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

const InfoValueSmall = {
  color: '#94A3B8',
  fontSize: 12,
  marginTop: 4,
};
