import { describe, expect, it } from 'vitest';
import { centralDiff, relativeError } from '~/math/analysis';
import { simpson } from '~/math/multivar';
import {
  POW,
  POW_IDS,
  TRI_KINDS,
  clampTri,
  halfAngle,
  identityValue,
  rootOfTheta,
  triSub,
  xDefault,
  xOfTheta,
  xRange,
} from '~/math/trigint';

// Every closed form was recomputed with sympy on 2026-11-27 (screens/tools/cas.py): the four identities, the four areas
// from 0 (∫₀ˣ sin³ = (1 − cos x)²(cos x + 2)/3), t = sin x/(1 + cos x) = tan(x/2), d(2 arctan t)/dt = 2/(1 + t²),
// dx/dθ = a cos θ, a/cos²θ, a sin θ/cos²θ.

/** a comparison against a closed form that crosses 0: |a − b| ≤ tol·max(1, |b|) */
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

const grid = (lo: number, hi: number, n: number) => Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n);

describe('trigint: exact identities of the power presets', () => {
  it('identity form (sum of the parts) equals f on a grid of [0, 2π]', () => {
    const off: string[] = [];
    for (const id of POW_IDS) {
      for (const x of grid(0, 2 * Math.PI, 400)) {
        if (!near(identityValue(id, x), POW[id].f(x), 1e-12)) off.push(`${id} @ ${x}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('closed-form area from 0 equals Simpson of f on [0, x]', () => {
    const off: string[] = [];
    for (const id of POW_IDS) {
      for (const x of grid(0, 2 * Math.PI, 24)) {
        const exact = POW[id].area(x);
        const num = x === 0 ? 0 : simpson(POW[id].f, 0, x, 2000);
        if (!near(num, exact, 1e-9)) off.push(`${id} @ ${x}: ${num} vs ${exact}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('area of every preset is 0 at x = 0', () => {
    const off = POW_IDS.filter((id) => POW[id].area(0) !== 0);
    expect(off).toEqual([]);
  });

  it('sin², cos²: constant part area x/2 plus oscillating part area equals the area, and the wiggle stays within 1/4', () => {
    const off: string[] = [];
    for (const id of ['sin2', 'cos2'] as const) {
      const s = POW[id];
      for (const x of grid(0, 2 * Math.PI, 200)) {
        if (!near(s.constArea!(x) + s.oscArea!(x), s.area(x), 1e-12)) off.push(`${id} sum @ ${x}`);
        if (Math.abs(s.oscArea!(x)) > s.oscBound! + 1e-12) off.push(`${id} bound @ ${x}`);
      }
      for (const k of [1, 2]) {
        if (!near(s.area(k * Math.PI), (k * Math.PI) / 2, 1e-12)) off.push(`${id} area(${k}π) is not kπ/2`);
      }
    }
    expect(off).toEqual([]);
  });

  it('presets without a constant part declare none', () => {
    expect(POW.sincos.constArea).toBeNull();
    expect(POW.sin3.constArea).toBeNull();
    expect(POW.sin2.parts.filter((p) => p.kind === 'const')).toHaveLength(1);
  });
});

describe('trigint: exact identities of the Weierstrass substitution', () => {
  it('cos x = (1 − t²)/(1 + t²), sin x = 2t/(1 + t²) on (−π, π)', () => {
    const off: string[] = [];
    for (const x of grid(-3.1, 3.1, 400)) {
      const h = halfAngle(x);
      if (!near(h.cosFromT, h.cos, 1e-12)) off.push(`cos @ ${x}`);
      if (!near(h.sinFromT, h.sin, 1e-12)) off.push(`sin @ ${x}`);
    }
    expect(off).toEqual([]);
  });

  it('t = sin x/(1 + cos x) (the line from S = (−1, 0) through P meets the y-axis at (0, t))', () => {
    const off: string[] = [];
    for (const x of grid(-3.0, 3.0, 300)) {
      if (!near(halfAngle(x).t, Math.sin(x) / (1 + Math.cos(x)), 1e-9)) off.push(`@ ${x}`);
    }
    expect(off).toEqual([]);
  });

  it('dx/dt = 2/(1 + t²) is the derivative of x(t) = 2 arctan t', () => {
    const off: string[] = [];
    for (const t of grid(-8, 8, 160)) {
      const x = 2 * Math.atan(t);
      const h = halfAngle(x);
      if (!near(centralDiff((u) => 2 * Math.atan(u), t), h.dxdt, 1e-8)) off.push(`@ t = ${t}`);
      if (!near(h.t, t, 1e-9)) off.push(`round trip @ t = ${t}`);
    }
    expect(off).toEqual([]);
  });
});

describe('trigint: exact identities of the trigonometric substitutions', () => {
  const as = [1, 1.5, 2, 3];

  it('the three sides satisfy Pythagoras and the root equals its closed form in x', () => {
    const off: string[] = [];
    for (const kind of TRI_KINDS) {
      for (const a of as) {
        const [lo, hi] = xRange(kind, a);
        for (const x of grid(lo, hi, 60)) {
          const t = triSub(kind, a, x);
          if (!near(t.opp ** 2 + t.adj ** 2, t.hyp ** 2, 1e-12)) off.push(`${kind} a=${a} x=${x}: Pythagoras`);
          const closed = kind === 'sin' ? Math.sqrt(a * a - x * x) : kind === 'tan' ? Math.sqrt(a * a + x * x) : Math.sqrt(x * x - a * a);
          if (!near(t.root, Math.max(0, closed) || 0, 1e-9)) off.push(`${kind} a=${a} x=${x}: root ${t.root} vs ${closed}`);
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('x = a sin θ, a tan θ, a/cos θ and the root a cos θ, a/cos θ, a tan θ hold at the returned θ', () => {
    const off: string[] = [];
    for (const kind of TRI_KINDS) {
      for (const a of as) {
        const [lo, hi] = xRange(kind, a);
        for (const x of grid(lo, hi, 60)) {
          const t = triSub(kind, a, x);
          if (!near(xOfTheta(kind, a, t.theta), x, 1e-9)) off.push(`${kind} a=${a} x=${x}: x(θ)`);
          if (!near(rootOfTheta(kind, a, t.theta), t.root, 1e-9)) off.push(`${kind} a=${a} x=${x}: root(θ)`);
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('dx/dθ equals the derivative of x(θ) (centralDiff)', () => {
    const off: string[] = [];
    for (const kind of TRI_KINDS) {
      for (const a of as) {
        const [lo, hi] = xRange(kind, a);
        for (const x of grid(lo, hi, 30)) {
          const t = triSub(kind, a, x);
          if (kind === 'sin' && Math.abs(Math.abs(x) - a) < 1e-9) continue; // a one-sided edge: asin is vertical there
          if (kind === 'sec' && Math.abs(x - a) < 1e-9) continue; // θ = 0 is the end of the range
          const num = centralDiff((th) => xOfTheta(kind, a, th), t.theta, 1e-6);
          if (!near(num, t.dxdtheta, 1e-6)) off.push(`${kind} a=${a} x=${x}: ${num} vs ${t.dxdtheta}`);
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('the starting x of every kind lies strictly inside its range', () => {
    const off: string[] = [];
    for (const kind of TRI_KINDS) {
      for (const a of as) {
        const [lo, hi] = xRange(kind, a);
        const x = xDefault(kind, a);
        if (!(x > lo && x < hi) || clampTri(kind, a, x) !== x) off.push(`${kind} a=${a}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('outside its domain triSub returns NaN (sin with |x| > a, sec with x < a)', () => {
    expect(Number.isNaN(triSub('sin', 2, 2.5).root)).toBe(true);
    expect(Number.isNaN(triSub('sec', 2, 1.5).theta)).toBe(true);
  });
});

describe('trigint: analytic limits', () => {
  it('t = tan(x/2) → ±∞ as x → ±π: t·(π − |x|) → 2', () => {
    const off: string[] = [];
    for (const d of [1e-1, 1e-2, 1e-3, 1e-4, 1e-5]) {
      for (const s of [1, -1]) {
        const t = halfAngle(s * (Math.PI - d)).t;
        if (Math.sign(t) !== s) off.push(`sign @ ${s}·(π − ${d})`);
        if (relativeError(Math.abs(t) * d, 2) > d * d) off.push(`|t|·d = ${Math.abs(t) * d} @ d = ${d}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('at the edge of the sin kind θ → ±π/2, the root and dx/dθ → 0: root ≈ √(2a(a − x))', () => {
    const off: string[] = [];
    const a = 2;
    for (const d of [1e-2, 1e-4, 1e-6]) {
      const t = triSub('sin', a, a - d);
      if (Math.abs(t.theta - Math.PI / 2) > 2 * Math.sqrt(d)) off.push(`θ @ d = ${d}`);
      if (relativeError(t.root, Math.sqrt(2 * a * d)) > 2 * d) off.push(`root @ d = ${d}`);
    }
    const e = triSub('sin', a, a);
    if (e.root !== 0 || e.dxdtheta !== 0 || e.theta !== Math.PI / 2) off.push('exact edge');
    const m = triSub('sin', a, -a);
    if (m.root !== 0 || m.theta !== -Math.PI / 2) off.push('exact left edge');
    expect(off).toEqual([]);
  });

  it('sec at x = a is the degenerate triangle: θ = 0 and the root 0', () => {
    const t = triSub('sec', 2, 2);
    expect([t.theta, t.root]).toEqual([0, 0]);
  });
});
