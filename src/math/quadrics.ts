/**
 * MODEL SPECIFICATION: quadric surfaces without mixed terms, and their sections by the planes x = c, y = c, z = c.
 *
 * Models:        the surface A·x² + B·y² + C·z² + G·x + H·y + I·z = D (seven real numbers; no xy, xz, yz terms). Every
 *                basic quadric of lesson 2.5 has this form: ellipsoid, sphere, cone, elliptic / hyperbolic paraboloid,
 *                hyperboloids of one and two sheets, cylinders.
 * Equations:     putting the plane z = c into the surface gives a conic in (u, v) = (x, y):
 *                    a·u² + b·v² + g·u + h·v = k,   (a, b, g, h, k) = (A, B, G, H, D − C·c² − I·c);
 *                x = c gives (u, v) = (y, z) with (B, C, H, I, D − A·c² − G·c); y = c gives (u, v) = (x, z) with
 *                (A, C, G, I, D − B·c² − H·c). Completing the square, a(u − u₀)² + b(v − v₀)² = k′ with u₀ = −g/2a,
 *                v₀ = −h/2b and k′ = k + g²/4a + h²/4b (a term whose coefficient is 0 drops out). The conic is then
 *                  a, b ≠ 0:  k′ = 0 → a point (ab > 0) or two lines through (u₀, v₀) (ab < 0);
 *                             k′ ≠ 0 → an ellipse (circle if a = b) when a, b, k′ share a sign, empty when a, b share a
 *                             sign and k′ has the other, a hyperbola when ab < 0 (branches open along u when k′/a > 0);
 *                  exactly one of a, b ≠ 0 (say a): a parabola v = (k − a·u² − g·u)/h when h ≠ 0; when h = 0, two
 *                             parallel lines u = u₀ ± √(k′/a), one double line (k′ = 0) or nothing;
 *                  a = b = 0: the line g·u + h·v = k (nothing when g = h = 0 and k ≠ 0).
 * Surface kind:  from the signs of A, B, C after completing the squares (kp = D + Σ lin²/4·coef): three squares of one
 *                sign → ellipsoid (sphere if equal) / a point / empty; two of one sign and one of the other → one sheet
 *                (kp·m > 0), two sheets (kp·m < 0) or a cone (kp = 0), m = the majority sign; two squares and a linear
 *                term in the third variable → a paraboloid (elliptic / circular when the signs agree, hyperbolic when
 *                they differ); two squares and no such term → a cylinder over the conic of the two; one square → a
 *                parabolic cylinder or planes; none → a plane.
 * Ignored:       mixed terms (rotated quadrics), and rounding: coefficients such as 1/9 are not exact in binary, so a
 *                coefficient or k′ is treated as 0 when |·| ≤ 1e-9 (ZERO). The presets' sections at the degenerate
 *                values (cone at z = 0, ellipsoid at z = ±1, hyperboloid at x = ±1) hit exactly 0 or about 1e-17.
 * Valid when:    coefficients of moderate size (|·| ≲ 100); the sampled curves are clipped to the box |u|, |v| ≤ R.
 * Sampling:      every sampled point is computed from the closed form (cos/sin, cosh/sinh, the solved variable), so it
 *                satisfies the surface equation to rounding (~1e-15 for the presets); tests check the residual.
 *
 * Drives the figure SurfaceLab (lesson 2.5). A drawn wireframe is a probe of the surface, never a proof of its type: the
 * type comes from the exact classification above.
 */

import { fmtDecimal, fmtInt, sqrtParts } from './space';

export type Vec3 = readonly [number, number, number];
export type Axis = 'x' | 'y' | 'z';
export type P2 = readonly [number, number];

export const ZERO = 1e-9;
const isZero = (x: number): boolean => Math.abs(x) <= ZERO;

/* ---------- the surface ---------- */

export interface Quadric {
  readonly A: number;
  readonly B: number;
  readonly C: number;
  readonly G: number;
  readonly H: number;
  readonly I: number;
  readonly D: number;
}

