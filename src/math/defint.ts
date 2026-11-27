/**
 * MODEL SPECIFICATION
 *
 * System:        two registries of real functions for chapter 8.2 (the definite integral: symmetry on [−a, a] and an
 *                integral with a variable limit). The core of DefIntLab. Evaluated in IEEE double precision.
 *                SYM: an integrand f with its parity (odd: f(−x) = −f(x); even: f(−x) = f(x); neither), a STORED
 *                antiderivative F in closed form (or null), and for `neither` its even and odd parts in closed form
 *                (with their antiderivatives).
 *                UP: G(x) = ∫ from h(x) to g(x) of f(t) dt, with f, the limits g, h and their derivatives g′, h′ in
 *                closed form, G in closed form (or null) and G′ in closed form.
 * Dynamics:      none.
 * Boundary:      every closed form below was recomputed with sympy on 2026-11-27 (screens/tools/cas.py and
 *                screens/tools/ch8_presets.py): (x⁴/4 − x²)′ = x³ − 2x; (x sin x + cos x)′ = x cos x;
 *                (x⁵/5 − x³ + x)′ = x⁴ − 3x² + 1; (x³ − x)′ = 3x² − 1 and ∫₋₁¹ (3x² − 1) dx = 0; cosh x + sinh x = eˣ and
 *                ∫₋ₐᵃ eˣ dx = 2 sinh a; ∫₀^{x²} cos t dt = sin(x²) with derivative 2x cos(x²); ∫ₓ^{2x} dt/t = ln 2 (x > 0).
 *                The parity is STORED, never decided by sampling; the tests check it on a grid.
 *                `gauss` (e^(−x²)) and `gauss-x` have no antiderivative in closed form: their integrals are composite
 *                Simpson sums (~200 panels per unit of length), a PROBE accurate to ~1e-10 on the windows, and the
 *                figure labels them as numeric values. Everything else a readout shows comes from a closed form.
 *                G′(x) is returned by the FORMULA f(g(x))·g′(x) − f(h(x))·h′(x) (the chain rule on the fundamental
 *                theorem); the tests check it against the stored closed form dG and against centralDiff of G.
 *                upperStrip splits G(x + dx) − G(x) into the strip at the top limit, ∫ from g(x) to g(x + dx) of f, and
 *                the strip at the bottom one, −∫ from h(x) to h(x + dx) of f (exact, from the antiderivative of f in t).
 * Ignored:       exact arithmetic; the functions off their windows.
 * Valid when:    for `recip-2x`, x > 0 (both limits stay on the domain t > 0 of 1/t); a in [0.2, 3].
 * Failure modes: strip area / dx is a forward difference: it differs from G′(x) by about G″(x)·dx/2, so where G″ is
 *                large (cos-x2 at |x| ≳ 1.2) even dx = 0.005 leaves an error above 1%. Not a bug: the limit dx → 0.
 */

import { simpson } from './multivar';

export type Fn = (x: number) => number;
export type Kind = 'odd' | 'even' | 'neither';

/** Simpson over [lo, hi] with ~200 panels per unit of length (at least 40): a probe, not a closed form */
export function numInt(f: Fn, lo: number, hi: number): number {
  if (lo === hi) return 0;
  const n = Math.max(40, 2 * Math.ceil(Math.abs(hi - lo) * 100));
  return simpson(f, lo, hi, n);
}

const gaussF: Fn = (x) => Math.exp(-x * x);

/* ------------------------------------------------------------------ symmetry */

export interface SymParts {
  /** the even part (f(x) + f(−x))/2 and the odd part (f(x) − f(−x))/2, in closed form */
  even: Fn;
  odd: Fn;
  evenText: string;
  oddText: string;
  evenTex: string;
  oddTex: string;
  /** antiderivatives of the two parts */
  evenF: Fn;
  oddF: Fn;
}

export interface SymSpec {
  id: SymId;
  tex: string;
  /** plain label for readouts and the select */
  text: string;
  f: Fn;
  kind: Kind;
  /** an antiderivative in closed form; null for gauss */
  F: Fn | null;
  Ftex: string | null;
  Ftext: string | null;
  /** the even and odd parts, for `neither` only */
  parts: SymParts | null;
  /** the panel: x range and y range (the curve is clipped outside it) */
  window: { x: readonly [number, number]; y: readonly [number, number] };
  /** the default half-width a */
  a0: number;
}

