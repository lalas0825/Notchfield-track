/**
 * Custom 64dp numpad with construction-flavored keys.
 *
 * Layout:
 *   7  8  9  /   '
 *   4  5  6  *   "
 *   1  2  3  -   .
 *   (  0  )  +   ⌫
 *
 *   mm  cm  m                                ← metric units (40dp)
 *   1/4  1/2  3/4  1/8  a/b▾                 ← fractions row + picker
 *
 *   [ C ] [    =    ]
 *
 * The fraction picker covers everything beyond the 4 quick-access ones
 * (3/8, 5/16, 9/16, etc) — see FractionPicker.tsx.
 */

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { haptic } from '@/shared/lib/haptics';
import { useCalculator } from '../hooks/useCalculator';
import { FractionPicker } from './FractionPicker';

const ROW1: KeySpec[] = [
  { label: '7' }, { label: '8' }, { label: '9' }, { label: '/' }, { label: "'" },
];
const ROW2: KeySpec[] = [
  { label: '4' }, { label: '5' }, { label: '6' }, { label: '*' }, { label: '"' },
];
const ROW3: KeySpec[] = [
  { label: '1' }, { label: '2' }, { label: '3' }, { label: '-' }, { label: '.' },
];
const ROW4: KeySpec[] = [
  { label: '(' }, { label: '0' }, { label: ')' }, { label: '+' }, { label: '⌫', kind: 'backspace' },
];

const METRIC: { label: string; insert: string }[] = [
  { label: 'mm', insert: 'mm' },
  { label: 'cm', insert: 'cm' },
  { label: 'm',  insert: 'm' },
];

const QUICK_FRACTIONS = ['1/4', '1/2', '3/4', '1/8'];

interface KeySpec {
  label: string;
  kind?: 'number' | 'backspace';
}

export function Keypad() {
  const append = useCalculator((s) => s.appendToExpression);
  const backspace = useCalculator((s) => s.backspace);
  const clear = useCalculator((s) => s.clear);
  const evaluate = useCalculator((s) => s.evaluateNow);
  const [showFractions, setShowFractions] = useState(false);

  const press = (spec: KeySpec) => {
    void haptic.light();
    if (spec.kind === 'backspace') {
      backspace();
      return;
    }
    append(spec.label);
  };

  const insertText = (text: string) => {
    void haptic.light();
    append(text);
  };

  const renderRow = (row: KeySpec[], rowIdx: number) => (
    <View key={`row-${rowIdx}`} className="flex-row" style={{ gap: 6 }}>
      {row.map((spec, i) => (
        <KeyButton key={`${rowIdx}-${i}`} spec={spec} onPress={() => press(spec)} />
      ))}
    </View>
  );

  return (
    <View className="px-2 pb-2" style={{ gap: 6 }}>
      {[ROW1, ROW2, ROW3, ROW4].map(renderRow)}

      {/* Metric units — secondary row, smaller height. Saves the user from
          opening the QWERTY keyboard just to type "mm". */}
      <View className="mt-1 flex-row" style={{ gap: 6 }}>
        {METRIC.map((m) => (
          <Pressable
            key={m.label}
            onPress={() => insertText(m.insert)}
            accessibilityRole="button"
            accessibilityLabel={m.label}
            className="flex-1 items-center justify-center rounded-xl border border-success/30 bg-card active:opacity-70"
            style={{ height: 40 }}
          >
            <Text className="text-base font-semibold text-success">{m.label}</Text>
          </Pressable>
        ))}
        {/* Spacer keeps the metric row width matching numpad rows */}
        <View className="flex-[2]" />
      </View>

      {/* Quick fractions + picker. The picker covers everything else
          (3/8, 5/16, 9/16, all 16ths, all 32nds). */}
      <View className="mt-1 flex-row" style={{ gap: 6 }}>
        {QUICK_FRACTIONS.map((f) => (
          <Pressable
            key={f}
            onPress={() => insertText(f)}
            accessibilityRole="button"
            accessibilityLabel={f}
            className="flex-1 items-center justify-center rounded-xl border border-border bg-card active:opacity-70"
            style={{ height: 44 }}
          >
            <Text className="text-base font-semibold text-slate-300">{f}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => {
            void haptic.medium();
            setShowFractions(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="More fractions"
          className="flex-1 flex-row items-center justify-center rounded-xl border border-brand-orange/40 bg-card active:opacity-70"
          style={{ height: 44 }}
        >
          <Text className="text-sm font-semibold text-brand-orange">a/b</Text>
          <Ionicons name="chevron-up" size={14} color="#F97316" style={{ marginLeft: 4 }} />
        </Pressable>
      </View>

      <View className="mt-2 flex-row" style={{ gap: 6 }}>
        <Pressable
          onPress={() => {
            void haptic.medium();
            clear();
          }}
          accessibilityRole="button"
          accessibilityLabel="Clear"
          className="flex-1 items-center justify-center rounded-2xl border border-border bg-card active:opacity-70"
          style={{ height: 64 }}
        >
          <Text className="text-xl font-bold text-slate-300">C</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            void haptic.medium();
            evaluate();
          }}
          accessibilityRole="button"
          accessibilityLabel="Evaluate expression"
          className="flex-[3] items-center justify-center rounded-2xl bg-brand-orange active:opacity-80"
          style={{ height: 64 }}
        >
          <Text className="text-2xl font-bold text-white">=</Text>
        </Pressable>
      </View>

      <FractionPicker
        visible={showFractions}
        onClose={() => setShowFractions(false)}
        onPick={insertText}
      />
    </View>
  );
}

function KeyButton({ spec, onPress }: { spec: KeySpec; onPress: () => void }) {
  const isOp = ['+', '-', '*', '/'].includes(spec.label);
  const isUnit = ["'", '"'].includes(spec.label);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={spec.label}
      className={`flex-1 items-center justify-center rounded-2xl active:opacity-70 ${
        spec.kind === 'backspace'
          ? 'border border-border bg-card'
          : isOp
            ? 'bg-card border border-brand-orange/30'
            : isUnit
              ? 'bg-card border border-success/30'
              : 'border border-border bg-card'
      }`}
      style={{ height: 64 }}
    >
      {spec.kind === 'backspace' ? (
        <Ionicons name="backspace-outline" size={24} color="#F8FAFC" />
      ) : (
        <Text
          className={`text-2xl font-bold ${
            isOp ? 'text-brand-orange' : isUnit ? 'text-success' : 'text-white'
          }`}
        >
          {spec.label}
        </Text>
      )}
    </Pressable>
  );
}
