/**
 * A function and its derivative, one above the other (chapter 5.1 and 5.5; SlopeGraph's core).
 *
 * MODEL SPECIFICATION
 * - System: a real function f of one variable on a closed interval [lo, hi] (its domain here), given by a preset
 *   formula (`SLOPE`), with its derivative f′ given in CLOSED FORM (`df`), both evaluated in IEEE doubles. Motion
 *   presets read f as a position x(t) (or a height h(t)) and f′ as the velocity v(t), in SI units (m, s, m/s).
 * - Stored facts, recomputed with sympy (2026-11-27): f′ (factored); the critical points of f, as lesson 5.5 defines
 *   them: the INTERIOR points of the domain (lo < c < hi) where f′ = 0 or f′ does not exist (no preset has a point
 *   where f′ is undefined); the value of f there; and the kind of each: `max` or `min` (local) when f′ changes sign
 *   there, `none` when f′ keeps its sign on both sides (x³ at 0, the quartic at 1). An END of the domain is never a
 *   critical point: the ends where f′ = 0 anyway are stored apart as `flatEnds` (box at 6, fall at 0), so that the
 *   figure can mark them as ends ("קצה התחום") and the motion presets can say the body is at rest there. Nothing is
 *   inferred from pixels or from a grid: the figure's verdicts read these stored facts.
 * - Monotone pieces (`pieces`): [lo, hi] cut at the critical points; on each piece f′ has one strict sign (f′ ≠ 0
 *   inside it), so f is strictly increasing (sign +1) or decreasing (−1) there. That step is the mean value theorem,
 *   which the course states and uses without proof. Neighbouring pieces with the same sign are merged (a critical
 *   point of kind `none` does not cut the graph).
 * - Global extrema on [a, b] ⊆ [lo, hi] (`globalExtrema`): f is continuous on [a, b], so the extreme-value theorem
 *   (4.6) gives a largest and a smallest value; f is differentiable inside, so they are attained among a, b and the
 *   critical points strictly inside (a < c < b). The candidates are compared exactly as stored numbers; ties (within a
 *   relative 1e-12, rounding only) are reported as several points. This is exact for the presets, not a search.
 * - "Only at an end" (`extremumOnlyAtEnd`): some critical point lies strictly inside (a, b), and the largest or the
 *   smallest value of f on [a, b] is attained at an end only, at no interior critical point (cubic on [0, 3]: the
 *   max 18 at 3, while the interior critical point 1 gives the min −2).
 * - Boundary: arguments outside [lo, hi] are clamped by the callers (the figure); f is a polynomial on all of ℝ.
 * - Ignored: nothing mathematical; floating-point rounding only (the stored critical points are integers and the
 *   formulas evaluate exactly there).
 */

export type Fn = (x: number) => number;

export type SlopeId = 'ball' | 'back-forth' | 'fall' | 'cubic' | 'x3' | 'quartic' | 'box';
export type CritKind = 'max' | 'min' | 'none';

export interface CritPoint {
  /** the exact point */
  x: number;
  /** f there, exact */
  value: number;
  /** f there as written (an exact fraction where needed) */
  valueText: string;
  kind: CritKind;
}

/** an end of the domain where f′ = 0: not a critical point (5.5 defines those as interior points) */
export interface FlatEnd {
  x: number;
  value: number;
  valueText: string;
}

/** names and units of a motion preset: time, position, velocity (Hebrew unit abbreviations) */
export interface MotionVars {
  t: string;
  x: string;
  v: string;
  unitT: string;
  unitX: string;
  unitV: string;
}

