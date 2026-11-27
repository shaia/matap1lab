/**
 * The derivative at a point for chapter 5 (DerivLab's core): a registry of functions with their EXACT derivatives, the
 * secant through two points of a graph, the tangent, and the linear approximation.
 *
 * MODEL SPECIFICATION
 * - System: a real function f of one variable from the registry `DFN`, evaluated in IEEE doubles; f(x) = NaN outside
 *   its domain. Each entry STORES, recomputed with sympy (2026-11-27): the closed-form derivative `df` (NaN where f is
 *   not differentiable or not defined), its domain as a union of intervals, and its kinks: the points of the domain
 *   where f is continuous but not differentiable, each a 'corner' (both one-sided slopes finite and different) or
 *   'vertical' (a one-sided slope is ±∞; NaN for a side outside the domain). Every verdict of the figure (tangent or
 *   not, corner, vertical tangent, "looks like a line") is read from these stored facts, never from the pixels or from
 *   the table.
 * - Secant (`diffQuotient`, `secantRows`): the difference quotient (f(x0 + h) − f(x0))/h for h ≠ 0 of either sign, the
 *   slope of the secant through P = (x0, f(x0)) and Q = (x0 + h, f(x0 + h)). It is a PROBE of the derivative: for a
 *   twice-differentiable f its error is O(h) (the central quotient's is O(h²)); in doubles, below |h| ~ 1e-8 rounding
 *   (~1e-16·|f|/|h|) dominates. The figure stops at |h| = 1e-4, where the rounding error is below 1e-11 for every
 *   entry. The table lists the quotient at h = ±1, ±10⁻¹, … down to the current |h| (one row per decade passed).
 * - Tangent (`tangentAt`): y = f(x0) + f′(x0)(x − x0) from the stored f′; null at a corner (no tangent) and outside
 *   the domain; `{ vertical: true }` at a vertical tangent.
 * - Linear approximation (`linearize`): at x = a + dx, the curve's value f(a + dx), the tangent's value
 *   L = f(a) + f′(a)dx, the true change Δy = f(a + dx) − f(a), the differential dy = f′(a)dx and the error Δy − dy. For a
 *   twice-differentiable f the error is O(dx²), so (Δy − dy)/dx → 0: that, not a fixed bound, is what the figure shows.
 * - Positions: P (and the point a) live on `x0Range`, a union of closed pieces inside the window and the domain; a
 *   position within `KINK_SNAP` of a kink snaps onto it, so "at the kink" means exactly at it.
 * - Ignored: nothing mathematical; floating-point rounding only.
 */

import { diffQuotient as dq, type Fn } from './analysis';

export type { Fn };

/** (f(x0 + h) − f(x0))/h, h ≠ 0 of either sign: the slope of the secant (re-exported from analysis.ts). */
export const diffQuotient = dq;

export type DId = 'x2' | 'x3' | 'recip' | 'sqrt' | 'abs' | 'cbrt' | 'kink' | 'glue' | 'sin' | 'exp' | 'cubic';
export const DIDS: DId[] = ['x2', 'x3', 'recip', 'sqrt', 'abs', 'cbrt', 'kink', 'glue', 'sin', 'exp', 'cubic'];
export const isDId = (s: unknown): s is DId => typeof s === 'string' && (DIDS as string[]).includes(s);

/** an interval of the domain; lo / hi may be ∓Infinity */
export interface Interval {
  lo: number;
  hi: number;
  loClosed: boolean;
  hiClosed: boolean;
}

export interface Kink {
  x: number;
  kind: 'corner' | 'vertical';
  /** the one-sided slopes: finite, ±Infinity (vertical), NaN for a side outside the domain */
  left: number;
  right: number;
}

export interface DSpec {
  id: DId;
  /** KaTeX of f(x) */
  tex: string;
  /** plain-text label for readouts */
  text: string;
  f: Fn;
  /** the exact closed-form derivative; NaN where f is not differentiable or not defined */
  df: Fn;
  dfTex: string;
  dfText: string;
  domain: Interval[];
  /** default x and y ranges of the graph */
  window: { x: [number, number]; y: [number, number] };
  kinks: Kink[];
  /** where P (or a) may stand: closed pieces inside the window and the domain */
  x0Range: [number, number][];
  /** the default position of P and of a */
  x0: number;
}

