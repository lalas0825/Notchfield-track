/**
 * Reusable body of the calculator — used by both the standalone screen
 * (under More) and the floating modal (on Plans). Keeps the input,
 * display, precision toggle, history, helpers grid, and keypad in one
 * scrollable column so we don't duplicate layout in two places.
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Display } from './Display';
import { HelperSheet } from './HelperSheet';
import { HistoryList } from './HistoryList';
import { Keypad } from './Keypad';
import { UnitToggle } from './UnitToggle';
import { useCalculator } from '../hooks/useCalculator';
import { useHistory } from '../hooks/useHistory';
import { haptic } from '@/shared/lib/haptics';

export function CalculatorBody() {
  const { t } = useTranslation();
  const expression = useCalculator((s) => s.expression);
  const result = useCalculator((s) => s.result);
  const error = useCalculator((s) => s.error);
  const setExpression = useCalculator((s) => s.setExpression);
  const evaluateNow = useCalculator((s) => s.evaluateNow);
  const { add: addHistory } = useHistory();
  const [showHelpers, setShowHelpers] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // When result becomes a fresh, valid value (transitioning from null), persist to history.
  // We track previous result via a closure so we only commit one entry per evaluation.
  useEffect(() => {
    if (!result || !expression.trim()) return;
    void addHistory({
      expression: expression.trim(),
      value: result.value,
      kind: result.kind,
    });
    // Effect intentionally fires on every result change; addHistory dedups by id+timestamp.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
    >
      <View className="px-4 pt-3">
        {/* Expression input */}
        <View className="mb-3 flex-row items-center rounded-xl border border-border bg-card px-3 py-3">
          <TextInput
            className="flex-1 text-2xl font-semibold text-white"
            value={expression}
            onChangeText={setExpression}
            placeholder={`5'3 1/4 + 2'7 1/2`}
            placeholderTextColor="#475569"
            autoCorrect={false}
            autoCapitalize="none"
            keyboardType="default"
            returnKeyType="done"
            onSubmitEditing={() => evaluateNow()}
            accessibilityLabel="Calculator expression"
          />
          {expression ? (
            <Pressable
              onPress={() => {
                void haptic.light();
                setExpression('');
              }}
              accessibilityRole="button"
              accessibilityLabel="Clear expression"
              className="ml-2 h-8 w-8 items-center justify-center rounded-full active:bg-border"
            >
              <Ionicons name="close-circle" size={20} color="#64748B" />
            </Pressable>
          ) : null}
        </View>

        {/* Result display */}
        <Display value={result} error={error} />

        {/* Precision toggle */}
        <UnitToggle />

        {/* Tools + History toggles */}
        <View className="mb-3 flex-row" style={{ gap: 8 }}>
          <Pressable
            onPress={() => {
              void haptic.medium();
              setShowHelpers(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={t('calculator.tools')}
            className="flex-1 flex-row items-center justify-center rounded-xl border border-border bg-card px-4 py-3 active:opacity-80"
          >
            <Ionicons name="construct-outline" size={18} color="#F97316" />
            <Text className="ml-2 text-sm font-semibold text-white">
              {t('calculator.tools')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              void haptic.selection();
              setShowHistory((v) => !v);
            }}
            accessibilityRole="button"
            accessibilityLabel={t('calculator.history')}
            className={`flex-1 flex-row items-center justify-center rounded-xl border px-4 py-3 active:opacity-80 ${
              showHistory ? 'border-brand-orange bg-brand-orange/10' : 'border-border bg-card'
            }`}
          >
            <Ionicons name="time-outline" size={18} color="#A855F7" />
            <Text className="ml-2 text-sm font-semibold text-white">
              {t('calculator.history')}
            </Text>
          </Pressable>
        </View>

        {showHistory ? (
          <View className="mb-3">
            <HistoryList />
          </View>
        ) : null}
      </View>

      {/* Keypad */}
      <Keypad />

      <HelperSheet visible={showHelpers} onClose={() => setShowHelpers(false)} />
    </ScrollView>
  );
}
