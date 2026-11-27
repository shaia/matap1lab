/**
 * MODEL SPECIFICATION
 *
 * System:        Plane curves r(t) = (x(t), y(t)) with their velocity v = r′ and acceleration a = r″ (registry VC):
 *                the secant quotient (r(t + h) − r(t))/h and its limit v (9.2), the tangent line r(t) + s·v when v ≠ 0,
 *                the linear approximation r(t + h) ≈ r(t) + h·v and its error, and (9.4, enrichment) the tangent–normal
 *                frame: T = v/|v|, N toward the side the curve bends to, a = a_T T + a_N N with a_T = v·a/|v| (= d|v|/dt)
 *                and a_N = |v × a|/|v| ≥ 0, the curvature κ = |v × a|/|v|³, ρ = 1/κ and the osculating circle's centre
 *                r + ρN. The core of VelocityLab. Evaluated in IEEE double precision. A pure-geometry model: no
 *                forces, masses or units; t is a parameter.
 * Dynamics:      none.
 * Boundary:      r, v and a of every preset are STORED closed forms (checked against centralDiff in the tests, and the
 *                closed forms of κ, a_T and a_N of `spin` and `throw` against sympy on 2026-11-27,
 *                screens/tools/ch9_presets.py). Nothing here differentiates numerically; `secant` is a finite
 *                difference of the stored r by definition.
 * Ignored:       the third dimension (space curves are ParamLab's); exact arithmetic.
 * Valid when:    t in the preset's range (the closed forms are valid on all of ℝ, the figure keeps t in the range);
 *                h ≠ 0 for `secant` and `linearError`.
 * Failure modes: at v = 0 (the cusp of `cusp` at t = 0, the points t = 2πk of `cycloid`) the direction of the tangent is
 *                NOT given by v: `tangentLine` returns null and `frame` returns every field null (T, N, a_T, a_N, κ, ρ,
 *                centre; the speed is 0). At κ = 0 (a straight stretch) `frame` has N, κ-radius ρ and centre null while
 *                T and a_T stay defined (a_N = 0). A zero chord (Δr = 0) has no direction: `angleBetween` returns null.
 */

export type Vec2 = [number, number];
export type VcId = 'parab' | 'cusp' | 'circle' | 'ellipse' | 'throw' | 'cycloid' | 'spin';

export interface VcPreset {
  /** the parametrisation, TeX */
  tex: string;
  /** the same in plain text (select option, aria label) */
  text: string;
  r: (t: number) => Vec2;
  v: (t: number) => Vec2;
  a: (t: number) => Vec2;
  /** the parameter interval */
  range: [number, number];
  /** the starting t of the figure */
  t0: number;
  /** a window the curve and its arrows fit in: the figure keeps equal scales, so it only uses its aspect */
  window: { x: [number, number]; y: [number, number] };
  /** world length per unit of velocity / of acceleration for the arrows: fixed per preset and printed by the figure */
  vScale: number;
  aScale: number;
  /** the parameters in the range where v = 0 (empty when the speed never vanishes) */
  vZeros: readonly number[];
  /** seconds a play loop takes over the whole range */
  seconds: number;
}

const TAU = 2 * Math.PI;
const cos = Math.cos;
const sin = Math.sin;

