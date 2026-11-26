/**
 * src/math/complex.ts, filed by accuracy category: exact identities of the algebraic form, polar form and de Moivre,
 * n-th roots, quadratic roots, regions of the plane, phasor helpers. Each test is named after the claim it proves.
 * Quantities are compared by relativeError; against an exact 0 the bound is absolute, 1e-12 times the scale of the
 * quantities involved, because rounding of a product with cos or sin is of order 1e-16 of that scale. A sweep over
 * many points collects its failures and asserts once.
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/vec';
import {
  REGION_KINDS,
  cabs,
  cadd,
  carg,
  cdiv,
  cis,
  cmul,
  complex,
  conj,
  cpow,
  cpowers,
  croots,
  csub,
  derivativeAmplitude,
  inRegion,
  polar,
  quadraticRoots,
  reAt,
  regionBoundaryDistance,
  regionBoundaryPoint,
  sumAmplitude,
  type Complex,
  type RegionSpec,
} from '~/math/complex';

/** a fixed set of sample numbers: a grid with irrational-ish spacing, no zero */
const SAMPLES: Complex[] = [];
for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) if (i || j) SAMPLES.push(complex(i * 0.7 + 0.1, j * 0.55 - 0.05));

const close = (a: Complex, b: Complex, scale: number) => cabs(csub(a, b)) <= 1e-12 * Math.max(1, scale);

describe('exact identities of the algebraic form', () => {
  it('|zw| = |z||w| for every pair of samples', () => {
    const off: string[] = [];
    for (const z of SAMPLES) for (const w of SAMPLES) if (relativeError(cabs(cmul(z, w)), cabs(z) * cabs(w)) > 1e-13) off.push(`${z.re},${z.im} ${w.re},${w.im}`);
    expect(off).toEqual([]);
  });

  it('z z-bar = |z|^2 is real for every sample', () => {
    const off: number[] = [];
    SAMPLES.forEach((z, k) => {
      const p = cmul(z, conj(z));
      if (relativeError(p.re, cabs(z) ** 2) > 1e-13 || Math.abs(p.im) > 1e-12 * cabs(z) ** 2) off.push(k);
    });
    expect(off).toEqual([]);
  });

  it('the conjugate respects sums, products and quotients, and conj(conj z) = z', () => {
    const off: string[] = [];
    const z = complex(1.3, -2.1);
    for (const w of SAMPLES) {
      const s = cabs(z) * cabs(w) + 1;
      if (!close(conj(cadd(z, w)), cadd(conj(z), conj(w)), s)) off.push('sum');
      if (!close(conj(cmul(z, w)), cmul(conj(z), conj(w)), s)) off.push('product');
      if (!close(conj(cdiv(z, w)), cdiv(conj(z), conj(w)), s)) off.push('quotient');
      if (!close(conj(conj(w)), w, 1)) off.push('involution');
    }
    expect(off).toEqual([]);
  });

  it('division recipe: (z/w) w = z for every pair of samples', () => {
    const off: string[] = [];
    for (const z of SAMPLES) for (const w of SAMPLES) if (!close(cmul(cdiv(z, w), w), z, cabs(z))) off.push(`${z.re},${z.im} / ${w.re},${w.im}`);
    expect(off).toEqual([]);
  });

  it('(1 + 2i)/(3 - i) = (1 + 7i)/10 exactly', () => {
    const q = cdiv(complex(1, 2), complex(3, -1));
    expect(relativeError(q.re, 0.1)).toBeLessThan(1e-14);
    expect(relativeError(q.im, 0.7)).toBeLessThan(1e-14);
  });

  it('arg(zw) = arg z + arg w up to a multiple of 2 pi', () => {
    const off: string[] = [];
    for (const z of SAMPLES) {
      for (const w of SAMPLES) {
        const d = carg(cmul(z, w)) - carg(z) - carg(w);
        const k = Math.round(d / (2 * Math.PI));
        if (Math.abs(d - 2 * Math.PI * k) > 1e-12) off.push(`${z.re},${z.im} ${w.re},${w.im}`);
      }
    }
    expect(off).toEqual([]);
  });
});

