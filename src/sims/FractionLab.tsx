/**
 * FractionLab (chapter 7.4, partial fractions): two modes. Maths: src/math/partialfrac.ts, whose STORED exact
 * decompositions (terms, poles, top coefficients, plot windows) drive every curve, label and verdict; nothing is
 * inferred from sampling. Canvases are math space and stay LTR (x to the right, y up); sliders for math quantities are
 * `dir="ltr"`. Nothing moves by itself (no animation), so there is no motion for motionAllowed() to gate.
 * Every curve is split at its poles and far values are clipped, so no false vertical segment is ever drawn across a
 * pole. Terms are told apart by dash pattern AND label (the label sits on a paper plate beside the curve), never colour
 * only.
 *
 * mode 'pieces': a rational function R (registry PF) and its partial-fraction terms.
 *                R is the solid ink curve (`--curve`); the real poles of R are thin dotted vertical lines labelled
 *                "x = a". Each term of the decomposition is its own curve with its own dash pattern and colour and a
 *                label with its formula (the polynomial part of an improper R is a term too); the learner toggles the
 *                terms one by one (the toggles are the terms' formulas). `sum` draws the sum of the SHOWN terms as a
 *                thick green band (`--limit`) under R: with every term shown it lies exactly on R, with one missing it
 *                does not. A probe x (drag the canvas, arrow keys, or the slider; the handle is a short tick on the
 *                bottom edge) with the readout R(x) and the value of each shown term; within 0.5 of a pole the readout
 *                also names the dominant term (the one carrying that pole). `coverup` = a pole index: the factor
 *                (x − a)ᵏ of that pole is "covered" and the readout gives (x − a)ᵏ·R(x), which tends to the pole's
 *                coefficient as the probe nears a (and is defined, equal to it, at x = a, where R is not). Pole
 *                indexes follow the denominator's factors and the terms (see PF in partialfrac.ts: notes 0 → x = 1,
 *                1 → x = 2; two 0 → 1, 1 → −1; three 0 → 0, 1 → 1, 2 → −2; repeated 0 → 1 (order 2); quad 0 → 0;
 *                improper 0 → 1, 1 → −1; fitA 0 → 1, 1 → −2). The `quad` preset has one real pole (x = 0): its
 *                (Bx + C)/(x² + 1) term has none. A probe on a pole says "לא מוגדרת" for R.
 * mode 'fit':    presets two, fitA, notes only. The top panel has R (solid) and the learner's attempt
 *                A/(x − a) + B/(x − b) (dashed, accent, split at its poles); the lower panel plots the residual
 *                R − attempt. Sliders A and B in [−6, 6], step 0.05. The residual blows up near a pole whose
 *                coefficient is wrong and is exactly 0 everywhere only at the exact A and B (a thick green line on 0);
 *                the readout says which pole is wrong and, at the exact values, "השארית מתאפסת: הפירוק נכון". There
 *                is no probe in this mode (the canvas ignores the pointer).
 *
 * Props (defaults): id (required); mode ('pieces'); modes (the mode buttons shown; default the starting mode only);
 * tasks ([]). f (a preset id: any of notes, two, three, repeated, quad, improper, fitA goes to the pieces mode; in the
 * fit mode only two, fitA, notes; defaults 'notes' for pieces and 'fitA' for fit); x (the probe; default the preset's
 * starting x: notes 3, two 2, three 3, repeated 3, quad 2, improper 3, fitA 3; clamped to the window); show (array of
 * term indexes, default all terms); sum (false); coverup (null, or a pole index); A (0), B (0).
 * Windows: notes x[−2, 5], two [−3, 3], three [−4, 4], repeated [−2, 4], quad [−3, 3], improper [−12, 12] (so that
 * R(x) − x < 0.1 is reachable), fitA [−4, 4].
 * Every prop is also a step key (`<Step fig=… set={{…}}>`, plus `mode` when it is in `modes`); a key left out keeps its
 * value; a new pieces `f` without `x` puts the probe at that preset's starting x and, without `show`, shows every term;
 * a `coverup` that is not a pole of the new preset becomes null. A state set by a step never ticks a task, and a state
 * that already had a task's property when a step or reset made it must be left and found again.
 * The learner can also pick the function from a list (select "הפונקציה": the presets of the current mode). Picking one
 * resets the probe, shows every term, clears the cover-up, sets A = B = 0 and ticks nothing.
 *
 * Tasks (ticked only inside the learner's own drag, key, slider or toggle):
 *   pieces: pf-pole (a cover-up is on and the probe is within 0.01 of that pole), pf-sum (`sum` on and every term
 *           shown: the sum lies on R; reached by turning on the last missing term or the sum), pf-far (preset
 *           improper, |x| ≥ 6 and |R(x) − x| < 0.1: from |x| ≈ 10.1 on)
 *   fit:    fit-exact (preset fitA or two, the learner reaches the exact A and B by the sliders; never notes)
 *
 * Hooks for e2e specs (inside `#<id>`; numbers use U+2212 for minus):
 *   buttons by role and name: the mode buttons "פירוק לשברים", "התאמת מקדמים"; "סכום האיברים" (the sum); the
 *     cover-up toggles "כיסוי הגורם (x − 1)" (one per pole: the name is "כיסוי הגורם " plus the factor, e.g.
 *     "כיסוי הגורם (x − 1)²" for the repeated pole, "כיסוי הגורם x" for x = 0); "איפוס" (reset)
 *   [data-control="term-<i>"] button   the toggle of term i (its name is the term's formula, e.g. "−2/(x − 1)")
 *   [data-control="coverup-<j>"] button   the cover-up toggle of pole j
 *   [data-control="preset"] select   the function (option values are the preset ids)
 *   [data-control="x"] input         the probe slider (pieces; value = x, step 0.01)
 *   [data-control="A"] input, [data-control="B"] input   the sliders of the fit mode (step 0.05)
 *   canvas                           pieces: drag moves the probe, ←/→ move it by 1/150 of the window
 *   [data-readout=…]                 pieces: fn (R(x) = …), x, fx (R(x) = … or "לא מוגדרת"), terms (each shown term
 *                                    with its value), dominant (only within 0.5 of a pole), sum (only with `sum`),
 *                                    cover (only with a cover-up)
 *                                    fit: fn, attempt, A, B, verdict
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import {
  FIT_IDS,
  PF,
  PF_IDS,
  coverUp,
  dominantTerm,
  evalR,
  evalSum,
  evalTerm,
  fitAttempt,
  fitExact,
  fitResidual,
  fitText,
  fitWrong,
  isFit,
  isPF,
  nearestPole,
  polesOfR,
  polesOfTerms,
  type FitId,
  type PFId,
} from '~/math/partialfrac';
import { markTask } from '~/progress/store';
import { subscribeSteps, type StepState } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { sci } from './core/format';
import { withAlpha } from './core/ink';
import { drawAxes, insetBox, makePlot, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import './FractionLab.css';

export type FractionMode = 'pieces' | 'fit';

export interface FractionLabProps {
  id: string;
  mode?: FractionMode;
  /** the mode buttons shown (default: the starting mode only) */
  modes?: FractionMode[];
  f?: string;
  x?: number;
  show?: number[];
  sum?: boolean;
  coverup?: number | null;
  A?: number;
  B?: number;
  tasks?: string[];
}

