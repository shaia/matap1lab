/**
 * ComplexPlane (chapter 3, complex numbers): the plane of Gauss (Re to the right, Im up) in nine modes, ported from
 * unimech (polar, multiply, rotate, sum) and extended (add, region, power, roots, quadratic). Maths: src/math/complex.ts.
 * Angles in props and step states are DEGREES; readouts show an angle in radians as a multiple of π when it is one
 * (3π/4), else as a decimal, with the degrees beside it. Points are [x, y]. Canvases are math space and stay LTR.
 *
 * mode 'add':       draggable z and w; z + w (accent) with the parallelogram. `sub` adds z − w, drawn from w to z and,
 *                   as a free vector, from the origin.
 * mode 'multiply':  draggable z and w; zw (accent); arcs for arg z, arg w and their sum; `div` adds z/w; buttons w = i,
 *                   w = −1 and w = z̄.
 * mode 'polar':     draggable z; the legs x and y; the arc of Arg z; the calculator's arctan(y/x) as a dashed ray when it
 *                   differs; `conj` adds z̄.
 * mode 'region':    a shaded set (`region`: disk, circle, annulus, sector, halfplane-re, halfplane-im, bisector) and a
 *                   draggable test point q: FILLED (green) inside, HOLLOW (red ring) outside. The set's own boundary
 *                   is solid when the boundary belongs to the set (disk, sector, circle, bisector) and dashed when not.
 * mode 'power':     draggable z; the points z, z², …, zⁿ joined in order (a spiral); `unit` draws the unit circle.
 * mode 'roots':     draggable w; the n roots of zⁿ = w as the vertices of a regular n-gon on the circle of radius
 *                   |w|^(1/n); the principal root (k = 0) is the larger marked one; `unit` draws the unit circle.
 * mode 'quadratic': sliders b, c ∈ [−4, 4] (step 0.25); the roots of z² + bz + c: two real roots meet at Δ = 0 and
 *                   leave the real axis as a conjugate pair.
 * mode 'rotate':   the complex amplitude Ã (dashed, draggable) and the arrow Ã e^(iωt) (ω = 1 rad/s) turning; its shadow
 *                   on the real axis is x(t) = Re(Ã e^(iωt)), traced against t on the side plot. `vel` adds iωÃe^(iωt).
 * mode 'sum':      Ã₁ = A₁ (real) and Ã₂ = A₂ e^(iΔφ) head to tail and their sum; the plot shows x₁, x₂, x₁ + x₂.
 *
 * Props (defaults): id (required); mode ('polar'); modes (the mode buttons shown; default the starting mode only);
 * tasks ([]). z ([1, 1], in 'polar' [2, 1.5]), w ([1, 1]), sub (false), div (false), conj (false), region ('disk'),
 * a ([0, 0]), b (region: a point, [2, 0]; quadratic: a number, 2), r (1.5), r2 (2.5), alphaDeg (30), betaDeg (120),
 * c (region: a number, 1; quadratic: a number, 1), q ([1, 1]), n (power 4, roots 3; 1–12 / 2–12), unit (power true,
 * roots false), amp ([2, 0]), vel (false), A1 (2), A2 (1.5), dphiDeg (60), t (0). `b` and `c` are read by the mode:
 * `b` as an array is the region's second point, as a number the quadratic's b; `c` is the half-plane constant in
 * 'region' and the constant term in 'quadratic'.
 * Every prop is also a step key (`<Step fig=… set={{…}}>`); a key left out keeps its value. A state set by a step
 * never ticks a task, and a state that already had a task's property when a step or reset made it must be left and
 * found again.
 *
 * Tasks (ticked only inside the learner's own drag, key, button, slider or toggle):
 *   add: sum-real (z + w real while neither is), sub-length (`sub` turned on by the learner, then z or w moved)
 *   multiply: times-i (w = i), real-product (zw real, neither real), div-conj (`div` on, z/w real, neither real),
 *             unit-rotate (|w| = 1 within 0.03, w not real)
 *   polar: second-quadrant, third-quadrant, conjugate (conj turned on), on-axis (z on the negative real axis)
 *   region: region-inside (q moved inside), region-boundary (q on the boundary within 0.05)
 *   power: power-unit (||z| − 1| < 0.02), power-real (zⁿ real, z not), power-shrink (0 < |z| < 1)
 *   roots: roots-unity (w = 1, n changed by the learner), roots-n (n set to 6), roots-move (w moved)
 *   quadratic: quadratic-double (|Δ| < 0.05), quadratic-complex (Δ < 0), quadratic-imag (b = 0, c > 0)
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import {
  REGION_KINDS,
  cabs,
  cadd,
  carg,
  cdiv,
  cis,
  cmul,
  complex,
  conj,
  cpowers,
  croots,
  csub,
  derivativeAmplitude,
  inRegion,
  quadraticRoots,
  reAt,
  regionBoundaryDistance,
  regionBoundaryPoint,
  sumAmplitude,
  type Complex,
  type RegionKind,
  type RegionSpec,
} from '~/math/complex';
import { niceAngle } from '~/math/coords';
import { sub, sup } from '~/math/fmt';
import { motionAllowed } from '~/progress/settings';
import { markTask } from '~/progress/store';
import { subscribeSteps, type StepState } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { sci } from './core/format';
import { arrow, withAlpha } from './core/ink';
import { drawAxes, drawCurve, insetBox, makePlot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import './ComplexPlane.css';

export type ComplexMode = 'add' | 'multiply' | 'polar' | 'region' | 'power' | 'roots' | 'quadratic' | 'rotate' | 'sum';
type Handle = 'z' | 'w' | 'q' | 'amp';
type Pt = [number, number];

const ltr = (s: string) => String.fromCharCode(0x2066) + s.replace(/ /g, String.fromCharCode(0xa0)) + String.fromCharCode(0x2069);

const TASK_LABEL: Record<string, string> = {
  'sum-real': `מצאו z ו-w, שאף אחד מהם לא ממשי, שסכומם ${ltr('z + w')} ממשי. מה מקשר בין החלקים המדומים שלהם?`,
  'sub-length': `הדליקו "z − w" וגררו: מה האורך של ${ltr('|z − w|')} ביחס לשתי הנקודות?`,
  'times-i': `במצב כפל: קבעו ${ltr('w = i')}. מה קורה לחץ של z?`,
  'real-product': 'במצב כפל: מצאו z ו-w, שאף אחד מהם לא ממשי, שהמכפלה שלהם ממשית.',
  'div-conj': `הדליקו "z/w" ומצאו z ו-w, שאף אחד מהם לא ממשי, שהמנה ${ltr('z/w')} ממשית.`,
  'unit-rotate': `קבעו ${ltr('|w| = 1')}, כש-w לא ממשי: מה המכפלה עושה ל-z?`,
  'second-quadrant': `גררו את z לרביע השני (חלק ממשי שלילי, מדומה חיובי). השוו את ${ltr('Arg z')} ל-${ltr('arctan(y/x)')}.`,
  'third-quadrant': `גררו את z לרביע השלישי. מה הערך של ${ltr('Arg z')} שם, ומה נותן ${ltr('arctan(y/x)')}?`,
  conjugate: `הדליקו "צמוד". איפה ${ltr('z̄')} ביחס ל-z, ומה הזווית שלו?`,
  'on-axis': `גררו את z לציר הממשי השלילי. מה ${ltr('Arg z')} שם?`,
  'region-inside': 'גררו את נקודת הבדיקה q פנימה אל התחום: הנקודה מתמלאת.',
  'region-boundary': 'הציבו את q על שפת התחום (ממש עליה). האם הנקודה שייכת לתחום?',
  'power-unit': `קבעו ${ltr('|z| = 1')}: איפה נמצאות כל החזקות?`,
  'power-real': `מצאו z לא ממשי ש-${ltr('zⁿ')} שלו ממשי.`,
  'power-shrink': `קבעו ${ltr('|z| < 1')}: לאן הולך הספירל?`,
  'roots-unity': `קבעו ${ltr('w = 1')} ושנו את n: איפה השורשים?`,
  'roots-n': `קבעו ${ltr('n = 6')}: כמה שורשים יש, ומה הזווית בין שורש לשורש?`,
  'roots-move': 'גררו את w: איך מצולע השורשים זז?',
  'quadratic-double': `מצאו b ו-c שבהם ${ltr('Δ = 0')}: מה קורה לשני השורשים?`,
  'quadratic-complex': `מצאו b ו-c שבהם ${ltr('Δ < 0')}: איפה השורשים?`,
  'quadratic-imag': `קבעו ${ltr('b = 0')} ו-${ltr('c > 0')}: מה השורשים?`,
};

const MODE_LABEL: Record<ComplexMode, string> = {
  add: 'חיבור',
  multiply: 'כפל',
  polar: 'צורה קוטבית',
  region: 'תחומים',
  power: 'חזקות',
  roots: 'שורשים',
  quadratic: 'משוואה ריבועית',
  rotate: 'תנודה',
  sum: 'חיבור תנודות',
};

const KIND_LABEL: Record<RegionKind, string> = {
  disk: 'עיגול',
  circle: 'מעגל',
  annulus: 'טבעת',
  sector: 'גזרה',
  'halfplane-re': 'חצי מישור',
  'halfplane-im': 'חצי מישור',
  bisector: 'האנך האמצעי',
};

export interface ComplexPlaneProps {
  id: string;
  mode?: ComplexMode;
  /** the mode buttons shown (default: the starting mode only) */
  modes?: ComplexMode[];
  z?: Pt;
  w?: Pt;
  sub?: boolean;
  div?: boolean;
  conj?: boolean;
  region?: RegionKind;
  a?: Pt;
  /** region: the second point (bisector); quadratic: the coefficient b */
  b?: Pt | number;
  r?: number;
  r2?: number;
  alphaDeg?: number;
  betaDeg?: number;
  /** region: the half-plane constant; quadratic: the constant term c */
  c?: number;
  q?: Pt;
  n?: number;
  unit?: boolean;
  /** rotate: the complex amplitude Ã */
  amp?: Pt;
  vel?: boolean;
  /** sum: the two amplitudes and the phase difference [deg] */
  A1?: number;
  A2?: number;
  dphiDeg?: number;
  /** time [s], ω = 1 rad/s */
  t?: number;
  tasks?: string[];
}

