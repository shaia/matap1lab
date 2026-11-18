/**
 * Axonometric (orthographic) projection of ℝ³ onto the screen, for figures drawn on a 2D canvas (SpaceLab).
 *
 * The frame is right-handed with z up. The viewer looks at the origin from the direction
 *   toward = (sin az·cos el, −cos az·cos el, sin el)
 * (az, el in degrees; el > 0 looks down on the xy-plane). The screen axes are
 *   right = (cos az, sin az, 0),   up = (−sin az·sin el, cos az·sin el, cos el),
 * and right × up = toward, so (right, up, toward) is itself right-handed: a point's screen position is
 * (p·right, p·up) and its depth, growing toward the viewer, is p·toward. Pure functions, no DOM.
 */

import { cross3, dot3, len3, norm3, type Vec3 } from '~/math/vec';

const RAD = Math.PI / 180;

export interface Camera {
  readonly right: Vec3;
  readonly up: Vec3;
  readonly toward: Vec3;
}

export function camera(azDeg: number, elDeg: number): Camera {
  const az = azDeg * RAD;
  const el = elDeg * RAD;
  return {
    right: [Math.cos(az), Math.sin(az), 0],
    up: [-Math.sin(az) * Math.sin(el), Math.cos(az) * Math.sin(el), Math.cos(el)],
    toward: [Math.sin(az) * Math.cos(el), -Math.cos(az) * Math.cos(el), Math.sin(el)],
  };
}

export interface Projected {
  /** to the right, in world units */
  readonly x: number;
  /** up, in world units */
  readonly y: number;
  /** toward the viewer: larger is nearer */
  readonly depth: number;
}

export const project = (cam: Camera, p: Vec3): Projected => ({
  x: dot3(p, cam.right),
  y: dot3(p, cam.up),
  depth: dot3(p, cam.toward),
});

/** where the world origin sits on the canvas and how many CSS px one world unit is */
export interface Frame {
  readonly cx: number;
  readonly cy: number;
  readonly scale: number;
}

/** A world → canvas-pixel map: [px, py, depth]. */
export function makeProjector(cam: Camera, f: Frame): (p: Vec3) => [number, number, number] {
  return (p) => {
    const q = project(cam, p);
    return [f.cx + q.x * f.scale, f.cy - q.y * f.scale, q.depth];
  };
}

/** The radius of the ball about the origin the figure must show: the largest |point| times `pad`, within [min, max]. */
export function viewRadius(points: readonly Vec3[], min: number, max: number, pad = 1.1): number {
  let r = 0;
  for (const p of points) r = Math.max(r, len3(p));
  return Math.min(max, Math.max(min, r * pad));
}

/**
 * Two unit vectors e1, e2 spanning the plane perpendicular to n, right-handed with n: e1 × e2 = n/|n|. The helper axis
 * is the coordinate axis least aligned with n, so the pair is stable while n changes slowly.
 */
export function orthoBasis(n: Vec3): [Vec3, Vec3] {
  const nh = norm3(n);
  const ax = Math.abs(nh[0]);
  const ay = Math.abs(nh[1]);
  const az = Math.abs(nh[2]);
  const helper: Vec3 = ax <= ay && ax <= az ? [1, 0, 0] : ay <= az ? [0, 1, 0] : [0, 0, 1];
  const e1 = norm3(cross3(nh, helper));
  return [e1, cross3(nh, e1)];
}

/** The parameter interval [t0, t1] on which A + t·v lies within the ball |X| ≤ R, or null. */
export function clipLineToBall(a: Vec3, v: Vec3, R: number): [number, number] | null {
  const vv = dot3(v, v);
  if (vv === 0) return null;
  const av = dot3(a, v);
  const disc = av * av - vv * (dot3(a, a) - R * R);
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  return [(-av - s) / vv, (-av + s) / vv];
}
