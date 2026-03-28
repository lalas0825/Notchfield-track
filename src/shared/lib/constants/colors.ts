/**
 * NotchField Track — Brand Colors
 * =================================
 * Dark mode default. Light mode as option.
 * High contrast for field conditions (direct sunlight, dirty screens).
 */

export const colors = {
  // Dark mode (default)
  dark: {
    background: '#0F172A',    // slate-900
    card: '#1E293B',          // slate-800
    border: '#334155',        // slate-700
    textPrimary: '#F8FAFC',   // slate-50
    textSecondary: '#94A3B8', // slate-400
    textMuted: '#64748B',     // slate-500
  },

  // Light mode (option)
  light: {
    background: '#F8FAFC',    // slate-50
    card: '#FFFFFF',
    border: '#E2E8F0',        // slate-200
    textPrimary: '#0F172A',   // slate-900
    textSecondary: '#64748B', // slate-500
    textMuted: '#94A3B8',     // slate-400
  },

  // Brand
  brand: {
    orange: '#F97316',        // Primary action, logo accent
    charcoal: '#1E293B',      // Card background
  },

  // Status (same in dark + light — always high contrast)
  status: {
    success: '#22C55E',       // green-500 — complete, on-site
    danger: '#EF4444',        // red-500 — blocked, error
    warning: '#F59E0B',       // amber-500 — outside fence, syncing
    info: '#3B82F6',          // blue-500 — reviewed, tickets
    notStarted: '#9CA3AF',    // gray-400
  },
} as const;

/**
 * Touch target minimums (in dp).
 * Construction field: gloves, wet fingers, sunlight.
 */
export const touchTargets = {
  minimum: 48,      // Apple/Google guideline
  preferred: 56,    // Primary actions (buttons, inputs)
  checkbox: 64,     // Production checkboxes (50+ taps/day)
  spacing: 12,      // Between interactive elements
} as const;

/**
 * Font sizes (in sp). Never below 14sp.
 */
export const fontSizes = {
  areaLabel: 18,    // Readable from 2 feet
  surfaceName: 16,
  secondary: 14,    // Absolute minimum
} as const;

/**
 * Layout breakpoints.
 */
export const breakpoints = {
  phone: 768,       // < 768dp width
  tablet: 768,      // >= 768dp width
} as const;