interface Setup {
  mode: ComplexMode;
  z: Pt;
  w: Pt;
  sub: boolean;
  div: boolean;
  conj: boolean;
  region: RegionKind;
  a: Pt;
  /** the region's second point */
  bPt: Pt;
  /** the half-plane constant */
  c: number;
  r: number;
  r2: number;
  alphaDeg: number;
  betaDeg: number;
  q: Pt;
  n: number;
  unit: boolean;
  /** the quadratic's b and c */
  qb: number;
  qc: number;
  amp: Pt;
  vel: boolean;
  A1: number;
  A2: number;
  dphiDeg: number;
  t: number;
}

const OMEGA = 1; // rad/s
const T_MAX = 4 * Math.PI; // two periods
const GRID = 0.5;
const DEG = Math.PI / 180;
const TAU = 2 * Math.PI;
const LIM = 3.5;
const LIM_AMP = 2.5;
const LIM_MULT_W = 2;
const Q_STEP = 0.25;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
/** the quadratic mode's c runs over [−4, C_MAX]: 6 reaches the classic z² − 2z + 5, roots 1 ± 2i */
const C_MAX = 6;
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const bool = (x: unknown): boolean | null => (typeof x === 'boolean' ? x : null);
const pt = (x: unknown): Pt | null => (Array.isArray(x) && x.length === 2 && num(x[0]) !== null && num(x[1]) !== null ? [x[0] as number, x[1] as number] : null);
const kindOf = (x: unknown): RegionKind | null => (typeof x === 'string' && (REGION_KINDS as string[]).includes(x) ? (x as RegionKind) : null);
const roundTo = (x: number, step: number) => Number((Math.round(x / step) * step).toPrecision(10));
const r9 = (x: number) => Number(x.toFixed(9));
const deg = (r: number) => (r * 180) / Math.PI;
const fmt = (x: number, sig = 3) => (Math.abs(x) < 5e-4 ? '0' : sci(x, sig).replace('-', '−'));
const C = (p: Pt): Complex => complex(p[0], p[1]);

/** "a + bi", "−bi", "a" */
function cstr(z: Complex): string {
  const re = Math.abs(z.re) < 5e-4 ? 0 : z.re;
  const im = Math.abs(z.im) < 5e-4 ? 0 : z.im;
  const imPart = (v: number) => (Math.abs(v) === 1 ? 'i' : `${fmt(Math.abs(v))}i`);
  if (im === 0) return fmt(re);
  if (re === 0) return `${im < 0 ? '−' : ''}${imPart(im)}`;
  return `${fmt(re)} ${im < 0 ? '−' : '+'} ${imPart(im)}`;
}
/** the angle in radians as a multiple of π when it is one, else a decimal; the degrees beside it */
function angStr(rad: number): string {
  const k = Math.round(rad / (Math.PI / 12));
  const snapped = Math.abs(rad - (k * Math.PI) / 12) < 1e-6 ? (k * Math.PI) / 12 : rad;
  return `${niceAngle(snapped) ?? fmt(snapped)} (${fmt(deg(snapped))}°)`;
}
const argDeg = (z: Complex) => (cabs(z) < 1e-9 ? 0 : deg(carg(z)));
const realish = (c: Complex) => Math.abs(c.im) <= 1e-6 * Math.max(1, cabs(c));

function specOf(s: Setup): RegionSpec {
  return { kind: s.region, a: C(s.a), b: C(s.bPt), r: s.r, r2: s.r2, alpha: s.alphaDeg * DEG, beta: s.betaDeg * DEG, c: s.c };
}
/** how many roots / powers the current mode uses */
const nOf = (s: Setup) => (s.mode === 'roots' ? clamp(Math.round(s.n), 2, 12) : clamp(Math.round(s.n), 1, 12));

/* ---- tasks: a rule is `state` (what must hold) and `needs` (the learner's change must touch one of these keys);
 * an `event` task needs no leaving: its achievement is the learner's act, not only the state */
interface Rule {
  needs: (keyof Setup)[];
  event?: boolean;
  state: (s: Setup, learnerSub: boolean) => boolean;
}
const RULES: Record<string, Rule> = {
  'sum-real': { needs: ['z', 'w'], state: (s) => s.mode === 'add' && Math.abs(s.z[1]) > 1e-6 && Math.abs(s.w[1]) > 1e-6 && realish(cadd(C(s.z), C(s.w))) },
  'sub-length': { needs: ['z', 'w'], event: true, state: (s, ls) => s.mode === 'add' && s.sub && ls && cabs(csub(C(s.z), C(s.w))) > 0 },
  'times-i': { needs: ['z', 'w'], event: true, state: (s) => s.mode === 'multiply' && Math.abs(s.w[0]) < 1e-6 && Math.abs(s.w[1] - 1) < 1e-6 && cabs(C(s.z)) > 0 },
  'real-product': {
    needs: ['z', 'w'],
    state: (s) => s.mode === 'multiply' && Math.abs(s.z[1]) > 1e-6 && Math.abs(s.w[1]) > 1e-6 && cabs(cmul(C(s.z), C(s.w))) > 0 && realish(cmul(C(s.z), C(s.w))),
  },
  'div-conj': {
    needs: ['z', 'w', 'div'],
    state: (s) => s.mode === 'multiply' && s.div && Math.abs(s.z[1]) > 1e-6 && Math.abs(s.w[1]) > 1e-6 && cabs(C(s.w)) > 0 && realish(cdiv(C(s.z), C(s.w))),
  },
  'unit-rotate': { needs: ['w'], state: (s) => s.mode === 'multiply' && Math.abs(cabs(C(s.w)) - 1) < 0.03 && Math.abs(s.w[1]) > 1e-6 },
  'second-quadrant': { needs: ['z'], state: (s) => s.mode === 'polar' && s.z[0] < 0 && s.z[1] > 0 },
  'third-quadrant': { needs: ['z'], state: (s) => s.mode === 'polar' && s.z[0] < 0 && s.z[1] < 0 },
  conjugate: { needs: ['conj'], event: true, state: (s) => s.mode === 'polar' && s.conj },
  'on-axis': { needs: ['z'], state: (s) => s.mode === 'polar' && s.z[0] < 0 && Math.abs(s.z[1]) < 1e-6 },
  'region-inside': { needs: ['q'], event: true, state: (s) => s.mode === 'region' && inRegion(specOf(s), C(s.q), 0.05) },
  'region-boundary': { needs: ['q'], state: (s) => s.mode === 'region' && regionBoundaryDistance(specOf(s), C(s.q)) < 0.05 },
  'power-unit': { needs: ['z'], state: (s) => s.mode === 'power' && Math.abs(cabs(C(s.z)) - 1) < 0.02 },
  'power-real': {
    needs: ['z', 'n'],
    state: (s) => {
      if (s.mode !== 'power' || Math.abs(s.z[1]) <= 1e-6) return false;
      const pw = cpowers(C(s.z), nOf(s));
      return realish(pw[pw.length - 1]);
    },
  },
  'power-shrink': { needs: ['z'], state: (s) => s.mode === 'power' && cabs(C(s.z)) > 0 && cabs(C(s.z)) < 1 },
  'roots-unity': { needs: ['n'], event: true, state: (s) => s.mode === 'roots' && Math.abs(s.w[0] - 1) < 1e-6 && Math.abs(s.w[1]) < 1e-6 },
  'roots-n': { needs: ['n'], event: true, state: (s) => s.mode === 'roots' && nOf(s) === 6 },
  'roots-move': { needs: ['w'], event: true, state: (s) => s.mode === 'roots' && cabs(C(s.w)) > 0 },
  'quadratic-double': { needs: ['qb', 'qc'], state: (s) => s.mode === 'quadratic' && Math.abs(s.qb * s.qb - 4 * s.qc) < 0.05 },
  'quadratic-complex': { needs: ['qb', 'qc'], state: (s) => s.mode === 'quadratic' && s.qb * s.qb - 4 * s.qc < -1e-9 },
  'quadratic-imag': { needs: ['qb', 'qc'], state: (s) => s.mode === 'quadratic' && s.qb === 0 && s.qc > 0 },
};

function haloText(ctx: CanvasRenderingContext2D, p: Palette, s: string, x: number, y: number, o: { font: string; color?: string; align?: CanvasTextAlign }) {
  ctx.save();
  ctx.direction = 'ltr';
  ctx.font = o.font;
  ctx.textAlign = o.align ?? 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = withAlpha(p.paper, 0.9);
  ctx.strokeText(s, x, y);
  ctx.fillStyle = o.color ?? p.ink;
  ctx.fillText(s, x, y);
  ctx.restore();
}

function dashed(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width = 1.2) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

/** An arc at (cx, cy) from angle `from` to `to` (math angles, counter-clockwise positive). */
function angleArc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, from: number, to: number, color: string, width = 1.6) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -from, -to, to > from);
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

