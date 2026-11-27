/**
 * DerivLab (chapter 5.1–5.2, the derivative at a point): three modes on one plot. Maths: src/math/derivative.ts, whose
 * stored facts (the exact f′, the domain, the kinks with their one-sided slopes) drive every verdict; nothing is
 * inferred from the table or the pixels. Canvases are math space and stay LTR; sliders for math quantities are
 * `dir="ltr"`. Colours: the function --curve, the tangent and f′ --limit (the secant tends to it), the secant and its
 * rise/run triangle --eps, the error Δy − dy and "no tangent" --delta. Shapes as well: the tangent solid, the secant
 * dashed, a point of the graph filled, a point of the tangent hollow. Nothing moves by itself (no animation).
 *
 * mode 'secant': the graph of f, P = (x0, f(x0)) (filled circle, drag it along the graph) and Q = (x0 + h, f(x0 + h))
 *                (filled square, drag it too); the secant PQ dashed across the window with its rise/run triangle (legs
 *                h and Δy). |h| by a log slider from 2 down to 10⁻⁴ and the side switch "מימין / משמאל" (the sign of
 *                h). A table under the canvas: one row per power of 10 that |h| has passed, plus the current h (a probe).
 *                With `tangent`: the tangent at P solid, its exact slope f′(x0); "אין משיק" at a corner; a vertical solid
 *                line at a vertical tangent.
 * mode 'zoom':   the graph in a window centred on P, both axes shrunk by the zoom factor z ∈ [1, 1000] (log slider;
 *                the aspect is kept, so slopes keep their look). With `tangent`, the tangent through P. The verdict
 *                comes from the registry: "נראה כמו ישר" for z ≥ 50 at a differentiable point, "פינה" / "משיק אנכי" at a
 *                kink at any z.
 * mode 'linear': f, the point a, the tangent L(x) = f(a) + f′(a)(x − a) solid; a step dx (slider over the window,
 *                negative allowed, never 0); at x = a + dx the point of the curve (filled) and of the tangent (hollow),
 *                the legs dy (on the tangent, --limit, solid) and Δy (on the curve, --curve, dashed) and their gap, the
 *                error, as a --delta bracket. `zoomErr` adds an inset that magnifies the neighbourhood of a (both axes
 *                by the same factor, chosen so that dx fills half the inset): as dx shrinks the curve and the tangent
 *                merge there, i.e. (Δy − dy)/dx → 0.
 *
 * Props (defaults): id (required); mode ('secant'); modes (the mode buttons shown; default the starting mode only);
 * fns (the function buttons shown; default none: the function changes only by steps); tasks ([]). f ('x2'), x0 (the
 * entry's default: x2 3, x3 5, recip 1, sqrt 1, abs 0, cbrt 0, kink 1, glue 1, sin 0, exp 0, cubic 2), h (1; signed,
 * 10⁻⁴ ≤ |h| ≤ 2), tangent (false), zoom (1; 1 ≤ z ≤ 1000), a (the entry's default, as x0), dx (1, clamped into the
 * window), zoomErr (false).
 * Every prop except id / modes / fns / tasks is also a step key (`<Step fig=… set={{…}}>`); a key left out keeps its
 * value; a new `f` without `x0` / `a` moves P and a to the entry's default. x0 and a are clamped into the entry's
 * x0Range and snapped onto a kink within 0.05 (so "at the kink" is exact). A state set by a step never ticks a task,
 * and a state that already had a task's property when a step or reset made it must be left and found again.
 *
 * Learner input: drag P or Q (secant), the point a or the end point a + dx (linear); sliders; the side switch; the
 * toggles; on the focused canvas ←/→ move P (secant, zoom) or a (linear) by 0.01 (Shift: 0.1), ↑/↓ change |h| by a
 * twentieth of a decade (secant), the zoom (zoom), dx by 0.01 (linear).
 *
 * Readouts (data-readout): secant: fn, x0, h, quotient, table, slope (with tangent); zoom: fn, x0, zoom, verdict,
 * slope (with tangent); linear: fn, a, dx, fx, L, Dy, dy, err, ratio. Negative numbers use U+2212.
 *
 * Tasks (ticked only inside the learner's own drag, key, slider, button or toggle):
 *   secant: secant-close (0 < |h| ≤ 10⁻³), secant-sides (f abs or kink, x0 at the kink, both signs of h had with
 *           |h| ≤ 10⁻² since f or x0 last changed), secant-steep (f cbrt, x0 at 0, |h| ≤ 10⁻³)
 *   zoom:   zoom-straight (z ≥ 100 at a differentiable point), zoom-corner (z ≥ 100 at a corner)
 *   linear: linear-small (0 < |dx| ≤ 0.1 where the tangent exists), linear-cross (f cubic, a = 2, dx within 0.05 of −6)
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import {
  DFN,
  H_MAX,
  H_MIN,
  clampH,
  differentiableAt,
  inDomain,
  isDId,
  kinkAt,
  linearize,
  quotientAt,
  secantRows,
  snapX0,
  tangentAt,
  type DId,
  type DSpec,
} from '~/math/derivative';
import { markTask } from '~/progress/store';
import { subscribeSteps, type StepState } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { sci } from './core/format';
import { withAlpha } from './core/ink';
import { drawAxes, insetBox, makePlot, niceTicks, type Box, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import './DerivLab.css';

export type DerivMode = 'secant' | 'zoom' | 'linear';

export interface DerivLabProps {
  id: string;
  mode?: DerivMode;
  /** the mode buttons shown (default: the starting mode only) */
  modes?: DerivMode[];
  /** the function buttons shown (default: none) */
  fns?: DId[];
  f?: DId;
  x0?: number;
  h?: number;
  tangent?: boolean;
  zoom?: number;
  a?: number;
  dx?: number;
  zoomErr?: boolean;
  tasks?: string[];
}

interface Setup {
  mode: DerivMode;
  f: DId;
  x0: number;
  h: number;
  tangent: boolean;
  zoom: number;
  a: number;
  dx: number;
  zoomErr: boolean;
  /** the signs of h the learner has had with |h| ≤ 10⁻² since f or x0 last changed: bit 1 right, bit 2 left */
  sides: number;
}

const ltr = (s: string) => String.fromCharCode(0x2066) + s.replace(/ /g, String.fromCharCode(0xa0)) + String.fromCharCode(0x2069);

