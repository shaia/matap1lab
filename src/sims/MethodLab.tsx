/**
 * MethodLab (chapter 7.2 and 7.3, the two integration methods as areas): two modes. Maths: src/math/intmethods.ts, whose
 * STORED closed forms (an antiderivative of the integrand in x and in u, the two regions of integration by parts) give
 * every area and verdict; nothing is inferred from sampling. Canvases are math space and stay LTR (x to the right, y
 * up); sliders for math quantities are `dir="ltr"`. Nothing moves by itself (no animation), so there is no motion for
 * motionAllowed() to gate. Colours come from the palette only; areas differ by pattern as well as by colour.
 *
 * mode 'subst': a preset f (registry SUB: h(x) = f(g(x))·g′(x), u = g(x)) in two panels of one canvas, side by side on
 *               a wide figure and stacked (h above f) on a phone-width one.
 *               Left panel: h(x) on the x-axis with the signed area from a to x shaded (above the axis a solid
 *               `--pos` fill, below it a hatched `--neg` fill). Right panel: f(u) on the u-axis with the area from
 *               g(a) to g(x) shaded the same way. The two areas are equal (the theorem the picture shows).
 *               Handles: a (hollow ring) and x (filled dot) on the left axis, their images g(a), g(x) on the right.
 *               `strip` outlines the strip [x, x + dx] under h and its image [g(x), g(x + dx)] under f: the image is
 *               wider or narrower (its width is about g′(x)·dx) and the heights compensate. The readout gives both
 *               widths, the two thin-rectangle areas h(x)·dx and f(u)·du, and their ratio (→ 1 as dx → 0).
 * mode 'parts': a preset (registry PARTS) as a curve (u(t), v(t)) in the (u, v) plane, drawn whole and faint, bold from
 *               t0 to T. The rectangle [0, u(T)]×[0, v(T)] is outlined; with u(t0)·v(t0) ≠ 0 the small rectangle
 *               [0, u(t0)]×[0, v(t0)] is outlined dashed. With `split` the region between the curve and the u-axis
 *               (∫v du, vertical hatching, `--delta`) and the region between the curve and the v-axis (∫u dv,
 *               horizontal hatching, `--eps`) are coloured and labelled; without it one outline of both together.
 *               T is dragged along the curve (the drag follows u) or set by a slider, t0 by a slider.
 *
 * Props (defaults): id (required); mode ('subst'); modes (the mode buttons shown; default the starting mode only);
 * tasks ([]). f (a SUB id goes to the subst mode, a PARTS id to the parts mode; defaults 'xcosx2' and 'xex'; the ids
 * never overlap); a (the preset's starting a: the left end of the window, or 0 / −0.5 for lin; clamped to the window);
 * x (starting x per preset: xcosx2 1.2, xexp 1, sincos 0.8, lin 0.5, sqrt 1.5); strip (false); dx (0.2; 0.005…0.5);
 * t0 (the preset's start of t: xex 0, lnx 1, xsin 0, atan 0); T (starting T per preset: xex 1.5, lnx 3, xsin 2, atan 2;
 * kept ≥ t0); split (false).
 * Every prop is also a step key (`<Step fig=… set={{…}}>`); a key left out keeps its value; a new `f` without `a` / `x`
 * (or `t0` / `T`) puts them at that preset's starting values. A state set by a step never ticks a task, and a state that
 * already had a task's property when a step or reset made it must be left and found again.
 * The learner can also pick the integral from a list (select "האינטגרל": the presets of the current mode).
 *
 * Tasks (ticked only inside the learner's own drag, key, slider, select or toggle):
 *   subst: subst-move (x moved by at least 0.3 from where a step, reset or preset change put it: the two areas stay
 *          equal), subst-strip (strip on, dx ≤ 0.02 and the thin-rectangle ratio within 1% of 1; at x ≈ 0.25 or less
 *          of a preset with g(x) = x² the ratio is further from 1, so move x away from 0 as well)
 *   parts: parts-move (T moved by at least 0.3 from where a step, reset or preset change put it), parts-start (t0 moved
 *          off the preset's start: the small rectangle appears and the identity still holds)
 *
 * Hooks for e2e specs (inside `#<id>`; numbers use U+2212 for minus):
 *   buttons by role and name: the mode buttons "הצבה", "אינטגרציה בחלקים"; subst "רצועה צרה" (strip, aria-pressed);
 *     parts "צביעת שני השטחים" (split, aria-pressed); "איפוס" (reset)
 *   [data-control="preset"] select   the integral (option values are the preset ids of the current mode)
 *   [data-control="x"] input         subst: the x slider (value = x, step 0.01)
 *   [data-control="a"] input         subst: the a slider (value = a, step 0.01)
 *   [data-control="dx"] input        subst, only with strip on: value = log10(dx), −2.3…−0.3, step 0.05 (−1.7 is dx = 0.02)
 *   [data-control="T"] input         parts: the T slider (value = T, step 0.01)
 *   [data-control="t0"] input        parts: the t0 slider (value = t0, step 0.01)
 *   canvas                           drag moves the nearer of a and x in subst (on either panel; the right panel
 *                                    drags u = g(x)), T in parts; ←/→ move x (subst) or T (parts)
 *   [data-readout=…]                 subst: fn, formula, a, x, u, xarea, uarea, equal; with strip: widths, strips,
 *                                    ratio
 *                                    parts: fn, uv, range, uT, vT, vdu, udv, sum, rect, identity (and note, only for
 *                                    xsin)
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import {
  PARTS,
  PARTS_IDS,
  SUB,
  SUB_IDS,
  invG,
  isPartsId,
  isSubId,
  partsAreas,
  stripPair,
  substAreas,
  tOfU,
  type PartsId,
  type SubId,
} from '~/math/intmethods';
import { markTask } from '~/progress/store';
import { subscribeSteps, type StepState } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { sci } from './core/format';
import { withAlpha } from './core/ink';
import { drawAxes, insetBox, makePlot, type Box, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import './MethodLab.css';

export type MethodMode = 'subst' | 'parts';

export interface MethodLabProps {
  id: string;
  mode?: MethodMode;
  /** the mode buttons shown (default: the starting mode only) */
  modes?: MethodMode[];
  /** a substitution preset id or a by-parts preset id */
  f?: string;
  a?: number;
  x?: number;
  strip?: boolean;
  dx?: number;
  t0?: number;
  T?: number;
  split?: boolean;
  tasks?: string[];
}