/** a hollow mark: paper inside, a coloured ring */
function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, paper: string, width = 2.4) {
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

interface PlaneMap {
  cx: number;
  cy: number;
  /** px per unit */
  s: number;
}

/** the number as a grid point when one is near, else on a polar magnet: |z| = 1 and multiples of 15° attract */
function smartSnap(x: number, y: number, lim: number): Pt {
  const gx = clamp(Math.round(x / GRID) * GRID, -lim, lim);
  const gy = clamp(Math.round(y / GRID) * GRID, -lim, lim);
  if (Math.hypot(x - gx, y - gy) < 0.15) return [gx, gy];
  let r = Math.hypot(x, y);
  let t = Math.atan2(y, x);
  r = Math.abs(r - 1) < 0.08 ? 1 : roundTo(r, 0.05);
  const step = Math.PI / 12;
  const t15 = Math.round(t / step) * step;
  t = Math.abs(t - t15) < 3 * DEG ? t15 : roundTo(t / DEG, 1) * DEG;
  return [clamp(r9(r * Math.cos(t)), -lim, lim), clamp(r9(r * Math.sin(t)), -lim, lim)];
}

export default function ComplexPlane(props: ComplexPlaneProps) {
  const startMode: ComplexMode = props.mode ?? 'polar';
  const modes: ComplexMode[] = props.modes ?? [startMode];
  const split = (m: ComplexMode) => m === 'rotate' || m === 'sum';
  const initial = (): Setup => ({
    mode: startMode,
    z: props.z ?? (startMode === 'polar' ? [2, 1.5] : [1, 1]),
    w: props.w ?? [1, 1],
    sub: props.sub ?? false,
    div: props.div ?? false,
    conj: props.conj ?? false,
    region: props.region ?? 'disk',
    a: props.a ?? [0, 0],
    bPt: Array.isArray(props.b) ? (props.b as Pt) : [2, 0],
    c: startMode !== 'quadratic' ? (props.c ?? 1) : 1,
    r: props.r ?? 1.5,
    r2: props.r2 ?? 2.5,
    alphaDeg: props.alphaDeg ?? 30,
    betaDeg: props.betaDeg ?? 120,
    q: props.q ?? [1, 1],
    n: clamp(Math.round(props.n ?? (startMode === 'roots' ? 3 : 4)), 1, 12),
    unit: props.unit ?? startMode === 'power',
    qb: typeof props.b === 'number' ? clamp(props.b, -4, 4) : 2,
    qc: startMode === 'quadratic' ? clamp(props.c ?? 1, -4, C_MAX) : 1,
    amp: props.amp ?? [2, 0],
    vel: props.vel ?? false,
    A1: clamp(props.A1 ?? 2, 0, 2.5),
    A2: clamp(props.A2 ?? 1.5, 0, 2.5),
    dphiDeg: clamp(props.dphiDeg ?? 60, 0, 360),
    t: clamp(props.t ?? 0, 0, T_MAX),
  });
  const [setup, setSetup] = useState<Setup>(initial);
  const cur = useRef(setup);
  const [playing, setPlaying] = useState(false);
  const [live, setLive] = useState('');
  const [selected, setSelected] = useState<Handle | null>(null);
  const drag = useRef<Handle | null>(null);
  const plane = useRef<PlaneMap | null>(null);
  const t0 = useRef<{ wall: number; t: number } | null>(null);
  const tNow = useRef(setup.t);
  /** tasks whose state held when the last step or reset made it: they must be left and found again */
  const held = useRef<Set<string>>(new Set());
  /** `sub` was turned on by the learner (not by a step) */
  const learnerSub = useRef(false);

  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const done = (t: string) => {
    if (props.tasks?.includes(t)) markTask(`${props.id}:${t}`);
  };
  const rebase = (s: Setup) => {
    held.current = new Set((props.tasks ?? []).filter((id) => RULES[id] && !RULES[id].event && RULES[id].state(s, learnerSub.current)));
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
        t0.current = null;
        learnerSub.current = false;
        const prev = cur.current;
        const mode = typeof st.mode === 'string' && modes.includes(st.mode as ComplexMode) ? (st.mode as ComplexMode) : prev.mode;
        const next: Setup = {
          mode,
          z: pt(st.z) ?? prev.z,
          w: pt(st.w) ?? prev.w,
          sub: bool(st.sub) ?? prev.sub,
          div: bool(st.div) ?? prev.div,
          conj: bool(st.conj) ?? prev.conj,
          region: kindOf(st.region) ?? prev.region,
          a: pt(st.a) ?? prev.a,
          bPt: pt(st.b) ?? prev.bPt,
          c: mode !== 'quadratic' ? (num(st.c) ?? prev.c) : prev.c,
          r: clamp(num(st.r) ?? prev.r, 0.25, 6),
          r2: clamp(num(st.r2) ?? prev.r2, 0.25, 8),
          alphaDeg: clamp(num(st.alphaDeg) ?? prev.alphaDeg, -180, 180),
          betaDeg: clamp(num(st.betaDeg) ?? prev.betaDeg, -180, 180),
          q: pt(st.q) ?? prev.q,
          n: clamp(Math.round(num(st.n) ?? prev.n), 1, 12),
          unit: bool(st.unit) ?? prev.unit,
          qb: num(st.b) !== null ? clamp(num(st.b) as number, -4, 4) : prev.qb,
          qc: mode === 'quadratic' && num(st.c) !== null ? clamp(num(st.c) as number, -4, C_MAX) : prev.qc,
          amp: pt(st.amp) ?? prev.amp,
          vel: bool(st.vel) ?? prev.vel,
          A1: clamp(num(st.A1) ?? prev.A1, 0, 2.5),
          A2: clamp(num(st.A2) ?? prev.A2, 0, 2.5),
          dphiDeg: clamp(num(st.dphiDeg) ?? prev.dphiDeg, 0, 360),
          t: clamp(num(st.t) ?? prev.t, 0, T_MAX),
        };
        tNow.current = next.t;
        commit(next);
        rebase(next);
      }),
    [props.id],
  );

  const s0 = setup;
  const z = C(s0.z);
  const w = C(s0.w);
  const zw = cmul(z, w);
  const zdw = cabs(w) > 0 ? cdiv(z, w) : complex(NaN, NaN);
  const amp = C(s0.amp);
  const a2 = cmul(complex(s0.A2), cis(s0.dphiDeg * DEG));
  const sumA = sumAmplitude(s0.A1, s0.A2, s0.dphiDeg * DEG);
  const sumPhase = argDeg({ re: s0.A1 + a2.re, im: a2.im });
  const nn = nOf(s0);
  const spec = specOf(s0);
  const qz = C(s0.q);
  const isSplit = split(s0.mode);
  const quad = quadraticRoots(s0.qb, s0.qc);

  const draw = ({ ctx, view, palette: p, t }: FrameInfo) => {
    const narrow = view.w < 520;
    const fs = narrow ? 12 : 13;
    const font = (w8: number, size = fs, it = true) => `${it ? 'italic ' : ''}${w8} ${size}px ${p.fontUi}`;

    // time now
    let tt = s0.t;
    if (playing) {
      if (t0.current === null) t0.current = { wall: t, t: s0.t };
      tt = (t0.current.t + (t - t0.current.wall)) % T_MAX;
    }
    tNow.current = tt;
    const rot = cis(OMEGA * tt);

    // boxes: the plane alone, or the plane beside (above) the time plot
    const top = narrow ? 34 : 0; // the stage's tool buttons sit over the top edge on a phone
    const planeBox = !isSplit
      ? { x: 0, y: top, w: view.w, h: view.h - top }
      : narrow
        ? { x: 0, y: top, w: view.w, h: view.h * 0.56 - top }
        : { x: 0, y: 0, w: view.w * 0.5, h: view.h };
    const sideBox = narrow ? { x: 0, y: view.h * 0.56, w: view.w, h: view.h * 0.44 } : { x: view.w * 0.5, y: 0, w: view.w * 0.5, h: view.h };

    // the half-range E of the plane, in units
    let E = 3;
    const fin = (v: number) => (Number.isFinite(v) ? v : 0);
    if (s0.mode === 'add') E = Math.max(3, 1.12 * Math.max(cabs(z), cabs(w), cabs(cadd(z, w)), s0.sub ? cabs(csub(z, w)) : 0));
    else if (s0.mode === 'polar') E = 4;
    else if (s0.mode === 'multiply') E = Math.max(2.5, 1.12 * Math.max(cabs(z), cabs(w), cabs(zw), s0.div ? fin(cabs(zdw)) : 0));
    else if (s0.mode === 'region') {
      const ext = s0.region === 'annulus' ? cabs(spec.a) + s0.r2 : s0.region === 'disk' || s0.region === 'circle' ? cabs(spec.a) + s0.r : s0.region === 'bisector' ? Math.max(cabs(spec.a), cabs(spec.b)) : 3;
      E = clamp(1.1 * ext, 4, 8);
    } else if (s0.mode === 'power') E = clamp(1.12 * Math.max(...cpowers(z, nn).map(cabs), s0.unit ? 1.2 : 0), 2.5, 16);
    else if (s0.mode === 'roots') E = Math.max(2.5, 1.2 * Math.max(cabs(w), Math.pow(cabs(w), 1 / nn), s0.unit ? 1 : 0));
    else if (s0.mode === 'quadratic') E = 5;
    else if (s0.mode === 'rotate') E = Math.max(2.5, 1.15 * Math.max(cabs(amp), s0.vel ? OMEGA * cabs(amp) : 0));
    else E = Math.max(2.5, 1.12 * (s0.A1 + s0.A2));
    const cx = planeBox.x + planeBox.w / 2;
    const cy = planeBox.y + planeBox.h / 2;
    const s = Math.max(1, (Math.min(planeBox.w, planeBox.h) / 2 - 14) / E);
    plane.current = { cx, cy, s };
    const X = (v: number) => cx + v * s;
    const Y = (v: number) => cy - v * s;

    // grid
    const step = E > 12 ? 5 : E > 6 ? 2 : 1;
    const nx = Math.floor(planeBox.w / 2 / s / step) * step;
    const ny = Math.floor(planeBox.h / 2 / s / step) * step;
    ctx.save();
    ctx.strokeStyle = withAlpha(p.rule, 0.7);
    ctx.lineWidth = 1;
    for (let g = -nx; g <= nx; g += step) {
      if (g === 0) continue;
      ctx.beginPath();
      ctx.moveTo(X(g), planeBox.y + 2);
      ctx.lineTo(X(g), planeBox.y + planeBox.h - 2);
      ctx.stroke();
    }
    for (let g = -ny; g <= ny; g += step) {
      if (g === 0) continue;
      ctx.beginPath();
      ctx.moveTo(planeBox.x + 2, Y(g));
      ctx.lineTo(planeBox.x + planeBox.w - 2, Y(g));
      ctx.stroke();
    }
    ctx.restore();

    /* ---- the shaded set of the region mode goes under the axes */
    const kindStroke = (closed: boolean) => {
      ctx.strokeStyle = p.delta;
      ctx.lineWidth = 2.4;
      ctx.setLineDash(closed ? [] : [7, 5]);
    };
    if (s0.mode === 'region') {
      ctx.save();
      ctx.beginPath();
      ctx.rect(planeBox.x, planeBox.y, planeBox.w, planeBox.h);
      ctx.clip();
      const ax = X(spec.a.re);
      const ay = Y(spec.a.im);
      ctx.fillStyle = p.deltaBand;
      const R = 4 * E * s;
      if (s0.region === 'disk') {
        ctx.beginPath();
        ctx.arc(ax, ay, s0.r * s, 0, TAU);
        ctx.fill();
        kindStroke(true);
        ctx.stroke();
      } else if (s0.region === 'circle') {
        ctx.beginPath();
        ctx.arc(ax, ay, s0.r * s, 0, TAU);
        ctx.strokeStyle = p.delta;
        ctx.lineWidth = 3.2;
        ctx.stroke();
      } else if (s0.region === 'annulus') {
        const lo = Math.min(s0.r, s0.r2);
        const hi = Math.max(s0.r, s0.r2);
        ctx.beginPath();
        ctx.moveTo(ax + hi * s, ay);
        ctx.arc(ax, ay, hi * s, 0, TAU);
        ctx.moveTo(ax + lo * s, ay);
        ctx.arc(ax, ay, lo * s, 0, TAU);
        ctx.fill('evenodd');
        kindStroke(false);
        ctx.beginPath();
        ctx.arc(ax, ay, hi * s, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(ax, ay, lo * s, 0, TAU);
        ctx.stroke();
      } else if (s0.region === 'sector') {
        const al = spec.alpha;
        let be = spec.beta;
        if (be < al) be += TAU;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, -al, -be, true);
        ctx.closePath();
        ctx.fill();
        kindStroke(true);
        ctx.beginPath();
        ctx.moveTo(cx + R * Math.cos(al), cy - R * Math.sin(al));
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + R * Math.cos(be), cy - R * Math.sin(be));
        ctx.stroke();
      } else if (s0.region === 'halfplane-re') {
        ctx.fillRect(X(s0.c), planeBox.y, planeBox.x + planeBox.w - X(s0.c), planeBox.h);
        kindStroke(false);
        ctx.beginPath();
        ctx.moveTo(X(s0.c), planeBox.y);
        ctx.lineTo(X(s0.c), planeBox.y + planeBox.h);
        ctx.stroke();
      } else if (s0.region === 'halfplane-im') {
        ctx.fillRect(planeBox.x, planeBox.y, planeBox.w, Y(s0.c) - planeBox.y);
        kindStroke(false);
        ctx.beginPath();
        ctx.moveTo(planeBox.x, Y(s0.c));
        ctx.lineTo(planeBox.x + planeBox.w, Y(s0.c));
        ctx.stroke();
      } else {
        const ab = csub(spec.b, spec.a);
        const L = cabs(ab);
        if (L > 0) {
          const mid = { re: (spec.a.re + spec.b.re) / 2, im: (spec.a.im + spec.b.im) / 2 };
          const d = { re: -ab.im / L, im: ab.re / L };
          ctx.strokeStyle = p.delta;
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.moveTo(X(mid.re - 3 * E * d.re), Y(mid.im - 3 * E * d.im));
          ctx.lineTo(X(mid.re + 3 * E * d.re), Y(mid.im + 3 * E * d.im));
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // axes
    ctx.save();
    ctx.strokeStyle = p.ink2;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(planeBox.x + 4, cy);
    ctx.lineTo(planeBox.x + planeBox.w - 8, cy);
    ctx.moveTo(cx, planeBox.y + planeBox.h - 4);
    ctx.lineTo(cx, planeBox.y + 8);
    ctx.stroke();
    ctx.restore();
    arrow(ctx, planeBox.x + planeBox.w - 14, cy, planeBox.x + planeBox.w - 4, cy, { color: p.ink2, width: 1.3, head: 7 });
    arrow(ctx, cx, planeBox.y + 14, cx, planeBox.y + 4, { color: p.ink2, width: 1.3, head: 7 });
    haloText(ctx, p, 'Re', planeBox.x + planeBox.w - 6, cy + 13, { font: font(600), color: p.ink2, align: 'right' });
    haloText(ctx, p, 'Im', cx + 8, planeBox.y + 10, { font: font(600), color: p.ink2, align: 'left' });
    // tick numbers, kept clear of the axis names at the right and top edges
    for (let g = -nx; g <= nx; g += step) {
      if (g !== 0 && X(g) - planeBox.x > 12 && planeBox.x + planeBox.w - X(g) > 30) haloText(ctx, p, fmt(g), X(g), cy + 11, { font: font(400, fs - 2, false), color: p.ink3 });
    }
    for (let g = -ny; g <= ny; g += step) {
      if (g !== 0 && Y(g) - planeBox.y > 24 && planeBox.y + planeBox.h - Y(g) > 10) haloText(ctx, p, `${fmt(g)}i`, cx - 6, Y(g), { font: font(400, fs - 2, false), color: p.ink3, align: 'right' });
    }

    const handleRing = (h: Handle, x: number, y: number) => {
      if (selected !== h) return;
      ctx.save();
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, TAU);
      ctx.stroke();
      ctx.restore();
    };
    const tag = (text: string, at: Complex, color: string, off = 14) => {
      const a = cabs(at) > 1e-9 ? carg(at) : Math.PI / 4;
      haloText(ctx, p, text, X(at.re) + off * Math.cos(a), Y(at.im) - off * Math.sin(a), { font: font(700, fs + 1), color });
    };
    const unitCircle = () => {
      ctx.save();
      ctx.strokeStyle = withAlpha(p.ink3, 0.8);
      ctx.lineWidth = 1.3;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.arc(cx, cy, s, 0, TAU);
      ctx.stroke();
      ctx.restore();
    };
    const vec = (c: Complex, color: string, width = 2.6, head = 11) => arrow(ctx, cx, cy, X(c.re), Y(c.im), { color, width, head });

    if (s0.mode === 'add') {
      const sm = cadd(z, w);
      dashed(ctx, X(z.re), Y(z.im), X(sm.re), Y(sm.im), withAlpha(p.equip, 0.8), 1.4);
      dashed(ctx, X(w.re), Y(w.im), X(sm.re), Y(sm.im), withAlpha(p.ink2, 0.9), 1.4);
      if (s0.sub) {
        const df = csub(z, w);
        // z − w from the origin, and the same vector from w to z: the segment between the two points
        vec(df, p.eps, 2.4, 10);
        arrow(ctx, X(w.re), Y(w.im), X(z.re), Y(z.im), { color: p.eps, width: 2.4, head: 10 });
        dashed(ctx, X(df.re), Y(df.im), X(z.re), Y(z.im), withAlpha(p.eps, 0.7), 1.2);
        tag('z − w', df, p.eps, 22);
      }
      vec(sm, p.accent, 3, 12);
      vec(w, p.equip);
      vec(z, p.ink);
      dot(ctx, X(z.re), Y(z.im), 5.5, p.ink, p.paper);
      dot(ctx, X(w.re), Y(w.im), 5.5, p.equip, p.paper);
      handleRing('z', X(z.re), Y(z.im));
      handleRing('w', X(w.re), Y(w.im));
      tag('z', z, p.ink);
      tag('w', w, p.equip);
      tag('z + w', sm, p.accent, 20);
    } else if (s0.mode === 'polar') {
      const zx = X(z.re);
      const zy = Y(z.im);
      dashed(ctx, zx, zy, cx, zy, p.ink2);
      // the legs of the right triangle: x along the real axis, then y straight up (or down) to z
      ctx.save();
      ctx.lineWidth = 4;
      ctx.strokeStyle = withAlpha(p.limit, 0.75);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(zx, cy);
      ctx.stroke();
      ctx.strokeStyle = withAlpha(p.eps, 0.75);
      ctx.beginPath();
      ctx.moveTo(zx, cy);
      ctx.lineTo(zx, zy);
      ctx.stroke();
      ctx.restore();
      if (Math.abs(z.re) > 0.4) haloText(ctx, p, `x = ${fmt(z.re)}`, (cx + zx) / 2, cy + (z.im >= 0 ? 16 : -16), { font: font(700), color: p.limit });
      if (Math.abs(z.im) > 0.4) haloText(ctx, p, `y = ${fmt(z.im)}`, zx + (z.re >= 0 ? 10 : -10), (cy + zy) / 2, { font: font(700), color: p.eps, align: z.re >= 0 ? 'left' : 'right' });
      if (cabs(z) > 1e-9) {
        const th = carg(z);
        const rr = Math.min(34, 0.45 * cabs(z) * s);
        // the calculator's arctan(y/x): a dashed ray where it points, when it is not Arg z
        if (z.re < 0 && Math.abs(z.im) > 1e-9) {
          const na = Math.atan(z.im / z.re);
          const len = Math.min(0.9 * E, 2.4) * s;
          dashed(ctx, cx, cy, cx + len * Math.cos(na), cy - len * Math.sin(na), withAlpha(p.ink3, 0.95), 1.4);
          ring(ctx, cx + len * Math.cos(na), cy - len * Math.sin(na), 4, p.ink3, p.paper, 1.6);
          haloText(ctx, p, 'arctan', cx + (len + 22) * Math.cos(na), cy - (len + 22) * Math.sin(na), { font: font(600, fs - 1), color: p.ink3 });
        }
        angleArc(ctx, cx, cy, rr, 0, th, p.accent, 2);
        const lr = rr + 13;
        haloText(ctx, p, 'θ', cx + lr * Math.cos(th / 2), cy - lr * Math.sin(th / 2), { font: font(700, fs + 1), color: p.accent });
      }
      if (s0.conj) {
        const c = conj(z);
        vec(c, p.equip, 2.2, 10);
        dashed(ctx, zx, zy, X(c.re), Y(c.im), withAlpha(p.equip, 0.8));
        tag('z̄', c, p.equip);
      }
      vec(z, p.ink, 2.8, 12);
      dot(ctx, zx, zy, 5.5, p.ink, p.paper);
      handleRing('z', zx, zy);
      tag('z', z, p.ink);
    } else if (s0.mode === 'multiply') {
      const showArcs = cabs(z) > 1e-9 && cabs(w) > 1e-9;
      if (showArcs) {
        const az = carg(z);
        const aw = carg(w);
        angleArc(ctx, cx, cy, 26, 0, az, p.ink, 2);
        angleArc(ctx, cx, cy, 38, 0, aw, p.equip, 2);
        angleArc(ctx, cx, cy, 50, 0, az + aw, p.accent, 2);
      }
      if (s0.div && cabs(w) > 0) {
        vec(zdw, p.eps, 2.4, 10);
        tag('z/w', zdw, p.eps, 20);
        if (showArcs) angleArc(ctx, cx, cy, 62, 0, carg(z) - carg(w), p.eps, 1.6);
      }
      vec(zw, p.accent, 3, 12);
      vec(w, p.equip, 2.4);
      vec(z, p.ink);
      dot(ctx, X(z.re), Y(z.im), 5.5, p.ink, p.paper);
      dot(ctx, X(w.re), Y(w.im), 5.5, p.equip, p.paper);
      handleRing('z', X(z.re), Y(z.im));
      handleRing('w', X(w.re), Y(w.im));
      tag('z', z, p.ink);
      tag('w', w, p.equip);
      tag('zw', zw, p.accent, 18);
    } else if (s0.mode === 'region') {
      // the centre(s) and the labels of the set
      if (s0.region === 'disk' || s0.region === 'circle' || s0.region === 'annulus') {
        dot(ctx, X(spec.a.re), Y(spec.a.im), 3.5, p.ink2, p.paper);
        haloText(ctx, p, 'a', X(spec.a.re) + 9, Y(spec.a.im) + 12, { font: font(700), color: p.ink2 });
      } else if (s0.region === 'bisector') {
        dashed(ctx, X(spec.a.re), Y(spec.a.im), X(spec.b.re), Y(spec.b.im), withAlpha(p.ink2, 0.9), 1.3);
        dot(ctx, X(spec.a.re), Y(spec.a.im), 4.5, p.ink2, p.paper);
        dot(ctx, X(spec.b.re), Y(spec.b.im), 4.5, p.equip, p.paper);
        haloText(ctx, p, 'a', X(spec.a.re) - 9, Y(spec.a.im) - 12, { font: font(700), color: p.ink2 });
        haloText(ctx, p, 'b', X(spec.b.re) + 9, Y(spec.b.im) - 12, { font: font(700), color: p.equip });
      }
      const inside = inRegion(spec, qz, 0.05);
      const qx = X(qz.re);
      const qy = Y(qz.im);
      // the distance q to the nearest boundary point, as a dashed segment
      const bp = regionBoundaryPoint(spec, qz);
      dashed(ctx, qx, qy, X(bp.re), Y(bp.im), withAlpha(p.ink3, 0.8), 1.2);
      if (inside) dot(ctx, qx, qy, 7, p.pointIn, p.paper);
      else ring(ctx, qx, qy, 6.5, p.pointOut, p.paper, 2.6);
      handleRing('q', qx, qy);
      haloText(ctx, p, 'q', qx + 12, qy - 12, { font: font(700, fs + 1), color: inside ? p.pointIn : p.pointOut });
    } else if (s0.mode === 'power') {
      if (s0.unit) unitCircle();
      const pts = cpowers(z, nn);
      ctx.save();
      ctx.strokeStyle = withAlpha(p.accent, 0.75);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(X(pts[0].re), Y(pts[0].im));
      for (let k = 1; k < pts.length; k++) ctx.lineTo(X(pts[k].re), Y(pts[k].im));
      ctx.stroke();
      ctx.restore();
      dashed(ctx, cx, cy, X(pts[pts.length - 1].re), Y(pts[pts.length - 1].im), withAlpha(p.ink3, 0.8), 1.2);
      pts.forEach((c, i) => {
        const k = i + 1;
        const last = k === nn;
        if (k === 1) return;
        dot(ctx, X(c.re), Y(c.im), last ? 5.5 : 4, last ? p.accent : p.curve, p.paper);
        if (nn <= 8 || last) tag(`z${sup(k)}`, c, last ? p.accent : p.ink2, 14);
      });
      vec(z, p.ink, 2.6, 11);
      dot(ctx, X(z.re), Y(z.im), 5.5, p.ink, p.paper);
      handleRing('z', X(z.re), Y(z.im));
      tag('z', z, p.ink);
    } else if (s0.mode === 'roots') {
      const rho = Math.pow(cabs(w), 1 / nn);
      const rts = croots(w, nn);
      if (s0.unit) unitCircle();
      ctx.save();
      ctx.strokeStyle = withAlpha(p.ink3, 0.8);
      ctx.lineWidth = 1.3;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(cx, cy, rho * s, 0, TAU);
      ctx.stroke();
      ctx.restore();
      if (rho > 0) {
        ctx.save();
        ctx.strokeStyle = withAlpha(p.accent, 0.8);
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        rts.forEach((c, k) => (k === 0 ? ctx.moveTo(X(c.re), Y(c.im)) : ctx.lineTo(X(c.re), Y(c.im))));
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = withAlpha(p.ink3, 0.55);
        ctx.lineWidth = 1;
        rts.forEach((c) => {
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(X(c.re), Y(c.im));
          ctx.stroke();
        });
        ctx.restore();
        // the argument of w and the argument of the principal root
        const aw = carg(w);
        angleArc(ctx, cx, cy, Math.min(26, 0.4 * rho * s), 0, aw / nn, p.accent, 2);
      }
      dashed(ctx, cx, cy, X(w.re), Y(w.im), withAlpha(p.equip, 0.85), 1.4);
      rts.forEach((c, k) => {
        if (k === 0) {
          dot(ctx, X(c.re), Y(c.im), 7, p.accent, p.paper);
          ring(ctx, X(c.re), Y(c.im), 11, p.accent, 'transparent', 1.8);
          tag(`z${sub(0)}`, c, p.accent, 20);
        } else {
          dot(ctx, X(c.re), Y(c.im), 4.5, p.curve, p.paper);
          if (nn <= 8) tag(`z${sub(k)}`, c, p.ink2, 16);
        }
      });
      dot(ctx, X(w.re), Y(w.im), 5.5, p.equip, p.paper);
      handleRing('w', X(w.re), Y(w.im));
      tag('w', w, p.equip);
    } else if (s0.mode === 'quadratic') {
      const [r1, r2] = quad.roots;
      // the axis of symmetry Re z = −b/2 and the segment between a conjugate pair
      dashed(ctx, X(-s0.qb / 2), planeBox.y + 6, X(-s0.qb / 2), planeBox.y + planeBox.h - 6, withAlpha(p.ink3, 0.8), 1.2);
      if (quad.disc < 0) dashed(ctx, X(r1.re), Y(r1.im), X(r2.re), Y(r2.im), withAlpha(p.accent, 0.8), 1.4);
      else if (quad.disc > 0) dashed(ctx, X(r1.re), cy, X(r2.re), cy, withAlpha(p.accent, 0.8), 1.4);
      if (Math.abs(quad.disc) < 1e-9) {
        dot(ctx, X(r1.re), Y(0), 6.5, p.accent, p.paper);
        ring(ctx, X(r1.re), Y(0), 11, p.accent, 'transparent', 1.8);
        haloText(ctx, p, 'z₁ = z₂', X(r1.re), Y(0) - 20, { font: font(700, fs + 1), color: p.accent });
      } else {
        dot(ctx, X(r1.re), Y(r1.im), 6, p.accent, p.paper);
        dot(ctx, X(r2.re), Y(r2.im), 6, p.equip, p.paper);
        haloText(ctx, p, 'z₁', X(r1.re), Y(r1.im) - 15, { font: font(700, fs + 1), color: p.accent });
        haloText(ctx, p, 'z₂', X(r2.re), Y(r2.im) + (quad.disc < 0 ? 15 : -15), { font: font(700, fs + 1), color: p.equip });
      }
    } else if (s0.mode === 'rotate') {
      const zt = cmul(amp, rot);
      // the complex amplitude Ã: dashed, draggable
      if (cabs(amp) > 1e-9) {
        dashed(ctx, cx, cy, X(amp.re), Y(amp.im), withAlpha(p.ink2, 0.9), 1.6);
        dot(ctx, X(amp.re), Y(amp.im), 5, withAlpha(p.ink2, 0.9), p.paper);
        if (tt > 0.05) tag('Ã', amp, p.ink2);
      }
      handleRing('amp', X(amp.re), Y(amp.im));
      // the circle of the motion
      ctx.save();
      ctx.strokeStyle = withAlpha(p.ink3, 0.6);
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.arc(cx, cy, cabs(amp) * s, 0, TAU);
      ctx.stroke();
      ctx.restore();
      if (s0.vel && cabs(amp) > 1e-9) {
        const vt = cmul(derivativeAmplitude(amp, OMEGA), rot);
        vec(vt, p.delta, 2.4, 10);
        dashed(ctx, X(vt.re), Y(vt.im), X(vt.re), cy, withAlpha(p.delta, 0.8));
        dot(ctx, X(vt.re), cy, 4.5, p.delta, p.paper);
        tag('ż', vt, p.delta, 14);
      }
      if (cabs(amp) > 1e-9) {
        dashed(ctx, X(zt.re), Y(zt.im), X(zt.re), cy, withAlpha(p.accent, 0.9));
        vec(zt, p.ink, 2.8, 12);
        dot(ctx, X(zt.re), cy, 5, p.accent, p.paper);
        haloText(ctx, p, 'x', X(zt.re), cy + (zt.im >= 0 ? 16 : -16), { font: font(700, fs + 1), color: p.accent });
        tag(tt > 0.05 ? 'z' : 'z = Ã', zt, p.ink, tt > 0.05 ? 14 : 24);
      }
    } else {
      // sum: head to tail
      const z1 = cmul(complex(s0.A1), rot);
      const z2 = cmul(a2, rot);
      const zs = { re: z1.re + z2.re, im: z1.im + z2.im };
      if (s0.A1 > 0) vec(z1, p.ink2, 2.4, 10);
      if (s0.A2 > 0) arrow(ctx, X(z1.re), Y(z1.im), X(zs.re), Y(zs.im), { color: p.equip, width: 2.4, head: 10 });
      if (cabs(zs) > 1e-6) vec(zs, p.accent, 3, 12);
      else dot(ctx, cx, cy, 5, p.accent, p.paper);
      dashed(ctx, X(zs.re), Y(zs.im), X(zs.re), cy, withAlpha(p.accent, 0.9));
      dot(ctx, X(zs.re), cy, 5, p.accent, p.paper);
      if (s0.A1 > 0) haloText(ctx, p, '1', X(z1.re / 2) - 10 * Math.sin(carg(z1)), Y(z1.im / 2) - 10 * Math.cos(carg(z1)), { font: font(700), color: p.ink2 });
      if (s0.A2 > 0) {
        const mid = { re: z1.re + z2.re / 2, im: z1.im + z2.im / 2 };
        haloText(ctx, p, '2', X(mid.re) - 10 * Math.sin(carg(z2)), Y(mid.im) - 10 * Math.cos(carg(z2)), { font: font(700), color: p.equip });
      }
      if (cabs(zs) > 1e-6) tag('Ã₁ + Ã₂', zs, p.accent, 20);
    }

    /* ---- the time plot */
    if (isSplit) {
      const yMax = s0.mode === 'rotate' ? Math.max(1, 1.12 * Math.max(cabs(amp), s0.vel ? OMEGA * cabs(amp) : 0)) : Math.max(1, 1.12 * (s0.A1 + s0.A2));
      const plot = makePlot(
        // on a wide stage the tool buttons sit over the plot's top right corner: start the plot below them
        insetBox(sideBox, { l: narrow ? 40 : 46, r: 14, t: narrow ? 20 : 50, b: 42 }),
        { min: 0, max: T_MAX, label: 't (s)' + String.fromCharCode(0x200e), ticks: [0, 2, 4, 6, 8, 10, 12], format: (v) => fmt(v) },
        { min: -yMax, max: yMax, label: s0.mode === 'rotate' && s0.vel ? 'x, v' : 'x', format: (v) => fmt(v) },
      );
      drawAxes(ctx, plot, p);
      if (s0.mode === 'rotate') {
        if (s0.vel) drawCurve(ctx, plot, (u) => reAt(derivativeAmplitude(amp, OMEGA), OMEGA, u), { color: p.delta, width: 1.8, dash: [5, 4], samples: 240 });
        drawCurve(ctx, plot, (u) => reAt(amp, OMEGA, u), { color: p.accent, width: 2.6, samples: 240 });
        dot(ctx, plot.px(tt), plot.py(reAt(amp, OMEGA, tt)), 5, p.accent, p.paper);
        if (s0.vel) dot(ctx, plot.px(tt), plot.py(reAt(derivativeAmplitude(amp, OMEGA), OMEGA, tt)), 4.5, p.delta, p.paper);
      } else {
        const a1c = complex(s0.A1);
        const sc = { re: s0.A1 + a2.re, im: a2.im };
        drawCurve(ctx, plot, (u) => reAt(a1c, OMEGA, u), { color: withAlpha(p.ink2, 0.85), width: 1.6, samples: 240 });
        drawCurve(ctx, plot, (u) => reAt(a2, OMEGA, u), { color: withAlpha(p.equip, 0.9), width: 1.6, samples: 240 });
        drawCurve(ctx, plot, (u) => reAt(sc, OMEGA, u), { color: p.accent, width: 2.8, samples: 240 });
        dot(ctx, plot.px(tt), plot.py(reAt(sc, OMEGA, tt)), 5, p.accent, p.paper);
      }
      dashed(ctx, plot.px(tt), plot.box.y, plot.px(tt), plot.box.y + plot.box.h, withAlpha(p.ink3, 0.8));
    }
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1.6, worldHeight: 1, animate: playing });
  useEffect(invalidate, [setup, playing, selected]);

  const [aspect, setAspect] = useState(isSplit ? 1.6 : 1.45);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const narrow = el.getBoundingClientRect().width < 520;
      setAspect(split(cur.current.mode) ? (narrow ? 0.72 : 1.6) : narrow ? 0.95 : 1.45);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const el = canvasRef.current;
    const narrow = (el?.getBoundingClientRect().width ?? 600) < 520;
    setAspect(isSplit ? (narrow ? 0.72 : 1.6) : narrow ? 0.95 : 1.45);
  }, [isSplit]);
  useEffect(invalidate, [aspect]);

  /** The learner changed the figure: apply, then tick whatever the new state completes. */
  const apply = (patch: Partial<Setup>) => {
    const prev = cur.current;
    const next = { ...prev, ...patch };
    if (patch.sub === true) learnerSub.current = true;
    if (patch.sub === false) learnerSub.current = false;
    commit(next);
    for (const id of props.tasks ?? []) {
      const rule = RULES[id];
      if (!rule) continue;
      if (!rule.state(next, learnerSub.current)) {
        held.current.delete(id);
        continue;
      }
      if (!rule.needs.some((k) => k in patch)) continue;
      if (!rule.event && held.current.has(id)) continue;
      done(id);
    }
  };

  const stop = () => {
    if (playing) commit({ ...cur.current, t: roundTo(tNow.current, 0.05) });
    setPlaying(false);
    t0.current = null;
  };

  const handles = (): Handle[] =>
    setup.mode === 'add' || setup.mode === 'multiply' ? ['z', 'w'] : setup.mode === 'polar' || setup.mode === 'power' ? ['z'] : setup.mode === 'roots' ? ['w'] : setup.mode === 'region' ? ['q'] : setup.mode === 'rotate' ? ['amp'] : [];
  const posOf = (h: Handle): Pt => {
    const c = cur.current;
    return h === 'z' ? c.z : h === 'w' ? c.w : h === 'q' ? c.q : c.amp;
  };

  const moveTo = (h: Handle, x: number, y: number) => {
    const c = cur.current;
    let q: Pt;
    if (h === 'q') {
      const sp = specOf(c);
      const free: Pt = [clamp(roundTo(x, 0.01), -3.9, 3.9), clamp(roundTo(y, 0.01), -3.9, 3.9)];
      const fz = C(free);
      if (regionBoundaryDistance(sp, fz) < 0.12) {
        const b = regionBoundaryPoint(sp, fz);
        q = [clamp(roundTo(b.re, 0.01), -3.9, 3.9), clamp(roundTo(b.im, 0.01), -3.9, 3.9)];
      } else {
        const gx = Math.round(x / Q_STEP) * Q_STEP;
        const gy = Math.round(y / Q_STEP) * Q_STEP;
        q = Math.hypot(x - gx, y - gy) < 0.08 ? [clamp(gx, -3.75, 3.75), clamp(gy, -3.75, 3.75)] : [clamp(roundTo(x, 0.05), -3.9, 3.9), clamp(roundTo(y, 0.05), -3.9, 3.9)];
      }
    } else if (h === 'amp') {
      q = [clamp(Math.round(x / GRID) * GRID, -LIM_AMP, LIM_AMP), clamp(Math.round(y / GRID) * GRID, -LIM_AMP, LIM_AMP)];
    } else {
      q = smartSnap(x, y, c.mode === 'multiply' && h === 'w' ? LIM_MULT_W : LIM);
    }
    const old = posOf(h);
    if (q[0] === old[0] && q[1] === old[1]) return;
    apply({ [h === 'amp' ? 'amp' : h]: q } as Partial<Setup>);
  };

  const onPointerDown = (e: PointerEvent) => {
    const m = plane.current;
    if (!m) return;
    let best: Handle | null = null;
    let bd = 22;
    for (const h of handles()) {
      const [x, y] = posOf(h);
      const d = Math.hypot(m.cx + x * m.s - e.offsetX, m.cy - y * m.s - e.offsetY);
      if (d < bd) {
        bd = d;
        best = h;
      }
    }
    setSelected(best);
    if (!best) return;
    stop();
    drag.current = best;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    const m = plane.current;
    const h = drag.current;
    if (!m || !h) return;
    moveTo(h, (e.offsetX - m.cx) / m.s, (m.cy - e.offsetY) / m.s);
  };
  const onPointerUp = () => {
    if (drag.current) setLive(describe());
    drag.current = null;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const hs = handles();
    if (hs.length === 0) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      const i = selected ? hs.indexOf(selected) : -1;
      const next = hs[(i + 1) % hs.length];
      setSelected(next);
      setLive(`נבחר ${next === 'amp' ? 'Ã' : next}.`);
      return;
    }
    const dirs: Record<string, Pt> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const d = dirs[e.key];
    if (!d) return;
    e.preventDefault();
    const h = selected && hs.includes(selected) ? selected : hs[0];
    setSelected(h);
    stop();
    const [x, y] = posOf(h);
    const k = h === 'q' ? Q_STEP : GRID;
    moveTo(h, x + d[0] * k, y + d[1] * k);
  };

  const play = () => {
    if (!motionAllowed()) {
      setLive('מצב שקט: התנועה לא מוצגת. הזיזו את הזמן בפס.');
      return;
    }
    t0.current = null;
    setPlaying(true);
  };

  const regionNote = (): string => {
    const d = regionBoundaryDistance(spec, qz);
    const inside = inRegion(spec, qz, 0.05);
    return `${KIND_LABEL[s0.region]}: ${d < 0.05 ? 'q על השפה' : inside ? 'q בפנים' : 'q בחוץ'}`;
  };

  function describe(): string {
    if (setup.mode === 'add') return `z = ${cstr(z)}, w = ${cstr(w)}, הסכום z + w = ${cstr(cadd(z, w))}.`;
    if (setup.mode === 'polar') return `z = ${cstr(z)}, הגודל ${fmt(cabs(z))}, הזווית ${fmt(argDeg(z))} מעלות.`;
    if (setup.mode === 'multiply') return `z = ${cstr(z)}, w = ${cstr(w)}, המכפלה zw = ${cstr(zw)}, בגודל ${fmt(cabs(zw))} ובזווית ${fmt(argDeg(zw))} מעלות.`;
    if (setup.mode === 'region') return `נקודת הבדיקה q = ${cstr(qz)}. ${regionNote()}.`;
    if (setup.mode === 'power') return `z = ${cstr(z)}, החזקה הגבוהה z בחזקת ${nn} היא ${cstr(cpowers(z, nn)[nn - 1])}.`;
    if (setup.mode === 'roots') return `w = ${cstr(w)}, ${nn} שורשים על מעגל ברדיוס ${fmt(Math.pow(cabs(w), 1 / nn))}.`;
    if (setup.mode === 'quadratic') return `הדיסקרימיננטה ${fmt(quad.disc)}: ${quad.disc > 1e-9 ? 'שני שורשים ממשיים' : quad.disc < -1e-9 ? 'זוג שורשים צמודים' : 'שורש כפול'}.`;
    if (setup.mode === 'rotate') return `האמפליטודה המרוכבת ${cstr(amp)}: אמפליטודה ${fmt(cabs(amp))} ופאזה ${fmt(argDeg(amp))} מעלות.`;
    return `סכום שתי תנודות: אמפליטודה ${fmt(sumA)}.`;
  }

  const phaseRad = cabs(amp) > 1e-9 ? carg(amp) : 0;
  const label =
    setup.mode === 'add'
      ? `איור חי: המישור המרוכב. z = ${cstr(z)} ו-w = ${cstr(w)} נחברים כחיצים, והסכום z + w = ${cstr(cadd(z, w))} הוא האלכסון של המקבילית.`
      : setup.mode === 'polar'
        ? `איור חי: המישור המרוכב והמספר z = ${cstr(z)}, בגודל ${fmt(cabs(z))} ובזווית ${fmt(argDeg(z))} מעלות מהציר הממשי.`
        : setup.mode === 'multiply'
          ? `איור חי: המכפלה של z = ${cstr(z)} ו-w = ${cstr(w)} היא ${cstr(zw)}. הגדלים מוכפלים והזוויות מתחברות.`
          : setup.mode === 'region'
            ? `איור חי: תחום במישור המרוכב (${KIND_LABEL[setup.region]}) ונקודת בדיקה q = ${cstr(qz)}. הנקודה מלאה כשהיא בתוך התחום וחלולה כשהיא מחוצה לו.`
            : setup.mode === 'power'
              ? `איור חי: החזקות z, z בריבוע, עד z בחזקת ${nn}, מחוברות לפי הסדר. הגודל מוכפל והזווית מוכפלת בכל צעד.`
              : setup.mode === 'roots'
                ? `איור חי: ${nn} השורשים של המשוואה z בחזקת ${nn} שווה w הם קודקודי מצולע משוכלל על מעגל ברדיוס ${fmt(Math.pow(cabs(w), 1 / nn))}.`
                : setup.mode === 'quadratic'
                  ? `איור חי: שורשי המשוואה z בריבוע ועוד b z ועוד c, עם b = ${fmt(setup.qb)} ו-c = ${fmt(setup.qc)}. הדיסקרימיננטה ${fmt(quad.disc)}.`
                  : setup.mode === 'rotate'
                    ? `איור חי: החץ Ã כפול e בחזקת iωt מסתובב, והצל שלו על הציר הממשי הוא התנודה, באמפליטודה ${fmt(cabs(amp))}.`
                    : `איור חי: שתי תנודות באותה תדירות כחצים ראש לזנב. האמפליטודה של הסכום ${fmt(sumA)}.`;

  const tReadout = (
    <span class="q" data-readout="t">
      t = <b>{fmt(roundTo(playing ? tNow.current : setup.t, 0.05))} s</b>
    </span>
  );
  const M = (p: { children: ComponentChildren }) => <bdi dir="ltr">{p.children}</bdi>;
  const argNote = cabs(z) < 1e-9 ? ' (לא מוגדרת ב-0)' : '';

  let readout: ComponentChildren;
  if (setup.mode === 'add') {
    const sm = cadd(z, w);
    readout = (
      <>
        <span class="q" data-readout="sum">
          <M>
            ({cstr(z)}) + ({cstr(w)}) = <b>{cstr(sm)}</b>
          </M>
        </span>
        <span class="q" data-readout="parts">
          <M>
            Re = {fmt(z.re)} + {fmt(w.re)} = <b>{fmt(sm.re)}</b>, Im = {fmt(z.im)} + {fmt(w.im)} = <b>{fmt(sm.im)}</b>
          </M>
        </span>
        {setup.sub && (
          <>
            <span class="q" data-readout="diff">
              <M>
                z − w = <b>{cstr(csub(z, w))}</b>
              </M>
            </span>
            <span class="q" data-readout="dist">
              המרחק בין z ל-w: <M>|z − w| = <b>{fmt(cabs(csub(z, w)))}</b></M>
            </span>
          </>
        )}
      </>
    );
  } else if (setup.mode === 'polar') {
    const naive = z.re === 0 ? null : Math.atan(z.im / z.re);
    const differs = naive !== null && cabs(z) > 1e-9 && Math.abs(naive - carg(z)) > 1e-9;
    readout = (
      <>
        <span class="q" data-readout="z">
          <M>
            z = <b>{cstr(z)}</b>
          </M>
        </span>
        <span class="q" data-readout="mod">
          <M>
            |z| = <b>{fmt(cabs(z))}</b>
          </M>
        </span>
        <span class="q" data-readout="arg">
          <M>
            Arg z = <b>{angStr(cabs(z) > 1e-9 ? carg(z) : 0)}</b>
          </M>
          {argNote}
        </span>
        <span class="q" data-readout="atan">
          <M>
            arctan(y/x) = <b>{naive === null ? '—' : angStr(naive)}</b>
          </M>
          {differs ? ' (שונה מ-Arg z)' : ''}
        </span>
        {setup.conj && (
          <span class="q" data-readout="conj">
            <M>
              z̄ = <b>{cstr(conj(z))}</b>, zz̄ = <b>{fmt(cabs(z) ** 2)}</b>
            </M>
          </span>
        )}
      </>
    );
  } else if (setup.mode === 'multiply') {
    readout = (
      <>
        <span class="q" data-readout="zw">
          <M>
            ({cstr(z)})({cstr(w)}) = <b>{cstr(zw)}</b>
          </M>
        </span>
        <span class="q" data-readout="mods">
          <M>
            |z||w| = {fmt(cabs(z))}·{fmt(cabs(w))} = <b>{fmt(cabs(zw))}</b>
          </M>
        </span>
        <span class="q" data-readout="args">
          <M>
            arg z + arg w = {fmt(argDeg(z))}° + {fmt(argDeg(w))}° = <b>{fmt(argDeg(z) + argDeg(w))}°</b>
          </M>
        </span>
        <span class="q" data-readout="argzw">
          <M>
            Arg zw = <b>{fmt(argDeg(zw))}°</b>
            {cabs(zw) > 1e-9 && Math.round((argDeg(z) + argDeg(w) - argDeg(zw)) / 360) !== 0 && (
              <>
                {' '}
                (= {fmt(argDeg(z) + argDeg(w))}° {argDeg(z) + argDeg(w) > argDeg(zw) ? '−' : '+'} 360°)
              </>
            )}
          </M>
        </span>
        {setup.div && (
          <span class="q" data-readout="div">
            <M>
              z/w = <b>{cabs(w) > 0 ? cstr(zdw) : '—'}</b>
              {cabs(w) > 0 && <>, |z/w| = <b>{fmt(cabs(zdw))}</b></>}
            </M>
          </span>
        )}
      </>
    );
  } else if (setup.mode === 'region') {
    const d = regionBoundaryDistance(spec, qz);
    const rel = (() => {
      const dc = cabs(csub(qz, spec.a));
      switch (setup.region) {
        case 'disk':
          return `|q − a| = ${fmt(dc)} ${dc <= setup.r + 1e-9 ? '≤' : '>'} ${fmt(setup.r)}`;
        case 'circle':
          return `|q − a| = ${fmt(dc)}, r = ${fmt(setup.r)}`;
        case 'annulus':
          return `${fmt(setup.r)} < |q − a| = ${fmt(dc)} < ${fmt(setup.r2)}`;
        case 'sector':
          // a sector that crosses the direction π (α > β) is two pieces of (−180°, 180°], never "α ≤ Arg z ≤ β"
          const cond =
            setup.alphaDeg <= setup.betaDeg
              ? `${fmt(setup.alphaDeg)}° ≤ Arg z ≤ ${fmt(setup.betaDeg)}°`
              : `Arg z ≥ ${fmt(setup.alphaDeg)}° או Arg z ≤ ${fmt(setup.betaDeg)}°`;
          return `Arg q = ${cabs(qz) > 1e-9 ? fmt(argDeg(qz)) : '—'}°, ${cond}`;
        case 'halfplane-re':
          return `Re q = ${fmt(qz.re)}, Re z > ${fmt(setup.c)}`;
        case 'halfplane-im':
          return `Im q = ${fmt(qz.im)}, Im z > ${fmt(setup.c)}`;
        case 'bisector':
          return `|q − a| = ${fmt(cabs(csub(qz, spec.a)))}, |q − b| = ${fmt(cabs(csub(qz, spec.b)))}`;
      }
    })();
    const inside = inRegion(spec, qz, 0.05);
    readout = (
      <>
        <span class="q" data-readout="kind">
          {KIND_LABEL[setup.region]}
        </span>
        <span class="q" data-readout="q">
          <M>
            q = <b>{cstr(qz)}</b>
          </M>
        </span>
        <span class="q" data-readout="test">
          <M>{rel}</M>
        </span>
        <span class="q" data-readout="verdict">
          <b>{d < 0.05 ? (inside ? 'q על השפה, והיא שייכת לקבוצה' : 'q על השפה, והיא לא שייכת לקבוצה') : inside ? 'q בפנים (נקודה מלאה)' : 'q בחוץ (נקודה חלולה)'}</b>
        </span>
      </>
    );
  } else if (setup.mode === 'power') {
    const th = cabs(z) > 1e-9 ? carg(z) : 0;
    const zn = cpowers(z, nn)[nn - 1];
    readout = (
      <>
        <span class="q" data-readout="z">
          <M>
            z = <b>{cstr(z)}</b>, |z| = <b>{fmt(cabs(z))}</b>, Arg z = <b>{angStr(th)}</b>
          </M>
        </span>
        <span class="q" data-readout="rn">
          <M>
            |z|{sup(nn)} = <b>{fmt(Math.pow(cabs(z), nn))}</b>
          </M>
        </span>
        <span class="q" data-readout="ntheta">
          <M>
            {nn}θ = <b>{angStr(nn * th)}</b>
          </M>
        </span>
        <span class="q" data-readout="zn">
          <M>
            z{sup(nn)} = <b>{cstr(zn)}</b>
          </M>
          {Math.abs(zn.im) <= 1e-6 * Math.max(1, cabs(zn)) && Math.abs(z.im) > 1e-6 ? ' (ממשי)' : ''}
        </span>
      </>
    );
  } else if (setup.mode === 'roots') {
    const rho = Math.pow(cabs(w), 1 / nn);
    const r0 = croots(w, nn)[0];
    readout = (
      <>
        <span class="q" data-readout="w">
          <M>
            w = <b>{cstr(w)}</b>, |w| = <b>{fmt(cabs(w))}</b>, Arg w = <b>{cabs(w) > 1e-9 ? angStr(carg(w)) : '0'}</b>
          </M>
        </span>
        <span class="q" data-readout="radius">
          <M>
            |w|^(1/{nn}) = <b>{fmt(rho)}</b>
          </M>
        </span>
        <span class="q" data-readout="angle">
          <M>
            Arg w / {nn} = <b>{angStr(cabs(w) > 1e-9 ? carg(w) / nn : 0)}</b>
          </M>
        </span>
        <span class="q" data-readout="step">
          הזווית בין שורשים סמוכים:{' '}
          <M>
            2π/{nn} = <b>{angStr(TAU / nn)}</b>
          </M>
        </span>
        <span class="q" data-readout="principal">
          השורש הראשי:{' '}
          <M>
            z{sub(0)} = <b>{cstr(r0)}</b>
          </M>
        </span>
      </>
    );
  } else if (setup.mode === 'quadratic') {
    const [r1, r2] = quad.roots;
    const bt = setup.qb < 0 ? `− ${fmt(-setup.qb)}z` : `+ ${fmt(setup.qb)}z`;
    const ct = setup.qc < 0 ? `− ${fmt(-setup.qc)}` : `+ ${fmt(setup.qc)}`;
    readout = (
      <>
        <span class="q" data-readout="eq">
          <M>
            z² {bt} {ct} = 0
          </M>
        </span>
        <span class="q" data-readout="disc">
          <M>
            Δ = b² − 4c = <b>{fmt(quad.disc)}</b>
          </M>
        </span>
        <span class="q" data-readout="roots">
          {Math.abs(quad.disc) < 1e-9 ? (
            <>
              שורש כפול:{' '}
              <M>
                z = <b>{fmt(r1.re)}</b>
              </M>
            </>
          ) : quad.disc > 0 ? (
            <>
              שני שורשים ממשיים:{' '}
              <M>
                z₁ = <b>{fmt(r1.re)}</b>, z₂ = <b>{fmt(r2.re)}</b>
              </M>
            </>
          ) : (
            <>
              זוג צמוד:{' '}
              <M>
                z₁ = <b>{cstr(r1)}</b>, z₂ = <b>{cstr(r2)}</b>
              </M>
            </>
          )}
        </span>
      </>
    );
  } else if (setup.mode === 'rotate') {
    readout = (
      <>
        <span class="q" data-readout="amp">
          <M>
            Ã = <b>{cstr(amp)}</b>
          </M>
        </span>
        <span class="q" data-readout="x">
          <M>
            x(t) = <b>{fmt(cabs(amp))} cos(t {phaseRad < 0 ? '−' : '+'} {fmt(Math.abs(phaseRad))})</b>
          </M>
        </span>
        {tReadout}
      </>
    );
  } else {
    readout = (
      <>
        <span class="q" data-readout="sum">
          <M>
            |Ã₁ + Ã₂| = <b>{fmt(sumA)}</b>
          </M>
        </span>
        <span class="q" data-readout="phase">
          <M>
            arg(Ã₁ + Ã₂) = <b>{sumA < 1e-6 ? '—' : `${fmt(sumPhase)}°`}</b>
          </M>
        </span>
        {tReadout}
      </>
    );
  }

  return (
    <SimShell
      fig={props.id}
      label={label}
      canvasRef={canvasRef}
      aspect={aspect}
      live={live}
      tasks={tasks}
      cursor={setup.mode === 'sum' || setup.mode === 'quadratic' ? 'default' : 'grab'}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onReset={() => {
        const init = initial();
        learnerSub.current = false;
        commit(init);
        rebase(init);
        setPlaying(false);
        setSelected(null);
        t0.current = null;
        tNow.current = init.t;
        setLive('האיור חזר למצב ההתחלה.');
      }}
      readout={readout}
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
                    stop();
                    setSelected(null);
                    apply({ mode: m });
                  }}
                />
              ))}
            </div>
          )}
          {setup.mode === 'add' && (
            <div class="group" role="group" aria-label="מה להציג">
              <Toggle label={<bdi dir="ltr">z − w</bdi>} on={setup.sub} swatch="var(--eps)" onChange={(on) => apply({ sub: on })} />
            </div>
          )}
          {setup.mode === 'polar' && (
            <div class="group" role="group" aria-label="מה להציג">
              <Toggle label="צמוד" on={setup.conj} swatch="var(--equip)" onChange={(on) => apply({ conj: on })} />
            </div>
          )}
          {setup.mode === 'multiply' && (
            <>
              <div class="group" role="group" aria-label="מה להציג">
                <Toggle label={<bdi dir="ltr">z/w</bdi>} on={setup.div} swatch="var(--eps)" onChange={(on) => apply({ div: on })} />
              </div>
              <div class="group" role="group" aria-label="ערכים מוכנים של w">
                <button type="button" class="btn" onClick={() => apply({ w: [0, 1] })}>
                  <bdi dir="ltr">w = i</bdi>
                </button>
                <button type="button" class="btn" onClick={() => apply({ w: [-1, 0] })}>
                  <bdi dir="ltr">w = −1</bdi>
                </button>
                <button type="button" class="btn" onClick={() => apply({ w: [clamp(setup.z[0], -LIM_MULT_W, LIM_MULT_W), clamp(-setup.z[1], -LIM_MULT_W, LIM_MULT_W)] })}>
                  <bdi dir="ltr">w = z̄</bdi>
                </button>
              </div>
            </>
          )}
          {setup.mode === 'power' && (
            <>
              <Slider label="החזקה הגבוהה n" value={nn} min={1} max={12} step={1} format={(x) => String(Math.round(x))} onChange={(v) => apply({ n: clamp(Math.round(v), 1, 12) })} />
              <div class="group" role="group" aria-label="מה להציג">
                <Toggle label="מעגל היחידה" on={setup.unit} swatch="var(--ink-3)" onChange={(on) => apply({ unit: on })} />
              </div>
            </>
          )}
          {setup.mode === 'roots' && (
            <>
              <Slider label="מספר השורשים n" value={nn} min={2} max={12} step={1} format={(x) => String(Math.round(x))} onChange={(v) => apply({ n: clamp(Math.round(v), 2, 12) })} />
              <div class="group" role="group" aria-label="מה להציג">
                <Toggle label="מעגל היחידה" on={setup.unit} swatch="var(--ink-3)" onChange={(on) => apply({ unit: on })} />
              </div>
            </>
          )}
          {setup.mode === 'quadratic' && (
            <>
              <Slider label="המקדם b" value={setup.qb} min={-4} max={4} step={Q_STEP} format={(x) => fmt(x)} onChange={(v) => apply({ qb: clamp(roundTo(v, Q_STEP), -4, 4) })} />
              <Slider label="המקדם c" value={setup.qc} min={-4} max={C_MAX} step={Q_STEP} format={(x) => fmt(x)} onChange={(v) => apply({ qc: clamp(roundTo(v, Q_STEP), -4, C_MAX) })} />
            </>
          )}
          {setup.mode === 'rotate' && (
            <div class="group" role="group" aria-label="מה להציג">
              <Toggle label="מהירות" on={setup.vel} swatch="var(--delta)" onChange={(on) => apply({ vel: on })} />
            </div>
          )}
          {setup.mode === 'sum' && (
            <>
              <Slider label="האמפליטודה A₁" value={setup.A1} min={0} max={2.5} step={0.25} format={(x) => fmt(x)} onChange={(v) => apply({ A1: clamp(roundTo(v, 0.25), 0, 2.5) })} />
              <Slider label="האמפליטודה A₂" value={setup.A2} min={0} max={2.5} step={0.25} format={(x) => fmt(x)} onChange={(v) => apply({ A2: clamp(roundTo(v, 0.25), 0, 2.5) })} />
              <Slider label="הפרש הפאזה Δφ" value={setup.dphiDeg} min={0} max={360} step={15} format={(x) => `${fmt(x)}°`} onChange={(v) => apply({ dphiDeg: clamp(roundTo(v, 15), 0, 360) })} />
            </>
          )}
          {isSplit && (
            <>
              <Slider
                label="הזמן t"
                value={roundTo(playing ? tNow.current : setup.t, 0.05)}
                min={0}
                max={roundTo(T_MAX, 0.05)}
                step={0.05}
                format={(x) => `${fmt(x)} s`}
                onChange={(v) => {
                  setPlaying(false);
                  t0.current = null;
                  apply({ t: clamp(roundTo(v, 0.05), 0, T_MAX) });
                }}
              />
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
        </>
      }
    />
  );
}
