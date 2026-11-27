/**
 * ArcLab (chapter 9.3, arc length): three modes. Maths: src/math/arclength.ts, whose STORED closed forms (the speeds, the
 * arc-length functions s(t) and s(θ), the lengths) give every exact value a readout shows; a polygon length is a finite sum
 * of chords computed term by term; the one value without a closed form (the perimeter of the ellipse, 9.68844822054768) is
 * stored from sympy and labelled "חישוב נומרי". Canvases are math space and stay LTR (x to the right, y up) with EQUAL
 * scales on both axes (a circle looks round); sliders for math quantities are `dir="ltr"`. Panels are stacked in one
 * canvas, so they also stack on a phone (390 px) without sideways scroll. Colours come from the palette only.
 *
 * mode 'polygon' (button "מצולע חסום"): preset f of AL (circle (cos t, sin t) on [0, 2π]; parab (t, t²) on [0, 2];
 *     cosh (t, cosh t) on [−1, 1]; ellipse (2 cos t, sin t) on [0, 2π]). The curve (--curve) and an inscribed polygon of n
 *     chords at equal parameter steps (accent, vertices marked by dots). With `exact` the readout adds the exact length
 *     (or the stored number labelled "חישוב נומרי" for the ellipse) and the difference L − Lₙ. n by slider (1…64) or ←/→.
 * mode 'speed' (button "מהירות ואורך"): preset f of RP, a CURVE id (notes: the parabola piece y = x², 0 ≤ x ≤ 2, with
 *     parametrisations t = (t, t²) and t2 = (t², t⁴); circle: the unit circle with t = (cos t, sin t), sq = (cos t², sin t²)
 *     and twice = (cos 2t, sin 2t)). Top panel: the curve (faint dashed), the part from the start to t bold and the point.
 *     Bottom panel: the speed |v(t)| against t with the area from 0 to t shaded (= s(t)). The select "הפרמטריזציה" switches
 *     `param` within the curve and keeps the point where it is when it can (the same position of the curve in the new
 *     parameter), so the same arc shows a different speed graph. The readout gives t, |v(t)|, s(t) and, at the end of the
 *     range, the total ∫|v| dt (for `twice` it is the distance travelled, 4π: the circle counted twice). t by slider, by
 *     dragging on the bottom panel (t) or on the curve (the nearest parameter), ←/→ or the play button.
 * mode 'polar' (button "עקום קוטבי"): preset f of PL (spiral r = θ, logspiral r = e^(θ/5), cardioid r = 1 + cos θ; θ in
 *     [0, 2π]). The curve (faint dashed), the ray at θ, the arc from 0 to θ bold and the angle at the origin. With `triangle`
 *     the little step from θ to θ + dθ is marked on the curve (accent) and an inset magnifies the triangle at P with the
 *     legs dr (along the ray from O through P) and r dθ (perpendicular to it, along the circle of radius r), in their true
 *     orientation, and its hypotenuse ≈ ds (along the curve). dθ by a log slider (0.01…0.5).
 *     θ by slider, by dragging on the plane (the nearest parameter on the curve), ←/→ or the play button.
 *
 * Props (defaults): id (required); mode ('polygon'); modes (the mode buttons shown; default the starting mode only);
 * tasks ([]). f (an AL id for polygon, an RP curve id for speed, a PL id for polar; defaults 'parab', 'notes', 'spiral'; the
 * id 'circle' is in both AL and RP and goes to the mode that is current, or to the mode a step sets);
 * n (6; an integer 1…64), exact (false); param ('t'; a parametrisation of the current RP curve), t (0.4 of the range of the
 * current parametrisation); theta (1.2; 0…2π), triangle (false), dtheta (0.2; 0.01…0.5).
 * Every prop is also a step key (`<Step fig=… set={{…}}>`; the mode too); a key left out keeps its value; `f` is routed to
 * the registry that holds it (each mode keeps its own preset); a new RP curve without `param` and `t` goes to param 't' with
 * t at 0.4 of the range, a new `param` without `t` keeps the point's position (as the select does). The learner can also pick
 * the preset from a list (select "העקום": the presets of the current mode) and, in speed mode, the parametrisation (select
 * "הפרמטריזציה"). A state set by a step never ticks a task, and a state that already had a task's property when a step or
 * reset made it must be left and found again.
 * Values from props, steps, reset and the parametrisation select are kept exact (only clamped to the range); only the
 * learner's slider, drag, keys and play snap t and θ to the grid T/400 (2π/400), with the end of the range snapped to the end.
 * Motion: a play button "הפעלה" / "עצירה" (speed and polar) moves t (θ) over its whole range in about 6 s and loops; it is
 * absent in still mode (motionAllowed() false) and every frame checks motionAllowed() again.
 *
 * Tasks (ticked only inside the learner's own drag, key, slider, select, button, toggle or play):
 *   polygon: pg-refine (exact on and n ≥ 32), pg-below (exact on and the learner has moved n through at least three
 *            values; the values the learner sets while `exact` is on are counted since the last step or reset)
 *   speed:   sp-param (on notes or circle the learner has switched the parametrisation with the select and then moved t to
 *            the end), sp-twice (curve circle with param twice, selected by the learner)
 *   polar:   pl-sweep (the learner has moved θ over a stretch of at least π since the last step or reset),
 *            pl-triangle (triangle on and dθ ≤ 0.02)
 *
 * Hooks for e2e specs (inside `#<id>`; numbers use U+2212 for minus):
 *   buttons by role and name: the mode buttons "מצולע חסום", "מהירות ואורך", "עקום קוטבי"; the toggles "האורך המדויק"
 *     (polygon) and "המשולש הקטן" (polar); "הפעלה" / "עצירה" (play, speed and polar, only when motion is allowed);
 *     "איפוס" (reset)
 *   [data-control="preset"] select    the curve (option values are the preset ids of the current mode)
 *   [data-control="param"] select     speed: the parametrisation (option values t, t2 / t, sq, twice)
 *   [data-control=…] input            polygon: n (1…64, step 1); speed: t (0…T, step T/400); polar: theta (0…2π, step 2π/400),
 *                                     dtheta (log slider: the value is log₁₀ dθ, −2…−0.301, step 0.01; the readout shows dθ)
 *   canvas                            speed: drag moves t (bottom panel: t; top panel: the nearest point of the curve);
 *                                     polar: drag moves θ; ←/→ change n (polygon), t (speed), θ (polar)
 *   [data-readout=…]                  polygon: fn, n, poly, exact (with exact), diff (with exact)
 *                                     speed: fn, t, speed, arc, total (only when t is at the end of its range)
 *                                     polar: fn, theta, r, dr, integrand, arc; with triangle: tri-around, tri-along, triangle (dθ and ds ≈ hyp), tri-arc
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import {
  AL,
  AL_IDS,
  PL,
  PL_IDS,
  RP_CURVES,
  RP_PARAMS,
  convertT,
  isAlId,
  isPlId,
  isRpCurve,
  isRpParam,
  maxSpeed,
  polarAt,
  polarTriangle,
  polygon,
  rpOf,
  rpWindow,
  type AlId,
  type PlId,
  type RpCurve,
  type Vec2,
  type Win,
} from '~/math/arclength';
import { markTask } from '~/progress/store';
import { motionAllowed } from '~/progress/settings';
import { subscribeSteps, type StepState } from '~/ui/steps';
import { useMounted } from '~/ui/useMounted';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { sci } from './core/format';
import { withAlpha } from './core/ink';
import { drawAxes, makePlot, type Box, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import './ArcLab.css';

export type ArcMode = 'polygon' | 'speed' | 'polar';

export interface ArcLabProps {
  id: string;
  mode?: ArcMode;
  /** the mode buttons shown (default: the starting mode only) */
  modes?: ArcMode[];
  /** an AL id (polygon), an RP curve id (speed) or a PL id (polar) */
  f?: string;
  n?: number;
  exact?: boolean;
  param?: string;
  t?: number;
  theta?: number;
  triangle?: boolean;
  dtheta?: number;
  tasks?: string[];
}

