/**
 * MODEL SPECIFICATION
 *
 * System:        Riemann sums of a real function f on [a, b] cut into n equal pieces, sampled at the left end, the right
 *                end or the middle of each piece (registry RS), the definite integral as their limit, signed area and
 *                geometric area; a velocity v(t) on [0, T] with the displacement ∫₀ᵗ v and the distance ∫₀ᵗ |v| (registry
 *                MO); two properties of the integral: additivity over intervals for any order of a, b, c and comparison
 *                f ≤ g ⇒ ∫f ≤ ∫g (registry PR). Chapter 8.1. The core of RiemannLab. Evaluated in IEEE double precision.
 * Dynamics:      none.
 * Boundary:      every closed form below (the antiderivatives F and X, the exact integrals, the zeros, the distances,
 *                ∫₀ᶜ sin = 1 − cos c, arctan 2) was recomputed with sympy on 2026-11-27 (screens/tools/cas.py; the brief's
 *                table in screens/tools/ch8_presets.py). Every exact value a readout shows is F(b) − F(a) of a STORED
 *                antiderivative, split at the STORED zeros of f (where f changes sign) for the areas above and below the
 *                axis and for the distance. A Riemann sum is a finite sum, computed term by term (no closed form is
 *                claimed for it). ∫₀² e^(−x²) dx has no antiderivative in the table: its value 0.882081390762422 is
 *                stored from sympy (√π·erf(2)/2) and the tests check it against composite Simpson; the figure labels it
 *                "חישוב נומרי".
 *                `zeros` are sign changes only. 1 + sin t touches 0 at t = 3π/2 without changing sign: that point is
 *                listed under `touches` (the body stops for an instant and goes on forward), never under `zeros`.
 * Ignored:       exact arithmetic; unequal partitions (the course uses equal pieces Δx = (b − a)/n); f off its window.
 * Valid when:    n is a positive integer; t in [0, T]; c in the PR range.
 * Failure modes: none on the stored ranges (every f is continuous on its [a, b]). For large n a sum carries rounding of
 *                order n·ε·max|f|·(b − a), far below what the figure shows (n ≤ 64).
 */

export type Fn = (x: number) => number;
export type RsRule = 'left' | 'right' | 'mid';
export const RS_RULES: readonly RsRule[] = ['left', 'right', 'mid'];
export const isRsRule = (s: unknown): s is RsRule => s === 'left' || s === 'right' || s === 'mid';

const PI = Math.PI;

/** one rectangle of a Riemann sum: the piece [x0, x1], its sample point xs and its height h = f(xs) (signed) */
export interface Rect {
  x0: number;
  x1: number;
  xs: number;
  h: number;
}

/* ------------------------------------------------------------------ generic sums and areas */

/** the sample point of the piece [x0, x1] for a rule */
export const sampleX = (x0: number, x1: number, rule: RsRule): number => (rule === 'left' ? x0 : rule === 'right' ? x1 : (x0 + x1) / 2);

/** the Riemann sum of f on [a, b] with n equal pieces, term by term; the piece ends are a + iΔx (no accumulated drift) */
export function riemannSumOf(f: Fn, a: number, b: number, n: number, rule: RsRule): { sum: number; dx: number; rects: Rect[] } {
  const m = Math.max(1, Math.round(n));
  const dx = (b - a) / m;
  const rects: Rect[] = [];
  let sum = 0;
  for (let i = 0; i < m; i++) {
    const x0 = a + i * dx;
    const x1 = i === m - 1 ? b : a + (i + 1) * dx;
    const xs = sampleX(x0, x1, rule);
    const h = f(xs);
    rects.push({ x0, x1, xs, h });
    sum += h * dx;
  }
  return { sum, dx, rects };
}

/** the zeros strictly inside (lo, hi) */
const inside = (zeros: readonly number[], lo: number, hi: number) => zeros.filter((z) => z > lo + 1e-12 && z < hi - 1e-12);

/**
 * The areas above and below the axis between lo and hi (lo ≤ hi), exactly from an antiderivative F and the zeros of f
 * (where f changes sign): on each piece between zeros f keeps one sign, so F(hi) − F(lo) there is ± the area.
 */
export function posNegOf(F: Fn, lo: number, hi: number, zeros: readonly number[]): { pos: number; neg: number } {
  if (!(hi > lo)) return { pos: 0, neg: 0 };
  const cuts = [lo, ...inside(zeros, lo, hi), hi];
  let pos = 0;
  let neg = 0;
  for (let i = 0; i + 1 < cuts.length; i++) {
    const d = F(cuts[i + 1]) - F(cuts[i]);
    if (d >= 0) pos += d;
    else neg -= d;
  }
  return { pos, neg };
}

/* ------------------------------------------------------------------ RS: the functions of the sum mode */

