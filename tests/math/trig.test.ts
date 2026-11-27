/**
 * src/math/trig.ts, filed by accuracy category: exact identities of the circle and of cosh/sinh, the places where tan
 * is undefined, wave readouts, principal values and the angle sets of the inverse functions, the π-multiple formatter.
 * Each test is named after the claim it proves; a sweep collects its failures and asserts once. Values from mpmath.
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/vec';
import {
  PRINCIPAL_RANGE,
  anglesFor,
  circlePoint,
  coshOf,
  deg2rad,
  halves,
  hyperIdentity,
  hyperPoint,
  piMultiple,
  piText,
  principalValue,
  sinhOf,
  tanOf,
  tanUndefined,
  trigOf,
  waveInfo,
  waveValue,
  type InvFn,
} from '~/math/trig';

describe('exact identities: the unit circle', () => {
  it('cos² θ + sin² θ = 1 for θ from −360° to 720°', () => {
    const off: number[] = [];
    for (let d = -360; d <= 720; d++) {
      const p = circlePoint(deg2rad(d));
      if (Math.abs(p.x * p.x + p.y * p.y - 1) > 1e-14) off.push(d);
    }
    expect(off).toEqual([]);
  });

  it('sin and cos are 2π-periodic and tan is π-periodic where defined (whole degrees)', () => {
    const off: string[] = [];
    for (let d = -360; d <= 360; d++) {
      if (Math.abs(trigOf('sin', d) - trigOf('sin', d + 360)) > 1e-12) off.push(`sin ${d}`);
      if (Math.abs(trigOf('cos', d) - trigOf('cos', d + 360)) > 1e-12) off.push(`cos ${d}`);
      if (!tanUndefined(d) && Math.abs(tanOf(d) - tanOf(d + 180)) > 1e-9 * (1 + Math.abs(tanOf(d)))) off.push(`tan ${d}`);
    }
    expect(off).toEqual([]);
  });

  it('in the second quadrant (90°, 180°) sin > 0 > cos', () => {
    const off: number[] = [];
    for (let d = 91; d <= 179; d++) if (!(trigOf('sin', d) > 0 && trigOf('cos', d) < 0)) off.push(d);
    expect(off).toEqual([]);
  });

  it('special values: sin 30° = 1/2, cos 60° = 1/2, tan 45° = 1, tan 135° = −1', () => {
    expect(relativeError(trigOf('sin', 30), 0.5)).toBeLessThan(1e-15);
    expect(relativeError(trigOf('cos', 60), 0.5)).toBeLessThan(1e-15);
    expect(relativeError(tanOf(45), 1)).toBeLessThan(1e-15);
    expect(relativeError(tanOf(135), -1)).toBeLessThan(1e-15);
  });
});

describe('boundaries: where tan is undefined', () => {
  it('tan is undefined exactly at 90° + k·180° over whole degrees −360…720', () => {
    const off: number[] = [];
    for (let d = -360; d <= 720; d++) {
      const expected = (((d - 90) % 180) + 180) % 180 === 0;
      if (tanUndefined(d) !== expected) off.push(d);
      if (expected !== Number.isNaN(tanOf(d))) off.push(d);
    }
    expect(off).toEqual([]);
  });

  it('89° and 91° are defined, with large values of opposite sign (tan 89° = 57.28996163)', () => {
    expect(tanUndefined(89)).toBe(false);
    expect(relativeError(tanOf(89), 57.28996163075943)).toBeLessThan(1e-12);
    expect(tanOf(91)).toBeLessThan(-57);
  });
});

describe('exact identities: waves', () => {
  it('amplitude |A|, period 2π/ω, shift −φ/ω', () => {
    const w = waveInfo(-2, 2, Math.PI / 3);
    expect(w.amplitude).toBe(2);
    expect(relativeError(w.period, Math.PI)).toBeLessThan(1e-15);
    expect(relativeError(w.shift, -Math.PI / 6)).toBeLessThan(1e-15);
  });

  it('the graph repeats after the period and vanishes at the shifted origin, over a grid of (A, ω, φ)', () => {
    const off: string[] = [];
    for (const A of [-3, -1, 0.5, 2]) {
      for (const om of [0.25, 0.75, 1, 2, 4]) {
        for (const ph of [-180, -90, 0, 45, 180].map(deg2rad)) {
          const { period, shift } = waveInfo(A, om, ph);
          for (const x of [-1, 0.3, 2]) {
            if (Math.abs(waveValue(A, om, ph, x) - waveValue(A, om, ph, x + period)) > 1e-12) off.push(`period ${A} ${om} ${ph} ${x}`);
          }
          if (Math.abs(waveValue(A, om, ph, shift)) > 1e-12) off.push(`shift ${A} ${om} ${ph}`);
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('A < 0 flips the graph in the x-axis', () => {
    expect(waveValue(-2, 1.5, 0.4, 0.9)).toBeCloseTo(-waveValue(2, 1.5, 0.4, 0.9), 15);
  });

  it('ω = 2 gives period π (task wave-period)', () => {
    expect(relativeError(waveInfo(1, 2, 0).period, Math.PI)).toBeLessThan(1e-15);
  });
});

describe('exact identities: the π-multiple formatter', () => {
  it('writes the readouts of the wave sliders exactly', () => {
    expect(piText(Math.PI)).toBe('π');
    expect(piText(-Math.PI)).toBe('−π');
    expect(piText(0)).toBe('0');
    expect(piText((2 * Math.PI) / 3)).toBe('2π/3');
    expect(piText(waveInfo(1, 0.25, 0).period)).toBe('8π');
    expect(piText(waveInfo(1, 1.5, 0).period)).toBe('4π/3');
    expect(piText(waveInfo(1, 1, deg2rad(60)).shift)).toBe('−π/3');
    expect(piText(waveInfo(1, 2, deg2rad(-90)).shift)).toBe('π/4');
  });

  it('returns null for a number that is not a multiple of π with denominator ≤ 48', () => {
    expect(piText(1)).toBeNull();
    expect(piText(2.5)).toBeNull();
    expect(piMultiple(0.3)).toBeNull();
  });

  it('round-trips p/q·π for q ≤ 12 and |p| ≤ 24', () => {
    const off: string[] = [];
    for (let q = 1; q <= 12; q++) {
      for (let p = -24; p <= 24; p++) {
        const m = piMultiple((p * Math.PI) / q);
        if (!m || m.p * q !== p * m.q) off.push(`${p}/${q}`);
      }
    }
    expect(off).toEqual([]);
  });
});

describe('principal values and the angles on the circle', () => {
  it('arcsin 1/2 = π/6, arccos(−1/2) = 2π/3, arctan(−1) = −π/4, arcsin(−1) = −π/2 (mpmath)', () => {
    expect(relativeError(principalValue('arcsin', 0.5), 0.5235987755982989)).toBeLessThan(1e-15);
    expect(relativeError(principalValue('arccos', -0.5), 2.0943951023931955)).toBeLessThan(1e-15);
    expect(relativeError(principalValue('arctan', -1), -0.7853981633974483)).toBeLessThan(1e-15);
    expect(relativeError(principalValue('arcsin', -1), -1.5707963267948966)).toBeLessThan(1e-15);
    expect(principalValue('arcsin', 1.5)).toBeNaN();
    expect(principalValue('arccos', -1.01)).toBeNaN();
  });

  it('each listed angle has the right trig value, and exactly one is principal and in the range', () => {
    const off: string[] = [];
    const fns: [InvFn, (t: number) => number, number[]][] = [
      ['arcsin', Math.sin, [-1, -0.7, -0.25, 0, 0.5, 0.95, 1]],
      ['arccos', Math.cos, [-1, -0.5, 0, 0.3, 1]],
      ['arctan', Math.tan, [-5, -1, 0, 0.5, 5]],
    ];
    for (const [fn, f, vs] of fns) {
      for (const v of vs) {
        const list = anglesFor(fn, v);
        const pr = list.filter((a) => a.principal);
        if (pr.length !== 1) off.push(`${fn} ${v} principal count ${pr.length}`);
        const { lo, hi } = PRINCIPAL_RANGE[fn];
        for (const a of list) {
          if (Math.abs(f(a.theta) - v) > 1e-9 * (1 + Math.abs(v))) off.push(`${fn} ${v} value ${a.theta}`);
          if (!(a.theta > -Math.PI && a.theta <= Math.PI)) off.push(`${fn} ${v} wrap`);
          if (a.principal && !(a.theta >= lo - 1e-12 && a.theta <= hi + 1e-12)) off.push(`${fn} ${v} principal out of range`);
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('two angles generally, one at v = ±1 for arcsin and arccos; arctan always two', () => {
    expect(anglesFor('arcsin', 0.5)).toHaveLength(2);
    expect(anglesFor('arcsin', 1)).toHaveLength(1);
    expect(anglesFor('arcsin', -1)).toHaveLength(1);
    expect(anglesFor('arccos', 1)).toHaveLength(1);
    expect(anglesFor('arccos', -1)).toHaveLength(1);
    expect(anglesFor('arccos', 0.5)).toHaveLength(2);
    expect(anglesFor('arctan', 5)).toHaveLength(2);
    expect(anglesFor('arcsin', 1.2)).toEqual([]);
  });

  it('arcsin of a negative is negative, arccos of a negative is in (π/2, π], sin θ = 1/2 has π/6 and 5π/6', () => {
    expect(principalValue('arcsin', -0.4)).toBeLessThan(0);
    const c = principalValue('arccos', -0.4);
    expect(c).toBeGreaterThan(Math.PI / 2);
    expect(c).toBeLessThanOrEqual(Math.PI);
    const l = anglesFor('arcsin', 0.5);
    expect(relativeError(l[0].theta, Math.PI / 6)).toBeLessThan(1e-14);
    expect(relativeError(l[1].theta, (5 * Math.PI) / 6)).toBeLessThan(1e-14);
  });
});

describe('exact identities: cosh and sinh', () => {
  it('cosh² t − sinh² t = 1 for t in [−3, 3]', () => {
    const off: number[] = [];
    for (let k = -60; k <= 60; k++) if (Math.abs(hyperIdentity(k / 20) - 1) > 1e-13) off.push(k / 20);
    expect(off).toEqual([]);
  });

  it('values (mpmath): cosh 1 = 1.5430806348, sinh 1 = 1.1752011936, cosh 3 = 10.067661996, sinh(−3) = −10.017874927', () => {
    expect(relativeError(coshOf(1), 1.5430806348152437)).toBeLessThan(1e-15);
    expect(relativeError(sinhOf(1), 1.1752011936438014)).toBeLessThan(1e-15);
    expect(relativeError(coshOf(3), 10.067661995777766)).toBeLessThan(1e-15);
    expect(relativeError(sinhOf(-3), -10.017874927409903)).toBeLessThan(1e-15);
  });

  it('cosh is even, sinh is odd, and the hyperbola point lies on x² − y² = 1 with x ≥ 1', () => {
    const off: number[] = [];
    for (let k = -60; k <= 60; k++) {
      const t = k / 20;
      const p = hyperPoint(t);
      if (Math.abs(coshOf(t) - coshOf(-t)) > 1e-14 * coshOf(t) || Math.abs(sinhOf(t) + sinhOf(-t)) > 1e-14 * (1 + Math.abs(sinhOf(t)))) off.push(t);
      if (Math.abs(p.x * p.x - p.y * p.y - 1) > 1e-13 || p.x < 1) off.push(t);
    }
    expect(off).toEqual([]);
  });

  it('cosh is the sum of the halves, sinh their difference, over [−3, 3]', () => {
    const off: number[] = [];
    for (let k = -60; k <= 60; k++) {
      const t = k / 20;
      const h = halves(t);
      if (relativeError(h.pos + h.neg, coshOf(t)) > 1e-14) off.push(t);
      if (Math.abs(h.pos - h.neg - sinhOf(t)) > 1e-14 * (1 + Math.abs(sinhOf(t)))) off.push(t);
    }
    expect(off).toEqual([]);
  });

  it('for |t| ≥ 2 cosh t is within 2% of e^|t|/2 (task hyper-halves), but not at t = 1', () => {
    const off: number[] = [];
    for (const t of [2, 2.5, 3, -2, -3]) if (relativeError(coshOf(t), Math.exp(Math.abs(t)) / 2) > 0.02) off.push(t);
    expect(off).toEqual([]);
    expect(relativeError(coshOf(1), Math.exp(1) / 2)).toBeGreaterThan(0.02);
  });
});
