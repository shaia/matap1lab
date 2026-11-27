/**
 * ParamLab (chapter 9.1, a curve as the path of a moving point r(t)): three modes. Maths: src/math/paramcurves.ts, whose
 * STORED closed forms (r, r′, the Cartesian equation of every plane preset and its whole set, the helix) give every value
 * a readout shows; nothing here is numerical estimation. Canvases are math space and stay LTR: the plane panels have EQUAL
 * scales on both axes (a circle looks round), x to the right, y up; sliders for math quantities are `dir="ltr"`. The 3D
 * panels are an orthographic view (src/sims/core/axo.ts) turned about the vertical axis; in the world-line view the axes
 * are (x, t, y) so the shadow plane t = t0 shows x to the right and y up exactly as the plane does, and t is rescaled to
 * fit (the caption says so). Panels are stacked in one canvas, so they stack on a phone (390 px) without sideways scroll.
 * A play button ("הפעלה" / "עצירה") moves t at a steady rate (the whole range in 6 s) and loops; it is shown only while
 * motionAllowed() (stillness: no play button, slider only), and a running play stops itself if stillness is switched on.
 *
 * mode 'trace' (button "התחקות"): preset f of PC (segment, circle, ellipse, parab, parab4, halfparab, nodal, twice).
 *     Main panel: the plane with the curve from t0 to t bold (--curve) and the rest faint and dashed when `ghost` is on
 *     (hidden when off), the point r(t) (ink), the position vector from the origin (ink, thin), an arrow at the start for
 *     the direction of motion and a ring on the starting point. Two small panels (below the main one on a phone): x(t) and
 *     y(t) against t, with the current t marked. `showEq` adds the whole set of the Cartesian equation faintly behind the
 *     curve (--accent, dotted) and the readout line "המשוואה: … — העקום הוא …". `nodal` marks the crossing point (a ring
 *     at the origin) once t has passed both t = −1 and t = 1. t by the slider, by dragging on the main panel (the
 *     parameter whose point is nearest to the pointer, preferring the one closest to the current t) or on a side panel
 *     (t at the pointer's x), by ←/→, or by play.
 * mode 'world' (button "קו עולם"): preset f of PC. Left (above on a phone) the plane curve as in `trace`, no side
 *     panels; right (below) the world line {(t, x(t), y(t))} in a turning 3D view, drawn up to t (the rest faint), its
 *     shadow on the plane t = t0 (the curve itself, dashed) with a vertical dropline from the world-line point to the
 *     shadow point and faint droplines along the traced part. `compare`, for a preset with a twin (circle with twice,
 *     parab with parab4), draws the twin's world line too (dashed --accent): one curve, two world lines. Drag on the 3D
 *     panel turns the view (azimuth); drag on the plane moves t; ←/→ move t.
 * mode 'space' (button "עקום במרחב"): preset f of SC (helix, segment3). A 3D view with the x, y, z axes, the curve up to
 *     t bold and the rest faint, the point and its position vector (ink). `shadow` draws the projection onto the xy-plane
 *     (dashed) and droplines. For `helix` the slider p (rise per turn, 0…3, default 1), a bracket on the z axis from 0
 *     to p with dotted links to the helix points one turn apart, and the readout "עלייה בסיבוב: p". Drag turns the view.
 *
 * Props (defaults): id (required); mode ('trace'); modes (the mode buttons shown; default the starting mode only);
 * tasks ([]). f (a PC id for trace and world, which share one preset and one t, or an SC id for space; defaults 'circle'
 * and 'helix'); t (the starting parameter of the starting mode's preset; default a quarter of the way along the range;
 * clamped to the range); ghost (true), showEq (false), compare (false), az (view azimuth in degrees, 35), p (helix rise
 * per turn, 1; clamped to 0…3), shadow (false).
 * Every prop is also a step key (`<Step fig=… set={{…}}>`); a key left out keeps its value; `f` is routed to the mode
 * group whose registry holds it (trace/world: PC, space: SC); a new preset without `t` puts t at the default (a quarter
 * of the range); `t` is the current mode's t. A step stops play. A state set by a step never ticks a task, and a state that
 * already had a task's property when a step or reset made it must be left and found again (rotation and pitch are counted
 * from the value at the last step, reset or mode change). The learner can also pick the preset from a list (select
 * "העקום": the presets of the current mode).
 *
 * Tasks (ticked only inside the learner's own drag, key, slider, select, button, toggle or play):
 *   trace:  pc-trace (t reaches the end t1 of the range, on any preset), pc-part (preset halfparab, showEq on, t ≥ 3π/2:
 *           the curve has gone out to both x = 1 and x = −1 and covers only |x| ≤ 1), pc-cross (preset nodal, t ≥ 1:
 *           the point has come back to the origin)
 *   world:  wl-compare (compare on with circle or parab), wl-rotate (the view azimuth differs by ≥ 30° from its value at
 *           the last step / reset / mode change)
 *   space:  sp-pitch (preset helix, p differs by ≥ 0.5 from its value at the last step / reset / mode change),
 *           sp-shadow (shadow on)
 *
 * Hooks for e2e specs (inside `#<id>`; numbers use U+2212 for minus):
 *   buttons by role and name: the mode buttons "התחקות", "קו עולם", "עקום במרחב"; the toggles "המשך העקום" (ghost),
 *     "המשוואה הקרטזית" (showEq), "אותו עקום בפרמטריזציה אחרת" (compare; only for presets with a twin), "הצל על מישור xy"
 *     (shadow); "הפעלה" / "עצירה" (play; absent in still mode); "איפוס" (reset)
 *   [data-control="preset"] select    the preset (option values are the preset ids of the current mode)
 *   [data-control=…] input            t (the range of the preset, 500 steps; trace, world, space), p (0…3, step 0.05;
 *                                     space with helix), az (0…359, step 1; world, space)
 *   canvas                            drag: trace moves t (main or side panels), world moves t on the plane and turns the
 *                                     view on the 3D panel, space turns the view; ←/→ change t by 1% of the range
 *   [data-readout=…]                  trace: fn, t, x, y, eq (with showEq), cross (nodal, t ≥ 1)
 *                                     world: fn, t, point, compare (with compare and a twin)
 *                                     space: fn, t, point, pitch (helix), shadow (with shadow)
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import {
  HELIX_P,
  PC,
  PC_IDS,
  SC,
  SC_IDS,
  TAU,
  isPcId,
  isScId,
  startT,
  type PcId,
  type ScId,
} from '~/math/paramcurves';
import type { Vec3 } from '~/math/vec';
import { motionAllowed } from '~/progress/settings';
import { markTask } from '~/progress/store';
import { subscribeSteps, type StepState } from '~/ui/steps';
import { camera, makeProjector } from './core/axo';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { sci } from './core/format';
import { arrow, withAlpha } from './core/ink';
import { drawAxes, makePlot, type Box, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import './ParamLab.css';

export type ParamMode = 'trace' | 'world' | 'space';

export interface ParamLabProps {
  id: string;
  mode?: ParamMode;
  /** the mode buttons shown (default: the starting mode only) */
  modes?: ParamMode[];
  /** a PC id (trace, world) or an SC id (space) */
  f?: string;
  t?: number;
  ghost?: boolean;
  showEq?: boolean;
  compare?: boolean;
  az?: number;
  p?: number;
  shadow?: boolean;
  tasks?: string[];
}

