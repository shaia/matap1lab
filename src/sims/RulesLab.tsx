/**
 * RulesLab (chapter 5.3–5.4, the rules of differentiation): three pictures of three rules. Maths: src/math/rules.ts,
 * whose closed forms give every exact value; the measured quantities (Δu, Δy/Δu, …) are probes and say so.
 * Canvases are math space and stay LTR; sliders for math quantities are `dir="ltr"`. No animation (nothing moves on
 * its own, so still mode changes nothing).
 *
 * mode 'product': the rectangle of sides u(x) (horizontal) and v(x) (vertical) for a pair, and the bigger one at
 *                 x + Δx (dashed outline). The strip v·Δu (colour --eps, hatched "/"), the strip u·Δv (--curve-2,
 *                 hatched "\") and the corner Δu·Δv (--delta, cross-hatched): two colours AND two hatch directions.
 *                 When Δv < 0 (sin past π/2) the strip u·Δv and the corner are areas taken away: dashed outline and a
 *                 "−" label. Sliders x and Δx ∈ [0.01, 1] (and x + Δx ≤ the pair's reach, so v > 0: for x2-sin
 *                 Δx ≤ 3 − x). Arrow keys on the canvas: ←/→ move x, ↑/↓ change Δx.
 * mode 'chain':   three horizontal number lines stacked, x (bottom), u = g(x) (middle), y = f(u) (top), all three at
 *                 ONE common scale chosen so the longest of the three intervals fills ~60% of the width (a scale bar
 *                 shows it). The interval [x, x + Δx], its image [g(x), g(x + Δx)] and the image of that, joined by
 *                 seven fan lines; on every line the image of x is a filled circle and the image of x + Δx a filled
 *                 square (a reversed order shows a negative stretch). The measured stretch factors "× …" sit between
 *                 the lines. Slider x (step 0.01; snaps to an exact zero of the derivative within 0.005) and log slider
 *                 Δx (1 down to 10⁻⁴, quarter decades). Arrow keys: ←/→ move x, ↑/↓ change Δx.
 * mode 'inverse': f and f⁻¹ on one square plot with y = x dashed; A = (a, f(a)) on f (filled, --curve) and its mirror
 *                 A′ = (f(a), a) on f⁻¹ (filled, --curve-2), joined by a dashed segment; the tangents at A (slope m)
 *                 and at A′ (slope 1/m), both solid --limit, with a rise/run triangle (--eps) on each whose legs are
 *                 labelled Δx, Δy and swap. At m = 0 (x³ at 0, sin at ±π/2) the mirror tangent is vertical and the
 *                 canvas says "משיק אנכי". Slider a (step 0.01; snaps to ±π/2 within 0.005); drag A along f (pointer x
 *                 sets a) or A′ along f⁻¹ (pointer y sets a); arrow keys ←/→.
 *
 * Props (defaults): id (required); mode ('product'); modes (the mode buttons shown; default the starting mode only);
 * tasks ([]). pair (product preset: 'x-x2'); preset (the preset of the starting mode when it is chain or inverse:
 * chain 'sin-x3', inverse 'x3px1'); x (the starting mode's x: the preset's default: x-x2 2, x2-sin 1, lin-lin 1,
 * sin-x3 1, sq-lin 0.5, exp-neg-sq 1, sqrt-1px2 1); dx (product 0.5, chain 0.1; product clamped to [0.01, dxMax],
 * chain to [10⁻⁴, 1]); a (inverse: exp 1, cube 1, sin 0.5, tan 0.7, x3px1 0.5).
 * Every prop is also a step key (`<Step fig=… set={{…}}>`); a key left out keeps its value. In a step `preset` names a
 * preset of the mode the step leaves the figure in (chain or inverse), and `x`, `dx` go to the product or the chain
 * according to that mode; a new `pair` / `preset` resets that mode's x (or a) to the preset default unless the step
 * gives it. A state set by a step never ticks a task, and a state that already had a task's property when a step or
 * reset made it must be left and found again. The preset buttons (all presets of the mode, always shown) act like a
 * step: they never tick a task.
 *
 * Readouts (`data-readout`): product: pair, x, dx, duv, sum, corner, cornerRatio; chain: fn, x, dx, stretchInner,
 * stretchOuter, stretch, exact; inverse: fn, a, fa, m, minv.
 *
 * Tasks (ticked only inside the learner's own slider, drag or key):
 *   product: product-corner (Δx ≤ 0.05)
 *   chain:   chain-small (Δx ≤ 10⁻³), chain-zero (preset sin-x3, x moved to within 0.02 of 0 or ±∛(π/2))
 *   inverse: inverse-recip (a moved, m ≠ 0: m·(1/m) = 1 shown), inverse-flat (cube with |a| ≤ 0.02, or sin with a
 *            within 0.02 of ±π/2)
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { niceAngle } from '~/math/coords';
import {
  CHAIN,
  CHAIN_IDS,
  INVERSE,
  INV_IDS,
  PAIRS,
  PAIR_IDS,
  DX_MIN,
  chainExact,
  chainMeasured,
  dxMax,
  inverseSlopes,
  isChainId,
  isInvId,
  isPairId,
  productParts,
  type ChainId,
  type InvId,
  type PairId,
} from '~/math/rules';
import { markTask } from '~/progress/store';
import { subscribeSteps, type StepState } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { sci } from './core/format';
import { withAlpha } from './core/ink';
import { drawAxes, insetBox, makePlot, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import './RulesLab.css';

export type RulesMode = 'product' | 'chain' | 'inverse';

export interface RulesLabProps {
  id: string;
  mode?: RulesMode;
  /** the mode buttons shown (default: the starting mode only) */
  modes?: RulesMode[];
  /** product preset */
  pair?: string;
  /** chain or inverse preset (of the starting mode) */
  preset?: string;
  x?: number;
  dx?: number;
  a?: number;
  tasks?: string[];
}

interface Setup {
  mode: RulesMode;
  pair: PairId;
  px: number;
  pdx: number;
  cp: ChainId;
  cx: number;
  cdx: number;
  ip: InvId;
  a: number;
}

const ltr = (s: string) => String.fromCharCode(0x2066) + s.replace(/ /g, String.fromCharCode(0xa0)) + String.fromCharCode(0x2069);

