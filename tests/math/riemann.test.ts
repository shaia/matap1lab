import { describe, expect, it } from 'vitest';
import { centralDiff, relativeError } from '~/math/analysis';
import { simpson } from '~/math/multivar';
import {
  ADD,
  CMP,
  MO,
  MO_IDS,
  RS,
  RS_IDS,
  RS_RULES,
  addParts,
  displacement,
  distance,
  exact,
  posNeg,
  posNegOf,
  rectParts,
  riemannSum,
  riemannSumOf,
} from '~/math/riemann';

// Every stored closed form was recomputed with sympy on 2026-11-27 (screens/tools/cas.py):
// ∫₀² x² = 8/3; ∫₀^π sin = 2; ∫₀^(3π/2) cos = −1 with ∫|cos| = 3 (above 1, below 2); ∫₁ᵉ 1/x = 1; ∫₀¹ eˣ = e − 1;
// ∫₀⁴ (2 − t) = 0, ∫₀⁴ |2 − t| = 4; ∫₀^(2π) sin = 0, ∫|sin| = 4; ∫₀^(2π) (1 + sin) = ∫|1 + sin| = 2π (1 + sin t = 0 only at
// 3π/2 in [0, 2π], no sign change); (2t − t²/2)′ = 2 − t, (−cos t)′ = sin t, (t − cos t)′ = 1 + sin t;
// ∫₀ᶜ sin = 1 − cos c, ∫ᶜ^π sin = 1 + cos c; ∫₀² e^(−x²) = 0.882081390762422; arctan 2 = 1.10714871779409;
// Σᵢ₌₁ⁿ (3i/n)²·(3/n) = 9(n + 1)(2n + 1)/(2n²).

/** |num − exact| ≤ tol·max(1, |exact|): relative, with an absolute floor where the exact value is 0 or crosses it */
const near = (num: number, exact: number, tol: number) => Math.abs(num - exact) <= tol * Math.max(1, Math.abs(exact));
const grid = (lo: number, hi: number, n = 40) => Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n);

