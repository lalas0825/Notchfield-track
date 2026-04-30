/**
 * Zustand store for the active calculator expression + last result.
 *
 * History is owned by useHistory.ts (separate so AsyncStorage logic is isolated).
 */

import { create } from 'zustand';
import { evaluate, EvalError, ParseError } from '../utils/parse';
import { TokenizeError } from '../utils/tokenize';
import { DEFAULT_PRECISION, type ImperialPrecision, type Value } from '../types/units';

interface CalculatorState {
  expression: string;
  result: Value | null;
  error: string | null;
  precision: ImperialPrecision;

  setExpression: (e: string) => void;
  appendToExpression: (s: string) => void;
  backspace: () => void;
  clear: () => void;
  evaluateNow: () => Value | null;
  setPrecision: (p: ImperialPrecision) => void;
  loadFromHistory: (expression: string) => void;
}

export const useCalculator = create<CalculatorState>((set, get) => ({
  expression: '',
  result: null,
  error: null,
  precision: DEFAULT_PRECISION,

  setExpression: (e) => set({ expression: e, error: null }),

  appendToExpression: (s) => set((state) => ({
    expression: state.expression + s,
    error: null,
  })),

  backspace: () => set((state) => ({
    expression: state.expression.slice(0, -1),
    error: null,
  })),

  clear: () => set({ expression: '', result: null, error: null }),

  evaluateNow: () => {
    const expr = get().expression.trim();
    if (!expr) {
      set({ result: null, error: null });
      return null;
    }
    try {
      const v = evaluate(expr);
      set({ result: v, error: null });
      return v;
    } catch (e) {
      const msg =
        e instanceof ParseError ? e.message :
        e instanceof TokenizeError ? e.message :
        e instanceof EvalError ? e.message :
        String(e);
      set({ result: null, error: msg });
      return null;
    }
  },

  setPrecision: (p) => set({ precision: p }),

  loadFromHistory: (expression) => {
    set({ expression, error: null });
    // Auto-eval after load so the display refreshes
    setTimeout(() => get().evaluateNow(), 0);
  },
}));
