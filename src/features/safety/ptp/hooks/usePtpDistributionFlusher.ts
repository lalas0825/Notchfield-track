import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { flushDistributionQueue } from '../services/distributeService';

/**
 * Attempts to flush the offline distribute queue on mount and every 60 s
 * while the app is in the foreground. The flush call itself no-ops fast when
 * the queue is empty, so this is cheap to run repeatedly.
 *
 * Mount this once near the app root (or in any long-lived layout). It does
 * NOT try to detect network state — `fetch()` fails fast when offline and
 * the individual requeue paths do not incur cost.
 */
export function usePtpDistributionFlusher(intervalMs = 60_000) {
  useEffect(() => {
    let cancelled = false;

    const tryFlush = async () => {
      if (cancelled) return;
      try {
        await flushDistributionQueue();
      } catch {
        // swallow — the queue persists for the next attempt
      }
    };

    // Fire once on mount
    tryFlush();

    // Poll while mounted
    const timer = setInterval(tryFlush, intervalMs);

    // Flush again whenever the app comes back to foreground
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') tryFlush();
    });

    return () => {
      cancelled = true;
      clearInterval(timer);
      sub.remove();
    };
  }, [intervalMs]);
}
