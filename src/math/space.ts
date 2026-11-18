/**
 * MODEL SPECIFICATION
 *
 * System:        analytic geometry of ℝ³ with a right-handed frame (x, y, z): the objects of lessons 1.3-1.5.
 *                  plane      ax + by + cz = d, with normal n = (a, b, c) and d = n·P₀ for any point P₀ on it
 *                  line       X(t) = A + t·v, with a point A and a direction v ≠ 0
 *                  vectors    a, b, c ∈ ℝ³; the cross product is the cofactor formula
 *                             a×b = (a₂b₃ − a₃b₂, a₃b₁ − a₁b₃, a₁b₂ − a₂b₁), which is the expansion of the symbolic
 *                             determinant with rows (î ĵ k̂), a, b along its first row
 *                  det3       the 3×3 determinant by cofactors along the first row,
 *                             det3(r₁, r₂, r₃) = r₁₁·M₁ − r₁₂·M₂ + r₁₃·M₃, where M_j is det2 of the rows r₂, r₃ with
 *                             column j deleted
 *                  triple     a·(b×c), the scalar triple product. Convention fixed by this file: it equals
 *                             det3(a, b, c), the determinant whose ROWS are a, b, c in this order
 *                             (expand a·(b×c) along a: the minors are exactly the components of b×c)
 *                  measures   area of the parallelogram on a, b: |a×b|; volume of the parallelepiped on a, b, c:
 *                             |a·(b×c)|; the sign of a·(b×c) is the orientation (+1 right-handed, −1 left-handed,
 *                             0 coplanar)
 * Plane facts:   signed distance from X to the plane is (n·X − d)/|n| (positive on the side n points to); the foot of
 *                the perpendicular is X − ((n·X − d)/|n|²)·n; the line meets the plane where
 *                n·(A + t·v) = d, i.e. t = (d − n·A)/(n·v) when n·v ≠ 0; n·v = 0 means parallel, and the line lies
 *                in the plane when moreover n·A = d.
 * Exactness:     for integer inputs every quantity above (coefficients, determinants, residuals, products) is an
 *                integer computed exactly in IEEE doubles as long as it stays below 2⁵³; t, the intersection point and
 *                the foot are rationals, given exactly by the `...Exact` functions as {numerator, denominator} pairs
 *                (denominator > 0, lowest terms). Lengths (|n|, |a×b|) are square roots of integers: `sqrtParts` and
 *                `fmtQuotSqrt` give the exact form k√m.
 * Ignored:       rounding in the float versions (`planeDistance`, `footOnPlane`, `intersectLinePlane`): relative
 *                error ~1e-15 for inputs of size ≲ 10.
 * Valid when:    n ≠ 0 for any plane function (a zero normal is not a plane: signed distances are NaN), v ≠ 0 for lines.
 *
 * Drives the figure SpaceLab (lessons 1.3-1.5). A numerical probe never proves: tests/math/space.test.ts checks the
 * identities on integer inputs, exactly.
 */

import { cross3, dot3, len3, sub3, type Vec3 } from './vec';

export type { Vec3 };

/* ---------- planes ---------- */

export interface Plane {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
}

/** The plane through p perpendicular to n: ax + by + cz = d with (a, b, c) = n and d = n·p. */
export const planeFromPointNormal = (p: Vec3, n: Vec3): Plane => ({ a: n[0], b: n[1], c: n[2], d: dot3(n, p) });

/**
 * The plane through three points: normal (q − p)×(r − p). Collinear points give the zero normal (no plane); the
 * caller checks `planeNormal(pl)` against zero.
 */
export const planeThroughPoints = (p: Vec3, q: Vec3, r: Vec3): Plane => planeFromPointNormal(p, cross3(sub3(q, p), sub3(r, p)));

export const planeNormal = (pl: Plane): Vec3 => [pl.a, pl.b, pl.c];

