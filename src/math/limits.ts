/**
 * Limits, continuity, the intermediate value theorem and extreme values for chapter 4 (LimitLab's core).
 *
 * MODEL SPECIFICATION
 * - System: a real function f of one variable given by a preset formula (`APPROACH`, `IVT`, `EXTREME`), evaluated in
 *   IEEE doubles; f(x) = NaN where the formula is undefined.
 * - Approach (`APPROACH`): a preset function and a point a. Each preset STORES its facts, recomputed with sympy
 *   (2026-11-26): the one-sided limits (finite value, ±∞, or none), f(a) (a number or null = undefined), and the
 *   classification `verdict`: continuous (limit = f(a)), removable (limit exists, f(a) undefined or different), jump
 *   (both one-sided limits finite and different), infinite (a one-sided limit is ±∞), none (a one-sided limit does not
 *   exist and is not ±∞). The verdict is never inferred from the table.
 * - Table (`approachRows`): f(a − h) and f(a + h) for h = 1, 10⁻¹, …, 10⁻⁶. The formulas are evaluated as written
 *   (no algebraic cancellation of the factor that vanishes at a): the removable presets then cancel digits, and the
 *   absolute error stays below 10⁻⁹ at h = 10⁻⁶ (the numerator error ~10⁻¹⁶ is divided by a denominator ~10⁻⁶).
 *   Below h ~ 10⁻⁸ the table would lose digits; the figure stops at 10⁻⁶.
 * - sin(1/x): `sinRecipScale(h)` samples sin(1/x) on (0, h]; for every h it takes values close to both +1 and −1
 *   (1/x runs through a full period 2π beyond 1/h). A table of values cannot show that: the table at x = 10⁻ᵏ is a
 *   probe of a few points.
 * - Intermediate value theorem (`IVT`): a preset f, an interval [a, b] and a level k. `bisectStep` halves the interval
 *   and keeps the half whose ends have f − k of opposite signs (or zero): the interval then still brackets a point c
 *   with f(c) = k when f is continuous on it, and its length halves at every step. At a midpoint where f is undefined
 *   (the pole of 1/x) the interval collapses to that point (`collapsed`); a continuous f never does that. For 1/x on
 *   [−1, 0.8] f − 0 changes sign, but the halves close in on the pole 0, where f is undefined: the sign change came
 *   from a discontinuity, not a root, so continuity is a hypothesis of the theorem, not a decoration.
 * - Level points (`levelPoints`): the points of [a, b] with f(c) = k, found on a grid of 4001 points and refined by
 *   bisection: a probe (it can miss a pair of roots closer than the grid step). For 1/x it is exact, c = 1/k.
 * - Extremes (`extremes`): a preset f on an interval with ends each closed or open. Candidates are the two ends and the
 *   interior critical points of the preset (listed per preset, exact). The supremum is the largest candidate value
 *   (an open end contributes its limiting value, possibly ±∞), and it is ATTAINED iff some included point (a closed
 *   end, or an interior critical point) has that value; likewise the infimum. This is exact for the presets (each is
 *   continuous with the listed critical points on its interval); it is not a numerical search.
 * - Boundary: an end of 1/x at 0 is excluded from the interval (f(0) is undefined) and contributes +∞.
 * - Ignored: nothing mathematical; floating-point rounding only.
 */

import { relativeError } from './analysis';

export type Fn = (x: number) => number;

/* ---------- approach presets ---------- */

export type ApproachId = 'removable-p3' | 'removable-p4' | 'sinc' | 'jump-p6' | 'sign' | 'recip' | 'recip2' | 'sin-recip' | 'cont';
export type Verdict = 'continuous' | 'removable' | 'jump' | 'infinite' | 'none';
export type OneSided = { kind: 'finite'; value: number } | { kind: 'inf'; sign: 1 | -1 } | { kind: 'none' };

