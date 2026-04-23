/**
 * Screen 5 — Distribute.
 *
 * Multi-select recipient list pre-populated from
 * projects.safety_distribution_emails. The foreman can add ad-hoc recipients
 * or uncheck defaults. Tapping "Send & Submit" POSTs to Takeoff's distribute
 * endpoint; on network failure, the request is queued for retry.
 */
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PtpPdfLabels } from '../types';
import { distributePtp } from '../services/distributeService';
import { WEB_HOSTNAME, VERIFY_BASE_URL } from '@/shared/config/urls';

type Props = {
  docId: string;
  labels: PtpPdfLabels;
  defaultRecipients: string[];
  oshaCitationsIncluded: boolean;
  onToggleOshaCitations: (next: boolean) => void;
  onSent: (result: { queued?: boolean; emailsSent?: number }) => void;
  onBack: () => void;
};

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export function PtpDistribute({
  docId,
  labels,
  defaultRecipients,
  oshaCitationsIncluded,
  onToggleOshaCitations,
  onSent,
  onBack,
}: Props) {
  const [recipients, setRecipients] = useState<{ email: string; checked: boolean }[]>([]);
  const [adhoc, setAdhoc] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const unique = [...new Set(defaultRecipients.map((e) => e.trim()).filter(isValidEmail))];
    setRecipients(unique.map((email) => ({ email, checked: true })));
  }, [defaultRecipients]);

  const toggle = (email: string) => {
    setRecipients((prev) =>
      prev.map((r) => (r.email === email ? { ...r, checked: !r.checked } : r)),
    );
  };

  const addAdhoc = () => {
    const trimmed = adhoc.trim();
    if (!isValidEmail(trimmed)) {
      Alert.alert('Invalid email', 'Enter a valid email address.');
      return;
    }
    if (recipients.some((r) => r.email === trimmed)) {
      setAdhoc('');
      return;
    }
    setRecipients((prev) => [...prev, { email: trimmed, checked: true }]);
    setAdhoc('');
  };

  const handleSend = async () => {
    const selected = recipients.filter((r) => r.checked).map((r) => r.email);
    if (selected.length === 0) {
      Alert.alert('No recipients', 'Select at least one email address.');
      return;
    }
    setSending(true);
    const result = await distributePtp(
      docId,
      { ...labels, oshaCitationsIncluded },
      selected,
    );
    setSending(false);

    if (result.success) {
      onSent({ emailsSent: result.emails_sent });
      return;
    }
    if (result.queued) {
      onSent({ queued: true });
      return;
    }
    Alert.alert('Send failed', result.error ?? 'Unknown error');
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
        {/* Integrity note */}
        <View className="mb-4 rounded-xl border border-border bg-card p-4">
          <View className="flex-row items-center">
            <Ionicons name="shield-checkmark" size={18} color="#22C55E" />
            <Text className="ml-2 text-sm font-bold text-white">PDF Ready</Text>
          </View>
          <Text className="mt-2 text-xs text-slate-400">
            Sent via {WEB_HOSTNAME} — each PDF is stamped with a SHA-256
            integrity hash that verifies at {VERIFY_BASE_URL}/&lt;hash&gt;.
          </Text>
        </View>

        {/* Recipients */}
        <Text className="mb-2 text-xs font-bold uppercase text-slate-500">Send to</Text>
        {recipients.length === 0 ? (
          <Text className="mb-2 text-sm text-slate-400">
            No default recipients — PM should configure the project's
            safety_distribution_emails. Add ad-hoc recipients below.
          </Text>
        ) : (
          recipients.map((r) => (
            <Pressable
              key={r.email}
              onPress={() => toggle(r.email)}
              className="mb-1.5 flex-row items-center rounded-xl border border-border bg-card px-3 py-3"
            >
              <Ionicons
                name={r.checked ? 'checkbox' : 'square-outline'}
                size={22}
                color={r.checked ? '#F97316' : '#64748B'}
              />
              <Text className="ml-3 flex-1 text-base text-white" numberOfLines={1}>
                {r.email}
              </Text>
            </Pressable>
          ))
        )}

        {/* Ad-hoc */}
        <View className="mt-2 flex-row items-center">
          <TextInput
            value={adhoc}
            onChangeText={setAdhoc}
            placeholder="Add recipient email"
            placeholderTextColor="#64748B"
            autoCapitalize="none"
            keyboardType="email-address"
            className="mr-2 h-12 flex-1 rounded-xl border border-border bg-card px-3 text-base text-white"
          />
          <Pressable
            onPress={addAdhoc}
            className="h-12 w-12 items-center justify-center rounded-xl bg-brand-orange/20"
          >
            <Ionicons name="add" size={22} color="#F97316" />
          </Pressable>
        </View>

        {/* OSHA toggle */}
        <View className="mt-6 rounded-xl border border-border bg-card p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-base font-medium text-white">Include OSHA citations</Text>
              <Text className="mt-1 text-xs text-slate-400">
                Adds OSHA reference codes under each hazard in the PDF
              </Text>
            </View>
            <Switch
              value={oshaCitationsIncluded}
              onValueChange={onToggleOshaCitations}
              trackColor={{ false: '#334155', true: '#F97316' }}
              thumbColor="#F8FAFC"
            />
          </View>
        </View>

        <View className="h-24" />
      </ScrollView>

      <View className="flex-row items-center border-t border-border bg-card px-4 py-3">
        <Pressable
          onPress={onBack}
          disabled={sending}
          className="mr-2 h-12 w-24 items-center justify-center rounded-xl border border-border"
        >
          <Text className="text-base text-slate-400">Back</Text>
        </Pressable>
        <Pressable
          onPress={handleSend}
          disabled={sending}
          className="ml-2 h-12 flex-1 flex-row items-center justify-center rounded-xl bg-brand-orange"
          style={{ opacity: sending ? 0.6 : 1 }}
        >
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="paper-plane" size={18} color="#fff" />
              <Text className="ml-2 text-base font-bold text-white">Send & Submit</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