export const quadric = (A: number, B: number, C: number, G: number, H: number, I: number, D: number): Quadric => ({ A, B, C, G, H, I, D });

/** A·x² + B·y² + C·z² + G·x + H·y + I·z − D: zero on the surface. */
export const residual = (q: Quadric, p: Vec3): number => q.A * p[0] * p[0] + q.B * p[1] * p[1] + q.C * p[2] * p[2] + q.G * p[0] + q.H * p[1] + q.I * p[2] - q.D;

/** The gradient of the residual: the normal direction (pointing to the side where the residual grows). */
export const gradient = (q: Quadric, p: Vec3): Vec3 => [2 * q.A * p[0] + q.G, 2 * q.B * p[1] + q.H, 2 * q.C * p[2] + q.I];

export type PresetId = 'ellipsoid' | 'sphere' | 'cone' | 'paraboloid' | 'saddle' | 'hyperboloid1' | 'hyperboloid2' | 'cylinder' | 'pcyl';

export interface Preset {
  readonly id: PresetId;
  readonly q: Quadric;
  /** the equation as written in the lesson (text, LTR) */
  readonly eq: string;
  /** a bounded convex surface: the far side of the wireframe is hidden by the near side */
  readonly closed: boolean;
}

export const PRESETS: readonly Preset[] = [
  { id: 'ellipsoid', q: quadric(1 / 4, 1 / 9, 1, 0, 0, 0, 1), eq: 'x²/4 + y²/9 + z² = 1', closed: true },
  { id: 'sphere', q: quadric(1, 1, 1, 0, 0, 0, 4), eq: 'x² + y² + z² = 4', closed: true },
  { id: 'cone', q: quadric(1, 1, -1, 0, 0, 0, 0), eq: 'x² + y² − z² = 0', closed: false },
  { id: 'paraboloid', q: quadric(1, 1, 0, 0, 0, -1, 0), eq: 'z = x² + y²', closed: false },
  { id: 'saddle', q: quadric(1, -1, 0, 0, 0, -1, 0), eq: 'z = x² − y²', closed: false },
  { id: 'hyperboloid1', q: quadric(1, 1, -1, 0, 0, 0, 1), eq: 'x² + y² − z² = 1', closed: false },
  { id: 'hyperboloid2', q: quadric(1, 1, -1, 0, 0, 0, -1), eq: 'x² + y² − z² = −1', closed: false },
  { id: 'cylinder', q: quadric(1, 1, 0, 0, 0, 0, 1), eq: 'x² + y² = 1', closed: false },
  { id: 'pcyl', q: quadric(1, 0, 0, 0, 0, -1, 0), eq: 'z = x²', closed: false },
];

export const presetById = (id: string): Preset | undefined => PRESETS.find((p) => p.id === id);

/* ---------- the section as a conic ---------- */

/** a·u² + b·v² + g·u + h·v = k */
export interface Conic {
  readonly a: number;
  readonly b: number;
  readonly g: number;
  readonly h: number;
  readonly k: number;
}

/** The names of the plane coordinates (u, v) for a cutting plane perpendicular to `axis`. */
export const planeVars = (axis: Axis): [Axis, Axis] => (axis === 'z' ? ['x', 'y'] : axis === 'x' ? ['y', 'z'] : ['x', 'z']);

/** The section of the surface by the plane axis = c, as a conic in the two other variables. */
export function traceConic(q: Quadric, axis: Axis, c: number): Conic {
  if (axis === 'z') return { a: q.A, b: q.B, g: q.G, h: q.H, k: q.D - q.C * c * c - q.I * c };
  if (axis === 'x') return { a: q.B, b: q.C, g: q.H, h: q.I, k: q.D - q.A * c * c - q.G * c };
  return { a: q.A, b: q.C, g: q.G, h: q.I, k: q.D - q.B * c * c - q.H * c };
}

