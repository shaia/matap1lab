/**
 * SketchLab (chapter 6.5, curve sketching): two modes. Maths: src/math/sketch.ts, whose STORED exact facts (domain,
 * asymptotes, critical and inflection points, the sign of f′ and f″ on each interval, the leading term of a residual)
 * drive every mark, strip and verdict; nothing is inferred from sampling. Canvases are math space and stay LTR (x to the
 * right, y up); sliders for math quantities are `dir="ltr"`. Nothing moves by itself (no animation), so there is no
 * motion for motionAllowed() to gate.
 *
 * mode 'sketch': a preset f (registry SK) with layers the learner switches on one by one, in this order:
 *                `domain`  thick segments on the x-axis, a finite end filled when included and hollow when excluded;
 *                `asym`    vertical asymptotes and the lines at ±∞, dashed, labelled (and the gap f(x) − (mx + b) at
 *                          the probe in the readout);
 *                `mono`    a strip under the plot: the sign of f′ and ↗ / ↘ on each interval, 0 at a zero of f′, a
 *                          dashed divider at a break of the domain;
 *                `conc`    a second strip: the sign of f″ and ∪ / ∩;
 *                `points`  the critical points (local max ▲, local min ▼, f′ = 0 without an extremum ◆) and the
 *                          inflection points ● (shape, not colour only), with their exact coordinates; a point that
 *                          is both (x⁴ − 4x³ at 0) is a larger ◆ with a ● inside, and the readout lists it twice;
 *                `graph`   the curve (off: the learner predicts it from the layers). The vertical asymptote of
 *                          `oblique` is never crossed by the curve (each piece of the domain is drawn on its own, far
 *                          values clipped); `xlnx` has a hollow end point at (0, 0).
 *                A probe x (drag the canvas, arrow keys, or the slider; it snaps to the listed points) with its
 *                tangent line and the readout f(x), f′(x), f″(x) (and "לא מוגדרת" outside the domain); its handle on
 *                the bottom edge is a short vertical tick (▲ is a maximum). Asymptote labels sit on a paper plate on
 *                the side of the line away from the curve, drawn after the curve and the tangent; labels near the
 *                top right stay clear of SimShell's ↺ / ⛶ buttons (TOOLS_W, TOOLS_H).
 * mode 'local':  a local preset (registry LOCAL) about its point a. The plot is the residual r(x) = f(x) − f(a), or
 *                with `tangent` r(x) = f(x) − [f(a) + f′(a)(x − a)], against x − a, at zoom z (1…1000, a log slider):
 *                the x-window shrinks by z and the y-window by zᵏ (k the order of the leading term), so the shape stays
 *                visible; the readout states the scaling. The leading term c(x − a)ᵏ is dashed (accent) over the curve;
 *                the readout gives k, c, the next term, and the verdict ("k זוגי, מקדם חיובי: מינימום מקומי", "k זוגי,
 *                מקדם שלילי: מקסימום מקומי", "k אי-זוגי: אין קיצון, הגרף חוצה"). With the tangent subtracted and
 *                f′(a) ≠ 0 (sin-pi) the verdict is about the tangent (above / below / crosses it: an inflection point);
 *                for the other presets the tangent at a is horizontal, so subtracting it changes nothing, and the
 *                readout says so.
 *
 * Props (defaults): id (required); mode ('sketch'); modes (the mode buttons shown; default the starting mode only);
 * tasks ([]). f (a sketch id goes to the sketch mode, a local id to the local mode; defaults 'cubic' and 'ex1x');
 * domain, asym, mono, conc, points (false); graph (true); x (the preset's starting probe: cubic 2, quartic 4,
 * oblique 5, gauss 2, xlnx 2, lorentz 2; clamped to the window); zoom (1; 1…1000); tangent (false).
 * Every prop is also a step key (`<Step fig=… set={{…}}>`); a key left out keeps its value; a new sketch `f` without `x`
 * puts the probe at that preset's starting x. A state set by a step never ticks a task, and a state that already had a
 * task's property when a step or reset made it must be left and found again.
 * The learner can also pick the function from a list (select "הפונקציה": the presets of the current mode).
 *
 * Tasks (ticked only inside the learner's own drag, key, slider, select or toggle):
 *   sketch: sketch-max (probe within 0.05 of a local maximum), sketch-inflect (probe within 0.05 of an inflection
 *           point), sketch-flat (preset quartic, probe within 0.05 of 0), sketch-asym (preset oblique, asym on, |x| ≥ 8
 *           and |f(x) − (x + 2)| < 0.15: from x ≈ 8.67 on the right, every x ≤ −8 on the left; at x = 8 the gap is 1/6)
 *   local:  local-zoom (zoom ≥ 100), local-flat-max (preset cos4, zoom ≥ 10 set by the learner), local-tangent
 *           (preset sin-pi, tangent turned on by the learner)
 *
 * Hooks for e2e specs (inside `#<id>`; numbers use U+2212 for minus):
 *   buttons by role and name: the mode buttons "שרטוט גרף", "מבט מקרוב"; the layer toggles "תחום הגדרה",
 *     "אסימפטוטות", "עלייה וירידה", "קמירות", "נקודות מיוחדות", "הגרף"; the toggle "הפחתת המשיק"; "איפוס" (reset).
 *   [data-control="preset"] select   the function (option values are the preset ids)
 *   [data-control="x"] input         the probe slider (sketch; value = x, step 0.01)
 *   [data-control="zoom"] input      the zoom slider (local; value = log10 of the zoom, 0…3, step 0.05: 2 is ×100)
 *   canvas                           drag in sketch mode moves the probe; ←/→ move it; in local mode ↑/↓ zoom
 *   [data-readout=…]                 sketch: fn, x, fx, f1x, f2x; with domain: domain; with asym: asym (and gap
 *                                    when the preset has a line at ±∞ and x is in the domain); with mono: mono;
 *                                    with conc: conc; with points: points
 *                                    local: fn, zoom, residual, order ("k = 4"), coef ("c = −1/24"), lead, next,
 *                                    verdict, note (only when there is something to add)
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import {
  LOCAL,
  LOCAL_IDS,
  SK,
  SKETCH_IDS,
  asymGap,
  asymLineAt,
  inDomain,
  isLocalId,
  isSketchId,
  localTerms,
  localWindow,
  pieceAt,
  verdictOf,
  type LocalId,
  type SignPiece,
  type SketchId,
  type SketchSpec,
  type Val,
} from '~/math/sketch';
import { markTask } from '~/progress/store';
import { subscribeSteps, type StepState } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { sci, superscript } from './core/format';
import { withAlpha } from './core/ink';
import { drawAxes, insetBox, makePlot, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import './SketchLab.css';

export type SketchMode = 'sketch' | 'local';

export interface SketchLabProps {
  id: string;
  mode?: SketchMode;
  /** the mode buttons shown (default: the starting mode only) */
  modes?: SketchMode[];
  /** a sketch preset id or a local preset id */
  f?: string;
  domain?: boolean;
  asym?: boolean;
  mono?: boolean;
  conc?: boolean;
  points?: boolean;
  graph?: boolean;
  x?: number;
  zoom?: number;
  tangent?: boolean;
  tasks?: string[];
}

