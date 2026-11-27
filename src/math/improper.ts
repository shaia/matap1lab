/**
 * MODEL SPECIFICATION
 *
 * System:        improper integrals of positive functions of one real variable (chapter 8.3), the core of ImproperLab.
 *                Three registries:
 *                TAIL   ∫ₐᴿ f as R → ∞ for f = 1/xᵖ (a = 1, p a parameter), 1/(1 + x²) and e^(−x) (a = 0), with the
 *                       running integral I(R) = ∫ₐᴿ f in CLOSED FORM and its limit (a number or Infinity);
 *                SPIKE  ∫_ε¹ f as ε → 0⁺ for f = 1/xᵖ, I(ε) in closed form and its limit;
 *                CMP    the comparison test on [1, ∞): an integrand f without a usable antiderivative and a reference g
 *                       with ∫₁ᴿ g in closed form, the relation f ≤ g or f ≥ g on [1, ∞), and the verdict.
 *                Evaluated in IEEE double precision.
 * Dynamics:      none.
 * Boundary:      every closed form and constant below was recomputed with sympy on 2026-11-27:
 *                ∫₁ᴿ x^(−p) dx = (R^(1−p) − 1)/(1 − p) (p ≠ 1), ln R (p = 1); ∫₀ᴿ dx/(1 + x²) = arctan R → π/2;
 *                ∫₀ᴿ e^(−x) dx = 1 − e^(−R) → 1; ∫_ε¹ x^(−p) dx = (1 − ε^(1−p))/(1 − p) (p ≠ 1), −ln ε (p = 1);
 *                ∫₁ᴿ e^(−x) dx = e^(−1) − e^(−R); ∫₁ᴿ (π/2)/x² dx = π/2 − π/(2R); ∫₁ᴿ x^(−3/2) dx = 2 − 2/√R;
 *                ∫₁ᴿ dx/x = ln R; ∫₁^∞ e^(−x²) dx = √π(1 − erf 1)/2 = 0.139402792640331;
 *                ∫₁^∞ arctan x/x² dx = π/4 + ln 2/2 = 1.131971753677421; ∫₁^∞ dx/√(x³ + 1) = 1.894759968012013
 *                (numeric, sympy); ∫₁ᴿ (2 + sin x)/x dx = 2 ln R + Si(R) − Si(1) → ∞.
 *                The closed forms (R^(1−p) − 1)/(1 − p) are evaluated as expm1((1 − p) ln R)/(1 − p), so they stay
 *                accurate and continuous as p → 1, where they meet ln R.
 *                The running integral ∫₁ᴿ f of a CMP preset is a PROBE: composite Simpson on a table of cumulative
 *                integrals over a uniform grid of [1, 1000] with step 0.02 (≈ 300 cells per period of sin x for
 *                `div`; ≈ 50 000 cells, two new evaluations of f each), built once per preset on first use, plus
 *                one Simpson panel from the last grid point to R.
 *                It is labelled "חישוב נומרי" wherever it is shown. Its limit `fLimit` is STORED from sympy (null for
 *                `div`, which diverges); the tests check it against Simpson of the integrand after a substitution
 *                that maps [1, ∞) to (0, 1].
 *                The relation f ≤ g (or f ≥ g) on [1, ∞) is STORED with its one-line reason, never decided by
 *                sampling: e^(−x²) ≤ e^(−x) because x² ≥ x; arctan x/x² ≤ (π/2)/x² because arctan x < π/2;
 *                1/√(x³ + 1) ≤ x^(−3/2) because x³ + 1 > x³; (2 + sin x)/x ≥ 1/x because 2 + sin x ≥ 1.
 * Ignored:       exact arithmetic; R beyond 10⁴ (TAIL) or 10³ (CMP), ε below 10⁻⁶.
 * Valid when:    R ≥ a and 0 < ε ≤ 1; 0 < p; for CMP 1 ≤ R ≤ 1000.
 * Failure modes: the readouts show where an integral is heading on a finite window; a limit is never decided
 *                numerically (the stored limit and verdict are the mathematics, the curve is the evidence). For p
 *                close to 1 from above the limit 1/(p − 1) is large and the curve reaches it only far beyond 10⁴.
 */

