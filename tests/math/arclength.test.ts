import { describe, expect, it } from 'vitest';
import { centralDiff, relativeError } from '~/math/analysis';
import { simpson } from '~/math/multivar';
import {
  AL,
  AL_IDS,
  PL,
  PL_IDS,
  RP,
  RP_CURVES,
  RP_PARAMS,
  arcTo,
  convertT,
  polarAt,
  polarTriangle,
  polygon,
  rpOf,
  type AlId,
} from '~/math/arclength';

// Every stored closed form was recomputed with sympy on 2026-11-27 (screens/tools/ch9_presets.py):
// parabola (t, t²) on [0, 2]: √17 + arsinh(4)/4 = 4.64678376243294; cosh on [−1, 1]: 2 sinh 1 = 2.35040238728760;
// ellipse (2 cos t, sin t): 9.68844822054768; spiral r = θ: 21.2562941482091; r = e^(θ/5): 12.8168221473193; cardioid: 8.

const near = (num: number, exact: number, tol: number) => Math.abs(num - exact) <= tol * Math.max(1, Math.abs(exact));
const grid = (lo: number, hi: number, n = 40) => Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n);

describe('exact identities: speeds, arc-length functions, lengths', () => {
  it('v is the derivative of r and the speed is |v| for every AL and RP preset', () => {
    const off: string[] = [];
    const check = (name: string, p: { r: (t: number) => [number, number]; v: (t: number) => [number, number]; speed: (t: number) => number; range: [number, number] }) => {
      for (const t of grid(p.range[0] + 0.05, p.range[1] - 0.05)) {
        const v = p.v(t);
        const dx = centralDiff((u) => p.r(u)[0], t);
        const dy = centralDiff((u) => p.r(u)[1], t);
        if (!near(dx, v[0], 1e-6) || !near(dy, v[1], 1e-6)) off.push(`${name} v t=${t}`);
        if (!near(Math.hypot(v[0], v[1]), p.speed(t), 1e-12)) off.push(`${name} speed t=${t}`);
      }
    };
    for (const id of AL_IDS) check(`AL ${id}`, AL[id]);
    for (const k of Object.keys(RP)) check(`RP ${k}`, RP[k]);
    expect(off).toEqual([]);
  });

  it('centralDiff(s) equals the speed, s(start) = 0 and s(end) = the stored length', () => {
    const off: string[] = [];
    for (const id of AL_IDS) {
      const p = AL[id];
      if (!p.s) continue;
      for (const t of grid(p.range[0] + 0.05, p.range[1] - 0.05)) if (!near(centralDiff(p.s, t), p.speed(t), 1e-6)) off.push(`AL ${id} t=${t}`);
      if (!near(arcTo(id, p.range[0]).value, 0, 1e-12)) off.push(`AL ${id} start`);
      if (!near(arcTo(id, p.range[1]).value, p.length, 1e-12)) off.push(`AL ${id} end`);
    }
    for (const k of Object.keys(RP)) {
      const p = RP[k];
      for (const t of grid(p.range[0] + 0.05, p.range[1] - 0.05)) if (!near(centralDiff(p.s, t), p.speed(t), 1e-6)) off.push(`RP ${k} t=${t}`);
      if (!near(p.s(p.range[0]), 0, 1e-12)) off.push(`RP ${k} start`);
      if (!near(p.s(p.range[1]), p.length, 1e-12)) off.push(`RP ${k} end`);
    }
    for (const id of PL_IDS) {
      const p = PL[id];
      // the cardioid integrand has a kink at θ = π (|cos(θ/2)|), where s still has a one-sided derivative: skip ±0.1 around it
      for (const th of grid(0.05, 2 * Math.PI - 0.05)) {
        if (id === 'cardioid' && Math.abs(th - Math.PI) < 0.1) continue;
        if (!near(centralDiff(p.s, th), p.integrand(th), 1e-6)) off.push(`PL ${id} th=${th}`);
      }
      if (!near(p.s(0), 0, 1e-12)) off.push(`PL ${id} start`);
      if (!near(p.s(p.range[1]), p.total, 1e-12)) off.push(`PL ${id} end`);
    }
    expect(off).toEqual([]);
  });

  it('the stored lengths are ∫ speed, by composite Simpson (the ellipse, which has no closed form, included)', () => {
    const off: string[] = [];
    for (const id of AL_IDS) if (relativeError(simpson(AL[id].speed, AL[id].range[0], AL[id].range[1], 4000), AL[id].length) > 1e-12) off.push(`AL ${id}`);
    for (const k of Object.keys(RP)) if (relativeError(simpson(RP[k].speed, RP[k].range[0], RP[k].range[1], 4000), RP[k].length) > 1e-10) off.push(`RP ${k}`);
    expect(off).toEqual([]);
  });

  it('the closed-form lengths match their formulas', () => {
    expect(AL.parab.length).toBeCloseTo(4.64678376243294, 12);
    expect(AL.cosh.length).toBeCloseTo(2.3504023872876, 12);
    expect(AL.circle.length).toBe(2 * Math.PI);
    expect(PL.cardioid.total).toBe(8);
    expect(relativeError(PL.logspiral.s(2 * Math.PI), Math.sqrt(26) * (Math.exp((2 * Math.PI) / 5) - 1))).toBeLessThan(1e-15);
  });

  it('the ellipse perimeter (a stored sympy number) agrees with composite Simpson on its speed', () => {
    expect(AL.ellipse.numeric).toBe(true);
    expect(AL.ellipse.s).toBeNull();
    const si = simpson(AL.ellipse.speed, 0, 2 * Math.PI, 4000);
    expect(relativeError(si, 9.68844822054768)).toBeLessThan(1e-12);
    expect(arcTo('ellipse', 2 * Math.PI).exact).toBe(false);
    expect(relativeError(arcTo('ellipse', 2 * Math.PI).value, AL.ellipse.length)).toBeLessThan(1e-9);
  });

  it('the Simpson branch of arcTo respects the ellipse symmetry: s(π) = L/2 and s(π/2) = L/4 (relative 1e-9)', () => {
    expect(relativeError(arcTo('ellipse', Math.PI).value, AL.ellipse.length / 2)).toBeLessThan(1e-9);
    expect(relativeError(arcTo('ellipse', Math.PI / 2).value, AL.ellipse.length / 4)).toBeLessThan(1e-9);
  });
});

