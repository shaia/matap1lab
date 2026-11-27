/**
 * Formula answers: read what a student types ("x^2 e^x", "sin(2t)/2", "ln|x| + C") and decide whether it is the same
 * function as the key.
 *
 * MODEL SPECIFICATION
 * - Input syntax: mathjs expressions (number build) after a normalisation that accepts what students write by hand:
 *   π → pi, √ → sqrt, ln → log (mathjs's log is natural), arcsin/arccos/arctan → asin/acos/atan, tg → tan,
 *   |…| → abs(…), the multiplication signs · × and the minus sign U+2212. Implicit products ("2x", "x e^x") work.
 * - Equivalence is a probe, not a proof: two expressions are "the same" when they agree at every one of up to
 *   POINTS random points of the stated box where the key is finite (a seeded generator, so a question always
 *   probes the same points). Agreement means |s − k| ≤ TOL·max(1, |k|). With `upToConstant`, the differences
 *   s − k must all agree with the first one instead (an antiderivative is right up to a constant, and a typed
 *   "+ C" counts as 0).
 * - Ignored: branch subtleties outside the box (ln x and ln|x| agree on a box inside x > 0), and expressions that
 *   agree on the sampled points by accident (a polynomial of high degree with roots there): the box and the
 *   number of points make that vanishingly unlikely for course answers.
 * - Valid range: real-valued expressions; a value that is complex or not finite at a point drops that point.
 */

import { parse, type MathNode } from 'mathjs/number';

const POINTS = 8;
const TOL = 1e-6;
/** constants and functions a student may write; anything else must be one of the question's variables */
const CONSTANTS = new Set(['pi', 'e']);
/** function names a student writes by hand (after normalisation) */
const FUNCTIONS = 'sin|cos|tan|cot|sec|csc|sinh|cosh|tanh|asin|acos|atan|log|exp|sqrt|abs';

export interface ExprSpec {
  /** the free variables the student may use */
  variables: string[];
  /** the box the test points are drawn from, the same interval for every variable */
  domain: [number, number];
  upToConstant: boolean;
  /** seeds the test points, so a question always probes the same ones */
  seed: string;
}