describe('de Moivre: powers', () => {
  it('cpow agrees with repeated multiplication for n = 0...12', () => {
    const off: string[] = [];
    for (const z of SAMPLES.slice(0, 40)) {
      let acc = complex(1, 0);
      for (let n = 0; n <= 12; n++) {
        if (!close(cpow(z, n), acc, cabs(acc))) off.push(`${z.re},${z.im} n=${n}`);
        acc = cmul(acc, z);
      }
    }
    expect(off).toEqual([]);
  });

  it('cis(pi/2)^2 = -1 and cis(t)^n = cis(nt)', () => {
    const m = cpow(cis(Math.PI / 2), 2);
    expect(Math.abs(m.re + 1)).toBeLessThan(1e-15);
    expect(Math.abs(m.im)).toBeLessThan(1e-15);
    const off: number[] = [];
    for (let k = 1; k <= 50; k++) {
      const th = 0.37 * k;
      for (let n = 1; n <= 12; n++) if (!close(cpow(cis(th), n), cis(n * th), 1)) off.push(k * 100 + n);
    }
    expect(off).toEqual([]);
  });

  it('a negative exponent gives the reciprocal power', () => {
    const z = complex(1.2, -0.7);
    expect(close(cmul(cpow(z, -3), cpow(z, 3)), complex(1, 0), 1)).toBe(true);
  });

  it('cpowers lists z, z^2, ..., z^n in order with modulus r^k and argument k t', () => {
    const z = polar(1.1, 0.4);
    const list = cpowers(z, 8);
    expect(list.length).toBe(8);
    const off: number[] = [];
    list.forEach((p, i) => {
      const k = i + 1;
      // Arg is in (-pi, pi], so k t is compared as a point of the unit circle
      const unit = cdiv(p, complex(cabs(p), 0));
      if (relativeError(cabs(p), 1.1 ** k) > 1e-13 || cabs(csub(unit, cis(0.4 * k))) > 1e-12) off.push(k);
    });
    expect(off).toEqual([]);
  });

  it('a number on the unit circle has all its powers on the unit circle', () => {
    const off: number[] = [];
    for (let k = 0; k < 36; k++) for (const p of cpowers(cis((k * Math.PI) / 18), 12)) if (relativeError(cabs(p), 1) > 1e-13) off.push(k);
    expect(off).toEqual([]);
  });
});

