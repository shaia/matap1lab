/**
 * AntiLab (chapter 7.1 and 7.6, the antiderivative): three modes. Maths: src/math/antideriv.ts, whose STORED closed forms
 * (F, the candidates' derivatives dG, the verdict `correct`, the constants between correct candidates) drive every curve
 * and verdict; nothing is decided by sampling. Canvases are math space and stay LTR (x to the right, y up); sliders for
 * math quantities are `dir="ltr"`. Nothing moves by itself (no animation), so there is no motion for motionAllowed() to
 * gate. Panels are stacked in one canvas (top, bottom, and in `check` with a comparison a third), so they also stack on
 * a phone (390 px) without sideways scroll.
 *
 * mode 'family' (button "משפחת קדומות"): preset f of AD (poly, cos, sin, exp, recip, lorentz; not gauss).
 *     top panel     the members F + k for k = −3…3 faint, and the chosen F + C bold (accent); at the probe x a short
 *                   tangent segment on EVERY member (all parallel, slope f(x)); for `recip` the left piece (x < 0) has its
 *                   own constant C₂ (slider shown only for recip), so the two branches are independent;
 *     bottom panel  f with the point (x, f(x)) and a dashed guide from the top panel's probe line.
 *     with `through`: a draggable point (x₀, y₀) (ring) on the top panel; the readout says "הפונקציה הקדומה שעוברת דרך
 *                   הנקודה: C = …" only when the bold member passes within 0.02 of it, else "C = … עדיין לא עוברת".
 *     The probe x is dragged on either panel (canvas), moved with ←/→, or set by the slider. A drag that starts within
 *     16 px of the through point drags the point instead.
 * mode 'area' (button "פונקציית השטח"): preset f of AD (all, with gauss).
 *     top panel     f with the signed area from a to x shaded: above the axis solid fill (--pos), below the axis hatched
 *                   (--neg), so the sign is never colour alone; handles on the axis: a (ring) and x (filled disc), dragged
 *                   (the nearer one moves) or set by sliders; a and x always lie in one piece of the domain (1/x: x never
 *                   crosses 0, the readout says so). With `strip`: the thin strip [x, x + dx] under f outlined.
 *     bottom panel  the area function A(t) = ∫ₐᵗ f (accent) with its tangent at x (slope f(x)); with `showF` the dashed
 *                   curve F(t) − F(a) (--limit) lies exactly over it. For `gauss` there is no F: the readout says so.
 *     A is signed: for x < a it is −(pos − neg), where pos / neg are the areas above / below the axis over [x, a].
 * mode 'check' (button "בדיקה בגזירה"): preset f of CHK (x-sinx, 2sincos, asin, atan, recip2).
 *     top panel     f (--curve) and the derivative dG of the chosen candidate (accent, dashed): they coincide exactly
 *                   when the candidate is correct;
 *     bottom panel  the candidate G itself (accent); with `compare` the second candidate (dashed) too, and a third panel
 *                   with the difference G₁ − G₂ (flat = a constant; for `atan` a step: a different constant on each piece).
 *
 * Props (defaults): id (required); mode ('family'); modes (the mode buttons shown; default the starting mode only);
 * tasks ([]). f (an AD id for family / area, a CHK id for check; defaults per preset registry: 'poly' for family and
 * area, 'x-sinx' for check); C (0), C2 (0), x (family: the preset's probe poly 1, cos 1, sin 1, exp 0, recip 2, lorentz 1;
 * area: the preset's x0), through (false), x0 / y0 (the preset's point: poly (1, 2), cos (0, 1), sin (0, 0), exp (0, 3),
 * recip (1, 2), lorentz (0, 1)), a (the preset's a0: 0, except exp −1 and recip 1), strip (false), dx (0.3; 0.005…1),
 * showF (false), cand (0, the index of the candidate), compare (null, or an index ≠ cand).
 * Every prop is also a step key (`<Step fig=… set={{…}}>`); a key left out keeps its value; a new preset `f` without `x`
 * (or `a`, `x0`, `y0`) puts those at that preset's defaults; `x` addresses the probe in family and the right end x of the
 * area in area. A step that sets `f` applies it to the family and area modes alike (gauss only to area), and to check when
 * it is a CHK id (then cand 0, compare null unless given). A state set by a step never ticks a task, and a state that
 * already had a task's property when a step or reset made it must be left and found again.
 * The learner can also pick the function from a list (select "הפונקציה": the presets of the current mode).
 *
 * Tasks (ticked only inside the learner's own drag, key, slider, select or toggle):
 *   family: family-parallel (the probe x moved ≥ 0.5 from where a step or reset put it), family-through (through on, the
 *           learner's C or C₂ makes the bold member pass within 0.02 of the point), family-split (preset recip, the
 *           learner changes C₂ while C stays, so that |C₂ − C| ≥ 0.2: two constants)
 *   area:   area-flat (the learner drags x within 0.05 of a zero of f where f changes sign: poly ±√(2/3), cos π/2 + kπ,
 *           sin kπ), area-strip (strip on, the learner shrinks dx to ≤ 0.02 with strip area / dx within 1% of f(x), plus
 *           an absolute 0.001 so a value near 0 can pass), area-negative (the learner drags so that x > a and the area
 *           below the axis is larger than the area above: A < 0)
 *   check:  check-wrong (the learner selects a wrong candidate), check-constant (compare is on with two correct
 *           candidates, set by the learner), check-pieces (preset atan, compare between arctan x and −arctan(1/x), in
 *           either order, set by the learner)
 *
 * Hooks for e2e specs (inside `#<id>`; numbers use U+2212 for minus):
 *   buttons by role and name: the mode buttons "משפחת קדומות", "פונקציית השטח", "בדיקה בגזירה"; the toggles "נקודה נתונה"
 *     (family), "פס צר" and "הצגת F(x) − F(a)" (area, the latter not for gauss), "השוואה בין שתי תשובות" (check);
 *     "איפוס" (reset)
 *   [data-control="preset"] select    the function (option values are the preset ids)
 *   [data-control=…] input / select   family: x (value = x, step 0.01), c (C, −3…3 step 0.01), c2 (recip only), x0, y0 (with
 *                                     through); area: a, x (step 0.01), dx (with strip; value = log10 dx, −2.3…0, step
 *                                     0.01: −2.3 is 0.005, −1 is 0.1); check: cand (select, values 0, 1, …), compare (select,
 *                                     with compare on; values are indexes)
 *   canvas                            drag moves the probe (family) or the nearer handle (area); ←/→ move the probe / x
 *   [data-readout=…]                  family: fn, x, fx, c (C and, for recip, C₂), through (with through)
 *                                     area: fn, a, x, area, parts, fx, strip (with strip), showf (with showF), gauss-note
 *                                     (gauss only)
 *                                     check: fn, cand, deriv, verdict, why (a wrong candidate), diff (with compare)
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import {
  AD,
  AD_IDS,
  CHK,
  CHK_IDS,
  FAMILY_IDS,
  areaFn,
  candPieces,
  diffOf,
  isAdId,
  isChkId,
  isFamilyId,
  nearestZero,
  pieceIndex,
  signedParts,
  stripArea,
  type AdId,
  type ChkId,
  type Fn,
  type Piece,
} from '~/math/antideriv';
import { markTask } from '~/progress/store';
import { subscribeSteps, type StepState } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { sci } from './core/format';
import { withAlpha } from './core/ink';
import { drawAxes, makePlot, type Box, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import './AntiLab.css';

export type AntiMode = 'family' | 'area' | 'check';

export interface AntiLabProps {
  id: string;
  mode?: AntiMode;
  /** the mode buttons shown (default: the starting mode only) */
  modes?: AntiMode[];
  /** an AD preset id (family, area) or a CHK preset id (check) */
  f?: string;
  C?: number;
  C2?: number;
  x?: number;
  through?: boolean;
  x0?: number;
  y0?: number;
  a?: number;
  strip?: boolean;
  dx?: number;
  showF?: boolean;
  cand?: number;
  compare?: number | null;
  tasks?: string[];
}

