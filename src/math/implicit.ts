/**
 * MODEL SPECIFICATION
 *
 * System:        (1) plane curves given by an equation F(x, y) = 0 (lesson 5.4, implicit differentiation):
 *                  circle       x² + y² = 25            y′ = −x/y
 *                  ellipse      x² + 4y² = 8            y′ = −x/(4y)
 *                  tilted       x² + xy + y² = 7        y′ = −(2x + y)/(x + 2y)
 *                  cubic-curve  x²y + y³ = 10           y′ = −2xy/(x² + 3y²)
 *                  folium       x³ + y³ = 6xy           y′ = (2y − x²)/(y² − 2x)
 *                y′ is what differentiating both sides of the equation with respect to x, with y = y(x), gives
 *                (the course's method; partial derivatives are not used anywhere the learner sees). It is stored as a
 *                closed form y′ = num(x, y)/den(x, y) with its TeX. The tangent direction at a point is (den, num);
 *                the tangent is horizontal where num = 0 ≠ den and vertical where den = 0 ≠ num. Each preset stores
 *                these points exactly (surds) with a plain-text label.
 *                (2) related rates (lesson 5.5): two quantities tied by an equation, one changing at a known rate.
 *                  ladder   x² + y² = 25 (a 5 m ladder), dx/dt = 1 m/s  ⇒ dy/dt = −(x/y)·dx/dt
 *                  cone     V = πh³/12 (an inverted cone with r = h/2), dV/dt = 2 m³/min  ⇒ dh/dt = 8/(πh²)
 *                  balloon  V = 4πr³/3, dr/dt = 2 cm/s  ⇒ dV/dt = 4πr²·dr/dt = 8πr²
 * Drawing:       every curve is drawn from an exact parametrisation sampled densely (circle and ellipses by cos/sin,
 *                the tilted ellipse in the axes rotated by 45°, the cubic curve as the graph y(x) given by Cardano's
 *                formula, the folium by x = 6t/(1+t³), y = 6t²/(1+t³) with t = tan s), clipped to a box twice the
 *                preset's window. The points on the curve above a given x (`ysAt`) are exact: the quadratic formula,
 *                or the real roots of a cubic (Cardano / the trigonometric form), each polished by one Newton step.
 * Projection:    a point dragged near the curve goes to the nearest point of the sampled polyline, then onto F = 0 by
 *                Newton steps along the normal of the curve (the normal is internal to this file: it is never shown).
 *                The folium's node at the origin has no single tangent: a projected or walked point never comes within
 *                FOLIUM_NODE_R = 0.15 of it.
 * Exactness:     the closed-form slopes, the special points and the related-rate formulas are exact formulas; points
 *                on the curve are IEEE doubles whose residual F(P) is of order 1e-15 times the size of the terms (the
 *                figure shows F(P) as a numerical check, not a proof).
 * Ignored:       the sampled polyline is a drawing and dragging aid only; slopes never come from it.
 * Valid when:    the point is on the curve and away from the folium's node (where num = den = 0).
 *
 * Drives the figure ImplicitLab (lessons 5.4 and 5.5). tests/math/implicit.test.ts checks the closed forms against
 * slopes measured along the parametrisations, the special points, and the related rates against a numerical
 * derivative in time.
 */

import type { Vec2 } from './vec';

export type ImplicitId = 'circle' | 'ellipse' | 'tilted' | 'cubic-curve' | 'folium';
export const IMPLICIT_IDS: ImplicitId[] = ['circle', 'ellipse', 'tilted', 'cubic-curve', 'folium'];
export const isImplicitId = (s: unknown): s is ImplicitId => typeof s === 'string' && (IMPLICIT_IDS as string[]).includes(s);

export interface SpecialPoint {
  at: Vec2;
  /** exact coordinates as plain text, e.g. "(√21/3, −2√21/3)" */
  text: string;
}

export interface ParamPiece {
  p: (t: number) => Vec2;
  t0: number;
  t1: number;
  closed: boolean;
  samples: number;
}

