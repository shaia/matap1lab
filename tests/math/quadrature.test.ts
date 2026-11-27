import { describe, expect, it } from 'vitest';
import { relativeError, secondDiff } from '~/math/analysis';
import {
  DOUBLINGS,
  ERROR_IDS,
  NQ,
  NQ_IDS,
  chordArea,
  chordAt,
  errorBound,
  errors,
  nodes,
  parabolaArea,
  parabolaAt,
  pieces,
  simpson,
  simpsonOf,
  trapezoid,
  trapezoidOf,
  type NqId,
} from '~/math/quadrature';

// Every stored closed form was recomputed with sympy on 2026-11-27:
//   ∫₀¹ eˣ = e − 1; ∫₁² dx/x = ln 2; ∫₀^π sin = 2; ∫₀² x³ = 4; ∫₀¹ e^(−x²) = √π·erf(1)/2 = 0.746824132812427; ∫₀¹ dx/(1 + x²) = π/4.
//   f″, f⁽⁴⁾: eˣ, eˣ; 2/x³, 24/x⁵; −sin x, sin x; 6x, 0; (4x² − 2)e^(−x²), (16x⁴ − 48x² + 12)e^(−x²);
//   (6x² − 2)/(1 + x²)³, 24(5x⁴ − 10x² + 1)/(1 + x²)⁵.
//   M₂ = max|f″|, M₄ = max|f⁽⁴⁾| (critical points of f″, f⁽⁴⁾ in [a, b] and the ends): exp e, e (x = 1); recip 2, 24 (x = 1);
//   sin 1, 1 (x = π/2); cubic 12 (x = 2), 0; gauss 2, 12 (x = 0); lorentz 2, 24 (x = 0).
//   f′(b) − f′(a) and f‴(b) − f‴(a): exp e − 1, e − 1; recip 3/4, 45/8; sin −2, 2; gauss −2/e, 4/e; lorentz −1/2, 0.

const evens = (lo: number, hi: number) => Array.from({ length: (hi - lo) / 2 + 1 }, (_, k) => lo + 2 * k);
const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, k) => lo + k);
/** a tolerance for rounding: ~100 ulps of the integral's size (a sum of up to 256 terms) */
const roundoff = (id: NqId) => 1e-13 * Math.max(1, Math.abs(NQ[id].exact));

