/**
 * src/math/space.ts and src/sims/core/axo.ts, filed by accuracy category. Each test is named after the claim it
 * checks. Integer inputs come from a fixed linear congruential generator (no Math.random: a failure must repeat).
 * Integer identities are compared with toBe (exact); real-valued ones by relativeError, except against an exact 0,
 * where an absolute bound is stated with its reason.
 */

import { describe, expect, it } from 'vitest';
import {
  angleBetweenPlanes,
  angleLinePlane,
  coplanar,
  det2,
  det3,
  distancePointLine,
  fmtAffine,
  fmtFrac,
  fmtPlaneEquation,
  fmtQuotSqrt,
  fmtSqrt,
  footOnPlane,
  footOnPlaneExact,
  frac,
  fracToNumber,
  intersectLinePlane,
  intersectLinePlaneExact,
  lineAt,
  minorsFirstRow,
  onAxis,
  onPlane,
  orientation,
  parallelepipedVolume,
  parallelogramArea,
  parallel3,
  planeDistance,
  planeDistanceSigned,
  planeFromPointNormal,
  planeResidual,
  planeThroughPoints,
  sqrtParts,
  tripleProduct,
  type Vec3,
} from '~/math/space';
import { camera, clipLineToBall, makeProjector, orthoBasis, project } from '~/sims/core/axo';
import { add3, cross3, dot3, len3, relativeError, scale3, sub3 } from '~/math/vec';

/** deterministic integers in [-4, 4] */
function* ints(seed: number) {
  let s = seed;
  while (true) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    yield (Math.floor(s / 65536) % 9) - 4;
  }
}
function vectors(count: number, seed: number): Vec3[] {
  const g = ints(seed);
  return Array.from({ length: count }, () => [g.next().value!, g.next().value!, g.next().value!] as Vec3);
}
const V = vectors(60, 7);

describe('exact identities: determinants and the triple product (integers, exact)', () => {
  it('det3 with rows a, b, c equals the triple product a·(b×c) on integer triples', () => {
    for (let i = 0; i + 2 < V.length; i++) expect(det3(V[i], V[i + 1], V[i + 2])).toBe(tripleProduct(V[i], V[i + 1], V[i + 2]));
  });
  it('det3 of a worked table is the first-row expansion 1·(2·1 − 0·3) − 2·(5·1 − 0·0) + 0·(...)', () => {
    // rows (1,2,0), (5,2,0), (0,3,1): 1·(2·1−0·3) − 2·(5·1−0·0) + 0 = 2 − 10 = −8
    expect(minorsFirstRow([5, 2, 0], [0, 3, 1])).toEqual([2, 5, 15]);
    expect(det3([1, 2, 0], [5, 2, 0], [0, 3, 1])).toBe(-8);
  });
  it('the signs of the first-row expansion are +, −, +: rows (1,2,3), (0,1,4), (2,−1,1) give 1·5 − 2·(−8) + 3·(−2) = 15', () => {
    // every first-row entry is nonzero, so each of the three signs matters (a missing middle minus gives −17);
    // the value is computed by hand, independently of cross3
    expect(minorsFirstRow([0, 1, 4], [2, -1, 1])).toEqual([5, -8, -2]);
    expect(det3([1, 2, 3], [0, 1, 4], [2, -1, 1])).toBe(15);
    // rows and columns give the same number (the transposed table)
    expect(det3([1, 0, 2], [2, 1, -1], [3, 4, 1])).toBe(15);
  });
  it('det3 of the identity rows is 1 and of a triple with a repeated row is 0', () => {
    expect(det3([1, 0, 0], [0, 1, 0], [0, 0, 1])).toBe(1);
    expect(det3([1, 2, 3], [1, 2, 3], [4, 5, 6])).toBe(0);
  });
  it('det2 is ad − bc', () => {
    expect(det2(3, 4, 5, 6)).toBe(-2);
  });
  it('the triple product is cyclic: a·(b×c) = b·(c×a) = c·(a×b)', () => {
    for (let i = 0; i + 2 < V.length; i++) {
      const [a, b, c] = [V[i], V[i + 1], V[i + 2]];
      expect(tripleProduct(b, c, a)).toBe(tripleProduct(a, b, c));
      expect(tripleProduct(c, a, b)).toBe(tripleProduct(a, b, c));
    }
  });
  it('swapping two vectors flips the sign of the triple product and of det3', () => {
    for (let i = 0; i + 2 < V.length; i++) {
      const [a, b, c] = [V[i], V[i + 1], V[i + 2]];
      expect(tripleProduct(b, a, c) + tripleProduct(a, b, c)).toBe(0);
      expect(det3(a, c, b) + det3(a, b, c)).toBe(0);
    }
  });
  it('a·(b×c) = (a×b)·c (the dot and the cross may be exchanged)', () => {
    for (let i = 0; i + 2 < V.length; i++) expect(dot3(cross3(V[i], V[i + 1]), V[i + 2])).toBe(tripleProduct(V[i], V[i + 1], V[i + 2]));
  });
  it('the triple product is linear in the first vector: (a + a′)·(b×c) = a·(b×c) + a′·(b×c)', () => {
    const [a, a2, b, c] = [V[3], V[4], V[5], V[6]];
    expect(tripleProduct(add3(a, a2), b, c)).toBe(tripleProduct(a, b, c) + tripleProduct(a2, b, c));
  });
  it('the unit-cube vectors i, j, k have volume 1 and a right-handed orientation', () => {
    expect(parallelepipedVolume([1, 0, 0], [0, 1, 0], [0, 0, 1])).toBe(1);
    expect(orientation([1, 0, 0], [0, 1, 0], [0, 0, 1])).toBe(1);
    expect(orientation([0, 1, 0], [1, 0, 0], [0, 0, 1])).toBe(-1);
  });
  it('the volume of a box with edges 2, 3, 6 along the axes is 36', () => {
    expect(parallelepipedVolume([2, 0, 0], [0, 3, 0], [0, 0, 6])).toBe(36);
  });
  it('the volume is |a·(b×c)| = base area times height: |a×b|·h with h = |c·(a×b)|/|a×b|', () => {
    const [a, b, c] = [[2, 0, 1], [1, 2, 0], [0, 1, 2]] as Vec3[];
    const n = cross3(a, b);
    const h = Math.abs(dot3(c, n)) / len3(n);
    expect(relativeError(parallelogramArea(a, b) * h, parallelepipedVolume(a, b, c))).toBeLessThan(1e-14);
  });
});

