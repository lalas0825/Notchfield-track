import { useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Pdf from 'react-native-pdf';

type PageBounds = {
  pageWidth: number;
  pageHeight: number;
};

type Props = {
  uri: string;
  page: number;
  /** Called with the PDF page dimensions (points) after first load. */
  onPageBounds?: (bounds: PageBounds) => void;
  /** Called with the current pinch-zoom scale (1 = fit). */
  onScaleChanged?: (scale: number) => void;
  /** Called when the viewport dimensions change. */
  onViewportSize?: (size: { width: number; height: number }) => void;
  /** Called when the user swipes to a different page (1-indexed). */
  onPageChanged?: (page: number) => void;
  /** Overlay layer rendered absolutely above the PDF. */
  overlay?: ReactNode;
};

export function PdfViewerNative({
  uri,
  page,
  onPageBounds,
  onScaleChanged,
  onViewportSize,
  onPageChanged,
  overlay,
}: Props) {
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setViewport({ width, height });
    onViewportSize?.({ width, height });
  };

  return (
    <View
      style={{ flex: 1, backgroundColor: '#0F172A' }}
      onLayout={handleLayout}
    >
      <Pdf
        source={{ uri }}
        page={page}
        enablePaging
        horizontal
        style={{ flex: 1, width: viewport.width || undefined, backgroundColor: '#0F172A' }}
        onLoadComplete={(_numberOfPages, _filePath, dimensions) => {
          if (onPageBounds && dimensions) {
            onPageBounds({
              pageWidth: dimensions.width ?? 0,
              pageHeight: dimensions.height ?? 0,
            });
          }
        }}
        onScaleChanged={(scale) => {
          onScaleChanged?.(scale);
        }}
        onPageChanged={(pageNum: number) => {
          onPageChanged?.(pageNum);
        }}
        onError={(err: unknown) => {
          console.error('[Plans] PDF render error:', err);
        }}
      />
      {overlay}
    </View>
  );
}
