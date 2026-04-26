/**
 * Sprint 69 — Mock notifications for UI dev while Web ships the real
 * /api/notifications/notify endpoint + DB table. Once Web confirms
 * "Sprint 69 backend ready", `useNotifications` swaps to PowerSync local
 * reads and these mocks are no longer surfaced.
 *
 * Shape verbatim from SPRINT_TRACK_NOTIFICATIONS.md §6.
 */

import type { Notification } from '../types';

const minutesAgo = (n: number): string =>
  new Date(Date.now() - n * 60 * 1000).toISOString();

export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    organization_id: 'org-jantile',
    recipient_id: 'me',
    type: 'block_alert_72h',
    entity_type: 'production_area',
    entity_id: 'area-abc',
    project_id: 'demo-project',
    title: 'Floor 03 - Bathroom 042 blocked 73h',
    body: 'Reason: other_trade · By: Carlos M.',
    icon: 'alert-octagon',
    severity: 'critical',
    link_url: '/projects/demo-project/pm/ready-board?area=area-abc',
    read_at: null,
    archived_at: null,
    email_sent_at: minutesAgo(30),
    push_sent_at: null,
    created_at: minutesAgo(5),
  },
  {
    id: 'n2',
    organization_id: 'org-jantile',
    recipient_id: 'me',
    type: 'ptp_distributed',
    entity_type: 'safety_document',
    entity_id: 'doc-123',
    project_id: 'demo-project',
    title: 'PTP #1042 distributed by John Smith',
    body: 'Floor 03 - Bathroom rough-in - 4 signers',
    icon: 'shield-check',
    severity: 'info',
    link_url: '/projects/demo-project/pm/safety-documents/doc-123',
    read_at: minutesAgo(40),
    archived_at: null,
    email_sent_at: minutesAgo(60),
    push_sent_at: null,
    created_at: minutesAgo(60),
  },
  {
    id: 'n3',
    organization_id: 'org-jantile',
    recipient_id: 'me',
    type: 'sst_expiring_30d',
    entity_type: 'worker',
    entity_id: 'worker-mario',
    project_id: null,
    title: 'Mario Rodriguez SST expires in 28 days',
    body: 'Card #SST-12345 - exp 2026-05-23',
    icon: 'id-card',
    severity: 'warning',
    link_url: '/manpower/worker-mario',
    read_at: null,
    archived_at: null,
    email_sent_at: null,
    push_sent_at: null,
    created_at: minutesAgo(60 * 11), // ~11h ago
  },
  {
    id: 'n4',
    organization_id: 'org-jantile',
    recipient_id: 'me',
    type: 'gate_verification_requested',
    entity_type: 'phase_progress',
    entity_id: 'pp-77',
    project_id: 'demo-project',
    title: 'Gate verification requested · Bathroom 041',
    body: 'Phase: Waterproof inspection · Carlos M.',
    icon: 'shield-alert',
    severity: 'warning',
    link_url: '/projects/demo-project/pm/ready-board?area=area-041',
    read_at: null,
    archived_at: null,
    email_sent_at: minutesAgo(60 * 4),
    push_sent_at: null,
    created_at: minutesAgo(60 * 4),
  },
  {
    id: 'n5',
    organization_id: 'org-jantile',
    recipient_id: 'me',
    type: 'nod_sent',
    entity_type: 'legal_document',
    entity_id: 'nod-7',
    project_id: 'demo-project',
    title: 'NOD sent to GC · Bathroom 042',
    body: 'Tracking pixel armed. 48h response window.',
    icon: 'gavel',
    severity: 'warning',
    link_url: '/projects/demo-project/pm/legal-documents/nod-7',
    read_at: minutesAgo(60 * 26),
    archived_at: null,
    email_sent_at: minutesAgo(60 * 27),
    push_sent_at: null,
    created_at: minutesAgo(60 * 27), // ~yesterday
  },
];
