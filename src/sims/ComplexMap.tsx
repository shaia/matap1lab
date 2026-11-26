/**
 * ComplexMap (lesson 3.4, the complex exponential and logarithm): three views. Maths from src/math/cexp.ts (e^z = e^x
 * cis y, the period 2πi, the values log w = ln|w| + i(Arg w + 2πk), Euler's formulas). Colour code (never alone): the
 * point the reader moves and the principal value = filled accent dot; copies, other values and e^(−iθ) = hollow rings;
 * images of lines and the angle arc = cool (--delta); cos θ = green (--limit); i sin θ and the negative real axis =
 * warm (--eps). Canvases are math space: Re to the right, Im up, whatever the page direction.
 *
 * mode 'euler': one plane with the unit circle, the arrow e^(iθ) (filled) and its mirror e^(−iθ) (hollow); θ by the
 * slider, by dragging in the plane, or by the arrow keys (shift: 15°). With `cosSin` the half-sum (e^(iθ) + e^(−iθ))/2
 * is drawn on the real axis (it is cos θ) and the half-difference (e^(iθ) − e^(−iθ))/2 on the imaginary axis (it is
 * i sin θ; dividing by i gives sin θ).
 * mode 'exp': two planes. The reader moves z in the z-plane (left); w = e^z = e^x cis y is the point in the w-plane
 * (right). With `copies`, the points z + 2πik, k = −2…2 (hollow) are drawn too: all land on the same w. With `line`
 * 'horizontal' / 'vertical' the line through z (Im z = y / Re z = x) is drawn with its image: the open ray from 0 at the
 * angle y (0 itself is not reached) / the circle of radius e^x. THE Im SCALE OF THE z-PLANE IS COMPRESSED (the copies
 * reach ±6π) while the w-plane has equal scales: the caption must say so. z snaps to 0.1 in Re and 15° (π/12) in Im.
 * mode 'log': two planes. The reader moves w ≠ 0 in the w-plane (right; it snaps to 0.05, |w| from 0.1 to 4.5); the
 * z-plane (left) shows all the values ln|w| + i(Arg w + 2πk), k = −2…2, on the vertical line Re z = ln|w|: the principal
 * value Log w (k = 0, Im in (−π, π]) filled, the others hollow. The negative real axis (Arg = π, the cut) is dashed.
 *
 * Props (defaults): id (required); mode ('euler'); controls (true: false hides sliders and toggles, so only dragging,
 * keys or a step move the figure); tasks ([]).
 *   euler: thetaDeg (60), cosSin (false)
 *   exp:   z ([0.5, π/3], as [x, y]), copies (false), line ('none' | 'horizontal' | 'vertical', default 'none')
 *   log:   w ([1, 1], as [x, y], not 0)
 * Step `set` keys (a text step sets state through the step bus and never ticks a task):
 *   euler: thetaDeg, cosSin
 *   exp:   z (a pair [x, y]) or x and y, copies, line
 *   log:   w (a pair [x, y]) or wx and wy
 * Tasks (ticked only by the reader's own change of the figure, and a state that already had the property when the
 * step, the reset or the first render made it must be left and found again):
 *   euler-pi        θ = 180° (±1°, mod 360): e^(iπ) = −1
 *   euler-cos       cosSin on and θ dragged (or slid) since the last step or reset
 *   exp-copies      copies on
 *   exp-vertical    line 'vertical' and Re z changed since the last step or reset: the image circle changes radius
 *   exp-negative    e^z on the negative real axis: Im z = π (mod 2π, ±0.04)
 *   log-negative    w on the negative real axis (|Im w| ≤ 0.04, Re w < 0): Arg w = π
 *   log-unit        |w| = 1 (±0.03): the values are purely imaginary
 * No animation: the figure only redraws when the reader or a step moves it, so there is nothing for motionAllowed().
 */

import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { argPrincipal, cexp, clog, clogBranches, expCircleRadius, expRay, periodCopies } from '~/math/cexp';
import { cabs, cis, conj, type Complex } from '~/math/complex';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { withAlpha } from './core/ink';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import './ComplexMap.css';

export type MapMode = 'euler' | 'exp' | 'log';
export type MapLine = 'none' | 'horizontal' | 'vertical';

export interface ComplexMapProps {
  id: string;
  mode?: MapMode;
  controls?: boolean;
  tasks?: string[];
  thetaDeg?: number;
  cosSin?: boolean;
  z?: [number, number];
  copies?: boolean;
  line?: MapLine;
  w?: [number, number];
}

