/**
 * VelocityLab (chapter 9.2 velocity and the tangent, 9.4 enrichment: the tangent-normal frame): three modes on one plane
 * curve r(t) of the registry VC. Maths: src/math/velocity.ts, whose STORED closed forms of r, v = r′ and a = r″ give every
 * vector a readout shows; the secant quotient is a finite difference of the stored r by definition. The canvas is math
 * space: LTR, x to the right, y up, EQUAL scales on both axes (a circle looks round); sliders for math quantities are
 * `dir="ltr"`. Panels: one canvas, so nothing overflows sideways at 390 px.
 * Colour and shape code (never colour alone): the curve = --curve; the point and the position-like marks = ink; the
 * VELOCITY (and the secant quotient, its approximation) = accent, a SOLID shaft with a FILLED head (the quotient: a dashed
 * accent shaft with a filled head); the ACCELERATION (and its parts a_T T, a_N N) = --limit, a DASHED shaft with an OPEN
 * (chevron) head; the tangent line and the osculating circle = accent, thin. Arrow scales are fixed per preset and
 * printed in the readout (data-readout="scale"): the figure never rescales an arrow by itself.
 *
 * mode 'secant' (button "מנת הפרש"): the curve, the point r(t) (filled), the second point r(t + h) (filled, smaller), the
 *     chord Δr (thin ink), the quotient Δr/h drawn from r(t) (dashed accent) and the velocity v(t) (solid accent).
 *     `tangent` draws the line r(t) + s·v(t) across the whole plot (thin accent) and the readout L(s) = … with numbers;
 *     `approx` marks r(t) + h·v(t) (hollow accent ring) next to r(t + h) and shows their distance (a dotted segment).
 *     h by a log slider on |h| (0.001…2) and the buttons "h > 0" / "h < 0". At v = 0 (|v| < 1e-9) the tangent line is not
 *     drawn and the readout says "v = 0: המהירות לא קובעת כיוון". t by the slider, dragging on the canvas (the nearest
 *     parameter on the curve) or ←/→.
 * mode 'motion' (button "תנועה"): the curve, the point, v (solid accent) and, with `accel`, a (dashed --limit, open head);
 *     with `accel` on `circle` a dotted line from the point to the centre (0, 0). Play ("הפעלה" / "עצירה"), the slider,
 *     dragging and ←/→ move t.
 * mode 'frame' (button "משיק ונורמל", 9.4 enrichment): the curve, the point, T and N (unit vectors, ink, labelled "T", "N",
 *     drawn at one fixed screen length), with `split` the acceleration a (dashed --limit) and its parts a_T T and a_N N
 *     (dashed --limit, thinner, labelled) joined to the tip of a by dotted projection lines, with `circle` the osculating
 *     circle (accent, dashed) with its centre and the radius ρ (a dotted line). At v = 0 nothing of the frame is drawn and
 *     the readout says "אין משיק".
 *
 * Props (defaults): id (required); mode ('secant'); modes (the mode buttons shown; default the starting mode only);
 * tasks ([]). f (a VC id: parab, cusp, circle, ellipse, throw, cycloid, spin; 'parab'); t (the preset's t0, clamped to its
 * range, rounded to 0.01); h (0.5, signed, 0.001 ≤ |h| ≤ 2); tangent (false); approx (false); accel (false); split (false);
 * circle (false).
 * Every prop is also a step key (`<Step fig=… set={{…}}>`); a key left out keeps its value; a new f without t puts t at that
 * preset's t0 (the same f keeps t). A step and the reset button stop play. A state set by a step never ticks a task, and a
 * state that already had a task's property when a step or reset made it must be left and found again. The learner can also
 * pick the curve from a select "העקום" (all seven presets). Each curve has the play loop length `seconds` of the registry.
 *
 * Tasks (ticked only inside the learner's own drag, key, slider, select, button, toggle or play):
 *   secant: sc-shrink (|h| ≤ 0.01 at a t where |v| > 0.1: the angle between Δr/h and v below 1°), sc-side (the learner
 *           switches the sign of h), sc-cusp (preset cusp or cycloid, t within 0.02 of a parameter with v = 0)
 *   motion: mo-accel (preset circle with accel on), mo-speed (preset ellipse with accel on, the learner's t has moved a
 *           whole period, 2π, in total since those held; by drag, slider, keys or play)
 *   frame:  fr-split (split on and the learner moves t), fr-top (preset throw with circle on and t within 0.03 of 0.8),
 *           fr-spin (preset spin with split on, the learner's t has moved by 1 in total since those held)
 *
 * Hooks for e2e specs (inside `#<id>`; numbers use U+2212 for minus):
 *   buttons by role and name: the mode buttons "מנת הפרש", "תנועה", "משיק ונורמל"; secant: "h > 0", "h < 0", "המשיק",
 *     "קירוב לינארי"; motion: "וקטור התאוצה"; frame: "פירוק התאוצה", "המעגל הצמוד"; motion and frame, when motion is
 *     allowed (not in still mode): "הפעלה" (starts; loops over the range) and, while playing, "עצירה"; "איפוס" (reset, on
 *     the canvas)
 *   [data-control="preset"] select    the curve "העקום" (option values are the VC ids)
 *   [data-control="h"] input          secant: log10 |h| (−3…log10 2, step 0.01)
 *   [data-control="t"] input          t (the preset's range, step 0.01)
 *   canvas                            drag moves t to the nearest parameter on the curve; ←/→ move t by 0.05
 *   [data-readout=…]                  secant: fn, scale, t, h, quotient, v, angle (not at v = 0), vzero (only at v = 0),
 *                                     tangent (with tangent), approx (with approx)
 *                                     motion: fn, scale, t, r, v, speed, a and a-abs (with accel)
 *                                     frame: fn, scale (with split), t, speed, notangent (only at v = 0), at (aT), an (aN),
 *                                     kappa, rho
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { VC, VC_IDS, V_ZERO, angleBetween, frame as frameOf, isVcId, linearError, secant as secantOf, speed as speedOf, tangentLine, type Vec2, type VcId } from '~/math/velocity';
import { motionAllowed } from '~/progress/settings';
import { markTask } from '~/progress/store';
import { subscribeSteps, type StepState } from '~/ui/steps';
import { useMounted } from '~/ui/useMounted';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { sci } from './core/format';
import { arrow, withAlpha } from './core/ink';
import { drawAxes, makePlot, type Box, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import './VelocityLab.css';

export type VelocityMode = 'secant' | 'motion' | 'frame';

export interface VelocityLabProps {
  id: string;
  mode?: VelocityMode;
  /** the mode buttons shown (default: the starting mode only) */
  modes?: VelocityMode[];
  /** a VC id */
  f?: string;
  t?: number;
  h?: number;
  tangent?: boolean;
  approx?: boolean;
  accel?: boolean;
  split?: boolean;
  circle?: boolean;
  tasks?: string[];
}