const TASK_LABEL: Record<string, string> = {
  'secant-close': `הקטינו את ${ltr('|h|')} עד ${ltr('10⁻³')} או פחות. לאיזה מספר מתקרב שיפוע המיתר?`,
  'secant-sides': `בפונקציה עם פינה, כש-P בפינה, הקטינו את ${ltr('|h|')} עד ${ltr('10⁻²')} או פחות ונסו את שני הצדדים. האם המיתרים מימין ומשמאל מתקרבים לאותו שיפוע?`,
  'secant-steep': `ב-${ltr('∛x')} עם P בראשית הקטינו את ${ltr('|h|')} עד ${ltr('10⁻³')} או פחות. מה קורה לשיפוע המיתר?`,
  'zoom-straight': 'בנקודה שבה הפונקציה גזירה הגדילו פי 100 או יותר. איך נראה הגרף ליד P?',
  'zoom-corner': 'בנקודת פינה הגדילו פי 100 או יותר. האם הפינה נעלמת?',
  'linear-small': `הקטינו את ${ltr('|dx|')} עד ${ltr('0.1')} או פחות. השוו את השגיאה לגודל הצעד.`,
  'linear-cross': `ב-${ltr('x³ − 3x')} עם ${ltr('a = 2')} הזיזו את dx לערך שבו המשיק פוגש שוב את הגרף.`,
};

/** mode buttons; no label contains another button's name ("משיק", "מימין", "משמאל"), so e2e name lookups stay unique */
const MODE_LABEL: Record<DerivMode, string> = { secant: 'מיתר', zoom: 'הגדלה', linear: 'קירוב לינארי' };

const TAU = 2 * Math.PI;
/** the |h| slider runs over e = −log10|h| ∈ [−0.3, 4]; its left end is |h| = 2 */
const E_MIN = -0.3;
const E_MAX = 4;
const E_STEP = 0.05;
/** the zoom slider runs over log10 z ∈ [0, 3] */
const Z_STEP = 0.05;
const KINK_TOL = 0.01;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const bool = (x: unknown): boolean | null => (typeof x === 'boolean' ? x : null);
const roundTo = (x: number, step: number) => Number((Math.round(x / step) * step).toPrecision(10));
const minus = (s: string) => s.replace(/-/g, '−');
const fmt = (x: number, sig = 6) => (Number.isNaN(x) ? '—' : !Number.isFinite(x) ? (x > 0 ? '∞' : '−∞') : Math.abs(x) < 1e-13 ? '0' : minus(sci(x, sig)));
const absHOfE = (e: number) => (e <= E_MIN + 1e-9 ? H_MAX : 10 ** -e);
const eOfAbsH = (ah: number) => clamp(-Math.log10(ah), E_MIN, E_MAX);
const SUP_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const fmtAbsH = (ah: number) => {
  const e = -Math.log10(ah);
  if (Math.abs(e - Math.round(e)) > 1e-9) return fmt(ah, 2);
  const n = Math.round(e);
  return n === 0 ? '1' : '10⁻' + String(n).replace(/\d/g, (d) => SUP_DIGITS[Number(d)]);
};
const fmtH = (h: number) => (h < 0 ? '−' : '') + fmtAbsH(Math.abs(h));
const clampZ = (z: number) => clamp(z, 1, 1000);
const fmtZ = (z: number) => (z >= 10 ? String(Math.round(z)) : minus(sci(z, 2)));

function fixDx(sp: DSpec, a: number, dx: number, prevSign = 1): number {
  const lo = Math.ceil((sp.window.x[0] - a) * 100 - 1e-6) / 100;
  const hi = Math.floor((sp.window.x[1] - a) * 100 + 1e-6) / 100;
  let v = clamp(roundTo(dx, 0.01), lo, hi);
  if (Math.abs(v) < 0.005) v = (dx < 0 || (dx === 0 && prevSign < 0)) && lo <= -0.01 ? -0.01 : 0.01;
  return v;
}
/** a step's or a prop's dx: clamped into the window, not rounded */
function fixDxExact(sp: DSpec, a: number, dx: number): number {
  const v = clamp(dx, sp.window.x[0] - a, sp.window.x[1] - a);
  return Math.abs(v) < 1e-6 ? 0.01 : v;
}

const kinkKind = (s: Setup, x: number) => kinkAt(s.f, x, KINK_TOL)?.kind ?? null;

/* ---- tasks: `needs` = the learner's change must touch one of these keys; `event` tasks tick on the learner's act, the
 * others must be left and found again after a step or reset made the state */
interface Rule {
  needs: (keyof Setup)[];
  event?: boolean;
  state: (s: Setup) => boolean;
}
const RULES: Record<string, Rule> = {
  'secant-close': { needs: ['h'], state: (s) => s.mode === 'secant' && Math.abs(s.h) <= 1e-3 * (1 + 1e-9) },
  'secant-sides': {
    needs: ['h'],
    event: true,
    state: (s) => s.mode === 'secant' && (s.f === 'abs' || s.f === 'kink') && kinkKind(s, s.x0) === 'corner' && s.sides === 3,
  },
  'secant-steep': {
    needs: ['h', 'x0', 'f'],
    state: (s) => s.mode === 'secant' && s.f === 'cbrt' && Math.abs(s.x0) <= KINK_TOL && Math.abs(s.h) <= 1e-3 * (1 + 1e-9),
  },
  'zoom-straight': { needs: ['zoom', 'x0', 'f'], state: (s) => s.mode === 'zoom' && s.zoom >= 100 - 1e-9 && differentiableAt(s.f, s.x0) },
  'zoom-corner': { needs: ['zoom', 'x0', 'f'], state: (s) => s.mode === 'zoom' && s.zoom >= 100 - 1e-9 && kinkKind(s, s.x0) === 'corner' },
  'linear-small': { needs: ['dx'], state: (s) => s.mode === 'linear' && Math.abs(s.dx) > 0 && Math.abs(s.dx) <= 0.1 * (1 + 1e-9) && differentiableAt(s.f, s.a) },
  'linear-cross': { needs: ['dx', 'a'], state: (s) => s.mode === 'linear' && s.f === 'cubic' && Math.abs(s.a - 2) < 0.005 && Math.abs(s.dx + 6) <= 0.05 + 1e-9 },
};