interface Setup {
  mode: SketchMode;
  pS: SketchId;
  pL: LocalId;
  domain: boolean;
  asym: boolean;
  mono: boolean;
  conc: boolean;
  points: boolean;
  graph: boolean;
  x: number;
  zoom: number;
  tangent: boolean;
}

const ltr = (s: string) => String.fromCharCode(0x2066) + s.replace(/ /g, String.fromCharCode(0xa0)) + String.fromCharCode(0x2069);

const TASK_LABEL: Record<string, string> = {
  'sketch-max': 'גררו את הנקודה x אל מקסימום מקומי. מה השיפוע של המשיק שם?',
  'sketch-inflect': `גררו את x אל נקודת פיתול. מה קורה שם לסימן של ${ltr('f″')}?`,
  'sketch-flat': `בפונקציה ${ltr('x⁴ − 4x³')} גררו את x אל 0. המשיק אופקי, אבל האם יש שם קיצון?`,
  'sketch-asym': `בפונקציה ${ltr('(x² − 3)/(x − 2)')}, עם האסימפטוטות, גררו את x רחוק (${ltr('|x| ≥ 8')}) עד שהמרחק מהישר ${ltr('y = x + 2')} קטן מ-${ltr('0.15')}.`,
  'local-zoom': 'הגדילו פי 100 או יותר. האם הצורה של הגרף משתנה?',
  'local-flat-max': `בפונקציה ${ltr('1 − cos x − x²/2')} הגדילו סביב 0. מה הסימן של r משני הצדדים, אף ש-${ltr('f″(0) = 0')}?`,
  'local-tangent': `בפונקציה ${ltr('sin x')} ליד π הדליקו "הפחתת המשיק". מה הסדר k עכשיו?`,
};

const MODE_LABEL: Record<SketchMode, string> = { sketch: 'שרטוט גרף', local: 'מבט מקרוב' };

const TAU = 2 * Math.PI;
/** SimShell's reset and full-screen buttons cover the canvas's top-right 82 × 42 px: a label's right end stays this far
 * left of the plot box's right edge (padding 14 + 84 > 82), or below TOOLS_H */
const TOOLS_W = 84;
const TOOLS_H = 42;
const Z_MAX = 3;
const Z_STEP = 0.05;
const TASK_TOL = 0.05;
const STRIP_H = 22;
const STRIP_GAP = 6;
/** the strips start this far below the plot box (under the tick numbers and the axis title) */
const STRIP_TOP = 42;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const bool = (x: unknown): boolean | null => (typeof x === 'boolean' ? x : null);
const roundTo = (x: number, step: number) => Number((Math.round(x / step) * step).toPrecision(10));
const minus = (s: string) => s.replace(/-/g, '−');
/** a value at the probe: rounding noise below 1e-9 reads as 0 */
const fmt = (x: number, sig = 4) => (Number.isNaN(x) ? '—' : Math.abs(x) < 1e-9 ? '0' : minus(sci(x, sig)));
/** a value of the local view: tiny numbers are the point, never rounded to 0 */
const fmtTiny = (x: number, sig = 3) => (Number.isNaN(x) ? '—' : minus(sci(x, sig)));
const zoomOf = (e: number) => 10 ** e;
const eOfZoom = (z: number) => Math.log10(z);
const clampZoom = (z: number) => clamp(z, 1, 10 ** Z_MAX);
const fmtZoom = (z: number) => {
  const r = Math.round(z);
  return Math.abs(z - r) < 1e-9 * z ? String(r) : z < 10 ? z.toFixed(2) : String(Math.round(z));
};
/** 10ⁿ for a whole power, else a number */
const fmtPow = (v: number) => {
  const e = Math.log10(v);
  return Math.abs(e - Math.round(e)) < 1e-9 ? `10${superscript(Math.round(e))}` : minus(sci(v, 3));
};

const clampX = (id: SketchId, x: number) => clamp(x, SK[id].window.x[0], SK[id].window.x[1]);
/** the listed x values the probe snaps to */
const specials = (s: SketchSpec): Val[] => [...s.crit.map((c) => c.x), ...s.infl.map((p) => p.x), ...s.holes.map((h) => h.x)];
function snapX(id: SketchId, x: number, tol: number): number {
  let best = x;
  let d = tol;
  for (const v of specials(SK[id])) {
    if (Math.abs(x - v.v) <= d) {
      best = v.v;
      d = Math.abs(x - v.v);
    }
  }
  return best;
}
const specialAt = (id: SketchId, x: number): Val | null => specials(SK[id]).find((v) => Math.abs(v.v - x) < 1e-12) ?? null;

/* ---- tasks: `needs` = the learner's change must touch one of these keys; `event` tasks tick on the learner's act, the
 * others must be left and found again after a step or reset made the state */
