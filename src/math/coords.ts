/**
 * Plane polar, cylindrical and spherical coordinates (lessons 2.3 and 2.4): conversions both ways, the quadrant
 * trap of arctan, polar curves r = f(θ), polar regions, the coordinate surfaces, a few solids, and the translation of
 * the lecture notes' spherical convention. The figure CoordinateLab draws these; the lessons' worked examples and
 * workbook recompute with them. Unit vectors r̂, θ̂ and the elements dA, dV belong to chapters 9 and 12 and are not here.
 *
 * MODEL SPECIFICATION
 * - System: points of the plane and of space, in any length unit. Plane polar (r, θ): x = r cos θ, y = r sin θ, θ
 *   counter-clockwise from +x. Cylindrical (r, θ, z): x = r cos θ, y = r sin θ, z = z; r is the distance from the
 *   z-axis. Spherical (r, θ, φ), the physics convention of this course: r the distance from the origin, θ ∈ [0, π]
 *   the angle FROM THE POSITIVE z-AXIS, φ the azimuth in the xy-plane from +x counter-clockwise:
 *   x = r sin θ cos φ, y = r sin θ sin φ, z = r cos θ. The cylindrical r equals r sin θ of the spherical system, and
 *   the cylindrical θ is the spherical φ.
 * - The lecture notes (pp. 29, 34) use (ρ, θ, φ) with φ a LATITUDE above the xy-plane, −π/2 ≤ φ ≤ π/2, and θ the
 *   azimuth: z = ρ sin φ. `fromNotesSpherical` / `toNotesSpherical` translate: course θ = π/2 − latitude, course
 *   φ = notes θ.
 * - Ranges returned by the conversions: r ≥ 0; plane polar and cylindrical θ in [0, 2π) (the course fixes the
 *   interval [0, 2π); `toPolar(p, 'pm-pi')` gives (−π, π]); spherical θ in [0, π], φ in [0, 2π).
 * - Polar curves r = f(θ) are drawn over a stated θ range on which f ≥ 0: THE COURSE KEEPS r ≥ 0 (the glossary
 *   defines r = √(x² + y²) ≥ 0), so a curve whose f changes sign is given only on the part where f ≥ 0 (a rose petal,
 *   the circle r = 2 cos θ on [−π/2, π/2]); a negative r is never plotted by reflection through the origin.
 * - A region a ≤ r ≤ b, α ≤ β is the set of points with r in [a, b] and some θ + 2πk in [α, β]; a sweep β − α ≥ 2π
 *   covers every direction.
 * - Ignored: nothing physical; this is geometry.
 * - Valid when: r > 0 for the angle θ of the plane to be defined; r > 0 and 0 < θ < π for the azimuth φ of the
 *   spherical system to be defined.
 * - Failure modes: at the origin (all systems) and on the z-axis (cylindrical θ, spherical φ; at the origin also the
 *   spherical θ) the angle is not defined: the functions return 0 for it, and `isAngleDefined*` says so. The naive
 *   arctan(y/x) is NaN at x = 0. Floating-point: an angle that should be a multiple of π/12 is recognised to 1e-9.
 */

import type { Vec2, Vec3 } from './vec';

export type { Vec2, Vec3 };

const TAU = 2 * Math.PI;
const EPS = 1e-9;

/** an angle in [0, 2π) */
export const wrap2pi = (t: number): number => {
  const w = ((t % TAU) + TAU) % TAU;
  return w >= TAU - 1e-15 ? 0 : w;
};

/** θ in degrees, in [0, 360) */
export const degrees360 = (theta: number): number => (wrap2pi(theta) * 180) / Math.PI;

/* ------------------------------------------------------------------ plane polar */

export const fromPolar = (r: number, theta: number): Vec2 => [r * Math.cos(theta), r * Math.sin(theta)];

/** r = √(x² + y²) and θ by atan2, so the quadrant is right: θ in [0, 2π) or, with 'pm-pi', in (−π, π]. */
export function toPolar(p: Vec2, range: '0-2pi' | 'pm-pi' = '0-2pi'): { r: number; theta: number } {
  const t = Math.atan2(p[1], p[0]);
  return { r: Math.hypot(p[0], p[1]), theta: range === '0-2pi' ? wrap2pi(t) : t };
}