interface Setup {
  mode: MethodMode;
  pS: SubId;
  pP: PartsId;
  a: number;
  x: number;
  strip: boolean;
  dx: number;
  t0: number;
  T: number;
  split: boolean;
}

const ltr = (s: string) => String.fromCharCode(0x2066) + s.replace(/ /g, String.fromCharCode(0xa0)) + String.fromCharCode(0x2069);

const TASK_LABEL: Record<string, string> = {
  'subst-move': `גררו את הנקודה x (או את הסרגל) לפחות ${ltr('0.3')} מהמקום שבו היא התחילה. מה קורה לשני השטחים?`,
  'subst-strip': `הדליקו "רצועה צרה" וכווצו את ${ltr('dx')} עד ${ltr('0.02')} או פחות (הרחיקו גם את x מ-0). מה היחס בין שטחי שתי הרצועות?`,
  'parts-move': `גררו את ${ltr('T')} לפחות ${ltr('0.3')} מהמקום שבו הוא התחיל. מה הסכום של שני השטחים?`,
  'parts-start': `הזיזו את ${ltr('t₀')} מנקודת ההתחלה. מה מופיע בציור, ומה נשאר שווה?`,
};

const MODE_LABEL: Record<MethodMode, string> = { subst: 'הצבה', parts: 'אינטגרציה בחלקים' };

const TAU = 2 * Math.PI;
/** SimShell's reset and full-screen buttons cover the canvas's top-right 82 × 42 px */
const TOOLS_H = 46;
const DX_MIN = 0.005;
const DX_MAX = 0.5;
const DX_E_MIN = -2.3;
const DX_E_MAX = -0.3;
const DX_E_STEP = 0.05;
const MOVE_X = 0.3;
const MOVE_T = 0.3;
const WIDE_PX = 520;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const bool = (x: unknown): boolean | null => (typeof x === 'boolean' ? x : null);
const roundTo = (x: number, step: number) => Number((Math.round(x / step) * step).toPrecision(10));
const minus = (s: string) => s.replace(/-/g, '−');
const fmt = (x: number, sig = 4) => (Number.isNaN(x) ? '—' : Math.abs(x) < 1e-9 ? '0' : minus(sci(x, sig)));
const fmtDx = (x: number) => minus(sci(x, 3));
const clampDx = (dx: number) => clamp(dx, DX_MIN, DX_MAX);
const dxOfE = (e: number) => clampDx(10 ** clamp(roundTo(e, DX_E_STEP), DX_E_MIN, DX_E_MAX));

const clampSubX = (id: SubId, x: number) => clamp(x, SUB[id].x[0], SUB[id].x[1]);
const clampT = (id: PartsId, t: number) => clamp(t, PARTS[id].t[0], PARTS[id].t[1]);

/* ---- tasks: `needs` = the learner's change must touch one of these keys; the others must be left and found again
 * after a step or reset made the state. `anchor` holds x and T as the last step / reset / preset change left them. */
interface Anchor {
  x: number;
  T: number;
}
interface Rule {
  needs: (keyof Setup)[];
  state: (s: Setup, anchor: Anchor) => boolean;
}
const RULES: Record<string, Rule> = {
  'subst-move': { needs: ['x'], state: (s, an) => s.mode === 'subst' && Math.abs(s.x - an.x) >= MOVE_X - 1e-9 },
  'subst-strip': {
    needs: ['dx', 'x', 'strip'],
    state: (s) => {
      if (s.mode !== 'subst' || !s.strip || s.dx > 0.02 + 1e-9) return false;
      const r = stripPair(s.pS, s.x, stripDx(s)).ratio;
      return Math.abs(r - 1) <= 0.01;
    },
  },
  'parts-move': { needs: ['T'], state: (s, an) => s.mode === 'parts' && Math.abs(s.T - an.T) >= MOVE_T - 1e-9 },
  'parts-start': { needs: ['t0'], state: (s) => s.mode === 'parts' && s.t0 > PARTS[s.pP].t[0] + 1e-9 },
};

