/**
 * src/math/coords.ts, filed by accuracy category: exact identities, round trips, angle convention, the arctan trap,
 * curves against their Cartesian equations, regions, coordinate surfaces, solids. Each test is named after the claim it
 * proves. Quantities are compared by relativeError; where the exact value is 0 (a coordinate on an axis) the bound is
 * absolute, 1e-12 times the length of the point, because a relative error against 0 is undefined and rounding of a
 * product with cos or sin is of order 1e-16 of the length.
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/vec';
import {
  CURVE_KEYS,
  POLAR_CURVES,
  SOLIDS,
  angleInRange,
  arctanNaive,
  cartesianResidual,
  curvePoint,
  cylSurfaceR,
  cylSurfaceTheta,
  cylSurfaceZ,
  cylindricalRadiusOf,
  degrees360,
  fromCylindrical,
  fromNotesSpherical,
  fromPolar,
  fromSpherical,
  inRegion,
  inSolid,
  isAngleDefinedCyl,
  isAngleDefinedSph,
  latitudeOf,
  niceAngle,
  notesToCourse,
  polarAngleByQuadrant,
  quadrantOf,
  regionKind,
  sphSurfaceR,
  sphSurfaceTheta,
  toCylindrical,
  toNotesSpherical,
  toPolar,
  toSpherical,
  wrap2pi,
  type Vec2,
  type Vec3,
} from '~/math/coords';

const TOL = 1e-12;
/** equal up to rounding: relative, or absolute against the point's length scale when the exact value is 0 */
function same(a: number, b: number, scale = 1) {
  if (a === 0 || b === 0) expect(Math.abs(a - b)).toBeLessThan(TOL * scale);
  else expect(relativeError(a, b)).toBeLessThan(TOL);
}
const sameVec = (a: readonly number[], b: readonly number[]) => {
  const s = Math.max(1, ...b.map(Math.abs));
  a.forEach((v, i) => same(v, b[i], s));
};

/** a deterministic pseudo-random stream in [0, 1) (LCG), so a failure repeats */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('plane polar: exact identities', () => {
  it('fromPolar gives x = r cos θ, y = r sin θ at the special angles', () => {
    sameVec(fromPolar(2, 0), [2, 0]);
    sameVec(fromPolar(2, Math.PI / 2), [0, 2]);
    sameVec(fromPolar(2, Math.PI), [-2, 0]);
    sameVec(fromPolar(2, (3 * Math.PI) / 2), [0, -2]);
    sameVec(fromPolar(4, (2 * Math.PI) / 3), [-2, 2 * Math.sqrt(3)]);
  });

  it('the notes\' point (1, 1) is r = √2 at θ = π/4', () => {
    const p = toPolar([1, 1]);
    same(p.r, Math.SQRT2);
    same(p.theta, Math.PI / 4);
  });

  it('(r, θ) and (r, θ + 2πk) are the same point', () => {
    for (const k of [-3, -1, 1, 2, 5]) sameVec(fromPolar(1.7, 0.9 + 2 * Math.PI * k), fromPolar(1.7, 0.9));
  });

  it('x² + y² = r² for every angle', () => {
    const rnd = lcg(7);
    for (let i = 0; i < 200; i++) {
      const r = 3 * rnd();
      const [x, y] = fromPolar(r, 20 * (rnd() - 0.5));
      same(x * x + y * y, r * r);
    }
  });
});

