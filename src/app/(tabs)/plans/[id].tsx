import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getPdfUri } from '@/features/plans/services/drawing-service';
import { PdfViewerNative } from '@/features/plans/components/PdfViewerNative';

export default function PlanViewerScreen() {
  const { filePath, pageNumber, label } = useLocalSearchParams<{
    id: string;
    filePath: string;
    pageNumber: string;
    label: string;
  }>();

  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const page = parseInt(pageNumber ?? '1', 10);

  useEffect(() => {
    if (!filePath) return;

    async function loadPdf() {
      setDownloading(true);
      setError(null);

      const uri = await getPdfUri(filePath, 'drawings', (p) => setProgress(p));

      if (uri) {
        setPdfUri(uri);
      } else {
        setError('Unable to load PDF. Check your connection and try again.');
      }
      setDownloading(false);
    }

    loadPdf();
  }, [filePath]);

  const retry = () => {
    setError(null);
    setDownloading(true);
    getPdfUri(filePath, 'drawings', (p) => setProgress(p)).then((uri) => {
      if (uri) setPdfUri(uri);
      else setError('Download failed');
      setDownloading(false);
    });
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: label ?? 'Plan Viewer',
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#F8FAFC',
        }}
      />
      <View className="flex-1 bg-background">
        {downloading && (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#F97316" />
            <Text className="mt-4 text-base font-medium text-white">
              Downloading plan...
            </Text>
            {progress > 0 && (
              <View className="mt-3 w-48">
                <View className="h-2 overflow-hidden rounded-full bg-slate-700">
                  <View
                    className="h-full rounded-full bg-brand-orange"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </View>
                <Text className="mt-1 text-center text-sm text-slate-400">
                  {Math.round(progress * 100)}%
                </Text>
              </View>
            )}
          </View>
        )}

        {error && !downloading && (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="cloud-offline-outline" size={48} color="#EF4444" />
            <Text className="mt-4 text-center text-base text-white">{error}</Text>
            <Pressable
              onPress={retry}
              className="mt-6 h-12 flex-row items-center rounded-xl bg-brand-orange px-6 active:opacity-80"
            >
              <Ionicons name="refresh" size={18} color="#FFFFFF" />
              <Text className="ml-2 text-base font-bold text-white">Retry</Text>
            </Pressable>
          </View>
        )}

        {pdfUri && !downloading && !error && (
          <PdfViewerNative uri={pdfUri} page={page} />
        )}
      </View>
    </>
  );
}
