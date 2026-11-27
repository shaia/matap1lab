import { describe, expect, it } from 'vitest';
import { centralDiff, relativeError } from '~/math/analysis';
import {
  CHAIN,
  CHAIN_IDS,
  INVERSE,
  INV_IDS,
  PAIRS,
  PAIR_IDS,
  chainExact,
  chainFn,
  chainMeasured,
  dxMax,
  inverseSlopes,
  invX3px1,
  productDerivative,
  productParts,
} from '~/math/rules';

// constants recomputed with sympy 2026-11-27: (sin x³)′ = 3x² cos x³ (plus: the notes' minus is a slip);
// ((3x+1)²)′ = 18x + 6; (e^(−x²))′ = −2x e^(−x²); (√(1+x²))′ = x/√(1+x²); (x²·sin x)′ = x² cos x + 2x sin x, zero at
// x = 2.28892972810340; ∛(π/2) = 1.16244735150963; x³ + x + 1 = 3 only at x = 1, f′(1) = 4, (f⁻¹)′(3) = 1/4.

/** n + 1 evenly spaced points of [lo, hi] */
const grid = (lo: number, hi: number, n: number) => Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n);

/** a closed form against the central difference: relative 1e-6, or absolute 1e-7 next to a zero */
const agrees = (exact: number, probe: number) => Math.abs(exact - probe) <= 1e-7 || relativeError(probe, exact) <= 1e-6;

