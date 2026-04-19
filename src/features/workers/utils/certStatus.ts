/**
 * Cert status classifier — shared with Takeoff web (see workerService.ts in
 * the Takeoff repo). Four states:
 *   - missing  : no cert number on file
 *   - valid    : cert number + no expiry OR expiry > 30 days away
 *   - expiring : cert number + expiry < 30 days away
 *   - expired  : cert number + expiry already passed
 */

export type CertStatus = 'valid' | 'expiring' | 'expired' | 'missing';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function classifyCertStatus(
  cardNumber: string | null | undefined,
  expiresAt: string | null | undefined,
  now: number = Date.now(),
): CertStatus {
  if (!cardNumber) return 'missing';
  if (!expiresAt) return 'valid';
  const expiry = new Date(expiresAt).getTime();
  if (Number.isNaN(expiry)) return 'valid';
  if (expiry < now) return 'expired';
  if (expiry - now < THIRTY_DAYS_MS) return 'expiring';
  return 'valid';
}

/** Human-readable days-until-expiry; negative means days overdue. */
export function daysUntilExpiry(
  expiresAt: string | null | undefined,
  now: number = Date.now(),
): number | null {
  if (!expiresAt) return null;
  const expiry = new Date(expiresAt).getTime();
  if (Number.isNaN(expiry)) return null;
  return Math.round((expiry - now) / (24 * 60 * 60 * 1000));
}

export const CERT_STATUS_COLOR: Record<CertStatus, string> = {
  valid: '#22C55E',
  expiring: '#F59E0B',
  expired: '#EF4444',
  missing: '#64748B',
};

export const CERT_STATUS_LABEL: Record<CertStatus, string> = {
  valid: 'Valid',
  expiring: 'Expiring',
  expired: 'Expired',
  missing: 'Missing',
};
