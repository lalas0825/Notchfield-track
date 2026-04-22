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
        source={{ uri, cache: true }}
        page={page}
        enablePaging
        horizontal
        // fitPolicy 0 = fit width → the native layer rasterizes the page
        // at the full viewport width, giving ~2× more pixels horizontally
        // than the default "fit both" mode. Construction drawings are
        // detail-dense — horizontal pixels are where detail lives. User
        // scrolls vertically when needed.
        fitPolicy={0}
        // Android-only — smoother edges during the scale-up window while
        // the native layer re-rasterizes on pinch. Cheap.
        enableAntialiasing
        // Cap the pinch-zoom so users don't pull past the resolution the
        // native layer is willing to re-render at — over-zoom is where
        // the "blurry forever" complaint comes from. maxScale=5 leaves
        // plenty of room for detail while keeping re-render in reach.
        minScale={1}
        maxScale={5}
        scale={1}
        spacing={0}
        trustAllCerts={false}
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