/** The trap: arctan(y/x). NaN at x = 0. It lies in (−π/2, π/2): only quadrants I and IV. */
export const arctanNaive = (x: number, y: number): number => (x === 0 ? NaN : Math.atan(y / x));

/**
 * The correct θ in [0, 2π) built the way a student should: arctan(y/x) fixed by the quadrant (x < 0: add π; x > 0 and
 * y < 0: add 2π). On the y-axis (x = 0) it is π/2 or 3π/2. At the origin it is 0 (undefined).
 */
export function polarAngleByQuadrant(x: number, y: number): number {
  if (x === 0) return y > 0 ? Math.PI / 2 : y < 0 ? 3 * Math.PI / 2 : 0;
  const a = Math.atan(y / x);
  if (x < 0) return a + Math.PI;
  return y < 0 ? a + TAU : a;
}

export type Quadrant = { kind: 'quadrant'; n: 1 | 2 | 3 | 4 } | { kind: 'axis'; axis: '+x' | '+y' | '-x' | '-y' } | { kind: 'origin' };

/** The quadrant of (x, y), by the signs (an axis point is on no quadrant). */
export function quadrantOf(x: number, y: number): Quadrant {
  if (x === 0 && y === 0) return { kind: 'origin' };
  if (y === 0) return { kind: 'axis', axis: x > 0 ? '+x' : '-x' };
  if (x === 0) return { kind: 'axis', axis: y > 0 ? '+y' : '-y' };
  if (x > 0) return { kind: 'quadrant', n: y > 0 ? 1 : 4 };
  return { kind: 'quadrant', n: y > 0 ? 2 : 3 };
}

/* ------------------------------------------------------------------ cylindrical */

export const fromCylindrical = (r: number, theta: number, z: number): Vec3 => [r * Math.cos(theta), r * Math.sin(theta), z];

export function toCylindrical(p: Vec3): { r: number; theta: number; z: number } {
  return { r: Math.hypot(p[0], p[1]), theta: wrap2pi(Math.atan2(p[1], p[0])), z: p[2] };
}

/** the cylindrical θ is undefined on the z-axis */
export const isAngleDefinedCyl = (p: Vec3): boolean => Math.hypot(p[0], p[1]) > EPS;

/* ------------------------------------------------------------------ spherical (the course's convention) */

export const fromSpherical = (r: number, theta: number, phi: number): Vec3 => [
  r * Math.sin(theta) * Math.cos(phi),
  r * Math.sin(theta) * Math.sin(phi),
  r * Math.cos(theta),
];

/** r ≥ 0, θ = arccos(z/r) in [0, π] from +z, φ in [0, 2π) (0 where undefined). */
export function toSpherical(p: Vec3): { r: number; theta: number; phi: number } {
  const r = Math.hypot(p[0], p[1], p[2]);
  if (r === 0) return { r: 0, theta: 0, phi: 0 };
  const theta = Math.acos(Math.max(-1, Math.min(1, p[2] / r)));
  return { r, theta, phi: wrap2pi(Math.atan2(p[1], p[0])) };
}

/** the spherical φ is undefined on the z-axis (and at the origin) */
export const isAngleDefinedSph = (p: Vec3): boolean => Math.hypot(p[0], p[1]) > EPS;

/** the distance from the z-axis of a spherical point: the cylindrical r = r sin θ */
export const cylindricalRadiusOf = (r: number, theta: number): number => r * Math.sin(theta);

/** the latitude above the xy-plane, π/2 − θ: the angle of the lecture notes */
export const latitudeOf = (theta: number): number => Math.PI / 2 - theta;

/** A point given in the notes' convention (ρ, azimuth θ, latitude φ) in Cartesian coordinates. */
export const fromNotesSpherical = (rho: number, azimuth: number, latitude: number): Vec3 => [
  rho * Math.cos(latitude) * Math.cos(azimuth),
  rho * Math.cos(latitude) * Math.sin(azimuth),
  rho * Math.sin(latitude),
];

/** The notes' (ρ, azimuth, latitude) of a point: latitude in [−π/2, π/2], azimuth in [0, 2π). */
export function toNotesSpherical(p: Vec3): { rho: number; azimuth: number; latitude: number } {
  const s = toSpherical(p);
  return { rho: s.r, azimuth: s.phi, latitude: latitudeOf(s.theta) };
}

