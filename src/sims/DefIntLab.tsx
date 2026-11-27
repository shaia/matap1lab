/**
 * DefIntLab (chapter 8.2, the definite integral: symmetry and a variable limit): two modes. Maths: src/math/defint.ts,
 * whose STORED closed forms (F, the parity, the even and odd parts, G, G′, the limits g, h and their derivatives) drive
 * every curve and every exact value; nothing is decided by sampling. The only numeric values are the integrals of
 * e^(−x²) (presets gauss and gauss-x), and the readout labels them as numeric. Canvases are math space and stay LTR
 * (x to the right, y up); sliders for math quantities are `dir="ltr"`. Nothing moves by itself (no animation), so there
 * is no motion for motionAllowed() to gate. In `upper` the two panels are stacked in one canvas, so they also stack on
 * a phone (390 px) without sideways scroll.
 *
 * mode 'symmetry' (button "סימטריה"): preset f of SYM (cubic, xcos, quart, gauss, zero, exp).
 *     one panel     f (--curve) on [−3.3, 3.3] with the signed areas over [−a, 0] and [0, a] shaded: above the axis a solid
 *                   fill (--pos), below it hatched (--neg), so the sign is never colour alone; dashed verticals at −a, 0, a,
 *                   handles (filled discs) at ±a labelled "−a" and "a", and the value of each half written under it.
 *     with `mirror`: the left half reflected onto [0, a], dashed accent: odd presets −f(−x) (half a turn about the
 *                   origin), even presets f(−x); for exp (neither) both f(−x) and −f(−x) (the latter fainter), so that
 *                   neither coincides with f. Each dashed curve is labelled with its formula.
 *     with `parts` (exp only; the toggle is shown only for exp): the even part cosh x (dashed accent) and the odd part
 *                   sinh x (dotted ink), each labelled.
 *     a is set by the slider (0.2…3), by a drag on the canvas (a = |x| of the pointer) or by ←/→.
 * mode 'upper' (button "גבול עליון משתנה"): preset f of UP (cos-x, cos-x2, gauss-x, recip-2x); G(x) = ∫ from h(x) to g(x)
 *                   of f(t) dt.
 *     top panel     f(t) on the t-axis with the area from h(x) to g(x) shaded (pos solid / neg hatched); the limits are
 *                   handles on the t-axis, labelled with their formulas as math-space (LTR) labels: the upper limit a
 *                   filled disc "t = g(x) = x²" (…), the lower limit a ring, "t = 0" when constant and "t = h(x) = x"
 *                   when it moves.
 *     with `strip`: the strip between g(x) and g(x + dx) (width ≈ g′(x)·dx, height ≈ f(g(x))) outlined and marked "+"
 *                   when the interval grows there (filled), "−" when it shrinks (dashed outline only); for two moving
 *                   limits (recip-2x) also the strip between h(x) and h(x + dx) at the bottom limit, marked "−" (removed).
 *     bottom panel  G(x) (accent) over the x range with its tangent at x (slope G′(x)) and the point (x, G(x)); with
 *                   `strip` a ring at (x + dx, G(x + dx)).
 *     x is set by the slider, by a drag (on the bottom panel: x itself; on the top panel: the nearer moving limit is
 *     dragged along the t-axis and x follows) or by ←/→.
 *
 * Props (defaults): id (required); mode ('symmetry'); modes (the mode buttons shown; default the starting mode only);
 * tasks ([]). f (a SYM id for symmetry, an UP id for upper; defaults 'cubic' and 'cos-x'); a (the preset's a0: cubic 1.8,
 * xcos 2.5, quart 1.8, gauss 1.5, zero 1.5, exp 1.5; clamped to 0.2…3); mirror (false); parts (false); x (the preset's x0:
 * cos-x 2.5, cos-x2 0.8, gauss-x 1, recip-2x 1.2; clamped to the preset's range: cos-x 0…6.2, cos-x2 −2.5…2.5, gauss-x 0…3,
 * recip-2x 0.4…3); strip (false); dx (0.2; 0.005…0.5).
 * Every prop is also a step key (`<Step fig=… set={{…}}>`); a key left out keeps its value; a step that sets `f` applies it
 * to symmetry when it is a SYM id and to upper when it is an UP id; a new preset without `a` (or `x`) puts a (or x) at
 * that preset's default. A state set by a step never ticks a task, and a state that already had a task's property when
 * a step or reset made it must be left and found again. The learner can also pick the function from a list (select
 * "הפונקציה": the presets of the current mode); that puts a or x at the preset's default too.
 *
 * Tasks (ticked only inside the learner's own drag, key, slider, select or toggle):
 *   symmetry: sym-mirror (mirror on with an odd preset, cubic or xcos, by the learner's toggle or select), sym-width (on an
 *             odd preset the learner moves a by ≥ 0.3 from where a step, a reset or the preset change put it: the total
 *             stays 0), sym-parts (the learner turns `parts` on, preset exp)
 *   upper:    up-move (the learner moves x by ≥ 0.3 from where a step, a reset or the preset change put it), up-strip
 *             (strip on, the learner shrinks dx to ≤ 0.02 so that strip area / dx is within 1% of G′(x), plus an
 *             absolute 0.001; at the default x of cos-x, cos-x2 and recip-2x dx = 0.02 is enough, gauss-x needs about 0.01, and where
 *             G″ is large, e.g. cos-x2 at |x| ≳ 1.2, even the slider's minimum 0.005 is not), up-const
 *             (preset recip-2x, the learner moves x by ≥ 0.3: G stays ln 2)
 *
 * Hooks for e2e specs (inside `#<id>`; numbers use U+2212 for minus):
 *   buttons by role and name: the mode buttons "סימטריה", "גבול עליון משתנה"; the toggles "שיקוף החצי השמאלי" and
 *     "החלק הזוגי והאי-זוגי" (symmetry, the latter for exp only), "פס צר" (upper); "איפוס" (reset)
 *   [data-control="preset"] select    the function (option values are the preset ids of the current mode)
 *   [data-control=…] input            symmetry: a (value = a, 0.2…3, step 0.01); upper: x (value = x, step 0.01), dx
 *                                     (with strip; value = log10 dx, −2.3…−0.3, step 0.01: −2.3 is 0.005, −1 is 0.1)
 *   canvas                            drag moves a (symmetry) or x (upper); ←/→ move a / x by 0.02
 *   [data-readout=…]                  symmetry: fn, a, left (∫ from −a to 0), right (∫ from 0 to a), total, kind (the
 *                                     verdict sentence), mirror (with mirror), parts (with parts, exp), numeric (gauss)
 *                                     upper: fn, x, limits (g(x) and, when it moves, h(x)), G, gprime (G′(x) by the
 *                                     formula with numbers), strip (with strip: the strips, strip area / dx next to
 *                                     G′(x)), numeric (gauss-x)
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import {
  A_MAX,
  A_MIN,
  Gof,
  SYM,
  SYM_IDS,
  UP,
  UP_IDS,
  isSymId,
  isUpId,
  partIntegrals,
  stripClose,
  symParts,
  upper,
  upperStrip,
  type Fn,
  type SymId,
  type UpId,
} from '~/math/defint';
import { markTask } from '~/progress/store';
import { subscribeSteps, type StepState } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { sci } from './core/format';
import { withAlpha } from './core/ink';
import { drawAxes, makePlot, type Box, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import './DefIntLab.css';

export type DefIntMode = 'symmetry' | 'upper';

export interface DefIntLabProps {
  id: string;
  mode?: DefIntMode;
  /** the mode buttons shown (default: the starting mode only) */
  modes?: DefIntMode[];
  /** a SYM preset id (symmetry) or an UP preset id (upper) */
  f?: string;
  a?: number;
  mirror?: boolean;
  parts?: boolean;
  x?: number;
  strip?: boolean;
  dx?: number;
  tasks?: string[];
}

