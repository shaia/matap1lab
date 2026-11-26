import { describe, expect, it } from 'vitest';
import { cabs, cadd, cmul, type Complex } from '../../src/math/complex';
import {
  argPrincipal,
  clog,
  clogBranches,
  clogPrincipal,
  cexp,
  cosEuler,
  expCircleRadius,
  expRay,
  logDefined,
  periodCopies,
  sinEuler,
} from '../../src/math/cexp';
import { relativeError } from '../../src/math/vec';

/** a fixed grid of nonzero test numbers, no random numbers */
function grid(n: number, lim: number): Complex[] {
  const out: Complex[] = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out.push({ re: -lim + (2 * lim * i) / (n - 1) + 0.013, im: -lim + (2 * lim * j) / (n - 1) + 0.007 });
  return out;
}
const dist = (a: Complex, b: Complex) => cabs({ re: a.re - b.re, im: a.im - b.im });

describe('exact identities', () => {
  it('e^(iπ) = −1: real part by relativeError, imaginary part against an absolute 1e-15 (exact value 0)', () => {
    const v = cexp({ re: 0, im: Math.PI });
    expect(relativeError(v.re, -1)).toBeLessThan(1e-15);
    expect(Math.abs(v.im)).toBeLessThan(1e-15);
  });

  it('e^(a+b) = e^a e^b for a grid of pairs', () => {
    const off: string[] = [];
    const zs = grid(7, 2.5);
    for (const a of zs) {
      for (const b of zs.slice(0, 12)) {
        const l = cexp(cadd(a, b));
        const r = cmul(cexp(a), cexp(b));
        if (relativeError(l.re, r.re) > 1e-12 && Math.abs(l.re - r.re) > 1e-12) off.push(`re ${a.re},${a.im} ${b.re},${b.im}`);
        if (relativeError(l.im, r.im) > 1e-12 && Math.abs(l.im - r.im) > 1e-12) off.push(`im ${a.re},${a.im} ${b.re},${b.im}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('|e^z| = e^(Re z)', () => {
    const off: string[] = [];
    for (const z of grid(15, 4)) if (relativeError(cabs(cexp(z)), Math.exp(z.re)) > 1e-14) off.push(`${z.re},${z.im}`);
    expect(off).toEqual([]);
  });

  it('e^(log w) = w for every branch k = −3…3', () => {
    const off: string[] = [];
    for (const w of grid(11, 4)) {
      for (let k = -3; k <= 3; k++) {
        const back = cexp(clog(w, k));
        if (dist(back, w) > 1e-12 * Math.max(1, cabs(w))) off.push(`${w.re},${w.im} k=${k}`);
      }
    }
    expect(off).toEqual([]);
  });

  it("Euler's formulas reproduce Math.cos and Math.sin on the real axis (imaginary parts against an absolute 1e-15)", () => {
    const off: string[] = [];
    for (let i = -60; i <= 60; i++) {
      const t = i * 0.1;
      const c = cosEuler({ re: t, im: 0 });
      const s = sinEuler({ re: t, im: 0 });
      if (Math.abs(c.re - Math.cos(t)) > 1e-15 || Math.abs(c.im) > 1e-15) off.push(`cos ${t}`);
      if (Math.abs(s.re - Math.sin(t)) > 1e-15 || Math.abs(s.im) > 1e-15) off.push(`sin ${t}`);
    }
    expect(off).toEqual([]);
  });

  it('cos² + sin² = 1 through the exponentials, also for a complex argument', () => {
    const off: string[] = [];
    for (const z of grid(9, 2)) {
      const c = cosEuler(z);
      const s = sinEuler(z);
      const sum = cadd(cmul(c, c), cmul(s, s));
      if (dist(sum, { re: 1, im: 0 }) > 1e-12) off.push(`${z.re},${z.im}`);
    }
    expect(off).toEqual([]);
  });
});

describe('periodicity', () => {
  it('e^(z + 2πik) = e^z for k = −2…2', () => {
    const off: string[] = [];
    for (const z of grid(9, 3)) {
      const target = cexp(z);
      for (const c of periodCopies(z, -2, 2)) if (dist(cexp(c), target) > 1e-12 * Math.max(1, cabs(target))) off.push(`${z.re},${z.im}`);
    }
    expect(off).toEqual([]);
  });

  it('the copies are spaced 2π apart on one vertical line', () => {
    const cs = periodCopies({ re: 0.5, im: 1 }, -2, 2);
    expect(cs).toHaveLength(5);
    const off: number[] = [];
    for (let i = 1; i < cs.length; i++) if (relativeError(cs[i].im - cs[i - 1].im, 2 * Math.PI) > 1e-14 || cs[i].re !== 0.5) off.push(i);
    expect(off).toEqual([]);
  });
});

describe('principal value and branches', () => {
  it('Im Log w lies in (−π, π] and Re Log w = ln|w|', () => {
    const off: string[] = [];
    for (const w of grid(21, 3)) {
      const L = clogPrincipal(w);
      if (!(L.im > -Math.PI && L.im <= Math.PI)) off.push(`range ${w.re},${w.im}`);
      if (relativeError(L.re, Math.log(cabs(w))) > 1e-14 && Math.abs(L.re) > 1e-14) off.push(`re ${w.re},${w.im}`);
    }
    expect(off).toEqual([]);
  });

  it('Log of the negative real axis is ln|w| + iπ, also with a rounding residue in Im', () => {
    expect(clogPrincipal({ re: -1, im: 0 })).toEqual({ re: 0, im: Math.PI });
    expect(argPrincipal({ re: -2, im: -1e-16 })).toBe(Math.PI);
    expect(argPrincipal({ re: -2, im: -0.01 })).toBeLessThan(0);
    const v = cexp({ re: 0, im: Math.PI });
    expect(argPrincipal(v)).toBe(Math.PI);
  });

  it('the branches differ by 2πi and k = 0 is the principal value', () => {
    const w = { re: 1, im: 1 };
    const bs = clogBranches(w, -2, 2);
    expect(bs).toHaveLength(5);
    expect(bs[2]).toEqual(clogPrincipal(w));
    expect(relativeError(bs[4].im - bs[2].im, 4 * Math.PI)).toBeLessThan(1e-14);
  });

  it('log 0 is signalled by NaN parts and logDefined is false', () => {
    const L = clog({ re: 0, im: 0 });
    expect(Number.isNaN(L.re) && Number.isNaN(L.im)).toBe(true);
    expect(logDefined({ re: 0, im: 0 })).toBe(false);
    expect(logDefined({ re: 0, im: 1e-300 })).toBe(true);
  });

  it('Log of a number on the unit circle is purely imaginary', () => {
    const off: number[] = [];
    for (let d = -170; d <= 180; d += 10) {
      const t = (d * Math.PI) / 180;
      const L = clogPrincipal({ re: Math.cos(t), im: Math.sin(t) });
      if (Math.abs(L.re) > 1e-15) off.push(d);
    }
    expect(off).toEqual([]);
  });
});

describe('images of lines', () => {
  it('the image of Im z = y is the ray at angle y, the image of Re z = x the circle of radius e^x', () => {
    const off: string[] = [];
    for (let i = -8; i <= 8; i++) {
      const y = i * 0.7;
      const ray = expRay(y);
      for (let j = -6; j <= 6; j++) {
        const t = j * 0.4;
        const w = cexp({ re: t, im: y });
        // on the ray: w = e^t (ux, uy)
        if (Math.hypot(w.re - Math.exp(t) * ray.ux, w.im - Math.exp(t) * ray.uy) > 1e-12 * Math.exp(t)) off.push(`ray ${y},${t}`);
        const c = cexp({ re: t, im: y });
        if (relativeError(cabs(c), expCircleRadius(t)) > 1e-14) off.push(`circle ${y},${t}`);
      }
    }
    expect(off).toEqual([]);
  });
});
