/**
 * ImplicitLab (chapter 5: lesson 5.4 implicit differentiation, lesson 5.5 related rates). Maths: src/math/implicit.ts,
 * whose closed forms drive every number shown; the sampled curve is only a drawing and dragging aid. Canvases are math
 * space and stay LTR (equal scales on both axes in 'implicit'); sliders for math quantities are `dir="ltr"`.
 * Partial derivatives are not part of the course yet: y′ is always "differentiate both sides with respect to x, with
 * y = y(x)", and nothing here says otherwise.
 *
 * mode 'implicit': a curve given by an equation (preset), drawn from an exact parametrisation; a point P on it (filled,
 *                  ringed in the tangent colour, labelled P) that the learner drags ALONG the curve: a press or drag
 *                  anywhere on the canvas moves P to the nearest point of the curve; the arrow keys on the focused
 *                  canvas walk P along the curve (Right/Up one way, Left/Down the other; 0.05 per press, 0.25 with
 *                  Shift; a press that would leave the visible window does nothing). Near a point with a horizontal or vertical tangent P snaps onto it exactly (within 10 px or
 *                  0.05 when dragging, 0.03 with the keys). The tangent at P is solid (`--limit`), with the slope y′
 *                  from the preset's closed form; a vertical tangent is a vertical line. The folium's node (0, 0) is
 *                  ringed (dashed) and P never comes within 0.15 of it. With `branch`: the piece of the curve through
 *                  P that is a graph y(x) is highlighted (a wide band in `--curve-2` under the curve), a dashed vertical
 *                  line through P and the other points of the curve above x are hollow rings (`--delta`).
 * mode 'related':  a scene (ladder against a wall / inverted conical tank / spherical balloon) beside (on a phone:
 *                  above) a small graph of the asked rate against the driving quantity q, with the current point. The
 *                  driving quantity by its slider (labels "המרחק x מהקיר", "עומק המים h", "הרדיוס r"), the arrow keys on the canvas, or "הפעלה" (play), which runs the
 *                  motion in time (ladder 1 s per s, cone 4 min per s, balloon 1 s per s) to the end of the range and
 *                  stops; with stillness (motionAllowed() false) play does not start and says so. Velocity arrows:
 *                  the given rate in ink, the asked rate in `--limit`, lengths proportional to the speeds (the
 *                  ladder's top arrow may reach below the ground: it is a velocity, not a place); an arrow too long
 *                  for the scene (ladder x > 4.82, cone h < 1.95) is cut short and marked by two slashes. A rate off
 *                  the small graph's scale is a triangle at its edge with the value beside it.
 *
 * Props (defaults): id (required); mode ('implicit'); modes (the mode buttons shown; default the starting mode only);
 * preset (the preset of the STARTING mode: implicit 'circle', related 'ladder'); presets (the preset buttons shown,
 * filtered to the current mode; default all of that mode; fewer than two of a mode hides the buttons); px, py (implicit:
 * the start point, projected onto the curve, snapping within 0.05 to a horizontal/vertical-tangent point; default the
 * preset's point); branch (false); q (related: ladder x ∈ [0.2, 4.95] default 3.5, cone h ∈ [0.2, 6] default 3,
 * balloon r ∈ [0.5, 8] default 4; clamped; the defaults avoid the question bank's cases x = 3, h = 4, r = 5); tasks ([]). formulaHtml is set by ImplicitLab.astro (the KaTeX of every y′, rendered
 * at build time); without it the readout shows the plain-text twin.
 * Implicit presets: circle, ellipse, tilted, cubic-curve, folium. Related presets: ladder, cone, balloon.
 *
 * Step keys (<Step fig=… set={{…}}>): mode, preset (a preset of the mode the step leaves the figure in; a new preset
 * resets P, resp. q, to its default unless the step gives px/py, resp. q), px, py (projected; one of them alone keeps the
 * other coordinate of the current P), branch, q. A key left out keeps its value. A step stops play. A state set by a
 * step never ticks a task, and a state that already had a task's property when a step or reset made it must be left
 * and found again.
 *
 * Readouts (data-readout):
 *   implicit: eq (the equation), p (P; exact text at the default point and at the special points, with decimals),
 *             slope ("y′ = …" with the exact fraction at the default point; "y′ = 0: משיק אופקי"; "משיק אנכי: …"),
 *             formula (the sentence "גוזרים את שני האגפים לפי x, כש-y = y(x), ומבודדים את y′:" and the TeX of y′),
 *             check (the left side minus the right side at P: a numerical check, ≈ 0), others (only with branch: the
 *             other points of the curve above P's x, or "the tangent is vertical: no neighbourhood is a graph").
 *   related:  preset (the problem's name), q (the driving quantity; the cone adds the water volume), rate (the given
 *             rate), dep (the quantity whose rate is asked: ladder y, cone h, balloon V), depRate (its rate with sign;
 *             with the exact value at the default q only: −7/√51, 8/(9π), 128π).
 *
 * Tasks (ticked only inside the learner's own drag, key, button, slider, play or toggle):
 *   implicit: implicit-horizontal (P moved within 0.05 of a point with a horizontal tangent), implicit-vertical (P moved
 *             within 0.05 of a point with a vertical tangent), implicit-branch (P moved while branch is on)
 *   related:  related-fast (ladder, q = x ≥ 4.8: the top falls faster than 3 m/s), related-slow (cone, q = h ≥ 5:
 *             dh/dt below a tenth of its value at h = 1.5). Play counts as the learner's own change.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import {
  FOLIUM_NODE_R,
  IMPLICIT,
  IMPLICIT_IDS,
  RELATED,
  RELATED_IDS,
  coneVolume,
  curvePolylines,
  exactRate,
  graphPiece,
  isDefaultPoint,
  isImplicitId,
  isRelatedId,
  nearSpecial,
  otherPointsAbove,
  projectToCurve,
  slopeAt,
  walkAlong,
  type ImplicitId,
  type RelatedId,
} from '~/math/implicit';
import type { Vec2 } from '~/math/vec';
import { markTask } from '~/progress/store';
import { motionAllowed } from '~/progress/settings';
import { subscribeSteps, type StepState } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { sci } from './core/format';
import { withAlpha } from './core/ink';
import { drawAxes, drawCurve, insetBox, makePlot, type Box, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import './ImplicitLab.css';

export type ImplicitMode = 'implicit' | 'related';

export interface ImplicitLabProps {
  id: string;
  mode?: ImplicitMode;
  /** the mode buttons shown (default: the starting mode only) */
  modes?: ImplicitMode[];
  /** the preset of the starting mode */
  preset?: string;
  /** the preset buttons shown (default: all presets of the current mode) */
  presets?: string[];
  px?: number;
  py?: number;
  branch?: boolean;
  q?: number;
  tasks?: string[];
  /** set by ImplicitLab.astro: preset id → KaTeX HTML of y′ */
  formulaHtml?: Record<string, string>;
}