interface Setup {
  mode: ArcMode;
  pA: AlId;
  n: number;
  exact: boolean;
  rc: RpCurve;
  rpar: string;
  t: number;
  pP: PlId;
  th: number;
  tri: boolean;
  dth: number;
}

const ltr = (s: string) => String.fromCharCode(0x2066) + s.replace(/ /g, String.fromCharCode(0xa0)) + String.fromCharCode(0x2069);

const TASK_LABEL: Record<string, string> = {
  'pg-refine': `הדליקו "האורך המדויק" והגדילו את ${ltr('n')} ל-32 לפחות. כמה נשאר בין אורך המצולע לאורך העקום?`,
  'pg-below': `כשהאורך המדויק דלוק, העבירו את ${ltr('n')} דרך שלושה ערכים לפחות. אורך המצולע גדול מהאורך המדויק או קטן ממנו?`,
  'sp-param': `בפרבולה או במעגל החליפו את הפרמטריזציה והזיזו את ${ltr('t')} עד סוף הקטע. מה קרה לאורך הכולל?`,
  'sp-twice': `במעגל בחרו את הפרמטריזציה ${ltr('(cos 2t, sin 2t)')} והזיזו את ${ltr('t')} עד הסוף. מה נמדד: אורך המעגל או הדרך שעברה הנקודה?`,
  'pl-sweep': `הזיזו את ${ltr('θ')} על פני קשת של ${ltr('π')} לפחות. איזה חלק מהאורך הכולל נצבר?`,
  'pl-triangle': `הדליקו את "המשולש הקטן" והקטינו את ${ltr('dθ')} ל-${ltr('0.02')} או פחות. מה קורה ליחס בין היתר לבין הקשת?`,
};

const MODE_LABEL: Record<ArcMode, string> = { polygon: 'מצולע חסום', speed: 'מהירות ואורך', polar: 'עקום קוטבי' };
const AL_NAME: Record<AlId, string> = { circle: 'מעגל', parab: 'פרבולה', cosh: 'הגרף של cosh', ellipse: 'אליפסה' };
const RP_NAME: Record<RpCurve, string> = { notes: 'פרבולה', circle: 'מעגל' };
const RP_MATH: Record<RpCurve, string> = { notes: 'y = x², 0 ≤ x ≤ 2', circle: 'x² + y² = 1' };
const PL_NAME: Record<PlId, string> = { spiral: 'ספירלה', logspiral: 'ספירלה לוגריתמית', cardioid: 'קרדיואידה' };
const RANGE_TEXT: Record<string, string> = { 'notes/t': '2', 'notes/t2': '√2', 'circle/t': '2π', 'circle/sq': '√(2π)', 'circle/twice': '2π' };
const AL_RANGE: Record<AlId, string> = { circle: '[0, 2π]', parab: '[0, 2]', cosh: '[−1, 1]', ellipse: '[0, 2π]' };