/** The point of the plane axis = c with plane coordinates (u, v). */
export function embed(axis: Axis, c: number, u: number, v: number): Vec3 {
  return axis === 'z' ? [u, v, c] : axis === 'x' ? [c, u, v] : [u, c, v];
}

export type ConicKind = 'ellipse' | 'circle' | 'hyperbola' | 'parabola' | 'two-lines' | 'parallel-lines' | 'double-line' | 'line' | 'point' | 'empty' | 'plane';

export interface ConicInfo {
  readonly kind: ConicKind;
  /** centre (ellipse, hyperbola, point, two lines), vertex (parabola), or a point of the line(s) */
  readonly u0: number;
  readonly v0: number;
  /** semi-axes along u and v (ellipse, circle, hyperbola); the circle's radius is ra */
  readonly ra: number;
  readonly rb: number;
  /** hyperbola: the axis the two branches open along */
  readonly transverse?: 'u' | 'v';
  /** parabola: the axis it is symmetric about, and p in v = v₀ + p(u − u₀)² (axis 'v') or u = u₀ + p(v − v₀)² (axis 'u') */
  readonly axis?: 'u' | 'v';
  readonly p?: number;
  /** two lines: v − v₀ = ±slope·(u − u₀) */
  readonly slope?: number;
  /** parallel or double lines: the lines are {lineVar} = const, at distance d from the centre line (0 for a double line) */
  readonly lineVar?: 'u' | 'v';
  readonly d?: number;
  /** k′ of the completed square (0 when no square) */
  readonly kp: number;
}

const base = { u0: 0, v0: 0, ra: 0, rb: 0, kp: 0 };

export function classifyConic(cn: Conic): ConicInfo {
  const { a, b, g, h, k } = cn;
  const A0 = isZero(a);
  const B0 = isZero(b);
  if (!A0 && !B0) {
    const u0 = -g / (2 * a) + 0;
    const v0 = -h / (2 * b) + 0;
    const kp = k + (g * g) / (4 * a) + (h * h) / (4 * b);
    if (isZero(kp)) {
      if (a * b > 0) return { ...base, kind: 'point', u0, v0, kp: 0 };
      return { ...base, kind: 'two-lines', u0, v0, slope: Math.sqrt(-a / b), kp: 0 };
    }
    if (a * b > 0) {
      if (kp / a < 0) return { ...base, kind: 'empty', u0, v0, kp };
      const ra = Math.sqrt(kp / a);
      const rb = Math.sqrt(kp / b);
      return { ...base, kind: Math.abs(a - b) <= 1e-12 * Math.max(Math.abs(a), Math.abs(b)) ? 'circle' : 'ellipse', u0, v0, ra, rb, kp };
    }
    return { ...base, kind: 'hyperbola', u0, v0, ra: Math.sqrt(Math.abs(kp / a)), rb: Math.sqrt(Math.abs(kp / b)), transverse: kp / a > 0 ? 'u' : 'v', kp };
  }
  if (!A0 || !B0) {
    // one square: u when a ≠ 0, v when b ≠ 0
    const [sq, lin, sg, sl, sk] = !A0 ? ([a, h, g, 'u', k] as const) : ([b, g, h, 'v', k] as const);
    if (!isZero(lin)) {
      // parabola: the other variable is the solved one
      const w0 = -sg / (2 * sq) + 0;
      const p = -sq / lin;
      const val = (sk - sq * w0 * w0 - sg * w0) / lin;
      return !A0 ? { ...base, kind: 'parabola', u0: w0, v0: val, axis: 'v', p } : { ...base, kind: 'parabola', u0: val, v0: w0, axis: 'u', p };
    }
    const kp = sk + (sg * sg) / (4 * sq);
    const c0 = -sg / (2 * sq) + 0;
    const at = (w: number) => (sl === 'u' ? { u0: w, v0: 0 } : { u0: 0, v0: w });
    if (isZero(kp)) return { ...base, kind: 'double-line', ...at(c0), lineVar: sl, d: 0, kp: 0 };
    if (kp / sq < 0) return { ...base, kind: 'empty', ...at(c0), kp };
    return { ...base, kind: 'parallel-lines', ...at(c0), lineVar: sl, d: Math.sqrt(kp / sq), kp };
  }
  if (!isZero(g) || !isZero(h)) return { ...base, kind: 'line', kp: 0 };
  return { ...base, kind: isZero(k) ? 'plane' : 'empty', kp: k };
}