describe('exact identities: the stored antiderivatives and exact values', () => {
  it('centralDiff(F) equals f on a grid of [a, b] for every RS preset, and X′ = v for every MO preset', () => {
    const off: string[] = [];
    for (const id of RS_IDS) {
      const s = RS[id];
      for (const x of grid(s.a, s.b)) if (!near(centralDiff(s.F, x), s.f(x), 1e-6)) off.push(`RS ${id} x=${x}`);
    }
    for (const id of MO_IDS) {
      const s = MO[id];
      for (const t of grid(0, s.T)) if (!near(centralDiff(s.X, t), s.v(t), 1e-6)) off.push(`MO ${id} t=${t}`);
    }
    for (const x of grid(-1, 4.5)) if (!near(centralDiff(ADD.F, x), ADD.f(x), 1e-6)) off.push(`ADD x=${x}`);
    for (const x of grid(0, 2)) if (!near(centralDiff(CMP.G, x), CMP.g(x), 1e-6)) off.push(`CMP x=${x}`);
    expect(off).toEqual([]);
  });

  it('the exact values of the brief: 8/3, 2, −1, 1, e − 1', () => {
    expect(exact('sq')).toBeCloseTo(8 / 3, 14);
    expect(exact('sin')).toBeCloseTo(2, 14);
    expect(exact('cos')).toBeCloseTo(-1, 14);
    expect(exact('recip')).toBeCloseTo(1, 14);
    expect(exact('exp')).toBeCloseTo(Math.E - 1, 14);
  });

  it('posNeg: pos − neg = exact and pos + neg = Simpson of |f|; cos on [0, 3π/2] is 1 above and 2 below', () => {
    const off: string[] = [];
    for (const id of RS_IDS) {
      const s = RS[id];
      const { pos, neg } = posNeg(id);
      if (pos < 0 || neg < 0) off.push(`${id}: a negative part`);
      if (!near(pos - neg, exact(id), 1e-12)) off.push(`${id}: pos − neg ≠ exact`);
      const abs = simpson((x) => Math.abs(s.f(x)), s.a, s.b, 4000);
      if (!near(pos + neg, abs, 1e-6)) off.push(`${id}: pos + neg = ${pos + neg}, ∫|f| = ${abs}`);
    }
    expect(off).toEqual([]);
    const c = posNeg('cos');
    expect(c.pos).toBeCloseTo(1, 14);
    expect(c.neg).toBeCloseTo(2, 14);
  });

  it('the listed zeros are sign changes of f inside [a, b], and f keeps one sign between them', () => {
    const off: string[] = [];
    for (const id of RS_IDS) {
      const s = RS[id];
      for (const z of s.zeros) {
        if (!(z > s.a && z < s.b)) off.push(`${id}: zero ${z} outside`);
        if (Math.abs(s.f(z)) > 1e-12 || s.f(z - 1e-3) * s.f(z + 1e-3) >= 0) off.push(`${id}: no sign change at ${z}`);
      }
      const cuts = [s.a, ...s.zeros, s.b];
      for (let i = 0; i + 1 < cuts.length; i++) {
        const inner = grid(cuts[i], cuts[i + 1], 60).slice(1, -1).map(s.f);
        if (!(inner.every((v) => v > 0) || inner.every((v) => v < 0))) off.push(`${id}: f changes sign in piece ${i}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('the monotone flag is right: f′ keeps its sign on [a, b]', () => {
    const off: string[] = [];
    for (const id of RS_IDS) {
      const s = RS[id];
      const d = grid(s.a, s.b).map((x) => centralDiff(s.f, x));
      const inc = d.every((v) => v >= -1e-9);
      const dec = d.every((v) => v <= 1e-9);
      const got = inc ? 'inc' : dec ? 'dec' : null;
      if (got !== s.monotone) off.push(`${id}: stored ${s.monotone}, found ${got}`);
    }
    expect(off).toEqual([]);
  });

  it('the midpoint rule is exact for a linear f, every n; left and right are exact for a constant', () => {
    const off: string[] = [];
    const f = (x: number) => 3 * x - 2;
    const ex = (b: number, a: number) => 1.5 * (b * b - a * a) - 2 * (b - a);
    for (const [a, b] of [
      [0, 2],
      [-1, 3],
      [2, 5],
    ])
      for (let n = 1; n <= 40; n++) {
        const m = riemannSumOf(f, a, b, n, 'mid').sum;
        if (!near(m, ex(b, a), 1e-12)) off.push(`linear [${a}, ${b}] n=${n}: ${m}`);
        for (const r of RS_RULES) if (!near(riemannSumOf(() => 1.5, a, b, n, r).sum, 1.5 * (b - a), 1e-12)) off.push(`const ${r} n=${n}`);
      }
    expect(off).toEqual([]);
  });

  it('a monotone f is bracketed: increasing left ≤ exact ≤ right, decreasing right ≤ exact ≤ left, n = 1…64', () => {
    const off: string[] = [];
    for (const id of RS_IDS) {
      const s = RS[id];
      if (!s.monotone) continue;
      const ex = exact(id);
      for (let n = 1; n <= 64; n++) {
        const L = riemannSum(id, n, 'left').sum;
        const R = riemannSum(id, n, 'right').sum;
        const [lo, hi] = s.monotone === 'inc' ? [L, R] : [R, L];
        if (!(lo < ex && ex < hi)) off.push(`${id} n=${n}: ${lo} ${ex} ${hi}`);
        // R − L = (f(b) − f(a))Δx exactly
        if (!near(R - L, ((s.f(s.b) - s.f(s.a)) * (s.b - s.a)) / n, 1e-12)) off.push(`${id} n=${n}: R − L`);
      }
    }
    expect(off).toEqual([]);
  });

  it('the right sum of x² on [0, 3] equals 9(n + 1)(2n + 1)/(2n²), n = 1…200', () => {
    const off: string[] = [];
    for (let n = 1; n <= 200; n++) {
      const s = riemannSumOf((x) => x * x, 0, 3, n, 'right').sum;
      const f = (9 * (n + 1) * (2 * n + 1)) / (2 * n * n);
      if (relativeError(s, f) > 1e-13) off.push(`n=${n}: ${s} vs ${f}`);
    }
    expect(off).toEqual([]);
  });

  it('the rectangles tile [a, b]: n pieces of width Δx, sample points inside, S = Σ h·Δx = up − down', () => {
    const off: string[] = [];
    for (const id of RS_IDS) {
      const s = RS[id];
      for (const n of [1, 2, 7, 32, 64])
        for (const r of RS_RULES) {
          const { sum, dx, rects } = riemannSum(id, n, r);
          if (rects.length !== n || rects[0].x0 !== s.a || rects[n - 1].x1 !== s.b) off.push(`${id} ${r} n=${n}: ends`);
          for (const q of rects) {
            if (!near(q.x1 - q.x0, dx, 1e-12) || q.xs < q.x0 || q.xs > q.x1 || q.h !== s.f(q.xs)) off.push(`${id} ${r} n=${n}: a piece`);
          }
          const { up, down } = rectParts(rects);
          if (!near(up - down, sum, 1e-12)) off.push(`${id} ${r} n=${n}: up − down`);
        }
    }
    expect(off).toEqual([]);
  });

  it('cos with n ≥ 2: some rectangles count negative for every rule', () => {
    const off: string[] = [];
    for (let n = 2; n <= 64; n++) for (const r of RS_RULES) if (rectParts(riemannSum('cos', n, r).rects).negCount === 0) off.push(`${r} n=${n}`);
    expect(off).toEqual([]);
  });
});

describe('analytic limits: the sums tend to the integral, left/right like 1/n, midpoint like 1/n²', () => {
  it('the error ratio E(n)/E(2n) → 2 for left and right and → 4 for mid on sq and exp', () => {
    const off: string[] = [];
    for (const id of ['sq', 'exp'] as const) {
      const ex = exact(id);
      for (const [rule, target] of [
        ['left', 2],
        ['right', 2],
        ['mid', 4],
      ] as const) {
        const ratios: number[] = [];
        for (let n = 8; n <= 512; n *= 2) ratios.push((riemannSum(id, n, rule).sum - ex) / (riemannSum(id, 2 * n, rule).sum - ex));
        // the ratio at the finest n is within 1% of the target (for x² with the midpoint rule it is exactly 4)
        const last = ratios[ratios.length - 1];
        if (Math.abs(last - target) > 0.01 * target) off.push(`${id} ${rule}: ${ratios.map((q) => q.toFixed(4)).join(' ')}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('the leading error terms, every preset: n(L_n − ∫) → −(b − a)(f(b) − f(a))/2, n(R_n − ∫) → +…, n²(M_n − ∫) → −(b − a)²(f′(b) − f′(a))/24', () => {
    const off: string[] = [];
    const n = 2000;
    for (const id of RS_IDS) {
      const s = RS[id];
      const ex = exact(id);
      const cLR = ((s.b - s.a) * (s.f(s.b) - s.f(s.a))) / 2;
      const cM = -((s.b - s.a) ** 2 * (centralDiff(s.f, s.b) - centralDiff(s.f, s.a))) / 24;
      // the next terms are O(1/n) relative to these: an absolute floor of 1% where the leading coefficient is 0 (sin)
      const checks: [string, number, number][] = [
        ['left', n * (riemannSum(id, n, 'left').sum - ex), -cLR],
        ['right', n * (riemannSum(id, n, 'right').sum - ex), cLR],
        ['mid', n * n * (riemannSum(id, n, 'mid').sum - ex), cM],
      ];
      for (const [r, got, want] of checks) if (!near(got, want, 0.01)) off.push(`${id} ${r}: ${got} vs ${want}`);
    }
    expect(off).toEqual([]);
  });
});

describe('motion: displacement and distance, exact against Simpson of v and |v|', () => {
  it('displacement(t) = Simpson of v and distance(t) = Simpson of |v| on a grid of t', () => {
    const off: string[] = [];
    for (const id of MO_IDS) {
      const s = MO[id];
      for (const t of grid(0, s.T, 30)) {
        const sv = t === 0 ? 0 : simpson(s.v, 0, t, 2000);
        const sa = t === 0 ? 0 : simpson((u) => Math.abs(s.v(u)), 0, t, 2000);
        if (!near(displacement(id, t), sv, 1e-8)) off.push(`${id} t=${t}: displacement ${displacement(id, t)} vs ${sv}`);
        // |v| has a kink at a zero: Simpson is less accurate there
        if (!near(distance(id, t), sa, 1e-5)) off.push(`${id} t=${t}: distance ${distance(id, t)} vs ${sa}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('the totals of the brief: reverse 0 and 4, swing 0 and 4, forward 2π and 2π', () => {
    expect(displacement('reverse', 4)).toBeCloseTo(0, 14);
    expect(distance('reverse', 4)).toBeCloseTo(4, 14);
    expect(displacement('swing', 2 * Math.PI)).toBeCloseTo(0, 14);
    expect(distance('swing', 2 * Math.PI)).toBeCloseTo(4, 14);
    expect(displacement('forward', 2 * Math.PI)).toBeCloseTo(2 * Math.PI, 14);
    expect(distance('forward', 2 * Math.PI)).toBeCloseTo(2 * Math.PI, 14);
  });

  it('the zeros are sign changes of v, the touches are zeros without one; the distance never decreases', () => {
    const off: string[] = [];
    for (const id of MO_IDS) {
      const s = MO[id];
      for (const z of s.zeros) if (Math.abs(s.v(z)) > 1e-12 || s.v(z - 1e-3) * s.v(z + 1e-3) >= 0) off.push(`${id}: zero ${z}`);
      for (const z of s.touches) if (Math.abs(s.v(z)) > 1e-12 || s.v(z - 1e-3) * s.v(z + 1e-3) <= 0) off.push(`${id}: touch ${z}`);
      const ts = grid(0, s.T, 200);
      for (let i = 1; i < ts.length; i++) if (distance(id, ts[i]) < distance(id, ts[i - 1]) - 1e-12) off.push(`${id}: distance falls at ${ts[i]}`);
      // past a zero the displacement decreases (v changes from + to −)
      for (const z of s.zeros) if (!(displacement(id, z + 0.1) < displacement(id, z))) off.push(`${id}: displacement does not fall after ${z}`);
      // the default t and the windows hold the curves
      if (!(s.t0 > 0 && s.t0 < s.T)) off.push(`${id}: t0`);
      for (const t of ts) {
        const v = s.v(t);
        if (v < s.window.v[0] || v > s.window.v[1]) off.push(`${id}: v out of window at ${t}`);
        for (const q of [displacement(id, t), distance(id, t)]) if (q < s.window.x[0] || q > s.window.x[1]) off.push(`${id}: x out of window at ${t}`);
      }
    }
    expect(off).toEqual([]);
  });
});

describe('properties: additivity for any order of a, b, c, and comparison', () => {
  it('∫ₐᶜ + ∫ᶜᵇ = ∫ₐᵇ = 2 for every c in [−1, 4.5], with ∫₀ᶜ sin = 1 − cos c', () => {
    const off: string[] = [];
    for (const c of grid(ADD.c[0], ADD.c[1], 110)) {
      const { ac, cb, ab } = addParts(c);
      if (!near(ac + cb, ab, 1e-14) || !near(ab, 2, 1e-14)) off.push(`c=${c}: sum`);
      if (!near(ac, 1 - Math.cos(c), 1e-14)) off.push(`c=${c}: ∫₀ᶜ`);
      // against Simpson, the integral taken in its own direction (reversing the limits changes the sign)
      if (c !== 0 && !near(ac, simpson(ADD.f, 0, c, 2000), 1e-9)) off.push(`c=${c}: ∫₀ᶜ vs Simpson`);
    }
    expect(off).toEqual([]);
  });

  it('c beyond b: ∫ᶜᵇ = −∫ᵦᶜ, which is negative when c > π (sin < 0 there)', () => {
    const { cb } = addParts(4);
    const { pos, neg } = posNegOf(ADD.F, Math.PI, 4, ADD.zeros);
    expect(cb).toBeCloseTo(-(pos - neg), 14);
    expect(cb).toBeGreaterThan(0); // −∫_π⁴ sin and ∫_π⁴ sin < 0
    expect(pos).toBe(0);
  });

  it('comparison: e^(−x²) ≤ 1/(1 + x²) on [0, 2] (e^(x²) ≥ 1 + x²), and the stored ∫f matches Simpson; ∫g = arctan 2', () => {
    const off: string[] = [];
    for (const x of grid(0, 2, 400)) if (CMP.f(x) > CMP.g(x) + 1e-15 || Math.exp(x * x) < 1 + x * x) off.push(`x=${x}`);
    expect(off).toEqual([]);
    expect(relativeError(simpson(CMP.f, 0, 2, 4000), CMP.fInt)).toBeLessThan(1e-12);
    expect(relativeError(CMP.gInt, 1.10714871779409)).toBeLessThan(1e-13);
    expect(relativeError(CMP.G(2) - CMP.G(0), simpson(CMP.g, 0, 2, 4000))).toBeLessThan(1e-12);
    expect(CMP.fInt).toBeLessThan(CMP.gInt);
  });
});