describe('plane polar: round trips in every quadrant and on the axes', () => {
  it('toPolar(fromPolar(r, θ)) returns (r, θ) for θ in [0, 2π), 400 seeded points', () => {
    const rnd = lcg(11);
    for (let i = 0; i < 400; i++) {
      const r = 0.1 + 3 * rnd();
      const th = 2 * Math.PI * rnd();
      const p = toPolar(fromPolar(r, th));
      same(p.r, r);
      // an angle within rounding of 2π may come back as 0: compare on the circle
      const d = Math.abs(wrap2pi(p.theta - th + Math.PI) - Math.PI);
      expect(d).toBeLessThan(1e-12);
    }
  });

  it('fromPolar(toPolar(p)) returns p, one point in each quadrant and on each axis', () => {
    const pts: Vec2[] = [[1, 2], [-3, 2], [-1, -4], [2, -0.5], [5, 0], [0, 5], [-5, 0], [0, -5]];
    for (const p of pts) sameVec(fromPolar(...(Object.values(toPolar(p)) as [number, number])), p);
  });

  it('θ lands in [0, 2π) with the default range and in (−π, π] with pm-pi', () => {
    const rnd = lcg(3);
    for (let i = 0; i < 200; i++) {
      const p: Vec2 = [rnd() - 0.5, rnd() - 0.5];
      const a = toPolar(p).theta;
      const b = toPolar(p, 'pm-pi').theta;
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(2 * Math.PI);
      expect(b).toBeGreaterThan(-Math.PI);
      expect(b).toBeLessThanOrEqual(Math.PI);
    }
  });

  it('the quarter-turn points have θ = 0, π/2, π, 3π/2', () => {
    same(toPolar([3, 0]).theta + 1, 1); // 0 + 1 against 1: relative form of an exact 0
    same(toPolar([0, 3]).theta, Math.PI / 2);
    same(toPolar([-3, 0]).theta, Math.PI);
    same(toPolar([0, -3]).theta, (3 * Math.PI) / 2);
  });
});

describe('the arctan trap: arctan(y/x) is the polar angle only in quadrants I and IV', () => {
  it('(1, 1) and (−1, −1) have the same y/x and the same arctan, π/4, but θ = π/4 and 5π/4', () => {
    same(arctanNaive(1, 1), Math.PI / 4);
    same(arctanNaive(-1, -1), Math.PI / 4);
    same(toPolar([-1, -1]).theta, (5 * Math.PI) / 4);
  });

  it('in quadrant II arctan(y/x) is negative while θ is in (π/2, π): (−1, 1) gives −π/4 against 3π/4', () => {
    same(arctanNaive(-1, 1), -Math.PI / 4);
    same(toPolar([-1, 1]).theta, (3 * Math.PI) / 4);
  });

  it('arctan(y/x) differs from θ by exactly π in quadrants II and III and agrees in I (mod 2π in IV)', () => {
    const rnd = lcg(5);
    for (let i = 0; i < 300; i++) {
      const x = 4 * (rnd() - 0.5);
      const y = 4 * (rnd() - 0.5);
      if (Math.abs(x) < 1e-3 || Math.abs(y) < 1e-3) continue;
      const th = toPolar([x, y]).theta;
      const a = arctanNaive(x, y);
      const q = quadrantOf(x, y);
      if (q.kind !== 'quadrant') continue;
      if (q.n === 1) same(th, a);
      if (q.n === 2 || q.n === 3) same(th, a + Math.PI);
      if (q.n === 4) same(th, a + 2 * Math.PI);
    }
  });

  it('the quadrant recipe (add π when x < 0) equals atan2 on 400 seeded points', () => {
    const rnd = lcg(13);
    for (let i = 0; i < 400; i++) {
      const x = 6 * (rnd() - 0.5);
      const y = 6 * (rnd() - 0.5);
      same(polarAngleByQuadrant(x, y), toPolar([x, y]).theta);
    }
    // the axes, where x = 0 and arctan(y/x) does not exist
    same(polarAngleByQuadrant(0, 2), Math.PI / 2);
    same(polarAngleByQuadrant(0, -2), (3 * Math.PI) / 2);
    expect(Number.isNaN(arctanNaive(0, 2))).toBe(true);
  });

  it('the quadrant of a point follows the signs, and the axes belong to no quadrant', () => {
    expect(quadrantOf(1, 1)).toEqual({ kind: 'quadrant', n: 1 });
    expect(quadrantOf(-1, 1)).toEqual({ kind: 'quadrant', n: 2 });
    expect(quadrantOf(-1, -1)).toEqual({ kind: 'quadrant', n: 3 });
    expect(quadrantOf(1, -1)).toEqual({ kind: 'quadrant', n: 4 });
    expect(quadrantOf(0, -2)).toEqual({ kind: 'axis', axis: '-y' });
    expect(quadrantOf(3, 0)).toEqual({ kind: 'axis', axis: '+x' });
    expect(quadrantOf(0, 0)).toEqual({ kind: 'origin' });
  });
});

