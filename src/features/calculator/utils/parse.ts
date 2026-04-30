/**
 * Recursive-descent parser for calculator expressions.
 *
 * Grammar:
 *   expression = term (('+' | '-') term)*
 *   term       = factor (('*' | '/') factor)*
 *   factor     = '-' factor | '(' expression ')' | length
 *   length     = LENGTH_LITERAL | NUMBER  (compound length parsing handled inline)
 *
 * Compound length: a sequence like
 *   NUMBER UNIT(ft) NUMBER UNIT(in)
 *   NUMBER UNIT(ft) NUMBER FRACTION UNIT(in)
 *   NUMBER FRACTION UNIT(in)
 * is treated as implicit addition within a single length literal.
 *
 * Type promotion:
 *   length × length  → area
 *   length × area    → volume
 *   length / scalar  → length
 *   length / length  → scalar (ratio)
 *   area   / length  → length
 *   length + length  → length (areas + areas, volumes + volumes)
 *   mixing kinds in + or - is an error (can't add 5 ft + 3 sqft)
 *
 * Cross-repo sync: this file MUST stay byte-identical with
 * notchfield-takeoff/src/features/calculator/utils/parse.ts.
 */

import { tokenize, type Token, TokenizeError } from './tokenize';
import {
  LENGTH_UNIT_TO_MM,
  SQM_PER_SQFT,
  type LengthUnit,
  type Value,
  type ValueKind,
} from '../types/units';

export class ParseError extends Error {
  constructor(public position: number, message: string) {
    super(`Parse error at position ${position}: ${message}`);
  }
}

export class EvalError extends Error {
  constructor(message: string) {
    super(`Eval error: ${message}`);
  }
}

// Whether a unit token is imperial — used by compound-length detection
function isImperial(unit: string | undefined): boolean {
  return unit === 'ft' || unit === 'in' || unit === 'yd';
}

class Parser {
  private pos = 0;

  constructor(private tokens: Token[]) {}

  parse(): Value {
    if (this.tokens.length === 0) {
      throw new ParseError(0, 'Empty expression');
    }
    const result = this.expression();
    if (this.pos < this.tokens.length) {
      throw new ParseError(this.tokens[this.pos].pos, `Unexpected token "${this.tokens[this.pos].value}"`);
    }
    return result;
  }

  private peek(offset = 0): Token | undefined {
    return this.tokens[this.pos + offset];
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }

  private expression(): Value {
    let left = this.term();
    while (this.peek()?.type === 'OP' && (this.peek()!.value === '+' || this.peek()!.value === '-')) {
      const op = this.consume().value;
      const right = this.term();
      left = applyBinary(left, right, op);
    }
    return left;
  }

  private term(): Value {
    let left = this.factor();
    while (this.peek()?.type === 'OP' && (this.peek()!.value === '*' || this.peek()!.value === '/')) {
      const op = this.consume().value;
      const right = this.factor();
      left = applyBinary(left, right, op);
    }
    return left;
  }

  private factor(): Value {
    const tok = this.peek();
    if (!tok) throw new ParseError(0, 'Unexpected end of expression');

    // Unary minus
    if (tok.type === 'OP' && tok.value === '-') {
      this.consume();
      const operand = this.factor();
      return { kind: operand.kind, value: -operand.value };
    }

    // Parens
    if (tok.type === 'LPAREN') {
      this.consume();
      const inner = this.expression();
      const close = this.peek();
      if (!close || close.type !== 'RPAREN') {
        throw new ParseError(tok.pos, 'Missing closing paren');
      }
      this.consume();
      return inner;
    }

    // Length literal (NUMBER UNIT, NUMBER FRACTION UNIT, FRACTION UNIT, NUMBER alone)
    return this.lengthLiteral();
  }

