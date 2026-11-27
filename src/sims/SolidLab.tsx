/**
 * SolidLab (lesson 8.5, areas between graphs and volumes of solids of revolution): three modes. Maths:
 * src/math/solids.ts, whose STORED closed forms (intersections, the strip forms and their areas, R(x), r(x), the shell's
 * radius and height, the partial-volume antiderivative P and the volume) drive every curve and every number; nothing is
 * decided by sampling. Canvases are math space and stay LTR (x to the right, y up); sliders for math quantities are
 * `dir="ltr"`. Nothing moves by itself (no animation), so there is no motion for motionAllowed() to gate. The solid is
 * drawn in canvas 2D (no three.js) in an axonometric projection (src/sims/core/axo.ts) as a crisp wireframe: the
 * region's boundary turned to the meridian through the ellipses' extreme points and its mirror image (the silhouette;
 * a washer's inner boundary dashed: it is hidden), a family of cross-section circles as ellipses with the back half
 * dashed, the part of the solid up to x faintly filled (the exact union of the projected slices), and the current disk /
 * washer / shell in accent. In `disk` and `shell` the two views sit side by side on a wide canvas and stack (the plane
 * on top) when the canvas is narrower than 520 px, so a phone (390 px) never scrolls sideways.
 *
 * mode 'between' (button "שטח בין גרפים"): preset f of AREA (parab, cross, yint).
 *     the curves f (--curve) and g (--equip, legend top left); the region between them filled in two patterns by
 *     which curve is on top (right): solid --pos where f is, hatched --neg where g is, each labelled "למעלה f" /
 *     "למעלה g" ("מימין f" / "מימין g" for horizontal strips); the intersection points (--limit) with their
 *     coordinates; the strip at x outlined (accent), its height top − bottom in the readout. `dy` (yint only; default
 *     true) cuts yint into horizontal strips (the position is y); off, into vertical strips in x, whose lower boundary
 *     changes formula at x = 0 (a dashed line marks it). The strip is dragged on the canvas, moved with the arrows or
 *     set by the slider.
 * mode 'disk' (button "שיטת הדיסקות"): preset f of REV with method disk or washer (cone, sine, sphere, washer, offaxis).
 *     left (top on a phone): the region in the plane (equal scales) with its mirror image in the axis dashed, the axis
 *     of rotation (--delta, dashed; the x-axis or the line y = −1) and the slice at x outlined (accent) with R (and r)
 *     marked from the axis; right: the solid with the axis horizontal, the slice at x a disk or a washer (accent), the
 *     solid from a to x filled faintly. Drag on either view (on the solid: along the axis), arrows, or the slider.
 * mode 'shell' (button "שיטת הקליפות הגליליות"): preset f of REV with method shell (bowl, sinshell, cone-y).
 *     left: the region with the y-axis as the axis of rotation, the strip at x (accent) and its mirror image, the
 *     radius x marked; right: the solid with the axis vertical, the shell of radius x and height f(x) (accent), the
 *     solid within radius x filled faintly. `unroll` cuts the shell open along its front (a dashed line) and draws it
 *     flattened into a thin slab 2πx × f(x) × dx in a band below the solid, at the solid's scale when it fits, else
 *     reduced and labelled so.
 *
 * Props (defaults): id (required); mode ('between'); modes (the mode buttons shown; default the starting mode only);
 * tasks ([]). f (an AREA id for between, a disk/washer REV id for disk, a shell REV id for shell; defaults 'parab',
 * 'cone', 'bowl'); x (the strip / slice / shell position of the starting mode; default per preset: parab −0.5, cross −1,
 * yint y = 0.5 (x = 1.5 with dy off); cone 1, sine 1, sphere −1, washer −0.5, offaxis 0.5; bowl 0.5, sinshell 1,
 * cone-y 0.5); dy (true; only yint uses it); showArea (false: the area readout is hidden until turned on); showVolume
 * (false: the whole volume is hidden until turned on); unroll (false).
 * Every prop is also a step key (`<Step fig=… set={{…}}>`); a key left out keeps its value; a step that sets `f` applies
 * it to the mode its registry belongs to (an AREA id to between, a disk/washer id to disk, a shell id to shell) and,
 * without `x`, puts that mode's position at the preset's default; `x` addresses the position of the mode in force after
 * the step (for yint, in the orientation `dy` gives; a step that changes `dy` without `x` puts the default of the new
 * orientation). A state set by a step never ticks a task, and a state that already had a task's property when a step
 * or reset made it must be left and found again (every position task measures from where the last step, reset or
 * preset choice put the position).
 * The learner can also pick the region from a list (select "התחום": the presets of the current mode).
 *
 * Tasks (ticked only inside the learner's own drag, key, slider, select or toggle):
 *   between: bt-strip (the strip moved ≥ 0.5 from where a step, reset or preset choice put it), bt-cross (preset cross,
 *            the learner moves the strip across x = 0: the top curve changes), bt-dy (the learner selects yint)
 *   disk:    dk-slide (the slice moved ≥ 0.3), dk-washer (preset washer or offaxis, the learner moves the slice to a
 *            place where r > 0)
 *   shell:   sh-slide (the shell moved ≥ 0.3), sh-unroll (the learner turns unroll on)
 *
 * Hooks for e2e specs (inside `#<id>`; numbers use U+2212 for minus):
 *   buttons by role and name: the mode buttons "שטח בין גרפים", "שיטת הדיסקות", "שיטת הקליפות הגליליות"; the toggles
 *     "הצגת השטח" (between), "פסים אופקיים" (between, yint only), "הצגת הנפח כולו" (disk, shell), "פריסת הקליפה"
 *     (shell); "איפוס" (reset)
 *   [data-control="preset"] select    the region (option values are the preset ids)
 *   [data-control="x"] input          the strip / slice / shell position (range input, step 0.01; for yint with dy on its
 *                                     value is y)
 *   canvas                            drag moves the strip / slice / shell; ←/→ (and ↑/↓) move it
 *   [data-readout=…]                  between: fn, cuts, strip, area (with showArea)
 *                                     disk: fn, x, radii, slice, partial, volume (with showVolume)
 *                                     shell: fn, x, height, slice, partial, slab (with unroll), volume (with showVolume)
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import {
  AREA,
  AREA_IDS,
  DISK_IDS,
  REV,
  SHELL_IDS,
  formsOf,
  isAreaId,
  isDiskId,
  isShellId,
  partialVolume,
  sliceAt,
  stripAt,
  stripRange,
  type AreaId,
  type RevId,
  type RevSpec,
} from '~/math/solids';
import type { Vec3 } from '~/math/vec';
import { markTask } from '~/progress/store';
import { subscribeSteps, type StepState } from '~/ui/steps';
import { camera, project, type Camera } from './core/axo';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { sci } from './core/format';
import { mix, withAlpha } from './core/ink';
import { drawAxes, makePlot, type Box, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import './SolidLab.css';

export type SolidMode = 'between' | 'disk' | 'shell';

export interface SolidLabProps {
  id: string;
  mode?: SolidMode;
  /** the mode buttons shown (default: the starting mode only) */
  modes?: SolidMode[];
  /** an AREA id (between), a disk / washer REV id (disk) or a shell REV id (shell) */
  f?: string;
  x?: number;
  dy?: boolean;
  showArea?: boolean;
  showVolume?: boolean;
  unroll?: boolean;
  tasks?: string[];
}

interface Setup {
  mode: SolidMode;
  pB: AreaId;
  pD: RevId;
  pS: RevId;
  xb: number;
  dy: boolean;
  xd: number;
  xs: number;
  showArea: boolean;
  showVolume: boolean;
  unroll: boolean;
}

type P2 = [number, number];

const ltr = (s: string) => String.fromCharCode(0x2066) + s.replace(/ /g, String.fromCharCode(0xa0)) + String.fromCharCode(0x2069);

