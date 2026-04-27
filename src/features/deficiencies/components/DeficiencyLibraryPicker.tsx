/**
 * Sprint 71 — Deficiency library picker.
 *
 * Bottom sheet that lets the foreman pick a template from the deficiency
 * library, grouped by trade. Templates surface their title, severity,
 * and a 1-line description. Tapping picks the template and closes the
 * sheet, returning the selection to the parent (ReportDeficiencyModal).
 *
 * Empty state: "Library not yet available" — happens before PowerSync
 * has synced deficiency_library or for an org with no relevant trades.
 * The fallback escape is a "Skip — describe manually" button so the
 * foreman can still file a free-text deficiency (auto-blindaje §8 says
 * library is preferred but free-text is allowed when no match exists).
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
import { useDeficiencyLibrary } from '../hooks/useDeficiencyLibrary';
import { SEVERITY_COLOR, SEVERITY_LABEL } from '../types';
import type { DeficiencyLibrary } from '../types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick: (template: DeficiencyLibrary) => void;
  /** Triggered when user taps "Skip — describe manually". */
  onSkip: () => void;
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

export function DeficiencyLibraryPicker({
  visible,
  onClose,
  onPick,
  onSkip,
}: Props) {
  const { byTrade, loading } = useDeficiencyLibrary();
  const [query, setQuery] = useState('');

  const filteredByTrade = useMemo(() => {
    if (!query.trim()) return byTrade;
    const q = query.toLowerCase();
    const out: Record<string, DeficiencyLibrary[]> = {};
    for (const [trade, items] of Object.entries(byTrade)) {
      const matches = items.filter(
        (t) =>
          t.default_title.toLowerCase().includes(q) ||
          (t.category ?? '').toLowerCase().includes(q) ||
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
            maxHeight: '80%',
          }}
        >
          {/* Drag handle */}
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
              Pick a Template
            </Text>
            <Text style={{ color: '#94A3B8', fontSize: 13, marginTop: 4 }}>
              Choose the closest match — you can edit details on the next step.
            </Text>

            {/* Search */}
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
            contentContainerStyle={{ paddingBottom: 20 }}
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
                <Ionicons name="library-outline" size={40} color="#475569" />
                <Text
                  style={{
                    color: '#94A3B8',
                    marginTop: 12,
                    textAlign: 'center',
                  }}
                >
                  {query
                    ? 'No templates match your search.'
                    : 'No templates available yet — describe the issue manually.'}
                </Text>
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
                      <View
                        style={{
                          width: 4,
                          alignSelf: 'stretch',
                          borderRadius: 2,
                          backgroundColor: SEVERITY_COLOR[t.default_severity],
                        }}
                      />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          numberOfLines={2}
                          style={{
                            color: '#F8FAFC',
                            fontSize: 15,
                            fontWeight: '600',
                          }}
                        >
                          {t.default_title}
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
                        <Text
                          style={{
                            color: SEVERITY_COLOR[t.default_severity],
                            fontSize: 11,
                            fontWeight: '700',
                            marginTop: 4,
                            letterSpacing: 0.5,
                            textTransform: 'uppercase',
                          }}
                        >
                          {SEVERITY_LABEL[t.default_severity]}
                          {t.category ? ` · ${t.category}` : ''}
                        </Text>
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

          {/* Footer — escape hatch */}
          <View
            style={{
              padding: 16,
              borderTopWidth: 1,
              borderTopColor: '#0F172A',
            }}
          >
            <Pressable
              onPress={() => {
                onSkip();
                onClose();
              }}
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
                Skip — describe manually
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
