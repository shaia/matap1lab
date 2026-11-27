/**
 * RiemannLab (chapter 8.1, Riemann sums and the definite integral): three modes. Maths: src/math/riemann.ts, whose STORED
 * closed forms (the antiderivatives F and X, the zeros where f or v changes sign, arctan 2) give every exact value a readout
 * shows; a Riemann sum is a finite sum computed term by term; the one value without an antiderivative in the table
 * (∫₀² e^(−x²) dx) is stored from sympy and labelled "חישוב נומרי". Canvases are math space and stay LTR (x to the right,
 * y up); sliders for math quantities are `dir="ltr"`. Nothing moves by itself (no animation), so there is no motion for
 * motionAllowed() to gate. Panels are stacked in one canvas, so they also stack on a phone (390 px) without sideways scroll.
 *
 * mode 'sum' (button "סכום רימן"): preset f of RS (sq x² on [0, 2], sin on [0, π], cos on [0, 3π/2], recip 1/x on [1, e],
 *     exp eˣ on [0, 1]). f (--curve) with the n rectangles of the chosen rule: above the axis a solid fill (--pos), below
 *     it a hatched one (--neg), so the sign is never colour alone; the sample point of each piece is a dot on the graph.
 *     With `exact`: the region itself shaded faintly underneath (the same sign patterns) and the edges x = a, x = b dashed
 *     (--limit); the readout adds the exact integral and S − ∫. n by slider (1…64) or ←/→; the rule by buttons.
 * mode 'motion' (button "מהירות והעתק"): preset f of MO (reverse v = 2 − t on [0, 4], swing sin t on [0, 2π], forward
 *     1 + sin t on [0, 2π]).
 *     top panel     v(t) (--curve) with the signed area from 0 to t shaded (solid above, hatched below); with `abs` the
 *                   graph of |v| (dashed, --limit) and its area instead (all above the axis, solid); the zeros of v where
 *                   it changes sign are dotted vertical lines.
 *     bottom panel  the position x(t) = ∫₀ᵗ v (accent; bold up to t, faint after) and, with `abs`, the distance
 *                   s(t) = ∫₀ᵗ |v| (dashed, --limit).
 *     t by dragging on either panel, ←/→, or the slider.
 * mode 'props' (button "תכונות האינטגרל"): preset f of PR.
 *     add  f = sin x on [a, b] = [0, π] and a point c (−1…4.5, drag / ←/→ / slider): the region of ∫ₐᶜ solid (accent),
 *          the region of ∫ᶜᵇ hatched (--limit); below the axis an arrow for each integral from its lower to its upper
 *          limit (an arrow to the left = limits reversed), and a + / − glyph on each sign piece of each region for the
 *          sign of its contribution (a part below the axis taken with reversed limits counts +), so the sign is never
 *          colour alone. Readout: c, ∫ₐᶜ, ∫ᶜᵇ, ∫ₐᵇ and the identity with numbers; c outside [a, b] adds the reversal
 *          (c > b: ∫ᶜᵇ = −∫ᵇᶜ; c < a: ∫ₐᶜ = −∫ᶜₐ).
 *     cmp  f = e^(−x²) (--curve, region filled solid --pos) below g = 1/(1 + x²) (dashed accent, its region outlined)
 *          on [0, 2]. Readout: ∫g = arctan 2 (exact), ∫f (stored, "חישוב נומרי") and "f ≤ g ולכן ∫f ≤ ∫g".
 *
 * Props (defaults): id (required); mode ('sum'); modes (the mode buttons shown; default the starting mode only);
 * tasks ([]). f (an RS id for sum, an MO id for motion, a PR id for props; defaults 'sq', 'reverse', 'add');
 * n (6; an integer 1…64), rule ('left' | 'right' | 'mid'; 'left'), exact (false); t (the MO preset's t0: reverse 1.2,
 * swing 1.5, forward 1.5; clamped to [0, T]), abs (false); c (2; −1…4.5).
 * Every prop is also a step key (`<Step fig=… set={{…}}>`); a key left out keeps its value; `f` is routed to the mode
 * whose registry holds it (each mode keeps its own preset); a new MO preset without `t` puts t at that preset's t0.
 * A state set by a step never ticks a task, and a state that already had a task's property when a step or reset made it
 * must be left and found again. The learner can also pick the preset from a list (select "הפונקציה": the presets of the
 * current mode).
 *
 * Tasks (ticked only inside the learner's own drag, key, slider, select, button or toggle):
 *   sum:    rs-refine (exact on and n ≥ 32, reached by the learner's n slider / key or exact toggle), rs-rule (on an
 *           increasing preset, sq or exp, the learner switches the rule from left to right or from right to left: n is
 *           unchanged), rs-negative (preset cos and n ≥ 8, reached by the learner's n or preset choice: some rectangles
 *           lie below the axis)
 *   motion: mo-turn (the learner moves t across a zero of v where it changes sign, either way), mo-abs (the same with
 *           abs on)
 *   props:  pr-outside (preset add, the learner moves c outside [0, π]), pr-compare (the learner selects cmp)
 *
 * Hooks for e2e specs (inside `#<id>`; numbers use U+2212 for minus):
 *   buttons by role and name: the mode buttons "סכום רימן", "מהירות והעתק", "תכונות האינטגרל"; the rule buttons "שמאלי",
 *     "ימני", "אמצע" (sum; aria-pressed marks the current rule); the toggles "האינטגרל המדויק" (sum) and "הדרך שעבר
 *     הגוף" (motion); "איפוס" (reset)
 *   [data-control="preset"] select    the preset (option values are the preset ids of the current mode)
 *   [data-control=…] input            sum: n (1…64, step 1); motion: t (0…T, step 0.01); props add: c (−1…4.5, step 0.01)
 *   canvas                            motion: drag moves t; props add: drag moves c; ←/→ change n (sum), t (motion),
 *                                     c (props add)
 *   [data-readout=…]                  sum: fn, n, dx, rule, sum, rects, exact (with exact), diff (with exact), parts
 *                                     (with exact)
 *                                     motion: fn, t, v, disp, dist (with abs), dir (a sentence; at a zero of v where it
 *                                     changes sign "המהירות מחליפה סימן: הגוף מסתובב")
 *                                     props add: fn, c, ac, cb, total, identity, reverse (c outside [0, π] only)
 *                                     props cmp: fn, g-int, f-int, compare
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import {
  ADD,
  CMP,
  MO,
  MO_IDS,
  PR_IDS,
  RS,
  RS_IDS,
  addParts,
  displacement,
  distance,
  exact as exactOf,
  isMoId,
  isPrId,
  isRsId,
  isRsRule,
  posNeg,
  rectParts,
  riemannSum,
  type Fn,
  type MoId,
  type PrId,
  type RsId,
  type RsRule,
} from '~/math/riemann';
import { markTask } from '~/progress/store';
import { subscribeSteps, type StepState } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { sci } from './core/format';
import { withAlpha } from './core/ink';
import { drawAxes, makePlot, type Box, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import './RiemannLab.css';

export type RiemannMode = 'sum' | 'motion' | 'props';

export interface RiemannLabProps {
  id: string;
  mode?: RiemannMode;
  /** the mode buttons shown (default: the starting mode only) */
  modes?: RiemannMode[];
  /** an RS id (sum), an MO id (motion) or a PR id (props) */
  f?: string;
  n?: number;
  rule?: RsRule;
  exact?: boolean;
  t?: number;
  abs?: boolean;
  c?: number;
  tasks?: string[];
}