export type Fn = (x: number) => number;

const PI = Math.PI;

/** (R^(1−p) − 1)/(1 − p), equal to ln R at p = 1 and continuous there */
function powPart(lnR: number, p: number): number {
  const q = 1 - p;
  if (Math.abs(q) < 1e-12) return lnR;
  return Math.expm1(q * lnR) / q;
}

/* ------------------------------------------------------------------ TAIL: ∫ₐᴿ f as R → ∞ */

export const TAIL_IDS = ['pow', 'lorentz', 'exp'] as const;
export type TailId = (typeof TAIL_IDS)[number];
export const isTailId = (s: unknown): s is TailId => typeof s === 'string' && (TAIL_IDS as readonly string[]).includes(s);

export interface TailSpec {
  id: TailId;
  tex: string;
  /** plain label for the select and the readout (p written as p) */
  text: string;
  /** the lower limit a */
  a: number;
  /** f uses the parameter p (only `pow`) */
  usesP: boolean;
  f: (x: number, p: number) => number;
  /** I(R) = ∫ₐᴿ f, closed form */
  I: (R: number, p: number) => number;
  /** the plain text of the closed form of ∫ₐᴿ f */
  Itext: (p: number) => string;
  /** lim I(R) as R → ∞: a number, or Infinity */
  limit: (p: number) => number;
  /** the exact limit as text ("π/2", "1", "1/(p − 1)"); null when it is infinite */
  limitText: (p: number) => string | null;
  /** the right end X of the top panel's window and its y range */
  X: number;
  y: readonly [number, number];
}

export const TAIL: Record<TailId, TailSpec> = {
  pow: {
    id: 'pow',
    tex: '\\frac{1}{x^p}',
    text: '1/xᵖ',
    a: 1,
    usesP: true,
    f: (x, p) => x ** -p,
    I: (R, p) => powPart(Math.log(R), p),
    Itext: (p) => (Math.abs(p - 1) < 1e-12 ? 'ln R' : '(R¹⁻ᵖ − 1)/(1 − p)'),
    limit: (p) => (p > 1 + 1e-12 ? 1 / (p - 1) : Infinity),
    limitText: (p) => (p > 1 + 1e-12 ? '1/(p − 1)' : null),
    X: 12,
    y: [0, 1.15],
  },
  lorentz: {
    id: 'lorentz',
    tex: '\\frac{1}{1+x^2}',
    text: '1/(1 + x²)',
    a: 0,
    usesP: false,
    f: (x) => 1 / (1 + x * x),
    I: (R) => Math.atan(R),
    Itext: () => 'arctan R',
    limit: () => PI / 2,
    limitText: () => 'π/2',
    X: 12,
    y: [0, 1.15],
  },
  exp: {
    id: 'exp',
    tex: 'e^{-x}',
    text: 'e^(−x)',
    a: 0,
    usesP: false,
    f: (x) => Math.exp(-x),
    I: (R) => -Math.expm1(-R),
    Itext: () => '1 − e^(−R)',
    limit: () => 1,
    limitText: () => '1',
    X: 12,
    y: [0, 1.15],
  },
};

/** ∫ₐᴿ f in closed form (R ≥ a) */
export const tailIntegral = (id: TailId, R: number, p: number): number => TAIL[id].I(R, p);
/** the limit of ∫ₐᴿ f as R → ∞ (Infinity when it diverges) */
export const tailLimit = (id: TailId, p: number): number => TAIL[id].limit(p);

/** the range of R the figure offers: from a + 0.1 to 10⁴ */
export const TAIL_R_MAX = 1e4;
export const tailRMin = (id: TailId): number => TAIL[id].a + 0.1;

/* ------------------------------------------------------------------ SPIKE: ∫_ε¹ f as ε → 0⁺ */

export const SPIKE_IDS = ['pow'] as const;
export type SpikeId = (typeof SPIKE_IDS)[number];
export const isSpikeId = (s: unknown): s is SpikeId => typeof s === 'string' && (SPIKE_IDS as readonly string[]).includes(s);

