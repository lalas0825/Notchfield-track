/**
 * Settings screen — profile info + app preferences + account management.
 *
 * The Danger Zone at the bottom hosts the "Delete Account" flow required
 * by Apple (2022+) and Google Play (2023+) policy. Keep it visible and
 * one-tap reachable from the More tab so store reviewers can find it
 * without asking — "couldn't locate account deletion" is one of the most
 * common first-rejection reasons.
 */

import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { deleteMyAccount } from '@/features/account/services/account-service';
import { Avatar } from '@/shared/components/Avatar';
import {
  pickAndUploadAvatar,
  removeAvatar,
  avatarErrorMessage,
} from '@/features/auth/services/avatar-service';

export default function SettingsScreen() {
  const router = useRouter();
  const { profile, user, signOut, fetchProfile } = useAuthStore();
  const [showDelete, setShowDelete] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const CONFIRM_PHRASE = 'DELETE';
  const canConfirm = confirmText.trim() === CONFIRM_PHRASE;

  const handleChangeAvatar = async () => {
    if (!user || avatarBusy) return;
    setAvatarBusy(true);
    try {
      const result = await pickAndUploadAvatar(user.id);
      if (!result.success) {
        const msg = avatarErrorMessage(result.error);
        if (msg) Alert.alert('Could not update photo', msg);
        return;
      }
      // Refresh profile so the new avatar_url propagates to all
      // mounted <Avatar> instances (top-bar, More card, etc).
      await fetchProfile(user.id);
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleRemoveAvatar = () => {
    if (!user || avatarBusy) return;
    Alert.alert(
      'Remove profile photo?',
      'You\'ll go back to showing your initial.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setAvatarBusy(true);
            try {
              const result = await removeAvatar(user.id);
              if (!result.success) {
                Alert.alert(
                  'Could not remove photo',
                  avatarErrorMessage(result.error),
                );
                return;
              }
              await fetchProfile(user.id);
            } finally {
              setAvatarBusy(false);
            }
          },
        },
      ],
    );
  };

  const performDelete = async () => {
    if (!canConfirm || deleting) return;
    setDeleting(true);
    const result = await deleteMyAccount();
    if (!result.success) {
      setDeleting(false);
      Alert.alert(
        'Could not delete account',
        result.error ?? 'Unknown error. Please try again or contact support.',
      );
      return;
    }
    // Sign out locally and route to login. The auth row was tombstoned
    // server-side, so the next request against Supabase would 401 anyway —
    // this just makes the transition clean instead of "session expired"
    // popping up a second later.
    await signOut();
    setDeleting(false);
    setShowDelete(false);
    router.replace('/(auth)/login' as any);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Settings',
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#F8FAFC',
        }}
      />
      <ScrollView className="flex-1 bg-background px-4 pt-4" keyboardShouldPersistTaps="handled">
        {/* ─── Profile card ─── */}
        <View className="mb-6 rounded-2xl border border-border bg-card p-4">
          <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
            Profile
          </Text>

          {/* Avatar block — Sprint 73B */}
          <View className="mb-4 items-center">
            <Avatar
              name={profile?.full_name ?? '?'}
              imageUrl={profile?.avatar_url}
              size="xl"
            />
            <View className="mt-3 flex-row gap-2">
              <Pressable
                onPress={handleChangeAvatar}
                disabled={avatarBusy}
                className="h-9 flex-row items-center rounded-lg border border-border bg-background px-3 active:opacity-80"
                style={{ opacity: avatarBusy ? 0.5 : 1 }}
              >
                {avatarBusy ? (
                  <ActivityIndicator color="#94A3B8" size="small" />
                ) : (
                  <>
                    <Ionicons name="camera" size={14} color="#F97316" />
                    <Text className="ml-1.5 text-sm font-medium text-white">
                      {profile?.avatar_url ? 'Change photo' : 'Upload photo'}
                    </Text>
                  </>
                )}
              </Pressable>
              {profile?.avatar_url ? (
                <Pressable
                  onPress={handleRemoveAvatar}
                  disabled={avatarBusy}
                  className="h-9 flex-row items-center rounded-lg border border-border bg-background px-3 active:opacity-80"
                  style={{ opacity: avatarBusy ? 0.5 : 1 }}
                >
                  <Ionicons name="trash-outline" size={14} color="#EF4444" />
                  <Text className="ml-1.5 text-sm font-medium text-danger">
                    Remove
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <Text className="mt-2 text-xs text-slate-500">
              JPG, PNG or WebP. Max 5 MB.
            </Text>
          </View>

          <Row label="Name" value={profile?.full_name ?? '—'} />
          <Row label="Email" value={user?.email ?? '—'} />
          <Row label="Role" value={profile?.role ?? '—'} capitalize />
          <Row label="Language" value={profile?.locale ?? '—'} capitalize />
        </View>

        {/* ─── App info ─── */}
        <View className="mb-6 rounded-2xl border border-border bg-card p-4">
          <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
            App
          </Text>
          <Row label="Version" value="1.0.0" />
          <Row label="Build" value="NotchField Track" />
        </View>

        {/* ─── Danger Zone ─── */}
        <View className="mb-6 overflow-hidden rounded-2xl border border-danger/40 bg-danger/5">
          <View className="border-b border-danger/30 bg-danger/10 px-4 py-2">
            <Text className="text-xs font-bold uppercase tracking-wider text-danger">
              Danger Zone
            </Text>
          </View>
          <View className="p-4">
            <Text className="mb-1 text-base font-medium text-white">Delete my account</Text>
            <Text className="mb-3 text-sm leading-snug text-slate-400">
              Permanently anonymizes your profile. Your signed safety documents,
              work tickets, and time entries stay with your organization for
              legal retention — they'll show as attributed to "Deleted User".
              This cannot be undone.
            </Text>
            <Pressable
              onPress={() => {
                setConfirmText('');
                setShowDelete(true);
              }}
              className="h-11 flex-row items-center justify-center rounded-xl border border-danger active:opacity-80"
            >
              <Ionicons name="trash" size={16} color="#EF4444" />
              <Text className="ml-2 text-sm font-bold text-danger">Delete my account</Text>
            </Pressable>
          </View>
        </View>

        <View className="h-24" />
      </ScrollView>

      {/* ─── Confirmation modal ─── */}
      {showDelete ? (
        <View className="absolute inset-0 items-center justify-center bg-black/70 px-6">
          <View className="w-full max-w-md rounded-2xl border border-border bg-card p-5">
            <View className="mb-3 flex-row items-center">
              <Ionicons name="warning" size={22} color="#EF4444" />
              <Text className="ml-2 flex-1 text-lg font-bold text-white">Delete account?</Text>
            </View>

            <Text className="mb-4 text-sm leading-snug text-slate-300">
              This cannot be undone. Your name will be removed from your profile
              and you will no longer be able to sign in. Your signed documents
              stay with your organization.
            </Text>

            <Text className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">
              Type{' '}
              <Text className="text-danger">{CONFIRM_PHRASE}</Text>
              {' '}to confirm
            </Text>
            <TextInput
              value={confirmText}
              onChangeText={setConfirmText}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder={CONFIRM_PHRASE}
              placeholderTextColor="#475569"
              editable={!deleting}
              className="mb-4 h-11 rounded-xl border border-border bg-background px-3 text-base text-white"
            />

            <View className="flex-row">
              <Pressable
                onPress={() => setShowDelete(false)}
                disabled={deleting}
                className="mr-2 h-11 flex-1 items-center justify-center rounded-xl border border-border active:opacity-80"
              >
                <Text className="text-base font-medium text-white">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={performDelete}
                disabled={!canConfirm || deleting}
                className="ml-2 h-11 flex-1 flex-row items-center justify-center rounded-xl bg-danger active:opacity-80"
                style={{ opacity: canConfirm && !deleting ? 1 : 0.4 }}
              >
                {deleting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="trash" size={16} color="#FFFFFF" />
                    <Text className="ml-2 text-base font-bold text-white">Delete</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </>
  );
}

function Row({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <View className="mb-2 flex-row">
      <Text className="w-24 text-sm text-slate-500">{label}</Text>
      <Text
        className={`flex-1 text-base text-white ${capitalize ? 'capitalize' : ''}`}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}
