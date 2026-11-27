/**
 * ExpLab (lesson 4.3, exponential and logarithm, e, growth rates): three views. Maths from src/math/growth.ts (aˣ and
 * log_a x, (1 + 1/n)ⁿ by log1p, the nine race functions carried as signed logarithms so that eˣ at x = 1000 never
 * overflows). Colour code (never alone): the function the reader moves / the first race function = accent, solid, filled
 * marker; log_a x and the second race function = cool (--delta), dashed, hollow marker; the limit e = green (--limit);
 * the gap and the cursor guides = warm (--eps) / ink; references (the curve of eˣ, the line y = x) faint. Canvases are
 * math space: x to the right, y up, whatever the page direction.
 *
 * mode 'bases': y = aˣ (accent, passes (0, 1)) for a slider a ∈ (0, 5] (a log scale, a = e^s, s from −2.7 to 1.6; the
 * slider skips a = 1), with `log` also y = log_a x (cool, dashed, passes (1, 0)) and the line y = x; the curve of eˣ is
 * drawn faint for reference. The two curves are drawn on EQUAL scales so that they are mirror images in y = x.
 * mode 'compound': the points (1 + 1/n)ⁿ over n on a log n-axis (n = 1…10⁶), the line y = e (green) and, at the chosen n,
 * the gap e − (1 + 1/n)ⁿ (warm). The story: a yearly interest of 100% compounded n times.
 * mode 'race': two of ln, √x, x, x², x³, x¹⁰, eˣ, 2ˣ, 1.1ˣ on (0, xmax] with xmax in {10, 50, 100, 1000}; a cursor x; with
 * `logY` the value axis is logarithmic (log10 of the values, drawn from logarithms so nothing overflows); the last
 * crossing of the pair on the window is marked with a ring and its x printed. THE CROSSING IS A PROBE (a scan of sign
 * changes on a grid, then bisection): the caption must say so. With `ratio` a lower panel shows first / second on a log
 * axis with the line 1.
 *
 * Props (defaults): id (required); mode ('bases'); modes (the mode buttons shown; default the starting mode only);
 * controls (true: false hides sliders and toggles); tasks ([]).
 *   bases:    a (2, a number), log (false)
 *   compound: n (10)
 *   race:     a ('x10'), b ('exp') (the function ids), xmax (50), x (10), logY (false), ratio (false)
 * Step `set` keys (a text step sets state through the step bus and never ticks a task): mode, and the keys of the mode
 * after the switch (a is a number in bases, an id in race): a, b, log, n, xmax, x, logY, ratio.
 * Tasks (ticked only by the reader's own change of the figure, and a state that already had the property when the step,
 * the reset or the first render made it must be left and found again):
 *   bases-below-one  a < 1 (the reader moved a): aˣ decreases
 *   bases-e          a within 0.02 of e
 *   bases-log        log shown and a moved since the last step or reset
 *   compound-far     n ≥ 1000 (the reader moved n): the gap is below 0.002
 *   race-cross       pair x¹⁰, eˣ (either order) and the cursor within 0.5 of 35.77 (the reader moved the cursor)
 *   race-log         logY on (the reader turned it on)
 *   race-ratio       ratio on, the cursor moved, and first / second < 0.01 at the cursor
 * No animation: the figure only redraws when the reader or a step moves it, so there is nothing for motionAllowed().
 */