describe('rules, exact identities: the change of area of the rectangle is v·Δu + u·Δv + Δu·Δv', () => {
  it('every pair, x across its range, Δx across (0, dxMax]: Δ(uv) computed directly equals the three pieces', () => {
    const off: string[] = [];
    for (const id of PAIR_IDS) {
      const s = PAIRS[id];
      for (const x of grid(s.xRange[0], s.xRange[1], 50)) {
        for (const dx of [1, 0.5, 0.2, 0.05, 0.01]) {
          const d = Math.min(dx, dxMax(id, x));
          const p = productParts(id, x, d);
          const scale = Math.max(1, Math.abs(p.U2 * p.V2));
          if (Math.abs(p.duv - (p.sum + p.corner)) > 1e-13 * scale) off.push(`${id} x=${x} dx=${d}: ${p.duv} vs ${p.sum + p.corner}`);
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('v > 0 on [x, x + Δx] for every allowed state, so the picture is a rectangle', () => {
    const off: string[] = [];
    for (const id of PAIR_IDS) {
      const s = PAIRS[id];
      for (const x of grid(s.xRange[0], s.xRange[1], 50)) {
        for (const t of grid(x, x + dxMax(id, x), 20)) if (!(s.v(t) > 0 && s.u(t) > 0)) off.push(`${id} t=${t}`);
      }
    }
    expect(off).toEqual([]);
  });
});

describe('rules, exact identities: every closed-form derivative agrees with the central difference', () => {
  it('product pairs: u′, v′ and (uv)′ = u′v + uv′', () => {
    const off: string[] = [];
    for (const id of PAIR_IDS) {
      const s = PAIRS[id];
      const uv = (x: number) => s.u(x) * s.v(x);
      for (const x of grid(s.xRange[0], s.reach, 40)) {
        if (!agrees(s.du(x), centralDiff(s.u, x))) off.push(`${id} u′ x=${x}`);
        if (!agrees(s.dv(x), centralDiff(s.v, x))) off.push(`${id} v′ x=${x}`);
        if (!agrees(productDerivative(id, x), centralDiff(uv, x))) off.push(`${id} (uv)′ x=${x}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('chain presets: g′, f′ and (f∘g)′ = f′(g(x))·g′(x), including the + sign of (sin x³)′', () => {
    const off: string[] = [];
    for (const id of CHAIN_IDS) {
      const s = CHAIN[id];
      const F = chainFn(id);
      for (const x of grid(s.xRange[0], s.xRange[1], 60)) {
        if (!agrees(s.dg(x), centralDiff(s.g, x))) off.push(`${id} g′ x=${x}`);
        const u = s.g(x);
        if (!agrees(s.df(u), centralDiff(s.f, u))) off.push(`${id} f′ u=${u}`);
        if (!agrees(chainExact(id, x).d, centralDiff(F, x))) off.push(`${id} (f∘g)′ x=${x}`);
      }
    }
    // the notes' slip: (sin x³)′ = −3x² cos x³ disagrees with the probe where cos x³ ≠ 0
    if (agrees(-3 * cos3(1), centralDiff(chainFn('sin-x3'), 1))) off.push('the minus sign agrees at x = 1');
    expect(off).toEqual([]);
  });

  it('inverse presets: f′, f⁻¹ ∘ f = id, and (f⁻¹)′ by its own closed form', () => {
    const off: string[] = [];
    for (const id of INV_IDS) {
      const s = INVERSE[id];
      for (const a of grid(s.aRange[0], s.aRange[1], 60)) {
        if (!agrees(s.df(a), centralDiff(s.f, a))) off.push(`${id} f′ a=${a}`);
        const y = s.f(a);
        if (Math.abs(s.finv(y) - a) > 1e-12 * Math.max(1, Math.abs(a))) off.push(`${id} f⁻¹(f(a)) a=${a}`);
        // the probe is skipped next to a flat point (m < 0.05), where (f⁻¹)′ blows up and a central difference of ∛ or
        // arcsin near its singular point is no evidence of anything
        if (s.df(a) >= 0.05 && !agrees(s.dfinv(y), centralDiff(s.finv, y, 1e-6))) off.push(`${id} (f⁻¹)′ y=${y}`);
      }
    }
    expect(off).toEqual([]);
  });
});

function cos3(x: number) {
  return x * x * Math.cos(x * x * x);
}

describe('rules, exact identities: the reflected slope is the reciprocal', () => {
  it('m·(1/m) = 1 and 1/m = (f⁻¹)′(f(a)) by the closed form, wherever m ≠ 0', () => {
    const off: string[] = [];
    for (const id of INV_IDS) {
      const s = INVERSE[id];
      for (const a of grid(s.aRange[0], s.aRange[1], 60)) {
        const r = inverseSlopes(id, a);
        if (r.vertical) continue;
        if (Math.abs(r.m * r.minv - 1) > 1e-15) off.push(`${id} m·minv a=${a}`);
        if (relativeError(r.minv, s.dfinv(r.fa)) > 1e-9) off.push(`${id} minv vs dfinv a=${a}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('the flat points give m = 0 exactly and a vertical mirror tangent; nowhere else is m = 0', () => {
    const off: string[] = [];
    for (const [id, a] of [['cube', 0], ['sin', -Math.PI / 2], ['sin', Math.PI / 2]] as const) {
      const r = inverseSlopes(id, a);
      if (!(r.m === 0 && r.vertical && r.minv === Infinity)) off.push(`${id} a=${a}`);
    }
    for (const id of INV_IDS) {
      const s = INVERSE[id];
      for (const a of grid(s.aRange[0], s.aRange[1], 61)) if (!s.flat.includes(a) && inverseSlopes(id, a).vertical) off.push(`${id} a=${a} vertical`);
    }
    expect(off).toEqual([]);
  });
});

describe('rules, special values from the brief', () => {
  it('x3px1 at a = 1: f(1) = 3, m = 4, (f⁻¹)′(3) = 1/4; Cardano gives f⁻¹(3) = 1', () => {
    const r = inverseSlopes('x3px1', 1);
    expect([r.fa, r.m, r.minv]).toEqual([3, 4, 0.25]);
    expect(Math.abs(invX3px1(3) - 1)).toBeLessThan(1e-14);
    expect(relativeError(centralDiff(invX3px1, 3, 1e-6), 0.25)).toBeLessThan(1e-8);
  });

  it('the zeros of (sin x³)′ in [−1.5, 1.5] are 0 and ±∛(π/2) = ±1.16244735150963, and chainExact gives 0 there', () => {
    const zs = CHAIN['sin-x3'].zeros.map((z) => z.x);
    expect(relativeError(zs[2], 1.16244735150963)).toBeLessThan(1e-13);
    expect(zs.map((x) => Math.abs(chainExact('sin-x3', x).d))).toEqual([0, 0, 0]);
    // no other sign change of 3x² cos x³ on the window (a grid probe, step 10⁻³)
    const F = (x: number) => 3 * x * x * Math.cos(x ** 3);
    const changes = grid(-1.5, 1.5, 3000).filter((x, i, xs) => i > 0 && F(xs[i - 1]) * F(x) < 0);
    expect(changes.length).toBe(2);
  });

  it('each chain zero lies in its window and makes its own factor vanish', () => {
    const off: string[] = [];
    for (const id of CHAIN_IDS) {
      const s = CHAIN[id];
      for (const z of s.zeros) {
        if (z.x < s.xRange[0] || z.x > s.xRange[1]) off.push(`${id} ${z.x} outside`);
        const v = z.factor === 'inner' ? s.dg(z.x) : s.df(s.g(z.x));
        if (Math.abs(v) > 1e-15) off.push(`${id} ${z.x} ${z.factor} = ${v}`);
      }
    }
    expect(off).toEqual([]);
  });
});

describe('rules, analytic limits: the measured quantities converge as Δx → 0', () => {
  it('the corner over Δx tends to 0 like Δx: (Δu·Δv/Δx)/Δx → u′v′', () => {
    const off: string[] = [];
    for (const id of PAIR_IDS) {
      const s = PAIRS[id];
      for (const x of grid(s.xRange[0], s.xRange[1], 10)) {
        const target = s.du(x) * s.dv(x);
        const r = productParts(id, x, 1e-4).cornerRatio / 1e-4;
        if (Math.abs(r - target) > 1e-3 * Math.max(1, Math.abs(target))) off.push(`${id} x=${x}: ${r} vs ${target}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('(the two strips)/Δx tend to (uv)′ with error O(Δx)', () => {
    const off: string[] = [];
    for (const id of PAIR_IDS) {
      const s = PAIRS[id];
      for (const x of grid(s.xRange[0], s.xRange[1], 10)) {
        const d = productDerivative(id, x);
        const e = [1e-1, 1e-2, 1e-3].map((dx) => Math.abs(productParts(id, x, dx).sum / dx - d));
        // lin-lin is exact for every Δx (both factors linear): its error is rounding, ~10⁻¹⁶·|uv|/Δx ≤ 10⁻¹¹
        if (!(e[1] < 0.2 * e[0] + 1e-10 && e[2] < 0.2 * e[1] + 1e-10)) off.push(`${id} x=${x}: ${e}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('the product of the measured stretches tends to f′(g(x))·g′(x): the error falls ~10× per decade of Δx', () => {
    const off: string[] = [];
    for (const id of CHAIN_IDS) {
      const s = CHAIN[id];
      for (const x of grid(s.xRange[0], s.xRange[1], 12)) {
        const ex = chainExact(id, x).d;
        const err = [1e-3, 1e-4, 1e-5].map((dx) => {
          const m = chainMeasured(id, x, dx);
          const prod = Number.isNaN(m.outer) ? m.total : m.inner * m.outer;
          return Math.abs(prod - ex);
        });
        // O(Δx): each decade cuts the error by about 10 (allow 5); an error already at rounding level passes
        if (!(err[1] < 0.2 * err[0] + 1e-10 && err[2] < 0.2 * err[1] + 1e-10)) off.push(`${id} x=${x}: ${err}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('the product of the measured stretches is Δy/Δx itself (the same fraction)', () => {
    const off: string[] = [];
    for (const id of CHAIN_IDS) {
      const s = CHAIN[id];
      for (const x of grid(s.xRange[0], s.xRange[1], 30)) {
        for (const dx of [1, 1e-1, 1e-2, 1e-3, 1e-4]) {
          const m = chainMeasured(id, x, dx);
          if (Number.isNaN(m.outer)) continue;
          if (Math.abs(m.inner * m.outer - m.total) > 1e-12 * Math.max(1, Math.abs(m.total))) off.push(`${id} x=${x} dx=${dx}`);
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('at each preset default x and Δx = 10⁻³ the measured product is within 0.5% of the exact derivative', () => {
    const off: string[] = [];
    for (const id of CHAIN_IDS) {
      const s = CHAIN[id];
      const ex = chainExact(id, s.defaultX).d;
      const m = chainMeasured(id, s.defaultX, 1e-3).total;
      if (relativeError(m, ex) > 0.005) off.push(`${id}: ${m} vs ${ex}`);
    }
    expect(off).toEqual([]);
  });
});
