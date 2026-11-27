/**
 * GraphLab (chapter 4, functions of one variable): the graph of a function from the registry of src/math/functions.ts
 * in six modes. Canvases are math space and stay LTR (x to the right, y up). A point of the graph that is included is
 * FILLED, an excluded endpoint or a hole is HOLLOW (shape, not only colour). Readouts that come from sampling
 * (intersections, "coincides on the window", the domain of a composition) are probes, and say so.
 *
 * mode 'read':      the graph of `f` and a draggable cursor x with the point (x, f(x)) ("לא מוגדרת" outside the domain).
 *                   Toggles: `domain` (thick segments on the x-axis, ends filled / hollow), `range` (the same on the
 *                   y-axis), `mono` (increasing pieces solid, decreasing dashed; read from the registry's exact data).
 *                   Zeros (dots) and the y-intercept (square) are marked. The cursor snaps to zeros, turning points and
 *                   the ends of the domain within 0.04.
 * mode 'compose':   x → inner(x) → outer(inner(x)): the inner graph and the outer graph in two small panels, the
 *                   composition in the main one, the cursor followed through both. When inner(x) is outside the domain of
 *                   the outer function the chain breaks (hollow mark, "לא מוגדר") and the domain of the composition
 *                   (a probe) is drawn on the x-axis. Inner is `g` and outer is `f`; `swap` exchanges them (g∘f).
 * mode 'transform': y = A·f((x − a)/b) + c with the base f dashed; sliders a, b (b ≠ 0), A, c; the formula in the
 *                   readout; an optional `target` {a, b, A, c} as a faint graph to match.
 * mode 'solve':     the graphs of f and g (g may be `const`, whose value is the slider k, also dragged vertically);
 *                   the intersections on the window marked and counted (a probe).
 * mode 'parity':    the graph of f with a copy: `mirror` 'none' | 'y' (f(−x)) | 'origin' (−f(−x)), and a shifted copy
 *                   f(x + T) for T ≠ 0; each copy says whether it coincides with the graph on the window (a probe).
 *                   For a periodic f the slider T snaps to a multiple of the period within 0.02.
 * mode 'inverse':   f restricted to [lo, hi] (sliders), the line y = x, the reflection of the restricted graph (solid and
 *                   labelled f⁻¹ when the restriction is one-to-one, else dashed "אינה פונקציה"), a draggable horizontal
 *                   line y = k with its hit count (a probe), a draggable point (p, f(p)) and its mirror (f(p), p).
 *
 * Props (defaults): id (required); mode ('read'); modes (the mode buttons shown; default the starting mode only);
 * tasks ([]). f (read 'quad', compose 'sqrt', transform 'x2', solve 'cubic', parity 'x3', inverse 'x2'), g (compose
 * 'quad', solve 'const', else 'lin'), x (1), domain / range / mono (false), swap (false), a (0), b (1), A (1), c (0),
 * target (none), k (inverse 1, else 0), mirror ('none'), T (0), lo / hi (the f window's x range), p (1).
 * Every prop is also a step key (`<Step fig=… set={{…}}>`; `target: null` removes the target); a key left out keeps its
 * value; a new `f` without `lo`/`hi` resets the restriction to the window. A state set by a step never ticks a task, and a
 * state that already had a task's property when a step or reset made it must be left and found again.
 *
 * Tasks (ticked only inside the learner's own drag, key, slider, button or toggle):
 *   read: read-zero (cursor within 0.05 of a zero of f), read-outside (cursor where f is undefined),
 *         read-turn (cursor within 0.05 of a turning point)
 *   compose: compose-break (inner(x) is defined and outer(inner(x)) is not), compose-swap (swap on, both orders defined
 *            and different at x)
 *   transform: shift-right (a > 0), reflect-y (b < 0), stretch-x (|b| = 2 within 0.05), match (a, b, A, c within 0.05 of target)
 *   solve: solve-none, solve-one, solve-three (the count of intersections on the window)
 *   parity: parity-even (mirror y and f even), parity-odd (mirror origin and f odd), period-find (T within 0.02 of the
 *           smallest positive period)
 *   inverse: inverse-fail (k where the restricted graph is hit at least twice), inverse-branch (lo, hi moved to a
 *            one-to-one restriction of length at least half the window), inverse-point (p dragged)
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { niceAngle } from '~/math/coords';
import {
  FN,
  coincidesOnWindow,
  composeDomain,
  composeFn,
  dirAt,
  domainOf,
  fnOf,
  horizontalHits,
  intersections,
  intervalsText,
  isFnId,
  isOneToOne,
  mirrorFn,
  monoOf,
  shiftFn,
  transformFn,
  turningPoints,
  zerosOf,
  type FnId,
  type FnWindow,
  type Interval,
  type Intersections,
  type TransformSpec,
} from '~/math/functions';
import { markTask } from '~/progress/store';
import { subscribeSteps, type StepState } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { sci } from './core/format';
import { withAlpha } from './core/ink';
import { insetBox, makePlot, niceTicks, type Box } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import './GraphLab.css';

export type GraphMode = 'read' | 'compose' | 'transform' | 'solve' | 'parity' | 'inverse';
type Mirror = 'none' | 'y' | 'origin';
type Handle = 'x' | 'k' | 'p';
type Fn = (x: number) => number;

const ltr = (s: string) => String.fromCharCode(0x2066) + s.replace(/ /g, String.fromCharCode(0xa0)) + String.fromCharCode(0x2069);

const TASK_LABEL: Record<string, string> = {
  'read-zero': `גררו את הסמן לנקודה שבה הגרף חותך את ציר ${ltr('x')}. מה ערך ${ltr('f(x)')} שם?`,
  'read-outside': 'גררו את הסמן אל מקום שבו אין גרף. מה מראה הקריאה, ומה ההבדל בין זה לבין ערך 0?',
  'read-turn': 'גררו את הסמן אל נקודה שבה הפונקציה עוברת מעלייה לירידה או להפך.',
  'compose-break': `מצאו ${ltr('x')} שבו השרשרת נשברת: הערך של הפונקציה הפנימית קיים, אבל החיצונית לא מוגדרת בו.`,
  'compose-swap': `הפכו את סדר ההרכבה במקום שבו שתי ההרכבות מוגדרות. האם ${ltr('f(g(x))')} שווה ל-${ltr('g(f(x))')}?`,
  'shift-right': `קבעו ${ltr('a > 0')}. לאן זז הגרף, ומה קרה לנקודה המסומנת?`,
  'reflect-y': `קבעו ${ltr('b < 0')}. איזה שיקוף קיבלתם?`,
  'stretch-x': `קבעו ${ltr('|b| = 2')}. האם הגרף נמתח לרוחב או מתכווץ?`,
  match: `התאימו את ${ltr('a, b, A, c')} כך שהגרף יחפוף את גרף היעד (הקו הדק).`,
  'solve-none': 'מצאו k שעבורו אין אף פתרון בחלון.',
  'solve-one': 'מצאו k שעבורו יש פתרון אחד בדיוק.',
  'solve-three': 'מצאו k שעבורו יש שלושה פתרונות בדיוק.',
  'parity-even': 'בחרו שיקוף בציר y. האם הגרף המשוקף חופף לגרף שלכם?',
  'parity-odd': 'בחרו סיבוב חצי סיבוב סביב הראשית. האם הגרף המסובב חופף לגרף שלכם?',
  'period-find': `הזיזו את ${ltr('T')} עד שהגרף המוזז חופף לגרף. מהו הערך הקטן ביותר שעובד?`,
  'inverse-fail': 'גררו את הישר האופקי עד שהוא פוגע בגרף המצומצם פעמיים או יותר. מה זה אומר על ההפוך?',
  'inverse-branch': 'שנו את גבולות הצמצום כך שהפונקציה תהיה חד-חד-ערכית על תחום ארוך לפחות כחצי מהחלון.',
  'inverse-point': 'גררו את הנקודה על הגרף. איפה הנקודה המשוקפת, ומה היחס בין שני הזוגות?',
};

const MODE_LABEL: Record<GraphMode, string> = {
  read: 'קריאת גרף',
  compose: 'הרכבה',
  transform: 'הזזות ומתיחות',
  solve: 'פתרון משוואה',
  parity: 'זוגיות ומחזוריות',
  inverse: 'פונקציה הפוכה',
};

export interface GraphLabProps {
  id: string;
  mode?: GraphMode;
  /** the mode buttons shown (default: the starting mode only) */
  modes?: GraphMode[];
  f?: FnId;
  g?: FnId;
  x?: number;
  domain?: boolean;
  range?: boolean;
  mono?: boolean;
  swap?: boolean;
  a?: number;
  b?: number;
  A?: number;
  c?: number;
  target?: TransformSpec | null;
  k?: number;
  mirror?: Mirror;
  T?: number;
  lo?: number;
  hi?: number;
  p?: number;
  tasks?: string[];
}

interface Setup {
  mode: GraphMode;
  f: FnId;
  g: FnId;
  x: number;
  domain: boolean;
  range: boolean;
  mono: boolean;
  swap: boolean;
  a: number;
  b: number;
  A: number;
  c: number;
  target: TransformSpec | null;
  k: number;
  mirror: Mirror;
  T: number;
  lo: number;
  hi: number;
  p: number;
}

