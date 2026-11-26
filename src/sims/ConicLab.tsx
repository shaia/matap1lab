/**
 * Chapter 2's conic figure: the circle, ellipse, parabola and hyperbolas of lessons 2.1-2.2 as curves of an EQUATION in
 * the plane (no foci: the figure is about equations, standard forms, shifts, stretches and parametrisations). The plane
 * has equal scale on both axes (a circle looks like a circle), integer ticks, x to the right; the window is
 * −8.25 ≤ x ≤ 8.25, −7.5 ≤ y ≤ 7.5. Curves are sampled densely (src/math/conics.ts), a hyperbola's branches are
 * separate polylines, everything is clipped to the stage. A shape is never told apart by colour alone: P is a filled
 * dot with a ring and the letter P, the reference curves are dashed, the asymptotes are dashed in another colour,
 * the semi-axes are the only thick green segments and carry their lengths.
 *
 * MODES (prop `mode`, default 'ellipse')
 *
 * 'ellipse' (lesson 2.1)  ((x−h)/a)² + ((y−k)/b)² = 1; P = (h + a cos t, k + b sin t).
 *   State: a, b (half-integers 0.5…4), h, k (integers −3…3), t (degrees 0…345 in steps of 15; P is dragged along the
 *   curve and snaps to 15°; the arrow keys on the canvas move t), showUnit (the dashed unit circle with its own point
 *   U = (cos t, sin t) at the same t; with a shift also the dashed origin-centred stretched ellipse and the dotted
 *   path U → S = (a cos t, b sin t) → P, so "stretch by a and b, then shift by h and k" can be seen), showAxes (the
 *   semi-axes a and b from the centre, with their lengths). Readout: the equation with the current numbers, the
 *   semi-axes and the centre, the parametrisation, P exactly (a surd when t is a multiple of 30° or 45°, with its
 *   decimal value; at other angles only the decimal) and why P is on the curve.
 *
 * 'parabola' (lesson 2.2)  y = a(x−h)² + k with P = (h + t, k + a t²); with `sideways` x = a(y−k)² + h with
 *   P = (h + a t², k + t).
 *   State: a (one of −2, −1, −0.5, −0.25, 0.25, 0.5, 1, 2), h, k (integers −3…3), t (−3…3 in steps of 0.5; P is
 *   dragged: t = x − h, or y − k when sideways), sideways, showUnit (the dashed basic parabola y = x², or x = y², with its
 *   point at the same t, so the stretch by a and the shift by (h, k) are visible), showAxes (the axis of symmetry).
 *   The vertex is always marked. Readout: equation, vertex, opening direction, parametrisation, P exact (always a
 *   fraction).
 *
 * 'hyperbola' (lesson 2.2)  `kind` 'x': ((x−h)/a)² − ((y−k)/b)² = 1 (opens left/right) with
 *   P = (h + σa√(1+u²), k + b u); 'y': ((y−k)/b)² − ((x−h)/a)² = 1 (opens up/down) with P = (h + a u, k + σb√(1+u²));
 *   'xy': (x−h)(y−k) = c with P = (h + σt, k + c/(σt)), t > 0. This is the parametrisation of the bank (the unit
 *   hyperbola as a graph x = √(1+t²), y = t); no hyperbolic functions appear.
 *   State: kind, a, b (half-integers 0.5…4; kinds 'x', 'y'), c (one of −4, −2, −1, −0.5, 0.5, 1, 2, 4; kind 'xy'),
 *   h, k (−3…3), t (the parameter: −3…3 step 0.5 for 'x', 'y'; 0.25…4 step 0.25 for 'xy'; P is dragged), branch
 *   (+1 the right/upper branch, resp. the branch with x > h; −1 the other), showAsym (dashed asymptotes through the
 *   centre), showBox (the dashed 2a × 2b rectangle with the asymptotes through its corners; 'x', 'y' only). The
 *   vertices are filled small dots. Readout: equation, a, b and the centre, the asymptotes (slope b/a, or x = h and
 *   y = k for 'xy'), the parametrisation and P exact.
 *
 * 'identify' (lesson 2.2)  A x² + C y² + D x + E y + F = 0 with small integer coefficients A, C ∈ −4…4, D, E ∈ −20…20,
 *   F ∈ −30…30 set by steppers and optional presets. The figure draws the curve; the readout shows the equation, the
 *   completed square (exact fractions) and the type: circle, ellipse, parabola, hyperbola, or a degenerate conic
 *   (point, pair of intersecting lines, pair of parallel lines, a line, the empty set), with its numbers (centre, radii
 *   or semi-axes, vertex, asymptotes). Where the curve leaves the window (a centre beyond ±7.5) the readout says so.
 *
 * PROPS (all optional except id)
 *   id        figure id (the `fig` of <Step>); task ids are stored as `${id}:${task}`.
 *   mode      'ellipse' | 'parabola' | 'hyperbola' | 'identify'.
 *   a, b, h, k, t, c, kind, branch, sideways, showUnit, showAxes, showAsym, showBox   initial state (the state names
 *             above); defaults: ellipse a 3, b 2, h 0, k 0, t 30; parabola a 1, h 0, k 0, t 2; hyperbola kind 'x',
 *             a 2, b 1, c 1, h 0, k 0, t 1, branch 1; all toggles false. A value is snapped to its allowed set.
 *   coef      identify: [A, C, D, E, F], default [1, 4, −2, 8, −11] (an ellipse, (x−1)² + 4(y+1)² = 16).
 *   presets   identify: a list of [A, C, D, E, F]; each becomes a button labelled with its equation.
 *   controls  the controls to show, any of 'a' 'b' 'h' 'k' 't' 'c' 'kind' 'branch' 'sideways' 'unit' 'axes' 'asym'
 *             'box' 'coef' 'presets' (default: all that the mode has). A hidden control cannot be used by a task.
 *   kinds     hyperbola: the kinds offered, default ['x', 'y', 'xy'].
 *   tasks     the task ids to show (below).
 *
 * STEP KEYS (<Step fig set={{…}}>): every state name above, plus A, C, D, E, F and `coef: [A, C, D, E, F]` for
 *   identify. Values are snapped to the allowed sets; changing `kind` without `t` resets t to 1.
 *
 * TASKS (ticked only by the reader's own change of a state the task depends on since the last step or reset; a state a
 * text step produced never ticks a task, and a task whose property the step's state already has needs the reader to
 * leave it and find it again)
 *   ellipse:   'ell-circle-2'  a = b = 2 (turn the ellipse into a circle of radius 2; depends on a, b)
 *              'ell-axes-centre'  a = 3, b = 2, h = 1, k = −2 (depends on a, b, h, k)
 *              'ell-top'  t = 90°, P at the top (depends on t)
 *              'ell-tall'  b > a: taller than wide (depends on a, b)
 *              'ell-unit'  showUnit switched on while the ellipse is not the unit circle (depends on showUnit)
 *   parabola:  'par-down'  opens down: a < 0, not sideways (depends on a)
 *              'par-vertex'  vertex at (2, −1) (depends on h, k)
 *              'par-sideways'  sideways switched on (depends on sideways)
 *              'par-narrow'  |a| ≥ 2 (depends on a)
 *              'par-point'  y = x² with P at (2, 4): a = 1, h = k = 0, t = 2, not sideways (depends on a, h, k, t, sideways)
 *   hyperbola: 'hyp-flip-c'  xy = c with the sign of c opposite to the sign at the last step/reset (depends on c, kind)
 *              'hyp-asym-2'  asymptotes y = ±2x switched on: kind x or y, b = 2a, h = k = 0, showAsym
 *              'hyp-vertical'  kind 'y' (opens up and down)
 *              'hyp-rect'  a = b with the asymptotes on, kind x or y (perpendicular asymptotes y = ±x)
 *              'hyp-xy-asym'  kind 'xy' with the asymptotes on (the axes)
 *              'hyp-branch'  P moved to the other branch (branch differs from the last step/reset)
 *   identify:  'id-ellipse-to-hyperbola'  the type is hyperbola (depends on A, C, D, E, F)
 *              'id-circle'  circle; 'id-parabola'  parabola; 'id-point'  a single point;
 *              'id-lines'  a pair of intersecting lines; 'id-empty'  the empty set.
 *
 * Limits: exact points need t that is a multiple of 1/4 (always true here); at angles that are not multiples of 30° or
 * 45° the ellipse readout shows decimals only. The window is fixed: a hyperbola's branches and a steep parabola leave
 * it, and the note says so when P is outside. 3D, foci and rotated conics (an xy term other than xy = c) do not appear.
 */

import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  asymptotes,
  classifyConic,
  ellipseParam,
  ellipsePoint,
  ellipsePointText,
  fmtCompleted,
  fmtPiFraction,
  fmtPoly,
  fmtShift,
  fmtShiftSq,
  fmtSqrtFrac,
  hyperbolaPointText,
  hyperbolaPointX,
  hyperbolaPointXY,
  hyperbolaPointY,
  parabolaPointExact,
  parabolaPointH,
  parabolaPointV,
  samplePolylines,
  toFrac,
  type Box,
  type Classification,
  type Coeffs,
  type Pt,
  type Shape,
} from '~/math/conics';
import { fmtAffine, fmtDecimal, fmtFrac, fmtInt, frac, type Frac } from '~/math/space';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { withAlpha } from './core/ink';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import './ConicLab.css';

