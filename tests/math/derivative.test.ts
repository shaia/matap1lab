import { describe, expect, it } from 'vitest';
import { centralDiff, relativeError } from '~/math/analysis';
import {
  DFN,
  DIDS,
  H_MIN,
  KINK_SNAP,
  decadesPassed,
  diffQuotient,
  differentiableAt,
  inDomain,
  kinkAt,
  linearize,
  quotientAt,
  secantRows,
  snapX0,
  tangentAt,
  type DId,
} from '~/math/derivative';

// constants recomputed with sympy 2026-11-27: tangent of x² at 3 is 6x − 9; (x³)′(5) = 75, f(5) = 125; the tangent of
// x³ − 3x at 2 is 9x − 16 and x³ − 3x − (9x − 16) = (x − 2)²(x + 4); the kink piecewise is continuous at 1 (value 1)
// with one-sided slopes 2 and −1; the glue piecewise has value 1 and slope 2 from both sides at 1; ∛h/h = 100 at
// h = 10⁻³; √h/h → +∞ as h → 0⁺.

/**
 * Seams: points where f is differentiable but not twice (glue at 1: f″ jumps from 2 to 0). A central difference whose
 * stencil straddles a seam has error O(h), not O(h²) (≈ 5e-6 at h = 1e-5 for glue), so the O(h²) claim excludes them.
 */
const SEAMS: Partial<Record<DId, number[]>> = { glue: [1] };

/** sample points of x0Range, at least `gap` away from every kink and seam */
function samples(id: DId, n: number, gap: number): number[] {
  const s = DFN[id];
  const out: number[] = [];
  const avoid = [...s.kinks.map((k) => k.x), ...(SEAMS[id] ?? [])];
  for (const [lo, hi] of s.x0Range) {
    for (let i = 0; i <= n; i++) {
      const x = lo + ((hi - lo) * i) / n;
      if (avoid.some((k) => Math.abs(k - x) < gap)) continue;
      if (!inDomain(id, x - gap) || !inDomain(id, x + gap)) continue;
      out.push(x);
    }
  }
  return out;
}

