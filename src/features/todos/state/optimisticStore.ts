/**
 * Sprint 70 — Optimistic todo state, shared across surfaces.
 *
 * Same pattern as Sprint 69 localReadStore: Today screen, Compliance screen,
 * and the Today header icon's badge all read from this store so a
 * mark-done / snooze / dismiss tap on one surface re-renders the others
 * in the same React tick.
 *
 * Three sets cover the three optimistic states:
 *   - pendingDoneIds:    user swiped right; 5-second undo window
 *   - pendingSnoozeIds:  user picked a snooze option; row hidden until
 *                        Web flips status back to 'pending' on snooze_until
 *   - pendingDismissIds: user dismissed (long-press menu)
 *
 * Hidden = id is in ANY of the three sets. The hook applies a single
 * filter via `isOptimisticallyHidden(id)`.
 *
 * Lifecycle:
 *   - Sets persist for the app session (no auto-clear on reload).
 *     In live mode, PowerSync's sync rule excludes done/dismissed so the
 *     underlying row falls out of local SQLite and the optimistic id
 *     becomes a harmless duplicate filter. In mock mode, the sets ARE
 *     the source of truth for the session.
 *   - undoMarkDone(id) is the one inverse — clears the id from
 *     pendingDoneIds so the row returns to the list. Only callable
 *     within the 5-second window before the API call commits.
 *
 * Set immutability: every mutation creates a fresh Set so Zustand's
 * Object.is comparison fires subscribers (same rule as localReadStore).
 */

import { create } from 'zustand';

type OptimisticState = {
  pendingDoneIds: ReadonlySet<string>;
  pendingSnoozeIds: ReadonlySet<string>;
  pendingDismissIds: ReadonlySet<string>;
  /** Mark id as locally-done. Returns true on add, false if already present. */
  markDone: (id: string) => boolean;
  /** Restore — used by the 5-second undo toast. */
  undoMarkDone: (id: string) => void;
  /** Hide the row (snooze is a one-way op — no undo in the spec). */
  markSnoozed: (id: string) => void;
  /** Hide the row (dismiss is a one-way op). */
  markDismissed: (id: string) => void;
  /** Test helper / explicit "Refresh" reset. */
  clearAll: () => void;
};

function withAdded(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (set.has(id)) return set;
  const next = new Set(set);
  next.add(id);
  return next;
}

function withRemoved(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (!set.has(id)) return set;
  const next = new Set(set);
  next.delete(id);
  return next;
}

export const useTodoOptimisticStore = create<OptimisticState>((set, get) => ({
  pendingDoneIds: new Set<string>(),
  pendingSnoozeIds: new Set<string>(),
  pendingDismissIds: new Set<string>(),

  markDone: (id) => {
    const before = get().pendingDoneIds;
    const after = withAdded(before, id);
    if (after === before) return false;
    set({ pendingDoneIds: after });
    return true;
  },

  undoMarkDone: (id) => {
    set((s) => ({ pendingDoneIds: withRemoved(s.pendingDoneIds, id) }));
  },

  markSnoozed: (id) => {
    set((s) => ({ pendingSnoozeIds: withAdded(s.pendingSnoozeIds, id) }));
  },

  markDismissed: (id) => {
    set((s) => ({ pendingDismissIds: withAdded(s.pendingDismissIds, id) }));
  },

  clearAll: () => {
    set({
      pendingDoneIds: new Set<string>(),
      pendingSnoozeIds: new Set<string>(),
      pendingDismissIds: new Set<string>(),
    });
  },
}));

/**
 * Imperative helper for read-only callers (e.g. the useTodos hook's
 * filter step). Reads the current store state without subscribing.
 */
export function isOptimisticallyHidden(id: string): boolean {
  const s = useTodoOptimisticStore.getState();
  return s.pendingDoneIds.has(id) || s.pendingSnoozeIds.has(id) || s.pendingDismissIds.has(id);
}