interface Setup {
  mode: FractionMode;
  pP: PFId;
  pF: FitId;
  x: number;
  show: number[];
  sum: boolean;
  coverup: number | null;
  A: number;
  B: number;
}

const ltr = (s: string) => String.fromCharCode(0x2066) + s.replace(/ /g, String.fromCharCode(0xa0)) + String.fromCharCode(0x2069);

const TASK_LABEL: Record<string, string> = {
  'pf-pole': `הדליקו כיסוי של גורם וגררו את x עד ${ltr('0.01')} מהקוטב שלו. מה קורה לערך ${ltr('(x − a)·R(x)')}?`,
  'pf-sum': 'הציגו את כל האיברים והדליקו "סכום האיברים". היכן הסכום נמצא ביחס ל-R?',
  'pf-far': `בפונקציה ${ltr('x³/(x² − 1)')} גררו את x רחוק (${ltr('|x| ≥ 6')}) עד שהמרחק של R מהישר ${ltr('y = x')} קטן מ-${ltr('0.1')}.`,
  'fit-exact': 'כוונו את A ו-B עד שהשארית מתאפסת בכל מקום.',
};

const MODE_LABEL: Record<FractionMode, string> = { pieces: 'פירוק לשברים', fit: 'התאמת מקדמים' };

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const bool = (x: unknown): boolean | null => (typeof x === 'boolean' ? x : null);
const roundTo = (x: number, step: number) => Number((Math.round(x / step) * step).toPrecision(10));
const minus = (s: string) => s.replace(/-/g, '−');
const fmt = (x: number, sig = 4) => (Number.isNaN(x) ? '—' : Math.abs(x) < 1e-9 ? '0' : minus(sci(x, sig)));