interface Setup {
  mode: ImplicitMode;
  preset: ImplicitId;
  px: number;
  py: number;
  branch: boolean;
  rp: RelatedId;
  q: number;
}

const ltr = (s: string) => String.fromCharCode(0x2066) + s.replace(/ /g, String.fromCharCode(0xa0)) + String.fromCharCode(0x2069);

const TASK_LABEL: Record<string, string> = {
  'implicit-horizontal': 'גררו את P לנקודה שבה המשיק אופקי. מה מתאפס בנוסחה של y′?',
  'implicit-vertical': 'גררו את P לנקודה שבה המשיק אנכי. מה קורה למכנה של y′?',
  'implicit-branch': `הדליקו "חתיכה שהיא גרף ${ltr('y(x)')}" וגררו את P. איפה החתיכה נגמרת?`,
  'related-fast': `בסולם, הרחיקו את רגל הסולם עד ${ltr('x ≥ 4.8')}. כמה מהר יורד ראש הסולם?`,
  'related-slow': `במיכל החרוטי, העלו את עומק המים עד ${ltr('h ≥ 5')}. מה קרה לקצב העלייה של המים?`,
};

const MODE_LABEL: Record<ImplicitMode, string> = { implicit: 'גזירה סתומה', related: 'קצבים קשורים' };
const RELATED_LABEL: Record<RelatedId, string> = { ladder: 'סולם', cone: 'מיכל חרוטי', balloon: 'בלון' };
const Q_STEP: Record<RelatedId, number> = { ladder: 0.01, cone: 0.05, balloon: 0.05 };
const Q_SLIDER: Record<RelatedId, string> = {
  ladder: 'המרחק x מהקיר',
  cone: 'עומק המים h',
  balloon: 'הרדיוס r',
};
/** the window of the small graph of the asked rate */
const RATE_WIN: Record<RelatedId, [number, number]> = { ladder: [-7.5, 0.5], cone: [0, 3], balloon: [0, 1700] };
/** world units of arrow per unit of speed, and the longest arrow */
const ARROW: Record<RelatedId, { k: number; max: number }> = { ladder: { k: 0.9, max: 3.3 }, cone: { k: 3, max: 2 }, balloon: { k: 0.8, max: 2 } };

const TAU = 2 * Math.PI;
const SNAP_STEP = 0.05;
const SNAP_KEY = 0.03;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const bool = (x: unknown): boolean | null => (typeof x === 'boolean' ? x : null);
const roundTo = (x: number, step: number) => Number((Math.round(x / step) * step).toPrecision(10));
const minus = (s: string) => s.replace(/-/g, '−');
const fmt = (x: number, sig = 4) => (Number.isNaN(x) ? '—' : Math.abs(x) < 5e-5 ? '0' : minus(sci(x, sig)));
const fmtRes = (x: number) => (x === 0 ? '0' : minus(sci(x, 2)));
const ptText = (p: Vec2) => `(${fmt(p[0])}, ${fmt(p[1])})`;
const clampQ = (id: RelatedId, q: number) => clamp(q, RELATED[id].range[0], RELATED[id].range[1]);
/** "−3/4 = " at the default point, unless the exact form reads the same as the decimal (the folium's −1) */
const exactPrefix = (id: ImplicitId, p: Vec2, m: number) => {
  if (!isDefaultPoint(id, p)) return '';
  const ex = IMPLICIT[id].slopeExact;
  return ex === fmt(m) ? '' : `${ex} = `;
};
const near = (a: Vec2, b: Vec2, r: number) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= r + 1e-12;