  private lengthLiteral(): Value {
    const tok = this.peek();
    if (!tok) throw new ParseError(0, 'Expected number');

    // Pure FRACTION UNIT — like "1/4""
    if (tok.type === 'FRACTION') {
      const frac = this.consume();
      const next = this.peek();
      if (!next || next.type !== 'UNIT') {
        throw new ParseError(frac.pos, 'Fraction must be followed by a unit');
      }
      const unitTok = this.consume();
      const decimal = frac.num! / frac.den!;
      const mm = decimal * LENGTH_UNIT_TO_MM[unitTok.unit!];
      return { kind: 'length', value: mm };
    }

    // NUMBER ...
    if (tok.type !== 'NUMBER') {
      throw new ParseError(tok.pos, `Expected number, got "${tok.value}"`);
    }
    const num = this.consume();
    const next = this.peek();

    // NUMBER FRACTION UNIT — "10 1/2"" → 10.5 inches.
    // Field convention: write "10 1/2" with the fraction belonging to the
    // same unit as the trailing symbol. Common on plans + sketch notes.
    if (next?.type === 'FRACTION' && this.peek(1)?.type === 'UNIT') {
      const fracTok = this.consume();
      const unitTok = this.consume();
      const decimal = num.number! + fracTok.num! / fracTok.den!;
      const totalMm = decimal * LENGTH_UNIT_TO_MM[unitTok.unit!];
      return this.continueCompound(totalMm, unitTok.unit!);
    }

    // Unitless number → scalar
    if (!next || next.type !== 'UNIT') {
      return { kind: 'scalar', value: num.number! };
    }

    // NUMBER UNIT — basic length literal
    const firstUnitTok = this.consume();
    const totalMm = num.number! * LENGTH_UNIT_TO_MM[firstUnitTok.unit!];
    return this.continueCompound(totalMm, firstUnitTok.unit!);
  }

  /**
   * Compound-length continuation. After we've consumed an initial length
   * segment (NUMBER UNIT or NUMBER FRACTION UNIT), keep absorbing segments
   * that look like continuations of the same physical measurement:
   *   5'3"        → 5 ft 3 in
   *   5'-3"       → 5 ft 3 in (dash is separator)
   *   5'3 1/4"    → 5 ft 3.25 in
   *   5'3 1/4     → 5 ft 3.25 in (implicit trailing inches)
   *   5' 1/4      → 5 ft 0.25 in
   *   10" 1/2     → 10.5 in (implicit fraction continues inches)
   *   10 1/2"     → handled at entry (NUMBER FRACTION UNIT)
   * Continuation only applies to imperial — metric expressions don't have
   * compound forms.
   */
  private continueCompound(initialMm: number, firstUnit: LengthUnit): Value {
    let totalMm = initialMm;
    if (!isImperial(firstUnit)) {
      return { kind: 'length', value: totalMm };
    }

    const firstWasFt = firstUnit === 'ft';
    // Bare FRACTION continuation works after either ft (implicit inches) or
    // in (implicit same-unit inches) — both cases the fraction is inches.
    const acceptBareFrac = firstWasFt || firstUnit === 'in';

    while (true) {
      const lookahead = this.peek();
      if (!lookahead) break;

      if (lookahead.type === 'NUMBER') {
        const after1 = this.peek(1);
        const after2 = this.peek(2);

        // NUMBER FRACTION UNIT — explicit "3 1/4""
        if (after1?.type === 'FRACTION' && after2?.type === 'UNIT' && isImperial(after2.unit)) {
          const wholeTok = this.consume();
          const fracTok = this.consume();
          const unitTok = this.consume();
          const decimal = wholeTok.number! + fracTok.num! / fracTok.den!;
          totalMm += decimal * LENGTH_UNIT_TO_MM[unitTok.unit!];
          continue;
        }
        // NUMBER UNIT — explicit "3""
        if (after1?.type === 'UNIT' && isImperial(after1.unit)) {
          const wholeTok = this.consume();
          const unitTok = this.consume();
          totalMm += wholeTok.number! * LENGTH_UNIT_TO_MM[unitTok.unit!];
          continue;
        }
        // NUMBER FRACTION (no unit) — implicit inches after feet ("5'3 1/4")
        if (after1?.type === 'FRACTION' && firstWasFt) {
          const wholeTok = this.consume();
          const fracTok = this.consume();
          const decimal = wholeTok.number! + fracTok.num! / fracTok.den!;
          totalMm += decimal * LENGTH_UNIT_TO_MM.in;
          continue;
        }
        // Bare NUMBER, end-of-expression / OP / RPAREN — implicit inches
        // after feet ("5'3")
        if (firstWasFt && (!after1 || after1.type === 'OP' || after1.type === 'RPAREN')) {
          const wholeTok = this.consume();
          totalMm += wholeTok.number! * LENGTH_UNIT_TO_MM.in;
          continue;
        }
        break;
      }

      if (lookahead.type === 'FRACTION') {
        const after1 = this.peek(1);
        // FRACTION UNIT — "5' 1/4""
        if (after1?.type === 'UNIT' && isImperial(after1.unit)) {
          const fracTok = this.consume();
          const unitTok = this.consume();
          const decimal = fracTok.num! / fracTok.den!;
          totalMm += decimal * LENGTH_UNIT_TO_MM[unitTok.unit!];
          continue;
        }
        // Bare FRACTION at end / before OP — implicit inches continuation
        // after either ft (5' 1/4) or in (10" 1/2)
        if (acceptBareFrac && (!after1 || after1.type === 'OP' || after1.type === 'RPAREN')) {
          const fracTok = this.consume();
          const decimal = fracTok.num! / fracTok.den!;
          totalMm += decimal * LENGTH_UNIT_TO_MM.in;
          continue;
        }
        break;
      }

      break;
    }

    return { kind: 'length', value: totalMm };
  }
}