export const VC: Record<VcId, VcPreset> = {
  parab: {
    tex: '\\vec r(t) = (t,\\ t^2)',
    text: '(t, t²)',
    r: (t) => [t, t * t],
    v: (t) => [1, 2 * t],
    a: () => [0, 2],
    range: [-1.5, 1.5],
    t0: 0.5,
    window: { x: [-2, 2], y: [-0.4, 2.8] },
    vScale: 0.4,
    aScale: 0.4,
    vZeros: [],
    seconds: 6,
  },
  cusp: {
    tex: '\\vec r(t) = (t^2,\\ t^3)',
    text: '(t², t³)',
    r: (t) => [t * t, t * t * t],
    v: (t) => [2 * t, 3 * t * t],
    a: (t) => [2, 6 * t],
    range: [-1.2, 1.2],
    t0: 0.5,
    window: { x: [-0.4, 2], y: [-2.2, 2.2] },
    vScale: 0.3,
    aScale: 0.2,
    vZeros: [0],
    seconds: 6,
  },
  circle: {
    tex: '\\vec r(t) = (2\\cos t,\\ 2\\sin t)',
    text: '(2cos t, 2sin t)',
    r: (t) => [2 * cos(t), 2 * sin(t)],
    v: (t) => [-2 * sin(t), 2 * cos(t)],
    a: (t) => [-2 * cos(t), -2 * sin(t)],
    range: [0, TAU],
    t0: 0.8,
    window: { x: [-3, 3], y: [-3, 3] },
    vScale: 0.6,
    aScale: 0.6,
    vZeros: [],
    seconds: 8,
  },
  ellipse: {
    tex: '\\vec r(t) = (2\\cos t,\\ \\sin t)',
    text: '(2cos t, sin t)',
    r: (t) => [2 * cos(t), sin(t)],
    v: (t) => [-2 * sin(t), cos(t)],
    a: (t) => [-2 * cos(t), -sin(t)],
    range: [0, TAU],
    t0: 0.8,
    window: { x: [-3, 3], y: [-1.8, 1.8] },
    vScale: 0.6,
    aScale: 0.6,
    vZeros: [],
    seconds: 8,
  },
  throw: {
    tex: '\\vec r(t) = (6t,\\ 8t - 5t^2)',
    text: '(6t, 8t − 5t²)',
    r: (t) => [6 * t, 8 * t - 5 * t * t],
    v: (t) => [6, 8 - 10 * t],
    a: () => [0, -10],
    range: [0, 1.6],
    t0: 0.4,
    window: { x: [-0.6, 10.2], y: [-1.2, 4.4] },
    vScale: 0.2,
    aScale: 0.1,
    vZeros: [],
    seconds: 3,
  },
  cycloid: {
    tex: '\\vec r(t) = (t - \\sin t,\\ 1 - \\cos t)',
    text: '(t − sin t, 1 − cos t)',
    r: (t) => [t - sin(t), 1 - cos(t)],
    v: (t) => [1 - cos(t), sin(t)],
    a: (t) => [sin(t), cos(t)],
    range: [0, 2 * TAU],
    t0: 1,
    window: { x: [-0.6, 13.2], y: [-0.4, 2.8] },
    vScale: 0.6,
    aScale: 0.6,
    vZeros: [0, TAU, 2 * TAU],
    seconds: 10,
  },
  spin: {
    tex: '\\vec r(t) = (2\\cos\\tfrac{t^2}{2},\\ 2\\sin\\tfrac{t^2}{2})',
    text: '(2cos(t²/2), 2sin(t²/2))',
    r: (t) => [2 * cos((t * t) / 2), 2 * sin((t * t) / 2)],
    v: (t) => [-2 * t * sin((t * t) / 2), 2 * t * cos((t * t) / 2)],
    a: (t) => {
      const p = (t * t) / 2;
      return [-2 * sin(p) - 2 * t * t * cos(p), 2 * cos(p) - 2 * t * t * sin(p)];
    },
    range: [0, 3.5],
    t0: 1.5,
    window: { x: [-3, 3], y: [-3, 3] },
    vScale: 0.3,
    aScale: 0.08,
    vZeros: [0],
    seconds: 6,
  },
};

export const VC_IDS = Object.keys(VC) as VcId[];
export const isVcId = (s: unknown): s is VcId => typeof s === 'string' && s in VC;

/** below this speed v is treated as the zero vector (the direction of motion is undefined) */
export const V_ZERO = 1e-9;

const len = (u: Vec2) => Math.hypot(u[0], u[1]);
const dot = (u: Vec2, w: Vec2) => u[0] * w[0] + u[1] * w[1];
/** the z-component of u × w for plane vectors */
const crossZ = (u: Vec2, w: Vec2) => u[0] * w[1] - u[1] * w[0];