const N_MAX = 64;
const TAU = 2 * Math.PI;
const DTH_MIN = 0.01;
const DTH_MAX = 0.5;
const PLAY_SECONDS = 6;
const T0_FRACTION = 0.4;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const bool = (x: unknown): boolean | null => (typeof x === 'boolean' ? x : null);
const roundTo = (x: number, step: number) => Number((Math.round(x / step) * step).toPrecision(12));
const minus = (s: string) => s.replace(/-/g, '−');
const fmt = (x: number, sig = 4) => (Number.isNaN(x) ? '—' : Math.abs(x) < 1e-12 ? '0' : minus(sci(x, sig)));
const fixN = (n: number) => clamp(Math.round(n), 1, N_MAX);
const fixDth = (d: number) => clamp(roundTo(d, 0.001), DTH_MIN, DTH_MAX);

const rangeOf = (curve: RpCurve, param: string) => rpOf(curve, param).range[1];
const stepOf = (T: number) => T / 400;
/** t in [0, T] on the slider grid T/400, snapping to the end */
function fixT(curve: RpCurve, param: string, t: number): number {
  const T = rangeOf(curve, param);
  const st = stepOf(T);
  const r = roundTo(clamp(t, 0, T), st);
  return T - r < st * 0.5 ? T : r;
}
function fixTh(th: number): number {
  const st = stepOf(TAU);
  const r = roundTo(clamp(th, 0, TAU), st);
  return TAU - r < st * 0.5 ? TAU : r;
}
/** a value from a prop, a step or a reset: exact, only clamped to the range */
const clampT = (curve: RpCurve, param: string, t: number) => clamp(t, 0, rangeOf(curve, param));
const clampTh = (th: number) => clamp(th, 0, TAU);
const atEnd = (curve: RpCurve, param: string, t: number) => t >= rangeOf(curve, param) - 1e-6;
const defaultT = (curve: RpCurve, param: string) => clampT(curve, param, T0_FRACTION * rangeOf(curve, param));

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
  ctx.lineCap = 'round';
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

/** a plot of the window `win` with EQUAL scales on both axes, centred in `box` */
function fitPlot(box: Box, win: Win): Plot {
  const dx = win.x[1] - win.x[0];
  const dy = win.y[1] - win.y[0];
  const k = Math.min(box.w / dx, box.h / dy);
  const w = dx * k;
  const h = dy * k;
  const sub: Box = { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w: Math.max(1, w), h: Math.max(1, h) };
  return makePlot(sub, { min: win.x[0], max: win.x[1] }, { min: win.y[0], max: win.y[1] });
}

function axisLines(ctx: CanvasRenderingContext2D, p: Palette, pl: Plot) {
  drawAxes(ctx, pl, p);
  if (pl.y.min < 0 && pl.y.max > 0) line(ctx, pl.box.x, pl.py(0), pl.box.x + pl.box.w, pl.py(0), withAlpha(p.ink2, 0.75), 1.2);
  if (pl.x.min < 0 && pl.x.max > 0) line(ctx, pl.px(0), pl.box.y, pl.px(0), pl.box.y + pl.box.h, withAlpha(p.ink2, 0.75), 1.2);
}

/** a parametric curve on [a, b], clipped to the plot box */
function strokeCurve(ctx: CanvasRenderingContext2D, plot: Plot, r: (t: number) => Vec2, a: number, b: number, color: string, width: number, dash: number[] = [], n = 360) {
  if (!(b > a)) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.box.x - 1, plot.box.y - 2, plot.box.w + 2, plot.box.h + 4);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.setLineDash(dash);
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const [x, y] = r(a + ((b - a) * i) / n);
    if (i === 0) ctx.moveTo(plot.px(x), plot.py(y));
    else ctx.lineTo(plot.px(x), plot.py(y));
  }
  ctx.stroke();
  ctx.restore();
}

/** a small arrowhead at (x, y) pointing along the angle `ang` (screen) */
function head(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, color: string, size = 7) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - size * Math.cos(ang - 0.4), y - size * Math.sin(ang - 0.4));
  ctx.lineTo(x - size * Math.cos(ang + 0.4), y - size * Math.sin(ang + 0.4));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

interface Rule {
  needs: (keyof Setup)[];
  event?: boolean;
  state: (s: Setup) => boolean;
}