/** the strip's width, cut at the right end of the window (so g(x + dx) stays on the u-axis) */
function stripDx(s: Setup): number {
  return Math.max(0, Math.min(s.dx, SUB[s.pS].x[1] - s.x));
}

/* ---- canvas helpers */
function haloText(ctx: CanvasRenderingContext2D, p: Palette, s: string, x: number, y: number, o: { font: string; color?: string; align?: CanvasTextAlign; base?: CanvasTextBaseline }) {
  ctx.save();
  ctx.direction = 'ltr';
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
function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width = 1.3, dash: number[] = []) {
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
/** a label on a paper plate: lines may cross the spot, the letters stay clear */
function plate(ctx: CanvasRenderingContext2D, p: Palette, s: string, x: number, y: number, font: string, color: string) {
  ctx.save();
  ctx.direction = 'ltr';
  ctx.font = font;
  const w = ctx.measureText(s).width;
  ctx.fillStyle = withAlpha(p.paper, 0.92);
  ctx.strokeStyle = withAlpha(color, 0.6);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x - w / 2 - 4, y - 8, w + 8, 16, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
  ctx.restore();
}

/** hatching lines inside the current clip: vertical (`v`), horizontal (`h`) or diagonal (`d`), over `b` */
function hatch(ctx: CanvasRenderingContext2D, b: Box, kind: 'v' | 'h' | 'd', color: string, gap = 6, width = 1.2) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  if (kind === 'v') for (let x = b.x; x <= b.x + b.w; x += gap) (ctx.moveTo(x, b.y), ctx.lineTo(x, b.y + b.h));
  else if (kind === 'h') for (let y = b.y; y <= b.y + b.h; y += gap) (ctx.moveTo(b.x, y), ctx.lineTo(b.x + b.w, y));
  else for (let k = -b.h; k <= b.w; k += gap) (ctx.moveTo(b.x + k, b.y + b.h), ctx.lineTo(b.x + k + b.h, b.y));
  ctx.stroke();
  ctx.restore();
}

/** y = f(x) on [lo, hi] (the preset's window, not the padded axis), clipped to the plot, far values clamped */
function strokeFn(ctx: CanvasRenderingContext2D, plot: Plot, f: (x: number) => number, lo: number, hi: number, color: string, width: number) {
  const { box } = plot;
  const span = plot.y.max - plot.y.min;
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y - 2, box.w, box.h + 4);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const n = 240;
  let started = false;
  for (let i = 0; i <= n; i++) {
    const x = lo + ((hi - lo) * i) / n;
    const y = f(x);
    if (!Number.isFinite(y)) {
      started = false;
      continue;
    }
    const sy = plot.py(clamp(y, plot.y.min - 3 * span, plot.y.max + 3 * span));
    if (started) ctx.lineTo(plot.px(x), sy);
    else ctx.moveTo(plot.px(x), sy);
    started = true;
  }
  ctx.stroke();
  ctx.restore();
}

/** the polygon between y = f(x) over [xa, xb] and the axis y = 0, as a path on the context */
function regionPath(ctx: CanvasRenderingContext2D, plot: Plot, f: (x: number) => number, xa: number, xb: number) {
  const n = 160;
  const span = plot.y.max - plot.y.min;
  ctx.beginPath();
  ctx.moveTo(plot.px(xa), plot.py(0));
  for (let i = 0; i <= n; i++) {
    const x = xa + ((xb - xa) * i) / n;
    ctx.lineTo(plot.px(x), plot.py(clamp(f(x), plot.y.min - 3 * span, plot.y.max + 3 * span)));
  }
  ctx.lineTo(plot.px(xb), plot.py(0));
  ctx.closePath();
}

/** the signed area between f and the axis over [xa, xb]: above the axis a solid `pos` fill, below it a hatched `neg` fill */
function signedRegion(ctx: CanvasRenderingContext2D, plot: Plot, p: Palette, f: (x: number) => number, xa: number, xb: number) {
  if (xa === xb) return;
  const { box } = plot;
  const y0 = plot.py(0);
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  // above the axis
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, Math.max(0, y0 - box.y));
  ctx.clip();
  regionPath(ctx, plot, f, xa, xb);
  ctx.fillStyle = withAlpha(p.pos, 0.38);
  ctx.fill();
  ctx.restore();
  // below the axis, hatched
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, y0, box.w, Math.max(0, box.y + box.h - y0));
  ctx.clip();
  regionPath(ctx, plot, f, xa, xb);
  ctx.fillStyle = withAlpha(p.neg, 0.16);
  ctx.fill();
  ctx.clip();
  hatch(ctx, box, 'd', withAlpha(p.neg, 0.85), 5, 1.2);
  ctx.restore();
  ctx.restore();
}

/** a closed polygon from points in screen space, filled and hatched inside its own clip, then outlined */
function patternPoly(ctx: CanvasRenderingContext2D, pts: [number, number][], b: Box, color: string, kind: 'v' | 'h', outline: string) {
  if (pts.length < 3) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fillStyle = withAlpha(color, 0.2);
  ctx.fill();
  ctx.clip();
  hatch(ctx, b, kind, withAlpha(color, 0.9), 5, 1.3);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.restore();
}

