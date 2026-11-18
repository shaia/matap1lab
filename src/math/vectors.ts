/**
 * Vector algebra for lessons 1.1, 1.2, 1.4 and 1.5: components, length and direction, the unit vector, the dot
 * product (the angle between two vectors and the projection of one on a direction) and the cross product (the
 * area two vectors span and its right-hand direction). The figure VectorLab draws with it; the lessons' worked
 * examples and workbook recompute with it. The plain tuple helpers stay in vec.ts.
 *
 * MODEL SPECIFICATION
 * - System: arrows in a Euclidean space of two or three dimensions, given by their Cartesian components on a
 *   right-handed set of axes î, ĵ, k̂ (î to the right and ĵ up the page, k̂ points out of it). A plane vector
 *   (a₁, a₂) is the space vector (a₁, a₂, 0).
 * - Definitions used:
 *     a·b = |a||b| cos θ = a₁b₁ + a₂b₂ + a₃b₃,
 *     a×b = (a₂b₃ − a₃b₂, a₃b₁ − a₁b₃, a₁b₂ − a₂b₁),  |a×b| = |a||b| sin θ,
 *   where θ ∈ [0, π] is the angle between a and b. In the plane only (a×b)_z = a₁b₂ − a₂b₁ survives:
 *   positive is ⊙ (out of the page, the turn from a to b is counter-clockwise), negative is ⊗.
 * - Boundary: none.
 * - Ignored: units (every function works in the caller's) and any transformation law beyond rotations of the axes.
 * - Valid when: the components are finite. A direction is defined only for a nonzero vector.
 * - Failure modes: the angle of the zero vector is undefined; `toPolar` returns angle 0 for it and
 *   `angleBetween*` returns NaN when either vector is zero. arccos loses digits near 0 and π (a change δ in
 *   cos θ moves θ by δ/sin θ), so angles between vectors are computed as atan2(|a×b|, a·b), which keeps full
 *   relative accuracy at every angle.
 */

import { cross3, dot, dot3, len, len3, scale3, sub3, type Vec2, type Vec3 } from './vec';

/** The components of a plane vector of length `mag` at angle `angle` [rad], counter-clockwise from +x. */
export const fromPolar = (mag: number, angle: number): Vec2 => [mag * Math.cos(angle), mag * Math.sin(angle)];

/** Length and direction of a plane vector; the angle is in (−π, π], counter-clockwise from +x (atan2 picks the quadrant). */
export function toPolar(v: Vec2): { mag: number; angle: number } {
  return { mag: len(v), angle: Math.atan2(v[1], v[0]) };
}

/** A plane vector as a space vector in the plane z = 0. */
export const lift = (v: Vec2): Vec3 => [v[0], v[1], 0];

/** The z component of a×b for plane vectors: a₁b₂ − a₂b₁. Positive: ⊙, out of the page. */
export const crossZ = (a: Vec2, b: Vec2): number => a[0] * b[1] - a[1] * b[0];

/** The angle between two space vectors, in [0, π] radians; NaN if either is zero. */
export function angleBetween3(a: Vec3, b: Vec3): number {
  if (len3(a) === 0 || len3(b) === 0) return NaN;
  return Math.atan2(len3(cross3(a, b)), dot3(a, b));
}

/** The angle between two plane vectors, in [0, π] radians; NaN if either is zero. */
export const angleBetween = (a: Vec2, b: Vec2): number => angleBetween3(lift(a), lift(b));

/** The signed turn from a to b in the plane, in (−π, π]: positive counter-clockwise (then a×b is ⊙). */
export const signedTurn = (a: Vec2, b: Vec2): number => Math.atan2(crossZ(a, b), dot(a, b));

/** The scalar projection (the component) of a along the direction of `onto`: a·û. */
export const scalarProjection3 = (a: Vec3, onto: Vec3): number => dot3(a, onto) / len3(onto);

/** The plane version of `scalarProjection3`. */
export const scalarProjection = (a: Vec2, onto: Vec2): number => dot(a, onto) / len(onto);

/** The part of a along `onto`: (a·û) û. */
export function vectorProjection3(a: Vec3, onto: Vec3): Vec3 {
  const l = len3(onto);
  return scale3(onto, dot3(a, onto) / (l * l));
}

/** The part of a perpendicular to `onto`: a − (a·û) û. */
export const perpendicularPart3 = (a: Vec3, onto: Vec3): Vec3 => sub3(a, vectorProjection3(a, onto));

/** The area of the parallelogram a and b span: |a×b|. */
export const parallelogramArea3 = (a: Vec3, b: Vec3): number => len3(cross3(a, b));

/** The area of the triangle with corners p, q, r: ½|(q − p)×(r − p)|. */
export const triangleArea3 = (p: Vec3, q: Vec3, r: Vec3): number => 0.5 * parallelogramArea3(sub3(q, p), sub3(r, p));

/** The scalar triple product a·(b×c): the signed volume of the box the three vectors span. */
export const tripleProduct = (a: Vec3, b: Vec3, c: Vec3): number => dot3(a, cross3(b, c));

/** |a + b| from the two lengths and the angle θ between the vectors: √(|a|² + |b|² + 2|a||b| cos θ). */
export const sumMagnitude = (A: number, B: number, theta: number): number => Math.sqrt(A * A + B * B + 2 * A * B * Math.cos(theta));

/** Which way a z component points, seen from in front of the page; |z| ≤ eps counts as zero. */
export function depthOf(z: number, eps = 1e-12): 'out' | 'in' | 'none' {
  if (Math.abs(z) <= eps) return 'none';
  return z > 0 ? 'out' : 'in';
}
