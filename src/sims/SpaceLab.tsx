/**
 * Chapter 1's space figure: vectors, planes and boxes in ℝ³ on a 2D canvas, in an axonometric (orthographic)
 * projection (src/sims/core/axo.ts). Right-handed axes x, y, z (z up) with ticks at the integers and a faint floor
 * grid at z = 0; the view turns with two sliders, by dragging the canvas background, or with the arrow keys. Every
 * point has a dotted drop line to the xy-plane ending in a hollow footprint, so its 3D position reads in a still
 * picture. All vectors and points have INTEGER components set by steppers (−4…4), so every number in the readout is one
 * a student can recompute by hand. Three modes:
 *
 * 'plane' (lesson 1.3): the point P₀ and the normal n at P₀ (accent, double head); the plane through P₀ perpendicular
 *   to n, a translucent square of half-side 3 around P₀ (cool tint); optionally (showLine) the line through A with
 *   direction v (hand colour, open head; the part behind the plane dashed and lighter), the intersection X (filled
 *   dot with a ring) and, optionally (showPoint), a free point Q with its perpendicular to the plane (dashed accent,
 *   right-angle mark, hollow foot). In this mode `a` is the line's point A.
 * 'cross' (lesson 1.4): a (green) and b (purple) from the origin, the parallelogram they span (cool tint, the far
 *   sides dashed), and the product a×b, or b×a with `swap` (accent, double head), with right-angle marks at the
 *   origin showing it is perpendicular to both. A product longer than 5 is drawn shortened and says so.
 * 'box' (lesson 1.5): a, b, c from the origin and the parallelepiped they span: 12 edges, the hidden ones dashed
 *   (an edge is hidden when both faces at it face away from the viewer); the base parallelogram on a, b tinted; with
 *   showNormal the normal a×b (accent) and the height of c above the base (dashed perpendicular from c's tip).
 *
 * The readout is exact (fractions, k√m); a text step sets state through the step bus and never ticks a task: tasks
 * tick only from the reader's own change of a vector the task depends on since the last step or reset.
 */

import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  det3,
  fmtDecimal,
  fmtFrac,
  fmtInt,
  fmtAffine,
  fmtPlaneEquation,
  fmtQuotSqrt,
  fmtSqrt,
  footOnPlane,
  footOnPlaneExact,
  intersectLinePlaneExact,
  isZero3,
  minorsFirstRow,
  nonzeroComponents,
  onAxis,
  orientation,
  parallel3,
  planeFromPointNormal,
  planeResidual,
  tripleProduct,
  type Plane,
  type Vec3,
} from '~/math/space';
import { cross3, dot3, len3, norm3, sub3, add3, scale3 } from '~/math/vec';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { camera, clipLineToBall, makeProjector, orthoBasis, viewRadius } from './core/axo';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { arrow, chevron, withAlpha } from './core/ink';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import './SpaceLab.css';

export type SpaceMode = 'plane' | 'cross' | 'box';
type VKey = 'p0' | 'n' | 'a' | 'v' | 'q' | 'b' | 'c';
const VKEYS: VKey[] = ['p0', 'n', 'a', 'v', 'q', 'b', 'c'];
const LIM = 4;
/** the axes' half-length */
const AXL = 4.8;
const COMP = ['x', 'y', 'z'] as const;

interface State {
  p0: Vec3;
  n: Vec3;
  a: Vec3;
  v: Vec3;
  q: Vec3;
  b: Vec3;
  c: Vec3;
  showLine: boolean;
  showPoint: boolean;
  showNormal: boolean;
  swap: boolean;
  az: number;
  el: number;
}

export interface SpaceLabProps {
  id: string;
  /** 'plane' | 'cross' | 'box' (default 'plane') */
  mode?: SpaceMode;
  /** plane: the point P₀ (default [1, 1, 1]) and the normal n (default [1, 2, 2]) */
  p0?: Vec3;
  n?: Vec3;
  /** plane: the line's point A (default [-1, 0, 2]); cross and box: the vector a (defaults [2, 1, 0] and [2, 0, 1]) */
  a?: Vec3;
  /** plane: the line's direction v (default [1, 1, -1]) */
  v?: Vec3;
  /** plane: the free point Q (default [3, 2, 2]) */
  q?: Vec3;
  /** cross and box: the vector b (defaults [0, 2, 1] and [1, 2, 0]) */
  b?: Vec3;
  /** box: the vector c (default [0, 1, 2]) */
  c?: Vec3;
  /** plane: show the line (default false) / the point Q (default false) */
  showLine?: boolean;
  showPoint?: boolean;
  /** box: show a×b and the height of c above the base (default false) */
  showNormal?: boolean;
  /** cross: show b×a instead of a×b (default false) */
  swap?: boolean;
  /** the view in degrees: azimuth (default 125) and elevation (default 22, range 0…85) */
  az?: number;
  el?: number;
  tasks?: string[];
}

const DEFAULTS: Record<SpaceMode, Partial<Record<VKey, Vec3>>> = {
  plane: { p0: [1, 1, 1], n: [1, 2, 2], a: [-1, 0, 2], v: [1, 1, -1], q: [3, 2, 2] },
  cross: { a: [2, 1, 0], b: [0, 2, 1] },
  box: { a: [2, 0, 1], b: [1, 2, 0], c: [0, 1, 2] },
};

const isVec3 = (x: unknown): x is Vec3 => Array.isArray(x) && x.length === 3 && x.every((k) => typeof k === 'number' && Number.isFinite(k));
const clampEl = (e: number) => Math.min(85, Math.max(0, e));
const wrapAz = (a: number) => ((a % 360) + 360) % 360;

function fresh(p: SpaceLabProps): State {
  const mode = p.mode ?? 'plane';
  const d = DEFAULTS[mode];
  const pick = (k: VKey): Vec3 => (isVec3(p[k]) ? (p[k] as Vec3) : (d[k] ?? [0, 0, 0]));
  return {
    p0: pick('p0'),
    n: pick('n'),
    a: pick('a'),
    v: pick('v'),
    q: pick('q'),
    b: pick('b'),
    c: pick('c'),
    showLine: p.showLine ?? false,
    showPoint: p.showPoint ?? false,
    showNormal: p.showNormal ?? false,
    swap: p.swap ?? false,
    az: typeof p.az === 'number' ? wrapAz(p.az) : 125,
    el: typeof p.el === 'number' ? clampEl(p.el) : 22,
  };
}

/** a left-to-right island inside Hebrew text (U+2066 … U+2069), with no-break spaces so it never wraps */
const ltr = (s: string) => `⁦${s.replace(/ /g, ' ')}⁩`;

