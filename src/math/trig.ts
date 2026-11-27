/**
 * The unit circle, sinusoidal waves, the inverse trigonometric functions and the hyperbolic functions (CircleLab,
 * chapter 4).
 *
 * MODEL SPECIFICATION
 * - System: the unit circle x² + y² = 1 with the angle θ measured counter-clockwise from the positive x-axis, in
 *   radians in this module (the figure's props are degrees and convert with `deg2rad`). The point of angle θ is
 *   (cos θ, sin θ); tan θ = sin θ / cos θ is the height of the line through the origin on the tangent line x = 1.
 * - Where tan is undefined: at θ = 90° + k·180°. The figure moves θ in whole degrees, so `tanUndefined` tests the
 *   angle in degrees against 90 + 180k within 10⁻⁶°, not cos θ against 0 (Math.cos(π/2) is 6·10⁻¹⁷, not 0, and tan
 *   there would print 1.6·10¹⁶). `tanOf` returns NaN at such angles.
 * - Wave: y = A sin(ωx + φ). Amplitude |A|, period 2π/ω (ω > 0), phase shift −φ/ω (the graph of sin(ωx) moved that
 *   far to the right when positive), A < 0 flips the graph in the x-axis. `piMultiple` writes a number as p/q·π
 *   when it is that multiple (q ≤ 48, tolerance 10⁻⁹) so that a readout can say "2π/3" instead of 2.0944;
 *   otherwise the figure prints a decimal.
 * - Inverse functions: for a value v the angles θ in (−π, π] with sin θ = v are asin v and π − asin v (one angle at
 *   v = ±1), with cos θ = v are ±acos v (one at v = ±1), with tan θ = v are atan v and atan v + π (taken in
 *   (−π, π]). The principal value is the one in the range of the inverse function: arcsin in [−π/2, π/2], arccos in
 *   [0, π], arctan in (−π/2, π/2) (open ends). Exactly one listed angle is principal.
 * - Hyperbolic: cosh t = (eᵗ + e⁻ᵗ)/2 and sinh t = (eᵗ − e⁻ᵗ)/2 (the even and odd halves of eᵗ), the point
 *   (cosh t, sinh t) lies on the right branch of x² − y² = 1, and cosh² t − sinh² t = 1 for every t. The halves
 *   eᵗ/2 and e⁻ᵗ/2 are exposed so the figure can show cosh as their sum and sinh as their difference.
 * - Ignored: nothing mathematical; floating-point rounding only (about 10⁻¹⁶ relative, 10⁻¹⁴ for cosh² − sinh² at
 *   |t| = 3).
 */

export const deg2rad = (d: number): number => (d * Math.PI) / 180;
export const rad2deg = (r: number): number => (r * 180) / Math.PI;

/* ---------- the unit circle ---------- */

export interface CirclePoint {
  x: number;
  y: number;
}

/** The point (cos θ, sin θ), θ in radians. */
export const circlePoint = (theta: number): CirclePoint => ({ x: Math.cos(theta), y: Math.sin(theta) });

/** True when θ (degrees) is 90° + k·180° within 10⁻⁶°. */
export function tanUndefined(thetaDeg: number): boolean {
  const r = (((thetaDeg - 90) % 180) + 180) % 180;
  return Math.min(r, 180 - r) < 1e-6;
}

/** tan θ for θ in degrees; NaN where it is undefined. */
export const tanOf = (thetaDeg: number): number => (tanUndefined(thetaDeg) ? NaN : Math.tan(deg2rad(thetaDeg)));

export type TrigFn = 'sin' | 'cos' | 'tan';

/** sin / cos / tan of θ in degrees (tan: NaN where undefined). */
export function trigOf(fn: TrigFn, thetaDeg: number): number {
  if (fn === 'sin') return Math.sin(deg2rad(thetaDeg));
  if (fn === 'cos') return Math.cos(deg2rad(thetaDeg));
  return tanOf(thetaDeg);
}

/* ---------- waves ---------- */

/** A sin(ωx + φ), φ in radians. */
export const waveValue = (A: number, omega: number, phi: number, x: number): number => A * Math.sin(omega * x + phi);

export interface WaveInfo {
  amplitude: number;
  period: number;
  /** −φ/ω: the distance the graph of sin(ωx) is moved to the right (negative: to the left) */
  shift: number;
}

