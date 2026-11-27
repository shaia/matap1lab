/**
 * MODEL SPECIFICATION
 *
 * System:        numerical integration of a real function f over [a, b] by the composite trapezoid rule
 *                Tₙ = (h/2)(f₀ + 2f₁ + … + 2fₙ₋₁ + fₙ) and the composite Simpson rule
 *                Sₙ = (h/3)(f₀ + 4f₁ + 2f₂ + … + 4fₙ₋₁ + fₙ) (n even), h = (b − a)/n, fᵢ = f(a + ih). Chapter 8.4,
 *                the core of NumericLab. A registry NQ of presets with STORED closed forms: f, f″, f⁽⁴⁾, the exact
 *                integral, and M₂ = max|f″|, M₄ = max|f⁽⁴⁾| on [a, b]. Evaluated in IEEE double precision.
 *                (This Tₙ is the trapezoid sum, not chapter 6's Taylor polynomial; this file is separate from the
 *                `simpson` helper of multivar.ts / analysis.ts and does not change it.)
 * Dynamics:      none.
 * Boundary:      every closed form below (the exact integrals, f″, f⁽⁴⁾, M₂ and M₄ with the point where each maximum is
 *                attained) was recomputed with sympy on 2026-11-27 (the brief's screens/tools/ch8_presets.py and a
 *                check of the maxima: the critical points of f″ and f⁽⁴⁾ in [a, b] and the ends). The error bounds
 *                |E_T| ≤ (b − a)³M₂/(12n²) and |E_S| ≤ (b − a)⁵M₄/(180n⁴) are theorems the course states without proof;
 *                the tests check that every computed error obeys them. The error is signed: E = (rule) − exact.
 *                Doubling n divides the trapezoid error by about 4 and Simpson's by about 16 as n grows, BECAUSE the
 *                leading terms of the error are −h²(f′(b) − f′(a))/12 and −h⁴(f‴(b) − f‴(a))/180 (Euler–Maclaurin,
 *                not taught). For `lorentz` on [0, 1], f‴(0) = f‴(1) = 0, so Simpson's h⁴ term vanishes and its error
 *                ratio tends to 64, not 16: `lorentz` is therefore not in ERROR_IDS (the error plot), nor is `cubic`
 *                (Simpson is exact for a cubic: M₄ = 0, so its error is 0).
 * Ignored:       exact arithmetic. Rounding error of a sum of n terms is ~1e-16·n·max|f|·(b − a): Simpson's error at
 *                n = 256 is ~1e-12, still 3–4 orders above it on the ERROR_IDS presets.
 * Valid when:    n is a positive integer (Simpson: even); f is smooth on [a, b] (every preset is).
 * Failure modes: trapezoid(n) with n < 1 or not an integer, simpson(n) with n odd: both throw (a programming error,
 *                never a learner state). Error ratios at n ≥ 256 for Simpson start to show rounding noise.
 */

export type Fn = (x: number) => number;
export type QuadRule = 'trap' | 'simpson';

export interface NqSpec {
  id: NqId;
  /** TeX of f */
  tex: string;
  /** plain label for readouts and the select */
  text: string;
  f: Fn;
  /** f″ in closed form */
  f2: Fn;
  /** f⁽⁴⁾ in closed form */
  f4: Fn;
  f2text: string;
  f4text: string;
  a: number;
  b: number;
  /** "[0, π]" */
  abText: string;
  /** the exact integral ∫ₐᵇ f dx */
  exact: number;
  /** its closed form as plain text; null when it has no elementary closed form (gauss) */
  exactText: string | null;
  /** M₂ = max|f″| on [a, b], exactly, with its plain text and a point where it is attained */
  M2: number;
  M2text: string;
  M2at: number;
  /** M₄ = max|f⁽⁴⁾| on [a, b] (0 for the cubic) */
  M4: number;
  M4text: string;
  M4at: number;
  /** the plot window */
  window: { x: readonly [number, number]; y: readonly [number, number] };
}

export const NQ_IDS = ['exp', 'recip', 'sin', 'cubic', 'gauss', 'lorentz'] as const;
export type NqId = (typeof NQ_IDS)[number];
/** the presets of the error plot: Simpson's error is 0 on `cubic`, and ratio 64 (not 16) on `lorentz` */
export const ERROR_IDS = ['exp', 'recip', 'sin', 'gauss'] as const satisfies readonly NqId[];
export type ErrorId = (typeof ERROR_IDS)[number];
export const isNqId = (s: unknown): s is NqId => typeof s === 'string' && (NQ_IDS as readonly string[]).includes(s);
export const isErrorId = (s: unknown): s is ErrorId => typeof s === 'string' && (ERROR_IDS as readonly string[]).includes(s);

/** n = 2, 4, 8, …, 256: the doubling steps of the error plot */
export const DOUBLINGS: readonly number[] = [2, 4, 8, 16, 32, 64, 128, 256];