interface Setup {
  mode: VelocityMode;
  f: VcId;
  t: number;
  h: number;
  tangent: boolean;
  approx: boolean;
  accel: boolean;
  split: boolean;
  circle: boolean;
}

const ltr = (s: string) => String.fromCharCode(0x2066) + s.replace(/ /g, String.fromCharCode(0xa0)) + String.fromCharCode(0x2069);

const TASK_LABEL: Record<string, string> = {
  'sc-shrink': `הקטינו את ${ltr('|h|')} ל-0.01 לפחות. מה קורה לזווית בין ${ltr('Δr/h')} לבין ${ltr('v')}?`,
  'sc-side': `החליפו את הסימן של ${ltr('h')} (הכפתורים "h > 0" ו-"h < 0"). האם המנה מתקרבת אל ${ltr('v')} משני הצדדים?`,
  'sc-cusp': `בחרו את העקום ${ltr('(t², t³)')} או את הציקלואידה והזיזו את ${ltr('t')} לנקודה שבה ${ltr('v = 0')}. מה אפשר להגיד שם על כיוון המשיק?`,
  'mo-accel': `בחרו את המעגל והדליקו את "וקטור התאוצה". לאן מצביע ${ltr('a')}?`,
  'mo-speed': `בחרו את האליפסה, הדליקו את התאוצה והעבירו את ${ltr('t')} לאורך מחזור שלם (בגרירה או בהפעלה). היכן ${ltr('|v|')} הכי גדול, והיכן ${ltr('|a|')}?`,
  'fr-split': `הדליקו את "פירוק התאוצה" והזיזו את הנקודה הרחק מהקודקוד. איזה חלק של התאוצה גדל ואיזה קטן?`,
  'fr-top': 'בחרו את הזריקה, הדליקו את "המעגל הצמוד" והזיזו את t אל ראש המסלול, הנקודה הגבוהה ביותר.',
  'fr-spin': `בחרו את המעגל המואץ ${ltr('(2cos(t²/2), 2sin(t²/2))')}, הדליקו את הפירוק והזיזו את ${ltr('t')} ביחידה אחת לפחות. איזה רכיב נשאר קבוע?`,
};

const MODE_LABEL: Record<VelocityMode, string> = { secant: 'מנת הפרש', motion: 'תנועה', frame: 'משיק ונורמל' };