/* ---- tasks: `needs` = the learner's change must touch one of these keys; `event` tasks tick on the learner's act, the
 * others must be left and found again after a step or reset made the state */
interface Rule {
  needs: (keyof Setup)[];
  event?: boolean;
  state: (s: Setup) => boolean;
}
const RULES: Record<string, Rule> = {
  'implicit-horizontal': { needs: ['px', 'py'], state: (s) => s.mode === 'implicit' && IMPLICIT[s.preset].horizontal.some((q) => near(q.at, [s.px, s.py], 0.05)) },
  'implicit-vertical': { needs: ['px', 'py'], state: (s) => s.mode === 'implicit' && IMPLICIT[s.preset].vertical.some((q) => near(q.at, [s.px, s.py], 0.05)) },
  'implicit-branch': { needs: ['px', 'py'], event: true, state: (s) => s.mode === 'implicit' && s.branch },
  'related-fast': { needs: ['q'], state: (s) => s.mode === 'related' && s.rp === 'ladder' && s.q >= 4.8 - 1e-9 },
  'related-slow': { needs: ['q'], state: (s) => s.mode === 'related' && s.rp === 'cone' && s.q >= 5 - 1e-9 },
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
  ctx.lineCap = 'round';
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
function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, fill: string, width = 2.2, dash: number[] = []) {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
/** an arrow from (x1, y1) to (x2, y2) in screen pixels; no arrow when it is shorter than 2 px. `cut`: the true arrow
 *  is longer than drawn, shown by two slashes across the shaft */
function arrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width = 2.6, cut = false) {
  const L = Math.hypot(x2 - x1, y2 - y1);
  if (L < 2) return;
  const ux = (x2 - x1) / L;
  const uy = (y2 - y1) / L;
  const hd = Math.min(11, 0.5 * L + 4);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - ux * hd * 0.8, y2 - uy * hd * 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - ux * hd - uy * hd * 0.45, y2 - uy * hd + ux * hd * 0.45);
  ctx.lineTo(x2 - ux * hd + uy * hd * 0.45, y2 - uy * hd - ux * hd * 0.45);
  ctx.closePath();
  ctx.fill();
  if (cut) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    ctx.lineWidth = 2;
    for (const o of [-3.5, 3.5]) {
      const cx = mx + ux * o;
      const cy = my + uy * o;
      ctx.beginPath();
      ctx.moveTo(cx - uy * 7 - ux * 3, cy + ux * 7 - uy * 3);
      ctx.lineTo(cx + uy * 7 + ux * 3, cy - ux * 7 + uy * 3);
      ctx.stroke();
    }
  }
  ctx.restore();
}
function strokePolyline(ctx: CanvasRenderingContext2D, plot: Plot, pts: readonly Vec2[], closed: boolean, color: string, width: number) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.box.x, plot.box.y, plot.box.w, plot.box.h);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(plot.px(pts[0][0]), plot.py(pts[0][1]));
  for (let i = 1; i < pts.length; i++) ctx.lineTo(plot.px(pts[i][0]), plot.py(pts[i][1]));
  if (closed) ctx.closePath();
  ctx.stroke();
  ctx.restore();
}
/** a plot of the window [xr] × [yr] in `box` with equal scales: the shorter side of the window is widened */
function equalPlot(box: Box, xr: [number, number], yr: [number, number], labels = true): Plot {
  const cx = (xr[0] + xr[1]) / 2;
  const cy = (yr[0] + yr[1]) / 2;
  const s = Math.max((xr[1] - xr[0]) / box.w, (yr[1] - yr[0]) / box.h);
  return makePlot(
    box,
    { min: cx - (box.w * s) / 2, max: cx + (box.w * s) / 2, label: labels ? 'x' : undefined },
    { min: cy - (box.h * s) / 2, max: cy + (box.h * s) / 2, label: labels ? 'y' : undefined },
  );
}