const TASK_LABEL: Record<string, string> = {
  'plane-through-origin': `שנו את ${ltr('P₀')} או את ${ltr('n')} כך שהמישור יעבור דרך הראשית (${ltr('d = 0')}). מה קרה למשוואה?`,
  'line-parallel': `הציבו ${ltr('v')} כך שהישר יהיה מקביל למישור ולא מוכל בו (${ltr('v·n = 0')}). מה קורה לנקודת החיתוך?`,
  'line-perpendicular': `הציבו ${ltr('v')} כך שהישר יהיה מאונך למישור: ${ltr('v')} בכיוון של ${ltr('n')}.`,
  'point-on-plane': `הזיזו את ${ltr('Q')} אל המישור, לנקודה שונה מ-${ltr('P₀')}. מה הערך של ${ltr('ax + by + cz − d')} בה?`,
  'distance-3': `מצאו מצב שבו המרחק של ${ltr('Q')} מהמישור הוא בדיוק 3.`,
  'cross-zero': `מצאו שני וקטורים שונים מאפס, ${ltr('a')} ו-${ltr('b')}, שהמכפלה הווקטורית שלהם היא וקטור האפס. מה משותף להם?`,
  'cross-swap': `הפכו את סדר הגורמים: ${ltr('b×a')} במקום ${ltr('a×b')}. מה קרה לחץ?`,
  'cross-k': `סדרו את ${ltr('a')} ו-${ltr('b')} כך שהמכפלה תצביע בכיוון החיובי של ציר z. אף אחד מהם לא על ציר.`,
  'area-6': `מצאו ${ltr('a')} ו-${ltr('b')} שאינם מאונכים זה לזה, ושטח המקבילית שלהם בדיוק 6.`,
  'box-flat': `סדרו שלושה וקטורים שונים מאפס, שאינם מקבילים זה לזה, כך שיהיו באותו מישור. מה קורה לנפח?`,
  'box-negative': `סדרו את הווקטורים כך שהדטרמיננטה תהיה שלילית. איזו שלשה זו?`,
  'box-swap': `לחצו על "החליפו את a ו-b" ובדקו מה קרה לסימן.`,
  'box-volume-6': `מצאו שלושה וקטורים, אף אחד מהם לא על ציר, שנפח המקבילון שלהם בדיוק 6.`,
};

/** which vectors a task depends on: the reader must have changed one of them since the last step */
const TASK_KEYS: Record<string, VKey[]> = {
  'plane-through-origin': ['p0', 'n'],
  'line-parallel': ['v', 'n', 'a', 'p0'],
  'line-perpendicular': ['v', 'n'],
  'point-on-plane': ['q', 'p0', 'n'],
  'distance-3': ['q', 'p0', 'n'],
  'cross-zero': ['a', 'b'],
  'cross-k': ['a', 'b'],
  'area-6': ['a', 'b'],
  'box-flat': ['a', 'b', 'c'],
  'box-negative': ['a', 'b', 'c'],
  'box-volume-6': ['a', 'b', 'c'],
};

interface Ctx {
  /** the reader changed a vector in `keys` since the last step or reset */
  touched: Set<VKey>;
  /** the reader toggled the order / swapped a and b since the last step or reset */
  swapped: boolean;
  /** the state set by the last step or reset */
  baseline: State;
}

const planeOf = (s: State): Plane => planeFromPointNormal(s.p0, s.n);
const crossShown = (s: State): Vec3 => (s.swap ? cross3(s.b, s.a) : cross3(s.a, s.b));

/** tasks that ask for a state with a property: a state a text step (or the reset) left already having it does not count */
const VALUE_TASKS = ['line-parallel', 'line-perpendicular', 'point-on-plane', 'distance-3', 'cross-zero', 'cross-k', 'area-6', 'box-flat', 'box-negative', 'box-volume-6'];

/** whether a state completes a task (only ever asked after the reader's own change) */
function taskDone(task: string, s: State, cx: Ctx): boolean {
  if (!taskHolds(task, s, cx)) return false;
  // the step's state already had the property: the reader must leave it and find it again (a swap of rows is not finding it)
  if (VALUE_TASKS.includes(task) && taskHolds(task, cx.baseline, { ...cx, touched: new Set(VKEYS) })) {
    return !sameVectors(s, cx.baseline) && !sameVectors(s, { ...cx.baseline, a: cx.baseline.b, b: cx.baseline.a });
  }
  return true;
}

const sameVectors = (x: State, y: State): boolean => VKEYS.every((k) => x[k][0] === y[k][0] && x[k][1] === y[k][1] && x[k][2] === y[k][2]);

function taskHolds(task: string, s: State, cx: Ctx): boolean {
  const keys = TASK_KEYS[task];
  if (keys && !keys.some((k) => cx.touched.has(k))) return false;
  const pl = planeOf(s);
  const nz = !isZero3(s.n);
  switch (task) {
    case 'plane-through-origin':
      return nz && pl.d === 0 && planeOf(cx.baseline).d !== 0;
    case 'line-parallel':
      return s.showLine && nz && !isZero3(s.v) && dot3(s.n, s.v) === 0 && planeResidual(pl, s.a) !== 0;
    case 'line-perpendicular':
      return s.showLine && nz && !isZero3(s.v) && parallel3(s.n, s.v);
    case 'point-on-plane':
      return s.showPoint && nz && planeResidual(pl, s.q) === 0 && (s.q[0] !== s.p0[0] || s.q[1] !== s.p0[1] || s.q[2] !== s.p0[2]);
    case 'distance-3': {
      const r = planeResidual(pl, s.q);
      return s.showPoint && nz && r * r === 9 * dot3(s.n, s.n);
    }
    case 'cross-zero':
      return !isZero3(s.a) && !isZero3(s.b) && parallel3(s.a, s.b);
    case 'cross-swap':
      return cx.swapped && s.swap && !isZero3(cross3(s.a, s.b));
    case 'cross-k': {
      const p = crossShown(s);
      return p[0] === 0 && p[1] === 0 && p[2] > 0 && nonzeroComponents(s.a) >= 2 && nonzeroComponents(s.b) >= 2;
    }
    case 'area-6': {
      const p = cross3(s.a, s.b);
      return dot3(p, p) === 36 && dot3(s.a, s.b) !== 0;
    }
    case 'box-flat':
      return (
        !isZero3(s.a) && !isZero3(s.b) && !isZero3(s.c) && !parallel3(s.a, s.b) && !parallel3(s.a, s.c) && !parallel3(s.b, s.c) && tripleProduct(s.a, s.b, s.c) === 0
      );
    case 'box-negative':
      return tripleProduct(s.a, s.b, s.c) < 0;
    case 'box-swap':
      return cx.swapped && tripleProduct(s.a, s.b, s.c) !== 0;
    case 'box-volume-6':
      return Math.abs(tripleProduct(s.a, s.b, s.c)) === 6 && !onAxis(s.a) && !onAxis(s.b) && !onAxis(s.c) && nonzeroComponents(s.a) > 0 && nonzeroComponents(s.b) > 0 && nonzeroComponents(s.c) > 0;
    default:
      return false;
  }
}