const H_MIN = 0.001;
const H_MAX = 2;
const T_STEP = 0.01;
const TAU = 2 * Math.PI;
const CUSP_TOL = 0.02;
const TOP_TOL = 0.03;
const TOP_T = 0.8;
const VEC_LEN = 0.12;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const bool = (x: unknown): boolean | null => (typeof x === 'boolean' ? x : null);
const roundTo = (x: number, step: number) => Number((Math.round(x / step) * step).toPrecision(10));
const minus = (s: string) => s.replace(/-/g, '−');
const fmt = (x: number, sig = 4) => (Number.isNaN(x) ? '—' : Math.abs(x) < 1e-12 ? '0' : minus(sci(x, sig)));
const vec = (u: Vec2, sig = 3) => `(${fmt(u[0], sig)}, ${fmt(u[1], sig)})`;
const len2 = (u: Vec2) => Math.hypot(u[0], u[1]);
const fixT = (id: VcId, t: number) => clamp(roundTo(t, T_STEP), VC[id].range[0], VC[id].range[1]);
/** a signed h with 0.001 ≤ |h| ≤ 2; a 0 or non-number keeps the sign of `fallback` */
const fixH = (h: number, fallback = 0.5) => {
  const sgn = h < 0 || (h === 0 && fallback < 0) ? -1 : 1;
  return sgn * clamp(Number(Math.abs(h || fallback).toPrecision(3)), H_MIN, H_MAX);
};
/** the slider's value: log10 |h| */
const hLog = (h: number) => Math.log10(Math.abs(h));

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
/** a dashed shaft with an OPEN head (two strokes): the acceleration's shape */
function dashArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width = 2.2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L = Math.hypot(dx, dy);
  if (L < 1) return;
  const ux = dx / L;
  const uy = dy / L;
  const head = Math.min(10, L * 0.5);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x2 - ux * head - uy * head * 0.5, y2 - uy * head + ux * head * 0.5);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x2 - ux * head + uy * head * 0.5, y2 - uy * head - ux * head * 0.5);
  ctx.stroke();
  ctx.restore();
}
/** a dashed shaft with a FILLED head: the secant quotient */
function dashFilledArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width = 1.8) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L = Math.hypot(dx, dy);
  if (L < 1) return;
  const ux = dx / L;
  const uy = dy / L;
  const head = Math.min(8, L * 0.5);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - ux * head * 0.8, y2 - uy * head * 0.8);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - ux * head - uy * head * 0.48, y2 - uy * head + ux * head * 0.48);
  ctx.lineTo(x2 - ux * head + uy * head * 0.48, y2 - uy * head - ux * head * 0.48);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** a label with a real subscript, centred at (x, y): base, sub (smaller, lowered), rest; each run with a paper halo */
function subLabel(ctx: CanvasRenderingContext2D, p: Palette, x: number, y: number, base: string, sub: string, rest: string, color: string, size = 14) {
  const fb = `700 ${size}px ${p.fontUi}`;
  const fsub = `700 ${Math.round(size * 0.72)}px ${p.fontUi}`;
  ctx.save();
  ctx.direction = 'ltr';
  ctx.font = fb;
  const wb = ctx.measureText(base).width;
  const wr = ctx.measureText(rest).width;
  ctx.font = fsub;
  const ws = ctx.measureText(sub).width;
  ctx.restore();
  let cx = x - (wb + ws + wr) / 2;
  haloText(ctx, p, base, cx, y, { font: fb, color, align: 'left' });
  cx += wb;
  haloText(ctx, p, sub, cx, y + size * 0.3, { font: fsub, color, align: 'left' });
  cx += ws;
  haloText(ctx, p, rest, cx, y, { font: fb, color, align: 'left' });
}
/** where to put a label for the arrow (x1, y1) to (x2, y2): just beyond its head, offset perpendicular to the arrow, on the
 * side away from the screen point `away` */
function beyondHead(x1: number, y1: number, x2: number, y2: number, away: [number, number]): [number, number] {
  const L = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / L;
  const uy = (y2 - y1) / L;
  const nx = -uy;
  const ny = ux;
  const side = nx * (away[0] - x2) + ny * (away[1] - y2) > 0 ? -1 : 1;
  return [x2 + ux * 14 + nx * side * 11, y2 + uy * 14 + ny * side * 11];
}

interface Rule {
  needs: (keyof Setup)[];
  event?: boolean;
  state: (s: Setup, patch: Partial<Setup>, prev: Setup) => boolean;
}

/** the tasks that count how far the learner moved t while a condition held: the condition, the distance needed */
const TRAVEL: Record<string, { key: 'mo' | 'spin'; cond: (s: Setup) => boolean; need: number }> = {
  'mo-speed': { key: 'mo', cond: (s) => s.mode === 'motion' && s.f === 'ellipse' && s.accel, need: TAU - 0.05 },
  'fr-spin': { key: 'spin', cond: (s) => s.mode === 'frame' && s.f === 'spin' && s.split, need: 1 },
};