describe('exact identities', () => {
  it('Simpson is exact on the cubic x³ over [0, 2] for every even n = 2…64 (M₄ = 0)', () => {
    const off: string[] = [];
    for (const n of evens(2, 64)) {
      const s = simpson('cubic', n);
      if (Math.abs(s - 4) > 1e-12) off.push(`n=${n}: S=${s}`);
    }
    expect(off).toEqual([]);
    expect(NQ.cubic.M4).toBe(0);
    expect(errorBound('cubic', 2, 'simpson')).toBe(0);
  });

  it('Simpson is exact on every cubic polynomial, also over an interval not starting at 0 (the odd part about the middle cancels)', () => {
    const off: string[] = [];
    const cubics: [number, number, number, number][] = [
      [1, -2, 3, -4],
      [-0.5, 0, 2, 1],
      [0, 1, 0, 0],
    ];
    for (const [c3, c2, c1, c0] of cubics) {
      const f = (x: number) => c3 * x ** 3 + c2 * x * x + c1 * x + c0;
      const F = (x: number) => (c3 * x ** 4) / 4 + (c2 * x ** 3) / 3 + (c1 * x * x) / 2 + c0 * x;
      for (const [a, b] of [
        [-1, 2],
        [0.5, 3],
      ])
        for (const n of [2, 4, 10]) {
          const s = simpsonOf(f, a, b, n);
          const ex = F(b) - F(a);
          if (Math.abs(s - ex) > 1e-12 * Math.max(1, Math.abs(ex))) off.push(`${c3},${c2},${c1},${c0} on [${a}, ${b}] n=${n}: ${s} vs ${ex}`);
        }
    }
    expect(off).toEqual([]);
  });

  it('the trapezoid rule is exact on a linear f for every n = 1…64', () => {
    const off: string[] = [];
    const lines: [number, number][] = [
      [2, -1],
      [-0.7, 3],
      [0, 5],
    ];
    for (const [m, c] of lines)
      for (const n of range(1, 64)) {
        const t = trapezoidOf((x) => m * x + c, -1, 3, n);
        const ex = (m / 2) * (9 - 1) + c * 4;
        if (Math.abs(t - ex) > 1e-12 * Math.max(1, Math.abs(ex))) off.push(`${m}x + ${c}, n=${n}: ${t} vs ${ex}`);
      }
    expect(off).toEqual([]);
  });

  it('each Simpson parabola passes through its three points, and each chord through its two nodes, for every preset and n', () => {
    const off: string[] = [];
    for (const id of NQ_IDS) {
      const f = NQ[id].f;
      for (const n of evens(2, 64))
        for (const p of pieces(id, n, 'simpson'))
          for (const [x, y] of [
            [p.x0, p.y0],
            [p.xm, p.y1],
            [p.x2, p.y2],
          ] as const) {
            if (Math.abs(parabolaAt(p, x) - y) > 1e-12 * Math.max(1, Math.abs(y))) off.push(`${id} n=${n}: parabola misses (${x}, ${y})`);
            if (Math.abs(f(x) - y) > 1e-15 * Math.max(1, Math.abs(y))) off.push(`${id} n=${n}: node value ≠ f`);
          }
      for (const n of range(1, 64))
        for (const c of pieces(id, n, 'trap')) {
          if (Math.abs(chordAt(c, c.x0) - f(c.x0)) > 1e-12 || Math.abs(chordAt(c, c.x1) - f(c.x1)) > 1e-12 * Math.max(1, Math.abs(f(c.x1))))
            off.push(`${id} n=${n}: chord misses a node`);
        }
    }
    expect(off).toEqual([]);
  });

  it('the pieces add up to the rule: Σ chord areas = Tₙ, Σ parabola areas = Sₙ; the nodes span [a, b] with step h', () => {
    const off: string[] = [];
    for (const id of NQ_IDS) {
      const s = NQ[id];
      for (const n of range(1, 64)) {
        const { h, xs } = nodes(id, n);
        if (xs.length !== n + 1 || xs[0] !== s.a || xs[n] !== s.b || Math.abs(h - (s.b - s.a) / n) > 1e-15) off.push(`${id} n=${n}: nodes`);
        const tc = pieces(id, n, 'trap').reduce((acc, c) => acc + chordArea(c), 0);
        if (relativeError(tc, trapezoid(id, n)) > 1e-13) off.push(`${id} n=${n}: Σ chords ${tc} ≠ T ${trapezoid(id, n)}`);
        if (n % 2 === 0) {
          const ps = pieces(id, n, 'simpson');
          if (ps.length !== n / 2) off.push(`${id} n=${n}: ${ps.length} parabolas`);
          const sp = ps.reduce((acc, p) => acc + parabolaArea(p), 0);
          if (relativeError(sp, simpson(id, n)) > 1e-13) off.push(`${id} n=${n}: Σ parabolas ${sp} ≠ S ${simpson(id, n)}`);
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('T₄ of x² on [0, 2] is 11/4 and S₂ of sin on [0, π] is 2π/3 (the bank keys Q-8.4-trap-basic and Q-8.4-simpson-basic)', () => {
    expect(trapezoidOf((x) => x * x, 0, 2, 4)).toBeCloseTo(2.75, 14);
    expect(simpson('sin', 2)).toBeCloseTo((2 * Math.PI) / 3, 14);
  });

  it('an odd n for Simpson, and n < 1 or a fraction for either rule, throw', () => {
    expect(() => simpson('exp', 3)).toThrow(RangeError);
    expect(() => pieces('exp', 5, 'simpson')).toThrow(RangeError);
    expect(() => errorBound('exp', 7, 'simpson')).toThrow(RangeError);
    expect(() => trapezoid('exp', 0)).toThrow(RangeError);
    expect(() => trapezoid('exp', 2.5)).toThrow(RangeError);
  });
});

describe('the stored closed forms', () => {
  it('the exact integral of each preset agrees with a fine Simpson sum', () => {
    const off: string[] = [];
    for (const id of NQ_IDS) {
      const r = relativeError(simpson(id, 2000), NQ[id].exact);
      if (r > 1e-12) off.push(`${id}: relative error ${r}`);
    }
    expect(off).toEqual([]);
    expect(NQ.exp.exact).toBe(Math.E - 1);
    expect(NQ.recip.exact).toBe(Math.LN2);
    expect(NQ.lorentz.exact).toBe(Math.PI / 4);
  });

  it('f″ is the second difference of f, and f⁽⁴⁾ the second difference of f″, on a grid of [a, b]', () => {
    const off: string[] = [];
    for (const id of NQ_IDS) {
      const s = NQ[id];
      for (let i = 0; i <= 40; i++) {
        const x = s.a + ((s.b - s.a) * i) / 40;
        const d2 = secondDiff(s.f, x, 1e-4);
        const d4 = secondDiff(s.f2, x, 1e-3);
        if (Math.abs(d2 - s.f2(x)) > 1e-5 * Math.max(1, Math.abs(s.f2(x)))) off.push(`${id} x=${x}: f″ ${s.f2(x)} vs ${d2}`);
        if (Math.abs(d4 - s.f4(x)) > 1e-4 * Math.max(1, Math.abs(s.f4(x)))) off.push(`${id} x=${x}: f⁽⁴⁾ ${s.f4(x)} vs ${d4}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('M₂ and M₄ are the maxima of |f″| and |f⁽⁴⁾| on [a, b]: attained at the stored point, never exceeded on a grid', () => {
    const off: string[] = [];
    for (const id of NQ_IDS) {
      const s = NQ[id];
      if (Math.abs(Math.abs(s.f2(s.M2at)) - s.M2) > 1e-12 * Math.max(1, s.M2)) off.push(`${id}: |f″(${s.M2at})| ≠ M₂`);
      if (Math.abs(Math.abs(s.f4(s.M4at)) - s.M4) > 1e-12 * Math.max(1, s.M4)) off.push(`${id}: |f⁽⁴⁾(${s.M4at})| ≠ M₄`);
      if (s.M2at < s.a || s.M2at > s.b || s.M4at < s.a || s.M4at > s.b) off.push(`${id}: maximum point outside [a, b]`);
      for (let i = 0; i <= 2000; i++) {
        const x = s.a + ((s.b - s.a) * i) / 2000;
        if (Math.abs(s.f2(x)) > s.M2 * (1 + 1e-12)) off.push(`${id} x=${x}: |f″| > M₂`);
        if (Math.abs(s.f4(x)) > s.M4 * (1 + 1e-12) + 1e-15) off.push(`${id} x=${x}: |f⁽⁴⁾| > M₄`);
      }
    }
    expect(off).toEqual([]);
  });
});

describe('analytic limits: the error ratio E(n)/E(2n)', () => {
  it('trapezoid: → 4 for n = 4…128 on exp, recip, sin, gauss, lorentz (|ratio − 4| ≤ 2/n²)', () => {
    const off: string[] = [];
    for (const id of ['exp', 'recip', 'sin', 'gauss', 'lorentz'] as const)
      for (let n = 4; n <= 128; n *= 2) {
        const r = (trapezoid(id, n) - NQ[id].exact) / (trapezoid(id, 2 * n) - NQ[id].exact);
        if (Math.abs(r - 4) > 2 / n ** 2) off.push(`${id} n=${n}: ratio ${r}`);
      }
    expect(off).toEqual([]);
  });

  it('Simpson: → 16 for n = 4…128 on exp, recip, sin, gauss (|ratio − 16| ≤ 40/n², plus 0.01 for rounding at n = 256)', () => {
    const off: string[] = [];
    for (const id of ['exp', 'recip', 'sin', 'gauss'] as const)
      for (let n = 4; n <= 128; n *= 2) {
        const r = (simpson(id, n) - NQ[id].exact) / (simpson(id, 2 * n) - NQ[id].exact);
        if (Math.abs(r - 16) > 40 / n ** 2 + 0.01) off.push(`${id} n=${n}: ratio ${r}`);
      }
    expect(off).toEqual([]);
  });

  it('Simpson on lorentz: → 64, not 16, because f‴(0) = f‴(1) = 0 kills the h⁴ term (n = 8…32, before rounding takes over)', () => {
    const off: string[] = [];
    const f3 = (x: number) => (24 * x * (1 - x * x)) / (1 + x * x) ** 4;
    expect(f3(0)).toBe(0);
    expect(f3(1)).toBe(0);
    for (const n of [8, 16, 32]) {
      const r = (simpson('lorentz', n) - NQ.lorentz.exact) / (simpson('lorentz', 2 * n) - NQ.lorentz.exact);
      if (Math.abs(r - 64) > 0.2) off.push(`n=${n}: ratio ${r}`);
    }
    expect(off).toEqual([]);
  });

  it('the error plot presets: both errors are non-zero at every doubling n = 2…256, and from n = 64 the trapezoid error exceeds Simpson’s by a factor > 1000', () => {
    const off: string[] = [];
    for (const id of ERROR_IDS) {
      const et = errors(id, 'trap', DOUBLINGS);
      const es = errors(id, 'simpson', DOUBLINGS);
      DOUBLINGS.forEach((n, k) => {
        if (!(Math.abs(et[k].error) > 0) || !(Math.abs(es[k].error) > 0)) off.push(`${id} n=${n}: a zero error`);
        if (n >= 64 && !(Math.abs(et[k].error) / Math.abs(es[k].error) > 1000)) off.push(`${id} n=${n}: E_T/E_S = ${et[k].error / es[k].error}`);
      });
    }
    expect(off).toEqual([]);
    expect([...ERROR_IDS]).not.toContain('cubic');
    expect([...ERROR_IDS]).not.toContain('lorentz');
  });
});

describe('error bounds hold', () => {
  it('|Tₙ − I| ≤ (b − a)³M₂/(12n²) for n = 1…256 and |Sₙ − I| ≤ (b − a)⁵M₄/(180n⁴) for even n = 2…256, every preset', () => {
    const off: string[] = [];
    for (const id of NQ_IDS) {
      for (const row of errors(id, 'trap', range(1, 256)))
        if (Math.abs(row.error) > row.bound + roundoff(id)) off.push(`${id} T n=${row.n}: |E| ${Math.abs(row.error)} > ${row.bound}`);
      for (const row of errors(id, 'simpson', evens(2, 256)))
        if (Math.abs(row.error) > row.bound + roundoff(id)) off.push(`${id} S n=${row.n}: |E| ${Math.abs(row.error)} > ${row.bound}`);
    }
    expect(off).toEqual([]);
  });

  it('errors() reports the rule’s value, its signed error and the bound', () => {
    const [row] = errors('exp', 'trap', [4]);
    expect(row.value).toBe(trapezoid('exp', 4));
    expect(row.error).toBe(trapezoid('exp', 4) - (Math.E - 1));
    expect(row.bound).toBeCloseTo(Math.E / (12 * 16), 15);
    expect(errorBound('recip', 4, 'simpson')).toBeCloseTo(24 / (180 * 256), 15);
  });
});

describe('convexity', () => {
  it('exp (f″ > 0): Tₙ > ∫ for every n = 1…256 (chords above the graph); sin on [0, π] (f″ ≤ 0): Tₙ < ∫', () => {
    const off: string[] = [];
    for (const n of range(1, 256)) {
      if (!(trapezoid('exp', n) > NQ.exp.exact)) off.push(`exp n=${n}`);
      if (!(trapezoid('sin', n) < NQ.sin.exact)) off.push(`sin n=${n}`);
    }
    expect(off).toEqual([]);
  });

  it('exp, n = 1…4: every chord lies above the curve inside its piece', () => {
    const off: string[] = [];
    for (const n of [1, 2, 3, 4])
      for (const c of pieces('exp', n, 'trap'))
        for (let k = 1; k < 20; k++) {
          const x = c.x0 + ((c.x1 - c.x0) * k) / 20;
          if (!(chordAt(c, x) > Math.exp(x))) off.push(`n=${n} x=${x}`);
        }
    expect(off).toEqual([]);
  });
});