/** ax + by + cz − d at x: exactly 0 for integers when x is on the plane. */
export const planeResidual = (pl: Plane, x: Vec3): number => pl.a * x[0] + pl.b * x[1] + pl.c * x[2] - pl.d;

/** Whether x is on the plane: |residual| ≤ tol (tol = 0 is exact and right for integer inputs). */
export const onPlane = (pl: Plane, x: Vec3, tol = 0): boolean => Math.abs(planeResidual(pl, x)) <= tol;

/** (n·x − d)/|n|: positive on the side n points to. NaN for the zero normal. */
export const planeDistanceSigned = (pl: Plane, x: Vec3): number => {
  const l = len3(planeNormal(pl));
  return l === 0 ? NaN : planeResidual(pl, x) / l;
};

export const planeDistance = (pl: Plane, x: Vec3): number => Math.abs(planeDistanceSigned(pl, x));

/** The foot of the perpendicular from x to the plane: x − ((n·x − d)/|n|²)·n. */
export function footOnPlane(pl: Plane, x: Vec3): Vec3 {
  const n = planeNormal(pl);
  const nn = dot3(n, n);
  const k = planeResidual(pl, x) / nn;
  return [x[0] - k * n[0], x[1] - k * n[1], x[2] - k * n[2]];
}

/** The angle between two planes, in [0, π/2]: the angle between their normals, folded. */
export function angleBetweenPlanes(p1: Plane, p2: Plane): number {
  const n1 = planeNormal(p1);
  const n2 = planeNormal(p2);
  const c = Math.abs(dot3(n1, n2)) / (len3(n1) * len3(n2));
  return Math.acos(Math.min(1, c));
}

/** The angle between a line with direction v and a plane, in [0, π/2]: 0 when parallel, π/2 when perpendicular. */
export function angleLinePlane(v: Vec3, pl: Plane): number {
  const n = planeNormal(pl);
  const s = Math.abs(dot3(n, v)) / (len3(n) * len3(v));
  return Math.asin(Math.min(1, s));
}

/* ---------- lines ---------- */

/** The point A + t·v. */
export const lineAt = (a: Vec3, v: Vec3, t: number): Vec3 => [a[0] + t * v[0], a[1] + t * v[1], a[2] + t * v[2]];

/** The distance from p to the line A + t·v: |(p − A)×v| / |v|. NaN for v = 0. */
export function distancePointLine(p: Vec3, a: Vec3, v: Vec3): number {
  const l = len3(v);
  return l === 0 ? NaN : len3(cross3(sub3(p, a), v)) / l;
}

export type LinePlane =
  | { kind: 'parallel' }
  | { kind: 'contained' }
  | { kind: 'point'; t: number; point: Vec3 };

/**
 * Where the line A + t·v meets the plane. n·v = 0 (to within 1e-12 relative to |n||v|) is parallel; with n·A = d as
 * well (|residual| ≤ 1e-12·|n||A|, or ≤ 1e-12 when A = 0) it is contained. Exact for integers: use
 * `intersectLinePlaneExact` for the rational t and point.
 */
export function intersectLinePlane(a: Vec3, v: Vec3, pl: Plane): LinePlane {
  const n = planeNormal(pl);
  const nv = dot3(n, v);
  const r0 = planeResidual(pl, a);
  const eps = 1e-12;
  if (Math.abs(nv) <= eps * len3(n) * len3(v)) {
    return Math.abs(r0) <= eps * Math.max(1, len3(n) * len3(a)) ? { kind: 'contained' } : { kind: 'parallel' };
  }
  const t = -r0 / nv;
  return { kind: 'point', t, point: lineAt(a, v, t) };
}

/* ---------- exact rationals (integer inputs) ---------- */

export interface Frac {
  readonly n: number;
  readonly d: number;
}

const gcd = (a: number, b: number): number => {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x;
};