export default function VelocityLab(props: VelocityLabProps) {
  const startMode: VelocityMode = props.mode ?? 'secant';
  const modes: VelocityMode[] = props.modes ?? [startMode];
  const initial = (): Setup => {
    const f: VcId = isVcId(props.f) ? props.f : 'parab';
    return {
      mode: startMode,
      f,
      t: fixT(f, props.t ?? VC[f].t0),
      h: fixH(props.h ?? 0.5),
      tangent: props.tangent ?? false,
      approx: props.approx ?? false,
      accel: props.accel ?? false,
      split: props.split ?? false,
      circle: props.circle ?? false,
    };
  };
  const [setup, setSetup] = useState<Setup>(initial);
  const cur = useRef(setup);
  const [live, setLive] = useState('');
  const [narrow, setNarrow] = useState(false);
  const [playing, setPlaying] = useState(false);
  const plots = useRef<Plot[]>([]);
  const dragging = useRef(false);
  const mounted = useMounted();
  /** tasks whose state held when the last step or reset made it: they must be left and found again */
  const held = useRef<Set<string>>(new Set());
  const travel = useRef({ mo: 0, spin: 0 });

  const RULES: Record<string, Rule> = {
    'sc-shrink': {
      needs: ['h', 't', 'f'],
      state: (s) => {
        if (s.mode !== 'secant' || Math.abs(s.h) > 0.01 + 1e-12 || speedOf(s.f, s.t) <= 0.1) return false;
        const ang = angleBetween(secantOf(s.f, s.t, s.h).quotient, VC[s.f].v(s.t));
        return ang !== null && ang < 1;
      },
    },
    'sc-side': { needs: ['h'], event: true, state: (s, p, prev) => s.mode === 'secant' && p.h !== undefined && Math.sign(prev.h) !== Math.sign(s.h) },
    'sc-cusp': {
      needs: ['t', 'f'],
      state: (s) => s.mode === 'secant' && (s.f === 'cusp' || s.f === 'cycloid') && VC[s.f].vZeros.some((z) => Math.abs(s.t - z) <= CUSP_TOL + 1e-9),
    },
    'mo-accel': { needs: ['accel', 'f'], state: (s) => s.mode === 'motion' && s.f === 'circle' && s.accel },
    'mo-speed': { needs: ['t'], event: true, state: (s) => TRAVEL['mo-speed'].cond(s) && travel.current.mo >= TRAVEL['mo-speed'].need },
    'fr-split': { needs: ['t'], event: true, state: (s, p) => s.mode === 'frame' && s.split && p.t !== undefined },
    'fr-top': { needs: ['t', 'circle', 'f'], state: (s) => s.mode === 'frame' && s.f === 'throw' && s.circle && Math.abs(s.t - TOP_T) <= TOP_TOL + 1e-9 },
    'fr-spin': { needs: ['t'], event: true, state: (s) => TRAVEL['fr-spin'].cond(s) && travel.current.spin >= TRAVEL['fr-spin'].need },
  };

  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const done = (t: string) => {
    if (props.tasks?.includes(t)) markTask(`${props.id}:${t}`);
  };
  const rebase = (s: Setup) => {
    travel.current = { mo: 0, spin: 0 };
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
        const mode = typeof st.mode === 'string' && modes.includes(st.mode as VelocityMode) ? (st.mode as VelocityMode) : prev.mode;
        const next: Setup = { ...prev, mode };
        const newF = isVcId(st.f) && st.f !== prev.f;
        if (isVcId(st.f)) next.f = st.f;
        next.t = fixT(next.f, num(st.t) ?? (newF ? VC[next.f].t0 : prev.t));
        const sh = num(st.h);
        if (sh !== null && sh !== 0) next.h = fixH(sh);
        next.tangent = bool(st.tangent) ?? prev.tangent;
        next.approx = bool(st.approx) ?? prev.approx;
        next.accel = bool(st.accel) ?? prev.accel;
        next.split = bool(st.split) ?? prev.split;
        next.circle = bool(st.circle) ?? prev.circle;
        setPlaying(false);
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
    const sp = VC[s0.f];
    const box: Box = { x: 44, y: 8, w: Math.max(1, view.w - 44 - 12), h: Math.max(1, view.h - 8 - 28) };
    const wx = sp.window.x[1] - sp.window.x[0];
    const wy = sp.window.y[1] - sp.window.y[0];
    const sc = Math.min(box.w / wx, box.h / wy);
    const cx = (sp.window.x[0] + sp.window.x[1]) / 2;
    const cy = (sp.window.y[0] + sp.window.y[1]) / 2;
    const pl = makePlot(box, { min: cx - box.w / (2 * sc), max: cx + box.w / (2 * sc) }, { min: cy - box.h / (2 * sc), max: cy + box.h / (2 * sc) });
    plots.current = [pl];
    drawAxes(ctx, pl, p);
    if (pl.y.min < 0 && pl.y.max > 0) line(ctx, box.x, pl.py(0), box.x + box.w, pl.py(0), withAlpha(p.ink2, 0.75), 1.2);
    if (pl.x.min < 0 && pl.x.max > 0) line(ctx, pl.px(0), box.y, pl.px(0), box.y + box.h, withAlpha(p.ink2, 0.75), 1.2);
    haloText(ctx, p, 'x', box.x + box.w - 8, pl.y.min < 0 && pl.y.max > 0 ? pl.py(0) - 9 : box.y + box.h - 9, { font: font(700), color: p.ink2 });
    haloText(ctx, p, 'y', pl.x.min < 0 && pl.x.max > 0 ? pl.px(0) + 9 : box.x + 9, box.y + 9, { font: font(700), color: p.ink2 });

    const P = (u: Vec2): [number, number] => [pl.px(u[0]), pl.py(u[1])];
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();

    // the curve over its range
    ctx.save();
    ctx.strokeStyle = p.curve;
    ctx.lineWidth = 2.6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const N = 500;
    for (let i = 0; i <= N; i++) {
      const [sx, sy] = P(sp.r(sp.range[0] + ((sp.range[1] - sp.range[0]) * i) / N));
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.restore();

    const t = s0.t;
    const r = sp.r(t);
    const v = sp.v(t);
    const a = sp.a(t);
    const [rx, ry] = P(r);
    const tip = (u: Vec2, k: number): [number, number] => P([r[0] + k * u[0], r[1] + k * u[1]]);
    const vTip = tip(v, sp.vScale);
    const moving = len2(v) >= V_ZERO;
    const aTip = tip(a, sp.aScale);

    if (s0.mode === 'secant') {
      const q = secantOf(s0.f, t, s0.h);
      const [qx, qy] = P(q.q);
      if (s0.tangent) {
        const tl = tangentLine(s0.f, t);
        if (tl) {
          const L = (pl.x.max - pl.x.min + pl.y.max - pl.y.min) * 2;
          const d = len2(tl.dir);
          const [x1, y1] = P([tl.point[0] - (L * tl.dir[0]) / d, tl.point[1] - (L * tl.dir[1]) / d]);
          const [x2, y2] = P([tl.point[0] + (L * tl.dir[0]) / d, tl.point[1] + (L * tl.dir[1]) / d]);
          line(ctx, x1, y1, x2, y2, withAlpha(p.accent, 0.8), 1.4);
        }
      }
      line(ctx, rx, ry, qx, qy, p.ink, 1.3);
      const qt = tip(q.quotient, sp.vScale);
      dashFilledArrow(ctx, rx, ry, qt[0], qt[1], p.accent, 1.9);
      if (moving) arrow(ctx, rx, ry, vTip[0], vTip[1], { color: p.accent, width: 2.8, head: 10 });
      if (s0.approx) {
        const ap = P([r[0] + s0.h * v[0], r[1] + s0.h * v[1]]);
        line(ctx, ap[0], ap[1], qx, qy, withAlpha(p.ink, 0.8), 1.4, [2, 3]);
        ring(ctx, ap[0], ap[1], 5, p.accent, p.paper, 2.2);
      }
      dot(ctx, qx, qy, 4.4, p.ink, p.paper);
      haloText(ctx, p, 'r(t+h)', qx + (qx >= rx ? 8 : -8), qy + (qy >= ry ? 13 : -13), { font: font(600, 11), align: qx >= rx ? 'left' : 'right' });
      if (moving) haloText(ctx, p, 'v', vTip[0] + 6, vTip[1] - 9, { font: font(700, 13), color: p.accent });
    } else if (s0.mode === 'motion') {
      if (s0.accel && s0.f === 'circle') {
        const c = P([0, 0]);
        line(ctx, rx, ry, c[0], c[1], withAlpha(p.limit, 0.85), 1.5, [1.5, 4]);
        ring(ctx, c[0], c[1], 3.6, p.limit, p.paper, 1.8);
      }
      if (moving) {
        arrow(ctx, rx, ry, vTip[0], vTip[1], { color: p.accent, width: 2.8, head: 10 });
        haloText(ctx, p, 'v', vTip[0] + 6, vTip[1] - 9, { font: font(700, 13), color: p.accent });
      }
      if (s0.accel) {
        dashArrow(ctx, rx, ry, aTip[0], aTip[1], p.limit, 2.4);
        haloText(ctx, p, 'a', aTip[0] + 6, aTip[1] + 10, { font: font(700, 13), color: p.limit });
      }
    } else {
      const f = frameOf(s0.f, t);
      const unit = VEC_LEN * Math.min(box.w, box.h);
      if (s0.circle && f.centre && f.rho !== null) {
        const [ccx, ccy] = P(f.centre);
        ctx.save();
        ctx.strokeStyle = p.accent;
        ctx.lineWidth = 1.6;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.arc(ccx, ccy, f.rho * sc, 0, TAU);
        ctx.stroke();
        ctx.restore();
        line(ctx, rx, ry, ccx, ccy, withAlpha(p.accent, 0.8), 1.3, [1.5, 4]);
        ring(ctx, ccx, ccy, 4, p.accent, p.paper, 2);
      }
      if (s0.split && f.T) {
        dashArrow(ctx, rx, ry, aTip[0], aTip[1], p.limit, 2.4);
        haloText(ctx, p, 'a', aTip[0] + 6, aTip[1] + 10, { font: font(700, 13), color: p.limit });
        if (f.aT !== null && f.aN !== null) {
          const tT = tip(f.T, sp.aScale * f.aT);
          const tN = f.N ? tip(f.N, sp.aScale * f.aN) : [rx, ry];
          line(ctx, aTip[0], aTip[1], tT[0], tT[1], withAlpha(p.limit, 0.8), 1.2, [1.5, 3]);
          line(ctx, aTip[0], aTip[1], tN[0], tN[1], withAlpha(p.limit, 0.8), 1.2, [1.5, 3]);
          dashArrow(ctx, rx, ry, tT[0], tT[1], p.limit, 1.6);
          if (f.N) dashArrow(ctx, rx, ry, tN[0], tN[1], p.limit, 1.6);
          const lt = beyondHead(rx, ry, tT[0], tT[1], aTip);
          subLabel(ctx, p, lt[0], lt[1], 'a', 'T', ' T', p.limit);
          if (f.N) {
            const ln = beyondHead(rx, ry, tN[0], tN[1], aTip);
            subLabel(ctx, p, ln[0], ln[1], 'a', 'N', ' N', p.limit);
          }
        }
      }
      if (f.T) {
        const hx = rx + unit * f.T[0];
        const hy = ry - unit * f.T[1];
        arrow(ctx, rx, ry, hx, hy, { color: p.ink, width: 2.4, head: 9 });
        const o: [number, number] = f.N ? [rx + unit * f.N[0], ry - unit * f.N[1]] : [rx, ry];
        const lp = beyondHead(rx, ry, hx, hy, o);
        haloText(ctx, p, 'T', lp[0], lp[1], { font: font(700, 14) });
      }
      if (f.N) {
        const hx = rx + unit * f.N[0];
        const hy = ry - unit * f.N[1];
        arrow(ctx, rx, ry, hx, hy, { color: p.ink, width: 2.4, head: 9 });
        const o: [number, number] = f.T ? [rx + unit * f.T[0], ry - unit * f.T[1]] : [rx, ry];
        const lp = beyondHead(rx, ry, hx, hy, o);
        haloText(ctx, p, 'N', lp[0], lp[1], { font: font(700, 14) });
      }
    }
    dot(ctx, rx, ry, 5.6, p.ink, p.paper);
    if (!moving && s0.mode !== 'frame') {
      ring(ctx, rx, ry, 9, p.accent, p.paper, 1.8);
      dot(ctx, rx, ry, 4, p.ink, p.paper);
      haloText(ctx, p, 'v = 0', rx + 14, ry - 12, { font: font(700, 12), color: p.accent, align: 'left' });
    }
    ctx.restore();
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
  const win = VC[setup.f].window;
  const base = (win.x[1] - win.x[0]) / (win.y[1] - win.y[0]);
  const aspect = narrow ? clamp(base, 0.95, 1.5) : clamp(base, 1.2, 2.2);

  /* ---------------------------------------------------------------- learner changes */
  /** The learner changed the figure: apply, then tick whatever the new state completes. `moved` = how far t travelled. */
  const apply = (patch: Partial<Setup>, moved?: number) => {
    const prev = cur.current;
    const next: Setup = { ...prev, ...patch };
    commit(next);
    const dist = moved ?? ('t' in patch && !('f' in patch) ? Math.abs(next.t - prev.t) : 0);
    for (const id of props.tasks ?? []) {
      const tr = TRAVEL[id];
      if (!tr) continue;
      travel.current[tr.key] = tr.cond(next) ? travel.current[tr.key] + dist : 0;
    }
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

  const setT = (v: number) => {
    const c = cur.current;
    const nv = fixT(c.f, v);
    if (nv !== c.t) apply({ t: nv });
  };
  const userT = (v: number) => {
    setPlaying(false);
    setT(v);
  };
  const setH = (h: number) => {
    const nv = fixH(h, cur.current.h);
    if (nv !== cur.current.h) apply({ h: nv });
  };

  /* ---------------------------------------------------------------- play */
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      if (!motionAllowed()) {
        setPlaying(false);
        return;
      }
      const c = cur.current;
      const sp = VC[c.f];
      const [t0, t1] = sp.range;
      const step = (dt * (t1 - t0)) / sp.seconds;
      let t = c.t + step;
      if (t >= t1) t = t0 + (t - t1);
      // t moves on a continuous scale while playing: the slider rounds, the play loop does not
      apply({ t: clamp(t, t0, t1) }, step);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  const play = () => {
    if (!motionAllowed()) {
      setLive('מצב שקט: התנועה לא מוצגת. הזיזו את הפס.');
      return;
    }
    setPlaying(true);
  };

  /** the parameter whose point is nearest to the pointer, on the current curve */
  const nearestT = (e: PointerEvent) => {
    const pl = plots.current[0];
    const sp = VC[cur.current.f];
    if (!pl) return cur.current.t;
    let best = sp.range[0];
    let bd = Infinity;
    const N = 600;
    for (let i = 0; i <= N; i++) {
      const t = sp.range[0] + ((sp.range[1] - sp.range[0]) * i) / N;
      const q = sp.r(t);
      const d = (pl.px(q[0]) - e.offsetX) ** 2 + (pl.py(q[1]) - e.offsetY) ** 2;
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    return best;
  };
  const onPointerDown = (e: PointerEvent) => {
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    userT(nearestT(e));
  };
  const onPointerMove = (e: PointerEvent) => {
    if (dragging.current) userT(nearestT(e));
  };
  const onPointerUp = () => {
    if (dragging.current) setLive(describe(cur.current));
    dragging.current = false;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    userT(cur.current.t + (e.key === 'ArrowLeft' ? -0.05 : 0.05));
    e.preventDefault();
    setLive(describe(cur.current));
  };

  /* ---------------------------------------------------------------- text */
  const M = (q: { children: ComponentChildren }) => <bdi dir="ltr">{q.children}</bdi>;

  function describe(s: Setup): string {
    const sp = VC[s.f];
    if (s.mode === 'secant') {
      const q = secantOf(s.f, s.t, s.h);
      return `t = ${fmt(s.t, 3)}, h = ${fmt(s.h, 3)}: Δr/h = ${vec(q.quotient)}, v = ${vec(sp.v(s.t))}.`;
    }
    if (s.mode === 'motion') return `t = ${fmt(s.t, 3)}: v = ${vec(sp.v(s.t))}, |v| = ${fmt(speedOf(s.f, s.t), 3)}${s.accel ? `, a = ${vec(sp.a(s.t))}` : ''}.`;
    const f = frameOf(s.f, s.t);
    return f.aT === null ? `t = ${fmt(s.t, 3)}: אין משיק, v = 0.` : `t = ${fmt(s.t, 3)}: aT = ${fmt(f.aT, 3)}, aN = ${fmt(f.aN ?? 0, 3)}.`;
  }

  const sp = VC[setup.f];
  const label =
    setup.mode === 'secant'
      ? `איור חי: העקום ${sp.text}, הנקודה r(t) והנקודה r(t+h). הקו הדק הוא המיתר, החץ המקווקו הוא המנה Δr/h, והחץ המלא הוא וקטור המהירות v.${setup.tangent ? ' הקו המשיק עובר דרך הנקודה בכיוון v.' : ''}${setup.approx ? ' הטבעת היא הנקודה r(t) + h·v, הקירוב הלינארי.' : ''}`
      : setup.mode === 'motion'
        ? `איור חי: הנקודה נעה לאורך העקום ${sp.text}. החץ המלא הוא וקטור המהירות v${setup.accel ? ', והחץ המקווקו עם הראש הפתוח הוא וקטור התאוצה a' : ''}.`
        : `איור חי: העקום ${sp.text} ובנקודה וקטור היחידה המשיק T ווקטור היחידה הנורמלי N${setup.split ? ', והתאוצה a מפורקת לרכיב משיקי ולרכיב נורמלי' : ''}${setup.circle ? '. המעגל המקווקו הוא המעגל הצמוד' : ''}.`;

  const v = sp.v(setup.t);
  const a = sp.a(setup.t);
  const spd = len2(v);
  const scaleText = (k: number) => fmt(k, 2);
  let readout: ComponentChildren;
  if (setup.mode === 'secant') {
    const q = secantOf(setup.f, setup.t, setup.h);
    const ang = angleBetween(q.quotient, v);
    const vz = spd < V_ZERO;
    const tl = tangentLine(setup.f, setup.t);
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>r(t) = {sp.text}</M>
        </span>
        <span class="rtl-row" data-readout="scale">
          חץ המהירות בקנה מידה: יחידת מהירות אחת מצוירת באורך <M>{scaleText(sp.vScale)}</M> יחידות
        </span>
        <span class="q" data-readout="t">
          <M>
            t = <b>{fmt(setup.t, 3)}</b>
          </M>
        </span>
        <span class="q" data-readout="h">
          <M>
            h = <b>{fmt(setup.h, 3)}</b>
          </M>
        </span>
        <span class="q" data-readout="quotient">
          <M>
            Δr/h = (r(t+h) − r(t))/h = <b>{vec(q.quotient)}</b>
          </M>
        </span>
        <span class="q" data-readout="v">
          <M>
            v(t) = <b>{vec(v)}</b>
          </M>
        </span>
        {vz ? (
          <span class="rtl-row" data-readout="vzero">
            <b>
              <M>v = 0</M>: המהירות לא קובעת כיוון
            </b>
          </span>
        ) : (
          <span class="rtl-row" data-readout="angle">
            הזווית בין <M>Δr/h</M> לבין <M>v</M>: <M>{ang === null ? '—' : <b>{fmt(ang, 3)}°</b>}</M>
          </span>
        )}
        {setup.tangent && (
          <span class="rtl-row" data-readout="tangent">
            {tl ? (
              <M>
                L(s) = r(t) + s·v(t) = {vec(tl.point)} + s·{vec(tl.dir)}
              </M>
            ) : (
              <>
                <M>v = 0</M>: אין משוואת משיק מ-<M>v</M>
              </>
            )}
          </span>
        )}
        {setup.approx && (
          <>
            <span class="q" data-readout="approx-point">
              <M>
                r(t) + h·v(t) = <b>{vec([q.p[0] + setup.h * v[0], q.p[1] + setup.h * v[1]])}</b>
              </M>
            </span>
            <span class="rtl-row" data-readout="approx">
              המרחק מהנקודה{' '}
              <bdi dir="ltr">r(t+h)</bdi>: <bdi dir="ltr"><b>{fmt(linearError(setup.f, setup.t, setup.h), 3)}</b></bdi>
            </span>
          </>
        )}
      </>
    );
  } else if (setup.mode === 'motion') {
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>r(t) = {sp.text}</M>
        </span>
        <span class="rtl-row" data-readout="scale">
          חץ המהירות בקנה מידה: יחידת מהירות אחת מצוירת באורך <M>{scaleText(sp.vScale)}</M> יחידות
          {setup.accel && (
            <>
              ; חץ התאוצה: יחידת תאוצה אחת באורך <M>{scaleText(sp.aScale)}</M>
            </>
          )}
        </span>
        <span class="q" data-readout="t">
          <M>
            t = <b>{fmt(setup.t, 3)}</b>
          </M>
        </span>
        <span class="q" data-readout="r">
          <M>
            r = <b>{vec(sp.r(setup.t))}</b>
          </M>
        </span>
        <span class="q" data-readout="v">
          <M>
            v = <b>{vec(v)}</b>
          </M>
        </span>
        <span class="q" data-readout="speed">
          <M>
            |v| = <b>{fmt(spd, 3)}</b>
          </M>
        </span>
        {setup.accel && (
          <>
            <span class="q" data-readout="a">
              <M>
                a = <b>{vec(a)}</b>
              </M>
            </span>
            <span class="q" data-readout="a-abs">
              <M>
                |a| = <b>{fmt(len2(a), 3)}</b>
              </M>
            </span>
          </>
        )}
      </>
    );
  } else {
    const f = frameOf(setup.f, setup.t);
    const vz = f.aT === null;
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>r(t) = {sp.text}</M>
        </span>
        {setup.split && (
          <span class="rtl-row" data-readout="scale">
            חץ התאוצה בקנה מידה: יחידת תאוצה אחת מצוירת באורך <M>{scaleText(sp.aScale)}</M> יחידות; T ו-N הם וקטורי יחידה בגודל קבוע
          </span>
        )}
        <span class="q" data-readout="t">
          <M>
            t = <b>{fmt(setup.t, 3)}</b>
          </M>
        </span>
        <span class="q" data-readout="speed">
          <M>
            |v| = <b>{fmt(spd, 3)}</b>
          </M>
        </span>
        {vz && (
          <span class="rtl-row" data-readout="notangent">
            <b>אין משיק</b>: <M>v = 0</M>, ולכן אין <M>T</M> ואין <M>N</M>
          </span>
        )}
        <span class="q" data-readout="at">
          <M>
            a<sub>T</sub> = <b>{vz ? '—' : fmt(f.aT ?? 0, 3)}</b>
          </M>
        </span>
        <span class="q" data-readout="an">
          <M>
            a<sub>N</sub> = <b>{vz ? '—' : fmt(f.aN ?? 0, 3)}</b>
          </M>
        </span>
        <span class="q" data-readout="kappa">
          <M>
            κ = <b>{vz ? '—' : fmt(f.kappa ?? 0, 3)}</b>
          </M>
        </span>
        <span class="q" data-readout="rho">
          <M>
            ρ = <b>{vz ? '—' : f.rho === null ? '∞' : fmt(f.rho, 3)}</b>
          </M>
        </span>
      </>
    );
  }

  const showPlay = mounted && setup.mode !== 'secant' && motionAllowed();

  return (
    <SimShell
      fig={props.id}
      label={label}
      canvasRef={canvasRef}
      aspect={aspect}
      live={live}
      tasks={tasks}
      cursor="pointer"
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onReset={() => {
        const init = initial();
        setPlaying(false);
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
                    setPlaying(false);
                    apply({ mode: m });
                  }}
                />
              ))}
            </div>
          )}
          <label class="vl-select" data-control="preset">
            <span class="vl-lab">העקום</span>
            <select
              dir="ltr"
              value={setup.f}
              onChange={(e) => {
                const id = (e.target as HTMLSelectElement).value;
                if (isVcId(id) && id !== cur.current.f) {
                  setPlaying(false);
                  apply({ f: id, t: VC[id].t0 });
                  setLive(describe(cur.current));
                }
              }}
            >
              {VC_IDS.map((id) => (
                <option key={id} value={id}>
                  {`r(t) = ${VC[id].text}`}
                </option>
              ))}
            </select>
          </label>
          {setup.mode === 'secant' && (
            <>
              <div class="group" role="group" aria-label="כיוון ההפרש">
                <Toggle label={<bdi dir="ltr">h &gt; 0</bdi>} on={setup.h > 0} onChange={() => setup.h < 0 && setH(-setup.h)} />
                <Toggle label={<bdi dir="ltr">h &lt; 0</bdi>} on={setup.h < 0} onChange={() => setup.h > 0 && setH(-setup.h)} />
                <Toggle label="המשיק" on={setup.tangent} swatch="var(--accent)" onChange={(on) => apply({ tangent: on })} />
                <Toggle label="קירוב לינארי" on={setup.approx} swatch="var(--accent)" onChange={(on) => apply({ approx: on })} />
              </div>
              <div class="vl-ctl" data-control="h">
                <Slider
                  label="גודל |h|"
                  value={hLog(setup.h)}
                  min={-3}
                  max={Math.log10(H_MAX)}
                  step={0.01}
                  format={() => fmt(Math.abs(setup.h), 3)}
                  onChange={(u) => setH(Math.sign(setup.h) * 10 ** u)}
                />
              </div>
            </>
          )}
          {setup.mode === 'motion' && (
            <div class="group" role="group" aria-label="שכבות">
              <Toggle label="וקטור התאוצה" on={setup.accel} swatch="var(--limit)" onChange={(on) => apply({ accel: on })} />
            </div>
          )}
          {setup.mode === 'frame' && (
            <div class="group" role="group" aria-label="שכבות">
              <Toggle label="פירוק התאוצה" on={setup.split} swatch="var(--limit)" onChange={(on) => apply({ split: on })} />
              <Toggle label="המעגל הצמוד" on={setup.circle} swatch="var(--accent)" onChange={(on) => apply({ circle: on })} />
            </div>
          )}
          <div class="vl-ctl" data-control="t">
            <Slider label="הפרמטר t" value={setup.t} min={sp.range[0]} max={sp.range[1]} step={T_STEP} format={(x) => fmt(x, 3)} onChange={userT} />
          </div>
          {showPlay && (
            <div class="group" role="group" aria-label="הפעלה">
              <button type="button" class="btn primary" onClick={play}>
                הפעלה
              </button>
              {playing && (
                <button type="button" class="btn" onClick={() => setPlaying(false)}>
                  עצירה
                </button>
              )}
            </div>
          )}
        </>
      }
    />
  );
}
