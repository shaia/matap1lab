/**
 * TrigSubLab (chapter 7.5, trigonometric integrals): three modes. Maths: src/math/trigint.ts, closed forms checked by
 * tests/math/trigint.test.ts; nothing is inferred from sampling. Canvases are math space and stay LTR (x to the right,
 * y up); sliders for math quantities are `dir="ltr"`. The triangle and the circles keep their true aspect ratio (one
 * scale on both axes). Nothing moves by itself (no animation), so there is no motion for motionAllowed() to gate. On a
 * phone (canvas narrower than 520 px) the two panels of a mode stack instead of sitting side by side.
 *
 * mode 'power':     f = sin²x, cos²x, sin x cos x or sin³x on [0, 2π] (`--curve`), with the signed area from 0 to x
 *                   shaded: above the axis solid `--pos`, below the axis hatched `--neg` (pattern, not colour only). `split`
 *                   draws the identity's parts dashed: the constant 1/2 as a horizontal line (`--limit`), an oscillating
 *                   part in the accent colour (a second oscillating part, sin³x, with another dash pattern). The legend
 *                   above the plot names f and, with `split`, each part. x is dragged on the canvas, moved with ←/→ or
 *                   set by the slider; it snaps to a multiple of π within 0.02. Readout: the identity, x, the area, and
 *                   for sin², cos² "the constant part gives x/2, the oscillating part only wiggles" with the two values.
 * mode 'triangle':  a right triangle for the kind (`sin`: x = a sin θ and the root √(a² − x²) is the adjacent side;
 *                   `tan`: x = a tan θ, the root √(a² + x²) is the hypotenuse; `sec`: x = a/cos θ, the root √(x² − a²)
 *                   is the opposite side), each side labelled with its length expression (the hypotenuse in `--curve`,
 *                   the side opposite θ in the accent colour, the adjacent side in `--limit`), the right angle and θ
 *                   marked. Beside it (below it on a phone) the graph of the root against x with the point
 *                   (x, root): for `sin` the semicircle with the radius a and the angle θ from the y-axis. x by slider,
 *                   by dragging either panel (left: the height of the triangle's corner, for `sec` its distance from
 *                   the vertex; right: x) or ←/→. Range of x: sin |x| ≤ a, tan |x| ≤ 2a, sec a ≤ x ≤ 3a; a from 1 to 3.
 *                   A new kind puts x at that kind's starting value (sin 0.6a, tan a, sec 2a); a changes keep x, clamped.
 * mode 'halfangle': left, the unit circle with the point P = (cos x, sin x) (a handle), the point S = (−1, 0), the line
 *                   SP and its intersection T = (0, t) with the y-axis (t = tan(x/2): the inscribed angle at S is x/2,
 *                   the central angle at O is x); right, the graph of t = tan(x/2) on (−π, π) with the point (x, t).
 *                   x by slider or dragging either panel (±3.13 at most) or ←/→; a T beyond the plot sits on its edge.
 *                   Readout: x, t, cos x with (1 − t²)/(1 + t²), sin x with 2t/(1 + t²) (equal), dx/dt = 2/(1 + t²); for
 *                   |x| ≥ 3.0 a note that t grows without bound and the substitution covers only −π < x < π.
 *
 * Props (defaults): id (required); mode ('power'); modes (the mode buttons shown; default the starting mode only);
 * tasks ([]). f ('sin2'; one of sin2, cos2, sincos, sin3), split (false), kind ('sin'; sin, tan, sec), a (2; 1…3).
 * x (the starting x of the START mode: power 1, triangle the kind's starting value, halfangle 1); the other modes keep
 * their own x, which a step reaches with `mode` and `x` together.
 * Every prop is also a step key (`<Step fig=… set={{…}}>`); a key left out keeps its value; `x` goes to the mode the step
 * leaves current; a new `kind` without `x` puts x at that kind's starting value. A state set by a step never ticks a
 * task, and a state that already had a task's property when a step or reset made it must be left and found again.
 * The learner can also pick the function from a list (select "הפונקציה", power mode only).
 *
 * Tasks (ticked only inside the learner's own drag, key, slider, button or select; never by a step or reset):
 *   power:     power-period (preset sin2 or cos2, x dragged to within 0.03 of π or 2π: the area is exactly x/2),
 *              power-split (the learner turns split on)
 *   triangle:  tri-drag (x moved by ≥ 0.3 from where a step, reset or kind change put it), tri-edge (kind sin, x dragged to
 *              within 0.02 of ±a: θ = ±π/2 and the root 0), tri-kind (the learner switches the kind)
 *   halfangle: half-drag (x moved by ≥ 0.3 rad from where a step or reset put it), half-pi (|x| ≥ 3.0 by the learner: t > 7)
 *
 * Hooks for e2e specs (inside `#<id>`; numbers use U+2212 for minus):
 *   buttons by role and name: the mode buttons "הורדת חזקה", "הצבה טריגונומטרית", "טנגנס חצי הזווית"; the toggle
 *     "פירוק לחלקים" (power); the kind buttons "x = a sin θ", "x = a tan θ", "x = a/cos θ" (triangle); "איפוס" (reset).
 *   [data-control="preset"] select   the function (power; option values sin2, cos2, sincos, sin3)
 *   [data-control="x"] input         the slider of x (value = x, step 0.01; power 0…2π, triangle the kind's range,
 *                                    halfangle −3.13…3.13)
 *   [data-control="a"] input         the slider of a (triangle; 1…3, step 0.1)
 *   canvas                           drag moves x; ←/→ move it by 0.01 of the range
 *   [data-readout=…]                 power: fn, x, area, half (the constant part and the wiggle; sin², cos² only say
 *                                    "no constant part" for the others)
 *                                    triangle: fn (the substitution), theta, trig (sin θ = x/a, tan θ = x/a or cos θ = a/x),
 *                                    sides, root, dx; at the edge of `sin` also edge
 *                                    halfangle: x, t, cos, sin, dxdt; for |x| ≥ 3.0 also note
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import {
  POW,
  POW_IDS,
  TRI_KINDS,
  clampTri,
  halfAngle,
  isPowId,
  isTriKind,
  triSub,
  xDefault,
  xRange,
  type PowId,
  type TriKind,
} from '~/math/trigint';
import { markTask } from '~/progress/store';
import { subscribeSteps, type StepState } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { sci } from './core/format';
import { withAlpha } from './core/ink';
import { drawAxes, insetBox, makePlot, type Box, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import './TrigSubLab.css';

export type TrigMode = 'power' | 'triangle' | 'halfangle';

export interface TrigSubLabProps {
  id: string;
  mode?: TrigMode;
  /** the mode buttons shown (default: the starting mode only) */
  modes?: TrigMode[];
  f?: PowId;
  split?: boolean;
  kind?: TriKind;
  a?: number;
  x?: number;
  tasks?: string[];
}

