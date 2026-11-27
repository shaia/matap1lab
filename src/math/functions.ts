/**
 * Functions of one variable for chapter 4: a registry of the course's standard functions with their exact domain,
 * range, parity, period, zeros and monotone pieces, and the pure helpers behind GraphLab (transformations,
 * composition, intersections, the one-to-one test of a restriction).
 *
 * MODEL SPECIFICATION
 * - System: a real function of one real variable, given by a rule f: ℝ → ℝ ∪ {NaN}. NaN marks "not defined": every
 *   `FN[id].f` returns NaN exactly outside its `domain` (the tangent also at the poles π/2 + kπ, where |cos x| < 1e-12
 *   stands for "at the pole"; a double never lands exactly on π/2). Nothing returns ±∞ except by overflow.
 * - Exact data (hard-coded, each recomputed with sympy 2026-11-26, and checked against sampling in the tests):
 *   `domain` and `range` are lists of intervals { lo, hi, loOpen, hiOpen } with ±∞ allowed (an infinite end is always
 *   open); `parity` is 'even' (f(−x) = f(x)), 'odd' (f(−x) = −f(x)) or null (neither on its domain); `period` is the
 *   smallest positive period or null; `zeros` lists the points of the domain where f = 0 (a generator for the
 *   periodic ones); `mono` lists the maximal pieces of the domain on which f is strictly increasing or strictly
 *   decreasing (exact, from the registry, never from sampling). A turning point is a point of the domain shared by an
 *   increasing and a decreasing piece. `window` is the default x and y range of a figure.
 *   The constant function `const` has no fixed value: its rule is x ↦ k, and `fnOf`, `rangeOf`, `zerosOf` take k.
 * - Transformation: y = A·f((x − a)/b) + c with b ≠ 0 (b < 0 reflects in the y-axis, A < 0 in the x-axis).
 * - Composition: (f∘g)(x) = f(g(x)), defined where g(x) is defined and g(x) lies in the domain of f.
 * - One-to-one test of a restriction f|[lo, hi]: exact within one monotone piece (strictly monotone means injective);
 *   across several pieces the images of the clipped pieces must be disjoint, and the end values are read from f (a
 *   limit at an open end is f at a point 1e-9 inside, at an infinite end f at ±1e8). That last step is a numerical
 *   comparison of exactly known pieces, not a proof.
 * - Probes (numerical evidence, never proof; a figure that shows one says so): `definedSet` and `composeDomain` find
 *   where a rule is defined on a grid, then refine each edge by bisection; `intersections` finds sign changes of
 *   f − g on a grid and refines them with `bisect`; `coincidesOnWindow` compares values on a grid.
 * - What the probes miss: a run of definedness narrower than one grid step; two intersections closer together than one
 *   grid step (no sign change inside a cell, and the minimum of |f − g| there is not 1e-9 small); a tangency is found
 *   only when |f − g| reaches below 1e-9 at its minimum (an exact touch, as for x³ − 3x = 2 at x = −1), so a near-miss
 *   such as k = 2.0000001 counts as no touch; a jump of f − g through a pole is rejected because |f − g| at the
 *   bisected point is not small; a coincident pair (f = g on every sample) is reported as `coincident`, not counted.
 * - Ignored: functions that are not in the registry; complex values.
 */

import { bisect } from './analysis';

export type Fn = (x: number) => number;

export interface Interval {
  lo: number;
  hi: number;
  loOpen: boolean;
  hiOpen: boolean;
}

export type Dir = 'inc' | 'dec' | 'const';
export interface MonoPiece extends Interval {
  dir: Dir;
}

export type FnId =
  | 'lin'
  | 'x2'
  | 'x3'
  | 'sqrt'
  | 'cbrt'
  | 'abs'
  | 'recip'
  | 'recip2'
  | 'exp'
  | 'ln'
  | 'const'
  | 'sin'
  | 'cos'
  | 'tan'
  | 'arcsin'
  | 'arccos'
  | 'arctan'
  | 'sinh'
  | 'cosh'
  | 'tanh'
  | 'quad'
  | 'cubic'
  | 'semicircle'
  | 'rational'
  | 'sqrt-quad'
  | 'ln-abs'
  | 'gauss'
  | 'sin2';

export interface FnWindow {
  x: [number, number];
  y: [number, number];
}