describe('exact identities: the cross product', () => {
  it('a×b is perpendicular to a and to b (dot products exactly 0 on integers)', () => {
    for (let i = 0; i + 1 < V.length; i++) {
      const p = cross3(V[i], V[i + 1]);
      expect(dot3(p, V[i])).toBe(0);
      expect(dot3(p, V[i + 1])).toBe(0);
    }
  });
  it('a×b = −(b×a) (antisymmetry)', () => {
    for (let i = 0; i + 1 < V.length; i++) {
      const p = cross3(V[i], V[i + 1]);
      const q = cross3(V[i + 1], V[i]);
      expect(p.map((x, k) => x + q[k]).every((x) => x === 0)).toBe(true);
    }
  });
  it("Lagrange's identity |a×b|² = |a|²|b|² − (a·b)² on integers, exactly", () => {
    for (let i = 0; i + 1 < V.length; i++) {
      const [a, b] = [V[i], V[i + 1]];
      const p = cross3(a, b);
      expect(dot3(p, p)).toBe(dot3(a, a) * dot3(b, b) - dot3(a, b) ** 2);
    }
  });
  it('the area of the parallelogram on (3,0,0) and (1,2,0) is 6', () => {
    expect(parallelogramArea([3, 0, 0], [1, 2, 0])).toBe(6);
  });
  it('the sample product (2,1,0)×(0,2,1) is (1, −2, 4), area √21', () => {
    expect(cross3([2, 1, 0], [0, 2, 1])).toEqual([1, -2, 4]);
    expect(relativeError(parallelogramArea([2, 1, 0], [0, 2, 1]), Math.sqrt(21))).toBeLessThan(1e-15);
  });
});