interface Setup {
  mode: RiemannMode;
  pS: RsId;
  n: number;
  rule: RsRule;
  exact: boolean;
  pM: MoId;
  t: number;
  abs: boolean;
  pP: PrId;
  c: number;
}

const ltr = (s: string) => String.fromCharCode(0x2066) + s.replace(/ /g, String.fromCharCode(0xa0)) + String.fromCharCode(0x2069);

const TASK_LABEL: Record<string, string> = {
  'rs-refine': `הדליקו "האינטגרל המדויק" והגדילו את ${ltr('n')} ל-32 לפחות. כמה נשאר בין הסכום לאינטגרל?`,
  'rs-rule': `בפונקציה עולה (${ltr('x²')} או ${ltr('eˣ')}) החליפו בין סכום שמאלי לסכום ימני בלי לשנות את ${ltr('n')}. איזה מהם מתחת לאינטגרל ואיזה מעליו?`,
  'rs-negative': `בחרו ${ltr('cos x')} והגדילו את ${ltr('n')} ל-8 לפחות. איך נספרים המלבנים שמתחת לציר?`,
  'mo-turn': 'הזיזו את t אל מעבר לרגע שבו המהירות מתאפסת ומחליפה סימן. מה קורה להעתק מאותו רגע?',
  'mo-abs': 'הדליקו "הדרך שעבר הגוף" והזיזו את t אל מעבר לרגע שבו המהירות מחליפה סימן. מה קורה לדרך, ומה להעתק?',
  'pr-outside': `גררו את הנקודה c אל מחוץ לקטע ${ltr('[0, π]')}. האם סכום שני האינטגרלים עדיין שווה לאינטגרל על כל הקטע?`,
  'pr-compare': `בחרו את ההשוואה ${ltr('e^(−x²) ≤ 1/(1 + x²)')}. מה אפשר לומר על שני האינטגרלים בלי לחשב את הראשון?`,
};

const MODE_LABEL: Record<RiemannMode, string> = { sum: 'סכום רימן', motion: 'מהירות והעתק', props: 'תכונות האינטגרל' };
const RULE_BUTTON: Record<RsRule, string> = { left: 'שמאלי', right: 'ימני', mid: 'אמצע' };
const RULE_TEXT: Record<RsRule, string> = {
  left: 'סכום שמאלי: בכל קטע דוגמים בקצה השמאלי',
  right: 'סכום ימני: בכל קטע דוגמים בקצה הימני',
  mid: 'סכום האמצעים: בכל קטע דוגמים באמצע',
};

const N_MAX = 64;
const TURN_TOL = 0.025;
const TAU = 2 * Math.PI;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const bool = (x: unknown): boolean | null => (typeof x === 'boolean' ? x : null);
const roundTo = (x: number, step: number) => Number((Math.round(x / step) * step).toPrecision(10));
const minus = (s: string) => s.replace(/-/g, '−');
const fmt = (x: number, sig = 4) => (Number.isNaN(x) ? '—' : Math.abs(x) < 1e-12 ? '0' : minus(sci(x, sig)));
/** a number as a term of a sum: negative ones in brackets */
const term = (x: number, sig = 4) => (x < 0 && Math.abs(x) >= 1e-12 ? `(${fmt(x, sig)})` : fmt(x, sig));
const fixN = (n: number) => clamp(Math.round(n), 1, N_MAX);
const fixT = (id: MoId, t: number) => clamp(roundTo(t, 0.01), 0, MO[id].T);
const fixC = (c: number) => clamp(roundTo(c, 0.01), ADD.c[0], ADD.c[1]);