/* ---------- sampled curves ---------- */

type Run = P2[];

/** Liang–Barsky: the part of the segment p→q inside |u|,|v| ≤ R, with whether each end is the original point. */
function clipSegment(p: P2, q: P2, R: number): { a: P2; b: P2; aIn: boolean; bIn: boolean } | null {
  let t0 = 0;
  let t1 = 1;
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const tests: [number, number][] = [
    [-dx, p[0] + R],
    [dx, R - p[0]],
    [-dy, p[1] + R],
    [dy, R - p[1]],
  ];
  for (const [pk, qk] of tests) {
    if (pk === 0) {
      if (qk < 0) return null;
    } else {
      const r = qk / pk;
      if (pk < 0) {
        if (r > t1) return null;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return null;
        if (r < t1) t1 = r;
      }
    }
  }
  return {
    a: t0 === 0 ? p : [p[0] + t0 * dx, p[1] + t0 * dy],
    b: t1 === 1 ? q : [p[0] + t1 * dx, p[1] + t1 * dy],
    aIn: t0 === 0,
    bIn: t1 === 1,
  };
}

/** Cut a polyline to the box |u|,|v| ≤ R: a list of runs (a single point is kept when inside). */
export function clipRuns(pts: readonly P2[], R: number): Run[] {
  if (pts.length === 1) return Math.abs(pts[0][0]) <= R && Math.abs(pts[0][1]) <= R ? [[pts[0]]] : [];
  const runs: Run[] = [];
  let cur: Run | null = null;
  for (let i = 1; i < pts.length; i++) {
    const s = clipSegment(pts[i - 1], pts[i], R);
    if (!s) {
      cur = null;
      continue;
    }
    if (!cur || !s.aIn) {
      cur = [s.a];
      runs.push(cur);
    }
    cur.push(s.b);
    if (!s.bIn) cur = null;
  }
  return runs;
}

/**
 * Cut the curve t ↦ f(t), t ∈ [t0, t1] sampled at n + 1 points, to the box |u|,|v| ≤ R. A point where the curve leaves
 * the box is found by bisection on t, so it lies on the curve itself (a chord's intersection with the box would not).
 */
function clipParam(f: (t: number) => P2, t0: number, t1: number, n: number, R: number): Run[] {
  const inside = (p: P2) => Math.abs(p[0]) <= R && Math.abs(p[1]) <= R;
  const edge = (tIn: number, tOut: number): P2 => {
    let a = tIn;
    let b = tOut;
    for (let i = 0; i < 60; i++) {
      const m = (a + b) / 2;
      if (inside(f(m))) a = m;
      else b = m;
    }
    return f(a);
  };
  const runs: Run[] = [];
  let cur: Run | null = null;
  let prevT = t0;
  let prev = f(t0);
  let prevIn = inside(prev);
  if (prevIn) {
    cur = [prev];
    runs.push(cur);
  }
  for (let i = 1; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    const p = f(t);
    const pIn = inside(p);
    if (pIn && prevIn) cur?.push(p);
    else if (pIn && !prevIn) {
      cur = [edge(t, prevT), p];
      runs.push(cur);
    } else if (!pIn && prevIn) {
      cur?.push(edge(prevT, t));
      cur = null;
    }
    prevT = t;
    prev = p;
    prevIn = pIn;
  }
  return runs;
}