export const SYM_IDS = ['cubic', 'xcos', 'quart', 'gauss', 'zero', 'exp'] as const;
export type SymId = (typeof SYM_IDS)[number];
export const isSymId = (s: unknown): s is SymId => typeof s === 'string' && (SYM_IDS as readonly string[]).includes(s);

/** the slider range of the half-width a */
export const A_MIN = 0.2;
export const A_MAX = 3;

const SYM_X = [-3.3, 3.3] as const;

export const SYM: Record<SymId, SymSpec> = {
  cubic: {
    id: 'cubic',
    tex: 'x^3-2x',
    text: 'x³ − 2x',
    f: (x) => x ** 3 - 2 * x,
    kind: 'odd',
    F: (x) => x ** 4 / 4 - x * x,
    Ftex: '\\frac{x^4}{4}-x^2',
    Ftext: 'x⁴/4 − x²',
    parts: null,
    window: { x: SYM_X, y: [-6, 6] },
    a0: 1.8,
  },
  xcos: {
    id: 'xcos',
    tex: 'x\\cos x',
    text: 'x cos x',
    f: (x) => x * Math.cos(x),
    kind: 'odd',
    F: (x) => x * Math.sin(x) + Math.cos(x),
    Ftex: 'x\\sin x+\\cos x',
    Ftext: 'x sin x + cos x',
    parts: null,
    window: { x: SYM_X, y: [-3.3, 3.3] },
    a0: 2.5,
  },
  quart: {
    id: 'quart',
    tex: 'x^4-3x^2+1',
    text: 'x⁴ − 3x² + 1',
    f: (x) => x ** 4 - 3 * x * x + 1,
    kind: 'even',
    F: (x) => x ** 5 / 5 - x ** 3 + x,
    Ftex: '\\frac{x^5}{5}-x^3+x',
    Ftext: 'x⁵/5 − x³ + x',
    parts: null,
    window: { x: SYM_X, y: [-2, 6] },
    a0: 1.8,
  },
  gauss: {
    id: 'gauss',
    tex: 'e^{-x^2}',
    text: 'e^(−x²)',
    f: gaussF,
    kind: 'even',
    F: null,
    Ftex: null,
    Ftext: null,
    parts: null,
    window: { x: SYM_X, y: [-0.3, 1.2] },
    a0: 1.5,
  },
  zero: {
    id: 'zero',
    tex: '3x^2-1',
    text: '3x² − 1',
    f: (x) => 3 * x * x - 1,
    kind: 'even',
    F: (x) => x ** 3 - x,
    Ftex: 'x^3-x',
    Ftext: 'x³ − x',
    parts: null,
    window: { x: SYM_X, y: [-1.5, 7] },
    a0: 1.5,
  },
  exp: {
    id: 'exp',
    tex: 'e^x',
    text: 'eˣ',
    f: Math.exp,
    kind: 'neither',
    F: Math.exp,
    Ftex: 'e^x',
    Ftext: 'eˣ',
    parts: {
      even: Math.cosh,
      odd: Math.sinh,
      evenText: 'cosh x',
      oddText: 'sinh x',
      evenTex: '\\cosh x',
      oddTex: '\\sinh x',
      evenF: Math.sinh,
      oddF: Math.cosh,
    },
    window: { x: SYM_X, y: [-4, 8] },
    a0: 1.5,
  },
};

/** ∫ from lo to hi of the SYM preset: F(hi) − F(lo), or a Simpson probe when there is no F */
export function symIntegral(id: SymId, lo: number, hi: number): number {
  const s = SYM[id];
  return s.F ? s.F(hi) - s.F(lo) : numInt(s.f, lo, hi);
}

/** the two halves of ∫₋ₐᵃ f and their sum; `exact` is false when they are numeric (gauss) */
export function symParts(id: SymId, a: number): { left: number; right: number; total: number; exact: boolean } {
  const left = symIntegral(id, -a, 0);
  const right = symIntegral(id, 0, a);
  return { left, right, total: left + right, exact: SYM[id].F !== null };
}

/** ∫₋ₐᵃ of the even part and of the odd part (for `neither`): 2∫₀ᵃ even and exactly 0 */
export function partIntegrals(id: SymId, a: number): { even: number; odd: number } | null {
  const p = SYM[id].parts;
  if (!p) return null;
  return { even: p.evenF(a) - p.evenF(-a), odd: p.oddF(a) - p.oddF(-a) };
}

/* ------------------------------------------------------------------ variable limit */

export interface UpWindow {
  x: readonly [number, number];
  y: readonly [number, number];
}

