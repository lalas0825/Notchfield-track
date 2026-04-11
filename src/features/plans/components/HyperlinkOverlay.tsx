/**
 * HyperlinkOverlay — Sprint 47B
 * ================================
 * Semi-transparent blue hotspots over the PDF indicating sheet references.
 * Tap → navigate to target sheet.
 *
 * Positioning model: hyperlink position_x/y/width/height are PDF-point
 * coordinates (as produced by Sprint 47A's PDF detection). We map them to
 * the rendered viewport using the page bounds returned by react-native-pdf's
 * onLoadComplete. Only visible at scale=1 — overlays can't reliably follow
 * react-native-pdf's internal zoom/pan, so they fade out when zoomed.
 */

import { Pressable, Text, View } from 'react-native';
import type { DrawingHyperlink } from '../hooks/useHyperlinks';

type Props = {
  links: DrawingHyperlink[];
  pageWidth: number;                // PDF page width in points (from onLoadComplete)
  pageHeight: number;
  viewportWidth: number;            // rendered size on screen
  viewportHeight: number;
  visible: boolean;                 // hide when zoomed
  onLinkPress: (link: DrawingHyperlink) => void;
};

export function HyperlinkOverlay({
  links,
  pageWidth,
  pageHeight,
  viewportWidth,
  viewportHeight,
  visible,
  onLinkPress,
}: Props) {
  if (!visible || pageWidth <= 0 || pageHeight <= 0) return null;

  // Fit-to-width letterbox: calculate the actual rendered page rect inside
  // the viewport so hotspots track the PDF (not the whole viewport).
  const scale = Math.min(viewportWidth / pageWidth, viewportHeight / pageHeight);
  const renderedW = pageWidth * scale;
  const renderedH = pageHeight * scale;
  const offsetX = (viewportWidth - renderedW) / 2;
  const offsetY = (viewportHeight - renderedH) / 2;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {links.map((link) => {
        if (
          link.position_x == null ||
          link.position_y == null ||
          link.width == null ||
          link.height == null
        ) {
          return null;
        }
        const left = offsetX + link.position_x * scale;
        const top = offsetY + link.position_y * scale;
        const w = link.width * scale;
        const h = link.height * scale;

        return (
          <Pressable
            key={link.id}
            onPress={() => onLinkPress(link)}
            style={{
              position: 'absolute',
              left,
              top,
              width: Math.max(w, 32),
              height: Math.max(h, 24),
              backgroundColor: 'rgba(55, 138, 221, 0.18)',
              borderWidth: 1.5,
              borderColor: 'rgba(55, 138, 221, 0.7)',
              borderRadius: 4,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              className="text-[10px] font-bold"
              style={{ color: '#DBEAFE' }}
              numberOfLines={1}
            >
              {link.target_sheet_number}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
