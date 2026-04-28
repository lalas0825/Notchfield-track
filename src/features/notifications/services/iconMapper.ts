/**
 * Sprint 69 — Lucide → @expo/vector-icons mapper.
 *
 * Web's eventRegistry.ts uses lucide-react-native naming convention
 * ('shield-check', 'pen-tool', 'gavel', ...). Track is on
 * @expo/vector-icons (Ionicons + MaterialCommunityIcons, both already
 * bundled). Pulling in `lucide-react-native` would mean another native
 * font asset + APK rebuild for zero functional gain.
 *
 * This mapper translates lucide names to vector-icons specs. Preference
 * order: Ionicons first (Track's house style), MCI as a fallback for the
 * 4 names Ionicons doesn't carry (gavel, alert-octagon, id-card, pen-tool).
 *
 * If Web adds a new event with a lucide icon not in this map, `resolveIcon`
 * returns Ionicons 'notifications-outline' so the bell never crashes —
 * Track gets a 24h heads-up via the handoff doc to add the mapping.
 */

import type { ComponentProps } from 'react';
import type { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];
type MciName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type IconSpec =
  | { family: 'ionicons'; name: IoniconName }
  | { family: 'mci'; name: MciName };

const ION = (name: IoniconName): IconSpec => ({ family: 'ionicons', name });
const MCI = (name: MciName): IconSpec => ({ family: 'mci', name });

/**
 * Lucide → vector-icons map. Keys are the exact strings used in
 * `EVENTS[type].icon` from eventRegistry.ts.
 */
const LUCIDE_TO_VECTOR_ICON: Record<string, IconSpec> = {
  // Safety / PTP / docs
  'shield-check': ION('shield-checkmark'),
  shield: ION('shield'),
  'shield-alert': ION('shield-half'), // closest Ionicons match for warning shield
  'pen-tool': MCI('draw-pen'),

  // RFIs / messages
  'help-circle': ION('help-circle'),
  'message-square': ION('chatbox'),
  'message-circle': ION('chatbubble'),

  // Alerts / blocks
  'alert-triangle': ION('warning'),
  'alert-octagon': MCI('alert-octagon'),

  // Reports / files
  'file-text': ION('document-text'),

  // SST / certs
  'id-card': MCI('card-account-details'),
  'x-circle': ION('close-circle'),

  // Legal
  gavel: MCI('gavel'),

  // Sprint 71 Phase 2 — Deficiency / punch list todos
  wrench: ION('build'), // foreman action: fix the deficiency
  'clipboard-check': MCI('clipboard-check'), // PM action: verify resolution

  // Sprint 72 — Sign-Off lifecycle
  mail: ION('mail'),                        // signoff_request_sent + email triggers
  clock: ION('time'),                        // signoff_followup_due + stale prompts
  // Note: 'pen-tool' (signoff_signed + signoff_signature_due) already
  // mapped above for PTP signing — same icon.
};

/**
 * Resolve a lucide-style icon name to an Ionicons or MCI spec.
 * Falls back to Ionicons 'notifications-outline' for unmapped names.
 */
export function resolveIcon(lucideName: string): IconSpec {
  return LUCIDE_TO_VECTOR_ICON[lucideName] ?? ION('notifications-outline');
}
