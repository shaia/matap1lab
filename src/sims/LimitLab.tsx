/**
 * LimitLab (chapter 4.6, limits and continuity): three modes on one plot. Maths: src/math/limits.ts, whose stored facts
 * (one-sided limits, f(a), the classification, the extremes) drive every verdict; nothing is inferred from the table.
 * Canvases are math space and stay LTR; sliders for math quantities are `dir="ltr"`.
 *
 * mode 'approach': a preset near a point a; the points x = a − h (filled circle) and x = a + h (filled square) with a
 *                  table of the values of every decade of h passed (h from 1 down to 10⁻⁶, a log slider; the canvas
 *                  can be dragged horizontally too). f(a) is filled when defined, a hole is hollow. `classify` shows
 *                  the verdict (continuous / removable / jump / infinite / no limit) with the one-sided limits;
 *                  `fill` (removable presets only) fills the hole with the limit. sin(1/x) is drawn honestly: where
 *                  the oscillations are narrower than ~3 px the band is filled (and the readout says so).
 * mode 'ivt':      a preset f on [a, b] and a level k (a dashed line; drag it or use the arrow keys); the points c with
 *                  f(c) = k are marked (a probe, except for 1/x); "חצייה" halves the current interval keeping the
 *                  half where f − k changes sign (Enter or Space on the canvas does the same).
 * mode 'extreme':  a preset f on an interval whose ends are each closed or open (toggles); the largest and smallest
 *                  values are filled when attained and hollow with "לא מתקבל" when only approached.
 *
 * Props (defaults): id (required); mode ('approach'); modes (the mode buttons shown; default the starting mode only);
 * tasks ([]). preset (the preset of the STARTING mode: approach 'removable-p3', ivt 'cubic', extreme 'x2'),
 * h (1e-1; 10⁻⁶ ≤ h ≤ 1), classify (false), fill (false), a, b (the interval of ivt or of extreme: the preset's
 * default), k (ivt: 0), leftClosed, rightClosed (true).
 * Every prop is also a step key (`<Step fig=… set={{…}}>`); a key left out keeps its value. In a step `preset` names a
 * preset of the mode the step leaves the figure in (a new preset resets that mode's a, b, k to its defaults unless the
 * step gives them); `a`, `b` go to the ivt or the extreme interval according to that mode. A state set by a step never
 * ticks a task, and a state that already had a task's property when a step or reset made it must be left and found
 * again.
 *
 * Tasks (ticked only inside the learner's own drag, key, button, slider or toggle):
 *   approach: approach-close (h ≤ 10⁻³), approach-jump (jump-p6 or sign, h ≤ 10⁻²), approach-fill (fill turned on for a
 *             removable preset)
 *   ivt:      ivt-bisect (presses bring the interval of a continuous preset to length ≤ 1/64), ivt-fail (preset recip,
 *             presses make the interval collapse onto the pole or shrink to length ≤ 1/64)
 *   extreme:  extreme-open (a toggle opens an end and the max or the min is no longer attained), extreme-closed (a toggle
 *             closes an end and both are attained)
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import {
  APPROACH,
  EXTREME,
  IVT,
  approachRows,
  bisectInit,
  bisectStep,
  decadesPassed,
  extremes,
  isApproachId,
  isExtId,
  isIvtId,
  isRemovable,
  leftIncluded,
  levelPoints,
  signChanges,
  type ApproachId,
  type BisectState,
  type ExtId,
  type Fn,
  type IvtId,
  type OneSided,
} from '~/math/limits';
import { niceAngle } from '~/math/coords';
import { markTask } from '~/progress/store';
import { subscribeSteps, type StepState } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { sci } from './core/format';
import { withAlpha } from './core/ink';
import { drawAxes, insetBox, makePlot, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import './LimitLab.css';

export type LimitMode = 'approach' | 'ivt' | 'extreme';

export interface LimitLabProps {
  id: string;
  mode?: LimitMode;
  /** the mode buttons shown (default: the starting mode only) */
  modes?: LimitMode[];
  /** the preset of the starting mode */
  preset?: string;
  h?: number;
  classify?: boolean;
  fill?: boolean;
  a?: number;
  b?: number;
  k?: number;
  leftClosed?: boolean;
  rightClosed?: boolean;
  tasks?: string[];
}

interface Setup {
  mode: LimitMode;
  pA: ApproachId;
  h: number;
  classify: boolean;
  fill: boolean;
  pI: IvtId;
  ia: number;
  ib: number;
  k: number;
  bis: BisectState;
  pE: ExtId;
  ea: number;
  eb: number;
  lc: boolean;
  rc: boolean;
}

const ltr = (s: string) => String.fromCharCode(0x2066) + s.replace(/ /g, String.fromCharCode(0xa0)) + String.fromCharCode(0x2069);

const TASK_LABEL: Record<string, string> = {
  'approach-close': `צמצמו את h עד ${ltr('10⁻³')} או פחות. מה קורה לערכים בטבלה?`,
  'approach-jump': `בפונקציה עם קפיצה צמצמו את h עד ${ltr('10⁻²')} או פחות. השוו את הערכים משמאל לערכים מימין.`,
  'approach-fill': 'הדליקו "סגירת החור". איזה ערך סוגר אותו?',
  'ivt-bisect': `לחצו "חצייה" שוב ושוב עד שאורך הקטע קטן מ-${ltr('1/64')}.`,
  'ivt-fail': 'ב-1/x לחצו "חצייה" עד שהקטע מתכווץ. לאן הוא הולך, ומה קורה לפונקציה שם?',
  'extreme-open': 'פתחו קצה של הקטע. איזה ערך קיצוני כבר לא מתקבל?',
  'extreme-closed': 'סגרו את שני הקצוות. האם שני הערכים הקיצוניים מתקבלים?',
};

