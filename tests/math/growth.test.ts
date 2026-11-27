/**
 * src/math/growth.ts, filed by accuracy category: exact identities of bases and logarithms, convergence of the compound
 * interest sequence, crossings of the race functions (a probe, checked against mpmath values), and overflow safety.
 * Each test is named after the claim it proves; a sweep collects its failures and asserts once.
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/vec';
import {
  RACE_IDS,
  baseIncreases,
  compoundGap,
  compoundTerm,
  lastCrossing,
  logBase,
  powBase,
  raceCompare,
  raceCrossings,
  raceLog10,
  raceRatio,
  raceRatioLog10,
  raceValue,
} from '~/math/growth';

describe('exact identities: bases and logarithms', () => {
  it('log_a(aˣ) = x and a^(log_a x) = x on a grid of bases', () => {
    const off: string[] = [];
    for (const a of [0.1, 0.5, 0.9, 1.5, Math.E, 2, 5]) {
      for (const x of [0.25, 1, 2.5, 4]) {
        if (relativeError(logBase(a, powBase(a, x)), x) > 1e-12) off.push(`log_${a}(a^${x})`);
        if (relativeError(powBase(a, logBase(a, x)), x) > 1e-12) off.push(`a^log ${a} ${x}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('a⁰ = 1, a¹ = a, log_a 1 = 0, log_a a = 1', () => {
    const off: string[] = [];
    for (const a of [0.2, 0.7, 1.3, 3, 4.9]) {
      if (powBase(a, 0) !== 1) off.push(`a^0 ${a}`);
      if (relativeError(powBase(a, 1), a) > 1e-14) off.push(`a^1 ${a}`);
      if (logBase(a, 1) !== 0) off.push(`log 1 ${a}`);
      if (relativeError(logBase(a, a), 1) > 1e-14) off.push(`log a ${a}`);
    }
    expect(off).toEqual([]);
  });

  it('aˣ increases exactly when a > 1', () => {
    const off: string[] = [];
    for (const a of [0.1, 0.5, 0.99, 1.01, 2, 5]) {
      const grows = powBase(a, 2) > powBase(a, 1);
      if (grows !== baseIncreases(a) || grows !== a > 1) off.push(`a=${a}`);
    }
    expect(off).toEqual([]);
  });

  it('the logarithm is NaN for x ≤ 0 and for the base 1, the power for a ≤ 0', () => {
    expect(logBase(2, 0)).toBeNaN();
    expect(logBase(2, -1)).toBeNaN();
    expect(logBase(1, 3)).toBeNaN();
    expect(powBase(0, 2)).toBeNaN();
    expect(powBase(-2, 2)).toBeNaN();
  });
});

describe('convergence: (1 + 1/n)ⁿ → e', () => {
  it('the gap e − (1+1/n)ⁿ matches the mpmath values at n = 100, 1000, 10⁶', () => {
    expect(relativeError(compoundGap(100), 0.013467999037519142)).toBeLessThan(1e-9);
    expect(relativeError(compoundGap(1000), 0.001357896223152778)).toBeLessThan(1e-9);
    expect(relativeError(compoundGap(1e6), 1.3591396683515405e-6)).toBeLessThan(1e-9);
  });

  it('the terms match mpmath: 2.70481382942153 (100), 2.71692393223589 (1000), 2.71828046931938 (10⁶)', () => {
    expect(relativeError(compoundTerm(100), 2.7048138294215261)).toBeLessThan(1e-14);
    expect(relativeError(compoundTerm(1000), 2.7169239322358925)).toBeLessThan(1e-14);
    expect(relativeError(compoundTerm(1e6), 2.7182804693193769)).toBeLessThan(1e-14);
  });

  it('the first term is 2 and the sequence increases below e over n = 1…10⁶ on a log grid', () => {
    expect(compoundTerm(1)).toBeCloseTo(2, 14);
    const off: number[] = [];
    let prev = 0;
    for (let k = 0; k <= 120; k++) {
      const n = 10 ** (k / 20);
      const t = compoundTerm(n);
      if (!(t > prev && t < Math.E && compoundGap(n) > 0)) off.push(n);
      prev = t;
    }
    expect(off).toEqual([]);
  });

  it('the gap is about e/(2n): within 1% for n ≥ 1000', () => {
    const off: number[] = [];
    for (const n of [1e3, 1e4, 1e5, 1e6]) if (relativeError(compoundGap(n), Math.E / (2 * n)) > 0.01) off.push(n);
    expect(off).toEqual([]);
  });

  it('the gap is below 0.002 at n = 1000 (task compound-far) and above it at n = 100', () => {
    expect(compoundGap(1000)).toBeLessThan(0.002);
    expect(compoundGap(100)).toBeGreaterThan(0.002);
  });
});

describe('analytic limits: the race', () => {
  it('x¹⁰ = eˣ at 1.11833 and 35.7715 on the window 50 (mpmath: 1.11832559, 35.77152064)', () => {
    const c = raceCrossings('x10', 'exp', 50);
    expect(c).toHaveLength(2);
    expect(relativeError(c[0], 1.1183255915896296)).toBeLessThan(1e-9);
    expect(relativeError(c[1], 35.77152063957297)).toBeLessThan(1e-9);
  });

  it('x¹⁰ = 1.1ˣ at 1.00967 and 685.083 on the window 1000, only the first on the window 10 (mpmath: 1.00966963, 685.08319919)', () => {
    const c = raceCrossings('x10', 'pow1.1', 1000);
    expect(c).toHaveLength(2);
    expect(relativeError(c[0], 1.009669631083819)).toBeLessThan(1e-9);
    expect(relativeError(c[1], 685.0831991882841)).toBeLessThan(1e-9);
    expect(raceCrossings('x10', 'pow1.1', 10)).toHaveLength(1);
  });

  it('x³ = eˣ at 1.85718 and 4.53640 on the window 10 (mpmath: 1.85718386, 4.53640365)', () => {
    const c = raceCrossings('x3', 'exp', 10);
    expect(c).toHaveLength(2);
    expect(relativeError(c[0], 1.8571838602078353)).toBeLessThan(1e-9);
    expect(relativeError(c[1], 4.5364036549735274)).toBeLessThan(1e-9);
  });

  it('the last crossing of x¹⁰ and eˣ is 35.77 on windows 50, 100 and 1000 (either order), 1.118 on window 10', () => {
    expect(relativeError(lastCrossing('x10', 'exp', 50)!, 35.77152063957297)).toBeLessThan(1e-9);
    expect(relativeError(lastCrossing('x10', 'exp', 1000)!, 35.77152063957297)).toBeLessThan(1e-9);
    expect(relativeError(lastCrossing('exp', 'x10', 100)!, 35.77152063957297)).toBeLessThan(1e-9);
    expect(relativeError(lastCrossing('x10', 'exp', 10)!, 1.1183255915896296)).toBeLessThan(1e-9);
  });

  it('√x − ln x ≥ 0.613705 > 0: no crossing of sqrt and ln, and the difference stays above it on a grid', () => {
    expect(raceCrossings('sqrt', 'ln', 1000)).toEqual([]);
    const off: number[] = [];
    for (let k = 0; k <= 400; k++) {
      const x = 1e-3 * 1e6 ** (k / 400);
      const d = raceValue('sqrt', x) - raceValue('ln', x);
      if (!(d >= 0.6137056388 - 1e-9)) off.push(x);
    }
    expect(off).toEqual([]);
    // the minimum, at x = 4 (mpmath): 2 − ln 4 = 0.6137056388801094
    expect(relativeError(raceValue('sqrt', 4) - raceValue('ln', 4), 0.6137056388801094)).toBeLessThan(1e-14);
  });

  it('x² and 2ˣ cross last at x = 4 on the window 1000', () => {
    const c = raceCrossings('x2', 'pow2', 1000);
    expect(Math.max(...c)).toBeCloseTo(4, 6);
  });

  it('the pair x, x is not a race: no crossings', () => {
    expect(raceCrossings('x', 'x', 100)).toEqual([]);
    expect(lastCrossing('x', 'x', 100)).toBeNull();
  });
});

describe('exact identities: the race in logarithms never overflows', () => {
  it('eˣ, 2ˣ, 1.1ˣ and x¹⁰ at x = 1000 have finite log10; log10 eˣ = 1000/ln 10, log10 x¹⁰ = 30', () => {
    const off: string[] = [];
    for (const id of RACE_IDS) if (!Number.isFinite(raceLog10(id, 1000))) off.push(id);
    expect(off).toEqual([]);
    expect(relativeError(raceLog10('exp', 1000), 1000 / Math.LN10)).toBeLessThan(1e-14);
    expect(relativeError(raceLog10('pow2', 1000), 1000 * Math.log10(2))).toBeLessThan(1e-14);
    expect(relativeError(raceLog10('x10', 1000), 30)).toBeLessThan(1e-14);
  });

  it('eˣ at 1000 is +∞ and x¹⁰/eˣ underflows to 0 as a number, but its log10 is finite: ln of the quotient is −930.9224472', () => {
    expect(raceValue('exp', 1000)).toBe(Infinity);
    expect(raceRatio('x10', 'exp', 1000)).toBe(0);
    expect(relativeError(raceRatio('x10', 'exp', 30), Math.exp(10 * Math.log(30) - 30))).toBeLessThan(1e-14);
    expect(relativeError(raceRatioLog10('x10', 'exp', 1000), -930.9224472101786 / Math.LN10)).toBeLessThan(1e-12);
  });

  it('x¹⁰/eˣ is below 0.01 at x = 50 and above 1 at x = 20 (task race-ratio)', () => {
    expect(raceRatio('x10', 'exp', 50)).toBeLessThan(0.01);
    expect(raceRatio('x10', 'exp', 20)).toBeGreaterThan(1);
  });

  it('the comparison has the sign of the difference of values on a grid where nothing overflows', () => {
    const off: string[] = [];
    for (const a of RACE_IDS) {
      for (const b of RACE_IDS) {
        if (a === b) continue;
        for (let k = 0; k <= 60; k++) {
          const x = 0.02 + k * 0.5;
          const d = raceValue(a, x) - raceValue(b, x);
          const c = raceCompare(a, b, x);
          if (Math.abs(d) > 1e-9 * Math.max(Math.abs(raceValue(a, x)), Math.abs(raceValue(b, x))) && Math.sign(d) !== Math.sign(c)) {
            off.push(`${a} ${b} ${x}`);
          }
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('ln x is non-positive up to x = 1 and has no logarithmic value there', () => {
    expect(raceLog10('ln', 0.5)).toBeNaN();
    expect(raceLog10('ln', 1)).toBeNaN();
    expect(raceValue('ln', 1)).toBe(0);
    expect(raceValue('ln', 0.5)).toBeLessThan(0);
  });
});