describe('degenerate cases: parallel vectors and coplanar triples', () => {
  it('parallel vectors have the zero vector as their cross product', () => {
    expect(cross3([1, 2, 3], [2, 4, 6])).toEqual([0, 0, 0]);
    expect(cross3([1, 2, 3], [-1, -2, -3])).toEqual([0, 0, 0]);
    expect(parallel3([1, 2, 3], [-3, -6, -9])).toBe(true);
    expect(parallel3([1, 2, 3], [1, 2, 4])).toBe(false);
  });
  it('three coplanar vectors have triple product 0, volume 0 and orientation 0', () => {
    const [a, b] = [[1, 0, 2], [0, 1, -1]] as Vec3[];
    const c = add3(scale3(a, 2), scale3(b, -3)); // in the plane of a and b
    expect(tripleProduct(a, b, c)).toBe(0);
    expect(det3(a, b, c)).toBe(0);
    expect(coplanar(a, b, c)).toBe(true);
    expect(parallelepipedVolume(a, b, c)).toBe(0);
    expect(orientation(a, b, c)).toBe(0);
  });
  it('a non-coplanar triple is not coplanar', () => {
    expect(coplanar([1, 0, 0], [0, 1, 0], [0, 0, 1])).toBe(false);
  });
  it('a vector on an axis is detected, and the zero vector is not on an axis', () => {
    expect(onAxis([0, -3, 0])).toBe(true);
    expect(onAxis([1, 1, 0])).toBe(false);
    expect(onAxis([0, 0, 0])).toBe(false);
  });
});

describe('exact identities: planes (integers, exact)', () => {
  it('the plane through P₀ with normal n satisfies n·P₀ = d: (2,1,−3) and (1,−3,5) give x − 3y + 5z = −16', () => {
    const pl = planeFromPointNormal([2, 1, -3], [1, -3, 5]);
    expect(pl.d).toBe(-16);
    expect(fmtPlaneEquation(pl)).toBe('x − 3y + 5z = −16');
    expect(planeResidual(pl, [2, 1, -3])).toBe(0);
  });
  it('every point P₀ + s·u + t·w with u, w perpendicular to n lies on the plane (residual exactly 0)', () => {
    const n: Vec3 = [1, 2, 2];
    const p0: Vec3 = [1, 1, 1];
    const pl = planeFromPointNormal(p0, n);
    const u: Vec3 = [2, -1, 0];
    const w: Vec3 = [0, 1, -1];
    expect(dot3(n, u)).toBe(0);
    expect(dot3(n, w)).toBe(0);
    for (const s of [-3, 0, 2, 5]) for (const t of [-2, 1, 4]) expect(onPlane(pl, add3(p0, add3(scale3(u, s), scale3(w, t))))).toBe(true);
  });
  it('the plane through three points contains all three and has normal (Q−P)×(R−P)', () => {
    const [P, Q, R] = [[1, 0, 0], [0, 2, 0], [0, 0, 3]] as Vec3[];
    const pl = planeThroughPoints(P, Q, R);
    expect([pl.a, pl.b, pl.c]).toEqual(cross3(sub3(Q, P), sub3(R, P)));
    for (const X of [P, Q, R]) expect(planeResidual(pl, X)).toBe(0);
    // intercepts 1, 2, 3: 6x + 3y + 2z = 6
    expect(fmtPlaneEquation(pl)).toBe('6x + 3y + 2z = 6');
  });
  it('three collinear points give the zero normal (no plane)', () => {
    const pl = planeThroughPoints([0, 0, 0], [1, 1, 1], [2, 2, 2]);
    expect([pl.a, pl.b, pl.c]).toEqual([0, 0, 0]);
    expect(planeDistanceSigned(pl, [1, 2, 3])).toBeNaN();
  });
  it('the equation text writes signs, unit coefficients and zero terms properly', () => {
    expect(fmtPlaneEquation({ a: -1, b: 0, c: 1, d: 0 })).toBe('−x + z = 0');
    expect(fmtPlaneEquation({ a: 0, b: 0, c: 1, d: -3 })).toBe('z = −3');
    expect(fmtPlaneEquation({ a: 0, b: 0, c: 0, d: 4 })).toBe('0 = 4');
  });
});

