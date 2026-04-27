/**
 * Sprint 71 Phase 2 — Supervisor Compliance route.
 * Route: /(tabs)/more/compliance
 *
 * Lists deficiencies in status='resolved' awaiting verification.
 * Tap a row → /(tabs)/board/deficiency/<id> with Verify/Reject buttons.
 *
 * Entry point: More menu → Compliance (supervisorOnly: true gate).
 */
export { default } from '@/features/deficiencies/components/ComplianceScreen';