export interface SlopeSpec {
  id: SlopeId;
  /** the variable of f: 't' for the motion presets, 'x' otherwise */
  arg: string;
  /** the name of f: 'h', 'x', 'f' or 'V' */
  name: string;
  /** KaTeX labels of f and f′ */
  tex: string;
  dfTex: string;
  /** plain-text right-hand sides of f and f′ for readouts */
  text: string;
  dfText: string;
  f: Fn;
  /** f′ in closed form (exact formula, not a difference quotient) */
  df: Fn;
  /** the domain [lo, hi]: the horizontal range of both panels */
  domain: [number, number];
  /** vertical ranges of the f panel and of the f′ panel */
  yf: [number, number];
  ydf: [number, number];
  /** every critical point, all strictly inside (lo, hi), increasing */
  crit: CritPoint[];
  /** the ends of [lo, hi] where f′ = 0 (not critical points) */
  flatEnds: FlatEnd[];
  /** default cursor and default closed interval */
  start: number;
  interval: [number, number];
  /** motion presets only */
  motion?: MotionVars;
}

const SEC = 'ש׳';
const MET = 'מ׳';
const MPS = 'מ׳/ש׳';
const vars = (x: string): MotionVars => ({ t: 't', x, v: 'v', unitT: SEC, unitX: MET, unitV: MPS });

export const SLOPE: Record<SlopeId, SlopeSpec> = {
  ball: {
    id: 'ball',
    arg: 't',
    name: 'h',
    tex: '20t-5t^2',
    dfTex: '20-10t',
    text: '20t − 5t²',
    dfText: '20 − 10t',
    f: (t) => 20 * t - 5 * t * t,
    df: (t) => 20 - 10 * t,
    domain: [0, 4],
    yf: [-2, 24],
    ydf: [-24, 24],
    crit: [{ x: 2, value: 20, valueText: '20', kind: 'max' }],
    flatEnds: [],
    start: 0.5,
    interval: [0, 4],
    motion: vars('h'),
  },
  'back-forth': {
    id: 'back-forth',
    arg: 't',
    name: 'x',
    tex: 't^3-6t^2+9t',
    dfTex: '3(t-1)(t-3)',
    text: 't³ − 6t² + 9t',
    dfText: '3(t − 1)(t − 3)',
    f: (t) => t * t * t - 6 * t * t + 9 * t,
    df: (t) => 3 * (t - 1) * (t - 3),
    domain: [0, 4],
    yf: [-1, 5],
    ydf: [-5, 10],
    crit: [
      { x: 1, value: 4, valueText: '4', kind: 'max' },
      { x: 3, value: 0, valueText: '0', kind: 'min' },
    ],
    flatEnds: [],
    start: 0.5,
    interval: [0, 4],
    motion: vars('x'),
  },
  fall: {
    id: 'fall',
    arg: 't',
    name: 'x',
    tex: '5t^2',
    dfTex: '10t',
    text: '5t²',
    dfText: '10t',
    f: (t) => 5 * t * t,
    df: (t) => 10 * t,
    domain: [0, 3],
    yf: [-3, 48],
    ydf: [-3, 33],
    crit: [],
    flatEnds: [{ x: 0, value: 0, valueText: '0' }],
    start: 1,
    interval: [0, 3],
    motion: vars('x'),
  },
  cubic: {
    id: 'cubic',
    arg: 'x',
    name: 'f',
    tex: 'x^3-3x',
    dfTex: '3x^2-3',
    text: 'x³ − 3x',
    dfText: '3x² − 3',
    f: (x) => x * x * x - 3 * x,
    df: (x) => 3 * x * x - 3,
    domain: [-2.2, 3],
    yf: [-6, 20],
    ydf: [-5, 26],
    crit: [
      { x: -1, value: 2, valueText: '2', kind: 'max' },
      { x: 1, value: -2, valueText: '−2', kind: 'min' },
    ],
    flatEnds: [],
    start: 0,
    interval: [-2, 2],
  },
  x3: {
    id: 'x3',
    arg: 'x',
    name: 'f',
    tex: 'x^3',
    dfTex: '3x^2',
    text: 'x³',
    dfText: '3x²',
    f: (x) => x * x * x,
    df: (x) => 3 * x * x,
    domain: [-1.8, 1.8],
    yf: [-6.5, 6.5],
    ydf: [-1.5, 11],
    crit: [{ x: 0, value: 0, valueText: '0', kind: 'none' }],
    flatEnds: [],
    start: 1,
    interval: [-1.5, 1.5],
  },
  quartic: {
    id: 'quartic',
    arg: 'x',
    name: 'f',
    tex: '\\frac{x^4}{4}-\\frac{3x^2}{2}+2x',
    dfTex: '(x-1)^2(x+2)',
    text: 'x⁴/4 − 3x²/2 + 2x',
    dfText: '(x − 1)²(x + 2)',
    f: (x) => (x * x * x * x) / 4 - (3 * x * x) / 2 + 2 * x,
    df: (x) => (x - 1) * (x - 1) * (x + 2),
    domain: [-3, 2.2],
    yf: [-7, 4],
    ydf: [-17, 8],
    crit: [
      { x: -2, value: -6, valueText: '−6', kind: 'min' },
      { x: 1, value: 0.75, valueText: '3/4', kind: 'none' },
    ],
    flatEnds: [],
    start: 0,
    interval: [-3, 2],
  },
  box: {
    id: 'box',
    arg: 'x',
    name: 'V',
    tex: 'x(12-2x)^2',
    dfTex: '(12-2x)(12-6x)',
    text: 'x(12 − 2x)²',
    dfText: '(12 − 2x)(12 − 6x)',
    f: (x) => x * (12 - 2 * x) * (12 - 2 * x),
    df: (x) => (12 - 2 * x) * (12 - 6 * x),
    domain: [0, 6],
    yf: [-8, 140],
    ydf: [-60, 150],
    crit: [{ x: 2, value: 128, valueText: '128', kind: 'max' }],
    flatEnds: [{ x: 6, value: 0, valueText: '0' }],
    start: 1,
    interval: [0, 6],
  },
};