/** n/d in lowest terms with d > 0. Integers only. */
export function frac(n: number, d = 1): Frac {
  if (d === 0) throw new RangeError('frac: zero denominator');
  const g = gcd(n, d) || 1;
  const s = d < 0 ? -1 : 1;
  return { n: (s * n) / g || 0, d: (s * d) / g };
}
export const fracToNumber = (f: Frac): number => f.n / f.d;

export type LinePlaneExact =
  | { kind: 'parallel' }
  | { kind: 'contained' }
  | { kind: 'point'; t: Frac; point: readonly [Frac, Frac, Frac] };

/**
 * The line–plane intersection for integer A, v and plane coefficients, exactly:
 * t = (d − n·A)/(n·v) and X_i = (A_i·(n·v) + (d − n·A)·v_i)/(n·v).
 */
export function intersectLinePlaneExact(a: Vec3, v: Vec3, pl: Plane): LinePlaneExact {
  const nv = pl.a * v[0] + pl.b * v[1] + pl.c * v[2];
  const num = -planeResidual(pl, a); // d − n·A
  if (nv === 0) return num === 0 ? { kind: 'contained' } : { kind: 'parallel' };
  return {
    kind: 'point',
    t: frac(num, nv),
    point: [frac(a[0] * nv + num * v[0], nv), frac(a[1] * nv + num * v[1], nv), frac(a[2] * nv + num * v[2], nv)],
  };
}

/** The foot of the perpendicular from an integer point to a plane with integer coefficients, exactly. */
export function footOnPlaneExact(pl: Plane, x: Vec3): readonly [Frac, Frac, Frac] {
  const nn = pl.a * pl.a + pl.b * pl.b + pl.c * pl.c;
  const r = planeResidual(pl, x);
  return [frac(x[0] * nn - r * pl.a, nn), frac(x[1] * nn - r * pl.b, nn), frac(x[2] * nn - r * pl.c, nn)];
}

/* ---------- determinants, triple product, measures ---------- */

/** | a b ; c d | = ad − bc */
export const det2 = (a: number, b: number, c: number, d: number): number => a * d - b * c;

/**
 * The three minors of the cofactor expansion along the first row: M₁ = det2 of rows 2, 3 without column 1, M₂ without
 * column 2, M₃ without column 3. det3 = r1₁·M₁ − r1₂·M₂ + r1₃·M₃.
 */
export function minorsFirstRow(r2: Vec3, r3: Vec3): readonly [number, number, number] {
  return [det2(r2[1], r2[2], r3[1], r3[2]), det2(r2[0], r2[2], r3[0], r3[2]), det2(r2[0], r2[1], r3[0], r3[1])];
}

/** The 3×3 determinant with rows r1, r2, r3, by cofactors along the first row. */
export function det3(r1: Vec3, r2: Vec3, r3: Vec3): number {
  const [m1, m2, m3] = minorsFirstRow(r2, r3);
  return r1[0] * m1 - r1[1] * m2 + r1[2] * m3;
}

/** a·(b×c); equal to det3(a, b, c), the determinant with ROWS a, b, c. */
export const tripleProduct = (a: Vec3, b: Vec3, c: Vec3): number => dot3(a, cross3(b, c));

/** Whether three vectors are coplanar: |a·(b×c)| ≤ tol (tol = 0 is exact for integers). */
export const coplanar = (a: Vec3, b: Vec3, c: Vec3, tol = 0): boolean => Math.abs(tripleProduct(a, b, c)) <= tol;

/** The area of the parallelogram on a and b: |a×b|. */
export const parallelogramArea = (a: Vec3, b: Vec3): number => len3(cross3(a, b));

/** The volume of the parallelepiped on a, b, c: |a·(b×c)|. */
export const parallelepipedVolume = (a: Vec3, b: Vec3, c: Vec3): number => Math.abs(tripleProduct(a, b, c));

/** +1 for a right-handed triple (a·(b×c) > 0), −1 for a left-handed one, 0 for coplanar. */
export const orientation = (a: Vec3, b: Vec3, c: Vec3): -1 | 0 | 1 => {
  const t = tripleProduct(a, b, c);
  return t > 0 ? 1 : t < 0 ? -1 : 0;
};