export interface ApproachSpec {
  id: ApproachId;
  /** KaTeX label */
  tex: string;
  /** plain-text label for readouts */
  text: string;
  a: number;
  f: Fn;
  left: OneSided;
  right: OneSided;
  /** f(a); null = undefined */
  fa: number | null;
  verdict: Verdict;
  /** the two-sided limit when it is finite */
  limit: number | null;
  /** the jump, right − left, when both are finite and differ */
  jump: number | null;
  /** default x and y ranges of the graph */
  window: { x: [number, number]; y: [number, number] };
}

const fin = (value: number): OneSided => ({ kind: 'finite', value });
const inf = (sign: 1 | -1): OneSided => ({ kind: 'inf', sign });
const NONE: OneSided = { kind: 'none' };

export const APPROACH: Record<ApproachId, ApproachSpec> = {
  'removable-p3': {
    id: 'removable-p3',
    tex: '\\frac{x^2-3x+2}{x^2-1}',
    text: '(x² − 3x + 2)/(x² − 1)',
    a: 1,
    f: (x) => (x * x - 3 * x + 2) / (x * x - 1),
    left: fin(-0.5),
    right: fin(-0.5),
    fa: null,
    verdict: 'removable',
    limit: -0.5,
    jump: null,
    window: { x: [0, 3], y: [-2.5, 1] },
  },
  'removable-p4': {
    id: 'removable-p4',
    tex: '\\frac{x^2-5x+6}{x-2}',
    text: '(x² − 5x + 6)/(x − 2)',
    a: 2,
    f: (x) => (x * x - 5 * x + 6) / (x - 2),
    left: fin(-1),
    right: fin(-1),
    fa: null,
    verdict: 'removable',
    limit: -1,
    jump: null,
    window: { x: [0, 4], y: [-4, 1.5] },
  },
  sinc: {
    id: 'sinc',
    tex: '\\frac{\\sin x}{x}',
    text: 'sin x / x',
    a: 0,
    f: (x) => Math.sin(x) / x,
    left: fin(1),
    right: fin(1),
    fa: null,
    verdict: 'removable',
    limit: 1,
    jump: null,
    window: { x: [-12, 12], y: [-0.4, 1.2] },
  },
  'jump-p6': {
    id: 'jump-p6',
    tex: '\\begin{cases}2x+1 & x<3\\\\ x^2 & x\\ge 3\\end{cases}',
    text: '2x + 1 (x < 3), x² (x ≥ 3)',
    a: 3,
    f: (x) => (x < 3 ? 2 * x + 1 : x * x),
    left: fin(7),
    right: fin(9),
    fa: 9,
    verdict: 'jump',
    limit: null,
    jump: 2,
    window: { x: [1.5, 4.5], y: [2, 22] },
  },
  sign: {
    id: 'sign',
    tex: '\\frac{|x|}{x}',
    text: '|x|/x',
    a: 0,
    f: (x) => (x === 0 ? NaN : Math.abs(x) / x),
    left: fin(-1),
    right: fin(1),
    fa: null,
    verdict: 'jump',
    limit: null,
    jump: 2,
    window: { x: [-3, 3], y: [-2, 2] },
  },
  recip: {
    id: 'recip',
    tex: '\\frac{1}{x}',
    text: '1/x',
    a: 0,
    f: (x) => (x === 0 ? NaN : 1 / x),
    left: inf(-1),
    right: inf(1),
    fa: null,
    verdict: 'infinite',
    limit: null,
    jump: null,
    window: { x: [-3, 3], y: [-6, 6] },
  },
  recip2: {
    id: 'recip2',
    tex: '\\frac{1}{x^2}',
    text: '1/x²',
    a: 0,
    f: (x) => (x === 0 ? NaN : 1 / (x * x)),
    left: inf(1),
    right: inf(1),
    fa: null,
    verdict: 'infinite',
    limit: null,
    jump: null,
    window: { x: [-3, 3], y: [-1, 9] },
  },
  'sin-recip': {
    id: 'sin-recip',
    tex: '\\sin\\frac{1}{x}',
    text: 'sin(1/x)',
    a: 0,
    f: (x) => (x === 0 ? NaN : Math.sin(1 / x)),
    left: NONE,
    right: NONE,
    fa: null,
    verdict: 'none',
    limit: null,
    jump: null,
    window: { x: [-1, 1], y: [-1.5, 1.5] },
  },
  cont: {
    id: 'cont',
    tex: '2x+1',
    text: '2x + 1',
    a: 3,
    f: (x) => 2 * x + 1,
    left: fin(7),
    right: fin(7),
    fa: 7,
    verdict: 'continuous',
    limit: 7,
    jump: null,
    window: { x: [0, 6], y: [0, 14] },
  },
};

