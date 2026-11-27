import { describe, expect, it } from 'vitest';
import { centralDiff, relativeError } from '~/math/analysis';
import { simpson } from '~/math/multivar';
import {
  PARTS,
  PARTS_IDS,
  SUB,
  SUB_IDS,
  invG,
  partsAreas,
  stripPair,
  substAreas,
  tOfU,
  type PartsId,
  type SubId,
} from '~/math/intmethods';

// Closed forms recomputed with sympy on 2026-11-27 (screens/tools/ch7_presets.py): ∫2x cos x² = sin x², ∫2x e^(−x²) = −e^(−x²),
// ∫sin cos = sin²/2, ∫2(2x+1)³ = (2x+1)⁴/4, ∫x/√(1+x²) = √(1+x²); parts: ∫t eᵗ = (t−1)eᵗ, ∫t sin t = sin t − t cos t,
// ∫arctan t = t arctan t − ln(1+t²)/2, ∫ln t = t ln t − t.

/** |num − exact| ≤ tol·max(1, |exact|): finite differences near a zero have no relative error */
const near = (num: number, exact: number, tol: number) => Math.abs(num - exact) <= tol * Math.max(1, Math.abs(exact));

const grid = (lo: number, hi: number, n: number) => Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n);

describe('substitution: exact identities', () => {
  it('h(x) equals f(g(x))·g′(x) on a grid of the window', () => {
    const off: string[] = [];
    for (const id of SUB_IDS) {
      const s = SUB[id];
      for (const x of grid(s.x[0], s.x[1], 60)) {
        const exact = s.f(s.g(x)) * s.gp(x);
        if (!near(s.h(x), exact, 1e-12)) off.push(`${id} x=${x}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('g′ matches the derivative of g, and g is increasing on the window', () => {
    const off: string[] = [];
    for (const id of SUB_IDS) {
      const s = SUB[id];
      for (const x of grid(s.x[0] + 0.01, s.x[1] - 0.01, 40)) {
        if (!near(centralDiff(s.g, x), s.gp(x), 1e-7)) off.push(`${id} g′ x=${x}`);
      }
      for (const x of grid(s.x[0], s.x[1], 40)) if (s.gp(x) < -1e-12) off.push(`${id} decreasing x=${x}`);
    }
    expect(off).toEqual([]);
  });

  it('Fu′ = f and H′ = h on a grid', () => {
    const off: string[] = [];
    for (const id of SUB_IDS) {
      const s = SUB[id];
      for (const u of grid(s.u[0] + 0.01, s.u[1] - 0.01, 40)) if (!near(centralDiff(s.Fu, u), s.f(u), 1e-6)) off.push(`${id} Fu′ u=${u}`);
      for (const x of grid(s.x[0] + 0.01, s.x[1] - 0.01, 40)) if (!near(centralDiff(s.H, x), s.h(x), 1e-6)) off.push(`${id} H′ x=${x}`);
    }
    expect(off).toEqual([]);
  });

  it('H(x) = Fu(g(x)) + const: the substitution theorem for the stored closed forms', () => {
    const off: string[] = [];
    for (const id of SUB_IDS) {
      const s = SUB[id];
      const c = s.H(s.x[0]) - s.Fu(s.g(s.x[0]));
      for (const x of grid(s.x[0], s.x[1], 60)) if (!near(s.H(x), s.Fu(s.g(x)) + c, 1e-12)) off.push(`${id} x=${x}`);
    }
    expect(off).toEqual([]);
  });

  it('the u-window is [g(lo), g(hi)]', () => {
    const off: string[] = [];
    for (const id of SUB_IDS) {
      const s = SUB[id];
      if (s.u[0] !== s.g(s.x[0]) || s.u[1] !== s.g(s.x[1])) off.push(id);
    }
    expect(off).toEqual([]);
  });

  it('substAreas: the two areas are equal and equal to a Simpson sum of each side', () => {
    const off: string[] = [];
    for (const id of SUB_IDS) {
      const s = SUB[id];
      const [lo, hi] = s.x;
      const pairs: [number, number][] = [
        [lo, hi],
        [lo, (lo + hi) / 2],
        [(lo + hi) / 2, hi],
        [lo + 0.3 * (hi - lo), lo + 0.9 * (hi - lo)],
        [hi, lo],
      ];
      for (const [a, x] of pairs) {
        const { xArea, uArea } = substAreas(id, a, x);
        const sx = simpson(s.h, a, x, 400);
        const su = simpson(s.f, s.g(a), s.g(x), 400);
        if (!near(xArea, uArea, 1e-12)) off.push(`${id} equal ${a},${x}`);
        if (!near(xArea, sx, 1e-8)) off.push(`${id} x-side ${a},${x}`);
        if (!near(uArea, su, 1e-8)) off.push(`${id} u-side ${a},${x}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('substAreas at the starting a and x are signed and antisymmetric under swapping a and x', () => {
    const off: string[] = [];
    for (const id of SUB_IDS) {
      const s = SUB[id];
      const p = substAreas(id, s.a0, s.x0);
      const q = substAreas(id, s.x0, s.a0);
      if (!near(p.xArea, -q.xArea, 1e-12) || !near(p.uArea, -q.uArea, 1e-12)) off.push(id);
    }
    expect(off).toEqual([]);
  });

  it('the strip areas under h and under f are equal and equal to a Simpson sum', () => {
    const off: string[] = [];
    for (const id of SUB_IDS) {
      const s = SUB[id];
      for (const x of grid(s.x[0], s.x[1] - 0.4, 6)) {
        const dx = 0.3;
        const p = stripPair(id, x, dx);
        if (!near(p.ax, p.au, 1e-12)) off.push(`${id} equal x=${x}`);
        if (!near(p.ax, simpson(s.h, x, x + dx, 200), 1e-9)) off.push(`${id} x-side x=${x}`);
        if (!near(p.au, simpson(s.f, s.g(x), s.g(x + dx), 200), 1e-9)) off.push(`${id} u-side x=${x}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('invG inverts g on the window and clamps outside it', () => {
    const off: string[] = [];
    for (const id of SUB_IDS) {
      const s = SUB[id];
      for (const x of grid(s.x[0], s.x[1], 20)) if (Math.abs(invG(id, s.g(x)) - x) > 1e-9) off.push(`${id} x=${x}`);
      if (Math.abs(invG(id, s.u[0] - 5) - s.x[0]) > 1e-9) off.push(`${id} below`);
      if (Math.abs(invG(id, s.u[1] + 5) - s.x[1]) > 1e-9) off.push(`${id} above`);
    }
    expect(off).toEqual([]);
  });
});

describe('substitution: analytic limits', () => {
  it('the thin-rectangle area ratio f(g(x))·du / (h(x)·dx) tends to 1 as dx → 0, at first order', () => {
    const off: string[] = [];
    for (const id of SUB_IDS) {
      const s = SUB[id];
      for (const x of grid(s.x[0] + 0.3, s.x[1] - 0.3, 8)) {
        if (Math.abs(s.h(x)) < 1e-3 || Math.abs(s.gp(x)) < 0.3) continue;
        const e1 = Math.abs(stripPair(id, x, 1e-3).ratio - 1);
        const e2 = Math.abs(stripPair(id, x, 1e-4).ratio - 1);
        const e3 = Math.abs(stripPair(id, x, 1e-6).ratio - 1);
        if (!(e2 <= 0.2 * e1 + 1e-9)) off.push(`${id} x=${x} not first order: ${e1} -> ${e2}`);
        if (!(e3 < 1e-4)) off.push(`${id} x=${x} dx=1e-6 ratio off by ${e3}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('du/dx tends to g′(x) as dx → 0', () => {
    const off: string[] = [];
    for (const id of SUB_IDS) {
      const s = SUB[id];
      for (const x of grid(s.x[0] + 0.2, s.x[1] - 0.2, 8)) {
        const w = stripPair(id, x, 1e-6).widthRatio;
        if (relativeError(w, s.gp(x)) > 1e-4) off.push(`${id} x=${x}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('the ratio is NaN where h(x) = 0 (0/0), never a number', () => {
    expect(Number.isNaN(stripPair('xexp', 0, 0.1).ratio)).toBe(true);
    expect(Number.isNaN(stripPair('sqrt', 0, 0.1).ratio)).toBe(true);
  });
});

describe('by parts: exact identities', () => {
  it('Gudv′ = u·v′ and Gvdu′ = v·u′ against centralDiff on the t-range', () => {
    const off: string[] = [];
    for (const id of PARTS_IDS) {
      const s = PARTS[id];
      for (const t of grid(s.t[0] + 0.02, s.t[1] - 0.02, 50)) {
        if (!near(centralDiff(s.Gudv, t), s.u(t) * s.vp(t), 1e-6)) off.push(`${id} Gudv′ t=${t}`);
        if (!near(centralDiff(s.Gvdu, t), s.v(t) * s.up(t), 1e-6)) off.push(`${id} Gvdu′ t=${t}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('u′ and v′ match the derivatives of u and v, and both are non-negative increasing', () => {
    const off: string[] = [];
    for (const id of PARTS_IDS) {
      const s = PARTS[id];
      for (const t of grid(s.t[0] + 0.02, s.t[1] - 0.02, 50)) {
        if (!near(centralDiff(s.u, t), s.up(t), 1e-6)) off.push(`${id} u′ t=${t}`);
        if (!near(centralDiff(s.v, t), s.vp(t), 1e-6)) off.push(`${id} v′ t=${t}`);
      }
      for (const t of grid(s.t[0], s.t[1], 50)) {
        if (s.up(t) < 0 || s.vp(t) < 0 || s.u(t) < -1e-12 || s.v(t) < -1e-12) off.push(`${id} sign t=${t}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('partsAreas equals Simpson sums of u dv and v du', () => {
    const off: string[] = [];
    for (const id of PARTS_IDS) {
      const s = PARTS[id];
      const [lo, hi] = s.t;
      const pairs: [number, number][] = [
        [lo, hi],
        [lo, s.T0],
        [lo + 0.25 * (hi - lo), lo + 0.75 * (hi - lo)],
        [lo + 0.5 * (hi - lo), hi],
      ];
      for (const [t0, T] of pairs) {
        const a = partsAreas(id, t0, T);
        if (!near(a.udv, simpson((t) => s.u(t) * s.vp(t), t0, T, 400), 1e-8)) off.push(`${id} udv ${t0},${T}`);
        if (!near(a.vdu, simpson((t) => s.v(t) * s.up(t), t0, T, 400), 1e-8)) off.push(`${id} vdu ${t0},${T}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('udv + vdu = u(T)v(T) − u(t0)v(t0) exactly, on a grid of (t0, T)', () => {
    const off: string[] = [];
    for (const id of PARTS_IDS) {
      const s = PARTS[id];
      const ts = grid(s.t[0], s.t[1], 10);
      for (let i = 0; i < ts.length; i++) {
        for (let j = i; j < ts.length; j++) {
          const a = partsAreas(id, ts[i], ts[j]);
          if (!near(a.udv + a.vdu, a.rect, 1e-12)) off.push(`${id} ${ts[i]},${ts[j]}`);
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('from the preset start the closed forms are those of the brief', () => {
    const T = 1.7;
    const exact: Record<PartsId, [number, number]> = {
      xex: [(T - 1) * Math.exp(T) + 1, Math.exp(T) - 1],
      lnx: [T * Math.log(T) - T + 1, T - 1],
      xsin: [Math.sin(T) - T * Math.cos(T), T - Math.sin(T)],
      atan: [T * Math.atan(T) - Math.log(1 + T * T) / 2, Math.log(1 + T * T) / 2],
    };
    const off: string[] = [];
    for (const id of PARTS_IDS) {
      const a = partsAreas(id, PARTS[id].t[0], T);
      if (!near(a.udv, exact[id][0], 1e-12)) off.push(`${id} udv`);
      if (!near(a.vdu, exact[id][1], 1e-12)) off.push(`${id} vdu`);
    }
    expect(off).toEqual([]);
  });

  it('every preset starts at a point with u(t0)·v(t0) = 0, and the starting T is inside the range', () => {
    const off: string[] = [];
    for (const id of PARTS_IDS) {
      const s = PARTS[id];
      if (Math.abs(s.u(s.t[0]) * s.v(s.t[0])) > 1e-12) off.push(`${id} start`);
      if (!(s.T0 > s.t[0] && s.T0 < s.t[1])) off.push(`${id} T0`);
    }
    expect(off).toEqual([]);
  });

  it('tOfU inverts u along the curve and clamps outside the range', () => {
    const off: string[] = [];
    for (const id of PARTS_IDS) {
      const s = PARTS[id];
      for (const t of grid(s.t[0], s.t[1], 20)) if (Math.abs(tOfU(id, s.u(t)) - t) > 1e-9) off.push(`${id} t=${t}`);
      if (Math.abs(tOfU(id, -5) - s.t[0]) > 1e-9) off.push(`${id} below`);
      if (Math.abs(tOfU(id, s.u(s.t[1]) + 5) - s.t[1]) > 1e-9) off.push(`${id} above`);
    }
    expect(off).toEqual([]);
  });
});

describe('registry shape', () => {
  it('the ids of the two registries do not overlap (a step key f picks the mode by id)', () => {
    const subs = new Set<string>(SUB_IDS);
    expect(PARTS_IDS.filter((id) => subs.has(id))).toEqual([]);
  });

  it('every preset is keyed by its own id', () => {
    const off: string[] = [];
    for (const id of SUB_IDS as SubId[]) if (SUB[id].id !== id) off.push(id);
    for (const id of PARTS_IDS) if (PARTS[id].id !== id) off.push(id);
    expect(off).toEqual([]);
  });
});
