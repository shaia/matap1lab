/**
 * The complex exponential and logarithm for lesson 3.4.
 *
 * MODEL SPECIFICATION
 * - System: e^z for z = x + iy, defined as e^z = e^x cis y = e^x (cos y + i sin y). It agrees with the real e^x on
 *   the real axis and with Euler's cis θ = e^(iθ) on the imaginary axis; |e^z| = e^x and an argument of e^z is y.
 * - Periodicity: e^(z + 2πik) = e^z for every integer k (a shift of z by 2πi is a full turn of cis). Hence e^z is
 *   not one-to-one and the logarithm is many-valued.
 * - Logarithm: every solution z of e^z = w ≠ 0 is log w = ln|w| + i(Arg w + 2πk), k ∈ ℤ, all on the vertical line
 *   Re z = ln|w|, spaced 2π apart. The principal value Log w is the one with k = 0: Im Log w = Arg w ∈ (−π, π].
 *   Here ln is the real natural logarithm of |w| > 0.
 * - Euler's formulas: cos θ = (e^(iθ) + e^(−iθ))/2 and sin θ = (e^(iθ) − e^(−iθ))/(2i); they are used here for any
 *   complex argument, which defines cos z and sin z.
 * - Images for drawing: the horizontal line Im z = y (z = t + iy, t real) goes to the open ray from 0 at the angle y
 *   (radius e^t from 0 to ∞, 0 itself never reached); the vertical line Re z = x (z = x + it) goes to the circle of
 *   radius e^x about 0, run through infinitely often (once per 2π of t).
 * - Boundary: log 0 does not exist. Every logarithm function returns NaN parts at w = 0 (as `cdiv` does for a zero
 *   divisor); `logDefined` tells the two cases apart. Arg w on the negative real axis is +π (principal range
 *   (−π, π]); a number whose imaginary part is a rounding residue (|Im w| ≤ 1e-12 |w|) on the negative axis counts as
 *   on the axis, so that the Arg of e^(iπ) is π and not −π.
 * - Ignored: nothing mathematical; floating-point rounding only (cos π is −1, sin π is 1.2e-16, not 0).
 * - Failure modes: for |Im z| large (beyond ~1e15) cis loses all digits; the figures stay within |Im z| < 25.
 */

import { cabs, cadd, cdiv, cis, cmul, cscale, csub, polar, type Complex } from './complex';

const TWO_PI = 2 * Math.PI;
/** a number this close to the real axis (relative to its modulus) is on the axis: see the model specification */
const AXIS_EPS = 1e-12;

/** e^z = e^x cis y. */
export const cexp = (z: Complex): Complex => polar(Math.exp(z.re), z.im);

/** The principal argument Arg w ∈ (−π, π] with the rounding rule of the model specification (0 for w = 0). */
export function argPrincipal(w: Complex): number {
  const r = cabs(w);
  if (r === 0) return 0;
  if (w.re < 0 && Math.abs(w.im) <= AXIS_EPS * r) return Math.PI;
  return Math.atan2(w.im, w.re);
}

/** true when log w exists (w ≠ 0 and finite) */
export const logDefined = (w: Complex): boolean => Number.isFinite(w.re) && Number.isFinite(w.im) && cabs(w) > 0;

/** The k-th value of log w: ln|w| + i(Arg w + 2πk). NaN parts at w = 0. */
export function clog(w: Complex, k = 0): Complex {
  if (!logDefined(w)) return { re: NaN, im: NaN };
  return { re: Math.log(cabs(w)), im: argPrincipal(w) + TWO_PI * k };
}

/** The principal value Log w = ln|w| + i Arg w. NaN parts at w = 0. */
export const clogPrincipal = (w: Complex): Complex => clog(w, 0);

/** The values k = kMin … kMax of log w, in increasing k. */
export function clogBranches(w: Complex, kMin: number, kMax: number): Complex[] {
  const out: Complex[] = [];
  for (let k = kMin; k <= kMax; k++) out.push(clog(w, k));
  return out;
}

/** The copies z + 2πik, k = kMin … kMax, which all have the same e^z. */
export function periodCopies(z: Complex, kMin: number, kMax: number): Complex[] {
  const out: Complex[] = [];
  for (let k = kMin; k <= kMax; k++) out.push({ re: z.re, im: z.im + TWO_PI * k });
  return out;
}

const I_UNIT: Complex = { re: 0, im: 1 };
const iTimes = (z: Complex): Complex => cmul(I_UNIT, z);

/** cos z = (e^(iz) + e^(−iz))/2, from Euler's formulas. */
export function cosEuler(z: Complex): Complex {
  const a = cexp(iTimes(z));
  const b = cexp(iTimes(cscale(z, -1)));
  return cscale(cadd(a, b), 0.5);
}

/** sin z = (e^(iz) − e^(−iz))/(2i), from Euler's formulas. */
export function sinEuler(z: Complex): Complex {
  const a = cexp(iTimes(z));
  const b = cexp(iTimes(cscale(z, -1)));
  return cdiv(csub(a, b), { re: 0, im: 2 });
}

/** The image of the horizontal line Im z = y: the open ray from 0 at the angle y (unit direction and Arg). */
export function expRay(y: number): { ux: number; uy: number; arg: number } {
  return { ux: Math.cos(y), uy: Math.sin(y), arg: argPrincipal(cis(y)) };
}

/** The image of the vertical line Re z = x: the circle about 0 of radius e^x. */
export const expCircleRadius = (x: number): number => Math.exp(x);

