/**
 * ImproperLab (chapter 8.3, improper integrals): three modes. Maths: src/math/improper.ts, whose STORED closed forms
 * (∫ₐᴿ f, ∫_ε¹ f, ∫₁ᴿ g), limits, relations and verdicts drive every curve, number and sentence; the only computed
 * values are the running integrals ∫₁ᴿ f of the comparison presets (a precomputed Simpson table, labelled "חישוב
 * נומרי" in the readout). Nothing is decided by sampling. Canvases are math space and stay LTR (x to the right, y up);
 * sliders for math quantities are `dir="ltr"`. Nothing moves by itself (no animation), so there is no motion for
 * motionAllowed() to gate. The two panels are stacked in one canvas, so they also stack on a phone (390 px) without
 * sideways scroll. Every integrand here is positive: the shaded areas are the solid fill of a positive area (--pos).
 *
 * mode 'tail' (button "קצה אינסופי"): preset f of TAIL (pow 1/xᵖ with a = 1, lorentz 1/(1 + x²) and exp e^(−x) with a = 0).
 *     top panel     f (--curve) on [a, 12] with the area from a to min(R, 12) shaded and R marked on the axis; when R is
 *                   beyond the window an arrow "R = … →" at the right end of the axis instead;
 *     bottom panel  I(R) = ∫ₐᴿ f (accent, closed form) against R on a log₁₀ axis from max(a, 0.1) to 10⁴, the current
 *                   point marked (an arrow at the top when I(R) is above the window), and, when the limit is finite, a
 *                   horizontal dashed line (--limit) at it labelled with its exact value.
 * mode 'spike' (button "פונקציה לא חסומה"): preset pow of SPIKE (1/xᵖ on (0, 1]).
 *     top panel     f on (0, 1] with the area from ε to 1 shaded; the graph leaves the window at the top, where an arrow
 *                   pointing up says that it goes on (f is not bounded near 0); ε marked on the axis;
 *     bottom panel  I(ε) = ∫_ε¹ f (accent, closed form) against ε on a log₁₀ axis from 10⁻⁶ to 0.5 (ε → 0⁺ is to the
 *                   LEFT), the current point, and the limit line when it is finite.
 * mode 'compare' (button "מבחן ההשוואה"): preset f of CMP (exp2, atan, root, div), the comparison test on [1, ∞).
 *     top panel     f (--curve, solid) and the reference g (accent, dashed) on [1, 12], the area under f from 1 to
 *                   min(R, 12) shaded, R marked (or the arrow "R = … →" beyond the window);
 *     bottom panel  ∫₁ᴿ f (accent, solid; the precomputed numerical table) and ∫₁ᴿ g (accent, dashed; closed form)
 *                   against R on a log₁₀ axis from 1 to 10³, both current points, and g's limit line when finite.
 *
 * Props (defaults): id (required); mode ('tail'); modes (the mode buttons shown; default the starting mode only);
 * tasks ([]). f (a TAIL id for tail, the SPIKE id 'pow' for spike, a CMP id for compare; defaults 'pow' for tail and
 * spike, 'exp2' for compare); R (10: tail a + 0.1…10⁴, compare 1…10³); p (1.5; 0.3…3, snapped to steps of 0.05; ONE p
 * shared by the tail and spike power presets, so switching the end keeps the same function); eps (0.1; 10⁻⁶…0.5).
 * Every prop is also a step key (`<Step fig=… set={{…}}>`); a key left out keeps its value. `R` addresses the tail R in
 * the modes tail and spike and the comparison R in compare (the step's own mode decides). A step that sets `f` applies
 * it to tail when it is a TAIL id and to compare when it is a CMP id; a new preset keeps R (clamped to its range).
 * A state set by a step never ticks a task, and a state that already had a task's property when a step or reset made it
 * must be left and found again. The learner can also pick the function from a list (select "הפונקציה": the presets of
 * the current mode; not shown in spike, which has the one preset pow).
 *
 * Tasks (ticked only inside the learner's own drag, key, slider, select or toggle):
 *   tail:    tail-far (the learner drags R to ≥ 1000 on a preset with a finite limit: pow with p > 1, lorentz, exp),
 *            tail-p (preset pow, the learner moves p across 1, either way: from p < 1 to p > 1 or back; landing on
 *            p = 1 is not yet across), tail-slow (preset pow with p ≤ 1, the learner drags R to ≥ 1000: I keeps growing)
 *   spike:   spike-eps (the learner drags ε to ≤ 10⁻⁴), spike-p (the learner moves p across 1, as in tail-p)
 *   compare: cmp-bound (the learner drags R to ≥ 100 on a converging preset: exp2, atan, root), cmp-div (preset div,
 *            the learner drags R to ≥ 100)
 *
 * Hooks for e2e specs (inside `#<id>`; numbers use U+2212 for minus):
 *   buttons by role and name: the mode buttons "קצה אינסופי", "פונקציה לא חסומה", "מבחן ההשוואה" (only those in
 *     `modes`, and only when there are two or more); "איפוס" (reset)
 *   [data-control="preset"] select    the function (tail and compare; option values are the preset ids)
 *   [data-control=…] input            tail: r (LOG slider: value = log₁₀ R, from log₁₀(a + 0.1) rounded up to 0.01
 *                                     (0.05 for pow, −1 for lorentz and exp) to 4, step 0.01: 3 is R = 1000, 4 is
 *                                     10⁴), p (pow only; value = p, 0.3…3, step 0.05);
 *                                     spike: eps (LOG slider: value = log₁₀ ε, −6…−0.31, step 0.01: −4 is ε = 10⁻⁴),
 *                                     p (as in tail);
 *                                     compare: r (LOG slider: value = log₁₀ R, 0…3, step 0.01: 2 is R = 100)
 *   canvas                            a drag that starts on the top panel sets R (or ε) to the x under the pointer
 *                                     (inside the window); one that starts on the bottom panel sets it along the
 *                                     log₁₀ axis (the whole range); ←/→ move log₁₀ R (or log₁₀ ε) by 0.05
 *   [data-readout=…]                  tail: fn, closed, r, int, limit
 *                                     spike: fn, closed, eps, int, limit
 *                                     compare: fn, r, intf (numeric, says "חישוב נומרי"), intg (exact), relation,
 *                                     verdict
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import {
  CMP,
  CMP_IDS,
  CMP_R_MAX,
  CMP_R_MIN,
  EPS_MAX,
  EPS_MIN,
  P_MAX,
  P_MIN,
  P_STEP,
  SPIKE,
  TAIL,
  TAIL_IDS,
  TAIL_R_MAX,
  cmpF,
  cmpG,
  isCmpId,
  isTailId,
  spikeIntegral,
  spikeLimit,
  tailIntegral,
  tailLimit,
  tailRMin,
  type CmpId,
  type TailId,
} from '~/math/improper';
import { markTask } from '~/progress/store';
import { subscribeSteps, type StepState } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { sci } from './core/format';
import { arrow, withAlpha } from './core/ink';
import { drawAxes, makePlot, type Box, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import './ImproperLab.css';

export type ImproperMode = 'tail' | 'spike' | 'compare';

export interface ImproperLabProps {
  id: string;
  mode?: ImproperMode;
  /** the mode buttons shown (default: the starting mode only) */
  modes?: ImproperMode[];
  /** a TAIL preset id (tail), 'pow' (spike) or a CMP preset id (compare) */
  f?: string;
  R?: number;
  p?: number;
  eps?: number;
  tasks?: string[];
}