export default function ArcLab(props: ArcLabProps) {
  const startMode: ArcMode = props.mode ?? 'polygon';
  const modes: ArcMode[] = props.modes ?? [startMode];
  const initial = (): Setup => {
    const rc: RpCurve = isRpCurve(props.f) ? props.f : 'notes';
    const rpar = isRpParam(rc, props.param) ? props.param : 't';
    return {
      mode: startMode,
      pA: isAlId(props.f) ? props.f : 'parab',
      n: fixN(props.n ?? 6),
      exact: props.exact ?? false,
      rc,
      rpar,
      t: clampT(rc, rpar, props.t ?? T0_FRACTION * rangeOf(rc, rpar)),
      pP: isPlId(props.f) ? props.f : 'spiral',
      th: clampTh(props.theta ?? 1.2),
      tri: props.triangle ?? false,
      dth: fixDth(props.dtheta ?? 0.2),
    };
  };
  const [setup, setSetup] = useState<Setup>(initial);
  const cur = useRef(setup);
  const [live, setLive] = useState('');
  const [narrow, setNarrow] = useState(false);
  const [playing, setPlaying] = useState(false);
  const mounted = useMounted();
  const plots = useRef<Plot[]>([]);
  const dragging = useRef(false);
  /** tasks whose state held when the last step or reset made it: they must be left and found again */
  const held = useRef<Set<string>>(new Set());
  /** the n values the learner has set while `exact` was on (pg-below) */
  const visited = useRef<Set<number>>(new Set());
  /** the learner switched the parametrisation of the current curve (sp-param) */
  const switched = useRef(false);
  /** the stretch of θ the learner has covered (pl-sweep) */
  const sweep = useRef<[number, number]>([0, 0]);

  const RULES: Record<string, Rule> = {
    'pg-refine': { needs: ['n', 'exact'], state: (s) => s.mode === 'polygon' && s.exact && s.n >= 32 },
    'pg-below': { needs: ['n'], state: (s) => s.mode === 'polygon' && s.exact && visited.current.size >= 3 },
    'sp-param': { needs: ['t', 'rpar'], state: (s) => s.mode === 'speed' && switched.current && atEnd(s.rc, s.rpar, s.t) },
    'sp-twice': { needs: ['rpar'], state: (s) => s.mode === 'speed' && s.rc === 'circle' && s.rpar === 'twice' },
    'pl-sweep': { needs: ['th'], state: (s) => s.mode === 'polar' && sweep.current[1] - sweep.current[0] >= Math.PI - 1e-9 },
    'pl-triangle': { needs: ['dth', 'tri'], state: (s) => s.mode === 'polar' && s.tri && s.dth <= 0.02 + 1e-9 },
  };

  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const done = (t: string) => {
    if (props.tasks?.includes(t)) markTask(`${props.id}:${t}`);
  };
  const rebase = (s: Setup) => {
    visited.current = new Set();
    switched.current = false;
    sweep.current = [s.th, s.th];
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
        const mode = typeof st.mode === 'string' && modes.includes(st.mode as ArcMode) ? (st.mode as ArcMode) : prev.mode;
        const next: Setup = { ...prev, mode };
        // `f` goes to the registry of the (new) mode when that one holds it, else to the one that does
        const f = st.f;
        let newCurve = false;
        if (typeof f === 'string') {
          const inMode = (m: ArcMode) => (m === 'polygon' ? isAlId(f) : m === 'speed' ? isRpCurve(f) : isPlId(f));
          const target: ArcMode | null = inMode(mode) ? mode : (['polygon', 'speed', 'polar'] as const).find(inMode) ?? null;
          if (target === 'polygon' && isAlId(f)) next.pA = f;
          else if (target === 'speed' && isRpCurve(f)) {
            newCurve = f !== prev.rc;
            next.rc = f;
          } else if (target === 'polar' && isPlId(f)) next.pP = f;
        }
        const sn = num(st.n);
        if (sn !== null) next.n = fixN(sn);
        next.exact = bool(st.exact) ?? prev.exact;
        const stT = num(st.t);
        if (newCurve) next.rpar = 't';
        if (typeof st.param === 'string' && isRpParam(next.rc, st.param)) next.rpar = st.param;
        if (stT !== null) next.t = clampT(next.rc, next.rpar, stT);
        else if (newCurve) next.t = defaultT(next.rc, next.rpar);
        else if (next.rpar !== prev.rpar) next.t = clampT(next.rc, next.rpar, convertT(next.rc, prev.rpar, next.rpar, prev.t));
        else next.t = clampT(next.rc, next.rpar, prev.t);
        const sth = num(st.theta);
        if (sth !== null) next.th = clampTh(sth);
        next.tri = bool(st.triangle) ?? prev.tri;
        const sd = num(st.dtheta);
        if (sd !== null) next.dth = fixDth(sd);
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

    if (s0.mode === 'polygon') {
      const sp = AL[s0.pA];
      const [box] = layout(view.w, view.h, [1]);
      const pl = fitPlot(box, sp.window);
      plots.current = [pl];
      axisLines(ctx, p, pl);
      const pg = polygon(s0.pA, s0.n);
      strokeCurve(ctx, pl, sp.r, sp.range[0], sp.range[1], p.curve, 3);
      ctx.save();
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      pg.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(pl.px(x), pl.py(y)) : ctx.lineTo(pl.px(x), pl.py(y))));
      ctx.stroke();
      ctx.restore();
      const r = s0.n <= 16 ? 4 : s0.n <= 40 ? 3 : 2.3;
      if (s0.n <= 16) for (const [x, y] of pg.points) dot(ctx, pl.px(x), pl.py(y), r, p.accent, p.paper);
      haloText(ctx, p, `n = ${s0.n}`, box.x + 10, box.y + 12, { font: font(700), align: 'left' });
      return;
    }

    if (s0.mode === 'speed') {
      const rp = rpOf(s0.rc, s0.rpar);
      const T = rp.range[1];
      const [top, bot] = layout(view.w, view.h, [1.25, 1]);
      const pc = fitPlot(top, rpWindow(s0.rc));
      const ym = maxSpeed(rp) * 1.12;
      const pv = makePlot(bot, { min: -0.03 * T, max: 1.03 * T }, { min: -0.06 * ym, max: ym, label: '|v(t)|' });
      plots.current = [pc, pv];
      axisLines(ctx, p, pc);
      axisLines(ctx, p, pv);
      const t = s0.t;
      // top: the curve, the part up to t, the point
      strokeCurve(ctx, pc, rp.r, 0, T, withAlpha(p.curve, 0.4), 2, [6, 5]);
      strokeCurve(ctx, pc, rp.r, 0, t, p.curve, 3.6);
      const q = rp.r(0);
      ring(ctx, pc.px(q[0]), pc.py(q[1]), 4.5, p.ink, p.paper, 2);
      const P = rp.r(t);
      dot(ctx, pc.px(P[0]), pc.py(P[1]), 5.5, p.ink, p.paper);
      // bottom: the speed and the area from 0 to t
      const sh = new Path2D();
      sh.moveTo(pv.px(0), pv.py(0));
      const m = 160;
      for (let i = 0; i <= m; i++) {
        const u = (t * i) / m;
        sh.lineTo(pv.px(u), pv.py(rp.speed(u)));
      }
      sh.lineTo(pv.px(t), pv.py(0));
      sh.closePath();
      ctx.save();
      ctx.fillStyle = withAlpha(p.accent, 0.28);
      ctx.fill(sh);
      ctx.restore();
      const sw = Math.abs(pv.px(t) - pv.px(0));
      if (sw > 46 && Math.abs(pv.py(rp.speed(t) / 2) - pv.py(0)) > 14) haloText(ctx, p, 's(t)', pv.px(t / 2), pv.py(Math.min(rp.speed(t / 2), rp.speed(t)) / 2), { font: font(700), color: p.accent });
      const spd = (u: number) => [u, rp.speed(u)] as Vec2;
      strokeCurve(ctx, pv, spd, 0, T, p.curve, 2.6, [], 240);
      line(ctx, pv.px(t), pv.box.y, pv.px(t), pv.box.y + pv.box.h, withAlpha(p.accent, 0.6), 1.2, [3, 4]);
      dot(ctx, pv.px(t), pv.py(rp.speed(t)), 5.5, p.accent, p.paper);
      ctx.save();
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pv.px(t), pv.box.y + pv.box.h - 13);
      ctx.lineTo(pv.px(t), pv.box.y + pv.box.h - 2);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // polar
    const sp = PL[s0.pP];
    const [box] = layout(view.w, view.h, [1]);
    const pl = fitPlot(box, sp.window);
    plots.current = [pl];
    axisLines(ctx, p, pl);
    const rr = (th: number): Vec2 => polarAt(s0.pP, th);
    strokeCurve(ctx, pl, rr, 0, TAU, withAlpha(p.curve, 0.4), 2, [6, 5], 420);
    strokeCurve(ctx, pl, rr, 0, s0.th, p.curve, 3.6, [], 420);
    const O: Vec2 = [pl.px(0), pl.py(0)];
    const P = rr(s0.th);
    const sx = pl.px(P[0]);
    const sy = pl.py(P[1]);
    line(ctx, O[0], O[1], sx, sy, withAlpha(p.ink, 0.65), 1.4, [5, 4]);
    // the angle at the origin
    if (s0.th > 0.02) {
      ctx.save();
      ctx.strokeStyle = withAlpha(p.ink, 0.8);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(O[0], O[1], 18, 0, -s0.th, true);
      ctx.stroke();
      ctx.restore();
      const am = -s0.th / 2;
      if (s0.th > 0.5) haloText(ctx, p, 'θ', O[0] + 30 * Math.cos(am), O[1] + 30 * Math.sin(am), { font: font(700, 13) });
    }
    dot(ctx, O[0], O[1], 3, p.ink, p.paper);
    let tri: ReturnType<typeof polarTriangle> | null = null;
    if (s0.tri) {
      const th2 = s0.th + s0.dth;
      tri = polarTriangle(s0.pP, s0.th, s0.dth);
      strokeCurve(ctx, pl, rr, s0.th, th2, p.accent, 5, [], 40);
      const Q = rr(th2);
      ring(ctx, pl.px(Q[0]), pl.py(Q[1]), 4, p.accent, p.paper, 2);
    }
    dot(ctx, sx, sy, 6, p.ink, p.paper);
    haloText(ctx, p, 'P', sx + (sx > box.x + box.w / 2 ? -10 : 10), sy - 10, { font: font(700, 13) });

    if (tri) {
      // the magnifying inset, in the corner of the plot farthest from P
      const size = Math.min(150, box.w * 0.5, box.h * 0.6);
      const corners: [number, number][] = [
        [box.x + 4, box.y + 4],
        [box.x + box.w - size - 4, box.y + 4],
        [box.x + 4, box.y + box.h - size - 4],
        [box.x + box.w - size - 4, box.y + box.h - size - 4],
      ];
      let best = corners[0];
      let bd = -1;
      for (const c of corners) {
        const d = Math.hypot(c[0] + size / 2 - sx, c[1] + size / 2 - sy);
        if (d > bd) {
          bd = d;
          best = c;
        }
      }
      const [ix, iy] = best;
      ctx.save();
      ctx.fillStyle = withAlpha(p.paper, 0.95);
      ctx.strokeStyle = p.ink2;
      ctx.lineWidth = 1.2;
      ctx.fillRect(ix, iy, size, size);
      ctx.strokeRect(ix, iy, size, size);
      ctx.restore();
      haloText(ctx, p, 'הגדלה', ix + size / 2, iy + 9, { font: font(600, 10), color: p.ink2 });
      // the triangle at P in its true orientation: dr along the ray from O through P, r dθ perpendicular to it (along the
      // circle of radius r), the hypotenuse along the curve (screen y grows downward)
      const th = s0.th;
      const er: [number, number] = [Math.cos(th), -Math.sin(th)];
      const et: [number, number] = [-Math.sin(th), -Math.cos(th)];
      const k = (size * 0.6) / Math.max(tri.hyp, 1e-12);
      const rel: [number, number][] = [
        [0, 0],
        [tri.along * k * er[0], tri.along * k * er[1]],
        [tri.along * k * er[0] + tri.around * k * et[0], tri.along * k * er[1] + tri.around * k * et[1]],
      ];
      const mx = (Math.min(...rel.map((q) => q[0])) + Math.max(...rel.map((q) => q[0]))) / 2;
      const my = (Math.min(...rel.map((q) => q[1])) + Math.max(...rel.map((q) => q[1]))) / 2;
      const [A, B, C] = rel.map((q) => [ix + size / 2 + q[0] - mx, iy + size / 2 + 5 + q[1] - my] as [number, number]);
      const ctr: [number, number] = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3];
      // a label beside the middle of a side, pushed away from the triangle's centre
      const side = (U: [number, number], V: [number, number], s: string, color: string) => {
        const mxs = (U[0] + V[0]) / 2;
        const mys = (U[1] + V[1]) / 2;
        const dx = mxs - ctr[0];
        const dy = mys - ctr[1];
        const d = Math.max(Math.hypot(dx, dy), 1e-9);
        haloText(ctx, p, s, mxs + (dx / d) * 13, mys + (dy / d) * 11, { font: font(700, 10), color });
      };
      line(ctx, A[0], A[1], B[0], B[1], p.ink, 2);
      line(ctx, B[0], B[1], C[0], C[1], p.ink, 2);
      line(ctx, A[0], A[1], C[0], C[1], p.curve, 3.2);
      dot(ctx, A[0], A[1], 3, p.ink, p.paper);
      head(ctx, C[0], C[1], Math.atan2(C[1] - A[1], C[0] - A[0]), p.curve, 7);
      side(A, B, 'dr', p.ink);
      side(B, C, 'r dθ', p.ink);
      side(A, C, 'ds', p.curve);
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
  const aspect = setup.mode === 'speed' ? (narrow ? 0.85 : 1.05) : setup.mode === 'polar' ? (narrow ? 1 : 1.35) : narrow ? 1.05 : 1.5;

  /* ---------------------------------------------------------------- learner changes */
  /** The learner changed the figure: apply, then tick whatever the new state completes. */
  const apply = (patch: Partial<Setup>) => {
    const prev = cur.current;
    const next: Setup = { ...prev, ...patch };
    if (patch.n !== undefined && next.exact && next.mode === 'polygon') visited.current.add(next.n);
    if (patch.th !== undefined) sweep.current = [Math.min(sweep.current[0], next.th), Math.max(sweep.current[1], next.th)];
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

  const setN = (v: number) => {
    const nv = fixN(v);
    if (nv !== cur.current.n) apply({ n: nv });
  };
  const setT = (v: number) => {
    const c = cur.current;
    const nv = fixT(c.rc, c.rpar, v);
    if (nv !== c.t) apply({ t: nv });
  };
  const setTh = (v: number) => {
    const nv = fixTh(v);
    if (nv !== cur.current.th) apply({ th: nv });
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
      if (c.mode === 'speed') {
        const T = rangeOf(c.rc, c.rpar);
        const nt = c.t + (dt / PLAY_SECONDS) * T;
        setT(nt >= T ? 0 : nt);
      } else if (c.mode === 'polar') {
        const nt = c.th + (dt / PLAY_SECONDS) * TAU;
        setTh(nt >= TAU ? 0 : nt);
      } else {
        setPlaying(false);
        return;
      }
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
    const c = cur.current;
    if (c.mode === 'speed' && atEnd(c.rc, c.rpar, c.t)) apply({ t: 0 });
    if (c.mode === 'polar' && c.th >= TAU - 1e-6) apply({ th: 0 });
    setPlaying(true);
  };

  /* ---------------------------------------------------------------- pointer and keys */
  const draggable = (c: Setup) => c.mode === 'speed' || c.mode === 'polar';
  const fromPointer = (e: PointerEvent) => {
    const c = cur.current;
    const pl = plots.current;
    if (!pl.length) return;
    const nearest = (plot: Plot, r: (u: number) => Vec2, T: number) => {
      const x = plot.x.min + ((e.offsetX - plot.box.x) / plot.box.w) * (plot.x.max - plot.x.min);
      const y = plot.y.min + (1 - (e.offsetY - plot.box.y) / plot.box.h) * (plot.y.max - plot.y.min);
      let best = 0;
      let bd = Infinity;
      for (let i = 0; i <= 480; i++) {
        const u = (T * i) / 480;
        const [qx, qy] = r(u);
        const d = (qx - x) ** 2 + (qy - y) ** 2;
        if (d < bd) {
          bd = d;
          best = u;
        }
      }
      return best;
    };
    if (c.mode === 'speed') {
      const rp = rpOf(c.rc, c.rpar);
      const [pc, pv] = pl;
      if (pv && e.offsetY >= pv.box.y - 10) setT(pv.x.min + ((e.offsetX - pv.box.x) / pv.box.w) * (pv.x.max - pv.x.min));
      else if (pc) setT(nearest(pc, rp.r, rp.range[1]));
    } else if (c.mode === 'polar') {
      setTh(nearest(pl[0], (u) => polarAt(c.pP, u), TAU));
    }
    setPlaying(false);
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
    setPlaying(false);
    if (c.mode === 'polygon') setN(c.n + sgn);
    else if (c.mode === 'speed') setT(c.t + sgn * stepOf(rangeOf(c.rc, c.rpar)) * (e.shiftKey ? 20 : 2));
    else setTh(c.th + sgn * stepOf(TAU) * (e.shiftKey ? 20 : 2));
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
    if (s.mode === 'polygon') return `n = ${s.n}: אורך המצולע ${fmt(polygon(s.pA, s.n).length)}.`;
    if (s.mode === 'speed') {
      const rp = rpOf(s.rc, s.rpar);
      return `t = ${fmt(s.t, 3)}: המהירות ${fmt(rp.speed(s.t), 3)}, אורך הקשת ${fmt(rp.s(s.t))}.`;
    }
    return `θ = ${fmt(s.th, 3)}: אורך הקשת ${fmt(PL[s.pP].s(s.th))}.`;
  }

  const spA = AL[setup.pA];
  const rpS = rpOf(setup.rc, setup.rpar);
  const spP = PL[setup.pP];

  const label =
    setup.mode === 'polygon'
      ? `איור חי: העקום ${AL_NAME[setup.pA]} ${spA.text}, ומצולע חסום בו שבנוי מ-${setup.n} קטעים ישרים בין נקודות של העקום. ${setup.n <= 16 ? 'קודקודי המצולע מסומנים בעיגולים.' : ''}${setup.exact ? ' אורך המצולע מושווה לאורך המדויק של העקום.' : ''}`
      : setup.mode === 'speed'
        ? `איור חי: ${RP_NAME[setup.rc]} ${RP_MATH[setup.rc]} בפרמטריזציה ${rpS.text}. למעלה העקום, והחלק שעברה הנקודה עד t מודגש. למטה גרף המהירות |v(t)| עם השטח מ-0 עד t מוצלל: השטח הוא אורך הדרך עד t.`
        : `איור חי: העקום הקוטבי ${spP.text}, הקרן בזווית θ והקשת מ-0 עד θ מודגשת.${setup.tri ? ' בהגדלה: משולש קטן עם הניצבים r dθ ו-dr, והיתר שלו מקרב את אלמנט הקשת ds.' : ''}`;

  let readout: ComponentChildren;
  if (setup.mode === 'polygon') {
    const pg = polygon(setup.pA, setup.n);
    const diff = spA.length - pg.length;
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>
            r(t) = {spA.text}, t ∈ {AL_RANGE[setup.pA]}
          </M>
        </span>
        <span class="q" data-readout="n">
          <M>
            n = <b>{setup.n}</b>
          </M>
          : מספר הקטעים הישרים
        </span>
        <span class="q" data-readout="poly">
          <M>
            Lₙ = Σ |Δr| = <b>{fmt(pg.length)}</b>
          </M>
          : אורך המצולע
        </span>
        {setup.exact && (
          <>
            <span class="q" data-readout="exact">
              <M>
                L = <Int lo="a" hi="b" /> |r′| dt = {spA.numeric ? <b>{fmt(spA.length, 6)}</b> : <><b>{spA.lengthText}</b> ≈ {fmt(spA.length, 6)}</>}
              </M>
              {spA.numeric ? ' (חישוב נומרי: אין לו נוסחה סגורה בטבלה)' : ''}
            </span>
            <span class="q" data-readout="diff">
              <M>
                L − Lₙ = <b>{fmt(diff, 3)}</b>
              </M>
              : {Math.abs(diff) < 1e-12 ? 'המצולע שווה בדיוק לעקום' : 'המצולע קצר מהעקום'}
            </span>
          </>
        )}
      </>
    );
  } else if (setup.mode === 'speed') {
    const t = setup.t;
    const end = atEnd(setup.rc, setup.rpar, t);
    const rt = RANGE_TEXT[`${setup.rc}/${setup.rpar}`];
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>
            r(t) = {rpS.text}, 0 ≤ t ≤ {rt}
          </M>
        </span>
        <span class="q" data-readout="t">
          <M>
            t = <b>{fmt(t, 4)}</b>
          </M>
        </span>
        <span class="q" data-readout="speed">
          <M>
            |v(t)| = <b>{fmt(rpS.speed(t))}</b>
          </M>
        </span>
        <span class="q" data-readout="arc">
          <M>
            s(t) = <Int lo="0" hi="t" /> |v| dt = <b>{fmt(rpS.s(t))}</b>
          </M>
        </span>
        {end && (
          <span class="q" data-readout="total">
            <M>
              <Int lo="0" hi={rt} /> |v| dt = <b>{rpS.lengthText}</b> ≈ {fmt(rpS.length, 6)}
            </M>
            : {rpS.once ? 'זה אורך העקום' : 'זו הדרך שעברה הנקודה: המעגל נספר פעמיים'}
          </span>
        )}
      </>
    );
  } else {
    const th = setup.th;
    const tri = setup.tri ? polarTriangle(setup.pP, th, setup.dth) : null;
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>
            {spP.text}, 0 ≤ θ ≤ 2π
          </M>
        </span>
        <span class="q" data-readout="theta">
          <M>
            θ = <b>{fmt(th, 4)}</b>
          </M>
        </span>
        <span class="q" data-readout="r">
          <M>
            r = <b>{fmt(spP.f(th))}</b>
          </M>
        </span>
        <span class="q" data-readout="dr">
          <M>
            dr/dθ = <b>{fmt(spP.df(th))}</b>
          </M>
        </span>
        <span class="q" data-readout="integrand">
          <M>
            √(r² + (dr/dθ)²) = <b>{fmt(spP.integrand(th))}</b>
          </M>
        </span>
        <span class="q" data-readout="arc">
          <M>
            s(θ) = <Int lo="0" hi="θ" /> √(r² + (dr/dθ)²) dθ = <b>{fmt(spP.s(th))}</b>
          </M>
        </span>
        {tri && (
          <>
            <span class="q" data-readout="tri-around">
              <M>
                r dθ = <b>{fmt(tri.around)}</b>
              </M>
            </span>
            <span class="q" data-readout="tri-along">
              <M>
                dr = <b>{fmt(tri.along)}</b>
              </M>
            </span>
            <span class="q" data-readout="triangle">
              <M>
                dθ = <b>{fmt(setup.dth, 3)}</b>, ds ≈ √((r dθ)² + dr²) = <b>{fmt(tri.hyp)}</b>
              </M>
            </span>
            <span class="q" data-readout="tri-arc">
              הקשת המדויקת: <M>{fmt(tri.arc)}</M>
            </span>
          </>
        )}
      </>
    );
  }

  const presetIds: readonly string[] = setup.mode === 'polygon' ? AL_IDS : setup.mode === 'speed' ? RP_CURVES : PL_IDS;
  const presetText = (id: string) =>
    isAlId(id) && setup.mode === 'polygon'
      ? `${AL_NAME[id]}  ${ltr(AL[id].text)}`
      : isRpCurve(id) && setup.mode === 'speed'
        ? `${RP_NAME[id]}  ${ltr(RP_MATH[id])}`
        : isPlId(id)
          ? `${PL_NAME[id]}  ${ltr(PL[id].text)}`
          : id;
  const chosen = setup.mode === 'polygon' ? setup.pA : setup.mode === 'speed' ? setup.rc : setup.pP;
  const canPlay = mounted && motionAllowed() && (setup.mode === 'speed' || setup.mode === 'polar');
  const T = rangeOf(setup.rc, setup.rpar);

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
          <label class="al-select" data-control="preset">
            <span class="al-lab">העקום</span>
            <select
              dir="rtl"
              value={chosen}
              onChange={(e) => {
                const v = (e.target as HTMLSelectElement).value;
                const c = cur.current;
                setPlaying(false);
                if (c.mode === 'polygon' && isAlId(v)) apply({ pA: v });
                else if (c.mode === 'speed' && isRpCurve(v)) {
                  switched.current = false;
                  apply({ rc: v, rpar: 't', t: defaultT(v, 't') });
                } else if (c.mode === 'polar' && isPlId(v)) apply({ pP: v });
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
          {setup.mode === 'speed' && (
            <label class="al-select" data-control="param">
              <span class="al-lab">הפרמטריזציה</span>
              <select
                dir="ltr"
                value={setup.rpar}
                onChange={(e) => {
                  const v = (e.target as HTMLSelectElement).value;
                  const c = cur.current;
                  if (!isRpParam(c.rc, v) || v === c.rpar) return;
                  setPlaying(false);
                  switched.current = true;
                  apply({ rpar: v, t: clampT(c.rc, v, convertT(c.rc, c.rpar, v, c.t)) });
                  setLive(describe(cur.current));
                }}
              >
                {RP_PARAMS[setup.rc].map((id) => (
                  <option key={id} value={id}>
                    {`r(t) = ${rpOf(setup.rc, id).text}`}
                  </option>
                ))}
              </select>
            </label>
          )}
          {setup.mode === 'polygon' && (
            <>
              <div class="group" role="group" aria-label="שכבות">
                <Toggle label="האורך המדויק" on={setup.exact} swatch="var(--limit)" onChange={(on) => apply({ exact: on })} />
              </div>
              <div class="al-ctl" data-control="n">
                <Slider label="מספר הקטעים n" value={setup.n} min={1} max={N_MAX} step={1} format={(v) => String(v)} onChange={setN} />
              </div>
            </>
          )}
          {setup.mode === 'speed' && (
            <div class="al-ctl" data-control="t">
              <Slider label="הפרמטר t" value={setup.t} min={0} max={T} step={stepOf(T)} format={(v) => fmt(v, 4)} onChange={(v) => { setPlaying(false); setT(v); }} />
            </div>
          )}
          {setup.mode === 'polar' && (
            <>
              <div class="group" role="group" aria-label="שכבות">
                <Toggle label="המשולש הקטן" on={setup.tri} swatch="var(--accent)" onChange={(on) => apply({ tri: on })} />
              </div>
              <div class="al-ctl" data-control="theta">
                <Slider label="הזווית θ" value={setup.th} min={0} max={TAU} step={stepOf(TAU)} format={(v) => fmt(v, 4)} onChange={(v) => { setPlaying(false); setTh(v); }} />
              </div>
              {setup.tri && (
                <div class="al-ctl" data-control="dtheta">
                  <Slider
                    label="הצעד dθ"
                    value={Math.log10(setup.dth)}
                    min={Math.log10(DTH_MIN)}
                    max={Math.log10(DTH_MAX)}
                    step={0.01}
                    format={(v) => fmt(fixDth(10 ** v), 3)}
                    onChange={(v) => {
                      const nd = fixDth(10 ** v);
                      if (nd !== cur.current.dth) apply({ dth: nd });
                    }}
                  />
                </div>
              )}
            </>
          )}
          {canPlay && (
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