const MODE_LABEL: Record<LimitMode, string> = { approach: 'התקרבות', ivt: 'משפט ערך הביניים', extreme: 'ערכים קיצוניים' };

const TAU = 2 * Math.PI;
const E_MAX = 6;
const E_STEP = 0.25;
const MIN_GAP = 0.1;
const LEN_TARGET = 1 / 64;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const bool = (x: unknown): boolean | null => (typeof x === 'boolean' ? x : null);
const roundTo = (x: number, step: number) => Number((Math.round(x / step) * step).toPrecision(10));
const minus = (s: string) => s.replace(/-/g, '−');
const fmt = (x: number, sig = 3) => (Number.isNaN(x) ? '—' : Math.abs(x) < 5e-4 ? '0' : minus(sci(x, sig)));
const fmtTab = (x: number) => (Number.isNaN(x) ? '—' : x === 0 ? '0' : minus(sci(x, 7)));
const hOfE = (e: number) => 10 ** -e;
const eOfH = (h: number) => -Math.log10(h);
const clampH = (h: number) => clamp(h, 1e-6, 1);
const SUP_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const fmtH = (h: number) => {
  const e = eOfH(h);
  if (Math.abs(e - Math.round(e)) > 1e-9) return fmt(h, 2);
  const n = Math.round(e);
  return '10' + (n === 0 ? '⁰' : '⁻' + String(n).replace(/\d/g, (d) => SUP_DIGITS[Number(d)]));
};
const lim = (v: number) => (Math.abs(v + 0.5) < 1e-12 ? '−1/2' : fmt(v));
const sideText = (o: OneSided) => (o.kind === 'finite' ? lim(o.value) : o.kind === 'inf' ? (o.sign > 0 ? '+∞' : '−∞') : 'לא קיים');

function fixIvt(id: IvtId, a: number, b: number): [number, number] {
  const [lo, hi] = IVT[id].window.x;
  let A = clamp(a, lo, hi);
  let B = clamp(b, lo, hi);
  if (B < A + MIN_GAP) {
    B = Math.min(hi, A + MIN_GAP);
    if (B < A + MIN_GAP) A = B - MIN_GAP;
  }
  return [A, B];
}
function fixExt(id: ExtId, a: number, b: number): [number, number] {
  const s = EXTREME[id];
  let A = clamp(a, s.aRange[0], s.aRange[1]);
  let B = clamp(b, s.bRange[0], s.bRange[1]);
  if (B < A + MIN_GAP) {
    B = Math.min(s.bRange[1], A + MIN_GAP);
    if (B < A + MIN_GAP) A = B - MIN_GAP;
  }
  return [A, B];
}
/** the end of a sin interval snaps to a multiple of π/2 when it is within 0.03 */
function snapExt(id: ExtId, v: number): number {
  if (id !== 'sin') return roundTo(v, 0.05);
  const q = Math.round(v / (Math.PI / 2)) * (Math.PI / 2);
  return Math.abs(v - q) < 0.03 ? q : roundTo(v, 0.01);
}
const fmtX = (id: ExtId, x: number) => (id === 'sin' ? (niceAngle(x) ?? fmt(x)) : fmt(x));

/* ---- tasks: `needs` = the learner's change must touch one of these keys; `event` tasks tick on the learner's act, the
 * others must be left and found again after a step or reset made the state */
interface Rule {
  needs: (keyof Setup)[];
  event?: boolean;
  state: (s: Setup, patch: Partial<Setup>) => boolean;
}
const bothAttained = (s: Setup) => {
  const r = extremes(s.pE, s.ea, s.eb, s.lc, s.rc);
  return r.max.attained && r.min.attained;
};
const RULES: Record<string, Rule> = {
  'approach-close': { needs: ['h'], state: (s) => s.mode === 'approach' && s.h <= 1e-3 * (1 + 1e-9) },
  'approach-jump': { needs: ['h'], state: (s) => s.mode === 'approach' && APPROACH[s.pA].verdict === 'jump' && s.h <= 1e-2 * (1 + 1e-9) },
  'approach-fill': { needs: ['fill'], event: true, state: (s) => s.mode === 'approach' && s.fill && isRemovable(s.pA) },
  'ivt-bisect': { needs: ['bis'], event: true, state: (s) => s.mode === 'ivt' && s.pI !== 'recip' && s.bis.steps >= 1 && !s.bis.collapsed && s.bis.b - s.bis.a <= LEN_TARGET + 1e-12 },
  'ivt-fail': { needs: ['bis'], event: true, state: (s) => s.mode === 'ivt' && s.pI === 'recip' && s.bis.steps >= 1 && (s.bis.collapsed || s.bis.b - s.bis.a <= LEN_TARGET + 1e-12) },
  'extreme-open': {
    needs: ['lc', 'rc'],
    event: true,
    state: (s, p) => s.mode === 'extreme' && (p.lc === false || p.rc === false) && !bothAttained(s),
  },
  'extreme-closed': {
    needs: ['lc', 'rc'],
    event: true,
    state: (s, p) => s.mode === 'extreme' && (p.lc === true || p.rc === true) && s.lc && s.rc && bothAttained(s),
  },
};

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
function dashed(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width = 1.3) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}
/** a filled mark (shape: circle) */
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
/** a hollow mark: paper inside, a coloured ring */
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

