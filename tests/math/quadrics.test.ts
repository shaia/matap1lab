/**
 * src/math/quadrics.ts (the section of a quadric surface by a coordinate plane), filed by accuracy category. Each test is
 * named after the claim it checks. Real-valued quantities are compared by relativeError, except against an exact 0, where
 * an absolute bound is stated with its reason: a residual of a sampled point is a sum of terms of size up to ~10, so
 * rounding leaves ~1e-15 and the bound 1e-9 is generous but still rejects any real error.
 */

import { describe, expect, it } from 'vitest';
import {
  PRESETS,
  classifyConic,
  clipRuns,
  fmtConicEquation,
  fmtLines,
  fmtRational,
  fmtSqrtRational,
  formatQuadric,
  presetById,
  quadric,
  residual,
  sampleConic,
  sampleTrace,
  substitutePlane,
  surfaceKind,
  traceConic,
  type Axis,
  type Quadric,
} from '~/math/quadrics';
import { relativeError } from '~/math/vec';

const AXES: Axis[] = ['x', 'y', 'z'];
const CS = Array.from({ length: 25 }, (_, i) => -3 + i * 0.25);
const q = (id: string): Quadric => (presetById(id) as { q: Quadric }).q;
const info = (id: string, axis: Axis, c: number) => classifyConic(traceConic(q(id), axis, c));
/** absolute bound for a residual compared with the exact 0 */
const RESID = 1e-9;

describe('exact identities: a sampled trace point lies on the surface and on its plane', () => {
  for (const pr of PRESETS) {
    it(`every sampled point of every section of the ${pr.id} satisfies its equation`, () => {
      let count = 0;
      for (const axis of AXES) {
        const idx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
        for (const c of CS) {
          for (const run of sampleTrace(pr.q, axis, c)) {
            for (const p of run) {
              expect(Math.abs(residual(pr.q, p))).toBeLessThan(RESID);
              expect(p[idx]).toBe(c);
              for (const x of p) expect(Math.abs(x)).toBeLessThanOrEqual(3 + 1e-12);
              count++;
            }
          }
        }
      }
      expect(count).toBeGreaterThan(100);
    });
  }

  it('a section is empty exactly when the sampler returns no points and the classifier says empty', () => {
    for (const pr of PRESETS) {
      for (const axis of AXES) {
        for (const c of CS) {
          const kind = classifyConic(traceConic(pr.q, axis, c)).kind;
          if (kind === 'empty') expect(sampleTrace(pr.q, axis, c)).toEqual([]);
        }
      }
    }
  });
});

describe('analytic limits: the notes, ellipsoid x²/4 + y²/9 + z² = 1', () => {
  it('y = 0 gives the ellipse x²/4 + z² = 1 with semi-axes 2 (along x) and 1 (along z)', () => {
    const i = info('ellipsoid', 'y', 0);
    expect(i.kind).toBe('ellipse');
    expect(relativeError(i.ra, 2)).toBeLessThan(1e-12);
    expect(relativeError(i.rb, 1)).toBeLessThan(1e-12);
  });
  it('x = 0 gives y²/9 + z² = 1 with semi-axes 3 (along y) and 1 (along z)', () => {
    const i = info('ellipsoid', 'x', 0);
    expect(i.kind).toBe('ellipse');
    expect(relativeError(i.ra, 3)).toBeLessThan(1e-12);
    expect(relativeError(i.rb, 1)).toBeLessThan(1e-12);
  });
  it('z = 0 gives x²/4 + y²/9 = 1 with semi-axes 2 and 3', () => {
    const i = info('ellipsoid', 'z', 0);
    expect(relativeError(i.ra, 2)).toBeLessThan(1e-12);
    expect(relativeError(i.rb, 3)).toBeLessThan(1e-12);
  });
  it('z = a gives x²/4 + y²/9 = 1 − a²: semi-axes 2√(1−a²) and 3√(1−a²), for |a| < 1', () => {
    for (const a of [-0.75, -0.5, -0.25, 0.25, 0.5, 0.75]) {
      const i = info('ellipsoid', 'z', a);
      expect(i.kind).toBe('ellipse');
      expect(relativeError(i.ra, 2 * Math.sqrt(1 - a * a))).toBeLessThan(1e-12);
      expect(relativeError(i.rb, 3 * Math.sqrt(1 - a * a))).toBeLessThan(1e-12);
    }
  });
  it('z = 1/2 gives semi-axes √3 and 3√3/2 (question Q-2.5-ellipsoid-section)', () => {
    const i = info('ellipsoid', 'z', 0.5);
    expect(relativeError(i.ra, Math.sqrt(3))).toBeLessThan(1e-12);
    expect(relativeError(i.rb, (3 * Math.sqrt(3)) / 2)).toBeLessThan(1e-12);
  });
  it('the section at z = a is similar to the one at z = 0: the ratio of semi-axes stays 2 : 3', () => {
    for (const a of [-0.5, 0.25, 0.75]) {
      const i = info('ellipsoid', 'z', a);
      expect(relativeError(i.rb / i.ra, 1.5)).toBeLessThan(1e-12);
    }
  });
});