describe('exact identities: one curve, several parametrisations', () => {
  it('the two parametrisations of the notes trace the same set and have the same length', () => {
    const a = rpOf('notes', 't');
    const b = rpOf('notes', 't2');
    expect(b.length).toBe(a.length);
    const off: string[] = [];
    for (const t of grid(b.range[0], b.range[1], 60)) {
      const [x, y] = b.r(t);
      if (!near(y, x * x, 1e-12) || x < -1e-12 || x > 2 + 1e-12) off.push(`t2=${t}`);
      // the point is also on the other parametrisation: t = x
      const q = a.r(x);
      if (!near(q[0], x, 1e-12) || !near(q[1], y, 1e-12)) off.push(`same point t2=${t}`);
    }
    expect(b.r(b.range[1])[0]).toBeCloseTo(2, 12);
    expect(off).toEqual([]);
  });

  it('every parametrisation of the circle lies on x² + y² = 1 and reaches the same point at the same base position', () => {
    const off: string[] = [];
    for (const param of RP_PARAMS.circle) {
      const p = rpOf('circle', param);
      for (const t of grid(p.range[0], p.range[1], 60)) {
        const [x, y] = p.r(t);
        if (!near(x * x + y * y, 1, 1e-12)) off.push(`${param} t=${t}`);
      }
    }
    for (const curve of RP_CURVES) {
      const first = rpOf(curve, 't');
      for (const param of RP_PARAMS[curve]) {
        const p = rpOf(curve, param);
        for (const u of grid(first.range[0], Math.min(first.range[1], p.base(p.range[1])), 24)) {
          const t = convertT(curve, 't', param, u);
          const a = first.r(u);
          const b = p.r(t);
          if (!near(a[0], b[0], 1e-9) || !near(a[1], b[1], 1e-9)) off.push(`${curve}/${param} u=${u}`);
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('`twice` has twice the speed and twice the total of `t`, and sq has total 2π', () => {
    const one = rpOf('circle', 't');
    const two = rpOf('circle', 'twice');
    expect(two.length).toBe(2 * one.length);
    const off: string[] = [];
    for (const t of grid(0, 2 * Math.PI)) if (!near(two.speed(t), 2 * one.speed(t), 1e-15) || !near(two.s(t), 2 * one.s(t), 1e-15)) off.push(`t=${t}`);
    expect(off).toEqual([]);
    expect(rpOf('circle', 'sq').length).toBe(2 * Math.PI);
    expect(rpOf('circle', 'sq').s(rpOf('circle', 'sq').range[1])).toBeCloseTo(2 * Math.PI, 12);
  });

  it('arc length does not depend on a one-to-one reparametrisation: s2(t) = s1(base(t)) for the notes and sq', () => {
    const off: string[] = [];
    for (const [curve, param] of [['notes', 't2'], ['circle', 'sq'], ['circle', 'twice']] as const) {
      const p = rpOf(curve, param);
      const q = rpOf(curve, 't');
      for (const t of grid(p.range[0], p.range[1], 40)) if (!near(p.s(t), q.s(p.base(t)), 1e-12)) off.push(`${curve}/${param} t=${t}`);
    }
    expect(off).toEqual([]);
  });
});

describe('exact identities: polar curves', () => {
  it('the closed-form integrand equals √(x′² + y′²) of (f cos θ, f sin θ), and also √(r² + r′²)', () => {
    const off: string[] = [];
    for (const id of PL_IDS) {
      const p = PL[id];
      for (const th of grid(0.05, 2 * Math.PI - 0.05, 60)) {
        const dx = centralDiff((u) => polarAt(id, u)[0], th);
        const dy = centralDiff((u) => polarAt(id, u)[1], th);
        if (!near(Math.hypot(dx, dy), p.integrand(th), 1e-6)) off.push(`${id} xy th=${th}`);
        if (!near(Math.hypot(p.f(th), p.df(th)), p.integrand(th), 1e-12)) off.push(`${id} rr th=${th}`);
        if (!near(centralDiff(p.f, th), p.df(th), 1e-6)) off.push(`${id} df th=${th}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('the cardioid has s(π) = 4 and s(2π) = 8; the stored totals equal Simpson of the integrand', () => {
    expect(PL.cardioid.s(Math.PI)).toBeCloseTo(4, 12);
    expect(PL.cardioid.s(2 * Math.PI)).toBeCloseTo(8, 12);
    for (const id of PL_IDS) expect(relativeError(simpson(PL[id].integrand, 0, 2 * Math.PI, 4000), PL[id].total)).toBeLessThan(1e-9);
  });

  it('the triangle legs are r dθ and r′ dθ and the hypotenuse over dθ is the integrand', () => {
    const off: string[] = [];
    for (const id of PL_IDS) {
      const p = PL[id];
      for (const th of [0.3, 1.1, 2.4, 4]) {
        const tri = polarTriangle(id, th, 0.2);
        if (!near(tri.around, p.f(th) * 0.2, 1e-15) || !near(tri.along, p.df(th) * 0.2, 1e-15)) off.push(`${id} legs th=${th}`);
        if (!near(tri.hyp / 0.2, p.integrand(th), 1e-12)) off.push(`${id} hyp th=${th}`);
      }
    }
    expect(off).toEqual([]);
  });
});

describe('analytic limits: the inscribed polygon and the little triangle', () => {
  it('the polygon length increases when n doubles, stays below the length and tends to it', () => {
    const off: string[] = [];
    for (const id of AL_IDS) {
      let last = -1;
      for (const n of [1, 2, 4, 8, 16, 32, 64]) {
        const L = polygon(id, n).length;
        if (!(L >= last)) off.push(`${id} n=${n} not increasing`);
        if (!(L <= AL[id].length + 1e-12)) off.push(`${id} n=${n} above the length`);
        last = L;
      }
      if (!(AL[id].length - polygon(id, 64).length < 2e-3 * AL[id].length)) off.push(`${id} n=64 far`);
    }
    expect(off).toEqual([]);
  });

  it('the polygon error is proportional to 1/n²: halving the step divides it by about 4', () => {
    const off: string[] = [];
    for (const id of AL_IDS) {
      const e1 = AL[id].length - polygon(id, 32).length;
      const e2 = AL[id].length - polygon(id, 64).length;
      const ratio = e1 / e2;
      if (!(ratio > 3.7 && ratio < 4.3)) off.push(`${id} ratio=${ratio}`);
    }
    expect(off).toEqual([]);
  });

  it('a polygon has n + 1 vertices, starts and ends on the curve', () => {
    for (const id of AL_IDS as readonly AlId[]) {
      const pg = polygon(id, 8);
      expect(pg.points).toHaveLength(9);
      expect(pg.points[0]).toEqual(AL[id].r(AL[id].range[0]));
      expect(pg.points[8]).toEqual(AL[id].r(AL[id].range[1]));
    }
  });

  it('the chord over dθ tends to the integrand, with error proportional to dθ', () => {
    const off: string[] = [];
    for (const id of PL_IDS) {
      const th = id === 'cardioid' ? 1.2 : 2.3;
      const f = PL[id].integrand(th);
      const e1 = Math.abs(polarTriangle(id, th, 0.04).chord / 0.04 - f);
      const e2 = Math.abs(polarTriangle(id, th, 0.02).chord / 0.02 - f);
      if (!(e1 / e2 > 1.7 && e1 / e2 < 2.3)) off.push(`${id} ratio=${e1 / e2}`);
      if (!(e2 / f < 0.02)) off.push(`${id} not small`);
      const a = polarTriangle(id, th, 0.0005);
      if (relativeError(a.chord, a.arc) > 1e-6 || relativeError(a.hyp, a.arc) > 1e-3) off.push(`${id} tiny triangle`);
    }
    expect(off).toEqual([]);
  });
});