export type ConicMode = 'ellipse' | 'parabola' | 'hyperbola' | 'identify';
export type HypKind = 'x' | 'y' | 'xy';

interface State {
  a: number;
  b: number;
  h: number;
  k: number;
  t: number;
  c: number;
  kind: HypKind;
  branch: 1 | -1;
  sideways: boolean;
  showUnit: boolean;
  showAxes: boolean;
  showAsym: boolean;
  showBox: boolean;
  A: number;
  C: number;
  D: number;
  E: number;
  F: number;
}
type Key = keyof State;
const NUM_KEYS: Key[] = ['a', 'b', 'h', 'k', 't', 'c', 'A', 'C', 'D', 'E', 'F'];
const BOOL_KEYS: Key[] = ['sideways', 'showUnit', 'showAxes', 'showAsym', 'showBox'];

export interface ConicLabProps {
  id: string;
  mode?: ConicMode;
  a?: number;
  b?: number;
  h?: number;
  k?: number;
  t?: number;
  c?: number;
  kind?: HypKind;
  branch?: 1 | -1;
  sideways?: boolean;
  showUnit?: boolean;
  showAxes?: boolean;
  showAsym?: boolean;
  showBox?: boolean;
  coef?: [number, number, number, number, number];
  presets?: [number, number, number, number, number][];
  controls?: string[];
  kinds?: HypKind[];
  tasks?: string[];
}

/* ---------- allowed values ---------- */

const PARAB_A = [-2, -1, -0.5, -0.25, 0.25, 0.5, 1, 2];
const C_LIST = [-4, -2, -1, -0.5, 0.5, 1, 2, 4];
const HX = 8.25;
const HY = 7.5;
const BOX: Box = { xmin: -HX, xmax: HX, ymin: -HY, ymax: HY };
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const snap = (x: number, step: number) => Math.round(x / step) * step;
const nearest = (x: number, list: number[]) => list.reduce((best, v) => (Math.abs(v - x) < Math.abs(best - x) ? v : best), list[0]);
const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

function tRange(mode: ConicMode, kind: HypKind): { min: number; max: number; step: number } {
  if (mode === 'ellipse') return { min: 0, max: 345, step: 15 };
  if (mode === 'hyperbola' && kind === 'xy') return { min: 0.25, max: 4, step: 0.25 };
  return { min: -3, max: 3, step: 0.5 };
}

/** every field brought into its allowed set (the figure's state is always normalised) */
function norm(mode: ConicMode, s: State): State {
  const r = tRange(mode, s.kind);
  const t = mode === 'ellipse' ? ((snap(s.t, 15) % 360) + 360) % 360 : clamp(snap(s.t, r.step), r.min, r.max);
  return {
    ...s,
    a: mode === 'parabola' ? nearest(s.a, PARAB_A) : clamp(snap(s.a, 0.5), 0.5, 4),
    b: clamp(snap(s.b, 0.5), 0.5, 4),
    h: clamp(Math.round(s.h), -3, 3),
    k: clamp(Math.round(s.k), -3, 3),
    c: nearest(s.c, C_LIST),
    t,
    kind: s.kind === 'y' || s.kind === 'xy' ? s.kind : 'x',
    branch: s.branch === -1 ? -1 : 1,
    A: clamp(Math.round(s.A), -4, 4),
    C: clamp(Math.round(s.C), -4, 4),
    D: clamp(Math.round(s.D), -20, 20),
    E: clamp(Math.round(s.E), -20, 20),
    F: clamp(Math.round(s.F), -30, 30),
  };
}

const BASE: State = {
  a: 3, b: 2, h: 0, k: 0, t: 30, c: 1, kind: 'x', branch: 1,
  sideways: false, showUnit: false, showAxes: false, showAsym: false, showBox: false,
  A: 1, C: 4, D: -2, E: 8, F: -11,
};
const MODE_DEFAULTS: Record<ConicMode, Partial<State>> = {
  ellipse: {},
  parabola: { a: 1, t: 2 },
  hyperbola: { a: 2, b: 1, t: 1 },
  identify: {},
};

function fresh(p: ConicLabProps): State {
  const mode = p.mode ?? 'ellipse';
  const s: State = { ...BASE, ...MODE_DEFAULTS[mode] };
  for (const k of NUM_KEYS) if (num(p[k as keyof ConicLabProps])) (s[k] as number) = p[k as keyof ConicLabProps] as number;
  for (const k of BOOL_KEYS) if (typeof p[k as keyof ConicLabProps] === 'boolean') (s[k] as boolean) = p[k as keyof ConicLabProps] as boolean;
  if (p.kind === 'x' || p.kind === 'y' || p.kind === 'xy') s.kind = p.kind;
  if (p.kind === 'xy' && !num(p.t)) s.t = 1;
  if (p.branch === 1 || p.branch === -1) s.branch = p.branch;
  if (Array.isArray(p.coef) && p.coef.length === 5 && p.coef.every(num)) [s.A, s.C, s.D, s.E, s.F] = p.coef;
  return norm(mode, s);
}

const coeffsOf = (s: State): Coeffs => ({ A: s.A, C: s.C, D: s.D, E: s.E, F: s.F });
const rad = (deg: number) => (deg * Math.PI) / 180;

/** P in the plane (null in 'identify') */
function pointOf(mode: ConicMode, s: State): Pt | null {
  if (mode === 'ellipse') return ellipsePoint(s.h, s.k, s.a, s.b, rad(s.t));
  if (mode === 'parabola') return s.sideways ? parabolaPointH(s.h, s.k, s.a, s.t) : parabolaPointV(s.h, s.k, s.a, s.t);
  if (mode === 'hyperbola') {
    if (s.kind === 'x') return hyperbolaPointX(s.h, s.k, s.a, s.b, s.t, s.branch);
    if (s.kind === 'y') return hyperbolaPointY(s.h, s.k, s.a, s.b, s.t, s.branch);
    return hyperbolaPointXY(s.h, s.k, s.c, s.t, s.branch);
  }
  return null;
}

function shapeOf(mode: ConicMode, s: State): Shape {
  if (mode === 'ellipse') return { kind: 'ellipse', h: s.h, k: s.k, a: s.a, b: s.b };
  if (mode === 'parabola') return s.sideways ? { kind: 'parabolaH', h: s.h, k: s.k, a: s.a } : { kind: 'parabolaV', h: s.h, k: s.k, a: s.a };
  if (mode === 'hyperbola') {
    if (s.kind === 'x') return { kind: 'hyperbolaX', h: s.h, k: s.k, a: s.a, b: s.b };
    if (s.kind === 'y') return { kind: 'hyperbolaY', h: s.h, k: s.k, a: s.a, b: s.b };
    return { kind: 'hyperbolaXY', h: s.h, k: s.k, c: s.c };
  }
  return classifyConic(coeffsOf(s)).shape;
}

/* ---------- text ---------- */

/** a left-to-right island inside Hebrew text (U+2066 … U+2069), with no-break spaces so it never wraps */
const ltr = (s: string) => `⁦${s.replace(/ /g, ' ')}⁩`;

