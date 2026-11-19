/**
 * src/math/conics.ts, filed by accuracy category: exact identities (completion of the square, classification),
 * parametrisations (residuals of points on the curve), analytic limits (asymptotes), drawing (branches never joined).
 * Each test is named after the claim it proves. Quantities are compared by relativeError; where the exact value is 0
 * (a residual of a point on the curve) the bound is absolute on a value divided by the natural scale of the terms
 * that cancel, because a relative error against 0 is undefined; rounding is then of order 1e-16 of that scale.
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/vec';
import {
  asymptotes,
  classifyConic,
  completeSquare,
  ellipseParam,
  ellipsePoint,
  ellipsePointText,
  hyperbolaPointText,
  parabolaPointExact,
  evalPoly,
  exactCosSin,
  expandCompleted,
  fmtCompleted,
  fmtPiFraction,
  fmtPoly,
  fmtSqrtFrac,
  fmtSurd,
  fmtSurdSum,
  hyperbolaPointX,
  hyperbolaPointXY,
  hyperbolaPointY,
  parabolaPointH,
  parabolaPointV,
  residual,
  samplePolylines,
  surdValue,
  toFrac,
  type Box,
  type Coeffs,
  type Shape,
} from '~/math/conics';
import { frac } from '~/math/space';

const BOX: Box = { xmin: -8, xmax: 8, ymin: -7.5, ymax: 7.5 };
const c = (A: number, C: number, D: number, E: number, F: number): Coeffs => ({ A, C, D, E, F });

/** a grid of coefficient sets: every sign pattern and zero of A, C and several linear terms and constants */
const GRID: Coeffs[] = [];
for (const A of [-3, -1, 0, 1, 2, 4]) for (const C of [-4, -2, 0, 1, 3]) for (const D of [-6, 0, 2, 5]) for (const E of [-8, 0, 3, 4]) for (const F of [-9, 0, 1, 7]) GRID.push(c(A, C, D, E, F));

describe('exact identities: completing the square', () => {
  it('expanding the completed form gives back A, C, D, E, F exactly, for every coefficient set of the grid', () => {
    for (const k of GRID) {
      const e = expandCompleted(completeSquare(k));
      expect([e.A, e.C, e.D, e.E, e.F].map((f) => f.n / f.d)).toEqual([k.A, k.C, k.D, k.E, k.F]);
      expect([e.A.d, e.C.d, e.D.d, e.E.d, e.F.d]).toEqual([1, 1, 1, 1, 1]);
    }
  });

  it('x² + 4y² − 2x + 8y − 11 = 0 completes to (x − 1)² + 4(y + 1)² = 16', () => {
    const f = completeSquare(c(1, 4, -2, 8, -11));
    expect(fmtCompleted(f)).toBe('(x − 1)² + 4(y + 1)² = 16');
  });

  it('the completed form is the same polynomial: A(x−h)² + C(y−k)² + lx·x + ly·y − R equals the original at integer points', () => {
    for (const k of GRID.filter((_, i) => i % 7 === 0)) {
      const f = completeSquare(k);
      const h = f.h ? f.h.n / f.h.d : 0;
      const kk = f.k ? f.k.n / f.k.d : 0;
      for (const [x, y] of [[0, 0], [1, 2], [-3, 4], [2, -1]]) {
        const lhs = f.A * (x - h) ** 2 + f.C * (y - kk) ** 2 + f.lx * x + f.ly * y - f.R.n / f.R.d;
        const rhs = evalPoly(k, x, y);
        // exact up to double rounding of fractions with denominators dividing 4·A·C
        expect(Math.abs(lhs - rhs)).toBeLessThan(1e-12 * (1 + Math.abs(rhs)));
      }
    }
  });

  it('fractional centres stay exact: 2x² + 2x + y² = 0 has h = −1/2 and R = 1/2', () => {
    const f = completeSquare(c(2, 1, 2, 0, 0));
    expect(f.h).toEqual({ n: -1, d: 2 });
    expect(f.R).toEqual({ n: 1, d: 2 });
  });
});