const TASK_LABEL: Record<string, string> = {
  'product-corner': `הקטינו את ${ltr('Δx')} עד ${ltr('0.05')} או פחות. איזה חלק מהשינוי בשטח נשאר בפינה?`,
  'chain-small': `הקטינו את ${ltr('Δx')} עד ${ltr('10⁻³')} או פחות. השוו את מכפלת שני יחסי המתיחה לנגזרת המדויקת.`,
  'chain-zero': `ב-${ltr('y = sin(x³)')} הזיזו את x לנקודה שבה אחד משני הגורמים מתאפס. מה הנגזרת שם?`,
  'inverse-recip': 'הזיזו את הנקודה A. מה המכפלה של השיפוע ב-A והשיפוע ב-A′?',
  'inverse-flat': `ב-${ltr('x³')} או ב-${ltr('sin x')} הביאו את A לנקודה שבה המשיק אופקי. מה קורה למשיק של ההפוכה?`,
};

const MODE_LABEL: Record<RulesMode, string> = { product: 'כלל המכפלה', chain: 'כלל השרשרת', inverse: 'נגזרת ההפוכה' };

const TAU = 2 * Math.PI;
const CE_MAX = 4;
const CE_STEP = 0.25;
const SNAP = 0.0051;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const roundTo = (x: number, step: number) => Number((Math.round(x / step) * step).toPrecision(10));
const minus = (s: string) => s.replace(/-/g, '−');
const fmt = (x: number, sig = 4) => (Number.isNaN(x) ? '—' : !Number.isFinite(x) ? (x > 0 ? '∞' : '−∞') : Math.abs(x) < 1e-12 ? '0' : minus(sci(x, sig)));
const SUP_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const eOfH = (h: number) => -Math.log10(h);
const fmtH = (h: number) => {
  const e = eOfH(h);
  if (Math.abs(e - Math.round(e)) > 1e-9) return fmt(h, 2);
  const n = Math.round(e);
  return n === 0 ? '1' : '10⁻' + String(n).replace(/\d/g, (d) => SUP_DIGITS[Number(d)]);
};
const clampCdx = (h: number) => clamp(h, 1e-4, 1);
const cdxOfE = (e: number) => clampCdx(10 ** -clamp(roundTo(e, CE_STEP), 0, CE_MAX));

/* ---- presets and their defaults */
const fixPdx = (pair: PairId, x: number, dx: number) => clamp(roundTo(dx, 0.01), DX_MIN, dxMax(pair, x));
const fixPx = (pair: PairId, x: number) => clamp(roundTo(x, 0.05), PAIRS[pair].xRange[0], PAIRS[pair].xRange[1]);
function snapCx(id: ChainId, v: number): number {
  const s = CHAIN[id];
  const r = clamp(roundTo(v, 0.01), s.xRange[0], s.xRange[1]);
  const z = s.zeros.find((q) => Math.abs(q.x - r) < SNAP);
  return z ? z.x : r;
}
function snapA(id: InvId, v: number): number {
  const s = INVERSE[id];
  // a step that sets an exact multiple of π/12 (π/6, π/4, …) keeps it exact: the text quotes the values there
  const k = v / (Math.PI / 12);
  if (Math.abs(k - Math.round(k)) < 1e-9) return clamp(Math.round(k) * (Math.PI / 12), s.aRange[0], s.aRange[1]);
  const r = clamp(roundTo(v, 0.01), s.aRange[0], s.aRange[1]);
  const f = s.flat.find((q) => Math.abs(q - r) < SNAP);
  return f !== undefined ? f : r;
}
const fmtA = (id: InvId, a: number) => ((id === 'sin' || id === 'tan') && niceAngle(a) !== null && a !== 0 ? (niceAngle(a) as string) : fmt(a));
const fmtCx = (id: ChainId, x: number) => {
  if (id === 'sin-x3' && Math.abs(Math.abs(x) - CHAIN['sin-x3'].zeros[2].x) < 1e-12) return `${x < 0 ? '−' : ''}∛(π/2) ≈ ${fmt(Math.abs(x))}`;
  if (id === 'sq-lin' && x === -1 / 3) return '−1/3';
  return fmt(x);
};

/* ---- tasks: `needs` = the learner's change must touch one of these keys; `event` tasks tick on the learner's act, the
 * others must be left and found again after a step or reset made the state */
interface Rule {
  needs: (keyof Setup)[];
  event?: boolean;
  state: (s: Setup) => boolean;
}
const RULES: Record<string, Rule> = {
  'product-corner': { needs: ['pdx'], state: (s) => s.mode === 'product' && s.pdx <= 0.05 + 1e-9 },
  'chain-small': { needs: ['cdx'], state: (s) => s.mode === 'chain' && s.cdx <= 1e-3 * (1 + 1e-9) },
  'chain-zero': { needs: ['cx'], state: (s) => s.mode === 'chain' && s.cp === 'sin-x3' && CHAIN['sin-x3'].zeros.some((z) => Math.abs(s.cx - z.x) <= 0.02 + 1e-9) },
  'inverse-recip': { needs: ['a'], event: true, state: (s) => s.mode === 'inverse' && !inverseSlopes(s.ip, s.a).vertical },
  'inverse-flat': {
    needs: ['a'],
    state: (s) => s.mode === 'inverse' && ((s.ip === 'cube' && Math.abs(s.a) <= 0.02 + 1e-9) || (s.ip === 'sin' && Math.abs(Math.abs(s.a) - Math.PI / 2) <= 0.02 + 1e-9)),
  },
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

/**
 * A rectangle (screen corners in any order) tinted and hatched: dir 1 = "/" lines, −1 = "\" lines, 0 = both (cross).
 * `removed` draws the outline dashed (an area taken away).
 */
function hatchRect(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, color: string, dir: 1 | -1 | 0, removed: boolean, gap = 7) {
  const x0 = Math.min(ax, bx);
  const x1 = Math.max(ax, bx);
  const y0 = Math.min(ay, by);
  const y1 = Math.max(ay, by);
  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 0 && h <= 0) return;
  ctx.save();
  ctx.fillStyle = withAlpha(color, 0.16);
  ctx.fillRect(x0, y0, w, h);
  ctx.beginPath();
  ctx.rect(x0, y0, w, h);
  ctx.clip();
  ctx.strokeStyle = withAlpha(color, 0.85);
  ctx.lineWidth = 1.2;
  const dirs: (1 | -1)[] = dir === 0 ? [1, -1] : [dir];
  for (const d of dirs) {
    ctx.beginPath();
    // lines x − d·(y − y1) = c across the rectangle (d = 1: rising to the right on screen)
    for (let c = x0 - h - gap; c <= x1 + h + gap; c += gap) {
      if (d === 1) {
        ctx.moveTo(c, y1);
        ctx.lineTo(c + h, y0);
      } else {
        ctx.moveTo(c, y0);
        ctx.lineTo(c + h, y1);
      }
    }
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.setLineDash(removed ? [5, 3] : []);
  ctx.strokeRect(x0, y0, w, h);
  ctx.restore();
}

/** a polyline of points (screen coordinates), broken where a point is not finite or jumps more than `jump` px */
function polyline(ctx: CanvasRenderingContext2D, pts: [number, number][], color: string, width: number, clip: { x: number; y: number; w: number; h: number }, jump = 1e4) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(clip.x, clip.y - 1, clip.w, clip.h + 2);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  let started = false;
  let prev: [number, number] = [0, 0];
  for (const [sx, sy] of pts) {
    if (!Number.isFinite(sx) || !Number.isFinite(sy)) {
      started = false;
      continue;
    }
    const cx = clamp(sx, -1e4, 1e4);
    const cy = clamp(sy, -1e4, 1e4);
    if (started && Math.abs(cx - prev[0]) + Math.abs(cy - prev[1]) > jump) started = false;
    if (started) ctx.lineTo(cx, cy);
    else ctx.moveTo(cx, cy);
    started = true;
    prev = [cx, cy];
  }
  ctx.stroke();
  ctx.restore();
}

