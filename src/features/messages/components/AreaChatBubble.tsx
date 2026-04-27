/**
 * Sprint 71 polish (2026-04-27) — Floating chat bubble for per-area Notes.
 *
 * Replaces the inline MessageThread that sat at the bottom of AreaDetail.
 * The inline thread was eating ~300px of vertical space and pushing primary
 * actions (Mark Complete, Report Blocked, Report Deficiency) below the
 * fold once Sprint 71 added the deficiencies section. Per pilot feedback
 * 2026-04-27: collapse the chat into a floating bubble (Slack/Intercom
 * pattern) with an unread-count badge.
 *
 * Layout:
 *   - Bubble: 56dp circular, fixed bottom-right (right: 20, bottom: 24)
 *   - Badge: red 18dp circle in top-right corner of bubble, count of
 *     unread messages from OTHERS since user's last visit (excludes
 *     own messages — see useAreaMessageActivity).
 *   - Tap → bottom-sheet modal slides up with the full MessageThread.
 *   - Modal close (backdrop tap, X button, or hardware back) →
 *     markAreaVisited resets the badge to 0 instantly via DeviceEventEmitter.
 *
 * Always visible. Discoverability > saving 56dp of pixels. The bubble
 * is small enough to not interfere with the page's primary actions, and
 * the badge is the user's signal that something needs reading.
 *
 * Accessibility:
 *   - 56dp tap target (above Apple's 44pt + Material's 48dp minimums)
 *   - hitSlop: 8dp extra on all sides for chunky thumb taps in the field
 *   - accessibilityLabel describes count when present
 */

import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MessageThread } from './MessageThread';
import {
  useAreaMessageActivity,
  markAreaVisited,
} from '../hooks/useAreaMessageActivity';

type Props = {
  userId: string | null;
  projectId: string | null;
  areaId: string | null;
  /** Shown as the modal title — e.g. the area name "Washroom 01-034". */
  areaLabel?: string;
};

export function AreaChatBubble({
  userId,
  projectId,
  areaId,
  areaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const { recentCount } = useAreaMessageActivity(userId, projectId, areaId);

  const handleClose = useCallback(() => {
    setOpen(false);
    // Reset badge instantly — markAreaVisited persists to AsyncStorage
    // and emits the AREA_VISITED event that triggers reload() in the
    // hook, dropping recentCount to 0 in the same render.
    if (userId && projectId && areaId) {
      markAreaVisited(userId, projectId, areaId).catch(() => {
        // No-op — the next reload will catch up if AsyncStorage failed.
      });
    }
  }, [userId, projectId, areaId]);

  // Hide if missing context (e.g. project not loaded yet).
  if (!projectId || !areaId) return null;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={
          recentCount > 0
            ? `Notes — ${recentCount} new message${recentCount === 1 ? '' : 's'}`
            : 'Open notes'
        }
        style={{
          position: 'absolute',
          right: 20,
          bottom: 24,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: '#1E293B',
          borderWidth: 1,
          borderColor: '#334155',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.4,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }}
      >
        <Ionicons name="chatbubbles" size={26} color="#F8FAFC" />
        {recentCount > 0 ? (
          <View
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 22,
              height: 22,
              paddingHorizontal: 5,
              borderRadius: 11,
              backgroundColor: '#EF4444',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: '#0F172A',
            }}
          >
            <Text
              style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}
            >
              {recentCount > 99 ? '99+' : recentCount}
            </Text>
          </View>
        ) : null}
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={handleClose}
        // statusBarTranslucent lets the Modal flow under the status bar on
        // Android so KeyboardAvoidingView's height calculation matches the
        // actual visible area when the keyboard opens. Without this, KAV
        // measures wrong and the composer still ends up under the keyboard.
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          // 2026-04-27 keyboard fix: behavior was `undefined` for Android,
          // which made KAV a no-op. Modal creates its own window on Android,
          // so the activity-level `softwareKeyboardLayoutMode: resize` from
          // app.json doesn't apply — Modal needs its own keyboard handling.
          // Using 'height' for Android (shrinks KAV's children to fit above
          // keyboard) and 'padding' for iOS (adds bottom padding equal to
          // keyboard height — works with the flex:1 backdrop + flex sheet).
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* Backdrop — tap closes */}
          <Pressable
            onPress={handleClose}
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.6)',
              justifyContent: 'flex-end',
            }}
          >
            {/* Sheet — taps inside don't close. Height stays at 85% of
                KAV's content area; on Android, KAV with behavior='height'
                resizes when keyboard opens, so 85% of the new (smaller)
                content area automatically positions the composer above
                the keyboard. */}
            <Pressable
              onPress={() => {}}
              style={{
                backgroundColor: '#0F172A',
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                borderTopWidth: 1,
                borderColor: '#334155',
                height: '85%',
              }}
            >
              {/* Drag handle */}
              <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                <View
                  style={{
                    width: 40,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: '#475569',
                  }}
                />
              </View>

              {/* Header */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingBottom: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: '#1E293B',
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: '#F8FAFC',
                      fontSize: 18,
                      fontWeight: '700',
                    }}
                    numberOfLines={1}
                  >
                    Notes
                  </Text>
                  {areaLabel ? (
                    <Text
                      style={{ color: '#94A3B8', fontSize: 13, marginTop: 2 }}
                      numberOfLines={1}
                    >
                      {areaLabel}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={handleClose}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Close notes"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="close" size={22} color="#94A3B8" />
                </Pressable>
              </View>

              {/* Thread — fills remaining sheet height. MessageThread
                  internally handles its own ScrollView + composer. */}
              <View style={{ flex: 1 }}>
                <MessageThread projectId={projectId} areaId={areaId} />
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
