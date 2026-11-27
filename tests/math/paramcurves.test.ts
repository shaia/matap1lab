import { describe, expect, it } from 'vitest';
import { centralDiff } from '~/math/analysis';
import {
  HELIX_P,
  PC,
  PC_IDS,
  SC,
  SC_IDS,
  TAU,
  point,
  sample,
  selfCrossings,
  spacePoint,
  spaceSample,
  spaceVelocity,
  velocity,
  worldLine,
} from '~/math/paramcurves';

// Closed forms checked with sympy (screens/tools/ch9_presets.py, 2026-11-27): (t, t²) and (t², t⁴), 0 ≤ t ≤ √2, give the
// same piece of y = x²; (sin t, sin² t) satisfies y = x² with |x| ≤ 1; (t² − 1, t³ − t) satisfies y² = x²(x + 1) since
// (t³ − t)² = t²(t² − 1)² = (t² − 1)²·t² = x²(x + 1); the helix (cos t, sin t, p t/2π) rises p per turn.

const grid = (lo: number, hi: number, n = 200) => Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n);
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

describe('exact identities: the Cartesian equations', () => {
  it('every point of every preset satisfies its equation, on a grid of the range', () => {
    const off: string[] = [];
    for (const id of PC_IDS) {
      const s = PC[id];
      for (const t of grid(s.range[0], s.range[1])) {
        const [x, y] = point(id, t);
        if (Math.abs(s.resid(x, y)) > 1e-12) off.push(`${id} t=${t}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('every point of every stored full set satisfies the equation', () => {
    const off: string[] = [];
    for (const id of PC_IDS) {
      for (const poly of PC[id].eqSet()) for (const [x, y] of poly) if (Math.abs(PC[id].resid(x, y)) > 1e-12) off.push(`${id} ${x},${y}`);
    }
    expect(off).toEqual([]);
  });

  it('parab and parab4 trace the same set: each point of one is a point of the other', () => {
    const off: string[] = [];
    for (const t of grid(0, 2)) {
      const [x, y] = point('parab', t);
      const u = Math.sqrt(t);
      const [x4, y4] = point('parab4', u);
      if (!near(x4, x, 1e-12) || !near(y4, y, 1e-12)) off.push(`parab t=${t}`);
    }
    for (const u of grid(0, Math.SQRT2)) {
      const [x, y] = point('parab4', u);
      const [x1, y1] = point('parab', u * u);
      if (!near(x1, x, 1e-12) || !near(y1, y, 1e-12)) off.push(`parab4 u=${u}`);
    }
    expect(off).toEqual([]);
  });

  it('circle and twice trace the same set: twice(t) = circle(2t), and the two ranges end at the starting point', () => {
    const off: string[] = [];
    for (const t of grid(0, TAU)) {
      const [x, y] = point('twice', t);
      const [cx, cy] = point('circle', 2 * t);
      if (!near(x, cx, 1e-12) || !near(y, cy, 1e-12)) off.push(`t=${t}`);
    }
    expect(off).toEqual([]);
    expect(PC.circle.twin).toBe('twice');
    expect(PC.twice.twin).toBe('circle');
    expect(PC.parab.twin).toBe('parab4');
    expect(PC.parab4.twin).toBe('parab');
  });

  it('nodal passes through the origin at t = -1 and t = 1, and selfCrossings says so', () => {
    for (const t of [-1, 1]) {
      const [x, y] = point('nodal', t);
      expect(x).toBeCloseTo(0, 12);
      expect(y).toBeCloseTo(0, 12);
    }
    const [c] = selfCrossings('nodal');
    expect([c.t1, c.t2]).toEqual([-1, 1]);
    expect(c.p[0]).toBeCloseTo(0, 12);
    expect(c.p[1]).toBeCloseTo(0, 12);
  });
});

describe('exact identities: the stored velocities', () => {
  it('dr equals centralDiff of r, componentwise, on an interior grid of every preset', () => {
    const off: string[] = [];
    for (const id of PC_IDS) {
      const [a, b] = PC[id].range;
      for (const t of grid(a + 0.01 * (b - a), b - 0.01 * (b - a), 60)) {
        const d = velocity(id, t);
        for (const k of [0, 1] as const) {
          if (!near(centralDiff((u) => point(id, u)[k], t), d[k], 1e-6)) off.push(`${id} k=${k} t=${t}`);
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('the space presets: dr equals centralDiff of r, componentwise, for several pitches', () => {
    const off: string[] = [];
    for (const id of SC_IDS) {
      const [a, b] = SC[id].range;
      for (const p of [0, 1, 2.5]) {
        for (const t of grid(a + 0.01 * (b - a), b - 0.01 * (b - a), 40)) {
          const d = spaceVelocity(id, t, p);
          for (const k of [0, 1, 2] as const) {
            if (!near(centralDiff((u) => spacePoint(id, u, p)[k], t), d[k], 1e-6)) off.push(`${id} p=${p} k=${k} t=${t}`);
          }
        }
      }
    }
    expect(off).toEqual([]);
  });
});

describe('range claims', () => {
  it('halfparab has |x| <= 1, reaches both ends and goes back and forth', () => {
    const xs = sample('halfparab', 400).map((q) => q[0]);
    expect(xs.every((x) => Math.abs(x) <= 1 + 1e-12)).toBe(true);
    expect(Math.max(...xs)).toBeCloseTo(1, 10);
    expect(Math.min(...xs)).toBeCloseTo(-1, 10);
    // t = pi/2 and t = 3pi/2 are the two turning points: x = 1 and x = -1, and dx/dt = 0 there
    expect(velocity('halfparab', Math.PI / 2)[0]).toBeCloseTo(0, 12);
    expect(velocity('halfparab', (3 * Math.PI) / 2)[0]).toBeCloseTo(0, 12);
  });

  it('segment starts at A = (-2, -1) and ends at B = (2, 1)', () => {
    const [x0, y0] = point('segment', 0);
    const [x1, y1] = point('segment', 1);
    expect([x0, y0, x1, y1]).toEqual([-2, -1, 2, 1]);
  });

  it('circle and ellipse start at (1, 0) and (2, 0), close up at t = 2 pi; parab4 ends at (2, 4)', () => {
    expect(point('circle', 0)).toEqual([1, 0]);
    expect(point('ellipse', 0)).toEqual([2, 0]);
    const e = point('circle', TAU);
    expect(e[0]).toBeCloseTo(1, 12);
    expect(e[1]).toBeCloseTo(0, 12);
    const q = point('parab4', Math.SQRT2);
    expect(q[0]).toBeCloseTo(2, 12);
    expect(q[1]).toBeCloseTo(4, 12);
    const w = point('parab', 2);
    expect(w).toEqual([2, 4]);
  });

  it('every preset stays inside its window', () => {
    const off: string[] = [];
    for (const id of PC_IDS) {
      const w = PC[id].window;
      for (const [x, y] of sample(id, 300)) if (x < w.x[0] || x > w.x[1] || y < w.y[0] || y > w.y[1]) off.push(`${id} ${x},${y}`);
    }
    expect(off).toEqual([]);
  });
});

describe('world lines and space curves', () => {
  it('the world line is the graph: (t, x(t), y(t)), with the shadow the curve itself', () => {
    const off: string[] = [];
    for (const id of PC_IDS) {
      const wl = worldLine(id, 100);
      const sm = sample(id, 100);
      wl.forEach(([t, x, y], i) => {
        const [px, py] = point(id, t);
        if (px !== x || py !== y || sm[i][0] !== x || sm[i][1] !== y) off.push(`${id} i=${i}`);
      });
      if (wl[0][0] !== PC[id].range[0] || wl[100][0] !== PC[id].range[1]) off.push(`${id} ends`);
    }
    expect(off).toEqual([]);
  });

  it('two twins give different world lines at the same point of the plane', () => {
    // circle at t = pi/2 is (0, 1); twice reaches (0, 1) already at t = pi/4
    const [x, y] = point('twice', Math.PI / 4);
    expect(x).toBeCloseTo(0, 12);
    expect(y).toBeCloseTo(1, 12);
    const [cx, cy] = point('circle', Math.PI / 2);
    expect([cx, cy].map((v) => Math.round(v * 1e9) / 1e9)).toEqual([0, 1]);
  });

  it('the helix rises exactly p per turn and stays on the cylinder x² + y² = 1', () => {
    const off: string[] = [];
    for (const p of [HELIX_P.min, 0.5, 1, 2, HELIX_P.max]) {
      for (const t of grid(0, TAU, 40)) {
        const a = spacePoint('helix', t, p);
        const b = spacePoint('helix', t + TAU, p);
        if (!near(b[2] - a[2], p, 1e-12) || !near(b[0], a[0], 1e-12) || !near(b[1], a[1], 1e-12)) off.push(`p=${p} t=${t}`);
        if (Math.abs(a[0] * a[0] + a[1] * a[1] - 1) > 1e-12) off.push(`cyl p=${p} t=${t}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('the helix with p = 0 is the unit circle in the xy-plane, and every space point lies in its box', () => {
    const off: string[] = [];
    for (const [x, y, z] of spaceSample('helix', 80, 0)) if (Math.abs(x * x + y * y - 1) > 1e-12 || z !== 0) off.push(`${x},${y},${z}`);
    for (const id of SC_IDS) {
      const { lo, hi } = SC[id].box;
      for (const p of [HELIX_P.min, HELIX_P.max]) {
        for (const q of spaceSample(id, 80, p)) for (let k = 0; k < 3; k++) if (q[k] < lo[k] || q[k] > hi[k]) off.push(`${id} p=${p} ${q.join(',')}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('segment3 runs from (2, 0, 0) to (0, 2, 2)', () => {
    expect(spacePoint('segment3', 0)).toEqual([2, 0, 0]);
    expect(spacePoint('segment3', 1)).toEqual([0, 2, 2]);
  });
});