const PI = Math.PI;
const E = Math.E;

/** the plot window of [a, b]: a margin of 6% of the width on each side, y from a little below 0 to yMax */
function win(a: number, b: number, yMax: number): NqSpec['window'] {
  const m = 0.06 * (b - a);
  return { x: [a - m, b + m], y: [-0.08 * yMax, yMax] };
}

export const NQ: Record<NqId, NqSpec> = {
  exp: {
    id: 'exp',
    tex: 'e^{x}',
    text: 'eˣ',
    f: Math.exp,
    f2: Math.exp,
    f4: Math.exp,
    f2text: 'eˣ',
    f4text: 'eˣ',
    a: 0,
    b: 1,
    abText: '[0, 1]',
    exact: E - 1,
    exactText: 'e − 1',
    M2: E,
    M2text: 'e',
    M2at: 1,
    M4: E,
    M4text: 'e',
    M4at: 1,
    window: win(0, 1, 3),
  },
  recip: {
    id: 'recip',
    tex: '\\frac{1}{x}',
    text: '1/x',
    f: (x) => 1 / x,
    f2: (x) => 2 / x ** 3,
    f4: (x) => 24 / x ** 5,
    f2text: '2/x³',
    f4text: '24/x⁵',
    a: 1,
    b: 2,
    abText: '[1, 2]',
    exact: Math.LN2,
    exactText: 'ln 2',
    M2: 2,
    M2text: '2',
    M2at: 1,
    M4: 24,
    M4text: '24',
    M4at: 1,
    window: win(1, 2, 1.2),
  },
  sin: {
    id: 'sin',
    tex: '\\sin x',
    text: 'sin x',
    f: Math.sin,
    f2: (x) => -Math.sin(x),
    f4: Math.sin,
    f2text: '−sin x',
    f4text: 'sin x',
    a: 0,
    b: PI,
    abText: '[0, π]',
    exact: 2,
    exactText: '2',
    M2: 1,
    M2text: '1',
    M2at: PI / 2,
    M4: 1,
    M4text: '1',
    M4at: PI / 2,
    window: win(0, PI, 1.25),
  },
  cubic: {
    id: 'cubic',
    tex: 'x^3',
    text: 'x³',
    f: (x) => x ** 3,
    f2: (x) => 6 * x,
    f4: () => 0,
    f2text: '6x',
    f4text: '0',
    a: 0,
    b: 2,
    abText: '[0, 2]',
    exact: 4,
    exactText: '4',
    M2: 12,
    M2text: '12',
    M2at: 2,
    M4: 0,
    M4text: '0',
    M4at: 0,
    window: win(0, 2, 8.8),
  },
  gauss: {
    id: 'gauss',
    tex: 'e^{-x^2}',
    text: 'e^(−x²)',
    f: (x) => Math.exp(-x * x),
    f2: (x) => 2 * (2 * x * x - 1) * Math.exp(-x * x),
    f4: (x) => 4 * (4 * x ** 4 - 12 * x * x + 3) * Math.exp(-x * x),
    f2text: '(4x² − 2)e^(−x²)',
    f4text: '(16x⁴ − 48x² + 12)e^(−x²)',
    a: 0,
    b: 1,
    abText: '[0, 1]',
    // √π·erf(1)/2 (sympy, 16 digits); erf is not in the course, so the readout shows the number only
    exact: 0.746824132812427,
    exactText: null,
    M2: 2,
    M2text: '2',
    M2at: 0,
    M4: 12,
    M4text: '12',
    M4at: 0,
    window: win(0, 1, 1.15),
  },
  lorentz: {
    id: 'lorentz',
    tex: '\\frac{1}{1+x^2}',
    text: '1/(1 + x²)',
    f: (x) => 1 / (1 + x * x),
    f2: (x) => (2 * (3 * x * x - 1)) / (1 + x * x) ** 3,
    f4: (x) => (24 * (5 * x ** 4 - 10 * x * x + 1)) / (1 + x * x) ** 5,
    f2text: '(6x² − 2)/(1 + x²)³',
    f4text: '24(5x⁴ − 10x² + 1)/(1 + x²)⁵',
    a: 0,
    b: 1,
    abText: '[0, 1]',
    exact: PI / 4,
    exactText: 'π/4',
    M2: 2,
    M2text: '2',
    M2at: 0,
    M4: 24,
    M4text: '24',
    M4at: 0,
    window: win(0, 1, 1.15),
  },
};

function checkN(n: number, rule: QuadRule) {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`n must be a positive integer, got ${n}`);
  if (rule === 'simpson' && n % 2 !== 0) throw new RangeError(`Simpson's rule needs an even n, got ${n}`);
}

/** the trapezoid sum Tₙ of any f over [a, b] */
export function trapezoidOf(f: Fn, a: number, b: number, n: number): number {
  checkN(n, 'trap');
  const h = (b - a) / n;
  let s = (f(a) + f(b)) / 2;
  for (let i = 1; i < n; i++) s += f(a + i * h);
  return s * h;
}

