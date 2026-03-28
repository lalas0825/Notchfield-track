import { useRef, useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  signerName: string;
  onCapture: (base64: string) => void;
  onClear: () => void;
  captured: boolean;
};

export function SignaturePad({ signerName, onCapture, onClear, captured }: Props) {
  const signatureRef = useRef<any>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  if (Platform.OS === 'web') {
    // Web fallback — simple "signed" toggle
    return (
      <View className="rounded-xl border border-border bg-card p-4">
        <Text className="mb-2 text-sm font-medium text-slate-400">
          Signature — {signerName}
        </Text>
        {captured ? (
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
              <Text className="ml-2 text-base font-medium text-success">Signed</Text>
            </View>
            <Pressable onPress={onClear} className="h-10 items-center justify-center px-4">
              <Text className="text-sm text-slate-400">Clear</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => onCapture('web-placeholder-signature')}
            className="h-14 items-center justify-center rounded-xl border border-dashed border-brand-orange"
          >
            <Text className="text-base text-brand-orange">Tap to Sign</Text>
          </Pressable>
        )}
      </View>
    );
  }

  // Native: use react-native-signature-canvas
  const SignatureCanvas = require('react-native-signature-canvas').default;

  const handleOK = (signature: string) => {
    // signature is a base64 data URI
    onCapture(signature);
    setIsEmpty(false);
  };

  const handleClear = () => {
    signatureRef.current?.clearSignature();
    setIsEmpty(true);
    onClear();
  };

  if (captured) {
    return (
      <View className="rounded-xl border border-border bg-card p-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
            <Text className="ml-2 text-base font-medium text-success">
              {signerName} — Signed
            </Text>
          </View>
          <Pressable onPress={handleClear} className="h-10 items-center justify-center px-4">
            <Text className="text-sm text-danger">Clear</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="rounded-xl border border-border bg-card p-4">
      <Text className="mb-2 text-sm font-medium text-slate-400">
        Signature — {signerName}
      </Text>
      <View className="h-[150px] overflow-hidden rounded-lg border border-slate-600 bg-white">
        <SignatureCanvas
          ref={signatureRef}
          onOK={handleOK}
          webStyle=".m-signature-pad { box-shadow: none; border: none; } .m-signature-pad--body { border: none; } .m-signature-pad--footer { display: none; }"
          backgroundColor="white"
          penColor="black"
          minWidth={2}
          maxWidth={4}
        />
      </View>
      <View className="mt-3 flex-row justify-between">
        <Pressable
          onPress={handleClear}
          className="h-12 flex-1 mr-2 items-center justify-center rounded-xl border border-border"
        >
          <Text className="text-base text-slate-400">Clear</Text>
        </Pressable>
        <Pressable
          onPress={() => signatureRef.current?.readSignature()}
          className="h-12 flex-1 ml-2 items-center justify-center rounded-xl bg-brand-orange"
        >
          <Text className="text-base font-bold text-white">Confirm</Text>
        </Pressable>
      </View>
    </View>
  );
}
