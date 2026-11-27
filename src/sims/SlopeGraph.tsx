/**
 * SlopeGraph (chapter 5.1 and 5.5): a function and its derivative in two panels, one above the other, sharing the
 * horizontal axis, with one cursor (a vertical line) through both. Maths: src/math/slopegraph.ts, whose stored facts
 * (the closed-form f′, the exact critical points and their kinds, the global extremes of a closed interval) drive every
 * verdict; nothing is read from pixels or from a grid. Canvases are math space and stay LTR; sliders are `dir="ltr"`.
 *
 * mode 'motion': a motion preset (ball, back-forth, fall). Top: the position against time; bottom: the velocity. The
 *                cursor t (drag on either panel, the arrow keys on the canvas, or the slider). With `tangent`, the
 *                tangent to the position graph at t (solid, --limit) with its slope m = v(t); on the bottom panel the
 *                point (t, v(t)) on the same vertical line. `vel` off hides the bottom panel behind the prompt
 *                "צפו קודם: איך ייראה גרף המהירות?". The button "הפעלה" runs t to the end of the domain (from the
 *                start when t is already at the end) and "עצירה" stops it; in still mode (motionAllowed() false) it
 *                does not move and says so, and the cursor stays static.
 * mode 'sign':   any preset. Top: f, solid where f′ > 0 and dashed where f′ < 0 (shape, not only colour; a legend
 *                in a row under the horizontal axis says which); bottom: f′, its positive part shaded and its negative
 *                part hatched. Labels on the canvas are kept inside their panel and moved off one another. The critical points
 *                (exact; as in lesson 5.5 only INTERIOR points of the domain, never an end) are filled dots on both
 *                panels, each labelled with its kind. An end of the domain where f′ = 0 anyway (box at 6, fall at 0)
 *                is a filled square labelled "קצה התחום", not a critical point. A cursor x. With `interval`, a closed
 *                interval [a, b] (two sliders) whose largest and smallest values (among a, b and the critical points
 *                inside) are marked: the max by an up-triangle, the min by a down-triangle.
 *
 * Props (defaults): id (required); mode ('motion'); modes (the mode buttons shown; default the starting mode only);
 * tasks ([]). preset (the preset of the STARTING mode: motion 'back-forth', sign 'cubic'; motion accepts only ball,
 * back-forth, fall); t (the preset's start: ball 0.5, back-forth 0.5, fall 1), vel (true), tangent (true);
 * x (the preset's start: cubic 0, x3 1, quartic 0, box 1, ball 0.5, back-forth 0.5, fall 1), interval (false),
 * a, b (the preset's default interval: cubic [−2, 2], x3 [−1.5, 1.5], quartic [−3, 2], box [0, 6], motion presets
 * their whole domain). t, x, a, b are clamped to the preset's domain and rounded (t, x to 0.01; a, b to 0.05, b ≥ a + 0.1).
 * Every prop is also a step key (`<Step fig=… set={{…}}>`); a key left out keeps its value. In a step `preset` names
 * a preset of the mode the step leaves the figure in (a new preset resets that mode's t, or x, a, b, to its defaults
 * unless the step gives them). A state set by a step never ticks a task, and a state that already had a task's
 * property when a step or reset made it must be left and found again. A step and the reset stop "הפעלה".
 *
 * Readouts (`data-readout`): motion: fn ("x(t) = t³ − 6t² + 9t"), t, x (the position, named by the preset: h for
 * ball), v, dir ("נע קדימה" / "נע אחורה" / "עוצר"); sign: fn (f and f′), x, fx, dfx, trend ("עולה" / "יורדת" /
 * "נקודה קריטית" at an interior critical point / "קצה התחום" at an end where f′ = 0), crit (the interior critical
 * points with kinds, exact; "אין נקודות קריטיות בתוך התחום" when there are none; ends are never listed), gmax, gmin
 * (with interval; the ends a, b are candidates as always).
 *
 * Tasks (ticked only inside the learner's own drag, key, slider or toggle; "הפעלה" never ticks one):
 *   motion: motion-rest (the cursor within 0.03 of a time where v = 0: a critical point or an end of the domain
 *           where v = 0, fall at t = 0), motion-back (the cursor at a time where
 *           v < 0), motion-vel (the learner turned vel on after moving the cursor at least once since the reset)
 *   sign:   sign-max (the cursor within 0.03 of a local max), sign-flat (the cursor within 0.03 of a critical point of
 *           kind none), sign-end (interval on, a, b set so that a critical point lies strictly inside and the largest
 *           or the smallest value is attained only at an end: cubic on [0, 3], max 18 at 3)
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import {
  SLOPE,
  critAt,
  critNear,
  extremumOnlyAtEnd,
  globalExtrema,
  isMotionId,
  isSlopeId,
  pieces,
  restNear,
  tangentAt,
  trendAt,
  type CritPoint,
  type Fn,
  type SlopeId,
} from '~/math/slopegraph';
import { markTask } from '~/progress/store';
import { motionAllowed } from '~/progress/settings';
import { subscribeSteps, type StepState } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { sci } from './core/format';
import { withAlpha } from './core/ink';
import { drawAxes, makePlot, type Box, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import './SlopeGraph.css';

export type SlopeMode = 'motion' | 'sign';

export interface SlopeGraphProps {
  id: string;
  mode?: SlopeMode;
  /** the mode buttons shown (default: the starting mode only) */
  modes?: SlopeMode[];
  /** the preset of the starting mode */
  preset?: string;
  t?: number;
  vel?: boolean;
  tangent?: boolean;
  x?: number;
  interval?: boolean;
  a?: number;
  b?: number;
  tasks?: string[];
}