const DEG = Math.PI / 180;
const TAU = 2 * Math.PI;
const STEP_Y = Math.PI / 12;
const PAD = 26;
const Z_RE = 3;
const Z_IM = 19.5;
const W_R = 5;
const E_R = 1.5;
const X_MIN = -2;
const X_MAX = 1.5;
const Y_LIM = TAU;
const W_MIN = 0.1;
const W_MAX = 4.5;

interface State {
  th: number; // degrees
  cs: boolean;
  zx: number;
  zy: number;
  copies: boolean;
  line: MapLine;
  wx: number;
  wy: number;
}

function initial(p: ComplexMapProps): State {
  return {
    th: p.thetaDeg ?? 60,
    cs: p.cosSin ?? false,
    zx: p.z?.[0] ?? 0.5,
    zy: p.z?.[1] ?? Math.PI / 3,
    copies: p.copies ?? false,
    line: p.line ?? 'none',
    wx: p.w?.[0] ?? 1,
    wy: p.w?.[1] ?? 1,
  };
}

/* ---------- text ---------- */

/** a left-to-right island inside Hebrew text (U+2066 … U+2069), with no-break spaces so it never wraps */
const ltr = (s: string) => `⁦${s.replace(/ /g, ' ')}⁩`;
const MINUS = '−';

function num(x: number, d = 3): string {
  let t = (Math.abs(x) < 0.5 * 10 ** -d ? 0 : x).toFixed(d);
  if (t.includes('.')) t = t.replace(/0+$/, '').replace(/\.$/, '');
  if (t === '-0') t = '0';
  return t.startsWith('-') ? MINUS + t.slice(1) : t;
}
const cstr = (z: Complex): string => {
  const im = Math.abs(z.im) < 5e-4 ? 0 : z.im;
  return `${num(z.re)} ${im < 0 ? MINUS : '+'} ${num(Math.abs(im))}i`;
};
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
/** an angle as a multiple of π when it is a multiple of π/12 (π/3, −3π/4, …), else a decimal */
function piStr(y: number): string {
  const k = Math.round((y / Math.PI) * 12);
  if (Math.abs(y - (k * Math.PI) / 12) > 1e-9) return num(y);
  if (k === 0) return '0';
  const g = gcd(k, 12);
  const n = Math.abs(k / g);
  const d = 12 / g;
  return `${k < 0 ? MINUS : ''}${n === 1 ? '' : n}π${d === 1 ? '' : '/' + d}`;
}

const TASK_LABEL: Record<string, string> = {
  'euler-pi': `סובבו את ${ltr('θ')} עד ${ltr('θ = 180°')}. איזה מספר הוא ${ltr('e^(iπ)')}?`,
  'euler-cos': `הדליקו את חצי הסכום וחצי ההפרש וסובבו את ${ltr('θ')}: מה קורה לנקודות על הצירים?`,
  'exp-copies': `הדליקו את ההעתקים ${ltr('z + 2πik')}: איפה כולם נוחתים במישור ${ltr('w')}?`,
  'exp-vertical': `בחרו ישר אנכי וגררו את ${ltr('z')} ימינה ושמאלה: מה קורה לרדיוס המעגל?`,
  'exp-negative': `מצאו ${ltr('z')} ש-${ltr('e^z')} שלו על הציר הממשי השלילי. מהו ${ltr('Im z')}?`,
  'log-negative': `הציבו את ${ltr('w')} על הציר הממשי השלילי. מהו ${ltr('Arg w')}?`,
  'log-unit': `הציבו את ${ltr('w')} על מעגל היחידה. מהו החלק הממשי של כל ערכי ${ltr('log w')}?`,
};

/* ---------- tasks ---------- */

const mod = (a: number, m: number) => ((a % m) + m) % m;

function cond(task: string, s: State, touched: Set<keyof State>): boolean {
  switch (task) {
    case 'euler-pi':
      return Math.abs(mod(s.th, 360) - 180) <= 1;
    case 'euler-cos':
      return s.cs && touched.has('th');
    case 'exp-copies':
      return s.copies;
    case 'exp-vertical':
      return s.line === 'vertical' && touched.has('zx');
    case 'exp-negative':
      return Math.abs(mod(s.zy, TAU) - Math.PI) <= 0.04;
    case 'log-negative':
      return s.wx < 0 && Math.abs(s.wy) <= 0.04;
    case 'log-unit':
      return Math.abs(Math.hypot(s.wx, s.wy) - 1) <= 0.03;
    default:
      return false;
  }
}