describe('analytic limits: the notes, cone x² + y² − z² = 0', () => {
  it('y = 0 gives the pair of lines z = ±x', () => {
    const i = info('cone', 'y', 0);
    expect(i.kind).toBe('two-lines');
    expect(relativeError(i.slope as number, 1)).toBeLessThan(1e-12);
    expect(fmtLines(traceConic(q('cone'), 'y', 0), ['x', 'z'])).toBe('z = ±x');
  });
  it('x = 0 gives the pair of lines z = ±y', () => {
    const i = info('cone', 'x', 0);
    expect(i.kind).toBe('two-lines');
    expect(fmtLines(traceConic(q('cone'), 'x', 0), ['y', 'z'])).toBe('z = ±y');
  });
  it('z = 0 gives a single point, the origin', () => {
    const i = info('cone', 'z', 0);
    expect(i.kind).toBe('point');
    expect(i.u0).toBe(0);
    expect(i.v0).toBe(0);
  });
  it('z = a gives the circle x² + y² = a² of radius |a|', () => {
    for (const a of [-3, -1.5, -0.25, 0.25, 1, 2.75]) {
      const i = info('cone', 'z', a);
      expect(i.kind).toBe('circle');
      expect(relativeError(i.ra, Math.abs(a))).toBeLessThan(1e-12);
    }
  });
  it('x = c ≠ 0 gives a hyperbola whose branches open along z', () => {
    const i = info('cone', 'x', 1);
    expect(i.kind).toBe('hyperbola');
    expect(i.transverse).toBe('v');
  });
});