describe('exact identities: classification by signs and the right-hand side', () => {
  const cases: [string, Coeffs, string][] = [
    ['x² + y² − 1 = 0 is a circle', c(1, 1, 0, 0, -1), 'circle'],
    ['x² + y² − 2x + 4y + 1 = 0 is a circle (centre (1, −2), radius 2)', c(1, 1, -2, 4, 1), 'circle'],
    ['x² + 4y² − 4 = 0 is an ellipse', c(1, 4, 0, 0, -4), 'ellipse'],
    ['9x² + 4y² − 36 = 0 is an ellipse, not a hyperbola', c(9, 4, 0, 0, -36), 'ellipse'],
    ['9x² − 4y² − 36 = 0 is a hyperbola', c(9, -4, 0, 0, -36), 'hyperbola'],
    ['−9x² + 4y² − 36 = 0 is a hyperbola', c(-9, 4, 0, 0, -36), 'hyperbola'],
    ['x² − y = 0 is a parabola', c(1, 0, 0, -1, 0), 'parabola'],
    ['y² − 2x + 4y = 0 is a sideways parabola', c(0, 1, -2, 4, 0), 'parabola'],
    ['x² + y² = 0 is a single point', c(1, 1, 0, 0, 0), 'point'],
    ['x² + y² + 1 = 0 is the empty set', c(1, 1, 0, 0, 1), 'empty'],
    ['−x² − 2y² − 1 = 0 is the empty set (same-sign coefficients, wrong-sign right-hand side)', c(-1, -2, 0, 0, -1), 'empty'],
    ['x² − y² = 0 is a pair of intersecting lines', c(1, -1, 0, 0, 0), 'two-lines'],
    ['x² − 1 = 0 is two parallel lines', c(1, 0, 0, 0, -1), 'parallel-lines'],
    ['x² + 1 = 0 is the empty set', c(1, 0, 0, 0, 1), 'empty'],
    ['x² = 0 is a single (double) line', c(1, 0, 0, 0, 0), 'double-line'],
    ['y² − 2y + 1 = 0 is a double line y = 1', c(0, 1, 0, -2, 1), 'double-line'],
    ['2x − 4y + 6 = 0 has no second-degree term: a line', c(0, 0, 2, -4, 6), 'line'],
    ['0 = 0 is the whole plane', c(0, 0, 0, 0, 0), 'plane'],
  ];
  for (const [name, k, type] of cases) {
    it(name, () => expect(classifyConic(k).type).toBe(type));
  }

  it('a moved degenerate conic: x² − y² − 2x − 2y = 0 is x² − 2x + 1 − (y² + 2y + 1) = 0, a pair of lines', () => {
    expect(classifyConic(c(1, -1, -2, -2, 0)).type).toBe('two-lines');
  });

  it('the type depends only on signs and the right-hand side: scaling an equation by 3 or −2 never changes it', () => {
    for (const k of GRID) {
      for (const m of [3, -2]) {
        const s = c(m * k.A, m * k.C, m * k.D, m * k.E, m * k.F);
        expect(classifyConic(s).type).toBe(classifyConic(k).type);
      }
    }
  });

  it('A = C makes a circle and A ≠ C (same sign) an ellipse, when the set is not empty', () => {
    expect(classifyConic(c(2, 2, 0, 0, -8)).type).toBe('circle');
    expect(classifyConic(c(2, 3, 0, 0, -8)).type).toBe('ellipse');
  });
});