interface Setup {
  mode: ImproperMode;
  pT: TailId;
  pC: CmpId;
  /** the tail's R */
  R: number;
  /** the comparison's R */
  Rc: number;
  p: number;
  eps: number;
}

const ltr = (s: string) => String.fromCharCode(0x2066) + s.replace(/ /g, String.fromCharCode(0xa0)) + String.fromCharCode(0x2069);

const TASK_LABEL: Record<string, string> = {
  'tail-far': `בפונקציה שהאינטגרל שלה מתכנס, גררו את R עד ${ltr('R ≥ 1000')}. כמה רחוק עוד ${ltr('I(R)')} מהגבול?`,
  'tail-p': `בפונקציה ${ltr('1/xᵖ')} הזיזו את p אל הצד השני של ${ltr('p = 1')}. מה קורה לגבול?`,
  'tail-slow': `בפונקציה ${ltr('1/xᵖ')} עם ${ltr('p ≤ 1')} גררו את R עד ${ltr('1000')} לפחות. האם ${ltr('I(R)')} מתקרב למספר כלשהו?`,
  'spike-eps': `גררו את ε עד ${ltr('10⁻⁴')} או פחות. האם השטח מתייצב?`,
  'spike-p': `הזיזו את p אל הצד השני של ${ltr('p = 1')}. ליד 0, באיזה צד האינטגרל מתכנס?`,
  'cmp-bound': `בפונקציה שהאינטגרל שלה מתכנס, גררו את R עד ${ltr('100')} לפחות. האם ${ltr('∫f')} יכול לעבור את הגבול של ${ltr('∫g')}?`,
  'cmp-div': `בחרו ${ltr('(2 + sin x)/x')} וגררו את R עד ${ltr('100')} לפחות. מה דוחף את ${ltr('∫f')} למעלה?`,
};

const MODE_LABEL: Record<ImproperMode, string> = { tail: 'קצה אינסופי', spike: 'פונקציה לא חסומה', compare: 'מבחן ההשוואה' };

/** the right end of the top panel in compare */
const CMP_X = 12;
/** the bottom panels' y range stops at this value when the integral diverges (the curve leaves at the top) */
const Y_CAP = 20;
const E_EPS_MAX = -0.31;
const KEY_STEP = 0.05;
/** the width of the reset / fullscreen buttons over the top right corner of the canvas */
const TOOLS_W = 84;
const TAU = 2 * Math.PI;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const roundTo = (x: number, step: number) => Number((Math.round(x / step) * step).toPrecision(10));
const minus = (s: string) => s.replace(/-/g, '−');
const fmt = (x: number, sig = 4) => (Number.isNaN(x) ? '—' : Math.abs(x) < 1e-12 ? '0' : minus(sci(x, sig)));
/** "=" when the decimal shown is the value itself (up to the rounding of 1/(p − 1) in floating point: 1/(1.2 − 1) is
 * 5.000000000000001), "≈" otherwise */