interface Setup {
  mode: TrigMode;
  f: PowId;
  split: boolean;
  kind: TriKind;
  a: number;
  /** x of each mode */
  px: number;
  tx: number;
  hx: number;
}

interface Env {
  /** the change is the learner dragging, sliding or pressing a key on x */
  drag: boolean;
  /** x of the triangle / half-angle modes where a step, reset or kind change last put it */
  anchor: { tri: number; half: number };
}

const ltr = (s: string) => String.fromCharCode(0x2066) + s.replace(/ /g, String.fromCharCode(0xa0)) + String.fromCharCode(0x2069);

const TASK_LABEL: Record<string, string> = {
  'power-period': `בפונקציה ${ltr('sin²x')} (או ${ltr('cos²x')}) גררו את x אל ${ltr('π')} או ${ltr('2π')}. מה השטח שם, ומה הקשר שלו אל ${ltr('x/2')}?`,
  'power-split': 'הדליקו "פירוק לחלקים". איזה חלק גדל עם x, ואיזה רק מתנדנד?',
  'tri-drag': 'גררו את x והסתכלו איך המשולש משתנה. איזו צלע לא משתנה כש-x זז?',
  'tri-edge': `בהצבה ${ltr('x = a sin θ')} גררו את x עד הקצה ${ltr('x = ±a')}. מה קורה לשורש, ומה הזווית θ?`,
  'tri-kind': 'עברו להצבה אחרת. איזו צלע של המשולש היא השורש בכל אחת מהשלוש?',
  'half-drag': 'גררו את הנקודה P על המעגל והסתכלו על t. מה הזווית שבין הישר SP לציר x?',
  'half-pi': `גררו את P קרוב ל-${ltr('x = π')} (או ${ltr('x = −π')}) עד ש-${ltr('|x| ≥ 3.0')}. מה קורה ל-t?`,
};

const MODE_LABEL: Record<TrigMode, string> = { power: 'הורדת חזקה', triangle: 'הצבה טריגונומטרית', halfangle: 'טנגנס חצי הזווית' };
const KIND_LABEL: Record<TriKind, string> = { sin: 'x = a sin θ', tan: 'x = a tan θ', sec: 'x = a/cos θ' };

const PI = Math.PI;
const TAU = 2 * Math.PI;
/** half-angle x stays this far from ±π (t is finite there) */
const HX_MAX = 3.13;
const POW_SNAP = 0.02;
const EDGE_SNAP = 0.015;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const bool = (x: unknown): boolean | null => (typeof x === 'boolean' ? x : null);
const roundTo = (x: number, step: number) => Number((Math.round(x / step) * step).toPrecision(10));
const minus = (s: string) => s.replace(/-/g, '−');
const fmt = (x: number, sig = 4) => (Number.isNaN(x) ? '—' : Math.abs(x) < 1e-9 ? '0' : minus(sci(x, sig)));

const clampA = (a: number) => clamp(roundTo(a, 0.1), 1, 3);
const clampPx = (x: number) => clamp(x, 0, TAU);
const clampHx = (x: number) => clamp(x, -HX_MAX, HX_MAX);

/** x in power mode snaps to a multiple of π (0, π, 2π) within POW_SNAP */
const snapPow = (x: number) => {
  const k = Math.round(x / PI);
  return Math.abs(x - k * PI) <= POW_SNAP ? k * PI : x;
};
/** x in the sin kind snaps to ±a within EDGE_SNAP */
const snapTri = (kind: TriKind, a: number, x: number) => (kind === 'sin' && Math.abs(Math.abs(x) - a) <= EDGE_SNAP ? Math.sign(x) * a : x);

/* ---- tasks: `needs` = the learner's change must touch one of these keys; `event` tasks tick on the learner's act, the
 * others must be left and found again after a step or reset made the state */
interface Rule {
  needs: (keyof Setup)[];
  event?: boolean;
  state: (s: Setup, patch: Partial<Setup>, env: Env) => boolean;
}
const RULES: Record<string, Rule> = {
  'power-period': {
    needs: ['px'],
    state: (s, _p, e) => {
      const k = Math.round(s.px / PI);
      return e.drag && s.mode === 'power' && (s.f === 'sin2' || s.f === 'cos2') && k >= 1 && Math.abs(s.px - k * PI) <= 0.03 + 1e-9;
    },
  },
  'power-split': { needs: ['split'], event: true, state: (s, p) => s.mode === 'power' && s.split && p.split === true },
  'tri-drag': { needs: ['tx'], event: true, state: (s, _p, e) => s.mode === 'triangle' && e.drag && Math.abs(s.tx - e.anchor.tri) >= 0.3 - 1e-9 },
  'tri-edge': { needs: ['tx'], state: (s, _p, e) => s.mode === 'triangle' && s.kind === 'sin' && e.drag && Math.abs(Math.abs(s.tx) - s.a) <= 0.02 + 1e-9 },
  'tri-kind': { needs: ['kind'], event: true, state: (s, p) => s.mode === 'triangle' && p.kind !== undefined },
  'half-drag': { needs: ['hx'], event: true, state: (s, _p, e) => s.mode === 'halfangle' && e.drag && Math.abs(s.hx - e.anchor.half) >= 0.3 - 1e-9 },
  'half-pi': { needs: ['hx'], state: (s, _p, e) => s.mode === 'halfangle' && e.drag && Math.abs(s.hx) >= 3.0 - 1e-9 },
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
/** a filled square mark (the point T on the y-axis) */
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
/** an arc of angle `from` to `to` (screen angles, radians, y down) about (cx, cy); the shorter way round */
function arcBetween(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, from: number, to: number, color: string, width = 1.6) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(cx, cy, r, from, to, to < from);
  ctx.stroke();
  ctx.restore();
}