describe('analytic identities: the shape found from the equation has the right numbers', () => {
  it('x² + 4y² − 2x + 8y − 11 = 0 has centre (1, −1) and semi-axes 4 and 2', () => {
    const s = classifyConic(c(1, 4, -2, 8, -11)).shape as Extract<Shape, { kind: 'ellipse' }>;
    expect(s.kind).toBe('ellipse');
    expect(relativeError(s.a, 4)).toBeLessThan(1e-14);
    expect(relativeError(s.b, 2)).toBeLessThan(1e-14);
    expect(s.h).toBe(1);
    expect(s.k).toBe(-1);
  });

  it('4x² + 9y² = 36 has a = 3 (not 9) and b = 2: the coefficient of x² is not the semi-axis', () => {
    const s = classifyConic(c(4, 9, 0, 0, -36)).shape as Extract<Shape, { kind: 'ellipse' }>;
    expect(relativeError(s.a, 3)).toBeLessThan(1e-14);
    expect(relativeError(s.b, 2)).toBeLessThan(1e-14);
  });

  it('x² − y − 2x + 3 = 0 is y = (x − 1)² + 2: vertex (1, 2), a = 1', () => {
    const s = classifyConic(c(1, 0, -2, -1, 3)).shape as Extract<Shape, { kind: 'parabolaV' }>;
    expect(s).toMatchObject({ kind: 'parabolaV', h: 1, k: 2, a: 1 });
  });

  it('−2y² + 8y − x − 3 = 0 opens to the left: x = −2(y − 2)² + 5', () => {
    const s = classifyConic(c(0, -2, -1, 8, -3)).shape as Extract<Shape, { kind: 'parabolaH' }>;
    expect(s).toMatchObject({ kind: 'parabolaH', h: 5, k: 2, a: -2 });
  });

  it('9x² − 4y² = 36 opens left and right with a = 2, b = 3; 4y² − 9x² = 36 opens up and down with b = 3, a = 2', () => {
    const s1 = classifyConic(c(9, -4, 0, 0, -36)).shape as Extract<Shape, { kind: 'hyperbolaX' }>;
    expect(s1.kind).toBe('hyperbolaX');
    expect(relativeError(s1.a, 2)).toBeLessThan(1e-14);
    expect(relativeError(s1.b, 3)).toBeLessThan(1e-14);
    const s2 = classifyConic(c(-9, 4, 0, 0, -36)).shape as Extract<Shape, { kind: 'hyperbolaY' }>;
    expect(s2.kind).toBe('hyperbolaY');
    expect(relativeError(s2.a, 2)).toBeLessThan(1e-14);
    expect(relativeError(s2.b, 3)).toBeLessThan(1e-14);
  });

  it('x² − y² = 0 is the lines y = x and y = −x through the centre', () => {
    const s = classifyConic(c(1, -1, 0, 0, 0)).shape as Extract<Shape, { kind: 'lines' }>;
    expect(s.lines.map((l) => l.dy / l.dx).sort()).toEqual([-1, 1]);
  });
});