interface SubPlots {
  kind: 'subst';
  l: Plot;
  r: Plot;
  rect: { l: Box; r: Box };
}
interface PartsPlot {
  kind: 'parts';
  p: Plot;
}

export default function MethodLab(props: MethodLabProps) {
  const startMode: MethodMode = props.mode ?? 'subst';
  const modes: MethodMode[] = props.modes ?? [startMode];
  const initial = (): Setup => {
    const pS: SubId = isSubId(props.f) ? props.f : 'xcosx2';
    const pP: PartsId = isPartsId(props.f) ? props.f : 'xex';
    const t0 = clampT(pP, props.t0 ?? PARTS[pP].t[0]);
    return {
      mode: startMode,
      pS,
      pP,
      a: clampSubX(pS, props.a ?? SUB[pS].a0),
      x: clampSubX(pS, props.x ?? SUB[pS].x0),
      strip: props.strip ?? false,
      dx: clampDx(props.dx ?? 0.2),
      t0,
      T: Math.max(t0, clampT(pP, props.T ?? PARTS[pP].T0)),
      split: props.split ?? false,
    };
  };
  const [setup, setSetup] = useState<Setup>(initial);
  const cur = useRef(setup);
  const [live, setLive] = useState('');
  const [narrow, setNarrow] = useState(false);
  const plotRef = useRef<SubPlots | PartsPlot | null>(null);
  const dragging = useRef<null | { handle: 'a' | 'x'; panel: 'l' | 'r' }>(null);
  const draggingT = useRef(false);
  const anchor = useRef<Anchor>({ x: setup.x, T: setup.T });
  /** tasks whose state held when the last step or reset made it: they must be left and found again */
  const held = useRef<Set<string>>(new Set());

  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const done = (t: string) => {
    if (props.tasks?.includes(t)) markTask(`${props.id}:${t}`);
  };
  const rebase = (s: Setup) => {
    anchor.current = { x: s.x, T: s.T };
    held.current = new Set((props.tasks ?? []).filter((id) => RULES[id] && RULES[id].state(s, anchor.current)));
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
        const mode = typeof st.mode === 'string' && modes.includes(st.mode as MethodMode) ? (st.mode as MethodMode) : prev.mode;
        const next: Setup = { ...prev, mode };
        const newS = isSubId(st.f) && st.f !== prev.pS;
        const newP = isPartsId(st.f) && st.f !== prev.pP;
        if (isSubId(st.f)) next.pS = st.f;
        if (isPartsId(st.f)) next.pP = st.f;
        next.a = clampSubX(next.pS, num(st.a) ?? (newS ? SUB[next.pS].a0 : prev.a));
        next.x = clampSubX(next.pS, num(st.x) ?? (newS ? SUB[next.pS].x0 : prev.x));
        next.strip = bool(st.strip) ?? prev.strip;
        next.dx = clampDx(num(st.dx) ?? prev.dx);
        next.t0 = clampT(next.pP, num(st.t0) ?? (newP ? PARTS[next.pP].t[0] : prev.t0));
        next.T = Math.max(next.t0, clampT(next.pP, num(st.T) ?? (newP ? PARTS[next.pP].T0 : prev.T)));
        next.split = bool(st.split) ?? prev.split;
        commit(next);
        rebase(next);
      }),
    [props.id],
  );

  const s0 = setup;

  /* ---------------------------------------------------------------- drawing */
  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    const nar = view.w < WIDE_PX;
    const fs = nar ? 11 : 12;
    const font = (w8: number, size = fs) => `${w8} ${size}px ${p.fontUi}`;

    if (s0.mode === 'subst') {
      const sp = SUB[s0.pS];
      const sideBySide = !nar;
      const pw = sideBySide ? view.w / 2 : view.w;
      const ph = sideBySide ? view.h : view.h / 2;
      const panelBox = (row: number, col: number): Box => ({ x: col * pw, y: row * ph, w: pw, h: ph });
      const rectL = panelBox(0, 0);
      const rectR = sideBySide ? panelBox(0, 1) : panelBox(1, 0);
      const mkBox = (r: Box, top: number): Box => insetBox(r, { l: nar ? 40 : 38, r: sideBySide ? 12 : 14, t: top, b: 38 });
      const boxL = mkBox(rectL, TOOLS_H);
      const boxR = mkBox(rectR, sideBySide ? TOOLS_H : 30);
      const padX = (lo: number, hi: number) => (hi - lo) * 0.04;
      const plotL = makePlot(boxL, { min: sp.x[0] - padX(...sp.x), max: sp.x[1] + padX(...sp.x), label: 'x' }, { min: sp.hy[0], max: sp.hy[1], label: 'y' });
      const plotR = makePlot(boxR, { min: sp.u[0] - padX(...sp.u), max: sp.u[1] + padX(...sp.u), label: 'u' }, { min: sp.fy[0], max: sp.fy[1], label: 'y' });
      plotRef.current = { kind: 'subst', l: plotL, r: plotR, rect: { l: rectL, r: rectR } };

      const xe = s0.x + stripDx(s0);
      const drawPanel = (plot: Plot, fn: (t: number) => number, lo: number, hi: number, ta: number, tb: number, sa: number, sb: number, title: string, hx: string) => {
        drawAxes(ctx, plot, p);
        const { box } = plot;
        line(ctx, box.x, plot.py(0), box.x + box.w, plot.py(0), withAlpha(p.ink2, 0.75), 1.2);
        signedRegion(ctx, plot, p, fn, ta, tb);
        strokeFn(ctx, plot, fn, lo, hi, p.curve, 2.6);
        // the strip [sa, sb]: outlined
        if (s0.strip && sb > sa) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(box.x, box.y, box.w, box.h);
          ctx.clip();
          regionPath(ctx, plot, fn, sa, sb);
          ctx.fillStyle = withAlpha(p.accent, 0.3);
          ctx.fill();
          ctx.strokeStyle = p.ink;
          ctx.lineWidth = 1.8;
          ctx.stroke();
          ctx.restore();
        }
        // handles: a (hollow) and x (filled) on the axis, with a dashed guide up to the curve
        const y0 = plot.py(0);
        for (const [t, filled] of [
          [ta, false],
          [tb, true],
        ] as const) {
          const sx = plot.px(t);
          const sy = plot.py(clamp(fn(t), plot.y.min, plot.y.max));
          line(ctx, sx, y0, sx, sy, withAlpha(p.accent, 0.6), 1.1, [3, 4]);
          if (filled) dot(ctx, sx, y0, 6, p.accent, p.paper);
          else ring(ctx, sx, y0, 5.5, p.accent, p.paper);
        }
        haloText(ctx, p, title, box.x + 4, box.y - 14, { font: font(700), color: p.ink, align: 'left' });
        haloText(ctx, p, hx, box.x + box.w - 4, box.y + box.h - 12, { font: font(600, fs - 1), color: p.ink2, align: 'right' });
      };
      drawPanel(plotL, sp.h, sp.x[0], sp.x[1], s0.a, s0.x, s0.x, xe, `h(x) = ${sp.hText}`, `a = ${fmt(s0.a, 3)}  x = ${fmt(s0.x, 3)}`);
      drawPanel(plotR, sp.f, sp.u[0], sp.u[1], sp.g(s0.a), sp.g(s0.x), sp.g(s0.x), sp.g(xe), `f(u) = ${sp.fText}`, `g(a) = ${fmt(sp.g(s0.a), 3)}  u = ${fmt(sp.g(s0.x), 3)}`);
      return;
    }

    // parts: the (u, v) plane
    const sp = PARTS[s0.pP];
    const uMax = sp.u(sp.t[1]);
    const vMax = sp.v(sp.t[1]);
    const box = insetBox({ x: 0, y: 0, w: view.w, h: view.h }, { l: 46, r: 16, t: nar ? 34 : 24, b: 42 });
    const plot = makePlot(box, { min: 0, max: uMax * 1.08, label: 'u' }, { min: 0, max: vMax * 1.08, label: 'v' });
    plotRef.current = { kind: 'parts', p: plot };
    drawAxes(ctx, plot, p);
    const PX = plot.px;
    const PY = plot.py;
    const t0 = s0.t0;
    const T = s0.T;
    const u0 = sp.u(t0);
    const v0 = sp.v(t0);
    const uT = sp.u(T);
    const vT = sp.v(T);
    const curvePts = (ta: number, tb: number, n = 120): [number, number][] =>
      Array.from({ length: n + 1 }, (_, i) => {
        const t = ta + ((tb - ta) * i) / n;
        return [PX(sp.u(t)), PY(sp.v(t))] as [number, number];
      });
    const arc = curvePts(t0, T);
    if (T > t0) {
      if (s0.split) {
        // ∫v du: between the curve and the u-axis, vertical hatching; ∫u dv: between the curve and the v-axis, horizontal
        patternPoly(ctx, [...arc, [PX(uT), PY(0)], [PX(u0), PY(0)]], box, p.delta, 'v', p.delta);
        patternPoly(ctx, [...arc, [PX(0), PY(vT)], [PX(0), PY(v0)]], box, p.eps, 'h', p.eps);
      } else {
        // one outline of both regions together: the big rectangle without the small one
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(PX(0), PY(vT));
        ctx.lineTo(PX(uT), PY(vT));
        ctx.lineTo(PX(uT), PY(0));
        ctx.lineTo(PX(u0), PY(0));
        ctx.lineTo(PX(u0), PY(v0));
        ctx.lineTo(PX(0), PY(v0));
        ctx.closePath();
        ctx.fillStyle = withAlpha(p.ink3, 0.12);
        ctx.fill();
        ctx.strokeStyle = p.ink2;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.restore();
      }
    }
    // the rectangle [0, u(T)] × [0, v(T)] and the small one [0, u(t0)] × [0, v(t0)]
    ctx.save();
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 1.8;
    ctx.strokeRect(PX(0), PY(vT), PX(uT) - PX(0), PY(0) - PY(vT));
    ctx.restore();
    const small = u0 * v0 > 1e-12;
    if (small) {
      ctx.save();
      ctx.strokeStyle = p.ink2;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(PX(0), PY(v0), PX(u0) - PX(0), PY(0) - PY(v0));
      ctx.restore();
    }
    // the curve: faint whole, bold from t0 to T
    ctx.save();
    ctx.strokeStyle = withAlpha(p.curve, 0.35);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    curvePts(sp.t[0], sp.t[1], 200).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.strokeStyle = p.curve;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    arc.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.restore();
    // labels of the two regions, on plates
    if (s0.split && T > t0) {
      const tm = (t0 + T) / 2;
      plate(ctx, p, '∫v du', PX(sp.u(tm)), PY(sp.v(tm) / 2), font(700), p.delta);
      plate(ctx, p, '∫u dv', PX(sp.u(tm) / 2), PY(sp.v(tm)), font(700), p.eps);
    }
    if (small) plate(ctx, p, 'u(t₀)v(t₀)', PX(u0 / 2), PY(v0 / 2), font(600, fs - 1), p.ink2);
    // the start (hollow) and T (filled, draggable)
    ring(ctx, PX(u0), PY(v0), 5, p.ink, p.paper);
    dot(ctx, PX(uT), PY(vT), 6.5, p.accent, p.paper);
    haloText(ctx, p, `(u(T), v(T)) = (${fmt(uT, 3)}, ${fmt(vT, 3)})`, box.x + 6, box.y + 10, { font: font(700), color: p.ink, align: 'left' });
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1.6, worldHeight: 1, animate: false });
  useEffect(invalidate, [setup, narrow]);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const upd = () => setNarrow(el.getBoundingClientRect().width < WIDE_PX);
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const aspect = setup.mode === 'subst' ? (narrow ? 0.66 : 2.0) : narrow ? 0.95 : 1.4;

  /* ---------------------------------------------------------------- learner changes */
  /** The learner changed the figure: apply, then tick whatever the new state completes. A mode or preset change
   * only moves the anchors. */
  const apply = (patch: Partial<Setup>) => {
    const prev = cur.current;
    const next: Setup = { ...prev, ...patch };
    commit(next);
    if ('mode' in patch || 'pS' in patch || 'pP' in patch) {
      rebase(next);
      return;
    }
    for (const id of props.tasks ?? []) {
      const rule = RULES[id];
      if (!rule) continue;
      if (!rule.state(next, anchor.current)) {
        held.current.delete(id);
        continue;
      }
      if (!rule.needs.some((key) => key in patch)) continue;
      if (held.current.has(id)) continue;
      done(id);
    }
  };

  const setX = (x: number) => {
    const c = cur.current;
    const nx = clampSubX(c.pS, roundTo(x, 0.01));
    if (nx !== c.x) apply({ x: nx });
  };
  const setA = (a: number) => {
    const c = cur.current;
    const na = clampSubX(c.pS, roundTo(a, 0.01));
    if (na !== c.a) apply({ a: na });
  };
  const setT = (T: number) => {
    const c = cur.current;
    const nT = Math.max(c.t0, clampT(c.pP, roundTo(T, 0.01)));
    if (nT !== c.T) apply({ T: nT });
  };
  const setT0 = (t0: number) => {
    const c = cur.current;
    const n0 = Math.min(c.T, clampT(c.pP, roundTo(t0, 0.01)));
    if (n0 !== c.t0) apply({ t0: n0 });
  };

  /** the pointer in the plot's data coordinates */
  const dataX = (plot: Plot, e: PointerEvent) => plot.x.min + ((e.offsetX - plot.box.x) / plot.box.w) * (plot.x.max - plot.x.min);
  const inRect = (b: Box, e: PointerEvent) => e.offsetX >= b.x && e.offsetX <= b.x + b.w && e.offsetY >= b.y && e.offsetY <= b.y + b.h;

  const onPointerDown = (e: PointerEvent) => {
    const pl = plotRef.current;
    const c = cur.current;
    if (!pl) return;
    if (pl.kind === 'subst' && c.mode === 'subst') {
      const panel: 'l' | 'r' = inRect(pl.rect.r, e) && !inRect(pl.rect.l, e) ? 'r' : 'l';
      const plot = panel === 'l' ? pl.l : pl.r;
      const t = dataX(plot, e);
      const xAt = panel === 'l' ? clampSubX(c.pS, t) : invG(c.pS, t);
      const handle: 'a' | 'x' = Math.abs(xAt - c.a) < Math.abs(xAt - c.x) ? 'a' : 'x';
      dragging.current = { handle, panel };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      (handle === 'a' ? setA : setX)(xAt);
    } else if (pl.kind === 'parts' && c.mode === 'parts') {
      draggingT.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setT(tOfU(c.pP, dataX(pl.p, e)));
    }
  };
  const onPointerMove = (e: PointerEvent) => {
    const pl = plotRef.current;
    const c = cur.current;
    if (!pl) return;
    if (pl.kind === 'subst' && dragging.current && c.mode === 'subst') {
      const { handle, panel } = dragging.current;
      const t = dataX(panel === 'l' ? pl.l : pl.r, e);
      const xAt = panel === 'l' ? clampSubX(c.pS, t) : invG(c.pS, t);
      (handle === 'a' ? setA : setX)(xAt);
    } else if (pl.kind === 'parts' && draggingT.current && c.mode === 'parts') {
      setT(tOfU(c.pP, dataX(pl.p, e)));
    }
  };
  const onPointerUp = () => {
    if (dragging.current || draggingT.current) setLive(describe(cur.current));
    dragging.current = null;
    draggingT.current = false;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const c = cur.current;
    const dir = e.key === 'ArrowLeft' ? -1 : 1;
    if (c.mode === 'subst') {
      const w = SUB[c.pS].x;
      setX(c.x + dir * Math.max(0.01, roundTo((w[1] - w[0]) / 100, 0.01)));
    } else {
      const w = PARTS[c.pP].t;
      setT(c.T + dir * Math.max(0.01, roundTo((w[1] - w[0]) / 100, 0.01)));
    }
    setLive(describe(cur.current));
  };

  /* ---------------------------------------------------------------- text */
  const M = (q: { children: ComponentChildren }) => <bdi dir="ltr">{q.children}</bdi>;
  const spS = SUB[setup.pS];
  const spP = PARTS[setup.pP];

  function describe(s: Setup): string {
    if (s.mode === 'subst') {
      const sp = SUB[s.pS];
      const { xArea, uArea } = substAreas(s.pS, s.a, s.x);
      return `x = ${fmt(s.x, 3)}, u = ${fmt(sp.g(s.x), 3)}: השטח ב-x הוא ${fmt(xArea)} והשטח ב-u הוא ${fmt(uArea)}.`;
    }
    const { udv, vdu, rect } = partsAreas(s.pP, s.t0, s.T);
    return `T = ${fmt(s.T, 3)}: ∫v du = ${fmt(vdu)}, ∫u dv = ${fmt(udv)}, והסכום ${fmt(rect)}.`;
  }

  const label =
    setup.mode === 'subst'
      ? `איור חי: הצבה בציור של שטחים. משמאל הגרף של ${spS.hText} על ציר x עם השטח מ-a עד x, ומימין הגרף של ${spS.fText} על ציר u עם השטח מ-g(a) עד g(x), כש-${spS.formula}. שני השטחים שווים. אפשר להדליק רצועה צרה ולראות שרוחבה משתנה אבל השטח נשמר.`
      : `איור חי: אינטגרציה בחלקים בציור של שטחים, עבור ${spP.text}. עקומה במישור (u, v): השטח בינה לבין ציר u הוא האינטגרל של v du, והשטח בינה לבין ציר v הוא האינטגרל של u dv. שניהם יחד עם המלבן הקטן משלימים את המלבן [0, u(T)] × [0, v(T)].`;

  let readout: ComponentChildren;
  if (setup.mode === 'subst') {
    const { a, x } = setup;
    const u = spS.g(x);
    const { xArea, uArea } = substAreas(setup.pS, a, x);
    const equal = Math.abs(xArea - uArea) <= 1e-9 * Math.max(1, Math.abs(xArea));
    const sdx = stripDx(setup);
    const sp = stripPair(setup.pS, x, sdx);
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>
            ∫ {spS.hText} dx
          </M>
        </span>
        <span class="q" data-readout="formula">
          <M>{spS.formula}</M>
        </span>
        <span class="q" data-readout="a">
          <M>
            a = <b>{fmt(a)}</b>
          </M>
          , <M>g(a) = {fmt(spS.g(a))}</M>
        </span>
        <span class="q" data-readout="x">
          <M>
            x = <b>{fmt(x)}</b>
          </M>
        </span>
        <span class="q" data-readout="u">
          <M>
            u = {spS.gText} = <b>{fmt(u)}</b>
          </M>
        </span>
        <span class="q" data-readout="xarea">
          השטח משמאל, ב-x: <M>∫ₐˣ h dx = <b>{fmt(xArea)}</b></M>
        </span>
        <span class="q" data-readout="uarea">
          השטח מימין, ב-u: <M>∫ f du = <b>{fmt(uArea)}</b></M>
        </span>
        <span class="q" data-readout="equal">
          {equal ? 'שני השטחים שווים.' : 'השטחים שונים (לא אמור לקרות).'}
        </span>
        {setup.strip && (
          <>
            <span class="q" data-readout="widths">
              <M>
                dx = <b>{fmtDx(sp.dx)}</b>, du = <b>{fmtDx(sp.du)}</b>, du/dx = <b>{fmt(sp.widthRatio, 3)}</b>
              </M>
              , <M>g′(x) = {fmt(spS.gp(x), 3)}</M>
            </span>
            <span class="q" data-readout="strips">
              <M>
                h(x)·dx = <b>{fmtDx(sp.rx)}</b>, f(u)·du = <b>{fmtDx(sp.ru)}</b>
              </M>
            </span>
            <span class="q" data-readout="ratio">
              {Number.isNaN(sp.ratio) ? (
                'h(x) = 0 כאן: אין יחס בין הרצועות.'
              ) : (
                <>
                  היחס בין שטחי הרצועות: <M>f(u)·du / (h(x)·dx) = <b>{fmt(sp.ratio, 4)}</b></M>
                </>
              )}
            </span>
          </>
        )}
      </>
    );
  } else {
    const { t0, T } = setup;
    const { udv, vdu, rect } = partsAreas(setup.pP, t0, T);
    const uT = spP.u(T);
    const vT = spP.v(T);
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>{spP.text}</M>
        </span>
        <span class="q" data-readout="uv">
          <M>{spP.uvText}</M>, <M>v = {spP.vText}</M>
        </span>
        <span class="q" data-readout="range">
          <M>
            t₀ = <b>{fmt(t0)}</b>, T = <b>{fmt(T)}</b>
          </M>
        </span>
        <span class="q" data-readout="uT">
          <M>
            u(T) = <b>{fmt(uT)}</b>
          </M>
        </span>
        <span class="q" data-readout="vT">
          <M>
            v(T) = <b>{fmt(vT)}</b>
          </M>
        </span>
        <span class="q" data-readout="vdu">
          השטח שבין העקומה לציר u: <M>∫v du = <b>{fmt(vdu)}</b></M>
        </span>
        <span class="q" data-readout="udv">
          השטח שבין העקומה לציר v: <M>∫u dv = <b>{fmt(udv)}</b></M>
        </span>
        <span class="q" data-readout="sum">
          הסכום: <M>∫u dv + ∫v du = <b>{fmt(udv + vdu)}</b></M>
        </span>
        <span class="q" data-readout="rect">
          <M>
            u(T)v(T) − u(t₀)v(t₀) = <b>{fmt(rect)}</b>
          </M>
        </span>
        <span class="q" data-readout="identity">
          <M>
            ∫u dv = uv − ∫v du: {fmt(udv)} = {fmt(rect)} − {fmt(vdu)}
          </M>
        </span>
        {spP.note && (
          <span class="q" data-readout="note">
            {spP.note}
          </span>
        )}
      </>
    );
  }

  const presetIds: readonly string[] = setup.mode === 'subst' ? SUB_IDS : PARTS_IDS;
  const presetLabel = (id: string) => (isSubId(id) ? SUB[id].text : isPartsId(id) ? PARTS[id].text : id);
  const chosen = setup.mode === 'subst' ? setup.pS : setup.pP;
  const wx = spS.x;
  const wt = spP.t;

  return (
    <SimShell
      fig={props.id}
      label={label}
      canvasRef={canvasRef}
      aspect={aspect}
      live={live}
      tasks={tasks}
      cursor="ew-resize"
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
          <label class="ml-select" data-control="preset">
            <span class="ml-lab">האינטגרל</span>
            <select
              dir="ltr"
              value={chosen}
              onChange={(e) => {
                const v = (e.target as HTMLSelectElement).value;
                if (isSubId(v)) apply({ pS: v, a: SUB[v].a0, x: SUB[v].x0 });
                else if (isPartsId(v)) apply({ pP: v, t0: PARTS[v].t[0], T: PARTS[v].T0 });
              }}
            >
              {presetIds.map((id) => (
                <option key={id} value={id}>
                  {presetLabel(id)}
                </option>
              ))}
            </select>
          </label>
          {setup.mode === 'subst' && (
            <>
              <div class="group" role="group" aria-label="רצועה">
                <Toggle label="רצועה צרה" on={setup.strip} swatch="var(--accent)" onChange={(on) => apply({ strip: on })} />
              </div>
              <div class="ml-ctl" data-control="x">
                <Slider label="הנקודה x" value={setup.x} min={wx[0]} max={wx[1]} step={0.01} format={(v) => fmt(v, 3)} onChange={setX} />
              </div>
              <div class="ml-ctl" data-control="a">
                <Slider label="ההתחלה a" value={setup.a} min={wx[0]} max={wx[1]} step={0.01} format={(v) => fmt(v, 3)} onChange={setA} />
              </div>
              {setup.strip && (
                <div class="ml-ctl" data-control="dx">
                  <Slider
                    label="רוחב הרצועה dx (סרגל לוגריתמי)"
                    value={roundTo(Math.log10(setup.dx), DX_E_STEP)}
                    min={DX_E_MIN}
                    max={DX_E_MAX}
                    step={DX_E_STEP}
                    format={() => fmtDx(setup.dx)}
                    onChange={(e) => apply({ dx: dxOfE(e) })}
                  />
                </div>
              )}
            </>
          )}
          {setup.mode === 'parts' && (
            <>
              <div class="group" role="group" aria-label="צביעה">
                <Toggle label="צביעת שני השטחים" on={setup.split} swatch="var(--delta)" onChange={(on) => apply({ split: on })} />
              </div>
              <div class="ml-ctl" data-control="T">
                <Slider label="הנקודה T" value={setup.T} min={wt[0]} max={wt[1]} step={0.01} format={(v) => fmt(v, 3)} onChange={setT} />
              </div>
              <div class="ml-ctl" data-control="t0">
                <Slider label="ההתחלה t₀" value={setup.t0} min={wt[0]} max={wt[1]} step={0.01} format={(v) => fmt(v, 3)} onChange={setT0} />
              </div>
            </>
          )}
        </>
      }
    />
  );
}
