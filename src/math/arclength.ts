/**
 * MODEL SPECIFICATION
 *
 * System:        The length of a plane curve (chapter 9.3). Three registries. AL: curves r(t) = (x(t), y(t)) on [a, b], each
 *                with its velocity, speed |r′|, exact length and (when it has a closed form) the arc-length function
 *                s(t) = ∫ₐᵗ |r′|; the inscribed polygon of n chords at equal parameter steps. RP: ONE curve with several
 *                parametrisations (the notes' (t, t²) and (t², t⁴); the circle as (cos t, sin t), (cos t², sin t²) and
 *                (cos 2t, sin 2t)), each with its own speed, s(t) and total ∫|v| (the distance travelled). PL: polar curves
 *                r = f(θ), the integrand √(r² + (dr/dθ)²), s(θ) and the total, and the little triangle with legs r dθ and dr.
 *                The core of ArcLab. Evaluated in IEEE double precision.
 * Dynamics:      none.
 * Boundary:      every closed form below (speeds, s(t), s(θ), lengths) was recomputed with sympy on 2026-11-27
 *                (screens/tools/ch9_presets.py). Every exact value a readout shows is a STORED closed form; the only value
 *                without one, the perimeter of the ellipse x²/4 + y² = 1, is stored from sympy (9.68844822054768) and the
 *                figure labels it "חישוב נומרי"; the tests check it against composite Simpson. A polygon length is a finite
 *                sum of chords, computed term by term. The limit of the polygon lengths is the length: the course states
 *                this, the tests only show the convergence (error ∝ 1/n²).
 * Ignored:       exact arithmetic; polygons with unequal parameter steps; parametrisations that are not one-to-one except
 *                `circle/twice` (named as a distance, not a length of the curve); curves off their window.
 * Valid when:    t in the preset's range; n a positive integer; θ in [0, 2π]; dθ > 0.
 * Failure modes: none on the stored ranges (every speed is continuous). The speed is 0 at t = 0 in `notes/t2` and
 *                `circle/sq` (the point starts at rest), and the cardioid integrand √(r² + (dr/dθ)²) = 2|cos(θ/2)| is 0 at θ = π
 *                (the cusp), where s(θ) is still continuous with a one-sided derivative 0. `circle` with n = 1 is a
 *                degenerate polygon (one chord from the start to itself, length 0).
 */

import { simpson } from './multivar';

export type Fn = (x: number) => number;
export type Vec2 = [number, number];
export interface Win {
  x: [number, number];
  y: [number, number];
}

const PI = Math.PI;
const TAU = 2 * Math.PI;

/** a window around the points and the origin, padded by `pad` of its size on every side */
export function boundsOf(points: readonly Vec2[], pad = 0.1): Win {
  let x0 = 0;
  let x1 = 0;
  let y0 = 0;
  let y1 = 0;
  for (const [x, y] of points) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const px = Math.max(1e-9, (x1 - x0) * pad);
  const py = Math.max(1e-9, (y1 - y0) * pad);
  return { x: [x0 - px, x1 + px], y: [y0 - py, y1 + py] };
}

const sampleOf = (r: (t: number) => Vec2, a: number, b: number, n: number): Vec2[] =>
  Array.from({ length: n + 1 }, (_, i) => r(a + ((b - a) * i) / n));

/* ------------------------------------------------------------------ AL: curves for the polygon */

export const AL_IDS = ['circle', 'parab', 'cosh', 'ellipse'] as const;
export type AlId = (typeof AL_IDS)[number];
export const isAlId = (s: unknown): s is AlId => typeof s === 'string' && (AL_IDS as readonly string[]).includes(s);

export interface AlPreset {
  id: AlId;
  /** r(t) in unicode (a readout, a select) */
  text: string;
  range: [number, number];
  r: (t: number) => Vec2;
  v: (t: number) => Vec2;
  speed: Fn;
  /** the exact length */
  length: number;
  /** the exact length as a formula; '' when the value has none (a stored numeric value) */
  lengthText: string;
  /** true when `length` is a stored sympy number, not a closed form */
  numeric: boolean;
  /** s(t) = ∫ₐᵗ speed in closed form, or null */
  s: Fn | null;
  window: Win;
}