export default function ImplicitLab(props: ImplicitLabProps) {
  const startMode: ImplicitMode = props.mode ?? 'implicit';
  const modes: ImplicitMode[] = props.modes ?? [startMode];
  const initial = (): Setup => {
    const preset: ImplicitId = startMode === 'implicit' && isImplicitId(props.preset) ? props.preset : 'circle';
    const rp: RelatedId = startMode === 'related' && isRelatedId(props.preset) ? props.preset : 'ladder';
    const sp = IMPLICIT[preset];
    const given = num(props.px) !== null || num(props.py) !== null;
    const P = given ? projectToCurve(preset, [num(props.px) ?? sp.point[0], num(props.py) ?? sp.point[1]], SNAP_STEP) : sp.point;
    return {
      mode: startMode,
      preset,
      px: P[0],
      py: P[1],
      branch: props.branch ?? false,
      rp,
      q: clampQ(rp, num(props.q) ?? RELATED[rp].q0),
    };
  };
  const [setup, setSetup] = useState<Setup>(initial);
  const cur = useRef(setup);
  const [live, setLive] = useState('');
  const [narrow, setNarrow] = useState(false);
  const [playing, setPlaying] = useState(false);
  const plotRef = useRef<Plot | null>(null);
  const dragging = useRef(false);
  /** tasks whose state held when the last step or reset made it: they must be left and found again */
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

  useEffect(
    () =>
      subscribeSteps(props.id, (st: StepState) => {
        setPlaying(false);
        const prev = cur.current;
        const mode = typeof st.mode === 'string' && modes.includes(st.mode as ImplicitMode) ? (st.mode as ImplicitMode) : prev.mode;
        const next: Setup = { ...prev, mode };
        next.branch = bool(st.branch) ?? prev.branch;
        const px = num(st.px);
        const py = num(st.py);
        if (mode === 'implicit') {
          const newPreset = isImplicitId(st.preset) && st.preset !== prev.preset;
          if (isImplicitId(st.preset)) next.preset = st.preset;
          const sp = IMPLICIT[next.preset];
          if (px !== null || py !== null) {
            const base: Vec2 = newPreset ? sp.point : [prev.px, prev.py];
            const P = projectToCurve(next.preset, [px ?? base[0], py ?? base[1]], SNAP_STEP);
            next.px = P[0];
            next.py = P[1];
          } else if (newPreset) {
            next.px = sp.point[0];
            next.py = sp.point[1];
          }
        }
        if (mode === 'related') {
          const newPreset = isRelatedId(st.preset) && st.preset !== prev.rp;
          if (isRelatedId(st.preset)) next.rp = st.preset;
          next.q = clampQ(next.rp, num(st.q) ?? (newPreset ? RELATED[next.rp].q0 : prev.q));
        }
        commit(next);
        rebase(next);
      }),
    [props.id],
  );

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
      const sp = RELATED[c.rp];
      const q = sp.advance(c.q, dt * sp.timePerSecond);
      if (q >= sp.range[1]) {
        apply({ q: sp.range[1] });
        setPlaying(false);
        setLive(describe({ ...c, q: sp.range[1] }));
        return;
      }
      apply({ q });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const s0 = setup;

  /* ---------------------------------------------------------------- drawing */
  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    const nar = view.w < 520;
    const fs = nar ? 12 : 13;
    const font = (w8: number, size = fs, it = false) => `${it ? 'italic ' : ''}${w8} ${size}px ${p.fontUi}`;
    if (s0.mode === 'implicit') drawImplicit(ctx, view.w, view.h, p, nar, font);
    else drawRelated(ctx, view.w, view.h, p, nar, font);
  };

  const drawImplicit = (ctx: CanvasRenderingContext2D, W: number, H: number, p: Palette, nar: boolean, font: (w: number, s?: number, it?: boolean) => string) => {
    const sp = IMPLICIT[s0.preset];
    const box = insetBox({ x: 0, y: 0, w: W, h: H }, { l: 46, r: 14, t: nar ? 44 : 16, b: 38 });
    const plot = equalPlot(box, sp.window.x, sp.window.y);
    plotRef.current = plot;
    drawAxes(ctx, plot, p);
    const PX = plot.px;
    const PY = plot.py;
    // the axes through the origin
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    line(ctx, PX(0), box.y, PX(0), box.y + box.h, p.ink3, 1.4);
    line(ctx, box.x, PY(0), box.x + box.w, PY(0), p.ink3, 1.4);
    ctx.restore();
    const P: Vec2 = [s0.px, s0.py];
    // the graph piece, under the curve
    if (s0.branch) {
      const piece = graphPiece(s0.preset, P);
      if (piece) strokePolyline(ctx, plot, piece, false, withAlpha(p.curve2, 0.45), 9);
    }
    for (const pl of curvePolylines(s0.preset)) strokePolyline(ctx, plot, pl.points, pl.closed, p.curve, 2.4);
    // the folium's node: no single tangent there
    if (sp.avoid) ring(ctx, PX(sp.avoid.at[0]), PY(sp.avoid.at[1]), Math.max(4, sp.avoid.r * (box.w / (plot.x.max - plot.x.min))), p.ink3, 'transparent', 1.3, [3, 3]);
    // the vertical line through P and the other points above x
    if (s0.branch) {
      line(ctx, PX(P[0]), box.y, PX(P[0]), box.y + box.h, withAlpha(p.ink3, 0.9), 1.3, [5, 4]);
      for (const o of otherPointsAbove(s0.preset, P)) {
        const sy = PY(o[1]);
        if (sy < box.y || sy > box.y + box.h) continue;
        ring(ctx, PX(o[0]), sy, 6, p.delta, p.paper, 2.4);
      }
    }
    // the tangent at P
    const sl = slopeAt(s0.preset, P[0], P[1]);
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    if (sl.kind === 'vertical') line(ctx, PX(P[0]), box.y, PX(P[0]), box.y + box.h, p.limit, 2.4);
    else if (sl.kind !== 'none') {
      const span = 3 * (plot.x.max - plot.x.min);
      const dx = 1 / Math.hypot(1, sl.m);
      const dy = sl.m * dx;
      line(ctx, PX(P[0] - span * dx), PY(P[1] - span * dy), PX(P[0] + span * dx), PY(P[1] + span * dy), p.limit, 2.4);
    }
    ctx.restore();
    // P
    const sx = PX(P[0]);
    const sy = PY(P[1]);
    ring(ctx, sx, sy, 9.5, p.limit, 'transparent', 2);
    dot(ctx, sx, sy, 5.5, p.ink, p.paper);
    haloText(ctx, p, 'P', sx + 14, sy - 14, { font: font(700, nar ? 14 : 15, true) });
  };

  const drawRelated = (ctx: CanvasRenderingContext2D, W: number, H: number, p: Palette, nar: boolean, font: (w: number, s?: number, it?: boolean) => string) => {
    const sp = RELATED[s0.rp];
    const q = s0.q;
    const sceneBox: Box = nar ? { x: 8, y: 44, w: W - 16, h: H * 0.56 - 44 } : { x: 10, y: 10, w: W * 0.55 - 20, h: H - 20 };
    const graphOuter: Box = nar ? { x: 0, y: H * 0.56, w: W, h: H * 0.44 } : { x: W * 0.55, y: 0, w: W * 0.45, h: H };
    const ar = ARROW[s0.rp];
    const rate = sp.depRate(q);
    const lab = (s: string, x: number, y: number, color: string, align: CanvasTextAlign = 'left') => haloText(ctx, p, s, x, y, { font: font(700), color, align });
    plotRef.current = null;

    if (s0.rp === 'ladder') {
      const sc = equalPlot(sceneBox, [-1.4, 5.6], [-2.8, 5.5], false);
      const X = sc.px;
      const Y = sc.py;
      const y = sp.dep(q);
      // the earth below the ground and the wall
      ctx.save();
      ctx.fillStyle = withAlpha(p.ink3, 0.12);
      ctx.fillRect(X(-1.4), Y(0), X(5.6) - X(-1.4), Y(-2.8) - Y(0));
      ctx.fillRect(X(-1.4), Y(5.3), X(0) - X(-1.4), Y(0) - Y(5.3));
      ctx.restore();
      line(ctx, X(-1.4), Y(0), X(5.6), Y(0), p.ink2, 2);
      line(ctx, X(0), Y(0), X(0), Y(5.3), p.ink2, 3);
      // the ladder
      line(ctx, X(q), Y(0), X(0), Y(y), p.curve, 4.5);
      dot(ctx, X(q), Y(0), 5.5, p.curve, p.paper);
      dot(ctx, X(0), Y(y), 5.5, p.curve, p.paper);
      // the distances x and y, dashed
      line(ctx, X(0), Y(0) + 14, X(q), Y(0) + 14, p.ink3, 1.2, [4, 3]);
      lab(`x = ${fmt(q, 3)}`, (X(0) + X(q)) / 2, Y(0) + 26, p.ink2, 'center');
      lab(`y = ${fmt(y, 3)}`, X(0) + 8, Y(y / 2), p.ink2);
      // the velocities: the foot (given, ink) and the top (asked, the derivative colour)
      arrow(ctx, X(q), Y(0) - 10, X(q + ar.k * sp.rate), Y(0) - 10, p.ink);
      lab(`dx/dt = ${fmt(sp.rate)}`, X(q + ar.k * sp.rate), Y(0) + 46, p.ink, 'right');
      const L = Math.min(ar.max, ar.k * Math.abs(rate));
      arrow(ctx, X(-0.35), Y(y), X(-0.35), Y(y - L), p.limit, 2.6, ar.k * Math.abs(rate) > ar.max);
      lab(`dy/dt = ${fmt(rate, 3)}`, X(0.15), Y(Math.min(5.2, y + 0.4)), p.limit);
    } else if (s0.rp === 'cone') {
      const sc = equalPlot(sceneBox, [-4.2, 4.2], [-0.6, 7.8], false);
      const X = sc.px;
      const Y = sc.py;
      const h = q;
      // the water
      ctx.save();
      ctx.fillStyle = withAlpha(p.delta, 0.25);
      ctx.beginPath();
      ctx.moveTo(X(0), Y(0));
      ctx.lineTo(X(-h / 2), Y(h));
      ctx.lineTo(X(h / 2), Y(h));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      line(ctx, X(-h / 2), Y(h), X(h / 2), Y(h), p.delta, 2.2);
      // the tank
      line(ctx, X(0), Y(0), X(-3), Y(6), p.ink2, 2.4);
      line(ctx, X(0), Y(0), X(3), Y(6), p.ink2, 2.4);
      line(ctx, X(-3), Y(6), X(3), Y(6), p.ink3, 1.2, [5, 4]);
      // h and r
      line(ctx, X(3.4), Y(0), X(3.4), Y(h), p.ink3, 1.2, [4, 3]);
      lab(`h = ${fmt(h, 3)}`, X(3.5), Y(h / 2), p.ink2);
      if (h > 1.2) lab(`r = h/2`, X(h / 4), Y(h) + 14, p.ink2, 'center');
      // the inflow (given) and the rise of the surface (asked)
      arrow(ctx, X(-2.6), Y(7.6), X(-2.6), Y(6.5), p.ink);
      lab(`dV/dt = ${fmt(sp.rate)}`, X(-2.4), Y(7.3), p.ink);
      const L = Math.min(ar.max, ar.k * rate);
      arrow(ctx, X(0), Y(h), X(0), Y(h + L), p.limit, 2.6, ar.k * rate > ar.max);
      lab(`dh/dt = ${fmt(rate, 3)}`, X(0.25), Y(h + Math.min(L, 1.6) + 0.35), p.limit);
    } else {
      const sc = equalPlot(sceneBox, [-9.6, 9.6], [-9.6, 9.6], false);
      const X = sc.px;
      const Y = sc.py;
      const r = q;
      ring(ctx, X(0), Y(0), Math.abs(X(r) - X(0)), p.curve2, withAlpha(p.curve2, 0.12), 2.2);
      dot(ctx, X(0), Y(0), 3.5, p.ink2, p.paper);
      const c = Math.cos(0.6);
      const s = Math.sin(0.6);
      line(ctx, X(0), Y(0), X(r * c), Y(r * s), p.ink2, 1.6);
      lab(`r = ${fmt(r, 3)}`, X((r * c) / 2) + 6, Y((r * s) / 2) + 12, p.ink2);
      arrow(ctx, X(r * c), Y(r * s), X((r + ar.k * sp.rate) * c), Y((r + ar.k * sp.rate) * s), p.ink);
      lab(`dr/dt = ${fmt(sp.rate)}`, X((r + ar.k * sp.rate) * c) - 4, Y((r + ar.k * sp.rate) * s) - 14, p.ink, 'right');
      lab(`dV/dt = ${fmt(rate, 4)}`, X(0), Y(-Math.min(r, 8.2)) + (r > 7.6 ? -14 : 16), p.limit, 'center');
    }

    // the small graph of the asked rate against q
    const gBox = insetBox(graphOuter, { l: 50, r: 14, t: nar ? 10 : 18, b: 40 });
    const [ylo, yhi] = RATE_WIN[s0.rp];
    const plot = makePlot(gBox, { min: sp.range[0], max: sp.range[1], label: `${sp.qName} (${sp.qUnit})` }, { min: ylo, max: yhi, label: sp.depRateName });
    drawAxes(ctx, plot, p);
    if (ylo < 0 && yhi > 0) line(ctx, gBox.x, plot.py(0), gBox.x + gBox.w, plot.py(0), p.ink3, 1.2);
    drawCurve(ctx, plot, (x) => sp.depRate(x), { color: p.limit, width: 2.4, samples: 320 });
    const gy = plot.py(rate);
    const gx = plot.px(q);
    if (gy >= gBox.y && gy <= gBox.y + gBox.h) {
      line(ctx, gx, gBox.y + gBox.h, gx, gy, withAlpha(p.limit, 0.8), 1.2, [4, 4]);
      dot(ctx, gx, gy, 6, p.limit, p.paper);
    } else {
      // off the chart: a triangle at the edge it left by
      const up = gy < gBox.y;
      const ty = up ? gBox.y + 8 : gBox.y + gBox.h - 8;
      ctx.save();
      ctx.fillStyle = p.limit;
      ctx.beginPath();
      ctx.moveTo(gx, ty + (up ? -7 : 7));
      ctx.lineTo(gx - 7, ty + (up ? 7 : -7));
      ctx.lineTo(gx + 7, ty + (up ? 7 : -7));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      lab(fmt(rate, 3), gx + 10, ty + (up ? 4 : -4), p.limit);
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
  const aspect = setup.mode === 'implicit' ? (narrow ? 1 : 1.35) : narrow ? 0.78 : 1.75;

  /* ---------------------------------------------------------------- learner changes */
  const moveP = (P: Vec2) => {
    const c = cur.current;
    if (P[0] === c.px && P[1] === c.py) return;
    apply({ px: P[0], py: P[1] });
  };
  const fromPointer = (e: PointerEvent) => {
    const plot = plotRef.current;
    const c = cur.current;
    if (!plot || c.mode !== 'implicit') return;
    const upp = (plot.x.max - plot.x.min) / plot.box.w;
    const x = plot.x.min + (e.offsetX - plot.box.x) * upp;
    const y = plot.y.max - (e.offsetY - plot.box.y) * ((plot.y.max - plot.y.min) / plot.box.h);
    moveP(projectToCurve(c.preset, [x, y], Math.max(SNAP_STEP, 10 * upp)));
  };
  const onPointerDown = (e: PointerEvent) => {
    if (cur.current.mode !== 'implicit') return;
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
  const setQ = (v: number) => {
    const c = cur.current;
    apply({ q: clampQ(c.rp, roundTo(v, Q_STEP[c.rp])) });
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const c = cur.current;
    const fwd = e.key === 'ArrowRight' || e.key === 'ArrowUp';
    const back = e.key === 'ArrowLeft' || e.key === 'ArrowDown';
    if (!fwd && !back) return;
    e.preventDefault();
    if (c.mode === 'implicit') {
      const np = walkAlong(c.preset, [c.px, c.py], (fwd ? 1 : -1) * (e.shiftKey ? 0.25 : 0.05), SNAP_KEY);
      const pl = plotRef.current;
      // P stays in the visible window
      if (!pl || (np[0] >= pl.x.min && np[0] <= pl.x.max && np[1] >= pl.y.min && np[1] <= pl.y.max)) moveP(np);
    } else {
      setPlaying(false);
      setQ(c.q + (fwd ? 1 : -1) * Q_STEP[c.rp] * (e.shiftKey ? 10 : 1));
    }
    setLive(describe(cur.current));
  };
  const play = () => {
    if (!motionAllowed()) {
      setLive('מצב שקט: התנועה לא מוצגת. הזיזו את הפס.');
      return;
    }
    const c = cur.current;
    const sp = RELATED[c.rp];
    if (c.q >= sp.range[1] - 1e-9) apply({ q: sp.range[0] });
    setPlaying(true);
  };

  /* ---------------------------------------------------------------- text */
  const M = (q: { children: ComponentChildren }) => <bdi dir="ltr">{q.children}</bdi>;
  const spI = IMPLICIT[setup.preset];
  const spR = RELATED[setup.rp];
  const P: Vec2 = [setup.px, setup.py];

  function pointText(id: ImplicitId, p: Vec2): string {
    if (isDefaultPoint(id, p)) return IMPLICIT[id].pointText;
    const sp = nearSpecial(id, p, 1e-9);
    if (sp) return sp.point.text === ptText(p) ? sp.point.text : `${sp.point.text} ≈ ${ptText(p)}`;
    return ptText(p);
  }

  function slopeLine(id: ImplicitId, p: Vec2): string {
    const sl = slopeAt(id, p[0], p[1]);
    if (sl.kind === 'vertical') return 'משיק אנכי: המכנה של y′ מתאפס ב-P, והשיפוע לא מוגדר.';
    if (sl.kind === 'horizontal') return 'y′ = 0: משיק אופקי (המונה של y′ מתאפס ב-P).';
    if (sl.kind === 'none') return 'אין ב-P משיק יחיד.';
    const ex = exactPrefix(id, p, sl.m);
    return `y′ = ${ex}${fmt(sl.m)}`;
  }

  function describe(s: Setup): string {
    if (s.mode === 'implicit') return `P = ${pointText(s.preset, [s.px, s.py])}. ${slopeLine(s.preset, [s.px, s.py])}`;
    const sp = RELATED[s.rp];
    return `${sp.qName} = ${fmt(s.q, 3)} ${sp.qUnit}, ${sp.depRateName} = ${fmt(sp.depRate(s.q), 3)} ${sp.depRateUnit}.`;
  }

  const label =
    setup.mode === 'implicit'
      ? `איור חי: העקומה ${spI.text} במערכת צירים עם קנה מידה שווה. נקודה P על העקומה שאפשר לגרור לאורכה (או להזיז בחיצים), והמשיק ב-P בקו מלא בשיפוע מהנוסחה של y′.${setup.branch ? ' מודגשת החתיכה של העקומה סביב P שהיא גרף של פונקציה y(x), וקו אנכי מקווקו דרך P עובר בנקודות האחרות של העקומה מעל אותו x, בעיגולים חלולים.' : ''}`
      : setup.rp === 'ladder'
        ? 'איור חי: סולם באורך 5 מטרים נשען על קיר. רגל הסולם מתרחקת מהקיר במהירות קבועה של מטר בשנייה, וראש הסולם יורד. החצים מראים את שתי המהירויות, ולידם גרף של מהירות הירידה כפונקציה של המרחק x.'
        : setup.rp === 'cone'
          ? 'איור חי: מיכל בצורת חרוט הפוך שמתמלא מים בקצב קבוע של 2 מטר מעוקב לדקה. החץ על פני המים מראה את קצב העלייה שלהם, ולידו גרף של קצב העלייה כפונקציה של העומק h.'
          : 'איור חי: בלון כדורי שהרדיוס שלו גדל בקצב קבוע של 2 סנטימטר לשנייה, ולידו גרף של קצב גדילת הנפח כפונקציה של הרדיוס r.';

  let readout: ComponentChildren;
  if (setup.mode === 'implicit') {
    const html = props.formulaHtml?.[setup.preset];
    const F = spI.F(P[0], P[1]);
    const sl = slopeAt(setup.preset, P[0], P[1]);
    const others = otherPointsAbove(setup.preset, P);
    readout = (
      <>
        <span class="q" data-readout="eq">
          העקומה: <M>{spI.text}</M>
        </span>
        <span class="q" data-readout="p">
          <M>P = {pointText(setup.preset, P)}</M>
        </span>
        <span class="q" data-readout="slope">
          {sl.kind === 'vertical' ? (
            <>
              <b>משיק אנכי</b>: המכנה של <M>y′</M> מתאפס ב-P, והשיפוע לא מוגדר.
            </>
          ) : sl.kind === 'horizontal' ? (
            <>
              <M>
                <b>y′ = 0</b>
              </M>
              : <b>משיק אופקי</b> (המונה של <M>y′</M> מתאפס ב-P).
            </>
          ) : (
            <>
              שיפוע המשיק ב-P מהנוסחה:{' '}
              <M>
                <b>
                  y′ = {exactPrefix(setup.preset, P, sl.m)}
                  {fmt(sl.m)}
                </b>
              </M>
            </>
          )}
        </span>
        <span class="q imp-formula" data-readout="formula">
          גוזרים את שני האגפים לפי <M>x</M>, כש-<M>y = y(x)</M>, ומבודדים את <M>y′</M>:{' '}
          {html ? <span class="imp-tex" dir="ltr" dangerouslySetInnerHTML={{ __html: html }} /> : <M>{spI.slopeText}</M>}
        </span>
        <span class="q" data-readout="check">
          בדיקה מספרית ב-P: <M>{spI.residualText} = {fmtRes(F)}</M> (כמעט 0: P על העקומה)
        </span>
        {setup.branch && (
          <span class="q" data-readout="others">
            {sl.kind === 'vertical'
              ? `ב-P המשיק אנכי: אין סביבה של P שבה העקומה היא גרף של פונקציה ${ltr('y(x)')}.`
              : others.length === 0
                ? setup.preset === 'cubic-curve'
                  ? `מעל ${ltr(`x = ${fmt(P[0])}`)} אין על העקומה נקודה אחרת. העקומה הזאת כולה גרף של פונקציה אחת ${ltr('y(x)')}: מעל כל x יש עליה נקודה אחת בדיוק.`
                  : `מעל ${ltr(`x = ${fmt(P[0])}`)} אין על העקומה נקודה אחרת.`
                : `מעל ${ltr(`x = ${fmt(P[0])}`)} יש על העקומה עוד ${others.length === 1 ? 'נקודה' : `${others.length} נקודות`}: ${ltr(others.map(ptText).join(', '))}. העקומה כולה אינה גרף של פונקציה אחת.`}
          </span>
        )}
      </>
    );
  } else {
    const q = setup.q;
    const ex = exactRate(setup.rp, q);
    readout = (
      <>
        <span class="q" data-readout="preset">
          <b>{spR.name}</b>
          {setup.rp === 'cone' && (
            <>
              , הרדיוס של פני המים <M>r = h/2</M>
            </>
          )}
        </span>
        <span class="q" data-readout="q">
          {spR.qLabel}: <M>{spR.qName} = <b>{fmt(q, 3)}</b></M> {spR.qUnit}
          {setup.rp === 'cone' && (
            <>
              {' '}
              (נפח המים <M>V = πh³/12 = {fmt(coneVolume(q), 3)}</M> מ״ק)
            </>
          )}
        </span>
        <span class="q" data-readout="rate">
          הקצב הנתון: <M>{spR.rateName} = {fmt(spR.rate)}</M> {spR.rateUnit} (קבוע)
        </span>
        <span class="q" data-readout="dep">
          {spR.depLabel}: <M>{spR.depName} = {fmt(spR.dep(q), 4)}</M> {spR.depUnit}
        </span>
        <span class="q" data-readout="depRate">
          <M>{spR.depRateText}</M>, כלומר{' '}
          <M>
            <b>
              {spR.depRateName} = {ex ? `${ex} ≈ ` : ''}
              {fmt(spR.depRate(q), 4)}
            </b>
          </M>{' '}
          {spR.depRateUnit}
        </span>
      </>
    );
  }

  const shownPresets = (list: readonly string[]) => (props.presets ? list.filter((x) => props.presets!.includes(x)) : [...list]);
  const implicitButtons = shownPresets(IMPLICIT_IDS) as ImplicitId[];
  const relatedButtons = shownPresets(RELATED_IDS) as RelatedId[];

  return (
    <SimShell
      fig={props.id}
      label={label}
      canvasRef={canvasRef}
      aspect={aspect}
      live={live}
      tasks={tasks}
      cursor={setup.mode === 'implicit' ? 'pointer' : 'default'}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onReset={() => {
        setPlaying(false);
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
          {setup.mode === 'implicit' && (
            <>
              {implicitButtons.length > 1 && (
                <div class="group" role="group" aria-label="העקומה">
                  {implicitButtons.map((id) => (
                    <Toggle
                      key={id}
                      label={<bdi dir="ltr">{IMPLICIT[id].text}</bdi>}
                      on={setup.preset === id}
                      onChange={() => {
                        const pt = IMPLICIT[id].point;
                        apply({ preset: id, px: pt[0], py: pt[1] });
                      }}
                    />
                  ))}
                </div>
              )}
              <div class="group" role="group" aria-label="מה להציג">
                <Toggle
                  label={
                    <>
                      חתיכה שהיא גרף <bdi dir="ltr">y(x)</bdi>
                    </>
                  }
                  on={setup.branch}
                  swatch="var(--curve-2)"
                  onChange={(on) => apply({ branch: on })}
                />
              </div>
            </>
          )}
          {setup.mode === 'related' && (
            <>
              {relatedButtons.length > 1 && (
                <div class="group" role="group" aria-label="הבעיה">
                  {relatedButtons.map((id) => (
                    <Toggle
                      key={id}
                      label={RELATED_LABEL[id]}
                      on={setup.rp === id}
                      onChange={() => {
                        setPlaying(false);
                        apply({ rp: id, q: RELATED[id].q0 });
                      }}
                    />
                  ))}
                </div>
              )}
              <Slider
                label={Q_SLIDER[setup.rp]}
                value={roundTo(setup.q, Q_STEP[setup.rp])}
                min={spR.range[0]}
                max={spR.range[1]}
                step={Q_STEP[setup.rp]}
                format={(v) => `${fmt(v, 3)} ${spR.qUnit}`}
                onChange={(v) => {
                  setPlaying(false);
                  setQ(v);
                }}
              />
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
            </>
          )}
        </>
      }
    />
  );
}