/* ---- canvas helpers */
function haloText(ctx: CanvasRenderingContext2D, p: Palette, s: string, x: number, y: number, o: { font: string; color?: string; align?: CanvasTextAlign; base?: CanvasTextBaseline; rtl?: boolean }) {
  ctx.save();
  ctx.direction = o.rtl ? 'rtl' : 'ltr';
  ctx.font = o.font;
  ctx.textAlign = o.align ?? 'center';
  ctx.textBaseline = o.base ?? 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = withAlpha(p.paper, 0.9);
  ctx.strokeText(s, x, y);
  ctx.fillStyle = o.color ?? p.ink;
  ctx.fillText(s, x, y);
  ctx.restore();
}
function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width = 1.5, dash: number[] = []) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}
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
function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, paper: string, width = 2.2) {
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
  ctx.beginPath();
  ctx.rect(x - r, y - r, 2 * r, 2 * r);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
function triangle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, up: boolean, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + (up ? -r : r));
  ctx.lineTo(x - r, y + (up ? r : -r));
  ctx.lineTo(x + r, y + (up ? r : -r));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
function clipTo(ctx: CanvasRenderingContext2D, b: Box) {
  ctx.beginPath();
  ctx.rect(b.x, b.y, b.w, b.h);
  ctx.clip();
}

/** tick labels with as many decimals as the tick step needs (a zoomed window has ticks 4.998, 5, 5.002) */
function axisOf(min: number, max: number, label: string) {
  const ticks = niceTicks(min, max);
  const step = ticks.length > 1 ? ticks[1] - ticks[0] : Math.abs(max - min) || 1;
  const dec = clamp(Math.ceil(-Math.log10(step) - 1e-9), 0, 8);
  return { min, max, label, ticks, format: (v: number) => minus((Math.abs(v) < step * 1e-6 ? 0 : v).toFixed(dec)) };
}

/** the x values of one piece of the domain inside [lo, hi], dense towards an open finite end (a pole), with the kinks */
function samplesOf(sp: DSpec, lo: number, hi: number, n: number): number[][] {
  const out: number[][] = [];
  for (const I of sp.domain) {
    const l = Math.max(I.lo, lo);
    const h = Math.min(I.hi, hi);
    if (!(h > l)) continue;
    const nearLo = !I.loClosed && Number.isFinite(I.lo) && l === I.lo;
    const nearHi = !I.hiClosed && Number.isFinite(I.hi) && h === I.hi;
    const xs: number[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      let x = nearLo ? l + (h - l) * t * t : nearHi ? h - (h - l) * (1 - t) * (1 - t) : l + (h - l) * t;
      if (nearLo && x - l < 1e-9 * Math.max(1, h - l)) x = l + 1e-9 * Math.max(1, h - l);
      if (nearHi && h - x < 1e-9 * Math.max(1, h - l)) x = h - 1e-9 * Math.max(1, h - l);
      xs.push(x);
    }
    for (const k of sp.kinks) if (k.x > l && k.x < h) xs.push(k.x);
    xs.sort((a, b) => a - b);
    out.push(xs);
  }
  return out;
}

