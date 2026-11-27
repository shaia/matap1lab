/**
 * CircleLab (lesson 4.4 trigonometric functions, waves and inverse functions; lesson 4.5 hyperbolic functions): four views.
 * Maths from src/math/trig.ts (the unit circle point, tan undefined at 90° + k·180°, the wave A sin(ωx + φ), the angles
 * with sin θ = v / cos θ = v / tan θ = v and the principal one, cosh and sinh). Colour code (never alone): the angle, the
 * reader's point and the principal angle = filled accent; the second function / the other angles / the mirror point =
 * hollow rings; the angle arc and the range of the inverse function = cool (--delta); cos and the x-projection = green
 * (--limit); sin, the height of tan and the amplitude = warm (--eps); the ghost sin x = faint dashed ink. Canvases are
 * math space: x to the right, y up, whatever the page direction. All angles in props and step keys are DEGREES.
 *
 * mode 'trig': the unit circle (left) and a graph (right) sharing the vertical scale (stacked on a phone, where the scales
 * are separate). θ ∈ [−360°, 720°] by the slider, by dragging in the circle or on the graph, or by the arrow keys. The
 * point (cos θ, sin θ), its two projections, the arc of θ. The graph of `fn` (sin / cos / tan) is faint and, with `trace`,
 * the part up to θ is bold. For tan the ray through the point meets the tangent line x = 1 at height tan θ; at
 * θ = 90° + k·180° (decided in whole degrees, see trig.ts) the figure says "לא מוגדר" and draws no point.
 * mode 'wave': y = A sin(ωx + φ) with the ghost sin x; the amplitude lines ±|A| (warm), the period as the distance from the
 * shifted zero (filled) to the next rising zero (hollow); readout amplitude, period 2π/ω, shift −φ/ω as π-multiples when exact.
 * mode 'arc': the circle with the line (y = v for arcsin, x = v for arccos, the line y = vx and the point (1, v) for arctan)
 * and every angle in (−180°, 180°] with that sine / cosine / tangent: the principal one filled, the others hollow, and
 * the range of the inverse function drawn as a thick arc (its ends hollow when open).
 * mode 'hyper': the right branch of x² − y² = 1 with (cosh t, sinh t), the faint unit circle with (cos t, sin t); beside it
 * the graphs of cosh (filled marker) and sinh (hollow marker) traced up to t, and with `halves` eᵗ/2 and e⁻ᵗ/2 dashed. THE
 * HYPERBOLA PANE SHOWS ONLY |t| up to about 2: beyond it the point leaves the pane and the graph carries it.
 *
 * Props (defaults): id (required); mode ('trig'); modes (the mode buttons shown; default the starting mode only);
 * controls (true: false hides sliders and toggles); tasks ([]).
 *   trig:  thetaDeg (30), fn ('sin' | 'cos' | 'tan', default 'sin'), trace (true)
 *   wave:  A (1), omega (1), phiDeg (0)
 *   arc:   fn ('arcsin' | 'arccos' | 'arctan', default 'arcsin'), v (0.5; 1 for arctan)
 *   hyper: t (1), halves (false)
 * Step `set` keys (a text step sets state through the step bus and never ticks a task): mode, and the keys of the mode
 * after the switch (fn is a trig name in trig, an inverse name in arc).
 * Tasks (ticked only by the reader's own change, and a state that already had the property when the step, the reset or
 * the first render made it must be left and found again):
 *   trig-second       θ mod 360 in (90°, 180°) (the reader moved θ): sin > 0 > cos
 *   trig-tan-undef    fn tan and θ within 1° of 90° + k·180° (the reader moved θ)
 *   trig-period       θ > 360° (the reader moved θ): the graph repeats
 *   wave-period       ω = 2 (the reader moved ω): period π
 *   wave-shift        φ ≠ 0 (the reader moved φ)
 *   wave-flip         A < 0 (the reader moved A)
 *   arc-negative      fn arcsin and v < 0 (the reader moved v): the principal angle is negative
 *   arc-cos-obtuse    fn arccos and v < 0 (the reader moved v): the angle is in (90°, 180°]
 *   arc-edge          fn arcsin or arccos and |v| within 0.01 of 1 (the reader moved v): one angle
 *   hyper-halves      halves on, |t| ≥ 2 and cosh t within 2% of e^|t|/2 (the reader moved t or the toggle)
 *   hyper-negative    t < 0 (the reader moved t): sinh changes sign, cosh does not
 * No animation: the figure only redraws when the reader or a step moves it, so there is nothing for motionAllowed().
 */

