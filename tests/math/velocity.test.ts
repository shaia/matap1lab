import { describe, expect, it } from 'vitest';
import { centralDiff } from '~/math/analysis';
import { VC, VC_IDS, angleBetween, frame, frameFrom, linearError, secant, speed, tangentLine, type VcId, type Vec2 } from '~/math/velocity';

// Closed forms checked with sympy on 2026-11-27 (screens/tools/ch9_presets.py): κ(parab) = 2/(1 + 4t²)^(3/2);
// κ(ellipse) = 2/(1 + 3 sin²t)^(3/2); κ(circle) = κ(spin) = 1/2; κ(cusp) = 6/(|t|(4 + 9t²)^(3/2)); throw: |v × a| = 60,
// ρ(0.8) = 6³/60 = 3.6 with centre (4.8, −0.4); spin: a_T = 2, a_N = 2t².

/** |num − exact| ≤ tol·max(1, |exact|): relative, with an absolute floor where the exact value is 0 or crosses it */
const near = (num: number, exact: number, tol: number) => Math.abs(num - exact) <= tol * Math.max(1, Math.abs(exact));
const grid = (lo: number, hi: number, n = 60) => Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n);
const len = (u: Vec2) => Math.hypot(u[0], u[1]);
/** the grid points of a preset's range where v ≠ 0 */
const movingGrid = (id: VcId, n = 60) => grid(VC[id].range[0], VC[id].range[1], n).filter((t) => speed(id, t) > 1e-6);