export interface FnSpec {
  id: FnId;
  /** KaTeX label of the rule, e.g. `\sqrt{x}` */
  tex: string;
  /** plain-text label for readouts, e.g. `√x` */
  text: string;
  /** the rule with `arg` in place of x: `at('(x − 1)/2')` is `√((x − 1)/2)` */
  at: (arg: string) => string;
  f: Fn;
  /** exact; a generator returns the intervals that meet [lo, hi] (unclipped) */
  domain: Interval[] | ((lo: number, hi: number) => Interval[]);
  range: Interval[];
  /** exact, readable: "ℝ ∖ {0}", "[−2, 2]" */
  domainText: string;
  rangeText: string;
  parity: 'even' | 'odd' | null;
  period: number | null;
  /** the zeros on ℝ, or a generator for the zeros in [lo, hi] (inclusive) */
  zeros: number[] | ((lo: number, hi: number) => number[]);
  window: FnWindow;
  /** exact monotone pieces; a generator returns the pieces that meet [lo, hi] (unclipped) */
  mono: MonoPiece[] | ((lo: number, hi: number) => MonoPiece[]);
}

/* ------------------------------------------------------------------ intervals */

const INF = Infinity;
export const interval = (lo: number, hi: number, loOpen = false, hiOpen = false): Interval => ({
  lo,
  hi,
  loOpen: loOpen || lo === -INF,
  hiOpen: hiOpen || hi === INF,
});
const REAL = [interval(-INF, INF)];
const NONZERO = [interval(-INF, 0, true, true), interval(0, INF, true, true)];
const POSITIVE = [interval(0, INF, true, true)];
const NONNEG = [interval(0, INF)];

export function inInterval(iv: Interval, x: number): boolean {
  if (Number.isNaN(x)) return false;
  const aboveLo = iv.loOpen ? x > iv.lo : x >= iv.lo;
  const belowHi = iv.hiOpen ? x < iv.hi : x <= iv.hi;
  return aboveLo && belowHi;
}
export const inIntervals = (set: Interval[], x: number): boolean => set.some((iv) => inInterval(iv, x));

const numText = (v: number): string => (v === INF ? '∞' : v === -INF ? '−∞' : v < 0 ? `−${Math.abs(v)}` : String(v));
/** "[−2, 2]", "(−∞, 0) ∪ (0, ∞)", the intervals as text */
export function intervalsText(set: Interval[]): string {
  if (set.length === 0) return '∅';
  return set.map((iv) => `${iv.loOpen ? '(' : '['}${numText(iv.lo)}, ${numText(iv.hi)}${iv.hiOpen ? ')' : ']'}`).join(' ∪ ');
}

/* ------------------------------------------------------------------ lattices for the periodic functions */

/** the lattice cells [origin + j·step, origin + (j+1)·step] that meet [lo, hi] */
function lattice(lo: number, hi: number, origin: number, step: number): number[] {
  const j0 = Math.floor((lo - origin) / step);
  const j1 = Math.floor((hi - origin) / step);
  const out: number[] = [];
  for (let j = j0; j <= j1; j++) out.push(j);
  return out;
}
const piecesOn = (lo: number, hi: number, origin: number, step: number, dirOf: (j: number) => Dir, open: boolean): MonoPiece[] =>
  lattice(lo, hi, origin, step).map((j) => ({ ...interval(origin + j * step, origin + (j + 1) * step, open, open), dir: dirOf(j) }));
const even = (j: number) => ((j % 2) + 2) % 2 === 0;
const multiplesOf = (lo: number, hi: number, origin: number, step: number): number[] => {
  const out: number[] = [];
  for (let j = Math.ceil((lo - origin) / step - 1e-12); origin + j * step <= hi + 1e-12; j++) out.push(origin + j * step);
  return out;
};

const PI = Math.PI;
const HALF = PI / 2;

/* ------------------------------------------------------------------ the registry */

type Raw = Omit<FnSpec, 'at' | 'text'> & { text: string; tpl: string };