/** the x values of one drawn piece of the graph: dense towards the pole when the piece touches it */
function piece(lo: number, hi: number, pole: number | null, n: number): number[] {
  const nearLo = pole !== null && lo === pole;
  const nearHi = pole !== null && hi === pole;
  const xs: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let x = nearLo ? lo + (hi - lo) * t * t : nearHi ? hi - (hi - lo) * (1 - t) * (1 - t) : lo + (hi - lo) * t;
    if (nearLo && x - lo < 1e-9) x = lo + 1e-9;
    if (nearHi && hi - x < 1e-9) x = hi - 1e-9;
    xs.push(x);
  }
  return xs;
}

/** the graph of f over [lo, hi] clipped to the plot, broken at `pole` (the pole or the jump is never joined across) */
function strokeFn(ctx: CanvasRenderingContext2D, plot: Plot, f: Fn, pole: number | null, lo: number, hi: number, color: string, width: number, dash: number[] = []) {
  const [y0, y1] = [plot.y.min, plot.y.max];
  const span = y1 - y0;
  const segs: [number, number][] = pole !== null && lo < pole && pole < hi ? [[lo, pole], [pole, hi]] : [[lo, hi]];
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.box.x, plot.box.y - 2, plot.box.w, plot.box.h + 4);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.setLineDash(dash);
  for (const [l, h] of segs) {
    if (!(h > l)) continue;
    ctx.beginPath();
    let started = false;
    for (const x of piece(l, h, pole, 480)) {
      const v = f(x);
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

export default function LimitLab(props: LimitLabProps) {
  const startMode: LimitMode = props.mode ?? 'approach';
  const modes: LimitMode[] = props.modes ?? [startMode];
  const initial = (): Setup => {
    const pA: ApproachId = startMode === 'approach' && isApproachId(props.preset) ? props.preset : 'removable-p3';
    const pI: IvtId = startMode === 'ivt' && isIvtId(props.preset) ? props.preset : 'cubic';
    const pE: ExtId = startMode === 'extreme' && isExtId(props.preset) ? props.preset : 'x2';
    const [ia, ib] = fixIvt(pI, (startMode === 'ivt' ? props.a : null) ?? IVT[pI].defaultA, (startMode === 'ivt' ? props.b : null) ?? IVT[pI].defaultB);
    const [ea, eb] = fixExt(pE, (startMode === 'extreme' ? props.a : null) ?? EXTREME[pE].defaultA, (startMode === 'extreme' ? props.b : null) ?? EXTREME[pE].defaultB);
    return {
      mode: startMode,
      pA,
      h: clampH(props.h ?? 0.1),
      classify: props.classify ?? false,
      fill: props.fill ?? false,
      pI,
      ia,
      ib,
      k: clamp(props.k ?? 0, IVT[pI].window.y[0], IVT[pI].window.y[1]),
      bis: bisectInit(ia, ib),
      pE,
      ea,
      eb,
      lc: props.leftClosed ?? true,
      rc: props.rightClosed ?? true,
    };
  };
  const [setup, setSetup] = useState<Setup>(initial);
  const cur = useRef(setup);
  const [live, setLive] = useState('');
  const [narrow, setNarrow] = useState(false);
  const plotRef = useRef<Plot | null>(null);
  const dragging = useRef(false);
  /** tasks whose state held when the last step or reset made it: they must be left and found again */
  const held = useRef<Set<string>>(new Set());

  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const done = (t: string) => {
    if (props.tasks?.includes(t)) markTask(`${props.id}:${t}`);
  };
  const rebase = (s: Setup) => {
    held.current = new Set((props.tasks ?? []).filter((id) => RULES[id] && !RULES[id].event && RULES[id].state(s, {})));
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
        const mode = typeof st.mode === 'string' && modes.includes(st.mode as LimitMode) ? (st.mode as LimitMode) : prev.mode;
        const next: Setup = { ...prev, mode };
        const preset = st.preset;
        const a = num(st.a);
        const b = num(st.b);
        const k = num(st.k);
        next.h = clampH(num(st.h) ?? prev.h);
        next.classify = bool(st.classify) ?? prev.classify;
        next.fill = bool(st.fill) ?? prev.fill;
        next.lc = bool(st.leftClosed) ?? prev.lc;
        next.rc = bool(st.rightClosed) ?? prev.rc;
        if (mode === 'approach' && isApproachId(preset)) next.pA = preset;
        if (mode === 'ivt') {
          const newPreset = isIvtId(preset) && preset !== prev.pI;
          if (isIvtId(preset)) next.pI = preset;
          const [ia, ib] = fixIvt(next.pI, a ?? (newPreset ? IVT[next.pI].defaultA : prev.ia), b ?? (newPreset ? IVT[next.pI].defaultB : prev.ib));
          next.ia = ia;
          next.ib = ib;
          next.k = clamp(k ?? (newPreset ? 0 : prev.k), IVT[next.pI].window.y[0], IVT[next.pI].window.y[1]);
          if (newPreset || a !== null || b !== null || k !== null || prev.mode !== 'ivt') next.bis = bisectInit(next.ia, next.ib);
        }
        if (mode === 'extreme') {
          const newPreset = isExtId(preset) && preset !== prev.pE;
          if (isExtId(preset)) next.pE = preset;
          const [ea, eb] = fixExt(next.pE, a ?? (newPreset ? EXTREME[next.pE].defaultA : prev.ea), b ?? (newPreset ? EXTREME[next.pE].defaultB : prev.eb));
          next.ea = ea;
          next.eb = eb;
        }
        commit(next);
        rebase(next);
      }),
    [props.id],
  );

  const s0 = setup;

  /* ---------------------------------------------------------------- drawing */
  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    const nar = view.w < 520;
    const fs = nar ? 12 : 13;
    const font = (w8: number, size = fs, it = false) => `${it ? 'italic ' : ''}${w8} ${size}px ${p.fontUi}`;
    const win = s0.mode === 'approach' ? APPROACH[s0.pA].window : s0.mode === 'ivt' ? IVT[s0.pI].window : EXTREME[s0.pE].window;
    const box = insetBox({ x: 0, y: 0, w: view.w, h: view.h }, { l: 46, r: 16, t: nar ? 40 : 18, b: 38 });
    const plot = makePlot(box, { min: win.x[0], max: win.x[1], label: 'x' }, { min: win.y[0], max: win.y[1], label: 'y' });
    plotRef.current = plot;
    drawAxes(ctx, plot, p);
    const inBox = (sy: number) => sy >= box.y - 1 && sy <= box.y + box.h + 1;
    const PX = plot.px;
    const PY = plot.py;

    if (s0.mode === 'approach') {
      const sp = APPROACH[s0.pA];
      const a = sp.a;
      const [xl, xh] = win.x;
      // the graph
      if (s0.pA === 'sin-recip') {
        // resolved part: stepping evenly in 1/x, where sin(1/x) is a plain sine; the rest is the filled band
        const upp = (xh - xl) / box.w;
        const xc = Math.sqrt((3 * upp) / Math.PI);
        ctx.save();
        ctx.beginPath();
        ctx.rect(box.x, box.y - 2, box.w, box.h + 4);
        ctx.clip();
        ctx.fillStyle = withAlpha(p.curve, 0.22);
        ctx.fillRect(PX(-xc), PY(1), PX(xc) - PX(-xc), PY(-1) - PY(1));
        ctx.strokeStyle = p.curve;
        ctx.lineWidth = 2.2;
        ctx.lineJoin = 'round';
        for (const side of [1, -1]) {
          ctx.beginPath();
          const u0 = 1 / xh;
          const u1 = 1 / xc;
          const n = Math.max(2, Math.ceil((u1 - u0) / 0.04));
          for (let i = 0; i <= n; i++) {
            const u = u0 + ((u1 - u0) * i) / n;
            const x = side / u;
            if (i) ctx.lineTo(PX(x), PY(Math.sin(side * u)));
            else ctx.moveTo(PX(x), PY(Math.sin(side * u)));
          }
          ctx.stroke();
        }
        ctx.restore();
      } else {
        strokeFn(ctx, plot, sp.f, a, xl, xh, p.curve, 2.4);
      }
      if (s0.classify && sp.verdict === 'infinite') dashed(ctx, PX(a), box.y, PX(a), box.y + box.h, withAlpha(p.ink3, 0.9));
      // the one-sided limits as dashed lines in the limit colour
      if (s0.classify) {
        const sides: [OneSided, string, number][] = [
          [sp.left, 'L₋', -1],
          [sp.right, 'L₊', 1],
        ];
        for (const [o, name, sgn] of sides) {
          if (o.kind !== 'finite') continue;
          const sy = PY(o.value);
          if (!inBox(sy)) continue;
          dashed(ctx, box.x, sy, PX(a), sy, p.limit, 1.5);
          const dupe = sp.left.kind === 'finite' && sp.right.kind === 'finite' && sp.left.value === sp.right.value;
          haloText(ctx, p, dupe ? `L = ${lim(o.value)}` : `${name} = ${lim(o.value)}`, box.x + 6, sy + (dupe || sgn > 0 ? -10 : 10), { font: font(700), color: p.limit, align: 'left' });
        }
      }
      // the points of the graph at x = a: filled when attained, hollow for a hole
      const marks: number[] = [];
      for (const o of [sp.left, sp.right]) if (o.kind === 'finite' && !marks.includes(o.value)) marks.push(o.value);
      if (sp.fa !== null && !marks.includes(sp.fa)) marks.push(sp.fa);
      for (const v of marks) {
        const sy = PY(v);
        if (!inBox(sy)) continue;
        if (sp.fa === v) dot(ctx, PX(a), sy, 5.5, p.curve, p.paper);
        else ring(ctx, PX(a), sy, 5.5, p.curve, p.paper);
      }
      if (s0.fill && sp.limit !== null) {
        const sy = PY(sp.limit);
        ring(ctx, PX(a), sy, 9, p.limit, 'transparent', 1.8);
        dot(ctx, PX(a), sy, 5.5, p.limit, p.paper);
      }
      // the two points a − h and a + h
      const hh = s0.h;
      const pts: [number, boolean][] = [
        [a - hh, true],
        [a + hh, false],
      ];
      for (const [x, left] of pts) {
        const v = sp.f(x);
        if (!Number.isFinite(v)) continue;
        const sx = PX(x);
        const sy = PY(v);
        const col = left ? p.accent : p.equip;
        if (inBox(sy)) {
          dashed(ctx, sx, box.y + box.h, sx, sy, withAlpha(col, 0.85), 1.2);
          if (left) dot(ctx, sx, sy, 5.5, col, p.paper);
          else square(ctx, sx, sy, 5, col, p.paper);
        } else {
          const up = sy < box.y;
          triangle(ctx, sx, up ? box.y + 9 : box.y + box.h - 9, 6, up, col);
        }
      }
      haloText(ctx, p, `a = ${fmt(a)}`, PX(a), box.y + box.h - 9, { font: font(700), color: p.ink2 });
      if (s0.pA === 'sin-recip') {
        const upp = (xh - xl) / box.w;
        const xc = Math.sqrt((3 * upp) / Math.PI);
        if (xc * 2 > upp * 30) haloText(ctx, p, 'פס מלא', PX(0), PY(0.55), { font: font(600, fs - 1), color: p.curve });
      }
    } else if (s0.mode === 'ivt') {
      const sp = IVT[s0.pI];
      const f = sp.f;
      const pole = s0.pI === 'recip' ? 0 : null;
      const bis = s0.bis;
      // the current interval as a band; the starting interval as ticks on the axis
      ctx.save();
      ctx.beginPath();
      ctx.rect(box.x, box.y, box.w, box.h);
      ctx.clip();
      const wBand = Math.max(2, PX(bis.b) - PX(bis.a));
      ctx.fillStyle = p.deltaBand;
      ctx.fillRect(PX(bis.a), box.y, wBand, box.h);
      ctx.restore();
      if (pole !== null) dashed(ctx, PX(0), box.y, PX(0), box.y + box.h, withAlpha(p.ink3, 0.9));
      strokeFn(ctx, plot, f, pole, win.x[0], win.x[1], withAlpha(p.curve, 0.35), 1.6, [5, 4]);
      strokeFn(ctx, plot, f, pole, s0.ia, s0.ib, p.curve, 2.6);
      // the level k
      const ky = PY(s0.k);
      dashed(ctx, box.x, ky, box.x + box.w, ky, p.limit, 1.6);
      haloText(ctx, p, `k = ${fmt(s0.k)}`, box.x + box.w - 6, ky - 10, { font: font(700), color: p.limit, align: 'right' });
      // the points c with f(c) = k
      for (const c of levelPoints(s0.pI, s0.k, s0.ia, s0.ib)) {
        dashed(ctx, PX(c), box.y + box.h, PX(c), ky, withAlpha(p.limit, 0.8), 1.2);
        dot(ctx, PX(c), ky, 6, p.limit, p.paper);
      }
      // the starting ends a, b
      ctx.save();
      ctx.strokeStyle = p.ink2;
      ctx.lineWidth = 2;
      for (const x of [s0.ia, s0.ib]) {
        ctx.beginPath();
        ctx.moveTo(PX(x), box.y + box.h - 7);
        ctx.lineTo(PX(x), box.y + box.h + 1);
        ctx.stroke();
      }
      ctx.restore();
      haloText(ctx, p, 'a', PX(s0.ia), box.y + box.h - 14, { font: font(700), color: p.ink2 });
      haloText(ctx, p, 'b', PX(s0.ib), box.y + box.h - 14, { font: font(700), color: p.ink2 });
      // the ends of the current interval: circle on the left, square on the right
      for (const [x, left] of [[bis.a, true], [bis.b, false]] as [number, boolean][]) {
        const v = f(x);
        if (!Number.isFinite(v)) continue;
        const sy = PY(v);
        const col = left ? p.accent : p.equip;
        if (!inBox(sy)) {
          const up = sy < box.y;
          triangle(ctx, PX(x), up ? box.y + 9 : box.y + box.h - 9, 6, up, col);
        } else if (left) dot(ctx, PX(x), sy, 5.5, col, p.paper);
        else square(ctx, PX(x), sy, 5, col, p.paper);
      }
      if (bis.collapsed) haloText(ctx, p, 'f לא מוגדרת', PX(bis.a), box.y + 26, { font: font(700), color: p.pointOut });
    } else {
      const sp = EXTREME[s0.pE];
      const f = sp.f;
      const pole = s0.pE === 'recip' ? 0 : null;
      const res = extremes(s0.pE, s0.ea, s0.eb, s0.lc, s0.rc);
      strokeFn(ctx, plot, f, pole, win.x[0], win.x[1], withAlpha(p.curve, 0.35), 1.6, [5, 4]);
      strokeFn(ctx, plot, f, pole, s0.ea, s0.eb, p.curve, 3);
      const lcEff = leftIncluded(s0.pE, s0.ea, s0.lc);
      // the ends of the interval
      for (const [x, closed] of [[s0.ea, lcEff], [s0.eb, s0.rc]] as [number, boolean][]) {
        const v = f(x);
        if (!Number.isFinite(v)) continue;
        const sy = PY(v);
        if (!inBox(sy)) continue;
        if (closed) dot(ctx, PX(x), sy, 4.5, p.curve, p.paper);
        else ring(ctx, PX(x), sy, 4.5, p.curve, p.paper, 2);
      }
      // the largest and smallest values
      const mark = (e: typeof res.max, name: string, up: boolean) => {
        if (!Number.isFinite(e.value)) {
          const x = (up ? e.approachedAt : e.approachedAt)[0] ?? s0.ea;
          triangle(ctx, PX(x) + 14, up ? box.y + 10 : box.y + box.h - 10, 6, up, p.limit);
          haloText(ctx, p, up ? 'אין חסם מלמעלה' : 'אין חסם מלמטה', PX(x) + 24, up ? box.y + 12 : box.y + box.h - 12, { font: font(700), color: p.limit, align: 'left' });
          return;
        }
        const sy = PY(e.value);
        if (!inBox(sy)) return;
        const x = e.attained ? e.at[0] : e.approachedAt[0];
        dashed(ctx, box.x, sy, PX(x), sy, p.limit, 1.4);
        if (e.attained) dot(ctx, PX(x), sy, 7, p.limit, p.paper);
        else ring(ctx, PX(x), sy, 7, p.limit, p.paper, 2.4);
        haloText(ctx, p, `${name} = ${fmt(e.value)}${e.attained ? '' : ' (לא מתקבל)'}`, box.x + 6, sy + (up ? -11 : 11), { font: font(700), color: p.limit, align: 'left' });
      };
      mark(res.max, 'max', true);
      mark(res.min, 'min', false);
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
    if (!('bis' in patch) && ('ia' in patch || 'ib' in patch || 'k' in patch)) next.bis = bisectInit(next.ia, next.ib);
    const eff: Partial<Setup> = next.bis !== prev.bis ? { ...patch, bis: next.bis } : patch;
    commit(next);
    for (const id of props.tasks ?? []) {
      const rule = RULES[id];
      if (!rule) continue;
      if (!rule.state(next, eff)) {
        held.current.delete(id);
        continue;
      }
      if (!rule.needs.some((key) => key in eff)) continue;
      if (!rule.event && held.current.has(id)) continue;
      done(id);
    }
  };

  const press = () => {
    const c = cur.current;
    const nxt = bisectStep(c.pI, c.k, c.bis);
    if (!nxt) return;
    apply({ bis: nxt });
    setLive(nxt.collapsed ? 'הקטע התכווץ לנקודה שבה הפונקציה לא מוגדרת.' : `אורך הקטע ${fmt(nxt.b - nxt.a, 4)}.`);
  };

  const setE = (e: number) => apply({ h: clampH(hOfE(clamp(roundTo(e, E_STEP), 0, E_MAX))) });
  const fromPointer = (e: PointerEvent) => {
    const plot = plotRef.current;
    const c = cur.current;
    if (!plot) return;
    if (c.mode === 'approach') {
      const a = APPROACH[c.pA].a;
      const x = plot.x.min + ((e.offsetX - plot.box.x) / plot.box.w) * (plot.x.max - plot.x.min);
      const d = Math.max(Math.abs(x - a), 1e-6);
      const ne = clamp(roundTo(eOfH(d), E_STEP), 0, E_MAX);
      if (Math.abs(ne - eOfH(c.h)) > 1e-9) apply({ h: clampH(hOfE(ne)) });
    } else if (c.mode === 'ivt') {
      const y = plot.y.max - ((e.offsetY - plot.box.y) / plot.box.h) * (plot.y.max - plot.y.min);
      const nk = clamp(roundTo(y, 0.05), plot.y.min, plot.y.max);
      if (nk !== c.k) apply({ k: nk });
    }
  };
  const onPointerDown = (e: PointerEvent) => {
    if (cur.current.mode === 'extreme') return;
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    fromPointer(e);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (dragging.current) fromPointer(e);
  };
  const onPointerUp = () => {
    if (dragging.current) setLive(describe());
    dragging.current = false;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const c = cur.current;
    if (c.mode === 'approach') {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        setE(eOfH(c.h) + (e.key === 'ArrowLeft' ? E_STEP : -E_STEP));
        setLive(describe());
      }
    } else if (c.mode === 'ivt') {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        press();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const y = IVT[c.pI].window.y;
        apply({ k: clamp(roundTo(c.k + (e.key === 'ArrowUp' ? 0.05 : -0.05), 0.05), y[0], y[1]) });
      }
    }
  };

  /* ---------------------------------------------------------------- text */
  const M = (q: { children: ComponentChildren }) => <bdi dir="ltr">{q.children}</bdi>;
  const spA = APPROACH[s0.pA];
  const spI = IVT[s0.pI];
  const spE = EXTREME[s0.pE];
  const resE = extremes(s0.pE, s0.ea, s0.eb, s0.lc, s0.rc);
  const lcEff = leftIncluded(s0.pE, s0.ea, s0.lc);

  const verdictText = (): string => {
    switch (spA.verdict) {
      case 'continuous':
        return 'רציפה ב-a: הגבול שווה לערך הפונקציה.';
      case 'removable':
        return 'אי-רציפות סליקה: הגבול קיים, אבל f(a) לא מוגדרת. אפשר לסגור את החור בערך הגבול.';
      case 'jump':
        return 'אי-רציפות מסוג קפיצה: שני הגבולות החד-צדדיים קיימים ושונים, ואין גבול.';
      case 'infinite':
        return 'אי-רציפות אינסופית: הערכים גדלים בלי גבול בערך מוחלט, ואין גבול סופי.';
      default:
        return 'אין גבול: הערכים מתנודדים בין −1 ל-1 בכל קרבה ל-0.';
    }
  };

  function describe(): string {
    if (setup.mode === 'approach') return `h = ${fmtH(setup.h)}: משמאל f(a − h) = ${fmt(spA.f(spA.a - setup.h), 5)}, מימין f(a + h) = ${fmt(spA.f(spA.a + setup.h), 5)}.`;
    if (setup.mode === 'ivt') return `הקטע [${fmt(setup.bis.a, 5)}, ${fmt(setup.bis.b, 5)}], אורכו ${fmt(setup.bis.b - setup.bis.a, 4)}, אחרי ${setup.bis.steps} חציות.`;
    return `הערך הגדול ביותר ${fmt(resE.max.value)} ${resE.max.attained ? 'מתקבל' : 'לא מתקבל'}, הקטן ביותר ${fmt(resE.min.value)} ${resE.min.attained ? 'מתקבל' : 'לא מתקבל'}.`;
  }

  const label =
    setup.mode === 'approach'
      ? `איור חי: הפונקציה ${spA.text} ליד a = ${fmt(spA.a)}. שתי נקודות, בעיגול משמאל ובריבוע מימין, במרחק h מ-a, וטבלת ערכים. נקודה מלאה בגרף היא ערך שהפונקציה מקבלת, וחלולה היא חור.`
      : setup.mode === 'ivt'
        ? `איור חי: הפונקציה ${spI.text} על הקטע מ-${fmt(setup.ia)} עד ${fmt(setup.ib)}, ישר ברמה k = ${fmt(setup.k)}, וחצייה שמחלקת את הקטע לחצאים ושומרת את החצי שבו הסימן של f פחות k מתחלף.`
        : `איור חי: הפונקציה ${spE.text} על קטע עם קצוות סגורים או פתוחים. הערך הגדול והקטן ביותר מלאים כשהם מתקבלים וחלולים כשרק מתקרבים אליהם.`;

  const sw = (kind: 'l' | 'r' | 'lim') => <span class={`lim-sw lim-sw-${kind}`} aria-hidden="true" />;

  let readout: ComponentChildren;
  if (setup.mode === 'approach') {
    const decs = decadesPassed(setup.h);
    const exactDecade = decs.some((d) => Math.abs(d - setup.h) < d * 1e-9);
    const rows = approachRows(setup.pA, exactDecade ? decs : [...decs, setup.h]);
    const faText = spA.fa === null ? 'לא מוגדרת' : fmt(spA.fa);
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>f(x) = {spA.text}</M>, <M>a = {fmt(spA.a)}</M>
        </span>
        <span class="q" data-readout="h">
          <M>
            h = <b>{fmtH(setup.h)}</b>
          </M>
        </span>
        <span class="q" data-readout="fa">
          <M>f(a)</M> = <b>{faText}</b>
        </span>
        <div class="lim-tablewrap" data-readout="table">
          <table class="lim-table" dir="ltr">
            <thead>
              <tr>
                <th>h</th>
                <th>{sw('l')} f(a − h)</th>
                <th>{sw('r')} f(a + h)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.h} class={i === rows.length - 1 ? 'now' : ''}>
                  <td>{fmtH(r.h)}</td>
                  <td>{fmtTab(r.fl)}</td>
                  <td>{fmtTab(r.fr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {setup.pA === 'sin-recip' && (
          <span class="q" data-readout="probe">
            הטבלה היא דגימה של כמה נקודות. קרוב ל-0 התנודות צרות מדי לצייר: הפס המלא הוא כל הערכים בין −1 ל-1.
          </span>
        )}
        {setup.classify && (
          <>
            <span class="q" data-readout="limits">
              {sw('lim')} הגבול משמאל: <b>{sideText(spA.left)}</b>, הגבול מימין: <b>{sideText(spA.right)}</b>
              {spA.jump !== null && (
                <>
                  , הקפיצה: <b>{fmt(spA.jump)}</b>
                </>
              )}
            </span>
            <span class="q" data-readout="verdict">
              <b>{verdictText()}</b>
            </span>
          </>
        )}
        {setup.fill && isRemovable(setup.pA) && (
          <span class="q" data-readout="fill">
            החור נסגר בערך הגבול <M>{lim(spA.limit as number)}</M>: הפונקציה החדשה רציפה.
          </span>
        )}
      </>
    );
  } else if (setup.mode === 'ivt') {
    const bis = setup.bis;
    const len = bis.b - bis.a;
    const cont = spI.continuousOn(setup.ia, setup.ib);
    const sc = signChanges(setup.pI, setup.k, setup.ia, setup.ib);
    const gA = spI.f(bis.a) - setup.k;
    const gB = spI.f(bis.b) - setup.k;
    const pts = levelPoints(setup.pI, setup.k, setup.ia, setup.ib);
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>f(x) = {spI.text}</M>, <M>
            [a, b] = [{fmt(setup.ia)}, {fmt(setup.ib)}]
          </M>
        </span>
        <span class="q" data-readout="interval">
          {sw('l')}
          {sw('r')} הקטע הנוכחי: <M>[{fmt(bis.a, 6)}, {fmt(bis.b, 6)}]</M>, אורכו <b>{fmt(len, 4)}</b>, אחרי <b>{bis.steps}</b> חציות
        </span>
        <span class="q" data-readout="signs">
          {bis.collapsed ? (
            <b>הקטע התכווץ לנקודה {fmt(bis.a)}, שבה f לא מוגדרת: אין שם ערך.</b>
          ) : (
            <>
              הערך של <M>f − k</M> בקצה השמאלי: <b>{fmt(gA, 4)}</b>, ובקצה הימני: <b>{fmt(gB, 4)}</b>
            </>
          )}
        </span>
        <span class="q" data-readout="verdict">
          <b>
            {!cont
              ? `הפונקציה ${ltr('f')} לא רציפה בקטע (יש בו נקודה שבה היא לא מוגדרת): המשפט לא חל, ושינוי הסימן לא מבטיח נקודה עם ${ltr('f(c) = k')}.`
              : sc
                ? `הפונקציה ${ltr('f')} רציפה בקטע, ו-${ltr('f − k')} מחליפה סימן בין הקצוות: יש נקודה ${ltr('c')} שבה ${ltr('f(c) = k')}.`
                : `ל-${ltr('f − k')} אותו סימן בשני הקצוות: המשפט לא מבטיח נקודה, ו"חצייה" לא תעבוד.`}
          </b>
        </span>
        <span class="q" data-readout="points">
          {sw('lim')} {pts.length === 0 ? `אין בקטע נקודות שבהן ${ltr('f(c) = k')}.` : `הנקודות בקטע שבהן ${ltr('f(c) = k')}: ${ltr(pts.map((c) => fmt(c, 6)).join(', '))}.`}
          {setup.pI !== 'recip' && pts.length > 0 ? ' (דגימה, לא הוכחה)' : ''}
        </span>
      </>
    );
  } else {
    const lb = lcEff ? '[' : '(';
    const rb = setup.rc ? ']' : ')';
    const line = (e: typeof resE.max, name: string, big: boolean) => {
      if (!Number.isFinite(e.value)) return <b>אין {name}: הפונקציה לא חסומה {big ? 'מלמעלה' : 'מלמטה'}.</b>;
      return e.attained ? (
        <>
          {name}: <b>{fmt(e.value)}</b>, מתקבל ב-<M>x = {e.at.map((x) => fmtX(setup.pE, x)).join(', ')}</M>
        </>
      ) : (
        <>
          {name}: אין. הערך <b>{fmt(e.value)}</b> לא מתקבל, רק מתקרבים אליו ב-<M>x → {e.approachedAt.map((x) => fmtX(setup.pE, x)).join(', ')}</M>
        </>
      );
    };
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>f(x) = {spE.text}</M>
        </span>
        <span class="q" data-readout="interval">
          <M>
            {lb}
            {fmtX(setup.pE, setup.ea)}, {fmtX(setup.pE, setup.eb)}
            {rb}
          </M>
          {setup.pE === 'recip' && setup.ea === 0 ? ' (ב-0 הפונקציה לא מוגדרת: הקצה השמאלי תמיד פתוח)' : ''}
        </span>
        <span class="q" data-readout="max">
          {sw('lim')} {line(resE.max, 'הערך הגדול ביותר', true)}
        </span>
        <span class="q" data-readout="min">
          {sw('lim')} {line(resE.min, 'הערך הקטן ביותר', false)}
        </span>
      </>
    );
  }

  const hSlider = (
    <Slider label="המרחק h" value={roundTo(eOfH(setup.h), E_STEP)} min={0} max={E_MAX} step={E_STEP} format={() => fmtH(setup.h)} onChange={(v) => setE(v)} />
  );

  return (
    <SimShell
      fig={props.id}
      label={label}
      canvasRef={canvasRef}
      aspect={aspect}
      live={live}
      tasks={tasks}
      cursor={setup.mode === 'extreme' ? 'default' : setup.mode === 'ivt' ? 'ns-resize' : 'ew-resize'}
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
                <Toggle
                  key={m}
                  label={MODE_LABEL[m]}
                  on={setup.mode === m}
                  onChange={() => {
                    apply({ mode: m, bis: m === 'ivt' ? bisectInit(cur.current.ia, cur.current.ib) : cur.current.bis });
                  }}
                />
              ))}
            </div>
          )}
          {setup.mode === 'approach' && (
            <>
              {hSlider}
              <div class="group" role="group" aria-label="מה להציג">
                <Toggle label="סיווג" on={setup.classify} swatch="var(--limit)" onChange={(on) => apply({ classify: on })} />
                {isRemovable(setup.pA) && <Toggle label="סגירת החור" on={setup.fill} swatch="var(--limit)" onChange={(on) => apply({ fill: on })} />}
              </div>
            </>
          )}
          {setup.mode === 'ivt' && (
            <>
              <Slider
                label="הקצה השמאלי a"
                value={setup.ia}
                min={spI.window.x[0]}
                max={spI.window.x[1]}
                step={0.05}
                format={(x) => fmt(x)}
                onChange={(v) => {
                  const [a, b] = fixIvt(setup.pI, roundTo(v, 0.05), setup.ib);
                  apply({ ia: a, ib: b });
                }}
              />
              <Slider
                label="הקצה הימני b"
                value={setup.ib}
                min={spI.window.x[0]}
                max={spI.window.x[1]}
                step={0.05}
                format={(x) => fmt(x)}
                onChange={(v) => {
                  const [a, b] = fixIvt(setup.pI, setup.ia, roundTo(v, 0.05));
                  apply({ ia: a, ib: b });
                }}
              />
              <Slider label="הרמה k" value={setup.k} min={spI.window.y[0]} max={spI.window.y[1]} step={0.05} format={(x) => fmt(x)} onChange={(v) => apply({ k: roundTo(v, 0.05) })} />
              <div class="group" role="group" aria-label="חצייה">
                <button type="button" class="btn primary" disabled={bisectStep(setup.pI, setup.k, setup.bis) === null} onClick={press}>
                  חצייה
                </button>
              </div>
            </>
          )}
          {setup.mode === 'extreme' && (
            <>
              <Slider
                label="הקצה השמאלי a"
                value={setup.ea}
                min={spE.aRange[0]}
                max={spE.aRange[1]}
                step={setup.pE === 'sin' ? 0.01 : 0.05}
                format={(x) => fmtX(setup.pE, x)}
                onChange={(v) => {
                  const [a, b] = fixExt(setup.pE, snapExt(setup.pE, v), setup.eb);
                  apply({ ea: a, eb: b });
                }}
              />
              <Slider
                label="הקצה הימני b"
                value={setup.eb}
                min={spE.bRange[0]}
                max={spE.bRange[1]}
                step={setup.pE === 'sin' ? 0.01 : 0.05}
                format={(x) => fmtX(setup.pE, x)}
                onChange={(v) => {
                  const [a, b] = fixExt(setup.pE, setup.ea, snapExt(setup.pE, v));
                  apply({ ea: a, eb: b });
                }}
              />
              <div class="group" role="group" aria-label="סוג הקצוות">
                <Toggle label="קצה שמאלי סגור" on={lcEff} onChange={(on) => (leftIncluded(setup.pE, setup.ea, true) ? apply({ lc: on }) : undefined)} />
                <Toggle label="קצה ימני סגור" on={setup.rc} onChange={(on) => apply({ rc: on })} />
              </div>
            </>
          )}
        </>
      }
    />
  );
}