interface Rule {
  needs: (keyof Setup)[];
  event?: boolean;
  state: (s: Setup, patch: Partial<Setup>) => boolean;
}
const RULES: Record<string, Rule> = {
  'sketch-max': { needs: ['x'], state: (s) => s.mode === 'sketch' && SK[s.pS].crit.some((c) => c.kind === 'max' && Math.abs(s.x - c.x.v) <= TASK_TOL + 1e-9) },
  'sketch-inflect': { needs: ['x'], state: (s) => s.mode === 'sketch' && SK[s.pS].infl.some((p) => Math.abs(s.x - p.x.v) <= TASK_TOL + 1e-9) },
  'sketch-flat': { needs: ['x'], state: (s) => s.mode === 'sketch' && s.pS === 'quartic' && Math.abs(s.x) <= TASK_TOL + 1e-9 },
  'sketch-asym': {
    needs: ['x', 'asym'],
    state: (s) => s.mode === 'sketch' && s.pS === 'oblique' && s.asym && Math.abs(s.x) >= 8 - 1e-9 && Math.abs(asymGap('oblique', s.x)) < 0.15,
  },
  'local-zoom': { needs: ['zoom'], state: (s) => s.mode === 'local' && s.zoom >= 100 * (1 - 1e-9) },
  'local-flat-max': { needs: ['zoom'], state: (s) => s.mode === 'local' && s.pL === 'cos4' && s.zoom >= 10 * (1 - 1e-9) },
  'local-tangent': { needs: ['tangent'], event: true, state: (s, p) => s.mode === 'local' && s.pL === 'sin-pi' && s.tangent && p.tangent === true },
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
/** a filled mark (shape: circle) */
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
/** ▲ (up) or ▼ (down), centred on the point */
function triangle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, up: boolean, color: string, paper: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = paper;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y + (up ? -r : r) * 1.15);
  ctx.lineTo(x - r, y + (up ? r : -r) * 0.75);
  ctx.lineTo(x + r, y + (up ? r : -r) * 0.75);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
/** a label on a paper plate (a filled rounded box behind the text): lines may cross the spot, the letters stay clear */
function plate(ctx: CanvasRenderingContext2D, p: Palette, s: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign) {
  ctx.save();
  ctx.direction = 'ltr';
  ctx.font = font;
  const w = ctx.measureText(s).width;
  const h = 16;
  const x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  ctx.fillStyle = withAlpha(p.paper, 0.92);
  ctx.strokeStyle = withAlpha(p.limit, 0.5);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x0 - 4, y - h / 2, w + 8, h, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
  ctx.restore();
}
/** ◆ */
function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, paper: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = paper;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.2);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r * 1.2);
  ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** x samples of [lo, hi], dense towards an end that is a pole (quadratic spacing), never touching it */
function samples(lo: number, hi: number, poleLo: boolean, poleHi: boolean, n: number): number[] {
  const xs: number[] = [];
  const eps = (hi - lo) * 1e-9;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let x = poleLo && !poleHi ? lo + (hi - lo) * t * t : poleHi && !poleLo ? hi - (hi - lo) * (1 - t) * (1 - t) : lo + (hi - lo) * t;
    if (i === 0 && poleLo) x = lo + eps;
    if (i === n && poleHi) x = hi - eps;
    xs.push(x);
  }
  return xs;
}

/** a function on [lo, hi] (one piece of the domain), clipped to the plot; far values are clamped so a pole is a steep
 * stroke off the box, and two pieces are never joined */
function strokePiece(ctx: CanvasRenderingContext2D, plot: Plot, f: (x: number) => number, lo: number, hi: number, poleLo: boolean, poleHi: boolean, color: string, width: number, dash: number[] = []) {
  if (!(hi > lo)) return;
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
  ctx.beginPath();
  let started = false;
  for (const x of samples(lo, hi, poleLo, poleHi, 600)) {
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
  ctx.restore();
}

/** the line y = m x + b across [xa, xb], clipped to the plot */
function strokeLine(ctx: CanvasRenderingContext2D, plot: Plot, m: number, b: number, xa: number, xb: number, color: string, width: number, dash: number[] = []) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.box.x, plot.box.y, plot.box.w, plot.box.h);
  ctx.clip();
  line(ctx, plot.px(xa), plot.py(m * xa + b), plot.px(xb), plot.py(m * xb + b), color, width, dash);
  ctx.restore();
}

/** merge neighbouring pieces of one sign when the point between them is in the domain (x⁴ − 4x³ falls on (−∞, 3)) */
function merged(id: SketchId, pieces: SignPiece[], sign: 1 | -1): [Val, Val][] {
  const out: [Val, Val][] = [];
  for (let i = 0; i < pieces.length; i++) {
    const pc = pieces[i];
    if (pc.sign !== sign) continue;
    const last = out[out.length - 1];
    if (last && i > 0 && pieces[i - 1].sign === sign && last[1].v === pc.lo.v && inDomain(id, pc.lo.v)) last[1] = pc.hi;
    else out.push([pc.lo, pc.hi]);
  }
  return out;
}
const ivText = ([lo, hi]: [Val, Val]) => `(${lo.text}, ${hi.text})`;
const ptText = (x: Val, y: Val) => `(${x.text}, ${y.text})`;
/** "f(x) − (x + 2)" for y = x + 2, "f(x) − 0" for y = 0 */
const gapLhs = (lineText: string) => {
  const rhs = lineText.replace(/^y = /, '');
  return rhs.includes(' ') ? `f(x) − (${rhs})` : `f(x) − ${rhs}`;
};
function domainText(s: SketchSpec): string {
  return s.domain
    .map((d) => `${d.loClosed ? '[' : '('}${d.lo.text}, ${d.hi.text}${d.hiClosed ? ']' : ')'}`)
    .join(' ∪ ');
}