interface Setup {
  mode: DefIntMode;
  pS: SymId;
  a: number;
  mirror: boolean;
  parts: boolean;
  pU: UpId;
  x: number;
  strip: boolean;
  dx: number;
}

const ltr = (s: string) => String.fromCharCode(0x2066) + s.replace(/ /g, String.fromCharCode(0xa0)) + String.fromCharCode(0x2069);

const TASK_LABEL: Record<string, string> = {
  'sym-mirror': `בפונקציה אי-זוגית הדליקו "שיקוף החצי השמאלי". על מה נופל החצי השמאלי אחרי חצי סיבוב סביב הראשית?`,
  'sym-width': `בפונקציה אי-זוגית הזיזו את ${ltr('a')} (לפחות ${ltr('0.3')}). מה קורה לאינטגרל על ${ltr('[−a, a]')}?`,
  'sym-parts': `בפונקציה ${ltr('eˣ')} הדליקו "החלק הזוגי והאי-זוגי". איזה חלק תורם לאינטגרל על ${ltr('[−a, a]')}?`,
  'up-move': `הזיזו את ${ltr('x')} (לפחות ${ltr('0.3')}). מה קורה לשטח, ומה השיפוע של ${ltr('G')} בנקודה?`,
  'up-strip': `הדליקו "פס צר" וכווצו את ${ltr('dx')} ל-${ltr('0.02')} או פחות, עד ששטח הפס חלקי ${ltr('dx')} מתקרב ל-${ltr('G′(x)')} (בטווח של אחוז).`,
  'up-const': `בפונקציה ${ltr('1/t')} מ-${ltr('x')} עד ${ltr('2x')} הזיזו את ${ltr('x')} (לפחות ${ltr('0.3')}). למה ${ltr('G(x)')} לא משתנה?`,
};

const MODE_LABEL: Record<DefIntMode, string> = { symmetry: 'סימטריה', upper: 'גבול עליון משתנה' };

const DX_MIN = 0.005;
const DX_MAX = 0.5;
const DX_E_MIN = -2.3;
const DX_E_MAX = -0.3;
const MOVE = 0.3;
const TAU = 2 * Math.PI;
const TOOLS_W = 84;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const bool = (x: unknown): boolean | null => (typeof x === 'boolean' ? x : null);
const roundTo = (x: number, step: number) => Number((Math.round(x / step) * step).toPrecision(10));
const minus = (s: string) => s.replace(/-/g, '−');
const fmt = (x: number, sig = 4) => (Number.isNaN(x) ? '—' : Math.abs(x) < 1e-9 ? '0' : minus(sci(x, sig)));
const dxOfE = (e: number) => (e <= DX_E_MIN + 1e-9 ? DX_MIN : e >= DX_E_MAX - 1e-9 ? DX_MAX : clamp(10 ** e, DX_MIN, DX_MAX));
const eOfDx = (dx: number) => clamp(Math.log10(dx), DX_E_MIN, DX_E_MAX);
const fixA = (a: number) => clamp(a, A_MIN, A_MAX);
const fixX = (id: UpId, x: number) => clamp(x, UP[id].xr[0], UP[id].xr[1]);
const isOdd = (id: SymId) => SYM[id].kind === 'odd';

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