describe('analytic limits: the distance from a point to a plane', () => {
  const pl = planeFromPointNormal([0, 0, 0], [1, 2, 2]); // x + 2y + 2z = 0, |n| = 3
  it('the distance from (5,−2,3) to the plane z = 0 is exactly 3', () => {
    expect(planeDistance(planeFromPointNormal([0, 0, 0], [0, 0, 1]), [5, -2, 3])).toBe(3);
  });
  it('the distance from (3,2,2) to x + 2y + 2z = 5 is |11 − 5|/3 = 2', () => {
    const p = planeFromPointNormal([1, 1, 1], [1, 2, 2]);
    expect(relativeError(planeDistance(p, [3, 2, 2]), 2)).toBeLessThan(1e-15);
  });
  it('the formula |ax₀+by₀+cz₀−d|/|n| equals the length of the foot-of-perpendicular construction', () => {
    for (const X of V.slice(0, 40)) {
      const foot = footOnPlane(pl, X);
      expect(relativeError(planeDistance(pl, X), len3(sub3(X, foot)))).toBeLessThan(1e-12);
    }
  });
  it('the foot of the perpendicular lies on the plane: its residual is 0 up to rounding (absolute bound 1e-13: the residual is a sum of terms of size ≤ 10 cancelling to 0)', () => {
    for (const X of V.slice(0, 40)) expect(Math.abs(planeResidual(pl, footOnPlane(pl, X)))).toBeLessThan(1e-13);
  });
  it('X − foot is parallel to n: its cross product with n vanishes up to rounding (absolute bound 1e-13, same reason)', () => {
    const X: Vec3 = [3, -1, 4];
    const w = sub3(X, footOnPlane(pl, X));
    for (const k of cross3(w, [1, 2, 2])) expect(Math.abs(k)).toBeLessThan(1e-13);
  });
  it('the signed distance is positive on the side n points to and negative on the other', () => {
    expect(planeDistanceSigned(pl, [1, 2, 2])).toBeGreaterThan(0);
    expect(planeDistanceSigned(pl, [-1, -2, -2])).toBeLessThan(0);
    expect(relativeError(planeDistanceSigned(pl, [1, 2, 2]), -planeDistanceSigned(pl, [-1, -2, -2]))).toBeLessThan(1e-15);
  });
  it('the exact foot from (3,2,2) to x + 2y + 2z = 5 is (3,2,2) − (6/9)(1,2,2) = (7/3, 2/3, 2/3)', () => {
    const p = planeFromPointNormal([1, 1, 1], [1, 2, 2]);
    const f = footOnPlaneExact(p, [3, 2, 2]);
    expect(f.map(fmtFrac)).toEqual(['7/3', '2/3', '2/3']);
    expect(relativeError(fracToNumber(f[0]), footOnPlane(p, [3, 2, 2])[0])).toBeLessThan(1e-15);
  });
  it('the exact form of the distance from the origin to 3x + 5y + z = 40 style planes: 40/√35', () => {
    expect(fmtQuotSqrt(40, 35)).toBe('40/√35');
    expect(fmtQuotSqrt(6, 9)).toBe('2');
    expect(fmtQuotSqrt(2, 18)).toBe('2/(3√2)');
    expect(fmtQuotSqrt(0, 5)).toBe('0');
  });
  it('the angle between planes with normals (0,0,1) and (1,0,1) is 45°, and the line (1,0,0) makes angle 0 with z = 0', () => {
    expect(relativeError(angleBetweenPlanes({ a: 0, b: 0, c: 1, d: 0 }, { a: 1, b: 0, c: 1, d: 0 }), Math.PI / 4)).toBeLessThan(1e-15);
    expect(angleLinePlane([1, 0, 0], { a: 0, b: 0, c: 1, d: 0 })).toBe(0);
    expect(relativeError(angleLinePlane([0, 0, 3], { a: 0, b: 0, c: 1, d: 0 }), Math.PI / 2)).toBeLessThan(1e-15);
  });
  it('the distance from a point to a line: from (0,3,4) and from (7,3,4) to the x-axis is 5, whatever the length of the direction vector', () => {
    expect(distancePointLine([0, 3, 4], [0, 0, 0], [1, 0, 0])).toBe(5);
    expect(distancePointLine([7, 3, 4], [0, 0, 0], [2, 0, 0])).toBe(5);
  });
});