/** Hand-written notation → mathjs syntax. */
export function normalizeExpr(input: string): string {
  let s = input
    .trim()
    .replace(/−/g, '-')
    .replace(/[·×]/g, '*')
    .replace(/π/g, 'pi')
    .replace(/\barc(sin|cos|tan)\b/g, 'a$1')
    .replace(/\btg\b/g, 'tan')
    .replace(/\bln\b/g, 'log');
  // √x, √2, √(…) → sqrt(…)
  s = s.replace(/√\s*\(/g, 'sqrt(').replace(/√\s*([a-z]|\d+(?:\.\d+)?)/gi, 'sqrt($1)');
  // |…| → abs(…), innermost pairs first; "ln|x|" keeps its function: log(abs(x)). An odd bar is left for the parser.
  for (let i = 0; i < 4 && /\|[^|]*\|/.test(s); i++) {
    s = s.replace(new RegExp(`\\b(${FUNCTIONS})\\s*\\|([^|]*)\\|`, 'g'), '$1(abs($2))').replace(/\|([^|]*)\|/g, 'abs($1)');
  }
  // a function applied without parentheses to one short argument, as written by hand: "sin x", "ln 2", "cos 2t"
  s = s.replace(new RegExp(`\\b(${FUNCTIONS})\\s+(\\d+(?:\\.\\d+)?[a-z]?|[a-z])(?![\\w(])`, 'g'), '$1($2)');
  // a space before "(" is a product, not a call: mathjs reads "e^x (x-1)" as e^(x(x-1)), a student means e^x·(x-1)
  s = s.replace(/([\w.)])\s+\(/g, (m, before: string, offset: number) => {
    const word = s.slice(0, offset + 1).match(/[a-z]+$/i)?.[0];
    return word && new RegExp(`^(${FUNCTIONS})$`).test(word) ? m : `${before}*(`;
  });
  // a name that is not a function, right before "(", is a product too: "n(n+1)(2n+1)" as printed in a formula, which
  // mathjs would otherwise read as a call of a function n and evaluate to nothing
  s = s.replace(/([a-z]+)\(/gi, (m, word: string) => (new RegExp(`^(${FUNCTIONS})$`).test(word) ? m : `${word}*(`));
  return s;
}

export type Compiled = { ok: true; f: (scope: Record<string, number>) => number } | { ok: false; error: string };

/** Parse a formula; unknown names are reported in Hebrew, by name. */
export function compileExpr(input: string, variables: string[], allowConstantC = false): Compiled {
  if (input.trim() === '') return { ok: false, error: 'כתבו נוסחה.' };
  let node: MathNode;
  try {
    node = parse(normalizeExpr(input));
  } catch {
    return { ok: false, error: 'לא הצלחנו לקרוא את הנוסחה. בדקו סוגריים וסימני כפל, למשל x^2*exp(x) או sin(2x)/2.' };
  }
  const allowed = new Set([...variables, ...CONSTANTS, ...(allowConstantC ? ['C', 'c'] : [])]);
  for (const n of node.filter((x) => x.type === 'SymbolNode')) {
    const name = (n as unknown as { name: string }).name;
    // a symbol in function position is a function name: mathjs checks it when evaluating
    const isFn = node.filter((x) => x.type === 'FunctionNode' && (x as unknown as { fn: MathNode }).fn === n).length > 0;
    if (!isFn && !allowed.has(name)) {
      return { ok: false, error: `הסימן ${name} לא מופיע בשאלה. אפשר להשתמש ב: ${variables.join(', ')}, וגם ב-pi וב-e.` };
    }
  }
  const code = node.compile();
  return {
    ok: true,
    f: (scope) => {
      try {
        const v = code.evaluate({ ...scope, C: 0, c: 0 });
        return typeof v === 'number' ? v : NaN;
      } catch {
        return NaN;
      }
    },
  };
}

/** A small seeded generator (mulberry32 over a string hash): the same question probes the same points. */
function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The test points: up to POINTS points of the box where the key is finite. */
export function samplePoints(key: (s: Record<string, number>) => number, spec: ExprSpec): Record<string, number>[] {
  const rand = rng(spec.seed);
  const [lo, hi] = spec.domain;
  const out: Record<string, number>[] = [];
  for (let tries = 0; tries < POINTS * 8 && out.length < POINTS; tries++) {
    const p = Object.fromEntries(spec.variables.map((v) => [v, lo + (hi - lo) * rand()]));
    if (Number.isFinite(key(p))) out.push(p);
  }
  return out;
}

/** True when `student` is the key's function on the box (up to a constant when the spec says so). */
export function sameFunction(student: string, key: string, spec: ExprSpec): boolean {
  const k = compileExpr(key, spec.variables);
  if (!k.ok) throw new Error(`the key ${key} does not parse: ${k.error}`);
  const s = compileExpr(student, spec.variables, spec.upToConstant);
  if (!s.ok) return false;
  const points = samplePoints(k.f, spec);
  if (points.length === 0) throw new Error(`the key ${key} is not finite anywhere on [${spec.domain}]`);
  let shift: number | null = null;
  for (const p of points) {
    const kv = k.f(p);
    const sv = s.f(p);
    if (!Number.isFinite(sv)) return false;
    const scale = Math.max(1, Math.abs(kv), Math.abs(sv));
    if (spec.upToConstant) {
      shift ??= sv - kv;
      if (Math.abs(sv - kv - shift) > TOL * scale) return false;
    } else if (Math.abs(sv - kv) > TOL * scale) return false;
  }
  return true;
}

/** A constant expression ("3π/2", "2√3", "ln 2", "e^2") as a number, or null. */
export function evalConstant(input: string): number | null {
  const c = compileExpr(input, []);
  if (!c.ok) return null;
  const v = c.f({});
  return Number.isFinite(v) ? v : null;
}