/** y = f(x) over [lo, hi], clipped to the plot; non-finite values break the line */
function stroke(ctx: CanvasRenderingContext2D, plot: Plot, f: Fn, lo: number, hi: number, color: string, width: number, dash: number[] = [], n = 400) {
  if (!(hi > lo)) return;
  const span = plot.y.max - plot.y.min;
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.box.x, plot.box.y - 2, plot.box.w, plot.box.h + 4);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.setLineDash(dash);
  ctx.beginPath();
  let started = false;
  for (let i = 0; i <= n; i++) {
    const x = lo + ((hi - lo) * i) / n;
    const v = f(x);
    if (!Number.isFinite(v)) {
      started = false;
      continue;
    }
    const sx = plot.px(x);
    const sy = plot.py(clamp(v, plot.y.min - 3 * span, plot.y.max + 3 * span));
    if (started) ctx.lineTo(sx, sy);
    else ctx.moveTo(sx, sy);
    started = true;
  }
  ctx.stroke();
  ctx.restore();
}

/** a short segment of slope m through (x, y), half-width hw in x, clipped to the plot */
function tangentSeg(ctx: CanvasRenderingContext2D, plot: Plot, x: number, y: number, m: number, hw: number, color: string, width: number) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.box.x, plot.box.y, plot.box.w, plot.box.h);
  ctx.clip();
  line(ctx, plot.px(x - hw), plot.py(y - m * hw), plot.px(x + hw), plot.py(y + m * hw), color, width);
  ctx.restore();
}

/** the region between the graph of f and the axis over [lo, hi]: above the axis a solid fill (--pos), below it a hatched
 * one (--neg), so the sign shows in the pattern and not in the colour alone. outline: none, solid or dashed. */
function shadeRegion(ctx: CanvasRenderingContext2D, p: Palette, plot: Plot, f: Fn, lo: number, hi: number, o: { fill?: boolean; outline?: 'solid' | 'dashed' } = {}) {
  if (!(hi > lo)) return;
  const { box } = plot;
  const span = plot.y.max - plot.y.min;
  const zero = clamp(plot.py(0), box.y, box.y + box.h);
  const path = new Path2D();
  path.moveTo(plot.px(lo), zero);
  const n = 260;
  for (let i = 0; i <= n; i++) {
    const x = lo + ((hi - lo) * i) / n;
    const v = f(x);
    path.lineTo(plot.px(x), plot.py(clamp(Number.isFinite(v) ? v : plot.y.max + 3 * span, plot.y.min - 3 * span, plot.y.max + 3 * span)));
  }
  path.lineTo(plot.px(hi), zero);
  path.closePath();
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  if (o.fill !== false) {
    // above the axis: solid
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, zero - box.y);
    ctx.clip();
    ctx.clip(path);
    ctx.fillStyle = withAlpha(p.pos, 0.3);
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.restore();
    // below the axis: hatched
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, zero, box.w, box.y + box.h - zero);
    ctx.clip();
    ctx.clip(path);
    ctx.fillStyle = withAlpha(p.neg, 0.1);
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.strokeStyle = withAlpha(p.neg, 0.9);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let k = -box.h; k < box.w + box.h; k += 6) {
      ctx.moveTo(box.x + k, box.y + box.h);
      ctx.lineTo(box.x + k + box.h, box.y);
    }
    ctx.stroke();
    ctx.restore();
  }
  if (o.outline) {
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 1.8;
    ctx.setLineDash(o.outline === 'dashed' ? [5, 4] : []);
    ctx.stroke(path);
  }
  ctx.restore();
}

/** panel boxes of the canvas, stacked: fractions of the height, each with room for tick numbers below */
function layout(w: number, h: number, fr: number[]): Box[] {
  const left = 50;
  const right = 14;
  const top = 6;
  const unit = (h - top) / fr.reduce((s, v) => s + v, 0);
  const boxes: Box[] = [];
  let y = top;
  for (const f of fr) {
    const ph = f * unit;
    boxes.push({ x: left, y: y + 8, w: Math.max(1, w - left - right), h: Math.max(1, ph - 8 - 24) });
    y += ph;
  }
  return boxes;
}

function axisLines(ctx: CanvasRenderingContext2D, p: Palette, pl: Plot) {
  if (pl.y.min < 0 && pl.y.max > 0) line(ctx, pl.box.x, pl.py(0), pl.box.x + pl.box.w, pl.py(0), withAlpha(p.ink2, 0.7), 1.2);
  if (pl.x.min < 0 && pl.x.max > 0) line(ctx, pl.px(0), pl.box.y, pl.px(0), pl.box.y + pl.box.h, withAlpha(p.ink2, 0.7), 1.2);
}

interface Rule {
  needs: (keyof Setup)[];
  state: (s: Setup) => boolean;
}