/** the Simpson sum Sₙ of any f over [a, b], n even */
export function simpsonOf(f: Fn, a: number, b: number, n: number): number {
  checkN(n, 'simpson');
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += (i % 2 === 1 ? 4 : 2) * f(a + i * h);
  return (s * h) / 3;
}

/** Tₙ of a preset */
export const trapezoid = (id: NqId, n: number): number => trapezoidOf(NQ[id].f, NQ[id].a, NQ[id].b, n);
/** Sₙ of a preset (n even; throws on odd n) */
export const simpson = (id: NqId, n: number): number => simpsonOf(NQ[id].f, NQ[id].a, NQ[id].b, n);
export const approx = (id: NqId, n: number, rule: QuadRule): number => (rule === 'trap' ? trapezoid(id, n) : simpson(id, n));

/** the step h = (b − a)/n and the nodes xᵢ = a + ih, fᵢ = f(xᵢ), i = 0…n */
export function nodes(id: NqId, n: number): { h: number; xs: number[]; ys: number[] } {
  checkN(n, 'trap');
  const s = NQ[id];
  const h = (s.b - s.a) / n;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= n; i++) {
    const x = i === n ? s.b : s.a + i * h;
    xs.push(x);
    ys.push(s.f(x));
  }
  return { h, xs, ys };
}

/** a chord of the trapezoid rule over [x0, x1] */
export interface Chord {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}
/** Simpson's parabola over a pair of pieces [x0, x2] with middle xm, through (x0, y0), (xm, y1), (x2, y2):
 * p(x) = A + B(x − xm) + C(x − xm)² */
export interface Parabola {
  x0: number;
  xm: number;
  x2: number;
  y0: number;
  y1: number;
  y2: number;
  A: number;
  B: number;
  C: number;
}

export const chordAt = (c: Chord, x: number): number => c.y0 + ((c.y1 - c.y0) * (x - c.x0)) / (c.x1 - c.x0);
export const parabolaAt = (p: Parabola, x: number): number => p.A + p.B * (x - p.xm) + p.C * (x - p.xm) ** 2;
/** the exact area under a chord: (h/2)(y0 + y1) */
export const chordArea = (c: Chord): number => ((c.x1 - c.x0) / 2) * (c.y0 + c.y1);
/** the exact area under a parabola over its pair, ∫ from −h to h of (A + Bt + Ct²) dt = 2hA + 2Ch³/3 */
export function parabolaArea(p: Parabola): number {
  const h = (p.x2 - p.x0) / 2;
  return 2 * h * p.A + (2 * p.C * h ** 3) / 3;
}

/** the n chords of Tₙ, or the n/2 parabolas of Sₙ (throws on an odd n for Simpson) */
export function pieces(id: NqId, n: number, rule: 'trap'): Chord[];
export function pieces(id: NqId, n: number, rule: 'simpson'): Parabola[];
export function pieces(id: NqId, n: number, rule: QuadRule): Chord[] | Parabola[];
export function pieces(id: NqId, n: number, rule: QuadRule): Chord[] | Parabola[] {
  checkN(n, rule);
  const { h, xs, ys } = nodes(id, n);
  if (rule === 'trap') {
    const out: Chord[] = [];
    for (let i = 0; i < n; i++) out.push({ x0: xs[i], x1: xs[i + 1], y0: ys[i], y1: ys[i + 1] });
    return out;
  }
  const out: Parabola[] = [];
  for (let i = 0; i < n; i += 2) {
    const [y0, y1, y2] = [ys[i], ys[i + 1], ys[i + 2]];
    out.push({
      x0: xs[i],
      xm: xs[i + 1],
      x2: xs[i + 2],
      y0,
      y1,
      y2,
      A: y1,
      B: (y2 - y0) / (2 * h),
      C: (y0 - 2 * y1 + y2) / (2 * h * h),
    });
  }
  return out;
}

/** the stated error bound: (b − a)³M₂/(12n²) for the trapezoid, (b − a)⁵M₄/(180n⁴) for Simpson */
export function errorBound(id: NqId, n: number, rule: QuadRule): number {
  checkN(n, rule);
  const s = NQ[id];
  const L = s.b - s.a;
  return rule === 'trap' ? (L ** 3 * s.M2) / (12 * n * n) : (L ** 5 * s.M4) / (180 * n ** 4);
}

export interface ErrorRow {
  n: number;
  /** Tₙ or Sₙ */
  value: number;
  /** signed: value − exact */
  error: number;
  bound: number;
}

/** the approximation, its signed error and the bound at each n of `ns` */
export function errors(id: NqId, rule: QuadRule, ns: readonly number[]): ErrorRow[] {
  return ns.map((n) => {
    const value = approx(id, n, rule);
    return { n, value, error: value - NQ[id].exact, bound: errorBound(id, n, rule) };
  });
}
