/**
 * Sprint 72 — Create Sign-Off modal (2-step).
 *
 * Step 1 (mode='pick'): library picker (delegated to SignoffLibraryPicker).
 *   Foreman taps a template → state advances to Step 2.
 *
 * Step 2 (mode='form'): the full form.
 *   - Recipient name + company inputs (Polish R1 — live-substitute body)
 *   - Body preview (read-only, rendered from template + recipient)
 *   - Optional notes textarea (Polish R2)
 *   - Areas chip row (defaults to the current area; multi-area picker is
 *     deferred to Phase 2 — for P0, foreman creates one signoff per area
 *     and PM consolidates if needed)
 *   - Slot-based evidence cards (Polish R1 critical) — ONE upload card per
 *     `required_evidence` rule. Photo's `label` is injected from the rule
 *     so server-side label exact-match validation passes. NO free-text
 *     label entry by the foreman.
 *
 * On submit: upload photos in parallel → build evidence[] with rule labels
 * → renderSignoffBody with substitutions → POST /api/signoffs/create.
 *
 * Auto-blindaje §10: required evidence enforced client-side BEFORE submit
 * so the foreman sees a friendly error instead of a 500 from the server.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { SignoffLibraryPicker } from './SignoffLibraryPicker';
import {
  createSignoffViaWeb,
  type CreateSignoffEvidence,
  type CreateSignoffResult,
} from '../services/signoffApiClient';
import { uploadSignoffPhotos } from '../services/signoffPhotos';
import {
  renderSignoffBody,
  type SignoffEvidenceRule,
  type SignoffTemplate,
} from '../types';

type Mode = 'pick' | 'form' | 'submitting' | 'success';

type EvidenceSlot = {
  rule: SignoffEvidenceRule;
  /** Local file URI before upload (file:// or content://). */
  localUri: string | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Project the new signoff belongs to. */
  projectId: string;
  /** Default area pre-populated (the current AreaDetail screen). */
  defaultArea: { areaId: string; label: string; surfaceId?: string };
  /** Optional callback after successful create — refresh parent's list. */
  onCreated?: (result: CreateSignoffResult) => void;
};