describe('exact identities: line and plane', () => {
  const pl = planeFromPointNormal([1, 1, 1], [1, 2, 2]); // x + 2y + 2z = 5
  it('the line A = (−1,0,2), v = (1,1,−1) meets x + 2y + 2z = 5 at t = 2, point (1,2,0)', () => {
    const r = intersectLinePlaneExact([-1, 0, 2], [1, 1, -1], pl);
    expect(r.kind).toBe('point');
    if (r.kind !== 'point') return;
    expect(fmtFrac(r.t)).toBe('2');
    expect(r.point.map(fmtFrac)).toEqual(['1', '2', '0']);
  });
  it('the intersection point satisfies both the line (A + t·v) and the plane (residual 0), for integer inputs, exactly in rationals', () => {
    let hits = 0;
    for (let i = 0; i + 2 < V.length; i += 3) {
      const [A, v, n] = [V[i], V[i + 1], V[i + 2]];
      const p = planeFromPointNormal(V[(i + 5) % V.length], n);
      const r = intersectLinePlaneExact(A, v, p);
      if (r.kind !== 'point') continue;
      hits++;
      // X = A + t·v in rationals: X_k·t.d = A_k·t.d + t.n·v_k  ->  compare cross-multiplied integers
      for (let k = 0; k < 3; k++) {
        expect(r.point[k].n * r.t.d).toBe((A[k] * r.t.d + r.t.n * v[k]) * r.point[k].d);
      }
      const res = p.a * fracToNumber(r.point[0]) + p.b * fracToNumber(r.point[1]) + p.c * fracToNumber(r.point[2]) - p.d;
      expect(Math.abs(res)).toBeLessThan(1e-12); // sum of terms of size ≤ 40 cancelling to 0
      // and the float version agrees
      const f = intersectLinePlane(A, v, p);
      expect(f.kind).toBe('point');
      if (f.kind === 'point') expect(relativeError(f.t, fracToNumber(r.t))).toBeLessThan(1e-14);
    }
    expect(hits).toBeGreaterThan(3);
  });
  it('a non-integer t is exact: from A = (0,0,0), v = (1,0,0) meets x + 2y + 2z = 5 at t = 5 and v = (1,1,0) at t = 5/3, point (5/3, 5/3, 0)', () => {
    const r = intersectLinePlaneExact([0, 0, 0], [1, 0, 0], pl);
    expect(r.kind).toBe('point');
    if (r.kind === 'point') expect(fmtFrac(r.t)).toBe('5');
    const s = intersectLinePlaneExact([0, 0, 0], [1, 1, 0], pl);
    expect(s.kind).toBe('point');
    if (s.kind === 'point') {
      expect(fmtFrac(s.t)).toBe('5/3');
      expect(s.point.map(fmtFrac)).toEqual(['5/3', '5/3', '0']);
    }
  });
  it('the parameter is t = (d − n·A)/(n·v), with this sign: from A = (3,2,2) (n·A = 11 > d = 5) along v = n the line goes back, t = −6/9 = −2/3', () => {
    const r = intersectLinePlaneExact([3, 2, 2], [1, 2, 2], pl);
    expect(r.kind).toBe('point');
    if (r.kind === 'point') {
      expect(fmtFrac(r.t)).toBe('−2/3');
      expect(r.point.map(fmtFrac)).toEqual(['7/3', '2/3', '2/3']); // the foot of the perpendicular
    }
    const f = intersectLinePlane([3, 2, 2], [1, 2, 2], pl);
    expect(f.kind).toBe('point');
    if (f.kind === 'point') expect(relativeError(f.t, -2 / 3)).toBeLessThan(1e-15);
  });
  it('a direction with v·n = 0 and A off the plane is parallel; with A on the plane it is contained', () => {
    // v = (2,−1,0) is perpendicular to n = (1,2,2)
    expect(intersectLinePlaneExact([0, 0, 0], [2, -1, 0], pl).kind).toBe('parallel');
    expect(intersectLinePlane([0, 0, 0], [2, -1, 0], pl).kind).toBe('parallel');
    expect(intersectLinePlaneExact([1, 1, 1], [2, -1, 0], pl).kind).toBe('contained');
    expect(intersectLinePlane([1, 1, 1], [2, -1, 0], pl).kind).toBe('contained');
  });
  it('lineAt returns A at t = 0 and A + v at t = 1', () => {
    expect(lineAt([1, 2, 3], [4, 5, 6], 0)).toEqual([1, 2, 3]);
    expect(lineAt([1, 2, 3], [4, 5, 6], 1)).toEqual([5, 7, 9]);
  });
  it('fractions are kept in lowest terms with a positive denominator, and 0 has no sign', () => {
    expect(frac(6, -4)).toEqual({ n: -3, d: 2 });
    expect(Object.is(frac(0, -3).n, 0)).toBe(true);
    expect(() => frac(1, 0)).toThrow();
  });
});