interface Setup {
  mode: SlopeMode;
  pM: SlopeId;
  t: number;
  vel: boolean;
  tangent: boolean;
  pS: SlopeId;
  x: number;
  interval: boolean;
  a: number;
  b: number;
}

const ltr = (s: string) => String.fromCharCode(0x2066) + s.replace(/ /g, String.fromCharCode(0xa0)) + String.fromCharCode(0x2069);

const TASK_LABEL: Record<string, string> = {
  'motion-rest': 'הזיזו את הסמן לרגע שבו הגוף עוצר. מה השיפוע של המשיק ברגע הזה?',
  'motion-back': 'מצאו רגע שבו הגוף נע אחורה. מה הסימן של המהירות ברגע הזה?',
  'motion-vel': 'הזיזו את הסמן ונחשו איך ייראה גרף המהירות. אחר כך הדליקו "גרף מהירות" ובדקו.',
  'sign-max': `הזיזו את הסמן למקסימום מקומי של ${ltr('f')}. מה הסימן של ${ltr('f′')} משמאל לו ומימין לו?`,
  'sign-flat': `מצאו נקודה קריטית שאינה נקודת קיצון. מה קורה לסימן של ${ltr('f′')} משני צדיה?`,
  'sign-end': 'הדליקו "קטע סגור" ובחרו קטע שיש בתוכו נקודה קריטית, אבל הערך הגדול ביותר או הקטן ביותר מתקבל רק בקצה שלו.',
};

const MODE_LABEL: Record<SlopeMode, string> = { motion: 'מקום ומהירות', sign: 'סימן הנגזרת' };
const KIND_TEXT: Record<CritPoint['kind'], string> = { max: 'מקסימום מקומי', min: 'מינימום מקומי', none: 'לא נקודת קיצון' };
const KIND_SHORT: Record<CritPoint['kind'], string> = { max: 'מקסימום', min: 'מינימום', none: 'לא קיצון' };

const TAU = 2 * Math.PI;
const CUR_STEP = 0.01;
const END_STEP = 0.05;
const MIN_GAP = 0.1;
const NEAR = 0.03;
const SNAP = 0.02;
/** seconds of animation for a run through the whole domain */
const PLAY_SECONDS = 6;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const bool = (x: unknown): boolean | null => (typeof x === 'boolean' ? x : null);
const roundTo = (x: number, step: number) => Number((Math.round(x / step) * step).toPrecision(10));
const minus = (s: string) => s.replace(/-/g, '−');
/** a value to 4 significant figures, U+2212 for minus */
const fmt = (v: number, sig = 4) => (Number.isNaN(v) ? '—' : Math.abs(v) < 1e-12 ? '0' : minus(sci(v, sig)));
/** a cursor or an end: at most two decimals */
const fmtX = (v: number) => (Math.abs(v) < 1e-12 ? '0' : minus(String(Number(v.toFixed(2)))));

const curOf = (id: SlopeId, v: number) => clamp(roundTo(v, CUR_STEP), SLOPE[id].domain[0], SLOPE[id].domain[1]);

function fixInterval(id: SlopeId, a: number, b: number): [number, number] {
  const [lo, hi] = SLOPE[id].domain;
  let A = clamp(a, lo, hi);
  let B = clamp(b, lo, hi);
  if (B < A + MIN_GAP) {
    B = Math.min(hi, A + MIN_GAP);
    if (B < A + MIN_GAP) A = B - MIN_GAP;
  }
  return [A, B];
}

/* ---- tasks: `needs` = the learner's change must touch one of these keys; `event` tasks tick on the learner's act, the
 * others must be left and found again after a step or reset made the state */
interface Rule {
  needs: (keyof Setup)[];
  event?: boolean;
  state: (s: Setup, moved: boolean) => boolean;
}
const RULES: Record<string, Rule> = {
  'motion-rest': { needs: ['t'], state: (s) => s.mode === 'motion' && restNear(s.pM, s.t, NEAR) !== null },
  'motion-back': { needs: ['t'], state: (s) => s.mode === 'motion' && SLOPE[s.pM].df(s.t) < 0 },
  'motion-vel': { needs: ['vel'], event: true, state: (s, moved) => s.mode === 'motion' && s.vel && moved },
  'sign-max': { needs: ['x'], state: (s) => s.mode === 'sign' && critNear(s.pS, s.x, NEAR, ['max']) !== null },
  'sign-flat': { needs: ['x'], state: (s) => s.mode === 'sign' && critNear(s.pS, s.x, NEAR, ['none']) !== null },
  'sign-end': { needs: ['interval', 'a', 'b'], state: (s) => s.mode === 'sign' && s.interval && extremumOnlyAtEnd(s.pS, s.a, s.b) },
};

