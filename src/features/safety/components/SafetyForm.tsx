import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useProjectStore } from '@/features/projects/store/project-store';
import { useSafetyDocs } from '../hooks/useSafetyDocs';
import { SignaturePad } from './SignaturePad';
import {
  type DocType,
  type SignatureEntry,
  PPE_OPTIONS,
  RISK_LEVELS,
  DOC_TYPE_LABELS,
  SafetyDocFormData,
} from '../types/schemas';

type HazardRow = {
  description: string;
  risk_level: string;
  controls: string;
  ppe: string[];
};

/**
 * PTP and Toolbox Talk were both removed from this form — both now have
 * dedicated wizards (src/app/(tabs)/docs/safety/ptp, .../toolbox). This
 * legacy form handles JHA only. The type narrowing makes the form refuse
 * any other doc_type at the compiler level.
 */
type LegacyDocType = 'jha';

type Props = {
  docType: LegacyDocType;
};

export function SafetyForm({ docType }: Props) {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { activeProject } = useProjectStore();
  const { createDoc } = useSafetyDocs();

  // Common fields
  const [title, setTitle] = useState(`${DOC_TYPE_LABELS[docType]} — ${new Date().toLocaleDateString()}`);
  const [location, setLocation] = useState(activeProject?.address ?? '');

  // JHA fields
  const [weather, setWeather] = useState('');
  const [hazards, setHazards] = useState<HazardRow[]>([
    { description: '', risk_level: 'medium', controls: '', ppe: [] },
  ]);

  // Signature
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);

    // JHA is the only doc type this form supports.
    const content: Record<string, unknown> = { location, weather, hazards };

    const signatures: SignatureEntry[] = signatureData
      ? [{ signer_name: profile?.full_name ?? 'Unknown', signature_data: signatureData, signed_at: new Date().toISOString() }]
      : [];

    // Validate with Zod
    const parsed = SafetyDocFormData.safeParse({
      doc_type: docType,
      title,
      content,
      signatures,
    });

    if (!parsed.success) {
      // Zod v4: use issues array
      const issues = (parsed.error as any).issues ?? (parsed.error as any).errors ?? [];
      const firstMessage = issues[0]?.message ?? 'Validation failed';
      setError(firstMessage);
      return;
    }

    setSaving(true);
    const result = await createDoc({
      doc_type: docType,
      title,
      content,
      signatures,
    });

    setSaving(false);
    if (result.success) {
      router.back();
    } else {
      setError(result.error ?? 'Failed to save');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1"
    >
      <ScrollView className="flex-1 bg-background px-4 pt-4" keyboardShouldPersistTaps="handled" nestedScrollEnabled>
        {/* Title */}
        <FieldLabel label="Title" />
        <StyledInput value={title} onChangeText={setTitle} placeholder="Document title" />

        {/* ─── JHA Form ─── */}
        {docType === 'jha' && (
          <>
            <FieldLabel label="Location" />
            <StyledInput value={location} onChangeText={setLocation} placeholder="Job site location" />

            <FieldLabel label="Weather Conditions" />
            <StyledInput value={weather} onChangeText={setWeather} placeholder="e.g., Clear, 75°F" />

            <SectionHeader title="Hazards" onAdd={() => setHazards([...hazards, { description: '', risk_level: 'medium', controls: '', ppe: [] }])} />

            {hazards.map((h, i) => (
              <View key={i} className="mb-4 rounded-xl border border-border bg-card p-4">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-sm font-bold text-white">Hazard #{i + 1}</Text>
                  {hazards.length > 1 && (
                    <Pressable onPress={() => setHazards(hazards.filter((_, j) => j !== i))}>
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </Pressable>
                  )}
                </View>

                <StyledInput
                  value={h.description}
                  onChangeText={(v) => updateHazard(i, 'description', v)}
                  placeholder="Describe the hazard"
                />

                {/* Risk level chips */}
                <Text className="mt-2 mb-1 text-sm text-slate-400">Risk Level</Text>
                <View className="flex-row flex-wrap gap-2">
                  {RISK_LEVELS.map((r) => (
                    <Pressable
                      key={r.value}
                      onPress={() => updateHazard(i, 'risk_level', r.value)}
                      className={`h-10 items-center justify-center rounded-lg px-4 ${h.risk_level === r.value ? 'border-2' : 'border border-border'}`}
                      style={h.risk_level === r.value ? { borderColor: r.color, backgroundColor: `${r.color}20` } : undefined}
                    >
                      <Text style={{ color: h.risk_level === r.value ? r.color : '#94A3B8' }} className="text-sm font-medium">
                        {r.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <StyledInput
                  value={h.controls}
                  onChangeText={(v) => updateHazard(i, 'controls', v)}
                  placeholder="Control measures"
                  multiline
                  style={{ marginTop: 8 }}
                />

                {/* PPE chips */}
                <Text className="mt-2 mb-1 text-sm text-slate-400">PPE Required</Text>
                <View className="flex-row flex-wrap gap-2">
                  {PPE_OPTIONS.map((ppe) => {
                    const selected = h.ppe.includes(ppe);
                    return (
                      <Pressable
                        key={ppe}
                        onPress={() => {
                          const updated = selected
                            ? h.ppe.filter((p) => p !== ppe)
                            : [...h.ppe, ppe];
                          updateHazard(i, 'ppe', updated);
                        }}
                        className={`h-9 items-center justify-center rounded-lg px-3 ${selected ? 'bg-brand-orange/20 border border-brand-orange' : 'border border-border'}`}
                      >
                        <Text className={`text-xs font-medium ${selected ? 'text-brand-orange' : 'text-slate-400'}`}>
                          {ppe}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </>
        )}

        {/* Toolbox Talk has its own wizard — no legacy form branch here. */}

        {/* ─── Signature ─── */}
        <View className="mt-6 mb-4">
          <Text className="mb-3 text-lg font-bold text-white">Signature</Text>
          <SignaturePad
            signerName={profile?.full_name ?? 'Foreman'}
            captured={signatureData !== null}
            onCapture={setSignatureData}
            onClear={() => setSignatureData(null)}
          />
        </View>

        {/* Error */}
        {error && (
          <View className="mb-4 rounded-xl bg-red-500/10 px-4 py-3">
            <Text className="text-center text-base text-danger">{error}</Text>
          </View>
        )}

        {/* Save button */}
        <Pressable
          onPress={handleSave}
          disabled={saving}
          className="mb-4 h-14 items-center justify-center rounded-xl bg-brand-orange active:opacity-80"
        >
          <Text className="text-lg font-bold text-white">
            {saving ? 'Saving...' : 'Save & Sign'}
          </Text>
        </Pressable>

        <View className="h-24" />
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // ─── Helpers ──────────────────────────────────────────
  function updateHazard(index: number, field: string, value: unknown) {
    const updated = [...hazards];
    (updated[index] as any)[field] = value;
    setHazards(updated);
  }
}

// ─── Reusable sub-components ─────────────────────────────

function FieldLabel({ label }: { label: string }) {
  return <Text className="mb-1 mt-4 text-sm font-medium text-slate-400">{label}</Text>;
}

function SectionHeader({ title, onAdd }: { title: string; onAdd: () => void }) {
  return (
    <View className="mt-6 mb-3 flex-row items-center justify-between">
      <Text className="text-lg font-bold text-white">{title}</Text>
      <Pressable
        onPress={onAdd}
        className="h-10 flex-row items-center rounded-lg bg-brand-orange/20 px-3 active:opacity-80"
      >
        <Ionicons name="add" size={18} color="#F97316" />
        <Text className="ml-1 text-sm font-medium text-brand-orange">Add</Text>
      </Pressable>
    </View>
  );
}

function StyledInput({
  value,
  onChangeText,
  placeholder,
  multiline,
  style,
  containerStyle,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  multiline?: boolean;
  style?: object;
  containerStyle?: object;
}) {
  return (
    <View style={containerStyle}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#64748B"
        multiline={multiline}
        className={`rounded-xl border border-border bg-card px-4 text-base text-white ${multiline ? 'h-20 pt-3' : 'h-14'}`}
        style={style}
      />
    </View>
  );
}