export const waveInfo = (A: number, omega: number, phi: number): WaveInfo => ({
  amplitude: Math.abs(A),
  period: (2 * Math.PI) / omega,
  shift: -phi / omega,
});

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

/** y = p/q · π with q ≤ maxDen (lowest terms, q > 0), or null when y is not such a multiple. */
export function piMultiple(y: number, maxDen = 48): { p: number; q: number } | null {
  const t = y / Math.PI;
  for (let q = 1; q <= maxDen; q++) {
    const p = Math.round(t * q);
    if (Math.abs(t * q - p) < 1e-9 * q) {
      const g = gcd(p, q) || 1;
      return { p: p / g, q: q / g };
    }
  }
  return null;
}

/** y as "2π/3", "−π", "0"; null when y is not a multiple p/q·π with q ≤ maxDen. */
export function piText(y: number, maxDen = 48): string | null {
  const m = piMultiple(y, maxDen);
  if (!m) return null;
  if (m.p === 0) return '0';
  const n = Math.abs(m.p);
  return `${m.p < 0 ? '−' : ''}${n === 1 ? '' : n}π${m.q === 1 ? '' : '/' + m.q}`;
}

/* ---------- inverse trigonometric functions ---------- */

export type InvFn = 'arcsin' | 'arccos' | 'arctan';

/** The range of each inverse function, with whether its ends are included. */
export const PRINCIPAL_RANGE: Record<InvFn, { lo: number; hi: number; closed: boolean }> = {
  arcsin: { lo: -Math.PI / 2, hi: Math.PI / 2, closed: true },
  arccos: { lo: 0, hi: Math.PI, closed: true },
  arctan: { lo: -Math.PI / 2, hi: Math.PI / 2, closed: false },
};

/** Whether v is in the domain of the inverse function ([−1, 1] for arcsin and arccos, ℝ for arctan). */
export const invDomainOk = (fn: InvFn, v: number): boolean => (fn === 'arctan' ? Number.isFinite(v) : Math.abs(v) <= 1);

/** The principal value arcsin v / arccos v / arctan v in radians (NaN outside the domain). */
export function principalValue(fn: InvFn, v: number): number {
  if (!invDomainOk(fn, v)) return NaN;
  return fn === 'arcsin' ? Math.asin(v) : fn === 'arccos' ? Math.acos(v) : Math.atan(v);
}

/** θ moved into (−π, π]. */
function wrap(t: number): number {
  let r = (((t + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  r -= Math.PI;
  return r === -Math.PI ? Math.PI : r;
}

export interface CircleAngle {
  /** radians in (−π, π] */
  theta: number;
  principal: boolean;
}

/** Every angle in (−π, π] with sin θ = v (arcsin), cos θ = v (arccos) or tan θ = v (arctan), one marked principal. */
export function anglesFor(fn: InvFn, v: number): CircleAngle[] {
  if (!invDomainOk(fn, v)) return [];
  const p = principalValue(fn, v);
  const cands = fn === 'arcsin' ? [p, Math.PI - p] : fn === 'arccos' ? [p, -p] : [p, p + Math.PI];
  const out: CircleAngle[] = [];
  cands.forEach((c, i) => {
    const th = wrap(c);
    if (out.some((o) => Math.abs(o.theta - th) < 1e-9)) return;
    out.push({ theta: th, principal: i === 0 });
  });
  return out;
}

/* ---------- hyperbolic functions ---------- */

export const coshOf = (t: number): number => Math.cosh(t);
export const sinhOf = (t: number): number => Math.sinh(t);

/** The point (cosh t, sinh t) of the right branch of x² − y² = 1. */
export const hyperPoint = (t: number): CirclePoint => ({ x: Math.cosh(t), y: Math.sinh(t) });

/** The halves eᵗ/2 and e⁻ᵗ/2: cosh t is their sum, sinh t their difference. */
export const halves = (t: number): { pos: number; neg: number } => ({ pos: Math.exp(t) / 2, neg: Math.exp(-t) / 2 });

/** cosh² t − sinh² t, which is 1 for every t. */
export const hyperIdentity = (t: number): number => Math.cosh(t) ** 2 - Math.sinh(t) ** 2;