describe('analytic limits: the degenerate sections of the lesson', () => {
  it('hyperboloid of one sheet: x = ±1 and y = ±1 give pairs of lines, x = 0 gives a hyperbola', () => {
    for (const axis of ['x', 'y'] as Axis[]) {
      expect(info('hyperboloid1', axis, 1).kind).toBe('two-lines');
      expect(info('hyperboloid1', axis, -1).kind).toBe('two-lines');
      expect(info('hyperboloid1', axis, 0).kind).toBe('hyperbola');
      expect(info('hyperboloid1', axis, 2).kind).toBe('hyperbola');
    }
  });
  it('hyperboloid of one sheet: every z = c gives the circle of radius √(1 + c²)', () => {
    for (const c of CS) {
      const i = info('hyperboloid1', 'z', c);
      expect(i.kind).toBe('circle');
      expect(relativeError(i.ra, Math.sqrt(1 + c * c))).toBeLessThan(1e-12);
    }
  });
  it('hyperboloid of two sheets: z = c is empty for |c| < 1, a point at |c| = 1, a circle of radius √(c² − 1) beyond', () => {
    for (const c of CS) {
      const i = info('hyperboloid2', 'z', c);
      if (Math.abs(c) < 1) expect(i.kind).toBe('empty');
      else if (Math.abs(c) === 1) expect(i.kind).toBe('point');
      else {
        expect(i.kind).toBe('circle');
        expect(relativeError(i.ra, Math.sqrt(c * c - 1))).toBeLessThan(1e-12);
      }
    }
  });
  it('hyperboloid of two sheets: the vertical sections x = c are hyperbolas for every c', () => {
    for (const c of CS) expect(info('hyperboloid2', 'x', c).kind).toBe('hyperbola');
  });
  it('ellipsoid: z = ±1 is a point, |z| > 1 is empty', () => {
    expect(info('ellipsoid', 'z', 1).kind).toBe('point');
    expect(info('ellipsoid', 'z', -1).kind).toBe('point');
    expect(info('ellipsoid', 'z', 1.25).kind).toBe('empty');
    expect(info('ellipsoid', 'x', 2).kind).toBe('point');
    expect(info('ellipsoid', 'y', -3).kind).toBe('point');
    expect(info('ellipsoid', 'y', 3.25 - 0.25).kind).toBe('point');
  });
  it('sphere x² + y² + z² = 4: z = 1 is a circle of radius √3, z = ±2 a point, beyond it no section', () => {
    expect(relativeError(info('sphere', 'z', 1).ra, Math.sqrt(3))).toBeLessThan(1e-12);
    expect(info('sphere', 'z', 2).kind).toBe('point');
    expect(info('sphere', 'z', 2.25).kind).toBe('empty');
  });
  it('saddle z = x² − y²: z = 0 is the pair of lines y = ±x; z = c is a hyperbola opening along x for c > 0 and along y for c < 0', () => {
    expect(info('saddle', 'z', 0).kind).toBe('two-lines');
    expect(fmtLines(traceConic(q('saddle'), 'z', 0), ['x', 'y'])).toBe('y = ±x');
    expect(info('saddle', 'z', 1).transverse).toBe('u');
    expect(info('saddle', 'z', -1).transverse).toBe('v');
  });
  it('saddle: y = 1 gives z = x² − 1 (opens up), x = 1 gives z = 1 − y² (opens down) (question Q-2.5-saddle-sections)', () => {
    const up = info('saddle', 'y', 1);
    expect(up.kind).toBe('parabola');
    expect(up.axis).toBe('v');
    expect(up.p).toBe(1);
    expect(relativeError(up.v0, -1)).toBeLessThan(1e-12);
    expect(fmtConicEquation(traceConic(q('saddle'), 'y', 1), ['x', 'z'])).toBe('z = x² − 1');
    const down = info('saddle', 'x', 1);
    expect(down.kind).toBe('parabola');
    expect(down.p).toBe(-1);
    expect(fmtConicEquation(traceConic(q('saddle'), 'x', 1), ['y', 'z'])).toBe('z = 1 − y²');
  });
  it('paraboloid z = x² + y²: z = 4 is the circle of radius 2, z < 0 is empty, z = 0 a point, x = 0 the parabola z = y²', () => {
    expect(relativeError(info('paraboloid', 'z', 4).ra, 2)).toBeLessThan(1e-12);
    expect(info('paraboloid', 'z', -0.25).kind).toBe('empty');
    expect(info('paraboloid', 'z', 0).kind).toBe('point');
    expect(fmtConicEquation(traceConic(q('paraboloid'), 'x', 0), ['y', 'z'])).toBe('z = y²');
    expect(fmtConicEquation(traceConic(q('paraboloid'), 'x', 0.5), ['y', 'z'])).toBe('z = y² + 1/4');
  });
  it('cylinder x² + y² = 1: every z = c is the same unit circle; x = 1/2 gives two parallel lines, x = ±1 one double line, |x| > 1 nothing', () => {
    for (const c of CS) {
      const i = info('cylinder', 'z', c);
      expect(i.kind).toBe('circle');
      expect(i.ra).toBe(1);
    }
    const lines = info('cylinder', 'x', 0.5);
    expect(lines.kind).toBe('parallel-lines');
    expect(relativeError(lines.d as number, Math.sqrt(0.75))).toBeLessThan(1e-12);
    expect(info('cylinder', 'x', 1).kind).toBe('double-line');
    expect(info('cylinder', 'x', 1.25).kind).toBe('empty');
  });
  it('parabolic cylinder z = x²: z = c is two parallel lines x = ±√c, y = c the parabola z = x²', () => {
    expect(info('pcyl', 'z', 4).kind).toBe('parallel-lines');
    expect(fmtLines(traceConic(q('pcyl'), 'z', 4), ['x', 'y'])).toBe('x = ±2');
    expect(info('pcyl', 'y', 1.5).kind).toBe('parabola');
  });
});