describe('cylindrical: x = r cos θ, y = r sin θ, z = z', () => {
  it('fromCylindrical(2, π/3, −1) = (1, √3, −1)', () => {
    sameVec(fromCylindrical(2, Math.PI / 3, -1), [1, Math.sqrt(3), -1]);
  });

  it('round trip Cartesian → cylindrical → Cartesian, 400 seeded points over all octants', () => {
    const rnd = lcg(17);
    for (let i = 0; i < 400; i++) {
      const p: Vec3 = [6 * (rnd() - 0.5), 6 * (rnd() - 0.5), 6 * (rnd() - 0.5)];
      const c = toCylindrical(p);
      expect(c.r).toBeGreaterThanOrEqual(0);
      expect(c.theta).toBeGreaterThanOrEqual(0);
      expect(c.theta).toBeLessThan(2 * Math.PI);
      sameVec(fromCylindrical(c.r, c.theta, c.z), p);
    }
  });

  it('the cylindrical r is the distance from the z-axis, not from the origin', () => {
    same(toCylindrical([3, 4, 12]).r, 5);
  });

  it('on the z-axis the cylindrical θ is flagged undefined', () => {
    expect(isAngleDefinedCyl([0, 0, 3])).toBe(false);
    expect(isAngleDefinedCyl([1, 0, 3])).toBe(true);
  });
});

describe('spherical: the course convention, θ from the positive z-axis, φ the azimuth', () => {
  it('the special points: +z has θ = 0, −z has θ = π, +x has θ = π/2 and φ = 0, +y has φ = π/2', () => {
    same(toSpherical([0, 0, 2]).theta + 1, 1);
    same(toSpherical([0, 0, -2]).theta, Math.PI);
    const x = toSpherical([2, 0, 0]);
    same(x.theta, Math.PI / 2);
    same(x.phi + 1, 1);
    const y = toSpherical([0, 2, 0]);
    same(y.theta, Math.PI / 2);
    same(y.phi, Math.PI / 2);
  });

  it('fromSpherical(4, π/3, π/4) = (√2·√3, √2·√3, 2): z = r cos θ, not r sin θ', () => {
    const p = fromSpherical(4, Math.PI / 3, Math.PI / 4);
    same(p[2], 2);
    same(p[0], 4 * (Math.sqrt(3) / 2) * (Math.SQRT2 / 2));
    same(p[1], p[0]);
  });

  it('the equator θ = π/2 is the xy-plane: z = 0', () => {
    for (const phi of [0, 1, 2, 4, 6]) same(fromSpherical(3, Math.PI / 2, phi)[2] + 1, 1);
  });

  it('round trip Cartesian → spherical → Cartesian, 600 seeded points over all octants', () => {
    const rnd = lcg(19);
    for (let i = 0; i < 600; i++) {
      const p: Vec3 = [6 * (rnd() - 0.5), 6 * (rnd() - 0.5), 6 * (rnd() - 0.5)];
      const s = toSpherical(p);
      expect(s.theta).toBeGreaterThanOrEqual(0);
      expect(s.theta).toBeLessThanOrEqual(Math.PI);
      expect(s.phi).toBeGreaterThanOrEqual(0);
      expect(s.phi).toBeLessThan(2 * Math.PI);
      sameVec(fromSpherical(s.r, s.theta, s.phi), p);
    }
  });

  it('round trip spherical → Cartesian → spherical for 0 < θ < π', () => {
    const rnd = lcg(23);
    for (let i = 0; i < 400; i++) {
      const r = 0.2 + 3 * rnd();
      const th = 0.05 + (Math.PI - 0.1) * rnd();
      const ph = 2 * Math.PI * rnd();
      const s = toSpherical(fromSpherical(r, th, ph));
      same(s.r, r);
      same(s.theta, th);
      expect(Math.abs(wrap2pi(s.phi - ph + Math.PI) - Math.PI)).toBeLessThan(1e-12);
    }
  });

  it('r² = x² + y² + z² and the cylindrical r is r sin θ', () => {
    const rnd = lcg(29);
    for (let i = 0; i < 200; i++) {
      const r = 3 * rnd();
      const th = Math.PI * rnd();
      const p = fromSpherical(r, th, 6 * rnd());
      same(p[0] ** 2 + p[1] ** 2 + p[2] ** 2, r * r);
      same(toCylindrical(p).r, cylindricalRadiusOf(r, th));
    }
  });

  it('the cylindrical θ is the spherical φ of the same point', () => {
    const p: Vec3 = [-1, -2, 3];
    same(toCylindrical(p).theta, toSpherical(p).phi);
  });

  it('r = 2, θ = 30° has cylindrical r = 1 (r sin θ): the two r are different numbers', () => {
    same(cylindricalRadiusOf(2, Math.PI / 6), 1);
    same(toCylindrical(fromSpherical(2, Math.PI / 6, 1.1)).r, 1);
  });

  it('the angles are flagged undefined on the z-axis', () => {
    expect(isAngleDefinedSph([0, 0, -1])).toBe(false);
    expect(isAngleDefinedSph([0, 1e-3, -1])).toBe(true);
    expect(toSpherical([0, 0, 0])).toEqual({ r: 0, theta: 0, phi: 0 });
  });
});