/* ---------- text helpers (readout is LTR math inside Hebrew rows) ---------- */

const t = (x: number) => (x < 0 ? `(${fmtInt(x)})` : fmtInt(x));
const vecTxt = (v: Vec3) => `(${v.map(fmtInt).join(', ')})`;
const prodTxt = (u: Vec3, w: Vec3) => `${t(u[0])}·${t(w[0])} + ${t(u[1])}·${t(w[1])} + ${t(u[2])}·${t(w[2])}`;
/** a vector's name in the readout (plain letter: the combining arrow U+20D7 is missing from the UI font) */
const vn = (x: string) => x;
const sqrtLen = (N: number) => `${fmtSqrt(N)}${Number.isInteger(Math.sqrt(N)) ? '' : ` ≈ ${fmtDecimal(Math.sqrt(N))}`}`;

function Row(p: { id: string; label?: string; strong?: boolean; children: ComponentChildren }) {
  return (
    <div class={`sl-row${p.strong ? ' strong' : ''}`} data-readout={p.id}>
      {p.label && <span class="sl-lab">{p.label}</span>}
      <span class="q sl-math">{p.children}</span>
    </div>
  );
}

/* ---------- canvas ---------- */

type Pt = [number, number];

function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, p: Palette, vec: boolean) {
  ctx.save();
  ctx.font = `italic 700 15px ${p.fontUi}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4;
  ctx.strokeStyle = withAlpha(p.paper, 0.85);
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  if (vec) {
    const w = ctx.measureText(text).width;
    const ay = y - 11;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, ay);
    ctx.lineTo(x + w / 2, ay);
    ctx.moveTo(x + w / 2 - 3.5, ay - 2.5);
    ctx.lineTo(x + w / 2, ay);
    ctx.lineTo(x + w / 2 - 3.5, ay + 2.5);
    ctx.stroke();
  }
  ctx.restore();
}

/** a label beyond `tip`, pushed away from `tail` on the screen so it clears the arrowhead */
function tipLabel(ctx: CanvasRenderingContext2D, text: string, tail: Pt, tip: Pt, color: string, p: Palette, vec: boolean, off = 15) {
  let dx = tip[0] - tail[0];
  let dy = tip[1] - tail[1];
  const L = Math.hypot(dx, dy);
  if (L < 1) {
    dx = 0;
    dy = -1;
  } else {
    dx /= L;
    dy /= L;
  }
  drawLabel(ctx, text, tip[0] + dx * off, tip[1] + dy * off + (vec ? -2 : 0), color, p, vec);
}

type ArrowKind = 'solid' | 'double' | 'open';

function vecArrow(ctx: CanvasRenderingContext2D, from: Pt, to: Pt, color: string, kind: ArrowKind, width = 3) {
  const L = Math.hypot(to[0] - from[0], to[1] - from[1]);
  if (L < 1) return;
  const ux = (to[0] - from[0]) / L;
  const uy = (to[1] - from[1]) / L;
  if (kind === 'open') {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(from[0], from[1]);
    ctx.lineTo(to[0], to[1]);
    ctx.stroke();
    ctx.restore();
    chevron(ctx, to[0], to[1], ux, uy, Math.min(12, L * 0.5), color);
    return;
  }
  const head = kind === 'double' ? 14 : 12;
  arrow(ctx, from[0], from[1], to[0], to[1], { color, width: kind === 'double' ? width + 1.2 : width, head });
  if (kind === 'double' && L > head * 2.2) chevron(ctx, to[0] - ux * head * 1.15, to[1] - uy * head * 1.15, ux, uy, head * 0.7, color);
}

function dot(ctx: CanvasRenderingContext2D, [x, y]: Pt, r: number, fill: string | null, stroke: string, p: Palette, width = 2) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill ?? p.paper;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}

function seg(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, color: string, width: number, dash: number[] = [], alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.setLineDash(dash);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
  ctx.restore();
}

function poly(ctx: CanvasRenderingContext2D, pts: Pt[], fill: string | null, stroke: string | null, width = 1.4, dash: number[] = []) {
  ctx.save();
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.setLineDash(dash);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  ctx.restore();
}

export default function SpaceLab(props: SpaceLabProps) {
  const mode: SpaceMode = props.mode ?? 'plane';
  const [s, setS] = useState<State>(() => fresh(props));
  const cur = useRef(s);
  cur.current = s;
  const drag = useRef<{ x: number; y: number } | null>(null);
  const ctxRef = useRef<Ctx>({ touched: new Set(), swapped: false, baseline: s });
  const [live, setLive] = useState('');
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));

  const apply = (patch: Partial<State>): State => {
    const next = { ...cur.current, ...patch };
    cur.current = next;
    setS(next);
    return next;
  };

  /** the reader's own change of vectors / toggles: the only place a task can tick */
  const userSet = (patch: Partial<State>, opts: { swapped?: boolean } = {}) => {
    const cx = ctxRef.current;
    for (const k of Object.keys(patch) as (keyof State)[]) if ((VKEYS as string[]).includes(k)) cx.touched.add(k as VKey);
    if ('showLine' in patch) {
      cx.touched.add('v');
      cx.touched.add('a');
    }
    if ('showPoint' in patch) cx.touched.add('q');
    if (opts.swapped) cx.swapped = true;
    const next = apply(patch);
    for (const task of props.tasks ?? []) if (taskDone(task, next, cx)) markTask(`${props.id}:${task}`);
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        const patch: Partial<State> = {};
        for (const k of VKEYS) if (isVec3(st[k])) patch[k] = st[k] as Vec3;
        for (const k of ['showLine', 'showPoint', 'showNormal', 'swap'] as const) if (typeof st[k] === 'boolean') patch[k] = st[k] as boolean;
        if (typeof st.az === 'number') patch.az = wrapAz(st.az);
        if (typeof st.el === 'number') patch.el = clampEl(st.el);
        const next = apply(patch);
        // a state a text step produced never ticks a task: forget the reader's moves and re-base
        ctxRef.current = { touched: new Set(), swapped: false, baseline: next };
      }),
    [props.id],
  );

  /* ---------- derived quantities ---------- */
  const pl = planeOf(s);
  const hasPlane = !isZero3(s.n);
  const lineOk = s.showLine && !isZero3(s.v);

  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    const cam = camera(s.az, s.el);
    const nrm = crossShown(s);
    const SHORT = 5;
    const shorten = (v: Vec3): [Vec3, boolean] => {
      const l = len3(v);
      return l > SHORT ? [scale3(v, SHORT / l), true] : [v, false];
    };

    // the ball the picture must contain
    const pts: Vec3[] = [];
    if (mode === 'plane') {
      pts.push(s.p0, add3(s.p0, s.n));
      if (s.showLine) pts.push(s.a, add3(s.a, s.v));
      if (s.showPoint) pts.push(s.q);
    } else if (mode === 'cross') {
      pts.push(s.a, s.b, add3(s.a, s.b), shorten(nrm)[0]);
    } else {
      for (const i of [0, 1]) for (const j of [0, 1]) for (const k of [0, 1]) pts.push(add3(add3(scale3(s.a, i), scale3(s.b, j)), scale3(s.c, k)));
      if (s.showNormal) pts.push(shorten(cross3(s.a, s.b))[0]);
    }
    const R = viewRadius(pts, 5.3, 9);
    const scale = (Math.min(view.w, view.h) * 0.5 * 0.93) / R;
    const P = makeProjector(cam, { cx: view.w / 2, cy: view.h / 2 + 6, scale });
    const px = (v: Vec3): Pt => {
      const q = P(v);
      return [q[0], q[1]];
    };
    const O = px([0, 0, 0]);

    // ---- floor grid z = 0
    ctx.save();
    ctx.strokeStyle = p.rule;
    ctx.lineWidth = 1;
    for (let i = -LIM; i <= LIM; i++) {
      const a1 = px([i, -LIM, 0]);
      const a2 = px([i, LIM, 0]);
      const b1 = px([-LIM, i, 0]);
      const b2 = px([LIM, i, 0]);
      ctx.beginPath();
      ctx.moveTo(a1[0], a1[1]);
      ctx.lineTo(a2[0], a2[1]);
      ctx.moveTo(b1[0], b1[1]);
      ctx.lineTo(b2[0], b2[1]);
      ctx.stroke();
    }
    ctx.restore();

    // ---- axes with ticks and names
    const AX: Vec3[] = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    for (let m = 0; m < 3; m++) {
      const e = AX[m];
      const neg = px(scale3(e, -AXL));
      const end = px(scale3(e, AXL));
      seg(ctx, neg, O, p.ink3, 1.3, [5, 4], 0.8);
      arrow(ctx, O[0], O[1], end[0], end[1], { color: p.ink3, width: 1.6, head: 9 });
      // ticks at the integers, perpendicular to the axis on the screen
      const dx = end[0] - O[0];
      const dy = end[1] - O[1];
      const L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L;
      const ny = dx / L;
      ctx.save();
      ctx.strokeStyle = p.ink3;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = -4; i <= 4; i++) {
        if (i === 0) continue;
        const c = px(scale3(e, i));
        ctx.moveTo(c[0] - nx * 3.2, c[1] - ny * 3.2);
        ctx.lineTo(c[0] + nx * 3.2, c[1] + ny * 3.2);
      }
      ctx.stroke();
      ctx.restore();
      const lab = px(scale3(e, AXL + 0.45));
      ctx.save();
      ctx.font = `italic 600 15px ${p.fontUi}`;
      ctx.fillStyle = p.ink2;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(COMP[m], lab[0], lab[1]);
      ctx.restore();
    }

    // a dotted drop line to the xy-plane with a hollow footprint
    const drop = (v: Vec3, color: string) => {
      if (v[2] === 0) return;
      const a = px(v);
      const f = px([v[0], v[1], 0]);
      seg(ctx, a, f, p.ink3, 1.2, [2, 4], 0.9);
      dot(ctx, f, 2.6, null, color, p, 1.3);
    };

    const rightAngle = (at: Vec3, u: Vec3, w: Vec3, size: number, color: string) => {
      const uu = norm3(u);
      const ww = norm3(w);
      const a = px(add3(at, scale3(uu, size)));
      const b = px(add3(at, scale3(add3(uu, ww), size)));
      const c = px(add3(at, scale3(ww, size)));
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(c[0], c[1]);
      ctx.stroke();
      ctx.restore();
    };

    const tint = withAlpha(p.delta, 0.2);
    const tintEdge = withAlpha(p.delta, 0.85);

    /* ============================ plane ============================ */
    if (mode === 'plane') {
      const [e1, e2] = hasPlane ? orthoBasis(s.n) : [[1, 0, 0] as Vec3, [0, 1, 0] as Vec3];
      const H = 2.6;
      const corner = (i: number, j: number): Vec3 => add3(s.p0, add3(scale3(e1, i * H), scale3(e2, j * H)));
      const sideViewer = Math.sign(dot3(s.n, cam.toward));

      // the line is cut at the plane; the pieces behind the plane are dashed and lighter
      type Piece = { a: Vec3; b: Vec3; behind: boolean };
      const pieces: Piece[] = [];
      let X: Vec3 | null = null;
      if (lineOk) {
        const iv = clipLineToBall(s.a, s.v, R * 1.05);
        if (iv) {
          const r0 = planeResidual(pl, s.a);
          const nv = dot3(s.n, s.v);
          const cuts: number[] = [iv[0]];
          if (hasPlane && nv !== 0) {
            const ts = -r0 / nv;
            if (ts > iv[0] && ts < iv[1]) cuts.push(ts);
          }
          cuts.push(iv[1]);
          for (let i = 0; i + 1 < cuts.length; i++) {
            const mid = (cuts[i] + cuts[i + 1]) / 2;
            const g = planeResidual(pl, add3(s.a, scale3(s.v, mid)));
            pieces.push({
              a: add3(s.a, scale3(s.v, cuts[i])),
              b: add3(s.a, scale3(s.v, cuts[i + 1])),
              behind: hasPlane && Math.sign(g) * sideViewer < 0,
            });
          }
        }
        const hit = hasPlane ? intersectLinePlaneExact(s.a, s.v, pl) : null;
        if (hit && hit.kind === 'point') X = [hit.point[0].n / hit.point[0].d, hit.point[1].n / hit.point[1].d, hit.point[2].n / hit.point[2].d];
      }
      const lineColor = p.hand;
      for (const pc of pieces) if (pc.behind) seg(ctx, px(pc.a), px(pc.b), lineColor, 1.8, [7, 5], 0.55);

      if (hasPlane) {
        const quad: Pt[] = [corner(1, 1), corner(-1, 1), corner(-1, -1), corner(1, -1)].map(px);
        poly(ctx, quad, tint, tintEdge, 1.6);
        // the grid of the patch makes it read as a plane
        for (const f of [-1 / 3, 1 / 3]) {
          const a1 = px(corner(f, 1));
          const a2 = px(corner(f, -1));
          const b1 = px(corner(1, f));
          const b2 = px(corner(-1, f));
          seg(ctx, a1, a2, p.delta, 1, [], 0.35);
          seg(ctx, b1, b2, p.delta, 1, [], 0.35);
        }
      }
      for (const pc of pieces) if (!pc.behind) seg(ctx, px(pc.a), px(pc.b), lineColor, 2, [], 0.95);

      drop(s.p0, p.ink);
      if (s.showLine) drop(s.a, lineColor);
      if (s.showPoint) drop(s.q, p.ink);

      // normal
      const P0 = px(s.p0);
      if (hasPlane) {
        const tip = px(add3(s.p0, s.n));
        vecArrow(ctx, P0, tip, p.accent, 'double', 3);
        tipLabel(ctx, 'n', P0, tip, p.accent, p, true);
      }
      dot(ctx, P0, 4.5, p.ink, p.paper, p, 1.5);
      drawLabel(ctx, 'P₀', P0[0] - 17, P0[1] - 13, p.ink, p, false);

      if (lineOk) {
        const A = px(s.a);
        const tip = px(add3(s.a, s.v));
        vecArrow(ctx, A, tip, lineColor, 'open', 3.6);
        tipLabel(ctx, 'v', A, tip, lineColor, p, true);
        dot(ctx, A, 4, lineColor, p.paper, p, 1.5);
        drawLabel(ctx, 'A', A[0] - 13, A[1] + 12, lineColor, p, false);
      }
      if (X) {
        const xp = px(X);
        dot(ctx, xp, 6.5, p.ink, p.paper, p, 2.2);
        drawLabel(ctx, 'X', xp[0] + 14, xp[1] - 10, p.ink, p, false);
      }
      if (s.showPoint) {
        const Q = px(s.q);
        if (hasPlane) {
          const F = footOnPlane(pl, s.q);
          const Fp = px(F);
          const r = planeResidual(pl, s.q);
          if (r !== 0) {
            seg(ctx, Q, Fp, p.accent, 2, [6, 4]);
            const toQ = sub3(s.q, F);
            const inPlane = len3(sub3(s.p0, F)) > 0.2 ? sub3(s.p0, F) : e1;
            rightAngle(F, toQ, inPlane, 0.32, p.accent);
            dot(ctx, Fp, 3.4, null, p.accent, p, 1.6);
          }
        }
        dot(ctx, Q, 5, p.ink, p.paper, p, 1.5);
        drawLabel(ctx, 'Q', Q[0] + 13, Q[1] - 11, p.ink, p, false);
      }
    }

    /* ============================ cross ============================ */
    if (mode === 'cross') {
      const ab = add3(s.a, s.b);
      const flat = isZero3(cross3(s.a, s.b));
      const A = px(s.a);
      const B = px(s.b);
      const AB = px(ab);
      if (!flat) poly(ctx, [O, A, AB, B], tint, null);
      seg(ctx, A, AB, p.equip, 1.5, [6, 5], 0.6);
      seg(ctx, B, AB, p.force, 1.5, [6, 5], 0.6);
      drop(s.a, p.force);
      drop(s.b, p.equip);
      const [pd, cut] = shorten(nrm);
      if (!isZero3(nrm)) {
        const tip = px(pd);
        vecArrow(ctx, O, tip, p.accent, 'double', 3.2);
        tipLabel(ctx, `${s.swap ? 'b×a' : 'a×b'}${cut ? ' (מקוצר)' : ''}`, O, tip, p.accent, p, false, 20);
        if (!isZero3(s.a)) rightAngle([0, 0, 0], nrm, s.a, 0.38, p.accent);
        if (!isZero3(s.b)) rightAngle([0, 0, 0], nrm, s.b, 0.38, p.accent);
      } else {
        dot(ctx, O, 7, null, p.accent, p, 2.4);
        drawLabel(ctx, `${s.swap ? 'b×a' : 'a×b'} = 0`, O[0] + 6, O[1] + 24, p.accent, p, false);
      }
      vecArrow(ctx, O, B, p.equip, 'solid', 3);
      tipLabel(ctx, 'b', O, B, p.equip, p, true);
      vecArrow(ctx, O, A, p.force, 'solid', 3);
      tipLabel(ctx, 'a', O, A, p.force, p, true);
    }

    /* ============================= box ============================= */
    if (mode === 'box') {
      const E: Vec3[] = [s.a, s.b, s.c];
      const colors = [p.force, p.equip, p.hand];
      const D = tripleProduct(s.a, s.b, s.c);
      const V3 = (i: number, j: number, k: number): Vec3 => add3(add3(scale3(s.a, i), scale3(s.b, j)), scale3(s.c, k));

      // which faces look toward the viewer; face (m, side) has the outward normal ±E[p]×E[q]
      const vis: boolean[][] = [
        [true, true],
        [true, true],
        [true, true],
      ];
      if (D !== 0) {
        for (let m = 0; m < 3; m++) {
          const N = cross3(E[(m + 1) % 3], E[(m + 2) % 3]);
          const sg = Math.sign(dot3(N, E[m]));
          const facing = dot3(N, cam.toward);
          vis[m][1] = sg * facing > 0;
          vis[m][0] = -sg * facing > 0;
        }
      }
      type Edge = { from: Vec3; to: Vec3; m: number; hidden: boolean; atOrigin: boolean };
      const edges: Edge[] = [];
      for (let m = 0; m < 3; m++) {
        const pI = (m + 1) % 3;
        const qI = (m + 2) % 3;
        for (const cp of [0, 1]) {
          for (const cq of [0, 1]) {
            const idx = [0, 0, 0];
            idx[pI] = cp;
            idx[qI] = cq;
            const from = V3(idx[0], idx[1], idx[2]);
            edges.push({ from, to: add3(from, E[m]), m, hidden: !(vis[pI][cp] || vis[qI][cq]), atOrigin: cp === 0 && cq === 0 });
          }
        }
      }

      if (!isZero3(cross3(s.a, s.b))) poly(ctx, [O, px(s.a), px(V3(1, 1, 0)), px(s.b)], withAlpha(p.delta, 0.26), null);
      for (const e of edges) if (e.hidden && !e.atOrigin) seg(ctx, px(e.from), px(e.to), colors[e.m], 1.5, [5, 5], 0.55);
      for (const e of edges) if (!e.hidden && !e.atOrigin) seg(ctx, px(e.from), px(e.to), colors[e.m], 1.7, [], 0.8);
      for (const e of edges) if (e.hidden && e.atOrigin) seg(ctx, px(e.from), px(e.to), colors[e.m], 1.5, [5, 5], 0.55);

      for (const [i, v] of E.entries()) drop(v, colors[i]);

      if (s.showNormal) {
        const ab = cross3(s.a, s.b);
        if (!isZero3(ab)) {
          const [pd, cut] = shorten(ab);
          const tip = px(pd);
          vecArrow(ctx, O, tip, p.accent, 'double', 3.2);
          tipLabel(ctx, `a×b${cut ? ' (מקוצר)' : ''}`, O, tip, p.accent, p, false, 20);
          // the height of c above the base plane: a dashed perpendicular from c's tip
          const nh = norm3(ab);
          const hgt = dot3(s.c, nh);
          if (hgt !== 0) {
            const foot = sub3(s.c, scale3(nh, hgt));
            seg(ctx, px(s.c), px(foot), p.accent, 2, [6, 4]);
            const inward = len3(foot) > 0.2 ? scale3(foot, -1) : s.a;
            rightAngle(foot, scale3(nh, hgt), inward, 0.32, p.accent);
            dot(ctx, px(foot), 3.4, null, p.accent, p, 1.6);
            const mid = px(scale3(add3(s.c, foot), 0.5));
            drawLabel(ctx, 'h', mid[0] + 10, mid[1], p.accent, p, false);
          }
        }
      }

      // the three vectors from the origin, drawn last so the hidden dashes never cut them
      const names = ['a', 'b', 'c'];
      for (const i of [2, 1, 0]) {
        const tip = px(E[i]);
        vecArrow(ctx, O, tip, colors[i], i === 2 ? 'open' : 'solid', 3);
        tipLabel(ctx, names[i], O, tip, colors[i], p, true);
      }
    }
    dot(ctx, O, 2.8, p.ink, p.paper, p, 1);
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1, worldHeight: 1, animate: false });
  useEffect(invalidate, [s]);

  const onPointerDown = (e: PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    drag.current = { x: e.clientX, y: e.clientY };
    apply({ az: wrapAz(cur.current.az - dx * 0.5), el: clampEl(cur.current.el + dy * 0.4) });
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const k = e.shiftKey ? 15 : 5;
    if (e.key === 'ArrowLeft') apply({ az: wrapAz(cur.current.az - k) });
    else if (e.key === 'ArrowRight') apply({ az: wrapAz(cur.current.az + k) });
    else if (e.key === 'ArrowUp') apply({ el: clampEl(cur.current.el + k) });
    else if (e.key === 'ArrowDown') apply({ el: clampEl(cur.current.el - k) });
    else return;
    e.preventDefault();
  };

  const reset = () => {
    const f = fresh(props);
    cur.current = f;
    ctxRef.current = { touched: new Set(), swapped: false, baseline: f };
    setS(f);
    setLive('האיור אופס.');
  };

  /* ---------- text ---------- */
  const describe = (): string => {
    const view = `המבט: סיבוב ${Math.round(s.az)} מעלות, הטיה ${Math.round(s.el)} מעלות.`;
    if (mode === 'plane') {
      const parts = [hasPlane ? `המישור ${fmtPlaneEquation(pl)}, דרך הנקודה ${vecTxt(s.p0)}, עם נורמל ${vecTxt(s.n)}.` : 'הנורמל הוא אפס: אין מישור.'];
      if (lineOk && hasPlane) {
        const hit = intersectLinePlaneExact(s.a, s.v, pl);
        parts.push(
          hit.kind === 'point'
            ? `הישר דרך ${vecTxt(s.a)} בכיוון ${vecTxt(s.v)} חותך את המישור ב-${hit.point.map(fmtFrac).join(', ')}.`
            : hit.kind === 'parallel'
              ? 'הישר מקביל למישור.'
              : 'הישר מוכל במישור.',
        );
      }
      if (s.showPoint && hasPlane) {
        const r = planeResidual(pl, s.q);
        parts.push(r === 0 ? `הנקודה Q ${vecTxt(s.q)} על המישור.` : `הנקודה Q ${vecTxt(s.q)} במרחק ${fmtQuotSqrt(Math.abs(r), dot3(s.n, s.n))} מהמישור.`);
      }
      return `${parts.join(' ')} ${view}`;
    }
    if (mode === 'cross') {
      const pr = crossShown(s);
      return `a הוא ${vecTxt(s.a)} ו-b הוא ${vecTxt(s.b)}. ${s.swap ? 'b×a' : 'a×b'} הוא ${vecTxt(pr)}, ושטח המקבילית ${fmtSqrt(dot3(pr, pr))}. ${view}`;
    }
    const D = det3(s.a, s.b, s.c);
    return `a ${vecTxt(s.a)}, b ${vecTxt(s.b)}, c ${vecTxt(s.c)}. הדטרמיננטה ${fmtInt(D)}, נפח המקבילון ${Math.abs(D)}. ${view}`;
  };

  const orientTxt = (D: number) =>
    D > 0 ? 'שלשה ימנית' : D < 0 ? 'שלשה שמאלית' : 'שלושת הווקטורים במישור אחד: הנפח 0';

  /* ---------- readout ---------- */
  let readout: ComponentChildren = null;

  if (mode === 'plane') {
    const N = dot3(s.n, s.n);
    const hit = lineOk && hasPlane ? intersectLinePlaneExact(s.a, s.v, pl) : null;
    const nA = dot3(s.n, s.a);
    const nv = dot3(s.n, s.v);
    const r = planeResidual(pl, s.q);
    const dist = hasPlane ? fmtQuotSqrt(Math.abs(r), N) : '';
    const distDec = hasPlane ? fmtDecimal(Math.abs(r) / Math.sqrt(N)) : '';
    readout = (
      <div class="sl-readout">
        {hasPlane ? (
          <>
            <Row id="plane" label="משוואת המישור:" strong>
              {fmtPlaneEquation(pl)}
            </Row>
            <Row id="normal" label="הנורמל והנקודה:">
              {`${vn('n')} = ${vecTxt(s.n)},   P₀ = ${vecTxt(s.p0)}`}
            </Row>
            <Row id="d" label="הצבה של P₀:">
              {`d = ${vn('n')}·P₀ = ${prodTxt(s.n, s.p0)} = ${fmtInt(pl.d)}`}
            </Row>
          </>
        ) : (
          <div class="sl-row" data-readout="plane">
            <span class="sl-note">הנורמל הוא וקטור האפס: אין מישור.</span>
          </div>
        )}
        {s.showLine &&
          (isZero3(s.v) ? (
            <div class="sl-row" data-readout="line">
              <span class="sl-note">כיוון הישר הוא וקטור האפס: אין ישר.</span>
            </div>
          ) : (
            <>
              <Row id="line" label="הישר דרך A בכיוון v:">
                {`x = ${fmtAffine(s.a[0], s.v[0])},  y = ${fmtAffine(s.a[1], s.v[1])},  z = ${fmtAffine(s.a[2], s.v[2])}`}
              </Row>
              <Row id="line-dot" label="הכיוון והנורמל:">
                {`${vn('v')} = ${vecTxt(s.v)},  ${vn('v')}·${vn('n')} = ${prodTxt(s.v, s.n)} = ${fmtInt(nv)}`}
              </Row>
              {hasPlane && hit && hit.kind === 'point' && (
                <>
                  <Row id="line-t" label="הפרמטר:">
                    {`t = (d − ${vn('n')}·A)/(${vn('n')}·${vn('v')}) = (${fmtInt(pl.d)} − ${t(nA)})/${t(nv)} = ${fmtFrac(hit.t)}`}
                  </Row>
                  <Row id="line-point" label="נקודת החיתוך:" strong>
                    {`X = ${vecTxtFrac(hit.point)}`}
                  </Row>
                </>
              )}
              {hasPlane && hit && hit.kind === 'parallel' && (
                <div class="sl-row" data-readout="line-result">
                  <span class="sl-note">הישר מקביל למישור</span>
                  <span class="sl-lab">{`(${ltr(`${vn('v')}·${vn('n')} = 0`)}, ו-A אינה על המישור: אין נקודת חיתוך)`}</span>
                </div>
              )}
              {hasPlane && hit && hit.kind === 'contained' && (
                <div class="sl-row" data-readout="line-result">
                  <span class="sl-note">הישר מוכל במישור</span>
                  <span class="sl-lab">{`(${ltr(`${vn('v')}·${vn('n')} = 0`)}, ו-A על המישור: כל נקודה של הישר היא נקודת חיתוך)`}</span>
                </div>
              )}
            </>
          ))}
        {s.showPoint && hasPlane && (
          <>
            <Row id="point" label="הנקודה Q:">
              {`Q = ${vecTxt(s.q)},  r = ${vn('n')}·Q − d = ${prodTxt(s.n, s.q)} − ${t(pl.d)} = ${fmtInt(r)}`}
            </Row>
            {r === 0 ? (
              <div class="sl-row" data-readout="distance">
                <span class="sl-note">Q על המישור</span>
                <span class="sl-lab">(המרחק 0)</span>
              </div>
            ) : (
              <>
                <Row id="distance" label="המרחק מהמישור:" strong>
                  {`|r|/|${vn('n')}| = ${Math.abs(r)}/√${N}${dist === `${Math.abs(r)}/√${N}` ? '' : ` = ${dist}`}${dist === distDec ? '' : ` ≈ ${distDec}`}`}
                </Row>
                <Row id="foot" label="הנקודה הקרובה במישור (הרגל):">
                  {`F = ${vecTxtFrac(footOnPlaneExact(pl, s.q))}`}
                </Row>
              </>
            )}
          </>
        )}
      </div>
    );
  }

  if (mode === 'cross') {
    const [f, g] = s.swap ? [s.b, s.a] : [s.a, s.b];
    const [nf, ng] = s.swap ? ['b', 'a'] : ['a', 'b'];
    const pr = cross3(f, g);
    const N = dot3(pr, pr);
    const zero = isZero3(pr);
    readout = (
      <div class="sl-readout">
        <Row id="vectors">{`${vn('a')} = ${vecTxt(s.a)},   ${vn('b')} = ${vecTxt(s.b)}`}</Row>
        <Row id="cross-formula" label="הנוסחה:">
          {`${vn(nf)}×${vn(ng)} = (${nf}₂${ng}₃ − ${nf}₃${ng}₂,  ${nf}₃${ng}₁ − ${nf}₁${ng}₃,  ${nf}₁${ng}₂ − ${nf}₂${ng}₁)`}
        </Row>
        <Row id="cross-numbers" label="במספרים:">
          {`= (${t(f[1])}·${t(g[2])} − ${t(f[2])}·${t(g[1])},  ${t(f[2])}·${t(g[0])} − ${t(f[0])}·${t(g[2])},  ${t(f[0])}·${t(g[1])} − ${t(f[1])}·${t(g[0])})`}
        </Row>
        <Row id="cross" label="המכפלה:" strong>
          {`${vn(nf)}×${vn(ng)} = ${vecTxt(pr)}`}
        </Row>
        {zero ? (
          <div class="sl-row" data-readout="area">
            <span class="sl-note">המכפלה היא וקטור האפס: הווקטורים מקבילים (או אחד מהם אפס), והמקבילית מנוונת, שטחה 0.</span>
          </div>
        ) : (
          <Row id="area" label="האורך = שטח המקבילית:" strong>
            {`|${vn(nf)}×${vn(ng)}| = √(${t(pr[0])}² + ${t(pr[1])}² + ${t(pr[2])}²) = ${fmtSqrt(N) === `√${N}` ? '' : `√${N} = `}${sqrtLen(N)}`}
          </Row>
        )}
        <Row id="check-f" label={`מאונכת ל-${nf}:`}>
          {`(${vn(nf)}×${vn(ng)})·${vn(nf)} = ${prodTxt(pr, f)} = ${fmtInt(dot3(pr, f))}`}
        </Row>
        <Row id="check-g" label={`מאונכת ל-${ng}:`}>
          {`(${vn(nf)}×${vn(ng)})·${vn(ng)} = ${prodTxt(pr, g)} = ${fmtInt(dot3(pr, g))}`}
        </Row>
      </div>
    );
  }

  if (mode === 'box') {
    const [m1, m2, m3] = minorsFirstRow(s.b, s.c);
    const D = det3(s.a, s.b, s.c);
    const bc = cross3(s.b, s.c);
    const ab = cross3(s.a, s.b);
    const Nab = dot3(ab, ab);
    const rows: [string, Vec3][] = [
      ['a', s.a],
      ['b', s.b],
      ['c', s.c],
    ];
    readout = (
      <div class="sl-readout">
        <div class="sl-row" data-readout="matrix">
          <span class="sl-lab">הדטרמיננטה, השורות הן a, b, c:</span>
          <table class="sl-mat" dir="ltr">
            <tbody>
              {rows.map(([nm, v]) => (
                <tr key={nm}>
                  <td class="rowname">{vn(nm)}</td>
                  {v.map((x, k) => (
                    <td key={k} class={k === 0 ? 'first' : k === 2 ? 'last' : ''}>
                      {fmtInt(x)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Row id="expansion" label="פיתוח לפי השורה הראשונה:">
          {`det = ${t(s.a[0])}·(${t(s.b[1])}·${t(s.c[2])} − ${t(s.b[2])}·${t(s.c[1])}) − ${t(s.a[1])}·(${t(s.b[0])}·${t(s.c[2])} − ${t(s.b[2])}·${t(s.c[0])}) + ${t(s.a[2])}·(${t(s.b[0])}·${t(s.c[1])} − ${t(s.b[1])}·${t(s.c[0])})`}
        </Row>
        <Row id="det" label="" strong>
          {`= ${t(s.a[0])}·${t(m1)} − ${t(s.a[1])}·${t(m2)} + ${t(s.a[2])}·${t(m3)} = ${fmtInt(D)}`}
        </Row>
        <Row id="triple" label="המכפלה המשולשת (שווה לדטרמיננטה):">
          {`${vn('b')}×${vn('c')} = ${vecTxt(bc)},   ${vn('a')}·(${vn('b')}×${vn('c')}) = ${prodTxt(s.a, bc)} = ${fmtInt(tripleProduct(s.a, s.b, s.c))}`}
        </Row>
        <Row id="volume" label="נפח המקבילון:" strong>
          {`V = |${fmtInt(D)}| = ${Math.abs(D)}`}
        </Row>
        <div class="sl-row" data-readout="orientation">
          <span class="sl-note">{orientTxt(D)}</span>
          {orientation(s.a, s.b, s.c) !== 0 && <span class="sl-lab">{`(${ltr(`det ${D > 0 ? '> 0' : '< 0'}`)})`}</span>}
        </div>
        {s.showNormal && (
          <>
            <Row id="normal" label="הנורמל לבסיס:">{`${vn('a')}×${vn('b')} = ${vecTxt(ab)}`}</Row>
            {Nab === 0 ? (
              <div class="sl-row" data-readout="height">
                <span class="sl-note">a ו-b מקבילים: אין בסיס, והנפח 0.</span>
              </div>
            ) : (
              <Row id="height" label="שטח הבסיס וגובה c מעליו:">
                {`|${vn('a')}×${vn('b')}| = ${sqrtLen(Nab)},   h = |${fmtInt(D)}|/√${Nab} = ${fmtQuotSqrt(Math.abs(D), Nab)}${fmtQuotSqrt(Math.abs(D), Nab) === fmtDecimal(Math.abs(D) / Math.sqrt(Nab)) ? '' : ` ≈ ${fmtDecimal(Math.abs(D) / Math.sqrt(Nab))}`}`}
              </Row>
            )}
          </>
        )}
      </div>
    );
  }

  /* ---------- controls ---------- */
  const NAMES: Record<VKey, string> = { p0: 'P₀', n: 'n', a: mode === 'plane' ? 'A' : 'a', v: 'v', q: 'Q', b: 'b', c: 'c' };
  const IS_VEC: Record<VKey, boolean> = { p0: false, n: true, a: mode !== 'plane', v: true, q: false, b: true, c: true };
  const COLOR: Record<VKey, string> = {
    p0: 'var(--ink)',
    n: 'var(--accent)',
    a: mode === 'plane' ? 'var(--hand)' : 'var(--force)',
    v: 'var(--hand)',
    q: 'var(--ink)',
    b: 'var(--equip)',
    c: 'var(--hand)',
  };
  const rowsFor: VKey[] =
    mode === 'plane' ? ['p0', 'n', ...(s.showLine ? (['a', 'v'] as VKey[]) : []), ...(s.showPoint ? (['q'] as VKey[]) : [])] : mode === 'cross' ? ['a', 'b'] : ['a', 'b', 'c'];

  const stepper = (k: VKey, i: number, dir: 1 | -1) => {
    const v = [...s[k]] as [number, number, number];
    v[i] = v[i] + dir;
    userSet({ [k]: v } as Partial<State>);
    setLive(`${NAMES[k]} ${COMP[i]} = ${fmtInt(v[i])}`);
  };

  const controls = (
    <>
      <div class="sl-vecs">
        {rowsFor.map((k) => (
          <div class="sl-vec" key={k} data-vec={k} role="group" aria-label={`הרכיבים של ${NAMES[k]}`}>
            <span class="sl-vec-name" style={{ color: COLOR[k] }}>
              {IS_VEC[k] ? vn(NAMES[k]) : NAMES[k]}
            </span>
            {COMP.map((cn, i) => (
              <span class="sl-step" key={cn} data-comp={cn}>
                <span class="axis" aria-hidden="true">
                  {cn}
                </span>
                <button type="button" data-step="dec" aria-label={`הקטנת ${cn} של ${NAMES[k]}`} disabled={s[k][i] <= -LIM} onClick={() => stepper(k, i, -1)}>
                  −
                </button>
                <output data-value aria-label={`${cn} של ${NAMES[k]}`}>
                  {fmtInt(s[k][i])}
                </output>
                <button type="button" data-step="inc" aria-label={`הגדלת ${cn} של ${NAMES[k]}`} disabled={s[k][i] >= LIM} onClick={() => stepper(k, i, 1)}>
                  +
                </button>
              </span>
            ))}
          </div>
        ))}
      </div>
      <div class="group" role="group" aria-label="מה להציג">
        {mode === 'plane' && <Toggle label="ישר" on={s.showLine} swatch="var(--hand)" onChange={(v) => userSet({ showLine: v })} />}
        {mode === 'plane' && <Toggle label="נקודה Q" on={s.showPoint} swatch="var(--ink)" onChange={(v) => userSet({ showPoint: v })} />}
        {mode === 'cross' && (
          <Toggle
            label={
              <>
                סדר הפוך: <bdi dir="ltr">b×a</bdi>
              </>
            }
            on={s.swap}
            swatch="var(--accent)"
            onChange={(v) => userSet({ swap: v }, { swapped: true })}
          />
        )}
        {mode === 'box' && (
          <Toggle
            label={
              <>
                הנורמל והגובה: <bdi dir="ltr">a×b</bdi>
              </>
            }
            on={s.showNormal}
            swatch="var(--accent)"
            onChange={(v) => userSet({ showNormal: v })}
          />
        )}
        {mode === 'box' && (
          <button
            type="button"
            class="toggle"
            data-action="swap-ab"
            onClick={() => userSet({ a: s.b, b: s.a }, { swapped: true })}
          >
            החליפו את <bdi dir="ltr">a</bdi> ו-<bdi dir="ltr">b</bdi>
          </button>
        )}
      </div>
      <div class="sl-views">
        <Slider label="סיבוב המבט" value={s.az} min={0} max={359} step={1} format={(x) => `${Math.round(x)}°`} onChange={(x) => apply({ az: wrapAz(x) })} />
        <Slider label="הטיית המבט" value={s.el} min={0} max={85} step={1} format={(x) => `${Math.round(x)}°`} onChange={(x) => apply({ el: clampEl(x) })} />
      </div>
      <p class="hint hand">גררו את הרקע של האיור כדי לסובב את המבט.</p>
    </>
  );

  return (
    <SimShell
      fig={props.id}
      label={`איור חי: מערכת צירים תלת-ממדית בהטלה אקסונומטרית, ציר z כלפי מעלה. ${describe()} במקלדת: חצים מסובבים את המבט.`}
      canvasRef={canvasRef}
      aspect={1.05}
      live={live}
      tasks={tasks}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      cursor="grab"
      onReset={reset}
      readout={readout}
      controls={controls}
    />
  );
}

/** (x, y, z) with exact fractions */
function vecTxtFrac(v: readonly [{ n: number; d: number }, { n: number; d: number }, { n: number; d: number }]): string {
  return `(${v.map(fmtFrac).join(', ')})`;
}