/** a round step 1, 2 or 5 × 10ⁿ close to `raw` */
function niceStep(raw: number): number {
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * mag;
}

/**
 * The square-scaled plot of the product picture: the window is the current pair of rectangles with 14% to spare, and
 * ONE scale (px per unit) serves both axes, so a side of length 4 is drawn twice as long as a side of length 2. The plot
 * box is centred in the room left after the tick margins.
 */
function productPlot(view: { w: number; h: number }, U: number, V: number, U2: number, V2: number): Plot {
  const Eu = 1.14 * Math.max(U, U2);
  const Ev = 1.14 * Math.max(V, V2);
  const room = insetBox({ x: 0, y: 0, w: view.w, h: view.h }, { l: 46, r: 16, t: 16, b: 40 });
  const s = Math.min(room.w / Eu, room.h / Ev);
  const w = Eu * s;
  const h = Ev * s;
  const box = { x: room.x + (room.w - w) / 2, y: room.y + (room.h - h) / 2, w, h };
  // one tick step for both axes, about 60 px apart
  const step = niceStep(60 / s);
  const ticks = (E: number) => Array.from({ length: Math.floor(E / step + 1e-9) + 1 }, (_, k) => Number((k * step).toPrecision(12)));
  return makePlot(box, { min: 0, max: Eu, label: 'u', ticks: ticks(Eu) }, { min: 0, max: Ev, label: 'v', ticks: ticks(Ev) });
}

