/**
 * NumericLab (chapter 8.4, numerical integration): two modes. Maths: src/math/quadrature.ts, whose registry NQ STORES the
 * exact integral, f″, f⁽⁴⁾ and the maxima M₂, M₄ of each preset in closed form; the sums Tₙ, Sₙ are computed (that is the
 * point of the figure) and every exact value and bound shown comes from the stored forms. Notation of the lesson: Tₙ is
 * the trapezoid sum, Sₙ the Simpson sum, h = (b − a)/n, I = ∫ₐᵇ f(x) dx, the error is signed: Tₙ − I, Sₙ − I. Canvases
 * are math space and stay LTR (x to the right, y up); sliders for math quantities are `dir="ltr"`. Nothing moves by
 * itself (no animation), so there is no motion for motionAllowed() to gate. One panel per mode, so the figure fits a
 * phone (390 px) without sideways scroll.
 *
 * mode 'rules' (button "טרפז וסימפסון"): preset f of NQ (exp, recip, sin, cubic, gauss, lorentz).
 *     f (--curve) on [a, b]; the n pieces of the chosen rule (accent): the chords of the trapezoid rule with the region
 *     under them filled faintly, or Simpson's parabolas (one over each pair of pieces) filled faintly; the nodes
 *     (xᵢ, fᵢ) marked. With `both` the other rule is drawn dashed (--ink-2, no fill), so the two differ in pattern and
 *     not in colour alone; Simpson's parabolas are not drawn for an odd n. n = 1…64 by slider; Simpson takes an even n
 *     only: its slider steps by 2 (2…64), switching to Simpson with an odd n raises n by 1, and the readout says
 *     "בסימפסון n זוגי".
 * mode 'error' (button "גודל השגיאה"): preset f of ERROR_IDS (exp, recip, sin, gauss; not cubic, whose Simpson error is 0,
 *     nor lorentz, where f‴(0) = f‴(1) = 0 makes Simpson's ratio 64 and not 16).
 *     a log–log plot of |error| against n = 2, 4, 8, …, 256 for both rules: the trapezoid (accent, filled circles) and
 *     Simpson (--hand, filled squares): two series, two marker shapes; dashed guide lines of slopes −2 and −4 drawn
 *     parallel above them; the current n marked by a vertical line and rings on both series. The marker moves over the
 *     doubling steps only (drag on the canvas, ←/→, or the slider).
 *
 * Props (defaults): id (required); mode ('rules'); modes (the mode buttons shown; default the starting mode only);
 * tasks ([]). f ('exp'; an NQ id; in error mode an ERROR_IDS id, any other id leaves the error preset at 'exp');
 * n (rules: 8, an integer 1…64, raised to even for Simpson; error: 4, snapped to the nearest of 2, 4, …, 256);
 * rule ('trap' | 'simpson'; 'trap'); both (false).
 * Every prop is also a step key (`<Step fig=… set={{…}}>`); a key left out keeps its value; `n` addresses the n of the
 * mode the step ends in (rules and error keep separate n's). A step that sets `f` applies it to rules, and to error when
 * it is an ERROR_IDS id. A state set by a step never ticks a task, and a state that already had a task's property when
 * a step or reset made it must be left and found again.
 * The learner can also pick the function from a list (select "הפונקציה": the presets of the current mode).
 *
 * Tasks (ticked only inside the learner's own slider, key, drag, button or select):
 *   rules:  nr-refine (the learner raises n to ≥ 16 with the trapezoid rule), nr-simpson (the learner switches to Simpson
 *           with the "סימפסון" button), nr-convex (preset exp, trapezoid, n ≤ 4, set by the learner: every chord lies
 *           above the curve, Tₙ > I)
 *   error:  err-double (the learner moves the marker by at least two doublings from where a step or reset put it),
 *           err-compare (the learner reaches n ≥ 64, where Simpson's error is below the trapezoid's by a factor > 1000)
 *
 * Hooks for e2e specs (inside `#<id>`; numbers use U+2212 for minus):
 *   buttons by role and name, matched with { exact: true } ("טרפז" is also part of "טרפז וסימפסון"): the mode buttons
 *     "טרפז וסימפסון", "גודל השגיאה"; the rule buttons "טרפז", "סימפסון" and the toggle "השוואה לכלל השני" (rules);
 *     "איפוס" (reset)
 *   [data-control="preset"] select    the function (option values are the preset ids)
 *   [data-control="n"] input          rules: value = n (trapezoid 1…64 step 1; Simpson 2…64 step 2);
 *                                     error: value = log₂ n (1…8, step 1: 2 is n = 4, 6 is n = 64)
 *   canvas                            error: a drag sets n to the nearest doubling step; ←/→ change n in both modes
 *                                     (rules ±1, Simpson ±2; error one doubling)
 *   [data-readout=…]                  rules: fn, n (n and h), approx (Tₙ or Sₙ), exact (I), error, bound, other (with both:
 *                                     the other rule's sum and error), even (Simpson chosen, or both on with an odd n:
 *                                     "בסימפסון n זוגי")
 *                                     error: fn, n, err-trap, err-simp, ratio-trap, ratio-simp (E(n/2)/E(n), "—" at n = 2),
 *                                     compare (|E_T|/|E_S| at n)
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import {
  DOUBLINGS,
  ERROR_IDS,
  NQ,
  NQ_IDS,
  approx,
  errorBound,
  isErrorId,
  isNqId,
  nodes,
  parabolaAt,
  pieces,
  type ErrorId,
  type NqId,
  type QuadRule,
} from '~/math/quadrature';
import { markTask } from '~/progress/store';
import { subscribeSteps, type StepState } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { sci } from './core/format';
import { withAlpha } from './core/ink';
import { drawAxes, makePlot, type Box, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import './NumericLab.css';

export type NumMode = 'rules' | 'error';

export interface NumericLabProps {
  id: string;
  mode?: NumMode;
  /** the mode buttons shown (default: the starting mode only) */
  modes?: NumMode[];
  /** an NQ preset id (an ERROR_IDS id for the error mode) */
  f?: string;
  n?: number;
  rule?: QuadRule;
  both?: boolean;
  tasks?: string[];
}