const parabS: Fn = (t) => (t * Math.sqrt(4 * t * t + 1)) / 2 + Math.asinh(2 * t) / 4;

function makeAl(p: Omit<AlPreset, 'window'>): AlPreset {
  return { ...p, window: boundsOf(sampleOf(p.r, p.range[0], p.range[1], 240)) };
}

export const AL: Record<AlId, AlPreset> = {
  circle: makeAl({
    id: 'circle',
    text: '(cos t, sin t)',
    range: [0, TAU],
    r: (t) => [Math.cos(t), Math.sin(t)],
    v: (t) => [-Math.sin(t), Math.cos(t)],
    speed: () => 1,
    length: TAU,
    lengthText: '2π',
    numeric: false,
    s: (t) => t,
  }),
  parab: makeAl({
    id: 'parab',
    text: '(t, t²)',
    range: [0, 2],
    r: (t) => [t, t * t],
    v: (t) => [1, 2 * t],
    speed: (t) => Math.sqrt(1 + 4 * t * t),
    length: Math.sqrt(17) + Math.asinh(4) / 4,
    lengthText: '√17 + arsinh(4)/4',
    numeric: false,
    s: parabS,
  }),
  cosh: makeAl({
    id: 'cosh',
    text: '(t, cosh t)',
    range: [-1, 1],
    r: (t) => [t, Math.cosh(t)],
    v: (t) => [1, Math.sinh(t)],
    speed: (t) => Math.cosh(t),
    length: 2 * Math.sinh(1),
    lengthText: '2 sinh 1',
    numeric: false,
    s: (t) => Math.sinh(t) + Math.sinh(1),
  }),
  ellipse: makeAl({
    id: 'ellipse',
    text: '(2 cos t, sin t)',
    range: [0, TAU],
    r: (t) => [2 * Math.cos(t), Math.sin(t)],
    v: (t) => [-2 * Math.sin(t), Math.cos(t)],
    speed: (t) => Math.sqrt(1 + 3 * Math.sin(t) ** 2),
    length: 9.68844822054768,
    lengthText: '',
    numeric: true,
    s: null,
  }),
};

/** s(t) from the start: the closed form, or composite Simpson (then `exact` is false) */
export function arcTo(id: AlId, t: number): { value: number; exact: boolean } {
  const p = AL[id];
  if (p.s) return { value: p.s(t) - p.s(p.range[0]), exact: true };
  return { value: t <= p.range[0] ? 0 : simpson(p.speed, p.range[0], t, 800), exact: false };
}

/** the inscribed polygon of n chords at equal parameter steps: n + 1 vertices and the sum of the chord lengths */
export function polygon(id: AlId, n: number): { points: Vec2[]; length: number } {
  const p = AL[id];
  const m = Math.max(1, Math.round(n));
  const points = sampleOf(p.r, p.range[0], p.range[1], m);
  let length = 0;
  for (let i = 0; i < m; i++) length += Math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]);
  return { points, length };
}

export const speedAt = (id: AlId, t: number): number => AL[id].speed(t);

/* ------------------------------------------------------------------ RP: one curve, several parametrisations */

export const RP_CURVES = ['notes', 'circle'] as const;
export type RpCurve = (typeof RP_CURVES)[number];
export const RP_PARAMS: Record<RpCurve, readonly string[]> = {
  notes: ['t', 't2'],
  circle: ['t', 'sq', 'twice'],
};
export const isRpCurve = (s: unknown): s is RpCurve => typeof s === 'string' && (RP_CURVES as readonly string[]).includes(s);
export const isRpParam = (curve: RpCurve, s: unknown): s is string => typeof s === 'string' && RP_PARAMS[curve].includes(s);