export default function RulesLab(props: RulesLabProps) {
  const startMode: RulesMode = props.mode ?? 'product';
  const modes: RulesMode[] = props.modes ?? [startMode];
  const initial = (): Setup => {
    const pair: PairId = isPairId(props.pair) ? props.pair : 'x-x2';
    const cp: ChainId = startMode === 'chain' && isChainId(props.preset) ? props.preset : 'sin-x3';
    const ip: InvId = startMode === 'inverse' && isInvId(props.preset) ? props.preset : 'x3px1';
    const px = fixPx(pair, (startMode === 'product' ? num(props.x) : null) ?? PAIRS[pair].defaultX);
    return {
      mode: startMode,
      pair,
      px,
      pdx: fixPdx(pair, px, (startMode === 'product' ? num(props.dx) : null) ?? 0.5),
      cp,
      cx: snapCx(cp, (startMode === 'chain' ? num(props.x) : null) ?? CHAIN[cp].defaultX),
      cdx: clampCdx((startMode === 'chain' ? num(props.dx) : null) ?? 0.1),
      ip,
      a: snapA(ip, num(props.a) ?? INVERSE[ip].defaultA),
    };
  };
  const [setup, setSetup] = useState<Setup>(initial);
  const cur = useRef(setup);
  const [live, setLive] = useState('');
  const [narrow, setNarrow] = useState(false);
  const plotRef = useRef<Plot | null>(null);
  const dragging = useRef<'A' | 'A2' | null>(null);
  /** tasks whose state held when the last step, preset button or reset made it: they must be left and found again */
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
        const mode = typeof st.mode === 'string' && modes.includes(st.mode as RulesMode) ? (st.mode as RulesMode) : prev.mode;
        const next: Setup = { ...prev, mode };
        const x = num(st.x);
        const dx = num(st.dx);
        const a = num(st.a);
        if (isPairId(st.pair) && st.pair !== prev.pair) {
          next.pair = st.pair;
          next.px = PAIRS[st.pair].defaultX;
        }
        if (mode === 'product') {
          next.px = fixPx(next.pair, x ?? next.px);
          next.pdx = fixPdx(next.pair, next.px, dx ?? next.pdx);
        } else next.pdx = fixPdx(next.pair, next.px, next.pdx);
        if (mode === 'chain') {
          if (isChainId(st.preset) && st.preset !== prev.cp) {
            next.cp = st.preset;
            next.cx = CHAIN[st.preset].defaultX;
          }
          next.cx = snapCx(next.cp, x ?? next.cx);
          next.cdx = clampCdx(dx ?? next.cdx);
        }
        if (mode === 'inverse' && isInvId(st.preset) && st.preset !== prev.ip) {
          next.ip = st.preset;
          next.a = INVERSE[st.preset].defaultA;
        }
        next.a = snapA(next.ip, a ?? next.a);
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
    const font = (w8: number, size = fs) => `${w8} ${size}px ${p.fontUi}`;

    if (s0.mode === 'product') {
      const pp = productParts(s0.pair, s0.px, s0.pdx);
      const plot = productPlot(view, pp.U, pp.V, pp.U2, pp.V2);
      plotRef.current = plot;
      drawAxes(ctx, plot, p);
      const X = plot.px;
      const Y = plot.py;
      const { U, V, U2, V2, dv } = pp;
      const removed = dv < 0;
      // the rectangle u·v
      ctx.save();
      ctx.fillStyle = withAlpha(p.curve, 0.07);
      ctx.fillRect(X(0), Y(V), X(U) - X(0), Y(0) - Y(V));
      ctx.restore();
      // the strips and the corner
      hatchRect(ctx, X(U), Y(0), X(U2), Y(V), p.eps, 1, false);
      hatchRect(ctx, X(0), Y(V), X(U), Y(V2), p.curve2, -1, removed);
      hatchRect(ctx, X(U), Y(V), X(U2), Y(V2), p.delta, 0, removed);
      ctx.save();
      ctx.strokeStyle = p.curve;
      ctx.lineWidth = 2.2;
      ctx.strokeRect(X(0), Y(V), X(U) - X(0), Y(0) - Y(V));
      ctx.restore();
      // the rectangle at x + Δx
      ctx.save();
      ctx.strokeStyle = p.ink2;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(X(0), Y(V2), X(U2) - X(0), Y(0) - Y(V2));
      ctx.restore();
      // labels
      const bold = font(700);
      haloText(ctx, p, 'u·v', (X(0) + X(U)) / 2, (Y(0) + Y(V)) / 2, { font: font(700, fs + 2), color: p.curve });
      haloText(ctx, p, `u = ${fmt(U, 3)}`, (X(0) + X(U)) / 2, Y(0) - 12, { font: bold, color: p.curve });
      haloText(ctx, p, `v = ${fmt(V, 3)}`, X(0) + 8, (Y(0) + Y(V)) / 2 + 20, { font: bold, color: p.curve, align: 'left' });
      const sw = X(U2) - X(U);
      const sh = Math.abs(Y(V2) - Y(V));
      const yTop = Math.min(Y(V), Y(V2));
      // Δu above its strip and Δv to the right of its band, outside the rectangle; a strip thinner than its label gets
      // no label (the readout's hatched swatches name it), so the two never pile onto the corner
      if (sw >= 22) haloText(ctx, p, 'Δu', (X(U) + X(U2)) / 2, yTop - 11, { font: bold, color: p.eps });
      if (sh >= 16) haloText(ctx, p, removed ? 'Δv < 0' : 'Δv', X(U2) + 7, (Y(V) + Y(V2)) / 2, { font: bold, color: p.curve2, align: 'left' });
      if (sw >= 40) haloText(ctx, p, 'v·Δu', (X(U) + X(U2)) / 2, (Y(0) + Y(V)) / 2, { font: bold, color: p.eps });
      if (sh >= 18) haloText(ctx, p, removed ? '−u·|Δv|' : 'u·Δv', (X(0) + X(U)) / 2, (Y(V) + Y(V2)) / 2, { font: bold, color: p.curve2 });
      if (sw >= 52 && sh >= 18) haloText(ctx, p, 'Δu·Δv', (X(U) + X(U2)) / 2, (Y(V) + Y(V2)) / 2, { font: font(700, fs - 1), color: p.delta });
    } else if (s0.mode === 'chain') {
      plotRef.current = null;
      const sp = CHAIN[s0.cp];
      const X0 = s0.cx;
      const X1 = s0.cx + s0.cdx;
      const U0 = sp.g(X0);
      const U1 = sp.g(X1);
      const Y0 = sp.f(U0);
      const Y1 = sp.f(U1);
      const meas = chainMeasured(s0.cp, s0.cx, s0.cdx);
      const L = nar ? 14 : 92;
      const R = view.w - (nar ? 14 : 70);
      const rowY = nar ? [0.24, 0.55, 0.84].map((t) => t * view.h) : [0.17, 0.5, 0.83].map((t) => t * view.h);
      const [yTop, yMid, yBot] = rowY;
      const span = Math.max(Math.abs(X1 - X0), Math.abs(U1 - U0), Math.abs(Y1 - Y0));
      const sc = (0.6 * (R - L)) / span;
      const mid = (L + R) / 2;
      const mapper = (c: number) => (v: number) => mid + (v - c) * sc;
      const MX = mapper((X0 + X1) / 2);
      const MU = mapper((U0 + U1) / 2);
      const MY = mapper((Y0 + Y1) / 2);
      // rulers: a common tick step for the three lines
      const step = niceStep(70 / sc);
      const rows: [number, (v: number) => number, number][] = [
        [yBot, MX, (X0 + X1) / 2],
        [yMid, MU, (U0 + U1) / 2],
        [yTop, MY, (Y0 + Y1) / 2],
      ];
      for (const [yy, M, c] of rows) {
        line(ctx, L, yy, R, yy, p.ink2, 1.5);
        const kLo = Math.ceil((c - (mid - L) / sc) / step);
        const kHi = Math.floor((c + (R - mid) / sc) / step);
        ctx.save();
        ctx.strokeStyle = p.ink3;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let k = kLo; k <= kHi && k - kLo < 200; k++) {
          const sx = M(k * step);
          ctx.moveTo(sx, yy - 4);
          ctx.lineTo(sx, yy + 4);
        }
        ctx.stroke();
        ctx.restore();
      }
      // line names
      const names = ['x', 'u = g(x)', 'y = f(u)'];
      rows.forEach(([yy], i) => {
        if (nar) haloText(ctx, p, names[i], L, yy - 16, { font: font(700), color: p.ink, align: 'left' });
        else haloText(ctx, p, names[i], L - 10, yy, { font: font(700), color: p.ink, align: 'right' });
      });
      // the fan: seven points of [x, x + Δx] followed through g and f
      ctx.save();
      ctx.beginPath();
      ctx.rect(L, 0, R - L, view.h);
      ctx.clip();
      ctx.strokeStyle = withAlpha(p.ink3, 0.6);
      ctx.lineWidth = 1;
      /** each fan line as its three screen points, bottom row first */
      const fans: [number, number][][] = [];
      for (let i = 0; i <= 6; i++) {
        const t = X0 + ((X1 - X0) * i) / 6;
        const u = sp.g(t);
        const yv = sp.f(u);
        const pts: [number, number][] = [
          [MX(t), yBot],
          [MU(u), yMid],
          [MY(yv), yTop],
        ];
        fans.push(pts);
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        ctx.lineTo(pts[1][0], pts[1][1]);
        ctx.lineTo(pts[2][0], pts[2][1]);
        ctx.stroke();
      }
      ctx.restore();
      // the intervals: the image of x a circle, of x + Δx a square
      const seg = (yy: number, a: number, b: number) => {
        line(ctx, a, yy, b, yy, p.eps, 5);
        dot(ctx, a, yy, 5.5, p.eps, p.paper);
        square(ctx, b, yy, 4.6, p.eps, p.paper);
      };
      seg(yBot, MX(X0), MX(X1));
      seg(yMid, MU(U0), MU(U1));
      seg(yTop, MY(Y0), MY(Y1));
      // the value at the circle of each line, placed where no fan line crosses it: centred below or above, else to
      // the side of the circle (the first free spot; failing that, the one crossed by the fewest fan lines)
      const lab = font(600, fs - 1);
      const crossings = (row: number, cx: number, cy: number, wd: number): number => {
        // the fan segments between this row and its neighbour on the label's side
        const other = cy > rowY[2 - row] ? row - 1 : row + 1;
        if (other < 0 || other > 2) return 0;
        const y0 = cy - 8;
        const y1 = cy + 8;
        let n = 0;
        for (const f of fans) {
          const [ax, ay] = f[row];
          const [bx, by] = f[other];
          const xAt = (yq: number) => ax + ((bx - ax) * (clamp(yq, Math.min(ay, by), Math.max(ay, by)) - ay)) / (by - ay);
          const xa = xAt(y0);
          const xb = xAt(y1);
          if (Math.max(xa, xb) >= cx - wd / 2 - 3 && Math.min(xa, xb) <= cx + wd / 2 + 3) n++;
        }
        return n;
      };
      const placeLabel = (row: number, text: string, at: number) => {
        const yy = rowY[2 - row];
        ctx.save();
        ctx.font = lab;
        const wd = ctx.measureText(text).width;
        ctx.restore();
        const side = wd / 2 + 10;
        const order: [number, number][] =
          row === 2
            ? [[0, -17], [0, 17], [-side, -17], [side, -17]]
            : [[0, 17], [0, -17], [-side, 17], [side, 17], [-side, -17], [side, -17]];
        let best: [number, number] | null = null;
        let bestN = Infinity;
        for (const [ox, oy] of order) {
          const cx = clamp(at + ox, L + wd / 2, R - wd / 2);
          // in the narrow layout the line's name sits above its left end
          if (nar && oy < 0 && cx - wd / 2 < L + 64) continue;
          const n = crossings(row, cx, yy + oy, wd);
          if (n < bestN) {
            best = [cx, yy + oy];
            bestN = n;
          }
          if (n === 0) break;
        }
        if (best) haloText(ctx, p, text, best[0], best[1], { font: lab, color: p.ink2 });
      };
      placeLabel(0, `x = ${fmt(X0)}`, MX(X0));
      placeLabel(1, `u = ${fmt(U0)}`, MU(U0));
      placeLabel(2, `y = ${fmt(Y0)}`, MY(Y0));
      // the measured stretch factors between the lines
      const fx = nar ? R : R + 8;
      const al: CanvasTextAlign = nar ? 'right' : 'left';
      haloText(ctx, p, `× ${fmt(meas.inner, 3)}`, fx, (yBot + yMid) / 2, { font: font(700), color: p.eps, align: al });
      haloText(ctx, p, `× ${Number.isNaN(meas.outer) ? '—' : fmt(meas.outer, 3)}`, fx, (yMid + yTop) / 2, { font: font(700), color: p.eps, align: al });
      // the scale bar
      const barPx = step * sc;
      const bx1 = R;
      const bx0 = R - barPx;
      const by = Math.min(view.h - 8, yBot + 34);
      line(ctx, bx0, by, bx1, by, p.ink2, 1.6);
      line(ctx, bx0, by - 4, bx0, by + 4, p.ink2, 1.6);
      line(ctx, bx1, by - 4, bx1, by + 4, p.ink2, 1.6);
      haloText(ctx, p, fmt(step, 2), bx0 - 6, by, { font: font(600, fs - 1), color: p.ink2, align: 'right' });
    } else {
      const sp = INVERSE[s0.ip];
      const [lo, hi] = sp.window;
      const side = Math.max(60, Math.min(view.w - 46 - 14, view.h - 16 - 40));
      const bx = Math.max(46, (view.w - side) / 2);
      const box = { x: bx, y: 16, w: side, h: side };
      const plot = makePlot(box, { min: lo, max: hi, label: 'x' }, { min: lo, max: hi, label: 'y' });
      plotRef.current = plot;
      drawAxes(ctx, plot, p);
      const X = plot.px;
      const Y = plot.py;
      // the coordinate axes through 0
      if (lo < 0 && hi > 0) {
        line(ctx, X(0), box.y, X(0), box.y + box.h, withAlpha(p.ink2, 0.7), 1.1);
        line(ctx, box.x, Y(0), box.x + box.w, Y(0), withAlpha(p.ink2, 0.7), 1.1);
      }
      line(ctx, X(lo), Y(lo), X(hi), Y(hi), p.ink3, 1.6, [6, 5]);
      // f and its mirror f⁻¹
      const eps = sp.domain.open ? 1e-4 : 0;
      const x0 = Math.max(lo, sp.domain.lo + eps);
      const x1 = Math.min(hi, sp.domain.hi - eps);
      const n = 600;
      const graph: [number, number][] = [];
      const mirror: [number, number][] = [];
      for (let i = 0; i <= n; i++) {
        // denser near the ends of an open domain (tan): t² spacing from both ends
        const t = i / n;
        const tt = sp.domain.open ? 0.5 - 0.5 * Math.cos(Math.PI * t) : t;
        const xv = x0 + (x1 - x0) * tt;
        const yv = sp.f(xv);
        graph.push([X(xv), Y(yv)]);
        mirror.push([X(yv), Y(xv)]);
      }
      polyline(ctx, graph, p.curve, 2.6, box);
      polyline(ctx, mirror, p.curve2, 2.6, box);
      if (!sp.domain.open && Number.isFinite(sp.domain.lo)) {
        for (const e of [sp.domain.lo, sp.domain.hi]) {
          dot(ctx, X(e), Y(sp.f(e)), 3.8, p.curve, p.paper);
          dot(ctx, X(sp.f(e)), Y(e), 3.8, p.curve2, p.paper);
        }
      }
      const r = inverseSlopes(s0.ip, s0.a);
      const a = s0.a;
      const fa = r.fa;
      const m = r.m;
      // the tangents
      const clipBox = () => {
        ctx.beginPath();
        ctx.rect(box.x, box.y, box.w, box.h);
        ctx.clip();
      };
      ctx.save();
      clipBox();
      line(ctx, X(lo), Y(fa + m * (lo - a)), X(hi), Y(fa + m * (hi - a)), p.limit, 2.2);
      if (r.vertical) line(ctx, X(fa), box.y, X(fa), box.y + box.h, p.limit, 2.2);
      else line(ctx, X(lo), Y(a + (lo - fa) / m), X(hi), Y(a + (hi - fa) / m), p.limit, 2.2);
      ctx.restore();
      // The rise/run triangles: at A run Δx = L (orientation d), then rise Δy = mL; at A′ the Δx leg is vertical and
      // the Δy leg horizontal (orientation e), slope 1/m. Each triangle points AWAY from the other point: A's x-range
      // is [a − L, a] when A′ lies to its right (f(a) > a) and A′'s is [f(a), f(a) + mL], so the two never overlap,
      // even when A and A′ are close (tan at π/4). A triangle that would leave the window flips.
      const spanW = hi - lo;
      const Lr = (0.16 * spanW) / Math.max(1, Math.abs(m));
      const inside = (v: number) => v >= lo + 0.03 * spanW && v <= hi - 0.03 * spanW;
      let d = fa > a ? -1 : 1;
      if (!(inside(a + d * Lr) && inside(fa + d * m * Lr))) d = -d;
      let e = -d;
      if (!(inside(fa + e * m * Lr) && inside(a + e * Lr))) e = -e;
      ctx.save();
      clipBox();
      // at A: run Δx, then rise Δy = mΔx
      line(ctx, X(a), Y(fa), X(a + d * Lr), Y(fa), p.eps, 2.2);
      line(ctx, X(a + d * Lr), Y(fa), X(a + d * Lr), Y(fa + d * m * Lr), p.eps, 2.2);
      // at A′: the legs swapped: Δx vertical, Δy horizontal
      line(ctx, X(fa), Y(a), X(fa), Y(a + e * Lr), p.eps, 2.2);
      line(ctx, X(fa), Y(a + e * Lr), X(fa + e * m * Lr), Y(a + e * Lr), p.eps, 2.2);
      ctx.restore();
      // leg labels on the outer side of each leg
      const small = font(700, fs - 1);
      haloText(ctx, p, 'Δx', X(a + (d * Lr) / 2), Y(fa) + 12 * d, { font: small, color: p.eps });
      if (m !== 0) haloText(ctx, p, 'Δy', X(a + d * Lr) + 15 * d, Y(fa + (d * m * Lr) / 2), { font: small, color: p.eps });
      haloText(ctx, p, 'Δx', X(fa) - 15 * e, Y(a + (e * Lr) / 2), { font: small, color: p.eps });
      if (m !== 0) haloText(ctx, p, 'Δy', X(fa + (e * m * Lr) / 2), Y(a + e * Lr) - 11 * e, { font: small, color: p.eps });
      // A, A′ and the mirror segment; each letter on the side free of its triangle, tangent and the segment
      line(ctx, X(a), Y(fa), X(fa), Y(a), withAlpha(p.ink2, 0.85), 1.3, [4, 4]);
      dot(ctx, X(a), Y(fa), 6, p.curve, p.paper);
      dot(ctx, X(fa), Y(a), 6, p.curve2, p.paper);
      haloText(ctx, p, 'A', X(a) + 14 * d, Y(fa) + 13 * d, { font: font(700), color: p.curve });
      haloText(ctx, p, 'A′', X(fa) + 14 * e, Y(a) + 13 * e, { font: font(700), color: p.curve2 });
      if (r.vertical) {
        // at the foot of the vertical tangent, on the side with more room (the curves run through the other corners)
        const left = X(fa) - box.x > box.x + box.w - X(fa);
        haloText(ctx, p, 'משיק אנכי ב-A′', left ? X(fa) - 8 : X(fa) + 8, box.y + box.h - 14, {
          font: font(700),
          color: p.limit,
          align: left ? 'right' : 'left',
          rtl: true,
        });
      }
      // legend
      const lx = box.x + 8;
      let ly = box.y + 12;
      const legend: [string, string, boolean][] = [
        [`f(x) = ${sp.fText}`, p.curve, false],
        [sp.id === 'x3px1' ? 'f⁻¹' : `f⁻¹(x) = ${sp.finvText}`, p.curve2, false],
        ['y = x', p.ink3, true],
      ];
      for (const [t, c, dsh] of legend) {
        line(ctx, lx, ly, lx + 18, ly, c, 2.4, dsh ? [5, 4] : []);
        haloText(ctx, p, t, lx + 24, ly, { font: font(600, fs - 1), color: c === p.ink3 ? p.ink2 : c, align: 'left' });
        ly += 17;
      }
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
  const aspect = setup.mode === 'chain' ? (narrow ? 1.05 : 1.9) : setup.mode === 'inverse' ? (narrow ? 0.95 : 1.3) : narrow ? 0.95 : 1.2;

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
      if (!rule.event && held.current.has(id)) continue;
      done(id);
    }
  };
  /** A preset button: like a step, it never ticks a task. */
  const choose = (patch: Partial<Setup>) => {
    const next: Setup = { ...cur.current, ...patch };
    commit(next);
    rebase(next);
    setLive(describe(next));
  };

  const setPx = (v: number) => {
    const c = cur.current;
    const px = fixPx(c.pair, v);
    const pdx = fixPdx(c.pair, px, c.pdx);
    if (px !== c.px || pdx !== c.pdx) apply(pdx !== c.pdx ? { px, pdx } : { px });
  };
  const setPdx = (v: number) => {
    const c = cur.current;
    const pdx = fixPdx(c.pair, c.px, v);
    if (pdx !== c.pdx) apply({ pdx });
  };
  const setCx = (v: number) => {
    const c = cur.current;
    const cx = snapCx(c.cp, v);
    if (cx !== c.cx) apply({ cx });
  };
  const setCe = (e: number) => {
    const c = cur.current;
    const cdx = cdxOfE(e);
    if (cdx !== c.cdx) apply({ cdx });
  };
  const setA = (v: number) => {
    const c = cur.current;
    const a = snapA(c.ip, v);
    if (a !== c.a) apply({ a });
  };

  const fromPointer = (e: PointerEvent) => {
    const plot = plotRef.current;
    const h = dragging.current;
    if (!plot || !h) return;
    const [lo, hi] = INVERSE[cur.current.ip].window;
    const v = h === 'A' ? lo + ((e.offsetX - plot.box.x) / plot.box.w) * (hi - lo) : hi - ((e.offsetY - plot.box.y) / plot.box.h) * (hi - lo);
    setA(v);
  };
  const onPointerDown = (e: PointerEvent) => {
    const c = cur.current;
    const plot = plotRef.current;
    if (c.mode !== 'inverse' || !plot) return;
    const r = inverseSlopes(c.ip, c.a);
    const dA = Math.hypot(plot.px(c.a) - e.offsetX, plot.py(r.fa) - e.offsetY);
    const dB = Math.hypot(plot.px(r.fa) - e.offsetX, plot.py(c.a) - e.offsetY);
    dragging.current = dB < dA ? 'A2' : 'A';
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
    const c = cur.current;
    const big = e.shiftKey ? 10 : 1;
    const horiz = e.key === 'ArrowLeft' || e.key === 'ArrowRight';
    const vert = e.key === 'ArrowUp' || e.key === 'ArrowDown';
    if (!horiz && !vert) return;
    const sgn = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : -1;
    if (c.mode === 'product') {
      e.preventDefault();
      if (horiz) setPx(c.px + sgn * 0.05 * big);
      else setPdx(c.pdx + sgn * 0.01 * big);
    } else if (c.mode === 'chain') {
      e.preventDefault();
      if (horiz) setCx(c.cx + sgn * 0.01 * big);
      else setCe(eOfH(c.cdx) - sgn * CE_STEP);
    } else if (horiz) {
      e.preventDefault();
      setA(c.a + sgn * 0.01 * big);
    } else return;
    setLive(describe(cur.current));
  };

  /* ---------------------------------------------------------------- text */
  const M = (q: { children: ComponentChildren }) => <bdi dir="ltr">{q.children}</bdi>;

  function describe(s: Setup): string {
    if (s.mode === 'product') {
      const pp = productParts(s.pair, s.px, s.pdx);
      return `x = ${fmt(s.px)}, Δx = ${fmt(s.pdx)}: השינוי בשטח ${fmt(pp.duv)}, שתי הרצועות ${fmt(pp.sum)}, הפינה ${fmt(pp.corner)}.`;
    }
    if (s.mode === 'chain') {
      const m = chainMeasured(s.cp, s.cx, s.cdx);
      return `x = ${fmtCx(s.cp, s.cx)}, Δx = ${fmtH(s.cdx)}: יחסי המתיחה ${fmt(m.inner)} ו-${fmt(m.outer)}, המכפלה ${fmt(m.total)}; הנגזרת המדויקת ${fmt(chainExact(s.cp, s.cx).d)}.`;
    }
    const r = inverseSlopes(s.ip, s.a);
    return `a = ${fmtA(s.ip, s.a)}, f(a) = ${fmt(r.fa)}: השיפוע ב-A הוא ${fmt(r.m)}, ${r.vertical ? 'והמשיק ב-A′ אנכי.' : `והשיפוע ב-A′ הוא ${fmt(r.minv)}.`}`;
  }

  const sw = (kind: 'v' | 'u' | 'c') => <span class={`rul-sw rul-sw-${kind}`} aria-hidden="true" />;

  let readout: ComponentChildren;
  let label: string;
  if (setup.mode === 'product') {
    const sp = PAIRS[setup.pair];
    const pp = productParts(setup.pair, setup.px, setup.pdx);
    label = `איור חי: מלבן שצלעותיו u(x) = ${sp.uText} לרוחב ו-v(x) = ${sp.vText} לגובה, והמלבן הגדול יותר ב-x + Δx בקו מקווקו. השינוי בשטח מחולק לרצועה v·Δu (קווקוו אלכסוני ימינה), לרצועה u·Δv (קווקוו אלכסוני שמאלה) ולפינה Δu·Δv (קווקוו מוצלב).${pp.dv < 0 ? ' כאן Δv שלילי: הרצועה העליונה והפינה הן שטח שיורד.' : ''}`;
    readout = (
      <>
        <span class="q" data-readout="pair">
          <M>u(x) = {sp.uText}</M>, <M>v(x) = {sp.vText}</M>
        </span>
        <span class="q" data-readout="x">
          <M>
            x = <b>{fmt(setup.px)}</b>
          </M>
        </span>
        <span class="q" data-readout="dx">
          <M>
            Δx = <b>{fmt(setup.pdx)}</b>
          </M>
        </span>
        <span class="q" data-readout="duv">
          השינוי בשטח: <M>
            Δ(uv) = u(x+Δx)·v(x+Δx) − u(x)·v(x) = <b>{fmt(pp.duv, 5)}</b>
          </M>
        </span>
        <span class="q" data-readout="sum">
          {sw('v')}
          {sw('u')} שתי הרצועות: <M>
            v·Δu + u·Δv = <b>{fmt(pp.sum, 5)}</b>
          </M>
        </span>
        <span class="q" data-readout="corner">
          {sw('c')} הפינה: <M>
            Δu·Δv = <b>{fmt(pp.corner, 4)}</b>
          </M>
          , שהם <b>{Number.isNaN(pp.share) ? '—' : `${fmt(pp.share * 100, 2)}%`}</b> <span class="rul-nb">מ-<M>Δ(uv)</M></span>
        </span>
        <span class="q" data-readout="cornerRatio">
          <M>
            Δu·Δv / Δx = <b>{fmt(pp.cornerRatio, 3)}</b>
          </M>{' '}
          (שואף ל-0 <span class="rul-nb">כש-<M>Δx → 0</M>)</span>
        </span>
      </>
    );
  } else if (setup.mode === 'chain') {
    const sp = CHAIN[setup.cp];
    const m = chainMeasured(setup.cp, setup.cx, setup.cdx);
    const ex = chainExact(setup.cp, setup.cx);
    label = `איור חי: שלושה ישרי מספרים זה מעל זה, x למטה, u = ${sp.innerText} באמצע ו-y = ${sp.outerText} למעלה, כולם באותו קנה מידה. הקטע מ-x עד x + Δx, התמונה שלו בישר של u והתמונה של התמונה בישר של y מחוברים בקווים. יחסי המתיחה הנמדדים כתובים בין הישרים.`;
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>
            y = {sp.outerText}, u = {sp.innerText}
          </M>
          , כלומר <M>y = {sp.text}</M>
        </span>
        <span class="q" data-readout="x">
          <M>
            x = <b>{fmtCx(setup.cp, setup.cx)}</b>
          </M>
        </span>
        <span class="q" data-readout="dx">
          <M>
            Δx = <b>{fmtH(setup.cdx)}</b>
          </M>
        </span>
        <span class="q" data-readout="stretchInner">
          המתיחה בשלב הפנימי (מדידה): <M>
            Δu/Δx = <b>{fmt(m.inner, 5)}</b>
          </M>
        </span>
        <span class="q" data-readout="stretchOuter">
          המתיחה בשלב החיצוני (מדידה):{' '}
          {Number.isNaN(m.outer) ? (
            <>
              <M>Δu = 0</M>, אין מנה
            </>
          ) : (
            <M>
              Δy/Δu = <b>{fmt(m.outer, 5)}</b>
            </M>
          )}
        </span>
        <span class="q" data-readout="stretch">
          המכפלה (מדידה): <M>
            (Δy/Δu)·(Δu/Δx) = Δy/Δx = <b>{fmt(m.total, 5)}</b>
          </M>
        </span>
        <span class="q" data-readout="exact">
          מדויק: <M>
            g′(x) = {sp.dInnerText} = <b>{fmt(ex.inner, 5)}</b>
          </M>
          , <M>
            f′(g(x)) = <b>{fmt(ex.outer, 5)}</b>
          </M>
          , <M>
            dy/dx = f′(g(x))·g′(x) = <b>{fmt(ex.d, 5)}</b>
          </M>
          {ex.zero && <>. הגורם {ex.zero.factor === 'inner' ? <M>g′(x)</M> : <M>f′(g(x))</M>} הוא 0, ולכן הנגזרת 0</>}
        </span>
      </>
    );
  } else {
    const sp = INVERSE[setup.ip];
    const r = inverseSlopes(setup.ip, setup.a);
    label = `איור חי: הגרף של f(x) = ${sp.fText} והגרף של ההפוכה שלה, השיקוף שלו בישר y = x המקווקו. הנקודה A על f והנקודה המשוקפת A′ על ההפוכה, עם המשיקים בשתיהן ועם משולש עלייה והתקדמות על כל משיק: הניצבים מתחלפים, ולכן השיפוע m הופך ל-1/m.${r.vertical ? ' כאן m = 0, והמשיק בנקודה המשוקפת אנכי.' : ''}`;
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>f(x) = {sp.fText}</M>, ההפוכה {sp.id === 'x3px1' ? <M>f⁻¹</M> : <M>f⁻¹(x) = {sp.finvText}</M>}
        </span>
        <span class="q" data-readout="a">
          <M>
            a = <b>{fmtA(setup.ip, setup.a)}</b>
          </M>
        </span>
        <span class="q" data-readout="fa">
          <M>
            f(a) = <b>{fmt(r.fa)}</b>
          </M>
        </span>
        <span class="q" data-readout="m">
          השיפוע ב-A: <M>
            m = f′(a) = <b>{fmt(r.m)}</b>
          </M>
        </span>
        <span class="q" data-readout="minv">
          {r.vertical ? (
            <b>משיק אנכי: ההפוכה אינה גזירה כאן</b>
          ) : (
            <>
              השיפוע ב-A′: <M>
                (f⁻¹)′({fmt(r.fa)}) = 1/m = <b>{fmt(r.minv)}</b>
              </M>
              , <span class="rul-nb">ו-<M>m · (1/m) = 1</M></span>
            </>
          )}
        </span>
      </>
    );
  }

  const presetGroup =
    setup.mode === 'product' ? (
      <div class="group" role="group" aria-label="הזוג">
        {PAIR_IDS.map((id) => (
          <Toggle
            key={id}
            label={
              <bdi dir="ltr">
                {PAIRS[id].uText} · {PAIRS[id].vText}
              </bdi>
            }
            on={setup.pair === id}
            onChange={() => {
              if (cur.current.pair === id) return;
              const px = PAIRS[id].defaultX;
              choose({ pair: id, px, pdx: fixPdx(id, px, cur.current.pdx) });
            }}
          />
        ))}
      </div>
    ) : setup.mode === 'chain' ? (
      <div class="group" role="group" aria-label="הפונקציה">
        {CHAIN_IDS.map((id) => (
          <Toggle
            key={id}
            label={<bdi dir="ltr">{CHAIN[id].text}</bdi>}
            on={setup.cp === id}
            onChange={() => {
              if (cur.current.cp !== id) choose({ cp: id, cx: CHAIN[id].defaultX });
            }}
          />
        ))}
      </div>
    ) : (
      <div class="group" role="group" aria-label="הפונקציה">
        {INV_IDS.map((id) => (
          <Toggle
            key={id}
            label={<bdi dir="ltr">{INVERSE[id].fText}</bdi>}
            on={setup.ip === id}
            onChange={() => {
              if (cur.current.ip !== id) choose({ ip: id, a: INVERSE[id].defaultA });
            }}
          />
        ))}
      </div>
    );

  return (
    <SimShell
      fig={props.id}
      label={label}
      canvasRef={canvasRef}
      aspect={aspect}
      live={live}
      tasks={tasks}
      cursor={setup.mode === 'inverse' ? 'grab' : 'default'}
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
          {presetGroup}
          {setup.mode === 'product' && (
            <>
              <Slider label="הנקודה x" value={setup.px} min={PAIRS[setup.pair].xRange[0]} max={PAIRS[setup.pair].xRange[1]} step={0.05} format={(v) => fmt(v)} onChange={setPx} />
              <Slider label="הצעד Δx" value={setup.pdx} min={DX_MIN} max={dxMax(setup.pair, setup.px)} step={0.01} format={(v) => fmt(v)} onChange={setPdx} />
            </>
          )}
          {setup.mode === 'chain' && (
            <>
              <Slider label="הנקודה x" value={setup.cx} min={CHAIN[setup.cp].xRange[0]} max={CHAIN[setup.cp].xRange[1]} step={0.01} format={() => fmtCx(setup.cp, setup.cx)} onChange={setCx} />
              <Slider label="אורך הקטע Δx" value={roundTo(eOfH(setup.cdx), CE_STEP)} min={0} max={CE_MAX} step={CE_STEP} format={() => fmtH(setup.cdx)} onChange={setCe} />
            </>
          )}
          {setup.mode === 'inverse' && (
            <Slider label="הנקודה a" value={setup.a} min={INVERSE[setup.ip].aRange[0]} max={INVERSE[setup.ip].aRange[1]} step={0.01} format={() => fmtA(setup.ip, setup.a)} onChange={setA} />
          )}
        </>
      }
    />
  );
}
