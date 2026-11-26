/**
 * Complex numbers for chapter 3: the algebraic form, the plane of Gauss, the polar form.
 *
 * MODEL SPECIFICATION
 * - System: numbers z = x + iy with i² = −1, drawn as points (x, y) of the plane of Gauss (Re to the right,
 *   Im up). A number is a plain object { re, im } of IEEE doubles.
 * - Operations: the field operations of the algebraic form; the conjugate z̄ = x − iy; the modulus
 *   |z| = √(x² + y²); the principal argument Arg z ∈ (−π, π] (atan2); the polar form z = r cis θ with
 *   cis θ = cos θ + i sin θ.
 * - Boundary: Arg 0 is undefined; `carg` returns 0 there (atan2(0, 0)), and callers that show it must say so.
 *   `cdiv` by 0 returns NaN parts (no silent infinity).
 * - Failure modes: `arctanNaive` is the calculator's arctan(y/x), wrong by ±π whenever x < 0 and undefined at
 *   x = 0 (it returns ±π/2 there): it exists to show that error, never to compute an argument.
 * - Powers and roots: `cpow` is de Moivre, (r cis θ)ⁿ = rⁿ cis nθ, for any integer n. The n-th roots of w ≠ 0 are
 *   r^(1/n) cis((Arg w + 2πk)/n), k = 0…n−1 (k = 0 is the principal root); all n lie on one circle at equal
 *   angles 2π/n. For w = 0 every root is 0.
 * - Quadratics: z² + bz + c with real b, c has Δ = b² − 4c; Δ ≥ 0 gives two real roots (equal at Δ = 0), Δ < 0 a
 *   conjugate pair −b/2 ± i√(−Δ)/2.
 * - Sets in the plane (`RegionSpec`): disk |z − a| ≤ r, circle |z − a| = r, annulus r < |z − a| < r2, sector
 *   α ≤ Arg z ≤ β, half-planes Re z > c and Im z > c, and the bisector |z − a| = |z − b|. Disk and sector are closed,
 *   annulus and half-planes open; a curve (circle, bisector) "contains" a point within a stated tolerance.
 *   `regionBoundaryPoint` is the nearest point of the boundary (for a disk, a circle or the bisector: the nearest point
 *   of that curve), `regionBoundaryDistance` its distance.
 * - Phasors (figure-only helpers kept here): Re(Ã e^(iωt)), the amplitude iωÃ of the derivative, and |Ã₁ + Ã₂|.
 * - Ignored: nothing mathematical; floating-point rounding only.
 *
 * Chapter-3 figures extend this module and `cexp.ts` (exp and log); the signatures above are shared and stay fixed.
 */

export interface Complex {
  re: number;
  im: number;
}

export const complex = (re: number, im = 0): Complex => ({ re, im });
/** i, the unit of the imaginary axis. */
export const I: Complex = { re: 0, im: 1 };

export const cadd = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
export const csub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
export const cmul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});
/** A real multiple a·z. */
export const cscale = (z: Complex, a: number): Complex => ({ re: a * z.re, im: a * z.im });
/** The conjugate z̄ = x − iy: the mirror image in the real axis. */
export const conj = (z: Complex): Complex => ({ re: z.re, im: -z.im });

/** a / b = a·b̄ / |b|², the recipe of lesson 3.1. Division by 0 gives NaN parts. */
export function cdiv(a: Complex, b: Complex): Complex {
  const d = b.re * b.re + b.im * b.im;
  if (d === 0) return { re: NaN, im: NaN };
  const n = cmul(a, conj(b));
  return { re: n.re / d, im: n.im / d };
}

