/**
 * Centralized Web URLs — single source of truth for every outbound call
 * Track makes to the Takeoff Web surface or marketing site.
 *
 * Each constant reads from an `EXPO_PUBLIC_*` env var (baked in at build
 * time by `eas.json`) with a production-safe default. Never hard-code
 * `notchfield.com` inline — import from here so a domain swap is a
 * single-line change.
 *
 * Set these on a per-profile basis in `eas.json` when we add a staging
 * domain:
 *   - EXPO_PUBLIC_WEB_URL          → marketing site + route base
 *   - EXPO_PUBLIC_WEB_API_URL      → API base for distribute + auth
 *   - EXPO_PUBLIC_SIGN_BASE_URL    → GC signature page (full URL)
 *   - EXPO_PUBLIC_VERIFY_BASE_URL  → PDF integrity verifier (host + path)
 */

const envOrDefault = (name: string, fallback: string): string => {
  if (typeof process === 'undefined') return fallback;
  // process.env lookups must be STATIC at parse time for Expo's babel
  // transform to inline the value at build time. Dynamic lookups by
  // variable name (process.env[name]) resolve to undefined on device.
  switch (name) {
    case 'EXPO_PUBLIC_WEB_URL':
      return process.env.EXPO_PUBLIC_WEB_URL ?? fallback;
    case 'EXPO_PUBLIC_WEB_API_URL':
      return process.env.EXPO_PUBLIC_WEB_API_URL ?? fallback;
    case 'EXPO_PUBLIC_SIGN_BASE_URL':
      return process.env.EXPO_PUBLIC_SIGN_BASE_URL ?? fallback;
    case 'EXPO_PUBLIC_VERIFY_BASE_URL':
      return process.env.EXPO_PUBLIC_VERIFY_BASE_URL ?? fallback;
    default:
      return fallback;
  }
};

/** Marketing + route base — `https://notchfield.com` in prod. */
export const WEB_URL = envOrDefault('EXPO_PUBLIC_WEB_URL', 'https://notchfield.com');

/** Base for Track → Web API calls (distribute, auth helpers). */
export const WEB_API_URL = envOrDefault('EXPO_PUBLIC_WEB_API_URL', WEB_URL);

/** Full URL for GC signature pages. Token is appended: `${SIGN_BASE_URL}/${token}`. */
export const SIGN_BASE_URL = envOrDefault(
  'EXPO_PUBLIC_SIGN_BASE_URL',
  `${WEB_URL}/en/sign`,
);

/**
 * Host + path prefix for the PDF integrity verifier. Intentionally NOT
 * a full URL because Takeoff's PDF footer renders it without the
 * protocol prefix: "verifiable at notchfield.com/verify".
 */
export const VERIFY_BASE_URL = envOrDefault(
  'EXPO_PUBLIC_VERIFY_BASE_URL',
  WEB_URL.replace(/^https?:\/\//, '') + '/verify',
);

/** Brand hostname — used for UI strings like "Sent via notchfield.com". */
export const WEB_HOSTNAME = WEB_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