export interface ImplicitSpec {
  id: ImplicitId;
  /** the equation as plain text (U+2212 minus, superscripts) */
  text: string;
  /** the equation in TeX */
  tex: string;
  /** left side minus right side, as plain text: the quantity the `check` readout evaluates */
  residualText: string;
  /** F(x, y) = left side − right side */
  F: (x: number, y: number) => number;
  /** the normal (∇F) — internal, used only to project a point onto the curve */
  normal: (x: number, y: number) => Vec2;
  /** y′ = num/den */
  num: (x: number, y: number) => number;
  den: (x: number, y: number) => number;
  /** the closed form of y′ in TeX (KaTeX strict) and as plain text */
  slopeTex: string;
  slopeText: string;
  /** the default point, its text and its exact slope */
  point: Vec2;
  pointText: string;
  slopeExact: string;
  /** the default window (the figure widens one axis to keep the scales equal) */
  window: { x: [number, number]; y: [number, number] };
  horizontal: SpecialPoint[];
  vertical: SpecialPoint[];
  /** a point no dragged point may come near (the folium's node) */
  avoid: { at: Vec2; r: number } | null;
  /** the exact points of the curve above x, increasing */
  ysAt: (x: number) => number[];
  pieces: ParamPiece[];
}

export const FOLIUM_NODE_R = 0.15;

/* ---------------------------------------------------------------- real roots of polynomials */

/** The real roots of y² + b·y + c = 0, increasing (a double root once). */
export function quadraticRoots(b: number, c: number): number[] {
  const D = b * b - 4 * c;
  if (D < 0) return [];
  if (D === 0) return [-b / 2];
  const s = Math.sqrt(D);
  // the stable form: no cancellation between −b and ±√D
  const q = -0.5 * (b + Math.sign(b || 1) * s);
  const r1 = q;
  const r2 = c / q;
  return r1 < r2 ? [r1, r2] : [r2, r1];
}

/** The real roots of y³ + p·y + q = 0, increasing, each polished by Newton steps; roots closer than 1e-9 merge. */
export function depressedCubicRoots(p: number, q: number): number[] {
  let roots: number[];
  const D = (q / 2) ** 2 + (p / 3) ** 3;
  if (p === 0) roots = [Math.cbrt(-q)];
  else if (D > 0) {
    const s = Math.sqrt(D);
    roots = [Math.cbrt(-q / 2 + s) + Math.cbrt(-q / 2 - s)];
  } else {
    // three real roots (p < 0): y = 2√(−p/3)·cos(θ/3 − 2πk/3)
    const m = 2 * Math.sqrt(-p / 3);
    const th = Math.acos(Math.max(-1, Math.min(1, ((3 * q) / (2 * p)) * Math.sqrt(-3 / p))));
    roots = [0, 1, 2].map((k) => m * Math.cos(th / 3 - (2 * Math.PI * k) / 3));
  }
  const g = (y: number) => y * y * y + p * y + q;
  const dg = (y: number) => 3 * y * y + p;
  roots = roots.map((y) => {
    let r = y;
    for (let i = 0; i < 3; i++) {
      const d = dg(r);
      if (d === 0) break;
      const nr = r - g(r) / d;
      if (!Number.isFinite(nr)) break;
      r = nr;
    }
    return r;
  });
  roots.sort((a, b) => a - b);
  const out: number[] = [];
  for (const r of roots) if (!out.length || Math.abs(r - out[out.length - 1]) > 1e-9) out.push(r);
  return out;
}

/** the cubic curve x²y + y³ = 10 as a graph: its one real y for every x (y > 0) */
export const cubicCurveY = (x: number): number => depressedCubicRoots(x * x, -10)[0];

/* ---------------------------------------------------------------- the presets */

const S2 = Math.SQRT2;
const S21 = Math.sqrt(21);
const C2 = Math.cbrt(2);
const C4 = Math.cbrt(4);
const TAU = 2 * Math.PI;
// the tilted ellipse in the axes u = (x + y)/√2, v = (y − x)/√2: (3/2)u² + (1/2)v² = 7
const TU = Math.sqrt(14 / 3);
const TV = Math.sqrt(14);