interface Setup {
  mode: NumMode;
  /** preset of the rules mode */
  pR: NqId;
  /** preset of the error mode */
  pE: ErrorId;
  /** n of the rules mode, 1…64 (even for Simpson) */
  n: number;
  rule: QuadRule;
  both: boolean;
  /** the error mode's n = 2^k, k = 1…8 */
  k: number;
}

const ltr = (s: string) => String.fromCharCode(0x2066) + s.replace(/ /g, String.fromCharCode(0xa0)) + String.fromCharCode(0x2069);

const TASK_LABEL: Record<string, string> = {
  'nr-refine': `בכלל הטרפז הגדילו את ${ltr('n')} ל-16 או יותר. מה קורה לשגיאה?`,
  'nr-simpson': 'עברו לכלל סימפסון. במה הפרבולות שונות מהמיתרים?',
  'nr-convex': `בפונקציה ${ltr('eˣ')} ובכלל הטרפז הקטינו את ${ltr('n')} ל-4 או פחות. איפה המיתרים ביחס לגרף, ומה הסימן של השגיאה?`,
  'err-double': `הזיזו את הסמן לפחות שתי הכפלות של ${ltr('n')}. פי כמה קטנה כל שגיאה בכל הכפלה?`,
  'err-compare': `הגיעו ל-${ltr('n ≥ 64')}. פי כמה שגיאת סימפסון קטנה משגיאת הטרפז?`,
};

const MODE_LABEL: Record<NumMode, string> = { rules: 'טרפז וסימפסון', error: 'גודל השגיאה' };
const RULE_LABEL: Record<QuadRule, string> = { trap: 'טרפז', simpson: 'סימפסון' };

const N_MAX = 64;
const K_MIN = 1;
const K_MAX = 8;
const TAU = 2 * Math.PI;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const bool = (x: unknown): boolean | null => (typeof x === 'boolean' ? x : null);
const minus = (s: string) => s.replace(/-/g, '−');
/** a value to 10 significant figures, so the error is visible in it */
const val = (x: number) => minus(String(Number(x.toPrecision(10))));
const fmt = (x: number, sig = 3) => (Number.isNaN(x) ? '—' : x === 0 ? '0' : minus(sci(x, sig)));
const SUB = '₀₁₂₃₄₅₆₇₈₉';
const sub = (n: number) =>
  String(n)
    .split('')
    .map((c) => SUB[Number(c)] ?? c)
    .join('');
