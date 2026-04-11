import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

type Props = {
  uri: string;
  page: number;
  onPageBounds?: (bounds: { pageWidth: number; pageHeight: number }) => void;
  onScaleChanged?: (scale: number) => void;
  onViewportSize?: (size: { width: number; height: number }) => void;
  overlay?: ReactNode;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function PdfViewerNative(_props: Props) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#94A3B8', fontSize: 16 }}>
        PDF viewing is available on the mobile app.
      </Text>
    </View>
  );
}