export interface RsSpec {
  id: RsId;
  tex: string;
  /** plain label for readouts and the select */
  text: string;
  /** the integral in plain text, e.g. "∫₀² x² dx" */
  itext: string;
  f: Fn;
  /** a closed-form antiderivative */
  F: Fn;
  Ftext: string;
  a: number;
  b: number;
  aText: string;
  bText: string;
  /** the exact value of ∫ₐᵇ f as text ("8/3", "e − 1") */
  exactText: string;
  /** where f changes sign inside (a, b) */
  zeros: readonly number[];
  /** f increasing / decreasing on [a, b], or neither */
  monotone: 'inc' | 'dec' | null;
  window: { x: readonly [number, number]; y: readonly [number, number] };
}

export const RS_IDS = ['sq', 'sin', 'cos', 'recip', 'exp'] as const;
export type RsId = (typeof RS_IDS)[number];
export const isRsId = (s: unknown): s is RsId => typeof s === 'string' && (RS_IDS as readonly string[]).includes(s);

export const RS: Record<RsId, RsSpec> = {
  sq: {
    id: 'sq',
    tex: 'x^2',
    text: 'x²',
    itext: '∫₀² x² dx',
    f: (x) => x * x,
    F: (x) => (x * x * x) / 3,
    Ftext: 'x³/3',
    a: 0,
    b: 2,
    aText: '0',
    bText: '2',
    exactText: '8/3',
    zeros: [],
    monotone: 'inc',
    window: { x: [-0.25, 2.25], y: [-0.6, 4.6] },
  },
  sin: {
    id: 'sin',
    tex: '\\sin x',
    text: 'sin x',
    itext: '∫₀^π sin x dx',
    f: Math.sin,
    F: (x) => -Math.cos(x),
    Ftext: '−cos x',
    a: 0,
    b: PI,
    aText: '0',
    bText: 'π',
    exactText: '2',
    zeros: [],
    monotone: null,
    window: { x: [-0.3, PI + 0.3], y: [-0.45, 1.3] },
  },
  cos: {
    id: 'cos',
    tex: '\\cos x',
    text: 'cos x',
    itext: '∫₀^(3π/2) cos x dx',
    f: Math.cos,
    F: Math.sin,
    Ftext: 'sin x',
    a: 0,
    b: (3 * PI) / 2,
    aText: '0',
    bText: '3π/2',
    exactText: '−1',
    zeros: [PI / 2],
    monotone: null,
    window: { x: [-0.3, (3 * PI) / 2 + 0.3], y: [-1.3, 1.3] },
  },
  recip: {
    id: 'recip',
    tex: '\\frac{1}{x}',
    text: '1/x',
    itext: '∫₁ᵉ dx/x',
    f: (x) => 1 / x,
    F: Math.log,
    Ftext: 'ln x',
    a: 1,
    b: Math.E,
    aText: '1',
    bText: 'e',
    exactText: '1',
    zeros: [],
    monotone: 'dec',
    window: { x: [0.6, 3.0], y: [-0.15, 1.25] },
  },
  exp: {
    id: 'exp',
    tex: 'e^x',
    text: 'eˣ',
    itext: '∫₀¹ eˣ dx',
    f: Math.exp,
    F: Math.exp,
    Ftext: 'eˣ',
    a: 0,
    b: 1,
    aText: '0',
    bText: '1',
    exactText: 'e − 1',
    zeros: [],
    monotone: 'inc',
    window: { x: [-0.15, 1.15], y: [-0.3, 3.0] },
  },
};

/** the Riemann sum of a preset with n equal pieces */
export const riemannSum = (id: RsId, n: number, rule: RsRule) => riemannSumOf(RS[id].f, RS[id].a, RS[id].b, n, rule);

/** ∫ₐᵇ f exactly: F(b) − F(a) of the stored antiderivative */
export const exact = (id: RsId): number => RS[id].F(RS[id].b) - RS[id].F(RS[id].a);

/** the areas above and below the axis over [a, b], exact from F and the zeros: exact = pos − neg, ∫|f| = pos + neg */
export const posNeg = (id: RsId) => posNegOf(RS[id].F, RS[id].a, RS[id].b, RS[id].zeros);

/** the sum of the rectangles above the axis and the sum of the (absolute) rectangles below it: S = up − down */
export function rectParts(rects: readonly Rect[]): { up: number; down: number; negCount: number } {
  let up = 0;
  let down = 0;
  let negCount = 0;
  for (const r of rects) {
    const s = r.h * (r.x1 - r.x0);
    if (r.h >= 0) up += s;
    else {
      down -= s;
      negCount++;
    }
  }
  return { up, down, negCount };
}

/* ------------------------------------------------------------------ MO: velocities of the motion mode */

export interface MoSpec {
  id: MoId;
  tex: string;
  /** "2 − t" */
  text: string;
  v: Fn;
  /** an antiderivative of v (closed form): the position is X(t) − X(0) */
  X: Fn;
  Xtext: string;
  T: number;
  Ttext: string;
  /** where v changes sign inside (0, T): the body turns back */
  zeros: readonly number[];
  /** where v touches 0 without changing sign: the body stops for an instant and goes on */
  touches: readonly number[];
  /** the default t of the figure */
  t0: number;
  window: { v: readonly [number, number]; x: readonly [number, number] };
}