describe('the lecture notes\' convention: φ a latitude from the xy-plane, z = ρ sin φ', () => {
  it('the latitude of the course angle is π/2 − θ', () => {
    same(latitudeOf(Math.PI / 3), Math.PI / 6);
    same(latitudeOf(Math.PI), -Math.PI / 2);
  });

  it('notes (ρ, azimuth, latitude) → course (r, θ, φ) describes the same point', () => {
    const rnd = lcg(31);
    for (let i = 0; i < 200; i++) {
      const rho = 0.5 + 3 * rnd();
      const az = 2 * Math.PI * rnd();
      const lat = Math.PI * (rnd() - 0.5);
      const c = notesToCourse(rho, az, lat);
      sameVec(fromSpherical(c.r, c.theta, c.phi), fromNotesSpherical(rho, az, lat));
    }
  });

  it('toNotesSpherical inverts fromNotesSpherical: latitude in [−π/2, π/2]', () => {
    const p = fromNotesSpherical(3, 1, -0.4);
    const n = toNotesSpherical(p);
    same(n.rho, 3);
    same(n.azimuth, 1);
    same(n.latitude, -0.4);
  });

  it('the north pole is latitude π/2 in the notes and θ = 0 here', () => {
    same(toNotesSpherical([0, 0, 2]).latitude, Math.PI / 2);
  });
});