/* ---------- small predicates on integer vectors (used by the figure's tasks) ---------- */

export const isZero3 = (v: Vec3): boolean => v[0] === 0 && v[1] === 0 && v[2] === 0;

/** The vectors are parallel (or one is zero): a×b = 0. */
export const parallel3 = (a: Vec3, b: Vec3): boolean => isZero3(cross3(a, b));

export const nonzeroComponents = (v: Vec3): number => (v[0] !== 0 ? 1 : 0) + (v[1] !== 0 ? 1 : 0) + (v[2] !== 0 ? 1 : 0);

/** A nonzero vector with exactly one nonzero component lies on a coordinate axis. */
export const onAxis = (v: Vec3): boolean => nonzeroComponents(v) === 1;

/* ---------- exact text: signs as U+2212, fractions, k√m ---------- */

export const fmtInt = (x: number): string => (x < 0 ? `−${-x}` : String(x === 0 ? 0 : x));

export const fmtFrac = (f: Frac): string => (f.d === 1 ? fmtInt(f.n) : `${fmtInt(f.n)}/${f.d}`);

/** A decimal with 4 significant digits and no trailing zeros. */
export const fmtDecimal = (x: number): string => {
  if (!Number.isFinite(x)) return '—';
  const s = String(Number(x.toPrecision(4)));
  return s.startsWith('-') ? `−${s.slice(1)}` : s;
};

/** n = k²·m with m the largest square-free part: the exact form k√m of √n (n a non-negative integer). */
export function sqrtParts(n: number): { k: number; m: number } {
  if (n <= 0) return { k: 0, m: 1 };
  for (let k = Math.floor(Math.sqrt(n) + 1e-9); k >= 1; k--) {
    if (n % (k * k) === 0) return { k, m: n / (k * k) };
  }
  return { k: 1, m: n };
}

/** √n in exact form: "5", "2√3", "√35". */
export function fmtSqrt(n: number): string {
  const { k, m } = sqrtParts(n);
  if (n <= 0) return '0';
  return m === 1 ? String(k) : k === 1 ? `√${m}` : `${k}√${m}`;
}

/** p/√N in exact form, p ≥ 0 and N > 0 integers: "40/√35", "5/3", "2/(3√2)" (N = 18 = 3²·2 and p = 2). */
export function fmtQuotSqrt(p: number, N: number): string {
  if (p === 0) return '0';
  const { k, m } = sqrtParts(N);
  const f = frac(p, k);
  if (m === 1) return fmtFrac(f);
  return f.d === 1 ? `${f.n}/√${m}` : `${f.n}/(${f.d}√${m})`;
}

/** An affine expression c0 + c1·sym with integer coefficients: "1 + 2t", "−t", "3", "−2 − t". */
export function fmtAffine(c0: number, c1: number, sym = 't'): string {
  if (c1 === 0) return fmtInt(c0);
  const mag = Math.abs(c1) === 1 ? sym : `${Math.abs(c1)}${sym}`;
  if (c0 === 0) return `${c1 < 0 ? '−' : ''}${mag}`;
  return `${fmtInt(c0)} ${c1 < 0 ? '−' : '+'} ${mag}`;
}

/** "x − 3y + 5z = −20": the plane's equation with its actual numbers (integer coefficients). */
export function fmtPlaneEquation(pl: Plane): string {
  let s = '';
  for (const [coef, sym] of [
    [pl.a, 'x'],
    [pl.b, 'y'],
    [pl.c, 'z'],
  ] as const) {
    if (coef === 0) continue;
    const mag = Math.abs(coef) === 1 ? sym : `${Math.abs(coef)}${sym}`;
    s += s === '' ? `${coef < 0 ? '−' : ''}${mag}` : ` ${coef < 0 ? '−' : '+'} ${mag}`;
  }
  return `${s === '' ? '0' : s} = ${fmtInt(pl.d)}`;
}