export const SLOPE_IDS = Object.keys(SLOPE) as SlopeId[];
export const MOTION_IDS = SLOPE_IDS.filter((id) => SLOPE[id].motion !== undefined);
export const isSlopeId = (s: unknown): s is SlopeId => typeof s === 'string' && s in SLOPE;
export const isMotionId = (s: unknown): s is SlopeId => isSlopeId(s) && SLOPE[s].motion !== undefined;

/** the stored critical point at x (exactly: the cursor lands on the integers by its 0.01 steps), else null */
export function critAt(id: SlopeId, x: number): CritPoint | null {
  return SLOPE[id].crit.find((c) => Math.abs(c.x - x) < 1e-9) ?? null;
}

/** the stored critical point nearest to x within tol (and of the given kinds), else null */
export function critNear(id: SlopeId, x: number, tol: number, kinds: CritKind[] = ['max', 'min', 'none']): CritPoint | null {
  let best: CritPoint | null = null;
  for (const c of SLOPE[id].crit) {
    if (!kinds.includes(c.kind)) continue;
    const d = Math.abs(c.x - x);
    if (d <= tol + 1e-12 && (best === null || d < Math.abs(best.x - x))) best = c;
  }
  return best;
}

/** the stored end of the domain with f′ = 0 at x (exactly), else null */
export function flatEndAt(id: SlopeId, x: number): FlatEnd | null {
  return SLOPE[id].flatEnds.find((e) => Math.abs(e.x - x) < 1e-9) ?? null;
}

/** a point where f′ = 0 within tol of x, critical or an end (a motion preset is at rest there), else null */
export function restNear(id: SlopeId, x: number, tol: number): number | null {
  const c = critNear(id, x, tol);
  if (c) return c.x;
  const e = SLOPE[id].flatEnds.find((q) => Math.abs(q.x - x) <= tol + 1e-12);
  return e ? e.x : null;
}

/**
 * f increases (f′ > 0), decreases (f′ < 0), x is a critical point (interior, f′ = 0), or x is an end of the domain
 * where f′ = 0 ('end': not a critical point)
 */