describe('exact identities: v, a, the frame', () => {
  it('v = r′ and a = v′ against centralDiff, componentwise, on a grid of every preset', () => {
    const off: string[] = [];
    for (const id of VC_IDS) {
      const s = VC[id];
      for (const t of grid(s.range[0], s.range[1])) {
        for (const k of [0, 1] as const) {
          if (!near(centralDiff((u) => s.r(u)[k], t), s.v(t)[k], 1e-6)) off.push(`${id} v${k} t=${t}`);
          if (!near(centralDiff((u) => s.v(u)[k], t), s.a(t)[k], 1e-6)) off.push(`${id} a${k} t=${t}`);
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('a_T = d|v|/dt (centralDiff of the speed) and a_T² + a_N² = |a|² wherever v ≠ 0', () => {
    const off: string[] = [];
    for (const id of VC_IDS) {
      for (const t of movingGrid(id)) {
        const f = frame(id, t);
        if (f.aT === null || f.aN === null) {
          off.push(`${id} null t=${t}`);
          continue;
        }
        if (!near(f.aT, centralDiff((u) => speed(id, u), t), 1e-5)) off.push(`${id} aT t=${t}`);
        if (!near(f.aT ** 2 + f.aN ** 2, len(VC[id].a(t)) ** 2, 1e-9)) off.push(`${id} pythagoras t=${t}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('a = a_T T + a_N N componentwise (N toward the bend) wherever v ≠ 0 and the curve bends', () => {
    const off: string[] = [];
    for (const id of VC_IDS) {
      for (const t of movingGrid(id)) {
        const f = frame(id, t);
        if (!f.T || !f.N || f.aT === null || f.aN === null) continue;
        const a = VC[id].a(t);
        for (const k of [0, 1] as const) if (!near(f.aT * f.T[k] + f.aN * f.N[k], a[k], 1e-9)) off.push(`${id} k=${k} t=${t}`);
        if (Math.abs(len(f.T) - 1) > 1e-12 || Math.abs(len(f.N) - 1) > 1e-12 || Math.abs(f.T[0] * f.N[0] + f.T[1] * f.N[1]) > 1e-12) off.push(`${id} unit t=${t}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('the curvature against its closed forms (parab, ellipse, circle, spin, cusp, throw)', () => {
    const closed: Partial<Record<VcId, (t: number) => number>> = {
      parab: (t) => 2 / (1 + 4 * t * t) ** 1.5,
      ellipse: (t) => 2 / (1 + 3 * Math.sin(t) ** 2) ** 1.5,
      circle: () => 0.5,
      spin: () => 0.5,
      cusp: (t) => 6 / (Math.abs(t) * (4 + 9 * t * t) ** 1.5),
      cycloid: (t) => 1 / (4 * Math.abs(Math.sin(t / 2))),
      throw: (t) => 60 / Math.hypot(6, 8 - 10 * t) ** 3,
    };
    const off: string[] = [];
    for (const id of Object.keys(closed) as VcId[]) {
      for (const t of movingGrid(id)) {
        const k = frame(id, t).kappa;
        if (k === null || !near(k, closed[id]!(t), 1e-9)) off.push(`${id} t=${t}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('circle: |v| = 2, a = −r, ρN points to the centre (0, 0); ρ = 2', () => {
    const off: string[] = [];
    for (const t of grid(0, 2 * Math.PI)) {
      const r = VC.circle.r(t);
      const a = VC.circle.a(t);
      const f = frame('circle', t);
      if (!near(speed('circle', t), 2, 1e-12)) off.push(`speed t=${t}`);
      if (!near(a[0], -r[0], 1e-12) || !near(a[1], -r[1], 1e-12)) off.push(`a=-r t=${t}`);
      if (!f.centre || f.rho === null || !near(f.rho, 2, 1e-12) || len(f.centre) > 1e-9) off.push(`centre t=${t}`);
    }
    expect(off).toEqual([]);
  });

  it('spin: a_T = 2 and a_N = 2t² for t > 0', () => {
    const off: string[] = [];
    for (const t of grid(0.05, 3.5)) {
      const f = frame('spin', t);
      if (f.aT === null || f.aN === null || !near(f.aT, 2, 1e-9) || !near(f.aN, 2 * t * t, 1e-9)) off.push(`t=${t}`);
    }
    expect(off).toEqual([]);
  });

  it('throw at the top t = 0.8: v = (6, 0), a = (0, −10), a_T = 0, a_N = 10, ρ = 3.6, centre (4.8, −0.4)', () => {
    const v = VC.throw.v(0.8);
    const f = frame('throw', 0.8);
    expect(v[0]).toBe(6);
    expect(Math.abs(v[1])).toBeLessThan(1e-12);
    expect(VC.throw.a(0.8)).toEqual([0, -10]);
    expect(f.aT).not.toBeNull();
    expect(Math.abs(f.aT!)).toBeLessThan(1e-9);
    expect(f.aN).toBeCloseTo(10, 9);
    expect(f.rho).toBeCloseTo(3.6, 9);
    expect(f.centre![0]).toBeCloseTo(4.8, 9);
    expect(f.centre![1]).toBeCloseTo(-0.4, 9);
  });

  it('a straight stretch (v = (1, 1), a = (2, 2)): κ = 0, a_N = 0, a_T = 2√2, and N, ρ, centre are null', () => {
    const f = frameFrom([3, 4], [1, 1], [2, 2]);
    expect(f.kappa).toBe(0);
    expect(f.aN).toBe(0);
    expect(f.aT).toBeCloseTo(2 * Math.SQRT2, 12);
    expect(f.T![0]).toBeCloseTo(Math.SQRT1_2, 12);
    expect([f.N, f.rho, f.centre]).toEqual([null, null, null]);
  });

  it('exact in h: parab quotient = (1, 2t + h), linearError = h² (parab) and 5h² (throw), tangentLine point = r(t)', () => {
    const off: string[] = [];
    for (const t of grid(-1.5, 1.5, 12)) {
      for (const h of [-1.5, -0.3, -0.01, 0.01, 0.3, 1.5]) {
        const q = secant('parab', t, h).quotient;
        if (!near(q[0], 1, 1e-12) || !near(q[1], 2 * t + h, 1e-12)) off.push(`quotient t=${t} h=${h}`);
        if (!near(linearError('parab', t, h), h * h, 1e-12)) off.push(`parab err t=${t} h=${h}`);
        if (!near(linearError('throw', t, h), 5 * h * h, 1e-12)) off.push(`throw err t=${t} h=${h}`);
      }
    }
    for (const id of VC_IDS) {
      for (const t of movingGrid(id, 20)) {
        const tl = tangentLine(id, t)!;
        if (tl.point[0] !== VC[id].r(t)[0] || tl.point[1] !== VC[id].r(t)[1]) off.push(`${id} point t=${t}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('the stored windows contain every curve over its range, and vZeros are exactly where v vanishes', () => {
    const off: string[] = [];
    for (const id of VC_IDS) {
      const s = VC[id];
      for (const t of grid(s.range[0], s.range[1], 200)) {
        const [x, y] = s.r(t);
        if (x < s.window.x[0] || x > s.window.x[1] || y < s.window.y[0] || y > s.window.y[1]) off.push(`${id} window t=${t}`);
        const near0 = s.vZeros.some((z) => Math.abs(t - z) < 0.06);
        if (speed(id, t) < 1e-3 && !near0) off.push(`${id} unlisted zero t=${t}`);
      }
      for (const z of s.vZeros) if (speed(id, z) > 1e-12) off.push(`${id} vZero ${z} has speed ${speed(id, z)}`);
    }
    expect(off).toEqual([]);
  });
});

describe('analytic limits: the secant quotient, the linear approximation, the cusp', () => {
  const T_AT: Record<VcId, number> = { parab: 0.5, cusp: 0.5, circle: 0.8, ellipse: 0.8, throw: 0.4, cycloid: 1, spin: 1.5 };

  it('the quotient tends to v with error ≈ |a| |h| / 2 (proportional to h), from both sides', () => {
    const off: string[] = [];
    for (const id of VC_IDS) {
      const t = T_AT[id];
      const v = VC[id].v(t);
      const a = len(VC[id].a(t));
      for (const sgn of [1, -1]) {
        const err = (h: number) => {
          const q = secant(id, t, sgn * h).quotient;
          return Math.hypot(q[0] - v[0], q[1] - v[1]);
        };
        const e1 = err(1e-3);
        const e2 = err(5e-4);
        if (Math.abs(e1 - (a * 1e-3) / 2) > 0.02 * ((a * 1e-3) / 2)) off.push(`${id} ${sgn} size ${e1}`);
        if (Math.abs(e1 / e2 - 2) > 0.02) off.push(`${id} ${sgn} ratio ${e1 / e2}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('linearError = O(h²): linearError/h → 0 and halves when h halves', () => {
    const off: string[] = [];
    for (const id of VC_IDS) {
      const t = T_AT[id];
      const a = len(VC[id].a(t));
      for (const sgn of [1, -1]) {
        const r1 = linearError(id, t, sgn * 1e-3) / 1e-3;
        const r2 = linearError(id, t, sgn * 5e-4) / 5e-4;
        if (!(r1 < 2e-3 * Math.max(1, a))) off.push(`${id} ${sgn} not small ${r1}`);
        if (Math.abs(r1 / r2 - 2) > 0.02) off.push(`${id} ${sgn} ratio ${r1 / r2}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('cusp at t = 0.5: the angle between the quotient and v tends to 0, proportionally to h', () => {
    const v = VC.cusp.v(0.5);
    const ang = (h: number) => angleBetween(secant('cusp', 0.5, h).quotient, v)!;
    expect(ang(1e-3)).toBeLessThan(0.05);
    expect(ang(1e-4)).toBeLessThan(ang(1e-3) / 5);
    expect(ang(-1e-3)).toBeLessThan(0.05);
  });

  it('cusp at t = 0: the quotient (h, h²) → 0 = v(0), tangentLine is null, yet the chord direction → (1, 0) from both sides', () => {
    expect(VC.cusp.v(0)).toEqual([0, 0]);
    expect(tangentLine('cusp', 0)).toBeNull();
    const off: string[] = [];
    for (const h of [1e-2, -1e-2, 1e-3, -1e-3, 1e-4, -1e-4]) {
      const { dr, quotient } = secant('cusp', 0, h);
      if (len(quotient) > 1.1 * Math.abs(h)) off.push(`quotient h=${h}`);
      const d: Vec2 = [dr[0] / len(dr), dr[1] / len(dr)];
      if (Math.hypot(d[0] - 1, d[1]) > 1.5 * Math.abs(h)) off.push(`direction h=${h}`);
    }
    expect(off).toEqual([]);
  });

  it('where v = 0 every frame field is null and the tangent line is null; elsewhere the tangent line has direction v', () => {
    const off: string[] = [];
    for (const id of VC_IDS) {
      for (const z of VC[id].vZeros) {
        const f = frame(id, z);
        if (tangentLine(id, z) !== null || Object.values(f).some((x) => x !== null)) off.push(`${id} zero ${z}`);
      }
      for (const t of movingGrid(id, 30)) {
        const tl = tangentLine(id, t);
        const v = VC[id].v(t);
        if (!tl || tl.dir[0] !== v[0] || tl.dir[1] !== v[1]) off.push(`${id} line t=${t}`);
      }
    }
    expect(off).toEqual([]);
    expect(angleBetween([0, 0], [1, 0])).toBeNull();
    expect(angleBetween([1, 0], [0, 1])).toBeCloseTo(90, 12);
  });
});