/** the sign-change zero of v crossed when t moves from p to q (q not on it), or null */
function crossed(id: MoId, p: number, q: number): number | null {
  for (const z of MO[id].zeros) if (q !== z && Math.sign(p - z) !== Math.sign(q - z)) return z;
  return null;
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
/** a horizontal arrow from x1 to x2 at height y */
function hArrow(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number, color: string) {
  const d = x2 - x1;
  if (Math.abs(d) < 2) return;
  const s = Math.sign(d);
  const head = Math.min(8, Math.abs(d) * 0.5);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2 - s * head * 0.8, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y);
  ctx.lineTo(x2 - s * head, y - 4);
  ctx.lineTo(x2 - s * head, y + 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
/** "∫" with its lower limit below and its upper limit above, centred at (x, y) */
function intLabel(ctx: CanvasRenderingContext2D, p: Palette, x: number, y: number, lo: string, hi: string, color: string) {
  haloText(ctx, p, '∫', x - 4, y, { font: `600 16px ${p.fontUi}`, color });
  haloText(ctx, p, hi, x + 3, y - 7, { font: `600 11px ${p.fontUi}`, color, align: 'left' });
  haloText(ctx, p, lo, x + 3, y + 8, { font: `600 11px ${p.fontUi}`, color, align: 'left' });
}

/** f on [lo, hi], clipped to the plot */
function stroke(ctx: CanvasRenderingContext2D, plot: Plot, f: Fn, lo: number, hi: number, color: string, width: number, dash: number[] = []) {
  if (!(hi > lo)) return;
  const [y0, y1] = [plot.y.min, plot.y.max];
  const span = y1 - y0;
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.box.x, plot.box.y - 2, plot.box.w, plot.box.h + 4);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.setLineDash(dash);
  ctx.beginPath();
  const n = 400;
  for (let i = 0; i <= n; i++) {
    const x = lo + ((hi - lo) * i) / n;
    const sx = plot.px(x);
    const sy = plot.py(clamp(f(x), y0 - 3 * span, y1 + 3 * span));
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();
  ctx.restore();
}

/** the closed path between the graph of f and the axis over [lo, hi] */
function regionPath(plot: Plot, f: Fn, lo: number, hi: number): Path2D {
  const { box } = plot;
  const [y0, y1] = [plot.y.min, plot.y.max];
  const span = y1 - y0;
  const zero = clamp(plot.py(0), box.y, box.y + box.h);
  const path = new Path2D();
  path.moveTo(plot.px(lo), zero);
  const n = 260;
  for (let i = 0; i <= n; i++) {
    const x = lo + ((hi - lo) * i) / n;
    path.lineTo(plot.px(x), plot.py(clamp(f(x), y0 - 3 * span, y1 + 3 * span)));
  }
  path.lineTo(plot.px(hi), zero);
  path.closePath();
  return path;
}

/** diagonal lines over the box (slope +1 when `up`, −1 otherwise), drawn inside the current clip */
function hatchLines(ctx: CanvasRenderingContext2D, box: Box, color: string, up: boolean, gap = 6, width = 1.3) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  for (let k = -box.h; k < box.w + box.h; k += gap) {
    if (up) {
      ctx.moveTo(box.x + k, box.y + box.h);
      ctx.lineTo(box.x + k + box.h, box.y);
    } else {
      ctx.moveTo(box.x + k, box.y);
      ctx.lineTo(box.x + k + box.h, box.y + box.h);
    }
  }
  ctx.stroke();
}

/** the region between f and the axis over [lo, hi]: above the axis a solid fill (--pos), below it a hatched one (--neg);
 * `k` scales the strength (1 for the area itself, less for a faint backdrop) */
function shadeSigned(ctx: CanvasRenderingContext2D, p: Palette, plot: Plot, f: Fn, lo: number, hi: number, k = 1) {
  if (!(hi > lo)) return;
  const { box } = plot;
  const zero = clamp(plot.py(0), box.y, box.y + box.h);
  const path = regionPath(plot, f, lo, hi);
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, zero - box.y);
  ctx.clip();
  ctx.clip(path);
  ctx.fillStyle = withAlpha(p.pos, 0.3 * k);
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, zero, box.w, box.y + box.h - zero);
  ctx.clip();
  ctx.clip(path);
  ctx.fillStyle = withAlpha(p.neg, 0.1 * k);
  ctx.fillRect(box.x, box.y, box.w, box.h);
  hatchLines(ctx, box, withAlpha(p.neg, 0.9 * k), true);
  ctx.restore();
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
  drawAxes(ctx, pl, p);
  if (pl.y.min < 0 && pl.y.max > 0) line(ctx, pl.box.x, pl.py(0), pl.box.x + pl.box.w, pl.py(0), withAlpha(p.ink2, 0.75), 1.2);
  if (pl.x.min < 0 && pl.x.max > 0) line(ctx, pl.px(0), pl.box.y, pl.px(0), pl.box.y + pl.box.h, withAlpha(p.ink2, 0.75), 1.2);
}

/** the sign pieces of [lo, hi] (split at the given zeros) */
function signPieces(lo: number, hi: number, zeros: readonly number[]): [number, number][] {
  const cuts = [lo, ...zeros.filter((z) => z > lo + 1e-9 && z < hi - 1e-9), hi];
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < cuts.length; i++) out.push([cuts[i], cuts[i + 1]]);
  return out;
}

interface Rule {
  needs: (keyof Setup)[];
  event?: boolean;
  state: (s: Setup, patch: Partial<Setup>, prev: Setup) => boolean;
}