const nOfK = (k: number) => 2 ** k;
const kOfN = (n: number) => clamp(Math.round(Math.log2(Math.max(1, n))), K_MIN, K_MAX);
const isRule = (s: unknown): s is QuadRule => s === 'trap' || s === 'simpson';
/** n kept in 1…64 and even for Simpson (an odd n goes up by one) */
function fixN(n: number, rule: QuadRule): number {
  const m = clamp(Math.round(n), 1, N_MAX);
  return rule === 'simpson' && m % 2 === 1 ? Math.min(m + 1, N_MAX) : m;
}
/** the signed error of a rule at n; 0 when the stated bound is 0 (Simpson on the cubic: exact by the theorem) */
function errOf(id: NqId, n: number, rule: QuadRule): number {
  if (errorBound(id, n, rule) === 0) return 0;
  return approx(id, n, rule) - NQ[id].exact;
}
const symOf = (rule: QuadRule) => (rule === 'trap' ? 'T' : 'S');

/* ---- canvas helpers */
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
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
function square(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, paper: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = paper;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.rect(x - r, y - r, 2 * r, 2 * r);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
/** a marker of a series: circle for the trapezoid, square for Simpson */
function marker(ctx: CanvasRenderingContext2D, rule: QuadRule, x: number, y: number, r: number, color: string, paper: string) {
  if (rule === 'trap') dot(ctx, x, y, r, color, paper);
  else square(ctx, x, y, r * 0.88, color, paper);
}
function text(ctx: CanvasRenderingContext2D, p: Palette, s: string, x: number, y: number, o: { font: string; color?: string; align?: CanvasTextAlign; dir?: CanvasDirection }) {
  ctx.save();
  ctx.direction = o.dir ?? 'ltr';
  ctx.font = o.font;
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = withAlpha(p.paper, 0.9);
  ctx.strokeText(s, x, y);
  ctx.fillStyle = o.color ?? p.ink;
  ctx.fillText(s, x, y);
  ctx.restore();
}
/** "שיפוע −2": a Hebrew word on the right and an LTR number on its left, drawn as two runs so no bidi reordering can
 * move the minus sign; (x, y) is the left end */
function heNum(ctx: CanvasRenderingContext2D, p: Palette, he: string, n: string, x: number, y: number, font: string, color: string) {
  ctx.save();
  ctx.font = font;
  const wn = ctx.measureText(n).width;
  ctx.restore();
  text(ctx, p, n, x, y, { font, color, align: 'left' });
  text(ctx, p, he, x + wn + 5, y, { font, color, align: 'left', dir: 'rtl' });
}

function panel(w: number, h: number, bottom: number, left = 54): Box {
  const right = 14;
  const top = 12;
  return { x: left, y: top, w: Math.max(1, w - left - right), h: Math.max(1, h - top - bottom) };
}

interface TaskRule {
  needs: (keyof Setup)[];
  event?: boolean;
  state: (s: Setup, patch: Partial<Setup>) => boolean;
}

export default function NumericLab(props: NumericLabProps) {
  const startMode: NumMode = props.mode ?? 'rules';
  const modes: NumMode[] = props.modes ?? [startMode];
  const initial = (): Setup => {
    const rule: QuadRule = isRule(props.rule) ? props.rule : 'trap';
    const pn = num(props.n);
    return {
      mode: startMode,
      pR: isNqId(props.f) ? props.f : 'exp',
      pE: isErrorId(props.f) ? props.f : 'exp',
      n: fixN(startMode === 'rules' && pn !== null ? pn : 8, rule),
      rule,
      both: props.both ?? false,
      k: kOfN(startMode === 'error' && pn !== null ? pn : 4),
    };
  };
  const [setup, setSetup] = useState<Setup>(initial);
  const cur = useRef(setup);
  const [live, setLive] = useState('');
  const plot = useRef<Plot | null>(null);
  const dragging = useRef(false);
  /** the error mode's k that a step, a reset or the start put: err-double measures from it */
  const anchorK = useRef(setup.k);
  /** tasks whose state held when the last step or reset made it: they must be left and found again */
  const held = useRef<Set<string>>(new Set());

  const RULES: Record<string, TaskRule> = {
    'nr-refine': { needs: ['n', 'rule'], state: (s) => s.mode === 'rules' && s.rule === 'trap' && s.n >= 16 },
    'nr-simpson': { needs: ['rule'], event: true, state: (s, p) => s.mode === 'rules' && s.rule === 'simpson' && p.rule === 'simpson' },
    'nr-convex': { needs: ['n', 'rule', 'pR'], state: (s) => s.mode === 'rules' && s.pR === 'exp' && s.rule === 'trap' && s.n <= 4 },
    'err-double': { needs: ['k'], state: (s) => s.mode === 'error' && Math.abs(s.k - anchorK.current) >= 2 },
    'err-compare': {
      needs: ['k'],
      state: (s) => {
        if (s.mode !== 'error' || nOfK(s.k) < 64) return false;
        const n = nOfK(s.k);
        return Math.abs(errOf(s.pE, n, 'trap')) > 1000 * Math.abs(errOf(s.pE, n, 'simpson'));
      },
    },
  };

  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const done = (t: string) => {
    if (props.tasks?.includes(t)) markTask(`${props.id}:${t}`);
  };
  const rebase = (s: Setup) => {
    anchorK.current = s.k;
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
        const mode = typeof st.mode === 'string' && modes.includes(st.mode as NumMode) ? (st.mode as NumMode) : prev.mode;
        const next: Setup = { ...prev, mode };
        if (isNqId(st.f)) next.pR = st.f;
        if (isErrorId(st.f)) next.pE = st.f;
        next.rule = isRule(st.rule) ? st.rule : prev.rule;
        next.both = bool(st.both) ?? prev.both;
        const sn = num(st.n);
        next.n = fixN(mode === 'rules' && sn !== null ? sn : prev.n, next.rule);
        next.k = mode === 'error' && sn !== null ? kOfN(sn) : prev.k;
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

    if (s0.mode === 'rules') {
      const sp = NQ[s0.pR];
      const pl = makePlot(panel(view.w, view.h, 30), { min: sp.window.x[0], max: sp.window.x[1] }, { min: sp.window.y[0], max: sp.window.y[1] });
      plot.current = pl;
      drawAxes(ctx, pl, p);
      const { box } = pl;
      const zero = pl.py(0);
      line(ctx, box.x, zero, box.x + box.w, zero, withAlpha(p.ink2, 0.75), 1.2);
      if (sp.window.x[0] < 0 && sp.window.x[1] > 0) line(ctx, pl.px(0), box.y, pl.px(0), box.y + box.h, withAlpha(p.ink2, 0.75), 1.2);

      const n = s0.n;
      const { xs, ys } = nodes(s0.pR, n);
      /** the outline of a rule's pieces from a to b, sampled: chords exactly, parabolas 24 points each */
      const outline = (rule: QuadRule): [number, number][] => {
        if (rule === 'trap') return xs.map((x, i) => [x, ys[i]]);
        const pts: [number, number][] = [];
        for (const q of pieces(s0.pR, n, 'simpson'))
          for (let j = pts.length ? 1 : 0; j <= 24; j++) {
            const x = q.x0 + ((q.x2 - q.x0) * j) / 24;
            pts.push([x, parabolaAt(q, x)]);
          }
        return pts;
      };
      const stroke = (pts: [number, number][], color: string, width: number, dash: number[] = []) => {
        ctx.save();
        ctx.beginPath();
        ctx.rect(box.x, box.y - 2, box.w, box.h + 4);
        ctx.clip();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineJoin = 'round';
        ctx.setLineDash(dash);
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(pl.px(x), pl.py(y)) : ctx.moveTo(pl.px(x), pl.py(y))));
        ctx.stroke();
        ctx.restore();
      };

      // the region under the chosen rule's pieces, faint
      const main = outline(s0.rule);
      ctx.save();
      ctx.beginPath();
      ctx.rect(box.x, box.y, box.w, box.h);
      ctx.clip();
      ctx.beginPath();
      ctx.moveTo(pl.px(sp.a), zero);
      for (const [x, y] of main) ctx.lineTo(pl.px(x), pl.py(y));
      ctx.lineTo(pl.px(sp.b), zero);
      ctx.closePath();
      ctx.fillStyle = withAlpha(p.accent, 0.13);
      ctx.fill();
      ctx.restore();
      // the vertical sides of the pieces: every node for the trapezoid; for Simpson the ends of each pair solid and its
      // middle dashed
      xs.forEach((x, i) => {
        const mid = s0.rule === 'simpson' && i % 2 === 1;
        line(ctx, pl.px(x), zero, pl.px(x), pl.py(ys[i]), withAlpha(p.accent, mid ? 0.4 : 0.55), 1, mid ? [3, 3] : []);
      });
      // f itself
      const fpts: [number, number][] = [];
      for (let i = 0; i <= 400; i++) {
        const x = sp.window.x[0] + ((sp.window.x[1] - sp.window.x[0]) * i) / 400;
        fpts.push([x, sp.f(x)]);
      }
      stroke(fpts, p.curve, 2.6);
      // the other rule, dashed (Simpson only for an even n)
      const other: QuadRule = s0.rule === 'trap' ? 'simpson' : 'trap';
      if (s0.both && (other === 'trap' || n % 2 === 0)) stroke(outline(other), p.ink2, 1.7, [6, 4]);
      // the chosen rule's chords or parabolas
      stroke(main, p.accent, 2.2);
      // the nodes
      const r = n > 32 ? 2.2 : n > 16 ? 3 : 4.2;
      xs.forEach((x, i) => dot(ctx, pl.px(x), pl.py(ys[i]), r, p.accent, p.paper));
      // labels: f at the right end of the curve
      const xr = sp.window.x[1];
      text(ctx, p, 'f', Math.min(pl.px(xr) - 4, box.x + box.w - 10), clamp(pl.py(sp.f(xr)) - 12, box.y + 10, box.y + box.h - 10), { font: font(700), color: p.curve, align: 'right' });
      return;
    }

    // error: log–log
    const id = s0.pE;
    const eT = DOUBLINGS.map((n) => Math.abs(errOf(id, n, 'trap')));
    const eS = DOUBLINGS.map((n) => Math.abs(errOf(id, n, 'simpson')));
    const all = [...eT, ...eS].filter((v) => v > 0);
    const yMin = 10 ** Math.floor(Math.log10(Math.min(...all) / 2));
    const yMax = 10 ** Math.ceil(Math.log10(Math.max(...all) * 1.5));
    const pl = makePlot(
      panel(view.w, view.h, 50, 64),
      { min: 1.6, max: 320, scale: 'log', ticks: [...DOUBLINGS], format: (v) => String(v), label: 'מספר הקטעים n' },
      { min: yMin, max: yMax, scale: 'log' },
    );
    plot.current = pl;
    drawAxes(ctx, pl, p);
    const { box } = pl;
    // y title, rotated, in the left margin
    ctx.save();
    ctx.translate(13, box.y + box.h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.font = font(600);
    ctx.fillStyle = p.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.fillText('גודל השגיאה', 0, 0);
    ctx.restore();

    const clip = () => {
      ctx.beginPath();
      ctx.rect(box.x, box.y, box.w, box.h);
      ctx.clip();
    };
    // guide lines, parallel above each series: through 4·|E(256)| at n = 256, slopes −2 and −4
    const last = DOUBLINGS.length - 1;
    const guides: { slope: number; at: number; label: string }[] = [
      { slope: 2, at: eT[last] * 4, label: '−2' },
      { slope: 4, at: eS[last] * 4, label: '−4' },
    ];
    for (const g of guides) {
      const gy = (n: number) => g.at * (256 / n) ** g.slope;
      ctx.save();
      clip();
      line(ctx, pl.px(1.6), pl.py(gy(1.6)), pl.px(320), pl.py(gy(320)), withAlpha(p.ink2, 0.8), 1.2, [5, 4]);
      ctx.restore();
      // the label where the guide is inside the box, about a third of the way along
      let nl = 4;
      while (nl < 64 && pl.py(gy(nl)) < box.y + 24) nl *= 2;
      heNum(ctx, p, 'שיפוע', g.label, pl.px(nl) + 6, pl.py(gy(nl)) - 10, font(600, fs - 1), p.ink2);
    }
    // the two series
    const series: { rule: QuadRule; e: number[]; color: string }[] = [
      { rule: 'trap', e: eT, color: p.accent },
      { rule: 'simpson', e: eS, color: p.hand },
    ];
    for (const sr of series) {
      ctx.save();
      clip();
      ctx.strokeStyle = sr.color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      sr.e.forEach((v, i) => (i ? ctx.lineTo(pl.px(DOUBLINGS[i]), pl.py(v)) : ctx.moveTo(pl.px(DOUBLINGS[i]), pl.py(v))));
      ctx.stroke();
      ctx.restore();
      sr.e.forEach((v, i) => marker(ctx, sr.rule, pl.px(DOUBLINGS[i]), pl.py(v), 4.2, sr.color, p.paper));
    }
    // the current n
    const kk = s0.k - 1;
    const nx = pl.px(DOUBLINGS[kk]);
    line(ctx, nx, box.y, nx, box.y + box.h, withAlpha(p.ink, 0.6), 1.3, [3, 4]);
    for (const sr of series) {
      const y = pl.py(sr.e[kk]);
      ctx.save();
      ctx.strokeStyle = sr.color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      if (sr.rule === 'trap') ctx.arc(nx, y, 9, 0, TAU);
      else ctx.rect(nx - 8, y - 8, 16, 16);
      ctx.stroke();
      ctx.restore();
      marker(ctx, sr.rule, nx, y, 5.5, sr.color, p.paper);
    }
    // legend, bottom left (the errors fall to the right, so that corner is empty)
    const lx = box.x + 12;
    const ly = box.y + box.h - 34;
    marker(ctx, 'trap', lx + 5, ly, 4.5, p.accent, p.paper);
    text(ctx, p, `כלל הטרפז`, lx + 16, ly, { font: font(600), color: p.ink, dir: 'rtl', align: 'left' });
    marker(ctx, 'simpson', lx + 5, ly + 18, 4.5, p.hand, p.paper);
    text(ctx, p, `כלל סימפסון`, lx + 16, ly + 18, { font: font(600), color: p.ink, dir: 'rtl', align: 'left' });
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1.6, worldHeight: 1, animate: false });
  useEffect(invalidate, [setup]);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const upd = () => setNarrow(el.getBoundingClientRect().width < 520);
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(invalidate, [narrow]);
  const aspect = setup.mode === 'rules' ? (narrow ? 1.15 : 1.5) : narrow ? 0.95 : 1.3;

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

  const setN = (v: number) => {
    const c = cur.current;
    const nn = fixN(v, c.rule);
    if (nn !== c.n) apply({ n: nn });
  };
  const setK = (v: number) => {
    const kk = clamp(Math.round(v), K_MIN, K_MAX);
    if (kk !== cur.current.k) apply({ k: kk });
  };
  const setRule = (rule: QuadRule) => {
    const c = cur.current;
    if (rule === c.rule) return;
    const nn = fixN(c.n, rule);
    apply(nn !== c.n ? { rule, n: nn } : { rule });
    setLive(describe(cur.current));
  };

  const kFromPointer = (e: PointerEvent) => {
    const pl = plot.current;
    if (!pl) return;
    const lo = Math.log10(pl.x.min);
    const hi = Math.log10(pl.x.max);
    const n = 10 ** (lo + ((e.offsetX - pl.box.x) / pl.box.w) * (hi - lo));
    setK(kOfN(n));
  };
  const onPointerDown = (e: PointerEvent) => {
    if (cur.current.mode !== 'error') return;
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    kFromPointer(e);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (dragging.current) kFromPointer(e);
  };
  const onPointerUp = () => {
    if (dragging.current) setLive(describe(cur.current));
    dragging.current = false;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const c = cur.current;
    const sgn = e.key === 'ArrowLeft' ? -1 : 1;
    if (c.mode === 'rules') setN(c.n + sgn * (c.rule === 'simpson' ? 2 : 1));
    else setK(c.k + sgn);
    setLive(describe(cur.current));
  };

  /* ---------------------------------------------------------------- text */
  const M = (q: { children: ComponentChildren }) => <bdi dir="ltr">{q.children}</bdi>;

  function describe(s: Setup): string {
    if (s.mode === 'rules') {
      const sym = `${symOf(s.rule)}${sub(s.n)}`;
      return `${RULE_LABEL[s.rule]}, n = ${s.n}: ${sym} = ${val(approx(s.pR, s.n, s.rule))}, השגיאה ${fmt(errOf(s.pR, s.n, s.rule))}.`;
    }
    const n = nOfK(s.k);
    return `n = ${n}: שגיאת הטרפז ${fmt(errOf(s.pE, n, 'trap'))}, שגיאת סימפסון ${fmt(errOf(s.pE, n, 'simpson'))}.`;
  }

  const spR = NQ[setup.pR];
  const spE = NQ[setup.pE];

  const label =
    setup.mode === 'rules'
      ? `איור חי: קירוב האינטגרל של ${spR.text} על ${spR.abText} ב${setup.rule === 'trap' ? 'כלל הטרפז: מיתרים בין נקודות החלוקה' : 'כלל סימפסון: פרבולה מעל כל זוג קטעים'}, עם ${setup.n} קטעים. השטח שמתחת לקירוב מסומן בצבע חלש${setup.both ? ', והכלל השני מצויר בקו מקווקו' : ''}.`
      : `איור חי: גודל השגיאה של כלל הטרפז (עיגולים) ושל כלל סימפסון (ריבועים) עבור ${spE.text} על ${spE.abText}, כפונקציה של n = 2, 4, …, 256, בסקאלה לוגריתמית בשני הצירים. הקווים המקווקווים הם קווי עזר בשיפוע −2 ו־−4.`;

  let readout: ComponentChildren;
  if (setup.mode === 'rules') {
    const n = setup.n;
    const sym = `${symOf(setup.rule)}${sub(n)}`;
    const other: QuadRule = setup.rule === 'trap' ? 'simpson' : 'trap';
    const oSym = `${symOf(other)}${sub(n)}`;
    const otherOk = other === 'trap' || n % 2 === 0;
    const h = (spR.b - spR.a) / n;
    const bound = errorBound(setup.pR, n, setup.rule);
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>f(x) = {spR.text}</M>, <M>[a, b] = {spR.abText}</M>
        </span>
        <span class="q" data-readout="n">
          <M>
            n = <b>{n}</b>
          </M>
          , <M>h = (b − a)/n = {fmt(h, 4)}</M>
        </span>
        <span class="q" data-readout="approx">
          {setup.rule === 'trap' ? 'כלל הטרפז' : 'כלל סימפסון'}:{' '}
          <M>
            {sym} = <b>{val(approx(setup.pR, n, setup.rule))}</b>
          </M>
        </span>
        <span class="q" data-readout="exact">
          הערך המדויק:{' '}
          <M>
            I = ∫ₐᵇ f(x) dx = {spR.exactText !== null && spR.exactText !== val(spR.exact) ? `${spR.exactText} = ` : ''}
            <b>{val(spR.exact)}</b>
          </M>
          {spR.exactText === null && ' (אין לו נוסחה בפונקציות שלמדנו; זה ערכו בעשר ספרות)'}
        </span>
        <span class="q" data-readout="error">
          השגיאה:{' '}
          <M>
            {sym} − I = <b>{fmt(errOf(setup.pR, n, setup.rule))}</b>
          </M>
        </span>
        <span class="q" data-readout="bound">
          חסם השגיאה:{' '}
          {setup.rule === 'trap' ? (
            <>
              <M>
                |{sym} − I| ≤ (b − a)³M₂/(12n²) = <b>{fmt(bound)}</b>
              </M>
              , <M>M₂ = max|f″| = {spR.M2text}</M>
            </>
          ) : (
            <>
              <M>
                |{sym} − I| ≤ (b − a)⁵M₄/(180n⁴) = <b>{fmt(bound)}</b>
              </M>
              , <M>M₄ = max|f⁽⁴⁾| = {spR.M4text}</M>
            </>
          )}
        </span>
        {setup.both && (
          <span class="q" data-readout="other">
            {other === 'trap' ? 'כלל הטרפז (מקווקו)' : 'כלל סימפסון (מקווקו)'}:{' '}
            {otherOk ? (
              <>
                <M>
                  {oSym} = {val(approx(setup.pR, n, other))}
                </M>
                , השגיאה <M>{fmt(errOf(setup.pR, n, other))}</M>
              </>
            ) : (
              'לא מוצג כש-n אי-זוגי'
            )}
          </span>
        )}
        {(setup.rule === 'simpson' || (setup.both && n % 2 === 1)) && (
          <span class="q" data-readout="even">
            בסימפסון <M>n</M> זוגי
          </span>
        )}
      </>
    );
  } else {
    const n = nOfK(setup.k);
    const eT = errOf(setup.pE, n, 'trap');
    const eS = errOf(setup.pE, n, 'simpson');
    const ratio = (rule: QuadRule, target: number) => {
      if (n < 4) return <>— (בחרו <M>n ≥ 4</M>)</>;
      const r = errOf(setup.pE, n / 2, rule) / errOf(setup.pE, n, rule);
      const close = Math.abs(r - target) <= 0.05 * target;
      return (
        <>
          <M>
            E({n / 2})/E({n}) = <b>{minus(r.toFixed(2))}</b>
            {close ? ` ≈ ${target}` : ''}
          </M>
          {!close && (
            <>
              {' '}
              (ב-<M>n</M> גדול יותר: <M>≈ {target}</M>)
            </>
          )}
        </>
      );
    };
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>f(x) = {spE.text}</M>, <M>[a, b] = {spE.abText}</M>
        </span>
        <span class="q" data-readout="n">
          <M>
            n = <b>{n}</b>
          </M>
        </span>
        <span class="q" data-readout="err-trap">
          שגיאת הטרפז:{' '}
          <M>
            T{sub(n)} − I = <b>{fmt(eT)}</b>
          </M>
        </span>
        <span class="q" data-readout="err-simp">
          שגיאת סימפסון:{' '}
          <M>
            S{sub(n)} − I = <b>{fmt(eS)}</b>
          </M>
        </span>
        <span class="q" data-readout="ratio-trap">
          היחס בטרפז: {ratio('trap', 4)}
        </span>
        <span class="q" data-readout="ratio-simp">
          היחס בסימפסון: {ratio('simpson', 16)}
        </span>
        <span class="q" data-readout="compare">
          שגיאת הטרפז גדולה משגיאת סימפסון פי <M><b>{fmt(Math.abs(eT / eS), 3)}</b></M>
        </span>
      </>
    );
  }

  const presetIds: readonly string[] = setup.mode === 'rules' ? NQ_IDS : ERROR_IDS;
  const chosen = setup.mode === 'rules' ? setup.pR : setup.pE;

  return (
    <SimShell
      fig={props.id}
      label={label}
      canvasRef={canvasRef}
      aspect={aspect}
      live={live}
      tasks={tasks}
      cursor={setup.mode === 'error' ? 'ew-resize' : 'default'}
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
          <label class="nl-select" data-control="preset">
            <span class="nl-lab">הפונקציה</span>
            <select
              dir="ltr"
              value={chosen}
              onChange={(e) => {
                const v = (e.target as HTMLSelectElement).value;
                const c = cur.current;
                if (c.mode === 'rules' && isNqId(v)) apply({ pR: v });
                else if (c.mode === 'error' && isErrorId(v)) apply({ pE: v });
                setLive(describe(cur.current));
              }}
            >
              {presetIds.map((id) => (
                <option key={id} value={id}>
                  {isNqId(id) ? `${NQ[id].text}, ${NQ[id].abText}` : id}
                </option>
              ))}
            </select>
          </label>
          {setup.mode === 'rules' && (
            <>
              <div class="group" role="group" aria-label="כלל הקירוב">
                {(['trap', 'simpson'] as const).map((r) => (
                  <Toggle key={r} label={RULE_LABEL[r]} on={setup.rule === r} swatch="var(--accent)" onChange={() => setRule(r)} />
                ))}
              </div>
              <div class="group" role="group" aria-label="השוואה">
                <Toggle label="השוואה לכלל השני" on={setup.both} swatch="var(--ink-2)" onChange={(on) => apply({ both: on })} />
              </div>
              <div class="nl-ctl" data-control="n">
                <Slider
                  label={setup.rule === 'simpson' ? 'מספר הקטעים n (זוגי)' : 'מספר הקטעים n'}
                  value={setup.n}
                  min={setup.rule === 'simpson' ? 2 : 1}
                  max={N_MAX}
                  step={setup.rule === 'simpson' ? 2 : 1}
                  format={(v) => `n = ${v}`}
                  onChange={setN}
                />
              </div>
            </>
          )}
          {setup.mode === 'error' && (
            <div class="nl-ctl" data-control="n">
              <Slider label="מספר הקטעים n (הכפלות)" value={setup.k} min={K_MIN} max={K_MAX} step={1} format={(v) => `n = ${nOfK(v)}`} onChange={setK} />
            </div>
          )}
        </>
      }
    />
  );
}