export const MO_IDS = ['reverse', 'swing', 'forward'] as const;
export type MoId = (typeof MO_IDS)[number];
export const isMoId = (s: unknown): s is MoId => typeof s === 'string' && (MO_IDS as readonly string[]).includes(s);

export const MO: Record<MoId, MoSpec> = {
  reverse: {
    id: 'reverse',
    tex: '2-t',
    text: '2 − t',
    v: (t) => 2 - t,
    X: (t) => 2 * t - (t * t) / 2,
    Xtext: '2t − t²/2',
    T: 4,
    Ttext: '4',
    zeros: [2],
    touches: [],
    t0: 1.2,
    window: { v: [-2.4, 2.4], x: [-0.5, 4.5] },
  },
  swing: {
    id: 'swing',
    tex: '\\sin t',
    text: 'sin t',
    v: Math.sin,
    X: (t) => -Math.cos(t),
    Xtext: '−cos t',
    T: 2 * PI,
    Ttext: '2π',
    zeros: [PI],
    touches: [],
    t0: 1.5,
    window: { v: [-1.3, 1.3], x: [-0.5, 4.5] },
  },
  forward: {
    id: 'forward',
    tex: '1+\\sin t',
    text: '1 + sin t',
    v: (t) => 1 + Math.sin(t),
    X: (t) => t - Math.cos(t),
    Xtext: 't − cos t',
    T: 2 * PI,
    Ttext: '2π',
    zeros: [],
    touches: [(3 * PI) / 2],
    t0: 1.5,
    window: { v: [-0.4, 2.3], x: [-0.6, 6.9] },
  },
};

/** the displacement ∫₀ᵗ v = X(t) − X(0), exact */
export const displacement = (id: MoId, t: number): number => MO[id].X(t) - MO[id].X(0);

/** the distance ∫₀ᵗ |v|, exact: |X(hi) − X(lo)| summed over the pieces of [0, t] between the zeros of v */
export function distance(id: MoId, t: number): number {
  const { pos, neg } = posNegOf(MO[id].X, 0, t, MO[id].zeros);
  return pos + neg;
}

/** the sign-change zero of v nearest to t, with its distance */
export function nearestTurn(id: MoId, t: number): { z: number; d: number } | null {
  let best: { z: number; d: number } | null = null;
  for (const z of MO[id].zeros) if (!best || Math.abs(t - z) < best.d) best = { z, d: Math.abs(t - z) };
  return best;
}

/* ------------------------------------------------------------------ PR: the properties mode */

export const PR_IDS = ['add', 'cmp'] as const;
export type PrId = (typeof PR_IDS)[number];
export const isPrId = (s: unknown): s is PrId => typeof s === 'string' && (PR_IDS as readonly string[]).includes(s);

/** additivity: f = sin x on [a, b] = [0, π], a point c anywhere in [−1, 4.5] */
export const ADD = {
  id: 'add' as const,
  text: 'sin x, [0, π]: ∫ₐᶜ + ∫ᶜᵇ',
  f: Math.sin as Fn,
  F: ((x: number) => -Math.cos(x)) as Fn,
  a: 0,
  b: PI,
  aText: '0',
  bText: 'π',
  /** where sin changes sign in the window */
  zeros: [0, PI] as readonly number[],
  c: [-1, 4.5] as const,
  c0: 2,
  window: { x: [-1.3, 4.8] as const, y: [-1.3, 1.3] as const },
};

/** comparison: f = e^(−x²) ≤ g = 1/(1 + x²) on [0, 2] (because e^(x²) ≥ 1 + x²) */
export const CMP = {
  id: 'cmp' as const,
  text: 'e^(−x²) ≤ 1/(1 + x²)',
  f: ((x: number) => Math.exp(-x * x)) as Fn,
  g: ((x: number) => 1 / (1 + x * x)) as Fn,
  G: Math.atan as Fn,
  a: 0,
  b: 2,
  /** ∫₀² g = arctan 2, exact */
  gInt: Math.atan(2),
  gIntText: 'arctan 2',
  /** ∫₀² e^(−x²) dx = √π·erf(2)/2 (sympy), STORED: no antiderivative in the table; checked against Simpson in the tests */
  fInt: 0.882081390762422,
  window: { x: [-0.15, 2.2] as const, y: [-0.12, 1.2] as const },
};

export const PR = { add: ADD, cmp: CMP } as const;

/** additivity with numbers: ∫ₐᶜ, ∫ᶜᵇ and ∫ₐᵇ of sin, exact (1 − cos c, 1 + cos c, 2), for any order of a, b, c */
export function addParts(c: number): { ac: number; cb: number; ab: number } {
  const { F, a, b } = ADD;
  return { ac: F(c) - F(a), cb: F(b) - F(c), ab: F(b) - F(a) };
}