export interface RpPreset {
  curve: RpCurve;
  param: string;
  /** r(t) in unicode */
  text: string;
  range: [number, number];
  r: (t: number) => Vec2;
  v: (t: number) => Vec2;
  speed: Fn;
  /** s(t) = ∫₀ᵗ speed, exact */
  s: Fn;
  /** the total ∫ speed over the range: the distance travelled */
  length: number;
  lengthText: string;
  /** the same position in the curve's first parametrisation: u = base(t); and back, t = fromBase(u) (clamped to the range) */
  base: Fn;
  fromBase: Fn;
  /** the curve itself is traced exactly once (false only for `circle/twice`) */
  once: boolean;
}

const NOTES_LEN = Math.sqrt(17) + Math.asinh(4) / 4;
const clampTo = (x: number, r: [number, number]) => Math.max(r[0], Math.min(r[1], x));

function makeRp(p: Omit<RpPreset, 'fromBase'> & { inv: Fn }): RpPreset {
  const { inv, ...rest } = p;
  return { ...rest, fromBase: (u) => clampTo(inv(u), p.range) };
}

export const RP: Record<string, RpPreset> = {
  'notes/t': makeRp({
    curve: 'notes',
    param: 't',
    text: '(t, t²)',
    range: [0, 2],
    r: (t) => [t, t * t],
    v: (t) => [1, 2 * t],
    speed: (t) => Math.sqrt(1 + 4 * t * t),
    s: parabS,
    length: NOTES_LEN,
    lengthText: '√17 + arsinh(4)/4',
    base: (t) => t,
    inv: (u) => u,
    once: true,
  }),
  'notes/t2': makeRp({
    curve: 'notes',
    param: 't2',
    text: '(t², t⁴)',
    range: [0, Math.SQRT2],
    r: (t) => [t * t, t ** 4],
    v: (t) => [2 * t, 4 * t ** 3],
    speed: (t) => 2 * t * Math.sqrt(1 + 4 * t ** 4),
    s: (t) => parabS(t * t),
    length: NOTES_LEN,
    lengthText: '√17 + arsinh(4)/4',
    base: (t) => t * t,
    inv: (u) => Math.sqrt(Math.max(0, u)),
    once: true,
  }),
  'circle/t': makeRp({
    curve: 'circle',
    param: 't',
    text: '(cos t, sin t)',
    range: [0, TAU],
    r: (t) => [Math.cos(t), Math.sin(t)],
    v: (t) => [-Math.sin(t), Math.cos(t)],
    speed: () => 1,
    s: (t) => t,
    length: TAU,
    lengthText: '2π',
    base: (t) => t,
    inv: (u) => u,
    once: true,
  }),
  'circle/sq': makeRp({
    curve: 'circle',
    param: 'sq',
    text: '(cos t², sin t²)',
    range: [0, Math.sqrt(TAU)],
    r: (t) => [Math.cos(t * t), Math.sin(t * t)],
    v: (t) => [-2 * t * Math.sin(t * t), 2 * t * Math.cos(t * t)],
    speed: (t) => 2 * t,
    s: (t) => t * t,
    length: TAU,
    lengthText: '2π',
    base: (t) => t * t,
    inv: (u) => Math.sqrt(Math.max(0, u)),
    once: true,
  }),
  'circle/twice': makeRp({
    curve: 'circle',
    param: 'twice',
    text: '(cos 2t, sin 2t)',
    range: [0, TAU],
    r: (t) => [Math.cos(2 * t), Math.sin(2 * t)],
    v: (t) => [-2 * Math.sin(2 * t), 2 * Math.cos(2 * t)],
    speed: () => 2,
    s: (t) => 2 * t,
    length: 2 * TAU,
    lengthText: '4π',
    base: (t) => 2 * t,
    inv: (u) => u / 2,
    once: false,
  }),
};

export const rpOf = (curve: RpCurve, param: string): RpPreset => RP[`${curve}/${param}`];

/** the window of a curve: that of its first parametrisation (every parametrisation traces the same set) */
export const rpWindow = (curve: RpCurve): Win => {
  const p = rpOf(curve, 't');
  return boundsOf(sampleOf(p.r, p.range[0], p.range[1], 240));
};

