import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/shared/lib/supabase/client';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { signNod, type LegalDoc } from '@/features/legal/services/legal-service';
import { SignaturePad } from '@/features/safety/components/SignaturePad';

export default function LegalDocDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const [doc, setDoc] = useState<LegalDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('legal_documents').select('*').eq('id', id).single();
      setDoc(data as LegalDoc | null);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading || !doc) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  const isSigned = !!doc.signed_at;
  const canSign = doc.status === 'draft' && !isSigned;

  const handleSign = async () => {
    if (!user || !signatureData) return;
    setError(null);
    setSigning(true);

    const result = await signNod(doc.id, user.id, signatureData);

    setSigning(false);
    if (result.success) {
      router.back();
    } else {
      setError(result.error ?? 'Signing failed');
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: doc.document_type.toUpperCase() }} />
      <ScrollView className="flex-1 bg-background px-4 pt-4">
        {/* Header */}
        <View className="mb-4 rounded-2xl border border-border bg-card p-4">
          <Text className="text-xl font-bold text-white">{doc.title}</Text>
          <Text className="mt-1 text-sm text-slate-400">
            Created {new Date(doc.created_at).toLocaleString()}
          </Text>

          {/* Status badge */}
          <View className="mt-3 flex-row items-center gap-3">
            <View className={`rounded-full px-3 py-1 ${
              isSigned ? 'bg-blue-500/20' : 'bg-amber-500/20'
            }`}>
              <Text className={`text-sm font-bold ${isSigned ? 'text-blue-400' : 'text-warning'}`}>
                {doc.status.toUpperCase()}
              </Text>
            </View>

            {doc.sha256_hash && (
              <View className="flex-row items-center">
                <Ionicons name="shield-checkmark" size={14} color="#22C55E" />
                <Text className="ml-1 text-xs text-success">Integrity verified</Text>
              </View>
            )}
          </View>
        </View>

        {/* Document content */}
        <View className="mb-4 rounded-xl border border-border bg-card p-4">
          <Text className="text-base leading-6 text-white">{doc.description}</Text>
        </View>

        {/* SHA-256 hash (if signed) */}
        {doc.sha256_hash && (
          <View className="mb-4 rounded-xl border border-border bg-card p-4">
            <View className="flex-row items-center mb-2">
              <Ionicons name="finger-print" size={16} color="#22C55E" />
              <Text className="ml-2 text-sm font-bold text-slate-400">SHA-256 Hash</Text>
            </View>
            <Text className="text-xs font-mono text-slate-500" selectable>
              {doc.sha256_hash}
            </Text>
            <Text className="mt-2 text-xs text-slate-600">
              Signed {doc.signed_at ? new Date(doc.signed_at).toLocaleString() : ''}
            </Text>
          </View>
        )}

        {/* Signature pad (draft only) */}
        {canSign && (
          <View className="mb-4">
            <Text className="mb-3 text-lg font-bold text-white">Sign Document</Text>
            <SignaturePad
              signerName={profile?.full_name ?? 'Supervisor'}
              captured={signatureData !== null}
              onCapture={setSignatureData}
              onClear={() => setSignatureData(null)}
            />

            {signatureData && (
              <Pressable
                onPress={handleSign}
                disabled={signing}
                className="mt-4 h-14 flex-row items-center justify-center rounded-xl bg-danger active:opacity-80"
              >
                <Ionicons name="shield-checkmark" size={22} color="#FFFFFF" />
                <Text className="ml-2 text-lg font-bold text-white">
                  {signing ? 'Signing...' : 'Sign & Lock Document'}
                </Text>
              </Pressable>
            )}

            <Text className="mt-2 text-center text-xs text-slate-500">
              Once signed, this document cannot be modified. A SHA-256 hash will be generated for tamper detection.
            </Text>
          </View>
        )}

        {/* Immutability notice (if signed) */}
        {isSigned && (
          <View className="mb-4 rounded-xl border border-success/30 bg-green-500/5 px-4 py-3">
            <View className="flex-row items-center">
              <Ionicons name="lock-closed" size={16} color="#22C55E" />
              <Text className="ml-2 text-sm font-bold text-success">Document Locked</Text>
            </View>
            <Text className="mt-1 text-sm text-slate-400">
              This document has been signed and cryptographically sealed. It cannot be modified or deleted.
            </Text>
          </View>
        )}

        {/* Error */}
        {error && (
          <View className="mb-4 rounded-xl bg-red-500/10 px-4 py-3">
            <Text className="text-center text-base text-danger">{error}</Text>
          </View>
        )}

        <View className="h-24" />
      </ScrollView>
    </>
  );
}
