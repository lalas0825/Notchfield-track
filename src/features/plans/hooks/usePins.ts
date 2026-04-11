/**
 * usePins — Sprint 47B
 * ======================
 * Fetch + manage drawing pins for a specific drawing. Local-first via
 * PowerSync write helpers (offline-safe). Provides reload after mutations.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  fetchPinsForDrawing,
  type DrawingPin,
} from '../services/pin-service';

export function usePins(drawingId: string | null) {
  const [pins, setPins] = useState<DrawingPin[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!drawingId) {
      setPins([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchPinsForDrawing(drawingId);
      setPins(data);
    } catch (err) {
      console.warn('[usePins] load failed', err);
      setPins([]);
    } finally {
      setLoading(false);
    }
  }, [drawingId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { pins, loading, reload };
}
