/**
 * MODEL SPECIFICATION
 *
 * System:        two integration methods shown as areas. Chapter 7.2 (substitution) and 7.3 (integration by parts),
 *                MethodLab's core.
 *                SUBSTITUTION. A preset is an integrand h(x) = f(g(x))·g′(x) on an x-window where g is increasing.
 *                The same area is read in two planes: under h over [a, x], and under f over [g(a), g(x)]. The theorem
 *                the figure shows is ∫ₐˣ f(g(t))·g′(t) dt = ∫_{g(a)}^{g(x)} f(u) du.
 *                BY PARTS. A preset is a curve (u(t), v(t)), t ∈ [tLo, tHi], with u and v both increasing and
 *                non-negative. For t0 ≤ T the two regions are ∫u dv (between the curve and the v-axis, v from v(t0) to
 *                v(T)) and ∫v du (between the curve and the u-axis, u from u(t0) to u(T)); with the small rectangle
 *                [0, u(t0)]×[0, v(t0)] they tile the rectangle [0, u(T)]×[0, v(T)], so
 *                ∫u dv + ∫v du = u(T)v(T) − u(t0)v(t0): the rule ∫u dv = uv − ∫v du, as areas.
 * Dynamics:      none.
 * Boundary:      every area is STORED in closed form (Fu, H for substitution; Gudv, Gvdu for parts), recomputed with
 *                sympy on 2026-11-27 (screens/tools/ch7_presets.py) and checked again by tests/math/intmethods.test.ts
 *                against derivatives (centralDiff) and Simpson sums. Nothing the figure shows is inferred from sampling.
 *                `H` (an antiderivative of h in x) is written independently of `Fu`, so that H(x) = Fu(g(x)) is a
 *                checked fact (the substitution theorem), not a definition.
 *                A "strip" [x, x + dx] has the exact areas ax (under h) and au (under f over [g(x), g(x+dx)]), which
 *                are equal; the thin-rectangle areas rx = h(x)·dx and ru = f(g(x))·du, du = g(x+dx) − g(x), are not,
 *                and their ratio ru/rx = du/(g′(x)·dx) tends to 1 as dx → 0: "du is g′(x)·dx".
 * Ignored:       exact arithmetic; the figure never shows a value outside the preset's window.
 * Valid when:    x, a in the preset's x-window (substitution); tLo ≤ t0 ≤ T ≤ tHi (parts).
 * Failure modes: the strip ratio is 0/0 where h(x) = 0 (NaN is returned); a strip that runs past the right end of the
 *                window has g(x + dx) outside the u-window (the figure clamps dx there).
 */

import { bisect } from './analysis';

export type Fn = (x: number) => number;

const PI = Math.PI;

/* ---------------------------------------------------------------- substitution */

export type SubId = 'xcosx2' | 'xexp' | 'sincos' | 'lin' | 'sqrt';

export interface SubSpec {
  id: SubId;
  /** plain labels (no TeX) */
  text: string;
  hText: string;
  gText: string;
  gpText: string;
  fText: string;
  FuText: string;
  /** "u = x², du = 2x dx" */
  formula: string;
  /** the integrand h(x) = f(g(x))·g′(x) */
  h: Fn;
  /** the inner function u = g(x), its derivative, the outer function f and its antiderivative Fu */
  g: Fn;
  gp: Fn;
  f: Fn;
  Fu: Fn;
  /** an antiderivative of h in x, written independently of Fu */
  H: Fn;
  /** the x-window (g increasing on it) and the u-window [g(lo), g(hi)] */
  x: [number, number];
  u: [number, number];
  /** y-windows for h and for f */
  hy: [number, number];
  fy: [number, number];
  /** starting a and x */
  a0: number;
  x0: number;
}

function sub(s: Omit<SubSpec, 'u'>): SubSpec {
  return { ...s, u: [s.g(s.x[0]), s.g(s.x[1])] };
}