/* ---- canvas helpers */
function text(ctx: CanvasRenderingContext2D, p: Palette, s: string, x: number, y: number, o: { font: string; color?: string; align?: CanvasTextAlign; base?: CanvasTextBaseline; rtl?: boolean }) {
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
/** a filled mark with a paper rim */
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
/** a filled square: an end of the domain where f′ = 0 (a dot is a critical point) */
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
function triangle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, up: boolean, color: string, paper: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = paper;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y + (up ? -r : r));
  ctx.lineTo(x - r, y + (up ? r * 0.7 : -r * 0.7));
  ctx.lineTo(x + r, y + (up ? r * 0.7 : -r * 0.7));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
function clipTo(ctx: CanvasRenderingContext2D, box: Box) {
  ctx.beginPath();
  ctx.rect(box.x, box.y - 2, box.w, box.h + 4);
  ctx.clip();
}
/** y = f(x) over [lo, hi], clipped to the plot */
function strokeFn(ctx: CanvasRenderingContext2D, plot: Plot, f: Fn, lo: number, hi: number, color: string, width: number, dash: number[] = []) {
  const span = plot.y.max - plot.y.min;
  const n = Math.max(8, Math.ceil((360 * (hi - lo)) / (plot.x.max - plot.x.min)));
  ctx.save();
  clipTo(ctx, plot.box);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.setLineDash(dash);
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const x = lo + ((hi - lo) * i) / n;
    const y = clamp(f(x), plot.y.min - 3 * span, plot.y.max + 3 * span);
    if (i) ctx.lineTo(plot.px(x), plot.py(y));
    else ctx.moveTo(plot.px(x), plot.py(y));
  }
  ctx.stroke();
  ctx.restore();
}
/** the region between f′ and 0: the positive part shaded, the negative part hatched */
function signRegions(ctx: CanvasRenderingContext2D, plot: Plot, df: Fn, p: Palette) {
  const { box } = plot;
  const n = 360;
  const [lo, hi] = [plot.x.min, plot.x.max];
  const region = (part: (v: number) => number) => {
    ctx.beginPath();
    ctx.moveTo(plot.px(lo), plot.py(0));
    for (let i = 0; i <= n; i++) {
      const x = lo + ((hi - lo) * i) / n;
      ctx.lineTo(plot.px(x), plot.py(clamp(part(df(x)), plot.y.min, plot.y.max)));
    }
    ctx.lineTo(plot.px(hi), plot.py(0));
    ctx.closePath();
  };
  ctx.save();
  clipTo(ctx, box);
  region((v) => Math.max(v, 0));
  ctx.fillStyle = withAlpha(p.limit, 0.16);
  ctx.fill();
  ctx.restore();
  ctx.save();
  clipTo(ctx, box);
  region((v) => Math.min(v, 0));
  ctx.clip();
  ctx.strokeStyle = withAlpha(p.delta, 0.6);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let k = -box.h; k < box.w; k += 7) {
    ctx.moveTo(box.x + k, box.y + box.h);
    ctx.lineTo(box.x + k + box.h, box.y);
  }
  ctx.stroke();
  ctx.restore();
}