const folium = (t: number): Vec2 => {
  const d = 1 + t * t * t;
  return [(6 * t) / d, (6 * t * t) / d];
};

export const IMPLICIT: Record<ImplicitId, ImplicitSpec> = {
  circle: {
    id: 'circle',
    text: 'x² + y² = 25',
    tex: 'x^2+y^2=25',
    residualText: 'x² + y² − 25',
    F: (x, y) => x * x + y * y - 25,
    normal: (x, y) => [2 * x, 2 * y],
    num: (x) => -x,
    den: (_x, y) => y,
    slopeTex: "y' = -\\frac{x}{y}",
    slopeText: 'y′ = −x/y',
    point: [3, 4],
    pointText: '(3, 4)',
    slopeExact: '−3/4',
    window: { x: [-7, 7], y: [-6.5, 6.5] },
    horizontal: [
      { at: [0, 5], text: '(0, 5)' },
      { at: [0, -5], text: '(0, −5)' },
    ],
    vertical: [
      { at: [5, 0], text: '(5, 0)' },
      { at: [-5, 0], text: '(−5, 0)' },
    ],
    avoid: null,
    ysAt: (x) => quadraticRoots(0, x * x - 25),
    pieces: [{ p: (t) => [5 * Math.cos(t), 5 * Math.sin(t)], t0: 0, t1: TAU, closed: true, samples: 1200 }],
  },
  ellipse: {
    id: 'ellipse',
    text: 'x² + 4y² = 8',
    tex: 'x^2+4y^2=8',
    residualText: 'x² + 4y² − 8',
    F: (x, y) => x * x + 4 * y * y - 8,
    normal: (x, y) => [2 * x, 8 * y],
    num: (x) => -x,
    den: (_x, y) => 4 * y,
    slopeTex: "y' = -\\frac{x}{4y}",
    slopeText: 'y′ = −x/(4y)',
    point: [2, 1],
    pointText: '(2, 1)',
    slopeExact: '−1/2',
    window: { x: [-4, 4], y: [-3, 3] },
    horizontal: [
      { at: [0, S2], text: '(0, √2)' },
      { at: [0, -S2], text: '(0, −√2)' },
    ],
    vertical: [
      { at: [2 * S2, 0], text: '(2√2, 0)' },
      { at: [-2 * S2, 0], text: '(−2√2, 0)' },
    ],
    avoid: null,
    ysAt: (x) => quadraticRoots(0, (x * x - 8) / 4),
    pieces: [{ p: (t) => [2 * S2 * Math.cos(t), S2 * Math.sin(t)], t0: 0, t1: TAU, closed: true, samples: 1200 }],
  },
  tilted: {
    id: 'tilted',
    text: 'x² + xy + y² = 7',
    tex: 'x^2+xy+y^2=7',
    residualText: 'x² + xy + y² − 7',
    F: (x, y) => x * x + x * y + y * y - 7,
    normal: (x, y) => [2 * x + y, x + 2 * y],
    num: (x, y) => -(2 * x + y),
    den: (x, y) => x + 2 * y,
    slopeTex: "y' = -\\frac{2x+y}{x+2y}",
    slopeText: 'y′ = −(2x + y)/(x + 2y)',
    point: [1, 2],
    pointText: '(1, 2)',
    slopeExact: '−4/5',
    window: { x: [-4.5, 4.5], y: [-4.5, 4.5] },
    horizontal: [
      { at: [S21 / 3, (-2 * S21) / 3], text: '(√21/3, −2√21/3)' },
      { at: [-S21 / 3, (2 * S21) / 3], text: '(−√21/3, 2√21/3)' },
    ],
    vertical: [
      { at: [(2 * S21) / 3, -S21 / 3], text: '(2√21/3, −√21/3)' },
      { at: [(-2 * S21) / 3, S21 / 3], text: '(−2√21/3, √21/3)' },
    ],
    avoid: null,
    ysAt: (x) => quadraticRoots(x, x * x - 7),
    pieces: [
      {
        p: (t) => {
          const u = TU * Math.cos(t);
          const v = TV * Math.sin(t);
          return [(u - v) / S2, (u + v) / S2];
        },
        t0: 0,
        t1: TAU,
        closed: true,
        samples: 1400,
      },
    ],
  },
  'cubic-curve': {
    id: 'cubic-curve',
    text: 'x²y + y³ = 10',
    tex: 'x^2y+y^3=10',
    residualText: 'x²y + y³ − 10',
    F: (x, y) => x * x * y + y * y * y - 10,
    normal: (x, y) => [2 * x * y, x * x + 3 * y * y],
    num: (x, y) => -2 * x * y,
    den: (x, y) => x * x + 3 * y * y,
    slopeTex: "y' = -\\frac{2xy}{x^2+3y^2}",
    slopeText: 'y′ = −2xy/(x² + 3y²)',
    point: [1, 2],
    pointText: '(1, 2)',
    slopeExact: '−4/13',
    window: { x: [-6, 6], y: [-1.5, 4] },
    horizontal: [{ at: [0, Math.cbrt(10)], text: '(0, ∛10)' }],
    vertical: [],
    avoid: null,
    ysAt: (x) => depressedCubicRoots(x * x, -10),
    pieces: [{ p: (t) => [t, cubicCurveY(t)], t0: -14, t1: 14, closed: false, samples: 2400 }],
  },
  folium: {
    id: 'folium',
    text: 'x³ + y³ = 6xy',
    tex: 'x^3+y^3=6xy',
    residualText: 'x³ + y³ − 6xy',
    F: (x, y) => x * x * x + y * y * y - 6 * x * y,
    normal: (x, y) => [3 * x * x - 6 * y, 3 * y * y - 6 * x],
    num: (x, y) => 2 * y - x * x,
    den: (x, y) => y * y - 2 * x,
    slopeTex: "y' = \\frac{2y-x^2}{y^2-2x}",
    slopeText: 'y′ = (2y − x²)/(y² − 2x)',
    point: [3, 3],
    pointText: '(3, 3)',
    slopeExact: '−1',
    window: { x: [-5, 5], y: [-5, 5] },
    horizontal: [{ at: [2 * C2, 2 * C4], text: '(2∛2, 2∛4)' }],
    vertical: [{ at: [2 * C4, 2 * C2], text: '(2∛4, 2∛2)' }],
    avoid: { at: [0, 0], r: FOLIUM_NODE_R },
    // for a fixed x: y³ − 6x·y + x³ = 0
    ysAt: (x) => depressedCubicRoots(-6 * x, x * x * x),
    // t = tan s; t = −1 (s = −π/4) is the point at infinity; s → ±π/2 is the node
    pieces: [
      { p: (s) => folium(Math.tan(s)), t0: -Math.PI / 4 + 1e-4, t1: Math.PI / 2 - 1e-4, closed: false, samples: 4000 },
      { p: (s) => folium(Math.tan(s)), t0: -Math.PI / 2 + 1e-4, t1: -Math.PI / 4 - 1e-4, closed: false, samples: 2000 },
    ],
  },
};