const TAU = 2 * Math.PI;
const finite = Number.isFinite;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const roundTo = (x: number, step: number) => Number((Math.round(x / step) * step).toPrecision(10));
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const bool = (x: unknown): boolean | null => (typeof x === 'boolean' ? x : null);
const fnId = (x: unknown): FnId | null => (isFnId(x) ? x : null);
const fmt = (x: number, sig = 3) => (Math.abs(x) < 5e-4 ? '0' : sci(x, sig).replace('-', '−'));
const SNAP = 0.04;
const TASK_TOL = 0.05;

function parseTarget(x: unknown): TransformSpec | null {
  if (typeof x !== 'object' || x === null) return null;
  const o = x as Record<string, unknown>;
  const a = num(o.a);
  const b = num(o.b);
  const A = num(o.A);
  const c = num(o.c);
  return a !== null && b !== null && A !== null && c !== null && b !== 0 ? { a, b, A, c } : null;
}

/* ---- the window, the chain and the cached probes */

const union = (a: [number, number], b: [number, number]): [number, number] => [Math.min(a[0], b[0]), Math.max(a[1], b[1])];
const chainOf = (s: Setup) => (s.swap ? { inner: s.f, outer: s.g, iName: 'f', oName: 'g' } : { inner: s.g, outer: s.f, iName: 'g', oName: 'f' });

/** the x range of the sliders and the cursor, per mode */
function xWindow(s: Setup): [number, number] {
  if (s.mode === 'compose') return FN[chainOf(s).inner].window.x;
  if (s.mode === 'solve' && s.g !== 'const') return union(FN[s.f].window.x, FN[s.g].window.x);
  return FN[s.f].window.x;
}

const cache = new Map<string, unknown>();
function cached<T>(key: string, make: () => T): T {
  if (cache.has(key)) return cache.get(key) as T;
  if (cache.size > 300) cache.clear();
  const v = make();
  cache.set(key, v);
  return v;
}

const composeY = (s: Setup): [number, number] => {
  const { inner, outer } = chainOf(s);
  const [x0, x1] = xWindow(s);
  return cached(`cy|${s.f}|${s.g}|${s.swap}|${s.k}`, () => {
    const F = composeFn(fnOf(outer, s.k), fnOf(inner, s.k));
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i <= 300; i++) {
      const v = F(x0 + ((x1 - x0) * i) / 300);
      if (finite(v) && Math.abs(v) < 1e3) {
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    }
    if (lo > hi) return FN[outer].window.y;
    const pad = Math.max(0.5, 0.12 * (hi - lo));
    lo = Math.max(-12, lo - pad);
    hi = Math.min(12, hi + pad);
    return hi - lo < 2 ? [lo - 1, hi + 1] : [lo, hi];
  });
};

/** the window of the main plot */
function windowOf(s: Setup): FnWindow {
  const wf = FN[s.f].window;
  if (s.mode === 'compose') return { x: xWindow(s), y: composeY(s) };
  if (s.mode === 'solve') return { x: xWindow(s), y: union(wf.y, FN[s.g].window.y) };
  if (s.mode === 'inverse') {
    const [m, M] = union(wf.x, wf.y);
    return { x: [m, M], y: [m, M] };
  }
  return wf;
}

function hitsOf(s: Setup): Intersections {
  const [x0, x1] = xWindow(s);
  return cached(`hit|${s.f}|${s.g}|${s.k}|${x0}|${x1}`, () => intersections(fnOf(s.f, s.k), fnOf(s.g, s.k), x0, x1));
}
const restrictedHits = (s: Setup): number => cached(`rh|${s.f}|${s.k}|${s.lo}|${s.hi}`, () => horizontalHits(fnOf(s.f, s.k), s.k, s.lo, s.hi));
const oneToOne = (s: Setup): boolean => isOneToOne(s.f, s.lo, s.hi, s.k);
const composedDomain = (s: Setup): Interval[] => {
  const { inner, outer } = chainOf(s);
  const [x0, x1] = xWindow(s);
  return cached(`cd|${outer}|${inner}|${s.k}|${x0}|${x1}`, () => composeDomain(fnOf(outer, s.k), fnOf(inner, s.k), x0, x1, 800));
};