export interface UpSpec {
  id: UpId;
  /** f(t): TeX and plain text */
  ftex: string;
  ftext: string;
  f: Fn;
  /** an antiderivative of f in t: closed form, or for gauss-x the Simpson area from 0 (a probe) */
  Ft: Fn;
  /** Ft is a closed form */
  exact: boolean;
  /** the upper limit g, the lower limit h, their derivatives, their plain texts */
  g: Fn;
  gp: Fn;
  h: Fn;
  hp: Fn;
  gtext: string;
  gptext: string;
  htext: string;
  hptext: string;
  /** the lower limit moves with x */
  hMoves: boolean;
  /** f(g(x)) and f(h(x)) as formulas in x (plain text) */
  fgtext: string;
  fhtext: string;
  /** g⁻¹ and h⁻¹ for a drag on the t-axis (`ref` picks the branch of x² by the sign of the current x) */
  gInv: (t: number, ref: number) => number;
  hInv: ((t: number) => number) | null;
  /** G(x) in closed form; null for gauss-x */
  G: Fn | null;
  Gtex: string | null;
  Gtext: string | null;
  /** G′(x) in closed form */
  dG: Fn;
  dGtex: string;
  dGtext: string;
  /** the slider range of x and its default */
  xr: readonly [number, number];
  x0: number;
  /** the top panel (f over t) and the bottom panel (G over x) */
  tWin: UpWindow;
  xWin: UpWindow;
}

export const UP_IDS = ['cos-x', 'cos-x2', 'gauss-x', 'recip-2x'] as const;
export type UpId = (typeof UP_IDS)[number];
export const isUpId = (s: unknown): s is UpId => typeof s === 'string' && (UP_IDS as readonly string[]).includes(s);

const zero: Fn = () => 0;
const LN2 = Math.LN2;

export const UP: Record<UpId, UpSpec> = {
  'cos-x': {
    id: 'cos-x',
    ftex: '\\cos t',
    ftext: 'cos t',
    f: Math.cos,
    Ft: Math.sin,
    exact: true,
    g: (x) => x,
    gp: () => 1,
    h: zero,
    hp: zero,
    gtext: 'x',
    gptext: '1',
    htext: '0',
    hptext: '0',
    hMoves: false,
    fgtext: 'cos x',
    fhtext: 'cos 0',
    gInv: (t) => t,
    hInv: null,
    G: Math.sin,
    Gtex: '\\sin x',
    Gtext: 'sin x',
    dG: Math.cos,
    dGtex: '\\cos x',
    dGtext: 'cos x',
    xr: [0, 6.2],
    x0: 2.5,
    tWin: { x: [-0.3, 6.6], y: [-1.35, 1.35] },
    xWin: { x: [-0.3, 6.6], y: [-1.35, 1.35] },
  },
  'cos-x2': {
    id: 'cos-x2',
    ftex: '\\cos t',
    ftext: 'cos t',
    f: Math.cos,
    Ft: Math.sin,
    exact: true,
    g: (x) => x * x,
    gp: (x) => 2 * x,
    h: zero,
    hp: zero,
    gtext: 'x²',
    gptext: '2x',
    htext: '0',
    hptext: '0',
    hMoves: false,
    fgtext: 'cos(x²)',
    fhtext: 'cos 0',
    gInv: (t, ref) => (ref < 0 ? -1 : 1) * Math.sqrt(Math.max(0, t)),
    hInv: null,
    G: (x) => Math.sin(x * x),
    Gtex: '\\sin\\left(x^2\\right)',
    Gtext: 'sin(x²)',
    dG: (x) => 2 * x * Math.cos(x * x),
    dGtex: '2x\\cos\\left(x^2\\right)',
    dGtext: '2x cos(x²)',
    xr: [-2.5, 2.5],
    x0: 0.8,
    tWin: { x: [-0.3, 6.6], y: [-1.35, 1.35] },
    xWin: { x: [-2.6, 2.6], y: [-1.35, 1.35] },
  },
  'gauss-x': {
    id: 'gauss-x',
    ftex: 'e^{-t^2}',
    ftext: 'e^(−t²)',
    f: gaussF,
    Ft: (t) => numInt(gaussF, 0, t),
    exact: false,
    g: (x) => x,
    gp: () => 1,
    h: zero,
    hp: zero,
    gtext: 'x',
    gptext: '1',
    htext: '0',
    hptext: '0',
    hMoves: false,
    fgtext: 'e^(−x²)',
    fhtext: 'e^0',
    gInv: (t) => t,
    hInv: null,
    G: null,
    Gtex: null,
    Gtext: null,
    dG: gaussF,
    dGtex: 'e^{-x^2}',
    dGtext: 'e^(−x²)',
    xr: [0, 3],
    x0: 1,
    tWin: { x: [-0.3, 3.3], y: [-0.15, 1.15] },
    xWin: { x: [-0.3, 3.3], y: [-0.1, 1.05] },
  },
  'recip-2x': {
    id: 'recip-2x',
    ftex: '\\frac{1}{t}',
    ftext: '1/t',
    f: (t) => 1 / t,
    Ft: Math.log,
    exact: true,
    g: (x) => 2 * x,
    gp: () => 2,
    h: (x) => x,
    hp: () => 1,
    gtext: '2x',
    gptext: '2',
    htext: 'x',
    hptext: '1',
    hMoves: true,
    fgtext: '1/(2x)',
    fhtext: '1/x',
    gInv: (t) => t / 2,
    hInv: (t) => t,
    G: () => LN2,
    Gtex: '\\ln 2',
    Gtext: 'ln 2',
    dG: zero,
    dGtex: '0',
    dGtext: '0',
    xr: [0.4, 3],
    x0: 1.2,
    tWin: { x: [0, 6.4], y: [-0.15, 2.7] },
    xWin: { x: [0, 3.2], y: [-0.15, 1.2] },
  },
};