export const speed = (id: VcId, t: number): number => len(VC[id].v(t));

/** the angle in degrees between two vectors (0…180), or null when either is zero */
export function angleBetween(u: Vec2, w: Vec2): number | null {
  const lu = len(u);
  const lw = len(w);
  if (lu < V_ZERO || lw < V_ZERO) return null;
  const c = Math.max(-1, Math.min(1, dot(u, w) / (lu * lw)));
  return (Math.acos(c) * 180) / Math.PI;
}

export interface Secant {
  /** r(t) */
  p: Vec2;
  /** r(t + h) */
  q: Vec2;
  /** the chord Δr = q − p */
  dr: Vec2;
  /** the average velocity Δr / h */
  quotient: Vec2;
}

/** the chord from r(t) to r(t + h) and the average velocity over [t, t + h] (h ≠ 0, either sign) */
export function secant(id: VcId, t: number, h: number): Secant {
  const p = VC[id].r(t);
  const q = VC[id].r(t + h);
  const dr: Vec2 = [q[0] - p[0], q[1] - p[1]];
  return { p, q, dr, quotient: [dr[0] / h, dr[1] / h] };
}

/** the tangent line r(t) + s·v(t): a point and a direction, or null when v = 0 (v then gives no direction) */
export function tangentLine(id: VcId, t: number): { point: Vec2; dir: Vec2 } | null {
  const v = VC[id].v(t);
  if (len(v) < V_ZERO) return null;
  return { point: VC[id].r(t), dir: v };
}

/** the error of the linear approximation: |r(t + h) − (r(t) + h·v(t))| */
export function linearError(id: VcId, t: number, h: number): number {
  const s = VC[id];
  const p = s.r(t);
  const v = s.v(t);
  const q = s.r(t + h);
  return Math.hypot(q[0] - (p[0] + h * v[0]), q[1] - (p[1] + h * v[1]));
}

export interface Frame {
  /** unit tangent T = v/|v| */
  T: Vec2 | null;
  /** unit normal, toward the side the curve bends to (null on a straight stretch) */
  N: Vec2 | null;
  /** a_T = v·a/|v|, signed (= d|v|/dt) */
  aT: number | null;
  /** a_N = |v × a|/|v| ≥ 0 */
  aN: number | null;
  /** κ = |v × a|/|v|³ */
  kappa: number | null;
  /** ρ = 1/κ (null where κ = 0) */
  rho: number | null;
  /** the osculating circle's centre r + ρN */
  centre: Vec2 | null;
}

const NO_FRAME: Frame = { T: null, N: null, aT: null, aN: null, kappa: null, rho: null, centre: null };

/** the tangent–normal frame of a motion with position r, velocity v and acceleration a (see `frame`) */
export function frameFrom(r: Vec2, v: Vec2, a: Vec2): Frame {
  const sp = len(v);
  if (sp < V_ZERO) return NO_FRAME;
  const T: Vec2 = [v[0] / sp, v[1] / sp];
  const aT = dot(v, a) / sp;
  const c = crossZ(v, a);
  const aN = Math.abs(c) / sp;
  const kappa = Math.abs(c) / (sp * sp * sp);
  if (Math.abs(c) < 1e-12 * sp * sp * sp) return { T, N: null, aT, aN: 0, kappa: 0, rho: null, centre: null };
  // the curve bends left of T when v × a > 0: N = T turned by +90°, otherwise by −90°
  const N: Vec2 = c > 0 ? [-T[1], T[0]] : [T[1], -T[0]];
  const rho = 1 / kappa;
  return { T, N, aT, aN, kappa, rho, centre: [r[0] + rho * N[0], r[1] + rho * N[1]] };
}

/** the tangent–normal frame at t; every field null at v = 0, N / ρ / centre null where κ = 0 */
export function frame(id: VcId, t: number): Frame {
  const s = VC[id];
  return frameFrom(s.r(t), s.v(t), s.a(t));
}