/** The notes' (ρ, azimuth, latitude) as this course's (r, θ, φ): θ = π/2 − latitude, φ = azimuth. */
export const notesToCourse = (rho: number, azimuth: number, latitude: number): { r: number; theta: number; phi: number } => ({
  r: rho,
  theta: Math.PI / 2 - latitude,
  phi: azimuth,
});

/* ------------------------------------------------------------------ polar curves r = f(θ) */

export type CurveKey = 'circle' | 'ray' | 'cos' | 'sin' | 'cardioid' | 'spiral' | 'petal' | 'vline' | 'hline';

export interface PolarCurve {
  /** the equation as the student writes it */
  equation: string;
  /** the Cartesian equation when it is simple, else null */
  cartesian: string | null;
  /** the θ range [from, to] on which the curve is drawn (f ≥ 0 on it); for the ray the range of r instead */
  range: readonly [number, number];
  /** r as a function of θ; for the ray a function of r, returning the fixed angle */
  r: (theta: number) => number;
  /** a ray θ = c: the curve is traced by r, not by θ */
  ray?: boolean;
}

export const POLAR_CURVES: Record<CurveKey, PolarCurve> = {
  circle: { equation: 'r = 2', cartesian: 'x² + y² = 4', range: [0, TAU], r: () => 2 },
  ray: { equation: 'θ = π/4', cartesian: 'y = x, x ≥ 0', range: [0, 3], r: () => Math.PI / 4, ray: true },
  cos: { equation: 'r = 2cos θ', cartesian: '(x − 1)² + y² = 1', range: [-Math.PI / 2, Math.PI / 2], r: (t) => 2 * Math.cos(t) },
  sin: { equation: 'r = 2sin θ', cartesian: 'x² + (y − 1)² = 1', range: [0, Math.PI], r: (t) => 2 * Math.sin(t) },
  cardioid: { equation: 'r = 1 + cos θ', cartesian: null, range: [0, TAU], r: (t) => 1 + Math.cos(t) },
  spiral: { equation: 'r = θ/4', cartesian: null, range: [0, 4 * Math.PI], r: (t) => t / 4 },
  petal: { equation: 'r = 2cos 2θ', cartesian: null, range: [-Math.PI / 4, Math.PI / 4], r: (t) => 2 * Math.cos(2 * t) },
  vline: { equation: 'r = 1/cos θ', cartesian: 'x = 1', range: [-Math.PI / 3, Math.PI / 3], r: (t) => 1 / Math.cos(t) },
  hline: { equation: 'r = 2/sin θ', cartesian: 'y = 2', range: [Math.PI / 4, (3 * Math.PI) / 4], r: (t) => 2 / Math.sin(t) },
};

export const CURVE_KEYS = Object.keys(POLAR_CURVES) as CurveKey[];

/** The point of the curve at parameter t (θ; for the ray, r): its polar (r, θ) and Cartesian (x, y). */
export function curvePoint(key: CurveKey, t: number): { r: number; theta: number; x: number; y: number } {
  const c = POLAR_CURVES[key];
  const r = c.ray ? t : c.r(t);
  const theta = c.ray ? c.r(t) : t;
  const [x, y] = fromPolar(r, theta);
  return { r, theta, x, y };
}