interface Setup {
  mode: AntiMode;
  pF: AdId;
  pA: AdId;
  pC: ChkId;
  C: number;
  C2: number;
  x: number;
  through: boolean;
  x0: number;
  y0: number;
  a: number;
  xa: number;
  strip: boolean;
  dx: number;
  showF: boolean;
  cand: number;
  compare: number | null;
}

const ltr = (s: string) => String.fromCharCode(0x2066) + s.replace(/ /g, String.fromCharCode(0xa0)) + String.fromCharCode(0x2069);

const TASK_LABEL: Record<string, string> = {
  'family-parallel': 'גררו את הנקודה x. מה משותף לשיפועים של כל הפונקציות הקדומות באותו x?',
  'family-through': 'הדליקו "נקודה נתונה" וכוונו את הקבוע C עד שהפונקציה המודגשת עוברת דרך הנקודה (בטווח 0.02).',
  'family-split': `בפונקציה ${ltr('1/x')} שנו את ${ltr('C₂')} כשה-${ltr('C')} נשאר. האם שני הקבועים חייבים להיות שווים?`,
  'area-flat': `גררו את x אל נקודה ש-${ltr('f')} מתאפסת בה ומחליפה סימן. מה קורה למשיק של פונקציית השטח שם?`,
  'area-strip': `הדליקו "פס צר" וכווצו את ${ltr('dx')} עד ${ltr('0.02')} או פחות. למה שווה שטח הפס חלקי ${ltr('dx')}?`,
  'area-negative': `גררו את x ימינה עד שהשטח מתחת לציר גדול מהשטח מעליו, כך ש-${ltr('A(x)')} שלילי.`,
  'check-wrong': 'בחרו תשובה שגויה. מה הנגזרת שלה, ולמה היא שונה מ-f?',
  'check-constant': 'הדליקו השוואה בין שתי תשובות נכונות. מה ההפרש ביניהן?',
  'check-pieces': `בפונקציה ${ltr('1/(1 + x²)')} השוו בין ${ltr('arctan x')} ל-${ltr('−arctan(1/x)')}. מה ההפרש משני צדי ${ltr('x = 0')}?`,
};

const MODE_LABEL: Record<AntiMode, string> = { family: 'משפחת קדומות', area: 'פונקציית השטח', check: 'בדיקה בגזירה' };

const FAM_PAD = 3.3;
const TOOLS_W = 84;
const MEMBERS = [-3, -2, -1, 0, 1, 2, 3];
const PROBE_MIN = 0.05;
const DX_MIN = 0.005;
const DX_E_MIN = -2.3;
const THROUGH_TOL = 0.02;
const GRAB = 16;
const TAU = 2 * Math.PI;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const bool = (x: unknown): boolean | null => (typeof x === 'boolean' ? x : null);
const roundTo = (x: number, step: number) => Number((Math.round(x / step) * step).toPrecision(10));
const minus = (s: string) => s.replace(/-/g, '−');
const fmt = (x: number, sig = 4) => (Number.isNaN(x) ? '—' : Math.abs(x) < 1e-9 ? '0' : minus(sci(x, sig)));
const dxOfE = (e: number) => (e <= DX_E_MIN + 1e-9 ? DX_MIN : clamp(10 ** e, DX_MIN, 1));
const eOfDx = (dx: number) => Math.max(DX_E_MIN, Math.log10(dx));

/** x kept in the window and at least PROBE_MIN from every finite break of the domain */
function fixX(id: AdId, x: number): number {
  const s = AD[id];
  let v = clamp(x, s.window.x[0], s.window.x[1]);
  for (const [lo, hi] of s.pieces)
    for (const b of [lo, hi]) {
      if (!Number.isFinite(b) || Math.abs(v - b) >= PROBE_MIN) continue;
      v = v >= b ? b + PROBE_MIN : b - PROBE_MIN;
    }
  return clamp(v, s.window.x[0], s.window.x[1]);
}
/** v kept inside the piece that holds `ref` */
function inPieceOf(id: AdId, ref: number, v: number): number {
  const s = AD[id];
  const k = pieceIndex(s.pieces, ref);
  const w = fixX(id, v);
  if (k < 0) return w;
  const [lo, hi] = s.pieces[k];
  return clamp(w, Math.max(lo, s.window.x[0]) + (Number.isFinite(lo) ? PROBE_MIN : 0), Math.min(hi, s.window.x[1]) - (Number.isFinite(hi) ? PROBE_MIN : 0));
}
/** the constant of the piece of `recip` that holds x: the left piece has C₂ */
const constOf = (s: Setup, x: number): number => (s.pF === 'recip' && x < 0 ? s.C2 : s.C);
const famY = (id: AdId): [number, number] => [AD[id].window.yF[0] - FAM_PAD, AD[id].window.yF[1] + FAM_PAD];