describe('exact identities: text forms', () => {
  it('√n in exact form: √12 = 2√3, √36 = 6, √35 = √35, √1 = 1', () => {
    expect(sqrtParts(12)).toEqual({ k: 2, m: 3 });
    expect([12, 36, 35, 1, 0].map(fmtSqrt)).toEqual(['2√3', '6', '√35', '1', '0']);
  });
  it('affine parameter forms write signs and unit coefficients properly', () => {
    expect([fmtAffine(1, 2), fmtAffine(0, -1), fmtAffine(3, 0), fmtAffine(-2, -1), fmtAffine(0, 0), fmtAffine(4, 1)]).toEqual(['1 + 2t', '−t', '3', '−2 − t', '0', '4 + t']);
  });
});

describe('exact identities: the axonometric projection', () => {
  const views: [number, number][] = [[0, 0], [125, 22], [-40, 60], [300, 85]];
  it('the camera triple (right, up, toward) is orthonormal and right-handed: right × up = toward', () => {
    for (const [az, el] of views) {
      const c = camera(az, el);
      expect(relativeError(len3(c.right), 1)).toBeLessThan(1e-14);
      expect(relativeError(len3(c.up), 1)).toBeLessThan(1e-14);
      expect(Math.abs(dot3(c.right, c.up))).toBeLessThan(1e-15); // ⟂ up to rounding of cos·sin
      expect(Math.abs(dot3(c.right, c.toward))).toBeLessThan(1e-15);
      expect(Math.abs(dot3(c.up, c.toward))).toBeLessThan(1e-15);
      const r = cross3(c.right, c.up);
      for (let k = 0; k < 3; k++) expect(Math.abs(r[k] - c.toward[k])).toBeLessThan(1e-15);
    }
  });
  it('at az = 0, el = 0 the x-axis points right, z up and y away from the viewer', () => {
    const c = camera(0, 0);
    expect(project(c, [1, 0, 0]).x).toBe(1);
    expect(project(c, [0, 0, 1]).y).toBe(1);
    expect(project(c, [0, 1, 0]).depth).toBeCloseTo(-1, 15);
  });
  it('z always projects upward on screen for 0 ≤ el < 90', () => {
    for (const [az, el] of views) expect(project(camera(az, el), [0, 0, 1]).y).toBeGreaterThan(0);
  });
  it('projection is linear: P(a + b) = P(a) + P(b), and the origin projects to the frame centre', () => {
    const c = camera(125, 22);
    const P = makeProjector(c, { cx: 100, cy: 80, scale: 10 });
    expect(P([0, 0, 0])).toEqual([100, 80, 0]);
    const [a, b] = [[1, 2, 3], [-2, 0, 4]] as Vec3[];
    const pa = project(c, a);
    const pb = project(c, b);
    const pab = project(c, add3(a, b));
    expect(Math.abs(pab.x - pa.x - pb.x)).toBeLessThan(1e-14);
    expect(Math.abs(pab.depth - pa.depth - pb.depth)).toBeLessThan(1e-14);
  });
  it('orthoBasis gives unit vectors perpendicular to n with e1 × e2 = n/|n|', () => {
    for (const n of [[1, 2, 2], [0, 0, 1], [0, -3, 0], [-1, 1, -4]] as Vec3[]) {
      const [e1, e2] = orthoBasis(n);
      expect(Math.abs(dot3(e1, n))).toBeLessThan(1e-14);
      expect(Math.abs(dot3(e2, n))).toBeLessThan(1e-14);
      expect(relativeError(len3(e1), 1)).toBeLessThan(1e-14);
      const k = cross3(e1, e2);
      for (let i = 0; i < 3; i++) expect(Math.abs(k[i] - n[i] / len3(n))).toBeLessThan(1e-14);
    }
  });
  it('clipLineToBall returns parameters at which the line is at distance R from the origin', () => {
    const iv = clipLineToBall([1, 2, 0], [1, 1, 1], 5)!;
    for (const t of iv) expect(relativeError(len3(lineAt([1, 2, 0], [1, 1, 1], t)), 5)).toBeLessThan(1e-14);
    expect(clipLineToBall([10, 0, 0], [0, 1, 0], 5)).toBeNull();
  });
});