export function CreateSignoffModal({
  visible,
  onClose,
  projectId,
  defaultArea,
  onCreated,
}: Props) {
  const { profile } = useAuthStore();
  const orgId = profile?.organization_id ?? null;
  const userName = profile?.full_name?.trim() || 'Field crew';

  const [mode, setMode] = useState<Mode>('pick');
  const [template, setTemplate] = useState<SignoffTemplate | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [recipientCompany, setRecipientCompany] = useState('');
  const [notes, setNotes] = useState('');
  const [evidenceSlots, setEvidenceSlots] = useState<EvidenceSlot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateSignoffResult | null>(null);

  const reset = useCallback(() => {
    setMode('pick');
    setTemplate(null);
    setRecipientName('');
    setRecipientCompany('');
    setNotes('');
    setEvidenceSlots([]);
    setError(null);
    setCreated(null);
  }, []);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  // When picker returns a template, initialize evidence slots (one per rule)
  // and advance to the form step.
  const onPickTemplate = useCallback((t: SignoffTemplate) => {
    setTemplate(t);
    setEvidenceSlots(
      t.required_evidence.map((rule) => ({ rule, localUri: null })),
    );
    setMode('form');
  }, []);

  // Re-show the picker when re-opened after close (only relevant if
  // visible flips false then back true with a stale state).
  useEffect(() => {
    if (visible && mode === 'pick' && template === null) {
      // initial state, no-op
    }
  }, [visible, mode, template]);

  const today = useMemo(() => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${m}/${day}/${d.getFullYear()}`;
  }, []);

  const renderedBody = useMemo(() => {
    if (!template) return '';
    return renderSignoffBody(template.body_template, {
      areas: defaultArea.label,
      trade: template.trade,
      gc: recipientName,
      contractor: userName,
      date: today,
      project: '',
    });
  }, [template, defaultArea.label, recipientName, userName, today]);

  const handleAttachPhoto = useCallback(
    async (slotIndex: number, source: 'camera' | 'gallery') => {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Permission required',
          `${source === 'camera' ? 'Camera' : 'Gallery'} access needed.`,
        );
        return;
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
          : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
      if (result.canceled || !result.assets[0]) return;
      setEvidenceSlots((prev) =>
        prev.map((slot, i) =>
          i === slotIndex ? { ...slot, localUri: result.assets[0].uri } : slot,
        ),
      );
    },
    [],
  );

  const handleRemovePhoto = useCallback((slotIndex: number) => {
    setEvidenceSlots((prev) =>
      prev.map((slot, i) =>
        i === slotIndex ? { ...slot, localUri: null } : slot,
      ),
    );
  }, []);

  const missingRequired = useMemo(() => {
    return evidenceSlots.filter((s) => s.rule.required && !s.localUri);
  }, [evidenceSlots]);

  const handleSubmit = useCallback(async () => {
    if (!template || !orgId) return;

    if (missingRequired.length > 0) {
      Alert.alert(
        'Evidence required',
        `Add a photo for: ${missingRequired.map((s) => s.rule.label).join(', ')}`,
      );
      return;
    }

    setMode('submitting');
    setError(null);
    try {
      // Upload photos in parallel (slots that have a localUri).
      const slotsWithPhotos = evidenceSlots.filter((s) => s.localUri);
      const uploadedUrls =
        slotsWithPhotos.length > 0
          ? await uploadSignoffPhotos(
              slotsWithPhotos.map((s) => s.localUri as string),
              orgId,
            )
          : [];

      // Build evidence[] with EXACT-MATCH labels from the rules — this
      // is the Polish R1 critical contract: server validates labels
      // against the rule labels char-for-char on `send`. If we put a
      // generic "Evidence 1" label here, the send call fails with 500.
      //
      // 2026-04-29 — Always stamp `type: 'photo'` for uploaded images,
      // regardless of `slot.rule.type`. Some templates declare a slot as
      // `type: 'numeric_reading'` (e.g. Heat Mat Approval's ohm reading)
      // expecting a numeric value, but Track UI only exposes Camera/
      // Gallery — user takes a photo OF the meter display. If we stamp
      // `numeric_reading` on the evidence, Web's PDF/sign-page renderer
      // hides it (only renders type='photo' as images). Pilot reported
      // "solo adjunto una foto de dos" — second slot was numeric_reading
      // type, photo was uploaded but never rendered.
      // The label preserves the slot context. When Track UI grows a
      // proper numeric input for numeric_reading slots, revisit this.
      const evidence: CreateSignoffEvidence[] = slotsWithPhotos.map(
        (slot, i) => ({
          url: uploadedUrls[i] ?? (slot.localUri as string),
          type: 'photo',
          label: slot.rule.label,
        }),
      );

      const result = await createSignoffViaWeb({
        projectId,
        templateId: template.id,
        areas: [
          {
            areaId: defaultArea.areaId,
            surfaceId: defaultArea.surfaceId,
            label: defaultArea.label,
          },
        ],
        evidence: evidence.length > 0 ? evidence : undefined,
        notes: notes.trim() || null,
        body: renderedBody,
      });

      setCreated(result);
      setMode('success');
      onCreated?.(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not create sign-off';
      setError(msg);
      setMode('form');
    }
  }, [
    template,
    orgId,
    missingRequired,
    evidenceSlots,
    projectId,
    defaultArea,
    notes,
    renderedBody,
    onCreated,
  ]);

  const closeIfNotBusy = () => {
    if (mode !== 'submitting') close();
  };

  return (
    <>
      {/* Step 1 — library picker (own modal). When user picks a template,
          we immediately switch the parent modal into 'form' mode. */}
      <SignoffLibraryPicker
        visible={visible && mode === 'pick'}
        onClose={() => {
          if (template === null) close();
        }}
        onPick={onPickTemplate}
      />

      {/* Step 2+ — main modal.
          KeyboardAvoidingView removed 2026-04-29 after pilot reported the
          screen flickering on keyboard dismiss. Root cause: KAV with
          behavior='height' on Android shrinks its container by keyboard
          height during keyboard animation. The sheet's `height: '92%'`
          recomputed against the live-shrinking KAV parent, oscillating
          per frame. Same bug at maxHeight too — any percentage-based
          sheet height inside a KAV-managed parent will thrash.
          ScrollView with keyboardShouldPersistTaps='handled' handles
          input visibility natively (cursor stays visible above keyboard
          via Android's softInput resize behavior). */}
      <Modal
        visible={visible && mode !== 'pick'}
        transparent
        animationType="slide"
        onRequestClose={closeIfNotBusy}
        statusBarTranslucent
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
                {mode === 'success' && created ? (
                  <SuccessBody created={created} onDone={close} />
                ) : (
                  <FormBody
                    template={template}
                    defaultArea={defaultArea}
                    recipientName={recipientName}
                    recipientCompany={recipientCompany}
                    notes={notes}
                    body={renderedBody}
                    evidenceSlots={evidenceSlots}
                    error={error}
                    submitting={mode === 'submitting'}
                    onChangeRecipient={setRecipientName}
                    onChangeCompany={setRecipientCompany}
                    onChangeNotes={setNotes}
                    onAttach={handleAttachPhoto}
                    onRemove={handleRemovePhoto}
                    onSubmit={handleSubmit}
                    onBack={() => {
                      setTemplate(null);
                      setEvidenceSlots([]);
                      setMode('pick');
                    }}
                    onCancel={close}
                  />
                )}
              </ScrollView>
            </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ─── Form body (Step 2) ───────────────────────────────────────────────────

function FormBody(props: {
  template: SignoffTemplate | null;
  defaultArea: { areaId: string; label: string; surfaceId?: string };
  recipientName: string;
  recipientCompany: string;
  notes: string;
  body: string;
  evidenceSlots: EvidenceSlot[];
  error: string | null;
  submitting: boolean;
  onChangeRecipient: (v: string) => void;
  onChangeCompany: (v: string) => void;
  onChangeNotes: (v: string) => void;
  onAttach: (slotIndex: number, source: 'camera' | 'gallery') => Promise<void>;
  onRemove: (slotIndex: number) => void;
  onSubmit: () => void;
  onBack: () => void;
  onCancel: () => void;
}) {
  if (!props.template) return null;

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Pressable onPress={props.onBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={20} color="#94A3B8" />
        </Pressable>
        <Text style={{ color: '#94A3B8', fontSize: 13 }}>Choose template</Text>
      </View>

      <Text
        style={{
          color: '#F8FAFC',
          fontSize: 22,
          fontWeight: '700',
          marginTop: 8,
        }}
      >
        {props.template.name}
      </Text>
      <Text style={{ color: '#94A3B8', fontSize: 13, marginTop: 4 }}>
        Area: {props.defaultArea.label}
      </Text>

      {/* Recipient inputs (Polish R1) */}
      <Text style={Label}>Recipient (GC) name</Text>
      <TextInput
        value={props.recipientName}
        onChangeText={props.onChangeRecipient}
        placeholder="Leave blank to fill at signing"
        placeholderTextColor="#64748B"
        style={Input}
        editable={!props.submitting}
      />

      <Text style={Label}>Recipient company</Text>
      <TextInput
        value={props.recipientCompany}
        onChangeText={props.onChangeCompany}
        placeholder="Optional"
        placeholderTextColor="#64748B"
        style={Input}
        editable={!props.submitting}
      />

      {/* Body preview (read-only) */}
      <Text style={Label}>Body preview</Text>
      <View
        style={{
          backgroundColor: '#0F172A',
          borderRadius: 10,
          padding: 12,
          borderWidth: 1,
          borderColor: '#334155',
          minHeight: 100,
        }}
      >
        <Text style={{ color: '#E2E8F0', fontSize: 13, lineHeight: 20 }}>
          {props.body}
        </Text>
      </View>

      {/* Notes (Polish R2) */}
      <Text style={Label}>Additional notes (optional)</Text>
      <TextInput
        value={props.notes}
        onChangeText={props.onChangeNotes}
        placeholder="Verify between 9-11 AM / Note minor scratches / etc."
        placeholderTextColor="#64748B"
        multiline
        numberOfLines={3}
        style={[Input, { minHeight: 72, textAlignVertical: 'top' }]}
        editable={!props.submitting}
      />

      {/* Slot-based evidence (Polish R1 critical) */}
      <Text style={Label}>
        Evidence ({props.evidenceSlots.length} {props.evidenceSlots.length === 1 ? 'slot' : 'slots'})
      </Text>
      {props.evidenceSlots.map((slot, i) => (
        <EvidenceSlotCard
          key={`${slot.rule.label}-${i}`}
          slot={slot}
          onAttach={(src) => props.onAttach(i, src)}
          onRemove={() => props.onRemove(i)}
          disabled={props.submitting}
        />
      ))}

      {props.error ? (
        <View style={ErrorBox}>
          <Ionicons name="alert-circle" size={18} color="#F87171" />
          <Text style={ErrorText} numberOfLines={4}>
            {props.error}
          </Text>
        </View>
      ) : null}

      <View style={{ marginTop: 24, gap: 10 }}>
        <Pressable
          onPress={props.onSubmit}
          disabled={props.submitting}
          style={[PrimaryButton, props.submitting && { opacity: 0.5 }]}
        >
          {props.submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="document-text" size={20} color="#FFFFFF" />
              <Text style={PrimaryButtonText}>Create Sign-Off</Text>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={props.onCancel}
          disabled={props.submitting}
          style={{
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#64748B', fontSize: 13 }}>Cancel</Text>
        </Pressable>
      </View>
    </>
  );
}

function EvidenceSlotCard({
  slot,
  onAttach,
  onRemove,
  disabled,
}: {
  slot: EvidenceSlot;
  onAttach: (source: 'camera' | 'gallery') => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  const isFilled = !!slot.localUri;
  const required = slot.rule.required;

  return (
    <View
      style={{
        marginTop: 10,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: !isFilled && required ? '#F59E0B' : '#334155',
        backgroundColor: '#0F172A',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text
            style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '600' }}
            numberOfLines={2}
          >
            {slot.rule.label}
          </Text>
          <Text style={{ color: '#64748B', fontSize: 11, marginTop: 2 }}>
            {slot.rule.type}
            {required ? ' · required' : ' · optional'}
          </Text>
        </View>
        {required && !isFilled ? (
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 6,
              backgroundColor: '#F59E0B',
            }}
          >
            <Text
              style={{ color: '#000', fontSize: 10, fontWeight: '700' }}
            >
              REQUIRED
            </Text>
          </View>
        ) : null}
      </View>

      {isFilled && slot.localUri ? (
        <View style={{ marginTop: 10 }}>
          <Image
            source={{ uri: slot.localUri }}
            style={{
              width: '100%',
              height: 160,
              borderRadius: 8,
              backgroundColor: '#1E293B',
            }}
            resizeMode="cover"
          />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Pressable
              onPress={() => onAttach('camera')}
              disabled={disabled}
              style={SmallSecondaryBtn}
            >
              <Ionicons name="camera" size={14} color="#F97316" />
              <Text style={SmallSecondaryBtnText}>Replace</Text>
            </Pressable>
            <Pressable
              onPress={onRemove}
              disabled={disabled}
              style={SmallGhostBtn}
            >
              <Ionicons name="trash-outline" size={14} color="#EF4444" />
              <Text style={[SmallGhostBtnText, { color: '#EF4444' }]}>
                Remove
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <Pressable
            onPress={() => onAttach('camera')}
            disabled={disabled}
            style={[AttachBtn, { flex: 1 }]}
          >
            <Ionicons name="camera" size={16} color="#F97316" />
            <Text style={AttachBtnText}>Camera</Text>
          </Pressable>
          <Pressable
            onPress={() => onAttach('gallery')}
            disabled={disabled}
            style={[AttachBtn, { flex: 1 }]}
          >
            <Ionicons name="images" size={16} color="#F97316" />
            <Text style={AttachBtnText}>Gallery</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ─── Success state ────────────────────────────────────────────────────────

function SuccessBody({
  created,
  onDone,
}: {
  created: CreateSignoffResult;
  onDone: () => void;
}) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 8 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: '#0B1F1A',
          borderWidth: 2,
          borderColor: '#22C55E',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <Ionicons name="checkmark" size={32} color="#22C55E" />
      </View>
      <Text style={{ color: '#F8FAFC', fontSize: 22, fontWeight: '700' }}>
        Sign-Off Created
      </Text>
      <Text style={{ color: '#94A3B8', fontSize: 13, marginTop: 6 }}>
        #{created.number} · saved as draft
      </Text>
      <Text
        style={{
          color: '#64748B',
          fontSize: 12,
          marginTop: 12,
          textAlign: 'center',
          paddingHorizontal: 16,
        }}
      >
        Open the sign-off from More → Compliance to send for signature or sign in person.
      </Text>

      <Pressable
        onPress={onDone}
        style={[PrimaryButton, { width: '100%', marginTop: 24 }]}
      >
        <Text style={PrimaryButtonText}>Done</Text>
      </Pressable>
    </View>
  );
}

// ─── Styles (inline objects, matching ExportToGcModal pattern) ───────────

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

const AttachBtn = {
  height: 44,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: '#F97316',
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  flexDirection: 'row' as const,
  gap: 6,
};

const AttachBtnText = {
  color: '#F97316',
  fontSize: 13,
  fontWeight: '700' as const,
};

const SmallSecondaryBtn = {
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: '#F97316',
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 4,
};

const SmallSecondaryBtnText = {
  color: '#F97316',
  fontSize: 12,
  fontWeight: '700' as const,
};

const SmallGhostBtn = {
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderRadius: 8,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 4,
};

const SmallGhostBtnText = {
  fontSize: 12,
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