/** the parameter value of `to` that sits at the same position of the curve as t of `from` */
export const convertT = (curve: RpCurve, from: string, to: string, t: number): number => {
  const a = rpOf(curve, from);
  const b = rpOf(curve, to);
  return b.fromBase(a.base(t));
};

/** the largest speed on the range, sampled (for the speed graph's window) */
export function maxSpeed(p: RpPreset, n = 200): number {
  let m = 0;
  for (let i = 0; i <= n; i++) m = Math.max(m, p.speed(p.range[0] + ((p.range[1] - p.range[0]) * i) / n));
  return m;
}

/* ------------------------------------------------------------------ PL: polar curves */

export const PL_IDS = ['spiral', 'logspiral', 'cardioid'] as const;
export type PlId = (typeof PL_IDS)[number];
export const isPlId = (s: unknown): s is PlId => typeof s === 'string' && (PL_IDS as readonly string[]).includes(s);

export interface PlPreset {
  id: PlId;
  /** r = f(θ) in unicode */
  text: string;
  range: [number, number];
  f: Fn;
  /** dr/dθ */
  df: Fn;
  /** √(r² + (dr/dθ)²) in closed form */
  integrand: Fn;
  /** s(θ) = ∫₀^θ integrand in closed form */
  s: Fn;
  total: number;
  totalText: string;
  window: Win;
}

const polarPoint = (f: Fn, th: number): Vec2 => [f(th) * Math.cos(th), f(th) * Math.sin(th)];

function makePl(p: Omit<PlPreset, 'window'>): PlPreset {
  return { ...p, window: boundsOf(sampleOf((th) => polarPoint(p.f, th), p.range[0], p.range[1], 360)) };
}

export const PL: Record<PlId, PlPreset> = {
  spiral: makePl({
    id: 'spiral',
    text: 'r = θ',
    range: [0, TAU],
    f: (th) => th,
    df: () => 1,
    integrand: (th) => Math.sqrt(1 + th * th),
    s: (th) => (th * Math.sqrt(1 + th * th) + Math.asinh(th)) / 2,
    total: 21.2562941482091,
    totalText: '(2π√(1 + 4π²) + arsinh 2π)/2',
  }),
  logspiral: makePl({
    id: 'logspiral',
    text: 'r = e^(θ/5)',
    range: [0, TAU],
    f: (th) => Math.exp(th / 5),
    df: (th) => Math.exp(th / 5) / 5,
    integrand: (th) => (Math.sqrt(26) / 5) * Math.exp(th / 5),
    s: (th) => Math.sqrt(26) * (Math.exp(th / 5) - 1),
    total: 12.8168221473193,
    totalText: '√26 (e^(2π/5) − 1)',
  }),
  cardioid: makePl({
    id: 'cardioid',
    text: 'r = 1 + cos θ',
    range: [0, TAU],
    f: (th) => 1 + Math.cos(th),
    df: (th) => -Math.sin(th),
    integrand: (th) => 2 * Math.abs(Math.cos(th / 2)),
    s: (th) => (th <= PI ? 4 * Math.sin(th / 2) : 8 - 4 * Math.sin(th / 2)),
    total: 8,
    totalText: '8',
  }),
};

export const polarAt = (id: PlId, th: number): Vec2 => polarPoint(PL[id].f, th);

/**
 * The little triangle at θ: legs r dθ (around, perpendicular to the ray) and dr = r′(θ) dθ (along the ray), the hypotenuse
 * √((r dθ)² + dr²) ≈ ds. `chord` is the true distance between the points at θ and θ + dθ and `arc` the exact s(θ + dθ) − s(θ).
 */
export function polarTriangle(id: PlId, th: number, dth: number) {
  const p = PL[id];
  const around = p.f(th) * dth;
  const along = p.df(th) * dth;
  const a = polarPoint(p.f, th);
  const b = polarPoint(p.f, th + dth);
  return {
    around,
    along,
    hyp: Math.hypot(around, along),
    chord: Math.hypot(b[0] - a[0], b[1] - a[1]),
    arc: p.s(th + dth) - p.s(th),
  };
}