export const SUB: Record<SubId, SubSpec> = {
  xcosx2: sub({
    id: 'xcosx2',
    text: '∫ 2x·cos(x²) dx',
    hText: '2x·cos(x²)',
    gText: 'x²',
    gpText: '2x',
    fText: 'cos u',
    FuText: 'sin u',
    formula: 'u = x², du = 2x dx',
    h: (x) => 2 * x * Math.cos(x * x),
    g: (x) => x * x,
    gp: (x) => 2 * x,
    f: (u) => Math.cos(u),
    Fu: (u) => Math.sin(u),
    H: (x) => Math.sin(x * x),
    x: [0, 2.5],
    hy: [-4.5, 5.5],
    fy: [-1.3, 1.3],
    a0: 0,
    x0: 1.2,
  }),
  xexp: sub({
    id: 'xexp',
    text: '∫ 2x·e^(−x²) dx',
    hText: '2x·e^(−x²)',
    gText: 'x²',
    gpText: '2x',
    fText: 'e^(−u)',
    FuText: '−e^(−u)',
    formula: 'u = x², du = 2x dx',
    h: (x) => 2 * x * Math.exp(-x * x),
    g: (x) => x * x,
    gp: (x) => 2 * x,
    f: (u) => Math.exp(-u),
    Fu: (u) => -Math.exp(-u),
    H: (x) => -Math.exp(-x * x),
    x: [0, 2.5],
    hy: [-0.2, 1.1],
    fy: [-0.2, 1.2],
    a0: 0,
    x0: 1,
  }),
  sincos: sub({
    id: 'sincos',
    text: '∫ sin x·cos x dx',
    hText: 'sin x·cos x',
    gText: 'sin x',
    gpText: 'cos x',
    fText: 'u',
    FuText: 'u²/2',
    formula: 'u = sin x, du = cos x dx',
    h: (x) => Math.sin(x) * Math.cos(x),
    g: (x) => Math.sin(x),
    gp: (x) => Math.cos(x),
    f: (u) => u,
    Fu: (u) => (u * u) / 2,
    H: (x) => Math.sin(x) ** 2 / 2,
    x: [0, PI / 2],
    hy: [-0.1, 0.6],
    fy: [-0.1, 1.1],
    a0: 0,
    x0: 0.8,
  }),
  lin: sub({
    id: 'lin',
    text: '∫ 2(2x + 1)³ dx',
    hText: '2(2x + 1)³',
    gText: '2x + 1',
    gpText: '2',
    fText: 'u³',
    FuText: 'u⁴/4',
    formula: 'u = 2x + 1, du = 2 dx',
    h: (x) => 2 * (2 * x + 1) ** 3,
    g: (x) => 2 * x + 1,
    gp: () => 2,
    f: (u) => u ** 3,
    Fu: (u) => u ** 4 / 4,
    H: (x) => (2 * x + 1) ** 4 / 4,
    x: [-0.5, 1],
    hy: [-5, 60],
    fy: [-3, 30],
    a0: -0.5,
    x0: 0.5,
  }),
  sqrt: sub({
    id: 'sqrt',
    text: '∫ x/√(1 + x²) dx',
    hText: 'x/√(1 + x²)',
    gText: '1 + x²',
    gpText: '2x',
    fText: '1/(2√u)',
    FuText: '√u',
    formula: 'u = 1 + x², du = 2x dx',
    h: (x) => x / Math.sqrt(1 + x * x),
    g: (x) => 1 + x * x,
    gp: (x) => 2 * x,
    f: (u) => 1 / (2 * Math.sqrt(u)),
    Fu: (u) => Math.sqrt(u),
    H: (x) => Math.sqrt(1 + x * x),
    x: [0, 3],
    hy: [-0.15, 1.1],
    fy: [-0.1, 0.6],
    a0: 0,
    x0: 1.5,
  }),
};

export const SUB_IDS = Object.keys(SUB) as SubId[];
export const isSubId = (s: unknown): s is SubId => typeof s === 'string' && s in SUB;

/** the two areas of the substitution picture: under h over [a, x], under f over [g(a), g(x)]; equal by the theorem */
export function substAreas(id: SubId, a: number, x: number): { xArea: number; uArea: number } {
  const s = SUB[id];
  return { xArea: s.H(x) - s.H(a), uArea: s.Fu(s.g(x)) - s.Fu(s.g(a)) };
}

export interface StripPair {
  dx: number;
  /** the image width g(x + dx) − g(x) */
  du: number;
  /** exact strip areas: under h over [x, x+dx], under f over [g(x), g(x+dx)] (equal) */
  ax: number;
  au: number;
  /** thin-rectangle areas h(x)·dx and f(g(x))·du */
  rx: number;
  ru: number;
  /** du / dx (→ g′(x)) */
  widthRatio: number;
  /** ru / rx = du / (g′(x)·dx) (→ 1); NaN where h(x) = 0 */
  ratio: number;
}

export function stripPair(id: SubId, x: number, dx: number): StripPair {
  const s = SUB[id];
  const u = s.g(x);
  const du = s.g(x + dx) - u;
  const rx = s.h(x) * dx;
  const ru = s.f(u) * du;
  return {
    dx,
    du,
    ax: s.H(x + dx) - s.H(x),
    au: s.Fu(s.g(x + dx)) - s.Fu(u),
    rx,
    ru,
    widthRatio: du / dx,
    ratio: Math.abs(rx) < 1e-12 ? NaN : ru / rx,
  };
}