describe('exact identities: classification of the surfaces', () => {
  const expected: Record<string, string> = {
    ellipsoid: 'ellipsoid',
    sphere: 'sphere',
    cone: 'cone',
    paraboloid: 'paraboloid-circular',
    saddle: 'paraboloid-hyperbolic',
    hyperboloid1: 'hyperboloid-one',
    hyperboloid2: 'hyperboloid-two',
    cylinder: 'cylinder-circular',
    pcyl: 'cylinder-parabolic',
  };
  for (const [id, kind] of Object.entries(expected)) {
    it(`the preset ${id} is a ${kind}`, () => {
      expect(surfaceKind(q(id))).toBe(kind);
    });
  }
  it('the sign of the right-hand side decides one sheet or two, and 0 gives the cone', () => {
    expect(surfaceKind(quadric(1, 1, -1, 0, 0, 0, 1))).toBe('hyperboloid-one');
    expect(surfaceKind(quadric(1, 1, -1, 0, 0, 0, -1))).toBe('hyperboloid-two');
    expect(surfaceKind(quadric(1, 1, -1, 0, 0, 0, 0))).toBe('cone');
    // z² − x² − y² = 1 is two sheets: multiply by −1
    expect(surfaceKind(quadric(-1, -1, 1, 0, 0, 0, 1))).toBe('hyperboloid-two');
    expect(surfaceKind(quadric(-1, -1, 1, 0, 0, 0, -1))).toBe('hyperboloid-one');
  });
  it('x²/4 + y²/9 − z² = 1 is one sheet (question Q-2.5-sketch-recipe); x²/4 + y²/9 = z is an elliptic paraboloid', () => {
    expect(surfaceKind(quadric(1 / 4, 1 / 9, -1, 0, 0, 0, 1))).toBe('hyperboloid-one');
    expect(surfaceKind(quadric(1 / 4, 1 / 9, 0, 0, 0, -1, 0))).toBe('paraboloid-elliptic');
    expect(surfaceKind(quadric(1 / 4, 1 / 9, 0, 0, 0, 0, 1))).toBe('cylinder-elliptic');
    expect(surfaceKind(quadric(1, -1, 0, 0, 0, 0, 1))).toBe('cylinder-hyperbolic');
  });
  it('a shifted sphere (x−1)² + y² + z² = 4, written x² − 2x + y² + z² = 3, is still a sphere', () => {
    expect(surfaceKind(quadric(1, 1, 1, -2, 0, 0, 3))).toBe('sphere');
  });
  it('the written form of each standard preset reproduces its equation', () => {
    for (const id of ['ellipsoid', 'sphere', 'cone', 'hyperboloid1', 'hyperboloid2', 'cylinder']) {
      expect(formatQuadric(q(id))).toBe((presetById(id) as { eq: string }).eq);
    }
  });
});

describe('exact identities: classification of conics', () => {
  it('k′ of the completed square decides the shape for a shifted circle (u − 1)² + v² = 4, written u² − 2u + v² = 3', () => {
    const i = classifyConic({ a: 1, b: 1, g: -2, h: 0, k: 3 });
    expect(i.kind).toBe('circle');
    expect(i.u0).toBe(1);
    expect(i.ra).toBe(2);
  });
  it('a conic with no square and no linear term is the whole plane when k = 0 and empty otherwise', () => {
    expect(classifyConic({ a: 0, b: 0, g: 0, h: 0, k: 0 }).kind).toBe('plane');
    expect(classifyConic({ a: 0, b: 0, g: 0, h: 0, k: 1 }).kind).toBe('empty');
    expect(classifyConic({ a: 0, b: 0, g: 1, h: 2, k: 3 }).kind).toBe('line');
  });
  it('a parabola with its axis along u: u = v² has p = 1 and vertex at the origin', () => {
    const i = classifyConic({ a: 0, b: 1, g: -1, h: 0, k: 0 });
    expect(i.kind).toBe('parabola');
    expect(i.axis).toBe('u');
    expect(i.p).toBe(1);
  });
});