/** the default "other" candidate of a comparison: another correct one when the chosen one is correct */
function defaultCompare(id: ChkId, cand: number): number | null {
  const cs = CHK[id].cands;
  const others = cs.map((_, k) => k).filter((k) => k !== cand);
  return others.find((k) => cs[k].correct === cs[cand].correct) ?? others[0] ?? null;
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

/** x samples of [lo, hi], dense towards an end that is a break of the domain, never touching it */
function samples(lo: number, hi: number, breakLo: boolean, breakHi: boolean, n: number): number[] {
  const xs: number[] = [];
  const eps = (hi - lo) * 1e-9;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let x = breakLo && !breakHi ? lo + (hi - lo) * t * t : breakHi && !breakLo ? hi - (hi - lo) * (1 - t) * (1 - t) : lo + (hi - lo) * t;
    if (i === 0 && breakLo) x = lo + eps;
    if (i === n && breakHi) x = hi - eps;
    xs.push(x);
  }
  return xs;
}

/** f on each piece of the domain inside the window, clipped to the plot; two pieces are never joined */
function strokePieces(ctx: CanvasRenderingContext2D, plot: Plot, f: Fn, pieces: readonly Piece[], color: string, width: number, dash: number[] = []) {
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
  for (const [plo, phi] of pieces) {
    const lo = Math.max(plo, plot.x.min);
    const hi = Math.min(phi, plot.x.max);
    if (!(hi > lo)) continue;
    ctx.beginPath();
    let started = false;
    for (const x of samples(lo, hi, lo === plo, hi === phi, 500)) {
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

/** a short segment of slope m through (x, y), half-width hw in x, clipped to the plot */
function tangentSeg(ctx: CanvasRenderingContext2D, plot: Plot, x: number, y: number, m: number, hw: number, color: string, width: number) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.box.x, plot.box.y, plot.box.w, plot.box.h);
  ctx.clip();
  line(ctx, plot.px(x - hw), plot.py(y - m * hw), plot.px(x + hw), plot.py(y + m * hw), color, width);
  ctx.restore();
}

/** the area between the graph of f and the axis over [lo, hi]: above the axis a solid fill (--pos), below it a hatched one
 * (--neg), so the sign shows in the pattern and not in the colour alone */
function shadeRegion(ctx: CanvasRenderingContext2D, p: Palette, plot: Plot, f: Fn, lo: number, hi: number, outline: boolean) {
  if (!(hi > lo)) return;
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
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
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
  if (outline) {
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 1.8;
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

/** "x < 0", "x > 0", "−1 < x < 1" for a piece of the domain; "" for the whole line */
function pieceText([lo, hi]: Piece): string {
  const t = (v: number) => minus(String(Number(v.toPrecision(4))));
  if (lo === -Infinity && hi === Infinity) return '';
  if (lo === -Infinity) return `x < ${t(hi)}`;
  if (hi === Infinity) return `x > ${t(lo)}`;
  return `${t(lo)} < x < ${t(hi)}`;
}
const intersect = (A: readonly Piece[], B: readonly Piece[]): Piece[] => {
  const out: Piece[] = [];
  for (const [a0, a1] of A) for (const [b0, b1] of B) if (Math.max(a0, b0) < Math.min(a1, b1)) out.push([Math.max(a0, b0), Math.min(a1, b1)]);
  return out;
};

interface Rule {
  needs: (keyof Setup)[];
  event?: boolean;
  state: (s: Setup, patch: Partial<Setup>) => boolean;
}

export default function AntiLab(props: AntiLabProps) {
  const startMode: AntiMode = props.mode ?? 'family';
  const modes: AntiMode[] = props.modes ?? [startMode];
  const initial = (): Setup => {
    const pF: AdId = isFamilyId(props.f) ? props.f : 'poly';
    const pA: AdId = isAdId(props.f) ? props.f : 'poly';
    const pC: ChkId = isChkId(props.f) ? props.f : 'x-sinx';
    const sF = AD[pF];
    const sA = AD[pA];
    const a = inPieceOf(pA, sA.x0, props.a ?? sA.a0);
    const cand = clamp(Math.round(props.cand ?? 0), 0, CHK[pC].cands.length - 1);
    const cmp = props.compare ?? null;
    return {
      mode: startMode,
      pF,
      pA,
      pC,
      C: clamp(props.C ?? 0, -3, 3),
      C2: clamp(props.C2 ?? 0, -3, 3),
      x: fixX(pF, props.x ?? sF.probe),
      through: props.through ?? false,
      x0: fixX(pF, props.x0 ?? sF.through[0]),
      y0: clamp(props.y0 ?? sF.through[1], famY(pF)[0], famY(pF)[1]),
      a,
      xa: inPieceOf(pA, a, props.x ?? sA.x0),
      strip: props.strip ?? false,
      dx: clamp(props.dx ?? 0.3, DX_MIN, 1),
      showF: props.showF ?? false,
      cand,
      compare: cmp !== null && cmp !== cand && cmp >= 0 && cmp < CHK[pC].cands.length ? cmp : null,
    };
  };
  const [setup, setSetup] = useState<Setup>(initial);
  const cur = useRef(setup);
  const [live, setLive] = useState('');
  const [narrow, setNarrow] = useState(false);
  const plots = useRef<Plot[]>([]);
  const dragging = useRef<'x' | 'pt' | 'a' | 'xa' | null>(null);
  /** the family probe x that a step, a reset or the start put: family-parallel measures from it */
  const anchor = useRef(setup.x);
  /** tasks whose state held when the last step or reset made it: they must be left and found again */
  const held = useRef<Set<string>>(new Set());

  const RULES: Record<string, Rule> = {
    'family-parallel': { needs: ['x'], state: (s) => s.mode === 'family' && Math.abs(s.x - anchor.current) >= 0.5 - 1e-9 },
    'family-through': {
      needs: ['C', 'C2'],
      state: (s) => {
        if (s.mode !== 'family' || !s.through || pieceIndex(AD[s.pF].pieces, s.x0) < 0) return false;
        return Math.abs(AD[s.pF].F(s.x0) + constOf(s, s.x0) - s.y0) <= THROUGH_TOL + 1e-9;
      },
    },
    'family-split': {
      needs: ['C2'],
      event: true,
      state: (s, p) => s.mode === 'family' && s.pF === 'recip' && p.C2 !== undefined && !('C' in p) && Math.abs(s.C2 - s.C) >= 0.2 - 1e-9,
    },
    'area-flat': {
      needs: ['xa'],
      state: (s) => {
        if (s.mode !== 'area') return false;
        const z = nearestZero(s.pA, s.xa);
        return !!z && z.d <= 0.05 + 1e-9;
      },
    },
    'area-strip': {
      needs: ['dx'],
      state: (s) => {
        if (s.mode !== 'area' || !s.strip || s.dx > 0.02 + 1e-9) return false;
        const r = stripArea(s.pA, s.xa, s.dx) / s.dx;
        const fx = AD[s.pA].f(s.xa);
        return Number.isFinite(r) && Math.abs(r - fx) <= 0.01 * Math.abs(fx) + 0.001;
      },
    },
    'area-negative': {
      needs: ['xa', 'a'],
      state: (s) => {
        if (s.mode !== 'area' || !(s.xa > s.a)) return false;
        const { pos, neg } = signedParts(s.pA, s.a, s.xa);
        return neg > pos + 1e-9;
      },
    },
    'check-wrong': { needs: ['cand'], event: true, state: (s, p) => s.mode === 'check' && p.cand !== undefined && !CHK[s.pC].cands[s.cand].correct },
    'check-constant': {
      needs: ['compare', 'cand'],
      state: (s) => s.mode === 'check' && s.compare !== null && CHK[s.pC].cands[s.cand].correct && CHK[s.pC].cands[s.compare].correct,
    },
    'check-pieces': {
      needs: ['compare', 'cand'],
      state: (s) => s.mode === 'check' && s.pC === 'atan' && s.compare !== null && Math.min(s.cand, s.compare) === 0 && Math.max(s.cand, s.compare) === 1,
    },
  };

  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const done = (t: string) => {
    if (props.tasks?.includes(t)) markTask(`${props.id}:${t}`);
  };
  const rebase = (s: Setup) => {
    anchor.current = s.x;
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
        const mode = typeof st.mode === 'string' && modes.includes(st.mode as AntiMode) ? (st.mode as AntiMode) : prev.mode;
        const next: Setup = { ...prev, mode };
        const newF = isFamilyId(st.f) && st.f !== prev.pF;
        const newA = isAdId(st.f) && st.f !== prev.pA;
        const newC = isChkId(st.f) && st.f !== prev.pC;
        if (isFamilyId(st.f)) next.pF = st.f;
        if (isAdId(st.f)) next.pA = st.f;
        if (isChkId(st.f)) next.pC = st.f;
        next.C = clamp(num(st.C) ?? prev.C, -3, 3);
        next.C2 = clamp(num(st.C2) ?? prev.C2, -3, 3);
        const sx = num(st.x);
        next.x = fixX(next.pF, mode === 'family' && sx !== null ? sx : newF ? AD[next.pF].probe : prev.x);
        next.through = bool(st.through) ?? prev.through;
        next.x0 = fixX(next.pF, num(st.x0) ?? (newF ? AD[next.pF].through[0] : prev.x0));
        next.y0 = clamp(num(st.y0) ?? (newF ? AD[next.pF].through[1] : prev.y0), famY(next.pF)[0], famY(next.pF)[1]);
        next.a = inPieceOf(next.pA, newA ? AD[next.pA].x0 : prev.a, num(st.a) ?? (newA ? AD[next.pA].a0 : prev.a));
        next.xa = inPieceOf(next.pA, next.a, mode === 'area' && sx !== null ? sx : newA ? AD[next.pA].x0 : prev.xa);
        next.strip = bool(st.strip) ?? prev.strip;
        next.dx = clamp(num(st.dx) ?? prev.dx, DX_MIN, 1);
        next.showF = bool(st.showF) ?? prev.showF;
        const nc = CHK[next.pC].cands.length;
        next.cand = clamp(Math.round(num(st.cand) ?? (newC ? 0 : prev.cand)), 0, nc - 1);
        if ('compare' in st) {
          const c = st.compare === null ? null : num(st.compare);
          next.compare = c !== null && c >= 0 && c < nc && Math.round(c) !== next.cand ? Math.round(c) : null;
        } else if (newC || next.compare === next.cand) next.compare = null;
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

    if (s0.mode === 'family') {
      const sp = AD[s0.pF];
      const win = sp.window;
      const [top, bot] = layout(view.w, view.h, [1.7, 1]);
      const pT = makePlot(top, { min: win.x[0], max: win.x[1] }, { min: famY(s0.pF)[0], max: famY(s0.pF)[1], label: 'F + C' });
      const pB = makePlot(bot, { min: win.x[0], max: win.x[1] }, { min: win.y[0], max: win.y[1], label: 'f' });
      plots.current = [pT, pB];
      drawAxes(ctx, pT, p);
      drawAxes(ctx, pB, p);
      for (const pl of [pT, pB]) {
        line(ctx, pl.box.x, pl.py(0), pl.box.x + pl.box.w, pl.py(0), withAlpha(p.ink2, 0.7), 1.2);
        if (win.x[0] < 0 && win.x[1] > 0) line(ctx, pl.px(0), pl.box.y, pl.px(0), pl.box.y + pl.box.h, withAlpha(p.ink2, 0.7), 1.2);
      }
      const xp = s0.x;
      const hw = (win.x[1] - win.x[0]) * 0.065;
      const m = sp.f(xp);
      const k = pieceIndex(sp.pieces, xp);
      // the faint members and a tangent on every one
      for (const kk of MEMBERS) {
        for (let i = 0; i < sp.pieces.length; i++) {
          strokePieces(ctx, pT, (x) => sp.F(x) + kk, [sp.pieces[i]], withAlpha(p.accent, 0.3), 1.4);
          if (i === k) tangentSeg(ctx, pT, xp, sp.F(xp) + kk, m, hw, withAlpha(p.ink, 0.75), 1.6);
        }
      }
      // the chosen member, bold, one constant per piece
      sp.pieces.forEach((pc, i) => {
        const c = s0.pF === 'recip' && i === 0 ? s0.C2 : s0.C;
        strokePieces(ctx, pT, (x) => sp.F(x) + c, [pc], p.accent, 3);
        if (i === k) {
          const yb = sp.F(xp) + c;
          tangentSeg(ctx, pT, xp, yb, m, hw * 1.25, p.ink, 2.6);
          dot(ctx, pT.px(xp), pT.py(yb), 5, p.accent, p.paper);
        }
      });
      // the dots on the faint members at the probe
      if (k >= 0) for (const kk of MEMBERS) dot(ctx, pT.px(xp), pT.py(sp.F(xp) + kk), 2.6, withAlpha(p.accent, 0.7), p.paper);
      // the given point
      if (s0.through) {
        const ok = pieceIndex(sp.pieces, s0.x0) >= 0 && Math.abs(sp.F(s0.x0) + constOf(s0, s0.x0) - s0.y0) <= THROUGH_TOL + 1e-9;
        const sx = pT.px(s0.x0);
        const sy = pT.py(s0.y0);
        if (ok) dot(ctx, sx, sy, 7, p.limit, p.paper);
        else ring(ctx, sx, sy, 7, p.limit, p.paper, 2.6);
        line(ctx, sx - 11, sy, sx + 11, sy, p.limit, 1.2);
        line(ctx, sx, sy - 11, sx, sy + 11, p.limit, 1.2);
      }
      // the probe line through both panels
      for (const pl of [pT, pB]) line(ctx, pl.px(xp), pl.box.y, pl.px(xp), pl.box.y + pl.box.h, withAlpha(p.accent, 0.55), 1.1, [3, 4]);
      strokePieces(ctx, pB, sp.f, sp.pieces, p.curve, 2.6);
      if (k >= 0) dot(ctx, pB.px(xp), pB.py(m), 5.5, p.accent, p.paper);
      haloText(ctx, p, `f(x) = ${fmt(m, 3)}`, clamp(pB.px(xp), pB.box.x + 40, pB.box.x + pB.box.w - 40), pB.box.y + 10, { font: font(700), color: p.ink });
      // the probe's handle
      ctx.save();
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pB.px(xp), pB.box.y + pB.box.h - 13);
      ctx.lineTo(pB.px(xp), pB.box.y + pB.box.h - 2);
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (s0.mode === 'area') {
      const sp = AD[s0.pA];
      const win = sp.window;
      const [top, bot] = layout(view.w, view.h, [1, 1]);
      const pT = makePlot(top, { min: win.x[0], max: win.x[1] }, { min: win.y[0], max: win.y[1], label: 'f' });
      const pB = makePlot(bot, { min: win.x[0], max: win.x[1] }, { min: win.yA[0], max: win.yA[1], label: 'A(x)' });
      plots.current = [pT, pB];
      drawAxes(ctx, pT, p);
      drawAxes(ctx, pB, p);
      for (const pl of [pT, pB]) {
        line(ctx, pl.box.x, pl.py(0), pl.box.x + pl.box.w, pl.py(0), withAlpha(p.ink2, 0.7), 1.2);
        if (win.x[0] < 0 && win.x[1] > 0) line(ctx, pl.px(0), pl.box.y, pl.px(0), pl.box.y + pl.box.h, withAlpha(p.ink2, 0.7), 1.2);
      }
      const { a, xa: x } = s0;
      shadeRegion(ctx, p, pT, sp.f, Math.min(a, x), Math.max(a, x), false);
      strokePieces(ctx, pT, sp.f, sp.pieces, p.curve, 2.6);
      if (s0.strip && Number.isFinite(stripArea(s0.pA, x, s0.dx))) {
        const hi = Math.min(x + s0.dx, win.x[1]);
        shadeRegion(ctx, p, pT, sp.f, x, hi, true);
      }
      // the handles on the axis
      const yAx = clamp(pT.py(0), pT.box.y, pT.box.y + pT.box.h);
      line(ctx, pT.px(a), pT.box.y, pT.px(a), pT.box.y + pT.box.h, withAlpha(p.ink2, 0.55), 1.1, [3, 4]);
      line(ctx, pT.px(x), pT.box.y, pT.px(x), pT.box.y + pT.box.h, withAlpha(p.accent, 0.7), 1.2, [3, 4]);
      ring(ctx, pT.px(a), yAx, 6, p.ink, p.paper, 2.4);
      dot(ctx, pT.px(x), yAx, 6, p.accent, p.paper);
      const lab = (t: string, sx: number, color: string) => haloText(ctx, p, t, sx, pT.box.y + 10, { font: font(700), color });
      lab('a', pT.px(a), p.ink);
      lab('x', pT.px(x), p.accent);
      // the area function and its tangent
      const k = pieceIndex(sp.pieces, a);
      if (k >= 0) {
        const piece = [sp.pieces[k]];
        strokePieces(ctx, pB, (t) => areaFn(s0.pA, a, t), piece, p.accent, 2.8);
        if (s0.showF && sp.exact) strokePieces(ctx, pB, (t) => sp.F(t) - sp.F(a), piece, p.limit, 2, [7, 5]);
        const A = areaFn(s0.pA, a, x);
        if (Number.isFinite(A)) {
          line(ctx, pB.px(x), pB.box.y, pB.px(x), pB.box.y + pB.box.h, withAlpha(p.accent, 0.5), 1.1, [3, 4]);
          tangentSeg(ctx, pB, x, A, sp.f(x), (win.x[1] - win.x[0]) * 0.1, p.ink, 2.2);
          dot(ctx, pB.px(x), pB.py(A), 5.5, p.accent, p.paper);
        }
        ring(ctx, pB.px(a), pB.py(0), 4.5, p.ink, p.paper, 2);
      }
      return;
    }

    // check
    const sp = CHK[s0.pC];
    const win = sp.window;
    const cmp = s0.compare;
    const [top, bot, third] = layout(view.w, view.h, cmp !== null ? [1, 1, 0.8] : [1, 1]);
    const pT = makePlot(top, { min: win.x[0], max: win.x[1] }, { min: win.y[0], max: win.y[1], label: 'f, G′' });
    const pB = makePlot(bot, { min: win.x[0], max: win.x[1] }, { min: win.yG[0], max: win.yG[1], label: 'G' });
    const pD = cmp !== null ? makePlot(third, { min: win.x[0], max: win.x[1] }, { min: -4, max: 4, label: 'G₁ − G₂' }) : null;
    plots.current = pD ? [pT, pB, pD] : [pT, pB];
    for (const pl of plots.current) {
      drawAxes(ctx, pl, p);
      line(ctx, pl.box.x, pl.py(0), pl.box.x + pl.box.w, pl.py(0), withAlpha(p.ink2, 0.7), 1.2);
      if (win.x[0] < 0 && win.x[1] > 0) line(ctx, pl.px(0), pl.box.y, pl.px(0), pl.box.y + pl.box.h, withAlpha(p.ink2, 0.7), 1.2);
    }
    const c1 = sp.cands[s0.cand];
    strokePieces(ctx, pT, sp.f, sp.pieces, p.curve, 3);
    strokePieces(ctx, pT, c1.dG, sp.pieces, p.accent, 2.4, [7, 5]);
    strokePieces(ctx, pB, c1.G, candPieces(s0.pC, s0.cand), p.accent, 2.8);
    if (cmp !== null && pD) {
      const c2 = sp.cands[cmp];
      strokePieces(ctx, pB, c2.G, candPieces(s0.pC, cmp), p.ink2, 2.4, [7, 5]);
      const d = diffOf(s0.pC, s0.cand, cmp);
      const common = d ? d.map((q): Piece => [q.lo, q.hi]) : intersect(candPieces(s0.pC, s0.cand), candPieces(s0.pC, cmp));
      strokePieces(ctx, pD, (x) => c1.G(x) - c2.G(x), common, p.limit, 3);
      if (d)
        for (const q of d) {
          const mx = clamp((Math.max(q.lo, win.x[0]) + Math.min(q.hi, win.x[1])) / 2, win.x[0], win.x[1]);
          haloText(ctx, p, fmt(q.v, 4), pD.px(mx), pD.py(q.v) - 11, { font: font(700), color: p.ink });
        }
    }
    haloText(ctx, p, 'f', pT.box.x + pT.box.w - TOOLS_W - 10, pT.box.y + 12, { font: font(700), color: p.curve, align: 'right' });
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
  const aspect = setup.mode === 'check' && setup.compare !== null ? (narrow ? 0.7 : 0.95) : narrow ? 0.85 : 1.15;

  /* ---------------------------------------------------------------- learner changes */
  /** The learner changed the figure: apply, then tick whatever the new state completes. */
  const apply = (patch: Partial<Setup>) => {
    const prev = cur.current;
    const next: Setup = { ...prev, ...patch };
    commit(next);
    for (const id of props.tasks ?? []) {
      const rule = RULES[id];
      if (!rule) continue;
      if (!rule.state(next, patch)) {
        held.current.delete(id);
        continue;
      }
      if (!rule.needs.some((key) => key in patch)) continue;
      if (!rule.event && held.current.has(id)) continue;
      done(id);
    }
  };

  const setProbe = (x: number) => {
    const c = cur.current;
    const nx = fixX(c.pF, roundTo(x, 0.01));
    if (nx !== c.x) apply({ x: nx });
  };
  const setPoint = (x: number, y: number) => {
    const c = cur.current;
    const [y0, y1] = famY(c.pF);
    const nx = fixX(c.pF, roundTo(x, 0.01));
    const ny = clamp(roundTo(y, 0.01), y0, y1);
    if (nx !== c.x0 || ny !== c.y0) apply({ x0: nx, y0: ny });
  };
  const setA = (v: number) => {
    const c = cur.current;
    const nv = inPieceOf(c.pA, c.xa, roundTo(v, 0.01));
    if (nv !== c.a) apply({ a: nv });
  };
  const setXa = (v: number) => {
    const c = cur.current;
    const nv = inPieceOf(c.pA, c.a, roundTo(v, 0.01));
    if (nv !== c.xa) apply({ xa: nv });
  };
  const setC = (v: number) => apply({ C: clamp(roundTo(v, 0.01), -3, 3) });
  const setC2 = (v: number) => apply({ C2: clamp(roundTo(v, 0.01), -3, 3) });
  const setDxE = (e: number) => apply({ dx: dxOfE(e) });
  const setCand = (k: number) => {
    const c = cur.current;
    const patch: Partial<Setup> = { cand: k };
    if (c.compare === k) patch.compare = defaultCompare(c.pC, k);
    apply(patch);
    setLive(describe({ ...cur.current }));
  };

  const dataX = (e: PointerEvent, plot: Plot) => plot.x.min + ((e.offsetX - plot.box.x) / plot.box.w) * (plot.x.max - plot.x.min);
  const dataY = (e: PointerEvent, plot: Plot) => plot.y.min + ((plot.box.y + plot.box.h - e.offsetY) / plot.box.h) * (plot.y.max - plot.y.min);
  const fromPointer = (e: PointerEvent) => {
    const c = cur.current;
    const pl = plots.current;
    if (!pl.length) return;
    const x = dataX(e, pl[0]);
    if (c.mode === 'family') {
      if (dragging.current === 'pt') setPoint(x, dataY(e, pl[0]));
      else setProbe(x);
    } else if (c.mode === 'area') {
      if (dragging.current === 'a') setA(x);
      else setXa(x);
    }
  };
  const onPointerDown = (e: PointerEvent) => {
    const c = cur.current;
    const pl = plots.current;
    if (!pl.length || c.mode === 'check') return;
    if (c.mode === 'family') {
      const top = pl[0];
      const near = c.through && Math.hypot(e.offsetX - top.px(c.x0), e.offsetY - top.py(c.y0)) <= GRAB;
      dragging.current = near ? 'pt' : 'x';
    } else {
      dragging.current = Math.abs(e.offsetX - pl[0].px(c.a)) < Math.abs(e.offsetX - pl[0].px(c.xa)) ? 'a' : 'xa';
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
    const c = cur.current;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const sgn = e.key === 'ArrowLeft' ? -1 : 1;
    if (c.mode === 'family') {
      e.preventDefault();
      const w = AD[c.pF].window.x;
      setProbe(c.x + sgn * Math.max(0.01, roundTo((w[1] - w[0]) / 150, 0.01)));
      setLive(describe(cur.current));
    } else if (c.mode === 'area') {
      e.preventDefault();
      const w = AD[c.pA].window.x;
      setXa(c.xa + sgn * Math.max(0.01, roundTo((w[1] - w[0]) / 150, 0.01)));
      setLive(describe(cur.current));
    }
  };

  /* ---------------------------------------------------------------- text */
  const M = (q: { children: ComponentChildren }) => <bdi dir="ltr">{q.children}</bdi>;

  function describe(s: Setup): string {
    if (s.mode === 'family') return `x = ${fmt(s.x, 3)}: f(x) = ${fmt(AD[s.pF].f(s.x), 3)}, השיפוע של כל הפונקציות הקדומות כאן. C = ${fmt(s.C, 3)}.`;
    if (s.mode === 'area') return `a = ${fmt(s.a, 3)}, x = ${fmt(s.xa, 3)}: A = ${fmt(areaFn(s.pA, s.a, s.xa), 4)}.`;
    return `התשובה ${CHK[s.pC].cands[s.cand].text}: ${CHK[s.pC].cands[s.cand].correct ? 'נכונה' : 'שגויה'}.`;
  }

  const spF = AD[setup.pF];
  const spA = AD[setup.pA];
  const spC = CHK[setup.pC];

  const label =
    setup.mode === 'family'
      ? `איור חי: משפחת הפונקציות הקדומות של ${spF.text}. בלוח העליון הפונקציות F + k בדהוי והפונקציה F + C מודגשת, ובנקודה x משיק קצר על כל אחת, כולם מקבילים. בלוח התחתון הפונקציה f עצמה.`
      : setup.mode === 'area'
        ? `איור חי: השטח המסומן בין הגרף של ${spA.text} לציר, מ-a עד x. מעל הציר מילוי מלא ומתחתיו קווים אלכסוניים. בלוח התחתון פונקציית השטח A(x) והמשיק שלה, ששיפועו f(x).`
        : `איור חי: בדיקה בגזירה של תשובה לאינטגרל של ${spC.text}. בלוח העליון f והנגזרת של התשובה, ובתחתון התשובה עצמה${setup.compare !== null ? ', ובנוסף ההפרש בין שתי תשובות' : ''}.`;

  let readout: ComponentChildren;
  if (setup.mode === 'family') {
    const x = setup.x;
    const piece = pieceIndex(spF.pieces, x);
    const through = (() => {
      if (!setup.through) return null;
      const ok = pieceIndex(spF.pieces, setup.x0) >= 0 && Math.abs(spF.F(setup.x0) + constOf(setup, setup.x0) - setup.y0) <= THROUGH_TOL + 1e-9;
      const cp = constOf(setup, setup.x0);
      return ok ? (
        <>
          הפונקציה הקדומה שעוברת דרך הנקודה <M>({fmt(setup.x0, 3)}, {fmt(setup.y0, 3)})</M>: <M>C = <b>{fmt(cp, 3)}</b></M>
        </>
      ) : (
        <>
          <M>C = <b>{fmt(cp, 3)}</b></M> עדיין לא עוברת דרך הנקודה <M>({fmt(setup.x0, 3)}, {fmt(setup.y0, 3)})</M>
        </>
      );
    })();
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>
            f(x) = {spF.text}, F(x) = {spF.Ftext} + C
          </M>
        </span>
        <span class="q" data-readout="x">
          <M>
            x = <b>{fmt(x, 3)}</b>
          </M>
        </span>
        <span class="q" data-readout="fx">
          <M>
            f(x) = <b>{piece >= 0 ? fmt(spF.f(x)) : '—'}</b>
          </M>
          : השיפוע של כל אחת מהפונקציות הקדומות בנקודה x
        </span>
        <span class="q" data-readout="c">
          {setup.pF === 'recip' ? (
            <>
              <M>
                C = <b>{fmt(setup.C, 3)}</b>
              </M>{' '}
              (x &gt; 0), <M>C₂ = <b>{fmt(setup.C2, 3)}</b></M> (x &lt; 0)
            </>
          ) : (
            <M>
              C = <b>{fmt(setup.C, 3)}</b>
            </M>
          )}
          {setup.pF === 'recip' && ': שני קבועים בלתי תלויים, כי התחום מורכב משני חלקים'}
        </span>
        {through && (
          <span class="q" data-readout="through">
            {through}
          </span>
        )}
      </>
    );
  } else if (setup.mode === 'area') {
    const { a, xa: x } = setup;
    const A = areaFn(setup.pA, a, x);
    const { pos, neg } = signedParts(setup.pA, a, x);
    const sA = stripArea(setup.pA, x, setup.dx);
    const brk = spA.pieces.length > 1;
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>f(x) = {spA.text}</M>
          {spA.Ftext ? (
            <>
              , <M>F(x) = {spA.Ftext}</M>
            </>
          ) : null}
        </span>
        <span class="q" data-readout="a">
          <M>
            a = <b>{fmt(a, 3)}</b>
          </M>
        </span>
        <span class="q" data-readout="x">
          <M>
            x = <b>{fmt(x, 3)}</b>
          </M>
          {brk && ': x נשאר באותו חלק של התחום כמו a'}
        </span>
        <span class="q" data-readout="area">
          <M>
            A(x) = ∫ₐˣ f(t) dt = <b>{fmt(A)}</b>
          </M>
        </span>
        <span class="q" data-readout="parts">
          שטח מעל הציר (מלא): <M>{fmt(pos)}</M>; שטח מתחת לציר (פסים): <M>{fmt(neg)}</M>
        </span>
        <span class="q" data-readout="fx">
          <M>
            f(x) = <b>{fmt(spA.f(x))}</b>
          </M>
          : שיפוע המשיק של A בנקודה x
        </span>
        {setup.strip && (
          <span class="q" data-readout="strip">
            {Number.isFinite(sA) ? (
              <>
                שטח הפס: <M>{fmt(sA, 4)}</M>; שטח הפס חלקי <M>dx = {fmt(setup.dx, 3)}</M>: <M><b>{fmt(sA / setup.dx, 4)}</b></M>, לעומת <M>f(x) = {fmt(spA.f(x), 4)}</M>
              </>
            ) : (
              'הפס יוצא מתחום ההגדרה.'
            )}
          </span>
        )}
        {setup.showF && spA.exact && (
          <span class="q" data-readout="showf">
            <M>
              F(x) − F(a) = <b>{fmt(spA.F(x) - spA.F(a))}</b>
            </M>
            : שווה ל-<M>A(x)</M>
          </span>
        )}
        {!spA.exact && (
          <span class="q" data-readout="gauss-note">
            אין נוסחה לפונקציה קדומה, אבל פונקציית השטח קיימת
          </span>
        )}
      </>
    );
  } else {
    const c1 = spC.cands[setup.cand];
    const cmp = setup.compare;
    const d = cmp !== null ? diffOf(setup.pC, setup.cand, cmp) : null;
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>f(x) = {spC.text}</M>
        </span>
        <span class="q" data-readout="cand">
          התשובה המוצעת: <M>G(x) = {c1.text}</M>
        </span>
        <span class="q" data-readout="deriv">
          הנגזרת שלה: <M>G′(x) = {c1.dtext}</M>
        </span>
        <span class="q" data-readout="verdict">
          <b>{c1.correct ? 'הנגזרת שווה ל-f: התשובה נכונה' : 'הנגזרת שונה מ-f: התשובה שגויה'}</b>
        </span>
        {!c1.correct && c1.why && (
          <span class="q" data-readout="why">
            {c1.why}
          </span>
        )}
        {cmp !== null && (
          <span class="q" data-readout="diff">
            <M>G₁ = {c1.text}</M>, <M>G₂ = {spC.cands[cmp].text}</M>:{' '}
            {d ? (
              <b>
                קבוע:{' '}
                {d.map((q, i) => (
                  <>
                    {i > 0 && '; '}
                    <M>{q.text}</M>
                    {pieceText([q.lo, q.hi]) && (
                      <>
                        {' '}
                        (<M>{pieceText([q.lo, q.hi])}</M>)
                      </>
                    )}
                  </>
                ))}
              </b>
            ) : (
              <b>לא קבוע</b>
            )}
          </span>
        )}
      </>
    );
  }

  const presetIds: readonly string[] = setup.mode === 'family' ? FAMILY_IDS : setup.mode === 'area' ? AD_IDS : CHK_IDS;
  const presetText = (id: string) => (isAdId(id) ? AD[id].text : isChkId(id) ? CHK[id].text : id);
  const chosen = setup.mode === 'family' ? setup.pF : setup.mode === 'area' ? setup.pA : setup.pC;
  const wx = (setup.mode === 'family' ? spF : spA).window.x;
  const [fy0, fy1] = famY(setup.pF);

  return (
    <SimShell
      fig={props.id}
      label={label}
      canvasRef={canvasRef}
      aspect={aspect}
      live={live}
      tasks={tasks}
      cursor={setup.mode === 'check' ? 'default' : 'ew-resize'}
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
          <label class="al-select" data-control="preset">
            <span class="al-lab">הפונקציה</span>
            <select
              dir="ltr"
              value={chosen}
              onChange={(e) => {
                const v = (e.target as HTMLSelectElement).value;
                const c = cur.current;
                if (c.mode === 'family' && isFamilyId(v)) apply({ pF: v, x: AD[v].probe, x0: AD[v].through[0], y0: AD[v].through[1] });
                else if (c.mode === 'area' && isAdId(v)) apply({ pA: v, a: AD[v].a0, xa: AD[v].x0 });
                else if (c.mode === 'check' && isChkId(v)) apply({ pC: v, cand: 0, compare: null });
              }}
            >
              {presetIds.map((id) => (
                <option key={id} value={id}>
                  {presetText(id)}
                </option>
              ))}
            </select>
          </label>
          {setup.mode === 'family' && (
            <>
              <div class="group" role="group" aria-label="נקודה נתונה">
                <Toggle label="נקודה נתונה" on={setup.through} swatch="var(--limit)" onChange={(on) => apply({ through: on })} />
              </div>
              <div class="al-ctl" data-control="x">
                <Slider label="הנקודה x" value={setup.x} min={wx[0]} max={wx[1]} step={0.01} format={(v) => fmt(v, 3)} onChange={setProbe} />
              </div>
              <div class="al-ctl" data-control="c">
                <Slider label={setup.pF === 'recip' ? 'הקבוע C (x > 0)' : 'הקבוע C'} value={setup.C} min={-3} max={3} step={0.01} format={(v) => fmt(v, 3)} onChange={setC} />
              </div>
              {setup.pF === 'recip' && (
                <div class="al-ctl" data-control="c2">
                  <Slider label="הקבוע C₂ (x < 0)" value={setup.C2} min={-3} max={3} step={0.01} format={(v) => fmt(v, 3)} onChange={setC2} />
                </div>
              )}
              {setup.through && (
                <>
                  <div class="al-ctl" data-control="x0">
                    <Slider label="הנקודה הנתונה: x₀" value={setup.x0} min={wx[0]} max={wx[1]} step={0.01} format={(v) => fmt(v, 3)} onChange={(v) => setPoint(v, cur.current.y0)} />
                  </div>
                  <div class="al-ctl" data-control="y0">
                    <Slider label="הנקודה הנתונה: y₀" value={setup.y0} min={fy0} max={fy1} step={0.01} format={(v) => fmt(v, 3)} onChange={(v) => setPoint(cur.current.x0, v)} />
                  </div>
                </>
              )}
            </>
          )}
          {setup.mode === 'area' && (
            <>
              <div class="group" role="group" aria-label="שכבות">
                <Toggle label="פס צר" on={setup.strip} swatch="var(--ink)" onChange={(on) => apply({ strip: on })} />
                {spA.exact && <Toggle label="הצגת F(x) − F(a)" on={setup.showF} swatch="var(--limit)" onChange={(on) => apply({ showF: on })} />}
              </div>
              <div class="al-ctl" data-control="a">
                <Slider label="הקצה a" value={setup.a} min={wx[0]} max={wx[1]} step={0.01} format={(v) => fmt(v, 3)} onChange={setA} />
              </div>
              <div class="al-ctl" data-control="x">
                <Slider label="הנקודה x" value={setup.xa} min={wx[0]} max={wx[1]} step={0.01} format={(v) => fmt(v, 3)} onChange={setXa} />
              </div>
              {setup.strip && (
                <div class="al-ctl" data-control="dx">
                  <Slider label="רוחב הפס dx (סרגל לוגריתמי)" value={roundTo(eOfDx(setup.dx), 0.01)} min={DX_E_MIN} max={0} step={0.01} format={() => `dx = ${fmt(setup.dx, 3)}`} onChange={setDxE} />
                </div>
              )}
            </>
          )}
          {setup.mode === 'check' && (
            <>
              <label class="al-select" data-control="cand">
                <span class="al-lab">התשובה המוצעת</span>
                <select dir="ltr" value={String(setup.cand)} onChange={(e) => setCand(Number((e.target as HTMLSelectElement).value))}>
                  {spC.cands.map((c, k) => (
                    <option key={k} value={String(k)}>
                      {c.text}
                    </option>
                  ))}
                </select>
              </label>
              <div class="group" role="group" aria-label="השוואה">
                <Toggle
                  label="השוואה בין שתי תשובות"
                  on={setup.compare !== null}
                  swatch="var(--limit)"
                  onChange={(on) => apply({ compare: on ? defaultCompare(setup.pC, setup.cand) : null })}
                />
              </div>
              {setup.compare !== null && (
                <label class="al-select" data-control="compare">
                  <span class="al-lab">מושווית אל</span>
                  <select dir="ltr" value={String(setup.compare)} onChange={(e) => apply({ compare: Number((e.target as HTMLSelectElement).value) })}>
                    {spC.cands.map((c, k) =>
                      k === setup.cand ? null : (
                        <option key={k} value={String(k)}>
                          {c.text}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              )}
            </>
          )}
        </>
      }
    />
  );
}