describe('polar curves: the points of each preset satisfy its Cartesian equation', () => {
  for (const key of CURVE_KEYS) {
    const c = POLAR_CURVES[key];
    if (!c.cartesian) continue;
    it(`${c.equation} satisfies ${c.cartesian} at 200 points of its range`, () => {
      for (let i = 0; i <= 200; i++) {
        const t = c.range[0] + ((c.range[1] - c.range[0]) * i) / 200;
        const { x, y } = curvePoint(key, t);
        const res = cartesianResidual(key, x, y);
        expect(res).not.toBeNull();
        expect(Math.abs(res as number)).toBeLessThan(1e-9);
      }
    });
  }

  it('every curve keeps r ≥ 0 on its range (the course never plots a negative r)', () => {
    for (const key of CURVE_KEYS) {
      const c = POLAR_CURVES[key];
      for (let i = 0; i <= 400; i++) {
        const t = c.range[0] + ((c.range[1] - c.range[0]) * i) / 400;
        expect(curvePoint(key, t).r).toBeGreaterThanOrEqual(-1e-12);
      }
    }
  });

  it('the cardioid r = 1 + cos θ is 2 at θ = 0 and 0 at θ = π', () => {
    same(curvePoint('cardioid', 0).r, 2);
    same(curvePoint('cardioid', Math.PI).r, 0, 2);
  });

  it('the cardioid\'s leftmost point is x = −1/4 at θ = 2π/3, not at the origin (θ = π)', () => {
    let best = 0;
    let at = 0;
    for (let i = 0; i <= 100000; i++) {
      const t = (2 * Math.PI * i) / 100000;
      const x = curvePoint('cardioid', t).x;
      if (x < best) {
        best = x;
        at = t;
      }
    }
    expect(relativeError(best, -0.25)).toBeLessThan(1e-8);
    expect(Math.min(Math.abs(at - (2 * Math.PI) / 3), Math.abs(at - (4 * Math.PI) / 3))).toBeLessThan(1e-3);
  });

  it('the circle r = 2cos θ passes through the origin at the ends of its range and closes there', () => {
    const a = curvePoint('cos', -Math.PI / 2);
    const b = curvePoint('cos', Math.PI / 2);
    expect(Math.hypot(a.x, a.y)).toBeLessThan(1e-12);
    expect(Math.hypot(b.x, b.y)).toBeLessThan(1e-12);
    same(curvePoint('cos', 0).x, 2);
  });

  it('the ray θ = π/4 is traced by r: the point at r has Cartesian (r/√2, r/√2)', () => {
    const p = curvePoint('ray', 2);
    same(p.x, Math.SQRT2);
    same(p.y, Math.SQRT2);
    same(p.theta, Math.PI / 4);
  });

  it('the rose petal r = 2cos 2θ has r = 2 at θ = 0 and r = 0 at θ = ±π/4', () => {
    same(curvePoint('petal', 0).r, 2);
    same(curvePoint('petal', Math.PI / 4).r, 0, 2);
  });

  it('the cardioid, the spiral and the petal have no simple Cartesian equation: the residual is null', () => {
    expect(cartesianResidual('cardioid', 1, 1)).toBeNull();
    expect(cartesianResidual('spiral', 1, 1)).toBeNull();
    expect(cartesianResidual('petal', 1, 1)).toBeNull();
  });
});

