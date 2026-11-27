import { describe, expect, it } from 'vitest';
import { centralDiff, diffQuotient, gridExtrema } from '~/math/analysis';
import {
  MOTION_IDS,
  SLOPE,
  SLOPE_IDS,
  critNear,
  extremumOnlyAtEnd,
  globalExtrema,
  pathLength,
  pieces,
  restNear,
  tangentAt,
  trendAt,
  type CritKind,
  type SlopeId,
} from '~/math/slopegraph';

// constants recomputed with sympy 2026-11-27: h' = -10(t - 2), h(2) = 20; x' = 3(t - 1)(t - 3), x(0..4) = 0, 4, 2, 0, 4,
// path length on [0, 4] = 12; (5t^2)' = 10t; (x^3 - 3x)' = 3x^2 - 3, f(-1) = 2, f(1) = -2, f(0) = 0, f(3) = 18;
// quartic' = (x - 1)^2 (x + 2), f(-2) = -6, f(1) = 3/4; V' = 12(x - 6)(x - 2), V(0) = V(6) = 0, V(2) = 128.

/** evenly spaced points of [lo, hi], ends included */
const grid = (lo: number, hi: number, n: number) => Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n);

describe('slopegraph: exact identities (the closed-form f′ is the derivative of f)', () => {
  it('every preset: f′ agrees with the central difference at 201 points of the domain', () => {
    // For a polynomial of degree ≤ 4 the central difference misses f′ by exactly f‴(x)h²/6 (≤ 72·1e-10/6 ≈ 1.2e-9
    // here), plus rounding ε·|f|/h ≈ 2.2e-16·140/1e-5 ≈ 3e-9: an absolute bound 1e-8·max(1, |f|, |f′|), since f′ is
    // near 0 at some points and a relative comparison there is meaningless.
    const h = 1e-5;
    const bad: string[] = [];
    for (const id of SLOPE_IDS) {
      const s = SLOPE[id];
      for (const x of grid(s.domain[0], s.domain[1], 200)) {
        const d = centralDiff(s.f, x, h);
        const tol = 1e-8 * Math.max(1, Math.abs(s.f(x)), Math.abs(s.df(x)));
        if (Math.abs(d - s.df(x)) > tol) bad.push(`${id} at ${x}: ${d} vs ${s.df(x)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('every stored critical point is INTERIOR (lesson 5.5), with f′ = 0 and f equal to the stored value, exactly', () => {
    const bad: string[] = [];
    for (const id of SLOPE_IDS) {
      const s = SLOPE[id];
      for (const c of s.crit) {
        if (s.df(c.x) !== 0) bad.push(`${id}: f′(${c.x}) = ${s.df(c.x)}`);
        if (s.f(c.x) !== c.value) bad.push(`${id}: f(${c.x}) = ${s.f(c.x)} vs ${c.value}`);
        if (!(c.x > s.domain[0] && c.x < s.domain[1])) bad.push(`${id}: ${c.x} is not strictly inside the domain`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('the flat ends are exactly the ends of the domain where f′ = 0, with the stored value', () => {
    const bad: string[] = [];
    for (const id of SLOPE_IDS) {
      const s = SLOPE[id];
      const want = s.domain.filter((x) => s.df(x) === 0);
      if (JSON.stringify(s.flatEnds.map((e) => e.x)) !== JSON.stringify(want)) bad.push(`${id}: flat ends ${s.flatEnds.map((e) => e.x)} vs ${want}`);
      for (const e of s.flatEnds) if (s.f(e.x) !== e.value) bad.push(`${id}: f(${e.x}) = ${s.f(e.x)} vs ${e.value}`);
    }
    expect(bad).toEqual([]);
  });

  it('an end is never reported as a critical point: trendAt gives "end" there, and critNear never finds it', () => {
    const bad: string[] = [];
    for (const id of SLOPE_IDS) {
      for (const e of SLOPE[id].flatEnds) {
        if (trendAt(id, e.x) !== 'end') bad.push(`${id}: trend at ${e.x} is ${trendAt(id, e.x)}`);
        if (critNear(id, e.x, 0.03) !== null) bad.push(`${id}: critNear finds the end ${e.x}`);
        // the motion cursor is at rest there all the same (v = 0)
        if (restNear(id, e.x + 0.02, 0.03) !== e.x) bad.push(`${id}: restNear misses the end ${e.x}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('the stored kind follows from the change of sign of f′ across the point', () => {
    const bad: string[] = [];
    const eps = 1e-3;
    for (const id of SLOPE_IDS) {
      const s = SLOPE[id];
      for (const c of s.crit) {
        const left = Math.sign(s.df(c.x - eps));
        const right = Math.sign(s.df(c.x + eps));
        const kind: CritKind = left > 0 && right < 0 ? 'max' : left < 0 && right > 0 ? 'min' : 'none';
        if (kind !== c.kind) bad.push(`${id} at ${c.x}: ${kind} vs stored ${c.kind}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('the stored list is complete (a probe): every sign change or near-zero of f′ on a 4000-point grid is a stored critical point', () => {
    const bad: string[] = [];
    for (const id of SLOPE_IDS) {
      const s = SLOPE[id];
      const xs = grid(s.domain[0], s.domain[1], 4000);
      const step = xs[1] - xs[0];
      const zeros = [...s.crit.map((c) => c.x), ...s.flatEnds.map((e) => e.x)];
      const covered = (x: number, tol: number) => zeros.some((z) => Math.abs(z - x) <= tol);
      for (let i = 0; i + 1 < xs.length; i++) {
        const d0 = s.df(xs[i]);
        const d1 = s.df(xs[i + 1]);
        if (d0 * d1 < 0 && !covered(xs[i], step)) bad.push(`${id}: sign change near ${xs[i]}`);
      }
      // away from the stored points (≥ 0.05), |f′| stays clear of 0: no double root (no sign change) was missed
      let minAbs = Infinity;
      for (const x of xs) if (!covered(x, 0.05)) minAbs = Math.min(minAbs, Math.abs(s.df(x)));
      if (!(minAbs > 1e-3)) bad.push(`${id}: |f′| = ${minAbs} away from the stored points`);
    }
    expect(bad).toEqual([]);
  });

  it('pieces: f is strictly monotone on each piece with the stored sign, and the pieces tile the domain', () => {
    const bad: string[] = [];
    for (const id of SLOPE_IDS) {
      const s = SLOPE[id];
      const ps = pieces(id);
      if (ps[0].lo !== s.domain[0] || ps[ps.length - 1].hi !== s.domain[1]) bad.push(`${id}: ends`);
      for (let i = 0; i < ps.length; i++) {
        if (i > 0 && (ps[i].lo !== ps[i - 1].hi || ps[i].sign === ps[i - 1].sign)) bad.push(`${id}: join ${i}`);
        const xs = grid(ps[i].lo, ps[i].hi, 200);
        for (let k = 0; k + 1 < xs.length; k++) {
          if (Math.sign(s.f(xs[k + 1]) - s.f(xs[k])) !== ps[i].sign) {
            bad.push(`${id}: piece ${i} not monotone at ${xs[k]}`);
            break;
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('slopegraph: analytic limits (the tangent slope is the limit of secant slopes)', () => {
  it('the one-sided difference quotient misses f′ by O(h): the error falls about tenfold per decade of h (1e-1 to 1e-4)', () => {
    const bad: string[] = [];
    for (const id of SLOPE_IDS) {
      const s = SLOPE[id];
      for (const x of grid(s.domain[0] + 0.3, s.domain[1] - 0.3, 6)) {
        // f″(x) ≠ 0 is needed for the O(h) term to lead; skip the points where it vanishes (x³ at 0, cubic at 0, …)
        const f2 = (s.df(x + 1e-4) - s.df(x - 1e-4)) / 2e-4;
        if (Math.abs(f2) < 0.5) continue;
        const errs = [1e-1, 1e-2, 1e-3, 1e-4].map((h) => Math.abs(diffQuotient(s.f, x, h) - s.df(x)));
        for (let k = 0; k + 1 < errs.length; k++) {
          const r = errs[k] / errs[k + 1];
          if (!(r > 6 && r < 14)) bad.push(`${id} at ${x}: ratio ${r}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('the tangent at x0 passes through (x0, f(x0)) with slope f′(x0), and the gap f − tangent is o(x − x0)', () => {
    const bad: string[] = [];
    for (const id of SLOPE_IDS) {
      const s = SLOPE[id];
      const x0 = (s.domain[0] + s.domain[1]) / 2;
      const tl = tangentAt(id, x0);
      if (tl.at(x0) !== s.f(x0) || tl.m !== s.df(x0)) bad.push(`${id}: tangent at x0`);
      const ratios = [1e-1, 1e-2, 1e-3].map((d) => Math.abs(s.f(x0 + d) - tl.at(x0 + d)) / d);
      if (!(ratios[2] < ratios[1] && ratios[1] < ratios[0] && ratios[2] < 1e-1)) bad.push(`${id}: gap/dx ${ratios}`);
    }
    expect(bad).toEqual([]);
  });
});

describe('slopegraph: global extrema on a closed interval (the candidates: ends and interior critical points)', () => {
  it('agree with a 10001-point grid (a probe) on intervals across every preset', () => {
    const bad: string[] = [];
    for (const id of SLOPE_IDS) {
      const s = SLOPE[id];
      const ends = grid(s.domain[0], s.domain[1], 8);
      for (let i = 0; i < ends.length; i++) {
        for (let j = i + 1; j < ends.length; j++) {
          const g = globalExtrema(id, ends[i], ends[j]);
          const p = gridExtrema(s.f, ends[i], ends[j], 10_001);
          // the grid cannot beat the exact extremes, and its step (≤ 6e-4) bounds how far below it may stay
          if (p.max > g.max.value + 1e-9 || g.max.value - p.max > 1e-3 * Math.max(1, Math.abs(g.max.value))) bad.push(`${id} [${ends[i]}, ${ends[j]}] max`);
          if (p.min < g.min.value - 1e-9 || p.min - g.min.value > 1e-3 * Math.max(1, Math.abs(g.min.value))) bad.push(`${id} [${ends[i]}, ${ends[j]}] min`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('slopegraph: special values of the brief and the bank', () => {
  it('ball: v = 20 − 10t, rest at the top t = 2 with h = 20 (Q-5.1-ball)', () => {
    const s = SLOPE.ball;
    expect([0, 1, 2, 3, 4].map(s.df)).toEqual([20, 10, 0, -10, -20]);
    expect(s.crit).toEqual([{ x: 2, value: 20, valueText: '20', kind: 'max' }]);
  });

  it('back-forth: positions 0, 4, 2, 0, 4 at t = 0..4, backwards exactly on (1, 3), path length 12', () => {
    const s = SLOPE['back-forth'];
    expect([0, 1, 2, 3, 4].map(s.f)).toEqual([0, 4, 2, 0, 4]);
    expect(pieces('back-forth')).toEqual([
      { lo: 0, hi: 1, sign: 1 },
      { lo: 1, hi: 3, sign: -1 },
      { lo: 3, hi: 4, sign: 1 },
    ]);
    expect(pathLength('back-forth', 0, 4)).toBe(12);
    // the displacement is only 4: the path length is not the change of position
    expect(s.f(4) - s.f(0)).toBe(4);
  });

  it('fall: v = 10t, at rest only at the start t = 0, an end of the domain and so not a critical point', () => {
    const s = SLOPE.fall;
    expect([0, 1, 2, 3].map(s.df)).toEqual([0, 10, 20, 30]);
    expect(s.crit).toEqual([]);
    expect(s.flatEnds).toEqual([{ x: 0, value: 0, valueText: '0' }]);
    expect(trendAt('fall', 0)).toBe('end');
  });

  it('cubic: max 2 at −1, min −2 at 1; on [0, 3] the max is 18 at the end 3 only, the min −2 at 1', () => {
    expect(SLOPE.cubic.crit.map((c) => [c.x, c.kind, c.value])).toEqual([
      [-1, 'max', 2],
      [1, 'min', -2],
    ]);
    const g = globalExtrema('cubic', 0, 3);
    expect(g.max).toEqual({ value: 18, at: [3], endOnly: true });
    expect(g.min).toEqual({ value: -2, at: [1], endOnly: false });
    expect(extremumOnlyAtEnd('cubic', 0, 3)).toBe(true);
  });

  it('cubic on [−2, 2]: ties, max 2 at −1 and 2, min −2 at −2 and 1, so no extremum is at an end only', () => {
    const g = globalExtrema('cubic', -2, 2);
    expect(g.max).toEqual({ value: 2, at: [-1, 2], endOnly: false });
    expect(g.min).toEqual({ value: -2, at: [-2, 1], endOnly: false });
    expect(extremumOnlyAtEnd('cubic', -2, 2)).toBe(false);
    // no interior critical point: a monotone piece does not count
    expect(extremumOnlyAtEnd('cubic', 1.5, 3)).toBe(false);
  });

  it('x³: the critical point 0 is of kind none (f′(0) = 0, no extremum), f increases on both sides', () => {
    expect(SLOPE.x3.crit.map((c) => [c.x, c.kind])).toEqual([[0, 'none']]);
    expect(pieces('x3')).toEqual([{ lo: -1.8, hi: 1.8, sign: 1 }]);
    expect([trendAt('x3', -0.01), trendAt('x3', 0), trendAt('x3', 0.01)]).toEqual(['up', 'crit', 'up']);
  });

  it('quartic: f′ = (x − 1)²(x + 2), min −6 at −2, none at 1 (value 3/4)', () => {
    const s = SLOPE.quartic;
    expect(s.crit.map((c) => [c.x, c.kind, c.value])).toEqual([
      [-2, 'min', -6],
      [1, 'none', 0.75],
    ]);
    expect(globalExtrema('quartic', -3, 2.2).min).toEqual({ value: -6, at: [-2], endOnly: false });
    expect(critNear('quartic', 1.03, 0.03, ['none'])?.x).toBe(1);
    expect(critNear('quartic', 1.04, 0.03, ['none'])).toBeNull();
  });

  it('box: V′ = (12 − 2x)(12 − 6x), max 128 at 2, V = 0 at the ends 0 and 6; V′(6) = 0 but 6 is an end, not critical', () => {
    const s = SLOPE.box;
    expect(s.crit.map((c) => [c.x, c.kind, c.value])).toEqual([[2, 'max', 128]]);
    expect(s.flatEnds).toEqual([{ x: 6, value: 0, valueText: '0' }]);
    expect(trendAt('box', 6)).toBe('end');
    // the ends are still candidates for the global extremes
    expect(extremumOnlyAtEnd('box', 0, 6)).toBe(true);
    const g = globalExtrema('box', 0, 6);
    expect(g.max).toEqual({ value: 128, at: [2], endOnly: false });
    expect(g.min).toEqual({ value: 0, at: [0, 6], endOnly: true });
  });

  it('the motion presets are exactly ball, back-forth and fall, and each default cursor is a moment of forward motion', () => {
    expect(MOTION_IDS).toEqual(['ball', 'back-forth', 'fall'] as SlopeId[]);
    const bad = MOTION_IDS.filter((id) => !(SLOPE[id].df(SLOPE[id].start) > 0) || critNear(id, SLOPE[id].start, 0.03) !== null);
    expect(bad).toEqual([]);
  });
});