const eqSign = (x: number, sig: number) => (Math.abs(Number(sci(x, sig)) - x) <= 1e-12 * Math.abs(x) ? '=' : '≈');
const side = (p: number) => (Math.abs(p - 1) < 1e-9 ? 0 : p > 1 ? 1 : -1);

const fixP = (p: number) => clamp(roundTo(p, P_STEP), P_MIN, P_MAX);
const fixR = (id: TailId, R: number) => clamp(R, tailRMin(id), TAIL_R_MAX);
const fixRc = (R: number) => clamp(R, CMP_R_MIN, CMP_R_MAX);
const fixEps = (e: number) => clamp(e, EPS_MIN, EPS_MAX);
/** the log slider of the tail's R starts at log₁₀(a + 0.1) rounded up to 0.01 */
const eRMin = (id: TailId) => Math.ceil(Math.log10(tailRMin(id)) * 100 - 1e-9) / 100;
/** the tail's bottom panel starts at R = a (a > 0) or 0.1 (a = 0) */
const tailAxisMin = (id: TailId) => (TAIL[id].a > 0 ? TAIL[id].a : 0.1);

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

/** n + 1 samples of [lo, hi]: uniform, dense towards lo (a spike there), or uniform in log x (a log axis) */
function samples(lo: number, hi: number, warp: 'lin' | 'near-lo' | 'log', n: number): number[] {
  const xs: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    xs.push(warp === 'log' ? lo * (hi / lo) ** t : warp === 'near-lo' ? lo + (hi - lo) * t ** 3 : lo + (hi - lo) * t);
  }
  return xs;
}

/** y = F(x) on [lo, hi], clipped to the plot; values far outside the window are clamped so the path stays sane */
function stroke(ctx: CanvasRenderingContext2D, plot: Plot, F: (x: number) => number, lo: number, hi: number, warp: 'lin' | 'near-lo' | 'log', color: string, width: number, dash: number[] = []) {
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
  for (const x of samples(lo, hi, warp, 600)) {
    const v = F(x);
    if (!Number.isFinite(v)) {
      started = false;
      continue;
    }
    const sx = plot.px(x);
    const sy = plot.py(clamp(v, y0 - span, y1 + span));
    if (started) ctx.lineTo(sx, sy);
    else ctx.moveTo(sx, sy);
    started = true;
  }
  ctx.stroke();
  ctx.restore();
}