/** the cursor snaps to a zero, a turning point or a finite end of the domain within SNAP, else to 0.05 */
function snapX(s: Setup, x: number): number {
  const [x0, x1] = xWindow(s);
  const v = clamp(x, x0, x1);
  if (s.mode === 'read') {
    const magnets = [
      ...zerosOf(s.f, x0, x1),
      ...turningPoints(s.f, x0, x1),
      ...domainOf(s.f, x0, x1).flatMap((iv) => [iv.lo, iv.hi]).filter((e) => finite(e) && e >= x0 && e <= x1),
      0,
    ];
    let best = NaN;
    let bd = SNAP;
    for (const m of magnets) {
      const d = Math.abs(m - v);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    if (finite(best)) return best;
  }
  return clamp(roundTo(v, 0.05), x0, x1);
}

/* ---- tasks: a rule is `state` (what must hold) and `needs` (the learner's change must touch one of these keys) */
interface Rule {
  needs: (keyof Setup)[];
  event?: boolean;
  state: (s: Setup) => boolean;
}
const RULES: Record<string, Rule> = {
  'read-zero': { needs: ['x'], state: (s) => s.mode === 'read' && zerosOf(s.f, ...xWindow(s)).some((z) => Math.abs(z - s.x) <= TASK_TOL) },
  'read-outside': { needs: ['x'], state: (s) => s.mode === 'read' && !finite(fnOf(s.f, s.k)(s.x)) },
  'read-turn': { needs: ['x'], state: (s) => s.mode === 'read' && turningPoints(s.f, ...xWindow(s)).some((t) => Math.abs(t - s.x) <= TASK_TOL) },
  'compose-break': {
    needs: ['x', 'swap'],
    state: (s) => {
      if (s.mode !== 'compose') return false;
      const { inner, outer } = chainOf(s);
      const u = fnOf(inner, s.k)(s.x);
      return finite(u) && !finite(fnOf(outer, s.k)(u));
    },
  },
  'compose-swap': {
    needs: ['swap', 'x'],
    state: (s) => {
      if (s.mode !== 'compose' || !s.swap) return false;
      const f = fnOf(s.f, s.k);
      const g = fnOf(s.g, s.k);
      const fg = f(g(s.x));
      const gf = g(f(s.x));
      return finite(fg) && finite(gf) && Math.abs(fg - gf) > 1e-9;
    },
  },
  'shift-right': { needs: ['a'], state: (s) => s.mode === 'transform' && s.a > 0 },
  'reflect-y': { needs: ['b'], state: (s) => s.mode === 'transform' && s.b < 0 },
  'stretch-x': { needs: ['b'], state: (s) => s.mode === 'transform' && Math.abs(Math.abs(s.b) - 2) <= TASK_TOL },
  match: {
    needs: ['a', 'b', 'A', 'c'],
    state: (s) => s.mode === 'transform' && s.target !== null && ['a', 'b', 'A', 'c'].every((key) => Math.abs(s[key as 'a'] - (s.target as TransformSpec)[key as 'a']) <= TASK_TOL),
  },
  'solve-none': { needs: ['k'], state: (s) => s.mode === 'solve' && !hitsOf(s).coincident && hitsOf(s).xs.length === 0 },
  'solve-one': { needs: ['k'], state: (s) => s.mode === 'solve' && !hitsOf(s).coincident && hitsOf(s).xs.length === 1 },
  'solve-three': { needs: ['k'], state: (s) => s.mode === 'solve' && !hitsOf(s).coincident && hitsOf(s).xs.length === 3 },
  'parity-even': { needs: ['mirror'], state: (s) => s.mode === 'parity' && s.mirror === 'y' && FN[s.f].parity === 'even' },
  'parity-odd': { needs: ['mirror'], state: (s) => s.mode === 'parity' && s.mirror === 'origin' && FN[s.f].parity === 'odd' },
  'period-find': { needs: ['T'], state: (s) => s.mode === 'parity' && FN[s.f].period !== null && Math.abs(s.T - (FN[s.f].period as number)) <= 0.02 },
  'inverse-fail': { needs: ['k'], state: (s) => s.mode === 'inverse' && restrictedHits(s) >= 2 },
  'inverse-branch': {
    needs: ['lo', 'hi'],
    state: (s) => {
      if (s.mode !== 'inverse') return false;
      const [x0, x1] = FN[s.f].window.x;
      return s.hi - s.lo >= (x1 - x0) / 2 - 1e-9 && oneToOne(s);
    },
  },
  'inverse-point': { needs: ['p'], event: true, state: (s) => s.mode === 'inverse' },
};

/* ---- canvas helpers */

function haloText(ctx: CanvasRenderingContext2D, p: Palette, s: string, x: number, y: number, o: { font: string; color?: string; align?: CanvasTextAlign; rtl?: boolean }) {
  ctx.save();
  ctx.direction = o.rtl ? 'rtl' : 'ltr';
  ctx.font = o.font;
  ctx.textAlign = o.align ?? 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = withAlpha(p.paper, 0.9);
  ctx.strokeText(s, x, y);
  ctx.fillStyle = o.color ?? p.ink;
  ctx.fillText(s, x, y);
  ctx.restore();
}

function dashed(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width = 1.2) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

/** a filled mark: the point belongs to the graph */
function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, paper: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = paper;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** a hollow mark: paper inside, a coloured ring (the point is excluded) */
function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, paper: string, width = 2.4) {
  ctx.save();
  ctx.fillStyle = paper;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function square(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, paper: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = paper;
  ctx.lineWidth = 1.5;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  ctx.strokeRect(x - r, y - r, 2 * r, 2 * r);
  ctx.restore();
}

interface Pane {
  box: Box;
  xr: [number, number];
  yr: [number, number];
  px: (v: number) => number;
  py: (v: number) => number;
}
function makePane(box: Box, xr: [number, number], yr: [number, number]): Pane {
  const pl = makePlot(box, { min: xr[0], max: xr[1] }, { min: yr[0], max: yr[1] });
  return { box, xr, yr, px: pl.px, py: pl.py };
}
const inX = (pn: Pane, v: number) => v >= pn.xr[0] - 1e-9 && v <= pn.xr[1] + 1e-9;
const inY = (pn: Pane, v: number) => v >= pn.yr[0] - 1e-9 && v <= pn.yr[1] + 1e-9;

const PI_IDS: FnId[] = ['sin', 'cos', 'tan', 'sin2'];
const PI_Y_IDS: FnId[] = ['arcsin', 'arccos', 'arctan'];

function ticksFor(range: [number, number], pi: boolean, target: number): number[] {
  if (pi) {
    const step = range[1] - range[0] > 4 * Math.PI ? Math.PI : Math.PI / 2;
    const out: number[] = [];
    for (let k = Math.ceil(range[0] / step - 1e-9); k * step <= range[1] + 1e-9; k++) out.push(k * step);
    return out;
  }
  return niceTicks(range[0], range[1], target);
}
const tickText = (v: number, pi: boolean) => (pi ? (niceAngle(v) ?? fmt(v)) : fmt(v));

interface AxisOpts {
  fs: number;
  piX?: boolean;
  piY?: boolean;
  target?: number;
  labels?: boolean;
}
/** grid, frame, the axes through the origin (clamped to the frame) and the tick numbers */
function drawPane(ctx: CanvasRenderingContext2D, p: Palette, pn: Pane, o: AxisOpts) {
  const { box } = pn;
  const target = o.target ?? 6;
  const xt = ticksFor(pn.xr, !!o.piX, target);
  const yt = ticksFor(pn.yr, !!o.piY, target);
  ctx.save();
  ctx.strokeStyle = withAlpha(p.rule, 0.8);
  ctx.lineWidth = 1;
  for (const v of xt) {
    ctx.beginPath();
    ctx.moveTo(pn.px(v), box.y);
    ctx.lineTo(pn.px(v), box.y + box.h);
    ctx.stroke();
  }
  for (const v of yt) {
    ctx.beginPath();
    ctx.moveTo(box.x, pn.py(v));
    ctx.lineTo(box.x + box.w, pn.py(v));
    ctx.stroke();
  }
  ctx.strokeStyle = p.rule;
  ctx.strokeRect(box.x, box.y, box.w, box.h);
  const ax = clamp(pn.px(0), box.x, box.x + box.w);
  const ay = clamp(pn.py(0), box.y, box.y + box.h);
  ctx.strokeStyle = p.ink2;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(box.x, ay);
  ctx.lineTo(box.x + box.w, ay);
  ctx.moveTo(ax, box.y);
  ctx.lineTo(ax, box.y + box.h);
  ctx.stroke();
  ctx.restore();
  if (o.labels === false) return;
  const font = `400 ${o.fs - 1}px ${p.fontUi}`;
  const ly = Math.min(ay + 11, box.y + box.h - 7);
  for (const v of xt) {
    if (Math.abs(v) < 1e-9) continue;
    const sx = pn.px(v);
    if (sx < box.x + 10 || sx > box.x + box.w - 10) continue;
    haloText(ctx, p, tickText(v, !!o.piX), sx, ly, { font, color: p.ink3 });
  }
  const left = ax - box.x < 34;
  for (const v of yt) {
    if (Math.abs(v) < 1e-9) continue;
    const sy = pn.py(v);
    if (sy < box.y + 8 || sy > box.y + box.h - 8) continue;
    haloText(ctx, p, tickText(v, !!o.piY), left ? ax + 5 : ax - 5, sy, { font, color: p.ink3, align: left ? 'left' : 'right' });
  }
  haloText(ctx, p, 'x', box.x + box.w - 8, Math.min(ay - 10, box.y + box.h - 12), { font: `italic 700 ${o.fs}px ${p.fontUi}`, color: p.ink2 });
  haloText(ctx, p, 'y', Math.min(ax + 10, box.x + box.w - 8), box.y + 9, { font: `italic 700 ${o.fs}px ${p.fontUi}`, color: p.ink2 });
}

interface StrokeOpts {
  color: string;
  width?: number;
  dash?: number[];
  from?: number;
  to?: number;
  /** extra x values to include in the sampling (the exact ends of the domain) */
  extra?: number[];
}
/** y = F(x) clipped to the pane, broken where F is undefined and where it jumps by more than the pane's height */
function strokeFn(ctx: CanvasRenderingContext2D, pn: Pane, F: Fn, o: StrokeOpts) {
  const x0 = Math.max(o.from ?? pn.xr[0], pn.xr[0]);
  const x1 = Math.min(o.to ?? pn.xr[1], pn.xr[1]);
  if (!(x1 > x0)) return;
  const n = Math.max(60, Math.ceil(pn.box.w / 1.5));
  const xs: number[] = [];
  for (let i = 0; i <= n; i++) xs.push(x0 + ((x1 - x0) * i) / n);
  for (const e of o.extra ?? []) if (finite(e) && e > x0 && e < x1) xs.push(e);
  xs.sort((a, b) => a - b);
  ctx.save();
  ctx.beginPath();
  ctx.rect(pn.box.x, pn.box.y - 1, pn.box.w, pn.box.h + 2);
  ctx.clip();
  ctx.strokeStyle = o.color;
  ctx.lineWidth = o.width ?? 2.4;
  ctx.lineJoin = 'round';
  ctx.setLineDash(o.dash ?? []);
  ctx.beginPath();
  let started = false;
  let prev = 0;
  for (const x of xs) {
    const y = F(x);
    if (!finite(y)) {
      started = false;
      continue;
    }
    const sy = clamp(pn.py(y), -1e4, 1e4);
    const sx = pn.px(x);
    if (started && Math.abs(sy - prev) > 1.5 * pn.box.h) started = false;
    if (started) ctx.lineTo(sx, sy);
    else ctx.moveTo(sx, sy);
    started = true;
    prev = sy;
  }
  ctx.stroke();
  ctx.restore();
}

/** the finite ends of the domain of `id` inside the x range, for exact sampling */
const domainEnds = (id: FnId, lo: number, hi: number): number[] => domainOf(id, lo, hi).flatMap((iv) => [iv.lo, iv.hi]).filter((e) => finite(e) && e >= lo && e <= hi);

/** thick segments of a set along an axis ('x': the x-axis, 'y': the y-axis), ends filled (included) / hollow (excluded) */
function drawSet(ctx: CanvasRenderingContext2D, p: Palette, pn: Pane, set: Interval[], axis: 'x' | 'y', color: string) {
  const { box } = pn;
  const ax = clamp(pn.px(0), box.x, box.x + box.w);
  const ay = clamp(pn.py(0), box.y, box.y + box.h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  ctx.strokeStyle = withAlpha(color, 0.85);
  ctx.lineWidth = 6;
  ctx.lineCap = 'butt';
  for (const iv of set) {
    const lo = clamp(iv.lo, axis === 'x' ? pn.xr[0] : pn.yr[0], axis === 'x' ? pn.xr[1] : pn.yr[1]);
    const hi = clamp(iv.hi, axis === 'x' ? pn.xr[0] : pn.yr[0], axis === 'x' ? pn.xr[1] : pn.yr[1]);
    if (!(hi >= lo)) continue;
    ctx.beginPath();
    if (axis === 'x') {
      ctx.moveTo(pn.px(lo), ay);
      ctx.lineTo(pn.px(hi), ay);
    } else {
      ctx.moveTo(ax, pn.py(lo));
      ctx.lineTo(ax, pn.py(hi));
    }
    ctx.stroke();
  }
  ctx.restore();
  for (const iv of set) {
    for (const [v, open] of [[iv.lo, iv.loOpen], [iv.hi, iv.hiOpen]] as const) {
      if (!finite(v)) continue;
      if (axis === 'x' ? !inX(pn, v) : !inY(pn, v)) continue;
      const sx = axis === 'x' ? pn.px(v) : ax;
      const sy = axis === 'x' ? ay : pn.py(v);
      if (open) ring(ctx, sx, sy, 5, color, p.paper, 2.2);
      else dot(ctx, sx, sy, 5, color, p.paper);
    }
  }
}

/** the end points of the domain on the graph itself: filled where the graph includes them */
function drawGraphEnds(ctx: CanvasRenderingContext2D, p: Palette, pn: Pane, id: FnId, F: Fn, color: string) {
  for (const e of domainEnds(id, pn.xr[0], pn.xr[1])) {
    const y = F(e);
    if (finite(y) && inY(pn, y)) dot(ctx, pn.px(e), pn.py(y), 4.5, color, p.paper);
  }
}

export default function GraphLab(props: GraphLabProps) {
  const startMode: GraphMode = props.mode ?? 'read';
  const modes: GraphMode[] = props.modes ?? [startMode];
  const defaultF: Record<GraphMode, FnId> = { read: 'quad', compose: 'sqrt', transform: 'x2', solve: 'cubic', parity: 'x3', inverse: 'x2' };

  const initial = (): Setup => {
    const f = fnId(props.f) ?? defaultF[startMode];
    const g = fnId(props.g) ?? (startMode === 'compose' ? 'quad' : startMode === 'solve' ? 'const' : 'lin');
    const base: Setup = {
      mode: startMode,
      f,
      g,
      x: props.x ?? 1,
      domain: props.domain ?? false,
      range: props.range ?? false,
      mono: props.mono ?? false,
      swap: props.swap ?? false,
      a: props.a ?? 0,
      b: props.b !== undefined && props.b !== 0 ? props.b : 1,
      A: props.A ?? 1,
      c: props.c ?? 0,
      target: props.target ? parseTarget(props.target) : null,
      k: props.k ?? (startMode === 'inverse' ? 1 : 0),
      mirror: props.mirror ?? 'none',
      T: props.T ?? 0,
      lo: 0,
      hi: 0,
      p: props.p ?? 1,
    };
    const [x0, x1] = FN[f].window.x;
    base.lo = clamp(props.lo ?? x0, x0, x1);
    base.hi = clamp(props.hi ?? x1, x0, x1);
    const [w0, w1] = xWindow(base);
    base.x = clamp(base.x, w0, w1);
    base.p = clamp(base.p, base.lo, base.hi);
    return base;
  };
  const [setup, setSetup] = useState<Setup>(initial);
  const cur = useRef(setup);
  const [live, setLive] = useState('');
  const [selected, setSelected] = useState<Handle | null>(null);
  const drag = useRef<Handle | null>(null);
  const mainPane = useRef<Pane | null>(null);
  /** tasks whose state held when the last step or reset made it: they must be left and found again */
  const held = useRef<Set<string>>(new Set());

  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const done = (t: string) => {
    if (props.tasks?.includes(t)) markTask(`${props.id}:${t}`);
  };
  const rebase = (s: Setup) => {
    held.current = new Set((props.tasks ?? []).filter((id) => RULES[id] && !RULES[id].event && RULES[id].state(s)));
  };
  const commit = (s: Setup) => {
    cur.current = s;
    setSetup(s);
  };
  useEffect(() => rebase(cur.current), []);

  useEffect(
    () =>
      subscribeSteps(props.id, (st: StepState) => {
        const prev = cur.current;
        const mode = typeof st.mode === 'string' && modes.includes(st.mode as GraphMode) ? (st.mode as GraphMode) : prev.mode;
        const f = fnId(st.f) ?? prev.f;
        const target = 'target' in st ? (st.target === null ? null : (parseTarget(st.target) ?? prev.target)) : prev.target;
        const b = num(st.b);
        const next: Setup = {
          mode,
          f,
          g: fnId(st.g) ?? prev.g,
          x: num(st.x) ?? prev.x,
          domain: bool(st.domain) ?? prev.domain,
          range: bool(st.range) ?? prev.range,
          mono: bool(st.mono) ?? prev.mono,
          swap: bool(st.swap) ?? prev.swap,
          a: num(st.a) ?? prev.a,
          b: b !== null && b !== 0 ? b : prev.b,
          A: num(st.A) ?? prev.A,
          c: num(st.c) ?? prev.c,
          target,
          k: num(st.k) ?? prev.k,
          mirror: st.mirror === 'none' || st.mirror === 'y' || st.mirror === 'origin' ? st.mirror : prev.mirror,
          T: num(st.T) ?? prev.T,
          lo: num(st.lo) ?? prev.lo,
          hi: num(st.hi) ?? prev.hi,
          p: num(st.p) ?? prev.p,
        };
        const [x0, x1] = FN[f].window.x;
        if (f !== prev.f) {
          if (num(st.lo) === null) next.lo = x0;
          if (num(st.hi) === null) next.hi = x1;
        }
        next.lo = clamp(next.lo, x0, x1);
        next.hi = clamp(next.hi, x0, x1);
        if (next.hi < next.lo) [next.lo, next.hi] = [next.hi, next.lo];
        const [w0, w1] = xWindow(next);
        next.x = clamp(next.x, w0, w1);
        next.p = clamp(next.p, next.lo, next.hi);
        commit(next);
        rebase(next);
      }),
    [props.id],
  );

  const s0 = setup;
  const win = windowOf(s0);
  const fF = fnOf(s0.f, s0.k);
  const gF = fnOf(s0.g, s0.k);
  const mainSq = s0.mode === 'inverse';

  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    const narrow = view.w < 520;
    const fs = narrow ? 11.5 : 12.5;
    const font = (w8: number, size = fs, it = true) => `${it ? 'italic ' : ''}${w8} ${size}px ${p.fontUi}`;
    const margin = narrow ? { l: 6, r: 8, t: 8, b: 8 } : { l: 8, r: 10, t: 10, b: 10 };
    const top = narrow ? 34 : 0; // the stage's tool buttons sit over the top edge on a phone
    const legend = (pn: Pane, rows: { text: string; color: string; dash?: boolean }[]) => {
      rows.forEach((r, i) => {
        const y = pn.box.y + 12 + i * 16;
        ctx.save();
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 2.4;
        ctx.setLineDash(r.dash ? [5, 3] : []);
        ctx.beginPath();
        ctx.moveTo(pn.box.x + 8, y);
        ctx.lineTo(pn.box.x + 26, y);
        ctx.stroke();
        ctx.restore();
        haloText(ctx, p, r.text, pn.box.x + 31, y, { font: font(600, fs - 0.5, false), color: p.ink, align: 'left' });
      });
    };
    const cursorColor = p.accent;

    /* ---------------------------------------------------------------- compose: three panes */
    if (s0.mode === 'compose') {
      const { inner, outer, iName, oName } = chainOf(s0);
      const iF = fnOf(inner, s0.k);
      const oF = fnOf(outer, s0.k);
      const stage: Box = { x: 0, y: top, w: view.w, h: view.h - top };
      let mainBox: Box;
      let boxI: Box;
      let boxO: Box;
      if (narrow) {
        const hMain = stage.h * 0.58;
        mainBox = insetBox({ x: stage.x, y: stage.y, w: stage.w, h: hMain }, margin);
        const hs = stage.h - hMain;
        boxI = insetBox({ x: 0, y: stage.y + hMain, w: stage.w / 2, h: hs }, margin);
        boxO = insetBox({ x: stage.w / 2, y: stage.y + hMain, w: stage.w / 2, h: hs }, margin);
      } else {
        const wSide = stage.w * 0.34;
        mainBox = insetBox({ x: wSide, y: stage.y, w: stage.w - wSide, h: stage.h }, margin);
        boxI = insetBox({ x: 0, y: stage.y, w: wSide, h: stage.h / 2 }, margin);
        boxO = insetBox({ x: 0, y: stage.y + stage.h / 2, w: wSide, h: stage.h / 2 }, margin);
      }
      const pm = makePane(mainBox, win.x, win.y);
      const pi = makePane(boxI, FN[inner].window.x, FN[inner].window.y);
      const po = makePane(boxO, FN[outer].window.x, FN[outer].window.y);
      mainPane.current = pm;
      const small = { fs: fs - 1.5, target: 4 };
      drawPane(ctx, p, pm, { fs, target: 6, piX: PI_IDS.includes(inner), piY: PI_Y_IDS.includes(outer) });
      drawPane(ctx, p, pi, { ...small, piX: PI_IDS.includes(inner), piY: PI_Y_IDS.includes(inner) });
      drawPane(ctx, p, po, { ...small, piX: PI_IDS.includes(outer), piY: PI_Y_IDS.includes(outer) });

      // the domain of the composition on the x-axis of the main plot (a probe)
      const cd = composedDomain(s0);
      drawSet(ctx, p, pm, cd, 'x', p.delta);
      const comp = composeFn(oF, iF);
      strokeFn(ctx, pm, comp, { color: p.accent, width: 2.8, extra: cd.flatMap((iv) => [iv.lo, iv.hi]) });
      strokeFn(ctx, pi, iF, { color: p.curve, width: 2.2, extra: domainEnds(inner, ...pi.xr) });
      strokeFn(ctx, po, oF, { color: p.equip, width: 2.2, extra: domainEnds(outer, ...po.xr) });
      drawGraphEnds(ctx, p, pi, inner, iF, p.curve);
      drawGraphEnds(ctx, p, po, outer, oF, p.equip);

      const x = s0.x;
      const u = iF(x);
      const y = oF(u);
      // inner panel: the vertical from x to the point (x, inner(x))
      if (inX(pi, x)) {
        const ay = clamp(pi.py(0), pi.box.y, pi.box.y + pi.box.h);
        dashed(ctx, pi.px(x), ay, pi.px(x), finite(u) ? clamp(pi.py(u), pi.box.y, pi.box.y + pi.box.h) : ay, withAlpha(cursorColor, 0.9));
        if (finite(u) && inY(pi, u)) {
          dashed(ctx, pi.px(x), pi.py(u), pi.box.x + pi.box.w, pi.py(u), withAlpha(p.ink3, 0.8));
          dot(ctx, pi.px(x), pi.py(u), 5, cursorColor, p.paper);
        } else if (!finite(u)) ring(ctx, pi.px(x), ay, 5, p.pointOut, p.paper);
      }
      // outer panel: the value u arrives on the x-axis and goes up to the outer graph
      if (finite(u) && inX(po, u)) {
        const ay = clamp(po.py(0), po.box.y, po.box.y + po.box.h);
        if (finite(y) && inY(po, y)) {
          dashed(ctx, po.px(u), ay, po.px(u), po.py(y), withAlpha(cursorColor, 0.9));
          dot(ctx, po.px(u), po.py(y), 5, cursorColor, p.paper);
        } else {
          ring(ctx, po.px(u), ay, 5.5, p.pointOut, p.paper);
          haloText(ctx, p, 'לא מוגדר', po.px(u), clamp(ay - 16, po.box.y + 10, po.box.y + po.box.h - 10), { font: font(700, fs - 1, false), color: p.pointOut, rtl: true });
        }
      }
      // main plot: the cursor, filled when the whole chain is defined, hollow when it breaks
      if (inX(pm, x)) {
        const ay = clamp(pm.py(0), pm.box.y, pm.box.y + pm.box.h);
        if (finite(y) && inY(pm, y)) {
          dashed(ctx, pm.px(x), ay, pm.px(x), pm.py(y), withAlpha(cursorColor, 0.9));
          dashed(ctx, pm.px(x), pm.py(y), clamp(pm.px(0), pm.box.x, pm.box.x + pm.box.w), pm.py(y), withAlpha(p.ink3, 0.8));
          dot(ctx, pm.px(x), pm.py(y), 6, cursorColor, p.paper);
        } else {
          dashed(ctx, pm.px(x), pm.box.y, pm.px(x), pm.box.y + pm.box.h, withAlpha(cursorColor, 0.5));
          ring(ctx, pm.px(x), ay, 6, p.pointOut, p.paper);
          haloText(ctx, p, 'לא מוגדר', pm.px(x), clamp(ay - 18, pm.box.y + 12, pm.box.y + pm.box.h - 12), { font: font(700, fs, false), color: p.pointOut, rtl: true });
        }
      }
      haloText(ctx, p, `${iName}(x) = ${FN[inner].text}`, pi.box.x + 6, pi.box.y + 11, { font: font(600, fs - 1, false), color: p.curve, align: 'left' });
      haloText(ctx, p, `${oName}(x) = ${FN[outer].text}`, po.box.x + 6, po.box.y + 11, { font: font(600, fs - 1, false), color: p.equip, align: 'left' });
      haloText(ctx, p, `${oName}(${iName}(x))`, pm.box.x + 6, pm.box.y + 11, { font: font(700, fs, false), color: p.accent, align: 'left' });
      return;
    }

    /* ---------------------------------------------------------------- the single-plot modes */
    const stage: Box = { x: 0, y: top, w: view.w, h: view.h - top };
    let area = insetBox(stage, margin);
    if (mainSq) {
      const side = Math.min(area.w, area.h);
      area = { x: area.x + (area.w - side) / 2, y: area.y + (area.h - side) / 2, w: side, h: side };
    }
    const pn = makePane(area, win.x, win.y);
    mainPane.current = pn;
    const piX = PI_IDS.includes(s0.f);
    const piY = PI_Y_IDS.includes(s0.f);
    drawPane(ctx, p, pn, { fs, piX, piY, target: mainSq ? 8 : 6 });
    const ends = domainEnds(s0.f, pn.xr[0], pn.xr[1]);

    if (s0.mode === 'read') {
      if (s0.domain) drawSet(ctx, p, pn, domainOf(s0.f, pn.xr[0], pn.xr[1]), 'x', p.delta);
      if (s0.range) drawSet(ctx, p, pn, FN[s0.f].range, 'y', p.eps);
      strokeFn(ctx, pn, fF, { color: p.curve, width: s0.mono ? 1.6 : 2.8, extra: ends });
      if (s0.mono) {
        for (const pc of monoOf(s0.f, pn.xr[0], pn.xr[1]).filter((q) => q.dir !== 'const')) {
          strokeFn(ctx, pn, fF, { color: p.accent, width: 3.6, dash: pc.dir === 'dec' ? [9, 5] : undefined, from: pc.lo, to: pc.hi });
        }
      }
      drawGraphEnds(ctx, p, pn, s0.f, fF, p.curve);
      for (const z of zerosOf(s0.f, pn.xr[0], pn.xr[1])) if (finite(fF(z))) dot(ctx, pn.px(z), pn.py(0), 4.5, p.limit, p.paper);
      const y0 = fF(0);
      if (finite(y0) && inY(pn, y0) && inX(pn, 0)) square(ctx, pn.px(0), pn.py(y0), 4.2, p.eps, p.paper);
      const rows: { text: string; color: string; dash?: boolean }[] = [{ text: `f(x) = ${FN[s0.f].text}`, color: p.curve }];
      if (s0.mono) rows.push({ text: 'עולה', color: p.accent }, { text: 'יורדת', color: p.accent, dash: true });
      legend(pn, rows);
      const x = s0.x;
      const y = fF(x);
      const ay = clamp(pn.py(0), pn.box.y, pn.box.y + pn.box.h);
      if (finite(y)) {
        if (inY(pn, y)) {
          dashed(ctx, pn.px(x), ay, pn.px(x), pn.py(y), withAlpha(cursorColor, 0.9));
          dashed(ctx, pn.px(x), pn.py(y), clamp(pn.px(0), pn.box.x, pn.box.x + pn.box.w), pn.py(y), withAlpha(p.ink3, 0.85));
          dot(ctx, pn.px(x), pn.py(y), 6.5, cursorColor, p.paper);
        } else {
          dashed(ctx, pn.px(x), pn.box.y, pn.px(x), pn.box.y + pn.box.h, withAlpha(cursorColor, 0.6));
        }
      } else {
        dashed(ctx, pn.px(x), pn.box.y, pn.px(x), pn.box.y + pn.box.h, withAlpha(cursorColor, 0.5));
        ring(ctx, pn.px(x), ay, 6, p.pointOut, p.paper);
        haloText(ctx, p, 'לא מוגדרת', pn.px(x), clamp(ay - 20, pn.box.y + 12, pn.box.y + pn.box.h - 12), { font: font(700, fs, false), color: p.pointOut, rtl: true });
      }
    } else if (s0.mode === 'transform') {
      const t: TransformSpec = { a: s0.a, b: s0.b, A: s0.A, c: s0.c };
      if (s0.target) strokeFn(ctx, pn, transformFn(fF, s0.target), { color: withAlpha(p.delta, 0.55), width: 5 });
      strokeFn(ctx, pn, fF, { color: p.ink3, width: 1.8, dash: [6, 4], extra: ends });
      strokeFn(ctx, pn, transformFn(fF, t), { color: p.accent, width: 2.9 });
      if (inX(pn, t.a) && inY(pn, t.c)) {
        ctx.save();
        ctx.strokeStyle = p.accent;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(pn.px(t.a) - 6, pn.py(t.c));
        ctx.lineTo(pn.px(t.a) + 6, pn.py(t.c));
        ctx.moveTo(pn.px(t.a), pn.py(t.c) - 6);
        ctx.lineTo(pn.px(t.a), pn.py(t.c) + 6);
        ctx.stroke();
        ctx.restore();
        haloText(ctx, p, '(a, c)', pn.px(t.a) + 8, pn.py(t.c) + 14, { font: font(600, fs - 1), color: p.accent, align: 'left' });
      }
      const rows: { text: string; color: string; dash?: boolean }[] = [
        { text: `f(x) = ${FN[s0.f].text}`, color: p.ink3, dash: true },
        { text: 'y = A·f((x − a)/b) + c', color: p.accent },
      ];
      if (s0.target) rows.push({ text: 'היעד', color: withAlpha(p.delta, 0.8) });
      legend(pn, rows);
    } else if (s0.mode === 'solve') {
      const hits = hitsOf(s0);
      strokeFn(ctx, pn, fF, { color: p.curve, width: 2.8, extra: ends });
      strokeFn(ctx, pn, gF, { color: p.equip, width: 2.8, extra: s0.g === 'const' ? [] : domainEnds(s0.g, pn.xr[0], pn.xr[1]) });
      hits.xs.forEach((x) => {
        const y = fF(x);
        if (finite(y) && inY(pn, y)) {
          dot(ctx, pn.px(x), pn.py(y), 6.5, p.limit, p.paper);
          ring(ctx, pn.px(x), pn.py(y), 10, p.limit, 'transparent', 1.6);
        }
      });
      const rows: { text: string; color: string; dash?: boolean }[] = [{ text: `f(x) = ${FN[s0.f].text}`, color: p.curve }];
      rows.push({ text: s0.g === 'const' ? `y = ${fmt(s0.k)}` : `g(x) = ${FN[s0.g].text}`, color: p.equip });
      legend(pn, rows);
      if (s0.g === 'const' && selected === 'k') {
        ctx.save();
        ctx.strokeStyle = p.accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pn.box.x + pn.box.w - 14, pn.py(s0.k), 8, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
    } else if (s0.mode === 'parity') {
      if (s0.mirror === 'y') {
        const ay = clamp(pn.px(0), pn.box.x, pn.box.x + pn.box.w);
        ctx.save();
        ctx.strokeStyle = withAlpha(p.equip, 0.9);
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(ay, pn.box.y);
        ctx.lineTo(ay, pn.box.y + pn.box.h);
        ctx.stroke();
        ctx.restore();
      }
      if (s0.mirror !== 'none') strokeFn(ctx, pn, mirrorFn(fF, s0.mirror), { color: p.equip, width: 3.2, dash: [8, 5] });
      if (s0.T !== 0) strokeFn(ctx, pn, shiftFn(fF, s0.T), { color: p.eps, width: 3, dash: [3, 4] });
      strokeFn(ctx, pn, fF, { color: p.curve, width: 2.8, extra: ends });
      drawGraphEnds(ctx, p, pn, s0.f, fF, p.curve);
      if (s0.mirror === 'origin') {
        ring(ctx, pn.px(0), pn.py(0), 6, p.equip, p.paper, 2.2);
      }
      const rows: { text: string; color: string; dash?: boolean }[] = [{ text: `f(x) = ${FN[s0.f].text}`, color: p.curve }];
      if (s0.mirror === 'y') rows.push({ text: 'f(−x)', color: p.equip, dash: true });
      if (s0.mirror === 'origin') rows.push({ text: '−f(−x)', color: p.equip, dash: true });
      if (s0.T !== 0) rows.push({ text: `f(x + ${fmt(s0.T)})`, color: p.eps, dash: true });
      legend(pn, rows);
    } else {
      // inverse
      const lo = s0.lo;
      const hi = s0.hi;
      const one = oneToOne(s0);
      const [m, M] = pn.xr;
      dashed(ctx, pn.px(m), pn.py(m), pn.px(M), pn.py(M), withAlpha(p.ink3, 0.95), 1.6);
      strokeFn(ctx, pn, fF, { color: withAlpha(p.ink3, 0.55), width: 1.6, extra: ends });
      // the restricted graph
      strokeFn(ctx, pn, fF, { color: p.curve, width: 3.2, from: lo, to: hi, extra: ends });
      for (const e of [lo, hi]) {
        const y = fF(e);
        if (finite(y) && inY(pn, y)) dot(ctx, pn.px(e), pn.py(y), 4.5, p.curve, p.paper);
      }
      // the reflection: the points (f(x), x) for x in [lo, hi], undefined values skipped
      const refl = (): void => {
        const n = 400;
        ctx.save();
        ctx.beginPath();
        ctx.rect(pn.box.x, pn.box.y - 1, pn.box.w, pn.box.h + 2);
        ctx.clip();
        ctx.strokeStyle = one ? p.accent : withAlpha(p.accent, 0.8);
        ctx.lineWidth = one ? 3.4 : 2.6;
        ctx.setLineDash(one ? [] : [8, 5]);
        ctx.lineJoin = 'round';
        ctx.beginPath();
        let started = false;
        let prev = 0;
        for (let i = 0; i <= n; i++) {
          const x = lo + ((hi - lo) * i) / n;
          const y = fF(x);
          if (!finite(y)) {
            started = false;
            continue;
          }
          const sx = clamp(pn.px(y), -1e4, 1e4);
          const sy = pn.py(x);
          if (started && Math.abs(sx - prev) > 1.5 * pn.box.w) started = false;
          if (started) ctx.lineTo(sx, sy);
          else ctx.moveTo(sx, sy);
          started = true;
          prev = sx;
        }
        ctx.stroke();
        ctx.restore();
      };
      refl();
      for (const e of [lo, hi]) {
        const y = fF(e);
        if (finite(y) && inX(pn, y)) dot(ctx, pn.px(y), pn.py(e), 4.5, p.accent, p.paper);
      }
      // the line y = k, its vertical mirror x = k and the hits on the restricted graph
      const k = s0.k;
      if (inY(pn, k)) {
        dashed(ctx, pn.box.x, pn.py(k), pn.box.x + pn.box.w, pn.py(k), p.eps, 1.8);
        const xsHit = intersections(fF, () => k, lo, hi).xs;
        for (const x of xsHit) dot(ctx, pn.px(x), pn.py(k), 5.5, p.eps, p.paper);
        if (selected === 'k') {
          ctx.save();
          ctx.strokeStyle = p.accent;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(pn.box.x + pn.box.w - 14, pn.py(k), 8, 0, TAU);
          ctx.stroke();
          ctx.restore();
        }
      }
      // the draggable point and its mirror
      const pv = s0.p;
      const fp = fF(pv);
      if (finite(fp) && inX(pn, pv) && inY(pn, fp)) {
        dashed(ctx, pn.px(pv), pn.py(fp), pn.px(fp), pn.py(pv), withAlpha(p.ink2, 0.8), 1.4);
        dot(ctx, pn.px(pv), pn.py(fp), 6, p.curve, p.paper);
        if (inX(pn, fp) && inY(pn, pv)) dot(ctx, pn.px(fp), pn.py(pv), 6, p.accent, p.paper);
        if (selected === 'p') ring(ctx, pn.px(pv), pn.py(fp), 11, p.accent, 'transparent', 2);
      }
      const rows: { text: string; color: string; dash?: boolean }[] = [
        { text: `f(x) = ${FN[s0.f].text}`, color: p.curve },
        { text: 'y = x', color: p.ink3, dash: true },
        { text: one ? 'f⁻¹' : 'אינה פונקציה', color: p.accent, dash: !one },
      ];
      legend(pn, rows);
    }
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1.6, worldHeight: 1, animate: false });
  useEffect(invalidate, [setup, selected]);

  const [aspect, setAspect] = useState(1.45);
  const aspectFor = (mode: GraphMode, wpx: number) => {
    const narrow = wpx < 520;
    return mode === 'compose' ? (narrow ? 0.95 : 1.7) : mode === 'inverse' ? (narrow ? 1 : 1.3) : narrow ? 0.95 : 1.45;
  };
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAspect(aspectFor(cur.current.mode, el.getBoundingClientRect().width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    setAspect(aspectFor(setup.mode, canvasRef.current?.getBoundingClientRect().width ?? 600));
  }, [setup.mode]);
  useEffect(invalidate, [aspect]);

  /** The learner changed the figure: apply, then tick whatever the new state completes. */
  const apply = (patch: Partial<Setup>) => {
    const prev = cur.current;
    const next = { ...prev, ...patch };
    if (patch.lo !== undefined || patch.hi !== undefined) {
      const [x0, x1] = FN[next.f].window.x;
      next.lo = clamp(next.lo, x0, x1);
      next.hi = clamp(next.hi, x0, x1);
      next.p = clamp(next.p, next.lo, next.hi);
    }
    commit(next);
    for (const id of props.tasks ?? []) {
      const rule = RULES[id];
      if (!rule) continue;
      if (!rule.state(next)) {
        held.current.delete(id);
        continue;
      }
      if (!rule.needs.some((key) => key in patch)) continue;
      if (!rule.event && held.current.has(id)) continue;
      done(id);
    }
  };

  /** the slider T snaps to a multiple of the period of f within 0.02, so that the exact period is reachable */
  const snapT = (v: number): number => {
    const per = FN[cur.current.f].period;
    let t = roundTo(v, 0.01);
    if (per !== null) {
      const m = Math.round(t / per);
      if (m >= 1 && Math.abs(t - m * per) <= 0.02) t = m * per;
    }
    return clamp(t, 0, 7);
  };
  const snapK = (v: number, [y0, y1]: [number, number]): number => {
    const q = Math.round(v / 0.25) * 0.25;
    return clamp(Math.abs(v - q) < SNAP ? q : roundTo(v, 0.05), y0, y1);
  };

  const handles = (): Handle[] => (setup.mode === 'read' || setup.mode === 'compose' ? ['x'] : setup.mode === 'solve' && setup.g === 'const' ? ['k'] : setup.mode === 'inverse' ? ['k', 'p'] : []);

  const moveTo = (h: Handle, v: number) => {
    const c = cur.current;
    if (h === 'x') {
      const nx = snapX(c, v);
      if (nx !== c.x) apply({ x: nx });
    } else if (h === 'k') {
      const w = windowOf(c);
      const nk = snapK(v, w.y);
      if (nk !== c.k) apply({ k: nk });
    } else {
      const np = clamp(roundTo(v, 0.05), c.lo, c.hi);
      if (np !== c.p) apply({ p: np });
    }
  };

  const pointerValue = (h: Handle, e: PointerEvent): number | null => {
    const pn = mainPane.current;
    if (!pn) return null;
    return h === 'k' ? pn.yr[0] + ((pn.box.y + pn.box.h - e.offsetY) / pn.box.h) * (pn.yr[1] - pn.yr[0]) : pn.xr[0] + ((e.offsetX - pn.box.x) / pn.box.w) * (pn.xr[1] - pn.xr[0]);
  };

  const onPointerDown = (e: PointerEvent) => {
    const pn = mainPane.current;
    const hs = handles();
    if (!pn || hs.length === 0) return;
    let best: Handle | null = null;
    if (hs.length === 1) {
      const inside = e.offsetX >= pn.box.x - 4 && e.offsetX <= pn.box.x + pn.box.w + 4 && e.offsetY >= pn.box.y - 4 && e.offsetY <= pn.box.y + pn.box.h + 4;
      best = inside ? hs[0] : null;
    } else {
      const c = cur.current;
      const dk = Math.abs(pn.py(c.k) - e.offsetY);
      const fp = fnOf(c.f, c.k)(c.p);
      const dp = finite(fp) ? Math.hypot(pn.px(c.p) - e.offsetX, pn.py(fp) - e.offsetY) : Infinity;
      if (dp < 20 && dp <= dk + 6) best = 'p';
      else if (dk < 14) best = 'k';
      else if (dp < 36) best = 'p';
    }
    setSelected(best);
    if (!best) return;
    drag.current = best;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const v = pointerValue(best, e);
    if (v !== null) moveTo(best, v);
  };
  const onPointerMove = (e: PointerEvent) => {
    const h = drag.current;
    if (!h) return;
    const v = pointerValue(h, e);
    if (v !== null) moveTo(h, v);
  };
  const onPointerUp = () => {
    if (drag.current) setLive(describe());
    drag.current = null;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const hs = handles();
    if (hs.length === 0) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      const i = selected ? hs.indexOf(selected) : -1;
      const nxt = hs[(i + 1) % hs.length];
      setSelected(nxt);
      setLive(nxt === 'x' ? 'נבחר הסמן.' : nxt === 'k' ? 'נבחר הישר האופקי.' : 'נבחרה הנקודה.');
      return;
    }
    const c = cur.current;
    const h = selected && hs.includes(selected) ? selected : hs[0];
    const big = e.shiftKey ? 5 : 1;
    if (h === 'k') {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      setSelected(h);
      moveTo('k', c.k + (e.key === 'ArrowUp' ? 0.25 : -0.25) * big);
      return;
    }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    setSelected(h);
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    if (h === 'x') {
      const step = 0.1 * big;
      // from a magnet the first press must leave it: move by a step, snap again
      const target = c.x + dir * Math.max(step, 0.06);
      moveTo('x', target);
    } else moveTo('p', c.p + dir * 0.1 * big);
  };

  function describe(): string {
    const s = cur.current;
    const F = fnOf(s.f, s.k);
    if (s.mode === 'read') return finite(F(s.x)) ? `x = ${fmt(s.x)}, f(x) = ${fmt(F(s.x))}.` : `x = ${fmt(s.x)}, הפונקציה לא מוגדרת שם.`;
    if (s.mode === 'compose') {
      const { inner, outer } = chainOf(s);
      const u = fnOf(inner, s.k)(s.x);
      const y = fnOf(outer, s.k)(u);
      return !finite(u) ? `x = ${fmt(s.x)}, הפונקציה הפנימית לא מוגדרת.` : !finite(y) ? `x = ${fmt(s.x)}, הערך הפנימי ${fmt(u)}, והפונקציה החיצונית לא מוגדרת בו.` : `x = ${fmt(s.x)}, הערך הפנימי ${fmt(u)}, התוצאה ${fmt(y)}.`;
    }
    if (s.mode === 'solve') return `מספר הפתרונות בחלון: ${hitsOf(s).coincident ? 'אינסוף' : hitsOf(s).xs.length}.`;
    if (s.mode === 'inverse') return `k = ${fmt(s.k)}, מספר הפגיעות בגרף המצומצם: ${restrictedHits(s)}.`;
    return '';
  }

  const M = (q: { children: ComponentChildren }) => <bdi dir="ltr">{q.children}</bdi>;

  /* ---- readout */
  let readout: ComponentChildren;
  if (setup.mode === 'read') {
    const x = setup.x;
    const y = fF(x);
    const zs = zerosOf(setup.f, win.x[0], win.x[1]);
    const y0 = fF(0);
    const turn = turningPoints(setup.f, win.x[0], win.x[1]).some((t) => Math.abs(t - x) < 1e-9);
    const dir = dirAt(setup.f, x);
    readout = (
      <>
        <span class="q" data-readout="x">
          <M>
            x = <b>{fmt(x)}</b>
          </M>
        </span>
        <span class="q" data-readout="fx">
          {finite(y) ? (
            <M>
              f(x) = <b>{fmt(y)}</b>
            </M>
          ) : (
            <>
              <M>f(x)</M> <b>לא מוגדרת</b>
            </>
          )}
        </span>
        <span class="q" data-readout="zeros">
          אפסים בחלון:{' '}
          <M>
            <b>{zs.length ? zs.map((z) => fmt(z)).join(', ') : '—'}</b>
          </M>
        </span>
        {finite(y0) && win.x[0] <= 0 && win.x[1] >= 0 && (
          <span class="q" data-readout="y-intercept">
            חיתוך עם ציר <M>y</M>:{' '}
            <M>
              f(0) = <b>{fmt(y0)}</b>
            </M>
          </span>
        )}
        {setup.domain && (
          <span class="q" data-readout="domain">
            תחום הגדרה:{' '}
            <M>
              <b>{FN[setup.f].domainText}</b>
            </M>
          </span>
        )}
        {setup.range && (
          <span class="q" data-readout="range">
            תמונה:{' '}
            <M>
              <b>{FN[setup.f].rangeText}</b>
            </M>
          </span>
        )}
        {setup.mono && (
          <span class="q" data-readout="mono">
            {turn ? 'נקודת מפנה: כאן הכיוון מתהפך' : dir === 'inc' ? 'בנקודה הזאת הפונקציה עולה' : dir === 'dec' ? 'בנקודה הזאת הפונקציה יורדת' : 'מחוץ לתחום ההגדרה'}
          </span>
        )}
      </>
    );
  } else if (setup.mode === 'compose') {
    const { inner, outer, iName, oName } = chainOf(setup);
    const u = fnOf(inner, setup.k)(setup.x);
    const y = fnOf(outer, setup.k)(u);
    const cd = composedDomain(setup);
    readout = (
      <>
        <span class="q" data-readout="chain">
          <M>
            x = <b>{fmt(setup.x)}</b>
          </M>
          {' → '}
          {finite(u) ? (
            <M>
              {iName}(x) = <b>{fmt(u)}</b>
            </M>
          ) : (
            <>
              <M>{iName}(x)</M> <b>לא מוגדרת</b>
            </>
          )}
          {' → '}
          {finite(y) ? (
            <M>
              {oName}({iName}(x)) = <b>{fmt(y)}</b>
            </M>
          ) : (
            <>
              <M>
                {oName}({iName}(x))
              </M>{' '}
              <b>לא מוגדרת</b>
            </>
          )}
        </span>
        <span class="q" data-readout="domain">
          תחום ההרכבה בחלון (בדיקה מספרית):{' '}
          <M>
            <b>{intervalsText(cd)}</b>
          </M>
        </span>
      </>
    );
  } else if (setup.mode === 'transform') {
    const t: TransformSpec = { a: setup.a, b: setup.b, A: setup.A, c: setup.c };
    const shifted = t.a === 0 ? 'x' : `x ${t.a < 0 ? '+' : '−'} ${fmt(Math.abs(t.a))}`;
    const arg = t.b === 1 ? (t.a === 0 ? 'x' : shifted) : `(${shifted})/${t.b < 0 ? `(${fmt(t.b)})` : fmt(t.b)}`;
    const core = FN[setup.f].at(arg);
    const amp = t.A === 1 ? '' : t.A === -1 ? '−' : `${fmt(t.A)}·`;
    const cs = t.c === 0 ? '' : ` ${t.c < 0 ? '−' : '+'} ${fmt(Math.abs(t.c))}`;
    const match = setup.target !== null && ['a', 'b', 'A', 'c'].every((key) => Math.abs(setup[key as 'a'] - (setup.target as TransformSpec)[key as 'a']) <= TASK_TOL);
    readout = (
      <>
        <span class="q" data-readout="formula">
          <M>
            y = <b>{`${amp}${core}${cs}`}</b>
          </M>
        </span>
        <span class="q" data-readout="params">
          <M>
            a = {fmt(t.a)}, b = {fmt(t.b)}, A = {fmt(t.A)}, c = {fmt(t.c)}
          </M>
        </span>
        {setup.target && (
          <span class="q" data-readout="target">
            <b>{match ? 'הגרף חופף ליעד' : 'הגרף עוד לא חופף ליעד'}</b>
          </span>
        )}
      </>
    );
  } else if (setup.mode === 'solve') {
    const hits = hitsOf(setup);
    readout = (
      <>
        <span class="q" data-readout="count">
          מספר הפתרונות בחלון (בדיקה מספרית): <b>{hits.coincident ? 'אינסוף' : hits.xs.length}</b>
        </span>
        <span class="q" data-readout="equation">
          <M>
            {setup.g === 'const' ? `${FN[setup.f].text} = ${fmt(setup.k)}` : `${FN[setup.f].text} = ${FN[setup.g].text}`}
          </M>
        </span>
        {!hits.coincident && hits.xs.length > 0 && (
          <span class="q" data-readout="roots">
            <M>
              x ≈ <b>{hits.xs.slice(0, 6).map((x) => fmt(x)).join(', ')}</b>
            </M>
          </span>
        )}
      </>
    );
  } else if (setup.mode === 'parity') {
    const half = Math.min(-win.x[0], win.x[1]);
    const copy = setup.mirror === 'none' ? null : coincidesOnWindow(fF, mirrorFn(fF, setup.mirror), -half, half);
    const moved = setup.T === 0 ? null : coincidesOnWindow(fF, shiftFn(fF, setup.T), -half, half, { tol: 1e-6 });
    readout = (
      <>
        {copy !== null && (
          <span class="q" data-readout="mirror">
            <M>{setup.mirror === 'y' ? 'f(−x)' : '−f(−x)'}</M>: <b>{copy ? 'זהה לגרף' : 'לא זהה לגרף'}</b> (בדיקה מספרית על החלון)
          </span>
        )}
        {moved !== null && (
          <span class="q" data-readout="shift">
            <M>f(x + {fmt(setup.T)})</M>: <b>{moved ? 'זהה לגרף' : 'לא זהה לגרף'}</b> (בדיקה מספרית על החלון)
          </span>
        )}
        {copy === null && moved === null && <span class="q">בחרו שיקוף, או הזיזו את {ltr('T')}.</span>}
      </>
    );
  } else {
    const one = oneToOne(setup);
    const fp = fF(setup.p);
    readout = (
      <>
        <span class="q" data-readout="restriction">
          הצמצום:{' '}
          <M>
            [<b>{fmt(setup.lo)}</b>, <b>{fmt(setup.hi)}</b>]
          </M>
          {': '}
          <b>{one ? 'חד-חד-ערכית, יש לה הפוכה' : 'אינה חד-חד-ערכית'}</b>
        </span>
        <span class="q" data-readout="hits">
          <M>y = {fmt(setup.k)}</M> פוגע בגרף המצומצם <b>{restrictedHits(setup)}</b> פעמים (בדיקה מספרית)
        </span>
        <span class="q" data-readout="point">
          {finite(fp) ? (
            <M>
              ({fmt(setup.p)}, {fmt(fp)}) ← ({fmt(fp)}, {fmt(setup.p)})
            </M>
          ) : (
            <>הפונקציה לא מוגדרת ב-p</>
          )}
        </span>
      </>
    );
  }

  const label =
    setup.mode === 'read'
      ? `איור חי: הגרף של ${FN[setup.f].text} וסמן ב-x = ${fmt(setup.x)}. ${finite(fF(setup.x)) ? `ערך הפונקציה ${fmt(fF(setup.x))}.` : 'הפונקציה לא מוגדרת שם.'}`
      : setup.mode === 'compose'
        ? `איור חי: הרכבת שתי פונקציות, ${FN[chainOf(setup).inner].text} ואחריה ${FN[chainOf(setup).outer].text}. בנקודה שבה הערך הפנימי מחוץ לתחום ההגדרה של החיצונית השרשרת נשברת.`
        : setup.mode === 'transform'
          ? `איור חי: הגרף של ${FN[setup.f].text} אחרי הזזה, מתיחה ושיקוף, מול הגרף המקורי המקווקו.`
          : setup.mode === 'solve'
            ? `איור חי: שני גרפים ונקודות החיתוך שלהם בחלון, ${hitsOf(setup).coincident ? 'אינסוף' : hitsOf(setup).xs.length} במספר (בדיקה מספרית).`
            : setup.mode === 'parity'
              ? `איור חי: הגרף של ${FN[setup.f].text} והעתק שלו, משוקף או מוזז, כדי לבדוק אם הוא חופף לגרף.`
              : `איור חי: ${FN[setup.f].text} על ${fmt(setup.lo)} עד ${fmt(setup.hi)}, והשיקוף שלה בישר y = x, ${oneToOne(setup) ? 'פונקציה הפוכה' : 'לא פונקציה'}.`;

  const [xw0, xw1] = xWindow(setup);
  const [yw0, yw1] = win.y;
  const [fx0, fx1] = FN[setup.f].window.x;

  return (
    <SimShell
      fig={props.id}
      label={label}
      canvasRef={canvasRef}
      aspect={aspect}
      live={live}
      tasks={tasks}
      cursor={handles().length ? 'grab' : 'default'}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onReset={() => {
        const init = initial();
        commit(init);
        rebase(init);
        setSelected(null);
        setLive('האיור חזר למצב ההתחלה.');
      }}
      readout={<div class="rtl-q">{readout}</div>}
      controls={
        <>
          {modes.length > 1 && (
            <div class="group" role="group" aria-label="מה מציג האיור">
              {modes.map((m) => (
                <Toggle
                  key={m}
                  label={MODE_LABEL[m]}
                  on={setup.mode === m}
                  onChange={() => {
                    setSelected(null);
                    apply({ mode: m });
                  }}
                />
              ))}
            </div>
          )}
          {setup.mode === 'read' && (
            <>
              <Slider label="הסמן x" value={setup.x} min={xw0} max={xw1} step={0.05} format={(v) => fmt(v)} onChange={(v) => moveTo('x', v)} />
              <div class="group" role="group" aria-label="מה להציג">
                <Toggle label="תחום הגדרה" on={setup.domain} swatch="var(--delta)" onChange={(on) => apply({ domain: on })} />
                <Toggle label="תמונה" on={setup.range} swatch="var(--eps)" onChange={(on) => apply({ range: on })} />
                <Toggle label="עלייה וירידה" on={setup.mono} swatch="var(--accent)" onChange={(on) => apply({ mono: on })} />
              </div>
            </>
          )}
          {setup.mode === 'compose' && (
            <>
              <Slider label="הסמן x" value={setup.x} min={xw0} max={xw1} step={0.05} format={(v) => fmt(v)} onChange={(v) => moveTo('x', v)} />
              <div class="group" role="group" aria-label="סדר ההרכבה">
                <Toggle label={<bdi dir="ltr">g ∘ f</bdi>} on={setup.swap} swatch="var(--accent)" onChange={(on) => apply({ swap: on })} />
              </div>
            </>
          )}
          {setup.mode === 'transform' && (
            <>
              <Slider label="הזזה ימינה a" value={setup.a} min={-4} max={4} step={0.25} format={(v) => fmt(v)} onChange={(v) => apply({ a: v })} />
              <Slider
                label="מתיחה לרוחב b"
                value={setup.b}
                min={-3}
                max={3}
                step={0.25}
                format={(v) => fmt(v)}
                onChange={(v) => apply({ b: v === 0 ? (cur.current.b < 0 ? -0.25 : 0.25) : v })}
              />
              <Slider label="מתיחה לגובה A" value={setup.A} min={-3} max={3} step={0.25} format={(v) => fmt(v)} onChange={(v) => apply({ A: v })} />
              <Slider label="הזזה למעלה c" value={setup.c} min={-4} max={4} step={0.25} format={(v) => fmt(v)} onChange={(v) => apply({ c: v })} />
            </>
          )}
          {setup.mode === 'solve' && setup.g === 'const' && (
            <Slider label="הקבוע k" value={setup.k} min={yw0} max={yw1} step={0.25} format={(v) => fmt(v)} onChange={(v) => moveTo('k', v)} />
          )}
          {setup.mode === 'parity' && (
            <>
              <div class="group" role="group" aria-label="העתק של הגרף">
                <Toggle label="בלי שיקוף" on={setup.mirror === 'none'} onChange={() => apply({ mirror: 'none' })} />
                <Toggle label="שיקוף בציר y" on={setup.mirror === 'y'} swatch="var(--equip)" onChange={() => apply({ mirror: 'y' })} />
                <Toggle label="סיבוב סביב הראשית" on={setup.mirror === 'origin'} swatch="var(--equip)" onChange={() => apply({ mirror: 'origin' })} />
              </div>
              <Slider label="ההזזה T" value={setup.T} min={0} max={7} step={0.01} format={(v) => fmt(v)} onChange={(v) => apply({ T: snapT(v) })} />
            </>
          )}
          {setup.mode === 'inverse' && (
            <>
              <Slider label="תחילת הצמצום" value={setup.lo} min={fx0} max={fx1} step={0.05} format={(v) => fmt(v)} onChange={(v) => apply({ lo: Math.min(roundTo(v, 0.05), cur.current.hi) })} />
              <Slider label="סוף הצמצום" value={setup.hi} min={fx0} max={fx1} step={0.05} format={(v) => fmt(v)} onChange={(v) => apply({ hi: Math.max(roundTo(v, 0.05), cur.current.lo) })} />
              <Slider label="הישר y = k" value={setup.k} min={yw0} max={yw1} step={0.05} format={(v) => fmt(v)} onChange={(v) => moveTo('k', v)} />
              <Slider label="הנקודה p" value={setup.p} min={setup.lo} max={Math.max(setup.hi, setup.lo + 0.05)} step={0.05} format={(v) => fmt(v)} onChange={(v) => moveTo('p', v)} />
            </>
          )}
        </>
      }
    />
  );
}