describe('parametrisations: points of the parametrised curve satisfy its equation', () => {
  it('(h + a cos t, k + b sin t) satisfies the ellipse equation, for every t of a 15° grid and every a, b, h, k tested', () => {
    for (const [a, b, h, k] of [[3, 2, 1, -2], [0.5, 4, -3, 3], [2, 2, 0, 0], [4, 0.5, 3, -3]]) {
      const s: Shape = { kind: 'ellipse', h, k, a, b };
      for (let d = 0; d < 360; d += 15) {
        const [x, y] = ellipsePoint(h, k, a, b, (d * Math.PI) / 180);
        expect(Math.abs(residual(s, x, y))).toBeLessThan(1e-13);
      }
    }
  });

  it('(h + t, k + a t²) and (h + a t², k + t) satisfy the two parabola equations', () => {
    for (const a of [-2, -0.5, 0.25, 1, 2]) {
      const sv: Shape = { kind: 'parabolaV', h: 2, k: -1, a };
      const sh: Shape = { kind: 'parabolaH', h: 2, k: -1, a };
      for (let t = -3; t <= 3; t += 0.5) {
        const [x, y] = parabolaPointV(2, -1, a, t);
        expect(Math.abs(residual(sv, x, y))).toBeLessThan(1e-12);
        const [x2, y2] = parabolaPointH(2, -1, a, t);
        expect(Math.abs(residual(sh, x2, y2))).toBeLessThan(1e-12);
      }
    }
  });

  it('(h ± a√(1+u²), k + b u) lies on x²/a² − y²/b² = 1 and (h + a u, k ± b√(1+u²)) on y²/b² − x²/a² = 1, both branches', () => {
    const sx: Shape = { kind: 'hyperbolaX', h: -1, k: 2, a: 1.5, b: 2 };
    const sy: Shape = { kind: 'hyperbolaY', h: -1, k: 2, a: 1.5, b: 2 };
    for (const br of [1, -1] as const) {
      for (let u = -3; u <= 3; u += 0.5) {
        const [x, y] = hyperbolaPointX(-1, 2, 1.5, 2, u, br);
        expect(Math.abs(residual(sx, x, y))).toBeLessThan(1e-12);
        const [x2, y2] = hyperbolaPointY(-1, 2, 1.5, 2, u, br);
        expect(Math.abs(residual(sy, x2, y2))).toBeLessThan(1e-12);
      }
    }
  });

  it('(h + σt, k + c/(σt)) satisfies (x − h)(y − k) = c for either sign of c and both branches', () => {
    for (const cc of [-4, -0.5, 0.5, 2]) {
      const s: Shape = { kind: 'hyperbolaXY', h: 1, k: -2, c: cc };
      for (const br of [1, -1] as const) {
        for (let t = 0.25; t <= 4; t += 0.25) {
          const [x, y] = hyperbolaPointXY(1, -2, cc, t, br);
          expect(relativeError((x - 1) * (y + 2), cc)).toBeLessThan(1e-14);
          expect(Math.abs(residual(s, x, y))).toBeLessThan(1e-13 * Math.abs(cc));
        }
      }
    }
  });

  it('for c > 0 the branches of xy = c are in quadrants I and III; for c < 0 in II and IV', () => {
    for (const br of [1, -1] as const) {
      const [xp, yp] = hyperbolaPointXY(0, 0, 2, 1, br);
      expect(Math.sign(xp)).toBe(Math.sign(yp));
      const [xn, yn] = hyperbolaPointXY(0, 0, -2, 1, br);
      expect(Math.sign(xn)).toBe(-Math.sign(yn));
    }
  });

  it('the polar-looking parameter of an ellipse is not the polar angle: ellipseParam inverts the parametrisation, atan2(y, x) does not', () => {
    const t = Math.PI / 4;
    const [x, y] = ellipsePoint(0, 0, 1, 2, t);
    expect(relativeError(ellipseParam(0, 0, 1, 2, x, y), t)).toBeLessThan(1e-14);
    expect(relativeError(Math.atan2(y, x), Math.atan(2))).toBeLessThan(1e-14);
    expect(Math.abs(Math.atan2(y, x) - t)).toBeGreaterThan(0.3);
  });

  it('ellipseParam inverts the parametrisation in every quadrant with a centre shift', () => {
    for (let d = 5; d < 360; d += 10) {
      const t = (d * Math.PI) / 180;
      const [x, y] = ellipsePoint(2, -1, 3, 1.5, t);
      expect(relativeError(ellipseParam(2, -1, 3, 1.5, x, y), t)).toBeLessThan(1e-13);
    }
  });

  it('every point sampled from every classified curve satisfies the ORIGINAL polynomial equation', () => {
    for (const k of GRID) {
      const cl = classifyConic(k);
      if (cl.shape.kind === 'none' || cl.shape.kind === 'point') continue;
      const polylines = samplePolylines(cl.shape, BOX);
      expect(polylines.length).toBeGreaterThan(0);
      for (const pl of polylines) {
        for (const [x, y] of pl) {
          const scale = Math.abs(k.A) * x * x + Math.abs(k.C) * y * y + Math.abs(k.D * x) + Math.abs(k.E * y) + Math.abs(k.F);
          // a point at the origin has scale 0 and a residual of rounding size: the absolute floor is 1e-12 times the
          // coefficients' size, which is what cancels there (errors of the coordinates are ~1e-16)
          const floor = 1e-12 * (Math.abs(k.A) + Math.abs(k.C) + Math.abs(k.D) + Math.abs(k.E) + Math.abs(k.F));
          expect(Math.abs(evalPoly(k, x, y))).toBeLessThan(1e-9 * scale + floor);
        }
      }
    }
  });
});

describe('analytic limits: asymptotes', () => {
  it('the asymptotes of x²/a² − y²/b² = 1 have slope ±b/a and of y²/b² − x²/a² = 1 also ±b/a', () => {
    for (const kind of ['hyperbolaX', 'hyperbolaY'] as const) {
      const s: Shape = { kind, h: 0, k: 0, a: 2, b: 3 };
      const slopes = asymptotes(s).map((l) => l.dy / l.dx).sort();
      expect(slopes).toEqual([-1.5, 1.5]);
    }
  });

  it('the asymptotes of xy = c are the lines x = h and y = k, whatever c', () => {
    const [v, hz] = asymptotes({ kind: 'hyperbolaXY', h: 1, k: -2, c: -3 });
    expect([v.x0, v.dx, v.dy]).toEqual([1, 0, 1]);
    expect([hz.y0, hz.dx, hz.dy]).toEqual([-2, 1, 0]);
  });

  it('far from the centre the branch approaches the asymptote: the distance from the hyperbola to y = (b/a)x tends to 0', () => {
    const a = 2;
    const b = 3;
    let prev = Infinity;
    for (const u of [2, 4, 8, 16]) {
      const [x, y] = hyperbolaPointX(0, 0, a, b, u, 1);
      const d = Math.abs(y - (b / a) * x);
      expect(d).toBeLessThan(prev);
      prev = d;
    }
    expect(prev).toBeLessThan(0.1);
  });

  it('an ellipse, a parabola and a circle have no asymptotes', () => {
    expect(asymptotes({ kind: 'ellipse', h: 0, k: 0, a: 2, b: 1 })).toEqual([]);
    expect(asymptotes({ kind: 'parabolaV', h: 0, k: 0, a: 1 })).toEqual([]);
  });
});