/** ∫ from lo to hi of f(t) for the UP preset, through its antiderivative in t (Simpson for gauss-x) */
export function upArea(id: UpId, lo: number, hi: number): number {
  const s = UP[id];
  return s.exact ? s.Ft(hi) - s.Ft(lo) : numInt(s.f, lo, hi);
}

/** G(x): the stored closed form, or for gauss-x the Simpson probe ∫₀ˣ e^(−t²) dt */
export function Gof(id: UpId, x: number): number {
  const s = UP[id];
  return s.G ? s.G(x) : upArea(id, s.h(x), s.g(x));
}

/**
 * G(x), G′(x) by the formula f(g(x))·g′(x) − f(h(x))·h′(x), its two terms, and the limits lo = h(x), hi = g(x).
 * `exact` is false when G is a numeric probe (gauss-x); G′ is always exact.
 */
export function upper(id: UpId, x: number): { G: number; Gprime: number; top: number; bottom: number; lo: number; hi: number; exact: boolean } {
  const s = UP[id];
  const lo = s.h(x);
  const hi = s.g(x);
  const top = s.f(hi) * s.gp(x);
  const bottom = s.hMoves ? s.f(lo) * s.hp(x) : 0;
  return { G: Gof(id, x), Gprime: top - bottom, top, bottom, lo, hi, exact: s.G !== null };
}

export interface Strip {
  /** the t-interval [g(x), g(x + dx)] (or the same for h), in the order of x → x + dx: lo may exceed hi */
  from: number;
  to: number;
  /** to − from ≈ g′(x)·dx */
  width: number;
  /** f at the limit, ≈ the strip's height */
  height: number;
  /** the strip's contribution to G(x + dx) − G(x): +∫ from→to f at the top, −∫ from→to f at the bottom */
  area: number;
}

/** G(x + dx) − G(x) split into the strip at the upper limit and the strip at the lower limit (zero when h is constant) */
export function upperStrip(id: UpId, x: number, dx: number): { change: number; perDx: number; top: Strip; bottom: Strip } {
  const s = UP[id];
  const g0 = s.g(x);
  const g1 = s.g(x + dx);
  const h0 = s.h(x);
  const h1 = s.h(x + dx);
  const top: Strip = { from: g0, to: g1, width: g1 - g0, height: s.f(g0), area: upArea(id, g0, g1) };
  const bottom: Strip = s.hMoves
    ? { from: h0, to: h1, width: h1 - h0, height: s.f(h0), area: -upArea(id, h0, h1) }
    : { from: h0, to: h0, width: 0, height: s.f(h0), area: 0 };
  const change = top.area + bottom.area;
  return { change, perDx: change / dx, top, bottom };
}

/** the tolerance of the task up-strip: |strip / dx − G′(x)| ≤ 1% of |G′(x)| plus an absolute 0.001 */
export const stripClose = (perDx: number, Gprime: number): boolean =>
  Number.isFinite(perDx) && Math.abs(perDx - Gprime) <= 0.01 * Math.abs(Gprime) + 0.001;
