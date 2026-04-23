/**
 * Account service — self-service profile deletion.
 *
 * Apple (2022+) and Google Play (2023+) both require that any app with
 * account creation provides an in-app way to delete the account. Ours
 * calls the `delete-my-account` Edge Function, which anonymizes the
 * profiles row and tombstones the auth.users entry so the account can
 * never be logged into again. Signatures, safety docs, and time entries
 * stay attached to the anonymized profile for legal retention (NY Labor
 * Law 7 years + OSHA compliance).
 */

import { supabase } from '@/shared/lib/supabase/client';

export type DeleteAccountResult = {
  success: boolean;
  error?: string;
};

/**
 * Call the `delete-my-account` Edge Function for the currently signed-in
 * user. On success the caller should invoke `authStore.signOut()` and
 * redirect to the login screen — the session JWT will no longer work
 * against Supabase because the auth row has been tombstoned.
 */
export async function deleteMyAccount(): Promise<DeleteAccountResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return { success: false, error: 'Not signed in' };
  }

  try {
    const { data, error } = await supabase.functions.invoke<{
      success?: boolean;
      error?: string;
      detail?: string;
      partial?: string;
    }>('delete-my-account', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    if (data && data.success === true) {
      return { success: true };
    }
    const detail = data?.detail ? ` (${data.detail})` : '';
    return { success: false, error: (data?.error ?? 'Delete failed') + detail };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}