/** x with g(x) = u inside the preset's window (u clamped to the u-window): the right panel's drag */
export function invG(id: SubId, u: number): number {
  const s = SUB[id];
  const uc = Math.max(s.u[0], Math.min(s.u[1], u));
  return bisect((x) => s.g(x) - uc, s.x[0], s.x[1], 1e-12);
}

/* ---------------------------------------------------------------- integration by parts */

export type PartsId = 'xex' | 'lnx' | 'xsin' | 'atan';

export interface PartsSpec {
  id: PartsId;
  /** plain labels (no TeX) */
  text: string;
  uText: string;
  vText: string;
  /** "u = x, dv = eˣ dx" */
  uvText: string;
  /** a remark for the readout, or null */
  note: string | null;
  u: Fn;
  v: Fn;
  /** u′(t), v′(t) */
  up: Fn;
  vp: Fn;
  /** antiderivatives in t of u·v′ (the region ∫u dv) and of v·u′ (the region ∫v du) */
  Gudv: Fn;
  Gvdu: Fn;
  /** the t-range of the slider and the starting T */
  t: [number, number];
  T0: number;
}

export const PARTS: Record<PartsId, PartsSpec> = {
  xex: {
    id: 'xex',
    text: '∫ x·eˣ dx',
    uText: 'x',
    vText: 'eˣ',
    uvText: 'u = x, dv = eˣ dx',
    note: null,
    u: (t) => t,
    v: (t) => Math.exp(t),
    up: () => 1,
    vp: (t) => Math.exp(t),
    Gudv: (t) => (t - 1) * Math.exp(t),
    Gvdu: (t) => Math.exp(t),
    t: [0, 2],
    T0: 1.5,
  },
  lnx: {
    id: 'lnx',
    text: '∫ ln x dx',
    uText: 'ln x',
    vText: 'x',
    uvText: 'u = ln x, dv = dx',
    note: null,
    u: (t) => Math.log(t),
    v: (t) => t,
    up: (t) => 1 / t,
    vp: () => 1,
    Gudv: (t) => t * Math.log(t) - t,
    Gvdu: (t) => t,
    t: [1, 4],
    T0: 3,
  },
  xsin: {
    id: 'xsin',
    text: '∫ x·sin x dx',
    uText: 'x',
    vText: '1 − cos x',
    uvText: 'u = x, dv = sin x dx',
    note: 'כאן v = 1 − cos x, פונקציה קדומה של sin x שמתחילה ב-0. כל פונקציה קדומה אחרת מתאימה (‎−cos x, למשל, נבדלת ממנה בקבוע 1).',
    u: (t) => t,
    v: (t) => 1 - Math.cos(t),
    up: () => 1,
    vp: (t) => Math.sin(t),
    Gudv: (t) => Math.sin(t) - t * Math.cos(t),
    Gvdu: (t) => t - Math.sin(t),
    t: [0, PI],
    T0: 2,
  },
  atan: {
    id: 'atan',
    text: '∫ arctan x dx',
    uText: 'arctan x',
    vText: 'x',
    uvText: 'u = arctan x, dv = dx',
    note: null,
    u: (t) => Math.atan(t),
    v: (t) => t,
    up: (t) => 1 / (1 + t * t),
    vp: () => 1,
    Gudv: (t) => t * Math.atan(t) - Math.log(1 + t * t) / 2,
    Gvdu: (t) => Math.log(1 + t * t) / 2,
    t: [0, 3],
    T0: 2,
  },
};

export const PARTS_IDS = Object.keys(PARTS) as PartsId[];
export const isPartsId = (s: unknown): s is PartsId => typeof s === 'string' && s in PARTS;

/** the two regions' areas from t0 to T, and the rectangle difference u(T)v(T) − u(t0)v(t0); udv + vdu = rect */
export function partsAreas(id: PartsId, t0: number, T: number): { udv: number; vdu: number; rect: number } {
  const s = PARTS[id];
  return {
    udv: s.Gudv(T) - s.Gudv(t0),
    vdu: s.Gvdu(T) - s.Gvdu(t0),
    rect: s.u(T) * s.v(T) - s.u(t0) * s.v(t0),
  };
}

/** t with u(t) = target on the preset's t-range (target clamped): the drag of T along the curve */
export function tOfU(id: PartsId, target: number): number {
  const s = PARTS[id];
  const tc = Math.max(s.u(s.t[0]), Math.min(s.u(s.t[1]), target));
  return bisect((t) => s.u(t) - tc, s.t[0], s.t[1], 1e-12);
}
