/**
 * Sprint 72 — Sign-Off library picker.
 *
 * Bottom sheet that lets the foreman pick a signoff template, grouped by
 * trade. Polish R2: templates are pre-filtered by `org.primary_trades +
 * 'general'` (handled inside useSignoffTemplates) so e.g. Jantile sees
 * 11 templates instead of all 14.
 *
 * On pick → returns the template to parent (CreateSignoffModal Step 2)
 * and closes. No "Skip — manually" escape hatch (unlike Deficiencies)
 * because ad-hoc signoffs aren't part of the P0 pilot scope; foreman
 * always picks from library. Add later if needed.
 */

import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSignoffTemplates } from '../hooks/useSignoffTemplates';
import type { SignoffTemplate } from '../types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick: (template: SignoffTemplate) => void;
};

const TRADE_LABELS: Record<string, string> = {
  tile: 'Tile',
  marble: 'Marble',
  stone: 'Stone',
  paint: 'Paint',
  drywall: 'Drywall',
  flooring: 'Flooring',
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  hvac: 'HVAC',
  carpentry: 'Carpentry',
  general: 'General',
  other: 'Other',
};

function tradeLabel(trade: string): string {
  return TRADE_LABELS[trade.toLowerCase()] ?? trade;
}

const SIGNER_ROLE_LABEL: Record<string, string> = {
  contractor: 'Contractor signs',
  gc: 'GC signs',
  either: 'Either party',
};

const STATUS_AFTER_LABEL: Record<string, string> = {
  unlocks_next_trade: 'Unlocks next trade',
  closes_phase: 'Closes phase',
  archives: 'Archives only',
};