/** The curve of the conic inside the box |u|,|v| ≤ R, as polylines in plane coordinates. */
export function sampleConic(cn: Conic, R = 3, n = 200): Run[] {
  const info = classifyConic(cn);
  const { u0, v0 } = info;
  const FAR = 4 * R + Math.abs(u0) + Math.abs(v0);
  switch (info.kind) {
    case 'ellipse':
    case 'circle':
      return clipParam((t) => [u0 + info.ra * Math.cos(t), v0 + info.rb * Math.sin(t)], 0, 2 * Math.PI, n, R);
    case 'hyperbola': {
      const T = Math.asinh((2 * R + Math.abs(u0) + Math.abs(v0)) / Math.min(info.ra, info.rb)) + 0.2;
      return [1, -1].flatMap((s) =>
        clipParam(
          (t) => (info.transverse === 'u' ? [u0 + s * info.ra * Math.cosh(t), v0 + info.rb * Math.sinh(t)] : [u0 + info.ra * Math.sinh(t), v0 + s * info.rb * Math.cosh(t)]),
          -T,
          T,
          n,
          R,
        ),
      );
    }
    case 'parabola': {
      const p = info.p as number;
      return clipParam((w) => (info.axis === 'v' ? [w, v0 + p * (w - u0) * (w - u0)] : [u0 + p * (w - v0) * (w - v0), w]), -R, R, n, R);
    }
    case 'two-lines': {
      const m = info.slope as number;
      return [1, -1].flatMap((s) =>
        clipRuns(
          [
            [u0 - FAR, v0 - s * m * FAR],
            [u0 + FAR, v0 + s * m * FAR],
          ],
          R,
        ),
      );
    }
    case 'parallel-lines':
    case 'double-line': {
      const d = info.d as number;
      const offs = info.kind === 'double-line' ? [0] : [d, -d];
      return offs.flatMap((o) =>
        info.lineVar === 'u'
          ? clipRuns(
              [
                [u0 + o, -FAR],
                [u0 + o, FAR],
              ],
              R,
            )
          : clipRuns(
              [
                [-FAR, v0 + o],
                [FAR, v0 + o],
              ],
              R,
            ),
      );
    }
    case 'line': {
      const { g, h, k } = cn;
      return Math.abs(h) >= Math.abs(g)
        ? clipRuns(
            [
              [-FAR, (k + g * FAR) / h],
              [FAR, (k - g * FAR) / h],
            ],
            R,
          )
        : clipRuns(
            [
              [(k + h * FAR) / g, -FAR],
              [(k - h * FAR) / g, FAR],
            ],
            R,
          );
    }
    case 'point':
      return clipRuns([[u0, v0]], R);
    default:
      return [];
  }
}

/** The section of the surface by axis = c inside the box |x|,|y|,|z| ≤ R, as 3D polylines. */
export function sampleTrace(q: Quadric, axis: Axis, c: number, R = 3, n = 200): Vec3[][] {
  return sampleConic(traceConic(q, axis, c), R, n).map((run) => run.map(([u, v]) => embed(axis, c, u, v)));
}

/* ---------- the surface kind ---------- */

export type SurfaceKind =
  | 'ellipsoid'
  | 'sphere'
  | 'cone'
  | 'paraboloid-elliptic'
  | 'paraboloid-circular'
  | 'paraboloid-hyperbolic'
  | 'hyperboloid-one'
  | 'hyperboloid-two'
  | 'cylinder-elliptic'
  | 'cylinder-circular'
  | 'cylinder-hyperbolic'
  | 'cylinder-parabolic'
  | 'cylinder-degenerate'
  | 'planes'
  | 'plane'
  | 'point'
  | 'empty';