describe('polar regions a ≤ r ≤ b, α ≤ θ ≤ β', () => {
  const quarterRing = { a: 1, b: 2, alpha: Math.PI / 2, beta: Math.PI };

  it('the quarter-ring in quadrant II contains (−1.5, 0.5) and not (1.5, 0.5), (−0.5, 0.2) or (−2, −1)', () => {
    expect(inRegion(-1.5, 0.5, quarterRing)).toBe(true);
    expect(inRegion(1.5, 0.5, quarterRing)).toBe(false);
    expect(inRegion(-0.5, 0.2, quarterRing)).toBe(false);
    expect(inRegion(-2, -1, quarterRing)).toBe(false);
  });

  it('the edges belong to the region: r = a, r = b, θ = α, θ = β', () => {
    expect(inRegion(0, 1, quarterRing)).toBe(true);
    expect(inRegion(0, 2, quarterRing)).toBe(true);
    expect(inRegion(-1, 0, quarterRing)).toBe(true);
    expect(inRegion(-2, 0, quarterRing)).toBe(true);
  });

  it('the sector 0 ≤ θ ≤ π/4 with r ≤ 2: (1.5, 1) in; (1, 2) above the ray y = x, and (−1, −1) in quadrant III, out', () => {
    const sector = { a: 0, b: 2, alpha: 0, beta: Math.PI / 4 };
    expect(inRegion(1.5, 1, sector)).toBe(true);
    expect(inRegion(1, 2, sector)).toBe(false);
    expect(inRegion(-1, -1, sector)).toBe(false);
  });

  it('(−1, 1) has θ = 3π/4: in 0 ≤ θ ≤ π/2? no; but arctan(y/x) = −π/4 would be wrongly outside every first-quadrant test', () => {
    expect(inRegion(-1, 1, { a: 0, b: 2, alpha: 0, beta: Math.PI / 2 })).toBe(false);
    expect(inRegion(-1, 1, { a: 0, b: 2, alpha: Math.PI / 2, beta: Math.PI })).toBe(true);
  });

  it('an angle interval is read modulo 2π: [−π/2, 0] contains the point at 7π/4', () => {
    expect(angleInRange((7 * Math.PI) / 4, -Math.PI / 2, 0)).toBe(true);
    expect(angleInRange(Math.PI / 4, -Math.PI / 2, 0)).toBe(false);
  });

  it('a full sweep covers every direction: the annulus 1 ≤ r ≤ 2 contains all 360 points of the circle r = 1.5', () => {
    const ring = { a: 1, b: 2, alpha: 0, beta: 2 * Math.PI };
    for (let d = 0; d < 360; d++) {
      const [x, y] = fromPolar(1.5, (d * Math.PI) / 180);
      expect(inRegion(x, y, ring)).toBe(true);
    }
    expect(inRegion(0, 0, ring)).toBe(false);
    expect(inRegion(0, 0, { ...ring, a: 0 })).toBe(true);
  });

  it('the region kind: disc, annulus, sector, annular sector, empty', () => {
    expect(regionKind({ a: 0, b: 2, alpha: 0, beta: 2 * Math.PI })).toBe('disc');
    expect(regionKind({ a: 1, b: 2, alpha: 0, beta: 2 * Math.PI })).toBe('annulus');
    expect(regionKind({ a: 0, b: 2, alpha: 0, beta: Math.PI / 2 })).toBe('sector');
    expect(regionKind(quarterRing)).toBe('annular-sector');
    expect(regionKind({ a: 2, b: 1, alpha: 0, beta: 1 })).toBe('empty');
  });
});

describe('coordinate surfaces', () => {
  it('cylindrical: r = c is a cylinder (the axis at c = 0), θ = c a half-plane, z = c a plane', () => {
    expect(cylSurfaceR(1.5)).toBe('cylinder');
    expect(cylSurfaceR(0)).toBe('axis');
    expect(cylSurfaceTheta()).toBe('half-plane');
    expect(cylSurfaceZ(2)).toBe('plane');
    expect(cylSurfaceZ(0)).toBe('xy-plane');
  });

  it('spherical: r = c is a sphere, θ = c a cone, flat (the xy-plane) at π/2', () => {
    expect(sphSurfaceR(2)).toBe('sphere');
    expect(sphSurfaceTheta(Math.PI / 4)).toBe('cone');
    expect(sphSurfaceTheta((3 * Math.PI) / 4)).toBe('cone');
    expect(sphSurfaceTheta(Math.PI / 2)).toBe('xy-plane');
    expect(sphSurfaceTheta(0)).toBe('axis');
  });

  it('every point on the cone θ = π/4 has z = √(x² + y²); on θ = 3π/4 it has z = −√(x² + y²)', () => {
    const rnd = lcg(37);
    for (let i = 0; i < 100; i++) {
      const r = 0.2 + 3 * rnd();
      const p = fromSpherical(r, Math.PI / 4, 6 * rnd());
      same(p[2], Math.hypot(p[0], p[1]));
      const q = fromSpherical(r, (3 * Math.PI) / 4, 6 * rnd());
      same(q[2], -Math.hypot(q[0], q[1]));
    }
  });

  it('turning φ at fixed r and θ keeps the cylindrical r and z: the point draws a circle on a cone and on a sphere', () => {
    const rnd = lcg(41);
    for (let i = 0; i < 100; i++) {
      const p = fromSpherical(2, 0.7, 6 * rnd());
      same(Math.hypot(p[0], p[1]), 2 * Math.sin(0.7));
      same(p[2], 2 * Math.cos(0.7));
    }
  });

  it('the points (3, 4, 5) and (3, 0, 3) lie on the cone z = √(x²+y²), at θ = π/4', () => {
    same(toSpherical([3, 4, 5]).theta, Math.atan2(5, 5));
    same(toSpherical([3, 0, 3]).theta, Math.PI / 4);
  });
});