export function SignoffLibraryPicker({ visible, onClose, onPick }: Props) {
  const { byTrade, loading, error, source, reload } = useSignoffTemplates();
  const [query, setQuery] = useState('');

  const filteredByTrade = useMemo(() => {
    if (!query.trim()) return byTrade;
    const q = query.toLowerCase();
    const out: Record<string, SignoffTemplate[]> = {};
    for (const [trade, items] of Object.entries(byTrade)) {
      const matches = items.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.description ?? '').toLowerCase().includes(q),
      );
      if (matches.length > 0) out[trade] = matches;
    }
    return out;
  }, [byTrade, query]);

  const trades = Object.keys(filteredByTrade).sort();
  const isEmpty = !loading && trades.length === 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(0,0,0,0.6)',
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            backgroundColor: '#1E293B',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderTopWidth: 1,
            borderColor: '#334155',
            // Use definite height instead of maxHeight so the ScrollView
            // inside has room to render the empty state. With maxHeight,
            // the sheet collapsed to its natural content size when the
            // ScrollView was empty (no rows in signoff_templates locally),
            // hiding the "No templates loaded" + Retry CTA.
            height: '85%',
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

          <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
            <Text style={{ color: '#F8FAFC', fontSize: 20, fontWeight: '700' }}>
              Pick a Sign-Off Template
            </Text>
            <Text style={{ color: '#94A3B8', fontSize: 13, marginTop: 4 }}>
              Choose the formal acceptance you need signed.
            </Text>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#0F172A',
                borderRadius: 10,
                paddingHorizontal: 12,
                marginTop: 12,
                borderWidth: 1,
                borderColor: '#334155',
              }}
            >
              <Ionicons name="search" size={18} color="#64748B" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search templates"
                placeholderTextColor="#64748B"
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  paddingHorizontal: 8,
                  color: '#F8FAFC',
                  fontSize: 15,
                }}
              />
              {query.length > 0 ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color="#64748B" />
                </Pressable>
              ) : null}
            </View>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            {loading ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Text style={{ color: '#94A3B8' }}>Loading library…</Text>
              </View>
            ) : isEmpty ? (
              <View
                style={{
                  padding: 32,
                  alignItems: 'center',
                  paddingHorizontal: 24,
                }}
              >
                <Ionicons name="document-text-outline" size={40} color="#475569" />
                <Text
                  style={{
                    color: '#94A3B8',
                    marginTop: 12,
                    textAlign: 'center',
                  }}
                >
                  {query
                    ? 'No templates match your search.'
                    : 'No templates loaded yet.'}
                </Text>
                {!query ? (
                  <>
                    <Text
                      style={{
                        color: '#64748B',
                        marginTop: 8,
                        fontSize: 12,
                        textAlign: 'center',
                      }}
                    >
                      Tap Retry to refetch from the server. If still empty,
                      sign out and back in to refresh local data.
                    </Text>
                    {error ? (
                      <Text
                        style={{
                          color: '#FCA5A5',
                          marginTop: 12,
                          fontSize: 11,
                          textAlign: 'center',
                        }}
                        numberOfLines={3}
                      >
                        Error: {error}
                      </Text>
                    ) : null}
                    <Pressable
                      onPress={() => {
                        reload();
                      }}
                      style={{
                        marginTop: 16,
                        paddingHorizontal: 18,
                        paddingVertical: 10,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: '#F97316',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Ionicons name="refresh" size={16} color="#F97316" />
                      <Text style={{ color: '#F97316', fontSize: 14, fontWeight: '700' }}>
                        Retry
                      </Text>
                    </Pressable>
                  </>
                ) : null}
              </View>
            ) : (
              trades.map((trade) => (
                <View key={trade}>
                  <View
                    style={{
                      paddingHorizontal: 20,
                      paddingTop: 16,
                      paddingBottom: 6,
                    }}
                  >
                    <Text
                      style={{
                        color: '#64748B',
                        fontSize: 11,
                        fontWeight: '700',
                        letterSpacing: 1,
                        textTransform: 'uppercase',
                      }}
                    >
                      {tradeLabel(trade)}
                    </Text>
                  </View>
                  {filteredByTrade[trade].map((t) => (
                    <Pressable
                      key={t.id}
                      onPress={() => {
                        onPick(t);
                        onClose();
                      }}
                      android_ripple={{ color: '#0F172A' }}
                      style={{
                        paddingVertical: 12,
                        paddingHorizontal: 20,
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        gap: 10,
                        borderTopWidth: 1,
                        borderTopColor: '#0F172A',
                      }}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          numberOfLines={2}
                          style={{
                            color: '#F8FAFC',
                            fontSize: 15,
                            fontWeight: '600',
                          }}
                        >
                          {t.name}
                        </Text>
                        {t.description ? (
                          <Text
                            numberOfLines={2}
                            style={{
                              color: '#94A3B8',
                              fontSize: 13,
                              marginTop: 2,
                            }}
                          >
                            {t.description}
                          </Text>
                        ) : null}
                        <View
                          style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            gap: 6,
                            marginTop: 6,
                          }}
                        >
                          <MetaChip
                            text={SIGNER_ROLE_LABEL[t.signer_role] ?? t.signer_role}
                          />
                          <MetaChip
                            text={`${t.required_evidence.length} evidence ${
                              t.required_evidence.length === 1 ? 'rule' : 'rules'
                            }`}
                          />
                          {t.allows_multi_area ? <MetaChip text="Multi-area" /> : null}
                          <MetaChip
                            text={
                              STATUS_AFTER_LABEL[t.default_status_after_sign] ??
                              t.default_status_after_sign
                            }
                          />
                        </View>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color="#475569"
                        style={{ marginTop: 2 }}
                      />
                    </Pressable>
                  ))}
                </View>
              ))
            )}
          </ScrollView>

          <View
            style={{
              padding: 16,
              borderTopWidth: 1,
              borderTopColor: '#0F172A',
            }}
          >
            <Pressable
              onPress={onClose}
              style={{
                height: 48,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#334155',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#94A3B8', fontSize: 14, fontWeight: '600' }}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function MetaChip({ text }: { text: string }) {
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: '#0F172A',
        borderWidth: 1,
        borderColor: '#334155',
      }}
    >
      <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '600' }}>
        {text}
      </Text>
    </View>
  );
}