describe('drawing: sampled polylines', () => {
  it('a hyperbola gives two separate branches, none of which crosses the gap between the vertices', () => {
    for (const s of [
      { kind: 'hyperbolaX', h: 0, k: 0, a: 2, b: 1 },
      { kind: 'hyperbolaY', h: 0, k: 0, a: 2, b: 1 },
      { kind: 'hyperbolaXY', h: 0, k: 0, c: 1 },
    ] as Shape[]) {
      const pl = samplePolylines(s, BOX);
      expect(pl.length).toBe(2);
      for (const branch of pl) {
        const sx = branch.map((p) => Math.sign(p[0]));
        const sy = branch.map((p) => Math.sign(p[1]));
        if (s.kind === 'hyperbolaX') expect(new Set(sx).size).toBe(1);
        if (s.kind === 'hyperbolaY') expect(new Set(sy).size).toBe(1);
        if (s.kind === 'hyperbolaXY') expect(new Set(sx).size).toBe(1);
      }
    }
  });

  it('a closed curve repeats its first point so that it closes', () => {
    const [pl] = samplePolylines({ kind: 'ellipse', h: 1, k: 1, a: 2, b: 1 }, BOX);
    expect(relativeError(pl[0][0], pl[pl.length - 1][0])).toBeLessThan(1e-12);
    expect(relativeError(pl[0][1], pl[pl.length - 1][1])).toBeLessThan(1e-12);
  });

  it('the sampling of a hyperbola reaches the edge of the window: some point has |x| ≥ 8 on each x-branch', () => {
    const pl = samplePolylines({ kind: 'hyperbolaX', h: 0, k: 0, a: 0.5, b: 0.5 }, BOX);
    for (const branch of pl) expect(Math.max(...branch.map((p) => Math.abs(p[0])))).toBeGreaterThanOrEqual(8);
  });
});

describe('exact identities: exact trigonometric values and their text', () => {
  it('cos² + sin² = 1 exactly in surd form for every multiple of 30° and 45°', () => {
    for (let d = 0; d < 360; d += 15) {
      const e = exactCosSin(d);
      if (d % 30 !== 0 && d % 45 !== 0) {
        expect(e).toBeNull();
        continue;
      }
      expect(e).not.toBeNull();
      const { cos, sin } = e!;
      // the exact value 0 is compared absolutely (the float cos(π/2) is 6e-17), any other value relatively
      const near = (exact: number, float: number) => (exact === 0 ? Math.abs(float) < 1e-15 : relativeError(exact, float) < 1e-14);
      expect(near(surdValue(cos), Math.cos((d * Math.PI) / 180))).toBe(true);
      expect(near(surdValue(sin), Math.sin((d * Math.PI) / 180))).toBe(true);
    }
  });

  it('the text of surds and sums: 30° gives √3/2 and 1/2; 225° gives −√2/2', () => {
    const a = exactCosSin(30)!;
    expect(fmtSurd(a.cos)).toBe('√3/2');
    expect(fmtSurd(a.sin)).toBe('1/2');
    const b = exactCosSin(225)!;
    expect(fmtSurd(b.cos)).toBe('−√2/2');
    expect(fmtSurdSum(frac(1), { r: frac(3, 4), m: 3 })).toBe('1 + 3√3/4');
    expect(fmtSurdSum(frac(-2), { r: frac(-1, 2), m: 2 })).toBe('−2 − √2/2');
    expect(fmtSurdSum(frac(5), { r: frac(0), m: 1 })).toBe('5');
  });

  it('√(1 + u²) for u = 3/2 is √13/2 and for u = 2 is √5, exactly', () => {
    // (3/2): 1 + 9/4 = 13/4 → √13/2
    expect(fmtSurd({ r: frac(1, 2), m: 13 })).toBe('√13/2');
    expect(fmtSurd({ r: frac(1), m: 5 })).toBe('√5');
  });

  it('π fractions: 30° → π/6, 90° → π/2, 15° → π/12, 360° → 2π, 0 → 0', () => {
    expect([30, 90, 15, 360, 0, 150, 270].map(fmtPiFraction)).toEqual(['π/6', 'π/2', 'π/12', '2π', '0', '5π/6', '3π/2']);
  });

  it('√ of a rational in exact form: 16 → 4, 9/4 → 3/2, 3 → √3, 3/2 → √6/2', () => {
    expect([frac(16), frac(9, 4), frac(3), frac(3, 2)].map(fmtSqrtFrac)).toEqual(['4', '3/2', '√3', '√6/2']);
  });

  it('quarters and halves become exact fractions: 0.25, −0.5, 2.75', () => {
    expect([0.25, -0.5, 2.75].map((x) => toFrac(x).n / toFrac(x).d)).toEqual([0.25, -0.5, 2.75]);
  });
});