import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  PRINCIPAL_RANGE,
  anglesFor,
  circlePoint,
  coshOf,
  deg2rad,
  halves as halvesOf,
  hyperIdentity,
  hyperPoint,
  piText,
  principalValue,
  rad2deg,
  sinhOf,
  tanOf,
  tanUndefined,
  trigOf,
  waveInfo,
  waveValue,
  type InvFn,
  type TrigFn,
} from '~/math/trig';
import { markTask } from '~/progress/store';
import { relativeError } from '~/math/vec';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { withAlpha } from './core/ink';
import { drawAxes, makePlot, type Box, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import './CircleLab.css';

export type CircleMode = 'trig' | 'wave' | 'arc' | 'hyper';

export interface CircleLabProps {
  id: string;
  mode?: CircleMode;
  modes?: CircleMode[];
  controls?: boolean;
  tasks?: string[];
  thetaDeg?: number;
  fn?: string;
  trace?: boolean;
  A?: number;
  omega?: number;
  phiDeg?: number;
  v?: number;
  t?: number;
  halves?: boolean;
}

const TAU = 2 * Math.PI;
const PAD = 16;
const R_WORLD = 1.6; // half-range of the circle panes
const TH_MIN = -360;
const TH_MAX = 720;

interface State {
  mode: CircleMode;
  th: number; // degrees
  tf: TrigFn;
  trace: boolean;
  A: number;
  om: number;
  ph: number; // degrees
  af: InvFn;
  v: number;
  t: number;
  halves: boolean;
}

const isTrig = (v: unknown): v is TrigFn => v === 'sin' || v === 'cos' || v === 'tan';
const isInv = (v: unknown): v is InvFn => v === 'arcsin' || v === 'arccos' || v === 'arctan';
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const vLimit = (f: InvFn) => (f === 'arctan' ? 5 : 1);
const mod = (a: number, m: number) => ((a % m) + m) % m;

function initial(p: CircleLabProps): State {
  const af = isInv(p.fn) ? p.fn : 'arcsin';
  return {
    mode: p.mode ?? 'trig',
    th: clamp(p.thetaDeg ?? 30, TH_MIN, TH_MAX),
    tf: isTrig(p.fn) ? p.fn : 'sin',
    trace: p.trace ?? true,
    A: clamp(p.A ?? 1, -3, 3),
    om: clamp(p.omega ?? 1, 0.25, 4),
    ph: clamp(p.phiDeg ?? 0, -180, 180),
    af,
    v: clamp(p.v ?? (af === 'arctan' ? 1 : 0.5), -vLimit(af), vLimit(af)),
    t: clamp(p.t ?? 1, -3, 3),
    halves: p.halves ?? false,
  };
}

/* ---------- text ---------- */

/** a left-to-right island inside Hebrew text (U+2066 … U+2069), with no-break spaces so it never wraps */
const ltr = (s: string) => `⁦${s.replace(/ /g, ' ')}⁩`;
const MINUS = '−';

function num(x: number, d = 3): string {
  if (!Number.isFinite(x)) return '∞';
  let t = (Math.abs(x) < 0.5 * 10 ** -d ? 0 : x).toFixed(d);
  if (t.includes('.')) t = t.replace(/0+$/, '').replace(/\.$/, '');
  if (t === '-0') t = '0';
  return t.startsWith('-') ? MINUS + t.slice(1) : t;
}
/** a π-multiple when exact, else a decimal in radians */
const rad = (y: number): string => piText(y) ?? num(y, 3);

const MODE_LABEL: Record<CircleMode, string> = {
  trig: 'מעגל היחידה וגרף',
  wave: 'גל A sin(ωx + φ)',
  arc: 'הפונקציות ההפוכות',
  hyper: 'קוסינוס וסינוס היפרבוליים',
};
const MODE_ARIA: Record<CircleMode, string> = {
  trig: 'מעגל היחידה משמאל עם הזווית θ והנקודה (cos θ, sin θ), ומימינו הגרף של הפונקציה הטריגונומטרית',
  wave: 'הגרף של A sin(ωx + φ) בהשוואה לגרף של sin x',
  arc: 'מעגל היחידה עם כל הזוויות ש-sin, cos או tan שלהן שווה לערך v, והזווית הראשית מסומנת',
  hyper: 'ענף הימני של ההיפרבולה x² − y² = 1 עם הנקודה (cosh t, sinh t), ומימינו הגרפים של cosh ושל sinh',
};

const TASK_LABEL: Record<string, string> = {
  'trig-second': `העמידו את ${ltr('θ')} ברביע השני, בין ${ltr('90°')} ל-${ltr('180°')}. מה סימני ${ltr('sin θ')} ו-${ltr('cos θ')}?`,
  'trig-tan-undef': `בחרו ${ltr('tan')} וקרבו את ${ltr('θ')} אל ${ltr('90°')}. מה קורה לגובה על הישר ${ltr('x = 1')}?`,
  'trig-period': `המשיכו את ${ltr('θ')} מעבר ל-${ltr('360°')}. מה קורה לגרף?`,
  'wave-period': `קבעו ${ltr('ω = 2')}. מהי מחזוריות הגל?`,
  'wave-shift': `הזיזו את ${ltr('φ')}. לאן זז הגרף, ולאיזה כיוון?`,
  'wave-flip': `קבעו ${ltr('A')} שלילי. מה קורה לגרף?`,
  'arc-negative': `בחרו ${ltr('arcsin')} וערך ${ltr('v')} שלילי. באיזה רביע הזווית הראשית?`,
  'arc-cos-obtuse': `בחרו ${ltr('arccos')} וערך ${ltr('v')} שלילי. באיזה קטע נמצאת הזווית הראשית?`,
  'arc-edge': `קרבו את ${ltr('v')} אל ${ltr('1')} או אל ${ltr('−1')}. כמה זוויות נשארות?`,
  'hyper-halves': `הדליקו את החצאים והעמידו את ${ltr('t')} רחוק מ-${ltr('0')}, לפחות ${ltr('|t| = 2')}. איזה חצי ${ltr('cosh t')} כמעט שווה לו?`,
  'hyper-negative': `הציבו ${ltr('t')} שלילי. מה קורה ל-${ltr('sinh t')}, ומה ל-${ltr('cosh t')}?`,
};

/* ---------- tasks ---------- */

function cond(task: string, s: State, touched: Set<keyof State>): boolean {
  switch (task) {
    case 'trig-second': {
      const m = mod(s.th, 360);
      return s.mode === 'trig' && m > 90 && m < 180 && touched.has('th');
    }
    case 'trig-tan-undef': {
      const r = mod(s.th - 90, 180);
      return s.mode === 'trig' && s.tf === 'tan' && Math.min(r, 180 - r) <= 1 && touched.has('th');
    }
    case 'trig-period':
      return s.mode === 'trig' && s.th > 360 && touched.has('th');
    case 'wave-period':
      return s.mode === 'wave' && s.om === 2 && touched.has('om');
    case 'wave-shift':
      return s.mode === 'wave' && s.ph !== 0 && touched.has('ph');
    case 'wave-flip':
      return s.mode === 'wave' && s.A < 0 && touched.has('A');
    case 'arc-negative':
      return s.mode === 'arc' && s.af === 'arcsin' && s.v < 0 && touched.has('v');
    case 'arc-cos-obtuse':
      return s.mode === 'arc' && s.af === 'arccos' && s.v < 0 && touched.has('v');
    case 'arc-edge':
      return s.mode === 'arc' && s.af !== 'arctan' && Math.abs(Math.abs(s.v) - 1) <= 0.01 && touched.has('v');
    case 'hyper-halves': {
      if (s.mode !== 'hyper' || !s.halves || Math.abs(s.t) < 2 || !(touched.has('t') || touched.has('halves'))) return false;
      return relativeError(coshOf(s.t), Math.exp(Math.abs(s.t)) / 2) <= 0.02;
    }
    case 'hyper-negative':
      return s.mode === 'hyper' && s.t < 0 && touched.has('t');
    default:
      return false;
  }
}

/* ---------- drawing helpers ---------- */

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color: string, p: Palette, align: CanvasTextAlign = 'center', size = 12) {
  ctx.save();
  ctx.font = `600 ${size}px ${p.fontUi}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.direction = 'ltr';
  ctx.fillText(s, x, y);
  ctx.restore();
}
function seg(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, wd = 1.5, dash: number[] = []) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = wd;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}
/** a filled dot (the reader's point, the principal angle) or a hollow ring (other angles, second function) */
function dot(ctx: CanvasRenderingContext2D, x: number, y: number, filled: boolean, color: string, p: Palette, r = 6) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  if (filled) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.fillStyle = p.paper;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.stroke();
  }
  ctx.restore();
}
function clipTo(ctx: CanvasRenderingContext2D, b: Box) {
  ctx.beginPath();
  ctx.rect(b.x, b.y, b.w, b.h);
  ctx.clip();
}

/** a pane with a uniform scale: `unit` px per world unit, world centre (wx, wy) at the pane centre */
interface Pane {
  box: Box;
  cx: number;
  cy: number;
  unit: number;
  wx: number;
  wy: number;
}
function pane(box: Box, halfX: number, halfY: number, wx = 0, wy = 0): Pane {
  const unit = Math.max(4, Math.min((box.w - 2 * PAD) / (2 * halfX), (box.h - 2 * PAD) / (2 * halfY)));
  return { box, cx: box.x + box.w / 2, cy: box.y + box.h / 2, unit, wx, wy };
}
const PX = (pn: Pane, x: number) => pn.cx + (x - pn.wx) * pn.unit;
const PY = (pn: Pane, y: number) => pn.cy - (y - pn.wy) * pn.unit;
const WX = (pn: Pane, sx: number) => pn.wx + (sx - pn.cx) / pn.unit;
const WY = (pn: Pane, sy: number) => pn.wy - (sy - pn.cy) / pn.unit;

function paneFrame(ctx: CanvasRenderingContext2D, pn: Pane, p: Palette, ticks: { x: number[]; y: number[] }, bg = true) {
  const b = pn.box;
  if (bg) {
    ctx.save();
    ctx.fillStyle = withAlpha(p.paper2, 0.5);
    ctx.fillRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
    ctx.strokeStyle = p.rule;
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
    ctx.restore();
  }
  seg(ctx, b.x + 4, PY(pn, 0), b.x + b.w - 4, PY(pn, 0), p.ink2, 1.2);
  seg(ctx, PX(pn, 0), b.y + 4, PX(pn, 0), b.y + b.h - 4, p.ink2, 1.2);
  for (const v of ticks.x) {
    seg(ctx, PX(pn, v), PY(pn, 0) - 3, PX(pn, v), PY(pn, 0) + 3, p.ink2, 1);
    text(ctx, num(v, 0), PX(pn, v), PY(pn, 0) + 13, p.ink3, p, 'center', 10);
  }
  for (const v of ticks.y) {
    seg(ctx, PX(pn, 0) - 3, PY(pn, v), PX(pn, 0) + 3, PY(pn, v), p.ink2, 1);
    text(ctx, num(v, 0), PX(pn, 0) - 8, PY(pn, v), p.ink3, p, 'right', 10);
  }
}

function circleOf(ctx: CanvasRenderingContext2D, pn: Pane, color: string, wd = 1.5, dash: number[] = []) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = wd;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.arc(PX(pn, 0), PY(pn, 0), pn.unit, 0, TAU);
  ctx.stroke();
  ctx.restore();
}
/** an arc of radius rw (world) from math angle a0 to a1 (radians, counter-clockwise positive) */
function arcOf(ctx: CanvasRenderingContext2D, pn: Pane, rw: number, a0: number, a1: number, color: string, wd = 2) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = wd;
  ctx.beginPath();
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 0.05));
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const x = PX(pn, rw * Math.cos(a));
    const y = PY(pn, rw * Math.sin(a));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

/** y = f(x) from x0 to x1 in a plot, broken at NaN and at jumps larger than `jump` px (asymptotes), clipped to the box */
function strokeFn(
  ctx: CanvasRenderingContext2D,
  pl: Plot,
  f: (x: number) => number,
  x0: number,
  x1: number,
  color: string,
  wd: number,
  dash: number[] = [],
  samples = 500,
) {
  ctx.save();
  clipTo(ctx, pl.box);
  ctx.strokeStyle = color;
  ctx.lineWidth = wd;
  ctx.lineJoin = 'round';
  ctx.setLineDash(dash);
  ctx.beginPath();
  let started = false;
  let prevY = 0;
  const jump = pl.box.h * 1.5;
  for (let i = 0; i <= samples; i++) {
    const x = x0 + ((x1 - x0) * i) / samples;
    const y = f(x);
    if (!Number.isFinite(y)) {
      started = false;
      continue;
    }
    const sx = pl.px(x);
    const sy = pl.py(y);
    if (started && Math.abs(sy - prevY) < jump) ctx.lineTo(sx, sy);
    else ctx.moveTo(sx, sy);
    prevY = sy;
    started = true;
  }
  ctx.stroke();
  ctx.restore();
}

/* ---------- layout ---------- */

interface Layout {
  left: Box;
  right: Box | null;
}
function layout(mode: CircleMode, W: number, H: number, narrow: boolean): Layout {
  if (mode === 'wave') return { left: { x: 0, y: 0, w: W, h: H }, right: null };
  if (mode === 'arc') {
    const side = Math.min(W, H);
    return { left: { x: (W - side) / 2, y: 0, w: side, h: H }, right: null };
  }
  if (narrow) {
    const h1 = Math.min(W, H * 0.5);
    return { left: { x: 0, y: 0, w: W, h: h1 }, right: { x: 0, y: h1, w: W, h: H - h1 } };
  }
  const w1 = Math.min(H, W * 0.44);
  return { left: { x: 0, y: 0, w: w1, h: H }, right: { x: w1, y: 0, w: W - w1, h: H } };
}

/** the plot box of the right graph; in a side-by-side layout its vertical extent is that of the circle (shared scale) */
function graphBox(right: Box, left: Pane | null, yHalf: number, narrow: boolean): Box {
  if (!narrow && left) {
    const top = PY(left, yHalf);
    return { x: right.x + 44, y: top, w: Math.max(20, right.w - 44 - 14), h: PY(left, -yHalf) - top };
  }
  return { x: right.x + 44, y: right.y + 14, w: Math.max(20, right.w - 44 - 14), h: Math.max(20, right.h - 14 - 34) };
}

/* ---------- trig ---------- */

function degTicks(from: number, to: number, step = 180): number[] {
  const out: number[] = [];
  for (let d = Math.ceil(from / step) * step; d <= to; d += step) out.push(d);
  return out;
}

function trigGraphPlot(box: Box, s: State): Plot {
  return makePlot(
    box,
    { min: TH_MIN, max: TH_MAX, ticks: degTicks(TH_MIN, TH_MAX), format: (v) => `${num(v, 0)}°`, label: `θ` },
    { min: -R_WORLD, max: R_WORLD, ticks: s.tf === 'tan' ? [-1, 0, 1] : [-1, 0, 1], format: (v) => num(v, 0) },
  );
}

function drawTrig(ctx: CanvasRenderingContext2D, W: number, H: number, p: Palette, s: State, narrow: boolean) {
  const L = layout('trig', W, H, narrow);
  const pn = pane(L.left, R_WORLD, R_WORLD);
  paneFrame(ctx, pn, p, { x: [-1, 1], y: [-1, 1] });
  circleOf(ctx, pn, p.ink3, 1.5, [5, 4]);
  const th = deg2rad(s.th);
  const P = circlePoint(th);
  const undef = s.tf === 'tan' && tanUndefined(s.th);
  ctx.save();
  clipTo(ctx, { x: L.left.x + 3, y: L.left.y + 3, w: L.left.w - 6, h: L.left.h - 6 });
  if (s.tf === 'tan') seg(ctx, PX(pn, 1), PY(pn, -R_WORLD), PX(pn, 1), PY(pn, R_WORLD), p.ink3, 1.3, [4, 3]);
  arcOf(ctx, pn, 0.3, 0, th, p.delta, 2.4);
  // projections: cos on the x-axis (green), sin on the y-axis (warm); the active function is thick
  seg(ctx, PX(pn, P.x), PY(pn, P.y), PX(pn, P.x), PY(pn, 0), p.ink3, 1.1, [3, 3]);
  seg(ctx, PX(pn, P.x), PY(pn, P.y), PX(pn, 0), PY(pn, P.y), p.ink3, 1.1, [3, 3]);
  seg(ctx, PX(pn, 0), PY(pn, 0), PX(pn, P.x), PY(pn, 0), p.limit, s.tf === 'cos' ? 5 : 2.6);
  seg(ctx, PX(pn, 0), PY(pn, 0), PX(pn, 0), PY(pn, P.y), p.eps, s.tf === 'sin' ? 5 : 2.6);
  // the radius, extended to the tangent line for tan
  if (!undef) {
    const k = s.tf === 'tan' && Math.abs(P.x) > 1e-9 ? 1 / P.x : 1;
    const ex = P.x * Math.max(k, 1);
    const ey = P.y * Math.max(k, 1);
    seg(ctx, PX(pn, 0), PY(pn, 0), PX(pn, s.tf === 'tan' ? ex : P.x), PY(pn, s.tf === 'tan' ? ey : P.y), p.accent, s.tf === 'tan' ? 1.6 : 2.4, s.tf === 'tan' ? [4, 3] : []);
    if (s.tf === 'tan' && P.x > 1e-9) {
      const T = tanOf(s.th);
      seg(ctx, PX(pn, 1), PY(pn, 0), PX(pn, 1), PY(pn, T), p.eps, 5);
      if (Math.abs(T) <= R_WORLD) dot(ctx, PX(pn, 1), PY(pn, T), false, p.eps, p, 5);
      else text(ctx, `tan θ = ${num(T, 2)}`, PX(pn, 1) - 6, PY(pn, clamp(T, -R_WORLD + 0.15, R_WORLD - 0.15)), p.eps, p, 'right', 11);
    }
  } else {
    seg(ctx, PX(pn, 0), PY(pn, 0), PX(pn, P.x), PY(pn, P.y), p.accent, 2.4);
    text(ctx, 'לא מוגדר', PX(pn, 1) - 8, PY(pn, 0.55), p.eps, p, 'right', 12);
  }
  dot(ctx, PX(pn, P.x), PY(pn, P.y), true, p.accent, p, 7);
  ctx.restore();
  text(ctx, `θ = ${num(s.th, 0)}°`, L.left.x + 10, L.left.y + 14, p.ink, p, 'left', 12);

  if (!L.right) return;
  const gb = graphBox(L.right, pn, R_WORLD, narrow);
  const pl = trigGraphPlot(gb, s);
  drawAxes(ctx, pl, p, { grid: true });
  seg(ctx, gb.x, pl.py(0), gb.x + gb.w, pl.py(0), p.ink2, 1.2);
  const f = (d: number) => trigOf(s.tf, d);
  if (s.tf === 'tan') {
    for (let d = 90 + 180 * Math.ceil((TH_MIN - 90) / 180); d <= TH_MAX; d += 180) seg(ctx, pl.px(d), gb.y, pl.px(d), gb.y + gb.h, p.ink3, 1, [2, 4]);
  }
  strokeFn(ctx, pl, f, TH_MIN, TH_MAX, s.trace ? withAlpha(p.ink3, 0.6) : p.curve, s.trace ? 1.4 : 2.2, [], 720);
  if (s.trace) strokeFn(ctx, pl, f, TH_MIN, s.th, p.accent, 2.6, [], 720);
  ctx.save();
  clipTo(ctx, { x: gb.x - 6, y: gb.y - 6, w: gb.w + 12, h: gb.h + 12 });
  const gx = pl.px(s.th);
  seg(ctx, gx, gb.y, gx, gb.y + gb.h, p.ink3, 1, [3, 4]);
  if (undef) text(ctx, 'לא מוגדר', gx + 6, gb.y + gb.h * 0.3, p.eps, p, 'left', 12);
  else {
    const y = f(s.th);
    if (Math.abs(y) <= R_WORLD) {
      if (!narrow) seg(ctx, PX(pn, P.x), PY(pn, y), gx, pl.py(y), p.ink3, 1, [2, 4]);
      dot(ctx, gx, pl.py(y), true, p.accent, p, 6);
    }
  }
  ctx.restore();
  text(ctx, s.tf === 'sin' ? 'y = sin θ' : s.tf === 'cos' ? 'y = cos θ' : 'y = tan θ', gb.x + 8, gb.y + 12, p.accent, p, 'left', 12);
}

/* ---------- wave ---------- */

const PI_TICKS = [-2, -1, 0, 1, 2].map((k) => k * Math.PI);
function drawWave(ctx: CanvasRenderingContext2D, W: number, H: number, p: Palette, s: State) {
  const gb: Box = { x: 48, y: 14, w: Math.max(20, W - 48 - 14), h: Math.max(20, H - 14 - 38) };
  const pl = makePlot(
    gb,
    { min: -TAU, max: TAU, ticks: PI_TICKS, format: (v) => (v === 0 ? '0' : rad(v)), label: 'x' },
    { min: -3.5, max: 3.5, ticks: [-3, -2, -1, 0, 1, 2, 3], format: (v) => num(v, 0) },
  );
  drawAxes(ctx, pl, p, { grid: true });
  seg(ctx, gb.x, pl.py(0), gb.x + gb.w, pl.py(0), p.ink2, 1.2);
  seg(ctx, pl.px(0), gb.y, pl.px(0), gb.y + gb.h, p.ink2, 1.2);
  const phi = deg2rad(s.ph);
  const info = waveInfo(s.A, s.om, phi);
  ctx.save();
  clipTo(ctx, gb);
  for (const sg of [1, -1]) seg(ctx, gb.x, pl.py(sg * info.amplitude), gb.x + gb.w, pl.py(sg * info.amplitude), p.eps, 1.3, [6, 4]);
  ctx.restore();
  strokeFn(ctx, pl, Math.sin, -TAU, TAU, withAlpha(p.ink3, 0.8), 1.6, [2, 4], 400);
  strokeFn(ctx, pl, (x) => waveValue(s.A, s.om, phi, x), -TAU, TAU, p.accent, 2.8, [], 600);
  ctx.save();
  clipTo(ctx, { x: gb.x - 6, y: gb.y - 6, w: gb.w + 12, h: gb.h + 12 });
  // one period, from the shifted zero (filled) to the next rising zero (hollow)
  const x0 = info.shift;
  const x1 = x0 + info.period;
  const yb = pl.py(0);
  seg(ctx, pl.px(x0), yb + 16, pl.px(x1), yb + 16, p.eps, 2.2);
  seg(ctx, pl.px(x0), yb + 11, pl.px(x0), yb + 21, p.eps, 2.2);
  seg(ctx, pl.px(x1), yb + 11, pl.px(x1), yb + 21, p.eps, 2.2);
  dot(ctx, pl.px(x0), yb, true, p.accent, p, 5);
  dot(ctx, pl.px(x1), yb, false, p.accent, p, 5);
  ctx.restore();
  // legend
  let ly = gb.y + 14;
  const lx = gb.x + 10;
  seg(ctx, lx, ly, lx + 26, ly, p.accent, 2.8);
  text(ctx, `y = ${num(s.A, 2)} sin(${num(s.om, 2)}x ${s.ph < 0 ? MINUS : '+'} ${rad(deg2rad(Math.abs(s.ph)))})`, lx + 32, ly, p.accent, p, 'left', 12);
  ly += 17;
  seg(ctx, lx, ly, lx + 26, ly, p.ink3, 1.6, [2, 4]);
  text(ctx, 'y = sin x', lx + 32, ly, p.ink2, p, 'left', 12);
  ly += 17;
  seg(ctx, lx, ly, lx + 26, ly, p.eps, 1.3, [6, 4]);
  text(ctx, `±|A| = ${num(info.amplitude, 2)}`, lx + 32, ly, p.eps, p, 'left', 12);
}

/* ---------- arc ---------- */

function arcLine(af: InvFn, v: number): string {
  return af === 'arcsin' ? `sin θ = ${num(v, 2)}` : af === 'arccos' ? `cos θ = ${num(v, 2)}` : `tan θ = ${num(v, 2)}`;
}

function drawArc(ctx: CanvasRenderingContext2D, W: number, H: number, p: Palette, s: State) {
  const L = layout('arc', W, H, false);
  const pn = pane(L.left, R_WORLD, R_WORLD);
  paneFrame(ctx, pn, p, { x: [-1, 1], y: [-1, 1] });
  circleOf(ctx, pn, p.ink3, 1.5, [5, 4]);
  const rg = PRINCIPAL_RANGE[s.af];
  ctx.save();
  clipTo(ctx, { x: L.left.x + 3, y: L.left.y + 3, w: L.left.w - 6, h: L.left.h - 6 });
  // the range of the inverse function, as a thick arc of the circle
  arcOf(ctx, pn, 1, rg.lo, rg.hi, p.delta, 6);
  if (!rg.closed) {
    for (const a of [rg.lo, rg.hi]) dot(ctx, PX(pn, Math.cos(a)), PY(pn, Math.sin(a)), false, p.delta, p, 5);
  }
  // the line that defines the angles
  const v = s.v;
  if (s.af === 'arcsin') seg(ctx, PX(pn, -R_WORLD), PY(pn, v), PX(pn, R_WORLD), PY(pn, v), p.eps, 2, [6, 4]);
  else if (s.af === 'arccos') seg(ctx, PX(pn, v), PY(pn, -R_WORLD), PX(pn, v), PY(pn, R_WORLD), p.limit, 2, [6, 4]);
  else {
    seg(ctx, PX(pn, 1), PY(pn, -R_WORLD), PX(pn, 1), PY(pn, R_WORLD), p.ink3, 1.2, [4, 3]);
    seg(ctx, PX(pn, -R_WORLD / Math.max(1, Math.abs(v))), PY(pn, (-R_WORLD * v) / Math.max(1, Math.abs(v))), PX(pn, R_WORLD / Math.max(1, Math.abs(v))), PY(pn, (R_WORLD * v) / Math.max(1, Math.abs(v))), p.eps, 2, [6, 4]);
    if (Math.abs(v) <= R_WORLD) dot(ctx, PX(pn, 1), PY(pn, v), false, p.eps, p, 4.5);
  }
  const angles = anglesFor(s.af, v);
  for (const a of angles) {
    const x = PX(pn, Math.cos(a.theta));
    const y = PY(pn, Math.sin(a.theta));
    seg(ctx, PX(pn, 0), PY(pn, 0), x, y, a.principal ? p.accent : withAlpha(p.accent, 0.5), a.principal ? 2.4 : 1.4, a.principal ? [] : [4, 3]);
  }
  for (const a of angles) {
    if (!a.principal) dot(ctx, PX(pn, Math.cos(a.theta)), PY(pn, Math.sin(a.theta)), false, p.accent, p, 6.5);
  }
  for (const a of angles) {
    if (a.principal) {
      arcOf(ctx, pn, 0.3, 0, a.theta, p.accent, 2.2);
      dot(ctx, PX(pn, Math.cos(a.theta)), PY(pn, Math.sin(a.theta)), true, p.accent, p, 7.5);
    }
  }
  ctx.restore();
  text(ctx, arcLine(s.af, v), L.left.x + 10, L.left.y + 14, p.ink, p, 'left', 12);
  if (s.af === 'arctan' && Math.abs(v) > R_WORLD) text(ctx, `(1, ${num(v, 2)}) מחוץ לציור`, L.left.x + 10, L.left.y + 32, p.ink2, p, 'left', 11);
}

/* ---------- hyper ---------- */

const HY_X = 5;
const HY_Y = 4;
const HY_T = 3;
function drawHyper(ctx: CanvasRenderingContext2D, W: number, H: number, p: Palette, s: State, narrow: boolean) {
  const L = layout('hyper', W, H, narrow);
  const pn = pane(L.left, 3.25, HY_Y, 1.75, 0);
  paneFrame(ctx, pn, p, { x: [-1, 1, 2, 3, 4], y: [-3, -2, -1, 1, 2, 3] });
  ctx.save();
  clipTo(ctx, { x: L.left.x + 3, y: L.left.y + 3, w: L.left.w - 6, h: L.left.h - 6 });
  circleOf(ctx, pn, withAlpha(p.ink3, 0.8), 1.3, [4, 4]);
  // the branch x² − y² = 1, x ≥ 1
  ctx.save();
  ctx.strokeStyle = p.curve;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let i = 0; i <= 200; i++) {
    const t = -HY_T + (2 * HY_T * i) / 200;
    const x = PX(pn, Math.cosh(t));
    const y = PY(pn, Math.sinh(t));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
  const C = circlePoint(s.t);
  seg(ctx, PX(pn, 0), PY(pn, 0), PX(pn, C.x), PY(pn, C.y), withAlpha(p.ink3, 0.8), 1.2, [3, 3]);
  dot(ctx, PX(pn, C.x), PY(pn, C.y), false, p.ink2, p, 5);
  const H1 = hyperPoint(s.t);
  seg(ctx, PX(pn, H1.x), PY(pn, 0), PX(pn, H1.x), PY(pn, H1.y), p.ink3, 1.1, [3, 3]);
  seg(ctx, PX(pn, 0), PY(pn, H1.y), PX(pn, H1.x), PY(pn, H1.y), p.ink3, 1.1, [3, 3]);
  seg(ctx, PX(pn, 0), PY(pn, 0), PX(pn, H1.x), PY(pn, 0), p.limit, 3.2);
  seg(ctx, PX(pn, 0), PY(pn, 0), PX(pn, 0), PY(pn, H1.y), p.eps, 3.2);
  dot(ctx, PX(pn, H1.x), PY(pn, H1.y), true, p.accent, p, 7);
  ctx.restore();
  text(ctx, 'x² − y² = 1', L.left.x + 10, L.left.y + 14, p.ink, p, 'left', 12);
  if (Math.abs(H1.y) > HY_Y || H1.x > HY_X) text(ctx, 'הנקודה מחוץ לציור: ראו בגרף', L.left.x + 10, L.left.y + 32, p.ink2, p, 'left', 11);

  if (!L.right) return;
  const gb = graphBox(L.right, pn, HY_Y, narrow);
  const pl = makePlot(
    gb,
    { min: -HY_T, max: HY_T, ticks: [-3, -2, -1, 0, 1, 2, 3], format: (v) => num(v, 0), label: 't' },
    { min: -11, max: 11, ticks: [-10, -5, 0, 5, 10], format: (v) => num(v, 0) },
  );
  drawAxes(ctx, pl, p, { grid: true });
  seg(ctx, gb.x, pl.py(0), gb.x + gb.w, pl.py(0), p.ink2, 1.2);
  seg(ctx, pl.px(0), gb.y, pl.px(0), gb.y + gb.h, p.ink2, 1.2);
  if (s.halves) {
    strokeFn(ctx, pl, (t) => halvesOf(t).pos, -HY_T, HY_T, p.eps, 1.8, [6, 4]);
    strokeFn(ctx, pl, (t) => halvesOf(t).neg, -HY_T, HY_T, p.ink2, 1.8, [2, 4]);
  }
  strokeFn(ctx, pl, coshOf, -HY_T, HY_T, withAlpha(p.accent, 0.35), 1.4);
  strokeFn(ctx, pl, sinhOf, -HY_T, HY_T, withAlpha(p.delta, 0.35), 1.4);
  strokeFn(ctx, pl, coshOf, -HY_T, s.t, p.accent, 2.6);
  strokeFn(ctx, pl, sinhOf, -HY_T, s.t, p.delta, 2.6);
  ctx.save();
  clipTo(ctx, { x: gb.x - 6, y: gb.y - 6, w: gb.w + 12, h: gb.h + 12 });
  const gx = pl.px(s.t);
  seg(ctx, gx, gb.y, gx, gb.y + gb.h, p.ink3, 1, [3, 4]);
  dot(ctx, gx, pl.py(coshOf(s.t)), true, p.accent, p, 6);
  dot(ctx, gx, pl.py(sinhOf(s.t)), false, p.delta, p, 6);
  if (s.halves) {
    const h = halvesOf(s.t);
    dot(ctx, gx, pl.py(h.pos), false, p.eps, p, 4);
    dot(ctx, gx, pl.py(h.neg), false, p.ink2, p, 4);
  }
  ctx.restore();
  let ly = gb.y + 14;
  const lx = gb.x + 8;
  const entry = (label: string, color: string, dash: number[], wd: number, filled: boolean | null) => {
    seg(ctx, lx, ly, lx + 24, ly, color, wd, dash);
    if (filled !== null) dot(ctx, lx + 12, ly, filled, color, p, 3.5);
    text(ctx, label, lx + 30, ly, color, p, 'left', 12);
    ly += 16;
  };
  entry('y = cosh t', p.accent, [], 2.6, true);
  entry('y = sinh t', p.delta, [], 2.6, false);
  if (s.halves) {
    entry('y = eᵗ/2', p.eps, [6, 4], 1.8, null);
    entry('y = e⁻ᵗ/2', p.ink2, [2, 4], 1.8, null);
  }
}

/* ---------- readout ---------- */

function Row(p: { lab: string; math: string; strong?: boolean }) {
  return (
    <div class={`cl-row${p.strong ? ' strong' : ''}`}>
      <span class="cl-lab">{p.lab}</span>
      <span class="cl-math" dir="ltr">
        {p.math}
      </span>
    </div>
  );
}

function quadrant(deg: number): string {
  const m = mod(deg, 360);
  if (m === 0 || m === 90 || m === 180 || m === 270) return 'על אחד הצירים';
  return m < 90 ? 'הרביע הראשון' : m < 180 ? 'הרביע השני' : m < 270 ? 'הרביע השלישי' : 'הרביע הרביעי';
}

function readoutFor(s: State): ComponentChildren {
  if (s.mode === 'trig') {
    const th = deg2rad(s.th);
    const P = circlePoint(th);
    const T = tanOf(s.th);
    return (
      <div class="cl-readout">
        <Row lab="הזווית" math={`θ = ${num(s.th, 0)}° = ${rad(th)} rad`} />
        <Row lab="הנקודה על המעגל" math={`(cos θ, sin θ) = (${num(P.x, 4)}, ${num(P.y, 4)})`} strong />
        <Row lab="הטנגנס" math={Number.isNaN(T) ? 'tan θ: לא מוגדר' : `tan θ = sin θ / cos θ = ${num(T, 4)}`} />
        {Number.isNaN(T) && s.tf === 'tan' && <div class="cl-note">{`${ltr('cos θ = 0')}: הישר דרך הנקודה מקביל לישר ${ltr('x = 1')} ולא פוגש אותו.`}</div>}
        <div class="cl-note">{`${quadrant(s.th)}.`}</div>
        {s.th > 360 || s.th < 0 ? <div class="cl-note">{`${ltr(`θ ${s.th > 360 ? MINUS : '+'} 360° = ${num(s.th + (s.th > 360 ? -360 : 360), 0)}°`)}: אותה נקודה, אותו ערך.`}</div> : null}
      </div>
    );
  }
  if (s.mode === 'wave') {
    const phi = deg2rad(s.ph);
    const w = waveInfo(s.A, s.om, phi);
    return (
      <div class="cl-readout">
        <Row lab="הגל" math={`y = ${num(s.A, 2)} sin(${num(s.om, 2)}x ${s.ph < 0 ? MINUS : '+'} ${rad(deg2rad(Math.abs(s.ph)))})`} strong />
        <Row lab="אמפליטודה" math={`|A| = ${num(w.amplitude, 2)}`} />
        <Row lab="מחזור" math={`2π/ω = ${rad(w.period)}`} />
        <Row lab="הזזת מופע" math={`−φ/ω = ${rad(w.shift)}`} />
        {s.A < 0 && <div class="cl-note">{`${ltr('A < 0')}: הגרף מתהפך סביב ציר ${ltr('x')}.`}</div>}
        {w.shift !== 0 && <div class="cl-note">{w.shift > 0 ? 'הגרף זז ימינה ביחס ל-' : 'הגרף זז שמאלה ביחס ל-'}{ltr(`sin(${num(s.om, 2)}x)`)}.</div>}
      </div>
    );
  }
  if (s.mode === 'arc') {
    const pv = principalValue(s.af, s.v);
    const list = anglesFor(s.af, s.v);
    const f = s.af === 'arcsin' ? 'sin' : s.af === 'arccos' ? 'cos' : 'tan';
    return (
      <div class="cl-readout">
        <Row lab="הערך הראשי" math={`${s.af} ${num(s.v, 2)} = ${rad(pv)} rad = ${num(rad2deg(pv), 2)}°`} strong />
        <Row lab="התמונה של הפונקציה ההפוכה" math={s.af === 'arcsin' ? '[−π/2, π/2]' : s.af === 'arccos' ? '[0, π]' : '(−π/2, π/2)'} />
        <div class="cl-lab">{`כל הזוויות ב-${ltr('(−180°, 180°]')} עם ${ltr(`${f} θ = ${num(s.v, 2)}`)}:`}</div>
        <ul class="cl-list">
          {list.map((a, i) => (
            <li key={i} class={a.principal ? 'principal' : ''}>{`θ = ${num(rad2deg(a.theta), 2)}°${a.principal ? '  (ראשית)' : ''}`}</li>
          ))}
        </ul>
        {list.length === 1 && <div class="cl-note">{`${ltr(`|v| = 1`)}: זווית אחת בלבד על המעגל.`}</div>}
        {s.af === 'arcsin' && s.v < 0 && <div class="cl-note">הזווית הראשית שלילית: מתחת לציר x.</div>}
        {s.af === 'arccos' && s.v < 0 && <div class="cl-note">{`הזווית הראשית בין ${ltr('90°')} ל-${ltr('180°')}.`}</div>}
      </div>
    );
  }
  const ch = coshOf(s.t);
  const sh = sinhOf(s.t);
  const h = halvesOf(s.t);
  return (
    <div class="cl-readout">
      <Row lab="הפרמטר" math={`t = ${num(s.t, 2)}`} />
      <Row lab="הנקודה בהיפרבולה" math={`(cosh t, sinh t) = (${num(ch, 4)}, ${num(sh, 4)})`} strong />
      <Row lab="הזהות" math={`cosh² t − sinh² t = ${num(ch * ch, 3)} − ${num(sh * sh, 3)} = ${num(hyperIdentity(s.t), 4)}`} />
      {s.halves && <Row lab="החצאים" math={`eᵗ/2 = ${num(h.pos, 4)},  e⁻ᵗ/2 = ${num(h.neg, 4)}`} />}
      {s.halves && <Row lab="סכום והפרש" math={`cosh t = ${num(h.pos + h.neg, 4)},  sinh t = ${num(h.pos - h.neg, 4)}`} />}
      {s.t < 0 && <div class="cl-note">{`${ltr('t < 0')}: ${ltr('sinh t')} שלילי, ${ltr('cosh t')} אותו ערך כמו ב-${ltr('−t')}.`}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ the component */

export default function CircleLab(props: CircleLabProps) {
  const startMode: CircleMode = props.mode ?? 'trig';
  const modes: CircleMode[] = props.modes ?? [startMode];
  const showControls = props.controls !== false;
  const [s, setS] = useState<State>(() => initial(props));
  const cur = useRef(s);
  cur.current = s;
  const [live, setLive] = useState('');
  // on a phone (≤ 640 px, the site's breakpoint) the two panes are stacked: the server renders the wide stage
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const narrowRef = useRef(narrow);
  narrowRef.current = narrow;
  const touched = useRef<Set<keyof State>>(new Set());
  const armed = useRef<Record<string, boolean> | null>(null);
  const drag = useRef(false);
  const taskIds = props.tasks ?? [];
  const tasks: TaskDef[] = taskIds.map((id) => ({ id, label: TASK_LABEL[id] ?? id }));

  const rebase = (next: State) => {
    touched.current = new Set();
    const a: Record<string, boolean> = {};
    for (const t of taskIds) a[t] = !cond(t, next, touched.current);
    armed.current = a;
  };
  if (armed.current === null) rebase(s);

  const apply = (patch: Partial<State>): State => {
    const next = { ...cur.current, ...patch };
    cur.current = next;
    setS(next);
    return next;
  };

  /** the reader's own change: the only place a task can tick */
  const userSet = (patch: Partial<State>) => {
    for (const k of Object.keys(patch) as (keyof State)[]) if (patch[k] !== cur.current[k]) touched.current.add(k);
    const next = apply(patch);
    const a = armed.current ?? {};
    for (const t of taskIds) {
      if (cond(t, next, touched.current)) {
        if (a[t]) {
          a[t] = false;
          markTask(`${props.id}:${t}`);
        }
      } else a[t] = true;
    }
    armed.current = a;
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        const prev = cur.current;
        const patch: Partial<State> = {};
        const nm = (k: string) => (typeof st[k] === 'number' ? (st[k] as number) : undefined);
        const bl = (k: string) => (typeof st[k] === 'boolean' ? (st[k] as boolean) : undefined);
        const mode: CircleMode = typeof st.mode === 'string' && (modes as string[]).includes(st.mode) ? (st.mode as CircleMode) : prev.mode;
        patch.mode = mode;
        if (mode === 'trig') {
          if (nm('thetaDeg') !== undefined) patch.th = clamp(nm('thetaDeg')!, TH_MIN, TH_MAX);
          if (isTrig(st.fn)) patch.tf = st.fn;
          if (bl('trace') !== undefined) patch.trace = bl('trace');
        } else if (mode === 'wave') {
          if (nm('A') !== undefined) patch.A = clamp(nm('A')!, -3, 3);
          if (nm('omega') !== undefined) patch.om = clamp(nm('omega')!, 0.25, 4);
          if (nm('phiDeg') !== undefined) patch.ph = clamp(nm('phiDeg')!, -180, 180);
        } else if (mode === 'arc') {
          const af = isInv(st.fn) ? st.fn : prev.af;
          patch.af = af;
          const v = nm('v') ?? (isInv(st.fn) && st.fn !== prev.af && Math.abs(prev.v) > vLimit(af) ? 0.5 : prev.v);
          patch.v = clamp(v, -vLimit(af), vLimit(af));
        } else {
          if (nm('t') !== undefined) patch.t = clamp(nm('t')!, -3, 3);
          if (bl('halves') !== undefined) patch.halves = bl('halves');
        }
        // a state a text step produced never ticks a task: forget the reader's moves and re-base
        rebase(apply(patch));
      }),
    [props.id],
  );

  const reset = () => {
    const f = initial(props);
    cur.current = f;
    setS(f);
    rebase(f);
    setLive('האיור אופס.');
  };

  /* ---------- the canvas ---------- */
  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    if (s.mode === 'trig') drawTrig(ctx, view.w, view.h, p, s, narrow);
    else if (s.mode === 'wave') drawWave(ctx, view.w, view.h, p, s);
    else if (s.mode === 'arc') drawArc(ctx, view.w, view.h, p, s);
    else drawHyper(ctx, view.w, view.h, p, s, narrow);
  };
  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 2, worldHeight: 1, animate: false });
  useEffect(invalidate, [s]);

  /* ---------- pointer and keyboard ---------- */
  const setTheta = (deg: number) => userSet({ th: clamp(Math.round(deg), TH_MIN, TH_MAX) });
  const setV = (v: number, f: InvFn = cur.current.af) => {
    const lim = vLimit(f);
    const step = f === 'arctan' ? 0.05 : 0.01;
    userSet({ v: clamp(Math.round(v / step) * step, -lim, lim) });
  };
  const setT = (t: number) => userSet({ t: clamp(Math.round(t * 20) / 20, -3, 3) });

  const moveTo = (e: PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const X = e.clientX - rect.left;
    const Y = e.clientY - rect.top;
    const c = cur.current;
    const L = layout(c.mode, rect.width, rect.height, narrowRef.current);
    if (c.mode === 'trig') {
      const onGraph = L.right && X >= L.right.x && Y >= L.right.y;
      if (onGraph && L.right) {
        const pn = pane(L.left, R_WORLD, R_WORLD);
        const gb = graphBox(L.right, pn, R_WORLD, narrowRef.current);
        setTheta(TH_MIN + ((X - gb.x) / gb.w) * (TH_MAX - TH_MIN));
      } else {
        const pn = pane(L.left, R_WORLD, R_WORLD);
        const a = (Math.atan2(WY(pn, Y), WX(pn, X)) * 180) / Math.PI;
        let t = Math.round(a);
        t += 360 * Math.round((c.th - t) / 360);
        setTheta(t);
      }
    } else if (c.mode === 'arc') {
      const pn = pane(L.left, R_WORLD, R_WORLD);
      const wx = WX(pn, X);
      const wy = WY(pn, Y);
      if (c.af === 'arcsin') setV(wy);
      else if (c.af === 'arccos') setV(wx);
      else if (wx > 0.05) setV(wy / wx);
    } else if (c.mode === 'hyper') {
      const pn = pane(L.left, 3.25, HY_Y, 1.75, 0);
      const onGraph = L.right && X >= L.right.x && Y >= L.right.y;
      if (onGraph && L.right) {
        const gb = graphBox(L.right, pn, HY_Y, narrowRef.current);
        setT(-HY_T + ((X - gb.x) / gb.w) * 2 * HY_T);
      } else setT(Math.asinh(WY(pn, Y)));
    }
  };
  const onPointerDown = (e: PointerEvent) => {
    if (cur.current.mode === 'wave') return;
    drag.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
    moveTo(e);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (drag.current) moveTo(e);
  };
  const onPointerUp = () => {
    drag.current = false;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const c = cur.current;
    const dx = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    const dy = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0;
    if (!dx && !dy) return;
    e.preventDefault();
    const big = e.shiftKey;
    if (c.mode === 'trig') setTheta(c.th + (dx || dy) * (big ? 15 : 1));
    else if (c.mode === 'wave') {
      if (dx) userSet({ ph: clamp(c.ph + dx * 15, -180, 180) });
      else userSet({ A: clamp(Math.round((c.A + dy * 0.25) * 4) / 4, -3, 3) });
    } else if (c.mode === 'arc') setV(c.v + (dx || dy) * (c.af === 'arctan' ? 0.05 : 0.01) * (big ? 10 : 1));
    else setT(c.t + (dx || dy) * (big ? 0.5 : 0.05));
  };

  /* ---------- controls ---------- */
  let controls: ComponentChildren = null;
  if (showControls) {
    const modeButtons =
      modes.length > 1 ? (
        <div class="group" role="group" aria-label="מה מציג האיור">
          {modes.map((m) => (
            <Toggle key={m} label={MODE_LABEL[m]} on={s.mode === m} onChange={() => userSet({ mode: m })} />
          ))}
        </div>
      ) : null;
    let body: ComponentChildren;
    if (s.mode === 'trig') {
      body = (
        <>
          <Slider label="θ" value={s.th} min={TH_MIN} max={TH_MAX} step={1} format={(v) => `${Math.round(v)}°`} onChange={(v) => setTheta(v)} />
          <div class="cl-toggles">
            {(['sin', 'cos', 'tan'] as TrigFn[]).map((f) => (
              <Toggle key={f} label={<bdi dir="ltr">{f}</bdi>} on={s.tf === f} onChange={() => userSet({ tf: f })} />
            ))}
            <Toggle label="הציגו את המסלול עד θ" on={s.trace} onChange={(v) => userSet({ trace: v })} />
          </div>
        </>
      );
    } else if (s.mode === 'wave') {
      body = (
        <>
          <Slider label="A" value={s.A} min={-3} max={3} step={0.25} format={(v) => num(v, 2)} onChange={(v) => userSet({ A: v })} />
          <Slider label="ω" value={s.om} min={0.25} max={4} step={0.25} format={(v) => num(v, 2)} onChange={(v) => userSet({ om: v })} />
          <Slider label="φ" value={s.ph} min={-180} max={180} step={15} format={(v) => `${Math.round(v)}°`} onChange={(v) => userSet({ ph: v })} />
        </>
      );
    } else if (s.mode === 'arc') {
      const lim = vLimit(s.af);
      body = (
        <>
          <div class="cl-toggles">
            {(['arcsin', 'arccos', 'arctan'] as InvFn[]).map((f) => (
              <Toggle
                key={f}
                label={<bdi dir="ltr">{f}</bdi>}
                on={s.af === f}
                onChange={() => userSet({ af: f, v: clamp(cur.current.v, -vLimit(f), vLimit(f)) })}
              />
            ))}
          </div>
          <Slider label="v" value={s.v} min={-lim} max={lim} step={s.af === 'arctan' ? 0.05 : 0.01} format={(v) => num(v, 2)} onChange={(v) => setV(v)} />
        </>
      );
    } else {
      body = (
        <>
          <Slider label="t" value={s.t} min={-3} max={3} step={0.05} format={(v) => num(v, 2)} onChange={(v) => setT(v)} />
          <div class="cl-toggles">
            <Toggle label={`החצאים: ${ltr('eᵗ/2,  e⁻ᵗ/2')}`} on={s.halves} onChange={(v) => userSet({ halves: v })} />
          </div>
        </>
      );
    }
    controls = (
      <>
        {modeButtons}
        {body}
      </>
    );
  }

  const aspect =
    s.mode === 'wave' ? (narrow ? 1.1 : 1.8) : s.mode === 'arc' ? (narrow ? 1.0 : 1.4) : narrow ? 0.72 : 2;

  return (
    <SimShell
      fig={props.id}
      label={MODE_ARIA[s.mode]}
      canvasRef={canvasRef}
      aspect={aspect}
      live={live}
      tasks={tasks}
      onReset={reset}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      cursor={s.mode === 'wave' ? 'default' : 'crosshair'}
      readout={readoutFor(s)}
      controls={controls}
    />
  );
}
