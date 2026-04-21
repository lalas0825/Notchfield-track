/**
 * Screen 4 — Distribute.
 *
 * Same contract as PTP's distribute screen. We reuse `distributeSafetyDoc`
 * (the doc_type-agnostic alias of `distributePtp`) so the HTTP payload and
 * offline queue behaviour stay identical — the server's PDF renderer
 * branches on doc_type to produce the Toolbox layout.
 *
 * Adds a Discussion notes field (toolbox-specific) that the foreman can
 * jot field observations into before sending. These land in
 * `content.discussion_notes` via the parent wizard.
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
import type { PtpPdfLabels } from '@/features/safety/ptp/types';
import { distributeSafetyDoc } from '@/features/safety/ptp/services/distributeService';

type Props = {
  docId: string;
  labels: PtpPdfLabels;
  defaultRecipients: string[];
  oshaCitationsIncluded: boolean;
  discussionNotes: string;
  signatureCount: number;
  onToggleOshaCitations: (next: boolean) => void;
  onDiscussionNotesChange: (next: string) => void;
  onSent: (result: { queued?: boolean; emailsSent?: number }) => void;
  onBack: () => void;
};

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export function ToolboxDistribute({
  docId,
  labels,
  defaultRecipients,
  oshaCitationsIncluded,
  discussionNotes,
  signatureCount,
  onToggleOshaCitations,
  onDiscussionNotesChange,
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
    const result = await distributeSafetyDoc(
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
        <View className="mb-4 rounded-xl border border-border bg-card p-4">
          <View className="flex-row items-center">
            <Ionicons name="shield-checkmark" size={18} color="#22C55E" />
            <Text className="ml-2 text-sm font-bold text-white">
              {signatureCount} signature{signatureCount === 1 ? '' : 's'} captured
            </Text>
          </View>
          <Text className="mt-2 text-xs text-slate-400">
            PDF generated server-side at notchfield.com. Each copy is stamped
            with a SHA-256 integrity hash verifiable at notchfield.com/verify.
          </Text>
        </View>

        <Text className="mb-2 text-xs font-bold uppercase text-slate-500">Send to</Text>
        {recipients.length === 0 ? (
          <Text className="mb-2 text-sm text-slate-400">
            No default recipients — PM should configure project
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

        <View className="mt-6 rounded-xl border border-border bg-card p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-base font-medium text-white">Include OSHA citations</Text>
              <Text className="mt-1 text-xs text-slate-400">
                Stamps OSHA ref codes under key points in the PDF
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

        <Text className="mb-2 mt-6 text-xs font-bold uppercase text-slate-500">
          Field notes (optional)
        </Text>
        <TextInput
          value={discussionNotes}
          onChangeText={onDiscussionNotesChange}
          placeholder="e.g., Mario mentioned N95 too tight, scheduling fit-test next week"
          placeholderTextColor="#64748B"
          multiline
          textAlignVertical="top"
          className="rounded-xl border border-border bg-card p-3 text-sm text-white"
          style={{ minHeight: 100 }}
        />

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
              <Text className="ml-2 text-base font-bold text-white">Submit &amp; Send</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