/* ---------------------------------------------------------------- slope and special points */

export interface SlopeInfo {
  num: number;
  den: number;
  /** num/den, ±Infinity or NaN where den = 0 */
  m: number;
  kind: 'horizontal' | 'vertical' | 'none' | 'slope';
}

/** The slope from the closed form. At a stored special point (within 1e-9) the kind is exact; elsewhere a value of
 *  num or den below 1e-12 (relative to the size of the terms) counts as 0. */
export function slopeAt(id: ImplicitId, x: number, y: number): SlopeInfo {
  const s = IMPLICIT[id];
  const num = s.num(x, y);
  const den = s.den(x, y);
  const near = (list: SpecialPoint[]) => list.some((q) => Math.hypot(q.at[0] - x, q.at[1] - y) < 1e-9);
  if (near(s.horizontal)) return { num: 0, den, m: 0, kind: 'horizontal' };
  if (near(s.vertical)) return { num, den: 0, m: NaN, kind: 'vertical' };
  const scale = 1 + Math.abs(x) * Math.abs(x) + Math.abs(y) * Math.abs(y);
  const n0 = Math.abs(num) < 1e-12 * scale;
  const d0 = Math.abs(den) < 1e-12 * scale;
  if (n0 && d0) return { num, den, m: NaN, kind: 'none' };
  if (d0) return { num, den, m: NaN, kind: 'vertical' };
  if (n0) return { num, den, m: 0, kind: 'horizontal' };
  return { num, den, m: num / den, kind: 'slope' };
}

