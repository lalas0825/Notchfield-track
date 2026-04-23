import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/shared/lib/supabase/client';
import { initPowerSync, disconnectPowerSync } from '@/shared/lib/powersync/client';
import { useProjectStore } from '@/features/projects/store/project-store';
import { setSentryUser, clearSentryUser } from '@/shared/lib/sentry';

type Profile = {
  id: string;
  full_name: string | null;
  role: string;
  locale: string;
  organization_id: string;
  avatar_url: string | null;
};

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
};

type AuthActions = {
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  setSession: (session: Session | null) => void;
  fetchProfile: (userId: string) => Promise<void>;
};

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  loading: true,
  initialized: false,

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      // IMPORTANT: PowerSync must be initialized BEFORE we set profile state.
      // Otherwise TrackPermissionsContext fires its reload() with PowerSync
      // not yet ready, localQuery returns null, and we fall through to
      // Supabase REST which can hang on flaky networks.
      await initPowerSync();
      set({ session, user: session.user });
      setSentryUser(session.user.id);
      await get().fetchProfile(session.user.id);
      // Project loading is now driven by TrackPermissionsProvider, which
      // also fetches project_assignments to scope the project list (40C).
    }

    // Listen for auth changes (token refresh, sign out, etc.)
    supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (event === 'SIGNED_IN' && newSession?.user) {
        await initPowerSync();
        set({ session: newSession, user: newSession.user });
        setSentryUser(newSession.user.id);
        await get().fetchProfile(newSession.user.id);
        return;
      }

      set({ session: newSession, user: newSession?.user ?? null });

      if (event === 'SIGNED_OUT') {
        set({ profile: null });
        clearSentryUser();
        useProjectStore.setState({ projects: [], activeProject: null, isSupervisor: false });
        await disconnectPowerSync();
      }
    });

    set({ loading: false, initialized: true });
  },

  signIn: async (email, password) => {
    set({ loading: true });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    set({ loading: false });

    if (error) {
      return { error: error.message };
    }
    return { error: null };
  },

  signOut: async () => {
    set({ loading: true });
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null, loading: false });
  },

  resetPassword: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      return { error: error.message };
    }
    return { error: null };
  },

  setSession: (session) => {
    set({ session, user: session?.user ?? null });
  },

  fetchProfile: async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, locale, organization_id, avatar_url')
      .eq('id', userId)
      .single();

    if (!error && data) {
      const profile = data as Profile;
      set({ profile });
      // Tag the Sentry scope with role + organization_id (no PII) so
      // issues can be filtered by team / org in the dashboard.
      setSentryUser(userId, profile.role, profile.organization_id);
    }
  },
}));