const TASK_LABEL: Record<string, string> = {
  'bt-strip': 'גררו את הפס לאורך התחום (לפחות 0.5). מה קורה לגובה שלו?',
  'bt-cross': `בתחום שבין ${ltr('y = x³')} ל-${ltr('y = 4x')} גררו את הפס אל מעבר ל-${ltr('x = 0')}. איזו פונקציה למעלה עכשיו?`,
  'bt-dy': `בחרו את התחום שבין ${ltr('x = y² − 1')} ל-${ltr('x = y + 1')}. למה נוח לחתוך אותו לפסים אופקיים?`,
  'dk-slide': 'הזיזו את הפרוסה (לפחות 0.3). איך משתנה הרדיוס שלה, ואיך משתנה הנפח עד x?',
  'dk-washer': `בחרו תחום שהפרוסות שלו טבעות (בין ${ltr('y = x²')} ל-${ltr('y = 1')}, או סיבוב סביב ${ltr('y = −1')}) והזיזו את הפרוסה. מה הרדיוס הפנימי r?`,
  'sh-slide': 'הזיזו את הקליפה (לפחות 0.3). מה הרדיוס שלה ומה הגובה שלה?',
  'sh-unroll': 'הדליקו "פריסת הקליפה". מה הממדים של הלוח שמתקבל?',
};

const MODE_LABEL: Record<SolidMode, string> = { between: 'שטח בין גרפים', disk: 'שיטת הדיסקות', shell: 'שיטת הקליפות הגליליות' };

const TAU = 2 * Math.PI;
const NARROW = 520;
/** the reset and fullscreen buttons over the canvas's top right corner */
const TOOLS_W = 84;
const TOOLS_H = 44;
/** the camera of the solid: the axis horizontal (disk) or vertical (shell) */
const CAM_DISK = camera(25, 16);
const CAM_EL_SHELL = 22;
const CAM_SHELL = camera(22, CAM_EL_SHELL);

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const bool = (x: unknown): boolean | null => (typeof x === 'boolean' ? x : null);
const roundTo = (x: number, step: number) => Number((Math.round(x / step) * step).toPrecision(10));
const minus = (s: string) => s.replace(/-/g, '−');
const fmt = (x: number, sig = 4) => (Number.isNaN(x) ? '—' : Math.abs(x) < 1e-9 ? '0' : minus(sci(x, sig)));
const sign = (x: number) => (x > 1e-12 ? 1 : x < -1e-12 ? -1 : 0);
/** a radius text that is a number ("1", "0") needs no "= value" after it */
const isConstText = (t: string) => /^[0-9.]+$/.test(t);

/** yint cut into vertical strips (dy off) */
const altOf = (pB: AreaId, dy: boolean) => AREA[pB].alt !== null && !dy;
const defaultB = (pB: AreaId, dy: boolean) => (altOf(pB, dy) ? AREA[pB].alt0 : AREA[pB].v0);
function fixB(pB: AreaId, dy: boolean, v: number): number {
  const [lo, hi] = stripRange(pB, altOf(pB, dy));
  return clamp(v, lo, hi);
}
const fixR = (id: RevId, v: number) => clamp(v, REV[id].a, REV[id].b);

/* ---- canvas helpers */
function haloText(
  ctx: CanvasRenderingContext2D,
  p: Palette,
  s: string,
  x: number,
  y: number,
  o: { font: string; color?: string; align?: CanvasTextAlign; base?: CanvasTextBaseline; rtl?: boolean },
) {
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
function polyline(ctx: CanvasRenderingContext2D, pts: readonly P2[], color: string, width: number, dash: number[] = []) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.setLineDash(dash);
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.restore();
}
function fillPoly(ctx: CanvasRenderingContext2D, pts: readonly P2[], color: string) {
  if (pts.length < 3) return;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
/** a double-headed arrow from (x1, y1) to (x2, y2) */
function span(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width = 1.6) {
  const L = Math.hypot(x2 - x1, y2 - y1);
  if (L < 2) return;
  const ux = (x2 - x1) / L;
  const uy = (y2 - y1) / L;
  const h = Math.min(6, L / 3);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  for (const [px, py, s] of [
    [x1, y1, 1],
    [x2, y2, -1],
  ] as const) {
    ctx.moveTo(px + s * ux * h - uy * h * 0.55, py + s * uy * h + ux * h * 0.55);
    ctx.lineTo(px, py);
    ctx.lineTo(px + s * ux * h + uy * h * 0.55, py + s * uy * h - ux * h * 0.55);
  }
  ctx.stroke();
  ctx.restore();
}
/** hatch a clip path with diagonal lines */
function hatch(ctx: CanvasRenderingContext2D, box: Box, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (let k = -box.h; k < box.w + box.h; k += 6) {
    ctx.moveTo(box.x + k, box.y + box.h);
    ctx.lineTo(box.x + k + box.h, box.y);
  }
  ctx.stroke();
}

/** a plot whose x and y units are equal, or as near equal as a ratio of at most MAX_STRETCH allows (a wide, flat region
 * would otherwise be a thin line): the window is widened in one direction and centred */
const MAX_STRETCH = 2.5;
function equalPlot(box: Box, wx: readonly [number, number], wy: readonly [number, number]): Plot {
  let sx = box.w / (wx[1] - wx[0]);
  let sy = box.h / (wy[1] - wy[0]);
  if (sx < sy) sy = Math.min(sy, sx * MAX_STRETCH);
  else sx = Math.min(sx, sy * MAX_STRETCH);
  const cx = (wx[0] + wx[1]) / 2;
  const cy = (wy[0] + wy[1]) / 2;
  const hx = box.w / sx / 2;
  const hy = box.h / sy / 2;
  return makePlot(box, { min: cx - hx, max: cx + hx }, { min: cy - hy, max: cy + hy });
}

/* ---- the solid: geometry in (u, ρ, θ), u along the axis, ρ the distance to it */

interface Solid3 {
  cam: Camera;
  /** world point of (u, ρ, θ) */
  W: (u: number, rho: number, th: number) => Vec3;
  /** unit radial direction at θ */
  radial: (th: number) => Vec3;
  /** the meridian through the ellipses' extreme points: the silhouette is the boundary turned to θ* and θ* + π */
  thStar: number;
}

function solid3(s: RevSpec, uc: number): Solid3 {
  if (s.method === 'shell') {
    const cam = CAM_SHELL;
    return {
      cam,
      W: (u, rho, th) => [rho * Math.cos(th), rho * Math.sin(th), u - uc],
      radial: (th) => [Math.cos(th), Math.sin(th), 0],
      thStar: Math.atan2(cam.right[1], cam.right[0]),
    };
  }
  const cam = CAM_DISK;
  return {
    cam,
    W: (u, rho, th) => [u - uc, rho * Math.cos(th), rho * Math.sin(th)],
    radial: (th) => [0, Math.cos(th), Math.sin(th)],
    thStar: Math.atan2(cam.up[2], cam.up[1]),
  };
}

/** the plane point (x, y) as (u, ρ) */
function toUR(s: RevSpec, x: number, y: number): [number, number] {
  if (s.axis.kind === 'v') return [y, Math.abs(x - s.axis.c)];
  return [x, y - s.axis.k];
}

/** the region's boundary in the plane, in three parts: the top curve a → b, the ends, the bottom curve */
function boundaryParts(s: RevSpec, lo: number, hi: number, n = 140) {
  const top: [number, number][] = [];
  const bot: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const x = lo + ((hi - lo) * i) / n;
    top.push([x, s.top(x)]);
    bot.push([x, s.bottom(x)]);
  }
  return { top, bot };
}