/** The stored special point within `radius` of p, if any (the nearest). */
export function nearSpecial(id: ImplicitId, p: Vec2, radius: number): { kind: 'horizontal' | 'vertical'; point: SpecialPoint } | null {
  const s = IMPLICIT[id];
  let best: { kind: 'horizontal' | 'vertical'; point: SpecialPoint; d: number } | null = null;
  for (const kind of ['horizontal', 'vertical'] as const) {
    for (const q of s[kind]) {
      const d = Math.hypot(q.at[0] - p[0], q.at[1] - p[1]);
      if (d <= radius && (!best || d < best.d)) best = { kind, point: q, d };
    }
  }
  return best ? { kind: best.kind, point: best.point } : null;
}

/** The default point when p is (within 1e-9) the preset's default point. */
export const isDefaultPoint = (id: ImplicitId, p: Vec2) => Math.hypot(IMPLICIT[id].point[0] - p[0], IMPLICIT[id].point[1] - p[1]) < 1e-9;

/* ---------------------------------------------------------------- sampled curve (drawing and dragging aid) */

export interface Polyline {
  points: Vec2[];
  closed: boolean;
}

/** the box the curve is sampled in: the preset's window, twice as wide and tall about its centre */
export function sampleBox(id: ImplicitId): { x: [number, number]; y: [number, number] } {
  const w = IMPLICIT[id].window;
  const cx = (w.x[0] + w.x[1]) / 2;
  const cy = (w.y[0] + w.y[1]) / 2;
  const hx = w.x[1] - w.x[0];
  const hy = w.y[1] - w.y[0];
  const h = Math.max(hx, hy);
  return { x: [cx - h, cx + h], y: [cy - h, cy + h] };
}

const cache = new Map<ImplicitId, Polyline[]>();

/** The curve as polylines sampled from its parametrisation, broken where it leaves the sampling box. */
export function curvePolylines(id: ImplicitId): Polyline[] {
  const hit = cache.get(id);
  if (hit) return hit;
  const box = sampleBox(id);
  const inside = (p: Vec2) => p[0] >= box.x[0] && p[0] <= box.x[1] && p[1] >= box.y[0] && p[1] <= box.y[1];
  const out: Polyline[] = [];
  for (const pc of IMPLICIT[id].pieces) {
    let cur: Vec2[] = [];
    const flush = () => {
      if (cur.length > 1) out.push({ points: cur, closed: false });
      cur = [];
    };
    const n = pc.samples;
    const last = pc.closed ? n - 1 : n;
    for (let i = 0; i <= last; i++) {
      const p = pc.p(pc.t0 + ((pc.t1 - pc.t0) * i) / n);
      if (Number.isFinite(p[0]) && Number.isFinite(p[1]) && inside(p)) cur.push(p);
      else flush();
    }
    if (pc.closed && cur.length === n) {
      out.push({ points: cur, closed: true });
      cur = [];
    }
    flush();
  }
  cache.set(id, out);
  return out;
}

interface Loc {
  line: number;
  /** segment index: between points[seg] and points[seg + 1] (wrapping on a closed line) */
  seg: number;
  /** position along the segment, 0..1 */
  u: number;
  p: Vec2;
  d: number;
}