const ALL: Interval[] = [{ lo: -Infinity, hi: Infinity, loClosed: false, hiClosed: false }];
const cbrt = (x: number) => Math.cbrt(x);

export const DFN: Record<DId, DSpec> = {
  x2: {
    id: 'x2',
    tex: 'x^2',
    text: 'x²',
    f: (x) => x * x,
    df: (x) => 2 * x,
    dfTex: '2x',
    dfText: '2x',
    domain: ALL,
    window: { x: [-1, 5], y: [-3, 25] },
    kinks: [],
    x0Range: [[-0.8, 4.8]],
    x0: 3,
  },
  x3: {
    id: 'x3',
    tex: 'x^3',
    text: 'x³',
    f: (x) => x * x * x,
    df: (x) => 3 * x * x,
    dfTex: '3x^2',
    dfText: '3x²',
    domain: ALL,
    window: { x: [-2.5, 5.5], y: [-20, 170] },
    kinks: [],
    x0Range: [[-2.3, 5.3]],
    x0: 5,
  },
  recip: {
    id: 'recip',
    tex: '\\frac{1}{x}',
    text: '1/x',
    f: (x) => (x === 0 ? NaN : 1 / x),
    df: (x) => (x === 0 ? NaN : -1 / (x * x)),
    dfTex: '-\\frac{1}{x^2}',
    dfText: '−1/x²',
    domain: [
      { lo: -Infinity, hi: 0, loClosed: false, hiClosed: false },
      { lo: 0, hi: Infinity, loClosed: false, hiClosed: false },
    ],
    window: { x: [-4, 4], y: [-4, 4] },
    kinks: [],
    x0Range: [
      [-3.8, -0.25],
      [0.25, 3.8],
    ],
    x0: 1,
  },
  sqrt: {
    id: 'sqrt',
    tex: '\\sqrt{x}',
    text: '√x',
    f: (x) => (x < 0 ? NaN : Math.sqrt(x)),
    df: (x) => (x > 0 ? 1 / (2 * Math.sqrt(x)) : NaN),
    dfTex: '\\frac{1}{2\\sqrt{x}}',
    dfText: '1/(2√x)',
    domain: [{ lo: 0, hi: Infinity, loClosed: true, hiClosed: false }],
    window: { x: [-0.5, 4.5], y: [-0.6, 2.4] },
    kinks: [{ x: 0, kind: 'vertical', left: NaN, right: Infinity }],
    x0Range: [[0, 4.3]],
    x0: 1,
  },
  abs: {
    id: 'abs',
    tex: '|x|',
    text: '|x|',
    f: (x) => Math.abs(x),
    df: (x) => (x === 0 ? NaN : Math.sign(x)),
    dfTex: '\\begin{cases}-1 & x<0\\\\ 1 & x>0\\end{cases}',
    dfText: '−1 (x < 0), 1 (x > 0)',
    domain: ALL,
    window: { x: [-2, 2], y: [-0.8, 2] },
    kinks: [{ x: 0, kind: 'corner', left: -1, right: 1 }],
    x0Range: [[-1.8, 1.8]],
    x0: 0,
  },
  cbrt: {
    id: 'cbrt',
    tex: '\\sqrt[3]{x}',
    text: '∛x',
    f: cbrt,
    df: (x) => (x === 0 ? NaN : 1 / (3 * cbrt(x * x))),
    dfTex: '\\frac{1}{3\\sqrt[3]{x^2}}',
    dfText: '1/(3∛(x²))',
    domain: ALL,
    window: { x: [-2, 2], y: [-1.5, 1.5] },
    kinks: [{ x: 0, kind: 'vertical', left: Infinity, right: Infinity }],
    x0Range: [[-1.8, 1.8]],
    x0: 0,
  },
  kink: {
    id: 'kink',
    tex: '\\begin{cases}x^2 & x\\le 1\\\\ 2-x & x>1\\end{cases}',
    text: 'x² (x ≤ 1), 2 − x (x > 1)',
    f: (x) => (x <= 1 ? x * x : 2 - x),
    df: (x) => (x < 1 ? 2 * x : x > 1 ? -1 : NaN),
    dfTex: '\\begin{cases}2x & x<1\\\\ -1 & x>1\\end{cases}',
    dfText: '2x (x < 1), −1 (x > 1)',
    domain: ALL,
    window: { x: [-1, 3], y: [-1.5, 2.5] },
    kinks: [{ x: 1, kind: 'corner', left: 2, right: -1 }],
    x0Range: [[-0.8, 2.8]],
    x0: 1,
  },
  glue: {
    id: 'glue',
    tex: '\\begin{cases}x^2 & x\\le 1\\\\ 2x-1 & x>1\\end{cases}',
    text: 'x² (x ≤ 1), 2x − 1 (x > 1)',
    f: (x) => (x <= 1 ? x * x : 2 * x - 1),
    df: (x) => (x <= 1 ? 2 * x : 2),
    dfTex: '\\begin{cases}2x & x\\le 1\\\\ 2 & x>1\\end{cases}',
    dfText: '2x (x ≤ 1), 2 (x > 1)',
    domain: ALL,
    window: { x: [-1, 3], y: [-1, 5] },
    kinks: [],
    x0Range: [[-0.8, 2.8]],
    x0: 1,
  },
  sin: {
    id: 'sin',
    tex: '\\sin x',
    text: 'sin x',
    f: Math.sin,
    df: Math.cos,
    dfTex: '\\cos x',
    dfText: 'cos x',
    domain: ALL,
    window: { x: [-3.5, 6.5], y: [-2, 2] },
    kinks: [],
    x0Range: [[-3.3, 6.3]],
    x0: 0,
  },
  exp: {
    id: 'exp',
    tex: 'e^x',
    text: 'eˣ',
    f: Math.exp,
    df: Math.exp,
    dfTex: 'e^x',
    dfText: 'eˣ',
    domain: ALL,
    window: { x: [-3, 2], y: [-0.8, 7] },
    kinks: [],
    x0Range: [[-2.8, 1.9]],
    x0: 0,
  },
  cubic: {
    id: 'cubic',
    tex: 'x^3-3x',
    text: 'x³ − 3x',
    f: (x) => x * x * x - 3 * x,
    df: (x) => 3 * x * x - 3,
    dfTex: '3x^2-3',
    dfText: '3x² − 3',
    domain: ALL,
    window: { x: [-4.6, 3], y: [-60, 22] },
    kinks: [],
    x0Range: [[-4.4, 2.8]],
    x0: 2,
  },
};