/** |z| = √(x² + y²). */
export const cabs = (z: Complex): number => Math.hypot(z.re, z.im);
/** The principal argument Arg z ∈ (−π, π] (0 at z = 0, where it is undefined). */
export const carg = (z: Complex): number => Math.atan2(z.im, z.re);
/** cis θ = cos θ + i sin θ = e^(iθ). */
export const cis = (theta: number): Complex => ({ re: Math.cos(theta), im: Math.sin(theta) });
/** r cis θ. */
export const polar = (r: number, theta: number): Complex => ({ re: r * Math.cos(theta), im: r * Math.sin(theta) });
/** The polar form: r = |z| and θ = Arg z ∈ (−π, π]. */
export const toPolar = (z: Complex): { r: number; theta: number } => ({ r: cabs(z), theta: carg(z) });

/** An angle brought into (−π, π]. */
export function wrapAngle(a: number): number {
  const t = 2 * Math.PI;
  let r = ((a % t) + t) % t; // [0, 2π)
  if (r > Math.PI) r -= t;
  return r;
}

/** The calculator's arctan(y/x), which ignores the quadrant (see Failure modes). */
export function arctanNaive(z: Complex): number {
  if (z.re === 0) return z.im >= 0 ? Math.PI / 2 : -Math.PI / 2;
  return Math.atan(z.im / z.re);
}

const TAU = 2 * Math.PI;
const EPS = 1e-9;

/** zⁿ for an integer n by de Moivre: |z|ⁿ cis(n Arg z). z⁰ = 1; 0 to a negative power gives NaN parts. */
export function cpow(z: Complex, n: number): Complex {
  if (n === 0) return { re: 1, im: 0 };
  const r = cabs(z);
  if (r === 0) return n > 0 ? { re: 0, im: 0 } : { re: NaN, im: NaN };
  return polar(Math.pow(r, n), n * carg(z));
}

/** The points z, z², …, zⁿ (n ≥ 1) of the spiral of lesson 3.3. */
export function cpowers(z: Complex, n: number): Complex[] {
  const out: Complex[] = [];
  for (let k = 1; k <= n; k++) out.push(cpow(z, k));
  return out;
}

/** All n roots of zⁿ = w, k = 0…n−1; index 0 is the principal root |w|^(1/n) cis(Arg w / n). */
export function croots(w: Complex, n: number): Complex[] {
  const out: Complex[] = [];
  const r = Math.pow(cabs(w), 1 / n);
  const t = cabs(w) === 0 ? 0 : carg(w);
  for (let k = 0; k < n; k++) out.push(polar(r, (t + TAU * k) / n));
  return out;
}

/** The discriminant Δ = b² − 4c and the two roots of z² + bz + c (real b, c): real and equal at Δ = 0, else a conjugate pair. */
export function quadraticRoots(b: number, c: number): { disc: number; roots: [Complex, Complex] } {
  const disc = b * b - 4 * c;
  if (disc >= 0) {
    const s = Math.sqrt(disc);
    return { disc, roots: [{ re: (-b + s) / 2, im: 0 }, { re: (-b - s) / 2, im: 0 }] };
  }
  const s = Math.sqrt(-disc) / 2;
  return { disc, roots: [{ re: -b / 2, im: s }, { re: -b / 2, im: -s }] };
}

export type RegionKind = 'disk' | 'circle' | 'annulus' | 'sector' | 'halfplane-re' | 'halfplane-im' | 'bisector';
export const REGION_KINDS: RegionKind[] = ['disk', 'circle', 'annulus', 'sector', 'halfplane-re', 'halfplane-im', 'bisector'];

/** a, b: centres (b only for the bisector); r, r2: radii; alpha, beta: sector angles [rad]; c: half-plane constant. */
export interface RegionSpec {
  kind: RegionKind;
  a: Complex;
  b: Complex;
  r: number;
  r2: number;
  alpha: number;
  beta: number;
  c: number;
}

const mod2pi = (x: number) => ((x % TAU) + TAU) % TAU;
/** the width of the sector from alpha counter-clockwise to beta, in [0, 2π] */
const sectorSpan = (s: RegionSpec) => {
  let span = s.beta - s.alpha;
  if (span < 0) span += TAU;
  return span;
};