const segCount = (pl: Polyline) => (pl.closed ? pl.points.length : pl.points.length - 1);
const segEnd = (pl: Polyline, i: number) => pl.points[(i + 1) % pl.points.length];
const inAvoid = (id: ImplicitId, p: Vec2) => {
  const a = IMPLICIT[id].avoid;
  return a !== null && Math.hypot(p[0] - a.at[0], p[1] - a.at[1]) < a.r;
};

/** the nearest point of the sampled curve to q, ignoring segments that enter the avoided disc */
function locate(id: ImplicitId, q: Vec2): Loc | null {
  let best: Loc | null = null;
  const lines = curvePolylines(id);
  lines.forEach((pl, li) => {
    for (let i = 0; i < segCount(pl); i++) {
      const a = pl.points[i];
      const b = segEnd(pl, i);
      if (inAvoid(id, a) || inAvoid(id, b)) continue;
      const ex = b[0] - a[0];
      const ey = b[1] - a[1];
      const L2 = ex * ex + ey * ey;
      const u = L2 > 0 ? Math.max(0, Math.min(1, ((q[0] - a[0]) * ex + (q[1] - a[1]) * ey) / L2)) : 0;
      const p: Vec2 = [a[0] + u * ex, a[1] + u * ey];
      const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
      if (!best || d < best.d) best = { line: li, seg: i, u, p, d };
    }
  });
  return best;
}

/** Newton steps along the normal onto F = 0. Returns null if they wander (more than 0.2 away) or fail. */
export function polish(id: ImplicitId, p: Vec2): Vec2 | null {
  const s = IMPLICIT[id];
  let [x, y] = p;
  for (let i = 0; i < 6; i++) {
    const f = s.F(x, y);
    const [gx, gy] = s.normal(x, y);
    const g2 = gx * gx + gy * gy;
    if (!(g2 > 1e-20)) return null;
    x -= (f * gx) / g2;
    y -= (f * gy) / g2;
    if (Math.abs(f) < 1e-15) break;
  }
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.hypot(x - p[0], y - p[1]) > 0.2) return null;
  return [x, y];
}

/**
 * The point of the curve nearest to q (the sampled curve's nearest point polished onto F = 0), never within the
 * avoided disc. With `snap` > 0, a stored special point within `snap` of the result replaces it (exactly).
 */
export function projectToCurve(id: ImplicitId, q: Vec2, snap = 0): Vec2 {
  // the default point is exact and on the curve: keep it bit for bit, so its exact slope text is shown
  const d0 = IMPLICIT[id].point;
  if (Math.hypot(d0[0] - q[0], d0[1] - q[1]) < 1e-6) return [d0[0], d0[1]];
  const loc = locate(id, q);
  if (!loc) return IMPLICIT[id].point;
  let p = polish(id, loc.p) ?? loc.p;
  if (inAvoid(id, p)) p = loc.p;
  if (snap > 0) {
    const sp = nearSpecial(id, p, snap);
    if (sp) p = sp.point.at;
  }
  return p;
}

/**
 * Move along the curve from p by arc length `d` (sign = the direction of the sampled curve), stopping at the end of a
 * piece or at the edge of the avoided disc; the result is polished onto the curve.
 */
export function walkAlong(id: ImplicitId, p: Vec2, d: number, snap = 0): Vec2 {
  const loc = locate(id, p);
  if (!loc) return p;
  const pl = curvePolylines(id)[loc.line];
  const nSeg = segCount(pl);
  let seg = loc.seg;
  let u = loc.u;
  let left = Math.abs(d);
  const fwd = d >= 0;
  let pos: Vec2 = loc.p;
  for (let guard = 0; left > 0 && guard < 4 * nSeg; guard++) {
    const a = pl.points[seg];
    const b = segEnd(pl, seg);
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const room = (fwd ? 1 - u : u) * L;
    const take = Math.min(room, left);
    const nu = L > 0 ? u + ((fwd ? 1 : -1) * take) / L : u;
    const np: Vec2 = [a[0] + nu * (b[0] - a[0]), a[1] + nu * (b[1] - a[1])];
    if (inAvoid(id, np)) break;
    pos = np;
    u = nu;
    left -= take;
    if (left <= 0) break;
    // the next segment
    if (fwd) {
      if (seg + 1 >= nSeg && !pl.closed) break;
      seg = (seg + 1) % nSeg;
      u = 0;
    } else {
      if (seg === 0 && !pl.closed) break;
      seg = (seg - 1 + nSeg) % nSeg;
      u = 1;
    }
  }
  let out = polish(id, pos) ?? pos;
  if (inAvoid(id, out)) out = pos;
  if (snap > 0) {
    const sp = nearSpecial(id, out, snap);
    if (sp) out = sp.point.at;
  }
  return out;
}