const TAU = 2 * Math.PI;
/** SimShell's reset and full-screen buttons cover the canvas's top-right 82 × 42 px */
const TOOLS_W = 84;
const TOOLS_H = 42;
const TASK_TOL = 0.01;
const AB_MAX = 6;
const AB_STEP = 0.05;
const RES_Y = 4;

const allTerms = (id: PFId) => PF[id].terms.map((_, i) => i);
const validShow = (id: PFId, a: unknown): number[] | null => {
  if (!Array.isArray(a)) return null;
  const n = PF[id].terms.length;
  const out = a.filter((v): v is number => Number.isInteger(v) && v >= 0 && v < n);
  return [...new Set(out)].sort((p, q) => p - q);
};
const validCover = (id: PFId, v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < PF[id].poles.length ? v : null);
const clampX = (id: PFId, x: number) => clamp(x, PF[id].window.x[0], PF[id].window.x[1]);

/** the colours and dash patterns of the terms 0, 1, 2 (never colour alone: the dash differs too) */
const TERM_DASH: number[][] = [[9, 5], [2, 4], [12, 4, 2, 4]];
const termColor = (p: Palette, i: number) => [p.accent, p.delta, p.eps][i % 3];

/* ---- tasks: `needs` = the learner's change must touch one of these keys */
interface Rule {
  needs: (keyof Setup)[];
  state: (s: Setup) => boolean;
}
const RULES: Record<string, Rule> = {
  'pf-pole': {
    needs: ['x', 'coverup'],
    state: (s) => {
      if (s.mode !== 'pieces' || s.coverup === null) return false;
      const pole = PF[s.pP].poles[s.coverup];
      return !!pole && Math.abs(s.x - pole.a) <= TASK_TOL + 1e-9;
    },
  },
  'pf-sum': { needs: ['show', 'sum'], state: (s) => s.mode === 'pieces' && s.sum && s.show.length === PF[s.pP].terms.length },
  'pf-far': {
    needs: ['x'],
    state: (s) => s.mode === 'pieces' && s.pP === 'improper' && Math.abs(s.x) >= 6 - 1e-9 && Math.abs(evalR('improper', s.x) - s.x) < 0.1,
  },
  'fit-exact': { needs: ['A', 'B'], state: (s) => s.mode === 'fit' && (s.pF === 'fitA' || s.pF === 'two') && fitExact(s.pF, s.A, s.B) },
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
/** a small filled square: the mark of a term's value at the probe (R gets a circle) */
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
/** a label on a paper plate: lines may cross the spot, the letters stay clear */
function plate(ctx: CanvasRenderingContext2D, p: Palette, s: string, x: number, y: number, font: string, color: string, border: string) {
  ctx.save();
  ctx.direction = 'ltr';
  ctx.font = font;
  const w = ctx.measureText(s).width;
  const h = 16;
  ctx.fillStyle = withAlpha(p.paper, 0.92);
  ctx.strokeStyle = withAlpha(border, 0.7);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x - w / 2 - 4, y - h / 2, w + 8, h, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
  ctx.restore();
}

/** x samples of [lo, hi], dense towards an end that is a pole (quadratic spacing), never touching it */
function samples(lo: number, hi: number, poleLo: boolean, poleHi: boolean, n: number): number[] {
  const xs: number[] = [];
  const eps = (hi - lo) * 1e-9;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // both ends poles: dense at both (a symmetric smoothstep-like spacing)
    let x: number;
    if (poleLo && poleHi) x = lo + (hi - lo) * (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
    else if (poleLo) x = lo + (hi - lo) * t * t;
    else if (poleHi) x = hi - (hi - lo) * (1 - t) * (1 - t);
    else x = lo + (hi - lo) * t;
    if (i === 0 && poleLo) x = lo + eps;
    if (i === n && poleHi) x = hi - eps;
    xs.push(x);
  }
  return xs;
}

/** f on [lo, hi] split at `poles` (the points where f is undefined): each piece on its own, far values clipped */
function strokeSplit(ctx: CanvasRenderingContext2D, plot: Plot, f: (x: number) => number, poles: readonly number[], color: string, width: number, dash: number[] = []) {
  const [x0, x1] = [plot.x.min, plot.x.max];
  const cuts = [x0, ...poles.filter((a) => a > x0 && a < x1), x1];
  const y0 = plot.y.min;
  const y1 = plot.y.max;
  const span = y1 - y0;
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.box.x, plot.box.y - 2, plot.box.w, plot.box.h + 4);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.setLineDash(dash);
  for (let i = 0; i + 1 < cuts.length; i++) {
    const lo = cuts[i];
    const hi = cuts[i + 1];
    const poleLo = i > 0;
    const poleHi = i + 2 < cuts.length;
    ctx.beginPath();
    let started = false;
    for (const x of samples(lo, hi, poleLo, poleHi, 500)) {
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

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
const overlap = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

export default function FractionLab(props: FractionLabProps) {
  const startMode: FractionMode = props.mode ?? 'pieces';
  const modes: FractionMode[] = props.modes ?? [startMode];
  const initial = (): Setup => {
    const pP: PFId = isPF(props.f) ? props.f : 'notes';
    const pF: FitId = isFit(props.f) ? props.f : 'fitA';
    return {
      mode: startMode,
      pP,
      pF,
      x: clampX(pP, props.x ?? PF[pP].x0),
      show: validShow(pP, props.show) ?? allTerms(pP),
      sum: props.sum ?? false,
      coverup: validCover(pP, props.coverup),
      A: clamp(roundTo(props.A ?? 0, AB_STEP), -AB_MAX, AB_MAX),
      B: clamp(roundTo(props.B ?? 0, AB_STEP), -AB_MAX, AB_MAX),
    };
  };
  const [setup, setSetup] = useState<Setup>(initial);
  const cur = useRef(setup);
  const [live, setLive] = useState('');
  const [narrow, setNarrow] = useState(false);
  const plotRef = useRef<Plot | null>(null);
  const dragging = useRef(false);
  /** tasks whose state held when the last step, reset or select made it: they must be left and found again */
  const held = useRef<Set<string>>(new Set());

  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const done = (t: string) => {
    if (props.tasks?.includes(t)) markTask(`${props.id}:${t}`);
  };
  const rebase = (s: Setup) => {
    held.current = new Set((props.tasks ?? []).filter((id) => RULES[id] && RULES[id].state(s)));
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
        const mode = typeof st.mode === 'string' && modes.includes(st.mode as FractionMode) ? (st.mode as FractionMode) : prev.mode;
        const next: Setup = { ...prev, mode };
        let newP = false;
        if (typeof st.f === 'string') {
          if (mode === 'fit') {
            if (isFit(st.f)) next.pF = st.f;
          } else if (isPF(st.f) && st.f !== prev.pP) {
            next.pP = st.f;
            newP = true;
          }
        }
        next.show = validShow(next.pP, st.show) ?? (newP ? allTerms(next.pP) : prev.show);
        next.sum = bool(st.sum) ?? prev.sum;
        if (st.coverup === null) next.coverup = null;
        else next.coverup = validCover(next.pP, st.coverup) ?? (newP ? null : validCover(next.pP, prev.coverup));
        next.x = clampX(next.pP, num(st.x) ?? (newP ? PF[next.pP].x0 : prev.x));
        next.A = clamp(roundTo(num(st.A) ?? prev.A, AB_STEP), -AB_MAX, AB_MAX);
        next.B = clamp(roundTo(num(st.B) ?? prev.B, AB_STEP), -AB_MAX, AB_MAX);
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

    if (s0.mode === 'pieces') {
      const sp = PF[s0.pP];
      const win = sp.window;
      const box = insetBox({ x: 0, y: 0, w: view.w, h: view.h }, { l: 46, r: 14, t: 16, b: 42 });
      const plot = makePlot(box, { min: win.x[0], max: win.x[1], label: 'x' }, { min: win.y[0], max: win.y[1], label: 'y' });
      plotRef.current = plot;
      drawAxes(ctx, plot, p);
      const PX = plot.px;
      const PY = plot.py;
      const inBoxY = (sy: number) => sy >= box.y - 1 && sy <= box.y + box.h + 1;
      line(ctx, box.x, PY(0), box.x + box.w, PY(0), withAlpha(p.ink2, 0.7), 1.2);
      if (win.x[0] < 0 && win.x[1] > 0) line(ctx, PX(0), box.y, PX(0), box.y + box.h, withAlpha(p.ink2, 0.7), 1.2);

      // the poles of R: dotted verticals, the covered one thicker and in the accent colour
      const rPoles = polesOfR(s0.pP);
      const coverPole = s0.coverup !== null ? sp.poles[s0.coverup]?.a : undefined;
      for (const a of rPoles) {
        if (a < win.x[0] || a > win.x[1]) continue;
        const on = a === coverPole;
        line(ctx, PX(a), box.y, PX(a), box.y + box.h, on ? p.accent : p.ink3, on ? 2 : 1.3, [2, 5]);
        haloText(ctx, p, minus(`x = ${a}`), PX(a) + 5, box.y + box.h - 11, { font: font(600, fs - 1), color: on ? p.accent : p.ink2, align: 'left' });
      }

      // the sum of the shown terms: a thick green band under R
      const shown = s0.show;
      if (s0.sum && shown.length > 0) {
        strokeSplit(ctx, plot, (x) => evalSum(s0.pP, shown, x), polesOfTerms(s0.pP, shown), withAlpha(p.limit, 0.8), 6.5);
      }
      // the terms
      shown.forEach((i) => {
        const t = sp.terms[i];
        strokeSplit(ctx, plot, (x) => t.value(x), t.pole === null ? [] : [t.pole], termColor(p, i), 2.2, TERM_DASH[i % 3]);
      });
      // R on top
      strokeSplit(ctx, plot, (x) => evalR(s0.pP, x), rPoles, p.curve, 2.8);

      // the probe
      const xp = s0.x;
      const r = evalR(s0.pP, xp);
      line(ctx, PX(xp), box.y, PX(xp), box.y + box.h, withAlpha(p.accent, 0.55), 1.1, [3, 4]);
      for (const i of shown) {
        const v = evalTerm(s0.pP, i, xp);
        if (Number.isFinite(v) && inBoxY(PY(v))) square(ctx, PX(xp), PY(v), 4, termColor(p, i), p.paper);
      }
      if (Number.isFinite(r)) {
        if (inBoxY(PY(r))) dot(ctx, PX(xp), PY(r), 5.5, p.curve, p.paper);
      } else haloText(ctx, p, 'לא מוגדרת', PX(xp), box.y + 14, { font: font(700), color: p.pointOut });
      ctx.save();
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(PX(xp), box.y + box.h - 13);
      ctx.lineTo(PX(xp), box.y + box.h - 2);
      ctx.stroke();
      ctx.restore();

      // labels on plates, placed where the curve is inside the box and the plates do not collide
      const placed: Rect[] = [{ x0: box.x + box.w - TOOLS_W, y0: 0, x1: view.w, y1: TOOLS_H }];
      const place = (text: string, f: (x: number) => number, color: string) => {
        ctx.save();
        ctx.font = font(700);
        const w = ctx.measureText(text).width + 8;
        ctx.restore();
        const span = win.x[1] - win.x[0];
        for (const frac of [0.9, 0.78, 0.66, 0.54, 0.42, 0.3, 0.18, 0.08, 0.96, 0.02]) {
          const x = win.x[0] + span * frac;
          if (rPoles.some((a) => Math.abs(x - a) < span * 0.04)) continue;
          const v = f(x);
          if (!Number.isFinite(v)) continue;
          const sy = PY(v) - 13;
          if (sy < box.y + 10 || sy > box.y + box.h - 22) continue;
          const sx = clamp(PX(x), box.x + w / 2 + 2, box.x + box.w - w / 2 - 2);
          const rect: Rect = { x0: sx - w / 2, y0: sy - 9, x1: sx + w / 2, y1: sy + 9 };
          if (placed.some((q) => overlap(rect, q))) continue;
          placed.push(rect);
          plate(ctx, p, text, sx, sy, font(700), color, color);
          return;
        }
      };
      place('R(x)', (x) => evalR(s0.pP, x), p.ink);
      if (s0.sum && shown.length > 0) place('סכום', (x) => evalSum(s0.pP, shown, x), p.limit);
      for (const i of shown) place(sp.terms[i].text, (x) => evalTerm(s0.pP, i, x), termColor(p, i));
      return;
    }

    // fit mode: R and the attempt on top, the residual below
    const f = PF[s0.pF].fit!;
    const win = PF[s0.pF].window;
    const hTop = Math.round(view.h * 0.57);
    const boxT = insetBox({ x: 0, y: 0, w: view.w, h: hTop }, { l: 46, r: 14, t: 14, b: 22 });
    const boxB = insetBox({ x: 0, y: hTop, w: view.w, h: view.h - hTop }, { l: 46, r: 14, t: 12, b: 40 });
    const plotT = makePlot(boxT, { min: win.x[0], max: win.x[1] }, { min: win.y[0], max: win.y[1] });
    const plotB = makePlot(boxB, { min: win.x[0], max: win.x[1], label: 'x' }, { min: -RES_Y, max: RES_Y });
    plotRef.current = null;
    const poles = polesOfR(s0.pF);
    for (const [pl, bx] of [
      [plotT, boxT],
      [plotB, boxB],
    ] as const) {
      drawAxes(ctx, pl, p);
      line(ctx, bx.x, pl.py(0), bx.x + bx.w, pl.py(0), withAlpha(p.ink2, 0.7), 1.2);
      for (const a of poles) {
        if (a < win.x[0] || a > win.x[1]) continue;
        line(ctx, pl.px(a), bx.y, pl.px(a), bx.y + bx.h, p.ink3, 1.3, [2, 5]);
        haloText(ctx, p, minus(`x = ${a}`), pl.px(a) + 5, bx.y + bx.h - 10, { font: font(600, fs - 1), color: p.ink2, align: 'left' });
      }
    }
    const attemptPoles = [f.a, f.b];
    strokeSplit(ctx, plotT, (x) => fitAttempt(s0.pF, s0.A, s0.B, x), attemptPoles, p.accent, 2.6, [9, 5]);
    strokeSplit(ctx, plotT, (x) => evalR(s0.pF, x), poles, p.curve, 2.8);
    haloText(ctx, p, 'רציף: הפונקציה; מקווקו: הניסיון', boxT.x + 8, boxT.y + 10, { font: font(700, fs - 1), color: p.ink2, align: 'left' });
    const exact = fitExact(s0.pF, s0.A, s0.B);
    if (exact) {
      line(ctx, boxB.x, plotB.py(0), boxB.x + boxB.w, plotB.py(0), withAlpha(p.limit, 0.85), 6);
      haloText(ctx, p, 'השארית היא 0', boxB.x + boxB.w / 2, plotB.py(0) - 16, { font: font(700), color: p.limit });
    }
    strokeSplit(ctx, plotB, (x) => fitResidual(s0.pF, s0.A, s0.B, x), attemptPoles, p.accent, 2.4);
    haloText(ctx, p, 'השארית: הפונקציה פחות הניסיון', boxB.x + 8, boxB.y + 10, { font: font(700, fs - 1), color: p.ink2, align: 'left' });
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
  const aspect = setup.mode === 'pieces' ? (narrow ? 0.85 : 1.4) : narrow ? 0.8 : 1.15;

  /* ---------------------------------------------------------------- learner changes */
  /** The learner changed the figure: apply, then tick whatever the new state completes. */
  const apply = (patch: Partial<Setup>) => {
    const prev = cur.current;
    const next: Setup = { ...prev, ...patch };
    commit(next);
    for (const id of props.tasks ?? []) {
      const rule = RULES[id];
      if (!rule) continue;
      if (!rule.state(next)) {
        held.current.delete(id);
        continue;
      }
      if (!rule.needs.some((key) => key in patch)) continue;
      if (held.current.has(id)) continue;
      done(id);
    }
  };

  const setX = (x: number) => {
    const c = cur.current;
    const nx = clampX(c.pP, roundTo(x, 0.01));
    if (nx !== c.x) apply({ x: nx });
  };

  const fromPointer = (e: PointerEvent) => {
    const plot = plotRef.current;
    if (!plot || cur.current.mode !== 'pieces') return;
    setX(plot.x.min + ((e.offsetX - plot.box.x) / plot.box.w) * (plot.x.max - plot.x.min));
  };
  const onPointerDown = (e: PointerEvent) => {
    if (cur.current.mode !== 'pieces') return;
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
    if (c.mode === 'pieces' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      const w = PF[c.pP].window.x;
      const step = Math.max(0.01, roundTo((w[1] - w[0]) / 150, 0.01));
      setX(c.x + (e.key === 'ArrowLeft' ? -step : step));
      setLive(describe(cur.current));
    }
  };

  /* ---------------------------------------------------------------- text */
  const M = (q: { children: ComponentChildren }) => <bdi dir="ltr">{q.children}</bdi>;
  const spP = PF[setup.pP];
  const spF = PF[setup.pF];

  function describe(s: Setup): string {
    if (s.mode === 'pieces') {
      const r = evalR(s.pP, s.x);
      return Number.isFinite(r) ? `x = ${fmt(s.x, 3)}: R(x) = ${fmt(r)}.` : `x = ${fmt(s.x, 3)}: R לא מוגדרת שם.`;
    }
    return fitExact(s.pF, s.A, s.B) ? `A = ${fmt(s.A)}, B = ${fmt(s.B)}: השארית מתאפסת, הפירוק נכון.` : `A = ${fmt(s.A)}, B = ${fmt(s.B)}: השארית לא מתאפסת.`;
  }

  const label =
    setup.mode === 'pieces'
      ? `איור חי: הגרף של ${spP.text} והאיברים של הפירוק שלה לשברים חלקיים, כל איבר בקו מקווקו אחר ועם תווית. הקטבים מסומנים בקווים אנכיים מנוקדים. נקודה x נגררת, ומודפסים הערכים של R ושל כל איבר.`
      : `איור חי: הגרף של ${spF.text} והניסיון ${fitText(setup.pF)}, ומתחתיו השארית, הפרש שמתאפס בכל מקום רק כש-A ו-B מדויקים.`;

  let readout: ComponentChildren;
  if (setup.mode === 'pieces') {
    const x = setup.x;
    const r = evalR(setup.pP, x);
    const shown = setup.show;
    const near = nearestPole(setup.pP, x);
    const dom = near && near.dist < 0.5 ? dominantTerm(setup.pP, shown, x) : -1;
    const cp = setup.coverup !== null ? spP.poles[setup.coverup] : undefined;
    const sumVal = evalSum(setup.pP, shown, x);
    const allShown = shown.length === spP.terms.length;
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>R(x) = {spP.text}</M>
        </span>
        <span class="q" data-readout="x">
          <M>
            x = <b>{fmt(x, 3)}</b>
          </M>
        </span>
        <span class="q" data-readout="fx">
          {Number.isFinite(r) ? (
            <M>
              R(x) = <b>{fmt(r)}</b>
            </M>
          ) : (
            <b>R לא מוגדרת ב-x זה (הוא קוטב).</b>
          )}
        </span>
        <span class="q" data-readout="terms">
          {shown.length === 0
            ? 'אף איבר לא מוצג.'
            : shown.map((i, j) => (
                <span key={i}>
                  {j > 0 && '; '}
                  <M>
                    {spP.terms[i].text} = <b>{Number.isFinite(evalTerm(setup.pP, i, x)) ? fmt(evalTerm(setup.pP, i, x)) : '—'}</b>
                  </M>
                </span>
              ))}
        </span>
        {dom >= 0 && near && (
          <span class="q" data-readout="dominant">
            קרוב ל-<M>{minus(`x = ${near.a}`)}</M> האיבר <M>{spP.terms[dom].text}</M> הוא הגדול ביותר בערך מוחלט. הוא זה שמכיל את הקוטב.
          </span>
        )}
        {setup.sum && (
          <span class="q" data-readout="sum">
            סכום האיברים המוצגים:{' '}
            <M>
              <b>{Number.isFinite(sumVal) ? fmt(sumVal) : '—'}</b>
            </M>
            {allShown ? ': כל האיברים מוצגים, הסכום שווה ל-R.' : `. חסר איבר, ולכן הסכום לא שווה ל-R${Number.isFinite(r) && Number.isFinite(sumVal) ? ` (ההפרש ${fmt(r - sumVal)})` : ''}.`}
          </span>
        )}
        {cp && (
          <span class="q" data-readout="cover">
            <M>
              {cp.order === 1 ? `(${xa(cp.a)})` : `(${xa(cp.a)})²`}·R(x) = <b>{fmt(coverUp(setup.pP, setup.coverup as number, x))}</b>
            </M>
            {Math.abs(x - cp.a) < 1e-9 ? ' (ב-x = a עצמו R לא מוגדרת, אבל המכפלה מוגדרת)' : ''}
          </span>
        )}
      </>
    );
  } else {
    const exact = fitExact(setup.pF, setup.A, setup.B);
    const f = spF.fit!;
    const [wa, wb] = fitWrong(setup.pF, setup.A, setup.B);
    const wrongPoles = [...(wa ? [f.a] : []), ...(wb ? [f.b] : [])].map((a) => ltr(minus(`x = ${a}`)));
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>R(x) = {spF.text}</M>
        </span>
        <span class="q" data-readout="attempt">
          הניסיון: <M>{fitText(setup.pF)}</M>
        </span>
        <span class="q" data-readout="A">
          <M>
            A = <b>{fmt(setup.A)}</b>
          </M>
        </span>
        <span class="q" data-readout="B">
          <M>
            B = <b>{fmt(setup.B)}</b>
          </M>
        </span>
        <span class="q" data-readout="verdict">
          {exact ? (
            <b>השארית מתאפסת: הפירוק נכון</b>
          ) : (
            <b>
              השארית לא מתאפסת: ליד {wrongPoles.join(' וגם ליד ')} היא גדלה בלי גבול, כלומר המקדם שם לא נכון.
            </b>
          )}
        </span>
      </>
    );
  }

  const presetIds: readonly string[] = setup.mode === 'pieces' ? PF_IDS : FIT_IDS;
  const chosen = setup.mode === 'pieces' ? setup.pP : setup.pF;
  const w = spP.window.x;

  const onPreset = (v: string) => {
    const c = cur.current;
    let next: Setup;
    if (c.mode === 'pieces' && isPF(v)) next = { ...c, pP: v, x: PF[v].x0, show: allTerms(v), coverup: null, A: 0, B: 0 };
    else if (c.mode === 'fit' && isFit(v)) next = { ...c, pF: v, A: 0, B: 0 };
    else return;
    commit(next);
    rebase(next);
    setLive(`הפונקציה התחלפה: ${PF[v].text}.`);
  };

  return (
    <SimShell
      fig={props.id}
      label={label}
      canvasRef={canvasRef}
      aspect={aspect}
      live={live}
      tasks={tasks}
      cursor={setup.mode === 'pieces' ? 'ew-resize' : 'default'}
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
          <label class="fl-select" data-control="preset">
            <span class="fl-lab">הפונקציה</span>
            <select dir="ltr" value={chosen} onChange={(e) => onPreset((e.target as HTMLSelectElement).value)}>
              {presetIds.map((id) => (
                <option key={id} value={id}>
                  {PF[id as PFId].text}
                </option>
              ))}
            </select>
          </label>
          {setup.mode === 'pieces' && (
            <>
              <div class="group" role="group" aria-label="האיברים">
                {spP.terms.map((t, i) => (
                  <span key={`${setup.pP}-${i}`} class="fl-toggle" data-control={`term-${i}`}>
                    <Toggle
                      label={<bdi dir="ltr">{t.text}</bdi>}
                      on={setup.show.includes(i)}
                      swatch={termColorVar(i)}
                      onChange={(on) => apply({ show: on ? [...setup.show, i].sort((a, b) => a - b) : setup.show.filter((j) => j !== i) })}
                    />
                  </span>
                ))}
                <Toggle label="סכום האיברים" on={setup.sum} swatch="var(--limit)" onChange={(on) => apply({ sum: on })} />
              </div>
              {spP.poles.length > 0 && (
                <div class="group" role="group" aria-label="כיסוי גורם">
                  {spP.poles.map((pl, j) => (
                    <span key={`${setup.pP}-c${j}`} class="fl-toggle" data-control={`coverup-${j}`}>
                      <Toggle
                        label={
                          <>
                            כיסוי הגורם <bdi dir="ltr">{pl.order === 1 ? (pl.a === 0 ? 'x' : `(${xa(pl.a)})`) : `(${xa(pl.a)})²`}</bdi>
                          </>
                        }
                        on={setup.coverup === j}
                        swatch="var(--accent)"
                        onChange={(on) => apply({ coverup: on ? j : null })}
                      />
                    </span>
                  ))}
                </div>
              )}
              <div class="fl-ctl" data-control="x">
                <Slider label="הנקודה x" value={setup.x} min={w[0]} max={w[1]} step={0.01} format={(v) => fmt(v, 3)} onChange={(v) => setX(v)} />
              </div>
            </>
          )}
          {setup.mode === 'fit' && (
            <>
              <div class="fl-ctl" data-control="A">
                <Slider label="A" value={setup.A} min={-AB_MAX} max={AB_MAX} step={AB_STEP} format={(v) => fmt(v)} onChange={(v) => apply({ A: clamp(roundTo(v, AB_STEP), -AB_MAX, AB_MAX) })} />
              </div>
              <div class="fl-ctl" data-control="B">
                <Slider label="B" value={setup.B} min={-AB_MAX} max={AB_MAX} step={AB_STEP} format={(v) => fmt(v)} onChange={(v) => apply({ B: clamp(roundTo(v, AB_STEP), -AB_MAX, AB_MAX) })} />
              </div>
            </>
          )}
        </>
      }
    />
  );
}

/** "x − 1", "x + 2", "x" (for a cover-up label) */
function xa(a: number): string {
  return a === 0 ? 'x' : a > 0 ? `x − ${a}` : `x + ${-a}`;
}
/** the swatch colour of term i: the CSS variable of its canvas colour */
function termColorVar(i: number): string {
  return ['var(--accent)', 'var(--delta)', 'var(--eps)'][i % 3];
}