export function surfaceKind(q: Quadric): SurfaceKind {
  const co = [q.A, q.B, q.C];
  const lin = [q.G, q.H, q.I];
  const sq = co.map((x) => !isZero(x));
  const n = sq.filter(Boolean).length;
  if (n === 3) {
    const kp = q.D + co.reduce((s, c, i) => s + (lin[i] * lin[i]) / (4 * c), 0);
    const pos = co.filter((x) => x > 0).length;
    if (pos === 3 || pos === 0) {
      const t = kp * (pos === 3 ? 1 : -1);
      if (isZero(t)) return 'point';
      if (t < 0) return 'empty';
      const same = Math.abs(co[0] - co[1]) <= 1e-12 * Math.abs(co[0]) && Math.abs(co[1] - co[2]) <= 1e-12 * Math.abs(co[1]);
      return same ? 'sphere' : 'ellipsoid';
    }
    const t = kp * (pos === 2 ? 1 : -1);
    return isZero(t) ? 'cone' : t > 0 ? 'hyperboloid-one' : 'hyperboloid-two';
  }
  if (n === 2) {
    const j = sq.indexOf(false);
    const [i1, i2] = [0, 1, 2].filter((i) => i !== j);
    if (!isZero(lin[j])) {
      if (co[i1] * co[i2] < 0) return 'paraboloid-hyperbolic';
      return Math.abs(co[i1] - co[i2]) <= 1e-12 * Math.abs(co[i1]) ? 'paraboloid-circular' : 'paraboloid-elliptic';
    }
    const kind = classifyConic({ a: co[i1], b: co[i2], g: lin[i1], h: lin[i2], k: q.D }).kind;
    if (kind === 'circle') return 'cylinder-circular';
    if (kind === 'ellipse') return 'cylinder-elliptic';
    if (kind === 'hyperbola') return 'cylinder-hyperbolic';
    return 'cylinder-degenerate';
  }
  if (n === 1) {
    const i = sq.indexOf(true);
    return lin.some((l, k) => k !== i && !isZero(l)) ? 'cylinder-parabolic' : 'planes';
  }
  if (lin.some((l) => !isZero(l))) return 'plane';
  return 'empty';
}

/* ---------- exact text (signs as U+2212, fractions, k√m) ---------- */

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

/** x as n/d with the smallest d ≤ maxDen within 1e-9, or null. */
export function toFraction(x: number, maxDen = 144): { n: number; d: number } | null {
  for (let d = 1; d <= maxDen; d++) {
    const n = Math.round(x * d);
    if (Math.abs(x - n / d) <= 1e-9 * Math.max(1, Math.abs(x))) return { n, d };
  }
  return null;
}

/** "3/4", "−2", "0.3333" (a decimal when no small fraction fits). */
export function fmtRational(x: number): string {
  const f = toFraction(x);
  if (!f) return fmtDecimal(x);
  return f.d === 1 ? fmtInt(f.n) : `${fmtInt(f.n)}/${f.d}`;
}

/** √x for x ≥ 0 in exact form when x is a small fraction: "√3", "3√3/2", "2/3"; a decimal otherwise. */
export function fmtSqrtRational(x: number): string {
  const f = toFraction(Math.max(0, x));
  if (!f) return fmtDecimal(Math.sqrt(x));
  const { k, m } = sqrtParts(f.n * f.d);
  if (f.n === 0) return '0';
  const g = gcd(k, f.d);
  const kk = k / g;
  const dd = f.d / g;
  const num = m === 1 ? String(kk) : kk === 1 ? `√${m}` : `${kk}√${m}`;
  return dd === 1 ? num : `${num}/${dd}`;
}

/** Σ coef·body as text: bodies like "x²", "y", or "" for a constant. "x²/4 + y²/9", "x² − y", "0". */
export function fmtTerms(terms: readonly (readonly [number, string])[]): string {
  let s = '';
  for (const [coef, body] of terms) {
    if (isZero(coef)) continue;
    const mag = Math.abs(coef);
    let t: string;
    if (body === '') t = fmtRational(mag);
    else if (Math.abs(mag - 1) <= 1e-12) t = body;
    else {
      const inv = 1 / mag;
      const fr = toFraction(mag);
      if (Math.abs(inv - Math.round(inv)) <= 1e-9) t = `${body}/${Math.round(inv)}`;
      else t = fr ? `(${fmtRational(mag)})${body}` : `${fmtDecimal(mag)}${body}`;
    }
    s += s === '' ? `${coef < 0 ? '−' : ''}${t}` : ` ${coef < 0 ? '−' : '+'} ${t}`;
  }
  return s === '' ? '0' : s;
}