interface Setup {
  mode: ParamMode;
  pP: PcId;
  tP: number;
  ghost: boolean;
  showEq: boolean;
  compare: boolean;
  az: number;
  pS: ScId;
  tS: number;
  p: number;
  shadow: boolean;
}

const ltr = (s: string) => String.fromCharCode(0x2066) + s.replace(/ /g, String.fromCharCode(0xa0)) + String.fromCharCode(0x2069);

const TASK_LABEL: Record<string, string> = {
  'pc-trace': `הזיזו את ${ltr('t')} מתחילת הטווח ועד סופו (בפס, בגרירה או בהפעלה). איזה חלק מהמישור העקום עובר בו?`,
  'pc-part': `בחרו את ${ltr('(sin t, sin² t)')}, הדליקו "המשוואה הקרטזית" והזיזו את ${ltr('t')} עד ${ltr('3π/2')} לפחות. איזה חלק של הפרבולה העקום עובר בו?`,
  'pc-cross': `בחרו את ${ltr('(t² − 1, t³ − t)')} והזיזו את ${ltr('t')} אל מעבר ל-${ltr('1')}. מה קורה לנקודה?`,
  'wl-compare': `בחרו את המעגל או את ${ltr('(t, t²)')} והדליקו "אותו עקום בפרמטריזציה אחרת". מה שונה בין שני קווי העולם, ומה משותף להם?`,
  'wl-rotate': 'סובבו את המבט בגרירה על הלוח התלת-ממדי (או בפס "סיבוב המבט") ב-30 מעלות לפחות. איך נראה קו העולם מהצד?',
  'sp-pitch': `בחרו את הסליל והזיזו את ${ltr('p')} בחצי לפחות. מה משתנה בציור, ומה נשאר?`,
  'sp-shadow': `הדליקו "הצל על מישור xy". איזה עקום הוא הצל של הסליל, ומה קורה לצל כש-${ltr('p')} משתנה?`,
};

const MODE_LABEL: Record<ParamMode, string> = { trace: 'התחקות', world: 'קו עולם', space: 'עקום במרחב' };