/**
 * Is q in the set? Curves (circle, bisector) count a point within `tol` of the curve (default 1e-9); the closed sets
 * (disk, sector) carry a 1e-9 slack; the open sets are strict.
 */
export function inRegion(s: RegionSpec, q: Complex, tol = 0): boolean {
  const t = Math.max(tol, EPS);
  switch (s.kind) {
    case 'disk':
      return cabs(csub(q, s.a)) <= s.r + EPS;
    case 'circle':
      return Math.abs(cabs(csub(q, s.a)) - s.r) <= t;
    case 'annulus': {
      const d = cabs(csub(q, s.a));
      return d > s.r && d < s.r2;
    }
    case 'sector': {
      if (cabs(q) === 0) return true;
      return mod2pi(carg(q) - s.alpha) <= sectorSpan(s) + EPS;
    }
    case 'halfplane-re':
      return q.re > s.c;
    case 'halfplane-im':
      return q.im > s.c;
    case 'bisector':
      return regionBoundaryDistance(s, q) <= t;
  }
}

function nearestOnCircle(a: Complex, r: number, q: Complex): Complex {
  const v = csub(q, a);
  const d = cabs(v);
  if (d === 0) return { re: a.re + r, im: a.im };
  return { re: a.re + (v.re / d) * r, im: a.im + (v.im / d) * r };
}

function nearestOnRay(angle: number, q: Complex): Complex {
  const d = cis(angle);
  const t = Math.max(0, q.re * d.re + q.im * d.im);
  return { re: t * d.re, im: t * d.im };
}

/** The nearest point of the boundary of the set (see the model specification). */
export function regionBoundaryPoint(s: RegionSpec, q: Complex): Complex {
  switch (s.kind) {
    case 'disk':
    case 'circle':
      return nearestOnCircle(s.a, s.r, q);
    case 'annulus': {
      const p1 = nearestOnCircle(s.a, s.r, q);
      const p2 = nearestOnCircle(s.a, s.r2, q);
      return cabs(csub(q, p1)) <= cabs(csub(q, p2)) ? p1 : p2;
    }
    case 'sector': {
      const p1 = nearestOnRay(s.alpha, q);
      const p2 = nearestOnRay(s.beta, q);
      return cabs(csub(q, p1)) <= cabs(csub(q, p2)) ? p1 : p2;
    }
    case 'halfplane-re':
      return { re: s.c, im: q.im };
    case 'halfplane-im':
      return { re: q.re, im: s.c };
    case 'bisector': {
      const ab = csub(s.b, s.a);
      const L2 = ab.re * ab.re + ab.im * ab.im;
      if (L2 === 0) return q;
      const mid = { re: (s.a.re + s.b.re) / 2, im: (s.a.im + s.b.im) / 2 };
      const t = ((q.re - mid.re) * ab.re + (q.im - mid.im) * ab.im) / L2;
      return { re: q.re - t * ab.re, im: q.im - t * ab.im };
    }
  }
}

/** The distance from q to the boundary of the set. */
export const regionBoundaryDistance = (s: RegionSpec, q: Complex): number => cabs(csub(q, regionBoundaryPoint(s, q)));

/** The real oscillation Re(Ã e^(iωt)) of the complex amplitude Ã. */
export const reAt = (A: Complex, omega: number, t: number): number => cmul(A, cis(omega * t)).re;
/** The complex amplitude iωÃ of the derivative of Re(Ã e^(iωt)). */
export const derivativeAmplitude = (A: Complex, omega: number): Complex => cmul({ re: 0, im: omega }, A);
/** |Ã₁ + Ã₂| for the amplitudes A₁ and A₂ with phase difference dphi [rad]. */
export const sumAmplitude = (A1: number, A2: number, dphi: number): number =>
  Math.sqrt(Math.max(0, A1 * A1 + A2 * A2 + 2 * A1 * A2 * Math.cos(dphi)));
