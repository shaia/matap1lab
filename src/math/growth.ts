/**
 * Exponentials, logarithms and growth rates for chapter 4 (ExpLab).
 *
 * MODEL SPECIFICATION
 * - System: real functions of one real variable x > 0 (or all x for aˣ). Nothing here is a limit proof: the
 *   figures compare values, and a comparison over a finite window is a probe, never a proof of an asymptotic fact.
 * - Bases: aˣ = exp(x ln a) for a > 0 (a < 1 decreases, a > 1 increases) and log_a x = ln x / ln a for x > 0,
 *   a ≠ 1; the two are mirror images in the line y = x. Outside the domain the functions return NaN.
 * - Compound interest: the n-th term (1 + 1/n)ⁿ is computed as exp(n · log1p(1/n)), because for n near 10⁶ the sum
 *   1 + 1/n loses about six digits before the power is taken. The gap e − (1 + 1/n)ⁿ is computed as
 *   −e · expm1(n log1p(1/n) − 1), which keeps its relative accuracy near 1e-10 up to n = 10⁶ (a plain subtraction of
 *   two numbers near 2.718 keeps only about ten digits of a gap of size 10⁻⁶).
 * - Race: the functions ln, √x, x, x², x³, x¹⁰, eˣ, 2ˣ and 1.1ˣ are carried as a SIGNED LOGARITHM {sign, ln|f|}, so
 *   that eˣ, 2ˣ and 1.1ˣ at x = 1000 (beyond 1.8·10³⁰⁸) never overflow. Only ln x has f ≤ 0 (on 0 < x ≤ 1).
 *   Two functions are compared by the sign of ln|f_a| − ln|f_b| when both are positive, by the signs when exactly one
 *   is positive, and by the values themselves when both are non-positive (never reached for two different ids).
 * - Crossings: the crossings of two race functions on (0, xmax] are found by scanning a grid of 4000 points spaced
 *   geometrically from 10⁻³ to xmax for sign changes of the comparison and then bisecting each (`bisect` of
 *   analysis.ts). THIS IS A PROBE: two crossings closer together than one grid step, or a touching without a sign
 *   change, would be missed; for the nine functions on the four windows of the figure the crossings are
 *   well separated. `lastCrossing` is the crossing with the largest x.
 * - Quotient: first / second is exp(ln|f_a| − ln|f_b|) (it underflows to 0 below about 10⁻³²⁴, e.g. x¹⁰/eˣ at
 *   x = 1000); its log10 is the difference divided by ln 10, which never underflows and is what the log-axis lower
 *   panel draws. NaN unless both functions are positive.
 * - Ignored: nothing mathematical; floating-point rounding only.
 */

import { bisect } from './analysis';

/* ---------- bases ---------- */

/** aˣ for a > 0 (NaN otherwise). */
export const powBase = (a: number, x: number): number => (a > 0 ? Math.exp(x * Math.log(a)) : NaN);

/** log_a x for a > 0, a ≠ 1 and x > 0 (NaN otherwise). */
export const logBase = (a: number, x: number): number => (a > 0 && a !== 1 && x > 0 ? Math.log(x) / Math.log(a) : NaN);

/** True when aˣ increases (a > 1), false when it decreases (0 < a < 1). */
export const baseIncreases = (a: number): boolean => a > 1;

/* ---------- compound interest ---------- */

/** (1 + 1/n)ⁿ for n ≥ 1, accurate for n up to 10⁶ and beyond. */
export const compoundTerm = (n: number): number => Math.exp(n * Math.log1p(1 / n));

/** e − (1 + 1/n)ⁿ, positive and computed without cancellation. */
export const compoundGap = (n: number): number => -Math.E * Math.expm1(n * Math.log1p(1 / n) - 1);

/* ---------- race ---------- */

export const RACE_IDS = ['ln', 'sqrt', 'x', 'x2', 'x3', 'x10', 'exp', 'pow2', 'pow1.1'] as const;
export type RaceId = (typeof RACE_IDS)[number];
export const RACE_XMAX = [10, 50, 100, 1000] as const;