export default function SolidLab(props: SolidLabProps) {
  const startMode: SolidMode = props.mode ?? 'between';
  const modes: SolidMode[] = props.modes ?? [startMode];
  const initial = (): Setup => {
    const pB: AreaId = isAreaId(props.f) ? props.f : 'parab';
    const pD: RevId = isDiskId(props.f) ? props.f : 'cone';
    const pS: RevId = isShellId(props.f) ? props.f : 'bowl';
    const dy = props.dy ?? true;
    const x = num(props.x);
    return {
      mode: startMode,
      pB,
      pD,
      pS,
      dy,
      xb: fixB(pB, dy, startMode === 'between' && x !== null ? x : defaultB(pB, dy)),
      xd: fixR(pD, startMode === 'disk' && x !== null ? x : REV[pD].x0),
      xs: fixR(pS, startMode === 'shell' && x !== null ? x : REV[pS].x0),
      showArea: props.showArea ?? false,
      showVolume: props.showVolume ?? false,
      unroll: props.unroll ?? false,
    };
  };
  const [setup, setSetup] = useState<Setup>(initial);
  const cur = useRef(setup);
  const [live, setLive] = useState('');
  const [narrow, setNarrow] = useState(false);
  /** where the last step, reset or preset choice put each position: the slide tasks measure from it */
  const anchor = useRef({ b: setup.xb, d: setup.xd, s: setup.xs });
  /** the side of x = 0 the strip was last on (bt-cross) */
  const side = useRef(sign(setup.xb));
  /** the geometry of the last frame, for the pointer */
  const geo = useRef<{
    plot: Plot | null;
    solid: { box: Box; O: P2; du: P2; scale: number } | null;
  }>({ plot: null, solid: null });
  const dragging = useRef<'plot' | 'solid' | null>(null);

  interface Rule {
    needs: (keyof Setup)[];
    state: (s: Setup, patch: Partial<Setup>, prev: Setup) => boolean;
  }
  const RULES: Record<string, Rule> = {
    'bt-strip': { needs: ['xb'], state: (s) => s.mode === 'between' && Math.abs(s.xb - anchor.current.b) >= 0.5 - 1e-9 },
    'bt-cross': {
      needs: ['xb'],
      state: (s, p, prev) =>
        s.mode === 'between' && s.pB === 'cross' && prev.pB === 'cross' && !('pB' in p) && sign(s.xb) !== 0 && side.current !== 0 && sign(s.xb) !== side.current,
    },
    'bt-dy': { needs: ['pB'], state: (s, _p, prev) => s.mode === 'between' && s.pB === 'yint' && prev.pB !== 'yint' },
    'dk-slide': { needs: ['xd'], state: (s) => s.mode === 'disk' && Math.abs(s.xd - anchor.current.d) >= 0.3 - 1e-9 },
    'dk-washer': {
      needs: ['xd'],
      state: (s, p) => {
        if (s.mode !== 'disk' || REV[s.pD].method !== 'washer' || 'pD' in p) return false;
        const sl = sliceAt(s.pD, s.xd);
        return sl.kind !== 'shell' && sl.r > 1e-9;
      },
    },
    'sh-slide': { needs: ['xs'], state: (s) => s.mode === 'shell' && Math.abs(s.xs - anchor.current.s) >= 0.3 - 1e-9 },
    'sh-unroll': { needs: ['unroll'], state: (s, p) => s.mode === 'shell' && p.unroll === true },
  };

  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const done = (t: string) => {
    if (props.tasks?.includes(t)) markTask(`${props.id}:${t}`);
  };
  const rebase = (s: Setup) => {
    anchor.current = { b: s.xb, d: s.xd, s: s.xs };
    side.current = sign(s.xb);
  };
  const commit = (s: Setup) => {
    cur.current = s;
    setSetup(s);
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st: StepState) => {
        const prev = cur.current;
        const mode = typeof st.mode === 'string' && modes.includes(st.mode as SolidMode) ? (st.mode as SolidMode) : prev.mode;
        const next: Setup = { ...prev, mode };
        const newB = isAreaId(st.f) && st.f !== prev.pB;
        const newD = isDiskId(st.f) && st.f !== prev.pD;
        const newS = isShellId(st.f) && st.f !== prev.pS;
        if (isAreaId(st.f)) next.pB = st.f;
        if (isDiskId(st.f)) next.pD = st.f;
        if (isShellId(st.f)) next.pS = st.f;
        next.dy = bool(st.dy) ?? (newB ? true : prev.dy);
        const newOrient = newB || altOf(next.pB, next.dy) !== altOf(prev.pB, prev.dy);
        const sx = num(st.x);
        next.xb = fixB(next.pB, next.dy, mode === 'between' && sx !== null ? sx : newOrient ? defaultB(next.pB, next.dy) : prev.xb);
        next.xd = fixR(next.pD, mode === 'disk' && sx !== null ? sx : newD ? REV[next.pD].x0 : prev.xd);
        next.xs = fixR(next.pS, mode === 'shell' && sx !== null ? sx : newS ? REV[next.pS].x0 : prev.xs);
        next.showArea = bool(st.showArea) ?? prev.showArea;
        next.showVolume = bool(st.showVolume) ?? prev.showVolume;
        next.unroll = bool(st.unroll) ?? prev.unroll;
        commit(next);
        rebase(next);
      }),
    [props.id],
  );

  const s0 = setup;

  /* ---------------------------------------------------------------- drawing */
  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    const nar = view.w < NARROW;
    const fs = nar ? 11 : 12;
    const font = (w8: number, size = fs) => `${w8} ${size}px ${p.fontUi}`;

    if (s0.mode === 'between') {
      const sp = AREA[s0.pB];
      const alt = altOf(s0.pB, s0.dy);
      const box: Box = { x: 44, y: 10, w: Math.max(1, view.w - 44 - 12), h: Math.max(1, view.h - 10 - 26) };
      const plot = makePlot(box, { min: sp.window.x[0], max: sp.window.x[1] }, { min: sp.window.y[0], max: sp.window.y[1] });
      geo.current = { plot, solid: null };
      drawAxes(ctx, plot, p);
      line(ctx, box.x, plot.py(0), box.x + box.w, plot.py(0), withAlpha(p.ink2, 0.7), 1.2);
      line(ctx, plot.px(0), box.y, plot.px(0), box.y + box.h, withAlpha(p.ink2, 0.7), 1.2);
      haloText(ctx, p, 'x', box.x + box.w - 8, plot.py(0) - 10, { font: font(700), color: p.ink2 });
      haloText(ctx, p, 'y', plot.px(0) + 10, box.y + 9, { font: font(700), color: p.ink2 });
      const P = (v: number, w: number): P2 => (sp.variable === 'x' ? [plot.px(v), plot.py(w)] : [plot.px(w), plot.py(v)]);

      ctx.save();
      ctx.beginPath();
      ctx.rect(box.x, box.y, box.w, box.h);
      ctx.clip();
      // the region, one pattern per order of the curves (the natural cut)
      for (const fm of sp.forms) {
        const pts: P2[] = [];
        const n = 160;
        for (let i = 0; i <= n; i++) {
          const v = fm.lo + ((fm.hi - fm.lo) * i) / n;
          pts.push(P(v, fm.top(v)));
        }
        for (let i = n; i >= 0; i--) {
          const v = fm.lo + ((fm.hi - fm.lo) * i) / n;
          pts.push(P(v, fm.bottom(v)));
        }
        if (fm.upper === 'f') fillPoly(ctx, pts, withAlpha(p.pos, 0.28));
        else {
          ctx.save();
          ctx.beginPath();
          pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.closePath();
          ctx.fillStyle = withAlpha(p.neg, 0.1);
          ctx.fill();
          ctx.clip();
          hatch(ctx, box, withAlpha(p.neg, 0.85));
          ctx.restore();
        }
      }
      // where the lower boundary of the vertical strips changes formula (yint in x)
      const cut = formsOf(s0.pB, alt);
      if (cut.variable !== sp.variable)
        for (const fm of cut.forms.slice(1)) {
          const v = fm.lo;
          line(ctx, plot.px(v), plot.py(fm.top(v)), plot.px(v), plot.py(fm.bottom(v)), p.ink, 1.4, [5, 4]);
        }
      // the curves
      const curve = (fn: (v: number) => number, color: string) => {
        const pts: P2[] = [];
        const [lo, hi] = sp.variable === 'x' ? sp.window.x : sp.window.y;
        const n = 400;
        for (let i = 0; i <= n; i++) {
          const v = lo + ((hi - lo) * i) / n;
          pts.push(P(v, fn(v)));
        }
        polyline(ctx, pts, color, 2.6);
      };
      curve(sp.f, p.curve);
      curve(sp.g, p.equip);
      ctx.restore();

      // the pattern labels, at the place of the form farthest from the strip
      for (const fm of sp.forms) {
        const at = (t: number) => fm.lo + (fm.hi - fm.lo) * t;
        const v = [0.5, 0.3, 0.7].map(at).reduce((best, c) => (Math.abs(c - s0.xb) > Math.abs(best - s0.xb) + 1e-9 ? c : best));
        const [x, y] = P(v, (fm.top(v) + fm.bottom(v)) / 2);
        const word = sp.variable === 'x' ? 'למעלה' : 'מימין';
        haloText(ctx, p, `${word} ${fm.upper}`, x, y, { font: font(700), color: p.ink, rtl: true });
      }
      // the strip at v, outlined
      const v = s0.xb;
      const st = stripAt(s0.pB, v, alt);
      if (st) {
        const half = 4;
        if (cut.variable === 'x') {
          const sx = plot.px(v);
          const y1 = plot.py(st.top);
          const y0 = plot.py(st.bottom);
          ctx.save();
          ctx.fillStyle = withAlpha(p.accent, 0.6);
          ctx.fillRect(sx - half, y1, 2 * half, y0 - y1);
          ctx.strokeStyle = p.ink;
          ctx.lineWidth = 1.8;
          ctx.strokeRect(sx - half, y1, 2 * half, y0 - y1);
          ctx.restore();
          line(ctx, sx, box.y, sx, box.y + box.h, withAlpha(p.accent, 0.45), 1.1, [3, 4]);
          ctx.save();
          ctx.strokeStyle = p.accent;
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(sx, box.y + box.h - 12);
          ctx.lineTo(sx, box.y + box.h - 2);
          ctx.stroke();
          ctx.restore();
        } else {
          const sy = plot.py(v);
          const x1 = plot.px(st.top);
          const x0 = plot.px(st.bottom);
          ctx.save();
          ctx.fillStyle = withAlpha(p.accent, 0.6);
          ctx.fillRect(x0, sy - half, x1 - x0, 2 * half);
          ctx.strokeStyle = p.ink;
          ctx.lineWidth = 1.8;
          ctx.strokeRect(x0, sy - half, x1 - x0, 2 * half);
          ctx.restore();
          line(ctx, box.x, sy, box.x + box.w, sy, withAlpha(p.accent, 0.45), 1.1, [3, 4]);
          ctx.save();
          ctx.strokeStyle = p.accent;
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(box.x + 2, sy);
          ctx.lineTo(box.x + 12, sy);
          ctx.stroke();
          ctx.restore();
        }
      }
      // the intersection points (a label that would sit under the reset and fullscreen buttons goes below its point)
      for (const pt of sp.points) {
        const sx = plot.px(pt.x);
        const sy = plot.py(pt.y);
        dot(ctx, sx, sy, 5.5, p.limit, p.paper);
        const right = sx < box.x + box.w * 0.6;
        const below = sy - 12 < TOOLS_H && sx > view.w - TOOLS_W - 60;
        haloText(ctx, p, pt.text, sx + (right ? 9 : -9), below ? sy + 14 : sy - 12, { font: font(700), color: p.ink, align: right ? 'left' : 'right' });
      }
      // the legend
      const lx = box.x + 10;
      let ly = box.y + 14;
      for (const [name, text, color] of [
        ['f', sp.fText, p.curve],
        ['g', sp.gText, p.equip],
      ] as const) {
        line(ctx, lx, ly, lx + 20, ly, color, 2.6);
        haloText(ctx, p, `${name}: ${text}`, lx + 26, ly, { font: font(700), color: p.ink, align: 'left' });
        ly += 18;
      }
      return;
    }

    /* ---- disk and shell: the plane and the solid */
    const isShell = s0.mode === 'shell';
    const id = isShell ? s0.pS : s0.pD;
    const sp = REV[id];
    const x = isShell ? s0.xs : s0.xd;
    const split = nar ? null : Math.round(view.w * 0.44);
    const planeOuter: Box = split ? { x: 0, y: 0, w: split, h: view.h } : { x: 0, y: 0, w: view.w, h: Math.round(view.h * 0.42) };
    const solidBox: Box = split
      ? { x: split + 6, y: 6, w: view.w - split - 12, h: view.h - 12 }
      : { x: 6, y: planeOuter.h + 4, w: view.w - 12, h: view.h - planeOuter.h - 10 };
    const pbox: Box = { x: planeOuter.x + 40, y: planeOuter.y + 10, w: Math.max(1, planeOuter.w - 40 - 10), h: Math.max(1, planeOuter.h - 10 - 26) };
    const plot = equalPlot(pbox, sp.window.x, sp.window.y);
    drawAxes(ctx, plot, p);
    line(ctx, pbox.x, plot.py(0), pbox.x + pbox.w, plot.py(0), withAlpha(p.ink2, 0.7), 1.2);
    line(ctx, plot.px(0), pbox.y, plot.px(0), pbox.y + pbox.h, withAlpha(p.ink2, 0.7), 1.2);

    /* the plane */
    const { top, bot } = boundaryParts(sp, sp.a, sp.b);
    const region: P2[] = [...top.map(([u, v]): P2 => [plot.px(u), plot.py(v)]), ...[...bot].reverse().map(([u, v]): P2 => [plot.px(u), plot.py(v)])];
    const mirror = (u: number, v: number): P2 =>
      sp.axis.kind === 'h' ? [plot.px(u), plot.py(2 * sp.axis.k - v)] : [plot.px(2 * sp.axis.c - u), plot.py(v)];
    const mirrored: P2[] = [...top.map(([u, v]) => mirror(u, v)), ...[...bot].reverse().map(([u, v]) => mirror(u, v))];
    ctx.save();
    ctx.beginPath();
    ctx.rect(pbox.x, pbox.y, pbox.w, pbox.h);
    ctx.clip();
    fillPoly(ctx, region, withAlpha(p.accent, 0.16));
    polyline(ctx, [...mirrored, mirrored[0]], withAlpha(p.curve, 0.5), 1.4, [5, 4]);
    polyline(ctx, [...region, region[0]], p.curve, 2.4);
    // the axis of rotation
    if (sp.axis.kind === 'h') line(ctx, pbox.x, plot.py(sp.axis.k), pbox.x + pbox.w, plot.py(sp.axis.k), p.delta, 2, [9, 5]);
    else line(ctx, plot.px(sp.axis.c), pbox.y, plot.px(sp.axis.c), pbox.y + pbox.h, p.delta, 2, [9, 5]);
    // the slice / shell strip at x
    const yt = sp.top(x);
    const yb = sp.bottom(x);
    const drawStrip = (sx: number, solid: boolean) => {
      ctx.save();
      const y1 = plot.py(yt);
      const y0 = plot.py(yb);
      if (solid) {
        ctx.fillStyle = withAlpha(p.accent, 0.4);
        ctx.fillRect(sx - 4, y1, 8, y0 - y1);
      }
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = solid ? 2 : 1.4;
      ctx.setLineDash(solid ? [] : [4, 3]);
      ctx.strokeRect(sx - 4, y1, 8, y0 - y1);
      ctx.restore();
    };
    drawStrip(plot.px(x), true);
    if (isShell && sp.axis.kind === 'v') drawStrip(plot.px(2 * sp.axis.c - x), false);
    ctx.restore();
    if (sp.axis.kind === 'h') {
      const ya = plot.py(sp.axis.k);
      haloText(ctx, p, 'ציר הסיבוב', pbox.x + pbox.w - 6, ya + 11, { font: font(700, fs - 1), color: p.delta, align: 'right', rtl: true });
      // R and r from the axis
      const sx = plot.px(x) + 10;
      span(ctx, sx, ya, sx, plot.py(yt), p.ink, 1.6);
      haloText(ctx, p, 'R', sx + 9, (ya + plot.py(yt)) / 2, { font: font(700), color: p.ink });
      if (sp.method === 'washer' && sp.r(x) > 1e-9) {
        const sx2 = plot.px(x) - 10;
        span(ctx, sx2, ya, sx2, plot.py(yb), p.ink2, 1.4);
        haloText(ctx, p, 'r', sx2 - 8, (ya + plot.py(yb)) / 2, { font: font(700), color: p.ink2 });
      }
    } else {
      const xa = plot.px(sp.axis.c);
      haloText(ctx, p, 'ציר הסיבוב', xa + 6, pbox.y + 10, { font: font(700, fs - 1), color: p.delta, align: 'left', rtl: true });
      const yy = plot.py(yb + (yt - yb) * 0.5);
      if (Math.abs(plot.px(x) - xa) > 6) {
        span(ctx, xa, yy, plot.px(x), yy, p.ink, 1.6);
        haloText(ctx, p, 'x', (xa + plot.px(x)) / 2, yy - 10, { font: font(700), color: p.ink });
      }
    }
    // the handle under the plane
    ctx.save();
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(plot.px(x), pbox.y + pbox.h - 12);
    ctx.lineTo(plot.px(x), pbox.y + pbox.h - 2);
    ctx.stroke();
    ctx.restore();

    /* the solid */
    ctx.save();
    ctx.strokeStyle = p.rule;
    ctx.lineWidth = 1;
    ctx.strokeRect(solidBox.x + 0.5, solidBox.y + 0.5, solidBox.w - 1, solidBox.h - 1);
    ctx.restore();
    const band: Box | null = isShell && s0.unroll ? { x: solidBox.x, y: solidBox.y + solidBox.h * 0.64, w: solidBox.w, h: solidBox.h * 0.36 } : null;
    const sbox: Box = band ? { x: solidBox.x, y: solidBox.y, w: solidBox.w, h: solidBox.h * 0.64 } : solidBox;

    // the (u, ρ) extent of the solid
    const n = 120;
    let uMin = Infinity;
    let uMax = -Infinity;
    let rhoMax = 0;
    for (let i = 0; i <= n; i++) {
      const xx = sp.a + ((sp.b - sp.a) * i) / n;
      for (const yy of [sp.top(xx), sp.bottom(xx)]) {
        const [u, rho] = toUR(sp, xx, yy);
        uMin = Math.min(uMin, u);
        uMax = Math.max(uMax, u);
        rhoMax = Math.max(rhoMax, rho);
      }
    }
    const uc = (uMin + uMax) / 2;
    const S = solid3(sp, uc);
    const cam = S.cam;
    // the axis sticks out of the solid at both ends, far enough that its arrow and label clear the end rings
    const ext = Math.max(0.22 * (uMax - uMin), isShell ? rhoMax * Math.tan((CAM_EL_SHELL * Math.PI) / 180) + 0.15 : 0.55 * rhoMax);
    const axisLo = uMin - (isShell ? 0.5 : 0.9) * ext;
    const axisHi = uMax + ext;
    // fit: the outline at θ* and θ* + π, the end rings and the axis
    const fitPts: Vec3[] = [S.W(axisLo, 0, 0), S.W(axisHi, 0, 0)];
    for (let i = 0; i <= 40; i++) {
      const xx = sp.a + ((sp.b - sp.a) * i) / 40;
      for (const yy of [sp.top(xx), sp.bottom(xx)]) {
        const [u, rho] = toUR(sp, xx, yy);
        for (let k = 0; k < 24; k++) fitPts.push(S.W(u, rho, (TAU * k) / 24));
      }
    }
    let qx0 = Infinity;
    let qx1 = -Infinity;
    let qy0 = Infinity;
    let qy1 = -Infinity;
    for (const v of fitPts) {
      const q = project(cam, v);
      qx0 = Math.min(qx0, q.x);
      qx1 = Math.max(qx1, q.x);
      qy0 = Math.min(qy0, q.y);
      qy1 = Math.max(qy1, q.y);
    }
    // margins: 16 px, and 26 px at the bottom for the axis's legend
    const m = 16;
    const mb = 26;
    const scale = Math.min((sbox.w - 2 * m) / Math.max(1e-9, qx1 - qx0), (sbox.h - m - mb) / Math.max(1e-9, qy1 - qy0));
    const ox = sbox.x + sbox.w / 2 - ((qx0 + qx1) / 2) * scale;
    const oy = sbox.y + m + (sbox.h - m - mb) / 2 + ((qy0 + qy1) / 2) * scale;
    const toS = (v: Vec3): P2 => {
      const q = project(cam, v);
      return [ox + q.x * scale, oy - q.y * scale];
    };
    const O = toS(S.W(uc, 0, 0));
    const U1 = toS(S.W(uc + 1, 0, 0));
    geo.current = { plot, solid: { box: solidBox, O, du: [U1[0] - O[0], U1[1] - O[1]], scale } };
    const back = (th: number) => {
      const r = S.radial(th);
      return r[0] * cam.toward[0] + r[1] * cam.toward[1] + r[2] * cam.toward[2] < 0;
    };
    const ringPts = (u: number, rho: number, k = 96): P2[] => {
      const out: P2[] = [];
      for (let i = 0; i <= k; i++) out.push(toS(S.W(u, rho, (TAU * i) / k)));
      return out;
    };
    /** a circle about the axis: the front half solid, the back half dashed */
    const strokeRing = (u: number, rho: number, color: string, alpha: number, width: number, k = 96) => {
      if (!(rho > 1e-9)) return;
      const pts = ringPts(u, rho, k);
      // segment i runs from pts[i] to pts[i + 1]; it is at the back when its middle is
      const isBack = (i: number) => back((TAU * (i + 0.5)) / k);
      let start = 0;
      for (let i = 1; i <= k; i++) {
        if (i < k && isBack(i) === isBack(start)) continue;
        const b = isBack(start);
        polyline(ctx, pts.slice(start, i + 1), withAlpha(color, b ? alpha * 0.7 : alpha), b ? width * 0.85 : width, b ? [4, 4] : []);
        start = i;
      }
    };
    const fillCol = mix(p.paper, p.accent, 0.16);
    const holeCol = mix(p.paper, p.ink, 0.07);

    // 1. the part of the solid up to x, faintly filled (the union of the projected slices, opaque so it never darkens)
    if (!isShell) {
      const k = 90;
      const band1: P2[] = [];
      const band2: P2[] = [];
      for (let i = 0; i <= k; i++) {
        const u = sp.a + ((x - sp.a) * i) / k;
        const R = sp.R(u);
        if (R > 1e-9) fillPoly(ctx, ringPts(u, R, 48), fillCol);
        band1.push(toS(S.W(u, R, S.thStar)));
        band2.push(toS(S.W(u, R, S.thStar + Math.PI)));
      }
      if (x > sp.a) fillPoly(ctx, [...band1, ...band2.reverse()], fillCol);
    } else {
      const k = 60;
      for (let i = 1; i <= k; i++) {
        const rho = sp.a + ((x - sp.a) * i) / k;
        const [u1] = toUR(sp, rho, sp.top(rho));
        const [u0] = toUR(sp, rho, sp.bottom(rho));
        fillPoly(ctx, ringPts(u1, rho, 48), fillCol);
        fillPoly(ctx, ringPts(u0, rho, 48), fillCol);
        fillPoly(ctx, [toS(S.W(u0, rho, S.thStar)), toS(S.W(u1, rho, S.thStar)), toS(S.W(u1, rho, S.thStar + Math.PI)), toS(S.W(u0, rho, S.thStar + Math.PI))], fillCol);
      }
    }

    // 2. the axis of rotation
    const A0 = toS(S.W(axisLo, 0, 0));
    const A1 = toS(S.W(axisHi, 0, 0));
    line(ctx, A0[0], A0[1], A1[0], A1[1], p.delta, 1.8, [9, 5]);
    {
      const L = Math.hypot(A1[0] - A0[0], A1[1] - A0[1]) || 1;
      const ux = (A1[0] - A0[0]) / L;
      const uy = (A1[1] - A0[1]) / L;
      ctx.save();
      ctx.fillStyle = p.delta;
      ctx.beginPath();
      ctx.moveTo(A1[0] + ux * 8, A1[1] + uy * 8);
      ctx.lineTo(A1[0] - uy * 4.5, A1[1] + ux * 4.5);
      ctx.lineTo(A1[0] + uy * 4.5, A1[1] - ux * 4.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 3. the family of cross-section circles
    if (!isShell) {
      const k = 8;
      for (let i = 0; i <= k; i++) {
        const u = sp.a + ((sp.b - sp.a) * i) / k;
        const end = i === 0 || i === k;
        strokeRing(u, sp.R(u), p.curve, end ? 1 : 0.55, end ? 1.8 : 1.1);
        if (sp.method === 'washer') strokeRing(u, sp.r(u), p.curve, end ? 0.8 : 0.35, end ? 1.5 : 1);
      }
    } else {
      const k = 7;
      for (let i = 1; i <= k; i++) {
        const rho = sp.a + ((sp.b - sp.a) * i) / k;
        const [u] = toUR(sp, rho, sp.top(rho));
        strokeRing(u, rho, p.curve, i === k ? 1 : 0.55, i === k ? 1.8 : 1.1);
      }
      const [ub] = toUR(sp, sp.b, sp.bottom(sp.b));
      if (sp.top(sp.b) - sp.bottom(sp.b) > 1e-9) strokeRing(ub, sp.b, p.curve, 1, 1.8);
    }

    // 4. the silhouette: the region's boundary at θ* and its mirror image at θ* + π
    for (const th of [S.thStar, S.thStar + Math.PI]) {
      const at = (pts: [number, number][]) =>
        pts.map(([xx, yy]) => {
          const [u, rho] = toUR(sp, xx, yy);
          return toS(S.W(u, rho, th));
        });
      // a part of the boundary that lies on the axis of rotation is not an edge of the solid: it is left out
      const offAxis = (pts: [number, number][]) => pts.some(([xx, yy]) => toUR(sp, xx, yy)[1] > 1e-9);
      const T = at(top);
      const B = at(bot);
      if (offAxis(top)) polyline(ctx, T, p.curve, 2.2);
      if (offAxis([top[0], bot[0]])) polyline(ctx, [T[0], B[0]], p.curve, 2.2);
      if (offAxis([top[top.length - 1], bot[bot.length - 1]])) polyline(ctx, [T[T.length - 1], B[B.length - 1]], p.curve, 2.2);
      // a washer's inner boundary is hidden inside the solid: dashed
      if (offAxis(bot)) polyline(ctx, B, sp.method === 'washer' ? withAlpha(p.curve, 0.7) : p.curve, sp.method === 'washer' ? 1.5 : 2.2, sp.method === 'washer' ? [5, 4] : []);
    }

    // 5. the current slice
    if (!isShell) {
      const R = sp.R(x);
      const r = sp.method === 'washer' ? sp.r(x) : 0;
      if (R > 1e-9) {
        const outer = ringPts(x, R);
        fillPoly(ctx, outer, withAlpha(p.accent, 0.42));
        if (r > 1e-9) fillPoly(ctx, ringPts(x, r), holeCol);
        polyline(ctx, outer, p.accent, 2.6);
        if (r > 1e-9) polyline(ctx, ringPts(x, r), p.accent, 2);
      }
      const c = toS(S.W(x, 0, 0));
      dot(ctx, c[0], c[1], 3.5, p.accent, p.paper);
    } else if (x > 1e-9) {
      const [u1] = toUR(sp, x, sp.top(x));
      const [u0] = toUR(sp, x, sp.bottom(x));
      const ringT = ringPts(u1, x);
      const ringB = ringPts(u0, x);
      const sideA = [toS(S.W(u0, x, S.thStar)), toS(S.W(u1, x, S.thStar))];
      const sideB = [toS(S.W(u0, x, S.thStar + Math.PI)), toS(S.W(u1, x, S.thStar + Math.PI))];
      fillPoly(ctx, ringB, withAlpha(p.accent, 0.18));
      fillPoly(ctx, [sideA[0], sideA[1], sideB[1], sideB[0]], withAlpha(p.accent, 0.18));
      strokeRing(u0, x, p.accent, 1, 2.2);
      polyline(ctx, ringT, p.accent, 2.4);
      polyline(ctx, sideA, p.accent, 2.4);
      polyline(ctx, sideB, p.accent, 2.4);
      if (s0.unroll) {
        // the cut, down the front of the shell
        const thF = Math.atan2(cam.toward[1], cam.toward[0]);
        const c0 = toS(S.W(u0, x, thF));
        const c1 = toS(S.W(u1, x, thF));
        line(ctx, c0[0], c0[1], c1[0], c1[1], p.ink, 1.8, [5, 3]);
      }
    }
    // the axis's legend, in the bottom margin of the view (never over the solid)
    {
      const ly = sbox.y + sbox.h - 11;
      line(ctx, sbox.x + sbox.w - 34, ly, sbox.x + sbox.w - 10, ly, p.delta, 1.8, [6, 4]);
      haloText(ctx, p, 'ציר הסיבוב', sbox.x + sbox.w - 40, ly, { font: font(700, fs - 1), color: p.delta, align: 'right', rtl: true });
    }

    // 6. the shell unrolled into a slab
    if (band) {
      const h = sp.top(x) - sp.bottom(x);
      const w = TAU * x;
      line(ctx, band.x + 8, band.y, band.x + band.w - 8, band.y, p.rule, 1);
      const room = { w: band.w - 2 * 40, h: band.h - 2 * 22 };
      const sc = w > 0 && h > 0 ? Math.min(scale, room.w / w, room.h / h) : scale;
      const reduced = sc < scale * 0.999;
      const cx = band.x + band.w / 2;
      const cy = band.y + band.h / 2 + 4;
      if (w > 1e-9 && h > 1e-9) {
        const W = w * sc;
        const H = h * sc;
        const d = 7;
        const x0 = cx - W / 2;
        const y0 = cy + H / 2;
        // the thickness dx as a thin oblique offset (a picture of dx, not to scale)
        fillPoly(
          ctx,
          [
            [x0, y0 - H],
            [x0 + d, y0 - H - d],
            [x0 + W + d, y0 - H - d],
            [x0 + W, y0 - H],
          ],
          withAlpha(p.accent, 0.12),
        );
        fillPoly(
          ctx,
          [
            [x0 + W, y0],
            [x0 + W + d, y0 - d],
            [x0 + W + d, y0 - H - d],
            [x0 + W, y0 - H],
          ],
          withAlpha(p.accent, 0.12),
        );
        ctx.save();
        ctx.fillStyle = withAlpha(p.accent, 0.3);
        ctx.fillRect(x0, y0 - H, W, H);
        ctx.strokeStyle = p.accent;
        ctx.lineWidth = 2;
        ctx.strokeRect(x0, y0 - H, W, H);
        ctx.restore();
        polyline(
          ctx,
          [
            [x0, y0 - H],
            [x0 + d, y0 - H - d],
            [x0 + W + d, y0 - H - d],
            [x0 + W + d, y0 - d],
            [x0 + W, y0],
          ],
          p.accent,
          1.4,
        );
        line(ctx, x0 + W, y0 - H, x0 + W + d, y0 - H - d, p.accent, 1.4);
        haloText(ctx, p, `2πx = ${fmt(w, 3)}`, cx, y0 + 11, { font: font(700), color: p.ink });
        // the height inside the slab when it is tall enough, else above its left end
        if (H >= 18) haloText(ctx, p, `f(x) = ${fmt(h, 3)}`, cx, y0 - H / 2, { font: font(700), color: p.ink });
        else haloText(ctx, p, `f(x) = ${fmt(h, 3)}`, x0, y0 - H - d - 9, { font: font(700), color: p.ink, align: 'left' });
        haloText(ctx, p, 'dx', x0 + W + d + 6, y0 - H - d, { font: font(700), color: p.ink, align: 'left' });
      }
      if (reduced) haloText(ctx, p, 'בקנה מידה מוקטן', band.x + band.w - 8, band.y + 10, { font: font(600, fs - 1), color: p.ink2, align: 'right', rtl: true });
    }
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1.6, worldHeight: 1, animate: false });
  useEffect(invalidate, [setup, narrow]);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const upd = () => setNarrow(el.getBoundingClientRect().width < NARROW);
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const aspect =
    setup.mode === 'between'
      ? narrow
        ? 0.9
        : 1.3
      : narrow
        ? setup.mode === 'shell' && setup.unroll
          ? 0.5
          : 0.62
        : setup.mode === 'shell' && setup.unroll
          ? 1.45
          : 1.65;

  /* ---------------------------------------------------------------- learner changes */
  /** The learner changed the figure: apply, then tick whatever the new state completes. */
  const apply = (patch: Partial<Setup>) => {
    const prev = cur.current;
    const next: Setup = { ...prev, ...patch };
    commit(next);
    for (const id of props.tasks ?? []) {
      const rule = RULES[id];
      if (!rule || !rule.needs.some((key) => key in patch)) continue;
      if (rule.state(next, patch, prev)) done(id);
    }
    if (sign(next.xb) !== 0) side.current = sign(next.xb);
  };

  const setPos = (v: number) => {
    const c = cur.current;
    if (c.mode === 'between') {
      const nv = fixB(c.pB, c.dy, roundTo(v, 0.01));
      if (nv !== c.xb) apply({ xb: nv });
    } else if (c.mode === 'disk') {
      const nv = fixR(c.pD, roundTo(v, 0.01));
      if (nv !== c.xd) apply({ xd: nv });
    } else {
      const nv = fixR(c.pS, roundTo(v, 0.01));
      if (nv !== c.xs) apply({ xs: nv });
    }
  };
  const posOf = (s: Setup) => (s.mode === 'between' ? s.xb : s.mode === 'disk' ? s.xd : s.xs);
  const rangeOf = (s: Setup): [number, number] =>
    s.mode === 'between' ? stripRange(s.pB, altOf(s.pB, s.dy)) : s.mode === 'disk' ? [REV[s.pD].a, REV[s.pD].b] : [REV[s.pS].a, REV[s.pS].b];

  const fromPointer = (e: PointerEvent) => {
    const c = cur.current;
    const g = geo.current;
    if (dragging.current === 'plot' && g.plot) {
      const pl = g.plot;
      const dx = pl.x.min + ((e.offsetX - pl.box.x) / pl.box.w) * (pl.x.max - pl.x.min);
      const dyv = pl.y.min + ((pl.box.y + pl.box.h - e.offsetY) / pl.box.h) * (pl.y.max - pl.y.min);
      if (c.mode === 'between') setPos(formsOf(c.pB, altOf(c.pB, c.dy)).variable === 'x' ? dx : dyv);
      else if (c.mode === 'shell') {
        const ax = REV[c.pS].axis;
        setPos(Math.abs(dx - (ax.kind === 'v' ? ax.c : 0)));
      }
      else setPos(dx);
    } else if (dragging.current === 'solid' && g.solid) {
      const { O, du, scale } = g.solid;
      if (c.mode === 'disk') {
        const d2 = du[0] * du[0] + du[1] * du[1] || 1;
        const sp = REV[c.pD];
        const uc = (sp.a + sp.b) / 2;
        // the solid is centred on the middle of its u-extent, which for disks is the middle of [a, b]
        setPos(uc + ((e.offsetX - O[0]) * du[0] + (e.offsetY - O[1]) * du[1]) / d2);
      } else if (c.mode === 'shell') setPos(Math.abs(e.offsetX - O[0]) / scale);
    }
  };
  const onPointerDown = (e: PointerEvent) => {
    const g = geo.current;
    const c = cur.current;
    if (c.mode === 'between') dragging.current = g.plot ? 'plot' : null;
    else if (g.solid && e.offsetX >= g.solid.box.x && e.offsetY >= g.solid.box.y && e.offsetX <= g.solid.box.x + g.solid.box.w && e.offsetY <= g.solid.box.y + g.solid.box.h)
      dragging.current = 'solid';
    else dragging.current = g.plot ? 'plot' : null;
    if (!dragging.current) return;
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
    const k = e.key;
    if (k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'ArrowUp' && k !== 'ArrowDown') return;
    e.preventDefault();
    const c = cur.current;
    const [lo, hi] = rangeOf(c);
    const sgn = k === 'ArrowLeft' || k === 'ArrowDown' ? -1 : 1;
    setPos(posOf(c) + sgn * Math.max(0.01, roundTo((hi - lo) / 150, 0.01)));
    setLive(describe(cur.current));
  };

  /* ---------------------------------------------------------------- text */
  const M = (q: { children: ComponentChildren }) => <bdi dir="ltr">{q.children}</bdi>;

  function axisHe(sp: RevSpec): string {
    if (sp.axis.kind === 'v') return sp.axis.c === 0 ? `ציר ${ltr('y')}` : `הישר ${ltr(sp.axisText)}`;
    return sp.axis.k === 0 ? `ציר ${ltr('x')}` : `הישר ${ltr(sp.axisText)}`;
  }
  function regionHe(sp: RevSpec): string {
    const r = sp.bottomText === 'y = 0' ? `מתחת ל-${ltr(sp.topText)}` : `בין ${ltr(sp.bottomText)} ל-${ltr(sp.topText)}`;
    return `${r}, ${ltr(sp.rangeText)}`;
  }
  function describe(s: Setup): string {
    if (s.mode === 'between') {
      const v = formsOf(s.pB, altOf(s.pB, s.dy)).variable;
      const st = stripAt(s.pB, s.xb, altOf(s.pB, s.dy));
      return `הפס ב-${v} = ${fmt(s.xb, 3)}: ${v === 'x' ? 'הגובה' : 'האורך'} ${st ? fmt(st.height) : '—'}.`;
    }
    if (s.mode === 'disk') {
      const sl = sliceAt(s.pD, s.xd);
      return `הפרוסה ב-x = ${fmt(s.xd, 3)}: שטח ${fmt(sl.area)}, הנפח עד x ${fmt(partialVolume(s.pD, s.xd))}.`;
    }
    const sl = sliceAt(s.pS, s.xs);
    return `קליפה ברדיוס ${fmt(s.xs, 3)}: 2πx·f(x) = ${fmt(sl.area)}, הנפח עד x ${fmt(partialVolume(s.pS, s.xs))}.`;
  }

  const spB = AREA[setup.pB];
  const spD = REV[setup.pD];
  const spS = REV[setup.pS];

  const label =
    setup.mode === 'between'
      ? `איור חי: התחום שבין ${spB.fText} ל-${spB.gText}, נקודות החיתוך מסומנות, ופס צר בתוך התחום. החלק שבו f למעלה ממולא, והחלק שבו g למעלה (או מימין) מקווקו בקווים אלכסוניים.`
      : setup.mode === 'disk'
        ? `איור חי: משמאל (בטלפון למעלה) התחום ${regionHe(spD)} עם ציר הסיבוב ${axisHe(spD)} ופרוסה ב-x. מימין (בטלפון למטה) גוף הסיבוב כשלד: קו המתאר, מעגלי חתך שחציים האחורי מקווקו, הפרוסה ב-x כ${spD.method === 'washer' ? 'טבעת' : 'דיסקה'} מודגשת, והחלק עד x ממולא בעדינות.`
        : `איור חי: משמאל (בטלפון למעלה) התחום ${regionHe(spS)} עם ציר הסיבוב ${axisHe(spS)} ופס אנכי ב-x. מימין גוף הסיבוב כשלד, והקליפה הגלילית ברדיוס x ובגובה f(x) מודגשת${setup.unroll ? ', ומתחתיה הקליפה פרוסה ללוח' : ''}.`;

  let readout: ComponentChildren;
  if (setup.mode === 'between') {
    const alt = altOf(setup.pB, setup.dy);
    const cut = formsOf(setup.pB, alt);
    const v = cut.variable;
    const st = stripAt(setup.pB, setup.xb, alt);
    const areaText = alt ? `${cut.forms.map((f) => f.areaText).join(' + ')} = ${spB.areaText}` : spB.areaText;
    const areaFull = Number.isInteger(spB.area) ? areaText : `${areaText} = ${fmt(spB.area)}`;
    const word = (u: 'f' | 'g') => (cut.variable === 'x' ? `למעלה ${u}` : `מימין ${u}`);
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>f: {spB.fText}</M>, <M>g: {spB.gText}</M>
        </span>
        <span class="q" data-readout="cuts">
          נקודות החיתוך:{' '}
          {spB.cutsText.map((t, i) => (
            <>
              {i > 0 && (i === spB.cutsText.length - 1 ? ' ו-' : ', ')}
              <M>
                {spB.variable} = {t}
              </M>
            </>
          ))}
          ; הנקודות{' '}
          {spB.points.map((pt, i) => (
            <>
              {i > 0 && ', '}
              <M>{pt.text}</M>
            </>
          ))}
        </span>
        <span class="q" data-readout="strip">
          {st ? (
            <>
              הפס ב-
              <M>
                {v} = <b>{fmt(setup.xb, 3)}</b>
              </M>
              {!alt && <>: {word(st.form.upper)}</>}; {v === 'x' ? 'הגובה' : 'האורך'}{' '}
              <M>
                {st.form.heightText} = <b>{fmt(st.height)}</b>
              </M>
              {alt && cut.forms.length > 1 && (
                <>
                  {' '}
                  (הגבול התחתון מחליף נוסחה ב-<M>x = {minus(String(cut.forms[1].lo))}</M>)
                </>
              )}
            </>
          ) : (
            'הפס מחוץ לתחום.'
          )}
        </span>
        {setup.showArea && (
          <span class="q" data-readout="area">
            השטח:{' '}
            <M>
              <b>{areaFull}</b>
            </M>
            {spB.forms.length > 1 && !alt && <> (הסדר בין הגרפים מתחלף, ולכן מחשבים כל חלק לחוד)</>}
          </span>
        )}
      </>
    );
  } else if (setup.mode === 'disk') {
    const x = setup.xd;
    const sl = sliceAt(setup.pD, x);
    const R = sl.kind === 'shell' ? NaN : sl.R;
    const r = sl.kind === 'shell' ? NaN : sl.r;
    const washer = spD.method === 'washer';
    readout = (
      <>
        <span class="q" data-readout="fn">
          התחום {regionHe(spD)}; ציר הסיבוב: {axisHe(spD)}
        </span>
        <span class="q" data-readout="x">
          מקום הפרוסה:{' '}
          <M>
            x = <b>{fmt(x, 3)}</b>
          </M>
        </span>
        <span class="q" data-readout="radii">
          <M>
            R(x) = {spD.Rtext}
            {!isConstText(spD.Rtext) && (
              <>
                {' '}
                = <b>{fmt(R)}</b>
              </>
            )}
          </M>
          ,{' '}
          <M>
            r(x) = {spD.rtext}
            {!isConstText(spD.rtext) && (
              <>
                {' '}
                = <b>{fmt(r)}</b>
              </>
            )}
          </M>
          {washer ? (r > 1e-9 ? ': הפרוסה היא טבעת' : ': כאן החור נסגר') : ': הפרוסה היא דיסקה (אין חור)'}
        </span>
        <span class="q" data-readout="slice">
          שטח הפרוסה:{' '}
          <M>
            A(x) = {washer ? 'π(R² − r²)' : 'πR²'} = <b>{fmt(sl.area)}</b>
          </M>
        </span>
        <span class="q" data-readout="partial">
          הנפח עד x:{' '}
          <M>
            V(x) = {spD.Ptext} = <b>{fmt(partialVolume(setup.pD, x))}</b>
          </M>
        </span>
        {setup.showVolume && (
          <span class="q" data-readout="volume">
            הנפח כולו:{' '}
            <M>
              V = <b>{spD.volumeText}</b> ≈ {fmt(spD.volume)}
            </M>
          </span>
        )}
      </>
    );
  } else {
    const x = setup.xs;
    const sl = sliceAt(setup.pS, x);
    const h = sl.kind === 'shell' ? sl.height : NaN;
    readout = (
      <>
        <span class="q" data-readout="fn">
          התחום {regionHe(spS)}; ציר הסיבוב: {axisHe(spS)}
        </span>
        <span class="q" data-readout="x">
          רדיוס הקליפה:{' '}
          <M>
            x = <b>{fmt(x, 3)}</b>
          </M>
        </span>
        <span class="q" data-readout="height">
          גובה הקליפה:{' '}
          <M>
            f(x) = {spS.heightText} = <b>{fmt(h)}</b>
          </M>
        </span>
        <span class="q" data-readout="slice">
          <M>
            2πx·f(x) = 2π · {fmt(x, 3)} · {fmt(h)} = <b>{fmt(sl.area)}</b>
          </M>
          : נפח הקליפה הוא בערך זה כפול <M>dx</M>
        </span>
        <span class="q" data-readout="partial">
          הנפח עד x:{' '}
          <M>
            V(x) = {spS.Ptext} = <b>{fmt(partialVolume(setup.pS, x))}</b>
          </M>
        </span>
        {setup.unroll && (
          <span class="q" data-readout="slab">
            הקליפה פרוסה ללוח:{' '}
            <M>
              2πx × f(x) × dx = {fmt(2 * Math.PI * x)} × {fmt(h)} × dx
            </M>
          </span>
        )}
        {setup.showVolume && (
          <span class="q" data-readout="volume">
            הנפח כולו:{' '}
            <M>
              V = <b>{spS.volumeText}</b> ≈ {fmt(spS.volume)}
            </M>
          </span>
        )}
      </>
    );
  }

  const presetIds: readonly string[] = setup.mode === 'between' ? AREA_IDS : setup.mode === 'disk' ? DISK_IDS : SHELL_IDS;
  const presetText = (id: string) => {
    if (isAreaId(id)) return ltr(AREA[id].text);
    if (isDiskId(id) || isShellId(id)) {
      const sp = REV[id as RevId];
      return `${regionHe(sp)}, סביב ${axisHe(sp)}`;
    }
    return id;
  };
  const chosen = setup.mode === 'between' ? setup.pB : setup.mode === 'disk' ? setup.pD : setup.pS;
  const [rlo, rhi] = rangeOf(setup);
  const vName = setup.mode === 'between' ? formsOf(setup.pB, altOf(setup.pB, setup.dy)).variable : 'x';
  const sliderLabel = setup.mode === 'between' ? `מקום הפס ${vName}` : setup.mode === 'disk' ? 'מקום הפרוסה x' : 'רדיוס הקליפה x';

  return (
    <SimShell
      fig={props.id}
      label={label}
      canvasRef={canvasRef}
      aspect={aspect}
      live={live}
      tasks={tasks}
      cursor={vName === 'y' ? 'ns-resize' : 'ew-resize'}
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
          <label class="sl-select" data-control="preset">
            <span class="sl-lab">התחום</span>
            <select
              value={chosen}
              onChange={(e) => {
                const v = (e.target as HTMLSelectElement).value;
                const c = cur.current;
                if (c.mode === 'between' && isAreaId(v)) {
                  const xb = defaultB(v, true);
                  anchor.current.b = xb;
                  apply({ pB: v, dy: true, xb });
                } else if (c.mode === 'disk' && isDiskId(v)) {
                  anchor.current.d = REV[v].x0;
                  apply({ pD: v, xd: REV[v].x0 });
                } else if (c.mode === 'shell' && isShellId(v)) {
                  anchor.current.s = REV[v].x0;
                  apply({ pS: v, xs: REV[v].x0 });
                }
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
          <div class="group" role="group" aria-label="שכבות">
            {setup.mode === 'between' && <Toggle label="הצגת השטח" on={setup.showArea} swatch="var(--limit)" onChange={(on) => apply({ showArea: on })} />}
            {setup.mode === 'between' && spB.alt && (
              <Toggle
                label="פסים אופקיים"
                on={setup.dy}
                swatch="var(--accent)"
                onChange={(on) => {
                  const xb = defaultB(cur.current.pB, on);
                  anchor.current.b = xb;
                  apply({ dy: on, xb });
                }}
              />
            )}
            {setup.mode === 'shell' && <Toggle label="פריסת הקליפה" on={setup.unroll} swatch="var(--accent)" onChange={(on) => apply({ unroll: on })} />}
            {setup.mode !== 'between' && <Toggle label="הצגת הנפח כולו" on={setup.showVolume} swatch="var(--limit)" onChange={(on) => apply({ showVolume: on })} />}
          </div>
          <div class="sl-ctl" data-control="x">
            <Slider label={sliderLabel} value={posOf(setup)} min={rlo} max={rhi} step={0.01} format={(v) => `${vName} = ${fmt(v, 3)}`} onChange={setPos} />
          </div>
        </>
      }
    />
  );
}