const RAW: Raw[] = [
  {
    id: 'lin', tex: '2x+1', text: '2x + 1', tpl: '2(#) + 1', f: (x) => 2 * x + 1,
    domain: REAL, range: REAL, domainText: 'ℝ', rangeText: 'ℝ', parity: null, period: null, zeros: [-0.5],
    window: { x: [-4, 4], y: [-6, 6] }, mono: [{ ...interval(-INF, INF), dir: 'inc' }],
  },
  {
    id: 'x2', tex: 'x^2', text: 'x²', tpl: '(#)²', f: (x) => x * x,
    domain: REAL, range: NONNEG, domainText: 'ℝ', rangeText: '[0, ∞)', parity: 'even', period: null, zeros: [0],
    window: { x: [-3, 3], y: [-2, 9] },
    mono: [{ ...interval(-INF, 0, true, false), dir: 'dec' }, { ...interval(0, INF), dir: 'inc' }],
  },
  {
    id: 'x3', tex: 'x^3', text: 'x³', tpl: '(#)³', f: (x) => x * x * x,
    domain: REAL, range: REAL, domainText: 'ℝ', rangeText: 'ℝ', parity: 'odd', period: null, zeros: [0],
    window: { x: [-2.5, 2.5], y: [-8, 8] }, mono: [{ ...interval(-INF, INF), dir: 'inc' }],
  },
  {
    id: 'sqrt', tex: '\\sqrt{x}', text: '√x', tpl: '√(#)', f: (x) => (x < 0 ? NaN : Math.sqrt(x)),
    domain: NONNEG, range: NONNEG, domainText: '[0, ∞)', rangeText: '[0, ∞)', parity: null, period: null, zeros: [0],
    window: { x: [-2, 8], y: [-2, 4] }, mono: [{ ...interval(0, INF), dir: 'inc' }],
  },
  {
    id: 'cbrt', tex: '\\sqrt[3]{x}', text: '∛x', tpl: '∛(#)', f: (x) => Math.cbrt(x),
    domain: REAL, range: REAL, domainText: 'ℝ', rangeText: 'ℝ', parity: 'odd', period: null, zeros: [0],
    window: { x: [-4, 4], y: [-2.5, 2.5] }, mono: [{ ...interval(-INF, INF), dir: 'inc' }],
  },
  {
    id: 'abs', tex: '|x|', text: '|x|', tpl: '|#|', f: (x) => Math.abs(x),
    domain: REAL, range: NONNEG, domainText: 'ℝ', rangeText: '[0, ∞)', parity: 'even', period: null, zeros: [0],
    window: { x: [-4, 4], y: [-1, 5] },
    mono: [{ ...interval(-INF, 0, true, false), dir: 'dec' }, { ...interval(0, INF), dir: 'inc' }],
  },
  {
    id: 'recip', tex: '\\frac{1}{x}', text: '1/x', tpl: '1/(#)', f: (x) => (x === 0 ? NaN : 1 / x),
    domain: NONZERO, range: NONZERO, domainText: 'ℝ ∖ {0}', rangeText: 'ℝ ∖ {0}', parity: 'odd', period: null, zeros: [],
    window: { x: [-4, 4], y: [-4, 4] },
    mono: [{ ...interval(-INF, 0, true, true), dir: 'dec' }, { ...interval(0, INF, true, true), dir: 'dec' }],
  },
  {
    id: 'recip2', tex: '\\frac{1}{x^2}', text: '1/x²', tpl: '1/(#)²', f: (x) => (x === 0 ? NaN : 1 / (x * x)),
    domain: NONZERO, range: POSITIVE, domainText: 'ℝ ∖ {0}', rangeText: '(0, ∞)', parity: 'even', period: null, zeros: [],
    window: { x: [-3, 3], y: [-1, 9] },
    mono: [{ ...interval(-INF, 0, true, true), dir: 'inc' }, { ...interval(0, INF, true, true), dir: 'dec' }],
  },
  {
    id: 'exp', tex: 'e^{x}', text: 'eˣ', tpl: 'e^(#)', f: (x) => Math.exp(x),
    domain: REAL, range: POSITIVE, domainText: 'ℝ', rangeText: '(0, ∞)', parity: null, period: null, zeros: [],
    window: { x: [-3, 3], y: [-1, 10] }, mono: [{ ...interval(-INF, INF), dir: 'inc' }],
  },
  {
    id: 'ln', tex: '\\ln x', text: 'ln x', tpl: 'ln(#)', f: (x) => (x <= 0 ? NaN : Math.log(x)),
    domain: POSITIVE, range: REAL, domainText: '(0, ∞)', rangeText: 'ℝ', parity: null, period: null, zeros: [1],
    window: { x: [-1, 8], y: [-3, 3] }, mono: [{ ...interval(0, INF, true, true), dir: 'inc' }],
  },
  {
    // the rule x ↦ k is supplied by fnOf(id, k); this entry is the k = 0 case and its range is {0}
    id: 'const', tex: 'k', text: 'k', tpl: 'k', f: () => 0,
    domain: REAL, range: [interval(0, 0)], domainText: 'ℝ', rangeText: '{k}', parity: 'even', period: null, zeros: [],
    window: { x: [-4, 4], y: [-4, 4] }, mono: [{ ...interval(-INF, INF), dir: 'const' }],
  },
  {
    id: 'sin', tex: '\\sin x', text: 'sin x', tpl: 'sin(#)', f: (x) => Math.sin(x),
    domain: REAL, range: [interval(-1, 1)], domainText: 'ℝ', rangeText: '[−1, 1]', parity: 'odd', period: 2 * PI,
    zeros: (lo, hi) => multiplesOf(lo, hi, 0, PI), window: { x: [-6.5, 6.5], y: [-2, 2] },
    mono: (lo, hi) => piecesOn(lo, hi, -HALF, PI, (j) => (even(j) ? 'inc' : 'dec'), false),
  },
  {
    id: 'cos', tex: '\\cos x', text: 'cos x', tpl: 'cos(#)', f: (x) => Math.cos(x),
    domain: REAL, range: [interval(-1, 1)], domainText: 'ℝ', rangeText: '[−1, 1]', parity: 'even', period: 2 * PI,
    zeros: (lo, hi) => multiplesOf(lo, hi, HALF, PI), window: { x: [-6.5, 6.5], y: [-2, 2] },
    mono: (lo, hi) => piecesOn(lo, hi, 0, PI, (j) => (even(j) ? 'dec' : 'inc'), false),
  },
  {
    id: 'tan', tex: '\\tan x', text: 'tan x', tpl: 'tan(#)', f: (x) => (Math.abs(Math.cos(x)) < 1e-12 ? NaN : Math.tan(x)),
    domain: (lo, hi) => piecesOn(lo, hi, -HALF, PI, () => 'inc', true).map(({ dir: _d, ...iv }) => iv),
    range: REAL, domainText: 'ℝ ∖ {π/2 + kπ}', rangeText: 'ℝ', parity: 'odd', period: PI,
    zeros: (lo, hi) => multiplesOf(lo, hi, 0, PI), window: { x: [-6.5, 6.5], y: [-5, 5] },
    mono: (lo, hi) => piecesOn(lo, hi, -HALF, PI, () => 'inc', true),
  },
  {
    id: 'arcsin', tex: '\\arcsin x', text: 'arcsin x', tpl: 'arcsin(#)', f: (x) => Math.asin(x),
    domain: [interval(-1, 1)], range: [interval(-HALF, HALF)], domainText: '[−1, 1]', rangeText: '[−π/2, π/2]',
    parity: 'odd', period: null, zeros: [0], window: { x: [-1.5, 1.5], y: [-2, 2] }, mono: [{ ...interval(-1, 1), dir: 'inc' }],
  },
  {
    id: 'arccos', tex: '\\arccos x', text: 'arccos x', tpl: 'arccos(#)', f: (x) => Math.acos(x),
    domain: [interval(-1, 1)], range: [interval(0, PI)], domainText: '[−1, 1]', rangeText: '[0, π]',
    parity: null, period: null, zeros: [1], window: { x: [-1.5, 1.5], y: [-0.5, 3.5] }, mono: [{ ...interval(-1, 1), dir: 'dec' }],
  },
  {
    id: 'arctan', tex: '\\arctan x', text: 'arctan x', tpl: 'arctan(#)', f: (x) => Math.atan(x),
    domain: REAL, range: [interval(-HALF, HALF, true, true)], domainText: 'ℝ', rangeText: '(−π/2, π/2)',
    parity: 'odd', period: null, zeros: [0], window: { x: [-6, 6], y: [-2, 2] }, mono: [{ ...interval(-INF, INF), dir: 'inc' }],
  },
  {
    id: 'sinh', tex: '\\sinh x', text: 'sinh x', tpl: 'sinh(#)', f: (x) => Math.sinh(x),
    domain: REAL, range: REAL, domainText: 'ℝ', rangeText: 'ℝ', parity: 'odd', period: null, zeros: [0],
    window: { x: [-3, 3], y: [-6, 6] }, mono: [{ ...interval(-INF, INF), dir: 'inc' }],
  },
  {
    id: 'cosh', tex: '\\cosh x', text: 'cosh x', tpl: 'cosh(#)', f: (x) => Math.cosh(x),
    domain: REAL, range: [interval(1, INF)], domainText: 'ℝ', rangeText: '[1, ∞)', parity: 'even', period: null, zeros: [],
    window: { x: [-3, 3], y: [-1, 8] },
    mono: [{ ...interval(-INF, 0, true, false), dir: 'dec' }, { ...interval(0, INF), dir: 'inc' }],
  },
  {
    id: 'tanh', tex: '\\tanh x', text: 'tanh x', tpl: 'tanh(#)', f: (x) => Math.tanh(x),
    domain: REAL, range: [interval(-1, 1, true, true)], domainText: 'ℝ', rangeText: '(−1, 1)', parity: 'odd', period: null, zeros: [0],
    window: { x: [-4, 4], y: [-1.5, 1.5] }, mono: [{ ...interval(-INF, INF), dir: 'inc' }],
  },
  {
    id: 'quad', tex: 'x^2-2x-3', text: 'x² − 2x − 3', tpl: '(#)² − 2(#) − 3', f: (x) => x * x - 2 * x - 3,
    domain: REAL, range: [interval(-4, INF)], domainText: 'ℝ', rangeText: '[−4, ∞)', parity: null, period: null, zeros: [-1, 3],
    window: { x: [-4, 5], y: [-5, 6] },
    mono: [{ ...interval(-INF, 1), dir: 'dec' }, { ...interval(1, INF), dir: 'inc' }],
  },
  {
    id: 'cubic', tex: 'x^3-3x', text: 'x³ − 3x', tpl: '(#)³ − 3(#)', f: (x) => x * x * x - 3 * x,
    domain: REAL, range: REAL, domainText: 'ℝ', rangeText: 'ℝ', parity: 'odd', period: null, zeros: [-Math.sqrt(3), 0, Math.sqrt(3)],
    window: { x: [-2.5, 2.5], y: [-4, 4] },
    mono: [{ ...interval(-INF, -1), dir: 'inc' }, { ...interval(-1, 1), dir: 'dec' }, { ...interval(1, INF), dir: 'inc' }],
  },
  {
    id: 'semicircle', tex: '\\sqrt{4-x^2}', text: '√(4 − x²)', tpl: '√(4 − (#)²)', f: (x) => (4 - x * x < 0 ? NaN : Math.sqrt(4 - x * x)),
    domain: [interval(-2, 2)], range: [interval(0, 2)], domainText: '[−2, 2]', rangeText: '[0, 2]', parity: 'even', period: null, zeros: [-2, 2],
    window: { x: [-3, 3], y: [-1, 3] }, mono: [{ ...interval(-2, 0), dir: 'inc' }, { ...interval(0, 2), dir: 'dec' }],
  },
  {
    id: 'rational', tex: '\\frac{x-2}{x+1}', text: '(x − 2)/(x + 1)', tpl: '((#) − 2)/((#) + 1)', f: (x) => (x === -1 ? NaN : (x - 2) / (x + 1)),
    domain: [interval(-INF, -1, true, true), interval(-1, INF, true, true)],
    range: [interval(-INF, 1, true, true), interval(1, INF, true, true)], domainText: 'ℝ ∖ {−1}', rangeText: 'ℝ ∖ {1}',
    parity: null, period: null, zeros: [2], window: { x: [-5, 5], y: [-6, 6] },
    mono: [{ ...interval(-INF, -1, true, true), dir: 'inc' }, { ...interval(-1, INF, true, true), dir: 'inc' }],
  },
  {
    id: 'sqrt-quad', tex: '\\sqrt{x^2-2x-3}', text: '√(x² − 2x − 3)', tpl: '√((#)² − 2(#) − 3)',
    f: (x) => {
      const q = x * x - 2 * x - 3;
      return q < 0 ? NaN : Math.sqrt(q);
    },
    domain: [interval(-INF, -1), interval(3, INF)], range: NONNEG, domainText: '(−∞, −1] ∪ [3, ∞)', rangeText: '[0, ∞)',
    parity: null, period: null, zeros: [-1, 3], window: { x: [-5, 7], y: [-1, 6] },
    mono: [{ ...interval(-INF, -1), dir: 'dec' }, { ...interval(3, INF), dir: 'inc' }],
  },
  {
    id: 'ln-abs', tex: '\\ln|x|', text: 'ln|x|', tpl: 'ln|#|', f: (x) => (x === 0 ? NaN : Math.log(Math.abs(x))),
    domain: NONZERO, range: REAL, domainText: 'ℝ ∖ {0}', rangeText: 'ℝ', parity: 'even', period: null, zeros: [-1, 1],
    window: { x: [-5, 5], y: [-3, 3] },
    mono: [{ ...interval(-INF, 0, true, true), dir: 'dec' }, { ...interval(0, INF, true, true), dir: 'inc' }],
  },
  {
    id: 'gauss', tex: 'e^{-x^2}', text: 'exp(−x²)', tpl: 'exp(−(#)²)', f: (x) => Math.exp(-x * x),
    domain: REAL, range: [interval(0, 1, true, false)], domainText: 'ℝ', rangeText: '(0, 1]', parity: 'even', period: null, zeros: [],
    window: { x: [-3, 3], y: [-0.5, 1.5] },
    mono: [{ ...interval(-INF, 0), dir: 'inc' }, { ...interval(0, INF), dir: 'dec' }],
  },
  {
    id: 'sin2', tex: '\\sin^2 x', text: 'sin² x', tpl: 'sin²(#)', f: (x) => Math.sin(x) ** 2,
    domain: REAL, range: [interval(0, 1)], domainText: 'ℝ', rangeText: '[0, 1]', parity: 'even', period: PI,
    zeros: (lo, hi) => multiplesOf(lo, hi, 0, PI), window: { x: [-6.5, 6.5], y: [-0.5, 1.5] },
    mono: (lo, hi) => piecesOn(lo, hi, 0, HALF, (j) => (even(j) ? 'inc' : 'dec'), false),
  },
];

