/**
 * Sprint 69 — Notifications Hub event registry.
 *
 * COPIED VERBATIM from SPRINT_TRACK_NOTIFICATIONS.md handoff doc. Must
 * stay in lockstep with Web's eventRegistry.ts — the DB CHECK constraint
 * on `notifications.type` rejects mismatched values, and Web's recipient
 * resolver uses these EVENTS entries to decide who gets each notification.
 *
 * If Web changes this list, Track gets 24h notice via the handoff doc.
 * Adding a new type = both teams update + DB enum updated.
 */

export type NotificationEventType =
  | 'ptp_distributed'
  | 'ptp_signed_to_pm'
  | 'safety_doc_distributed'
  | 'rfi_created'
  | 'rfi_responded'
  | 'block_alert_24h'
  | 'block_alert_72h'
  | 'gate_verification_requested'
  | 'report_ready'
  | 'field_message_in_my_area'
  | 'sst_expiring_30d'
  | 'sst_expired'
  | 'nod_sent';

export type EventDefinition = {
  type: NotificationEventType;
  icon: string; // lucide-react-native naming convention
  severity: 'info' | 'warning' | 'critical';
  defaultChannels: { in_app: boolean; email: boolean; push: boolean };
  titleKey: string;
  bodyKey: string;
};

export const EVENTS: Record<NotificationEventType, EventDefinition> = {
  ptp_distributed: {
    type: 'ptp_distributed',
    icon: 'shield-check',
    severity: 'info',
    defaultChannels: { in_app: true, email: true, push: false },
    titleKey: 'ptpDistributedTitle',
    bodyKey: 'ptpDistributedBody',
  },
  ptp_signed_to_pm: {
    type: 'ptp_signed_to_pm',
    icon: 'pen-tool',
    severity: 'info',
    defaultChannels: { in_app: true, email: false, push: false },
    titleKey: 'ptpSignedTitle',
    bodyKey: 'ptpSignedBody',
  },
  safety_doc_distributed: {
    type: 'safety_doc_distributed',
    icon: 'shield',
    severity: 'info',
    defaultChannels: { in_app: true, email: true, push: false },
    titleKey: 'safetyDocDistributedTitle',
    bodyKey: 'safetyDocDistributedBody',
  },
  rfi_created: {
    type: 'rfi_created',
    icon: 'help-circle',
    severity: 'info',
    defaultChannels: { in_app: true, email: true, push: false },
    titleKey: 'rfiCreatedTitle',
    bodyKey: 'rfiCreatedBody',
  },
  rfi_responded: {
    type: 'rfi_responded',
    icon: 'message-square',
    severity: 'info',
    defaultChannels: { in_app: true, email: true, push: false },
    titleKey: 'rfiRespondedTitle',
    bodyKey: 'rfiRespondedBody',
  },
  block_alert_24h: {
    type: 'block_alert_24h',
    icon: 'alert-triangle',
    severity: 'warning',
    defaultChannels: { in_app: true, email: true, push: true },
    titleKey: 'block24hTitle',
    bodyKey: 'block24hBody',
  },
  block_alert_72h: {
    type: 'block_alert_72h',
    icon: 'alert-octagon',
    severity: 'critical',
    defaultChannels: { in_app: true, email: true, push: true },
    titleKey: 'block72hTitle',
    bodyKey: 'block72hBody',
  },
  gate_verification_requested: {
    type: 'gate_verification_requested',
    icon: 'shield-alert',
    severity: 'warning',
    defaultChannels: { in_app: true, email: true, push: false },
    titleKey: 'gateVerifyTitle',
    bodyKey: 'gateVerifyBody',
  },
  report_ready: {
    type: 'report_ready',
    icon: 'file-text',
    severity: 'info',
    defaultChannels: { in_app: true, email: false, push: false },
    titleKey: 'reportReadyTitle',
    bodyKey: 'reportReadyBody',
  },
  field_message_in_my_area: {
    type: 'field_message_in_my_area',
    icon: 'message-circle',
    severity: 'info',
    defaultChannels: { in_app: true, email: false, push: true },
    titleKey: 'fieldMessageTitle',
    bodyKey: 'fieldMessageBody',
  },
  sst_expiring_30d: {
    type: 'sst_expiring_30d',
    icon: 'id-card',
    severity: 'warning',
    defaultChannels: { in_app: true, email: true, push: false },
    titleKey: 'sstExpiring30Title',
    bodyKey: 'sstExpiring30Body',
  },
  sst_expired: {
    type: 'sst_expired',
    icon: 'x-circle',
    severity: 'critical',
    defaultChannels: { in_app: true, email: true, push: true },
    titleKey: 'sstExpiredTitle',
    bodyKey: 'sstExpiredBody',
  },
  nod_sent: {
    type: 'nod_sent',
    icon: 'gavel',
    severity: 'warning',
    defaultChannels: { in_app: true, email: true, push: false },
    titleKey: 'nodSentTitle',
    bodyKey: 'nodSentBody',
  },
};