function applyBinary(left: Value, right: Value, op: string): Value {
  switch (op) {
    case '+':
    case '-': {
      // Same kind required
      if (left.kind !== right.kind) {
        // Allow scalar ± scalar; otherwise error
        if (left.kind === 'scalar' && right.kind === 'scalar') {
          return { kind: 'scalar', value: op === '+' ? left.value + right.value : left.value - right.value };
        }
        throw new EvalError(`Can't ${op === '+' ? 'add' : 'subtract'} ${left.kind} and ${right.kind}`);
      }
      const v = op === '+' ? left.value + right.value : left.value - right.value;
      return { kind: left.kind, value: v };
    }
    case '*': {
      // length × length → area (mm² → m²)
      if (left.kind === 'length' && right.kind === 'length') {
        const sqm = (left.value * right.value) / 1_000_000;
        return { kind: 'area', value: sqm };
      }
      // length × area → volume (mm × m² = mm·m² → convert mm to m first)
      if (left.kind === 'length' && right.kind === 'area') {
        return { kind: 'volume', value: (left.value / 1000) * right.value };
      }
      if (left.kind === 'area' && right.kind === 'length') {
        return { kind: 'volume', value: left.value * (right.value / 1000) };
      }
      // scalar × anything → same kind as the other operand
      if (left.kind === 'scalar') {
        return { kind: right.kind, value: left.value * right.value };
      }
      if (right.kind === 'scalar') {
        return { kind: left.kind, value: left.value * right.value };
      }
      throw new EvalError(`Can't multiply ${left.kind} by ${right.kind}`);
    }
    case '/': {
      if (right.value === 0) throw new EvalError('Division by zero');
      // length / length → scalar (ratio)
      if (left.kind === 'length' && right.kind === 'length') {
        return { kind: 'scalar', value: left.value / right.value };
      }
      // area / length → length
      if (left.kind === 'area' && right.kind === 'length') {
        // sqm / mm → m → mm
        return { kind: 'length', value: ((left.value * 1_000_000) / right.value) };
      }
      // volume / area → length
      if (left.kind === 'volume' && right.kind === 'area') {
        return { kind: 'length', value: (left.value / right.value) * 1000 };
      }
      // anything / scalar → same kind
      if (right.kind === 'scalar') {
        return { kind: left.kind, value: left.value / right.value };
      }
      throw new EvalError(`Can't divide ${left.kind} by ${right.kind}`);
    }
    default:
      throw new EvalError(`Unknown operator "${op}"`);
  }
}

/**
 * Parse and evaluate a calculator expression string.
 * Returns a Value tagged with its kind.
 */
export function evaluate(input: string): Value {
  const trimmed = input.trim();
  if (!trimmed) throw new ParseError(0, 'Empty expression');
  let tokens: Token[];
  try {
    tokens = tokenize(trimmed);
  } catch (e) {
    if (e instanceof TokenizeError) throw e;
    throw new ParseError(0, (e as Error).message);
  }
  const parser = new Parser(tokens);
  return parser.parse();
}

// Re-exported for convenience
export type { ValueKind };
// Suppress unused-export warning on SQM_PER_SQFT — kept available for future use
void SQM_PER_SQFT;
