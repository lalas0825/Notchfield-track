/**
 * My Reports — Sprint 45B
 * Shows the user's own submitted feedback reports with admin responses.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth/store/auth-store';
import {
  fetchMyReports,
  parseScreenshots,
  type FeedbackReport,
  type FeedbackStatus,
  type FeedbackType,
} from '@/features/feedback/services/feedback-service';
import { FeedbackModal } from '@/shared/components/FeedbackModal';

const TYPE_CONFIG: Record<FeedbackType, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  bug:      { icon: 'bug',        color: '#EF4444', label: 'Bug' },
  feature:  { icon: 'bulb',       color: '#F59E0B', label: 'Feature' },
  feedback: { icon: 'chatbubble', color: '#0EA5E9', label: 'Feedback' },
};

const STATUS_CONFIG: Record<FeedbackStatus, { color: string; label: string }> = {
  new:       { color: '#3B82F6', label: 'New' },
  reviewing: { color: '#F59E0B', label: 'Reviewing' },
  resolved:  { color: '#22C55E', label: 'Resolved' },
  declined:  { color: '#9CA3AF', label: 'Declined' },
};

function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return 'just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function ReportCard({ report }: { report: FeedbackReport }) {
  const typeCfg = TYPE_CONFIG[report.type] ?? TYPE_CONFIG.feedback;
  const statusCfg = STATUS_CONFIG[report.status] ?? STATUS_CONFIG.new;
  const screenshotCount = parseScreenshots(report.screenshots).length;

  return (
    <View className="mb-2 rounded-xl border border-border bg-card px-4 py-3">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <View className="flex-row items-center">
            <Ionicons name={typeCfg.icon} size={14} color={typeCfg.color} />
            <Text className="ml-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: typeCfg.color }}>
              {typeCfg.label}
            </Text>
            {report.severity && report.type === 'bug' && (
              <Text className="ml-2 text-[10px] uppercase tracking-wider text-slate-500">
                · {report.severity}
              </Text>
            )}
          </View>
          <Text className="mt-1 text-sm font-semibold text-white" numberOfLines={2}>
            {report.title}
          </Text>
          <View className="mt-1 flex-row items-center">
            <Text className="text-xs text-slate-500">{timeAgo(report.created_at)}</Text>
            {report.page_name && (
              <Text className="ml-2 text-xs text-slate-600">· {report.page_name}</Text>
            )}
            {screenshotCount > 0 && (
              <View className="ml-2 flex-row items-center">
                <Ionicons name="image" size={11} color="#64748B" />
                <Text className="ml-0.5 text-xs text-slate-600">{screenshotCount}</Text>
              </View>
            )}
          </View>
        </View>
        <View
          className="rounded-full px-2 py-1"
          style={{ backgroundColor: `${statusCfg.color}20` }}
        >
          <Text className="text-[10px] font-bold" style={{ color: statusCfg.color }}>
            {statusCfg.label}
          </Text>
        </View>
      </View>

      {report.admin_response && (
        <View className="mt-3 rounded-lg border border-border bg-background p-2">
          <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Admin Response
          </Text>
          <Text className="mt-1 text-xs text-slate-300">{report.admin_response}</Text>
        </View>
      )}
    </View>
  );
}

export default function MyReportsScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const userId = profile?.id ?? user?.id ?? null;

  const [reports, setReports] = useState<FeedbackReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const reload = useCallback(async () => {
    if (!userId) {
      setReports([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchMyReports(userId);
      setReports(data);
    } catch (err) {
      console.warn('[MyReports] load failed', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'My Reports',
          headerRight: () => (
            <Pressable onPress={() => setShowModal(true)} hitSlop={12}>
              <Ionicons name="add-circle" size={28} color="#0EA5E9" />
            </Pressable>
          ),
        }}
      />

      <View className="flex-1 bg-background">
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#F97316" />
          </View>
        ) : reports.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="clipboard-outline" size={48} color="#334155" />
            <Text className="mt-4 text-center text-base text-slate-400">
              No reports yet.
            </Text>
            <Text className="mt-2 text-center text-xs text-slate-500">
              Report a bug, request a feature, or leave feedback.
            </Text>
            <Pressable
              onPress={() => setShowModal(true)}
              className="mt-6 flex-row items-center justify-center rounded-xl bg-brand-orange px-5 py-3 active:opacity-80"
              style={{ minHeight: 52 }}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text className="ml-2 text-base font-bold text-white">Report an Issue</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            className="flex-1 px-4 pt-3"
            refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor="#F97316" />}
          >
            {reports.map((r) => (
              <ReportCard key={r.id} report={r} />
            ))}
            <View className="h-24" />
          </ScrollView>
        )}

        {reports.length > 0 && (
          <Pressable
            onPress={() => setShowModal(true)}
            className="absolute bottom-6 right-4 h-14 flex-row items-center rounded-full bg-brand-orange px-5 shadow-lg active:opacity-80"
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
            <Text className="ml-2 text-base font-bold text-white">New Report</Text>
          </Pressable>
        )}
      </View>

      <FeedbackModal visible={showModal} onClose={() => { setShowModal(false); reload(); }} />
    </>
  );
}