/* ---------- geometry ---------- */

interface Pane {
  x0: number;
  y0: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  sx: number; // px per unit, Re
  sy: number; // px per unit, Im
}
function pane(x0: number, y0: number, w: number, h: number, reR: number, imR: number, uniform: boolean): Pane {
  let sx = (w - 2 * PAD) / (2 * reR);
  let sy = (h - 2 * PAD) / (2 * imR);
  if (uniform) sx = sy = Math.min(sx, sy);
  return { x0, y0, w, h, cx: x0 + w / 2, cy: y0 + h / 2, sx, sy };
}
/** a stage taller than STACK_AT × its height (a phone) puts the z-plane above the w-plane instead of beside it */
const STACK_AT = 1.2;
/** the stage's width / height: two planes side by side, or stacked on a phone */
const WIDE_ASPECT = 2;
const STACKED_ASPECT = 0.7;
function layout(mode: MapMode, vw: number, vh: number): { z: Pane; w: Pane } {
  if (mode === 'euler') {
    const side = Math.min(vw, vh);
    const pn = pane((vw - side) / 2, 0, side, vh, E_R, E_R, true);
    return { z: pn, w: pn };
  }
  if (vw / vh < STACK_AT) {
    const half = vh / 2;
    return { z: pane(0, 0, vw, half, Z_RE, Z_IM, false), w: pane(0, half, vw, half, W_R, W_R, true) };
  }
  const half = vw / 2;
  return { z: pane(0, 0, half, vh, Z_RE, Z_IM, false), w: pane(half, 0, half, vh, W_R, W_R, true) };
}
const px = (pn: Pane, re: number) => pn.cx + re * pn.sx;
const py = (pn: Pane, im: number) => pn.cy - im * pn.sy;
const snapTo = (v: number, g: number) => Math.round(v / g) * g;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ---------- drawing ---------- */

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color: string, p: Palette, align: CanvasTextAlign = 'center', size = 12) {
  ctx.save();
  ctx.font = `600 ${size}px ${p.fontUi}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
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
/** a filled dot (the principal / own point) or a hollow ring (copies, other values, the mirror point) */
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
function circle(ctx: CanvasRenderingContext2D, pn: Pane, rad: number, color: string, wd = 1.5, dash: number[] = []) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = wd;
  ctx.setLineDash(dash);
  ctx.beginPath();
  // a pane narrower than its padding (before layout) has a negative scale: draw nothing rather than throw
  const rx = rad * pn.sx;
  const ry = rad * pn.sy;
  if (!(rx > 0 && ry > 0)) {
    ctx.restore();
    return;
  }
  ctx.ellipse(pn.cx, pn.cy, rx, ry, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
}
/** an arc of radius rad about 0 from angle 0 to angle a (radians, either sign) */
function arc(ctx: CanvasRenderingContext2D, pn: Pane, rad: number, a: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 48; i++) {
    const t = (a * i) / 48;
    const x = px(pn, rad * Math.cos(t));
    const y = py(pn, rad * Math.sin(t));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

interface AxesOpt {
  reR: number;
  imR: number;
  reTicks: number[];
  imTicks: { v: number; t?: string }[];
  title: string;
}
function drawAxes(ctx: CanvasRenderingContext2D, pn: Pane, p: Palette, o: AxesOpt) {
  ctx.save();
  ctx.fillStyle = withAlpha(p.paper2, 0.5);
  ctx.fillRect(pn.x0 + 2, pn.y0 + 2, pn.w - 4, pn.h - 4);
  ctx.strokeStyle = p.rule;
  ctx.lineWidth = 1;
  ctx.strokeRect(pn.x0 + 2, pn.y0 + 2, pn.w - 4, pn.h - 4);
  ctx.restore();
  seg(ctx, px(pn, -o.reR), pn.cy, px(pn, o.reR), pn.cy, p.ink2, 1.2);
  seg(ctx, pn.cx, py(pn, -o.imR), pn.cx, py(pn, o.imR), p.ink2, 1.2);
  for (const v of o.reTicks) {
    seg(ctx, px(pn, v), pn.cy - 3, px(pn, v), pn.cy + 3, p.ink2, 1);
    text(ctx, num(v, 0), px(pn, v), pn.cy + 13, p.ink3, p, 'center', 10);
  }
  for (const t of o.imTicks) {
    seg(ctx, pn.cx - 3, py(pn, t.v), pn.cx + 3, py(pn, t.v), p.ink2, 1);
    if (t.t) text(ctx, t.t, pn.cx + 6, py(pn, t.v), p.ink3, p, 'left', 10);
  }
  text(ctx, 'Re', px(pn, o.reR) - 4, pn.cy - 9, p.ink2, p, 'right', 11);
  text(ctx, 'Im', pn.cx + 8, py(pn, o.imR) + 8, p.ink2, p, 'left', 11);
  text(ctx, o.title, pn.x0 + 10, pn.y0 + 14, p.ink, p, 'left', 12);
}

const Z_AXES = (title: string): AxesOpt => ({
  reR: Z_RE,
  imR: Z_IM,
  reTicks: [-2, -1, 1, 2],
  imTicks: [-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6].map((k) => ({
    v: k * Math.PI,
    t: k % 2 === 0 ? `${k < 0 ? MINUS : ''}${Math.abs(k)}π` : undefined,
  })),
  title,
});
const W_AXES = (title: string): AxesOpt => ({
  reR: W_R,
  imR: W_R,
  reTicks: [-4, -2, 2, 4],
  imTicks: [-4, -2, 2, 4].map((v) => ({ v, t: num(v, 0) })),
  title,
});

function clipTo(ctx: CanvasRenderingContext2D, pn: Pane) {
  ctx.beginPath();
  ctx.rect(pn.x0 + 3, pn.y0 + 3, pn.w - 6, pn.h - 6);
  ctx.clip();
}

function drawEuler(ctx: CanvasRenderingContext2D, pn: Pane, p: Palette, s: State) {
  drawAxes(ctx, pn, p, {
    reR: E_R,
    imR: E_R,
    reTicks: [-1, 1],
    imTicks: [
      { v: -1, t: `${MINUS}1` },
      { v: 1, t: '1' },
    ],
    title: 'מישור גאוס',
  });
  ctx.save();
  clipTo(ctx, pn);
  circle(ctx, pn, 1, p.ink3, 1.5, [5, 4]);
  const t = s.th * DEG;
  const e = cis(t);
  const f = conj(e);
  const X = (z: Complex): [number, number] => [px(pn, z.re), py(pn, z.im)];
  arc(ctx, pn, 0.28, t, p.delta);
  seg(ctx, pn.cx, pn.cy, ...X(e), p.accent, 2.4);
  seg(ctx, pn.cx, pn.cy, ...X(f), p.delta, 1.6, [4, 3]);
  if (s.cs) {
    const c = e.re;
    const sn = e.im;
    seg(ctx, ...X(e), ...X(f), p.ink3, 1.2, [3, 3]);
    seg(ctx, ...X(e), px(pn, 0), py(pn, sn), p.ink3, 1.2, [3, 3]);
    seg(ctx, pn.cx, pn.cy, px(pn, c), pn.cy, p.limit, 4);
    seg(ctx, pn.cx, pn.cy, pn.cx, py(pn, sn), p.eps, 4);
    dot(ctx, px(pn, c), pn.cy, true, p.limit, p, 5);
    dot(ctx, pn.cx, py(pn, sn), true, p.eps, p, 5);
    text(ctx, 'cos θ', px(pn, c), pn.cy + (sn >= 0 ? 24 : -24), p.limit, p, 'center', 12);
    text(ctx, 'i sin θ', pn.cx + (c >= 0 ? -8 : 8), py(pn, sn) + (sn >= 0 ? -12 : 12), p.eps, p, c >= 0 ? 'right' : 'left', 12);
  }
  dot(ctx, ...X(f), false, p.delta, p, 6);
  dot(ctx, ...X(e), true, p.accent, p, 7);
  const name = (z: Complex, s2: string, color: string) =>
    text(ctx, s2, px(pn, z.re * 1.2) + (z.re >= 0 ? 6 : -6), py(pn, z.im * 1.2) - (z.im >= 0 ? 8 : -8), color, p, z.re >= 0 ? 'left' : 'right');
  name(e, 'e^(iθ)', p.accent);
  name(f, 'e^(−iθ)', p.delta);
  ctx.restore();
}

function drawExp(ctx: CanvasRenderingContext2D, zp: Pane, wp: Pane, p: Palette, s: State) {
  drawAxes(ctx, zp, p, Z_AXES('מישור z'));
  drawAxes(ctx, wp, p, W_AXES('מישור w = e^z'));
  const z: Complex = { re: s.zx, im: s.zy };
  const w = cexp(z);
  ctx.save();
  clipTo(ctx, zp);
  if (s.line === 'horizontal') seg(ctx, px(zp, -Z_RE), py(zp, z.im), px(zp, Z_RE), py(zp, z.im), p.delta, 2);
  if (s.line === 'vertical') seg(ctx, px(zp, z.re), py(zp, -Z_IM), px(zp, z.re), py(zp, Z_IM), p.delta, 2);
  if (s.copies) {
    for (const c of periodCopies(z, -2, 2)) if (c.im !== z.im) dot(ctx, px(zp, c.re), py(zp, c.im), false, p.accent, p, 5);
  }
  dot(ctx, px(zp, z.re), py(zp, z.im), true, p.accent, p, 7);
  text(ctx, 'z', px(zp, z.re) + 11, py(zp, z.im) - 9, p.accent, p, 'left', 13);
  ctx.restore();
  ctx.save();
  clipTo(ctx, wp);
  circle(ctx, wp, 1, p.ink3, 1.2, [5, 4]);
  if (s.line === 'horizontal') {
    const r = expRay(z.im);
    const far = 2 * W_R;
    seg(ctx, wp.cx, wp.cy, px(wp, far * r.ux), py(wp, far * r.uy), p.delta, 2);
    dot(ctx, wp.cx, wp.cy, false, p.delta, p, 3.5);
  }
  if (s.line === 'vertical') circle(ctx, wp, expCircleRadius(z.re), p.delta, 2);
  seg(ctx, wp.cx, wp.cy, px(wp, w.re), py(wp, w.im), p.accent, 1.6, [4, 3]);
  if (s.copies) {
    ctx.save();
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px(wp, w.re), py(wp, w.im), 12, 0, TAU);
    ctx.stroke();
    ctx.restore();
    text(ctx, '5 נקודות, w אחד', px(wp, w.re), py(wp, w.im) + (w.im >= 0 ? -24 : 24), p.ink2, p, 'center', 11);
  }
  dot(ctx, px(wp, w.re), py(wp, w.im), true, p.accent, p, 7);
  text(ctx, 'w', px(wp, w.re) + 11, py(wp, w.im) - 9, p.accent, p, 'left', 13);
  ctx.restore();
}

function drawLog(ctx: CanvasRenderingContext2D, zp: Pane, wp: Pane, p: Palette, s: State) {
  drawAxes(ctx, zp, p, Z_AXES('מישור z: ערכי log w'));
  drawAxes(ctx, wp, p, W_AXES('מישור w'));
  const w: Complex = { re: s.wx, im: s.wy };
  const vals = clogBranches(w, -2, 2);
  const lnr = vals[0].re;
  ctx.save();
  clipTo(ctx, zp);
  seg(ctx, px(zp, lnr), py(zp, -Z_IM), px(zp, lnr), py(zp, Z_IM), p.delta, 1.4, [5, 4]);
  vals.forEach((v, i) => {
    if (i !== 2) dot(ctx, px(zp, v.re), py(zp, v.im), false, p.accent, p, 5);
  });
  const L = vals[2];
  dot(ctx, px(zp, L.re), py(zp, L.im), true, p.accent, p, 7);
  text(ctx, 'Log w', px(zp, L.re) + (L.re < 1 ? 11 : -11), py(zp, L.im) - 10, p.accent, p, L.re < 1 ? 'left' : 'right', 12);
  ctx.restore();
  ctx.save();
  clipTo(ctx, wp);
  circle(ctx, wp, 1, p.ink3, 1.2, [5, 4]);
  seg(ctx, wp.cx, wp.cy, px(wp, -W_R), wp.cy, p.eps, 3, [6, 4]);
  text(ctx, 'Arg = π', px(wp, -W_R) + 6, wp.cy + 14, p.eps, p, 'left', 10);
  arc(ctx, wp, 0.55, argPrincipal(w), p.delta);
  seg(ctx, wp.cx, wp.cy, px(wp, w.re), py(wp, w.im), p.accent, 1.6, [4, 3]);
  dot(ctx, px(wp, w.re), py(wp, w.im), true, p.accent, p, 7);
  text(ctx, 'w', px(wp, w.re) + 11, py(wp, w.im) - 9, p.accent, p, 'left', 13);
  ctx.restore();
}

/* ---------- readout ---------- */

function Row(p: { lab: string; math: string; strong?: boolean }) {
  return (
    <div class={`cm-row${p.strong ? ' strong' : ''}`}>
      <span class="cm-lab">{p.lab}</span>
      <span class="cm-math" dir="ltr">
        {p.math}
      </span>
    </div>
  );
}

function readoutFor(mode: MapMode, s: State): ComponentChildren {
  if (mode === 'euler') {
    const t = s.th * DEG;
    const e = cis(t);
    const f = conj(e);
    const near180 = Math.abs(mod(s.th, 360) - 180) <= 1;
    return (
      <div class="cm-readout">
        <Row lab="הזווית" math={`θ = ${num(s.th, 0)}° = ${piStr(t)}`} />
        <Row lab="הנקודה על המעגל" math={`e^(iθ) = cos θ + i sin θ = ${cstr(e)}`} strong />
        <Row lab="התמונה במראה" math={`e^(−iθ) = cos θ − i sin θ = ${cstr(f)}`} />
        {s.cs && <Row lab="חצי הסכום" math={`(e^(iθ) + e^(−iθ))/2 = ${num(e.re)} = cos θ`} />}
        {s.cs && <Row lab="חצי ההפרש חלקי i" math={`(e^(iθ) − e^(−iθ))/(2i) = ${num(e.im)} = sin θ`} />}
        {near180 && <div class="cm-note">{`זהו המספר ${ltr('e^(iπ) = −1')}.`}</div>}
      </div>
    );
  }
  if (mode === 'exp') {
    const z: Complex = { re: s.zx, im: s.zy };
    const w = cexp(z);
    const onNeg = Math.abs(mod(s.zy, TAU) - Math.PI) <= 0.04;
    return (
      <div class="cm-readout">
        <Row lab="הנקודה" math={`z = ${num(z.re, 1)} + ${piStr(z.im)}·i`} />
        <Row lab="החזקה" math={`e^z = e^x (cos y + i sin y),  x = ${num(z.re, 1)},  y = ${piStr(z.im)}`} strong />
        <Row lab="הגודל והזווית" math={`|w| = e^x = ${num(cabs(w))},  Arg w = ${num(argPrincipal(w))}`} />
        <Row lab="המספר" math={`w = ${cstr(w)}`} />
        {s.copies && <div class="cm-note">{`כל ההעתקים ${ltr('z + 2πik')} נותנים אותו ${ltr('w')}: מחזוריות ${ltr('2πi')}.`}</div>}
        {s.line === 'horizontal' && <div class="cm-note">{`הישר ${ltr(`Im z = ${piStr(z.im)}`)} עובר לקרן מ-0 בזווית ${ltr(piStr(z.im))}.`}</div>}
        {s.line === 'vertical' && (
          <div class="cm-note">{`הישר ${ltr(`Re z = ${num(z.re, 1)}`)} עובר למעגל ברדיוס ${ltr(`e^${num(z.re, 1)} = ${num(Math.exp(z.re))}`)}.`}</div>
        )}
        {onNeg && <div class="cm-note">{`${ltr('e^z')} שלילי וממשי: ${ltr('Im z = π')} (עד כפולה של ${ltr('2π')}).`}</div>}
      </div>
    );
  }
  const w: Complex = { re: s.wx, im: s.wy };
  const vals = clogBranches(w, -2, 2);
  const unit = Math.abs(cabs(w) - 1) <= 0.03;
  const neg = s.wx < 0 && Math.abs(s.wy) <= 0.04;
  return (
    <div class="cm-readout">
      <Row lab="הנקודה" math={`w = ${cstr(w)},  |w| = ${num(cabs(w))},  Arg w = ${num(argPrincipal(w))}`} />
      <Row lab="הערך הראשי" math={`Log w = ln|w| + i Arg w = ${cstr(clog(w))}`} strong />
      <div class="cm-lab">כל הערכים: ln|w| + i(Arg w + 2πk)</div>
      <ul class="cm-list">
        {vals.map((v, i) => (
          <li key={i} class={i === 2 ? 'principal' : ''}>{`k = ${i < 2 ? MINUS : ''}${Math.abs(i - 2)}:  ${cstr(v)}`}</li>
        ))}
      </ul>
      {unit && <div class="cm-note">{`${ltr('|w| = 1')}: ${ltr('ln|w| = 0')}, ערכי ${ltr('log w')} מדומים טהורים.`}</div>}
      {neg && <div class="cm-note">{`על הציר הממשי השלילי ${ltr('Arg w = π')}: ${ltr('Log w = ln|w| + iπ')}.`}</div>}
    </div>
  );
}

const MODE_LABEL: Record<MapMode, string> = {
  euler: 'מישור גאוס עם מעגל היחידה והנקודות e^(iθ) ו-e^(−iθ)',
  exp: 'שני מישורים: z משמאל ו-w = e^z מימין',
  log: 'שני מישורים: w מימין וכל ערכי log w על ישר אנכי במישור z משמאל',
};

/* ------------------------------------------------------------------ the component */

export default function ComplexMap(props: ComplexMapProps) {
  const mode: MapMode = props.mode ?? 'euler';
  const showControls = props.controls !== false;
  const [s, setS] = useState<State>(() => initial(props));
  const cur = useRef(s);
  cur.current = s;
  const [live, setLive] = useState('');
  // on a phone (≤ 640 px, the site's breakpoint) the two planes are stacked: the server renders the wide stage
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const touched = useRef<Set<keyof State>>(new Set());
  const armed = useRef<Record<string, boolean> | null>(null);
  const drag = useRef(false);
  const taskIds = props.tasks ?? [];
  const tasks: TaskDef[] = taskIds.map((id) => ({ id, label: TASK_LABEL[id] ?? id }));

  /** forget the reader's moves; a task whose property already holds must be left and found again */
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
        const patch: Partial<State> = {};
        const nm = (k: string) => (typeof st[k] === 'number' ? (st[k] as number) : undefined);
        const bl = (k: string) => (typeof st[k] === 'boolean' ? (st[k] as boolean) : undefined);
        const pair = (k: string): [number, number] | undefined => {
          const v = st[k];
          return Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number' ? [v[0], v[1]] : undefined;
        };
        if (mode === 'euler') {
          if (nm('thetaDeg') !== undefined) patch.th = nm('thetaDeg');
          if (bl('cosSin') !== undefined) patch.cs = bl('cosSin');
        } else if (mode === 'exp') {
          const z = pair('z');
          if (z) {
            patch.zx = z[0];
            patch.zy = z[1];
          }
          if (nm('x') !== undefined) patch.zx = nm('x');
          if (nm('y') !== undefined) patch.zy = nm('y');
          if (bl('copies') !== undefined) patch.copies = bl('copies');
          if (st.line === 'none' || st.line === 'horizontal' || st.line === 'vertical') patch.line = st.line;
        } else {
          const w = pair('w');
          if (w && (w[0] !== 0 || w[1] !== 0)) {
            patch.wx = w[0];
            patch.wy = w[1];
          }
          if (nm('wx') !== undefined) patch.wx = nm('wx');
          if (nm('wy') !== undefined) patch.wy = nm('wy');
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
    const L = layout(mode, view.w, view.h);
    if (mode === 'euler') drawEuler(ctx, L.z, p, s);
    else if (mode === 'exp') drawExp(ctx, L.z, L.w, p, s);
    else drawLog(ctx, L.z, L.w, p, s);
  };
  const { canvasRef, invalidate } = useFigureCanvas(draw, {
    worldWidth: mode === 'euler' ? 1.3 : 2,
    worldHeight: 1,
    animate: false,
  });
  useEffect(invalidate, [s]);

  /* ---------- pointer and keyboard ---------- */
  const setTheta = (deg: number) => userSet({ th: clamp(deg, -360, 360) });
  const setZ = (x: number, y: number) => userSet({ zx: clamp(snapTo(x, 0.1), X_MIN, X_MAX), zy: clamp(snapTo(y, STEP_Y), -Y_LIM, Y_LIM) });
  /** w ≠ 0 with W_MIN ≤ |w| ≤ W_MAX; `grid` snaps to 0.05 (dragging and keys), the sliders pass exact values */
  const setW = (x: number, y: number, grid = true) => {
    let a = grid ? snapTo(x, 0.05) : x;
    let b = grid ? snapTo(y, 0.05) : y;
    const r = Math.hypot(a, b);
    if (r < W_MIN) {
      const d = r === 0 ? { x: 1, y: 0 } : { x: a / r, y: b / r };
      a = d.x * W_MIN;
      b = d.y * W_MIN;
    } else if (r > W_MAX) {
      a = (a * W_MAX) / r;
      b = (b * W_MAX) / r;
    }
    userSet({ wx: a, wy: b });
  };

  const moveTo = (e: PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const X = e.clientX - rect.left;
    const Y = e.clientY - rect.top;
    const L = layout(mode, rect.width, rect.height);
    if (mode === 'euler') {
      const a = (Math.atan2(-(Y - L.z.cy), X - L.z.cx) * 180) / Math.PI;
      let t = Math.round(a);
      t += 360 * Math.round((cur.current.th - t) / 360);
      setTheta(t);
    } else if (mode === 'exp') {
      setZ((X - L.z.cx) / L.z.sx, -(Y - L.z.cy) / L.z.sy);
    } else {
      setW((X - L.w.cx) / L.w.sx, -(Y - L.w.cy) / L.w.sy);
    }
  };
  /** the draggable plane: z (left) in exp, w (right) in log, the only plane in euler */
  const inActivePlane = (e: PointerEvent): boolean => {
    if (mode === 'euler') return true;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const L = layout(mode, rect.width, rect.height);
    const pn = mode === 'exp' ? L.z : L.w;
    const X = e.clientX - rect.left;
    const Y = e.clientY - rect.top;
    return X >= pn.x0 && X <= pn.x0 + pn.w && Y >= pn.y0 && Y <= pn.y0 + pn.h;
  };
  const onPointerDown = (e: PointerEvent) => {
    if (!inActivePlane(e)) return;
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
    if (mode === 'euler') setTheta(c.th + (dx || dy) * (e.shiftKey ? 15 : 1));
    else if (mode === 'exp') setZ(c.zx + dx * 0.1, c.zy + dy * STEP_Y);
    else setW(c.wx + dx * 0.05, c.wy + dy * 0.05);
  };

  /* ---------- controls ---------- */
  let controls: ComponentChildren = null;
  if (showControls) {
    if (mode === 'euler') {
      controls = (
        <>
          <Slider label="θ" value={s.th} min={-360} max={360} step={1} format={(v) => `${Math.round(v)}°`} onChange={(v) => userSet({ th: v })} />
          <div class="cm-toggles">
            <Toggle label="חצי סכום וחצי הפרש: cos ו-sin" on={s.cs} onChange={(v) => userSet({ cs: v })} />
          </div>
        </>
      );
    } else if (mode === 'exp') {
      controls = (
        <>
          <Slider label="Re z" value={s.zx} min={X_MIN} max={X_MAX} step={0.1} format={(v) => num(v, 1)} onChange={(v) => userSet({ zx: v })} />
          <Slider
            label="Im z"
            value={Math.round(s.zy / STEP_Y)}
            min={-24}
            max={24}
            step={1}
            format={(v) => piStr(v * STEP_Y)}
            onChange={(v) => userSet({ zy: v * STEP_Y })}
          />
          <div class="cm-toggles">
            <Toggle label={`העתקים ${ltr('z + 2πik')}`} on={s.copies} onChange={(v) => userSet({ copies: v })} />
            <Toggle label="בלי ישר" on={s.line === 'none'} onChange={() => userSet({ line: 'none' })} />
            <Toggle label={`ישר אופקי ${ltr('Im z = y')}`} on={s.line === 'horizontal'} onChange={() => userSet({ line: 'horizontal' })} />
            <Toggle label={`ישר אנכי ${ltr('Re z = x')}`} on={s.line === 'vertical'} onChange={() => userSet({ line: 'vertical' })} />
          </div>
        </>
      );
    } else {
      const r = Math.hypot(s.wx, s.wy);
      const a = Math.round((argPrincipal({ re: s.wx, im: s.wy }) * 180) / Math.PI);
      controls = (
        <>
          <Slider
            label="|w|"
            value={r}
            min={W_MIN}
            max={W_MAX}
            step={0.05}
            format={(v) => num(v, 2)}
            onChange={(v) => setW((v * s.wx) / r, (v * s.wy) / r, false)}
          />
          <Slider
            label="Arg w"
            value={a}
            min={-179}
            max={180}
            step={1}
            format={(v) => `${Math.round(v)}°`}
            onChange={(v) => setW(r * Math.cos(v * DEG), r * Math.sin(v * DEG), false)}
          />
        </>
      );
    }
  }

  return (
    <SimShell
      fig={props.id}
      label={MODE_LABEL[mode]}
      canvasRef={canvasRef}
      aspect={mode === 'euler' ? 1.3 : narrow ? STACKED_ASPECT : WIDE_ASPECT}
      live={live}
      tasks={tasks}
      onReset={reset}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      cursor="crosshair"
      readout={readoutFor(mode, s)}
      controls={controls}
    />
  );
}