/** a position within this distance of a kink snaps onto it */
export const KINK_SNAP = 0.05;
/** the smallest and largest |h| of the figure */
export const H_MIN = 1e-4;
export const H_MAX = 2;

export const inDomain = (id: DId, x: number): boolean =>
  DFN[id].domain.some((I) => (I.loClosed ? x >= I.lo : x > I.lo) && (I.hiClosed ? x <= I.hi : x < I.hi));

/** the kink of f at x (within tol), or null */
export function kinkAt(id: DId, x: number, tol = 1e-9): Kink | null {
  return DFN[id].kinks.find((k) => Math.abs(k.x - x) <= tol) ?? null;
}

/** f is differentiable at x: x is in the domain and the stored f′(x) is finite */
export const differentiableAt = (id: DId, x: number): boolean => inDomain(id, x) && Number.isFinite(DFN[id].df(x));

export type Tangent = { vertical: false; m: number; b: number } | { vertical: true; x: number };

/** The tangent at x0: {m, b} of y = m x + b; {vertical: true} at a vertical tangent; null at a corner or outside. */
export function tangentAt(id: DId, x0: number): Tangent | null {
  const s = DFN[id];
  if (!inDomain(id, x0)) return null;
  const k = kinkAt(id, x0);
  if (k) return k.kind === 'vertical' ? { vertical: true, x: x0 } : null;
  const m = s.df(x0);
  if (!Number.isFinite(m)) return null;
  return { vertical: false, m, b: s.f(x0) - m * x0 };
}