/** the plot of a world window drawn with ONE scale on both axes, centred in the panel's inner box */
function fitPlot(panel: Box, m: { l: number; r: number; t: number; b: number }, xw: [number, number], yw: [number, number], xl?: string, yl?: string): Plot {
  const inner = insetBox(panel, m);
  const s = Math.min(inner.w / (xw[1] - xw[0]), inner.h / (yw[1] - yw[0]));
  const w = (xw[1] - xw[0]) * s;
  const h = (yw[1] - yw[0]) * s;
  const box = { x: inner.x + (inner.w - w) / 2, y: inner.y + (inner.h - h) / 2, w, h };
  return makePlot(box, { min: xw[0], max: xw[1], label: xl }, { min: yw[0], max: yw[1], label: yl });
}

/** y = f(x) on [lo, hi] clipped to the plot box; far values are clamped, so a pole is a steep stroke off the box */
function strokeFn(ctx: CanvasRenderingContext2D, plot: Plot, f: (x: number) => number, lo: number, hi: number, color: string, width: number, dash: number[] = [], n = 480) {
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

/** x ticks of the power mode */
const PI_TICKS = [0, PI / 2, PI, (3 * PI) / 2, TAU];
const PI_LABEL = (v: number) => (Math.abs(v) < 1e-9 ? '0' : minus(`${Math.abs(v - PI / 2) < 1e-9 ? 'π/2' : Math.abs(v - PI) < 1e-9 ? 'π' : Math.abs(v - 1.5 * PI) < 1e-9 ? '3π/2' : Math.abs(v - TAU) < 1e-9 ? '2π' : Math.abs(v + PI) < 1e-9 ? '−π' : Math.abs(v + PI / 2) < 1e-9 ? '−π/2' : sci(v, 2)}`));

/** world window of the triangle (left panel) and of the root graph (right panel) per kind */
function triWindow(kind: TriKind, a: number): { tri: { x: [number, number]; y: [number, number] }; root: { x: [number, number]; y: [number, number] } } {
  if (kind === 'sin') return { tri: { x: [-0.3 * a, 1.2 * a], y: [-1.2 * a, 1.2 * a] }, root: { x: [-1.25 * a, 1.25 * a], y: [-0.25 * a, 1.2 * a] } };
  if (kind === 'tan') return { tri: { x: [-0.3 * a, 1.35 * a], y: [-2.3 * a, 2.3 * a] }, root: { x: [-2.2 * a, 2.2 * a], y: [-0.25 * a, 2.5 * a] } };
  return { tri: { x: [-0.3 * a, 1.35 * a], y: [-0.3 * a, 3 * a] }, root: { x: [-0.3 * a, 3.3 * a], y: [-0.25 * a, 3 * a] } };
}
const rootLabel = (k: TriKind) => (k === 'sin' ? '√(a²−x²)' : k === 'tan' ? '√(a²+x²)' : '√(x²−a²)');
const sideLabels = (k: TriKind) => (k === 'sin' ? { hyp: 'a', opp: 'x', adj: rootLabel(k) } : k === 'tan' ? { hyp: rootLabel(k), opp: 'x', adj: 'a' } : { hyp: 'x', opp: rootLabel(k), adj: 'a' });
const rootFn = (k: TriKind, a: number) => (x: number) => (k === 'sin' ? Math.sqrt(a * a - x * x) : k === 'tan' ? Math.sqrt(a * a + x * x) : Math.sqrt(x * x - a * a));

type Region = { id: 'main' | 'L' | 'R'; plot: Plot; rect: Box };

export default function TrigSubLab(props: TrigSubLabProps) {
  const startMode: TrigMode = props.mode ?? 'power';
  const modes: TrigMode[] = props.modes ?? [startMode];
  const initial = (): Setup => {
    const kind: TriKind = isTriKind(props.kind) ? props.kind : 'sin';
    const a = clampA(props.a ?? 2);
    const x0 = num(props.x);
    return {
      mode: startMode,
      f: isPowId(props.f) ? props.f : 'sin2',
      split: props.split ?? false,
      kind,
      a,
      px: clampPx(startMode === 'power' && x0 !== null ? x0 : 1),
      tx: clampTri(kind, a, startMode === 'triangle' && x0 !== null ? x0 : xDefault(kind, a)),
      hx: clampHx(startMode === 'halfangle' && x0 !== null ? x0 : 1),
    };
  };
  const [setup, setSetup] = useState<Setup>(initial);
  const cur = useRef(setup);
  const [live, setLive] = useState('');
  const [narrow, setNarrow] = useState(false);
  const regions = useRef<Region[]>([]);
  const dragRegion = useRef<Region | null>(null);
  const dragging = useRef(false);
  /** tasks whose state held when the last step or reset made it: they must be left and found again */
  const held = useRef<Set<string>>(new Set());
  const anchor = useRef({ tri: setup.tx, half: setup.hx });

  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const done = (t: string) => {
    if (props.tasks?.includes(t)) markTask(`${props.id}:${t}`);
  };
  const rebase = (s: Setup) => {
    anchor.current = { tri: s.tx, half: s.hx };
    const env: Env = { drag: true, anchor: anchor.current };
    // a state-type task that holds now (with the learner "dragging" assumed) must be left and found again
    held.current = new Set((props.tasks ?? []).filter((id) => RULES[id] && !RULES[id].event && RULES[id].state(s, {}, env)));
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
        const mode = typeof st.mode === 'string' && modes.includes(st.mode as TrigMode) ? (st.mode as TrigMode) : prev.mode;
        const next: Setup = { ...prev, mode };
        if (isPowId(st.f)) next.f = st.f;
        next.split = bool(st.split) ?? prev.split;
        const newKind = isTriKind(st.kind) && st.kind !== prev.kind;
        if (isTriKind(st.kind)) next.kind = st.kind;
        next.a = clampA(num(st.a) ?? prev.a);
        const x = num(st.x);
        next.px = clampPx(mode === 'power' && x !== null ? x : prev.px);
        next.hx = clampHx(mode === 'halfangle' && x !== null ? x : prev.hx);
        next.tx = clampTri(next.kind, next.a, mode === 'triangle' && x !== null ? x : newKind ? xDefault(next.kind, next.a) : prev.tx);
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
    regions.current = [];
    const full: Box = { x: 0, y: 0, w: view.w, h: view.h };
    const half = (i: 0 | 1): Box => (nar ? { x: 0, y: (view.h / 2) * i, w: view.w, h: view.h / 2 } : { x: (view.w / 2) * i, y: 0, w: view.w / 2, h: view.h });
    const M = { l: 44, r: 14, t: nar ? 14 : 22, b: 40 };

    if (s0.mode === 'power') {
      const sp = POW[s0.f];
      const win = sp.window;
      const box = insetBox(full, { l: 46, r: 14, t: 34, b: 42 });
      const plot = makePlot(box, { min: win.x[0], max: win.x[1], ticks: PI_TICKS, format: PI_LABEL, label: 'x' }, { min: win.y[0], max: win.y[1], label: 'y' });
      regions.current = [{ id: 'main', plot, rect: full }];
      drawAxes(ctx, plot, p);
      const PX = plot.px;
      const PY = plot.py;
      line(ctx, box.x, PY(0), box.x + box.w, PY(0), withAlpha(p.ink2, 0.7), 1.2);
      // the signed area from 0 to x: above the axis solid, below the axis hatched
      const x = s0.px;
      if (x > 1e-9) {
        const region = new Path2D();
        region.moveTo(PX(0), PY(0));
        const N = 260;
        for (let i = 0; i <= N; i++) {
          const xi = (x * i) / N;
          region.lineTo(PX(xi), PY(sp.f(xi)));
        }
        region.lineTo(PX(x), PY(0));
        region.closePath();
        ctx.save();
        ctx.clip(region);
        ctx.save();
        ctx.beginPath();
        ctx.rect(box.x, box.y, box.w, PY(0) - box.y);
        ctx.clip();
        ctx.fillStyle = withAlpha(p.pos, 0.4);
        ctx.fillRect(box.x, box.y, box.w, box.h);
        ctx.restore();
        ctx.save();
        ctx.beginPath();
        ctx.rect(box.x, PY(0), box.w, box.y + box.h - PY(0));
        ctx.clip();
        ctx.fillStyle = withAlpha(p.neg, 0.14);
        ctx.fillRect(box.x, box.y, box.w, box.h);
        ctx.strokeStyle = withAlpha(p.neg, 0.85);
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        for (let d = -box.h; d < box.w + box.h; d += 6) {
          ctx.moveTo(box.x + d, box.y + box.h);
          ctx.lineTo(box.x + d + box.h, box.y);
        }
        ctx.stroke();
        ctx.restore();
        ctx.restore();
      }
      // the identity's parts, dashed
      const legend: [string, string][] = [[`f = ${sp.text}`, p.curve]];
      if (s0.split) {
        let oscIx = 0;
        for (const part of sp.parts) {
          if (part.kind === 'const') {
            strokeFn(ctx, plot, part.f, win.x[0], win.x[1], p.limit, 2, [6, 5]);
            legend.push([part.text, p.limit]);
          } else {
            strokeFn(ctx, plot, part.f, win.x[0], win.x[1], oscIx === 0 ? p.accent : p.ink2, 2, oscIx === 0 ? [3, 4] : [8, 3, 2, 3]);
            legend.push([part.text, oscIx === 0 ? p.accent : p.ink2]);
            oscIx++;
          }
        }
      }
      strokeFn(ctx, plot, sp.f, win.x[0], win.x[1], p.curve, 2.6);
      // legend above the plot
      ctx.save();
      ctx.font = font(700);
      let lx = box.x;
      const widths = legend.map(([t]) => ctx.measureText(t).width);
      ctx.restore();
      legend.forEach(([t, c], i) => {
        haloText(ctx, p, t, lx, box.y - 14, { font: font(700), color: c, align: 'left' });
        lx += widths[i] + 16;
      });
      // the x handle
      line(ctx, PX(x), box.y, PX(x), box.y + box.h, withAlpha(p.accent, 0.7), 1.3, [3, 4]);
      ctx.save();
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(PX(x), box.y + box.h - 13);
      ctx.lineTo(PX(x), box.y + box.h - 2);
      ctx.stroke();
      ctx.restore();
      dot(ctx, PX(x), PY(sp.f(x)), 5, p.accent, p.paper);
      return;
    }

    if (s0.mode === 'triangle') {
      const { kind, a } = s0;
      const t = triSub(kind, a, s0.tx);
      const win = triWindow(kind, a);
      const pl = fitPlot(half(0), M, win.tri.x, win.tri.y);
      const pr = fitPlot(half(1), M, win.root.x, win.root.y, 'x', 'השורש');
      regions.current = [
        { id: 'L', plot: pl, rect: half(0) },
        { id: 'R', plot: pr, rect: half(1) },
      ];
      // ---- the triangle
      {
        const PX = pl.px;
        const PY = pl.py;
        const O: [number, number] = [PX(0), PY(0)];
        const A: [number, number] = [PX(t.adj), PY(0)];
        const B: [number, number] = [PX(t.adj), PY(t.opp)];
        const sgn = t.opp >= 0 ? 1 : -1;
        // a faint frame of the window so the triangle's range is visible
        ctx.save();
        ctx.strokeStyle = withAlpha(p.rule, 0.8);
        ctx.lineWidth = 1;
        ctx.strokeRect(pl.box.x, pl.box.y, pl.box.w, pl.box.h);
        ctx.restore();
        line(ctx, pl.box.x, PY(0), pl.box.x + pl.box.w, PY(0), withAlpha(p.ink2, 0.45), 1, [2, 4]);
        ctx.save();
        ctx.fillStyle = withAlpha(p.accent, 0.08);
        ctx.beginPath();
        ctx.moveTo(...O);
        ctx.lineTo(...A);
        ctx.lineTo(...B);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        line(ctx, O[0], O[1], A[0], A[1], p.limit, 3);
        line(ctx, A[0], A[1], B[0], B[1], p.accent, 3);
        line(ctx, O[0], O[1], B[0], B[1], p.curve, 3);
        // the right angle at A
        if (Math.abs(t.opp) > 1e-6 && t.adj > 1e-6) {
          const q = 9;
          ctx.save();
          ctx.strokeStyle = p.ink2;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(A[0] - q, A[1]);
          ctx.lineTo(A[0] - q, A[1] - sgn * q);
          ctx.lineTo(A[0], A[1] - sgn * q);
          ctx.stroke();
          ctx.restore();
        }
        // θ at O
        const ang = -Math.atan2(t.opp, t.adj);
        if (Math.abs(ang) > 1e-4) arcBetween(ctx, O[0], O[1], 30, 0, ang, p.ink, 1.8);
        haloText(ctx, p, 'θ', O[0] + 46 * Math.cos(ang / 2), O[1] + 46 * Math.sin(ang / 2), { font: font(700, fs + 2), color: p.ink });
        dot(ctx, O[0], O[1], 4, p.ink, p.paper);
        // side labels
        const L = sideLabels(kind);
        const mid = (u: [number, number], v: [number, number]): [number, number] => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2];
        const mAdj = mid(O, A);
        const mOpp = mid(A, B);
        const mHyp = mid(O, B);
        haloText(ctx, p, L.adj, mAdj[0], mAdj[1] + sgn * 14 + (sgn > 0 ? 0 : 0), { font: font(700), color: p.limit });
        haloText(ctx, p, L.opp, mOpp[0] + 8, mOpp[1], { font: font(700), color: p.accent, align: 'left' });
        haloText(ctx, p, L.hyp, mHyp[0] - 8, mHyp[1] - sgn * 12, { font: font(700), color: p.curve, align: 'right' });
      }
      // ---- the root against x
      {
        const PX = pr.px;
        const PY = pr.py;
        drawAxes(ctx, pr, p);
        line(ctx, pr.box.x, PY(0), pr.box.x + pr.box.w, PY(0), withAlpha(p.ink2, 0.6), 1.2);
        line(ctx, PX(0), pr.box.y, PX(0), pr.box.y + pr.box.h, withAlpha(p.ink2, 0.6), 1.2);
        const [lo, hi] = kind === 'sec' ? [a, win.root.x[1]] : [win.root.x[0], win.root.x[1]];
        const lim = kind === 'sin' ? [-a, a] : [lo, hi];
        strokeFn(ctx, pr, rootFn(kind, a), lim[0], lim[1], p.curve, 2.6);
        if (Number.isFinite(t.root)) {
          const P: [number, number] = [PX(t.x), PY(t.root)];
          line(ctx, P[0], P[1], P[0], PY(0), withAlpha(p.accent, 0.8), 1.4, [4, 4]);
          if (kind === 'sin') {
            line(ctx, PX(0), PY(0), P[0], P[1], p.limit, 1.8);
            // θ between the y-axis and the radius
            const th = t.theta;
            if (Math.abs(th) > 1e-4) arcBetween(ctx, PX(0), PY(0), 30, -PI / 2, -PI / 2 + th, p.ink, 1.8);
            haloText(ctx, p, 'θ', PX(0) + 44 * Math.sin(th / 2) * 0.9 + (th >= 0 ? 4 : -4), PY(0) - 44 * Math.cos(th / 2) * 0.95, { font: font(700, fs + 2) });
            haloText(ctx, p, 'a', (PX(0) + P[0]) / 2 + (th >= 0 ? -10 : 10), (PY(0) + P[1]) / 2 + 2, { font: font(700), color: p.limit });
          }
          dot(ctx, P[0], P[1], 5.5, p.accent, p.paper);
          dot(ctx, P[0], PY(0), 4, p.accent, p.paper);
        }
      }
      return;
    }

    // ---- halfangle: the unit circle and the graph of t = tan(x/2)
    const x = s0.hx;
    const h = halfAngle(x);
    {
      const pc = fitPlot(half(0), M, [-1.45, 1.45], [-2.1, 2.1], 'x', 'y');
      regions.current.push({ id: 'L', plot: pc, rect: half(0) });
      drawAxes(ctx, pc, p, { grid: false });
      const PX = pc.px;
      const PY = pc.py;
      const O: [number, number] = [PX(0), PY(0)];
      const R = PX(1) - PX(0);
      line(ctx, pc.box.x, O[1], pc.box.x + pc.box.w, O[1], withAlpha(p.ink2, 0.6), 1.2);
      line(ctx, O[0], pc.box.y, O[0], pc.box.y + pc.box.h, withAlpha(p.ink2, 0.6), 1.2);
      ctx.save();
      ctx.strokeStyle = p.curve;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(O[0], O[1], R, 0, TAU);
      ctx.stroke();
      ctx.restore();
      const P: [number, number] = [PX(h.cos), PY(h.sin)];
      const S: [number, number] = [PX(-1), PY(0)];
      // the line S → T, T on the y-axis (clamped to the box edge when t is beyond it)
      const tIn = Math.abs(h.t) <= pc.y.max * 0.98;
      const tShown = clamp(h.t, pc.y.min * 0.98, pc.y.max * 0.98);
      const T: [number, number] = [PX(0), PY(tShown)];
      line(ctx, S[0], S[1], T[0], T[1], p.accent, 2, [7, 4]);
      line(ctx, O[0], O[1], P[0], P[1], withAlpha(p.ink2, 0.8), 1.3);
      // the central angle x at O and the inscribed angle x/2 at S
      if (Math.abs(x) > 1e-4) arcBetween(ctx, O[0], O[1], 0.3 * R, 0, -x, p.curve, 1.8);
      if (Math.abs(x) > 1e-4) arcBetween(ctx, S[0], S[1], 0.4 * R, 0, -x / 2, p.accent, 1.8);
      haloText(ctx, p, 'x', O[0] + 0.5 * R * Math.cos(-x / 2) * 0.82, O[1] + 0.5 * R * Math.sin(-x / 2) * 0.82, { font: font(700), color: p.curve });
      haloText(ctx, p, 'x/2', S[0] + 0.62 * R * Math.cos(-x / 4), S[1] + 0.62 * R * Math.sin(-x / 4) + (x >= 0 ? -4 : 6), { font: font(700), color: p.accent });
      ring(ctx, S[0], S[1], 5, p.ink, p.paper);
      haloText(ctx, p, 'S', S[0] - 9, S[1] + 14, { font: font(700) });
      square(ctx, T[0], T[1], 5, p.limit, p.paper);
      haloText(ctx, p, tIn ? `t = ${fmt(h.t, 3)}` : `t = ${fmt(h.t, 3)} ${h.t > 0 ? '↑' : '↓'}`, T[0] + 10, T[1] + (h.t > 0 && !tIn ? 12 : 0), { font: font(700), color: p.limit, align: 'left' });
      dot(ctx, P[0], P[1], 7, p.accent, p.paper);
      haloText(ctx, p, 'P', P[0] + (h.cos >= 0 ? 12 : -12), P[1] + (h.sin >= 0 ? -10 : 10), { font: font(700), align: h.cos >= 0 ? 'left' : 'right' });
    }
    {
      const W = [-PI, PI] as [number, number];
      const pg = makePlot(insetBox(half(1), M), { min: W[0], max: W[1], ticks: [-PI, -PI / 2, 0, PI / 2, PI], format: PI_LABEL, label: 'x' }, { min: -8, max: 8, ticks: [-6, -3, 0, 3, 6], label: 't' });
      regions.current.push({ id: 'R', plot: pg, rect: half(1) });
      drawAxes(ctx, pg, p);
      const PX = pg.px;
      const PY = pg.py;
      line(ctx, pg.box.x, PY(0), pg.box.x + pg.box.w, PY(0), withAlpha(p.ink2, 0.6), 1.2);
      line(ctx, PX(0), pg.box.y, PX(0), pg.box.y + pg.box.h, withAlpha(p.ink2, 0.6), 1.2);
      for (const e of [-PI, PI]) line(ctx, PX(e), pg.box.y, PX(e), pg.box.y + pg.box.h, p.limit, 1.6, [6, 5]);
      haloText(ctx, p, 'x = π', PX(PI) - 4, pg.box.y + pg.box.h - 12, { font: font(700), color: p.limit, align: 'right' });
      haloText(ctx, p, 'x = −π', PX(-PI) + 4, pg.box.y + pg.box.h - 12, { font: font(700), color: p.limit, align: 'left' });
      strokeFn(ctx, pg, (u) => Math.tan(u / 2), -PI + 1e-3, PI - 1e-3, p.curve, 2.6, [], 600);
      const ty = clamp(h.t, -7.9, 7.9);
      line(ctx, PX(x), PY(0), PX(x), PY(ty), withAlpha(p.accent, 0.8), 1.4, [4, 4]);
      dot(ctx, PX(x), PY(ty), 6, p.accent, p.paper);
      dot(ctx, PX(x), PY(0), 4, p.accent, p.paper);
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
  const aspect = setup.mode === 'power' ? (narrow ? 1.0 : 1.9) : setup.mode === 'triangle' ? (narrow ? 0.62 : 1.6) : narrow ? 0.62 : 1.6;

  /* ---------------------------------------------------------------- learner changes */
  /** The learner changed the figure: apply, then tick whatever the new state completes. */
  const apply = (patch: Partial<Setup>, drag = false) => {
    const prev = cur.current;
    const next: Setup = { ...prev, ...patch };
    commit(next);
    // a change of x that is not the learner's drag (kind change, a clamping x) is a new starting point
    if (!drag && 'tx' in patch) anchor.current.tri = next.tx;
    if (!drag && 'hx' in patch) anchor.current.half = next.hx;
    const env: Env = { drag, anchor: anchor.current };
    for (const id of props.tasks ?? []) {
      const rule = RULES[id];
      if (!rule) continue;
      if (!rule.state(next, patch, env)) {
        held.current.delete(id);
        continue;
      }
      if (!rule.needs.some((key) => key in patch)) continue;
      if (!rule.event && held.current.has(id)) continue;
      done(id);
    }
  };

  const setPx = (x: number) => {
    const nx = snapPow(clampPx(roundTo(x, 0.01)));
    if (nx !== cur.current.px) apply({ px: nx }, true);
  };
  const setTx = (x: number) => {
    const c = cur.current;
    const nx = snapTri(c.kind, c.a, clampTri(c.kind, c.a, roundTo(x, 0.01)));
    if (nx !== c.tx) apply({ tx: nx }, true);
  };
  const setHx = (x: number) => {
    const nx = clampHx(roundTo(x, 0.01));
    if (nx !== cur.current.hx) apply({ hx: nx }, true);
  };
  const setXOfMode = (x: number) => {
    const m = cur.current.mode;
    if (m === 'power') setPx(x);
    else if (m === 'triangle') setTx(x);
    else setHx(x);
  };

  const world = (r: Region, e: PointerEvent): [number, number] => {
    const { plot } = r;
    return [
      plot.x.min + ((e.offsetX - plot.box.x) / plot.box.w) * (plot.x.max - plot.x.min),
      plot.y.min + ((plot.box.y + plot.box.h - e.offsetY) / plot.box.h) * (plot.y.max - plot.y.min),
    ];
  };
  const regionAt = (e: PointerEvent): Region | null => {
    const rs = regions.current;
    return rs.find((r) => e.offsetX >= r.rect.x && e.offsetX <= r.rect.x + r.rect.w && e.offsetY >= r.rect.y && e.offsetY <= r.rect.y + r.rect.h) ?? rs[0] ?? null;
  };
  const fromPointer = (e: PointerEvent, r: Region) => {
    const c = cur.current;
    const [wx, wy] = world(r, e);
    if (c.mode === 'power') setPx(wx);
    else if (c.mode === 'triangle') {
      if (r.id === 'R') setTx(wx);
      else setTx(c.kind === 'sec' ? Math.hypot(wx, wy) : wy);
    } else if (r.id === 'R') setHx(wx);
    else setHx(Math.atan2(wy, wx));
  };
  const onPointerDown = (e: PointerEvent) => {
    const r = regionAt(e);
    if (!r) return;
    dragRegion.current = r;
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    fromPointer(e, r);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (dragging.current && dragRegion.current) fromPointer(e, dragRegion.current);
  };
  const onPointerUp = () => {
    if (dragging.current) setLive(describe(cur.current));
    dragging.current = false;
    dragRegion.current = null;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const c = cur.current;
    const step = c.mode === 'power' ? 0.05 : c.mode === 'halfangle' ? 0.05 : Math.max(0.01, roundTo(Math.abs(xRange(c.kind, c.a)[1] - xRange(c.kind, c.a)[0]) / 100, 0.01));
    const x = c.mode === 'power' ? c.px : c.mode === 'triangle' ? c.tx : c.hx;
    setXOfMode(x + (e.key === 'ArrowLeft' ? -step : step));
    setLive(describe(cur.current));
  };

  /* ---------------------------------------------------------------- text */
  const M = (q: { children: ComponentChildren }) => <bdi dir="ltr">{q.children}</bdi>;

  function describe(s: Setup): string {
    if (s.mode === 'power') return `x = ${fmt(s.px, 3)}: השטח מ-0 עד x הוא ${fmt(POW[s.f].area(s.px))}.`;
    if (s.mode === 'triangle') {
      const t = triSub(s.kind, s.a, s.tx);
      return `x = ${fmt(s.tx, 3)}, θ = ${fmt(t.theta, 3)}, השורש ${fmt(t.root, 3)}.`;
    }
    const h = halfAngle(s.hx);
    return `x = ${fmt(s.hx, 3)}, t = ${fmt(h.t, 3)}.`;
  }

  const sp = POW[setup.f];
  const label =
    setup.mode === 'power'
      ? `איור חי: הגרף של ${sp.text} על הקטע מ-0 עד 2π, והשטח המסומן מ-0 עד x: מעל הציר בצבע מלא, מתחתיו בקווקוו אלכסוניים. בפירוק לחלקים מופיעים חלקי הזהות ${sp.identityText} בקווים מקווקווים.`
      : setup.mode === 'triangle'
        ? `איור חי: משולש ישר זווית להצבה ${KIND_LABEL[setup.kind]} עם הצלעות והזווית θ, ולצדו הגרף של השורש כפונקציה של x עם הנקודה הנוכחית.`
        : 'איור חי: מעגל היחידה עם הנקודה P, הנקודה S = (−1, 0) והישר SP שחותך את ציר y בנקודה T = (0, t), ולצדו הגרף של t = tan(x/2) על הקטע מ-−π עד π.';

  let readout: ComponentChildren;
  if (setup.mode === 'power') {
    const x = setup.px;
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>
            {sp.text} = {sp.identityText}
          </M>
        </span>
        <span class="q" data-readout="x">
          <M>
            x = <b>{fmt(x, 4)}</b>
          </M>
        </span>
        <span class="q" data-readout="area">
          השטח מ-0 עד x:{' '}
          <M>
            ∫₀ˣ {sp.text} dx = <b>{fmt(sp.area(x))}</b>
          </M>
        </span>
        <span class="q" data-readout="half">
          {sp.constArea && sp.oscArea ? (
            <>
              החלק הקבוע נותן את <M>x/2 = {fmt(sp.constArea(x))}</M>, והחלק המתנודד רק מתנדנד: הוא נותן <M>{fmt(sp.oscArea(x))}</M>, תמיד בין <M>−1/4</M> ל-<M>1/4</M>.
            </>
          ) : (
            'אין חלק קבוע בפירוק: כל חלקי הזהות מתנדנדים, ולכן השטח לא גדל בלי הגבלה כש-x גדל.'
          )}
        </span>
      </>
    );
  } else if (setup.mode === 'triangle') {
    const t = triSub(setup.kind, setup.a, setup.tx);
    const L = sideLabels(setup.kind);
    const edge = setup.kind === 'sin' && Math.abs(Math.abs(setup.tx) - setup.a) < 1e-9;
    const trig =
      setup.kind === 'sin' ? `sin θ = x/a = ${fmt(setup.tx / setup.a)}` : setup.kind === 'tan' ? `tan θ = x/a = ${fmt(setup.tx / setup.a)}` : `cos θ = a/x = ${fmt(setup.a / setup.tx)}`;
    const rootEq = setup.kind === 'sin' ? 'a cos θ' : setup.kind === 'tan' ? 'a/cos θ' : 'a tan θ';
    const dxEq = setup.kind === 'sin' ? 'a cos θ' : setup.kind === 'tan' ? 'a/cos²θ' : 'a sin θ/cos²θ';
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>
            {KIND_LABEL[setup.kind]}, a = <b>{fmt(setup.a, 2)}</b>, x = <b>{fmt(setup.tx, 4)}</b>
          </M>
        </span>
        <span class="q" data-readout="theta">
          <M>
            θ = <b>{fmt(t.theta)}</b>
          </M>{' '}
          רדיאן
        </span>
        <span class="q" data-readout="trig">
          <M>{trig}</M>
        </span>
        <span class="q" data-readout="sides">
          היתר <M>{L.hyp} = {fmt(t.hyp)}</M>, הניצב מול θ <M>{L.opp} = {fmt(t.opp)}</M>, הניצב הסמוך <M>{L.adj} = {fmt(t.adj)}</M>.
        </span>
        <span class="q" data-readout="root">
          השורש{' '}
          <M>
            {rootLabel(setup.kind)} = {rootEq} = <b>{fmt(t.root)}</b>
          </M>
        </span>
        <span class="q" data-readout="dx">
          <M>
            dx = {dxEq} dθ = <b>{fmt(t.dxdtheta)}</b> dθ
          </M>
        </span>
        {edge && (
          <span class="q" data-readout="edge">
            בקצה <M>x = {setup.tx > 0 ? 'a' : '−a'}</M>: <M>θ = {setup.tx > 0 ? 'π/2' : '−π/2'}</M>, השורש הוא 0, וגם <M>dx/dθ = 0</M>.
          </span>
        )}
      </>
    );
  } else {
    const x = setup.hx;
    const h = halfAngle(x);
    readout = (
      <>
        <span class="q" data-readout="x">
          <M>
            x = <b>{fmt(x, 4)}</b>
          </M>
        </span>
        <span class="q" data-readout="t">
          <M>
            t = tan(x/2) = <b>{fmt(h.t)}</b>
          </M>
        </span>
        <span class="q" data-readout="cos">
          <M>
            cos x = <b>{fmt(h.cos)}</b>, (1 − t²)/(1 + t²) = <b>{fmt(h.cosFromT)}</b>
          </M>
        </span>
        <span class="q" data-readout="sin">
          <M>
            sin x = <b>{fmt(h.sin)}</b>, 2t/(1 + t²) = <b>{fmt(h.sinFromT)}</b>
          </M>
        </span>
        <span class="q" data-readout="dxdt">
          <M>
            dx/dt = 2/(1 + t²) = <b>{fmt(h.dxdt)}</b>
          </M>
        </span>
        {Math.abs(x) >= 3.0 - 1e-9 && (
          <span class="q" data-readout="note">
            <b>
              <M>t</M> גדל בלי גבול: ההצבה מכסה רק את <M>{'‎'}−π &lt; x &lt; π</M>
            </b>
          </span>
        )}
      </>
    );
  }

  const [xlo, xhi] = setup.mode === 'power' ? [0, TAU] : setup.mode === 'triangle' ? xRange(setup.kind, setup.a) : [-HX_MAX, HX_MAX];
  const xval = setup.mode === 'power' ? setup.px : setup.mode === 'triangle' ? setup.tx : setup.hx;

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
          {setup.mode === 'power' && (
            <>
              <label class="ts-select" data-control="preset">
                <span class="ts-lab">הפונקציה</span>
                <select
                  dir="ltr"
                  value={setup.f}
                  onChange={(e) => {
                    const v = (e.target as HTMLSelectElement).value;
                    if (isPowId(v)) apply({ f: v });
                  }}
                >
                  {POW_IDS.map((id) => (
                    <option key={id} value={id}>
                      {POW[id].text}
                    </option>
                  ))}
                </select>
              </label>
              <div class="group" role="group" aria-label="פירוק">
                <Toggle label="פירוק לחלקים" on={setup.split} swatch="var(--accent)" onChange={(on) => apply({ split: on })} />
              </div>
            </>
          )}
          {setup.mode === 'triangle' && (
            <>
              <div class="group" role="group" aria-label="סוג ההצבה">
                {TRI_KINDS.map((k) => (
                  <Toggle
                    key={k}
                    label={<bdi dir="ltr">{KIND_LABEL[k]}</bdi>}
                    on={setup.kind === k}
                    onChange={() => {
                      if (k !== cur.current.kind) apply({ kind: k, tx: xDefault(k, cur.current.a) });
                    }}
                  />
                ))}
              </div>
              <div class="ts-ctl" data-control="a">
                <Slider label="הפרמטר a" value={setup.a} min={1} max={3} step={0.1} format={(v) => fmt(v, 2)} onChange={(v) => apply({ a: clampA(v), tx: clampTri(cur.current.kind, clampA(v), cur.current.tx) })} />
              </div>
            </>
          )}
          <div class="ts-ctl" data-control="x">
            <Slider label="הנקודה x" value={xval} min={xlo} max={xhi} step={0.01} format={(v) => fmt(v, 3)} onChange={setXOfMode} />
          </div>
        </>
      }
    />
  );
}