/**
 * The piece of the curve through p that is a graph y(x): from p along the sampled curve both ways while the
 * denominator of y′ keeps its sign (so x keeps moving the same way) and the node is not reached. Null where the
 * tangent at p is vertical (or at the node): no neighbourhood of p on the curve is a graph y(x).
 */
export function graphPiece(id: ImplicitId, p: Vec2): Vec2[] | null {
  const s = IMPLICIT[id];
  const k = slopeAt(id, p[0], p[1]).kind;
  if (k === 'vertical' || k === 'none') return null;
  const sg = Math.sign(s.den(p[0], p[1]));
  const loc = locate(id, p);
  if (!loc) return null;
  const pl = curvePolylines(id)[loc.line];
  const n = pl.points.length;
  const ok = (q: Vec2) => Math.sign(s.den(q[0], q[1])) === sg && !inAvoid(id, q);
  const fwd: Vec2[] = [];
  const back: Vec2[] = [];
  // forward from the segment's end, backward from its start
  for (let k2 = 0, i = loc.seg + 1; k2 < n; k2++, i++) {
    if (!pl.closed && i >= n) break;
    const q = pl.points[i % n];
    if (!ok(q)) break;
    fwd.push(q);
  }
  for (let k2 = 0, i = loc.seg; k2 < n; k2++, i--) {
    if (!pl.closed && i < 0) break;
    const q = pl.points[((i % n) + n) % n];
    if (!ok(q)) break;
    back.push(q);
  }
  // on a closed curve that is a graph all round (it never is here) the two walks would overlap: keep them apart
  if (pl.closed && fwd.length + back.length > n) return null;
  return [...back.reverse(), p, ...fwd];
}

/** The other points of the curve above p's x (exact roots), excluding p itself. */
export function otherPointsAbove(id: ImplicitId, p: Vec2): Vec2[] {
  return IMPLICIT[id]
    .ysAt(p[0])
    .filter((y) => Math.abs(y - p[1]) > 1e-6 * (1 + Math.abs(y)))
    .map((y) => [p[0], y] as Vec2);
}

/* ---------------------------------------------------------------- related rates */

export type RelatedId = 'ladder' | 'cone' | 'balloon';
export const RELATED_IDS: RelatedId[] = ['ladder', 'cone', 'balloon'];
export const isRelatedId = (s: unknown): s is RelatedId => typeof s === 'string' && (RELATED_IDS as string[]).includes(s);

export interface RelatedSpec {
  id: RelatedId;
  /** Hebrew name of the problem */
  name: string;
  /** the driving quantity q (the slider): its symbol, Hebrew description, unit, range, default */
  qName: string;
  qLabel: string;
  qUnit: string;
  range: [number, number];
  q0: number;
  /** the given rate: its name, value and unit */
  rateName: string;
  rate: number;
  rateUnit: string;
  /** the quantity whose rate is asked, its value as a function of q, its rate (exact closed form) */
  depName: string;
  depLabel: string;
  depUnit: string;
  dep: (q: number) => number;
  depRateName: string;
  depRateUnit: string;
  depRate: (q: number) => number;
  /** the closed form of the asked rate, plain text */
  depRateText: string;
  /** the exact value of the asked rate at the default q, plain text (deliberately not at the question bank's cases
   *  x = 3, h = 4, r = 5, so the figure never prints a Check answer) */
  exact: { q: number; text: string }[];
  /** the time unit, in Hebrew, and how much of it passes per second of animation */
  timeUnit: string;
  timePerSecond: number;
  /** q after time τ (in the problem's time unit) from q, exactly; may leave the range */
  advance: (q: number, tau: number) => number;
}

