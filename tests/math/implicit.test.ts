import katex from 'katex';
import { describe, expect, it } from 'vitest';
import { centralDiff, relativeError } from '~/math/analysis';
import {
  FOLIUM_NODE_R,
  IMPLICIT,
  IMPLICIT_IDS,
  RELATED,
  RELATED_IDS,
  coneVolume,
  curvePolylines,
  depressedCubicRoots,
  exactRate,
  graphPiece,
  otherPointsAbove,
  projectToCurve,
  slopeAt,
  walkAlong,
  type ImplicitId,
} from '~/math/implicit';

// recomputed with sympy 2026-11-27 (differentiating each equation with y = y(x) and solving for y′):
// slopes −3/4, −1/2, −4/5, −4/13, −1 at (3, 4), (2, 1), (1, 2), (1, 2), (3, 3); the ellipse's tangent at (2, 1)
// meets the y-axis at 2; horizontal / vertical tangents: circle (0, ±5) / (±5, 0); ellipse (0, ±√2) / (±2√2, 0);
// tilted ±(√21/3, −2√21/3) / ±(2√21/3, −√21/3); cubic curve (0, ∛10) / none; folium (2∛2, 2∛4) / (2∛4, 2∛2) (and the
// node (0, 0), where num = den = 0). Ladder dy/dt = −3/4 at x = 3, −3.428571 at x = 4.8, |dy/dt| = 3 at x = 3√10/2;
// cone dh/dt = 8/(πh²), 1/(2π) at h = 4, ratio 9/100 between h = 5 and h = 1.5; balloon dV/dt = 8πr², 200π at r = 5.
// The figure's defaults (2026-11-27): ladder x = 3.5, y = √51/2, dy/dt = −7/√51 ≈ −0.9802; cone h = 3, V = 9π/4,
// dh/dt = 8/(9π) ≈ 0.2829; balloon r = 4, V = 256π/3, dV/dt = 128π ≈ 402.1.

const sizeOf = (x: number, y: number) => 1 + x * x + y * y + Math.abs(x * x * x) + Math.abs(y * y * y);