export default function DefIntLab(props: DefIntLabProps) {
  const startMode: DefIntMode = props.mode ?? 'symmetry';
  const modes: DefIntMode[] = props.modes ?? [startMode];
  const initial = (): Setup => {
    const pS: SymId = isSymId(props.f) ? props.f : 'cubic';
    const pU: UpId = isUpId(props.f) ? props.f : 'cos-x';
    return {
      mode: startMode,
      pS,
      a: fixA(props.a ?? SYM[pS].a0),
      mirror: props.mirror ?? false,
      parts: props.parts ?? false,
      pU,
      x: fixX(pU, props.x ?? UP[pU].x0),
      strip: props.strip ?? false,
      dx: clamp(props.dx ?? 0.2, DX_MIN, DX_MAX),
    };
  };
  const [setup, setSetup] = useState<Setup>(initial);
  const cur = useRef(setup);
  const [live, setLive] = useState('');
  const [narrow, setNarrow] = useState(false);
  const plots = useRef<Plot[]>([]);
  /** what a drag moves: a (symmetry), x on the G panel, or a limit on the t-axis of the f panel */
  const dragging = useRef<'a' | 'x' | 'g' | 'h' | null>(null);
  /** the a and x that a step, a reset, the start or a preset change put: sym-width, up-move and up-const measure from them */
  const anchorA = useRef(setup.a);
  const anchorX = useRef(setup.x);
  /** tasks whose state held when the last step or reset made it: they must be left and found again */
  const held = useRef<Set<string>>(new Set());

  const RULES: Record<string, Rule> = {
    'sym-mirror': { needs: ['mirror', 'pS'], state: (s) => s.mode === 'symmetry' && s.mirror && isOdd(s.pS) },
    'sym-width': { needs: ['a'], state: (s) => s.mode === 'symmetry' && isOdd(s.pS) && Math.abs(s.a - anchorA.current) >= MOVE - 1e-9 },
    'sym-parts': { needs: ['parts', 'pS'], state: (s) => s.mode === 'symmetry' && s.parts && s.pS === 'exp' },
    'up-move': { needs: ['x'], state: (s) => s.mode === 'upper' && Math.abs(s.x - anchorX.current) >= MOVE - 1e-9 },
    'up-strip': {
      needs: ['dx'],
      state: (s) => {
        if (s.mode !== 'upper' || !s.strip || s.dx > 0.02 + 1e-9) return false;
        return stripClose(upperStrip(s.pU, s.x, s.dx).perDx, upper(s.pU, s.x).Gprime);
      },
    },
    'up-const': { needs: ['x'], state: (s) => s.mode === 'upper' && s.pU === 'recip-2x' && Math.abs(s.x - anchorX.current) >= MOVE - 1e-9 },
  };

  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const done = (t: string) => {
    if (props.tasks?.includes(t)) markTask(`${props.id}:${t}`);
  };
  const rebase = (s: Setup) => {
    anchorA.current = s.a;
    anchorX.current = s.x;
    held.current = new Set((props.tasks ?? []).filter((id) => RULES[id] && RULES[id].state(s)));
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
        const mode = typeof st.mode === 'string' && modes.includes(st.mode as DefIntMode) ? (st.mode as DefIntMode) : prev.mode;
        const next: Setup = { ...prev, mode };
        const newS = isSymId(st.f) && st.f !== prev.pS;
        const newU = isUpId(st.f) && st.f !== prev.pU;
        if (isSymId(st.f)) next.pS = st.f;
        if (isUpId(st.f)) next.pU = st.f;
        next.a = fixA(num(st.a) ?? (newS ? SYM[next.pS].a0 : prev.a));
        next.mirror = bool(st.mirror) ?? prev.mirror;
        next.parts = bool(st.parts) ?? prev.parts;
        next.x = fixX(next.pU, num(st.x) ?? (newU ? UP[next.pU].x0 : prev.x));
        next.strip = bool(st.strip) ?? prev.strip;
        next.dx = clamp(num(st.dx) ?? prev.dx, DX_MIN, DX_MAX);
        commit(next);
        rebase(next);
      }),
    [props.id],
  );

  const s0 = setup;

  /* ---------------------------------------------------------------- drawing */
  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    const nar = view.w < 520;
    const fs = nar ? 11 : 12;
    const font = (w8: number, size = fs) => `${w8} ${size}px ${p.fontUi}`;

    if (s0.mode === 'symmetry') {
      const sp = SYM[s0.pS];
      const [box] = layout(view.w, view.h, [1]);
      const pl = makePlot(box, { min: sp.window.x[0], max: sp.window.x[1] }, { min: sp.window.y[0], max: sp.window.y[1], label: 'f' });
      plots.current = [pl];
      drawAxes(ctx, pl, p);
      axisLines(ctx, p, pl);
      const a = s0.a;
      shadeRegion(ctx, p, pl, sp.f, -a, 0);
      shadeRegion(ctx, p, pl, sp.f, 0, a);
      for (const v of [-a, a]) line(ctx, pl.px(v), pl.box.y, pl.px(v), pl.box.y + pl.box.h, withAlpha(p.accent, 0.7), 1.2, [3, 4]);
      stroke(ctx, pl, sp.f, sp.window.x[0], sp.window.x[1], p.curve, 2.6);
      if (s0.parts && sp.parts) {
        stroke(ctx, pl, sp.parts.even, sp.window.x[0], sp.window.x[1], p.accent, 2.2, [8, 5]);
        stroke(ctx, pl, sp.parts.odd, sp.window.x[0], sp.window.x[1], p.ink2, 2.2, [2, 4]);
        const lx = sp.window.x[0] + 0.15 * (sp.window.x[1] - sp.window.x[0]);
        const yl = (v: number) => clamp(pl.py(v), pl.box.y + 10, pl.box.y + pl.box.h - 10);
        haloText(ctx, p, sp.parts.evenText, pl.px(lx), yl(sp.parts.even(lx)) - 12, { font: font(700), color: p.accent });
        haloText(ctx, p, sp.parts.oddText, pl.px(lx), yl(sp.parts.odd(lx)) + 12, { font: font(700), color: p.ink2 });
      }
      /** a label's y kept off the tool buttons in the top-right corner of the canvas */
      const offTools = (sx: number, y: number, to = 44) => (sx > pl.box.x + pl.box.w - TOOLS_W - 30 && y < pl.box.y + to ? pl.box.y + to : y);
      if (s0.mirror) {
        const yl = (v: number) => clamp(pl.py(v), pl.box.y + 10, pl.box.y + pl.box.h - 10);
        // right of x = a, or left of it when the label would leave the panel
        const room = pl.px(a) + 10 + 52 <= pl.box.x + pl.box.w;
        const lab = (s: string, y: number, color: string) =>
          haloText(ctx, p, s, room ? pl.px(a) + 10 : pl.px(a) - 10, offTools(pl.px(a), y, 64), { font: font(700), color, align: room ? 'left' : 'right' });
        const rot: Fn = (x) => -sp.f(-x);
        const ref: Fn = (x) => sp.f(-x);
        // for `neither` both labels sit at x = a: keep them at least 18 px apart (−f(−x) below when it is the lower)
        let yRot = yl(rot(a));
        let yRef = yl(ref(a));
        if (sp.kind === 'neither' && Math.abs(yRot - yRef) < 18) {
          const mid = (yRot + yRef) / 2;
          const down = rot(a) <= ref(a) ? 1 : -1;
          yRot = mid + 9 * down;
          yRef = mid - 9 * down;
        }
        if (sp.kind === 'odd' || sp.kind === 'neither') {
          const c = sp.kind === 'odd' ? p.accent : withAlpha(p.accent, 0.5);
          stroke(ctx, pl, rot, 0, a, c, 3, [7, 5], 200);
          lab('−f(−x)', yRot, c);
        }
        if (sp.kind === 'even' || sp.kind === 'neither') {
          stroke(ctx, pl, ref, 0, a, p.accent, 3, [7, 5], 200);
          lab('f(−x)', yRef, p.accent);
        }
      }
      // handles at ±a and the value of each half
      const yAx = clamp(pl.py(0), pl.box.y, pl.box.y + pl.box.h);
      dot(ctx, pl.px(-a), yAx, 6, p.accent, p.paper);
      dot(ctx, pl.px(a), yAx, 6, p.accent, p.paper);
      haloText(ctx, p, '−a', pl.px(-a) - 10, pl.box.y + 10, { font: font(700), color: p.accent });
      haloText(ctx, p, 'a', pl.px(a) + 8, offTools(pl.px(a), pl.box.y + 10), { font: font(700), color: p.accent });
      const { left, right } = symParts(s0.pS, a);
      const yb = pl.box.y + pl.box.h - 12;
      haloText(ctx, p, fmt(left, 3), clamp(pl.px(-a / 2), pl.box.x + 24, pl.box.x + pl.box.w - 24), yb, { font: font(700), color: p.ink });
      haloText(ctx, p, fmt(right, 3), clamp(pl.px(a / 2), pl.box.x + 24, pl.box.x + pl.box.w - 24), yb, { font: font(700), color: p.ink });
      return;
    }

    // upper
    const sp = UP[s0.pU];
    const [top, bot] = layout(view.w, view.h, [1, 1]);
    const pT = makePlot(top, { min: sp.tWin.x[0], max: sp.tWin.x[1] }, { min: sp.tWin.y[0], max: sp.tWin.y[1], label: 'f(t)' });
    const pB = makePlot(bot, { min: sp.xWin.x[0], max: sp.xWin.x[1] }, { min: sp.xWin.y[0], max: sp.xWin.y[1], label: 'G(x)' });
    plots.current = [pT, pB];
    drawAxes(ctx, pT, p);
    drawAxes(ctx, pB, p);
    axisLines(ctx, p, pT);
    axisLines(ctx, p, pB);
    const x = s0.x;
    const u = upper(s0.pU, x);
    shadeRegion(ctx, p, pT, sp.f, Math.min(u.lo, u.hi), Math.max(u.lo, u.hi));
    if (s0.strip) {
      const st = upperStrip(s0.pU, x, s0.dx);
      const mark = (from: number, to: number, grows: boolean) => {
        const lo = Math.min(from, to);
        const hi = Math.max(from, to);
        if (!(hi > lo)) return;
        shadeRegion(ctx, p, pT, sp.f, lo, hi, grows ? { outline: 'solid' } : { fill: false, outline: 'dashed' });
        const fy = sp.f((lo + hi) / 2);
        const yy = clamp(pT.py(Math.max(0, Number.isFinite(fy) ? fy : 0)) - 12, pT.box.y + 30, pT.box.y + pT.box.h - 8);
        haloText(ctx, p, grows ? '+' : '−', pT.px((lo + hi) / 2), yy, { font: font(800, fs + 4), color: p.ink });
      };
      // the interval [h, g] grows at the top when g increases, at the bottom when h decreases
      mark(st.top.from, st.top.to, st.top.to > st.top.from);
      if (sp.hMoves) mark(st.bottom.from, st.bottom.to, st.bottom.to < st.bottom.from);
    }
    stroke(ctx, pT, sp.f, Math.max(sp.tWin.x[0], s0.pU === 'recip-2x' ? 1e-3 : sp.tWin.x[0]), sp.tWin.x[1], p.curve, 2.6);
    // the limits: handles on the t-axis with their formulas (math-space labels, LTR)
    const yAx = clamp(pT.py(0), pT.box.y, pT.box.y + pT.box.h);
    line(ctx, pT.px(u.lo), pT.box.y, pT.px(u.lo), pT.box.y + pT.box.h, withAlpha(p.ink2, 0.55), 1.1, [3, 4]);
    line(ctx, pT.px(u.hi), pT.box.y, pT.px(u.hi), pT.box.y + pT.box.h, withAlpha(p.accent, 0.7), 1.2, [3, 4]);
    ring(ctx, pT.px(u.lo), yAx, 6, p.ink, p.paper, 2.4);
    dot(ctx, pT.px(u.hi), yAx, 6, p.accent, p.paper);
    // a label is centred on its handle; near an edge it starts (or ends) at the handle instead, so it never drifts
    // over to the other handle on a narrow canvas
    const labelAt = (s: string, sx: number, y: number, color: string) => {
      ctx.font = font(700);
      const half = ctx.measureText(s).width / 2;
      const lo = pT.box.x + 2;
      const hi = pT.box.x + pT.box.w - TOOLS_W - 2;
      if (sx - half < lo) haloText(ctx, p, s, Math.max(sx - 6, lo), y, { font: font(700), color, align: 'left' });
      else if (sx + half > hi) haloText(ctx, p, s, Math.min(sx + 6, hi), y, { font: font(700), color, align: 'right' });
      else haloText(ctx, p, s, sx, y, { font: font(700), color });
    };
    labelAt(`t = g(x) = ${sp.gtext}`, pT.px(u.hi), pT.box.y + 10, p.accent);
    // the lower label: under its handle when there is room below the axis, else on a second row at the top
    const below = pT.box.y + pT.box.h - yAx >= 22;
    labelAt(sp.hMoves ? `t = h(x) = ${sp.htext}` : `t = ${sp.htext}`, pT.px(u.lo), below ? yAx + 15 : pT.box.y + 30, p.ink);
    // G and its tangent
    stroke(ctx, pB, (v) => Gof(s0.pU, v), sp.xr[0], sp.xr[1], p.accent, 2.8, [], sp.G ? 400 : 160);
    line(ctx, pB.px(x), pB.box.y, pB.px(x), pB.box.y + pB.box.h, withAlpha(p.accent, 0.5), 1.1, [3, 4]);
    tangentSeg(ctx, pB, x, u.G, u.Gprime, (sp.xWin.x[1] - sp.xWin.x[0]) * 0.1, p.ink, 2.2);
    if (s0.strip) {
      const xr = x + s0.dx;
      if (xr <= sp.xWin.x[1]) ring(ctx, pB.px(xr), pB.py(Gof(s0.pU, xr)), 4.5, p.accent, p.paper, 2);
    }
    dot(ctx, pB.px(x), pB.py(u.G), 5.5, p.accent, p.paper);
    haloText(ctx, p, 'x', pB.px(x), pB.box.y + 10, { font: font(700), color: p.accent });
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
  const aspect = setup.mode === 'symmetry' ? (narrow ? 1.15 : 1.7) : narrow ? 0.85 : 1.15;

  /* ---------------------------------------------------------------- learner changes */
  /** The learner changed the figure: apply, then tick whatever the new state completes. */
  const apply = (patch: Partial<Setup>) => {
    const next: Setup = { ...cur.current, ...patch };
    commit(next);
    for (const id of props.tasks ?? []) {
      const rule = RULES[id];
      if (!rule) continue;
      if (!rule.state(next)) {
        held.current.delete(id);
        continue;
      }
      if (!rule.needs.some((key) => key in patch)) continue;
      if (held.current.has(id)) continue;
      done(id);
    }
  };

  const setA = (v: number) => {
    const nv = fixA(roundTo(v, 0.01));
    if (nv !== cur.current.a) apply({ a: nv });
  };
  const setX = (v: number) => {
    const c = cur.current;
    const nv = fixX(c.pU, roundTo(v, 0.01));
    if (nv !== c.x) apply({ x: nv });
  };
  const setDxE = (e: number) => apply({ dx: dxOfE(e) });

  const dataX = (e: PointerEvent, plot: Plot) => plot.x.min + ((e.offsetX - plot.box.x) / plot.box.w) * (plot.x.max - plot.x.min);
  const fromPointer = (e: PointerEvent) => {
    const c = cur.current;
    const pl = plots.current;
    if (!pl.length) return;
    if (c.mode === 'symmetry') {
      setA(Math.abs(dataX(e, pl[0])));
      return;
    }
    const sp = UP[c.pU];
    if (dragging.current === 'x') setX(dataX(e, pl[1]));
    else if (dragging.current === 'g') setX(sp.gInv(dataX(e, pl[0]), c.x));
    else if (dragging.current === 'h' && sp.hInv) setX(sp.hInv(dataX(e, pl[0])));
  };
  const onPointerDown = (e: PointerEvent) => {
    const c = cur.current;
    const pl = plots.current;
    if (!pl.length) return;
    if (c.mode === 'symmetry') dragging.current = 'a';
    else {
      const [pT, pB] = pl;
      if (e.offsetY >= pB.box.y - 12) dragging.current = 'x';
      else {
        const sp = UP[c.pU];
        const u = upper(c.pU, c.x);
        dragging.current = sp.hMoves && Math.abs(e.offsetX - pT.px(u.lo)) < Math.abs(e.offsetX - pT.px(u.hi)) ? 'h' : 'g';
      }
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    fromPointer(e);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (dragging.current) fromPointer(e);
  };
  const onPointerUp = () => {
    if (dragging.current) setLive(describe(cur.current));
    dragging.current = null;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const c = cur.current;
    const sgn = e.key === 'ArrowLeft' ? -1 : 1;
    if (c.mode === 'symmetry') setA(c.a + sgn * 0.02);
    else setX(c.x + sgn * 0.02);
    setLive(describe(cur.current));
  };

  /* ---------------------------------------------------------------- text */
  const M = (q: { children: ComponentChildren }) => <bdi dir="ltr">{q.children}</bdi>;
  /** ∫ with limits as sub- and superscripts, inside an LTR island */
  const Int = (q: { lo: string; hi: string; children: ComponentChildren }) => (
    <bdi dir="ltr">
      ∫<sub>{q.lo}</sub>
      <sup>{q.hi}</sup> {q.children}
    </bdi>
  );

  function describe(s: Setup): string {
    if (s.mode === 'symmetry') {
      const r = symParts(s.pS, s.a);
      return `a = ${fmt(s.a, 3)}: ${fmt(r.left)} משמאל, ${fmt(r.right)} מימין, ובסך הכול ${fmt(r.total)}.`;
    }
    const u = upper(s.pU, s.x);
    return `x = ${fmt(s.x, 3)}: G(x) = ${fmt(u.G)}, G′(x) = ${fmt(u.Gprime)}.`;
  }

  const spS = SYM[setup.pS];
  const spU = UP[setup.pU];

  const label =
    setup.mode === 'symmetry'
      ? `איור חי: הגרף של ${spS.text} על הקטע הסימטרי מ-${ltr('−a')} עד ${ltr('a')}, והשטחים המסומנים משני צדי הציר האנכי. מעל ציר x מילוי מלא ומתחתיו קווים אלכסוניים. ${
          setup.mirror ? 'החצי השמאלי משוקף אל הצד הימני בקו מקווקו. ' : ''
        }${setup.parts && spS.parts ? 'החלק הזוגי והחלק האי-זוגי מצוירים בקווים מקווקווים. ' : ''}`
      : `איור חי: בלוח העליון הגרף של ${spU.ftext} והשטח מתחתיו מ-${spU.htext} עד ${spU.gtext}, והגבולות מסומנים על ציר t. בלוח התחתון הפונקציה G(x), השטח הזה כפונקציה של x, והמשיק שלה בנקודה x.${
          setup.strip ? ' הפס הצר שנוסף כשמזיזים את x ב-dx מסומן בקו מלא.' : ''
        }`;

  let readout: ComponentChildren;
  if (setup.mode === 'symmetry') {
    const a = setup.a;
    const r = symParts(setup.pS, a);
    const pi = partIntegrals(setup.pS, a);
    const kindText =
      spS.kind === 'odd' ? (
        'אי-זוגית: החלקים מתבטלים'
      ) : spS.kind === 'even' ? (
        <>
          זוגית: הכול פעמיים{' '}
          <Int lo="0" hi="a">
            f(x) dx
          </Int>
        </>
      ) : (
        'לא זוגית ולא אי-זוגית'
      );
    const mirrorText =
      spS.kind === 'odd' ? (
        <>
          החצי השמאלי מסובב חצי סיבוב סביב הראשית הוא הגרף של <M>−f(−x)</M>, והוא נופל בדיוק על <M>f</M>: השטח משמאל הוא מינוס השטח מימין
        </>
      ) : spS.kind === 'even' ? (
        <>
          החצי השמאלי משוקף בציר <M>y</M> הוא הגרף של <M>f(−x)</M>, והוא נופל בדיוק על <M>f</M>: השטח משמאל שווה לשטח מימין
        </>
      ) : (
        <>
          לא <M>f(−x)</M> ולא <M>−f(−x)</M> נופלות על <M>f</M>: אין סימטריה
        </>
      );
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>f(x) = {spS.text}</M>
          {spS.Ftext && (
            <>
              , <M>F(x) = {spS.Ftext}</M>
            </>
          )}
        </span>
        <span class="q" data-readout="a">
          <M>
            a = <b>{fmt(a, 3)}</b>
          </M>
        </span>
        <span class="q" data-readout="left">
          <M>
            <Int lo="−a" hi="0">
              f(x) dx = <b>{fmt(r.left)}</b>
            </Int>
          </M>
        </span>
        <span class="q" data-readout="right">
          <M>
            <Int lo="0" hi="a">
              f(x) dx = <b>{fmt(r.right)}</b>
            </Int>
          </M>
        </span>
        <span class="q" data-readout="total">
          <M>
            <Int lo="−a" hi="a">
              f(x) dx = <b>{fmt(r.total)}</b>
            </Int>
          </M>
        </span>
        <span class="q" data-readout="kind">
          <b>{kindText}</b>
        </span>
        {setup.mirror && (
          <span class="q" data-readout="mirror">
            {mirrorText}
          </span>
        )}
        {setup.parts && spS.parts && pi && (
          <span class="q" data-readout="parts">
            החלק הזוגי <M>{spS.parts.evenText}</M> והחלק האי-זוגי <M>{spS.parts.oddText}</M>:{' '}
            <Int lo="−a" hi="a">
              {spS.parts.evenText} dx = 2 sinh a = {fmt(pi.even)}
            </Int>
            ,{' '}
            <Int lo="−a" hi="a">
              {spS.parts.oddText} dx = {fmt(pi.odd)}
            </Int>
          </span>
        )}
        {!r.exact && (
          <span class="q" data-readout="numeric">
            אין נוסחה לפונקציה קדומה: הערכים חושבו נומרית (בקירוב)
          </span>
        )}
      </>
    );
  } else {
    const x = setup.x;
    const u = upper(setup.pU, x);
    const st = upperStrip(setup.pU, x, setup.dx);
    const fg = spU.f(u.hi);
    const fh = spU.f(u.lo);
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>
            G(x) ={' '}
            <Int lo={spU.htext} hi={spU.gtext}>
              {spU.ftext} dt
            </Int>
          </M>
        </span>
        <span class="q" data-readout="x">
          <M>
            x = <b>{fmt(x, 3)}</b>
          </M>
        </span>
        <span class="q" data-readout="limits">
          <M>
            g(x) = {spU.gtext} = <b>{fmt(u.hi)}</b>
          </M>
          {spU.hMoves ? (
            <>
              , <M>h(x) = {spU.htext} = <b>{fmt(u.lo)}</b></M>
            </>
          ) : (
            <>; הגבול התחתון קבוע</>
          )}
        </span>
        <span class="q" data-readout="G">
          {spU.Gtext ? (
            <M>
              G(x) = {spU.Gtext} = <b>{fmt(u.G)}</b>
            </M>
          ) : (
            <M>
              G(x) = <b>{fmt(u.G)}</b>
            </M>
          )}
          {setup.pU === 'recip-2x' && ': קבוע, לא תלוי ב-x'}
        </span>
        <span class="q" data-readout="gprime">
          {/* one LTR island that may break only between its pieces, never inside one */}
          <bdi dir="ltr" class="di-wrap">
            {spU.hMoves ? (
              <>
                <span class="di-nb">G′(x) = f(g(x))·g′(x) − f(h(x))·h′(x)</span>{' '}
                <span class="di-nb">
                  = {spU.fgtext}·{spU.gptext} − {spU.fhtext}·{spU.hptext}
                </span>{' '}
                <span class="di-nb">
                  = {fmt(fg)}·{fmt(spU.gp(x))} − {fmt(fh)}·{fmt(spU.hp(x))} = <b>{fmt(u.Gprime)}</b>
                </span>
              </>
            ) : (
              <>
                <span class="di-nb">G′(x) = f(g(x))·g′(x)</span>{' '}
                <span class="di-nb">
                  = {spU.fgtext}·{spU.gptext}
                </span>{' '}
                <span class="di-nb">
                  = {fmt(fg)}·{fmt(spU.gp(x))} = <b>{fmt(u.Gprime)}</b>
                </span>
              </>
            )}
          </bdi>
        </span>
        {setup.strip && (
          <span class="q" data-readout="strip">
            {spU.hMoves ? (
              <>
                הפס בגבול העליון: <M>{fmt(st.top.area)}</M>; הפס בגבול התחתון: <M>{fmt(st.bottom.area)}</M>; השינוי ב-<M>G</M>{' '}
                חלקי <M>dx = {fmt(setup.dx, 3)}</M>:
              </>
            ) : (
              <>
                שטח הפס: <M>{fmt(st.top.area)}</M>; שטח הפס חלקי <M>dx = {fmt(setup.dx, 3)}</M>:
              </>
            )}{' '}
            <M>
              <b>{fmt(st.perDx)}</b>
            </M>
            , לעומת <M>G′(x) = {fmt(u.Gprime)}</M>
          </span>
        )}
        {!u.exact && (
          <span class="q" data-readout="numeric">
            אין נוסחה ל-<M>G</M>: הערך של <M>G(x)</M> חושב נומרית (בקירוב). <M>G′(x)</M> מדויק.
          </span>
        )}
      </>
    );
  }

  const presetIds: readonly string[] = setup.mode === 'symmetry' ? SYM_IDS : UP_IDS;
  const presetText = (id: string) =>
    isSymId(id) ? SYM[id].text : isUpId(id) ? `∫ ${UP[id].ftext} dt   (t: ${UP[id].htext} → ${UP[id].gtext})` : id;
  const chosen = setup.mode === 'symmetry' ? setup.pS : setup.pU;

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
      readout={<div class="rtl-q di-readout">{readout}</div>}
      controls={
        <>
          {modes.length > 1 && (
            <div class="group" role="group" aria-label="מה מציג האיור">
              {modes.map((m) => (
                <Toggle key={m} label={MODE_LABEL[m]} on={setup.mode === m} onChange={() => apply({ mode: m })} />
              ))}
            </div>
          )}
          <label class="di-select" data-control="preset">
            <span class="di-lab">הפונקציה</span>
            <select
              dir="ltr"
              value={chosen}
              onChange={(e) => {
                const v = (e.target as HTMLSelectElement).value;
                const c = cur.current;
                if (c.mode === 'symmetry' && isSymId(v)) {
                  anchorA.current = SYM[v].a0;
                  apply({ pS: v, a: SYM[v].a0 });
                } else if (c.mode === 'upper' && isUpId(v)) {
                  anchorX.current = UP[v].x0;
                  apply({ pU: v, x: UP[v].x0 });
                }
              }}
            >
              {presetIds.map((id) => (
                <option key={id} value={id}>
                  {presetText(id)}
                </option>
              ))}
            </select>
          </label>
          {setup.mode === 'symmetry' && (
            <>
              <div class="group" role="group" aria-label="שכבות">
                <Toggle label="שיקוף החצי השמאלי" on={setup.mirror} swatch="var(--accent)" onChange={(on) => apply({ mirror: on })} />
                {spS.parts && <Toggle label="החלק הזוגי והאי-זוגי" on={setup.parts} swatch="var(--ink-2)" onChange={(on) => apply({ parts: on })} />}
              </div>
              <div class="di-ctl" data-control="a">
                <Slider label="חצי הרוחב a" value={setup.a} min={A_MIN} max={A_MAX} step={0.01} format={(v) => fmt(v, 3)} onChange={setA} />
              </div>
            </>
          )}
          {setup.mode === 'upper' && (
            <>
              <div class="group" role="group" aria-label="שכבות">
                <Toggle label="פס צר" on={setup.strip} swatch="var(--ink)" onChange={(on) => apply({ strip: on })} />
              </div>
              <div class="di-ctl" data-control="x">
                <Slider label="הנקודה x" value={setup.x} min={spU.xr[0]} max={spU.xr[1]} step={0.01} format={(v) => fmt(v, 3)} onChange={setX} />
              </div>
              {setup.strip && (
                <div class="di-ctl" data-control="dx">
                  <Slider
                    label="רוחב הצעד dx (סרגל לוגריתמי)"
                    value={roundTo(eOfDx(setup.dx), 0.01)}
                    min={DX_E_MIN}
                    max={DX_E_MAX}
                    step={0.01}
                    format={() => `dx = ${fmt(setup.dx, 3)}`}
                    onChange={setDxE}
                  />
                </div>
              )}
            </>
          )}
        </>
      }
    />
  );
}
