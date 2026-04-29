/**
 * Sprint 73B Avatars — RN Avatar component.
 *
 * Mirrors the Web `<Avatar>` API for parity. Renders the user's
 * `profiles.avatar_url` if set; falls back to a colored circle with
 * the first letter of their name. Image-load errors trigger the
 * same fallback (e.g. cache stale, network glitch).
 *
 * Sizes match Web exactly so layout decisions translate 1:1:
 *   xs 20  → bell items, dense lists
 *   sm 28  → comments, inline credits
 *   md 32  → top-bar, default
 *   lg 48  → profile cards, signers
 *   xl 96  → profile screen hero
 *
 * `imageUrl` includes a `?t=<timestamp>` cache-buster from the upload
 * path (Web pattern, mirrored Track-side). RN's <Image> uses the full
 * URL incl. querystring as cache key, so a fresh upload renders the
 * new image without manual cache invalidation.
 */

import { Image, Text, View } from 'react-native';
import { useEffect, useState } from 'react';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_PX: Record<AvatarSize, number> = {
  xs: 20,
  sm: 28,
  md: 32,
  lg: 48,
  xl: 96,
};

const FONT_SIZE: Record<AvatarSize, number> = {
  xs: 10,
  sm: 12,
  md: 12,
  lg: 16,
  xl: 32,
};

type Props = {
  name: string;
  imageUrl?: string | null;
  size?: AvatarSize;
};

export function Avatar({ name, imageUrl, size = 'md' }: Props) {
  const [errored, setErrored] = useState(false);
  // Reset error state when imageUrl changes (e.g. user uploads new avatar
  // → new ?t=<timestamp> querystring → new URL → retry the load).
  useEffect(() => {
    setErrored(false);
  }, [imageUrl]);

  const px = SIZE_PX[size];
  const fontSize = FONT_SIZE[size];
  const initial = (name || '?').charAt(0).toUpperCase() || '?';

  if (imageUrl && !errored) {
    return (
      <View
        style={{
          width: px,
          height: px,
          borderRadius: px / 2,
          backgroundColor: '#1E293B',
          overflow: 'hidden',
        }}
      >
        <Image
          source={{ uri: imageUrl }}
          style={{ width: px, height: px }}
          onError={() => setErrored(true)}
        />
      </View>
    );
  }

  return (
    <View
      style={{
        width: px,
        height: px,
        borderRadius: px / 2,
        backgroundColor: '#F97316', // brand-orange (matches existing initials bg)
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#FFFFFF', fontSize, fontWeight: '700' }}>
        {initial}
      </Text>
    </View>
  );
}
