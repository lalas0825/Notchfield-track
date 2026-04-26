/**
 * Sprint 69 — Optimistic local-read state, shared across surfaces.
 *
 * Why a store and not per-component state: the bell badge (Home header)
 * and the notifications list are TWO React components, each with their
 * own useNotifications() instance and their own local state. If only the
 * list tracked optimistic reads, the bell badge would stay stuck on the
 * old count until a server reload completed (or, in mock mode, never).
 *
 * This store is the single source of truth for "this id was tapped-read
 * locally, but the server might not know yet". Both useNotifications and
 * NotificationsScreen subscribe to it via Zustand selectors and re-render
 * together on changes.
 *
 * Lifecycle:
 *   - markRead(id) on every list-row tap (optimistic)
 *   - The set persists for the app session — no auto-clear on reload.
 *     In live mode, the server's read_at takes over once PowerSync syncs;
 *     keeping the optimistic id in the set is a harmless duplicate filter.
 *     In mock mode, nothing else marks items read, so the set IS the
 *     source of truth for the session.
 *   - clear() exists for an explicit "Mark all read" button (Phase 2).
 *
 * Set immutability: Zustand uses Object.is for change detection. Mutating
 * a Set in place does NOT trigger a re-render — every update creates a
 * fresh Set so subscribers fire.
 */

import { create } from 'zustand';

type LocalReadState = {
  ids: ReadonlySet<string>;
  markRead: (id: string) => void;
  clear: () => void;
};

export const useLocalReadStore = create<LocalReadState>((set) => ({
  ids: new Set<string>(),
  markRead: (id) =>
    set((s) => {
      if (s.ids.has(id)) return s; // no-op, keep the same Set ref
      const next = new Set(s.ids);
      next.add(id);
      return { ids: next };
    }),
  clear: () => set({ ids: new Set<string>() }),
}));