describe('implicit: exact identities, the default points and the special points', () => {
  it('every default point lies on its curve exactly', () => {
    const off: string[] = [];
    for (const id of IMPLICIT_IDS) {
      const s = IMPLICIT[id];
      if (s.F(s.point[0], s.point[1]) !== 0) off.push(id);
    }
    expect(off).toEqual([]);
  });

  it('the slopes at the default points: circle −3/4, ellipse −1/2, tilted −4/5, cubic curve −4/13, folium −1', () => {
    const want: Record<ImplicitId, number> = { circle: -3 / 4, ellipse: -1 / 2, tilted: -4 / 5, 'cubic-curve': -4 / 13, folium: -1 };
    const off: string[] = [];
    for (const id of IMPLICIT_IDS) {
      const s = IMPLICIT[id];
      const m = slopeAt(id, s.point[0], s.point[1]).m;
      if (relativeError(m, want[id]) > 1e-15) off.push(`${id}: ${m}`);
    }
    expect(off).toEqual([]);
  });

  it("the ellipse's tangent at (2, 1) meets the y-axis at 2", () => {
    const m = slopeAt('ellipse', 2, 1).m;
    expect(1 + m * (0 - 2)).toBe(2);
  });

  it('special points: on the curve; num = 0 ≠ den at a horizontal tangent, den = 0 ≠ num at a vertical one', () => {
    const off: string[] = [];
    for (const id of IMPLICIT_IDS) {
      const s = IMPLICIT[id];
      for (const [kind, list] of [['horizontal', s.horizontal], ['vertical', s.vertical]] as const) {
        for (const q of list) {
          const [x, y] = q.at;
          const sz = sizeOf(x, y);
          if (Math.abs(s.F(x, y)) > 1e-13 * sz) off.push(`${id} ${q.text}: F = ${s.F(x, y)}`);
          const zero = kind === 'horizontal' ? s.num(x, y) : s.den(x, y);
          const other = kind === 'horizontal' ? s.den(x, y) : s.num(x, y);
          if (Math.abs(zero) > 1e-13 * sz) off.push(`${id} ${q.text}: ${kind} part ${zero}`);
          if (Math.abs(other) < 0.1) off.push(`${id} ${q.text}: the other part is ${other}`);
          if (slopeAt(id, x, y).kind !== kind) off.push(`${id} ${q.text}: slopeAt kind`);
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('the special points are the exact values of the brief', () => {
    const r21 = Math.sqrt(21);
    const pts: [ImplicitId, 'horizontal' | 'vertical', number, number][] = [
      ['tilted', 'horizontal', r21 / 3, (-2 * r21) / 3],
      ['tilted', 'horizontal', -r21 / 3, (2 * r21) / 3],
      ['tilted', 'vertical', (2 * r21) / 3, -r21 / 3],
      ['tilted', 'vertical', (-2 * r21) / 3, r21 / 3],
      ['folium', 'horizontal', 2 * Math.cbrt(2), 2 * Math.cbrt(4)],
      ['folium', 'vertical', 2 * Math.cbrt(4), 2 * Math.cbrt(2)],
      ['circle', 'horizontal', 0, 5],
      ['circle', 'vertical', -5, 0],
      ['ellipse', 'horizontal', 0, Math.SQRT2],
      ['ellipse', 'vertical', 2 * Math.SQRT2, 0],
      ['cubic-curve', 'horizontal', 0, Math.cbrt(10)],
    ];
    const off: string[] = [];
    for (const [id, kind, x, y] of pts) {
      if (!IMPLICIT[id][kind].some((q) => q.at[0] === x && q.at[1] === y)) off.push(`${id} ${kind} (${x}, ${y})`);
    }
    expect(off).toEqual([]);
    expect(IMPLICIT['cubic-curve'].vertical).toEqual([]);
  });

  it('the folium node: num = den = 0 at the origin, and the stored slope is undefined there', () => {
    const s = IMPLICIT.folium;
    expect([s.F(0, 0), s.num(0, 0), s.den(0, 0)]).toEqual([0, 0, 0]);
    expect(slopeAt('folium', 0, 0).kind).toBe('none');
  });

  it('every TeX string renders in KaTeX strict mode', () => {
    const off: string[] = [];
    for (const id of IMPLICIT_IDS) {
      for (const src of [IMPLICIT[id].tex, IMPLICIT[id].slopeTex]) {
        try {
          katex.renderToString(src, { throwOnError: true, strict: 'error' });
        } catch (e) {
          off.push(`${id}: ${(e as Error).message}`);
        }
      }
    }
    expect(off).toEqual([]);
  });
});

describe('implicit: exact identities, the closed-form y′ against the slope measured along the curve', () => {
  it('the parametrisations lie on their curves', () => {
    const off: string[] = [];
    for (const id of IMPLICIT_IDS) {
      const s = IMPLICIT[id];
      for (const pc of s.pieces) {
        for (let i = 0; i <= 200; i++) {
          const [x, y] = pc.p(pc.t0 + ((pc.t1 - pc.t0) * i) / 200);
          if (!Number.isFinite(x) || Math.hypot(x, y) > 40) continue;
          if (Math.abs(s.F(x, y)) > 1e-12 * sizeOf(x, y)) off.push(`${id} at (${x}, ${y}): ${s.F(x, y)}`);
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('y′ = num/den equals (dy/dt)/(dx/dt) along the parametrisation (central differences), away from vertical tangents and the node', () => {
    const off: string[] = [];
    let checked = 0;
    for (const id of IMPLICIT_IDS) {
      const s = IMPLICIT[id];
      for (const pc of s.pieces) {
        for (let i = 1; i < 240; i++) {
          const t = pc.t0 + ((pc.t1 - pc.t0) * i) / 240;
          const [x, y] = pc.p(t);
          if (!Number.isFinite(x) || Math.hypot(x, y) > 12 || Math.hypot(x, y) < 0.3) continue;
          const dx = centralDiff((u) => pc.p(u)[0], t, 1e-6);
          const dy = centralDiff((u) => pc.p(u)[1], t, 1e-6);
          if (Math.abs(dx) < 0.05 * Math.hypot(dx, dy)) continue; // nearly vertical: the slope is ill-conditioned
          const measured = dy / dx;
          const closed = s.num(x, y) / s.den(x, y);
          checked++;
          if (Math.abs(measured - closed) > 1e-5 * (1 + Math.abs(closed))) off.push(`${id} at (${x.toFixed(3)}, ${y.toFixed(3)}): ${closed} vs ${measured}`);
        }
      }
    }
    expect(off).toEqual([]);
    expect(checked).toBeGreaterThan(800);
  });

  it('the points above x (exact roots) lie on the curve, and the counts are right', () => {
    const off: string[] = [];
    for (const id of IMPLICIT_IDS) {
      const s = IMPLICIT[id];
      for (let x = -6; x <= 6; x += 0.37) {
        for (const y of s.ysAt(x)) if (Math.abs(s.F(x, y)) > 1e-11 * sizeOf(x, y)) off.push(`${id} (${x}, ${y})`);
      }
    }
    const count = (id: ImplicitId, x: number) => IMPLICIT[id].ysAt(x).length;
    if (count('circle', 3) !== 2) off.push('circle at 3');
    if (count('circle', 6) !== 0) off.push('circle at 6');
    if (count('cubic-curve', 1) !== 1) off.push('cubic at 1');
    if (count('folium', 3) !== 3) off.push('folium at 3'); // the loop twice and the lower branch
    if (count('folium', -1) !== 1) off.push('folium at −1');
    expect(off).toEqual([]);
    expect(otherPointsAbove('circle', [3, 4])).toEqual([[3, -4]]);
  });

  it('depressedCubicRoots: three, two-merged and one real root', () => {
    const roots = depressedCubicRoots(-7, 6); // (y − 1)(y − 2)(y + 3)
    expect(roots.map((r) => Math.round(r * 1e12) / 1e12)).toEqual([-3, 1, 2]);
    expect(depressedCubicRoots(1, -2).map((r) => Math.round(r * 1e12) / 1e12)).toEqual([1]); // (y − 1)(y² + y + 2)
  });
});

describe('implicit: the sampled curve, projection and walking (drawing aids)', () => {
  it('projected points lie on the curve, and the folium never comes within 0.15 of the node', () => {
    const off: string[] = [];
    for (const id of IMPLICIT_IDS) {
      const s = IMPLICIT[id];
      for (let i = 0; i < 60; i++) {
        const q: [number, number] = [-5 + (i % 10) * 1.1, -4 + Math.floor(i / 10) * 1.6];
        const p = projectToCurve(id, q);
        if (Math.abs(s.F(p[0], p[1])) > 1e-11 * sizeOf(p[0], p[1])) off.push(`${id} from (${q}): F = ${s.F(p[0], p[1])}`);
        if (id === 'folium' && Math.hypot(p[0], p[1]) < FOLIUM_NODE_R) off.push(`folium near node from (${q})`);
      }
    }
    const near = projectToCurve('folium', [0.01, -0.02]);
    if (Math.hypot(near[0], near[1]) < FOLIUM_NODE_R) off.push('folium node');
    expect(off).toEqual([]);
  });

  it('projection snaps exactly onto a special point within the snap radius', () => {
    const r21 = Math.sqrt(21);
    expect(projectToCurve('tilted', [r21 / 3 + 0.02, (-2 * r21) / 3 - 0.01], 0.05)).toEqual([r21 / 3, (-2 * r21) / 3]);
    expect(projectToCurve('circle', [5.03, 0.02], 0.05)).toEqual([5, 0]);
  });

  it('walking along the curve stays on it and stops before the node', () => {
    const off: string[] = [];
    for (const id of IMPLICIT_IDS) {
      const s = IMPLICIT[id];
      let p = s.point;
      for (let i = 0; i < 80; i++) {
        p = walkAlong(id, p, 0.25);
        if (Math.abs(s.F(p[0], p[1])) > 1e-11 * sizeOf(p[0], p[1])) off.push(`${id} step ${i}`);
        if (id === 'folium' && Math.hypot(p[0], p[1]) < FOLIUM_NODE_R - 1e-9) off.push(`folium node at step ${i}`);
      }
    }
    expect(off).toEqual([]);
    const moved = walkAlong('circle', [3, 4], 0.05);
    expect(Math.hypot(moved[0] - 3, moved[1] - 4)).toBeGreaterThan(0.04);
  });

  it('the graph piece through P is a graph: x moves one way along it; none at a vertical tangent', () => {
    const off: string[] = [];
    for (const id of IMPLICIT_IDS) {
      const piece = graphPiece(id, IMPLICIT[id].point);
      if (!piece || piece.length < 20) {
        off.push(`${id}: no piece`);
        continue;
      }
      const dir = Math.sign(piece[piece.length - 1][0] - piece[0][0]);
      for (let i = 1; i < piece.length; i++) if (Math.sign(piece[i][0] - piece[i - 1][0]) !== dir && piece[i][0] !== piece[i - 1][0]) off.push(`${id} at ${i}`);
    }
    expect(off).toEqual([]);
    expect(graphPiece('circle', [5, 0])).toBeNull();
    // the upper half of the circle: it ends near (±5, 0)
    const up = graphPiece('circle', [3, 4]) as [number, number][];
    expect(Math.min(...up.map((p) => p[1]))).toBeGreaterThan(0);
    expect(Math.max(...up.map((p) => Math.abs(p[0])))).toBeGreaterThan(4.99);
  });

  it('the sampled curve is cut into pieces that stay inside the sampling box', () => {
    for (const id of IMPLICIT_IDS) expect(curvePolylines(id).length).toBeGreaterThan(0);
    expect(curvePolylines('circle')[0].closed).toBe(true);
  });
});

describe('related rates: the closed forms against a numerical derivative in time, and the special values', () => {
  it('ladder: dy/dt = −x/y · 1; −3/4 at x = 3; below −3 at x = 4.8 (the foot keeps 1 m/s)', () => {
    const L = RELATED.ladder;
    expect(L.depRate(3)).toBe(-3 / 4);
    expect(L.dep(3)).toBe(4);
    expect(relativeError(L.depRate(4.8), -4.8 / 1.4)).toBeLessThan(1e-12);
    expect(L.depRate(4.8)).toBeLessThan(-3);
    expect(Math.abs(L.depRate((3 * Math.sqrt(10)) / 2) + 3)).toBeLessThan(1e-12);
    expect(exactRate('ladder', 3)).toBeNull(); // the bank's case is computed, never printed as exact
  });

  it('the defaults avoid the bank cases; their stored exact rates are the closed forms: −7/√51, 8/(9π), 128π', () => {
    expect([RELATED.ladder.q0, RELATED.cone.q0, RELATED.balloon.q0]).toEqual([3.5, 3, 4]);
    expect(relativeError(RELATED.ladder.depRate(3.5), -7 / Math.sqrt(51))).toBeLessThan(1e-15);
    expect(relativeError(RELATED.ladder.dep(3.5), Math.sqrt(51) / 2)).toBeLessThan(1e-15);
    expect(relativeError(RELATED.cone.depRate(3), 8 / (9 * Math.PI))).toBeLessThan(1e-15);
    expect(relativeError(RELATED.balloon.depRate(4), 128 * Math.PI)).toBeLessThan(1e-15);
    expect([exactRate('ladder', 3.5), exactRate('cone', 3), exactRate('balloon', 4)]).toEqual(['−7/√51', '8/(9π)', '128π']);
    for (const id of RELATED_IDS) for (const e of RELATED[id].exact) expect(e.q).toBe(RELATED[id].q0);
  });

  it('cone: dh/dt = 8/(πh²); 1/(2π) at h = 4; at h ≥ 5 below a tenth of the value at h = 1.5', () => {
    const C = RELATED.cone;
    expect(relativeError(C.depRate(4), 1 / (2 * Math.PI))).toBeLessThan(1e-15);
    expect(relativeError(C.depRate(5) / C.depRate(1.5), 9 / 100)).toBeLessThan(1e-14);
    expect(C.depRate(5)).toBeLessThan(C.depRate(1.5) / 10);
    expect(relativeError(coneVolume(6), 18 * Math.PI)).toBeLessThan(1e-15);
  });

  it('balloon: dV/dt = 8πr²; 200π at r = 5', () => {
    expect(relativeError(RELATED.balloon.depRate(5), 200 * Math.PI)).toBeLessThan(1e-15);
  });

  it('every closed-form rate matches d/dt of the dependent quantity along the exact motion (central differences)', () => {
    const off: string[] = [];
    for (const id of RELATED_IDS) {
      const s = RELATED[id];
      for (let i = 1; i < 40; i++) {
        const q = s.range[0] + ((s.range[1] - s.range[0]) * i) / 40;
        // the dependent quantity as a function of time, through the exact motion q(t); for the cone the asked rate is
        // the rate of h itself, so measure d/dt of q(t)
        const g = (tau: number) => (id === 'cone' ? s.advance(q, tau) : s.dep(s.advance(q, tau)));
        const measured = centralDiff(g, 0, 1e-6);
        if (relativeError(measured, s.depRate(q)) > 1e-6) off.push(`${id} at ${q}: ${s.depRate(q)} vs ${measured}`);
        // the driving quantity moves at the given rate (ladder x, balloon r) or the volume does (cone)
        const given = id === 'cone' ? centralDiff((tau) => coneVolume(s.advance(q, tau)), 0, 1e-6) : centralDiff((tau) => s.advance(q, tau), 0, 1e-6);
        if (relativeError(given, s.rate) > 1e-6) off.push(`${id} at ${q}: given rate ${given}`);
      }
    }
    expect(off).toEqual([]);
  });
});