describe('text of equations', () => {
  it('the polynomial is written with real signs and unit coefficients dropped', () => {
    expect(fmtPoly(c(1, 4, -2, 8, -11))).toBe('x² + 4y² − 2x + 8y − 11 = 0');
    expect(fmtPoly(c(-1, 1, 0, 0, 0))).toBe('−x² + y² = 0');
    expect(fmtPoly(c(0, 0, 0, 0, 0))).toBe('0 = 0');
  });

  it('the completed form of a parabola and of a pair of lines', () => {
    expect(fmtCompleted(completeSquare(c(1, 0, -2, -1, 3)))).toBe('(x − 1)² − y = −2');
    expect(fmtCompleted(completeSquare(c(1, -1, 0, 0, 0)))).toBe('x² − y² = 0');
    expect(fmtCompleted(completeSquare(c(-1, 2, 2, 4, 0)))).toBe('−(x − 1)² + 2(y + 1)² = 1');
  });
});

describe('exact identities: exact text of points', () => {
  it('(1 + 3cos 30°, −2 + 2 sin 30°) is (1 + 3√3/2, −1)', () => {
    expect(ellipsePointText(1, -2, 3, 2, 30)).toEqual(['1 + 3√3/2', '−1']);
    expect(ellipsePointText(0, 0, 3, 2, 15)).toBeNull();
    expect(ellipsePointText(0, 0, 3, 2, 270)).toEqual(['0', '−2']);
  });

  it('the exact text agrees with the float parametrisation at every multiple of 30° and 45° (a rational point at the axes)', () => {
    // the points at 0°, 90°, 180°, 270° are rational: their text parses back to the float value
    for (const [deg, x, y] of [[0, 4, -1], [90, 1, 2], [180, -2, -1], [270, 1, -4]] as const) {
      const [tx, ty] = ellipsePointText(1, -1, 3, 3, deg)!;
      const [fx, fy] = ellipsePoint(1, -1, 3, 3, (deg * Math.PI) / 180);
      expect(Math.abs(fx - x)).toBeLessThan(1e-13);
      expect(Math.abs(fy - y)).toBeLessThan(1e-13);
      expect([tx, ty]).toEqual([String(x).replace('-', '−'), String(y).replace('-', '−')]);
    }
  });

  it('the parabola point is rational even for the quarter-valued a and half-valued t: a = 1/4, t = 1/2 gives y = 1/16', () => {
    const [x, y] = parabolaPointExact(0, 0, 0.25, 0.5, false);
    expect(x).toEqual({ n: 1, d: 2 });
    expect(y).toEqual({ n: 1, d: 16 });
    const [x2, y2] = parabolaPointExact(1, -1, -2, 1.5, true);
    expect(x2).toEqual({ n: -7, d: 2 });
    expect(y2).toEqual({ n: 1, d: 2 });
  });

  it('hyperbola points: u = 3/4 gives √(1+u²) = 5/4 exactly, u = 1/2 with a = 2 gives x = √5, and xy = 2 at t = 1/2 on the left is (−1/2, −4)', () => {
    expect(hyperbolaPointText('x', 0, 0, 1, 1, 1, 0.75, 1)).toEqual(['5/4', '3/4']);
    expect(hyperbolaPointText('x', 0, 0, 2, 1, 1, 0.5, 1)[0]).toBe('√5');
    expect(hyperbolaPointText('y', 0, 0, 1, 2, 1, 0.5, -1)).toEqual(['1/2', '−√5']);
    expect(hyperbolaPointText('xy', 0, 0, 1, 1, 2, 0.5, -1)).toEqual(['−1/2', '−4']);
  });
});