describe('derivative: exact identities (the stored closed-form f′ is the derivative of f)', () => {
  it('every entry: f′ agrees with the central difference at 101 points per piece, away from kinks (|Δ| ≤ 1e-6·max(1, |f′|))', () => {
    const off: string[] = [];
    for (const id of DIDS) {
      const s = DFN[id];
      for (const x of samples(id, 100, 0.02)) {
        const exact = s.df(x);
        const num = centralDiff(s.f, x, 1e-5);
        // against a value near 0 a relative error means nothing: the bound is absolute there (central error ~1e-10)
        if (!(Math.abs(exact - num) <= 1e-6 * Math.max(1, Math.abs(exact)))) off.push(`${id} at ${x}: ${exact} vs ${num}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('f′ is NaN exactly at the kinks and outside the domain; finite everywhere else that was sampled', () => {
    const off: string[] = [];
    for (const id of DIDS) {
      const s = DFN[id];
      for (const k of s.kinks) if (!Number.isNaN(s.df(k.x))) off.push(`${id}: f′(${k.x}) is not NaN`);
      for (const x of samples(id, 50, 0.02)) if (!Number.isFinite(s.df(x))) off.push(`${id}: f′(${x}) not finite`);
    }
    if (!Number.isNaN(DFN.sqrt.df(-1))) off.push('sqrt: f′(−1)');
    if (!Number.isNaN(DFN.recip.df(0)) || !Number.isNaN(DFN.recip.f(0))) off.push('recip at 0');
    expect(off).toEqual([]);
  });

  it('every kink is a point of continuity: f(k ± 1e-9) is within 1e-4 of f(k) on each side in the domain', () => {
    const off: string[] = [];
    for (const id of DIDS) {
      const s = DFN[id];
      for (const k of s.kinks) {
        const fk = s.f(k.x);
        for (const side of [-1, 1]) {
          const x = k.x + side * 1e-9;
          if (!inDomain(id, x)) continue;
          // ∛x moves by ∛(1e-9) = 1e-3 here; 1e-12 gives 1e-4: both shrink to 0 with the step
          const step = id === 'cbrt' ? 1e-12 : 1e-9;
          if (Math.abs(s.f(k.x + side * step) - fk) > 1e-4) off.push(`${id} at ${k.x} side ${side}`);
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('defaults are consistent: x0 in x0Range, x0Range inside the window and the domain, kinks inside x0Range', () => {
    const off: string[] = [];
    for (const id of DIDS) {
      const s = DFN[id];
      const inRange = (x: number) => s.x0Range.some(([lo, hi]) => x >= lo && x <= hi);
      if (!inRange(s.x0)) off.push(`${id}: x0`);
      for (const [lo, hi] of s.x0Range) {
        if (lo < s.window.x[0] || hi > s.window.x[1]) off.push(`${id}: piece [${lo}, ${hi}] leaves the window`);
        if (!inDomain(id, lo) || !inDomain(id, hi) || !inDomain(id, (lo + hi) / 2)) off.push(`${id}: piece leaves the domain`);
      }
      for (const k of s.kinks) if (!inRange(k.x)) off.push(`${id}: kink ${k.x}`);
      if (snapX0(id, s.x0) !== s.x0) off.push(`${id}: default x0 is not a snapped position`);
    }
    expect(off).toEqual([]);
  });
});

describe('derivative: analytic limits (the difference quotient tends to f′)', () => {
  it('forward quotient error is O(h): err(10⁻³)/err(10⁻⁴) ≈ 10 where f″ ≠ 0 (between 8 and 12)', () => {
    const off: string[] = [];
    const pts: [DId, number][] = [
      ['x2', 3],
      ['x3', 5],
      ['recip', 1],
      ['sqrt', 1],
      ['sin', 1],
      ['exp', 0],
      ['cubic', 2],
    ];
    for (const [id, x] of pts) {
      const s = DFN[id];
      const e3 = Math.abs(diffQuotient(s.f, x, 1e-3) - s.df(x));
      const e4 = Math.abs(diffQuotient(s.f, x, 1e-4) - s.df(x));
      const r = e3 / e4;
      if (!(r > 8 && r < 12)) off.push(`${id} at ${x}: ratio ${r}`);
    }
    expect(off).toEqual([]);
  });

  it('central quotient error is O(h²): err(10⁻²)/err(10⁻³) ≈ 100 where f‴ ≠ 0 (between 80 and 120)', () => {
    const off: string[] = [];
    const pts: [DId, number][] = [
      ['recip', 1],
      ['sqrt', 1],
      ['sin', 1],
      ['exp', 0],
      ['x3', 5],
    ];
    for (const [id, x] of pts) {
      const s = DFN[id];
      const e2 = Math.abs(centralDiff(s.f, x, 1e-2) - s.df(x));
      const e3 = Math.abs(centralDiff(s.f, x, 1e-3) - s.df(x));
      const r = e2 / e3;
      if (!(r > 80 && r < 120)) off.push(`${id} at ${x}: ratio ${r}`);
    }
    expect(off).toEqual([]);
  });

  it('x²: the quotient at 3 is exactly 6 + h (up to rounding), on both sides', () => {
    const off: string[] = [];
    for (const h of [1, 0.1, 0.01, 1e-3, 1e-4, -1, -0.1, -1e-3, -1e-4]) {
      const q = quotientAt('x2', 3, h);
      if (Math.abs(q - (6 + h)) > 1e-10) off.push(`h=${h}: ${q}`);
    }
    expect(off).toEqual([]);
  });

  it('corners: the one-sided quotients at h = ±10⁻⁶ are within 1e-5 of the stored one-sided slopes', () => {
    const off: string[] = [];
    for (const id of DIDS) {
      for (const k of DFN[id].kinks) {
        if (k.kind !== 'corner') continue;
        const qr = quotientAt(id, k.x, 1e-6);
        const ql = quotientAt(id, k.x, -1e-6);
        if (Math.abs(qr - k.right) > 1e-5) off.push(`${id} right ${qr}`);
        if (Math.abs(ql - k.left) > 1e-5) off.push(`${id} left ${ql}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('vertical tangents: |quotient| grows past 10³ at |h| = 10⁻⁶ on every side in the domain, with the stored sign', () => {
    const off: string[] = [];
    for (const id of DIDS) {
      for (const k of DFN[id].kinks) {
        if (k.kind !== 'vertical') continue;
        for (const [h, slope] of [
          [1e-6, k.right],
          [-1e-6, k.left],
        ] as [number, number][]) {
          const q = quotientAt(id, k.x, h);
          if (Number.isNaN(slope)) {
            if (!Number.isNaN(q)) off.push(`${id}: side h=${h} should be outside the domain`);
            continue;
          }
          if (!(Math.abs(q) > 1e3 && Math.sign(q) === Math.sign(slope))) off.push(`${id} h=${h}: ${q}`);
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('glue: both one-sided quotients at 1 tend to 2 (differentiable, bank Q-5.1-glue)', () => {
    expect(Math.abs(quotientAt('glue', 1, 1e-6) - 2)).toBeLessThan(1e-5);
    expect(Math.abs(quotientAt('glue', 1, -1e-6) - 2)).toBeLessThan(1e-5);
    expect(DFN.glue.df(1)).toBe(2);
    expect(DFN.glue.f(1)).toBe(1);
    expect(DFN.glue.f(1 + 1e-12)).toBeCloseTo(1, 10);
  });

  it('linear approximation: (Δy − dy)/dx → 0 at every default point (below 1e-2 at dx = ±10⁻⁴)', () => {
    const off: string[] = [];
    for (const id of DIDS) {
      const a = DFN[id].x0;
      if (!differentiableAt(id, a)) continue;
      for (const dx of [1e-4, -1e-4]) {
        const r = linearize(id, a, dx).err / dx;
        if (!(Math.abs(r) < 1e-2)) off.push(`${id} at ${a}, dx=${dx}: ${r}`);
      }
    }
    expect(off).toEqual([]);
  });
});

describe('derivative: special values from the brief and the notes', () => {
  it('x²: the tangent at 3 is y = 6x − 9 (notes p. 7)', () => {
    const t = tangentAt('x2', 3);
    expect(t).toEqual({ vertical: false, m: 6, b: -9 });
  });

  it('x³: f(5) = 125 and f′(5) = 75 (notes p. 8)', () => {
    expect(DFN.x3.f(5)).toBe(125);
    expect(DFN.x3.df(5)).toBe(75);
  });

  it('x³ − 3x: the tangent at 2 is y = 9x − 16 and meets the graph again at x = −4', () => {
    expect(tangentAt('cubic', 2)).toEqual({ vertical: false, m: 9, b: -16 });
    expect(DFN.cubic.f(-4)).toBe(-52);
    const l = linearize('cubic', 2, -6);
    expect(l.fx).toBe(-52);
    expect(l.L).toBe(-52);
    expect(l.err).toBe(0);
  });

  it('x²: linearize at 3 with dx = 0.1 gives Δy = 0.61, dy = 0.6, error 0.01 (= dx², so err/dx = dx)', () => {
    const l = linearize('x2', 3, 0.1);
    expect(relativeError(l.Dy, 0.61)).toBeLessThan(1e-12);
    expect(relativeError(l.dy, 0.6)).toBeLessThan(1e-12);
    expect(relativeError(l.err, 0.01)).toBeLessThan(1e-12);
  });

  it('kinks: |x| corner at 0 (−1, 1); the kink piecewise corner at 1 (2, −1) with f(1) = 1; ∛x and √x vertical at 0', () => {
    expect(kinkAt('abs', 0)).toEqual({ x: 0, kind: 'corner', left: -1, right: 1 });
    expect(kinkAt('kink', 1)).toEqual({ x: 1, kind: 'corner', left: 2, right: -1 });
    expect(DFN.kink.f(1)).toBe(1);
    expect(kinkAt('cbrt', 0)?.kind).toBe('vertical');
    expect(kinkAt('sqrt', 0)?.kind).toBe('vertical');
    expect(Number.isNaN(kinkAt('sqrt', 0)?.left)).toBe(true);
    expect(kinkAt('glue', 1)).toBeNull();
  });

  it('tangentAt: null at a corner and outside the domain; vertical at ∛x and √x at 0', () => {
    expect(tangentAt('abs', 0)).toBeNull();
    expect(tangentAt('kink', 1)).toBeNull();
    expect(tangentAt('recip', 0)).toBeNull();
    expect(tangentAt('sqrt', -1)).toBeNull();
    expect(tangentAt('cbrt', 0)).toEqual({ vertical: true, x: 0 });
    expect(tangentAt('sqrt', 0)).toEqual({ vertical: true, x: 0 });
  });

  it('∛x at 0: the quotient is |h|^(−2/3): 100 at h = ±10⁻³ (exactly 100, not more) and 10^(8/3) ≈ 464 at 10⁻⁴', () => {
    expect(relativeError(quotientAt('cbrt', 0, 1e-3), 100)).toBeLessThan(1e-12);
    expect(relativeError(quotientAt('cbrt', 0, -1e-3), 100)).toBeLessThan(1e-12);
    expect(relativeError(quotientAt('cbrt', 0, H_MIN), 10 ** (8 / 3))).toBeLessThan(1e-12);
  });
});

describe('derivative: the table and the positions', () => {
  it('secantRows: one row per decade passed, with the sign of h, plus the current h when it is not a decade', () => {
    expect(secantRows('x2', 3, 2).map((r) => r.h)).toEqual([2]);
    expect(secantRows('x2', 3, 1e-2).map((r) => r.h)).toEqual([1, 0.1, 0.01]);
    expect(secantRows('x2', 3, -0.05).map((r) => r.h)).toEqual([-1, -0.1, -0.05]);
    expect(decadesPassed(1e-4)).toHaveLength(5);
    // Q outside the domain: no quotient
    expect(Number.isNaN(secantRows('sqrt', 0, -0.1).at(-1)?.q)).toBe(true);
  });

  it('snapX0: onto a kink within KINK_SNAP, into the pieces of x0Range, rounded to 0.01', () => {
    expect(snapX0('abs', 0.04)).toBe(0);
    expect(snapX0('abs', -KINK_SNAP)).toBe(0);
    expect(snapX0('abs', 0.06)).toBe(0.06);
    expect(snapX0('kink', 1.03)).toBe(1);
    expect(snapX0('recip', 0.1)).toBe(0.25);
    expect(snapX0('recip', -0.1)).toBe(-0.25);
    expect(snapX0('sqrt', -0.3)).toBe(0);
    expect(snapX0('x2', 10)).toBe(4.8);
    expect(snapX0('x2', 3.004)).toBe(3);
  });
});