export function trendAt(id: SlopeId, x: number): 'up' | 'down' | 'crit' | 'end' {
  if (critAt(id, x)) return 'crit';
  if (flatEndAt(id, x)) return 'end';
  const d = SLOPE[id].df(x);
  return d > 0 ? 'up' : d < 0 ? 'down' : 'crit';
}

/** the tangent at x0: y = f(x0) + m(x − x0) */
export function tangentAt(id: SlopeId, x0: number): { m: number; y0: number; at: (x: number) => number } {
  const s = SLOPE[id];
  const m = s.df(x0);
  const y0 = s.f(x0);
  return { m, y0, at: (x) => y0 + m * (x - x0) };
}

export interface Piece {
  lo: number;
  hi: number;
  /** +1: f′ > 0 inside (f increases), −1: f′ < 0 inside (f decreases) */
  sign: 1 | -1;
}

/** the monotone pieces of f on its domain: cut at the critical points, same-sign neighbours merged */
export function pieces(id: SlopeId): Piece[] {
  const s = SLOPE[id];
  const [lo, hi] = s.domain;
  const cuts = [lo, ...s.crit.map((c) => c.x).filter((x) => x > lo && x < hi), hi];
  const out: Piece[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const a = cuts[i];
    const b = cuts[i + 1];
    const sign: 1 | -1 = s.df((a + b) / 2) > 0 ? 1 : -1;
    const last = out[out.length - 1];
    if (last && last.sign === sign) last.hi = b;
    else out.push({ lo: a, hi: b, sign });
  }
  return out;
}

export interface GlobalExtreme {
  value: number;
  /** every point of [a, b] where it is attained (increasing) */
  at: number[];
  /** attained at a or b only, at no interior critical point */
  endOnly: boolean;
}

/** the critical points strictly inside (a, b) */
export const interiorCrit = (id: SlopeId, a: number, b: number): CritPoint[] => SLOPE[id].crit.filter((c) => c.x > a && c.x < b);

const tie = (u: number, v: number) => Math.abs(u - v) <= 1e-12 * Math.max(1, Math.abs(u), Math.abs(v));

/** the largest and smallest values of f on [a, b] (a < b, inside the domain): among a, b and the interior critical points */
export function globalExtrema(id: SlopeId, a: number, b: number): { max: GlobalExtreme; min: GlobalExtreme } {
  const s = SLOPE[id];
  const cands: { x: number; v: number; end: boolean }[] = [
    { x: a, v: s.f(a), end: true },
    ...interiorCrit(id, a, b).map((c) => ({ x: c.x, v: c.value, end: false })),
    { x: b, v: s.f(b), end: true },
  ];
  const pick = (better: (u: number, v: number) => boolean): GlobalExtreme => {
    let best = cands[0].v;
    for (const c of cands) if (better(c.v, best)) best = c.v;
    const hits = cands.filter((c) => tie(c.v, best));
    return { value: best, at: hits.map((c) => c.x), endOnly: hits.every((c) => c.end) };
  };
  return { max: pick((u, v) => u > v), min: pick((u, v) => u < v) };
}

/** an interior critical point exists, and the max or the min on [a, b] is attained only at an end */
export function extremumOnlyAtEnd(id: SlopeId, a: number, b: number): boolean {
  if (interiorCrit(id, a, b).length === 0) return false;
  const g = globalExtrema(id, a, b);
  return g.max.endOnly || g.min.endOnly;
}

/** the distance travelled on [a, b] (motion presets): the sum of |Δx| over the monotone pieces, exact */
export function pathLength(id: SlopeId, a: number, b: number): number {
  const s = SLOPE[id];
  const cuts = [a, ...s.crit.map((c) => c.x).filter((x) => x > a && x < b), b];
  let d = 0;
  for (let i = 0; i + 1 < cuts.length; i++) d += Math.abs(s.f(cuts[i + 1]) - s.f(cuts[i]));
  return d;
}