export interface SpikeSpec {
  id: SpikeId;
  tex: string;
  text: string;
  f: (x: number, p: number) => number;
  /** I(ε) = ∫_ε¹ f, closed form */
  I: (eps: number, p: number) => number;
  Itext: (p: number) => string;
  limit: (p: number) => number;
  limitText: (p: number) => string | null;
  /** the y range of the top panel: the graph leaves it at the top (the function is not bounded) */
  y: readonly [number, number];
}

export const SPIKE: Record<SpikeId, SpikeSpec> = {
  pow: {
    id: 'pow',
    tex: '\\frac{1}{x^p}',
    text: '1/xᵖ',
    f: (x, p) => x ** -p,
    I: (eps, p) => -powPart(Math.log(eps), p),
    Itext: (p) => (Math.abs(p - 1) < 1e-12 ? '−ln ε' : '(1 − ε¹⁻ᵖ)/(1 − p)'),
    limit: (p) => (p < 1 - 1e-12 ? 1 / (1 - p) : Infinity),
    limitText: (p) => (p < 1 - 1e-12 ? '1/(1 − p)' : null),
    y: [0, 6],
  },
};

export const spikeIntegral = (id: SpikeId, eps: number, p: number): number => SPIKE[id].I(eps, p);
export const spikeLimit = (id: SpikeId, p: number): number => SPIKE[id].limit(p);
export const EPS_MIN = 1e-6;
export const EPS_MAX = 0.5;

/** the parameter p of both power presets: 0.3…3 in steps of 0.05 */
export const P_MIN = 0.3;
export const P_MAX = 3;
export const P_STEP = 0.05;

/* ------------------------------------------------------------------ CMP: the comparison test on [1, ∞) */

export const CMP_IDS = ['exp2', 'atan', 'root', 'div'] as const;
export type CmpId = (typeof CMP_IDS)[number];
export const isCmpId = (s: unknown): s is CmpId => typeof s === 'string' && (CMP_IDS as readonly string[]).includes(s);

export interface CmpSpec {
  id: CmpId;
  ftex: string;
  gtex: string;
  /** plain labels */
  ftext: string;
  gtext: string;
  f: Fn;
  g: Fn;
  /** ∫₁ᴿ g in closed form */
  G: Fn;
  Gtext: string;
  /** ∫₁^∞ g (Infinity when it diverges) and its exact text */
  gLimit: number;
  gLimitText: string | null;
  /** the stored relation on [1, ∞) and its reason (plain text with LTR math) */
  relation: 'le' | 'ge';
  why: string;
  verdict: 'converges' | 'diverges';
  /** ∫₁^∞ f from sympy (null when it diverges) */
  fLimit: number | null;
  /** y range of the top panel (f and g on [1, 12]) and of the bottom one (both running integrals up to R = 1000) */
  y: readonly [number, number];
  yI: readonly [number, number];
}

const L = (s: string) => String.fromCharCode(0x2066) + s.replace(/ /g, String.fromCharCode(0xa0)) + String.fromCharCode(0x2069);