describe('n-th roots', () => {
  const W = [complex(1, 0), complex(-1, 0), complex(0, 1), complex(-8, 0), complex(3, -4), complex(-2.5, 1.5), complex(0.2, -0.1)];

  it('each root raised to the n-th power gives w, for n = 2...12', () => {
    const off: string[] = [];
    for (const w of W) {
      for (let n = 2; n <= 12; n++) {
        croots(w, n).forEach((z, k) => {
          if (cabs(csub(cpow(z, n), w)) > 1e-12 * Math.max(1, cabs(w))) off.push(`${w.re},${w.im} n=${n} k=${k}`);
        });
      }
    }
    expect(off).toEqual([]);
  });

  it('the principal root (k = 0) is r^(1/n) cis(Arg w / n)', () => {
    const z0 = croots(complex(-8, 0), 3)[0];
    expect(relativeError(cabs(z0), 2)).toBeLessThan(1e-14);
    expect(Math.abs(carg(z0) - Math.PI / 3)).toBeLessThan(1e-14);
  });

  it('the square roots of -1 are i and -i, principal first', () => {
    const [a, b] = croots(complex(-1, 0), 2);
    expect(close(a, complex(0, 1), 1)).toBe(true);
    expect(close(b, complex(0, -1), 1)).toBe(true);
  });

  it('the roots lie on one circle and are equally spaced by 2 pi / n', () => {
    const off: string[] = [];
    for (const w of W) {
      for (let n = 2; n <= 12; n++) {
        const roots = croots(w, n);
        const rho = Math.pow(cabs(w), 1 / n);
        for (let k = 0; k < n; k++) {
          if (relativeError(cabs(roots[k]), rho) > 1e-13) off.push(`radius ${n} ${k}`);
          const step = carg(cdiv(roots[(k + 1) % n], roots[k]));
          const wanted = (2 * Math.PI) / n;
          // arg of the quotient is in (-pi, pi]; for n = 2 the step pi may come out as -pi
          if (Math.abs(step - wanted) > 1e-12 && !(n === 2 && Math.abs(Math.abs(step) - Math.PI) < 1e-12)) off.push(`step ${n} ${k}`);
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('the n roots sum to 0 for n >= 2', () => {
    const off: string[] = [];
    for (const w of W) {
      for (let n = 2; n <= 12; n++) {
        const s = croots(w, n).reduce(cadd, complex(0, 0));
        if (cabs(s) > 1e-12 * Math.max(1, Math.pow(cabs(w), 1 / n))) off.push(`${w.re},${w.im} n=${n}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('the roots of 1 are the roots of unity cis(2 pi k / n)', () => {
    const off: string[] = [];
    for (let n = 2; n <= 12; n++) {
      croots(complex(1, 0), n).forEach((z, k) => {
        if (!close(z, cis((2 * Math.PI * k) / n), 1)) off.push(`${n} ${k}`);
      });
    }
    expect(off).toEqual([]);
  });

  it('every root of 0 is 0', () => {
    expect(croots(complex(0, 0), 4).every((z) => z.re === 0 && z.im === 0)).toBe(true);
  });
});

describe('quadratic roots', () => {
  it('the roots satisfy z^2 + bz + c = 0 over a grid of b, c in [-4, 4]', () => {
    const off: string[] = [];
    for (let b = -4; b <= 4; b += 0.25) {
      for (let c = -4; c <= 4; c += 0.25) {
        for (const z of quadraticRoots(b, c).roots) {
          const v = cadd(cadd(cmul(z, z), cmul(complex(b, 0), z)), complex(c, 0));
          if (cabs(v) > 1e-12 * (1 + cabs(z) ** 2)) off.push(`${b},${c}`);
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('delta < 0 gives a conjugate pair with real part -b/2, delta > 0 two real roots, delta = 0 a double root', () => {
    const off: string[] = [];
    for (let b = -4; b <= 4; b += 0.5) {
      for (let c = -4; c <= 4; c += 0.5) {
        const { disc, roots } = quadraticRoots(b, c);
        const [p, q] = roots;
        if (disc < 0 && !(close(p, conj(q), 1) && p.im > 0 && Math.abs(p.re + b / 2) < 1e-14)) off.push(`pair ${b},${c}`);
        if (disc > 0 && !(p.im === 0 && q.im === 0 && p.re > q.re)) off.push(`real ${b},${c}`);
        if (disc === 0 && !(p.im === 0 && p.re === q.re)) off.push(`double ${b},${c}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('z^2 + 1 has the roots i and -i and z^2 - 2z + 1 the double root 1', () => {
    const [p, q] = quadraticRoots(0, 1).roots;
    expect(close(p, complex(0, 1), 1) && close(q, complex(0, -1), 1)).toBe(true);
    const d = quadraticRoots(-2, 1);
    expect(d.disc).toBe(0);
    expect(d.roots[0].re).toBe(1);
    expect(d.roots[1].re).toBe(1);
  });

  it('the sum of the roots is -b and the product is c (Vieta)', () => {
    const off: string[] = [];
    for (let b = -4; b <= 4; b += 0.5) {
      for (let c = -4; c <= 4; c += 0.5) {
        const [p, q] = quadraticRoots(b, c).roots;
        if (!close(cadd(p, q), complex(-b, 0), 4) || !close(cmul(p, q), complex(c, 0), 4)) off.push(`${b},${c}`);
      }
    }
    expect(off).toEqual([]);
  });
});

describe('regions of the plane: membership against hand-picked points', () => {
  const base: RegionSpec = { kind: 'disk', a: complex(0, 0), b: complex(2, 0), r: 1.5, r2: 2.5, alpha: Math.PI / 6, beta: (2 * Math.PI) / 3, c: 1 };
  const of = (kind: RegionSpec['kind'], over: Partial<RegionSpec> = {}): RegionSpec => ({ ...base, kind, ...over });

  it('the disk |z - a| <= r includes its boundary', () => {
    const s = of('disk', { a: complex(1, 1), r: 2 });
    expect(inRegion(s, complex(1, 1))).toBe(true);
    expect(inRegion(s, complex(3, 1))).toBe(true);
    expect(inRegion(s, complex(3.1, 1))).toBe(false);
    expect(inRegion(s, complex(-1, -1))).toBe(false);
  });

  it('the annulus r < |z - a| < r2 excludes both circles', () => {
    const s = of('annulus', { r: 1, r2: 2 });
    expect(inRegion(s, complex(1, 0))).toBe(false);
    expect(inRegion(s, complex(2, 0))).toBe(false);
    expect(inRegion(s, complex(1.5, 0))).toBe(true);
    expect(inRegion(s, complex(0, 0))).toBe(false);
    expect(inRegion(s, complex(0, 2.5))).toBe(false);
  });

  it('the circle |z - a| = r holds on the circle and within the stated tolerance', () => {
    const s = of('circle', { r: 2 });
    expect(inRegion(s, complex(0, 2))).toBe(true);
    expect(inRegion(s, complex(0, 2.03))).toBe(false);
    expect(inRegion(s, complex(0, 2.03), 0.05)).toBe(true);
    expect(inRegion(s, complex(0, 0))).toBe(false);
  });

  it('the sector alpha <= Arg z <= beta: the first quadrant, and a sector across the negative axis', () => {
    const q = of('sector', { alpha: 0, beta: Math.PI / 2 });
    expect(inRegion(q, complex(1, 1))).toBe(true);
    expect(inRegion(q, complex(1, 0))).toBe(true);
    expect(inRegion(q, complex(0, 3))).toBe(true);
    expect(inRegion(q, complex(-1, 1))).toBe(false);
    expect(inRegion(q, complex(1, -1))).toBe(false);
    const w = of('sector', { alpha: (3 * Math.PI) / 4, beta: -(3 * Math.PI) / 4 });
    expect(inRegion(w, complex(-1, 0))).toBe(true);
    expect(inRegion(w, complex(-1, 0.5))).toBe(true);
    expect(inRegion(w, complex(1, 0))).toBe(false);
  });

  it('the half-planes Re z > c and Im z > c are strict', () => {
    expect(inRegion(of('halfplane-re', { c: 1 }), complex(1.5, -9))).toBe(true);
    expect(inRegion(of('halfplane-re', { c: 1 }), complex(1, 0))).toBe(false);
    expect(inRegion(of('halfplane-im', { c: -1 }), complex(7, -0.5))).toBe(true);
    expect(inRegion(of('halfplane-im', { c: -1 }), complex(7, -1))).toBe(false);
  });

  it('the bisector |z - a| = |z - b| is the perpendicular bisector of the segment ab', () => {
    const s = of('bisector', { a: complex(0, 0), b: complex(2, 0) });
    expect(inRegion(s, complex(1, 5))).toBe(true);
    expect(inRegion(s, complex(1, -3))).toBe(true);
    expect(inRegion(s, complex(1.5, 0))).toBe(false);
    const t = of('bisector', { a: complex(1, 1), b: complex(-1, -1) });
    expect(inRegion(t, complex(1, -1))).toBe(true);
    expect(inRegion(t, complex(1, 1))).toBe(false);
  });

  it('points of the bisector are equally far from a and b (a sweep along the line)', () => {
    const s = of('bisector', { a: complex(-1, 2), b: complex(3, 0.5) });
    const off: number[] = [];
    for (let t = -10; t <= 10; t += 0.5) {
      const p = regionBoundaryPoint(s, complex(0.7 + t * 0.3, t));
      if (relativeError(cabs(csub(p, s.a)), cabs(csub(p, s.b))) > 1e-12) off.push(t);
    }
    expect(off).toEqual([]);
  });
});

describe('region boundary: nearest point and distance', () => {
  const base: RegionSpec = { kind: 'disk', a: complex(0, 0), b: complex(2, 0), r: 1.5, r2: 2.5, alpha: Math.PI / 6, beta: (2 * Math.PI) / 3, c: 1 };
  const of = (kind: RegionSpec['kind'], over: Partial<RegionSpec> = {}): RegionSpec => ({ ...base, kind, ...over });

  it('the boundary distances of hand-picked points', () => {
    expect(relativeError(regionBoundaryDistance(of('disk'), complex(3, 0)), 1.5)).toBeLessThan(1e-14);
    expect(relativeError(regionBoundaryDistance(of('annulus'), complex(1.6, 0)), 0.1)).toBeLessThan(1e-12);
    expect(regionBoundaryDistance(of('halfplane-re', { c: 1 }), complex(4, 7))).toBe(3);
    expect(regionBoundaryDistance(of('halfplane-im', { c: 1 }), complex(4, -1))).toBe(2);
    expect(relativeError(regionBoundaryDistance(of('bisector'), complex(3, 5)), 2)).toBeLessThan(1e-14);
    expect(relativeError(regionBoundaryDistance(of('sector', { alpha: 0, beta: Math.PI / 2 }), complex(-1, 1)), 1)).toBeLessThan(1e-14);
  });

  it('the nearest boundary point lies on the boundary for every kind (sweep)', () => {
    const off: string[] = [];
    for (const kind of REGION_KINDS) {
      const s = of(kind);
      for (let x = -3; x <= 3; x += 0.37) {
        for (let y = -3; y <= 3; y += 0.41) {
          const p = regionBoundaryPoint(s, complex(x, y));
          const d = regionBoundaryDistance(s, p);
          if (d > 1e-12) off.push(`${kind} ${x},${y} -> ${d}`);
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('the nearest point of a disk is the radial projection onto its circle', () => {
    const p = regionBoundaryPoint(of('disk'), polar(3, 1));
    expect(relativeError(cabs(p), 1.5)).toBeLessThan(1e-14);
    expect(Math.abs(carg(p) - 1)).toBeLessThan(1e-14);
  });
});

describe('phasor helpers', () => {
  it('Re(A e^(it)) with A = 2 is 2 cos t, and the derivative amplitude gives -2 sin t', () => {
    const off: number[] = [];
    for (let k = 0; k <= 60; k++) {
      const t = 0.21 * k;
      if (Math.abs(reAt(complex(2, 0), 1, t) - 2 * Math.cos(t)) > 1e-12) off.push(k);
      if (Math.abs(reAt(derivativeAmplitude(complex(2, 0), 1), 1, t) + 2 * Math.sin(t)) > 1e-12) off.push(-k);
    }
    expect(off).toEqual([]);
  });

  it('the sum amplitude of 3 and 4 a quarter turn apart is 5, of equal opposite ones 0', () => {
    expect(relativeError(sumAmplitude(3, 4, Math.PI / 2), 5)).toBeLessThan(1e-14);
    expect(sumAmplitude(2, 2, Math.PI)).toBeLessThan(1e-7);
  });
});