/** the graph of f clipped to the plot box, never joined across a gap of the domain */
function drawGraph(ctx: CanvasRenderingContext2D, plot: Plot, sp: DSpec, color: string, width: number) {
  const [y0, y1] = [plot.y.min, plot.y.max];
  const span = y1 - y0;
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.box.x, plot.box.y - 2, plot.box.w, plot.box.h + 4);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  for (const xs of samplesOf(sp, plot.x.min, plot.x.max, 600)) {
    ctx.beginPath();
    let started = false;
    for (const x of xs) {
      const v = sp.f(x);
      if (!Number.isFinite(v)) {
        started = false;
        continue;
      }
      const sx = plot.px(x);
      const sy = plot.py(clamp(v, y0 - 3 * span, y1 + 3 * span));
      if (started) ctx.lineTo(sx, sy);
      else ctx.moveTo(sx, sy);
      started = true;
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** the line through (x0, y0) with slope m across the plot, clipped */
function drawLineThrough(ctx: CanvasRenderingContext2D, plot: Plot, x0: number, y0: number, m: number, color: string, width: number, dash: number[] = []) {
  const { min, max } = plot.x;
  ctx.save();
  clipTo(ctx, plot.box);
  line(ctx, plot.px(min), plot.py(y0 + m * (min - x0)), plot.px(max), plot.py(y0 + m * (max - x0)), color, width, dash);
  ctx.restore();
}

export default function DerivLab(props: DerivLabProps) {
  const startMode: DerivMode = props.mode ?? 'secant';
  const modes: DerivMode[] = props.modes ?? [startMode];
  const fns: DId[] = (props.fns ?? []).filter(isDId);
  const initial = (): Setup => {
    const f: DId = isDId(props.f) ? props.f : 'x2';
    const sp = DFN[f];
    const a = snapX0(f, props.a ?? sp.x0, false);
    return {
      mode: startMode,
      f,
      x0: snapX0(f, props.x0 ?? sp.x0, false),
      h: clampH(props.h ?? 1),
      tangent: props.tangent ?? false,
      zoom: clampZ(props.zoom ?? 1),
      a,
      dx: fixDxExact(sp, a, props.dx ?? 1),
      zoomErr: props.zoomErr ?? false,
      sides: 0,
    };
  };
  const [setup, setSetup] = useState<Setup>(initial);
  const cur = useRef(setup);
  const [live, setLive] = useState('');
  const [narrow, setNarrow] = useState(false);
  const plotRef = useRef<Plot | null>(null);
  const drag = useRef<'P' | 'Q' | 'a' | 'dx' | null>(null);
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
        const mode = typeof st.mode === 'string' && (['secant', 'zoom', 'linear'] as string[]).includes(st.mode) ? (st.mode as DerivMode) : prev.mode;
        const f: DId = isDId(st.f) ? st.f : prev.f;
        const sp = DFN[f];
        const newF = f !== prev.f;
        const x0 = num(st.x0);
        const a = num(st.a);
        const h = num(st.h);
        const z = num(st.zoom);
        const dx = num(st.dx);
        const next: Setup = { ...prev, mode, f, sides: 0 };
        next.x0 = snapX0(f, x0 ?? (newF ? sp.x0 : prev.x0), false);
        next.a = snapX0(f, a ?? (newF ? sp.x0 : prev.a), false);
        if (h !== null && h !== 0) next.h = clampH(h);
        if (z !== null) next.zoom = clampZ(z);
        next.dx = fixDxExact(sp, next.a, dx ?? prev.dx);
        next.tangent = bool(st.tangent) ?? prev.tangent;
        next.zoomErr = bool(st.zoomErr) ?? prev.zoomErr;
        commit(next);
        rebase(next);
      }),
    [props.id],
  );

  const s0 = setup;
  const sp0 = DFN[s0.f];

  /* ---------------------------------------------------------------- drawing */
  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    const nar = view.w < 520;
    const fs = nar ? 12 : 13;
    const font = (w8: number, size = fs, it = false) => `${it ? 'italic ' : ''}${w8} ${size}px ${p.fontUi}`;
    const sp = sp0;
    const f = sp.f;
    let xr: [number, number] = sp.window.x;
    let yr: [number, number] = sp.window.y;
    if (s0.mode === 'zoom') {
      const wx = (sp.window.x[1] - sp.window.x[0]) / s0.zoom;
      const wy = (sp.window.y[1] - sp.window.y[0]) / s0.zoom;
      const cy = f(s0.x0);
      xr = [s0.x0 - wx / 2, s0.x0 + wx / 2];
      yr = [cy - wy / 2, cy + wy / 2];
    }
    // the y-axis name sits left of the widest tick label (drawAxes puts it at a fixed offset, where a zoomed window's
    // long labels such as "−0.010" run into it): no name for drawAxes, a margin measured from the labels, our own name
    const yAxis = axisOf(yr[0], yr[1], '');
    ctx.save();
    ctx.font = `11px ${p.fontUi}`;
    const tickW = Math.max(0, ...yAxis.ticks.map((v) => ctx.measureText(yAxis.format(v)).width));
    ctx.restore();
    const box = insetBox({ x: 0, y: 0, w: view.w, h: view.h }, { l: Math.max(40, Math.ceil(tickW) + 26), r: 14, t: nar ? 26 : 16, b: 38 });
    const plot = makePlot(box, axisOf(xr[0], xr[1], 'x'), yAxis);
    plotRef.current = plot;
    drawAxes(ctx, plot, p);
    haloText(ctx, p, 'y', box.x - tickW - 16, box.y + box.h / 2, { font: `600 12px ${p.fontUi}` });
    const PX = plot.px;
    const PY = plot.py;
    const inBox = (sx: number, sy: number) => sx >= box.x - 1 && sx <= box.x + box.w + 1 && sy >= box.y - 1 && sy <= box.y + box.h + 1;
    const edgeMark = (sx: number, sy: number, color: string) => {
      const up = sy < box.y;
      triangle(ctx, clamp(sx, box.x + 8, box.x + box.w - 8), up ? box.y + 9 : box.y + box.h - 9, 6, up, color);
    };
    /**
     * "אין משיק" next to the point (xw, f(xw)) at screen (sx, sy): on the side of the point away from the graph (below a
     * corner that opens upwards, above one that opens downwards), clear of the labels P and Q, shifted horizontally by
     * `shift` px (secant mode: towards Q, since the dashed secant leaves P on the other side).
     */
    const noTangent = (xw: number, sx: number, sy: number, text: string, shift = 0) => {
      const d = (plot.x.max - plot.x.min) / 20;
      const fl = f(xw - d);
      const fr = f(xw + d);
      const y0 = f(xw);
      const graphAbove = (Number.isFinite(fl) ? fl - y0 : 0) + (Number.isFinite(fr) ? fr - y0 : 0) >= 0;
      const ty = graphAbove ? sy + 30 : sy - 30;
      haloText(ctx, p, text, clamp(sx + shift, box.x + 50, box.x + box.w - 50), clamp(ty, box.y + 12, box.y + box.h - 12), { font: font(700), color: p.delta, rtl: true });
    };

    /** the tangent at x (solid, --limit), or a vertical line, or the words "אין משיק" */
    const tangentLine = (pl: Plot, x: number) => {
      const t = tangentAt(s0.f, x);
      if (t === null) return false;
      if (t.vertical) {
        ctx.save();
        clipTo(ctx, pl.box);
        line(ctx, pl.px(x), pl.box.y, pl.px(x), pl.box.y + pl.box.h, p.limit, 2.4);
        ctx.restore();
      } else drawLineThrough(ctx, pl, x, f(x), t.m, p.limit, 2.4);
      return true;
    };

    if (s0.mode === 'secant' || s0.mode === 'zoom') {
      drawGraph(ctx, plot, sp, p.curve, 2.6);
      const x0 = s0.x0;
      const y0 = f(x0);
      const sxP = PX(x0);
      const syP = PY(y0);
      if (s0.mode === 'secant') {
        const xq = x0 + s0.h;
        const yq = f(xq);
        const q = quotientAt(s0.f, x0, s0.h);
        if (Number.isFinite(q)) {
          // the rise/run triangle P → (x0 + h, f(x0)) → Q, then the secant across the window (dashed)
          const sxC = PX(xq);
          const syQ = PY(yq);
          ctx.save();
          clipTo(ctx, box);
          ctx.fillStyle = p.epsBand;
          ctx.beginPath();
          ctx.moveTo(sxP, syP);
          ctx.lineTo(sxC, syP);
          ctx.lineTo(sxC, syQ);
          ctx.closePath();
          ctx.fill();
          line(ctx, sxP, syP, sxC, syP, p.eps, 1.6);
          line(ctx, sxC, syP, sxC, syQ, p.eps, 1.6);
          ctx.restore();
          drawLineThrough(ctx, plot, x0, y0, q, p.eps, 2, [7, 5]);
          if (Math.abs(sxC - sxP) > 22 && inBox((sxP + sxC) / 2, syP)) {
            haloText(ctx, p, 'h', (sxP + sxC) / 2, syP + (syQ < syP ? 12 : -12), { font: font(700, fs, true), color: p.eps });
          }
          if (Math.abs(syQ - syP) > 22 && inBox(sxC, (syP + syQ) / 2)) {
            haloText(ctx, p, 'Δy', sxC + (sxC >= sxP ? 16 : -16), (syP + syQ) / 2, { font: font(700, fs, true), color: p.eps });
          }
        }
        if (s0.tangent && !tangentLine(plot, x0) && inDomain(s0.f, x0)) noTangent(x0, sxP, syP, 'אין משיק', s0.h > 0 ? 36 : -36);
        // Q (filled square), then P (filled circle) on top
        if (Number.isFinite(yq)) {
          const sxQ = PX(xq);
          const syQ = PY(yq);
          if (inBox(sxQ, syQ)) {
            square(ctx, sxQ, syQ, 5, p.eps, p.paper);
            if (Math.abs(sxQ - sxP) > 14 || Math.abs(syQ - syP) > 14) haloText(ctx, p, 'Q', sxQ + 12, syQ - 12, { font: font(700), color: p.eps });
          } else edgeMark(sxQ, syQ, p.eps);
        }
        dot(ctx, sxP, syP, 6, p.curve, p.paper);
        haloText(ctx, p, 'P', sxP - 12, syP - 13, { font: font(700), color: p.curve });
      } else {
        if (s0.tangent && !tangentLine(plot, x0)) noTangent(x0, sxP, syP, 'אין משיק');
        dot(ctx, sxP, syP, 6, p.curve, p.paper);
        haloText(ctx, p, 'P', sxP - 12, syP - 13, { font: font(700), color: p.curve });
        haloText(ctx, p, `×${fmtZ(s0.zoom)}`, box.x + 8, box.y + 12, { font: font(700), color: p.ink2, align: 'left' });
      }
      return;
    }

    // ---- linear
    const inBox2 = (pl: Plot, sx: number, sy: number) => sx >= pl.box.x - 1 && sx <= pl.box.x + pl.box.w + 1 && sy >= pl.box.y - 1 && sy <= pl.box.y + pl.box.h + 1;
    /** the picture of the linear approximation on a plot: tangent, run, legs dy and Δy, the error, the points */
    const scene = (pl: Plot, labels: boolean) => {
      const a = s0.a;
      const fa = f(a);
      const X = a + s0.dx;
      const lin = linearize(s0.f, a, s0.dx);
      const hasT = Number.isFinite(lin.L);
      const sxA = pl.px(a);
      const syA = pl.py(fa);
      const sxX = pl.px(X);
      const syBase = pl.py(fa);
      ctx.save();
      clipTo(ctx, pl.box);
      // the run dx (dashed, ink)
      line(ctx, sxA, syA, sxX, syBase, withAlpha(p.ink2, 0.9), 1.3, [4, 4]);
      if (hasT) {
        const syL = pl.py(lin.L);
        const syF = pl.py(lin.fx);
        const off = 4;
        // dy: on the tangent, solid --limit; Δy: on the curve, dashed --curve; the gap: a --delta bracket
        line(ctx, sxX - off, syBase, sxX - off, syL, p.limit, 3);
        line(ctx, sxX + off, syBase, sxX + off, syF, p.curve, 3, [5, 3]);
        const bx = sxX + off + 9;
        line(ctx, bx, syL, bx, syF, p.delta, 4);
        line(ctx, bx - 5, syL, bx + 5, syL, p.delta, 2);
        line(ctx, bx - 5, syF, bx + 5, syF, p.delta, 2);
      }
      ctx.restore();
      if (hasT) {
        const syL = pl.py(lin.L);
        const syF = pl.py(lin.fx);
        if (labels) {
          if (Math.abs(sxX - sxA) > 24) haloText(ctx, p, 'dx', (sxA + sxX) / 2, syBase + (syL < syBase ? 12 : -12), { font: font(700, fs, true), color: p.ink2 });
          if (Math.abs(syL - syBase) > 22) haloText(ctx, p, 'dy', sxX - 10, (syBase + syL) / 2, { font: font(700, fs, true), color: p.limit, align: 'right' });
          if (Math.abs(syF - syBase) > 22) haloText(ctx, p, 'Δy', sxX + 24, (syBase + syF) / 2 + (Math.abs(syL - syF) > 30 ? 0 : 14), { font: font(700, fs, true), color: p.curve, align: 'left' });
        }
        if (inBox2(pl, sxX, syL)) ring(ctx, sxX, syL, 5, p.limit, p.paper);
        if (inBox2(pl, sxX, syF)) dot(ctx, sxX, syF, 5.5, p.curve, p.paper);
      } else {
        const syF = pl.py(lin.fx);
        if (Number.isFinite(lin.fx) && inBox2(pl, sxX, syF)) dot(ctx, sxX, syF, 5.5, p.curve, p.paper);
      }
      if (inBox2(pl, sxA, syA)) dot(ctx, sxA, syA, 6, p.curve, p.paper);
      if (labels) haloText(ctx, p, 'a', sxA, pl.box.y + pl.box.h - 9, { font: font(700, fs, true), color: p.ink2 });
    };

    drawGraph(ctx, plot, sp, p.curve, 2.6);
    const hasTangent = tangentLine(plot, s0.a);
    if (!hasTangent) noTangent(s0.a, PX(s0.a), PY(f(s0.a)), 'אין משיק ב-a');
    scene(plot, true);

    if (s0.zoomErr && differentiableAt(s0.f, s0.a)) {
      // the inset: both axes magnified by the same factor about the middle of the step, dx filling half of it
      const Wx = sp.window.x[1] - sp.window.x[0];
      const Wy = sp.window.y[1] - sp.window.y[0];
      const frac = nar ? 0.46 : 0.4;
      const iw = box.w * frac;
      const ih = box.h * frac;
      const mag = Math.max(1, (frac * Wx) / (2 * Math.abs(s0.dx)));
      const wx = (Wx * frac) / mag;
      const wy = (Wy * frac) / mag;
      const lin = linearize(s0.f, s0.a, s0.dx);
      const cx = s0.a + s0.dx / 2;
      const cy = f(s0.a) + lin.dy / 2;
      // the corner that hides the least of the picture: score each by the samples of the curve and the tangent it would
      // cover, and (heavily) the points a, a + dx on both and the label "a"; ties go to the corner farthest from a
      const ax = PX(s0.a);
      const ay = PY(f(s0.a));
      const X = s0.a + s0.dx;
      const m = sp.df(s0.a);
      const marks: [number, number, number][] = [
        [ax, ay, 40],
        [PX(X), PY(lin.fx), 40],
        [PX(X), PY(lin.L), 40],
        [ax, box.y + box.h - 9, 20],
      ];
      for (let i = 0; i <= 240; i++) {
        const x = plot.x.min + ((plot.x.max - plot.x.min) * i) / 240;
        const v = f(x);
        // hiding the curve (say, where √x starts) is worse than hiding a stretch of the tangent
        if (Number.isFinite(v)) marks.push([PX(x), PY(v), 2]);
        marks.push([PX(x), PY(f(s0.a) + m * (x - s0.a)), 1]);
      }
      // the bottom corners stay above the row of the label "a"
      const corners: [number, number][] = [
        [box.x + 8, box.y + 8],
        [box.x + box.w - iw - 8, box.y + 8],
        [box.x + 8, box.y + box.h - ih - 22],
        [box.x + box.w - iw - 8, box.y + box.h - ih - 22],
      ];
      const pad = 6;
      let best = corners[0];
      let bestScore = Infinity;
      let bd = -1;
      for (const c of corners) {
        let score = 0;
        for (const [mx, my, w] of marks) if (mx >= c[0] - pad && mx <= c[0] + iw + pad && my >= c[1] - pad && my <= c[1] + ih + pad) score += w;
        const d = Math.hypot(c[0] + iw / 2 - ax, c[1] + ih / 2 - ay);
        if (score < bestScore || (score === bestScore && d > bd)) [best, bestScore, bd] = [c, score, d];
      }
      const ib: Box = { x: best[0], y: best[1], w: iw, h: ih };
      const ipl = makePlot(ib, { min: cx - wx / 2, max: cx + wx / 2 }, { min: cy - wy / 2, max: cy + wy / 2 });
      ctx.save();
      ctx.fillStyle = p.paper;
      ctx.fillRect(ib.x, ib.y, ib.w, ib.h);
      ctx.strokeStyle = p.ink3;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(ib.x, ib.y, ib.w, ib.h);
      ctx.restore();
      drawGraph(ctx, ipl, sp, p.curve, 2.2);
      tangentLine(ipl, s0.a);
      scene(ipl, false);
      haloText(ctx, p, `×${fmtZ(mag)}`, ib.x + 6, ib.y + 11, { font: font(700, fs - 1), color: p.ink2, align: 'left' });
    }
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1.6, worldHeight: 1, animate: false });
  useEffect(invalidate, [setup, narrow]);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const upd = () => setNarrow(el.getBoundingClientRect().width < 520);
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const aspect = narrow ? 0.95 : 1.45;

  /* ---------------------------------------------------------------- learner changes */
  /** The learner changed the figure: apply, then tick whatever the new state completes. */
  const apply = (patch: Partial<Setup>) => {
    const prev = cur.current;
    const next: Setup = { ...prev, ...patch };
    if (next.f !== prev.f || next.x0 !== prev.x0) next.sides = 0;
    if ('h' in patch && Math.abs(next.h) <= 1e-2 * (1 + 1e-9)) next.sides |= next.h > 0 ? 1 : 2;
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

  const setX0 = (x: number) => {
    const c = cur.current;
    const nx = snapX0(c.f, x);
    if (nx !== c.x0) apply({ x0: nx });
  };
  const setA = (x: number) => {
    const c = cur.current;
    const na = snapX0(c.f, x);
    if (na !== c.a) apply({ a: na, dx: fixDx(DFN[c.f], na, c.dx, Math.sign(c.dx)) });
  };
  const setDx = (v: number) => {
    const c = cur.current;
    const nd = fixDx(DFN[c.f], c.a, v, Math.sign(c.dx));
    if (nd !== c.dx) apply({ dx: nd });
  };
  const setAbsHE = (e: number) => {
    const c = cur.current;
    const ah = clamp(absHOfE(clamp(roundTo(e, E_STEP), E_MIN, E_MAX)), H_MIN, H_MAX);
    const nh = (c.h < 0 ? -1 : 1) * ah;
    if (nh !== c.h) apply({ h: nh });
  };
  const setSide = (sg: 1 | -1) => {
    const c = cur.current;
    if ((c.h < 0 ? -1 : 1) !== sg) apply({ h: -c.h });
  };
  const setZoomE = (e: number) => {
    const c = cur.current;
    const nz = clampZ(10 ** clamp(roundTo(e, Z_STEP), 0, 3));
    if (nz !== c.zoom) apply({ zoom: nz });
  };
  const chooseF = (id: DId) => {
    const c = cur.current;
    if (id === c.f) return;
    const sp = DFN[id];
    apply({ f: id, x0: sp.x0, a: sp.x0, dx: fixDx(sp, sp.x0, c.dx, Math.sign(c.dx)) });
  };

  const worldX = (e: PointerEvent, pl: Plot) => pl.x.min + ((e.offsetX - pl.box.x) / pl.box.w) * (pl.x.max - pl.x.min);
  const onPointerDown = (e: PointerEvent) => {
    const pl = plotRef.current;
    const c = cur.current;
    if (!pl || c.mode === 'zoom') return;
    const f = DFN[c.f].f;
    let which: 'P' | 'Q' | 'a' | 'dx';
    if (c.mode === 'secant') {
      const xq = c.x0 + c.h;
      const yq = f(xq);
      const dq = Number.isFinite(yq) ? Math.hypot(pl.px(xq) - e.offsetX, pl.py(yq) - e.offsetY) : Infinity;
      const dp = Math.hypot(pl.px(c.x0) - e.offsetX, pl.py(f(c.x0)) - e.offsetY);
      which = dq < 18 && dq < dp ? 'Q' : 'P';
    } else {
      const X = c.a + c.dx;
      const lin = linearize(c.f, c.a, c.dx);
      const d1 = Number.isFinite(lin.fx) ? Math.hypot(pl.px(X) - e.offsetX, pl.py(lin.fx) - e.offsetY) : Infinity;
      const d2 = Number.isFinite(lin.L) ? Math.hypot(pl.px(X) - e.offsetX, pl.py(lin.L) - e.offsetY) : Infinity;
      const da = Math.hypot(pl.px(c.a) - e.offsetX, pl.py(f(c.a)) - e.offsetY);
      which = Math.min(d1, d2) < 18 && Math.min(d1, d2) < da ? 'dx' : 'a';
    }
    drag.current = which;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    move(e);
  };
  const move = (e: PointerEvent) => {
    const pl = plotRef.current;
    const c = cur.current;
    if (!pl || !drag.current) return;
    const x = worldX(e, pl);
    if (drag.current === 'P') setX0(x);
    else if (drag.current === 'a') setA(x);
    else if (drag.current === 'dx') setDx(x - c.a);
    else {
      const raw = x - c.x0;
      const sg = raw === 0 ? (c.h < 0 ? -1 : 1) : Math.sign(raw);
      const ah = clamp(Math.abs(raw), H_MIN, H_MAX);
      const e2 = clamp(roundTo(eOfAbsH(ah), E_STEP), E_MIN, E_MAX);
      const nh = sg * clamp(absHOfE(e2), H_MIN, H_MAX);
      if (nh !== c.h) apply({ h: nh });
    }
  };
  const onPointerMove = (e: PointerEvent) => {
    if (drag.current) move(e);
  };
  const onPointerUp = () => {
    if (drag.current) setLive(describe());
    drag.current = null;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const c = cur.current;
    const big = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const d = (e.key === 'ArrowRight' ? 0.01 : -0.01) * big;
      if (c.mode === 'linear') setA(c.a + d);
      else setX0(c.x0 + d);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const up = e.key === 'ArrowUp';
      if (c.mode === 'secant') setAbsHE(eOfAbsH(Math.abs(c.h)) + (up ? -E_STEP : E_STEP));
      else if (c.mode === 'zoom') setZoomE(Math.log10(c.zoom) + (up ? Z_STEP : -Z_STEP));
      else setDx(c.dx + (up ? 0.01 : -0.01) * big);
    } else return;
    setLive(describe());
  };

  /* ---------------------------------------------------------------- text */
  const M = (q: { children: ComponentChildren }) => <bdi dir="ltr">{q.children}</bdi>;
  const sw = (kind: 'curve' | 'limit' | 'eps' | 'delta') => <span class={`dl-sw dl-sw-${kind}`} aria-hidden="true" />;
  const sp = sp0;
  const f = sp.f;

  function describe(): string {
    const c = cur.current;
    const s = DFN[c.f];
    if (c.mode === 'secant') return `x₀ = ${fmt(c.x0)}, h = ${fmtH(c.h)}: שיפוע המיתר ${fmt(quotientAt(c.f, c.x0, c.h), 7)}.`;
    if (c.mode === 'zoom') return `הגדלה פי ${fmtZ(c.zoom)} סביב x₀ = ${fmt(c.x0)}.`;
    const l = linearize(c.f, c.a, c.dx);
    return `${s.text}, a = ${fmt(c.a)}, dx = ${fmt(c.dx)}: Δy = ${fmt(l.Dy)}, dy = ${fmt(l.dy)}, השגיאה ${fmt(l.err, 4)}.`;
  }

  /** the slope sentence at x: exact f′, or the kind of kink */
  const slopeLine = (x: number) => {
    const k = kinkAt(s0.f, x, KINK_TOL);
    if (k?.kind === 'corner')
      return (
        <>
          {sw('delta')} <b>אין משיק</b>: ב-<M>x₀ = {fmt(x)}</M> יש פינה. השיפוע משמאל <M>{fmt(k.left)}</M>, השיפוע מימין <M>{fmt(k.right)}</M>.
        </>
      );
    if (k?.kind === 'vertical')
      return (
        <>
          {sw('limit')} <b>משיק אנכי</b>: מנת ההפרשים גדלה בלי גבול, והמשיק הוא הישר <M>x = {fmt(x)}</M>
          {Number.isNaN(k.left) ? ' (רק מימין: משמאל הפונקציה לא מוגדרת)' : ''}. השיפוע אינו מספר.
        </>
      );
    if (!differentiableAt(s0.f, x)) return <>הנקודה מחוץ לתחום של f.</>;
    return (
      <>
        {sw('limit')} שיפוע המשיק (מדויק): <M>
          f′(x₀) = <b>{fmt(sp.df(x))}</b>
        </M>
        , מהנוסחה <M>f′(x) = {sp.dfText}</M>
      </>
    );
  };

  const fnRow = (
    <span class="q" data-readout="fn">
      <M>f(x) = {sp.text}</M>
    </span>
  );
  const x0Row = (
    <span class="q" data-readout="x0">
      <M>x₀ = {fmt(s0.x0)}</M>, <M>f(x₀) = {fmt(f(s0.x0))}</M>
    </span>
  );

  let readout: ComponentChildren;
  let label: string;
  if (setup.mode === 'secant') {
    const q = quotientAt(setup.f, setup.x0, setup.h);
    const rows = secantRows(setup.f, setup.x0, setup.h);
    label = `איור חי: הגרף של ${sp.text}, הנקודה P על הגרף ב-x₀ = ${fmt(setup.x0)} (עיגול מלא) והנקודה Q ב-x₀ + h (ריבוע מלא), המיתר PQ מקווקו עם משולש של h ו-Δy, וטבלה של שיפוע המיתר לכל חזקה של 10 ש-|h| עובר. ${setup.tangent ? 'המשיק ב-P בקו מלא.' : ''}`;
    readout = (
      <>
        {fnRow}
        {x0Row}
        <span class="q" data-readout="h">
          <M>
            h = <b>{fmtH(setup.h)}</b>
          </M>{' '}
          (Q {setup.h > 0 ? 'מימין' : 'משמאל'} ל-P)
        </span>
        <span class="q" data-readout="quotient">
          {sw('eps')} שיפוע המיתר PQ: <M>
            (f(x₀ + h) − f(x₀))/h = <b>{fmt(q, 7)}</b>
          </M>
          {Number.isNaN(q) ? ' (הנקודה x₀ + h מחוץ לתחום של f)' : ''}
        </span>
        <div class="dl-tablewrap" data-readout="table">
          <table class="dl-table" dir="ltr">
            <thead>
              <tr>
                <th>h</th>
                <th>(f(x₀ + h) − f(x₀))/h</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.h} class={i === rows.length - 1 ? 'now' : ''}>
                  <td>{fmtH(r.h)}</td>
                  <td>{fmt(r.q, 7)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {setup.tangent && (
          <span class="q" data-readout="slope">
            {slopeLine(setup.x0)}
          </span>
        )}
      </>
    );
  } else if (setup.mode === 'zoom') {
    const k = kinkAt(setup.f, setup.x0, KINK_TOL);
    const wx = (sp.window.x[1] - sp.window.x[0]) / setup.zoom;
    const verdict =
      k?.kind === 'corner'
        ? `פינה: בכל הגדלה רואים שני קטעים בשיפועים שונים (${fmt(k.left)} משמאל, ${fmt(k.right)} מימין). הפינה לא נעלמת, ואין משיק.`
        : k?.kind === 'vertical'
          ? 'משיק אנכי: בכל הגדלה הגרף ליד P נראה תלול יותר ויותר, קרוב לקו אנכי. השיפוע אינו מספר.'
          : setup.zoom >= 50 - 1e-9
            ? 'נראה כמו ישר: בהגדלה כזו הגרף ליד P כמעט לא נבדל מהמשיק.'
            : 'הגדילו עוד (לפחות פי 50) וצפו בצורת הגרף ליד P.';
    label = `איור חי: הגרף של ${sp.text} בחלון סביב P = (${fmt(setup.x0)}, ${fmt(f(setup.x0))}), מוגדל פי ${fmtZ(setup.zoom)} בשני הצירים. ${setup.tangent ? 'המשיק ב-P בקו מלא.' : ''}`;
    readout = (
      <>
        {fnRow}
        {x0Row}
        <span class="q" data-readout="zoom">
          הגדלה פי <M>
            <b>{fmtZ(setup.zoom)}</b>
          </M>
          : חלון ברוחב <M>{fmt(wx, 3)}</M>
        </span>
        <span class="q" data-readout="verdict">
          <b>{verdict}</b>
        </span>
        {setup.tangent && (
          <span class="q" data-readout="slope">
            {slopeLine(setup.x0)}
          </span>
        )}
      </>
    );
  } else {
    const a = setup.a;
    const lin = linearize(setup.f, a, setup.dx);
    const hasT = Number.isFinite(lin.L);
    const k = kinkAt(setup.f, a, KINK_TOL);
    label = `איור חי: הגרף של ${sp.text}, הנקודה a = ${fmt(a)} והמשיק בה בקו מלא. ב-x = a + dx נקודה מלאה על הגרף ונקודה חלולה על המשיק; ביניהן השגיאה. ${setup.zoomErr ? 'בחלון קטן: הסביבה של a מוגדלת.' : ''}`;
    readout = (
      <>
        {fnRow}
        <span class="q" data-readout="a">
          <M>a = {fmt(a)}</M>, <M>f(a) = {fmt(f(a))}</M>,{' '}
          {hasT ? (
            <>
              <M>f′(a) = {fmt(sp.df(a))}</M> (מדויק)
            </>
          ) : (
            <b>{k?.kind === 'vertical' ? 'משיק אנכי ב-a: השיפוע אינו מספר, ואין קירוב לינארי' : k?.kind === 'corner' ? 'אין משיק ב-a (פינה), ואין קירוב לינארי' : 'אין משיק ב-a'}</b>
          )}
        </span>
        <span class="q" data-readout="dx">
          <M>
            dx = <b>{fmt(setup.dx)}</b>
          </M>
        </span>
        <span class="q" data-readout="fx">
          {sw('curve')} על הגרף: <M>f(a + dx) = {fmt(lin.fx)}</M>
        </span>
        <span class="q" data-readout="L">
          {sw('limit')} על המשיק: <M>L(a + dx) = f(a) + f′(a)·dx = {fmt(lin.L)}</M>
        </span>
        <span class="q" data-readout="Dy">
          {sw('curve')} השינוי האמיתי: <M>Δy = f(a + dx) − f(a) = {fmt(lin.Dy)}</M>
        </span>
        <span class="q" data-readout="dy">
          {sw('limit')} הדיפרנציאל: <M>dy = f′(a)·dx = {fmt(lin.dy)}</M>
        </span>
        <span class="q" data-readout="err">
          {sw('delta')} השגיאה: <M>
            Δy − dy = <b>{fmt(lin.err, 4)}</b>
          </M>
        </span>
        <span class="q" data-readout="ratio">
          השגיאה ביחס לצעד: <M>
            (Δy − dy)/dx = <b>{fmt(lin.err / setup.dx, 4)}</b>
          </M>
        </span>
      </>
    );
  }

  const ranges = sp.x0Range;
  const xLo = ranges[0][0];
  const xHi = ranges[ranges.length - 1][1];
  const x0Slider = (
    <Slider label="הנקודה x₀" value={setup.x0} min={xLo} max={xHi} step={0.01} format={(v) => fmt(v)} onChange={(v) => setX0(v)} />
  );
  const tangentToggle = <Toggle label="משיק" on={setup.tangent} swatch="var(--limit)" onChange={(on) => apply({ tangent: on })} />;

  return (
    <SimShell
      fig={props.id}
      label={label}
      canvasRef={canvasRef}
      aspect={aspect}
      live={live}
      tasks={tasks}
      cursor={setup.mode === 'zoom' ? 'default' : 'ew-resize'}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onReset={() => {
        const init = initial();
        commit(init);
        rebase(init);
        setLive('האיור חזר למצב ההתחלה.');
      }}
      readout={<div class="rtl-q">{readout}</div>}
      controls={
        <>
          {modes.length > 1 && (
            <div class="group" role="group" aria-label="מה מציג האיור">
              {modes.map((m) => (
                <Toggle key={m} label={MODE_LABEL[m]} on={setup.mode === m} onChange={() => apply({ mode: m })} />
              ))}
            </div>
          )}
          {fns.length > 1 && (
            <div class="group" role="group" aria-label="הפונקציה">
              {fns.map((id) => (
                <Toggle key={id} label={<M>{DFN[id].text}</M>} on={setup.f === id} onChange={() => chooseF(id)} />
              ))}
            </div>
          )}
          {setup.mode === 'secant' && (
            <>
              {x0Slider}
              <Slider
                label="הצעד |h|"
                value={roundTo(eOfAbsH(Math.abs(setup.h)), E_STEP)}
                min={E_MIN}
                max={E_MAX}
                step={E_STEP}
                format={() => fmtAbsH(Math.abs(setup.h))}
                onChange={(v) => setAbsHE(v)}
              />
              <div class="group" role="group" aria-label="הצד של Q">
                <Toggle label="מימין" on={setup.h > 0} onChange={() => setSide(1)} />
                <Toggle label="משמאל" on={setup.h < 0} onChange={() => setSide(-1)} />
                {tangentToggle}
              </div>
            </>
          )}
          {setup.mode === 'zoom' && (
            <>
              {x0Slider}
              <Slider label="ההגדלה" value={roundTo(Math.log10(setup.zoom), Z_STEP)} min={0} max={3} step={Z_STEP} format={() => `×${fmtZ(setup.zoom)}`} onChange={(v) => setZoomE(v)} />
              <div class="group" role="group" aria-label="מה להציג">
                {tangentToggle}
              </div>
            </>
          )}
          {setup.mode === 'linear' && (
            <>
              <Slider label="הנקודה a" value={setup.a} min={xLo} max={xHi} step={0.01} format={(v) => fmt(v)} onChange={(v) => setA(v)} />
              <Slider
                label="הצעד dx"
                value={setup.dx}
                min={Math.ceil((sp.window.x[0] - setup.a) * 100 - 1e-6) / 100}
                max={Math.floor((sp.window.x[1] - setup.a) * 100 + 1e-6) / 100}
                step={0.01}
                format={(v) => fmt(v)}
                onChange={(v) => setDx(v)}
              />
              <div class="group" role="group" aria-label="מה להציג">
                <Toggle label="הגדלת הסביבה של a" on={setup.zoomErr} swatch="var(--delta)" onChange={(on) => apply({ zoomErr: on })} />
              </div>
            </>
          )}
        </>
      }
    />
  );
}