export default function SlopeGraph(props: SlopeGraphProps) {
  const startMode: SlopeMode = props.mode ?? 'motion';
  const modes: SlopeMode[] = props.modes ?? [startMode];
  const initial = (): Setup => {
    const pM: SlopeId = startMode === 'motion' && isMotionId(props.preset) ? props.preset : 'back-forth';
    const pS: SlopeId = startMode === 'sign' && isSlopeId(props.preset) ? props.preset : 'cubic';
    const [a, b] = fixInterval(pS, roundTo(props.a ?? SLOPE[pS].interval[0], END_STEP), roundTo(props.b ?? SLOPE[pS].interval[1], END_STEP));
    return {
      mode: startMode,
      pM,
      t: curOf(pM, props.t ?? SLOPE[pM].start),
      vel: props.vel ?? true,
      tangent: props.tangent ?? true,
      pS,
      x: curOf(pS, props.x ?? SLOPE[pS].start),
      interval: props.interval ?? false,
      a,
      b,
    };
  };
  const [setup, setSetup] = useState<Setup>(initial);
  const cur = useRef(setup);
  const [live, setLive] = useState('');
  const [narrow, setNarrow] = useState(false);
  const [playing, setPlayingState] = useState(false);
  /** read by the animation loop, so that a stop (the learner, a step, the reset) holds before the next frame */
  const playRef = useRef(false);
  const setPlaying = (on: boolean) => {
    playRef.current = on;
    setPlayingState(on);
  };
  const plotRef = useRef<Plot | null>(null);
  const dragging = useRef(false);
  /** the learner has moved the motion cursor since the last reset (for motion-vel) */
  const moved = useRef(false);
  /** tasks whose state held when the last step or reset made it: they must be left and found again */
  const held = useRef<Set<string>>(new Set());

  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const done = (t: string) => {
    if (props.tasks?.includes(t)) markTask(`${props.id}:${t}`);
  };
  const rebase = (s: Setup) => {
    held.current = new Set((props.tasks ?? []).filter((id) => RULES[id] && !RULES[id].event && RULES[id].state(s, moved.current)));
  };
  const commit = (s: Setup) => {
    cur.current = s;
    setSetup(s);
  };
  useEffect(() => rebase(cur.current), []);

  useEffect(
    () =>
      subscribeSteps(props.id, (st: StepState) => {
        setPlaying(false);
        const prev = cur.current;
        const mode = typeof st.mode === 'string' && modes.includes(st.mode as SlopeMode) ? (st.mode as SlopeMode) : prev.mode;
        const next: Setup = { ...prev, mode };
        const preset = st.preset;
        next.vel = bool(st.vel) ?? prev.vel;
        next.tangent = bool(st.tangent) ?? prev.tangent;
        next.interval = bool(st.interval) ?? prev.interval;
        if (mode === 'motion') {
          const fresh = isMotionId(preset) && preset !== prev.pM;
          if (isMotionId(preset)) next.pM = preset;
          next.t = curOf(next.pM, num(st.t) ?? (fresh ? SLOPE[next.pM].start : prev.t));
        } else {
          const fresh = isSlopeId(preset) && preset !== prev.pS;
          if (isSlopeId(preset)) next.pS = preset;
          next.x = curOf(next.pS, num(st.x) ?? (fresh ? SLOPE[next.pS].start : prev.x));
          const a = num(st.a);
          const b = num(st.b);
          const d = SLOPE[next.pS].interval;
          const [A, B] = fixInterval(next.pS, roundTo(a ?? (fresh ? d[0] : prev.a), END_STEP), roundTo(b ?? (fresh ? d[1] : prev.b), END_STEP));
          next.a = A;
          next.b = B;
        }
        commit(next);
        rebase(next);
      }),
    [props.id],
  );

  /* ---------------------------------------------------------------- play (respects motionAllowed()) */
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      if (!playRef.current) return;
      const c = cur.current;
      if (!motionAllowed() || c.mode !== 'motion') {
        setPlaying(false);
        commit({ ...c, t: curOf(c.pM, c.t) });
        return;
      }
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      const [lo, hi] = SLOPE[c.pM].domain;
      const t = c.t + (dt * (hi - lo)) / PLAY_SECONDS;
      if (t >= hi) {
        commit({ ...c, t: hi });
        setPlaying(false);
        return;
      }
      commit({ ...c, t });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const s0 = setup;
  const id0: SlopeId = s0.mode === 'motion' ? s0.pM : s0.pS;

  /* ---------------------------------------------------------------- drawing */
  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    const nar = view.w < 520;
    const fs = nar ? 11 : 12;
    const font = (w8: number, size = fs) => `${w8} ${size}px ${p.fontUi}`;
    const sp = SLOPE[id0];
    const [lo, hi] = sp.domain;
    const motion = s0.mode === 'motion';
    const mv = sp.motion;
    const top = nar ? 44 : 20;
    const gap = nar ? 16 : 18;
    // sign mode keeps a row under the horizontal axis title for the legend (solid = increasing, dashed = decreasing)
    const bottom = motion ? 40 : 62;
    const L = 52;
    const R = 16;
    const inner = Math.max(40, view.h - top - gap - bottom);
    const hTop = Math.round(inner / 2);
    const boxF: Box = { x: L, y: top, w: Math.max(1, view.w - L - R), h: hTop };
    const boxD: Box = { x: L, y: top + hTop + gap, w: boxF.w, h: inner - hTop };
    const xName = motion && mv ? mv.t : sp.arg;
    const fLabel = motion && mv ? `${mv.x} (${mv.unitX})` : `${sp.name}(${sp.arg})`;
    const dLabel = motion && mv ? `${mv.v} (${mv.unitV})` : `${sp.name}′(${sp.arg})`;
    const xLabel = motion && mv ? `${mv.t} (${mv.unitT})` : sp.arg;
    // the bottom panel carries the shared horizontal axis; with it hidden (motion, vel off) the top panel takes the ticks
    const showD = !motion || s0.vel;
    const plotF = makePlot(boxF, { min: lo, max: hi, format: showD ? () => '' : undefined }, { min: sp.yf[0], max: sp.yf[1], label: fLabel });
    const plotD = makePlot(boxD, { min: lo, max: hi, label: xLabel }, { min: sp.ydf[0], max: sp.ydf[1], label: dLabel });
    plotRef.current = plotF;
    const PX = plotF.px;
    const cx = motion ? s0.t : s0.x;
    const inF = (sy: number) => sy >= boxF.y - 1 && sy <= boxF.y + boxF.h + 1;
    const inD = (sy: number) => sy >= boxD.y - 1 && sy <= boxD.y + boxD.h + 1;

    /* labels: kept inside their box and moved off the labels and marks already placed */
    type Rect = { x0: number; y0: number; x1: number; y1: number };
    const taken: Rect[] = [];
    const lh = fs + 4;
    const hit = (r: Rect) => taken.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0);
    const mark = (x: number, y: number, r: number) => taken.push({ x0: x - r, y0: y - r, x1: x + r, y1: y + r });
    const place = (
      s: string,
      x: number,
      y: number,
      within: Box,
      o: { align: CanvasTextAlign; color: string; rtl?: boolean; size?: number },
    ) => {
      const f = font(700, o.size ?? fs);
      ctx.save();
      ctx.font = f;
      const w = ctx.measureText(s).width;
      ctx.restore();
      const left = (xx: number) => (o.align === 'left' ? xx : o.align === 'right' ? xx - w : xx - w / 2);
      let xx = x;
      if (left(xx) < within.x + 2) xx += within.x + 2 - left(xx);
      if (left(xx) + w > within.x + within.w - 2) xx -= left(xx) + w - (within.x + within.w - 2);
      const yLo = within.y + Math.min(lh, within.h) / 2;
      const yHi = within.y + within.h - Math.min(lh, within.h) / 2;
      const rect = (yy: number): Rect => ({ x0: left(xx) - 2, y0: yy - lh / 2, x1: left(xx) + w + 2, y1: yy + lh / 2 });
      let yy = clamp(y, yLo, yHi);
      for (const k of [0, -1, 1, -2, 2, -3, 3]) {
        const c = clamp(y + k * lh, yLo, yHi);
        if (!hit(rect(c))) {
          yy = c;
          break;
        }
      }
      taken.push(rect(yy));
      text(ctx, p, s, xx, yy, { font: f, color: o.color, align: o.align, rtl: o.rtl });
    };

    // the interval band behind both panels
    const gx = !motion && s0.interval ? globalExtrema(s0.pS, s0.a, s0.b) : null;
    if (gx) {
      ctx.save();
      ctx.fillStyle = withAlpha(p.curve2, 0.09);
      ctx.fillRect(PX(s0.a), boxF.y, PX(s0.b) - PX(s0.a), boxF.h);
      ctx.fillRect(PX(s0.a), boxD.y, PX(s0.b) - PX(s0.a), boxD.h);
      ctx.restore();
    }

    // top panel: f
    drawAxes(ctx, plotF, p);
    if (sp.yf[0] < 0 && sp.yf[1] > 0) line(ctx, boxF.x, plotF.py(0), boxF.x + boxF.w, plotF.py(0), p.ink3, 1.2);
    if (motion) {
      strokeFn(ctx, plotF, sp.f, lo, hi, p.curve, 2.6);
    } else {
      for (const pc of pieces(s0.pS)) strokeFn(ctx, plotF, sp.f, pc.lo, pc.hi, p.curve, 2.6, pc.sign > 0 ? [] : [8, 6]);
      // the legend, in its own row under the axis title (never over a curve): solid = increasing, dashed = decreasing
      ctx.save();
      ctx.font = font(600);
      const items: [string, number[]][] = [
        ['עולה', []],
        ['יורדת', [8, 6]],
      ];
      const widths = items.map(([w]) => 26 + 6 + ctx.measureText(w).width);
      ctx.restore();
      const sep = 22;
      let lx = boxD.x + boxD.w / 2 - (widths[0] + widths[1] + sep) / 2;
      const ly = boxD.y + boxD.h + 52;
      items.forEach(([w, dash], i) => {
        line(ctx, lx, ly, lx + 26, ly, p.curve, 2.6, dash);
        text(ctx, p, w, lx + 32, ly, { font: font(600), align: 'left', rtl: true });
        lx += widths[i] + sep;
      });
    }

    // bottom panel: f′ (hidden in motion mode when vel is off)
    if (showD) {
      drawAxes(ctx, plotD, p);
      signRegions(ctx, plotD, sp.df, p);
      line(ctx, boxD.x, plotD.py(0), boxD.x + boxD.w, plotD.py(0), p.ink2, 1.4);
      strokeFn(ctx, plotD, sp.df, lo, hi, p.limit, 2.6);
    } else {
      ctx.save();
      ctx.strokeStyle = p.ink3;
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 1.2;
      ctx.strokeRect(boxD.x, boxD.y, boxD.w, boxD.h);
      ctx.restore();
      text(ctx, p, 'צפו קודם: איך ייראה גרף המהירות?', boxD.x + boxD.w / 2, boxD.y + boxD.h / 2, { font: font(700, fs + 2), color: p.ink2, rtl: true });
      // the time axis title still belongs to the shared axis
      text(ctx, p, xLabel, boxD.x + boxD.w / 2, boxD.y + boxD.h + 28, { font: font(600), rtl: true });
    }

    // critical points (sign mode): filled dots on both panels, labelled with their kind
    if (!motion) {
      for (const c of sp.crit) {
        const sx = PX(c.x);
        const sy = plotF.py(c.value);
        if (inF(sy)) {
          dot(ctx, sx, sy, 5.5, p.curve, p.paper);
          mark(sx, sy, 6);
          // the kind on the side away from the interval's markers (max: triangles above, min: below)
          const above = c.kind === 'min';
          place(KIND_SHORT[c.kind], sx, sy + (above ? -16 : 17), boxF, { align: 'center', color: p.ink, rtl: true });
        }
        const zy = plotD.py(0);
        if (inD(zy)) dot(ctx, sx, zy, 5, p.limit, p.paper);
      }
      // an end of the domain where f′ = 0: a square (not a critical point), labelled as an end
      for (const e of sp.flatEnds) {
        const sx = PX(e.x);
        const sy = plotF.py(e.value);
        if (inF(sy)) {
          square(ctx, sx, sy, 5, p.curve, p.paper);
          mark(sx, sy, 6);
          const right = e.x === lo;
          // well above the square: an interval's min or max label sits beside it at the panel's edge
          place('קצה התחום', sx + (right ? 10 : -10), sy - 24, boxF, { align: right ? 'left' : 'right', color: p.ink2, rtl: true });
        }
        const zy = plotD.py(0);
        if (inD(zy)) square(ctx, sx, zy, 4.5, p.limit, p.paper);
      }
    }

    // the global extremes of [a, b]
    if (gx) {
      line(ctx, PX(s0.a), boxF.y, PX(s0.a), boxD.y + boxD.h, withAlpha(p.curve2, 0.9), 1.6);
      line(ctx, PX(s0.b), boxF.y, PX(s0.b), boxD.y + boxD.h, withAlpha(p.curve2, 0.9), 1.6);
      // the names a and b in the strip between the panels, inside the interval beside their lines (outside it when the
      // interval is too narrow for both), kept inside the plot's width
      const strip: Box = { x: boxF.x, y: boxF.y + boxF.h, w: boxF.w, h: gap };
      const roomy = PX(s0.b) - PX(s0.a) > 42;
      place('a', PX(s0.a) + (roomy ? 10 : -6), strip.y + gap / 2, strip, { align: roomy ? 'left' : 'right', color: p.curve2 });
      place('b', PX(s0.b) + (roomy ? -10 : 6), strip.y + gap / 2, strip, { align: roomy ? 'right' : 'left', color: p.curve2 });
      const extreme = (e: typeof gx.max, up: boolean) => {
        const sy = plotF.py(e.value);
        if (!inF(sy)) return;
        for (const xv of e.at) {
          triangle(ctx, PX(xv), sy + (up ? -9 : 9), 7, up, p.curve2, p.paper);
          mark(PX(xv), sy + (up ? -9 : 9), 7);
        }
        // beside the last triangle, towards the middle of the panel
        const sxv = PX(e.at[e.at.length - 1]);
        const left = sxv > boxF.x + boxF.w / 2;
        place(`${up ? 'max' : 'min'} = ${fmt(e.value)}`, sxv + (left ? -13 : 13), sy + (up ? -9 : 9), boxF, { align: left ? 'right' : 'left', color: p.curve2 });
      };
      extreme(gx.max, true);
      extreme(gx.min, false);
    }

    // the cursor through both panels
    const sx = PX(cx);
    line(ctx, sx, boxF.y, sx, showD ? boxD.y + boxD.h : boxF.y + boxF.h, p.ink2, 1.3, [3, 3]);
    const fy = plotF.py(sp.f(cx));
    if (motion && s0.tangent) {
      const tl = tangentAt(s0.pM, cx);
      ctx.save();
      clipTo(ctx, boxF);
      line(ctx, PX(lo), plotF.py(tl.at(lo)), PX(hi), plotF.py(tl.at(hi)), p.limit, 2.2);
      ctx.restore();
      if (inF(fy)) {
        const right = sx < boxF.x + boxF.w * 0.6;
        text(ctx, p, `m = ${fmt(tl.m, 3)}`, sx + (right ? 12 : -12), fy + (tl.m > 0 ? 16 : -16), { font: font(700, fs + 1), color: p.limit, align: right ? 'left' : 'right' });
      }
    }
    if (inF(fy)) dot(ctx, sx, fy, 6, p.curve, p.paper);
    if (showD) {
      const dy = plotD.py(sp.df(cx));
      if (inD(dy)) {
        line(ctx, sx, plotD.py(0), sx, dy, p.limit, 2.4);
        dot(ctx, sx, dy, 6, p.limit, p.paper);
      }
    }
    if (motion && showD) {
      // beside the dashed cursor, not on it (to its left in the right part of the plot)
      const strip: Box = { x: boxF.x, y: boxF.y + boxF.h, w: boxF.w, h: gap };
      const onLeft = sx > boxF.x + boxF.w * 0.7;
      place(`${xName} = ${fmtX(cx)}`, sx + (onLeft ? -6 : 6), strip.y + gap / 2, strip, { align: onLeft ? 'right' : 'left', color: p.ink2 });
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
  const aspect = narrow ? 0.74 : 1.15;

  /* ---------------------------------------------------------------- learner changes */
  /** The learner changed the figure: apply, then tick whatever the new state completes. */
  const apply = (patch: Partial<Setup>) => {
    if (playRef.current && ('t' in patch || 'mode' in patch)) setPlaying(false);
    const prev = cur.current;
    const next: Setup = { ...prev, ...patch };
    if ('t' in patch && next.mode === 'motion') moved.current = true;
    commit(next);
    for (const id of props.tasks ?? []) {
      const rule = RULES[id];
      if (!rule) continue;
      if (!rule.state(next, moved.current)) {
        held.current.delete(id);
        continue;
      }
      if (!rule.needs.some((key) => key in patch)) continue;
      if (!rule.event && held.current.has(id)) continue;
      done(id);
    }
  };

  /** move the cursor of the current mode (snap: pointer drags snap to a critical point within 0.02) */
  const moveCursor = (v: number, snap: boolean) => {
    const c = cur.current;
    const pid = c.mode === 'motion' ? c.pM : c.pS;
    let nv = curOf(pid, v);
    if (snap) {
      const near = restNear(pid, v, SNAP);
      if (near !== null) nv = near;
    }
    if (c.mode === 'motion') {
      if (nv !== c.t) apply({ t: nv });
    } else if (nv !== c.x) apply({ x: nv });
  };

  const fromPointer = (e: PointerEvent) => {
    const plot = plotRef.current;
    if (!plot) return;
    const x = plot.x.min + ((e.offsetX - plot.box.x) / plot.box.w) * (plot.x.max - plot.x.min);
    moveCursor(x, true);
  };
  const onPointerDown = (e: PointerEvent) => {
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    fromPointer(e);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (dragging.current) fromPointer(e);
  };
  const onPointerUp = () => {
    if (dragging.current) setLive(describe(cur.current));
    dragging.current = false;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const c = cur.current;
    const step = (e.shiftKey ? 10 : 1) * CUR_STEP * (e.key === 'ArrowRight' ? 1 : -1);
    moveCursor((c.mode === 'motion' ? c.t : c.x) + step, false);
    setLive(describe(cur.current));
  };

  const play = () => {
    if (!motionAllowed()) {
      setLive('מצב שקט: התנועה לא מוצגת. הזיזו את הזמן בפס.');
      return;
    }
    const c = cur.current;
    const [lo, hi] = SLOPE[c.pM].domain;
    if (c.t >= hi) commit({ ...c, t: lo });
    setPlaying(true);
  };
  const stop = () => {
    setPlaying(false);
    const c = cur.current;
    commit({ ...c, t: curOf(c.pM, c.t) });
  };

  /* ---------------------------------------------------------------- text */
  const M = (q: { children: ComponentChildren }) => <bdi dir="ltr">{q.children}</bdi>;
  const sp = SLOPE[id0];
  const mv = sp.motion;

  const dirText = (s: Setup): string => {
    const tr = trendAt(s.pM, s.t);
    return tr === 'up' ? 'נע קדימה' : tr === 'down' ? 'נע אחורה' : 'עוצר';
  };
  const trendText = (s: Setup): string => {
    const tr = trendAt(s.pS, s.x);
    return tr === 'up' ? 'עולה' : tr === 'down' ? 'יורדת' : tr === 'end' ? 'קצה התחום' : 'נקודה קריטית';
  };

  function describe(s: Setup): string {
    const q = SLOPE[s.mode === 'motion' ? s.pM : s.pS];
    if (s.mode === 'motion' && q.motion) {
      const m = q.motion;
      return `${m.t} = ${fmtX(s.t)} ${m.unitT}: ${m.x} = ${fmt(q.f(s.t))} ${m.unitX}, ${m.v} = ${fmt(q.df(s.t))} ${m.unitV}, ${dirText(s)}.`;
    }
    return `${q.arg} = ${fmtX(s.x)}: ${q.name} = ${fmt(q.f(s.x))}, הנגזרת ${fmt(q.df(s.x))}, ${trendText(s)}.`;
  }

  const label =
    setup.mode === 'motion' && mv
      ? `איור חי: למעלה גרף המקום ${mv.x}(t) = ${sp.text}, למטה גרף המהירות ${mv.v}(t), על אותו ציר זמן. קו אנכי מסמן את הרגע t בשני הגרפים. המשיק לגרף המקום ברגע t ושיפועו m, השווה למהירות באותו רגע. המהירות מחושבת מנוסחה מדויקת.`
      : `איור חי: למעלה הפונקציה ${sp.name}(${sp.arg}) = ${sp.text}, בקו מלא היכן שהיא עולה ובקו מקווקו היכן שהיא יורדת. למטה הנגזרת ${sp.name}′(${sp.arg}) = ${sp.dfText}: החלק החיובי צבוע והחלק השלילי מקווקו באלכסון. הנקודות הקריטיות, מדויקות, מסומנות בנקודות מלאות בשני הגרפים.${sp.flatEnds.length ? ' קצה של התחום שבו הנגזרת מתאפסת מסומן בריבוע: הוא אינו נקודה קריטית.' : ''}${setup.interval ? ' בקטע הסגור הערך הגדול ביותר מסומן במשולש למעלה והקטן ביותר במשולש למטה.' : ''}`;

  let readout: ComponentChildren;
  if (setup.mode === 'motion' && mv) {
    const v = sp.df(setup.t);
    const tr = trendAt(setup.pM, setup.t);
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>
            {mv.x}(t) = {sp.text}
          </M>
        </span>
        <span class="q" data-readout="t">
          <M>
            {mv.t} = <b>{fmtX(setup.t)}</b>
          </M>{' '}
          {mv.unitT}
        </span>
        <span class="q" data-readout="x">
          <M>
            {mv.x} = <b>{fmt(sp.f(setup.t))}</b>
          </M>{' '}
          {mv.unitX}
        </span>
        <span class="q" data-readout="v">
          <M>
            {mv.v} = <b>{fmt(v)}</b>
          </M>{' '}
          {mv.unitV}
        </span>
        <span class="q" data-readout="dir">
          <b>{dirText(setup)}</b> (<M>{tr === 'up' ? 'v > 0' : tr === 'down' ? 'v < 0' : 'v = 0'}</M>)
        </span>
      </>
    );
  } else {
    const xv = setup.x;
    const tr = trendAt(setup.pS, xv);
    const at = critAt(setup.pS, xv);
    const g = setup.interval ? globalExtrema(setup.pS, setup.a, setup.b) : null;
    const iv = `[${fmtX(setup.a)}, ${fmtX(setup.b)}]`;
    const ext = (e: NonNullable<typeof g>['max'], big: boolean) => (
      <>
        {big ? 'הערך הגדול ביותר' : 'הערך הקטן ביותר'} ב-<M>{iv}</M>: <b>{fmt(e.value)}</b>, מתקבל ב-<M>{sp.arg} = {e.at.map(fmtX).join(', ')}</M>
        {e.endOnly ? ' (רק בקצה)' : ''}
      </>
    );
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>
            {sp.name}({sp.arg}) = {sp.text}
          </M>
          , <M>
            {sp.name}′({sp.arg}) = {sp.dfText}
          </M>
        </span>
        <span class="q" data-readout="x">
          <M>
            {sp.arg} = <b>{fmtX(xv)}</b>
          </M>
        </span>
        <span class="q" data-readout="fx">
          <M>
            {sp.name}({sp.arg}) = <b>{fmt(sp.f(xv))}</b>
          </M>
        </span>
        <span class="q" data-readout="dfx">
          <M>
            {sp.name}′({sp.arg}) = <b>{fmt(sp.df(xv))}</b>
          </M>
        </span>
        <span class="q" data-readout="trend">
          {tr === 'crit' ? (
            <>
              <b>נקודה קריטית</b> (<M>{sp.name}′ = 0</M>){at ? `: ${KIND_TEXT[at.kind]}` : ''}
            </>
          ) : tr === 'end' ? (
            <>
              <b>קצה התחום</b> (<M>{sp.name}′ = 0</M>): קצה אינו נקודה קריטית
            </>
          ) : (
            <>
              הפונקציה <b>{tr === 'up' ? 'עולה' : 'יורדת'}</b> (<M>{sp.name}′ {tr === 'up' ? '>' : '<'} 0</M>)
            </>
          )}
        </span>
        <span class="q" data-readout="crit">
          {sp.crit.length === 0 ? 'אין נקודות קריטיות בתוך התחום.' : 'נקודות קריטיות (מדויק): '}
          {sp.crit.map((c, i) => (
            <span key={c.x}>
              {i ? '; ' : ''}
              <M>
                {sp.arg} = {fmtX(c.x)}
              </M>
              : {KIND_TEXT[c.kind]}, <M>
                {sp.name}({fmtX(c.x)}) = {c.valueText}
              </M>
            </span>
          ))}
        </span>
        {g && (
          <>
            <span class="q" data-readout="gmax">
              {ext(g.max, true)}
            </span>
            <span class="q" data-readout="gmin">
              {ext(g.min, false)}
            </span>
          </>
        )}
      </>
    );
  }

  const lo = sp.domain[0];
  const hi = sp.domain[1];

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
        setPlaying(false);
        moved.current = false;
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
          {setup.mode === 'motion' && mv && (
            <>
              <Slider
                label={`הזמן ${mv.t}`}
                value={roundTo(setup.t, CUR_STEP)}
                min={lo}
                max={hi}
                step={CUR_STEP}
                format={(v) => `${fmtX(v)} ${mv.unitT}`}
                onChange={(v) => moveCursor(v, false)}
              />
              <div class="group" role="group" aria-label="מה להציג">
                <Toggle label="גרף מהירות" on={setup.vel} swatch="var(--limit)" onChange={(on) => apply({ vel: on })} />
                <Toggle label="המשיק" on={setup.tangent} swatch="var(--limit)" onChange={(on) => apply({ tangent: on })} />
              </div>
              <div class="group" role="group" aria-label="הפעלה">
                <button type="button" class="btn primary" onClick={play}>
                  הפעלה
                </button>
                {playing && (
                  <button type="button" class="btn" onClick={stop}>
                    עצירה
                  </button>
                )}
              </div>
            </>
          )}
          {setup.mode === 'sign' && (
            <>
              <Slider label={`הנקודה ${sp.arg}`} value={setup.x} min={lo} max={hi} step={CUR_STEP} format={(v) => fmtX(v)} onChange={(v) => moveCursor(v, false)} />
              <div class="group" role="group" aria-label="מה להציג">
                <Toggle label="קטע סגור" on={setup.interval} swatch="var(--curve-2)" onChange={(on) => apply({ interval: on })} />
              </div>
              {setup.interval && (
                <>
                  <Slider
                    label="הקצה השמאלי a"
                    value={setup.a}
                    min={lo}
                    max={hi}
                    step={END_STEP}
                    format={(v) => fmtX(v)}
                    onChange={(v) => {
                      const [a, b] = fixInterval(setup.pS, roundTo(v, END_STEP), setup.b);
                      apply({ a, b });
                    }}
                  />
                  <Slider
                    label="הקצה הימני b"
                    value={setup.b}
                    min={lo}
                    max={hi}
                    step={END_STEP}
                    format={(v) => fmtX(v)}
                    onChange={(v) => {
                      const [a, b] = fixInterval(setup.pS, setup.a, roundTo(v, END_STEP));
                      apply({ a, b });
                    }}
                  />
                </>
              )}
            </>
          )}
        </>
      }
    />
  );
}