export const FN: Record<FnId, FnSpec> = Object.fromEntries(
  RAW.map(({ tpl, ...r }) => [r.id, { ...r, at: (arg: string) => (arg === 'x' ? r.text : tpl.replace(/#/g, arg)) } satisfies FnSpec]),
) as Record<FnId, FnSpec>;

export const FN_IDS = RAW.map((r) => r.id) as FnId[];
export const isFnId = (s: unknown): s is FnId => typeof s === 'string' && Object.prototype.hasOwnProperty.call(FN, s);

/* ------------------------------------------------------------------ registry accessors */

/** the rule of `id`; `const` is x ↦ k */
export const fnOf = (id: FnId, k = 0): Fn => (id === 'const' ? () => k : FN[id].f);

/** the domain's intervals that meet [lo, hi] (unclipped) */
export function domainOf(id: FnId, lo = -INF, hi = INF): Interval[] {
  const d = FN[id].domain;
  return typeof d === 'function' ? d(lo, hi) : d;
}
export const rangeOf = (id: FnId, k = 0): Interval[] => (id === 'const' ? [interval(k, k)] : FN[id].range);
/** the zeros of f in [lo, hi] (`const` has zeros everywhere when k = 0: none are listed) */
export function zerosOf(id: FnId, lo: number, hi: number): number[] {
  const z = FN[id].zeros;
  return (typeof z === 'function' ? z(lo, hi) : z).filter((x) => x >= lo - 1e-12 && x <= hi + 1e-12);
}
/** the monotone pieces that meet [lo, hi] (unclipped) */
export function monoOf(id: FnId, lo = -INF, hi = INF): MonoPiece[] {
  const m = FN[id].mono;
  return (typeof m === 'function' ? m(lo, hi) : m).filter((p) => p.hi >= lo && p.lo <= hi);
}
/** the direction of f at x: the piece of the registry that contains x, or null (x outside the domain) */
export function dirAt(id: FnId, x: number): Dir | null {
  const p = monoOf(id, x, x).find((q) => inInterval(q, x));
  return p ? p.dir : null;
}
/**
 * The turning points in [lo, hi]: points of the domain where an increasing piece meets a decreasing one (or the
 * reverse) with the function defined on both sides.
 */
export function turningPoints(id: FnId, lo: number, hi: number): number[] {
  const pieces = monoOf(id, lo - 1e-9, hi + 1e-9).sort((a, b) => a.lo - b.lo);
  const out: number[] = [];
  for (let i = 0; i + 1 < pieces.length; i++) {
    const a = pieces[i];
    const b = pieces[i + 1];
    if (a.hi === b.lo && !a.hiOpen && !b.loOpen && a.dir !== b.dir && a.dir !== 'const' && b.dir !== 'const' && a.hi >= lo && a.hi <= hi) out.push(a.hi);
  }
  return out;
}

/* ------------------------------------------------------------------ transformations */

export interface TransformSpec {
  a: number;
  b: number;
  A: number;
  c: number;
}
/** y = A·f((x − a)/b) + c; b = 0 gives NaN (no function) */
export const transformFn =
  (f: Fn, t: TransformSpec): Fn =>
  (x) =>
    t.b === 0 ? NaN : t.A * f((x - t.a) / t.b) + t.c;
/** the mirror image of f: `y` is f(−x), `origin` is −f(−x) */
export const mirrorFn =
  (f: Fn, kind: 'y' | 'origin'): Fn =>
  (x) =>
    kind === 'y' ? f(-x) : -f(-x);
/** f(x + T), the graph moved T to the left */
export const shiftFn =
  (f: Fn, T: number): Fn =>
  (x) =>
    f(x + T);
/** (outer ∘ inner)(x) = outer(inner(x)) */
export const composeFn =
  (outer: Fn, inner: Fn): Fn =>
  (x) =>
    outer(inner(x));

/* ------------------------------------------------------------------ probes: where a rule is defined, where two rules meet */

const finite = Number.isFinite;
/** rounded to 9 decimals; `+ 0` turns −0 into 0 */
const snap9 = (x: number) => Number(x.toFixed(9)) + 0;

/**
 * PROBE. The set of x in [lo, hi] where F(x) is finite, as intervals: a grid of n cells, each edge between a defined
 * and an undefined sample refined by bisection to 1e-12, then snapped to 9 decimals; an end is closed when F is
 * defined at the snapped point. A run that touches lo or hi is closed there (the window's edge). Misses a defined
 * run (or an undefined gap) narrower than one cell.
 */
export function definedSet(F: Fn, lo: number, hi: number, n = 1200): Interval[] {
  const X = (i: number) => (i === n ? hi : lo + ((hi - lo) * i) / n);
  const def = (x: number) => finite(F(x));
  const ok: boolean[] = [];
  for (let i = 0; i <= n; i++) ok.push(def(X(i)));
  const edge = (d: number, u: number): { x: number; closed: boolean } => {
    for (let it = 0; it < 60; it++) {
      const m = (d + u) / 2;
      if (def(m)) d = m;
      else u = m;
    }
    const s = snap9(d);
    return { x: s, closed: def(s) };
  };
  const out: Interval[] = [];
  let i = 0;
  while (i <= n) {
    if (!ok[i]) {
      i++;
      continue;
    }
    const start = i;
    while (i + 1 <= n && ok[i + 1]) i++;
    const end = i;
    const left = start === 0 ? { x: lo, closed: true } : edge(X(start), X(start - 1));
    const right = end === n ? { x: hi, closed: true } : edge(X(end), X(end + 1));
    out.push({ lo: left.x, hi: right.x, loOpen: !left.closed, hiOpen: !right.closed });
    i++;
  }
  return out;
}

/** PROBE. The domain of outer ∘ inner on [lo, hi] (where inner is defined and its value is in the domain of outer). */
export const composeDomain = (outer: Fn, inner: Fn, lo: number, hi: number, n = 1200): Interval[] => definedSet(composeFn(outer, inner), lo, hi, n);

export interface Intersections {
  xs: number[];
  /** f = g on every sampled point: infinitely many intersections, none listed */
  coincident: boolean;
}

/**
 * PROBE. The x in [lo, hi] with f(x) = g(x): sign changes of f − g between the n + 1 grid samples refined by `bisect`
 * (a root is accepted only when |f − g| < 1e-6 there, which rejects a jump through a pole), samples with
 * |f − g| < 1e-12 (an end of the window where sin 2π = −2.4e-16 counts as a zero),
 * a point where f − g stops being defined (accepted when |f − g| < 1e-9 at the edge), and tangencies (a sample whose
 * neighbours have the same sign and whose |f − g| < 0.05 is refined by a ternary search on |f − g|, accepted when
 * the minimum is below 1e-9). Roots closer than 1e-6 are one. See the model specification for what it misses.
 */
export function intersections(f: Fn, g: Fn, lo: number, hi: number, n = 2000): Intersections {
  const X = (i: number) => (i === n ? hi : lo + ((hi - lo) * i) / n);
  const dd = (x: number) => {
    const a = f(x);
    const b = g(x);
    return finite(a) && finite(b) ? a - b : NaN;
  };
  const d: number[] = [];
  let nd = 0;
  let allZero = true;
  for (let i = 0; i <= n; i++) {
    const v = dd(X(i));
    d.push(v);
    if (finite(v)) {
      nd++;
      if (Math.abs(v) > 1e-12) allZero = false;
    }
  }
  if (nd >= 20 && allZero) return { xs: [], coincident: true };

  const xs: number[] = [];
  const push = (x: number) => {
    if (!xs.some((v) => Math.abs(v - x) < 1e-6)) xs.push(x);
  };
  const edgeRoot = (def: number, undef: number) => {
    for (let it = 0; it < 60; it++) {
      const m = (def + undef) / 2;
      if (finite(dd(m))) def = m;
      else undef = m;
    }
    if (Math.abs(dd(def)) < 1e-9) push(def);
  };
  const h = (x: number) => {
    const v = dd(x);
    return finite(v) ? Math.abs(v) : Infinity;
  };
  for (let i = 0; i <= n; i++) {
    const di = d[i];
    if (Number.isNaN(di)) continue;
    if (Math.abs(di) < 1e-12) push(X(i));
    if (i < n) {
      const dj = d[i + 1];
      if (Number.isNaN(dj)) edgeRoot(X(i), X(i + 1));
      else if (di * dj < 0) {
        const r = bisect(dd, X(i), X(i + 1));
        if (Math.abs(dd(r)) < 1e-6) push(r);
      }
    }
    if (i > 0 && Number.isNaN(d[i - 1])) edgeRoot(X(i), X(i - 1));
    if (i > 0 && i < n && di !== 0 && finite(d[i - 1]) && finite(d[i + 1]) && Math.abs(di) < 0.05) {
      const same = Math.sign(d[i - 1]) === Math.sign(di) && Math.sign(d[i + 1]) === Math.sign(di);
      if (same && Math.abs(di) <= Math.abs(d[i - 1]) && Math.abs(di) <= Math.abs(d[i + 1])) {
        let a = X(i - 1);
        let b = X(i + 1);
        for (let it = 0; it < 100; it++) {
          const m1 = a + (b - a) / 3;
          const m2 = b - (b - a) / 3;
          if (h(m1) < h(m2)) b = m2;
          else a = m1;
        }
        const x = (a + b) / 2;
        if (h(x) < 1e-9) push(x);
      }
    }
  }
  return { xs: xs.sort((p, q) => p - q), coincident: false };
}

/** PROBE. The number of intersections of f and g on [lo, hi] (Infinity when they coincide). */
export function countIntersections(f: Fn, g: Fn, lo: number, hi: number, n = 2000): number {
  const r = intersections(f, g, lo, hi, n);
  return r.coincident ? Infinity : r.xs.length;
}

/** PROBE. How many times the horizontal line y = k meets the graph of f restricted to [lo, hi]. */
export const horizontalHits = (f: Fn, k: number, lo: number, hi: number, n = 2000): number => countIntersections(f, () => k, lo, hi, n);

/**
 * PROBE. g coincides with f on the window: on n + 1 samples both are undefined or both are defined within
 * tol·max(1, |f|, |g|), and at least one sample is defined.
 */
export function coincidesOnWindow(f: Fn, g: Fn, lo: number, hi: number, opts: { n?: number; tol?: number } = {}): boolean {
  const n = opts.n ?? 400;
  const tol = opts.tol ?? 1e-9;
  let seen = 0;
  for (let i = 0; i <= n; i++) {
    const x = lo + ((hi - lo) * i) / n;
    const a = f(x);
    const b = g(x);
    const fa = finite(a);
    const fb = finite(b);
    if (fa !== fb) return false;
    if (!fa) continue;
    seen++;
    if (Math.abs(a - b) > tol * Math.max(1, Math.abs(a), Math.abs(b))) return false;
  }
  return seen > 0;
}

/* ------------------------------------------------------------------ one-to-one restrictions */

const BIG = 1e8;
/** the value of F at the end x of a clipped piece: F(x) at a closed end, else F a hair inside (a limit) */
function endValue(F: Fn, x: number, open: boolean, lowerEnd: boolean): number {
  if (!open && finite(x)) {
    const v = F(x);
    if (finite(v)) return v;
  }
  const inward = lowerEnd ? 1 : -1;
  if (!finite(x)) return F(lowerEnd ? -BIG : BIG);
  for (const d of [1e-9, 1e-6, 1e-3]) {
    const v = F(x + inward * d * Math.max(1, Math.abs(x)));
    if (finite(v)) return v;
  }
  return NaN;
}

/** the monotone pieces of `id` clipped to [lo, hi], each with the interval its values fill */
export function clippedPieces(id: FnId, lo: number, hi: number, k = 0): { piece: MonoPiece; image: [number, number] }[] {
  const F = fnOf(id, k);
  const out: { piece: MonoPiece; image: [number, number] }[] = [];
  for (const p of monoOf(id, lo, hi)) {
    const cl: MonoPiece = {
      lo: Math.max(p.lo, lo),
      hi: Math.min(p.hi, hi),
      loOpen: p.lo > lo ? p.loOpen : p.lo < lo ? false : p.loOpen,
      hiOpen: p.hi < hi ? p.hiOpen : p.hi > hi ? false : p.hiOpen,
      dir: p.dir,
    };
    const nonEmpty = cl.lo < cl.hi || (cl.lo === cl.hi && !cl.loOpen && !cl.hiOpen);
    if (!nonEmpty) continue;
    const a = endValue(F, cl.lo, cl.loOpen, true);
    const b = endValue(F, cl.hi, cl.hiOpen, false);
    out.push({ piece: cl, image: [Math.min(a, b), Math.max(a, b)] });
  }
  return out;
}

/**
 * Is f restricted to [lo, hi] (and to its domain) one-to-one? Within a strictly monotone piece: yes. With several
 * pieces: only when the images of the clipped pieces do not overlap (see the model specification). `const` is never
 * one-to-one on an interval with two points.
 */
export function isOneToOne(id: FnId, lo: number, hi: number, k = 0): boolean {
  const cp = clippedPieces(id, lo, hi, k);
  if (cp.length === 0) return true;
  if (cp.some((c) => c.piece.dir === 'const' && c.piece.hi > c.piece.lo)) return false;
  for (let i = 0; i < cp.length; i++) {
    for (let j = i + 1; j < cp.length; j++) {
      const [a0, a1] = cp[i].image;
      const [b0, b1] = cp[j].image;
      const ovLo = Math.max(a0, b0);
      const ovHi = Math.min(a1, b1);
      // the images overlap when their common part is longer than rounding, judged at the size of the common part
      if (ovHi - ovLo > 1e-7 * (1 + Math.max(Math.abs(ovLo), Math.abs(ovHi)))) return false;
    }
  }
  return true;
}