/** Residual of the curve's Cartesian equation at (x, y), in the form lhs − rhs; null when the curve has none. */
export function cartesianResidual(key: CurveKey, x: number, y: number): number | null {
  switch (key) {
    case 'circle':
      return x * x + y * y - 4;
    case 'ray':
      return y - x;
    case 'cos':
      return (x - 1) ** 2 + y * y - 1;
    case 'sin':
      return x * x + (y - 1) ** 2 - 1;
    case 'vline':
      return x - 1;
    case 'hline':
      return y - 2;
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ plane regions in polar coordinates */

export interface PolarRegion {
  a: number;
  b: number;
  alpha: number;
  beta: number;
}

/** whether some θ + 2πk lies in [alpha, beta] */
export function angleInRange(theta: number, alpha: number, beta: number): boolean {
  if (beta - alpha >= TAU - EPS) return true;
  const k = Math.ceil((alpha - theta - EPS) / TAU);
  return theta + k * TAU <= beta + EPS;
}

/** whether (x, y) is in the region a ≤ r ≤ b, α ≤ θ ≤ β (the origin counts when a = 0) */
export function inRegion(x: number, y: number, reg: PolarRegion): boolean {
  const r = Math.hypot(x, y);
  if (r < reg.a - EPS || r > reg.b + EPS) return false;
  if (r < EPS) return reg.a <= EPS;
  return angleInRange(Math.atan2(y, x), reg.alpha, reg.beta);
}

export type RegionKind = 'empty' | 'disc' | 'annulus' | 'sector' | 'annular-sector';

export function regionKind(reg: PolarRegion): RegionKind {
  if (reg.b < reg.a - EPS || reg.b <= EPS || reg.beta < reg.alpha - EPS) return 'empty';
  const full = reg.beta - reg.alpha >= TAU - EPS;
  const fromOrigin = reg.a <= EPS;
  if (full) return fromOrigin ? 'disc' : 'annulus';
  return fromOrigin ? 'sector' : 'annular-sector';
}

/* ------------------------------------------------------------------ coordinate surfaces */

export type SurfaceKind = 'cylinder' | 'half-plane' | 'plane' | 'sphere' | 'cone' | 'axis' | 'xy-plane' | 'point';

/** Cylindrical r = c: a cylinder around the z-axis (the axis itself when c = 0). */
export const cylSurfaceR = (c: number): SurfaceKind => (c <= EPS ? 'axis' : 'cylinder');
/** Cylindrical θ = c: a half-plane bounded by the z-axis. */
export const cylSurfaceTheta = (): SurfaceKind => 'half-plane';
/** Cylindrical z = c: a plane parallel to the xy-plane (the xy-plane itself when c = 0). */
export const cylSurfaceZ = (c: number): SurfaceKind => (Math.abs(c) <= EPS ? 'xy-plane' : 'plane');
/** Spherical r = c: a sphere centred at the origin (the origin itself when c = 0). */
export const sphSurfaceR = (c: number): SurfaceKind => (c <= EPS ? 'point' : 'sphere');
/** Spherical θ = c: a cone about the z-axis, flat (the xy-plane) at π/2, a half-axis at 0 and π. */
export function sphSurfaceTheta(c: number): SurfaceKind {
  if (Math.abs(c - Math.PI / 2) <= EPS) return 'xy-plane';
  if (c <= EPS || Math.abs(c - Math.PI) <= EPS) return 'axis';
  return 'cone';
}
/** Spherical φ = c: a half-plane bounded by the z-axis. */
export const sphSurfacePhi = (): SurfaceKind => 'half-plane';

/* ------------------------------------------------------------------ solids */

export type SolidKey = 'ball' | 'cylinder' | 'cone';

/** The solids of the figure: ball x²+y²+z² ≤ R²; cylinder x²+y² ≤ R², 0 ≤ z ≤ H; cone √(x²+y²) ≤ z ≤ H. */
export const SOLIDS = {
  ball: { R: 2 },
  cylinder: { R: 2, H: 3 },
  cone: { H: 2 },
} as const;

export function inSolid(kind: SolidKey, p: Vec3): boolean {
  const rho = Math.hypot(p[0], p[1]);
  switch (kind) {
    case 'ball':
      return rho * rho + p[2] * p[2] <= SOLIDS.ball.R ** 2 + EPS;
    case 'cylinder':
      return rho <= SOLIDS.cylinder.R + EPS && p[2] >= -EPS && p[2] <= SOLIDS.cylinder.H + EPS;
    case 'cone':
      return p[2] >= rho - EPS && p[2] <= SOLIDS.cone.H + EPS;
  }
}

/* ------------------------------------------------------------------ angles for display */

/**
 * "π/4", "3π/2", "−π/3", "0", "π", "2π" when the angle is a multiple of π/12 (to 1e-9), else null. Plain text with
 * π, for a left-to-right island.
 */
export function niceAngle(theta: number): string | null {
  const k = Math.round((theta / Math.PI) * 12);
  if (Math.abs(theta - (k * Math.PI) / 12) > EPS) return null;
  if (k === 0) return '0';
  const g = gcd(Math.abs(k), 12);
  const num = k / g;
  const den = 12 / g;
  const sign = num < 0 ? '−' : '';
  const n = Math.abs(num);
  const top = n === 1 ? 'π' : `${n}π`;
  return den === 1 ? `${sign}${top}` : `${sign}${top}/${den}`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
