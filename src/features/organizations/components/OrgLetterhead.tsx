/**
 * OrgLetterhead — thin strip rendered at the top of document detail
 * screens (PTP, Toolbox, Work Ticket) that mirrors the PDF letterhead
 * the client will receive: company logo on the left, document type +
 * number centered, status badge on the right.
 *
 * Scope rule (per Sprint 52 pilot feedback): the 'NotchField TRACK'
 * brand lives on splash/about only — documents carry the customer's
 * branding, not ours.
 */

import { Image, Text, View } from 'react-native';
import { useOrganization } from '../hooks/useOrganization';

type Props = {
  organizationId: string | null | undefined;
  docTypeTitle: string;        // e.g. "Pre-Task Plan", "Toolbox Talk"
  docNumber?: number | null;
  status?: string | null;      // draft | active | completed
};

const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  draft: { bg: '#FEF3C7', fg: '#B45309' },
  active: { bg: '#DCFCE7', fg: '#15803D' },
  completed: { bg: '#E0E7FF', fg: '#3730A3' },
  closed: { bg: '#F1F5F9', fg: '#475569' },
};

export function OrgLetterhead({
  organizationId,
  docTypeTitle,
  docNumber,
  status,
}: Props) {
  const { org } = useOrganization(organizationId);

  const hasLogo = !!org?.logo_url;
  const statusStyle = status ? STATUS_COLOR[status] ?? STATUS_COLOR.closed : null;

  return (
    <View className="mb-4 overflow-hidden rounded-2xl border border-border bg-white">
      <View className="flex-row items-center px-4 py-3">
        {/* LEFT — logo or company name */}
        <View className="w-24 items-start justify-center">
          {hasLogo ? (
            <Image
              source={{ uri: org!.logo_url! }}
              style={{ width: 88, height: 44 }}
              resizeMode="contain"
            />
          ) : (
            <Text
              className="text-sm font-bold text-slate-900"
              numberOfLines={2}
            >
              {org?.name ?? ' '}
            </Text>
          )}
        </View>

        {/* CENTER — doc type title */}
        <View className="flex-1 items-center justify-center">
          <Text className="text-center text-base font-bold uppercase tracking-wide text-slate-900">
            {docTypeTitle}
          </Text>
          {docNumber ? (
            <Text className="mt-0.5 text-xs text-slate-500">#{docNumber}</Text>
          ) : null}
        </View>

        {/* RIGHT — status badge */}
        <View className="w-24 items-end justify-center">
          {statusStyle ? (
            <View
              className="rounded-full px-2 py-1"
              style={{ backgroundColor: statusStyle.bg }}
            >
              <Text
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: statusStyle.fg }}
              >
                {status}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Orange rule — same accent as the PDF letterhead */}
      <View className="h-1 bg-brand-orange" />
    </View>
  );
}