const DEFAULT_AZ = 35;
const EL_WORLD = 18;
const EL_SPACE = 22;
const PLAY_SECONDS = 6;
const ROTATE_TASK = 30;
const PITCH_TASK = 0.5;
const END_TOL = 0.004;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const bool = (x: unknown): boolean | null => (typeof x === 'boolean' ? x : null);
const minus = (s: string) => s.replace(/-/g, '−');
const fmt = (x: number, sig = 4) => (Number.isNaN(x) ? '—' : Math.abs(x) < 1e-12 ? '0' : minus(sci(x, sig)));
/** a coordinate: three decimals at most, trailing zeros dropped, |x| < 5·10⁻⁴ is 0, never scientific */
const coord = (x: number) => {
  if (Number.isNaN(x)) return '—';
  if (Math.abs(x) < 5e-4) return '0';
  return minus(x.toFixed(3).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, ''));
};
const wrapAz = (a: number) => ((a % 360) + 360) % 360;
const azDiff = (a: number, b: number) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);
const fixT = (range: readonly [number, number], t: number) => clamp(Math.round(t * 1e6) / 1e6, range[0], range[1]);
const fixP = (p: number) => clamp(Math.round(p * 100) / 100, HELIX_P.min, HELIX_P.max);
const rangeP = (id: PcId) => PC[id].range;
const rangeS = (id: ScId) => SC[id].range;
const span = (r: readonly [number, number]) => r[1] - r[0];

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
function seg(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width = 1.3, dash: number[] = []) {
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
/** a polyline through screen points, optionally clipped to a box */
function poly(ctx: CanvasRenderingContext2D, pts: readonly (readonly [number, number])[], color: string, width: number, dash: number[] = [], clip?: Box) {
  if (pts.length < 2) return;
  ctx.save();
  if (clip) {
    ctx.beginPath();
    ctx.rect(clip.x, clip.y - 2, clip.w, clip.h + 4);
    ctx.clip();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.setLineDash(dash);
  ctx.beginPath();
  pts.forEach((q, i) => (i === 0 ? ctx.moveTo(q[0], q[1]) : ctx.lineTo(q[0], q[1])));
  ctx.stroke();
  ctx.restore();
}
/** points of f at equal parameter steps over [a, b] */
function along<T>(f: (u: number) => T, a: number, b: number, n: number): T[] {
  return Array.from({ length: n + 1 }, (_, i) => f(a + ((b - a) * i) / n));
}

/** the plane panel: a plot whose two axes have the same scale, centred in `box` */
function planePlot(box: Box, win: { x: readonly [number, number]; y: readonly [number, number] }): Plot {
  const xs = win.x[1] - win.x[0];
  const ys = win.y[1] - win.y[0];
  const s = Math.min(box.w / xs, box.h / ys);
  const w = xs * s;
  const h = ys * s;
  const b: Box = { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
  return makePlot(b, { min: win.x[0], max: win.x[1], label: 'x' }, { min: win.y[0], max: win.y[1], label: 'y' });
}

function axisLines(ctx: CanvasRenderingContext2D, p: Palette, pl: Plot) {
  drawAxes(ctx, pl, p);
  if (pl.y.min < 0 && pl.y.max > 0) seg(ctx, pl.box.x, pl.py(0), pl.box.x + pl.box.w, pl.py(0), withAlpha(p.ink2, 0.75), 1.2);
  if (pl.x.min < 0 && pl.x.max > 0) seg(ctx, pl.px(0), pl.box.y, pl.px(0), pl.box.y + pl.box.h, withAlpha(p.ink2, 0.75), 1.2);
}

interface Regions {
  /** the allocated area of the plane panel and its plot */
  plane: { area: Box; plot: Plot } | null;
  /** the side panels x(t), y(t) (trace) */
  sides: Plot[];
  /** the 3D panel */
  three: Box | null;
}

function traceBoxes(w: number, h: number): { main: Box; sides: Box[] } {
  if (w >= 520) {
    const split = Math.round(w * 0.56);
    const x0 = split + 44;
    const sh = (h - 8) / 2;
    return {
      main: { x: 46, y: 10, w: Math.max(1, split - 54), h: Math.max(1, h - 44) },
      sides: [0, 1].map((i) => ({ x: x0, y: 8 + i * sh + 6, w: Math.max(1, w - x0 - 14), h: Math.max(1, sh - 6 - 26) })),
    };
  }
  const unit = (h - 6) / 3.3;
  const x = 40;
  const wd = Math.max(1, w - x - 12);
  const sides: Box[] = [0, 1].map((i) => ({ x, y: 6 + 1.8 * unit + i * 0.75 * unit + 6, w: wd, h: Math.max(1, 0.75 * unit - 6 - 24) }));
  return { main: { x, y: 8, w: wd, h: Math.max(1, 1.8 * unit - 8 - 26) }, sides };
}

function worldBoxes(w: number, h: number): { plane: Box; three: Box } {
  if (w >= 520) {
    const split = Math.round(w * 0.36);
    return { plane: { x: 46, y: 10, w: Math.max(1, split - 54), h: Math.max(1, h - 44) }, three: { x: split, y: 4, w: Math.max(1, w - split - 6), h: Math.max(1, h - 8) } };
  }
  const unit = (h - 6) / 2.1;
  return { plane: { x: 40, y: 8, w: Math.max(1, w - 52), h: Math.max(1, unit - 8 - 26) }, three: { x: 6, y: 6 + unit, w: Math.max(1, w - 12), h: Math.max(1, 1.1 * unit - 4) } };
}

/** the orthographic projector of a box-shaped scene, turned by az, looked at from elevation el */
function projector(box: Box, az: number, el: number, lo: Vec3, hi: Vec3) {
  const centre: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  const R = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2;
  const scale = (0.46 * Math.min(box.w, box.h)) / R;
  const f = makeProjector(camera(az, el), { cx: box.x + box.w / 2, cy: box.y + box.h / 2, scale });
  return (q: Vec3): [number, number] => {
    const r = f([q[0] - centre[0], q[1] - centre[1], q[2] - centre[2]]);
    return [r[0], r[1]];
  };
}

interface Rule {
  needs: (keyof Setup)[];
  state: (s: Setup, patch: Partial<Setup>, prev: Setup) => boolean;
}

export default function ParamLab(props: ParamLabProps) {
  const startMode: ParamMode = props.mode ?? 'trace';
  const modes: ParamMode[] = props.modes ?? [startMode];
  const initial = (): Setup => {
    const pP: PcId = isPcId(props.f) ? props.f : 'circle';
    const pS: ScId = isScId(props.f) ? props.f : 'helix';
    const given = props.t;
    return {
      mode: startMode,
      pP,
      tP: fixT(rangeP(pP), startMode !== 'space' && given !== undefined ? given : startT(rangeP(pP))),
      ghost: props.ghost ?? true,
      showEq: props.showEq ?? false,
      compare: props.compare ?? false,
      az: wrapAz(props.az ?? DEFAULT_AZ),
      pS,
      tS: fixT(rangeS(pS), startMode === 'space' && given !== undefined ? given : startT(rangeS(pS))),
      p: fixP(props.p ?? HELIX_P.default),
      shadow: props.shadow ?? false,
    };
  };
  const [setup, setSetup] = useState<Setup>(initial);
  const cur = useRef(setup);
  const [live, setLive] = useState('');
  const [narrow, setNarrow] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [still, setStill] = useState(false);
  const hit = useRef<Regions>({ plane: null, sides: [], three: null });
  const drag = useRef<{ kind: 'time' | 'rot'; x: number } | null>(null);
  /** tasks whose state held when the last step or reset made it: they must be left and found again */
  const held = useRef<Set<string>>(new Set());
  /** the azimuth and the pitch at the last step, reset or mode change: the rotation and pitch tasks count from them */
  const baseAz = useRef(setup.az);
  const baseP = useRef(setup.p);

  const RULES: Record<string, Rule> = {
    'pc-trace': { needs: ['tP'], state: (s) => s.mode === 'trace' && s.tP >= rangeP(s.pP)[1] - END_TOL * span(rangeP(s.pP)) },
    'pc-part': { needs: ['tP', 'showEq'], state: (s) => s.mode === 'trace' && s.pP === 'halfparab' && s.showEq && s.tP >= 1.5 * Math.PI - END_TOL * TAU },
    'pc-cross': { needs: ['tP'], state: (s) => s.mode === 'trace' && s.pP === 'nodal' && s.tP >= 1 - 1e-3 },
    'wl-compare': { needs: ['compare', 'pP'], state: (s) => s.mode === 'world' && s.compare && (s.pP === 'circle' || s.pP === 'parab') },
    'wl-rotate': { needs: ['az'], state: (s) => s.mode === 'world' && azDiff(s.az, baseAz.current) >= ROTATE_TASK },
    'sp-pitch': { needs: ['p'], state: (s) => s.mode === 'space' && s.pS === 'helix' && Math.abs(s.p - baseP.current) >= PITCH_TASK },
    'sp-shadow': { needs: ['shadow'], state: (s) => s.mode === 'space' && s.shadow },
  };

  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const done = (t: string) => {
    if (props.tasks?.includes(t)) markTask(`${props.id}:${t}`);
  };
  const rebase = (s: Setup) => {
    baseAz.current = s.az;
    baseP.current = s.p;
    held.current = new Set((props.tasks ?? []).filter((id) => RULES[id] && RULES[id].state(s, {}, s)));
  };
  const commit = (s: Setup) => {
    cur.current = s;
    setSetup(s);
  };
  useEffect(() => rebase(cur.current), []);

  /* stillness: no play button, and a running play stops */
  useEffect(() => {
    const upd = () => {
      const quiet = !motionAllowed();
      setStill(quiet);
      if (quiet) setPlaying(false);
    };
    upd();
    window.addEventListener('matap1lab:settings', upd);
    return () => window.removeEventListener('matap1lab:settings', upd);
  }, []);

  useEffect(
    () =>
      subscribeSteps(props.id, (st: StepState) => {
        const prev = cur.current;
        const mode = typeof st.mode === 'string' && modes.includes(st.mode as ParamMode) ? (st.mode as ParamMode) : prev.mode;
        const next: Setup = { ...prev, mode };
        let newP = false;
        let newS = false;
        if (isPcId(st.f)) {
          newP = st.f !== prev.pP;
          next.pP = st.f;
        }
        if (isScId(st.f)) {
          newS = st.f !== prev.pS;
          next.pS = st.f;
        }
        next.ghost = bool(st.ghost) ?? prev.ghost;
        next.showEq = bool(st.showEq) ?? prev.showEq;
        next.compare = bool(st.compare) ?? prev.compare;
        next.shadow = bool(st.shadow) ?? prev.shadow;
        const sa = num(st.az);
        if (sa !== null) next.az = wrapAz(sa);
        const sp = num(st.p);
        if (sp !== null) next.p = fixP(sp);
        const sT = num(st.t);
        next.tP = fixT(rangeP(next.pP), sT !== null && mode !== 'space' ? sT : newP ? startT(rangeP(next.pP)) : prev.tP);
        next.tS = fixT(rangeS(next.pS), sT !== null && mode === 'space' ? sT : newS ? startT(rangeS(next.pS)) : prev.tS);
        setPlaying(false);
        commit(next);
        rebase(next);
      }),
    [props.id],
  );

  const s0 = setup;

  /* ---------------------------------------------------------------- drawing */
  const drawPlane = (ctx: CanvasRenderingContext2D, p: Palette, pl: Plot, s: Setup) => {
    const sp = PC[s.pP];
    const [a, b] = sp.range;
    const t = s.tP;
    const toS = (q: readonly [number, number]): [number, number] => [pl.px(q[0]), pl.py(q[1])];
    axisLines(ctx, p, pl);
    if (s.mode === 'trace' && s.showEq) for (const line of sp.eqSet()) poly(ctx, line.map(toS), withAlpha(p.accent, 0.85), 1.9, [2, 5], pl.box);
    if (s.mode === 'trace' ? s.ghost : true) poly(ctx, along(sp.r, a, b, 480).map(toS), withAlpha(p.curve, 0.38), 1.6, [6, 5], pl.box);
    const n = Math.max(2, Math.round((480 * (t - a)) / (b - a)));
    if (t > a) poly(ctx, along(sp.r, a, t, n).map(toS), p.curve, 3.4, [], pl.box);
    // the start: a ring and an arrow for the direction of motion
    const [sx, sy] = toS(sp.r(a));
    const ahead = toS(sp.r(a + 0.004 * (b - a)));
    const dl = Math.hypot(ahead[0] - sx, ahead[1] - sy);
    if (dl > 1e-6) arrow(ctx, sx, sy, sx + ((ahead[0] - sx) / dl) * 30, sy + ((ahead[1] - sy) / dl) * 30, { color: p.ink, width: 1.8, head: 8 });
    ring(ctx, sx, sy, 4, p.ink, p.paper, 1.8);
    if (s.pP === 'nodal' && s.mode === 'trace' && t >= 1 - 1e-3) {
      const [cx, cy] = toS([0, 0]);
      ring(ctx, cx, cy, 9, p.limit, p.paper, 2.4);
      haloText(ctx, p, 'חיתוך', cx + 14, cy - 13, { font: `700 12px ${p.fontUi}`, color: p.limit, align: 'left' });
    }
    // the position vector from the origin and the point
    const [qx, qy] = toS(sp.r(t));
    if (pl.x.min <= 0 && pl.x.max >= 0 && pl.y.min <= 0 && pl.y.max >= 0) arrow(ctx, pl.px(0), pl.py(0), qx, qy, { color: p.ink, width: 1.3, head: 7, alpha: 0.75 });
    dot(ctx, qx, qy, 6, p.ink, p.paper);
  };

  const drawSide = (ctx: CanvasRenderingContext2D, p: Palette, box: Box, s: Setup, k: 0 | 1): Plot => {
    const sp = PC[s.pP];
    const [a, b] = sp.range;
    const val = (u: number) => sp.r(u)[k];
    const vs = along(val, a, b, 200);
    const lo = Math.min(...vs);
    const hi = Math.max(...vs);
    const pad = (hi - lo || 1) * 0.12;
    const pl = makePlot(box, { min: a, max: b }, { min: lo - pad, max: hi + pad });
    drawAxes(ctx, pl, p);
    if (pl.y.min < 0 && pl.y.max > 0) seg(ctx, box.x, pl.py(0), box.x + box.w, pl.py(0), withAlpha(p.ink2, 0.6), 1.1);
    const toS = (u: number): [number, number] => [pl.px(u), pl.py(val(u))];
    if (s.ghost) poly(ctx, along(toS as (u: number) => [number, number], a, b, 240), withAlpha(p.curve, 0.38), 1.5, [6, 5], box);
    const t = s.tP;
    seg(ctx, pl.px(t), box.y, pl.px(t), box.y + box.h, withAlpha(p.accent, 0.6), 1.2, [3, 4]);
    if (t > a) poly(ctx, along(toS, a, t, Math.max(2, Math.round((240 * (t - a)) / (b - a)))), p.curve, 3, [], box);
    dot(ctx, pl.px(t), pl.py(val(t)), 4.8, p.ink, p.paper);
    haloText(ctx, p, k === 0 ? 'x(t)' : 'y(t)', box.x + 6, box.y + 9, { font: `700 12px ${p.fontUi}`, color: p.curve, align: 'left' });
    haloText(ctx, p, 't', box.x + box.w - 4, box.y + box.h - 8, { font: `700 12px ${p.fontUi}`, color: p.ink2, align: 'right' });
    return pl;
  };

  const drawWorld3D = (ctx: CanvasRenderingContext2D, p: Palette, box: Box, s: Setup) => {
    const sp = PC[s.pP];
    const tw = sp.twin ? PC[sp.twin] : null;
    const lo = sp.range[0];
    const hi = Math.max(sp.range[1], tw ? tw.range[1] : sp.range[1]);
    const win = sp.window;
    const ts = (1.25 * Math.max(win.x[1] - win.x[0], win.y[1] - win.y[0])) / (hi - lo);
    const T = (t: number) => (t - lo) * ts;
    const W = (t: number, q: readonly [number, number]): Vec3 => [q[0], T(t), q[1]];
    const pr = projector(box, s.az, EL_WORLD, [win.x[0], 0, win.y[0]], [win.x[1], (hi - lo) * ts, win.y[1]]);
    const P = (t: number, q: readonly [number, number]) => pr(W(t, q));
    const t = s.tP;
    const [a, b] = sp.range;
    // the shadow plane t = t0: frame and its axes
    const corners: Vec3[] = [
      [win.x[0], 0, win.y[0]],
      [win.x[1], 0, win.y[0]],
      [win.x[1], 0, win.y[1]],
      [win.x[0], 0, win.y[1]],
      [win.x[0], 0, win.y[0]],
    ];
    ctx.save();
    ctx.beginPath();
    corners.forEach((c, i) => (i === 0 ? ctx.moveTo(...pr(c)) : ctx.lineTo(...pr(c))));
    ctx.fillStyle = withAlpha(p.ink2, 0.07);
    ctx.fill();
    ctx.restore();
    poly(ctx, corners.map(pr), withAlpha(p.ink2, 0.7), 1.2);
    poly(ctx, [pr([win.x[0], 0, 0]), pr([win.x[1], 0, 0])], withAlpha(p.ink2, 0.8), 1.2);
    poly(ctx, [pr([0, 0, win.y[0]]), pr([0, 0, win.y[1]])], withAlpha(p.ink2, 0.8), 1.2);
    const [lx, ly] = pr([win.x[1], 0, 0]);
    haloText(ctx, p, 'x', lx + 8, ly + 2, { font: `700 12px ${p.fontUi}`, color: p.ink2 });
    const [ux, uy] = pr([0, 0, win.y[1]]);
    haloText(ctx, p, 'y', ux + 2, uy - 9, { font: `700 12px ${p.fontUi}`, color: p.ink2 });
    // the t axis
    const [t0x, t0y] = pr([0, 0, 0]);
    const [t1x, t1y] = pr([0, (hi - lo) * ts, 0]);
    arrow(ctx, t0x, t0y, t1x, t1y, { color: p.ink2, width: 1.5, head: 8 });
    haloText(ctx, p, 't', t1x + 9, t1y - 2, { font: `700 13px ${p.fontUi}`, color: p.ink });
    // the shadow: the curve itself on the plane t = t0
    poly(ctx, along((u) => P(lo, sp.r(u)), a, b, 300), withAlpha(p.curve, 0.85), 1.7, [6, 4]);
    // the twin's world line
    if (s.compare && tw) {
      poly(ctx, along((u) => P(u, tw.r(u)), tw.range[0], tw.range[1], 300), p.accent, 2.2, [7, 4]);
    }
    // faint droplines along the traced part, the world line, the point and its dropline
    const nd = 14;
    for (let i = 1; i <= nd; i++) {
      const u = a + ((t - a) * i) / nd;
      const q = sp.r(u);
      seg(ctx, ...P(u, q), ...P(lo, q), withAlpha(p.ink2, 0.28), 1, [2, 4]);
    }
    poly(ctx, along((u) => P(u, sp.r(u)), a, b, 300), withAlpha(p.curve, 0.32), 1.6, [6, 5]);
    if (t > a) poly(ctx, along((u) => P(u, sp.r(u)), a, t, Math.max(2, Math.round((300 * (t - a)) / (b - a)))), p.curve, 3.4);
    const q = sp.r(t);
    const [wx, wy] = P(t, q);
    const [hx, hy] = P(lo, q);
    seg(ctx, wx, wy, hx, hy, p.ink, 1.5, [3, 4]);
    ring(ctx, hx, hy, 4.6, p.ink, p.paper, 2);
    dot(ctx, wx, wy, 5.6, p.ink, p.paper);
    // legend in the corner, clear of the curves
    const rows: [string, number[], number, string][] = [
      ['קו העולם', [], 3.2, p.curve],
      ['הצל: העקום עצמו', [6, 4], 1.7, withAlpha(p.curve, 0.85)],
    ];
    if (s.compare && tw) rows.push(['קו עולם של פרמטריזציה אחרת', [7, 4], 2.2, p.accent]);
    rows.forEach(([text, dash, w, color], i) => {
      const y = box.y + 14 + i * 18;
      seg(ctx, box.x + 6, y, box.x + 30, y, color, w, dash);
      haloText(ctx, p, text, box.x + 36, y, { font: `700 11px ${p.fontUi}`, color: p.ink, align: 'left' });
    });
  };

  const drawSpace3D = (ctx: CanvasRenderingContext2D, p: Palette, box: Box, s: Setup) => {
    const sp = SC[s.pS];
    // the view fits the current curve: the helix's height is two turns, 2p, with a minimum so p near 0 still shows a box
    const lo = sp.box.lo;
    const hi: Vec3 = sp.hasPitch ? [sp.box.hi[0], sp.box.hi[1], Math.max(1.4, 2 * s.p + 0.3)] : sp.box.hi;
    const pr = projector(box, s.az, EL_SPACE, lo, hi);
    const [a, b] = sp.range;
    const t = s.tS;
    const P = (q: Vec3) => pr(q);
    const flat = (q: Vec3): Vec3 => [q[0], q[1], 0];
    // the xy-plane and the axes
    const floor: Vec3[] = [
      [lo[0], lo[1], 0],
      [hi[0], lo[1], 0],
      [hi[0], hi[1], 0],
      [lo[0], hi[1], 0],
      [lo[0], lo[1], 0],
    ];
    ctx.save();
    ctx.beginPath();
    floor.forEach((c, i) => (i === 0 ? ctx.moveTo(...P(c)) : ctx.lineTo(...P(c))));
    ctx.fillStyle = withAlpha(p.ink2, 0.07);
    ctx.fill();
    ctx.restore();
    poly(ctx, floor.map(P), withAlpha(p.ink2, 0.6), 1.1);
    const axes: [Vec3, Vec3, string][] = [
      [[lo[0], 0, 0], [hi[0], 0, 0], 'x'],
      [[0, lo[1], 0], [0, hi[1], 0], 'y'],
      [[0, 0, Math.min(0, lo[2])], [0, 0, hi[2]], 'z'],
    ];
    for (const [from, to, name] of axes) {
      const [fx, fy] = P(from);
      const [tx, ty] = P(to);
      arrow(ctx, fx, fy, tx, ty, { color: p.ink2, width: 1.5, head: 8 });
      const l = Math.hypot(tx - fx, ty - fy) || 1;
      haloText(ctx, p, name, tx + ((tx - fx) / l) * 10, ty + ((ty - fy) / l) * 10, { font: `700 13px ${p.fontUi}`, color: p.ink });
    }
    const r = (u: number): Vec3 => sp.r(u, s.p);
    // the shadow on the xy-plane
    if (s.shadow) {
      poly(ctx, along((u) => P(flat(r(u))), a, b, 300), withAlpha(p.curve, 0.35), 1.4, [5, 4]);
      if (t > a) poly(ctx, along((u) => P(flat(r(u))), a, t, Math.max(2, Math.round((300 * (t - a)) / (b - a)))), p.curve, 2, [6, 4]);
      const nd = 16;
      for (let i = 1; i <= nd; i++) {
        const q = r(a + ((t - a) * i) / nd);
        seg(ctx, ...P(q), ...P(flat(q)), withAlpha(p.ink2, 0.3), 1, [2, 4]);
      }
    }
    // the helix's rise per turn: a bracket on the z axis from 0 to p, linked to the helix points one turn apart
    if (sp.hasPitch && s.p > 0.02) {
      const z0 = P([0, 0, 0]);
      const z1 = P([0, 0, s.p]);
      const h0 = P([1, 0, 0]);
      const h1 = P([1, 0, s.p]);
      seg(ctx, ...z0, ...h0, withAlpha(p.limit, 0.8), 1.3, [3, 4]);
      seg(ctx, ...z1, ...h1, withAlpha(p.limit, 0.8), 1.3, [3, 4]);
      seg(ctx, ...z0, ...z1, p.limit, 5);
      for (const e of [0, s.p]) seg(ctx, ...P([-0.12, 0, e]), ...P([0.12, 0, e]), p.limit, 3.2);
      haloText(ctx, p, `p = ${fmt(s.p, 3)}`, (z0[0] + z1[0]) / 2 - 9, (z0[1] + z1[1]) / 2, { font: `700 14px ${p.fontUi}`, color: p.limit, align: 'right' });
    }
    // the curve and the point
    poly(ctx, along((u) => P(r(u)), a, b, 360), withAlpha(p.curve, 0.35), 1.6, [6, 5]);
    if (t > a) poly(ctx, along((u) => P(r(u)), a, t, Math.max(2, Math.round((360 * (t - a)) / (b - a)))), p.curve, 3.4);
    const q = r(t);
    const [qx, qy] = P(q);
    const [ox, oy] = P([0, 0, 0]);
    arrow(ctx, ox, oy, qx, qy, { color: p.ink, width: 1.3, head: 7, alpha: 0.75 });
    if (s.shadow) {
      const [fx, fy] = P(flat(q));
      seg(ctx, qx, qy, fx, fy, p.ink, 1.5, [3, 4]);
      ring(ctx, fx, fy, 4.4, p.ink, p.paper, 2);
    }
    dot(ctx, qx, qy, 5.8, p.ink, p.paper);
  };

  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    const s = s0;
    const regions: Regions = { plane: null, sides: [], three: null };
    hit.current = regions;
    if (s.mode === 'trace') {
      const { main, sides } = traceBoxes(view.w, view.h);
      const pl = planePlot(main, PC[s.pP].window);
      regions.plane = { area: main, plot: pl };
      drawPlane(ctx, p, pl, s);
      regions.sides = sides.map((bx, k) => drawSide(ctx, p, bx, s, k as 0 | 1));
    } else if (s.mode === 'world') {
      const { plane, three } = worldBoxes(view.w, view.h);
      const pl = planePlot(plane, PC[s.pP].window);
      regions.plane = { area: plane, plot: pl };
      regions.three = three;
      drawPlane(ctx, p, pl, s);
      drawWorld3D(ctx, p, three, s);
    } else {
      const box: Box = { x: 4, y: 4, w: Math.max(1, view.w - 8), h: Math.max(1, view.h - 8) };
      regions.three = box;
      drawSpace3D(ctx, p, box, s);
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
  const aspect = setup.mode === 'trace' ? (narrow ? 0.8 : 1.7) : setup.mode === 'world' ? (narrow ? 0.78 : 1.6) : narrow ? 1.0 : 1.35;

  /* ---------------------------------------------------------------- learner changes */
  /** The learner changed the figure: apply, then tick whatever the new state completes. */
  const apply = (patch: Partial<Setup>) => {
    const prev = cur.current;
    const next: Setup = { ...prev, ...patch };
    if (patch.mode !== undefined && patch.mode !== prev.mode) {
      baseAz.current = next.az;
      baseP.current = next.p;
    }
    commit(next);
    for (const id of props.tasks ?? []) {
      const rule = RULES[id];
      if (!rule) continue;
      if (!rule.state(next, patch, prev)) {
        held.current.delete(id);
        continue;
      }
      if (!rule.needs.some((key) => key in patch)) continue;
      if (held.current.has(id)) continue;
      done(id);
    }
  };

  const curRange = (c: Setup) => (c.mode === 'space' ? rangeS(c.pS) : rangeP(c.pP));
  const curT = (c: Setup) => (c.mode === 'space' ? c.tS : c.tP);
  const setT = (v: number) => {
    const c = cur.current;
    const nv = fixT(curRange(c), v);
    if (nv === curT(c)) return;
    apply(c.mode === 'space' ? { tS: nv } : { tP: nv });
  };
  const setAz = (v: number) => {
    const nv = wrapAz(Math.round(v * 10) / 10);
    if (nv !== cur.current.az) apply({ az: nv });
  };
  const setP = (v: number) => {
    const nv = fixP(v);
    if (nv !== cur.current.p) apply({ p: nv });
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
      const r = curRange(c);
      const t = curT(c);
      const q = t >= r[1] ? r[0] : Math.min(r[1], t + (span(r) / PLAY_SECONDS) * dt);
      apply(c.mode === 'space' ? { tS: q } : { tP: q });
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

  /* ---------------------------------------------------------------- pointer */
  /** the parameter whose point is nearest to the pointer; among near ties, the one closest to the current t */
  const nearestT = (pl: Plot, id: PcId, ex: number, ey: number, tCur: number): number => {
    const [a, b] = rangeP(id);
    const N = 600;
    const d: number[] = [];
    let best = Infinity;
    for (let i = 0; i <= N; i++) {
      const [x, y] = PC[id].r(a + ((b - a) * i) / N);
      const dd = Math.hypot(pl.px(x) - ex, pl.py(y) - ey);
      d.push(dd);
      if (dd < best) best = dd;
    }
    let pick = 0;
    let gap = Infinity;
    for (let i = 0; i <= N; i++) {
      if (d[i] > best + 2.5) continue;
      const g = Math.abs(a + ((b - a) * i) / N - tCur);
      if (g < gap) {
        gap = g;
        pick = i;
      }
    }
    return a + ((b - a) * pick) / N;
  };
  const inside = (b: Box, x: number, y: number) => x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 4 && y <= b.y + b.h + 4;
  const timeFromPointer = (e: PointerEvent) => {
    const c = cur.current;
    const h = hit.current;
    if (c.mode === 'space') return;
    if (h.plane && (inside(h.plane.area, e.offsetX, e.offsetY) || drag.current?.kind === 'time')) {
      const pl = h.plane.plot;
      if (c.mode === 'trace' || inside(h.plane.area, e.offsetX, e.offsetY)) {
        setT(nearestT(pl, c.pP, e.offsetX, e.offsetY, c.tP));
        return;
      }
    }
    for (const pl of h.sides) {
      if (c.mode === 'trace' && inside(pl.box, e.offsetX, e.offsetY)) {
        setT(pl.x.min + ((e.offsetX - pl.box.x) / pl.box.w) * (pl.x.max - pl.x.min));
        return;
      }
    }
  };
  const onPointerDown = (e: PointerEvent) => {
    const c = cur.current;
    const h = hit.current;
    let kind: 'time' | 'rot' | null = null;
    if (c.mode === 'space') kind = 'rot';
    else if (h.three && c.mode === 'world' && inside(h.three, e.offsetX, e.offsetY)) kind = 'rot';
    else if (h.plane && inside(h.plane.area, e.offsetX, e.offsetY)) kind = 'time';
    else if (c.mode === 'trace' && h.sides.some((pl) => inside(pl.box, e.offsetX, e.offsetY))) kind = 'time';
    if (!kind) return;
    drag.current = { kind, x: e.clientX };
    setPlaying(false);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (kind === 'time') timeFromPointer(e);
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === 'time') timeFromPointer(e);
    else {
      const dx = e.clientX - d.x;
      d.x = e.clientX;
      setAz(cur.current.az - dx * 0.5);
    }
  };
  const onPointerUp = () => {
    if (drag.current) setLive(describe(cur.current));
    drag.current = null;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const c = cur.current;
    setPlaying(false);
    setT(curT(c) + (e.key === 'ArrowLeft' ? -1 : 1) * (span(curRange(c)) / 100));
    e.preventDefault();
    setLive(describe(cur.current));
  };

  /* ---------------------------------------------------------------- text */
  const M = (q: { children: ComponentChildren }) => <bdi dir="ltr">{q.children}</bdi>;

  function describe(s: Setup): string {
    if (s.mode === 'space') {
      const q = SC[s.pS].r(s.tS, s.p);
      return `t = ${coord(s.tS)}: r(t) = (${coord(q[0])}, ${coord(q[1])}, ${coord(q[2])}).`;
    }
    const q = PC[s.pP].r(s.tP);
    return `t = ${coord(s.tP)}: r(t) = (${coord(q[0])}, ${coord(q[1])}).`;
  }

  const spP = PC[setup.pP];
  const spS = SC[setup.pS];
  const twin = spP.twin ? PC[spP.twin] : null;

  const label =
    setup.mode === 'trace'
      ? `איור חי: העקום r(t) = ${spP.text}, ${spP.rangeText}, במישור עם שני צירים בקנה מידה שווה. החלק שהנקודה כבר עברה מצוייר בקו עבה, והמשכו בקו מקווקו דהוי. חץ בנקודת ההתחלה מראה את כיוון התנועה. משמאל לו שני גרפים קטנים של x(t) ושל y(t) כפונקציות של t, עם הרגע הנוכחי מסומן.${setup.showEq ? ` ברקע, בנקודות, כל הקבוצה של המשוואה ${spP.eqText ?? ''}.` : ''}`
      : setup.mode === 'world'
        ? `איור חי: העקום r(t) = ${spP.text}, ${spP.rangeText}, במישור, ומימינו קו העולם שלו, הגרף של t, x(t), y(t) במרחב תלת-ממדי (ציר t מסומן ומוקטן להתאמה). הצל של קו העולם על המישור t = t0 הוא העקום עצמו, בקו מקווקו, וקו אנכי מקווקו מחבר את הנקודה בקו העולם לצל שלה.${setup.compare && twin ? ' בקו מקווקו בצבע אחר מצויר קו העולם של פרמטריזציה אחרת של אותו עקום.' : ''}`
        : `איור חי: העקום במרחב r(t) = ${spS.text}, ${spS.rangeText}, בהצגה תלת-ממדית עם צירים x, y, z. החלק שהנקודה כבר עברה מצוייר בקו עבה, והמשכו בקו מקווקו דהוי, וחץ מהראשית אל הנקודה הוא וקטור המקום.${setup.shadow ? ' הצל של העקום על מישור xy מצויר בקו מקווקו, וקווים אנכיים מחברים נקודות של העקום לצל שלהן.' : ''}${setup.pS === 'helix' ? ` הסוגר על ציר z הוא העלייה בסיבוב אחד, p = ${fmt(setup.p, 3)}.` : ''}`;

  let readout: ComponentChildren;
  if (setup.mode === 'space') {
    const q = spS.r(setup.tS, setup.p);
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>
            r(t) = {spS.text}, {spS.rangeText}
          </M>
        </span>
        <span class="q" data-readout="t">
          <M>
            t = <b>{coord(setup.tS)}</b>
          </M>
        </span>
        <span class="q" data-readout="point">
          <M>
            r(t) = (<b>{coord(q[0])}</b>, <b>{coord(q[1])}</b>, <b>{coord(q[2])}</b>)
          </M>
        </span>
        {setup.pS === 'helix' && (
          <span class="rtl-row" data-readout="pitch">
            עלייה בסיבוב:{' '}
            <M>
              p = <b>{fmt(setup.p, 3)}</b>
            </M>
          </span>
        )}
        {setup.shadow && (
          <span class="rtl-row" data-readout="shadow">
            ההטלה על מישור xy:{' '}
            <M>
              ({coord(q[0])}, {coord(q[1])}, 0)
            </M>
          </span>
        )}
      </>
    );
  } else {
    const q = spP.r(setup.tP);
    const t = setup.tP;
    readout =
      setup.mode === 'trace' ? (
        <>
          <span class="q" data-readout="fn">
            <M>
              r(t) = {spP.text}, {spP.rangeText}
            </M>
          </span>
          <span class="q" data-readout="t">
            <M>
              t = <b>{coord(t)}</b>
            </M>
          </span>
          <span class="q" data-readout="x">
            <M>
              x(t) = <b>{coord(q[0])}</b>
            </M>
          </span>
          <span class="q" data-readout="y">
            <M>
              y(t) = <b>{coord(q[1])}</b>
            </M>
          </span>
          {setup.showEq && spP.eqText && (
            <span class="rtl-row" data-readout="eq">
              המשוואה: <M>{spP.eqText}</M> — העקום הוא {spP.eqNote}
            </span>
          )}
          {setup.pP === 'nodal' && t >= 1 - 1e-3 && (
            <span class="rtl-row" data-readout="cross">
              הערכים <M>t = −1</M> ו-<M>t = 1</M> נותנים את אותה נקודה: <M>(0, 0)</M>
            </span>
          )}
        </>
      ) : (
        <>
          <span class="q" data-readout="fn">
            <M>
              r(t) = {spP.text}, {spP.rangeText}
            </M>
          </span>
          <span class="q" data-readout="t">
            <M>
              t = <b>{coord(t)}</b>
            </M>
          </span>
          <span class="q" data-readout="point">
            <M>
              r(t) = (<b>{coord(q[0])}</b>, <b>{coord(q[1])}</b>)
            </M>
          </span>
          {setup.compare && twin && (
            <span class="rtl-row" data-readout="compare">
              אותה קבוצת נקודות, שני קווי עולם: <M>{spP.text}</M> ו-<M>{twin.text}</M>
            </span>
          )}
        </>
      );
  }

  const presetIds: readonly string[] = setup.mode === 'space' ? SC_IDS : PC_IDS;
  const presetText = (id: string) => (isPcId(id) ? `r(t) = ${PC[id].text},  ${PC[id].rangeText}` : isScId(id) ? `r(t) = ${SC[id].text},  ${SC[id].rangeText}` : id);
  const chosen = setup.mode === 'space' ? setup.pS : setup.pP;
  const range = curRange(setup);
  const showAz = setup.mode !== 'trace';

  return (
    <SimShell
      fig={props.id}
      label={label}
      canvasRef={canvasRef}
      aspect={aspect}
      live={live}
      tasks={tasks}
      cursor={setup.mode === 'space' ? 'grab' : 'ew-resize'}
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
          <label class="pl-select" data-control="preset">
            <span class="pl-lab">העקום</span>
            <select
              dir="ltr"
              value={chosen}
              onChange={(e) => {
                const v = (e.target as HTMLSelectElement).value;
                const c = cur.current;
                setPlaying(false);
                if (c.mode !== 'space' && isPcId(v)) apply({ pP: v, tP: startT(rangeP(v)) });
                else if (c.mode === 'space' && isScId(v)) apply({ pS: v, tS: startT(rangeS(v)) });
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
            {setup.mode === 'trace' && (
              <>
                <Toggle label="המשך העקום" on={setup.ghost} onChange={(on) => apply({ ghost: on })} />
                <Toggle label="המשוואה הקרטזית" on={setup.showEq} swatch="var(--accent)" onChange={(on) => apply({ showEq: on })} />
              </>
            )}
            {setup.mode === 'world' && twin && <Toggle label="אותו עקום בפרמטריזציה אחרת" on={setup.compare} swatch="var(--accent)" onChange={(on) => apply({ compare: on })} />}
            {setup.mode === 'space' && <Toggle label="הצל על מישור xy" on={setup.shadow} onChange={(on) => apply({ shadow: on })} />}
            {!still && (
              <button type="button" class="btn primary" onClick={playing ? () => setPlaying(false) : play}>
                {playing ? 'עצירה' : 'הפעלה'}
              </button>
            )}
          </div>
          <div class="pl-ctl" data-control="t">
            <Slider
              label="הפרמטר t"
              value={curT(setup)}
              min={range[0]}
              max={range[1]}
              step={span(range) / 500}
              format={(v) => fmt(v, 3)}
              onChange={(v) => {
                setPlaying(false);
                setT(v);
              }}
            />
          </div>
          {setup.mode === 'space' && setup.pS === 'helix' && (
            <div class="pl-ctl" data-control="p">
              <Slider label="עלייה בסיבוב p" value={setup.p} min={HELIX_P.min} max={HELIX_P.max} step={0.05} format={(v) => fmt(v, 3)} onChange={setP} />
            </div>
          )}
          {showAz && (
            <div class="pl-ctl" data-control="az">
              <Slider label="סיבוב המבט" value={setup.az} min={0} max={359} step={1} format={(v) => `${Math.round(v)}°`} onChange={setAz} />
            </div>
          )}
        </>
      }
    />
  );
}