export default function RiemannLab(props: RiemannLabProps) {
  const startMode: RiemannMode = props.mode ?? 'sum';
  const modes: RiemannMode[] = props.modes ?? [startMode];
  const initial = (): Setup => {
    const pM: MoId = isMoId(props.f) ? props.f : 'reverse';
    return {
      mode: startMode,
      pS: isRsId(props.f) ? props.f : 'sq',
      n: fixN(props.n ?? 6),
      rule: isRsRule(props.rule) ? props.rule : 'left',
      exact: props.exact ?? false,
      pM,
      t: fixT(pM, props.t ?? MO[pM].t0),
      abs: props.abs ?? false,
      pP: isPrId(props.f) ? props.f : 'add',
      c: fixC(props.c ?? ADD.c0),
    };
  };
  const [setup, setSetup] = useState<Setup>(initial);
  const cur = useRef(setup);
  const [live, setLive] = useState('');
  const [narrow, setNarrow] = useState(false);
  const plots = useRef<Plot[]>([]);
  const dragging = useRef(false);
  /** tasks whose state held when the last step or reset made it: they must be left and found again */
  const held = useRef<Set<string>>(new Set());

  const RULES: Record<string, Rule> = {
    'rs-refine': { needs: ['n', 'exact'], state: (s) => s.mode === 'sum' && s.exact && s.n >= 32 },
    'rs-rule': {
      needs: ['rule'],
      event: true,
      state: (s, p, prev) =>
        s.mode === 'sum' &&
        p.rule !== undefined &&
        RS[s.pS].monotone === 'inc' &&
        ((prev.rule === 'left' && s.rule === 'right') || (prev.rule === 'right' && s.rule === 'left')),
    },
    'rs-negative': {
      needs: ['n', 'pS'],
      state: (s) => s.mode === 'sum' && s.pS === 'cos' && s.n >= 8 && rectParts(riemannSum(s.pS, s.n, s.rule).rects).negCount > 0,
    },
    'mo-turn': { needs: ['t'], event: true, state: (s, p, prev) => s.mode === 'motion' && p.t !== undefined && crossed(s.pM, prev.t, s.t) !== null },
    'mo-abs': {
      needs: ['t'],
      event: true,
      state: (s, p, prev) => s.mode === 'motion' && s.abs && p.t !== undefined && crossed(s.pM, prev.t, s.t) !== null,
    },
    'pr-outside': { needs: ['c'], state: (s) => s.mode === 'props' && s.pP === 'add' && (s.c < ADD.a - 1e-9 || s.c > ADD.b + 1e-9) },
    'pr-compare': { needs: ['pP'], state: (s) => s.mode === 'props' && s.pP === 'cmp' },
  };

  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const done = (t: string) => {
    if (props.tasks?.includes(t)) markTask(`${props.id}:${t}`);
  };
  const rebase = (s: Setup) => {
    held.current = new Set((props.tasks ?? []).filter((id) => RULES[id] && !RULES[id].event && RULES[id].state(s, {}, s)));
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
        const mode = typeof st.mode === 'string' && modes.includes(st.mode as RiemannMode) ? (st.mode as RiemannMode) : prev.mode;
        const next: Setup = { ...prev, mode };
        if (isRsId(st.f)) next.pS = st.f;
        const newM = isMoId(st.f) && st.f !== prev.pM;
        if (isMoId(st.f)) next.pM = st.f;
        if (isPrId(st.f)) next.pP = st.f;
        const sn = num(st.n);
        if (sn !== null) next.n = fixN(sn);
        if (isRsRule(st.rule)) next.rule = st.rule;
        next.exact = bool(st.exact) ?? prev.exact;
        next.t = fixT(next.pM, num(st.t) ?? (newM ? MO[next.pM].t0 : prev.t));
        next.abs = bool(st.abs) ?? prev.abs;
        const sc = num(st.c);
        if (sc !== null) next.c = fixC(sc);
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

    if (s0.mode === 'sum') {
      const sp = RS[s0.pS];
      const [box] = layout(view.w, view.h, [1]);
      const pl = makePlot(box, { min: sp.window.x[0], max: sp.window.x[1] }, { min: sp.window.y[0], max: sp.window.y[1], label: 'f(x)' });
      plots.current = [pl];
      axisLines(ctx, p, pl);
      if (s0.exact) shadeSigned(ctx, p, pl, sp.f, sp.a, sp.b, 0.55);
      const { rects } = riemannSum(s0.pS, s0.n, s0.rule);
      const zero = pl.py(0);
      ctx.save();
      ctx.beginPath();
      ctx.rect(box.x, box.y, box.w, box.h);
      ctx.clip();
      const k = s0.exact ? 0.7 : 1;
      for (const r of rects) {
        const x0 = pl.px(r.x0);
        const x1 = pl.px(r.x1);
        const yh = pl.py(r.h);
        const top = Math.min(yh, zero);
        const hgt = Math.abs(yh - zero);
        if (r.h >= 0) {
          ctx.fillStyle = withAlpha(p.pos, 0.32 * k);
          ctx.fillRect(x0, top, x1 - x0, hgt);
          ctx.strokeStyle = withAlpha(p.pos, 0.95);
        } else {
          ctx.save();
          ctx.beginPath();
          ctx.rect(x0, top, x1 - x0, hgt);
          ctx.clip();
          ctx.fillStyle = withAlpha(p.neg, 0.1 * k);
          ctx.fillRect(x0, top, x1 - x0, hgt);
          hatchLines(ctx, { x: x0, y: top, w: x1 - x0, h: hgt }, withAlpha(p.neg, 0.9 * k), true);
          ctx.restore();
          ctx.strokeStyle = withAlpha(p.neg, 0.95);
        }
        ctx.lineWidth = s0.n > 40 ? 0.8 : 1.2;
        ctx.strokeRect(x0, top, x1 - x0, hgt);
      }
      ctx.restore();
      if (s0.exact) {
        line(ctx, pl.px(sp.a), box.y, pl.px(sp.a), box.y + box.h, withAlpha(p.limit, 0.85), 1.3, [5, 4]);
        line(ctx, pl.px(sp.b), box.y, pl.px(sp.b), box.y + box.h, withAlpha(p.limit, 0.85), 1.3, [5, 4]);
      }
      stroke(ctx, pl, sp.f, pl.x.min, pl.x.max, p.curve, 2.6);
      const r = s0.n <= 16 ? 3.6 : s0.n <= 40 ? 2.8 : 2.2;
      for (const q of rects) dot(ctx, pl.px(q.xs), pl.py(q.h), r, p.ink, p.paper);
      haloText(ctx, p, `n = ${s0.n}`, box.x + 10, box.y + 12, { font: font(700), align: 'left' });
      return;
    }

    if (s0.mode === 'motion') {
      const sp = MO[s0.pM];
      const T = sp.T;
      const [top, bot] = layout(view.w, view.h, [1, 1]);
      const xr = { min: -0.03 * T, max: 1.03 * T };
      const pT = makePlot(top, xr, { min: sp.window.v[0], max: sp.window.v[1], label: 'v(t)' });
      const pB = makePlot(bot, xr, { min: sp.window.x[0], max: sp.window.x[1], label: s0.abs ? 'x(t), s(t)' : 'x(t)' });
      plots.current = [pT, pB];
      axisLines(ctx, p, pT);
      axisLines(ctx, p, pB);
      const t = s0.t;
      const absV: Fn = (u) => Math.abs(sp.v(u));
      if (s0.abs) shadeSigned(ctx, p, pT, absV, 0, t);
      else shadeSigned(ctx, p, pT, sp.v, 0, t);
      for (const z of sp.zeros)
        for (const pl of [pT, pB]) line(ctx, pl.px(z), pl.box.y, pl.px(z), pl.box.y + pl.box.h, withAlpha(p.ink2, 0.8), 1.2, [2, 4]);
      stroke(ctx, pT, sp.v, 0, T, p.curve, 2.6);
      if (s0.abs) stroke(ctx, pT, absV, 0, T, p.limit, 2.2, [7, 5]);
      // the probe line through both panels
      for (const pl of [pT, pB]) line(ctx, pl.px(t), pl.box.y, pl.px(t), pl.box.y + pl.box.h, withAlpha(p.accent, 0.6), 1.2, [3, 4]);
      dot(ctx, pT.px(t), pT.py(sp.v(t)), 5.5, p.accent, p.paper);
      // the position and the distance
      const X: Fn = (u) => displacement(s0.pM, u);
      const S: Fn = (u) => distance(s0.pM, u);
      stroke(ctx, pB, X, 0, T, withAlpha(p.accent, 0.35), 2);
      stroke(ctx, pB, X, 0, t, p.accent, 3);
      if (s0.abs) {
        stroke(ctx, pB, S, 0, T, withAlpha(p.limit, 0.35), 1.8, [7, 5]);
        stroke(ctx, pB, S, 0, t, p.limit, 2.6, [7, 5]);
        ring(ctx, pB.px(t), pB.py(S(t)), 5, p.limit, p.paper, 2.4);
      }
      dot(ctx, pB.px(t), pB.py(X(t)), 5.5, p.accent, p.paper);
      haloText(ctx, p, 'x(t)', pB.px(T) - 4, pB.py(X(T)) - 12, { font: font(700), color: p.accent, align: 'right' });
      if (s0.abs) haloText(ctx, p, 's(t)', pB.px(T) - 4, pB.py(S(T)) + 13, { font: font(700), color: p.limit, align: 'right' });
      // the handle of t
      ctx.save();
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pB.px(t), pB.box.y + pB.box.h - 13);
      ctx.lineTo(pB.px(t), pB.box.y + pB.box.h - 2);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // props
    if (s0.pP === 'cmp') {
      const W = CMP.window;
      const [box] = layout(view.w, view.h, [1]);
      const pl = makePlot(box, { min: W.x[0], max: W.x[1] }, { min: W.y[0], max: W.y[1], label: 'f, g' });
      plots.current = [pl];
      axisLines(ctx, p, pl);
      shadeSigned(ctx, p, pl, CMP.f, CMP.a, CMP.b);
      ctx.save();
      ctx.beginPath();
      ctx.rect(box.x, box.y, box.w, box.h);
      ctx.clip();
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 1.6;
      ctx.stroke(regionPath(pl, CMP.g, CMP.a, CMP.b));
      ctx.restore();
      stroke(ctx, pl, CMP.g, W.x[0], W.x[1], p.accent, 2.4, [7, 5]);
      stroke(ctx, pl, CMP.f, W.x[0], W.x[1], p.curve, 2.6);
      haloText(ctx, p, 'g', pl.px(0.75), pl.py(CMP.g(0.75)) - 12, { font: font(700, 13), color: p.accent });
      haloText(ctx, p, 'f', pl.px(1.05), pl.py(CMP.f(1.05)) - 10, { font: font(700, 13), color: p.curve, align: 'right' });
      return;
    }

    const W = ADD.window;
    const [box] = layout(view.w, view.h, [1]);
    const pl = makePlot(box, { min: W.x[0], max: W.x[1] }, { min: -1.85, max: W.y[1], label: 'f(x)' });
    plots.current = [pl];
    axisLines(ctx, p, pl);
    const { a, b } = ADD;
    const c = s0.c;
    const R1: [number, number] = [Math.min(a, c), Math.max(a, c)];
    const R2: [number, number] = [Math.min(c, b), Math.max(c, b)];
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    if (R1[1] > R1[0]) {
      ctx.fillStyle = withAlpha(p.accent, 0.28);
      ctx.fill(regionPath(pl, ADD.f, R1[0], R1[1]));
    }
    if (R2[1] > R2[0]) {
      ctx.save();
      ctx.clip(regionPath(pl, ADD.f, R2[0], R2[1]));
      ctx.fillStyle = withAlpha(p.limit, 0.08);
      ctx.fillRect(box.x, box.y, box.w, box.h);
      hatchLines(ctx, box, withAlpha(p.limit, 0.9), false, 7, 1.4);
      ctx.restore();
    }
    ctx.restore();
    stroke(ctx, pl, ADD.f, W.x[0], W.x[1], p.curve, 2.6);
    // + / − on each sign piece of each region: the sign of its contribution (reversed limits flip it)
    const overlap = (u: [number, number], v: [number, number]) => Math.min(u[1], v[1]) - Math.max(u[0], v[0]) > 1e-9;
    const glyphs = (R: [number, number], orient: number, other: [number, number], frac: number, color: string) => {
      for (const piece of signPieces(R[0], R[1], ADD.zeros)) {
        const xm = (piece[0] + piece[1]) / 2;
        const fm = ADD.f(xm);
        if (Math.abs(pl.px(piece[1]) - pl.px(piece[0])) < 18 || Math.abs(pl.py(fm) - pl.py(0)) < 20) continue;
        const sgn = Math.sign(fm) * orient;
        const y = pl.py(fm * (overlap(piece, other) ? frac : 0.5));
        haloText(ctx, p, sgn > 0 ? '+' : '−', pl.px(xm), y, { font: font(800, 17), color });
      }
    };
    glyphs(R1, c >= a ? 1 : -1, R2, 0.3, p.accent);
    glyphs(R2, b >= c ? 1 : -1, R1, 0.7, p.limit);
    // the arrows of the two integrals, from the lower limit to the upper one
    const yA1 = pl.py(-1.3);
    const yA2 = pl.py(-1.62);
    hArrow(ctx, pl.px(a), pl.px(c), yA1, p.accent);
    hArrow(ctx, pl.px(c), pl.px(b), yA2, p.limit);
    const labX = (u: number, v: number) => clamp((pl.px(u) + pl.px(v)) / 2, box.x + 16, box.x + box.w - 22);
    if (Math.abs(pl.px(c) - pl.px(a)) > 26) intLabel(ctx, p, labX(a, c), yA1 - 13, 'a', 'c', p.accent);
    if (Math.abs(pl.px(c) - pl.px(b)) > 26) intLabel(ctx, p, labX(c, b), yA2 - 13, 'c', 'b', p.limit);
    // a, b fixed (rings), c the handle
    const y0 = pl.py(0);
    for (const [v, s] of [
      [a, 'a'],
      [b, 'b'],
    ] as const) {
      ring(ctx, pl.px(v), y0, 5.5, p.ink, p.paper, 2.2);
      haloText(ctx, p, s, pl.px(v) + (s === 'a' ? -9 : 9), y0 + 12, { font: font(700), color: p.ink });
    }
    line(ctx, pl.px(c), box.y, pl.px(c), box.y + box.h, withAlpha(p.accent, 0.6), 1.2, [3, 4]);
    dot(ctx, pl.px(c), y0, 6.5, p.accent, p.paper);
    haloText(ctx, p, 'c', pl.px(c), y0 - 15, { font: font(700, 13), color: p.accent });
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
  const aspect = setup.mode === 'motion' ? (narrow ? 0.8 : 1.15) : narrow ? 1.05 : 1.5;

  /* ---------------------------------------------------------------- learner changes */
  /** The learner changed the figure: apply, then tick whatever the new state completes. */
  const apply = (patch: Partial<Setup>) => {
    const prev = cur.current;
    const next: Setup = { ...prev, ...patch };
    commit(next);
    for (const id of props.tasks ?? []) {
      const rule = RULES[id];
      if (!rule) continue;
      if (!rule.state(next, patch, prev)) {
        held.current.delete(id);
        continue;
      }
      if (!rule.needs.some((key) => key in patch)) continue;
      if (!rule.event && held.current.has(id)) continue;
      done(id);
    }
  };

  const setN = (v: number) => {
    const nv = fixN(v);
    if (nv !== cur.current.n) apply({ n: nv });
  };
  const setT = (v: number) => {
    const c = cur.current;
    const nv = fixT(c.pM, v);
    if (nv !== c.t) apply({ t: nv });
  };
  const setC = (v: number) => {
    const nv = fixC(v);
    if (nv !== cur.current.c) apply({ c: nv });
  };

  const dataX = (e: PointerEvent, plot: Plot) => plot.x.min + ((e.offsetX - plot.box.x) / plot.box.w) * (plot.x.max - plot.x.min);
  const draggable = (c: Setup) => c.mode === 'motion' || (c.mode === 'props' && c.pP === 'add');
  const fromPointer = (e: PointerEvent) => {
    const c = cur.current;
    const pl = plots.current;
    if (!pl.length) return;
    const x = dataX(e, pl[0]);
    if (c.mode === 'motion') setT(x);
    else if (c.mode === 'props' && c.pP === 'add') setC(x);
  };
  const onPointerDown = (e: PointerEvent) => {
    if (!plots.current.length || !draggable(cur.current)) return;
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
    const c = cur.current;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const sgn = e.key === 'ArrowLeft' ? -1 : 1;
    if (c.mode === 'sum') setN(c.n + sgn);
    else if (c.mode === 'motion') setT(c.t + sgn * 0.05);
    else if (c.pP === 'add') setC(c.c + sgn * 0.05);
    else return;
    e.preventDefault();
    setLive(describe(cur.current));
  };

  /* ---------------------------------------------------------------- text */
  const M = (q: { children: ComponentChildren }) => <bdi dir="ltr">{q.children}</bdi>;
  const Int = (q: { lo: string; hi: string }) => (
    <>
      ∫<sub>{q.lo}</sub>
      <sup>{q.hi}</sup>
    </>
  );

  function describe(s: Setup): string {
    if (s.mode === 'sum') return `n = ${s.n}, ${RULE_TEXT[s.rule]}: S = ${fmt(riemannSum(s.pS, s.n, s.rule).sum)}.`;
    if (s.mode === 'motion') return `t = ${fmt(s.t, 3)}: v = ${fmt(MO[s.pM].v(s.t), 3)}, העתק ${fmt(displacement(s.pM, s.t))}${s.abs ? `, דרך ${fmt(distance(s.pM, s.t))}` : ''}.`;
    if (s.pP === 'add') {
      const q = addParts(s.c);
      return `c = ${fmt(s.c, 3)}: ${fmt(q.ac)} + ${term(q.cb)} = ${fmt(q.ab)}.`;
    }
    return `האינטגרל של f קטן מהאינטגרל של g: ${fmt(CMP.fInt)} לעומת ${fmt(CMP.gInt)}.`;
  }

  const spS = RS[setup.pS];
  const spM = MO[setup.pM];

  const label =
    setup.mode === 'sum'
      ? `איור חי: סכום רימן של ${spS.text} בקטע מ-${spS.aText} עד ${spS.bText}, ב-${setup.n} מלבנים. מלבן מעל הציר מלא, ומלבן מתחת לציר מקווקו באלכסון ונספר בסימן מינוס. הנקודה על הגרף בכל מלבן היא נקודת הדגימה.${setup.exact ? ' ברקע, בדהוי, השטח המדויק מתחת לגרף.' : ''}`
      : setup.mode === 'motion'
        ? `איור חי: המהירות v(t) = ${spM.text} בלוח העליון, עם השטח מ-0 עד t${setup.abs ? ' מתחת לגרף של |v|' : ' עם סימן: מעל הציר מלא, מתחתיו מקווקו'}. בלוח התחתון ההעתק x(t)${setup.abs ? ' והדרך s(t), בקו מקווקו' : ''}.`
        : setup.pP === 'add'
          ? 'איור חי: הגרף של sin x והנקודה c. השטח של האינטגרל מ-a עד c מלא, והשטח של האינטגרל מ-c עד b מקווקו. החצים מתחת לציר הולכים מהגבול התחתון של כל אינטגרל לגבול העליון שלו, והסימנים פלוס ומינוס מראים את הסימן של כל חלק.'
          : 'איור חי: הגרף של e בחזקת מינוס x בריבוע, ומעליו, בקו מקווקו, הגרף של 1 חלקי 1 ועוד x בריבוע, בקטע מ-0 עד 2. השטח מתחת לגרף התחתון מלא, והשטח מתחת לגרף העליון מוקף בקו.';

  let readout: ComponentChildren;
  if (setup.mode === 'sum') {
    const { sum, dx, rects } = riemannSum(setup.pS, setup.n, setup.rule);
    const ex = exactOf(setup.pS);
    const { up, down } = rectParts(rects);
    const { pos, neg } = posNeg(setup.pS);
    const d = sum - ex;
    const intText = /^−?\d+$/.test(spS.exactText) ? '' : ` ≈ ${fmt(ex)}`;
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>
            f(x) = {spS.text}, [a, b] = [{spS.aText}, {spS.bText}]
          </M>
        </span>
        <span class="q" data-readout="n">
          <M>
            n = <b>{setup.n}</b>
          </M>
        </span>
        <span class="q" data-readout="dx">
          <M>
            Δx = (b − a)/n = <b>{fmt(dx)}</b>
          </M>
        </span>
        <span class="q" data-readout="rule">
          {RULE_TEXT[setup.rule]}
        </span>
        <span class="q" data-readout="sum">
          <M>
            S = Σ f(xᵢ*)·Δx = <b>{fmt(sum)}</b>
          </M>
        </span>
        <span class="q" data-readout="rects">
          מלבנים מעל הציר (מלא): <M>{fmt(up)}</M>; מתחת לציר (פסים, נספרים במינוס): <M>{fmt(down)}</M>
        </span>
        {setup.exact && (
          <>
            <span class="q" data-readout="exact">
              <M>
                <Int lo={spS.aText} hi={spS.bText} /> {spS.text} dx = <b>{spS.exactText}</b>
                {intText}
              </M>
            </span>
            <span class="q" data-readout="diff">
              <M>
                S − ∫ = <b>{fmt(d, 3)}</b>
              </M>
              : {Math.abs(d) < 5e-13 ? 'הסכום שווה לאינטגרל' : d < 0 ? 'הסכום קטן מהאינטגרל' : 'הסכום גדול מהאינטגרל'}
            </span>
            <span class="q" data-readout="parts">
              השטח המדויק מעל הציר: <M>{fmt(pos)}</M>; מתחת לציר: <M>{fmt(neg)}</M>
            </span>
          </>
        )}
      </>
    );
  } else if (setup.mode === 'motion') {
    const t = setup.t;
    const v = spM.v(t);
    const z = spM.zeros.find((q) => Math.abs(t - q) <= TURN_TOL);
    const touch = spM.touches.find((q) => Math.abs(t - q) <= TURN_TOL);
    const dir =
      z !== undefined
        ? 'המהירות מחליפה סימן: הגוף מסתובב'
        : touch !== undefined
          ? 'המהירות מתאפסת בלי להחליף סימן: הגוף עוצר לרגע וממשיך קדימה'
          : Math.abs(v) < 1e-9
            ? 'המהירות 0 ברגע הזה'
            : v > 0
              ? 'המהירות חיובית: הגוף נע קדימה, וההעתק גדל'
              : 'המהירות שלילית: הגוף נע אחורה, וההעתק קטן';
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>
            v(t) = {spM.text}, 0 ≤ t ≤ {spM.Ttext}
          </M>
        </span>
        <span class="q" data-readout="t">
          <M>
            t = <b>{fmt(t, 3)}</b>
          </M>
        </span>
        <span class="q" data-readout="v">
          <M>
            v(t) = <b>{fmt(v)}</b>
          </M>
        </span>
        <span class="q" data-readout="disp">
          ההעתק:{' '}
          <M>
            x(t) = <Int lo="0" hi="t" /> v dt = <b>{fmt(displacement(setup.pM, t))}</b>
          </M>
        </span>
        {setup.abs && (
          <span class="q" data-readout="dist">
            הדרך:{' '}
            <M>
              s(t) = <Int lo="0" hi="t" /> |v| dt = <b>{fmt(distance(setup.pM, t))}</b>
            </M>
          </span>
        )}
        <span class="q" data-readout="dir">
          <b>{dir}</b>
        </span>
      </>
    );
  } else if (setup.pP === 'add') {
    const c = setup.c;
    const q = addParts(c);
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>f(x) = sin x, a = 0, b = π</M>
        </span>
        <span class="q" data-readout="c">
          <M>
            c = <b>{fmt(c, 3)}</b>
          </M>
        </span>
        <span class="q" data-readout="ac">
          <M>
            <Int lo="a" hi="c" /> f dx = 1 − cos c = <b>{fmt(q.ac)}</b>
          </M>
        </span>
        <span class="q" data-readout="cb">
          <M>
            <Int lo="c" hi="b" /> f dx = 1 + cos c = <b>{fmt(q.cb)}</b>
          </M>
        </span>
        <span class="q" data-readout="total">
          <M>
            <Int lo="a" hi="b" /> f dx = <b>{fmt(q.ab)}</b>
          </M>
        </span>
        <span class="q" data-readout="identity">
          <M>
            <Int lo="a" hi="c" /> + <Int lo="c" hi="b" /> = {fmt(q.ac)} + {term(q.cb)} = <b>{fmt(q.ac + q.cb)}</b> = <Int lo="a" hi="b" />
          </M>
        </span>
        {c > ADD.b + 1e-9 && (
          <span class="q" data-readout="reverse">
            <M>c &gt; b</M>: הגבולות של <M><Int lo="c" hi="b" /></M> הפוכים, ולכן{' '}
            <M>
              <Int lo="c" hi="b" /> = −<Int lo="b" hi="c" /> = −{term(-q.cb)} = {fmt(q.cb)}
            </M>
          </span>
        )}
        {c < ADD.a - 1e-9 && (
          <span class="q" data-readout="reverse">
            <M>c &lt; a</M>: הגבולות של <M><Int lo="a" hi="c" /></M> הפוכים, ולכן{' '}
            <M>
              <Int lo="a" hi="c" /> = −<Int lo="c" hi="a" /> = −{term(-q.ac)} = {fmt(q.ac)}
            </M>
          </span>
        )}
      </>
    );
  } else {
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>f(x) = e^(−x²), g(x) = 1/(1 + x²), 0 ≤ x ≤ 2</M>
        </span>
        <span class="q" data-readout="g-int">
          <M>
            <Int lo="0" hi="2" /> g dx = arctan 2 ≈ <b>{fmt(CMP.gInt)}</b>
          </M>
        </span>
        <span class="q" data-readout="f-int">
          <M>
            <Int lo="0" hi="2" /> f dx ≈ <b>{fmt(CMP.fInt)}</b>
          </M>{' '}
          (חישוב נומרי: ל-<M>f</M> אין פונקציה קדומה בטבלה)
        </span>
        <span class="q" data-readout="compare">
          <b>
            <M>f ≤ g</M> ולכן <M>∫f ≤ ∫g</M>
          </b>{' '}
          (<M>f ≤ g</M> בכל הקטע, כי <M>e^(x²) ≥ 1 + x²</M>)
        </span>
      </>
    );
  }

  const presetIds: readonly string[] = setup.mode === 'sum' ? RS_IDS : setup.mode === 'motion' ? MO_IDS : PR_IDS;
  const presetText = (id: string) =>
    isRsId(id)
      ? `${RS[id].text},  ${RS[id].aText} ≤ x ≤ ${RS[id].bText}`
      : isMoId(id)
        ? `v(t) = ${MO[id].text},  0 ≤ t ≤ ${MO[id].Ttext}`
        : isPrId(id)
          ? (id === 'add' ? ADD : CMP).text
          : id;
  const chosen = setup.mode === 'sum' ? setup.pS : setup.mode === 'motion' ? setup.pM : setup.pP;

  return (
    <SimShell
      fig={props.id}
      label={label}
      canvasRef={canvasRef}
      aspect={aspect}
      live={live}
      tasks={tasks}
      cursor={draggable(setup) ? 'ew-resize' : 'default'}
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
          <label class="rl-select" data-control="preset">
            <span class="rl-lab">הפונקציה</span>
            <select
              dir="ltr"
              value={chosen}
              onChange={(e) => {
                const v = (e.target as HTMLSelectElement).value;
                const c = cur.current;
                if (c.mode === 'sum' && isRsId(v)) apply({ pS: v });
                else if (c.mode === 'motion' && isMoId(v)) apply({ pM: v, t: MO[v].t0 });
                else if (c.mode === 'props' && isPrId(v)) apply({ pP: v });
                setLive(describe(cur.current));
              }}
            >
              {presetIds.map((id) => (
                <option key={id} value={id}>
                  {presetText(id)}
                </option>
              ))}
            </select>
          </label>
          {setup.mode === 'sum' && (
            <>
              <div class="group" role="group" aria-label="נקודת הדגימה">
                {(['left', 'right', 'mid'] as const).map((r) => (
                  <Toggle
                    key={r}
                    label={RULE_BUTTON[r]}
                    on={setup.rule === r}
                    onChange={() => {
                      if (cur.current.rule !== r) apply({ rule: r });
                      setLive(describe(cur.current));
                    }}
                  />
                ))}
                <Toggle label="האינטגרל המדויק" on={setup.exact} swatch="var(--limit)" onChange={(on) => apply({ exact: on })} />
              </div>
              <div class="rl-ctl" data-control="n">
                <Slider label="מספר הקטעים n" value={setup.n} min={1} max={N_MAX} step={1} format={(v) => String(v)} onChange={setN} />
              </div>
            </>
          )}
          {setup.mode === 'motion' && (
            <>
              <div class="group" role="group" aria-label="שכבות">
                <Toggle label="הדרך שעבר הגוף" on={setup.abs} swatch="var(--limit)" onChange={(on) => apply({ abs: on })} />
              </div>
              <div class="rl-ctl" data-control="t">
                <Slider label="הזמן t" value={setup.t} min={0} max={spM.T} step={0.01} format={(v) => fmt(v, 3)} onChange={setT} />
              </div>
            </>
          )}
          {setup.mode === 'props' && setup.pP === 'add' && (
            <div class="rl-ctl" data-control="c">
              <Slider label="הנקודה c" value={setup.c} min={ADD.c[0]} max={ADD.c[1]} step={0.01} format={(v) => fmt(v, 3)} onChange={setC} />
            </div>
          )}
        </>
      }
    />
  );
}