/** the area between a positive f and the axis over [lo, hi]: the solid fill of a positive area (--pos) */
function shadeUnder(ctx: CanvasRenderingContext2D, p: Palette, plot: Plot, f: (x: number) => number, lo: number, hi: number, warp: 'lin' | 'near-lo') {
  if (!(hi > lo)) return;
  const { box } = plot;
  const [y0, y1] = [plot.y.min, plot.y.max];
  const span = y1 - y0;
  const zero = clamp(plot.py(0), box.y, box.y + box.h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(plot.px(lo), zero);
  for (const x of samples(lo, hi, warp, 300)) ctx.lineTo(plot.px(x), plot.py(clamp(f(x), y0 - span, y1 + span)));
  ctx.lineTo(plot.px(hi), zero);
  ctx.closePath();
  ctx.fillStyle = withAlpha(p.pos, 0.3);
  ctx.fill();
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

/** the top of the bottom panels' y range: 1.2 × a finite limit, else the value at the end of the range, capped */
const yTop = (limit: number, atEnd: number) => (Number.isFinite(limit) ? 1.2 * limit : 1.1 * Math.min(atEnd, Y_CAP));

interface Rule {
  needs: (keyof Setup)[];
  event?: boolean;
  state: (s: Setup, patch: Partial<Setup>) => boolean;
}

export default function ImproperLab(props: ImproperLabProps) {
  const startMode: ImproperMode = props.mode ?? 'tail';
  const modes: ImproperMode[] = props.modes ?? [startMode];
  const initial = (): Setup => {
    const pT: TailId = isTailId(props.f) ? props.f : 'pow';
    const pC: CmpId = isCmpId(props.f) ? props.f : 'exp2';
    return {
      mode: startMode,
      pT,
      pC,
      R: fixR(pT, props.R ?? 10),
      Rc: fixRc(props.R ?? 10),
      p: fixP(props.p ?? 1.5),
      eps: fixEps(props.eps ?? 0.1),
    };
  };
  const [setup, setSetup] = useState<Setup>(initial);
  const cur = useRef(setup);
  const [live, setLive] = useState('');
  const [narrow, setNarrow] = useState(false);
  const plots = useRef<Plot[]>([]);
  const dragging = useRef<'top' | 'bot' | null>(null);
  /** the side of p = 1 (−1 / +1; 0 on it) that p was last on: tail-p and spike-p tick when the learner crosses it */
  const pSide = useRef(side(setup.p));
  const crossed = useRef(false);
  /** tasks whose state held when the last step or reset made it: they must be left and found again */
  const held = useRef<Set<string>>(new Set());

  const RULES: Record<string, Rule> = {
    'tail-far': { needs: ['R'], state: (s) => s.mode === 'tail' && Number.isFinite(tailLimit(s.pT, s.p)) && s.R >= 1000 - 1e-9 },
    'tail-p': { needs: ['p'], event: true, state: (s, p) => s.mode === 'tail' && s.pT === 'pow' && p.p !== undefined && crossed.current },
    'tail-slow': { needs: ['R'], state: (s) => s.mode === 'tail' && s.pT === 'pow' && s.p <= 1 + 1e-9 && s.R >= 1000 - 1e-9 },
    'spike-eps': { needs: ['eps'], state: (s) => s.mode === 'spike' && s.eps <= 1e-4 * (1 + 1e-9) },
    'spike-p': { needs: ['p'], event: true, state: (s, p) => s.mode === 'spike' && p.p !== undefined && crossed.current },
    'cmp-bound': { needs: ['Rc'], state: (s) => s.mode === 'compare' && CMP[s.pC].verdict === 'converges' && s.Rc >= 100 - 1e-9 },
    'cmp-div': { needs: ['Rc'], state: (s) => s.mode === 'compare' && s.pC === 'div' && s.Rc >= 100 - 1e-9 },
  };

  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const done = (t: string) => {
    if (props.tasks?.includes(t)) markTask(`${props.id}:${t}`);
  };
  const rebase = (s: Setup) => {
    pSide.current = side(s.p);
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
        const mode = typeof st.mode === 'string' && modes.includes(st.mode as ImproperMode) ? (st.mode as ImproperMode) : prev.mode;
        const next: Setup = { ...prev, mode };
        if (isTailId(st.f)) next.pT = st.f;
        if (isCmpId(st.f)) next.pC = st.f;
        const sR = num(st.R);
        next.R = fixR(next.pT, mode !== 'compare' && sR !== null ? sR : prev.R);
        next.Rc = fixRc(mode === 'compare' && sR !== null ? sR : prev.Rc);
        next.p = fixP(num(st.p) ?? prev.p);
        next.eps = fixEps(num(st.eps) ?? prev.eps);
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
    const [top, bot] = layout(view.w, view.h, [1, 1]);

    /** a vertical marker at v on the top panel's axis, or the arrow "R = … →" when v is beyond the window */
    const topMarker = (pl: Plot, v: number, name: string, valueText: string) => {
      const yAx = clamp(pl.py(0), pl.box.y, pl.box.y + pl.box.h);
      if (v <= pl.x.max) {
        line(ctx, pl.px(v), pl.box.y, pl.px(v), pl.box.y + pl.box.h, withAlpha(p.accent, 0.7), 1.2, [3, 4]);
        dot(ctx, pl.px(v), yAx, 6, p.accent, p.paper);
        // the label sits at the top of the panel, lower down where the reset / fullscreen buttons cover the corner
        const sx = clamp(pl.px(v), pl.box.x + 8, pl.box.x + pl.box.w - 8);
        haloText(ctx, p, name, sx, pl.box.y + (sx > pl.box.x + pl.box.w - TOOLS_W ? 46 : 10), { font: font(700), color: p.accent });
      } else {
        const xr = pl.box.x + pl.box.w - 4;
        const ya = yAx - 14;
        arrow(ctx, xr - 44, ya, xr, ya, { color: p.accent, width: 2.2, head: 9 });
        haloText(ctx, p, `${name} = ${valueText}`, xr - 50, ya, { font: font(700), color: p.accent, align: 'right' });
      }
    };
    /** the dashed limit line (--limit) with its label, and the current point (an up arrow when it is above the window) */
    const limitLine = (pl: Plot, L: number, label: string) => {
      if (!Number.isFinite(L) || L > pl.y.max) return;
      line(ctx, pl.box.x, pl.py(L), pl.box.x + pl.box.w, pl.py(L), p.limit, 2, [8, 5]);
      haloText(ctx, p, label, pl.box.x + 8, pl.py(L) - 11, { font: font(700), color: p.limit, align: 'left' });
    };
    const current = (pl: Plot, x: number, y: number, color: string, filled = true) => {
      const sx = pl.px(x);
      line(ctx, sx, pl.box.y, sx, pl.box.y + pl.box.h, withAlpha(color, 0.5), 1.1, [3, 4]);
      if (y > pl.y.max) {
        arrow(ctx, sx, pl.box.y + 26, sx, pl.box.y + 2, { color, width: 2.4, head: 9 });
        return;
      }
      if (filled) dot(ctx, sx, pl.py(y), 5.5, color, p.paper);
      else ring(ctx, sx, pl.py(y), 5, color, p.paper, 2.2);
    };
    const axisTag = (pl: Plot, t: string) => haloText(ctx, p, t, pl.box.x + pl.box.w - 6, pl.box.y + pl.box.h - 20, { font: font(700), color: p.ink2, align: 'right' });

    if (s0.mode === 'tail') {
      const sp = TAIL[s0.pT];
      const pT = makePlot(top, { min: sp.a, max: sp.X }, { min: sp.y[0], max: sp.y[1], label: 'f' });
      const L = tailLimit(s0.pT, s0.p);
      const lo = tailAxisMin(s0.pT);
      const pB = makePlot(bot, { min: lo, max: TAIL_R_MAX, scale: 'log' }, { min: 0, max: yTop(L, tailIntegral(s0.pT, TAIL_R_MAX, s0.p)), label: 'I(R)' });
      plots.current = [pT, pB];
      drawAxes(ctx, pT, p);
      drawAxes(ctx, pB, p);
      const f = (x: number) => sp.f(x, s0.p);
      shadeUnder(ctx, p, pT, f, sp.a, Math.min(s0.R, sp.X), 'lin');
      stroke(ctx, pT, f, sp.a, sp.X, 'lin', p.curve, 2.6);
      topMarker(pT, s0.R, 'R', fmt(s0.R, 4));
      axisTag(pT, 'x');
      const lt = sp.limitText(s0.p);
      limitLine(pB, L, lt ? (lt === fmt(L, 6) ? lt : `${lt} ${eqSign(L, 4)} ${fmt(L, 4)}`) : '');
      stroke(ctx, pB, (R) => tailIntegral(s0.pT, R, s0.p), lo, TAIL_R_MAX, 'log', p.accent, 2.8);
      current(pB, s0.R, tailIntegral(s0.pT, s0.R, s0.p), p.accent);
      axisTag(pB, 'R');
      return;
    }

    if (s0.mode === 'spike') {
      const sp = SPIKE.pow;
      const pT = makePlot(top, { min: 0, max: 1 }, { min: sp.y[0], max: sp.y[1], label: 'f' });
      const L = spikeLimit('pow', s0.p);
      const pB = makePlot(bot, { min: EPS_MIN, max: EPS_MAX, scale: 'log' }, { min: 0, max: yTop(L, spikeIntegral('pow', EPS_MIN, s0.p)), label: 'I(ε)' });
      plots.current = [pT, pB];
      drawAxes(ctx, pT, p);
      drawAxes(ctx, pB, p);
      const f = (x: number) => sp.f(x, s0.p);
      // where the graph leaves the window at the top
      const xTop = sp.y[1] ** (-1 / s0.p);
      shadeUnder(ctx, p, pT, f, s0.eps, 1, 'near-lo');
      stroke(ctx, pT, f, Math.max(1e-4, xTop * 0.5), 1, 'near-lo', p.curve, 2.6);
      const sx = pT.px(xTop) + 9;
      arrow(ctx, sx, pT.box.y + 30, sx, pT.box.y + 2, { color: p.curve, width: 2, head: 8 });
      topMarker(pT, s0.eps, 'ε', fmt(s0.eps, 3));
      axisTag(pT, 'x');
      const lt = sp.limitText(s0.p);
      limitLine(pB, L, lt ? `${lt} ${eqSign(L, 4)} ${fmt(L, 4)}` : '');
      stroke(ctx, pB, (e) => spikeIntegral('pow', e, s0.p), EPS_MIN, EPS_MAX, 'log', p.accent, 2.8);
      current(pB, s0.eps, spikeIntegral('pow', s0.eps, s0.p), p.accent);
      axisTag(pB, 'ε');
      return;
    }

    // compare
    const sp = CMP[s0.pC];
    const pT = makePlot(top, { min: 1, max: CMP_X }, { min: sp.y[0], max: sp.y[1], label: 'f, g' });
    const pB = makePlot(bot, { min: CMP_R_MIN, max: CMP_R_MAX, scale: 'log' }, { min: sp.yI[0], max: sp.yI[1], label: 'האינטגרלים' });
    plots.current = [pT, pB];
    drawAxes(ctx, pT, p);
    drawAxes(ctx, pB, p);
    shadeUnder(ctx, p, pT, sp.f, 1, Math.min(s0.Rc, CMP_X), 'lin');
    stroke(ctx, pT, sp.g, 1, CMP_X, 'lin', p.accent, 2.4, [7, 5]);
    stroke(ctx, pT, sp.f, 1, CMP_X, 'lin', p.curve, 2.6);
    topMarker(pT, s0.Rc, 'R', fmt(s0.Rc, 4));
    // the names of the two curves near the left, where they are apart: the upper one above its curve, the lower below
    const xl = 1.9;
    const [yf, yg] = [sp.f(xl), sp.g(xl)];
    const labTop = (t: string, y: number, above: boolean, color: string) =>
      haloText(ctx, p, t, pT.px(xl) + 8, clamp(pT.py(y) + (above ? -12 : 14), pT.box.y + 10, pT.box.y + pT.box.h - 10), { font: font(700), color, align: 'left' });
    labTop('f', yf, yf >= yg, p.curve);
    labTop('g', yg, yg > yf, p.accent);
    if (sp.gLimitText) limitLine(pB, sp.gLimit, `∫g → ${sp.gLimitText} ${eqSign(sp.gLimit, 4)} ${fmt(sp.gLimit, 4)}`);
    stroke(ctx, pB, (R) => cmpG(s0.pC, R), CMP_R_MIN, CMP_R_MAX, 'log', p.accent, 2.4, [7, 5]);
    stroke(ctx, pB, (R) => cmpF(s0.pC, R), CMP_R_MIN, CMP_R_MAX, 'log', p.accent, 2.8);
    current(pB, s0.Rc, cmpG(s0.pC, s0.Rc), p.accent, false);
    current(pB, s0.Rc, cmpF(s0.pC, s0.Rc), p.accent, true);
    const xe = pB.box.x + pB.box.w - 6;
    const [Fe, Ge] = [cmpF(s0.pC, CMP_R_MAX), cmpG(s0.pC, CMP_R_MAX)];
    const labBot = (t: string, y: number, above: boolean) =>
      haloText(ctx, p, t, xe, clamp(pB.py(y) + (above ? -12 : 13), pB.box.y + 10, pB.box.y + pB.box.h - 24), { font: font(700), color: p.accent, align: 'right' });
    labBot('∫f', Fe, Fe >= Ge);
    labBot('∫g', Ge, Ge > Fe);
    axisTag(pB, 'R');
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
  const aspect = narrow ? 0.85 : 1.15;

  /* ---------------------------------------------------------------- learner changes */
  /** The learner changed the figure: apply, then tick whatever the new state completes. */
  const apply = (patch: Partial<Setup>) => {
    const prev = cur.current;
    const next: Setup = { ...prev, ...patch };
    commit(next);
    const sNew = side(next.p);
    crossed.current = 'p' in patch && sNew !== 0 && pSide.current !== 0 && sNew !== pSide.current;
    if (sNew !== 0) pSide.current = sNew;
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
    crossed.current = false;
  };

  const setR = (R: number) => {
    const c = cur.current;
    const v = fixR(c.pT, R);
    if (v !== c.R) apply({ R: v });
  };
  const setRc = (R: number) => {
    const c = cur.current;
    const v = fixRc(R);
    if (v !== c.Rc) apply({ Rc: v });
  };
  const setEps = (e: number) => {
    const c = cur.current;
    const v = fixEps(e);
    if (v !== c.eps) apply({ eps: v });
  };
  const setP = (v: number) => {
    const c = cur.current;
    const np = fixP(v);
    if (np !== c.p) apply({ p: np });
  };
  /** log₁₀ of the current mode's variable, and a setter from it (rounded to 0.01) */
  const logOf = (c: Setup) => Math.log10(c.mode === 'tail' ? c.R : c.mode === 'spike' ? c.eps : c.Rc);
  const setLog = (e: number) => {
    const c = cur.current;
    const v = 10 ** roundTo(e, 0.01);
    if (c.mode === 'tail') setR(v);
    else if (c.mode === 'spike') setEps(v);
    else setRc(v);
  };

  const fromPointer = (e: PointerEvent) => {
    const c = cur.current;
    const pl = plots.current;
    if (pl.length < 2) return;
    if (dragging.current === 'top') {
      const top = pl[0];
      const x = top.x.min + ((e.offsetX - top.box.x) / top.box.w) * (top.x.max - top.x.min);
      if (c.mode === 'tail') setR(roundTo(clamp(x, top.x.min, top.x.max), 0.01));
      else if (c.mode === 'spike') setEps(roundTo(clamp(x, 0, 1), 0.005));
      else setRc(roundTo(clamp(x, top.x.min, top.x.max), 0.01));
    } else {
      const b = pl[1];
      const l0 = Math.log10(b.x.min);
      const l1 = Math.log10(b.x.max);
      setLog(l0 + clamp((e.offsetX - b.box.x) / b.box.w, 0, 1) * (l1 - l0));
    }
  };
  const onPointerDown = (e: PointerEvent) => {
    const pl = plots.current;
    if (pl.length < 2) return;
    dragging.current = e.offsetY < pl[1].box.y - 12 ? 'top' : 'bot';
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
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const c = cur.current;
    setLog(logOf(c) + (e.key === 'ArrowLeft' ? -KEY_STEP : KEY_STEP));
    setLive(describe(cur.current));
  };

  /* ---------------------------------------------------------------- text */
  const M = (q: { children: ComponentChildren }) => <bdi dir="ltr">{q.children}</bdi>;
  /** ∫ with its lower and upper limits */
  const Int = (q: { lo: string; hi: string }) => (
    <span class="il-int">
      ∫<sub>{q.lo}</sub>
      <sup>{q.hi}</sup>
    </span>
  );

  function describe(s: Setup): string {
    if (s.mode === 'tail') {
      const L = tailLimit(s.pT, s.p);
      return `R = ${fmt(s.R, 4)}: האינטגרל ${fmt(tailIntegral(s.pT, s.R, s.p), 6)}${Number.isFinite(L) ? `, הגבול ${fmt(L, 6)}` : ', גדל בלי גבול'}.`;
    }
    if (s.mode === 'spike') {
      const L = spikeLimit('pow', s.p);
      return `ε = ${fmt(s.eps, 3)}: האינטגרל ${fmt(spikeIntegral('pow', s.eps, s.p), 6)}${Number.isFinite(L) ? `, הגבול ${fmt(L, 6)}` : ', גדל בלי גבול'}.`;
    }
    return `R = ${fmt(s.Rc, 4)}: האינטגרל של f בערך ${fmt(cmpF(s.pC, s.Rc), 6)}, האינטגרל של g ${fmt(cmpG(s.pC, s.Rc), 6)}.`;
  }

  const spT = TAIL[setup.pT];
  const spS = SPIKE.pow;
  const spC = CMP[setup.pC];
  const pText = fmt(setup.p, 3);

  const label =
    setup.mode === 'tail'
      ? `איור חי: השטח מתחת לגרף של ${spT.text}${spT.usesP ? ` עם p = ${pText}` : ''} מ-${spT.a} עד R. בלוח העליון הגרף והשטח המסומן, ובלוח התחתון האינטגרל I(R) כפונקציה של R בסולם לוגריתמי${Number.isFinite(tailLimit(setup.pT, setup.p)) ? ', עם קו אופקי בגובה הגבול' : ''}.`
      : setup.mode === 'spike'
        ? `איור חי: השטח מתחת לגרף של 1/xᵖ עם p = ${pText} מ-ε עד 1. הגרף יוצא מהחלון למעלה ליד 0. בלוח התחתון האינטגרל I(ε) כפונקציה של ε בסולם לוגריתמי${Number.isFinite(spikeLimit('pow', setup.p)) ? ', עם קו אופקי בגובה הגבול' : ''}.`
        : `איור חי: מבחן ההשוואה. בלוח העליון f = ${spC.ftext} בקו מלא ו-g = ${spC.gtext} בקו מקווקו על הקטע מ-1 עד 12. בלוח התחתון האינטגרלים של שתיהן מ-1 עד R, בסולם לוגריתמי ב-R.`;

  let readout: ComponentChildren;
  if (setup.mode === 'tail') {
    const a = String(spT.a);
    const I = tailIntegral(setup.pT, setup.R, setup.p);
    const L = tailLimit(setup.pT, setup.p);
    const lt = spT.limitText(setup.p);
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>f(x) = {spT.text}</M>
          {spT.usesP && (
            <>
              , <M>p = <b>{pText}</b></M>
            </>
          )}
        </span>
        <span class="q" data-readout="closed">
          <M>
            <Int lo={a} hi="R" /> f(x) dx = {spT.Itext(setup.p)}
          </M>
        </span>
        <span class="q" data-readout="r">
          <M>
            R = <b>{fmt(setup.R, 4)}</b>
          </M>
        </span>
        <span class="q" data-readout="int">
          <M>
            I(R) = <Int lo={a} hi="R" /> f(x) dx = <b>{fmt(I, 6)}</b>
          </M>
        </span>
        <span class="q" data-readout="limit">
          {Number.isFinite(L) && lt ? (
            <>
              כש-<M>R → ∞</M> האינטגרל מתכנס ל-
              <M>
                <b>
                  {lt}
                  {lt !== fmt(L, 6) && ` ${eqSign(L, 6)} ${fmt(L, 6)}`}
                </b>
              </M>
              ; ההפרש מהגבול: <M>{fmt(L - I, 3)}</M>
            </>
          ) : (
            <>
              כש-<M>R → ∞</M> האינטגרל <b>גדל בלי גבול</b>: הוא מתבדר
            </>
          )}
        </span>
      </>
    );
  } else if (setup.mode === 'spike') {
    const I = spikeIntegral('pow', setup.eps, setup.p);
    const L = spikeLimit('pow', setup.p);
    const lt = spS.limitText(setup.p);
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>f(x) = {spS.text}</M>, <M>p = <b>{pText}</b></M>
        </span>
        <span class="q" data-readout="closed">
          <M>
            <Int lo="ε" hi="1" /> f(x) dx = {spS.Itext(setup.p)}
          </M>
        </span>
        <span class="q" data-readout="eps">
          <M>
            ε = <b>{fmt(setup.eps, 3)}</b>
          </M>
        </span>
        <span class="q" data-readout="int">
          <M>
            I(ε) = <Int lo="ε" hi="1" /> f(x) dx = <b>{fmt(I, 6)}</b>
          </M>
        </span>
        <span class="q" data-readout="limit">
          {Number.isFinite(L) && lt ? (
            <>
              כש-<M>ε → 0⁺</M> האינטגרל מתכנס ל-
              <M>
                <b>
                  {lt} {eqSign(L, 6)} {fmt(L, 6)}
                </b>
              </M>
              ; ההפרש מהגבול: <M>{fmt(L - I, 3)}</M>
            </>
          ) : (
            <>
              כש-<M>ε → 0⁺</M> האינטגרל <b>גדל בלי גבול</b>: הוא מתבדר
            </>
          )}
        </span>
      </>
    );
  } else {
    const le = spC.relation === 'le';
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>f(x) = {spC.ftext}</M>, <M>g(x) = {spC.gtext}</M> (מקווקו)
        </span>
        <span class="q" data-readout="r">
          <M>
            R = <b>{fmt(setup.Rc, 4)}</b>
          </M>
        </span>
        <span class="q" data-readout="intf">
          <M>
            <Int lo="1" hi="R" /> f(x) dx ≈ <b>{fmt(cmpF(setup.pC, setup.Rc), 6)}</b>
          </M>{' '}
          (חישוב נומרי)
        </span>
        <span class="q" data-readout="intg">
          <M>
            <Int lo="1" hi="R" /> g(x) dx = {spC.Gtext} = <b>{fmt(cmpG(setup.pC, setup.Rc), 6)}</b>
          </M>
        </span>
        <span class="q" data-readout="relation">
          <M>{le ? 'f(x) ≤ g(x)' : 'f(x) ≥ g(x)'}</M> לכל <M>x ≥ 1</M>, {spC.why}
        </span>
        <span class="q" data-readout="verdict">
          <b>
            {le ? (
              <>
                <M>f ≤ g</M> ו-<M>∫g</M> מתכנס (ל-<M>{spC.gLimitText}</M>), ולכן <M>∫f</M> מתכנס
              </>
            ) : (
              <>
                <M>f ≥ g</M> ו-<M>∫g</M> מתבדר, ולכן <M>∫f</M> מתבדר
              </>
            )}
          </b>
        </span>
      </>
    );
  }

  const presetIds: readonly string[] = setup.mode === 'tail' ? TAIL_IDS : CMP_IDS;
  const presetText = (id: string) => (setup.mode === 'tail' && isTailId(id) ? TAIL[id].text : isCmpId(id) ? `${CMP[id].ftext} (g = ${CMP[id].gtext})` : id);
  const chosen = setup.mode === 'tail' ? setup.pT : setup.pC;
  const usesP = setup.mode === 'spike' || (setup.mode === 'tail' && spT.usesP);

  return (
    <SimShell
      fig={props.id}
      label={label}
      canvasRef={canvasRef}
      aspect={aspect}
      live={live}
      tasks={tasks}
      cursor="ew-resize"
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
          {setup.mode !== 'spike' && (
            <label class="il-select" data-control="preset">
              <span class="il-lab">הפונקציה</span>
              <select
                dir="ltr"
                value={chosen}
                onChange={(e) => {
                  const v = (e.target as HTMLSelectElement).value;
                  const c = cur.current;
                  if (c.mode === 'tail' && isTailId(v)) apply({ pT: v, R: fixR(v, c.R) });
                  else if (c.mode === 'compare' && isCmpId(v)) apply({ pC: v });
                }}
              >
                {presetIds.map((id) => (
                  <option key={id} value={id}>
                    {presetText(id)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {setup.mode === 'tail' && (
            <div class="il-ctl" data-control="r">
              <Slider
                label="הקצה R (סרגל לוגריתמי)"
                value={roundTo(Math.log10(setup.R), 0.01)}
                min={eRMin(setup.pT)}
                max={Math.log10(TAIL_R_MAX)}
                step={0.01}
                format={() => `R = ${fmt(setup.R, 4)}`}
                onChange={setLog}
              />
            </div>
          )}
          {setup.mode === 'spike' && (
            <div class="il-ctl" data-control="eps">
              <Slider
                label="הקצה ε (סרגל לוגריתמי)"
                value={roundTo(Math.log10(setup.eps), 0.01)}
                min={Math.log10(EPS_MIN)}
                max={E_EPS_MAX}
                step={0.01}
                format={() => `ε = ${fmt(setup.eps, 3)}`}
                onChange={setLog}
              />
            </div>
          )}
          {setup.mode === 'compare' && (
            <div class="il-ctl" data-control="r">
              <Slider
                label="הקצה R (סרגל לוגריתמי)"
                value={roundTo(Math.log10(setup.Rc), 0.01)}
                min={Math.log10(CMP_R_MIN)}
                max={Math.log10(CMP_R_MAX)}
                step={0.01}
                format={() => `R = ${fmt(setup.Rc, 4)}`}
                onChange={setLog}
              />
            </div>
          )}
          {usesP && (
            <div class="il-ctl" data-control="p">
              <Slider label="החזקה p" value={setup.p} min={P_MIN} max={P_MAX} step={P_STEP} format={(v) => `p = ${fmt(v, 3)}`} onChange={setP} />
            </div>
          )}
        </>
      }
    />
  );
}