describe('solids: ball, cylinder, cone', () => {
  it('ball x² + y² + z² ≤ 4: (1, 1, 1) in, (2, 0, 0) on the boundary (in), (1.5, 1.5, 0) out', () => {
    expect(inSolid('ball', [1, 1, 1])).toBe(true);
    expect(inSolid('ball', [2, 0, 0])).toBe(true);
    expect(inSolid('ball', [1.5, 1.5, 0])).toBe(false);
  });

  it('cylinder x² + y² ≤ 4, 0 ≤ z ≤ 3: height and radius are both tested', () => {
    expect(inSolid('cylinder', [1, 1, 3])).toBe(true);
    expect(inSolid('cylinder', [1, 1, 3.1])).toBe(false);
    expect(inSolid('cylinder', [1, 1, -0.1])).toBe(false);
    expect(inSolid('cylinder', [2, 1, 1])).toBe(false);
  });

  it('cone √(x²+y²) ≤ z ≤ 2: "above the cone" means near the z-axis (θ ≤ π/4)', () => {
    expect(inSolid('cone', [0.5, 0.5, 1])).toBe(true);
    expect(inSolid('cone', [1.5, 0, 1])).toBe(false);
    expect(inSolid('cone', [0, 0, 2.1])).toBe(false);
    const rnd = lcg(43);
    for (let i = 0; i < 200; i++) {
      const p: Vec3 = [4 * (rnd() - 0.5), 4 * (rnd() - 0.5), 3 * rnd()];
      const s = toSpherical(p);
      const byAngle = s.theta <= Math.PI / 4 + 1e-12 && p[2] <= SOLIDS.cone.H;
      if (Math.abs(s.theta - Math.PI / 4) > 1e-9) expect(inSolid('cone', p)).toBe(byAngle);
    }
  });
});

describe('angle display: niceAngle and degrees360', () => {
  it('multiples of π/12 are named: 0, π/6, π/4, π/3, π/2, 3π/4, π, 5π/4, 3π/2, 2π, −π/3', () => {
    expect(niceAngle(0)).toBe('0');
    expect(niceAngle(Math.PI / 6)).toBe('π/6');
    expect(niceAngle(Math.PI / 4)).toBe('π/4');
    expect(niceAngle(Math.PI / 3)).toBe('π/3');
    expect(niceAngle(Math.PI / 2)).toBe('π/2');
    expect(niceAngle((3 * Math.PI) / 4)).toBe('3π/4');
    expect(niceAngle(Math.PI)).toBe('π');
    expect(niceAngle((5 * Math.PI) / 4)).toBe('5π/4');
    expect(niceAngle((3 * Math.PI) / 2)).toBe('3π/2');
    expect(niceAngle(2 * Math.PI)).toBe('2π');
    expect(niceAngle(-Math.PI / 3)).toBe('−π/3');
    expect(niceAngle((5 * Math.PI) / 12)).toBe('5π/12');
  });

  it('an angle that is not a multiple of π/12 has no name', () => {
    expect(niceAngle(1)).toBeNull();
    expect(niceAngle(Math.PI / 5)).toBeNull();
  });

  it('degrees360 maps into [0, 360): −90° → 270°, 405° → 45°', () => {
    same(degrees360(-Math.PI / 2), 270);
    same(degrees360((405 * Math.PI) / 180), 45);
  });
});