describe('exact identities: sampled curves keep to the window and to their shape', () => {
  it('an ellipse that fits in the window is one closed run, its first and last points equal', () => {
    const runs = sampleConic({ a: 1, b: 1, g: 0, h: 0, k: 4 }, 3);
    expect(runs.length).toBe(1);
    const run = runs[0];
    // sin 2π is ~1e-16, not exactly 0: the second coordinate is compared with an absolute bound
    expect(relativeError(run[0][0], run[run.length - 1][0])).toBeLessThan(1e-12);
    expect(Math.abs(run[0][1] - run[run.length - 1][1])).toBeLessThan(1e-12);
  });
  it('a circle of radius 5 is clipped to the window: no point is farther than 3 along any coordinate', () => {
    for (const run of sampleConic({ a: 1, b: 1, g: 0, h: 0, k: 25 }, 3)) {
      for (const [u, v] of run) {
        expect(Math.abs(u)).toBeLessThanOrEqual(3 + 1e-12);
        expect(Math.abs(v)).toBeLessThanOrEqual(3 + 1e-12);
      }
    }
  });
  it('a hyperbola has two branches, one on each side of the centre', () => {
    const runs = sampleConic({ a: 1, b: -1, g: 0, h: 0, k: 1 }, 3);
    expect(runs.some((r) => r.every(([u]) => u > 0))).toBe(true);
    expect(runs.some((r) => r.every(([u]) => u < 0))).toBe(true);
  });
  it('a point section is one run of one point; a pair of crossing lines is two runs through the origin', () => {
    expect(sampleConic({ a: 1, b: 1, g: 0, h: 0, k: 0 })).toEqual([[[0, 0]]]);
    const lines = sampleConic({ a: 1, b: -1, g: 0, h: 0, k: 0 }, 3);
    expect(lines.length).toBe(2);
    for (const r of lines) for (const [u, v] of r) expect(Math.abs(Math.abs(u) - Math.abs(v))).toBeLessThan(1e-12);
  });
  it('clipping keeps the part of a segment inside the window and drops the rest', () => {
    expect(clipRuns([[-10, 0], [10, 0]], 3)).toEqual([[[-3, 0], [3, 0]]]);
    expect(clipRuns([[5, 5], [6, 6]], 3)).toEqual([]);
  });
});

describe('exact identities: the text shown to the reader', () => {
  it('fractions and exact square roots', () => {
    expect(fmtRational(0.75)).toBe('3/4');
    expect(fmtRational(-2)).toBe('−2');
    expect(fmtRational(1 / 9)).toBe('1/9');
    expect(fmtSqrtRational(3)).toBe('√3');
    expect(fmtSqrtRational(6.75)).toBe('3√3/2');
    expect(fmtSqrtRational(4)).toBe('2');
    expect(fmtSqrtRational(0.75)).toBe('√3/2');
  });
  it('the ellipsoid cut by z = 1/2: substituted and simplified', () => {
    const e = (presetById('ellipsoid') as { eq: string }).eq;
    expect(substitutePlane(e, 'z', 0.5)).toBe('x²/4 + y²/9 + (1/2)² = 1');
    expect(fmtConicEquation(traceConic(q('ellipsoid'), 'z', 0.5), ['x', 'y'])).toBe('x²/4 + y²/9 = 3/4');
  });
  it('the paraboloid cut by z = 4 reads 4 = x² + y² and x² + y² = 4', () => {
    const e = (presetById('paraboloid') as { eq: string }).eq;
    expect(substitutePlane(e, 'z', 4)).toBe('4 = x² + y²');
    expect(fmtConicEquation(traceConic(q('paraboloid'), 'z', 4), ['x', 'y'])).toBe('x² + y² = 4');
  });
  it('the cone cut by z = 0 reads x² + y² = 0; by y = 0 reads x² − z² = 0', () => {
    expect(fmtConicEquation(traceConic(q('cone'), 'z', 0), ['x', 'y'])).toBe('x² + y² = 0');
    expect(fmtConicEquation(traceConic(q('cone'), 'y', 0), ['x', 'z'])).toBe('x² − z² = 0');
  });
  it('a negative plane value is bracketed when substituted', () => {
    expect(substitutePlane('x² + y² − z² = 1', 'z', -1)).toBe('x² + y² − (−1)² = 1');
  });
  it('a plane value that is a whole side of the equation is written without brackets', () => {
    const e = (presetById('paraboloid') as { eq: string }).eq;
    expect(substitutePlane(e, 'z', -1)).toBe('−1 = x² + y²');
    expect(substitutePlane(e, 'z', 0.5)).toBe('1/2 = x² + y²');
    expect(substitutePlane(e, 'x', -1)).toBe('z = (−1)² + y²');
  });
  it('a section that is one line is solved for its variable: z = x² cut by x = 1 reads z = 1, by x = −3/2 reads z = 9/4', () => {
    expect(fmtConicEquation(traceConic(q('pcyl'), 'x', 1), ['y', 'z'])).toBe('z = 1');
    expect(fmtConicEquation(traceConic(q('pcyl'), 'x', -1.5), ['y', 'z'])).toBe('z = 9/4');
    expect(fmtConicEquation(traceConic(q('pcyl'), 'x', 0), ['y', 'z'])).toBe('z = 0');
  });
});