const fmtNum = (x: number): string => (Number.isInteger(x) ? fmtInt(x) : `${x < 0 ? '−' : ''}${Math.abs(x)}`);
const sq = (x: number): Frac => {
  const f = toFrac(x);
  return frac(f.n * f.n, f.d * f.d);
};
/** the denominator of a square in an equation: "9", "(9/4)" */
const den = (x: number): string => {
  const f = sq(x);
  return f.d === 1 ? String(f.n) : `(${fmtFrac(f)})`;
};
const coefStr = (c: number): string => (c === 1 ? '' : c === -1 ? '−' : fmtNum(c));
/** c0 + c1·body with real signs: "1 + 3 cos t", "−2 − t²", "4" */
function lin(c0: number, c1: number, body: string): string {
  if (c1 === 0) return fmtNum(c0);
  const mag = Math.abs(c1) === 1 ? body.trim() : `${fmtNum(Math.abs(c1))}${body}`;
  if (c0 === 0) return `${c1 < 0 ? '−' : ''}${mag}`;
  return `${fmtNum(c0)} ${c1 < 0 ? '−' : '+'} ${mag}`;
}
/** the coefficient a = n/d in front of a square: "", "−", "2", "(1/2)" */
const coefFrac = (f: Frac): string => (f.n === 1 && f.d === 1 ? '' : f.n === -1 && f.d === 1 ? '−' : f.d === 1 ? fmtInt(f.n) : `(${fmtFrac(f)})`);
/** " + 3", " − 1/2" or nothing for 0 */
const addFrac = (f: Frac): string => (f.n === 0 ? '' : ` ${f.n < 0 ? '−' : '+'} ${fmtFrac(frac(Math.abs(f.n), f.d))}`);
/** c0 ± mag with the sign σ: "1 + 2√(1 + u²)", "−2√(1 + u²)", "0 − t" is written "−t" */
const signed = (c0: number, sg: number, mag: string): string => (c0 === 0 ? `${sg < 0 ? '−' : ''}${mag}` : `${fmtInt(c0)} ${sg < 0 ? '−' : '+'} ${mag}`);
const addK = (k: number): string => (k === 0 ? '' : ` ${k < 0 ? '−' : '+'} ${Math.abs(k)}`);
/** "y", "y − 1", "y + 2" */
const fmtLinear = (sym: string, c: number | Frac): string => {
  const f = typeof c === 'number' ? frac(c) : c;
  return f.n === 0 ? sym : `${sym} ${f.n < 0 ? '+' : '−'} ${fmtFrac(frac(Math.abs(f.n), f.d))}`;
};
/** "±x", "±3(x − 1)", "±(3/2)x", "±√3x" for the slope text s */
const slopeTimes = (slope: string, xPart: string): string => (slope === '1' ? `±${xPart}` : /\//.test(slope) ? `±(${slope})${xPart}` : `±${slope}${xPart}`);

function ellipseEq(s: State): string {
  return `${fmtShiftSq('x', frac(s.h))}/${den(s.a)} + ${fmtShiftSq('y', frac(s.k))}/${den(s.b)} = 1`;
}
function parabolaEq(s: State): string {
  const a = coefStr(s.a);
  return s.sideways ? `x = ${a}${fmtShiftSq('y', frac(s.k))}${addK(s.h)}` : `y = ${a}${fmtShiftSq('x', frac(s.h))}${addK(s.k)}`;
}
function hyperbolaEq(s: State): string {
  if (s.kind === 'xy') return `${fmtShift('x', frac(s.h))}${fmtShift('y', frac(s.k))} = ${fmtNum(s.c)}`;
  const X = `${fmtShiftSq('x', frac(s.h))}/${den(s.a)}`;
  const Y = `${fmtShiftSq('y', frac(s.k))}/${den(s.b)}`;
  return s.kind === 'x' ? `${X} − ${Y} = 1` : `${Y} − ${X} = 1`;
}
/** the asymptotes of a hyperbola with the slope text s through the centre */
function asymText(h: Frac, k: Frac, slope: string): string {
  const xPart = h.n === 0 ? 'x' : `(${fmtLinear('x', h)})`;
  return `${fmtLinear('y', k)} = ${slopeTimes(slope, xPart)}`;
}

const TYPE_HE: Record<string, string> = {
  circle: 'מעגל',
  ellipse: 'אליפסה',
  parabola: 'פרבולה',
  hyperbola: 'היפרבולה',
  point: 'נקודה אחת (חתך חרוט מנוון)',
  empty: 'הקבוצה הריקה: אין נקודות',
  'two-lines': 'זוג ישרים נחתכים (חתך חרוט מנוון)',
  'parallel-lines': 'זוג ישרים מקבילים (אינו חתך של החרוט)',
  'double-line': 'ישר אחד (חתך חרוט מנוון)',
  line: 'ישר (אין איבר ריבועי: המשוואה ממעלה ראשונה)',
  plane: 'כל המישור (המשוואה 0 = 0)',
};

/** the numbers of a classified conic as LTR math text rows: [label, text] */
function identifyDetails(cl: Classification, c: Coeffs): [string, string][] {
  const { form } = cl;
  const out: [string, string][] = [];
  const h = form.h ?? frac(0);
  const k = form.k ?? frac(0);
  const R = form.R;
  const RA = form.A !== 0 ? frac(R.n, R.d * form.A) : null;
  const RC = form.C !== 0 ? frac(R.n, R.d * form.C) : null;
  const centre = `(${fmtFrac(h)}, ${fmtFrac(k)})`;
  switch (cl.type) {
    case 'circle':
      out.push(['מרכז ורדיוס:', `${centre},  r = ${fmtSqrtFrac(RA!)}`]);
      break;
    case 'ellipse':
      out.push(['בצורה סטנדרטית:', `${fmtShiftSq('x', h)}/${fmtFrac(RA!)} + ${fmtShiftSq('y', k)}/${fmtFrac(RC!)} = 1`]);
      out.push(['מרכז וחצאי צירים:', `${centre},  a = ${fmtSqrtFrac(RA!)},  b = ${fmtSqrtFrac(RC!)}`]);
      break;
    case 'hyperbola': {
      const xType = (cl.shape as Shape).kind === 'hyperbolaX';
      const aa = xType ? RA! : frac(-R.n, R.d * form.A);
      const bb = xType ? frac(-R.n, R.d * form.C) : RC!;
      const X = `${fmtShiftSq('x', h)}/${fmtFrac(aa)}`;
      const Y = `${fmtShiftSq('y', k)}/${fmtFrac(bb)}`;
      out.push(['בצורה סטנדרטית:', xType ? `${X} − ${Y} = 1` : `${Y} − ${X} = 1`]);
      out.push(['מרכז, a ו-b:', `${centre},  a = ${fmtSqrtFrac(aa)},  b = ${fmtSqrtFrac(bb)}`]);
      out.push([xType ? 'נפתחת ימינה ושמאלה. אסימפטוטות:' : 'נפתחת למעלה ולמטה. אסימפטוטות:', asymText(h, k, fmtSqrtFrac(frac(-form.A, form.C)))]);
      break;
    }
    case 'two-lines':
      out.push(['הישרים:', asymText(h, k, fmtSqrtFrac(frac(-form.A, form.C)))]);
      break;
    case 'parabola': {
      const sh = cl.shape as Shape;
      if (sh.kind === 'parabolaV') {
        const vk = frac(R.n, R.d * c.E);
        out.push(['קודקוד:', `(${fmtFrac(h)}, ${fmtFrac(vk)})`]);
        out.push([c.E * c.A < 0 ? 'נפתחת כלפי מעלה:' : 'נפתחת כלפי מטה:', `y = ${coefFrac(frac(-c.A, c.E))}${fmtShiftSq('x', h)}${addFrac(vk)}`]);
      } else {
        const vh = frac(R.n, R.d * c.D);
        out.push(['קודקוד:', `(${fmtFrac(vh)}, ${fmtFrac(k)})`]);
        out.push([c.D * c.C < 0 ? 'נפתחת ימינה:' : 'נפתחת שמאלה:', `x = ${coefFrac(frac(-c.C, c.D))}${fmtShiftSq('y', k)}${addFrac(vh)}`]);
      }
      break;
    }
    case 'point':
      out.push(['הנקודה:', centre]);
      break;
    case 'parallel-lines': {
      const vertical = (cl.shape as Extract<Shape, { kind: 'lines' }>).lines[0].dx === 0;
      out.push(['הישרים:', vertical ? `x = ${fmtFrac(h)} ± ${fmtSqrtFrac(RA!)}` : `y = ${fmtFrac(k)} ± ${fmtSqrtFrac(RC!)}`]);
      break;
    }
    case 'double-line':
      out.push(['הישר:', form.A !== 0 ? `x = ${fmtFrac(h)}` : `y = ${fmtFrac(k)}`]);
      break;
    default:
      break;
  }
  return out;
}

/* ---------- canvas helpers ---------- */

function halo(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, p: Palette, opts: { size?: number; italic?: boolean; align?: CanvasTextAlign } = {}) {
  ctx.save();
  ctx.font = `${opts.italic === false ? '' : 'italic '}700 ${opts.size ?? 15}px ${p.fontUi}`;
  ctx.textAlign = opts.align ?? 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4;
  ctx.strokeStyle = withAlpha(p.paper, 0.85);
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function dotAt(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string | null, stroke: string, p: Palette, width = 2) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill ?? p.paper;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width: number, dash: number[] = [], alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.setLineDash(dash);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function stroke(ctx: CanvasRenderingContext2D, polys: Pt[][], X: (x: number) => number, Y: (y: number) => number, color: string, width: number, dash: number[] = [], alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.setLineDash(dash);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const pl of polys) {
    if (pl.length < 2) continue;
    ctx.beginPath();
    pl.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
    ctx.stroke();
  }
  ctx.restore();
}

function Row(p: { id: string; label?: string; strong?: boolean; children: ComponentChildren }) {
  return (
    <div class={`cl-row${p.strong ? ' strong' : ''}`} data-readout={p.id}>
      {p.label && <span class="cl-lab">{p.label}</span>}
      <span class="q cl-math">{p.children}</span>
    </div>
  );
}

function NumStep(p: { name: string; label: string; value: string; onDec: () => void; onInc: () => void; decOff: boolean; incOff: boolean; color?: string; aria: string }) {
  return (
    <span class="cl-step" data-stepper={p.name}>
      <span class="cl-name" style={p.color ? { color: p.color } : undefined}>
        {p.label}
      </span>
      <button type="button" data-step="dec" aria-label={`הקטנת ${p.aria}`} disabled={p.decOff} onClick={p.onDec}>
        −
      </button>
      <output data-value aria-label={p.aria}>
        {p.value}
      </output>
      <button type="button" data-step="inc" aria-label={`הגדלת ${p.aria}`} disabled={p.incOff} onClick={p.onInc}>
        +
      </button>
    </span>
  );
}

/* ---------- tasks ---------- */

const TASK_LABEL: Record<string, string> = {
  'ell-circle-2': `שנו את חצאי הצירים כך שהאליפסה תהיה מעגל ברדיוס 2. איזה מספר השתנה במשוואה?`,
  'ell-axes-centre': `הציבו חצאי צירים ${ltr('a = 3')} ו-${ltr('b = 2')} ומרכז ${ltr('(1, −2)')}. קראו את המשוואה.`,
  'ell-top': `הזיזו את ${ltr('P')} אל הנקודה העליונה של האליפסה. מהי קואורדינטת ${ltr('y')} שלה, ומהי קואורדינטת ${ltr('x')}?`,
  'ell-tall': `בחרו חצאי צירים כך שהאליפסה תהיה גבוהה יותר מרחבה. איזה מהמכנים במשוואה גדול יותר?`,
  'ell-unit': `הדליקו את מעגל היחידה. מה קורה לנקודה ${ltr('(cos t, sin t)')} כשהיא הופכת ל-${ltr('P')}?`,
  'par-down': `הפכו את הפרבולה כך שתיפתח כלפי מטה. מה השתנה במשוואה?`,
  'par-vertex': `העבירו את הקודקוד אל ${ltr('(2, −1)')}. איך זה נראה במשוואה?`,
  'par-sideways': `הדליקו את הפרבולה האופקית. לאיזה כיוון היא נפתחת כש-${ltr('a > 0')}?`,
  'par-narrow': `הפכו את הפרבולה לצרה יותר, עם ${ltr('|a| ≥ 2')}.`,
  'par-point': `הציבו ${ltr('y = x²')} והזיזו את ${ltr('P')} אל ${ltr('(2, 4)')}. איזה ערך של ${ltr('t')} נתן אותה?`,
  'hyp-flip-c': `בחרו ${ltr('xy = c')} והפכו את הסימן של ${ltr('c')}. באילו רביעים נמצאים הענפים בכל סימן?`,
  'hyp-asym-2': `סדרו היפרבולה שהאסימפטוטות שלה ${ltr('y = ±2x')} (המרכז בראשית), והדליקו את האסימפטוטות כדי לבדוק.`,
  'hyp-vertical': `הפכו את ההיפרבולה כך שתיפתח למעלה ולמטה. איזה סימן התחלף במשוואה?`,
  'hyp-rect': `בחרו ${ltr('a = b')} והדליקו את האסימפטוטות. מה הזווית ביניהן?`,
  'hyp-xy-asym': `בחרו ${ltr('xy = c')} והדליקו את האסימפטוטות. מהן הן?`,
  'hyp-branch': `העבירו את ${ltr('P')} אל הענף השני. מה השתנה בנוסחת הפרמטריזציה?`,
  'id-ellipse-to-hyperbola': `שנו מקדם אחד כך שהאליפסה תהפוך להיפרבולה. איזה מקדם שינה את הסוג?`,
  'id-circle': `שנו מקדמים כך שהעקום יהיה מעגל. מה צריך להתקיים בין ${ltr('A')} ל-${ltr('C')}?`,
  'id-parabola': `מצאו מקדמים שנותנים פרבולה. איזה מקדם צריך להיות 0?`,
  'id-point': `מצאו מקדמים שנותנים נקודה אחת בלבד. מה היה צריך לצאת באגף ימין אחרי ההשלמה לריבוע?`,
  'id-lines': `מצאו מקדמים שנותנים זוג ישרים נחתכים. במה זה שונה מהיפרבולה?`,
  'id-empty': `מצאו מקדמים שלא נותנים אף נקודה. מה היה סימן אגף ימין?`,
};

const TASK_KEYS: Record<string, Key[]> = {
  'ell-circle-2': ['a', 'b'],
  'ell-axes-centre': ['a', 'b', 'h', 'k'],
  'ell-top': ['t'],
  'ell-tall': ['a', 'b'],
  'ell-unit': ['showUnit'],
  'par-down': ['a'],
  'par-vertex': ['h', 'k'],
  'par-sideways': ['sideways'],
  'par-narrow': ['a'],
  'par-point': ['a', 'h', 'k', 't', 'sideways'],
  'hyp-flip-c': ['c', 'kind'],
  'hyp-asym-2': ['a', 'b', 'h', 'k', 'showAsym', 'kind'],
  'hyp-vertical': ['kind'],
  'hyp-rect': ['a', 'b', 'showAsym', 'kind'],
  'hyp-xy-asym': ['kind', 'showAsym'],
  'hyp-branch': ['branch'],
  'id-ellipse-to-hyperbola': ['A', 'C', 'D', 'E', 'F'],
  'id-circle': ['A', 'C', 'D', 'E', 'F'],
  'id-parabola': ['A', 'C', 'D', 'E', 'F'],
  'id-point': ['A', 'C', 'D', 'E', 'F'],
  'id-lines': ['A', 'C', 'D', 'E', 'F'],
  'id-empty': ['A', 'C', 'D', 'E', 'F'],
};

interface Ctx {
  /** the state keys the reader changed since the last step or reset */
  touched: Set<Key>;
  /** the state set by the last step or reset */
  baseline: State;
}

const sameKeys = (keys: Key[], x: State, y: State): boolean => keys.every((k) => x[k] === y[k]);

/** whether the state has the property of the task (the touched check is done by `taskDone`) */
function holds(task: string, s: State, base: State): boolean {
  switch (task) {
    case 'ell-circle-2':
      return s.a === 2 && s.b === 2;
    case 'ell-axes-centre':
      return s.a === 3 && s.b === 2 && s.h === 1 && s.k === -2;
    case 'ell-top':
      return s.t === 90;
    case 'ell-tall':
      return s.b > s.a;
    case 'ell-unit':
      return s.showUnit && !(s.a === 1 && s.b === 1);
    case 'par-down':
      return !s.sideways && s.a < 0;
    case 'par-vertex':
      return s.h === 2 && s.k === -1;
    case 'par-sideways':
      return s.sideways;
    case 'par-narrow':
      return Math.abs(s.a) >= 2;
    case 'par-point':
      return !s.sideways && s.a === 1 && s.h === 0 && s.k === 0 && s.t === 2;
    case 'hyp-flip-c':
      return s.kind === 'xy' && Math.sign(s.c) !== Math.sign(base.c);
    case 'hyp-asym-2':
      return s.kind !== 'xy' && s.b === 2 * s.a && s.h === 0 && s.k === 0 && s.showAsym;
    case 'hyp-vertical':
      return s.kind === 'y';
    case 'hyp-rect':
      return s.kind !== 'xy' && s.a === s.b && s.showAsym;
    case 'hyp-xy-asym':
      return s.kind === 'xy' && s.showAsym;
    case 'hyp-branch':
      return s.branch !== base.branch;
    case 'id-ellipse-to-hyperbola':
      return classifyConic(coeffsOf(s)).type === 'hyperbola';
    case 'id-circle':
      return classifyConic(coeffsOf(s)).type === 'circle';
    case 'id-parabola':
      return classifyConic(coeffsOf(s)).type === 'parabola';
    case 'id-point':
      return classifyConic(coeffsOf(s)).type === 'point';
    case 'id-lines':
      return classifyConic(coeffsOf(s)).type === 'two-lines';
    case 'id-empty':
      return classifyConic(coeffsOf(s)).type === 'empty';
    default:
      return false;
  }
}

/** tasks that ask for a state with a property: a state a text step (or the reset) left already having it does not count */
function taskDone(task: string, s: State, cx: Ctx): boolean {
  const keys = TASK_KEYS[task];
  if (!keys || !keys.some((k) => cx.touched.has(k))) return false;
  if (!holds(task, s, cx.baseline)) return false;
  if (task === 'hyp-branch') return true;
  // the step's state already had the property: the reader must leave it and find it again
  if (holds(task, cx.baseline, cx.baseline)) return !sameKeys(keys, s, cx.baseline);
  return true;
}

/* ---------- component ---------- */

export default function ConicLab(props: ConicLabProps) {
  const mode: ConicMode = props.mode ?? 'ellipse';
  const [s, setS] = useState<State>(() => fresh(props));
  const cur = useRef(s);
  cur.current = s;
  const ctxRef = useRef<Ctx>({ touched: new Set(), baseline: s });
  const drag = useRef(false);
  const [live, setLive] = useState('');
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const has = (c: string) => (props.controls ? props.controls.includes(c) : true);
  const kinds = props.kinds ?? (['x', 'y', 'xy'] as HypKind[]);

  const apply = (patch: Partial<State>): State => {
    const next = norm(mode, { ...cur.current, ...patch });
    cur.current = next;
    setS(next);
    return next;
  };

  /** the reader's own change: the only place a task can tick */
  const userSet = (patch: Partial<State>) => {
    const cx = ctxRef.current;
    const before = cur.current;
    const p2: Partial<State> = { ...patch };
    if (p2.kind && p2.kind !== before.kind && !('t' in p2)) p2.t = p2.kind === 'xy' ? 1 : clamp(before.t, -3, 3);
    const next = apply(p2);
    for (const k of Object.keys(p2) as Key[]) if (next[k] !== before[k] || k === 'branch') cx.touched.add(k);
    if (next.t !== before.t) cx.touched.add('t');
    for (const task of props.tasks ?? []) if (taskDone(task, next, cx)) markTask(`${props.id}:${task}`);
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        const patch: Partial<State> = {};
        for (const k of NUM_KEYS) if (num(st[k])) (patch[k] as number) = st[k] as number;
        for (const k of BOOL_KEYS) if (typeof st[k] === 'boolean') (patch[k] as boolean) = st[k] as boolean;
        if (st.kind === 'x' || st.kind === 'y' || st.kind === 'xy') {
          patch.kind = st.kind;
          if (!num(st.t) && st.kind !== cur.current.kind) patch.t = st.kind === 'xy' ? 1 : clamp(cur.current.t, -3, 3);
        }
        if (st.branch === 1 || st.branch === -1) patch.branch = st.branch;
        if (Array.isArray(st.coef) && st.coef.length === 5 && st.coef.every(num)) [patch.A, patch.C, patch.D, patch.E, patch.F] = st.coef as number[];
        const next = apply(patch);
        // a state a text step produced never ticks a task: forget the reader's moves and re-base
        ctxRef.current = { touched: new Set(), baseline: next };
      }),
    [props.id],
  );

  /* ---------- derived ---------- */
  const shape = shapeOf(mode, s);
  const P = pointOf(mode, s);
  const cl = mode === 'identify' ? classifyConic(coeffsOf(s)) : null;
  const inWindow = (p: Pt) => Math.abs(p[0]) <= HX && Math.abs(p[1]) <= HY;

  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    const sc = Math.min(view.w / (2 * HX), view.h / (2 * HY));
    const X = (x: number) => view.w / 2 + x * sc;
    const Y = (y: number) => view.h / 2 - y * sc;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, view.w, view.h);
    ctx.clip();

    // grid at the integers
    ctx.save();
    ctx.strokeStyle = p.rule;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -8; i <= 8; i++) {
      ctx.moveTo(X(i), 0);
      ctx.lineTo(X(i), view.h);
    }
    for (let j = -7; j <= 7; j++) {
      ctx.moveTo(0, Y(j));
      ctx.lineTo(view.w, Y(j));
    }
    ctx.stroke();
    ctx.restore();

    // axes with arrow heads, ticks and numbers
    line(ctx, 0, Y(0), view.w, Y(0), p.ink3, 1.5);
    line(ctx, X(0), 0, X(0), view.h, p.ink3, 1.5);
    ctx.save();
    ctx.fillStyle = p.ink3;
    ctx.beginPath();
    ctx.moveTo(view.w - 1, Y(0));
    ctx.lineTo(view.w - 11, Y(0) - 4.5);
    ctx.lineTo(view.w - 11, Y(0) + 4.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(X(0), 1);
    ctx.lineTo(X(0) - 4.5, 11);
    ctx.lineTo(X(0) + 4.5, 11);
    ctx.fill();
    ctx.restore();
    const every = sc >= 20 ? 1 : 2;
    ctx.save();
    ctx.strokeStyle = p.ink3;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = -8; i <= 8; i++) {
      if (!i) continue;
      ctx.moveTo(X(i), Y(0) - 3.5);
      ctx.lineTo(X(i), Y(0) + 3.5);
    }
    for (let j = -7; j <= 7; j++) {
      if (!j) continue;
      ctx.moveTo(X(0) - 3.5, Y(j));
      ctx.lineTo(X(0) + 3.5, Y(j));
    }
    ctx.stroke();
    ctx.restore();
    for (let i = -8; i <= 8; i++) if (i && i % every === 0) halo(ctx, fmtInt(i), X(i), Y(0) + 15, p.ink2, p, { size: 11, italic: false });
    for (let j = -7; j <= 7; j++) if (j && j % every === 0) halo(ctx, fmtInt(j), X(0) - 12, Y(j), p.ink2, p, { size: 11, italic: false, align: 'right' });
    halo(ctx, 'x', view.w - 14, Y(0) - 13, p.ink2, p, { size: 15 });
    halo(ctx, 'y', X(0) + 13, 16, p.ink2, p, { size: 15 });

    const drawLine = (l: { x0: number; y0: number; dx: number; dy: number }, color: string, width: number, dash: number[], alpha = 1) => {
      const n = Math.hypot(l.dx, l.dy) || 1;
      const L = 60;
      line(ctx, X(l.x0 - (l.dx / n) * L), Y(l.y0 - (l.dy / n) * L), X(l.x0 + (l.dx / n) * L), Y(l.y0 + (l.dy / n) * L), color, width, dash, alpha);
    };
    const curve = (sh: Shape, color: string, width: number, dash: number[] = [], alpha = 1) => stroke(ctx, samplePolylines(sh, BOX), X, Y, color, width, dash, alpha);
    /** dotted drops from P to the axes with hollow footprints, so its coordinates can be read */
    const drops = (q: Pt) => {
      line(ctx, X(q[0]), Y(q[1]), X(q[0]), Y(0), p.ink3, 1.3, [2, 4]);
      line(ctx, X(q[0]), Y(q[1]), X(0), Y(q[1]), p.ink3, 1.3, [2, 4]);
      if (q[1] !== 0) dotAt(ctx, X(q[0]), Y(0), 3, null, p.ink2, p, 1.4);
      if (q[0] !== 0) dotAt(ctx, X(0), Y(q[1]), 3, null, p.ink2, p, 1.4);
    };
    /** the point P: filled with a ring and its letter, the letter pushed away from `from` on the screen */
    const pointP = (q: Pt, from: Pt) => {
      let dx = X(q[0]) - X(from[0]);
      let dy = Y(q[1]) - Y(from[1]);
      const L = Math.hypot(dx, dy);
      if (L < 1) {
        dx = 1;
        dy = -1;
      } else {
        dx /= L;
        dy /= L;
      }
      dotAt(ctx, X(q[0]), Y(q[1]), 6.5, p.accent, p.paper, p, 2.2);
      halo(ctx, 'P', X(q[0]) + dx * 17, Y(q[1]) + dy * 17, p.accent, p);
    };

    /* ============================ ellipse ============================ */
    if (mode === 'ellipse') {
      const T = rad(s.t);
      const shifted = s.h !== 0 || s.k !== 0;
      if (s.showUnit) {
        if (shifted) curve({ kind: 'ellipse', h: 0, k: 0, a: s.a, b: s.b }, p.ink3, 1.4, [2, 4], 0.7);
        curve({ kind: 'ellipse', h: 0, k: 0, a: 1, b: 1 }, p.ink2, 1.8, [6, 5]);
      }
      curve(shape, p.curve, 2.8);
      if (s.showAxes) {
        line(ctx, X(s.h), Y(s.k), X(s.h + s.a), Y(s.k), p.force, 3.4);
        line(ctx, X(s.h), Y(s.k), X(s.h), Y(s.k + s.b), p.force, 3.4);
        halo(ctx, `a = ${fmtNum(s.a)}`, X(s.h + s.a / 2), Y(s.k) + (s.k + s.b > 0 ? 17 : 17), p.force, p);
        halo(ctx, `b = ${fmtNum(s.b)}`, X(s.h) - 8, Y(s.k + s.b / 2), p.force, p, { align: 'right' });
        dotAt(ctx, X(s.h), Y(s.k), 3.2, p.force, p.paper, p, 1.2);
      }
      const q = ellipsePoint(s.h, s.k, s.a, s.b, T);
      if (s.showUnit) {
        const u: Pt = [Math.cos(T), Math.sin(T)];
        const st: Pt = [s.a * Math.cos(T), s.b * Math.sin(T)];
        line(ctx, X(u[0]), Y(u[1]), X(st[0]), Y(st[1]), p.ink2, 1.6, [2, 3]);
        if (shifted) {
          line(ctx, X(st[0]), Y(st[1]), X(q[0]), Y(q[1]), p.ink2, 1.6, [2, 3]);
          dotAt(ctx, X(st[0]), Y(st[1]), 3.4, null, p.ink2, p, 1.6);
          // the letter S sits on the outer side of the corner U → S → P, away from both dotted legs
          const away = (from: Pt): Pt => {
            const dx = X(st[0]) - X(from[0]);
            const dy = Y(st[1]) - Y(from[1]);
            const L = Math.hypot(dx, dy);
            return L < 1 ? [0, 0] : [dx / L, dy / L];
          };
          const d1 = away(u);
          const d2 = away(q);
          let sx = d1[0] + d2[0];
          let sy = d1[1] + d2[1];
          const L = Math.hypot(sx, sy);
          if (L < 0.2) {
            // the legs are opposite (or missing): step sideways from the leg
            sx = -d2[1];
            sy = d2[0];
          } else {
            sx /= L;
            sy /= L;
          }
          halo(ctx, 'S', X(st[0]) + sx * 14, Y(st[1]) + sy * 14, p.ink2, p);
        }
        dotAt(ctx, X(u[0]), Y(u[1]), 4.6, null, p.ink2, p, 2);
        halo(ctx, 'U', X(u[0]) - 12, Y(u[1]) + 12, p.ink2, p);
      }
      drops(q);
      pointP(q, [s.h, s.k]);
    }

    /* ============================ parabola ============================ */
    if (mode === 'parabola') {
      if (s.showUnit) {
        const ref: Shape = s.sideways ? { kind: 'parabolaH', h: 0, k: 0, a: 1 } : { kind: 'parabolaV', h: 0, k: 0, a: 1 };
        curve(ref, p.ink2, 1.8, [6, 5]);
        const r = s.sideways ? parabolaPointH(0, 0, 1, s.t) : parabolaPointV(0, 0, 1, s.t);
        if (inWindow(r)) {
          dotAt(ctx, X(r[0]), Y(r[1]), 4.6, null, p.ink2, p, 2);
          halo(ctx, 'U', X(r[0]) - 12, Y(r[1]) + 12, p.ink2, p);
        }
      }
      if (s.showAxes) drawLine(s.sideways ? { x0: s.h, y0: s.k, dx: 1, dy: 0 } : { x0: s.h, y0: s.k, dx: 0, dy: 1 }, p.force, 1.8, [8, 5]);
      curve(shape, p.curve, 2.8);
      dotAt(ctx, X(s.h), Y(s.k), 4.6, p.ink, p.paper, p, 1.6);
      halo(ctx, 'V', X(s.h) - 12, Y(s.k) + (s.sideways ? -13 : 14), p.ink, p);
      if (P && inWindow(P)) {
        drops(P);
        pointP(P, [s.h, s.k]);
      }
    }

    /* ============================ hyperbola ============================ */
    if (mode === 'hyperbola') {
      if (s.kind !== 'xy' && s.showBox) {
        ctx.save();
        ctx.fillStyle = withAlpha(p.delta, 0.14);
        ctx.fillRect(X(s.h - s.a), Y(s.k + s.b), 2 * s.a * sc, 2 * s.b * sc);
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = p.delta;
        ctx.lineWidth = 1.6;
        ctx.strokeRect(X(s.h - s.a), Y(s.k + s.b), 2 * s.a * sc, 2 * s.b * sc);
        ctx.restore();
      }
      if (s.showAsym) for (const l of asymptotes(shape)) drawLine(l, p.equip, 2, [9, 5]);
      curve(shape, p.curve, 2.8);
      // vertices (small filled dots) and the centre (a hollow dot)
      const vs: Pt[] =
        s.kind === 'x'
          ? [[s.h + s.a, s.k], [s.h - s.a, s.k]]
          : s.kind === 'y'
            ? [[s.h, s.k + s.b], [s.h, s.k - s.b]]
            : [[s.h + Math.sqrt(Math.abs(s.c)), s.k + Math.sign(s.c) * Math.sqrt(Math.abs(s.c))], [s.h - Math.sqrt(Math.abs(s.c)), s.k - Math.sign(s.c) * Math.sqrt(Math.abs(s.c))]];
      for (const v of vs) dotAt(ctx, X(v[0]), Y(v[1]), 4, p.ink, p.paper, p, 1.4);
      dotAt(ctx, X(s.h), Y(s.k), 3.2, null, p.ink2, p, 1.4);
      if (P && inWindow(P)) {
        drops(P);
        // P's letter goes into the opening of its branch (the asymptotes are on the other side of the curve), so it
        // never sits on an asymptote; for xy = c the asymptotes are the lines through the centre, and "away from the centre" does it
        const from: Pt = s.kind === 'x' ? [P[0] - s.branch, P[1]] : s.kind === 'y' ? [P[0], P[1] - s.branch] : [s.h, s.k];
        pointP(P, from);
      }
    }

    /* ============================ identify ============================ */
    if (mode === 'identify' && cl) {
      const sh = cl.shape;
      if (sh.kind === 'point') {
        dotAt(ctx, X(sh.h), Y(sh.k), 7, p.ink, p.paper, p, 2.4);
      } else {
        curve(sh, p.curve, 2.8);
        if (sh.kind === 'ellipse' || sh.kind === 'hyperbolaX' || sh.kind === 'hyperbolaY') dotAt(ctx, X(sh.h), Y(sh.k), 3.4, null, p.ink2, p, 1.4);
        if (sh.kind === 'parabolaV' || sh.kind === 'parabolaH') dotAt(ctx, X(sh.h), Y(sh.k), 4.6, p.ink, p.paper, p, 1.6);
        if (sh.kind === 'lines' && cl.type === 'two-lines') dotAt(ctx, X(cl.form.h ? cl.form.h.n / cl.form.h.d : 0), Y(cl.form.k ? cl.form.k.n / cl.form.k.d : 0), 3.4, null, p.ink2, p, 1.4);
      }
      if (cl.type === 'empty' || cl.type === 'plane') {
        ctx.save();
        ctx.direction = 'rtl';
        halo(ctx, cl.type === 'empty' ? 'אין נקודות: הקבוצה ריקה' : 'כל נקודה של המישור מקיימת את המשוואה', view.w / 2, view.h * 0.2, p.ink, p, { size: 16, italic: false });
        ctx.restore();
      }
    }
    ctx.restore();
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1, worldHeight: 1, animate: false });
  useEffect(invalidate, [s]);

  /* ---------- pointer and keyboard ---------- */
  const geom = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const sc = Math.min(r.width / (2 * HX), r.height / (2 * HY));
    return { r, sc, toWorld: (cx: number, cy: number): Pt => [(cx - r.left - r.width / 2) / sc, -(cy - r.top - r.height / 2) / sc] };
  };
  /** the parameter patch that moves P toward the world point (x, y) */
  const patchToward = (x: number, y: number): Partial<State> | null => {
    const q = cur.current;
    if (mode === 'ellipse') return { t: (ellipseParam(q.h, q.k, q.a, q.b, x, y) * 180) / Math.PI };
    if (mode === 'parabola') return { t: q.sideways ? y - q.k : x - q.h };
    if (mode === 'hyperbola') {
      if (q.kind === 'x') return { t: (y - q.k) / q.b, branch: x >= q.h ? 1 : -1 };
      if (q.kind === 'y') return { t: (x - q.h) / q.a, branch: y >= q.k ? 1 : -1 };
      return { t: Math.abs(x - q.h), branch: x >= q.h ? 1 : -1 };
    }
    return null;
  };
  const onPointerDown = (e: PointerEvent) => {
    const P0 = pointOf(mode, cur.current);
    if (!P0 || !has('t')) return;
    const g = geom(e.currentTarget as HTMLElement);
    const [wx, wy] = g.toWorld(e.clientX, e.clientY);
    if (Math.hypot(wx - P0[0], wy - P0[1]) * g.sc > 48) return;
    drag.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!drag.current) return;
    const g = geom(e.currentTarget as HTMLElement);
    const [wx, wy] = g.toWorld(e.clientX, e.clientY);
    const patch = patchToward(wx, wy);
    if (patch) userSet(patch);
  };
  const onPointerUp = () => {
    drag.current = false;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (mode === 'identify' || !has('t')) return;
    const r = tRange(mode, cur.current.kind);
    const step = e.shiftKey ? r.step * 4 : r.step;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') userSet({ t: mode === 'ellipse' ? cur.current.t - step : cur.current.t - step });
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') userSet({ t: cur.current.t + step });
    else return;
    e.preventDefault();
  };

  const reset = () => {
    const f = fresh(props);
    cur.current = f;
    ctxRef.current = { touched: new Set(), baseline: f };
    setS(f);
    setLive('האיור אופס.');
  };

  /* ---------- text ---------- */
  const pText = (): { exact: string | null; dec: string } => {
    if (!P) return { exact: null, dec: '' };
    // cos 90° is 6e-17 in floating point: a coordinate that is 0 up to rounding is printed as 0
    const clean = (x: number) => fmtDecimal(Math.abs(x) < 1e-9 ? 0 : x);
    const dec = `(${clean(P[0])}, ${clean(P[1])})`;
    if (mode === 'ellipse') {
      const e = ellipsePointText(s.h, s.k, s.a, s.b, s.t);
      return { exact: e ? `(${e[0]}, ${e[1]})` : null, dec };
    }
    if (mode === 'parabola') {
      const [x, y] = parabolaPointExact(s.h, s.k, s.a, s.t, s.sideways);
      return { exact: `(${fmtFrac(x)}, ${fmtFrac(y)})`, dec };
    }
    const e = hyperbolaPointText(s.kind, s.h, s.k, s.a, s.b, s.c, s.t, s.branch);
    return { exact: `(${e[0]}, ${e[1]})`, dec };
  };

  const describe = (): string => {
    if (mode === 'ellipse') return `${s.a === s.b ? 'מעגל' : 'אליפסה'} שמשוואתה ${ellipseEq(s)}, מרכזה (${s.h}, ${s.k}), חצאי הצירים ${fmtNum(s.a)} ו-${fmtNum(s.b)}. הנקודה P בפרמטר t = ${s.t} מעלות ב-${pText().dec}.`;
    if (mode === 'parabola') return `פרבולה ${parabolaEq(s)} עם קודקוד (${s.h}, ${s.k}). הנקודה P בפרמטר t = ${fmtNum(s.t)} ב-${pText().dec}.`;
    if (mode === 'hyperbola') return `היפרבולה ${hyperbolaEq(s)}, שני ענפים ושתי אסימפטוטות. הנקודה P ב-${pText().dec}.`;
    return `העקום ${fmtPoly(coeffsOf(s))}: ${TYPE_HE[cl!.type]}.`;
  };

  /* ---------- readout ---------- */
  let readout: ComponentChildren = null;
  const pt = pText();
  const outside = P && !inWindow(P);

  if (mode === 'ellipse') {
    const T = s.t;
    const U = [Math.cos(rad(T)), Math.sin(rad(T))];
    readout = (
      <div class="cl-readout">
        <Row id="equation" label="המשוואה:" strong>
          {ellipseEq(s)}
        </Row>
        <Row id="axes" label="חצאי הצירים והמרכז:">
          {`a = ${fmtNum(s.a)},  b = ${fmtNum(s.b)},  (h, k) = (${fmtInt(s.h)}, ${fmtInt(s.k)})`}
        </Row>
        {s.a === s.b && (
          <div class="cl-row" data-readout="circle">
            <span class="cl-note">{`a = b: זה מעגל ברדיוס ${fmtNum(s.a)}`}</span>
          </div>
        )}
        <Row id="param" label="הפרמטריזציה:">
          {`(x, y) = (${lin(s.h, s.a, ' cos t')},  ${lin(s.k, s.b, ' sin t')}),  0 ≤ t < 2π`}
        </Row>
        <Row id="point" label="הנקודה P:" strong>
          {`t = ${fmtPiFraction(T)} (${T}°),  P ${pt.exact === pt.dec ? `= ${pt.dec}` : pt.exact ? `= ${pt.exact} ≈ ${pt.dec}` : `≈ ${pt.dec}`}`}
        </Row>
        {s.showUnit && (
          <Row id="unit" label="מעגל היחידה:">
            {`U = (cos t, sin t) ≈ (${fmtDecimal(Math.abs(U[0]) < 1e-9 ? 0 : U[0])}, ${fmtDecimal(Math.abs(U[1]) < 1e-9 ? 0 : U[1])})  →  ${s.h !== 0 || s.k !== 0 ? 'S = ' : ''}(a cos t, b sin t)  →  P`}
          </Row>
        )}
        <Row id="why" label="למה P על העקום:">
          {`((x − h)/a)² + ((y − k)/b)² = cos² t + sin² t = 1`}
        </Row>
      </div>
    );
  }

  if (mode === 'parabola') {
    const dir = s.sideways ? (s.a > 0 ? 'ימינה' : 'שמאלה') : s.a > 0 ? 'כלפי מעלה' : 'כלפי מטה';
    readout = (
      <div class="cl-readout">
        <Row id="equation" label="המשוואה:" strong>
          {parabolaEq(s)}
        </Row>
        <Row id="vertex" label="קודקוד:">
          {`(h, k) = (${fmtInt(s.h)}, ${fmtInt(s.k)})`}
        </Row>
        <div class="cl-row" data-readout="open">
          <span class="cl-lab">{`נפתחת ${dir}`}</span>
          <span class="cl-lab">{`(${ltr(`a = ${fmtNum(s.a)}`)}${Math.abs(s.a) > 1 ? ', צרה מהפרבולה הבסיסית' : Math.abs(s.a) < 1 ? ', רחבה מהפרבולה הבסיסית' : ''})`}</span>
        </div>
        <Row id="param" label="הפרמטריזציה:">
          {s.sideways ? `(x, y) = (${lin(s.h, s.a, 't²')},  ${fmtAffine(s.k, 1)}),  t ∈ ℝ` : `(x, y) = (${fmtAffine(s.h, 1)},  ${lin(s.k, s.a, 't²')}),  t ∈ ℝ`}
        </Row>
        <Row id="point" label="הנקודה P:" strong>
          {`t = ${fmtNum(s.t)},  P = ${pt.exact}${pt.exact === pt.dec ? '' : ` ≈ ${pt.dec}`}`}
        </Row>
        {outside && (
          <div class="cl-row" data-readout="outside">
            <span class="cl-note">P מחוץ לאיור: היא נמצאת על הפרבולה, אבל מעבר לגבולות הציור.</span>
          </div>
        )}
      </div>
    );
  }

  if (mode === 'hyperbola') {
    const H = frac(s.h);
    const K = frac(s.k);
    let asym: string[] = [];
    let opens = '';
    if (s.kind !== 'xy') {
      const slope = frac(Math.round(s.b * 2), Math.round(s.a * 2));
      const sl = slope.d === 1 ? String(slope.n) : `${slope.n}/${slope.d}`;
      asym = [asymText(H, K, sl)];
      opens = s.kind === 'x' ? 'נפתחת ימינה ושמאלה' : 'נפתחת למעלה ולמטה';
    } else {
      opens = s.c > 0 ? 'הענפים ברביעים הראשון והשלישי (ביחס למרכז)' : 'הענפים ברביעים השני והרביעי (ביחס למרכז)';
      asym = [`x = ${fmtInt(s.h)},  y = ${fmtInt(s.k)}`];
    }
    const root = `√(1 + u²)`;
    const par =
      s.kind === 'x'
        ? `(x, y) = (${signed(s.h, s.branch, `${s.a === 1 ? '' : fmtNum(s.a)}${root}`)},  ${lin(s.k, s.b, 'u')}),  u ∈ ℝ`
        : s.kind === 'y'
          ? `(x, y) = (${lin(s.h, s.a, 'u')},  ${signed(s.k, s.branch, `${s.b === 1 ? '' : fmtNum(s.b)}${root}`)}),  u ∈ ℝ`
          : `(x, y) = (${signed(s.h, s.branch, 't')},  ${signed(s.k, s.branch * Math.sign(s.c), `${Math.abs(s.c)}/t`)}),  t > 0`;
    readout = (
      <div class="cl-readout">
        <Row id="equation" label="המשוואה:" strong>
          {hyperbolaEq(s)}
        </Row>
        <div class="cl-row" data-readout="shape">
          {s.kind !== 'xy' && <span class="q cl-math">{`a = ${fmtNum(s.a)},  b = ${fmtNum(s.b)},  (h, k) = (${fmtInt(s.h)}, ${fmtInt(s.k)})`}</span>}
          {s.kind === 'xy' && <span class="q cl-math">{`c = ${fmtNum(s.c)},  (h, k) = (${fmtInt(s.h)}, ${fmtInt(s.k)})`}</span>}
          <span class="cl-lab">{opens}</span>
        </div>
        <Row id="asymptotes" label="האסימפטוטות:" strong>
          {asym.join(',  ')}
        </Row>
        <Row id="param" label="הפרמטריזציה:">
          {par}
        </Row>
        <Row id="point" label={`הנקודה P (${s.kind === 'xy' ? 't' : 'u'} = ${fmtNum(s.t)}):`} strong>
          {`P = ${pt.exact}${pt.exact === pt.dec ? '' : ` ≈ ${pt.dec}`}`}
        </Row>
        {outside && (
          <div class="cl-row" data-readout="outside">
            <span class="cl-note">P מחוץ לאיור: היא על ההיפרבולה, אבל מעבר לגבולות הציור.</span>
          </div>
        )}
      </div>
    );
  }

  if (mode === 'identify' && cl) {
    const details = identifyDetails(cl, coeffsOf(s));
    const sh = cl.shape;
    const cx = 'h' in sh ? sh.h : 0;
    const cy = 'k' in sh ? sh.k : 0;
    const farCentre = Math.abs(cx) > HX - 0.75 || Math.abs(cy) > HY - 0.75;
    readout = (
      <div class="cl-readout">
        <Row id="equation" label="המשוואה:">
          {fmtPoly(coeffsOf(s))}
        </Row>
        <Row id="completed" label="אחרי השלמה לריבוע:">
          {fmtCompleted(cl.form)}
        </Row>
        <div class="cl-row strong" data-readout="type">
          <span class="cl-lab">הסוג:</span>
          <span class="cl-note">{TYPE_HE[cl.type]}</span>
        </div>
        {details.map(([lab, txt], i) => (
          <Row key={i} id={`detail-${i}`} label={lab}>
            {txt}
          </Row>
        ))}
        {farCentre && sh.kind !== 'none' && (
          <div class="cl-row" data-readout="far">
            <span class="cl-note">המרכז או הקודקוד קרובים לשפת האיור או מחוצה לו: רק חלק מהעקום נראה.</span>
          </div>
        )}
      </div>
    );
  }

  /* ---------- controls ---------- */
  const COEFS: [keyof State, string, number, number][] = [
    ['A', 'A', -4, 4],
    ['C', 'C', -4, 4],
    ['D', 'D', -20, 20],
    ['E', 'E', -20, 20],
    ['F', 'F', -30, 30],
  ];
  const unitStep = (key: 'h' | 'k', lo: number, hi: number, label: string) => (
    <NumStep
      name={key}
      label={label}
      value={fmtInt(s[key])}
      decOff={s[key] <= lo}
      incOff={s[key] >= hi}
      aria={key === 'h' ? 'h, ההזזה בכיוון x' : 'k, ההזזה בכיוון y'}
      onDec={() => {
        userSet({ [key]: s[key] - 1 });
        setLive(`${key} = ${fmtInt(s[key] - 1)}`);
      }}
      onInc={() => {
        userSet({ [key]: s[key] + 1 });
        setLive(`${key} = ${fmtInt(s[key] + 1)}`);
      }}
    />
  );
  const halfStep = (key: 'a' | 'b', aria: string) => (
    <NumStep
      name={key}
      label={key}
      value={fmtNum(s[key])}
      decOff={s[key] <= 0.5}
      incOff={s[key] >= 4}
      aria={aria}
      onDec={() => {
        userSet({ [key]: s[key] - 0.5 });
        setLive(`${key} = ${fmtNum(s[key] - 0.5)}`);
      }}
      onInc={() => {
        userSet({ [key]: s[key] + 0.5 });
        setLive(`${key} = ${fmtNum(s[key] + 0.5)}`);
      }}
    />
  );
  const listStep = (key: 'a' | 'c', list: number[], aria: string) => {
    const i = list.indexOf(s[key]);
    return (
      <NumStep
        name={key}
        label={key}
        value={fmtNum(s[key])}
        decOff={i <= 0}
        incOff={i >= list.length - 1}
        aria={aria}
        onDec={() => {
          userSet({ [key]: list[i - 1] });
          setLive(`${key} = ${fmtNum(list[i - 1])}`);
        }}
        onInc={() => {
          userSet({ [key]: list[i + 1] });
          setLive(`${key} = ${fmtNum(list[i + 1])}`);
        }}
      />
    );
  };

  const range = tRange(mode, s.kind);
  const tLabel = mode === 'hyperbola' && s.kind !== 'xy' ? 'הפרמטר u' : 'הפרמטר t';
  const tFormat = (v: number) => (mode === 'ellipse' ? `${Math.round(v)}° = ${fmtPiFraction(Math.round(v))}` : fmtNum(v));

  const eqOf = (q: Coeffs) => fmtPoly(q);

  const controls = (
    <>
      {mode === 'hyperbola' && has('kind') && kinds.length > 1 && (
        <div class="group" role="group" aria-label="סוג ההיפרבולה">
          {kinds.map((kd) => (
            <Toggle
              key={kd}
              label={
                <bdi dir="ltr">
                  {kd === 'x' ? 'x²/a² − y²/b² = 1' : kd === 'y' ? 'y²/b² − x²/a² = 1' : 'xy = c'}
                </bdi>
              }
              on={s.kind === kd}
              onChange={() => userSet({ kind: kd })}
            />
          ))}
        </div>
      )}
      {mode !== 'identify' && (
        <div class="cl-nums" role="group" aria-label="הערכים של המשוואה">
          {mode === 'ellipse' && has('a') && halfStep('a', 'a, חצי הציר בכיוון x')}
          {mode === 'ellipse' && has('b') && halfStep('b', 'b, חצי הציר בכיוון y')}
          {mode === 'parabola' && has('a') && listStep('a', PARAB_A, 'a, מקדם הפרבולה')}
          {mode === 'hyperbola' && s.kind !== 'xy' && has('a') && halfStep('a', 'a, חצי המלבן בכיוון x')}
          {mode === 'hyperbola' && s.kind !== 'xy' && has('b') && halfStep('b', 'b, חצי המלבן בכיוון y')}
          {mode === 'hyperbola' && s.kind === 'xy' && has('c') && listStep('c', C_LIST, 'c, הקבוע במשוואה xy = c')}
          {has('h') && unitStep('h', -3, 3, 'h')}
          {has('k') && unitStep('k', -3, 3, 'k')}
        </div>
      )}
      {mode === 'identify' && has('coef') && (
        <div class="cl-nums" role="group" aria-label="המקדמים של המשוואה">
          {COEFS.map(([key, name, lo, hi]) => (
            <NumStep
              key={key}
              name={key}
              label={name}
              value={fmtInt(s[key] as number)}
              decOff={(s[key] as number) <= lo}
              incOff={(s[key] as number) >= hi}
              aria={`המקדם ${name}`}
              onDec={() => {
                userSet({ [key]: (s[key] as number) - 1 });
                setLive(`${name} = ${fmtInt((s[key] as number) - 1)}`);
              }}
              onInc={() => {
                userSet({ [key]: (s[key] as number) + 1 });
                setLive(`${name} = ${fmtInt((s[key] as number) + 1)}`);
              }}
            />
          ))}
        </div>
      )}
      {mode === 'identify' && has('presets') && props.presets && props.presets.length > 0 && (
        <div class="cl-presets" role="group" aria-label="דוגמאות">
          {props.presets.map((pr, i) => (
            <button key={i} type="button" class="toggle" data-preset={i} onClick={() => userSet({ A: pr[0], C: pr[1], D: pr[2], E: pr[3], F: pr[4] })}>
              {eqOf({ A: pr[0], C: pr[1], D: pr[2], E: pr[3], F: pr[4] })}
            </button>
          ))}
        </div>
      )}
      {mode !== 'identify' && has('t') && (
        <div class="cl-sliders">
          <Slider
            label={tLabel}
            value={s.t}
            min={range.min}
            max={range.max}
            step={range.step}
            format={tFormat}
            onChange={(v) => userSet({ t: v })}
          />
        </div>
      )}
      <div class="group" role="group" aria-label="מה להציג">
        {mode === 'ellipse' && has('unit') && <Toggle label="מעגל היחידה" on={s.showUnit} swatch="var(--ink-2)" onChange={(v) => userSet({ showUnit: v })} />}
        {mode === 'ellipse' && has('axes') && <Toggle label="חצאי הצירים" on={s.showAxes} swatch="var(--force)" onChange={(v) => userSet({ showAxes: v })} />}
        {mode === 'parabola' && has('sideways') && (
          <Toggle
            label={
              <>
                פרבולה אופקית: <bdi dir="ltr">x = a(y − k)² + h</bdi>
              </>
            }
            on={s.sideways}
            onChange={(v) => userSet({ sideways: v })}
          />
        )}
        {mode === 'parabola' && has('unit') && (
          <Toggle
            label={
              <>
                הפרבולה הבסיסית <bdi dir="ltr">{s.sideways ? 'x = y²' : 'y = x²'}</bdi>
              </>
            }
            on={s.showUnit}
            swatch="var(--ink-2)"
            onChange={(v) => userSet({ showUnit: v })}
          />
        )}
        {mode === 'parabola' && has('axes') && <Toggle label="ציר הסימטריה" on={s.showAxes} swatch="var(--force)" onChange={(v) => userSet({ showAxes: v })} />}
        {mode === 'hyperbola' && has('asym') && <Toggle label="אסימפטוטות" on={s.showAsym} swatch="var(--equip)" onChange={(v) => userSet({ showAsym: v })} />}
        {mode === 'hyperbola' && s.kind !== 'xy' && has('box') && (
          <Toggle
            label={
              <>
                המלבן <bdi dir="ltr">2a × 2b</bdi>
              </>
            }
            on={s.showBox}
            swatch="var(--delta)"
            onChange={(v) => userSet({ showBox: v })}
          />
        )}
        {mode === 'hyperbola' && has('branch') && (
          <button type="button" class="toggle" data-action="branch" onClick={() => userSet({ branch: (s.branch === 1 ? -1 : 1) as 1 | -1 })}>
            {`העבירו את P לענף ${s.kind === 'y' ? (s.branch === 1 ? 'התחתון' : 'העליון') : s.branch === 1 ? 'השמאלי' : 'הימני'}`}
          </button>
        )}
      </div>
      {mode !== 'identify' && has('t') && <p class="hint hand">גררו את P לאורך העקום, או הזיזו אותה בחצים כשהאיור במוקד.</p>}
    </>
  );

  return (
    <SimShell
      fig={props.id}
      label={`איור חי: מישור עם צירים בקנה מידה שווה. ${describe()}`}
      canvasRef={canvasRef}
      aspect={1.1}
      live={live}
      tasks={tasks}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      cursor={mode === 'identify' ? 'default' : 'crosshair'}
      onReset={reset}
      readout={readout}
      controls={controls}
    />
  );
}