export const APPROACH_IDS = Object.keys(APPROACH) as ApproachId[];
export const isApproachId = (s: unknown): s is ApproachId => typeof s === 'string' && s in APPROACH;
/** presets whose hole can be filled with the limit */
export const isRemovable = (id: ApproachId) => APPROACH[id].verdict === 'removable';

/** h = 1, 10⁻¹, …, 10⁻⁶ */
export const H_DECADES: readonly number[] = [1, 1e-1, 1e-2, 1e-3, 1e-4, 1e-5, 1e-6];
export const H_MIN = 1e-6;

/** the decades the slider has passed: those ≥ h (h itself is shown on its own line by the figure) */
export function decadesPassed(h: number): number[] {
  return H_DECADES.filter((d) => d >= h * (1 - 1e-9));
}

export interface ApproachRow {
  h: number;
  xl: number;
  fl: number;
  xr: number;
  fr: number;
}

/** One row per h: the left point a − h and the right point a + h with their values (NaN where undefined). */
export function approachRows(id: ApproachId, hs: readonly number[]): ApproachRow[] {
  const s = APPROACH[id];
  return hs.map((h) => ({ h, xl: s.a - h, fl: s.f(s.a - h), xr: s.a + h, fr: s.f(s.a + h) }));
}

/** the value a one-sided limit prescribes, as a number (±Infinity for ∞, NaN for none) */
export function oneSidedValue(o: OneSided): number {
  return o.kind === 'finite' ? o.value : o.kind === 'inf' ? o.sign * Infinity : NaN;
}

/**
 * sin(1/x) on (0, h]: the smallest and largest value of a sample of 1/x over one full period 2π beyond 1/h.
 * Both are within 10⁻³ of ∓1 for every h: the function oscillates at every scale.
 */
