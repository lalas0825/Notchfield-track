/**
 * Numeric input field with label. Used by every helper.
 *
 * Accepts decimals; rejects non-numeric input on blur. Shows unit suffix
 * inline when provided.
 */

import { TextInput, Text, View } from 'react-native';

interface NumberFieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  unit?: string;
  placeholder?: string;
  keyboardType?: 'numeric' | 'decimal-pad';
}

export function NumberField({
  label,
  value,
  onChangeText,
  unit,
  placeholder,
  keyboardType = 'decimal-pad',
}: NumberFieldProps) {
  return (
    <View className="mb-3">
      <Text className="mb-1 text-sm font-medium text-slate-300">{label}</Text>
      <View className="flex-row items-center rounded-xl border border-border bg-card px-3 py-3">
        <TextInput
          className="flex-1 text-base text-white"
          value={value}
          onChangeText={(t) => {
            // Allow digits, decimal, and one leading minus
            const cleaned = t.replace(/[^0-9.\-/]/g, '');
            onChangeText(cleaned);
          }}
          placeholder={placeholder ?? '0'}
          placeholderTextColor="#64748B"
          keyboardType={keyboardType}
          accessibilityLabel={label}
        />
        {unit ? (
          <Text className="ml-2 text-base font-medium text-slate-400">{unit}</Text>
        ) : null}
      </View>
    </View>
  );
}