export const LADDER_L = 5;
export const CONE_RATE = 2;
export const BALLOON_RATE = 2;

/** the cone's water volume at depth h (r = h/2): V = πh³/12 */
export const coneVolume = (h: number) => (Math.PI * h * h * h) / 12;
const coneDepth = (V: number) => Math.cbrt((12 * V) / Math.PI);

export const RELATED: Record<RelatedId, RelatedSpec> = {
  ladder: {
    id: 'ladder',
    name: 'סולם באורך 5 מ׳ נשען על קיר',
    qName: 'x',
    qLabel: 'המרחק של רגל הסולם מהקיר',
    qUnit: 'מ׳',
    range: [0.2, 4.95],
    q0: 3.5,
    rateName: 'dx/dt',
    rate: 1,
    rateUnit: 'מ׳/ש׳',
    depName: 'y',
    depLabel: 'הגובה של ראש הסולם',
    depUnit: 'מ׳',
    dep: (x) => Math.sqrt(LADDER_L * LADDER_L - x * x),
    depRateName: 'dy/dt',
    depRateUnit: 'מ׳/ש׳',
    depRate: (x) => -(x / Math.sqrt(LADDER_L * LADDER_L - x * x)) * 1,
    depRateText: 'dy/dt = −(x/y)·dx/dt',
    exact: [{ q: 3.5, text: '−7/√51' }],
    timeUnit: 'ש׳',
    timePerSecond: 1,
    advance: (x, tau) => x + 1 * tau,
  },
  cone: {
    id: 'cone',
    name: 'מיכל בצורת חרוט הפוך שמתמלא מים',
    qName: 'h',
    qLabel: 'עומק המים',
    qUnit: 'מ׳',
    range: [0.2, 6],
    q0: 3,
    rateName: 'dV/dt',
    rate: CONE_RATE,
    rateUnit: 'מ״ק/דקה',
    depName: 'h',
    depLabel: 'עומק המים',
    depUnit: 'מ׳',
    dep: (h) => h,
    depRateName: 'dh/dt',
    depRateUnit: 'מ׳/דקה',
    depRate: (h) => (4 * CONE_RATE) / (Math.PI * h * h),
    depRateText: 'dh/dt = 8/(πh²)',
    exact: [{ q: 3, text: '8/(9π)' }],
    timeUnit: 'דקות',
    timePerSecond: 4,
    advance: (h, tau) => coneDepth(coneVolume(h) + CONE_RATE * tau),
  },
  balloon: {
    id: 'balloon',
    name: 'בלון כדורי שמתנפח',
    qName: 'r',
    qLabel: 'הרדיוס',
    qUnit: 'ס״מ',
    range: [0.5, 8],
    q0: 4,
    rateName: 'dr/dt',
    rate: BALLOON_RATE,
    rateUnit: 'ס״מ/ש׳',
    depName: 'V',
    depLabel: 'הנפח',
    depUnit: 'סמ״ק',
    dep: (r) => (4 / 3) * Math.PI * r * r * r,
    depRateName: 'dV/dt',
    depRateUnit: 'סמ״ק/ש׳',
    depRate: (r) => 4 * Math.PI * r * r * BALLOON_RATE,
    depRateText: 'dV/dt = 4πr²·dr/dt',
    exact: [{ q: 4, text: '128π' }],
    timeUnit: 'ש׳',
    timePerSecond: 1,
    advance: (r, tau) => r + BALLOON_RATE * tau,
  },
};

/** the exact text of the asked rate at q, when q is one of the stored values (within 1e-9) */
export const exactRate = (id: RelatedId, q: number): string | null => RELATED[id].exact.find((e) => Math.abs(e.q - q) < 1e-9)?.text ?? null;