export function sinRecipScale(h: number): { min: number; max: number } {
  const u0 = 1 / h;
  let min = Infinity;
  let max = -Infinity;
  const n = 400;
  for (let i = 0; i <= n; i++) {
    const v = Math.sin(u0 + (2 * Math.PI * i) / n);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

/** the relative error of a table value against the stored limit (absolute against 0, never produced by a preset) */
export const limitError = (value: number, limit: number): number => (limit === 0 ? Math.abs(value) : relativeError(value, limit));

/* ---------- intermediate value theorem ---------- */

export type IvtId = 'cubic' | 'cos-x' | 'recip';

export interface IvtSpec {
  id: IvtId;
  tex: string;
  text: string;
  f: Fn;
  defaultA: number;
  defaultB: number;
  window: { x: [number, number]; y: [number, number] };
  /** the root of f = 0 on the default interval, null when there is none */
  root0: number | null;
  /** is f continuous on [a, b]? */
  continuousOn: (a: number, b: number) => boolean;
  /** exact level points when the preset has a closed form for f(c) = k (1/x: c = 1/k) */
  exact?: (k: number) => number[];
}

export const IVT: Record<IvtId, IvtSpec> = {
  cubic: {
    id: 'cubic',
    tex: 'x^3-x-1',
    text: 'x³ − x − 1',
    f: (x) => x * x * x - x - 1,
    defaultA: 1,
    defaultB: 2,
    window: { x: [0, 2.5], y: [-3, 7] },
    root0: 1.32471795724475,
    continuousOn: () => true,
  },
  'cos-x': {
    id: 'cos-x',
    tex: '\\cos x-x',
    text: 'cos x − x',
    f: (x) => Math.cos(x) - x,
    defaultA: 0,
    defaultB: 1,
    window: { x: [-0.2, 1.4], y: [-1.5, 1.3] },
    root0: 0.739085133215161,
    continuousOn: () => true,
  },
  recip: {
    id: 'recip',
    tex: '\\frac{1}{x}',
    text: '1/x',
    f: (x) => (x === 0 ? NaN : 1 / x),
    defaultA: -1,
    defaultB: 1,
    window: { x: [-1.5, 1.5], y: [-6, 6] },
    root0: null,
    continuousOn: (a, b) => !(a <= 0 && b >= 0),
    exact: (k) => (k === 0 ? [] : [1 / k]),
  },
};

export const IVT_IDS = Object.keys(IVT) as IvtId[];
export const isIvtId = (s: unknown): s is IvtId => typeof s === 'string' && s in IVT;

export interface BisectState {
  a: number;
  b: number;
  /** presses so far */
  steps: number;
  /** the last midpoint was a point where f is undefined: the interval is that point */
  collapsed: boolean;
}

export const bisectInit = (a: number, b: number): BisectState => ({ a, b, steps: 0, collapsed: false });

/** do the ends have f − k of opposite signs (or one of them zero), f finite at both? */
export function signChanges(id: IvtId, k: number, a: number, b: number): boolean {
  const f = IVT[id].f;
  const ga = f(a) - k;
  const gb = f(b) - k;
  return Number.isFinite(ga) && Number.isFinite(gb) && ga * gb <= 0;
}

/**
 * One press of "חצייה": keep the half of [a, b] on which f − k changes sign. null when there is nothing to halve (no
 * sign change at the ends, or the interval is already a point). A midpoint where f is undefined collapses the interval.
 */
export function bisectStep(id: IvtId, k: number, s: BisectState): BisectState | null {
  if (s.collapsed || s.b <= s.a || !signChanges(id, k, s.a, s.b)) return null;
  const f = IVT[id].f;
  const m = (s.a + s.b) / 2;
  const gm = f(m) - k;
  const steps = s.steps + 1;
  if (!Number.isFinite(gm)) return { a: m, b: m, steps, collapsed: true };
  if (gm === 0) return { a: m, b: m, steps, collapsed: false };
  const ga = f(s.a) - k;
  return ga * gm < 0 ? { a: s.a, b: m, steps, collapsed: false } : { a: m, b: s.b, steps, collapsed: false };
}

/** The points c of [a, b] with f(c) = k (a probe on a grid, refined by bisection; exact for 1/x). */
export function levelPoints(id: IvtId, k: number, a: number, b: number): number[] {
  const spec = IVT[id];
  if (spec.exact) return spec.exact(k).filter((c) => c >= a && c <= b);
  const g = (x: number) => spec.f(x) - k;
  const out: number[] = [];
  const n = 4000;
  let xp = a;
  let gp = g(a);
  if (gp === 0) out.push(a);
  for (let i = 1; i <= n; i++) {
    const x = a + ((b - a) * i) / n;
    const gx = g(x);
    if (gx === 0) out.push(x);
    else if (gp * gx < 0) {
      let lo = xp;
      let hi = x;
      for (let j = 0; j < 80; j++) {
        const m = (lo + hi) / 2;
        if (g(lo) * g(m) <= 0) hi = m;
        else lo = m;
      }
      out.push((lo + hi) / 2);
    }
    xp = x;
    gp = gx;
  }
  return out;
}

/* ---------- extreme values ---------- */

export type ExtId = 'x2' | 'recip' | 'lin' | 'sin';

export interface ExtSpec {
  id: ExtId;
  tex: string;
  text: string;
  f: Fn;
  defaultA: number;
  defaultB: number;
  window: { x: [number, number]; y: [number, number] };
  /** the ranges of the two end sliders */
  aRange: [number, number];
  bRange: [number, number];
  /** the interior critical points of f in the open interval (a, b), exact */
  critical: (a: number, b: number) => number[];
  /** the left end cannot be included when a is this value (f undefined there) */
  excludedAt?: number;
}

export const EXTREME: Record<ExtId, ExtSpec> = {
  x2: {
    id: 'x2',
    tex: 'x^2',
    text: 'x²',
    f: (x) => x * x,
    defaultA: -1,
    defaultB: 2,
    window: { x: [-1.5, 2.5], y: [-0.5, 5] },
    aRange: [-1.5, 2.4],
    bRange: [-1.4, 2.5],
    critical: (a, b) => (a < 0 && b > 0 ? [0] : []),
  },
  recip: {
    id: 'recip',
    tex: '\\frac{1}{x}',
    text: '1/x',
    f: (x) => (x === 0 ? NaN : 1 / x),
    defaultA: 0.5,
    defaultB: 3,
    window: { x: [-0.25, 3.5], y: [-0.5, 5] },
    aRange: [0, 3.4],
    bRange: [0.1, 3.5],
    critical: () => [],
    excludedAt: 0,
  },
  lin: {
    id: 'lin',
    tex: 'x',
    text: 'x',
    f: (x) => x,
    defaultA: 0,
    defaultB: 1,
    window: { x: [-0.5, 1.5], y: [-0.5, 1.5] },
    aRange: [-0.5, 1.4],
    bRange: [-0.4, 1.5],
    critical: () => [],
  },
  sin: {
    id: 'sin',
    tex: '\\sin x',
    text: 'sin x',
    f: Math.sin,
    defaultA: 0,
    defaultB: 2 * Math.PI,
    window: { x: [-0.5, 7], y: [-1.5, 1.5] },
    aRange: [0, 6.7],
    bRange: [0.1, 6.8],
    critical: (a, b) => {
      const out: number[] = [];
      for (let k = Math.ceil((a - Math.PI / 2) / Math.PI); ; k++) {
        const c = Math.PI / 2 + k * Math.PI;
        if (c >= b) break;
        if (c > a) out.push(c);
      }
      return out;
    },
  },
};

export const EXT_IDS = Object.keys(EXTREME) as ExtId[];
export const isExtId = (s: unknown): s is ExtId => typeof s === 'string' && s in EXTREME;

/** is the left end really included, given the learner's toggle? */
export const leftIncluded = (id: ExtId, a: number, leftClosed: boolean): boolean => leftClosed && EXTREME[id].excludedAt !== a;

export interface Extreme {
  /** sup (for the maximum) or inf (for the minimum); ±Infinity when unbounded */
  value: number;
  /** is there an included point with this value? */
  attained: boolean;
  /** included points where it is attained */
  at: number[];
  /** excluded ends where f approaches it */
  approachedAt: number[];
}

export interface ExtremeResult {
  max: Extreme;
  min: Extreme;
}

/** sup and inf of f on the interval from a to b with each end closed or open; see the MODEL SPECIFICATION. */
export function extremes(id: ExtId, a: number, b: number, leftClosed: boolean, rightClosed: boolean): ExtremeResult {
  const spec = EXTREME[id];
  const lc = leftIncluded(id, a, leftClosed);
  const valueAt = (x: number) => (spec.excludedAt === x ? Infinity : spec.f(x));
  const cands: { x: number; v: number; included: boolean }[] = [
    { x: a, v: valueAt(a), included: lc },
    { x: b, v: valueAt(b), included: rightClosed },
    ...spec.critical(a, b).map((x) => ({ x, v: spec.f(x), included: true })),
  ];
  const pick = (sign: 1 | -1): Extreme => {
    let best = -Infinity;
    for (const c of cands) best = Math.max(best, sign * c.v);
    const tie = (v: number) => sign * v === best || (Number.isFinite(best) && Math.abs(sign * v - best) <= 1e-12 * Math.max(1, Math.abs(best)));
    const at = cands.filter((c) => c.included && tie(c.v)).map((c) => c.x);
    const approachedAt = cands.filter((c) => !c.included && tie(c.v)).map((c) => c.x);
    return { value: sign * best, attained: at.length > 0, at, approachedAt };
  };
  return { max: pick(1), min: pick(-1) };
}