/** KaTeX label and plain-text label of each race function. */
export const RACE_LABEL: Record<RaceId, { tex: string; text: string }> = {
  ln: { tex: '\\ln x', text: 'ln x' },
  sqrt: { tex: '\\sqrt{x}', text: '√x' },
  x: { tex: 'x', text: 'x' },
  x2: { tex: 'x^2', text: 'x²' },
  x3: { tex: 'x^3', text: 'x³' },
  x10: { tex: 'x^{10}', text: 'x¹⁰' },
  exp: { tex: 'e^x', text: 'eˣ' },
  pow2: { tex: '2^x', text: '2ˣ' },
  'pow1.1': { tex: '1.1^x', text: '1.1ˣ' },
};

export interface SignedLog {
  /** sign of f(x): −1, 0 or 1 */
  sign: number;
  /** ln|f(x)|, −∞ when f(x) = 0 */
  lg: number;
}

/** f(x) as a signed logarithm, for x > 0 (NaN fields otherwise). */
export function raceLog(id: RaceId, x: number): SignedLog {
  if (!(x > 0)) return { sign: NaN, lg: NaN };
  const L = Math.log(x);
  switch (id) {
    case 'ln':
      return L === 0 ? { sign: 0, lg: -Infinity } : { sign: Math.sign(L), lg: Math.log(Math.abs(L)) };
    case 'sqrt':
      return { sign: 1, lg: L / 2 };
    case 'x':
      return { sign: 1, lg: L };
    case 'x2':
      return { sign: 1, lg: 2 * L };
    case 'x3':
      return { sign: 1, lg: 3 * L };
    case 'x10':
      return { sign: 1, lg: 10 * L };
    case 'exp':
      return { sign: 1, lg: x };
    case 'pow2':
      return { sign: 1, lg: x * Math.LN2 };
    case 'pow1.1':
      return { sign: 1, lg: x * Math.log(1.1) };
  }
}

/** f(x) itself; +∞ where it exceeds the double range (the figure clamps it). */
export function raceValue(id: RaceId, x: number): number {
  const { sign, lg } = raceLog(id, x);
  return sign === 0 ? 0 : sign * Math.exp(lg);
}

/** log10 f(x) for the logarithmic value axis; NaN where f(x) ≤ 0 (a log axis cannot show it). */
export function raceLog10(id: RaceId, x: number): number {
  const { sign, lg } = raceLog(id, x);
  return sign > 0 ? lg / Math.LN10 : NaN;
}

/** A number with the sign of f_a(x) − f_b(x), continuous across every crossing of the nine functions. */
export function raceCompare(a: RaceId, b: RaceId, x: number): number {
  const A = raceLog(a, x);
  const B = raceLog(b, x);
  if (A.sign > 0 && B.sign > 0) return A.lg - B.lg;
  if (A.sign > 0) return 1;
  if (B.sign > 0) return -1;
  return raceValue(a, x) - raceValue(b, x);
}

/** first / second at x: exp of the difference of the logarithms (NaN unless both are positive). */
export function raceRatio(a: RaceId, b: RaceId, x: number): number {
  const A = raceLog(a, x);
  const B = raceLog(b, x);
  return A.sign > 0 && B.sign > 0 ? Math.exp(A.lg - B.lg) : NaN;
}

/** log10 of first / second at x (NaN unless both are positive). */
export function raceRatioLog10(a: RaceId, b: RaceId, x: number): number {
  const A = raceLog(a, x);
  const B = raceLog(b, x);
  return A.sign > 0 && B.sign > 0 ? (A.lg - B.lg) / Math.LN10 : NaN;
}

const GRID = 4000;
const X_FIRST = 1e-3;

/** All crossings f_a = f_b on (0, xmax], increasing in x: a probe (see the module docstring). */
export function raceCrossings(a: RaceId, b: RaceId, xmax: number): number[] {
  if (a === b) return [];
  const f = (x: number) => raceCompare(a, b, x);
  const out: number[] = [];
  let x0 = X_FIRST;
  let f0 = f(x0);
  for (let i = 1; i <= GRID; i++) {
    const x1 = X_FIRST * (xmax / X_FIRST) ** (i / GRID);
    const f1 = f(x1);
    if (f0 === 0) out.push(x0);
    else if (f0 * f1 < 0) out.push(bisect(f, x0, x1, 1e-12));
    x0 = x1;
    f0 = f1;
  }
  if (f0 === 0) out.push(x0);
  return out;
}

/** The crossing with the largest x on (0, xmax], or null when there is none. */
export function lastCrossing(a: RaceId, b: RaceId, xmax: number): number | null {
  const c = raceCrossings(a, b, xmax);
  return c.length ? c[c.length - 1] : null;
}