export default function SketchLab(props: SketchLabProps) {
  const startMode: SketchMode = props.mode ?? 'sketch';
  const modes: SketchMode[] = props.modes ?? [startMode];
  const initial = (): Setup => {
    const pS: SketchId = isSketchId(props.f) ? props.f : 'cubic';
    const pL: LocalId = isLocalId(props.f) ? props.f : 'ex1x';
    return {
      mode: startMode,
      pS,
      pL,
      domain: props.domain ?? false,
      asym: props.asym ?? false,
      mono: props.mono ?? false,
      conc: props.conc ?? false,
      points: props.points ?? false,
      graph: props.graph ?? true,
      x: clampX(pS, props.x ?? SK[pS].x0),
      zoom: clampZoom(props.zoom ?? 1),
      tangent: props.tangent ?? false,
    };
  };
  const [setup, setSetup] = useState<Setup>(initial);
  const cur = useRef(setup);
  const [live, setLive] = useState('');
  const [narrow, setNarrow] = useState(false);
  const plotRef = useRef<Plot | null>(null);
  const dragging = useRef(false);
  /** tasks whose state held when the last step or reset made it: they must be left and found again */
  const held = useRef<Set<string>>(new Set());

  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const done = (t: string) => {
    if (props.tasks?.includes(t)) markTask(`${props.id}:${t}`);
  };
  const rebase = (s: Setup) => {
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
        const mode = typeof st.mode === 'string' && modes.includes(st.mode as SketchMode) ? (st.mode as SketchMode) : prev.mode;
        const next: Setup = { ...prev, mode };
        const newS = isSketchId(st.f) && st.f !== prev.pS;
        if (isSketchId(st.f)) next.pS = st.f;
        if (isLocalId(st.f)) next.pL = st.f;
        next.domain = bool(st.domain) ?? prev.domain;
        next.asym = bool(st.asym) ?? prev.asym;
        next.mono = bool(st.mono) ?? prev.mono;
        next.conc = bool(st.conc) ?? prev.conc;
        next.points = bool(st.points) ?? prev.points;
        next.graph = bool(st.graph) ?? prev.graph;
        next.x = clampX(next.pS, num(st.x) ?? (newS ? SK[next.pS].x0 : prev.x));
        next.zoom = clampZoom(num(st.zoom) ?? prev.zoom);
        next.tangent = bool(st.tangent) ?? prev.tangent;
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

    if (s0.mode === 'sketch') {
      const sp = SK[s0.pS];
      const win = sp.window;
      const stripsH = STRIP_TOP + 2 * STRIP_H + STRIP_GAP + 6;
      const box = insetBox({ x: 0, y: 0, w: view.w, h: view.h }, { l: 46, r: 14, t: 16, b: stripsH });
      const plot = makePlot(box, { min: win.x[0], max: win.x[1], label: 'x' }, { min: win.y[0], max: win.y[1], label: 'y' });
      plotRef.current = plot;
      drawAxes(ctx, plot, p);
      const PX = plot.px;
      const PY = plot.py;
      const inBoxY = (sy: number) => sy >= box.y - 1 && sy <= box.y + box.h + 1;
      const inBoxX = (sx: number) => sx >= box.x - 1 && sx <= box.x + box.w + 1;
      // the coordinate axes
      if (win.y[0] < 0 && win.y[1] > 0) line(ctx, box.x, PY(0), box.x + box.w, PY(0), withAlpha(p.ink2, 0.7), 1.2);
      if (win.x[0] < 0 && win.x[1] > 0) line(ctx, PX(0), box.y, PX(0), box.y + box.h, withAlpha(p.ink2, 0.7), 1.2);

      // domain: thick segments on the x-axis, finite ends filled (included) or hollow (excluded)
      if (s0.domain) {
        const ay = clamp(PY(0), box.y, box.y + box.h);
        ctx.save();
        ctx.beginPath();
        ctx.rect(box.x, box.y, box.w, box.h);
        ctx.clip();
        ctx.strokeStyle = withAlpha(p.delta, 0.85);
        ctx.lineWidth = 6;
        for (const d of sp.domain) {
          const lo = clamp(d.lo.v, win.x[0], win.x[1]);
          const hi = clamp(d.hi.v, win.x[0], win.x[1]);
          if (!(hi > lo)) continue;
          ctx.beginPath();
          ctx.moveTo(PX(lo), ay);
          ctx.lineTo(PX(hi), ay);
          ctx.stroke();
        }
        ctx.restore();
        for (const d of sp.domain) {
          for (const [v, closed] of [
            [d.lo.v, d.loClosed],
            [d.hi.v, d.hiClosed],
          ] as const) {
            if (!Number.isFinite(v) || v < win.x[0] || v > win.x[1]) continue;
            if (closed) dot(ctx, PX(v), ay, 5, p.delta, p.paper);
            else ring(ctx, PX(v), ay, 5, p.delta, p.paper);
          }
        }
      }

      // asymptotes: dashed, in the limit colour; their labels are drawn last, on a paper plate (`plates`), so neither
      // the curve nor the probe's tangent runs through the letters
      const plates: [string, number, number, CanvasTextAlign][] = [];
      if (s0.asym) {
        for (const v of sp.vertical) {
          if (v.v < win.x[0] || v.v > win.x[1]) continue;
          line(ctx, PX(v.v), box.y, PX(v.v), box.y + box.h, p.limit, 1.6, [6, 5]);
          // at the top, on a side where the curve does not run up along the asymptote
          const d = 1e-6 * (win.x[1] - win.x[0]);
          const upRight = sp.f(v.v + d) > win.y[1];
          const upLeft = sp.f(v.v - d) > win.y[1];
          if (upRight && !upLeft) plates.push([`x = ${v.text}`, PX(v.v) - 6, box.y + 12, 'right']);
          else plates.push([`x = ${v.text}`, PX(v.v) + 6, box.y + 12, 'left']);
        }
        const { left, right } = sp.atInf;
        const mid = (win.x[0] + win.x[1]) / 2;
        const lines: [NonNullable<typeof left>, number, number][] = [];
        if (left && right && left.m === right.m && left.b === right.b) lines.push([left, win.x[0], win.x[1]]);
        else {
          if (left) lines.push([left, win.x[0], mid]);
          if (right) lines.push([right, mid, win.x[1]]);
        }
        for (const [l, xa, xb] of lines) {
          strokeLine(ctx, plot, l.m, l.b, xa, xb, p.limit, 1.6, [6, 5]);
          // the label near the right end of the line, inside the box
          let lx = xb - (win.x[1] - win.x[0]) * 0.03;
          let ly = l.m * lx + l.b;
          if (!inBoxY(PY(ly))) {
            const yEdge = l.m > 0 ? win.y[1] : win.y[0];
            lx = l.m !== 0 ? (yEdge - l.b) / l.m : lx;
            ly = yEdge;
          }
          // on the side of the line away from the curve there (the curve approaches it from one side)
          const gap = sp.f(lx) - (l.m * lx + l.b);
          const below = Number.isFinite(gap) ? gap > 0 : l.m > 0;
          let ty = clamp(PY(ly) + (below ? 14 : -12), box.y + 10, box.y + box.h - 10);
          // clear of the ↺ / ⛶ buttons in the canvas's top-right corner (82 × 42 px)
          if (PX(lx) - 4 > view.w - TOOLS_W && ty < TOOLS_H + 8) ty = TOOLS_H + 8;
          plates.push([l.text, PX(lx) - 4, ty, 'right']);
        }
      }

      // the graph: each piece of the domain on its own, never joined across a break
      if (s0.graph) {
        const poles = new Set(sp.vertical.map((v) => v.v));
        for (const d of sp.domain) {
          const lo = Math.max(d.lo.v, win.x[0]);
          const hi = Math.min(d.hi.v, win.x[1]);
          strokePiece(ctx, plot, sp.f, lo, hi, lo === d.lo.v && (poles.has(lo) || !d.loClosed), hi === d.hi.v && (poles.has(hi) || !d.hiClosed), p.curve, 2.6);
        }
        for (const h of sp.holes) {
          const sx = PX(h.x.v);
          const sy = PY(h.y.v);
          if (inBoxX(sx) && inBoxY(sy)) ring(ctx, sx, sy, 5.5, p.curve, p.paper);
        }
      }

      // the probe: its tangent line and the point, or a dashed line where f is undefined
      const xp = s0.x;
      if (inDomain(s0.pS, xp)) {
        const y = sp.f(xp);
        const m = sp.f1(xp);
        if (s0.graph) {
          strokeLine(ctx, plot, m, y - m * xp, win.x[0], win.x[1], withAlpha(p.accent, 0.9), 1.6);
          if (inBoxY(PY(y))) {
            line(ctx, PX(xp), box.y + box.h, PX(xp), PY(y), withAlpha(p.accent, 0.55), 1.1, [3, 4]);
            dot(ctx, PX(xp), PY(y), 5.5, p.accent, p.paper);
          }
        } else line(ctx, PX(xp), box.y, PX(xp), box.y + box.h, withAlpha(p.accent, 0.7), 1.3, [3, 4]);
      } else {
        line(ctx, PX(xp), box.y, PX(xp), box.y + box.h, withAlpha(p.pointOut, 0.9), 1.4, [3, 4]);
        haloText(ctx, p, 'לא מוגדרת', PX(xp), box.y + box.h - 14, { font: font(700), color: p.pointOut });
      }
      // the probe's handle: a short thick vertical tick standing on the bottom edge of the box (not a ▲, which marks a
      // local maximum)
      ctx.save();
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(PX(xp), box.y + box.h - 13);
      ctx.lineTo(PX(xp), box.y + box.h - 2);
      ctx.stroke();
      ctx.restore();

      // the special points, by shape: max ▲, min ▼, flat ◆, inflection ●; a flat point that is also an inflection point
      // (x⁴ − 4x³ at 0) gets both: a larger ◆ with a ● inside it, ringed in paper so the two shapes stay apart
      if (s0.points) {
        const labels: [string, number, number, number][] = [];
        const alsoInfl = (x: number) => sp.infl.some((q) => q.x.v === x);
        for (const c of sp.crit) {
          const sx = PX(c.x.v);
          const sy = PY(c.y.v);
          if (!inBoxX(sx) || !inBoxY(sy)) continue;
          if (c.kind === 'max') triangle(ctx, sx, sy, 7, true, p.equip, p.paper);
          else if (c.kind === 'min') triangle(ctx, sx, sy, 7, false, p.equip, p.paper);
          else if (alsoInfl(c.x.v)) {
            diamond(ctx, sx, sy, 9.5, p.equip, p.paper);
            ctx.save();
            ctx.fillStyle = p.paper;
            ctx.beginPath();
            ctx.arc(sx, sy, 5.4, 0, TAU);
            ctx.fill();
            ctx.fillStyle = p.equip;
            ctx.beginPath();
            ctx.arc(sx, sy, 3.6, 0, TAU);
            ctx.fill();
            ctx.restore();
          } else diamond(ctx, sx, sy, 6.5, p.equip, p.paper);
          labels.push([ptText(c.x, c.y), sx, sy, c.kind === 'min' ? 1 : -1]);
        }
        for (const q of sp.infl) {
          const sx = PX(q.x.v);
          const sy = PY(q.y.v);
          if (!inBoxX(sx) || !inBoxY(sy)) continue;
          // where it is also a critical point, the mark above already holds the ●
          if (sp.crit.some((c) => c.x.v === q.x.v)) continue;
          dot(ctx, sx, sy, 6, p.equip, p.paper);
          labels.push([ptText(q.x, q.y), sx, sy, -1]);
        }
        if (!nar) for (const [t, sx, sy, dir] of labels) haloText(ctx, p, t, sx + 8, clamp(sy + dir * 16, box.y + 9, box.y + box.h - 9), { font: font(600, fs - 1), color: p.ink2, align: 'left' });
      }

      for (const [t, x, y, align] of plates) plate(ctx, p, t, x, y, font(700), p.limit, align);

      // the two strips: the sign of f′ and of f″, from the stored intervals
      const strip = (row: number, on: boolean, pieces: SignPiece[], zeros: number[], name: string, sym: [string, string]) => {
        const top = box.y + box.h + STRIP_TOP + row * (STRIP_H + STRIP_GAP);
        const mid = top + STRIP_H / 2;
        ctx.save();
        ctx.strokeStyle = p.rule;
        ctx.lineWidth = 1;
        ctx.strokeRect(box.x, top, box.w, STRIP_H);
        ctx.restore();
        haloText(ctx, p, name, box.x - 8, mid, { font: font(700), color: on ? p.ink : p.ink3, align: 'right' });
        if (!on) return;
        // where f is undefined: shaded, nothing written
        ctx.save();
        ctx.fillStyle = withAlpha(p.ink3, 0.18);
        let from = win.x[0];
        for (const d of [...sp.domain, { lo: { v: Infinity }, hi: { v: Infinity } }]) {
          const a = Math.max(from, win.x[0]);
          const b = Math.min(d.lo.v, win.x[1]);
          if (b > a) ctx.fillRect(PX(a), top, PX(b) - PX(a), STRIP_H);
          from = d.hi.v;
        }
        ctx.restore();
        for (const pc of pieces) {
          const a = Math.max(pc.lo.v, win.x[0]);
          const b = Math.min(pc.hi.v, win.x[1]);
          if (!(b > a)) continue;
          const sa = PX(a);
          const sb = PX(b);
          ctx.save();
          ctx.fillStyle = withAlpha(pc.sign > 0 ? p.pointIn : p.pointOut, 0.14);
          ctx.fillRect(sa, top, sb - sa, STRIP_H);
          ctx.restore();
          const w = sb - sa;
          const label = w >= 36 ? `${pc.sign > 0 ? '+' : '−'} ${pc.sign > 0 ? sym[0] : sym[1]}` : w >= 14 ? (pc.sign > 0 ? sym[0] : sym[1]) : '';
          if (label) haloText(ctx, p, label, (sa + sb) / 2, mid + 1, { font: font(700, fs + 1), color: p.ink });
        }
        // boundaries: a zero (solid, "0") or a break of the domain (dashed)
        for (let i = 1; i < pieces.length; i++) {
          const v = pieces[i].lo.v;
          if (v <= win.x[0] || v >= win.x[1]) continue;
          const sx = PX(v);
          if (zeros.includes(v)) {
            line(ctx, sx, top, sx, top + STRIP_H, p.ink2, 1.4);
            haloText(ctx, p, '0', sx, mid, { font: font(700, fs - 1), color: p.ink });
          } else line(ctx, sx, top, sx, top + STRIP_H, p.ink2, 1.2, [3, 3]);
        }
        // the probe's column
        line(ctx, PX(xp), top, PX(xp), top + STRIP_H, withAlpha(p.accent, 0.8), 1.2);
      };
      strip(0, s0.mono, sp.mono, sp.crit.map((c) => c.x.v), 'f′', ['↗', '↘']);
      strip(1, s0.conc, sp.conc, sp.infl.map((q) => q.x.v), 'f″', ['∪', '∩']);
      return;
    }

    // local mode: the residual against x − a, the window shrinking by z in x and by zᵏ in y
    const { lead, r } = localTerms(s0.pL, s0.tangent);
    const W = localWindow(s0.pL, s0.tangent, s0.zoom);
    const box = insetBox({ x: 0, y: 0, w: view.w, h: view.h }, { l: 66, r: 14, t: nar ? 34 : 16, b: 40 });
    const plot = makePlot(box, { min: -W.w, max: W.w, label: 'x − a' }, { min: -W.h, max: W.h, label: 'r' });
    plotRef.current = plot;
    drawAxes(ctx, plot, p);
    const PX = plot.px;
    const PY = plot.py;
    line(ctx, box.x, PY(0), box.x + box.w, PY(0), withAlpha(p.ink2, 0.7), 1.2);
    line(ctx, PX(0), box.y, PX(0), box.y + box.h, withAlpha(p.ink2, 0.7), 1.2);
    strokePiece(ctx, plot, (h) => lead.c.v * h ** lead.k, -W.w, W.w, false, false, p.accent, 2, [7, 5]);
    strokePiece(ctx, plot, r, -W.w, W.w, false, false, p.curve, 2.6);
    dot(ctx, PX(0), PY(0), 5.5, p.curve, p.paper);
    // left of the ↺ / ⛶ buttons in the top-right corner
    haloText(ctx, p, `×${fmtZoom(s0.zoom)}`, box.x + box.w - TOOLS_W, box.y + 12, { font: font(700, fs + 1), color: p.ink, align: 'right' });
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
  const aspect = setup.mode === 'sketch' ? (narrow ? 0.8 : 1.25) : narrow ? 0.95 : 1.45;

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

  const setX = (x: number, tol: number) => {
    const c = cur.current;
    const nx = snapX(c.pS, clampX(c.pS, roundTo(x, 0.01)), tol);
    if (nx !== c.x) apply({ x: nx });
  };
  const setZoomE = (e: number) => apply({ zoom: clampZoom(zoomOf(clamp(roundTo(e, Z_STEP), 0, Z_MAX))) });

  const fromPointer = (e: PointerEvent) => {
    const plot = plotRef.current;
    const c = cur.current;
    if (!plot || c.mode !== 'sketch') return;
    const x = plot.x.min + ((e.offsetX - plot.box.x) / plot.box.w) * (plot.x.max - plot.x.min);
    setX(x, 0.008 * (plot.x.max - plot.x.min));
  };
  const onPointerDown = (e: PointerEvent) => {
    if (cur.current.mode !== 'sketch') return;
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
    if (c.mode === 'sketch' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      const w = SK[c.pS].window.x;
      const step = Math.max(0.01, roundTo((w[1] - w[0]) / 150, 0.01));
      setX(c.x + (e.key === 'ArrowLeft' ? -step : step), step / 2);
      setLive(describe(cur.current));
    } else if (c.mode === 'local' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      setZoomE(eOfZoom(c.zoom) + (e.key === 'ArrowUp' ? 0.25 : -0.25));
      setLive(describe(cur.current));
    }
  };

  /* ---------------------------------------------------------------- text */
  const M = (q: { children: ComponentChildren }) => <bdi dir="ltr">{q.children}</bdi>;
  const spS = SK[setup.pS];
  const spL = LOCAL[setup.pL];

  function describe(s: Setup): string {
    if (s.mode === 'sketch') {
      const sp = SK[s.pS];
      if (!inDomain(s.pS, s.x)) return `x = ${fmt(s.x, 3)}: הפונקציה לא מוגדרת שם.`;
      return `x = ${fmt(s.x, 3)}: f(x) = ${fmt(sp.f(s.x))}, f′(x) = ${fmt(sp.f1(s.x))}, f″(x) = ${fmt(sp.f2(s.x))}.`;
    }
    const { lead } = localTerms(s.pL, s.tangent);
    return `הגדלה פי ${fmtZoom(s.zoom)}. האיבר המוביל ${lead.text}, k = ${lead.k}.`;
  }

  const label =
    setup.mode === 'sketch'
      ? `איור חי: הגרף של ${spS.text} עם שכבות שמדליקים אחת אחת: תחום ההגדרה, אסימפטוטות, רצועה של הסימן של f′ (עולה או יורדת), רצועה של הסימן של f″ (קמורה או קעורה), והנקודות המיוחדות: מקסימום מקומי במשולש כלפי מעלה, מינימום מקומי במשולש כלפי מטה, נקודה עם f′ = 0 בלי קיצון במעוין, נקודת פיתול בעיגול, ונקודה שהיא גם זו וגם זו במעוין ובתוכו עיגול. נקודה x נגררת עם המשיק שלה.`
      : `איור חי: ${spL.text} ליד a = ${spL.a.text}, בהגדלה פי ${fmtZoom(setup.zoom)}. העקומה היא ההפרש r, והאיבר המוביל שלו מקווקו.`;

  let readout: ComponentChildren;
  if (setup.mode === 'sketch') {
    const x = setup.x;
    const inD = inDomain(setup.pS, x);
    const sv = specialAt(setup.pS, x);
    const xText = sv ? (/^−?\d+$/.test(sv.text) ? sv.text : `${sv.text} ≈ ${fmt(x, 4)}`) : fmt(x, 3);
    const isInfl = spS.infl.some((q) => q.x.v === x);
    const pm = pieceAt(spS.mono, x);
    const pc = pieceAt(spS.conc, x);
    const f1Word = !inD ? '' : pm ? (pm.sign > 0 ? 'חיובית: הפונקציה עולה כאן' : 'שלילית: הפונקציה יורדת כאן') : 'אפס: המשיק אופקי';
    const f2Word = !inD ? '' : pc ? (pc.sign > 0 ? 'חיובית: הגרף קמור כאן (פתוח כלפי מעלה)' : 'שלילית: הגרף קעור כאן (פתוח כלפי מטה)') : isInfl ? 'אפס, והסימן מתחלף כאן: נקודת פיתול' : 'אפס';
    const lineHere = asymLineAt(setup.pS, x);
    const { left, right } = spS.atInf;
    const asymParts: string[] = [];
    for (const v of spS.vertical) asymParts.push(`אנכית ${ltr(`x = ${v.text}`)}`);
    if (left && right && left.text === right.text) asymParts.push(`${left.m === 0 ? 'אופקית' : 'משופעת'} ${ltr(left.text)} כש-${ltr('x → ±∞')}`);
    else {
      if (left) asymParts.push(`${left.m === 0 ? 'אופקית' : 'משופעת'} ${ltr(left.text)} כש-${ltr('x → −∞')}`);
      if (right) asymParts.push(`${right.m === 0 ? 'אופקית' : 'משופעת'} ${ltr(right.text)} כש-${ltr('x → ∞')}`);
    }
    const listIv = (ivs: [Val, Val][]) => (ivs.length ? ltr(ivs.map(ivText).join(', ')) : 'אין');
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>f(x) = {spS.text}</M>
        </span>
        <span class="q" data-readout="x">
          <M>
            x = <b>{xText}</b>
          </M>
        </span>
        {inD ? (
          <>
            <span class="q" data-readout="fx">
              <M>
                f(x) = <b>{fmt(spS.f(x))}</b>
              </M>
            </span>
            <span class="q" data-readout="f1x">
              <M>
                f′(x) = <b>{fmt(spS.f1(x))}</b>
              </M>
              , {f1Word}
            </span>
            <span class="q" data-readout="f2x">
              <M>
                f″(x) = <b>{fmt(spS.f2(x))}</b>
              </M>
              , {f2Word}
            </span>
          </>
        ) : (
          <span class="q" data-readout="fx">
            <b>x לא בתחום ההגדרה: הפונקציה לא מוגדרת שם.</b>
          </span>
        )}
        {setup.domain && (
          <span class="q" data-readout="domain">
            תחום ההגדרה: <M>{domainText(spS)}</M>
          </span>
        )}
        {setup.asym && (
          <span class="q" data-readout="asym">
            {asymParts.length ? `אסימפטוטות: ${asymParts.join('; ')}.` : (spS.note ?? 'אין אסימפטוטות: כש-x שואף ל-±∞ הערכים גדלים בערך מוחלט מהר יותר מכל ישר.')}
          </span>
        )}
        {setup.asym && lineHere && inD && (
          <span class="q" data-readout="gap">
            המרחק מהאסימפטוטה בנקודה:{' '}
            <M>
              {gapLhs(lineHere.text)} = <b>{fmt(asymGap(setup.pS, x), 3)}</b>
            </M>
          </span>
        )}
        {setup.mono && (
          <span class="q" data-readout="mono">
            <M>f′(x) = {spS.f1text}</M>. עולה: {listIv(merged(setup.pS, spS.mono, 1))}. יורדת: {listIv(merged(setup.pS, spS.mono, -1))}.
          </span>
        )}
        {setup.conc && (
          <span class="q" data-readout="conc">
            <M>f″(x) = {spS.f2text}</M>. קמורה: {listIv(merged(setup.pS, spS.conc, 1))}. קעורה: {listIv(merged(setup.pS, spS.conc, -1))}.
          </span>
        )}
        {setup.points && (
          <span class="q" data-readout="points">
            {[
              ...spS.crit.map((c) => `${c.kind === 'max' ? '▲ מקסימום מקומי' : c.kind === 'min' ? '▼ מינימום מקומי' : `◆ ${ltr('f′ = 0')} בלי קיצון`} ב-${ltr(ptText(c.x, c.y))}`),
              ...spS.infl.map((q) => `● נקודת פיתול ב-${ltr(ptText(q.x, q.y))}${spS.crit.some((c) => c.x.v === q.x.v) ? ' (אותה נקודה: ◆ ובתוכו ●)' : ''}`),
              ...(spS.infl.length ? [] : ['אין נקודות פיתול']),
            ].join('. ') + '.'}
          </span>
        )}
      </>
    );
  } else {
    const { lead, next } = localTerms(setup.pL, setup.tangent);
    const W = localWindow(setup.pL, setup.tangent, setup.zoom);
    const vd = verdictOf(lead);
    const aboutTangent = setup.tangent && spL.f1a.v !== 0;
    const verdict = aboutTangent
      ? vd === 'cross'
        ? 'k אי-זוגי: הגרף חוצה את המשיק, נקודת פיתול'
        : vd === 'min'
          ? 'k זוגי, מקדם חיובי: הגרף מעל המשיק משני הצדדים'
          : 'k זוגי, מקדם שלילי: הגרף מתחת למשיק משני הצדדים'
      : vd === 'cross'
        ? 'k אי-זוגי: אין קיצון, הגרף חוצה'
        : vd === 'min'
          ? 'k זוגי, מקדם חיובי: מינימום מקומי'
          : 'k זוגי, מקדם שלילי: מקסימום מקומי';
    const notes: string[] = [];
    if (setup.tangent && spL.f1a.v === 0) notes.push(`המשיק ב-a אופקי (${ltr('f′(a) = 0')}): הפחתתו זהה להפחתת ${ltr('f(a)')}, ושום דבר לא משתנה.`);
    if (!aboutTangent && vd === 'cross' && lead.k >= 3) notes.push(`המשיק ב-a אופקי והגרף חוצה אותו: נקודת פיתול עם משיק אופקי.`);
    if (!setup.tangent && spL.f1a.v !== 0) notes.push(`${ltr(`f′(a) = ${spL.f1a.text} ≠ 0`)}: הגרף עולה או יורד דרך a. הדליקו "הפחתת המשיק" כדי לראות מה נשאר.`);
    if (spL.id === 'cos4' && !setup.tangent) notes.push(`כאן ${ltr('f″(0) = 0')}, ובכל זאת יש מקסימום: הסדר k = 4 זוגי.`);
    const k = lead.k;
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>f(x) = {spL.text}</M>, <M>a = {spL.a.text}</M>, <M>f(a) = {spL.fa.text}</M>
          {setup.tangent && (
            <>
              , <M>f′(a) = {spL.f1a.text}</M>
            </>
          )}
        </span>
        <span class="q" data-readout="zoom">
          הגדלה <M>×{fmtZoom(setup.zoom)}</M>: ציר x מוגדל פי <M>{fmtZoom(setup.zoom)}</M>, וציר r פי <M>{fmtPow(W.yScale)}</M> (ההגדלה בחזקת <M>k = {k}</M>), כדי שהצורה תישאר בגודל קבוע.
        </span>
        <span class="q" data-readout="residual">
          {setup.tangent ? (
            <>
              ההפרש מהמשיק: <M>r(x) = f(x) − [f(a) + f′(a)(x − a)]</M>
            </>
          ) : (
            <>
              ההפרש: <M>r(x) = f(x) − f(a)</M>
            </>
          )}
        </span>
        <span class="q" data-readout="lead">
          האיבר המוביל (מקווקו): <M>r(x) ≈ <b>{lead.text}</b></M>
        </span>
        <span class="q" data-readout="order">
          <M>
            k = <b>{k}</b>
          </M>
        </span>
        <span class="q" data-readout="coef">
          <M>
            c = <b>{lead.c.text}</b>
          </M>
        </span>
        <span class="q" data-readout="next">
          האיבר הבא: <M>{next.text}</M>, קטן יותר ביחס לאיבר המוביל ככל שמתקרבים ל-a. בקצה הימני של החלון: <M>r = {fmtTiny(localTerms(setup.pL, setup.tangent).r(W.w))}</M>
        </span>
        <span class="q" data-readout="verdict">
          <b>
            <M>k</M>
            {verdict.slice(1)}
          </b>
        </span>
        {notes.length > 0 && (
          <span class="q" data-readout="note">
            {notes.join(' ')}
          </span>
        )}
      </>
    );
  }

  const presetIds: readonly string[] = setup.mode === 'sketch' ? SKETCH_IDS : LOCAL_IDS;
  const presetLabel = (id: string) => (isSketchId(id) ? SK[id].text : isLocalId(id) ? `${LOCAL[id].text}, a = ${LOCAL[id].a.text}` : id);
  const chosen = setup.mode === 'sketch' ? setup.pS : setup.pL;
  const w = spS.window.x;

  return (
    <SimShell
      fig={props.id}
      label={label}
      canvasRef={canvasRef}
      aspect={aspect}
      live={live}
      tasks={tasks}
      cursor={setup.mode === 'sketch' ? 'ew-resize' : 'default'}
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
          <label class="sk-select" data-control="preset">
            <span class="sk-lab">הפונקציה</span>
            <select
              dir="ltr"
              value={chosen}
              onChange={(e) => {
                const v = (e.target as HTMLSelectElement).value;
                if (isSketchId(v)) apply({ pS: v, x: SK[v].x0 });
                else if (isLocalId(v)) apply({ pL: v });
              }}
            >
              {presetIds.map((id) => (
                <option key={id} value={id}>
                  {presetLabel(id)}
                </option>
              ))}
            </select>
          </label>
          {setup.mode === 'sketch' && (
            <>
              <div class="group" role="group" aria-label="שכבות">
                <Toggle label="תחום הגדרה" on={setup.domain} swatch="var(--delta)" onChange={(on) => apply({ domain: on })} />
                <Toggle label="אסימפטוטות" on={setup.asym} swatch="var(--limit)" onChange={(on) => apply({ asym: on })} />
                <Toggle label="עלייה וירידה" on={setup.mono} onChange={(on) => apply({ mono: on })} />
                <Toggle label="קמירות" on={setup.conc} onChange={(on) => apply({ conc: on })} />
                <Toggle label="נקודות מיוחדות" on={setup.points} swatch="var(--equip)" onChange={(on) => apply({ points: on })} />
                <Toggle label="הגרף" on={setup.graph} swatch="var(--curve)" onChange={(on) => apply({ graph: on })} />
              </div>
              <div class="sk-ctl" data-control="x">
                <Slider label="הנקודה x" value={setup.x} min={w[0]} max={w[1]} step={0.01} format={(v) => fmt(v, 3)} onChange={(v) => setX(v, 0.006)} />
              </div>
            </>
          )}
          {setup.mode === 'local' && (
            <>
              <div class="sk-ctl" data-control="zoom">
                <Slider
                  label="הגדלה (סרגל לוגריתמי)"
                  value={roundTo(eOfZoom(setup.zoom), Z_STEP)}
                  min={0}
                  max={Z_MAX}
                  step={Z_STEP}
                  format={() => `×${fmtZoom(setup.zoom)}`}
                  onChange={(v) => setZoomE(v)}
                />
              </div>
              <div class="group" role="group" aria-label="מה מפחיתים">
                <Toggle label="הפחתת המשיק" on={setup.tangent} swatch="var(--accent)" onChange={(on) => apply({ tangent: on })} />
              </div>
            </>
          )}
        </>
      }
    />
  );
}