export interface Linearization {
  /** f(a + dx) */
  fx: number;
  /** L(a + dx) = f(a) + f′(a)dx */
  L: number;
  /** dy = f′(a)dx */
  dy: number;
  /** Δy = f(a + dx) − f(a) */
  Dy: number;
  /** Δy − dy */
  err: number;
}

/** The linear approximation at a, read at a + dx (NaN entries where f′(a) does not exist). */
export function linearize(id: DId, a: number, dx: number): Linearization {
  const s = DFN[id];
  const fa = s.f(a);
  const m = differentiableAt(id, a) ? s.df(a) : NaN;
  const fx = s.f(a + dx);
  const dy = m * dx;
  const Dy = fx - fa;
  return { fx, L: fa + dy, dy, Dy, err: Dy - dy };
}

/** decades 1, 10⁻¹, … that |h| has passed (|h| ≤ decade), down to H_MIN */
export function decadesPassed(absH: number): number[] {
  const out: number[] = [];
  for (let k = 0; k <= 4; k++) {
    const d = 10 ** -k;
    if (absH <= d * (1 + 1e-9)) out.push(d);
  }
  return out;
}

export interface SecantRow {
  h: number;
  /** the difference quotient; NaN when x0 + h is outside the domain */
  q: number;
}

/** One row per decade |h| has passed (with the sign of h), plus the current h when it is not a decade. */
export function secantRows(id: DId, x0: number, h: number): SecantRow[] {
  const sg = h < 0 ? -1 : 1;
  const ah = Math.abs(h);
  const decs = decadesPassed(ah);
  const hs = decs.map((d) => sg * d);
  if (!decs.some((d) => Math.abs(d - ah) <= d * 1e-9)) hs.push(h);
  const f = DFN[id].f;
  return hs.map((hh) => ({ h: hh, q: inDomain(id, x0) && inDomain(id, x0 + hh) ? diffQuotient(f, x0, hh) : NaN }));
}

/** The secant slope at (x0, h), NaN when P or Q is outside the domain. */
export const quotientAt = (id: DId, x0: number, h: number): number =>
  inDomain(id, x0) && inDomain(id, x0 + h) && h !== 0 ? diffQuotient(DFN[id].f, x0, h) : NaN;

const round2 = (x: number) => Number((Math.round(x * 100) / 100).toPrecision(12));

/**
 * A position for P or a: moved into `x0Range`, snapped onto a kink within KINK_SNAP, and (for the learner's drags and
 * sliders, `round`) rounded to 0.01. A step's or a prop's value is not rounded (x0 = π/2 stays exact).
 */
export function snapX0(id: DId, x: number, round = true): number {
  const s = DFN[id];
  for (const k of s.kinks) if (Math.abs(x - k.x) <= KINK_SNAP) return k.x;
  let best = x;
  let dist = Infinity;
  for (const [lo, hi] of s.x0Range) {
    const c = Math.min(hi, Math.max(lo, x));
    const d = Math.abs(c - x);
    if (d < dist) [best, dist] = [c, d];
  }
  if (!round) return best;
  const r = round2(best);
  // rounding must not leave the piece (a piece end such as 0.25 is a multiple of 0.01, so it stays inside)
  return s.x0Range.some(([lo, hi]) => r >= lo - 1e-12 && r <= hi + 1e-12) ? r : best;
}

/** |h| clamped into [H_MIN, H_MAX], the sign kept (h = 0 becomes +H_MIN). */
export function clampH(h: number): number {
  const sg = h < 0 ? -1 : 1;
  return sg * Math.min(H_MAX, Math.max(H_MIN, Math.abs(h)));
}
