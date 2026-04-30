/**
 * Tokenizer for calculator expressions.
 *
 * Handles construction-flavored input:
 *   "5'3 1/4""        → feet + inches + fraction inches (compound length)
 *   "5'-3 1/2""       → dash as separator (NOT subtraction)
 *   "5.5m + 2'7""     → mixed metric + imperial
 *   "1/4""            → fraction inches
 *   "5 - 2"           → subtraction (dash with whitespace)
 *   "(5'3" + 2') * 2" → grouping and multiplication
 *
 * Cross-repo sync: this file MUST stay byte-identical with
 * notchfield-takeoff/src/features/calculator/utils/tokenize.ts.
 */

import { LENGTH_UNIT_TOKENS, type LengthUnit } from '../types/units';

export type TokenType = 'NUMBER' | 'FRACTION' | 'UNIT' | 'OP' | 'LPAREN' | 'RPAREN';

export interface Token {
  type: TokenType;
  // NUMBER: parsed float; FRACTION: numerator (with denominator on next field); UNIT: parsed unit; OP: + - * /
  value: string;
  // For FRACTION only — the numerator/denominator
  num?: number;
  den?: number;
  // For UNIT only — the resolved canonical unit
  unit?: LengthUnit;
  // For NUMBER only — the parsed numeric value
  number?: number;
  // Source position for error messages
  pos: number;
}

export class TokenizeError extends Error {
  constructor(public position: number, message: string) {
    super(`Tokenize error at position ${position}: ${message}`);
  }
}

const OP_CHARS = new Set(['+', '-', '*', '×', '/', '÷']);
const UNIT_LETTER_RE = /[a-zA-Z]/;
const DIGIT_RE = /[0-9]/;

function normalizeOp(ch: string): string {
  if (ch === '×') return '*';
  if (ch === '÷') return '/';
  return ch;
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];

    // Skip whitespace
    if (ch === ' ' || ch === '\t') {
      i++;
      continue;
    }

    // Parens
    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(', pos: i });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')', pos: i });
      i++;
      continue;
    }

    // Dash: ambiguous. Treat as separator (skip) if it directly follows a unit-suffix
    // token (`'`, `"`, or a letter unit). Otherwise it's a minus operator.
    if (ch === '-') {
      const prev = tokens[tokens.length - 1];
      if (prev && prev.type === 'UNIT') {
        i++; // separator — skip
        continue;
      }
      tokens.push({ type: 'OP', value: '-', pos: i });
      i++;
      continue;
    }

    // Other operators
    if (OP_CHARS.has(ch)) {
      // Slash special-case: if surrounded by digits with no whitespace, it's a fraction.
      // Lookback: previous non-whitespace char is digit AND lookforward: next char is digit.
      // The fraction is parsed in the NUMBER branch when we see the second digit run.
      // Here we just emit as operator.
      tokens.push({ type: 'OP', value: normalizeOp(ch), pos: i });
      i++;
      continue;
    }

    // Quote unit shortcuts
    if (ch === "'") {
      tokens.push({ type: 'UNIT', value: "'", unit: 'ft', pos: i });
      i++;
      continue;
    }
    if (ch === '"') {
      tokens.push({ type: 'UNIT', value: '"', unit: 'in', pos: i });
      i++;
      continue;
    }

    // Number (with optional fraction immediately following: "1/2")
    if (DIGIT_RE.test(ch) || ch === '.') {
      const start = i;
      while (i < len && (DIGIT_RE.test(input[i]) || input[i] === '.')) i++;
      const numStr = input.slice(start, i);
      const numValue = parseFloat(numStr);
      if (Number.isNaN(numValue)) {
        throw new TokenizeError(start, `Invalid number "${numStr}"`);
      }

      // Look-ahead: is this part of a fraction "N/M"? (no whitespace between digits and slash)
      if (i < len && input[i] === '/' && i + 1 < len && DIGIT_RE.test(input[i + 1])) {
        // Consume slash + denominator digits
        const slashPos = i;
        i++; // skip slash
        const denStart = i;
        while (i < len && DIGIT_RE.test(input[i])) i++;
        const denStr = input.slice(denStart, i);
        const denValue = parseInt(denStr, 10);
        if (denValue === 0) {
          throw new TokenizeError(slashPos, 'Division by zero in fraction');
        }
        // The previous numStr was actually the numerator
        tokens.push({
          type: 'FRACTION',
          value: `${numStr}/${denStr}`,
          num: numValue,
          den: denValue,
          pos: start,
        });
        continue;
      }

      tokens.push({
        type: 'NUMBER',
        value: numStr,
        number: numValue,
        pos: start,
      });
      continue;
    }

    // Unit identifier (letters)
    if (UNIT_LETTER_RE.test(ch)) {
      const start = i;
      while (i < len && UNIT_LETTER_RE.test(input[i])) i++;
      const word = input.slice(start, i).toLowerCase();
      const unit = LENGTH_UNIT_TOKENS[word];
      if (!unit) {
        throw new TokenizeError(start, `Unknown unit "${word}"`);
      }
      tokens.push({ type: 'UNIT', value: word, unit, pos: start });
      continue;
    }

    throw new TokenizeError(i, `Unexpected character "${ch}"`);
  }

  return tokens;
}