import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  RACE_IDS,
  RACE_LABEL,
  RACE_XMAX,
  baseIncreases,
  compoundGap,
  compoundTerm,
  lastCrossing,
  logBase,
  powBase,
  raceLog,
  raceLog10,
  raceRatio,
  raceRatioLog10,
  raceValue,
  type RaceId,
} from '~/math/growth';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { superscript } from './core/format';
import { withAlpha } from './core/ink';
import { drawAxes, drawCurve, insetBox, makePlot, type Box, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import './ExpLab.css';

export type ExpMode = 'bases' | 'compound' | 'race';

export interface ExpLabProps {
  id: string;
  mode?: ExpMode;
  modes?: ExpMode[];
  controls?: boolean;
  tasks?: string[];
  a?: number | string;
  b?: string;
  log?: boolean;
  n?: number;
  xmax?: number;
  x?: number;
  logY?: boolean;
  ratio?: boolean;
}

const TAU = 2 * Math.PI;
const LN_MIN = -2.7;
const LN_MAX = 1.6;
const CROSS_XC = 35.77152063957297;

interface State {
  mode: ExpMode;
  ba: number; // the base a of the bases mode
  log: boolean;
  n: number;
  ra: RaceId;
  rb: RaceId;
  xmax: number;
  x: number;
  logY: boolean;
  ratio: boolean;
}

const isRaceId = (v: unknown): v is RaceId => typeof v === 'string' && (RACE_IDS as readonly string[]).includes(v);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clampBase = (a: number) => clamp(a, Math.exp(LN_MIN), 5);

function initial(p: ExpLabProps): State {
  const xmax = (RACE_XMAX as readonly number[]).includes(p.xmax ?? 50) ? (p.xmax ?? 50) : 50;
  return {
    mode: p.mode ?? 'bases',
    ba: typeof p.a === 'number' ? clampBase(p.a) : 2,
    log: p.log ?? false,
    n: clamp(Math.round(p.n ?? 10), 1, 1e6),
    ra: isRaceId(p.a) ? p.a : 'x10',
    rb: isRaceId(p.b) ? p.b : 'exp',
    xmax,
    x: clamp(p.x ?? 10, 0, xmax),
    logY: p.logY ?? false,
    ratio: p.ratio ?? false,
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
/** m·10ⁿ from a base-10 logarithm, plain decimal when the number is between 10⁻³ and 10⁶ */
function fromLog10(L: number): string {
  if (!Number.isFinite(L)) return '0';
  if (L > -3 && L < 6) return num(10 ** L, 4);
  let e = Math.floor(L);
  let m = 10 ** (L - e);
  if (Number(m.toFixed(2)) >= 10) {
    m = 1;
    e += 1;
  }
  const es = `${e < 0 ? MINUS : ''}${superscript(Math.abs(e))}`;
  return `${m.toFixed(2)}·10${es}`;
}
/** f(x) of a race function as text: the value when it is small, else from its logarithm (never overflows) */
function raceText(id: RaceId, x: number): string {
  const { sign } = raceLog(id, x);
  if (sign === 0) return '0';
  if (sign < 0) return num(raceValue(id, x), 4);
  return fromLog10(raceLog10(id, x));
}
const pair = (a: RaceId, b: RaceId, c: RaceId, d: RaceId) => (a === c && b === d) || (a === d && b === c);

const MODE_LABEL: Record<ExpMode, string> = {
  bases: 'חזקות ולוגריתמים',
  compound: 'ריבית דריבית',
  race: 'מרוץ גידול',
};
const MODE_ARIA: Record<ExpMode, string> = {
  bases: 'גרף של a בחזקת x ושל הלוגריתם בבסיס a, תמונות מראה זו של זו ביחס לישר y = x',
  compound: 'הנקודות של (1 + 1/n) בחזקת n מעל n בציר לוגריתמי, והישר y = e',
  race: 'גרפים של שתי פונקציות מתוך ln x, שורש x, x, x בריבוע, x בשלישית, x בעשירית, e בחזקת x, 2 בחזקת x ו-1.1 בחזקת x',
};

const TASK_LABEL: Record<string, string> = {
  'bases-below-one': `הקטינו את ${ltr('a')} מתחת ל-1. מה קורה לגרף של ${ltr('aˣ')}?`,
  'bases-e': `כוונו את ${ltr('a')} אל ${ltr('e ≈ 2.718')}, הבסיס של האקספוננט הטבעי ושל ${ltr('ln')}.`,
  'bases-log': `הדליקו את ${ltr('logₐ x')} והזיזו את ${ltr('a')}: איך הגרפים קשורים לישר ${ltr('y = x')}?`,
  'compound-far': `הגדילו את ${ltr('n')} עד ${ltr('1000')} לפחות. כמה קטן הפער עד ${ltr('e')}?`,
  'race-cross': `במרוץ בין ${ltr('x¹⁰')} ל-${ltr('eˣ')} העמידו את הסמן ליד נקודת החיתוך האחרונה. מה קורה אחריה?`,
  'race-log': `הדליקו ציר ערכים לוגריתמי: איך נראים הגרפים עכשיו?`,
  'race-ratio': `הדליקו את המנה והעמידו את הסמן במקום שבו המנה קטנה מ-${ltr('0.01')}.`,
};

/* ---------- tasks ---------- */

function cond(task: string, s: State, touched: Set<keyof State>): boolean {
  switch (task) {
    case 'bases-below-one':
      return s.mode === 'bases' && s.ba < 1 && touched.has('ba');
    case 'bases-e':
      return s.mode === 'bases' && Math.abs(s.ba - Math.E) <= 0.02 && touched.has('ba');
    case 'bases-log':
      return s.mode === 'bases' && s.log && touched.has('ba');
    case 'compound-far':
      return s.mode === 'compound' && s.n >= 1000 && touched.has('n');
    case 'race-cross':
      return s.mode === 'race' && pair(s.ra, s.rb, 'x10', 'exp') && Math.abs(s.x - CROSS_XC) <= 0.5 && touched.has('x');
    case 'race-log':
      return s.mode === 'race' && s.logY && touched.has('logY');
    case 'race-ratio': {
      if (s.mode !== 'race' || !s.ratio || !(touched.has('x') || touched.has('ratio'))) return false;
      const q = raceRatio(s.ra, s.rb, s.x);
      return q < 0.01;
    }
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
/** a filled dot (first function, the reader's point) or a hollow ring (second function, reference points) */
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
const inBox = (b: Box, px: number, py: number) => px >= b.x - 1 && px <= b.x + b.w + 1 && py >= b.y - 1 && py <= b.y + b.h + 1;

/** a plot whose x and y scales are equal (px per unit), centred on (cx, cy) */
function equalPlot(box: Box, cx: number, cy: number, unit: number): Plot {
  const hx = box.w / (2 * unit);
  const hy = box.h / (2 * unit);
  return makePlot(box, { min: cx - hx, max: cx + hx }, { min: cy - hy, max: cy + hy });
}

/** powers of ten as ticks of a log10 axis, thinned to at most `max` labels */
function expTicks(lo: number, hi: number, max = 7): number[] {
  const lo2 = Math.ceil(lo - 1e-9);
  const hi2 = Math.floor(hi + 1e-9);
  const stride = Math.max(1, Math.ceil((hi2 - lo2 + 1) / max));
  const out: number[] = [];
  for (let e = lo2; e <= hi2; e += stride) out.push(e);
  return out;
}
const tenPow = (e: number) => `10${e < 0 ? MINUS : ''}${superscript(Math.abs(e))}`;

const PAD = { l: 54, r: 14, t: 14, b: 44 };

/* ---------- bases ---------- */

function drawBases(ctx: CanvasRenderingContext2D, W: number, H: number, p: Palette, s: State) {
  const box = insetBox({ x: 0, y: 0, w: W, h: H }, PAD);
  const unit = Math.max(8, Math.min(box.w / 8, box.h / 6.5));
  const pl = equalPlot(box, 1, 0.75, unit);
  drawAxes(ctx, pl, p, { grid: true });
  seg(ctx, pl.px(0), box.y, pl.px(0), box.y + box.h, p.ink2, 1.2);
  seg(ctx, box.x, pl.py(0), box.x + box.w, pl.py(0), p.ink2, 1.2);
  ctx.save();
  clipTo(ctx, box);
  const lo = pl.x.min;
  const hi = pl.x.max;
  if (s.log) seg(ctx, pl.px(lo), pl.py(lo), pl.px(hi), pl.py(hi), p.ink3, 1.3, [5, 4]);
  ctx.restore();
  const a = s.ba;
  const nearE = Math.abs(a - Math.E) < 1e-9;
  if (!nearE) drawCurve(ctx, pl, (x) => Math.exp(x), { color: withAlpha(p.ink3, 0.55), width: 1.5, dash: [2, 4], samples: 240 });
  if (s.log) drawCurve(ctx, pl, (x) => logBase(a, x), { color: p.delta, width: 2.4, dash: [7, 4], samples: 400 });
  drawCurve(ctx, pl, (x) => powBase(a, x), { color: p.accent, width: 2.6, samples: 240 });
  ctx.save();
  clipTo(ctx, box);
  dot(ctx, pl.px(0), pl.py(1), true, p.accent, p, 5.5);
  text(ctx, '(0, 1)', pl.px(0) + 10, pl.py(1) - 10, p.accent, p, 'left', 12);
  if (s.log) {
    dot(ctx, pl.px(1), pl.py(0), true, p.delta, p, 5.5);
    text(ctx, '(1, 0)', pl.px(1) + 8, pl.py(0) + 14, p.delta, p, 'left', 12);
  }
  ctx.restore();
  // legend
  const lx = box.x + 10;
  let ly = box.y + 14;
  const entry = (label: string, color: string, dash: number[], wd: number) => {
    seg(ctx, lx, ly, lx + 26, ly, color, wd, dash);
    text(ctx, label, lx + 32, ly, color, p, 'left', 12);
    ly += 17;
  };
  entry(`a = ${num(a, 2)}:  y = aˣ`, p.accent, [], 2.6);
  if (s.log) entry('y = logₐ x', p.delta, [7, 4], 2.4);
  if (s.log) entry('y = x', p.ink3, [5, 4], 1.3);
  if (!nearE) entry('y = eˣ', withAlpha(p.ink3, 0.8), [2, 4], 1.5);
}

/* ---------- compound ---------- */

const COMP_Y: [number, number] = [1.9, 2.8];
function compoundPlot(W: number, H: number): Plot {
  const box = insetBox({ x: 0, y: 0, w: W, h: H }, PAD);
  return makePlot(
    box,
    { min: 1, max: 1e6, scale: 'log', label: 'n: כמה פעמים מחשבים ריבית בשנה' },
    { min: COMP_Y[0], max: COMP_Y[1], ticks: [2, 2.2, 2.4, 2.6, 2.8], format: (v) => num(v, 1) },
  );
}

function drawCompound(ctx: CanvasRenderingContext2D, W: number, H: number, p: Palette, s: State) {
  const pl = compoundPlot(W, H);
  const box = pl.box;
  drawAxes(ctx, pl, p, { grid: true });
  seg(ctx, box.x, pl.py(Math.E), box.x + box.w, pl.py(Math.E), p.limit, 2.2);
  text(ctx, 'y = e ≈ 2.71828', box.x + 8, pl.py(Math.E) - 11, p.limit, p, 'left', 12);
  drawCurve(ctx, pl, compoundTerm, { color: withAlpha(p.curve, 0.55), width: 1.5, samples: 300 });
  ctx.save();
  clipTo(ctx, box);
  for (let k = 0; k <= 6; k++) dot(ctx, pl.px(10 ** k), pl.py(compoundTerm(10 ** k)), true, p.curve, p, 3.8);
  const t = compoundTerm(s.n);
  const gx = pl.px(s.n);
  seg(ctx, gx, box.y, gx, box.y + box.h, p.ink3, 1, [3, 4]);
  seg(ctx, gx, pl.py(t), gx, pl.py(Math.E), p.eps, 4);
  dot(ctx, gx, pl.py(t), true, p.accent, p, 7);
  const right = gx > box.x + box.w * 0.6;
  text(ctx, `n = ${s.n}`, gx + (right ? -10 : 10), pl.py(t) + 18, p.accent, p, right ? 'right' : 'left', 12);
  ctx.restore();
}

/* ---------- race ---------- */

interface RaceLayout {
  top: Box;
  bottom: Box | null;
}
function raceLayout(W: number, H: number, ratio: boolean): RaceLayout {
  if (!ratio) return { top: insetBox({ x: 0, y: 0, w: W, h: H }, PAD), bottom: null };
  const h1 = H * 0.6;
  return {
    top: insetBox({ x: 0, y: 0, w: W, h: h1 }, { l: PAD.l, r: PAD.r, t: PAD.t, b: 26 }),
    bottom: insetBox({ x: 0, y: h1, w: W, h: H - h1 }, { l: PAD.l, r: PAD.r, t: 12, b: 40 }),
  };
}

/** the value window of the top panel: linear [lo, hi] or log10 [lo, hi] */
function raceWindow(s: State): { lo: number; hi: number } {
  const L = [s.ra, s.rb].map((id) => raceLog10(id, s.xmax));
  const finite = L.filter((v) => Number.isFinite(v));
  if (s.logY) {
    const top = finite.length ? Math.max(...finite) : 1;
    const hi = Math.ceil(Math.max(top, 1) + 0.15);
    return { lo: -2, hi };
  }
  const ends = [s.ra, s.rb].map((id) => raceValue(id, s.xmax));
  const smaller = Math.min(...ends.map((v) => (Number.isFinite(v) ? v : 1e300)));
  const hasLn = s.ra === 'ln' || s.rb === 'ln';
  const hi = clamp(smaller, 2, 1e300);
  return { lo: hasLn ? -Math.max(1, hi * 0.08) : 0, hi };
}

function raceTopPlot(box: Box, s: State): Plot {
  const w = raceWindow(s);
  const xAxis = { min: 0, max: s.xmax, label: 'x' };
  if (s.logY) {
    return makePlot(box, xAxis, { min: w.lo, max: w.hi, ticks: expTicks(w.lo, w.hi), format: (v) => tenPow(Math.round(v)) });
  }
  return makePlot(box, xAxis, { min: w.lo, max: w.hi });
}

function ratioWindow(s: State): { lo: number; hi: number } {
  let lo = 0;
  let hi = 0;
  for (let i = 0; i <= 120; i++) {
    const x = (s.xmax * i) / 120 || s.xmax / 240;
    const v = raceRatioLog10(s.ra, s.rb, x);
    if (Number.isFinite(v)) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  }
  lo = Math.floor(lo - 0.3);
  hi = Math.ceil(hi + 0.3);
  if (hi - lo < 2) hi = lo + 2;
  return { lo, hi };
}

function drawRace(ctx: CanvasRenderingContext2D, W: number, H: number, p: Palette, s: State) {
  const L = raceLayout(W, H, s.ratio);
  const pl = raceTopPlot(L.top, s);
  const box = pl.box;
  drawAxes(ctx, pl, p, { grid: true });
  const yOf = (id: RaceId) => (x: number) => (s.logY ? raceLog10(id, x) : raceValue(id, x));
  drawCurve(ctx, pl, yOf(s.rb), { color: p.delta, width: 2.4, dash: [7, 4], samples: 500 });
  drawCurve(ctx, pl, yOf(s.ra), { color: p.accent, width: 2.6, samples: 500 });
  ctx.save();
  clipTo(ctx, { x: box.x - 8, y: box.y - 8, w: box.w + 16, h: box.h + 16 });
  const cx = pl.px(s.x);
  seg(ctx, cx, box.y, cx, box.y + box.h, p.ink3, 1.2, [3, 4]);
  const ya = yOf(s.ra)(Math.max(s.x, 1e-9));
  const yb = yOf(s.rb)(Math.max(s.x, 1e-9));
  if (Number.isFinite(yb) && inBox(box, cx, pl.py(yb))) dot(ctx, cx, pl.py(yb), false, p.delta, p, 6);
  if (Number.isFinite(ya) && inBox(box, cx, pl.py(ya))) dot(ctx, cx, pl.py(ya), true, p.accent, p, 6);
  const c = lastCrossing(s.ra, s.rb, s.xmax);
  if (c !== null) {
    const yc = yOf(s.ra)(c);
    const sx = pl.px(c);
    seg(ctx, sx, box.y + box.h, sx, box.y + box.h - 10, p.ink, 2);
    if (Number.isFinite(yc) && inBox(box, sx, pl.py(yc))) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(sx, pl.py(yc), 10, 0, TAU);
      ctx.lineWidth = 2;
      ctx.strokeStyle = p.ink;
      ctx.stroke();
      ctx.restore();
    }
    text(ctx, `נקודת חיתוך אחרונה x ≈ ${num(c, 2)}`, clamp(sx, box.x + 70, box.x + box.w - 70), box.y + box.h - 22, p.ink, p, 'center', 11);
  } else {
    text(ctx, 'אין נקודת חיתוך בחלון', box.x + box.w - 8, box.y + 12, p.ink2, p, 'right', 11);
  }
  ctx.restore();
  // legend
  const lx = box.x + 10;
  let ly = box.y + 14;
  seg(ctx, lx, ly, lx + 26, ly, p.accent, 2.6);
  dot(ctx, lx + 13, ly, true, p.accent, p, 3.5);
  text(ctx, `y = ${RACE_LABEL[s.ra].text}`, lx + 32, ly, p.accent, p, 'left', 12);
  ly += 17;
  seg(ctx, lx, ly, lx + 26, ly, p.delta, 2.4, [7, 4]);
  dot(ctx, lx + 13, ly, false, p.delta, p, 3.5);
  text(ctx, `y = ${RACE_LABEL[s.rb].text}`, lx + 32, ly, p.delta, p, 'left', 12);

  if (L.bottom) {
    const rw = ratioWindow(s);
    const q = makePlot(
      L.bottom,
      { min: 0, max: s.xmax, label: 'x' },
      { min: rw.lo, max: rw.hi, ticks: expTicks(rw.lo, rw.hi, 5), format: (v) => tenPow(Math.round(v)) },
    );
    drawAxes(ctx, q, p, { grid: true });
    if (rw.lo < 0 && rw.hi > 0) seg(ctx, L.bottom.x, q.py(0), L.bottom.x + L.bottom.w, q.py(0), p.ink3, 1.3, [5, 4]);
    drawCurve(ctx, q, (x) => raceRatioLog10(s.ra, s.rb, Math.max(x, 1e-9)), { color: p.curve, width: 2.2, samples: 500 });
    const v = raceRatioLog10(s.ra, s.rb, Math.max(s.x, 1e-9));
    ctx.save();
    clipTo(ctx, { x: L.bottom.x - 8, y: L.bottom.y - 8, w: L.bottom.w + 16, h: L.bottom.h + 16 });
    seg(ctx, cx, L.bottom.y, cx, L.bottom.y + L.bottom.h, p.ink3, 1.2, [3, 4]);
    if (Number.isFinite(v)) dot(ctx, cx, q.py(v), true, p.accent, p, 5.5);
    text(ctx, `(${RACE_LABEL[s.ra].text}) / (${RACE_LABEL[s.rb].text})`, L.bottom.x + 10, L.bottom.y + 12, p.curve, p, 'left', 11);
    ctx.restore();
  }
}

/* ---------- readout ---------- */

function Row(p: { lab: string; math: string; strong?: boolean }) {
  return (
    <div class={`ex-row${p.strong ? ' strong' : ''}`}>
      <span class="ex-lab">{p.lab}</span>
      <span class="ex-math" dir="ltr">
        {p.math}
      </span>
    </div>
  );
}

function readoutFor(s: State): ComponentChildren {
  if (s.mode === 'bases') {
    const a = s.ba;
    const up = baseIncreases(a);
    return (
      <div class="ex-readout">
        <Row lab="הבסיס" math={`a = ${num(a, 3)}`} strong />
        <div class="ex-note">{up ? `${ltr('a > 1')}: הגרף של ${ltr('aˣ')} עולה.` : `${ltr('a < 1')}: הגרף של ${ltr('aˣ')} יורד.`}</div>
        <Row lab="נקודות קבועות" math={`a⁰ = 1,  a¹ = ${num(a, 3)},  logₐ 1 = 0`} />
        {s.log && <Row lab="הלוגריתם" math={`logₐ x = ln x / ln a,  ln a = ${num(Math.log(a), 3)}`} />}
        {s.log && <div class="ex-note">הגרף של הלוגריתם הוא תמונת המראה של הגרף של החזקה בישר y = x.</div>}
        {Math.abs(a - Math.E) <= 0.02 && <div class="ex-note">{`${ltr('a ≈ e')}: זה הבסיס המיוחד, והוא נקבע מחדש בהמשך השיעור.`}</div>}
      </div>
    );
  }
  if (s.mode === 'compound') {
    const t = compoundTerm(s.n);
    const g = compoundGap(s.n);
    return (
      <div class="ex-readout">
        <div class="ex-story">{`ריבית שנתית של ${ltr('100%')} על שקל אחד, כשמחשבים אותה ${ltr(String(s.n))} פעמים בשנה, בחלקים שווים.`}</div>
        <Row lab="הסכום בסוף השנה" math={`(1 + 1/${s.n})${superscript(s.n)} = ${t.toFixed(8)}`} strong />
        <Row lab="הפער עד e" math={`e − (1 + 1/n)ⁿ = ${g < 1e-3 ? g.toExponential(3).replace('e-', '·10⁻').replace('e+', '·10') : num(g, 5)}`} />
        {s.n >= 1000 && <div class="ex-note">{`${ltr('n ≥ 1000')}: הפער קטן מ-${ltr('0.002')}.`}</div>}
      </div>
    );
  }
  const c = lastCrossing(s.ra, s.rb, s.xmax);
  const q = raceRatioLog10(s.ra, s.rb, Math.max(s.x, 1e-9));
  const A = RACE_LABEL[s.ra].text;
  const B = RACE_LABEL[s.rb].text;
  return (
    <div class="ex-readout">
      <Row lab="הסמן" math={`x = ${num(s.x, 2)}`} strong />
      <Row lab="הראשונה" math={`${A} = ${raceText(s.ra, s.x)}`} />
      <Row lab="השנייה" math={`${B} = ${raceText(s.rb, s.x)}`} />
      {s.ratio && <Row lab="המנה" math={Number.isFinite(q) ? `(${A}) / (${B}) = ${fromLog10(q)}` : 'המנה אינה מוגדרת כאן'} />}
      <div class="ex-note">
        {c === null
          ? `בחלון ${ltr(`(0, ${s.xmax}]`)} אין נקודת חיתוך (בדיקה על רשת, לא הוכחה).`
          : `נקודת החיתוך האחרונה בחלון: ${ltr(`x ≈ ${num(c, 4)}`)} (בדיקה על רשת, לא הוכחה).`}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ the component */

export default function ExpLab(props: ExpLabProps) {
  const startMode: ExpMode = props.mode ?? 'bases';
  const modes: ExpMode[] = props.modes ?? [startMode];
  const showControls = props.controls !== false;
  const [s, setS] = useState<State>(() => initial(props));
  const cur = useRef(s);
  cur.current = s;
  const [live, setLive] = useState('');
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
        const mode: ExpMode = typeof st.mode === 'string' && (modes as string[]).includes(st.mode) ? (st.mode as ExpMode) : prev.mode;
        patch.mode = mode;
        if (mode === 'bases') {
          if (typeof st.a === 'number') patch.ba = clampBase(st.a);
          if (bl('log') !== undefined) patch.log = bl('log');
        } else if (mode === 'compound') {
          if (nm('n') !== undefined) patch.n = clamp(Math.round(nm('n')!), 1, 1e6);
        } else {
          if (isRaceId(st.a)) patch.ra = st.a;
          if (isRaceId(st.b)) patch.rb = st.b;
          const xmax = nm('xmax') !== undefined && (RACE_XMAX as readonly number[]).includes(nm('xmax')!) ? nm('xmax')! : prev.xmax;
          patch.xmax = xmax;
          patch.x = clamp(nm('x') ?? prev.x, 0, xmax);
          if (bl('logY') !== undefined) patch.logY = bl('logY');
          if (bl('ratio') !== undefined) patch.ratio = bl('ratio');
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
    if (s.mode === 'bases') drawBases(ctx, view.w, view.h, p, s);
    else if (s.mode === 'compound') drawCompound(ctx, view.w, view.h, p, s);
    else drawRace(ctx, view.w, view.h, p, s);
  };
  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 2, worldHeight: 1, animate: false });
  useEffect(invalidate, [s]);

  /* ---------- pointer and keyboard ---------- */
  const setN = (n: number) => userSet({ n: clamp(Math.round(n), 1, 1e6) });
  const setX = (x: number) => {
    const c = cur.current;
    userSet({ x: clamp(Math.round((x / c.xmax) * 500) / 500 * c.xmax, 0, c.xmax) });
  };
  const setLnA = (l: number) => {
    let v = Math.round(l * 100) / 100;
    if (Math.abs(v) < 0.005) v = cur.current.ba >= 1 ? -0.01 : 0.01;
    userSet({ ba: clampBase(Math.exp(clamp(v, LN_MIN, LN_MAX))) });
  };

  const moveTo = (e: PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const X = e.clientX - rect.left;
    const c = cur.current;
    if (c.mode === 'compound') {
      const pl = compoundPlot(rect.width, rect.height);
      setN(10 ** (6 * clamp((X - pl.box.x) / pl.box.w, 0, 1)));
    } else if (c.mode === 'race') {
      const L = raceLayout(rect.width, rect.height, c.ratio);
      setX(((X - L.top.x) / L.top.w) * c.xmax);
    }
  };
  const onPointerDown = (e: PointerEvent) => {
    if (cur.current.mode === 'bases') return;
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
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const big = e.shiftKey;
    if (c.mode === 'bases') setLnA(Math.log(c.ba) + d * (big ? 0.1 : 0.01));
    else if (c.mode === 'compound') setN(10 ** (Math.log10(c.n) + d * (big ? 0.5 : 0.05)));
    else setX(c.x + (d * c.xmax * (big ? 25 : 1)) / 500);
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
    if (s.mode === 'bases') {
      body = (
        <>
          <Slider
            label="a (סרגל לוגריתמי)"
            value={Math.round(Math.log(s.ba) * 100) / 100}
            min={LN_MIN}
            max={LN_MAX}
            step={0.01}
            format={() => num(s.ba, 3)}
            onChange={(v) => setLnA(v)}
          />
          <div class="ex-toggles">
            <Toggle label={`הציגו ${ltr('logₐ x')}`} on={s.log} onChange={(v) => userSet({ log: v })} />
          </div>
        </>
      );
    } else if (s.mode === 'compound') {
      body = (
        <Slider
          label="n (סרגל לוגריתמי)"
          value={Math.round(Math.log10(s.n) * 20) / 20}
          min={0}
          max={6}
          step={0.05}
          format={() => String(s.n)}
          onChange={(v) => setN(10 ** v)}
        />
      );
    } else {
      const sel = (label: string, key: 'ra' | 'rb') => (
        <label class="ex-select">
          <span class="ex-lab">{label}</span>
          <select
            dir="ltr"
            value={s[key]}
            onChange={(e) => {
              const v = (e.target as HTMLSelectElement).value;
              if (isRaceId(v)) userSet({ [key]: v } as Partial<State>);
            }}
          >
            {RACE_IDS.map((id) => (
              <option key={id} value={id}>
                {RACE_LABEL[id].text}
              </option>
            ))}
          </select>
        </label>
      );
      body = (
        <>
          <div class="ex-picks">
            {sel('הפונקציה הראשונה', 'ra')}
            {sel('הפונקציה השנייה', 'rb')}
          </div>
          <div class="group" role="group" aria-label="החלון">
            {RACE_XMAX.map((m) => (
              <Toggle
                key={m}
                label={<bdi dir="ltr">{`x ≤ ${m}`}</bdi>}
                on={s.xmax === m}
                onChange={() => userSet({ xmax: m, x: Math.min(cur.current.x, m) })}
              />
            ))}
          </div>
          <Slider label="x" value={s.x} min={0} max={s.xmax} step={s.xmax / 500} format={(v) => num(v, 2)} onChange={(v) => setX(v)} />
          <div class="ex-toggles">
            <Toggle label="ציר ערכים לוגריתמי" on={s.logY} onChange={(v) => userSet({ logY: v })} />
            <Toggle label="מנה (ראשונה חלקי שנייה)" on={s.ratio} onChange={(v) => userSet({ ratio: v })} />
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

  const aspect = s.mode === 'race' && s.ratio ? (narrow ? 0.85 : 1.25) : narrow ? 1.05 : 1.6;

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
      cursor={s.mode === 'bases' ? 'default' : 'ew-resize'}
      readout={readoutFor(s)}
      controls={controls}
    />
  );
}