export const CMP: Record<CmpId, CmpSpec> = {
  exp2: {
    id: 'exp2',
    ftex: 'e^{-x^2}',
    gtex: 'e^{-x}',
    ftext: 'e^(−x²)',
    gtext: 'e^(−x)',
    f: (x) => Math.exp(-x * x),
    g: (x) => Math.exp(-x),
    G: (R) => Math.exp(-1) - Math.exp(-R),
    Gtext: 'e^(−1) − e^(−R)',
    gLimit: Math.exp(-1),
    gLimitText: 'e^(−1)',
    relation: 'le',
    why: `כי ${L('x² ≥ x')} כש-${L('x ≥ 1')}`,
    verdict: 'converges',
    fLimit: 0.139402792640331,
    y: [0, 0.45],
    yI: [0, 0.45],
  },
  atan: {
    id: 'atan',
    ftex: '\\frac{\\arctan x}{x^2}',
    gtex: '\\frac{\\pi/2}{x^2}',
    ftext: 'arctan x / x²',
    gtext: '(π/2)/x²',
    f: (x) => Math.atan(x) / (x * x),
    g: (x) => PI / 2 / (x * x),
    G: (R) => PI / 2 - PI / (2 * R),
    Gtext: 'π/2 − π/(2R)',
    gLimit: PI / 2,
    gLimitText: 'π/2',
    relation: 'le',
    why: `כי ${L('arctan x < π/2')}`,
    verdict: 'converges',
    fLimit: 1.131971753677421,
    y: [0, 1.7],
    yI: [0, 1.75],
  },
  root: {
    id: 'root',
    ftex: '\\frac{1}{\\sqrt{x^3+1}}',
    gtex: '\\frac{1}{x^{3/2}}',
    ftext: '1/√(x³ + 1)',
    gtext: '1/x^(3/2)',
    f: (x) => 1 / Math.sqrt(x * x * x + 1),
    g: (x) => x ** -1.5,
    G: (R) => 2 - 2 / Math.sqrt(R),
    Gtext: '2 − 2/√R',
    gLimit: 2,
    gLimitText: '2',
    relation: 'le',
    why: `כי ${L('x³ + 1 > x³')}`,
    verdict: 'converges',
    fLimit: 1.894759968012013,
    y: [0, 1.1],
    yI: [0, 2.2],
  },
  div: {
    id: 'div',
    ftex: '\\frac{2+\\sin x}{x}',
    gtex: '\\frac{1}{x}',
    ftext: '(2 + sin x)/x',
    gtext: '1/x',
    f: (x) => (2 + Math.sin(x)) / x,
    g: (x) => 1 / x,
    G: (R) => Math.log(R),
    Gtext: 'ln R',
    gLimit: Infinity,
    gLimitText: null,
    relation: 'ge',
    why: `כי ${L('2 + sin x ≥ 1')}`,
    verdict: 'diverges',
    fLimit: null,
    y: [0, 3.1],
    yI: [0, 16],
  },
};

/** the range of R the comparison offers */
export const CMP_R_MIN = 1;
export const CMP_R_MAX = 1000;
/** the step of the cumulative table */
export const CMP_H = 0.02;
const CMP_CELLS = Math.round((CMP_R_MAX - CMP_R_MIN) / CMP_H);

/** one Simpson panel on [lo, hi] */
const panel = (f: Fn, lo: number, hi: number) => ((hi - lo) / 6) * (f(lo) + 4 * f((lo + hi) / 2) + f(hi));

/** cumulative integrals ∫₁^(1 + i h) f, i = 0…CMP_CELLS, built once per preset (a module-level cache: the page is
 * single-threaded and the table depends only on the preset) */
const tables = new Map<CmpId, Float64Array>();
export function cmpTable(id: CmpId): Float64Array {
  let t = tables.get(id);
  if (t) return t;
  const f = CMP[id].f;
  t = new Float64Array(CMP_CELLS + 1);
  let acc = 0;
  let x0 = CMP_R_MIN;
  let f0 = f(x0);
  for (let i = 1; i <= CMP_CELLS; i++) {
    const x1 = CMP_R_MIN + i * CMP_H;
    const f1 = f(x1);
    acc += (CMP_H / 6) * (f0 + 4 * f((x0 + x1) / 2) + f1);
    t[i] = acc;
    x0 = x1;
    f0 = f1;
  }
  tables.set(id, t);
  return t;
}

/** ∫₁ᴿ f by the table (a numerical probe, 1 ≤ R ≤ 1000) */
export function cmpF(id: CmpId, R: number): number {
  const r = Math.min(Math.max(R, CMP_R_MIN), CMP_R_MAX);
  const t = cmpTable(id);
  const i = Math.min(CMP_CELLS, Math.floor((r - CMP_R_MIN) / CMP_H + 1e-9));
  const xi = CMP_R_MIN + i * CMP_H;
  return t[i] + (r > xi ? panel(CMP[id].f, xi, r) : 0);
}

/** ∫₁ᴿ g in closed form */
export const cmpG = (id: CmpId, R: number): number => CMP[id].G(R);