/** "x²/4 + y²/9 + z² = 1": the surface in standard written form. */
export function formatQuadric(q: Quadric): string {
  return `${fmtTerms([
    [q.A, 'x²'],
    [q.B, 'y²'],
    [q.C, 'z²'],
    [q.G, 'x'],
    [q.H, 'y'],
    [q.I, 'z'],
  ])} = ${fmtRational(q.D)}`;
}

/**
 * The surface's written equation with the plane variable replaced by its value: "x²/4 + y²/9 + (1/2)² = 1". A negative
 * or fractional value is bracketed, except where it is a whole side of the equation on its own ("−1 = x² + y²").
 */
export function substitutePlane(eq: string, axis: Axis, c: number): string {
  const val = fmtRational(c);
  const wrapped = c < 0 || val.includes('/') || !Number.isInteger(c) ? `(${val})` : val;
  const sides = eq.split(' = ');
  return sides.map((side) => (side === axis ? val : side.split(axis).join(wrapped))).join(' = ');
}

/**
 * The section's simplified equation in its own variables: a parabola solved for its variable ("z = y² + 1/4"), every
 * other conic as a·u² + b·v² + g·u + h·v = k ("x²/4 + y²/9 = 3/4").
 */
export function fmtConicEquation(cn: Conic, names: readonly [string, string]): string {
  const [u, v] = names;
  const info = classifyConic(cn);
  if (info.kind === 'parabola') {
    const { a, b, g, h, k } = cn;
    const [solved, w, sq, lin, den] = info.axis === 'v' ? [v, u, a, g, h] : [u, v, b, h, g];
    // "z = 1 − y²" rather than "z = −y² + 1" when the square is negative and the constant positive
    const poly: [number, string][] = [
      [-sq / den, `${w}²`],
      [-lin / den, w],
      [k / den, ''],
    ];
    if (poly[0][0] < 0 && poly[2][0] > 0) poly.reverse();
    return `${solved} = ${fmtTerms(poly)}`;
  }
  // a line with one variable only is solved for it: "z = 1" rather than "−z = −1"
  if (isZero(cn.a) && isZero(cn.b) && isZero(cn.g) !== isZero(cn.h)) {
    return isZero(cn.h) ? `${u} = ${fmtRational(cn.k / cn.g)}` : `${v} = ${fmtRational(cn.k / cn.h)}`;
  }
  return `${fmtTerms([[cn.a, `${u}²`], [cn.b, `${v}²`], [cn.g, u], [cn.h, v]])} = ${fmtRational(cn.k)}`;
}

/** The lines of a degenerate section as text: "z = ±x", "y = ±√3/2", "x = 0"; null when the section is not lines. */
export function fmtLines(cn: Conic, names: readonly [string, string]): string | null {
  const [u, v] = names;
  const info = classifyConic(cn);
  const c0 = (x: number) => (isZero(x) ? '0' : fmtRational(x));
  if (info.kind === 'two-lines') {
    if (!isZero(info.u0) || !isZero(info.v0)) return null;
    const m = fmtSqrtRational((info.slope as number) ** 2);
    return m === '1' ? `${v} = ±${u}` : `${v} = ±${/[√/]/.test(m) ? `${m}·` : m}${u}`;
  }
  const name = info.lineVar === 'u' ? u : v;
  const mid = info.lineVar === 'u' ? info.u0 : info.v0;
  if (info.kind === 'double-line') return `${name} = ${c0(mid)}`;
  if (info.kind === 'parallel-lines') {
    const d = fmtSqrtRational((info.d as number) ** 2);
    return isZero(mid) ? `${name} = ±${d}` : `${name} = ${c0(mid)} ± ${d}`;
  }
  return null;
}
