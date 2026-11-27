/**
 * TaylorLab (chapter 6, Taylor series): five modes on one canvas. Maths: src/math/taylor.ts (jets: every coefficient
 * is exact, never a finite difference; the radius and the ends of each series are stored facts, never inferred).
 * Ported from unimech's TaylorLab (taylor mode) and rebuilt for mathematics; no secant mode (that is LinearizeLab).
 * Canvases are math space and stay LTR; sliders for math quantities are `dir="ltr"`.
 *
 * mode 'build':     f (curve) and T_n about x₀ (accent). x₀ is dragged on the graph (grab it near its marker) or set by
 *                   its slider within the preset's x0Range; the order n by a slider 0…20 and −/+ buttons; `ladder` draws
 *                   T₀…T_{n−1} faint; `band` shades the interval around x₀ where |f − T_n| ≤ tol·max(1, |f|) (a probe);
 *                   a probe x (drag it anywhere else on the graph, or ←/→) with f(x), T_n(x) and the gap. The readout
 *                   writes T_n in powers of (x − x₀), coefficients as p/q (q ≤ 10⁶) or 4 significant digits, and says
 *                   "T_n זהה ל-f" when f is a polynomial of degree ≤ n. For binom a slider for a.
 * mode 'remainder': top: f and T_n with the interval [x₀ − δ, x₀ + δ] (clipped to the domain) shaded; bottom (log y): the
 *                   sampled error |f − T_n| on the interval (a probe), the Lagrange bound B (solid) and ε (dashed).
 *                   The readout says how M was taken (exact at an end / the standard 1 for sin, cos / sampled, a probe /
 *                   0 for a polynomial) and the verdict "B < ε: הסדר מספיק" or "B ≥ ε: צריך סדר גבוה יותר".
 * mode 'lead':      a LEAD preset g near 0, its leading term c xᵏ dashed, with `next` the two-term model c xᵏ + d xᵐ
 *                   (accent); the cursor x by a log slider for |x| from 1 down to 10⁻³ and a sign toggle. The window
 *                   zooms with |x|. Readout g(x), c xᵏ and the quotient g(x)/xᵏ approaching c (`--limit`).
 * mode 'radius':    a preset with a series about 0: f and the partial sum T_n (n 0…60); the interval of convergence on
 *                   the x-axis, ends filled (converges there) or hollow (diverges), arrows for R = ∞; a probe x with a
 *                   table of T_5, T_10, T_20, T_40 at x and the term a_n xⁿ. `complex` (lorentz, arctan): an inset of the
 *                   complex plane with ±i and the disc of radius R.
 * mode 'leibniz':   a LEIBNIZ preset: S_1…S_{n+1} as points over n (log n-axis past 50) around the line y = S
 *                   (`--limit`); the y-window zooms to ±1.6·b_{n+1} around S. `bracket` draws the bracket from S_n to
 *                   S_{n+1} with S inside it. n is 1…2000 on a log-like slider (every integer to 100) and −/+ buttons.
 *
 * Props (defaults): id (required); mode ('build'); modes (the mode buttons shown; default the starting mode only);
 * tasks ([]); presets (ADDED to the brief: the preset chips offered, ids of TF, LEAD or LEIBNIZ; each mode shows those of
 * its own registry, plus the current preset when a step chose another one; default per mode: build exp, sin, cos, ln1p,
 * geom, arctan, binom, gauss, expsin, poly, ln, sqrt; remainder exp, sin, cos, ln1p, geom, ln, sqrt; lead all six;
 * radius exp, ln1p, geom, lorentz, arctan, tan, sqrt1p, binom; leibniz all four; `presets={[]}` hides the chips). The props f, x0, n, x go to the STARTING mode:
 *   build      f ('exp'), x0 (the preset's), n (1), ladder (false), band (false), tol (0.01: 0.1 | 0.01 | 0.001), x (preset)
 *   remainder  f ('exp'), x0, n (3), delta (the preset's, 0.1…3), eps (1e-3: 1e-1 … 1e-8)
 *   lead       g ('sin-x'), x (0.5; |x| in [10⁻³, 1]), next (false)
 *   radius     f ('ln1p'; a preset with a series about 0), n (10; 0…60), x (preset), complex (false)
 *   leibniz    series ('ln2'), n (10; 1…2000), bracket (false)
 *   a          binom's exponent (0.5; −3…3), shared by every mode. binom's chip reads "(1 + x)ᵃ" whatever a is (so it never
 *              duplicates √(1 + x)); the fn readouts give a apart ("f(x) = (1 + x)ᵃ, a = 1/2").
 * Every prop is also a step key (`<Step fig=… set={{…}}>`); a key left out keeps its value. In a step, f, x0, n and x go
 * to the mode the step leaves the figure in; a new f resets that mode's x0, x (and δ in remainder) to the preset's
 * defaults unless the step gives them. A state set by a step never ticks a task; a state task that already held when a
 * step or reset made the state must be left and found again.
 *
 * Tasks (ticked only inside the learner's own slider, button, toggle, chip, drag or key):
 *   build:     build-order2 (n set to 2), build-poly (preset poly with n ≥ 3), build-odd (sin about 0, n raised from an
 *              odd n to n + 1), build-band (band on, n raised until the band reaches |x − x₀| ≥ 2 on one side),
 *              build-move (x₀ moved)
 *   remainder: rem-enough (n set to the first order with B < ε), rem-widen (δ doubled, from its smallest value since n,
 *              f, x₀ or a last changed, at fixed n: B grows), rem-gap (n or δ changed while the sampled error ≤ B, both
 *              drawn: B > 0)
 *   lead:      lead-close (|x| ≤ 10⁻²), lead-next (next turned on at |x| ≥ 0.5, where the two-term model is closer)
 *   radius:    radius-outside (|x| > R finite and n ≥ 20), radius-edge (ln1p, |x − 1| ≤ 0.01, n ≥ 40), radius-complex
 *              (lorentz, complex turned on)
 *   leibniz:   leibniz-bracket (bracket on and n moved), leibniz-bound (ln2, n ≥ 1000), leibniz-fast (einv, n with
 *              b_{n+1} < 10⁻⁴, i.e. n ≥ 8)
 *
 * data-* hooks for e2e specs (inside the figure's `#fig-…` element):
 *   mode buttons   [data-mode="build|remainder|lead|radius|leibniz"] button      (shown when modes has > 1 entry)
 *   preset chips   [data-preset="<id>"] button                                    (ids from `presets`, this mode's)
 *   sliders        [data-slider="n|x0|x|a|delta|eps"] input[type=range]
 *                  n: build/remainder 0…20, radius 0…60, leibniz the INDEX into 1…100, 105…200 (5), 210…500 (10),
 *                  520…1000 (20), 1050…2000 (50); eps: the exponent 1…8 (ε = 10⁻ᵉ); lead x: −log₁₀|x| in 0…3, step 0.05
 *   buttons        [data-action="n-minus|n-plus"]                                 (build, leibniz)
 *   toggles        [data-toggle="ladder|band|sign|next|complex|bracket"] button   (aria-pressed)
 *   tol chips      [data-tol="0.1|0.01|0.001"] button                             (build)
 *   readouts       [data-readout="…"]:
 *     build      fn, n, poly ("T₃(x) = 1 − x²/2"), same ("T₃ זהה ל-f", only then), x, fx, tx, err, band (band on)
 *     remainder  fn, n, interval, M (with how it was taken), B, err (sampled max, a probe), verdict
 *     lead       fn, lead, next (next on), x, gx, cx, quot (g(x)/xᵏ → c), errs (next on; g, g − c xᵏ and the two-term
 *                error come from LEAD's series near 0, true to ~1e-15 relative, never by cancelling subtraction)
 *     radius     fn (with R), n, x, table (T_5 … T_40 and f(x)), term (a_n xⁿ), verdict, complex (complex on; on a
 *                canvas under 520 px the complex inset is drawn under the plot, and the canvas grows taller)
 *     leibniz    fn (with S), n, sn, bound (b_{n+1}), err (|S − S_n|), bracket (bracket on)
 *   tasks          ol.sim-tasks li (SimShell); progress key `${id}:${task}` in localStorage 'matap1lab:v1'.
 * Each equation in a readout is ONE LTR isolate (<bdi dir="ltr">), never split around "=" (the RTL row would reverse
 * it). Labels drawn near the top right of the plot stay left of SimShell's ↺ / ⛶ buttons (TOOLS_W).
 * Numbers use U+2212 for minus. Canvas keys: build/radius ←/→ probe, ↑/↓ n; remainder ↑/↓ n, ←/→ δ; lead ←/→ |x|;
 * leibniz ←/→ n.
 */

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import {
  LEAD,
  LEIBNIZ,
  LEIBNIZ_MAX,
  TF,
  degreeOf,
  domainOf,
  endsOf,
  fmtPoint,
  fnOf,
  goodBand,
  hasSeriesAt0,
  isLeadId,
  isLeibnizId,
  isTfId,
  leibnizSums,
  monoText,
  polyText,
  radiusOf,
  remainderInfo,
  remainderInterval,
  seriesCoeffs,
  taylorCoeffs,
  taylorPoly,
  textOf,
  aText,
  type Band,
  type Fn,
  type LeadId,
  type LeibnizId,
  type RemainderInfo,
  type TfId,
} from '~/math/taylor';
import { markTask } from '~/progress/store';
import { subscribeSteps, type StepState } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { sci } from './core/format';
import { withAlpha } from './core/ink';
import { drawAxes, insetBox, makePlot, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import './TaylorLab.css';

export type TaylorMode = 'build' | 'remainder' | 'lead' | 'radius' | 'leibniz';
type Tol = 0.1 | 0.01 | 0.001;

export interface TaylorLabProps {
  id: string;
  mode?: TaylorMode;
  /** the mode buttons shown (default: the starting mode only) */
  modes?: TaylorMode[];
  /** the preset chips offered (TF, LEAD or LEIBNIZ ids); default none */
  presets?: string[];
  tasks?: string[];
  f?: string;
  x0?: number;
  n?: number;
  ladder?: boolean;
  band?: boolean;
  tol?: number;
  x?: number;
  a?: number;
  delta?: number;
  eps?: number;
  g?: string;
  next?: boolean;
  complex?: boolean;
  series?: string;
  bracket?: boolean;
}

interface Setup {
  mode: TaylorMode;
  a: number;
  fB: TfId;
  x0B: number;
  nB: number;
  ladder: boolean;
  band: boolean;
  tol: Tol;
  xB: number;
  fR: TfId;
  x0R: number;
  nR: number;
  delta: number;
  /** ε = 10^(−epsE), epsE = 1…8 */
  epsE: number;
  g: LeadId;
  xG: number;
  next: boolean;
  fS: TfId;
  nS: number;
  xS: number;
  complex: boolean;
  series: LeibnizId;
  nL: number;
  bracket: boolean;
}

const MODE_LABEL: Record<TaylorMode, string> = {
  build: 'בנייה',
  remainder: 'שארית',
  lead: 'איבר מוביל',
  radius: 'תחום התכנסות',
  leibniz: 'טור לייבניץ',
};

/** a preset's name with binom's exponent given, for labels and announcements */
const fullText = (id: TfId, a: number) => (id === 'binom' ? `${textOf(id, a)}, a = ${aText(a)}` : textOf(id, a));
const ltr = (s: string) => String.fromCharCode(0x2066) + s.replace(/ /g, String.fromCharCode(0xa0)) + String.fromCharCode(0x2069);

const TASK_LABEL: Record<string, string> = {
  'build-order2': 'קבעו את הסדר ל-2. איך הפרבולה נצמדת לגרף ליד x₀?',
  'build-poly': `בחרו את ${ltr('x³ − 2x + 1')} וקבעו סדר 3 או יותר. מה קורה לפער בין הגרפים?`,
  'build-odd': `ב-${ltr('sin x')} סביב 0 עלו מסדר אי-זוגי לסדר הבא. האם הפולינום השתנה?`,
  'build-band': 'הדליקו את רצועת הדיוק והעלו את הסדר עד שהרצועה מגיעה למרחק 2 מ-x₀.',
  'build-move': 'הזיזו את x₀. מה קורה לפולינום?',
  'rem-enough': 'שנו את הסדר n עד הסדר הראשון שבו B קטן מ-ε.',
  'rem-widen': 'הכפילו את חצי הרוחב δ בלי לשנות את הסדר. מה קורה ל-B?',
  'rem-gap': 'שנו את n או את δ, והשוו את השגיאה שנדגמה לחסם B.',
  'lead-close': `הקטינו את |x| עד ${ltr('10⁻²')} או פחות. לאן הולכת המנה?`,
  'lead-next': 'ב-|x| של 0.5 לפחות הדליקו את האיבר הבא. איזה קירוב קרוב יותר?',
  'radius-outside': 'הזיזו את x אל מחוץ לתחום ההתכנסות וקבעו סדר 20 לפחות. מה עושים הסכומים החלקיים?',
  'radius-edge': `ב-${ltr('ln(1 + x)')} הזיזו את x ל-1 וקבעו סדר 40 לפחות. לאן מתקרבים הסכומים?`,
  'radius-complex': `ב-${ltr('1/(1 + x²)')} הדליקו את המישור המרוכב. מה נמצא במרחק 1 מ-0?`,
  'leibniz-bracket': 'הדליקו את הסוגר והזיזו את n. איפה נמצא הסכום S?',
  'leibniz-bound': `בטור של ${ltr('ln 2')} הגיעו ל-n של 1000 לפחות. מה החסם ${ltr('bₙ₊₁')}?`,
  'leibniz-fast': `בטור של ${ltr('1/e')} מצאו n שבו ${ltr('bₙ₊₁ < 10⁻⁴')}.`,
};

const TOLS: Tol[] = [0.1, 0.01, 0.001];

/** the preset chips of each mode when the lesson gives no `presets` (build: the brief's 6.1 and 6.3 lists together) */
const DEFAULT_PRESETS: Record<TaylorMode, string[]> = {
  build: ['exp', 'sin', 'cos', 'ln1p', 'geom', 'arctan', 'binom', 'gauss', 'expsin', 'poly', 'ln', 'sqrt'],
  remainder: ['exp', 'sin', 'cos', 'ln1p', 'geom', 'ln', 'sqrt'],
  lead: ['sin-x', '1-cos', 'exp-1-x', 'ln1p-x', 'tan-x', 'sinc'],
  radius: ['exp', 'ln1p', 'geom', 'lorentz', 'arctan', 'tan', 'sqrt1p', 'binom'],
  leibniz: ['ln2', 'pi4', 'einv', 'sin1'],
};
/** SimShell's reset and full-screen buttons cover the canvas's top-right 82 × 42 px: a label's right end stays this far
 * left of the plot box's right edge (PAD.r 16 + 84 > 82) */
const TOOLS_W = 84;
/** the complex-plane inset on a narrow canvas, drawn under the plot */
const INSET_NARROW = 96;
const insetBelow = (s: { mode: TaylorMode; complex: boolean; fS: TfId }) => s.mode === 'radius' && s.complex && (s.fS === 'lorentz' || s.fS === 'arctan');
const N_BUILD = 20;
const N_RADIUS = 60;
const LEAD_E_MAX = 3;
const LEAD_E_STEP = 0.05;
const TAU = 2 * Math.PI;

/** the n values of the leibniz slider: every integer to 100, then 2–3 significant figures up to 2000 */
const NS: number[] = (() => {
  const out: number[] = [];
  for (let n = 1; n <= 100; n++) out.push(n);
  for (let n = 105; n <= 200; n += 5) out.push(n);
  for (let n = 210; n <= 500; n += 10) out.push(n);
  for (let n = 520; n <= 1000; n += 20) out.push(n);
  for (let n = 1050; n <= LEIBNIZ_MAX; n += 50) out.push(n);
  return out;
})();
const nsIndex = (n: number) => {
  let best = 0;
  for (let i = 0; i < NS.length; i++) if (Math.abs(NS[i] - n) < Math.abs(NS[best] - n)) best = i;
  return best;
};

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const bool = (x: unknown): boolean | null => (typeof x === 'boolean' ? x : null);
const roundTo = (x: number, step: number) => Number((Math.round(x / step) * step).toPrecision(10));
const minus = (s: string) => s.replace(/-/g, '−');
const fmt = (x: number, sig = 4) => (Number.isNaN(x) ? '—' : x === 0 ? '0' : minus(sci(x, sig)));
const SUBS = '₀₁₂₃₄₅₆₇₈₉';
const SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sub = (k: number) => String(k).replace(/\d/g, (d) => SUBS[Number(d)]);
const sup = (k: number) => String(k).replace(/\d/g, (d) => SUPS[Number(d)]);
const isTol = (x: unknown): x is Tol => x === 0.1 || x === 0.01 || x === 0.001;
const tolText = (t: Tol) => (t === 0.1 ? '0.1' : t === 0.01 ? '0.01' : '0.001');
const epsText = (e: number) => `10⁻${sup(e)}`;
/** 10^l written as m·10ᵉ, for numbers below the smallest double */
function fmtLog10(l: number): string {
  if (l > -280) return fmt(10 ** l, 3);
  const e = Math.floor(l);
  return `${Number((10 ** (l - e)).toPrecision(3))}·10⁻${sup(-e)}`;
}
const fmtLeadX = (x: number) => {
  const e = -Math.log10(Math.abs(x));
  const sgn = x < 0 ? '−' : '';
  if (Math.abs(e - Math.round(e)) < 1e-9) return Math.round(e) === 0 ? `${sgn}1` : `${sgn}10⁻${sup(Math.round(e))}`;
  return fmt(x, 3);
};

/* ---- defaults */
const defFor = (mode: TaylorMode): TfId => (mode === 'radius' ? 'ln1p' : 'exp');
const x0Of = (id: TfId, v: number | null): number => {
  const r = TF[id].x0Range;
  return r ? clamp(v ?? TF[id].x0, r[0], r[1]) : TF[id].x0;
};
const probeOf = (id: TfId, v: number | null): number => {
  const w = TF[id].window.x;
  return clamp(v ?? TF[id].probe, w[0], w[1]);
};
const leadX = (v: number): number => {
  const s = v < 0 ? -1 : 1;
  return s * clamp(Math.abs(v) || 1e-3, 1e-3, 1);
};
const epsEOf = (v: number | null, prev: number) => (v !== null && v > 0 ? clamp(Math.round(-Math.log10(v)), 1, 8) : prev);

/* ---- tasks */
interface Rule {
  needs: (keyof Setup)[];
  event?: boolean;
  /** `base`: the smallest δ since n, f, x₀ or a last changed, and B there (rem-widen) */
  state: (s: Setup, patch: Partial<Setup>, prev: Setup, base: WidenBase) => boolean;
}
interface WidenBase {
  delta: number;
  B: number;
}

const bandReach = (s: Setup): number => {
  if (!s.band) return 0;
  const b = goodBand(s.fB, s.x0B, s.nB, s.tol, TF[s.fB].window.x, s.a);
  return Math.max(b.hi - s.x0B, s.x0B - b.lo);
};
const remB = (s: Setup, n = s.nR, delta = s.delta): number => {
  const [lo, hi] = remainderInterval(s.fR, s.x0R, delta, s.a);
  return remainderInfo(s.fR, s.x0R, n, lo, hi, s.a).B;
};
const remErr = (s: Setup): number => {
  const [lo, hi] = remainderInterval(s.fR, s.x0R, s.delta, s.a);
  return sampledError(s.fR, s.x0R, s.nR, lo, hi, s.a).max;
};
const leadCloser = (s: Setup) => {
  const L = LEAD[s.g];
  const r1 = L.rest(s.xG, 1);
  const r2 = L.rest(s.xG, 2);
  return Number.isFinite(r1) && Math.abs(r2) < Math.abs(r1);
};
const radiusR = (s: Setup) => radiusOf(s.fS, s.a) ?? Infinity;

const RULES: Record<string, Rule> = {
  'build-order2': { needs: ['nB'], event: true, state: (s, _p, prev) => s.mode === 'build' && s.nB === 2 && prev.nB !== 2 },
  'build-poly': {
    needs: ['nB', 'fB'],
    event: true,
    state: (s, _p, prev) => s.mode === 'build' && s.fB === 'poly' && s.nB >= 3 && !(prev.fB === 'poly' && prev.nB >= 3),
  },
  'build-odd': {
    needs: ['nB'],
    event: true,
    state: (s, _p, prev) => s.mode === 'build' && s.fB === 'sin' && Math.abs(s.x0B) < 1e-9 && prev.nB % 2 === 1 && s.nB === prev.nB + 1,
  },
  'build-band': {
    needs: ['nB'],
    event: true,
    state: (s, _p, prev) => s.mode === 'build' && s.band && s.nB > prev.nB && bandReach(s) >= 2 && !(prev.band && bandReach(prev) >= 2),
  },
  'build-move': { needs: ['x0B'], event: true, state: (s, _p, prev) => s.mode === 'build' && s.x0B !== prev.x0B },
  'rem-enough': {
    needs: ['nR'],
    event: true,
    state: (s) => s.mode === 'remainder' && remB(s) < 10 ** -s.epsE && (s.nR === 0 || remB(s, s.nR - 1) >= 10 ** -s.epsE),
  },
  'rem-widen': {
    needs: ['delta'],
    event: true,
    state: (s, p, _prev, b) => s.mode === 'remainder' && 'delta' in p && s.delta >= 2 * b.delta - 1e-9 && remB(s) > b.B,
  },
  'rem-gap': {
    needs: ['nR', 'delta'],
    event: true,
    state: (s) => {
      if (s.mode !== 'remainder') return false;
      const B = remB(s);
      const e = remErr(s);
      return B > 0 && Number.isFinite(B) && e > 0 && e <= B;
    },
  },
  'lead-close': { needs: ['xG'], state: (s) => s.mode === 'lead' && Math.abs(s.xG) <= 1e-2 * (1 + 1e-9) },
  'lead-next': {
    needs: ['next'],
    event: true,
    state: (s, _p, prev) => s.mode === 'lead' && s.next && !prev.next && Math.abs(s.xG) >= 0.5 - 1e-9 && leadCloser(s),
  },
  'radius-outside': {
    needs: ['xS', 'nS'],
    state: (s) => s.mode === 'radius' && Number.isFinite(radiusR(s)) && Math.abs(s.xS) > radiusR(s) + 1e-9 && s.nS >= 20,
  },
  'radius-edge': { needs: ['xS', 'nS'], state: (s) => s.mode === 'radius' && s.fS === 'ln1p' && Math.abs(s.xS - 1) <= 0.01 + 1e-9 && s.nS >= 40 },
  'radius-complex': { needs: ['complex'], event: true, state: (s, _p, prev) => s.mode === 'radius' && s.fS === 'lorentz' && s.complex && !prev.complex },
  'leibniz-bracket': { needs: ['nL'], event: true, state: (s, _p, prev) => s.mode === 'leibniz' && s.bracket && s.nL !== prev.nL },
  'leibniz-bound': { needs: ['nL'], state: (s) => s.mode === 'leibniz' && s.series === 'ln2' && s.nL >= 1000 },
  'leibniz-fast': { needs: ['nL'], state: (s) => s.mode === 'leibniz' && s.series === 'einv' && LEIBNIZ.einv.log10b(s.nL + 1) < -4 },
};

/** the error |f − T_n| on a grid of [lo, hi] (a probe): its largest value, where, and the profile for drawing */
function sampledError(id: TfId, x0: number, n: number, lo: number, hi: number, a: number, samples = 301) {
  const T = taylorPoly(taylorCoeffs(id, x0, n, a), x0);
  const f = fnOf(id, a);
  const xs: number[] = [];
  const es: number[] = [];
  let max = 0;
  let at = x0;
  for (let i = 0; i < samples; i++) {
    const x = lo + ((hi - lo) * i) / (samples - 1);
    const e = Math.abs(f(x) - T(x));
    xs.push(x);
    es.push(e);
    if (e > max) [max, at] = [e, x];
  }
  return { max, at, xs, es };
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
function triangle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, up: boolean, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + (up ? -r : r));
  ctx.lineTo(x - r, y + (up ? r : -r));
  ctx.lineTo(x + r, y + (up ? r : -r));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
/** y = f(x) on [lo, hi], clipped to the plot, broken where f is not finite; values far outside are clamped */
function stroke(ctx: CanvasRenderingContext2D, plot: Plot, f: Fn, lo: number, hi: number, color: string, width: number, dash: number[] = [], n = 400) {
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
  for (let i = 0; i <= n; i++) {
    const x = lo + ((hi - lo) * i) / n;
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
function shadeX(ctx: CanvasRenderingContext2D, plot: Plot, lo: number, hi: number, color: string) {
  const b = plot.box;
  const X1 = clamp(plot.px(lo), b.x, b.x + b.w);
  const X2 = clamp(plot.px(hi), b.x, b.x + b.w);
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(X1, b.y, Math.max(1, X2 - X1), b.h);
  ctx.restore();
}
function zeroLines(ctx: CanvasRenderingContext2D, plot: Plot, p: Palette) {
  const b = plot.box;
  if (plot.y.min < 0 && plot.y.max > 0) line(ctx, b.x, plot.py(0), b.x + b.w, plot.py(0), p.ink3, 1);
  if (plot.x.min < 0 && plot.x.max > 0) line(ctx, plot.px(0), b.y, plot.px(0), b.y + b.h, p.ink3, 1);
}

export default function TaylorLab(props: TaylorLabProps) {
  const startMode: TaylorMode = props.mode ?? 'build';
  const modes: TaylorMode[] = props.modes ?? [startMode];
  const initial = (): Setup => {
    const st = (m: TaylorMode) => startMode === m;
    const a = clamp(num(props.a) ?? 0.5, -3, 3);
    const pf = isTfId(props.f) ? props.f : null;
    const fB: TfId = st('build') && pf ? pf : defFor('build');
    const fR: TfId = st('remainder') && pf ? pf : defFor('remainder');
    const fS: TfId = st('radius') && pf && hasSeriesAt0(pf) ? pf : defFor('radius');
    const x0 = num(props.x0);
    const n = num(props.n);
    const x = num(props.x);
    return {
      mode: startMode,
      a,
      fB,
      x0B: x0Of(fB, st('build') ? x0 : null),
      nB: clamp(Math.round(st('build') && n !== null ? n : 1), 0, N_BUILD),
      ladder: props.ladder ?? false,
      band: props.band ?? false,
      tol: isTol(props.tol) ? props.tol : 0.01,
      xB: probeOf(fB, st('build') ? x : null),
      fR,
      x0R: x0Of(fR, st('remainder') ? x0 : null),
      nR: clamp(Math.round(st('remainder') && n !== null ? n : 3), 0, N_BUILD),
      delta: clamp(num(props.delta) ?? TF[fR].delta, 0.1, 3),
      epsE: epsEOf(num(props.eps), 3),
      g: isLeadId(props.g) ? props.g : 'sin-x',
      xG: leadX(st('lead') && x !== null ? x : 0.5),
      next: props.next ?? false,
      fS,
      nS: clamp(Math.round(st('radius') && n !== null ? n : 10), 0, N_RADIUS),
      xS: probeOf(fS, st('radius') ? x : null),
      complex: props.complex ?? false,
      series: isLeibnizId(props.series) ? props.series : 'ln2',
      nL: NS[nsIndex(st('leibniz') && n !== null ? n : 10)],
      bracket: props.bracket ?? false,
    };
  };
  const [setup, setSetup] = useState<Setup>(initial);
  const cur = useRef(setup);
  const [live, setLive] = useState('');
  const [narrow, setNarrow] = useState(false);
  const plotRef = useRef<Plot | null>(null);
  const drag = useRef<'x0' | 'probe' | null>(null);
  const held = useRef<Set<string>>(new Set());
  const base = useRef<WidenBase>({ delta: 0, B: 0 });

  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const done = (t: string) => {
    if (props.tasks?.includes(t)) markTask(`${props.id}:${t}`);
  };
  const rebase = (s: Setup) => {
    held.current = new Set((props.tasks ?? []).filter((id) => RULES[id] && !RULES[id].event && RULES[id].state(s, {}, s, base.current)));
    base.current = { delta: s.delta, B: remB(s) };
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
        const mode = typeof st.mode === 'string' && modes.includes(st.mode as TaylorMode) ? (st.mode as TaylorMode) : prev.mode;
        const next: Setup = { ...prev, mode };
        const x0 = num(st.x0);
        const n = num(st.n);
        const x = num(st.x);
        next.a = clamp(num(st.a) ?? prev.a, -3, 3);
        next.ladder = bool(st.ladder) ?? prev.ladder;
        next.band = bool(st.band) ?? prev.band;
        if (isTol(st.tol)) next.tol = st.tol;
        next.epsE = epsEOf(num(st.eps), prev.epsE);
        if (isLeadId(st.g)) next.g = st.g;
        next.next = bool(st.next) ?? prev.next;
        next.complex = bool(st.complex) ?? prev.complex;
        if (isLeibnizId(st.series)) next.series = st.series;
        next.bracket = bool(st.bracket) ?? prev.bracket;
        const f = isTfId(st.f) ? st.f : null;
        if (mode === 'build') {
          const nf = f !== null && f !== prev.fB;
          if (f) next.fB = f;
          next.x0B = x0Of(next.fB, x0 ?? (nf ? null : prev.x0B));
          next.xB = probeOf(next.fB, x ?? (nf ? null : prev.xB));
          if (n !== null) next.nB = clamp(Math.round(n), 0, N_BUILD);
        } else if (mode === 'remainder') {
          const nf = f !== null && f !== prev.fR;
          if (f) next.fR = f;
          next.x0R = x0Of(next.fR, x0 ?? (nf ? null : prev.x0R));
          if (n !== null) next.nR = clamp(Math.round(n), 0, N_BUILD);
          next.delta = clamp(num(st.delta) ?? (nf ? TF[next.fR].delta : prev.delta), 0.1, 3);
        } else if (mode === 'lead') {
          if (x !== null) next.xG = leadX(x);
        } else if (mode === 'radius') {
          const nf = f !== null && hasSeriesAt0(f) && f !== prev.fS;
          if (f && hasSeriesAt0(f)) next.fS = f;
          next.xS = probeOf(next.fS, x ?? (nf ? null : prev.xS));
          if (n !== null) next.nS = clamp(Math.round(n), 0, N_RADIUS);
        } else if (n !== null) next.nL = NS[nsIndex(n)];
        if (mode !== 'remainder' && num(st.delta) !== null) next.delta = clamp(num(st.delta) as number, 0.1, 3);
        commit(next);
        rebase(next);
      }),
    [props.id],
  );

  const s0 = setup;

  /* ---------------------------------------------------------------- per-state model (not per pixel) */
  const build = useMemo(() => {
    const c = taylorCoeffs(s0.fB, s0.x0B, s0.nB + 1, s0.a);
    const polys = Array.from({ length: s0.nB + 1 }, (_, k) => taylorPoly(c.slice(0, k + 1), s0.x0B));
    const band: Band | null = s0.band ? goodBand(s0.fB, s0.x0B, s0.nB, s0.tol, TF[s0.fB].window.x, s0.a) : null;
    return { c, polys, T: polys[s0.nB], band };
  }, [s0.fB, s0.x0B, s0.nB, s0.a, s0.band, s0.tol]);

  const rem = useMemo(() => {
    const [lo, hi] = remainderInterval(s0.fR, s0.x0R, s0.delta, s0.a);
    const info: RemainderInfo = remainderInfo(s0.fR, s0.x0R, s0.nR, lo, hi, s0.a);
    const err = sampledError(s0.fR, s0.x0R, s0.nR, lo, hi, s0.a);
    const T = taylorPoly(taylorCoeffs(s0.fR, s0.x0R, s0.nR, s0.a), s0.x0R);
    return { lo, hi, info, err, T };
  }, [s0.fR, s0.x0R, s0.nR, s0.delta, s0.a]);

  const rad = useMemo(() => {
    const c = seriesCoeffs(s0.fS, N_RADIUS, s0.a);
    const S = (n: number): Fn => (x) => {
      let v = 0;
      for (let k = n; k >= 0; k--) v = v * x + c[k];
      return v;
    };
    return { c, S, R: radiusOf(s0.fS, s0.a) ?? Infinity, ends: endsOf(s0.fS, s0.a) };
  }, [s0.fS, s0.a]);

  /* ---------------------------------------------------------------- drawing */
  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    const nar = view.w < 520;
    const fs = nar ? 12 : 13;
    const font = (w8: number, size = fs, it = false) => `${it ? 'italic ' : ''}${w8} ${size}px ${p.fontUi}`;
    const outer = { x: 0, y: 0, w: view.w, h: view.h };
    // on a phone the complex inset would cover a branch of the partial sum: it moves below the plot (see `aspect`)
    const below = nar && insetBelow(s0);
    const PAD = { l: 50, r: 16, t: nar ? 30 : 16, b: below ? 38 + INSET_NARROW + 16 : 38 };

    if (s0.mode === 'build') {
      const sp = TF[s0.fB];
      const win = sp.window;
      const plot = makePlot(insetBox(outer, PAD), { min: win.x[0], max: win.x[1], label: 'x' }, { min: win.y[0], max: win.y[1], label: 'y' });
      plotRef.current = plot;
      const b = plot.box;
      if (build.band) {
        const bd = build.band;
        shadeX(ctx, plot, bd.lo, bd.hi, p.epsBand);
        if (bd.loBounded) line(ctx, plot.px(bd.lo), b.y, plot.px(bd.lo), b.y + b.h, withAlpha(p.eps, 0.8), 1.2, [4, 4]);
        if (bd.hiBounded) line(ctx, plot.px(bd.hi), b.y, plot.px(bd.hi), b.y + b.h, withAlpha(p.eps, 0.8), 1.2, [4, 4]);
      }
      drawAxes(ctx, plot, p);
      zeroLines(ctx, plot, p);
      const f = fnOf(s0.fB, s0.a);
      stroke(ctx, plot, f, win.x[0], win.x[1], p.curve, 2.6);
      if (s0.ladder) for (let k = 0; k < s0.nB; k++) stroke(ctx, plot, build.polys[k], win.x[0], win.x[1], withAlpha(p.accent, 0.28), 1.3);
      stroke(ctx, plot, build.T, win.x[0], win.x[1], p.accent, 2.4);
      // labels: f at the left, T_n where it leaves the plot to the right of x₀
      {
        let xl = win.x[0] + 0.05 * (win.x[1] - win.x[0]);
        if (!Number.isFinite(f(xl))) xl = Math.max(xl, domainOf(s0.fB, s0.a)[0] + 0.15 * (win.x[1] - win.x[0]));
        const yl = f(xl);
        if (Number.isFinite(yl)) haloText(ctx, p, 'f', plot.px(xl) + 4, clamp(plot.py(yl), b.y + 12, b.y + b.h - 12) - 14, { font: font(700, fs + 2, true), color: p.curve, align: 'left' });
        let xr = s0.x0B;
        const step = (win.x[1] - win.x[0]) / 300;
        const T = build.T;
        while (xr + step < win.x[1] && T(xr + step) < win.y[1] && T(xr + step) > win.y[0]) xr += step;
        haloText(ctx, p, `T${sub(s0.nB)}`, Math.min(plot.px(xr) - 8, b.x + b.w - TOOLS_W), clamp(plot.py(T(xr)), b.y + 12, b.y + b.h - 12) + 12, { font: font(700, fs, true), color: p.accent, align: 'right' });
      }
      // x₀
      {
        const X = plot.px(s0.x0B);
        const v = f(s0.x0B);
        if (Number.isFinite(v)) {
          const Y = clamp(plot.py(v), b.y, b.y + b.h);
          line(ctx, X, Y, X, b.y + b.h, p.ink3, 1, [2, 3]);
          dot(ctx, X, Y, 6, p.curve, p.paper);
        }
        haloText(ctx, p, 'x₀', X, b.y + b.h - 10, { font: font(600, fs, true), color: p.ink2 });
      }
      // the probe: f(x) filled circle, T_n(x) accent square, the gap between them
      {
        const X = plot.px(s0.xB);
        const fx = f(s0.xB);
        const tx = build.T(s0.xB);
        line(ctx, X, b.y, X, b.y + b.h, withAlpha(p.ink, 0.35), 1, [1, 3]);
        if (Number.isFinite(fx)) {
          const y1 = clamp(plot.py(fx), b.y, b.y + b.h);
          const y2 = clamp(plot.py(tx), b.y, b.y + b.h);
          line(ctx, X, y1, X, y2, p.eps, 3);
          if (plot.py(fx) >= b.y && plot.py(fx) <= b.y + b.h) dot(ctx, X, plot.py(fx), 4.5, p.curve, p.paper);
        }
        const ty = plot.py(tx);
        if (ty >= b.y && ty <= b.y + b.h) square(ctx, X, ty, 4, p.accent, p.paper);
        else triangle(ctx, X, ty < b.y ? b.y + 9 : b.y + b.h - 9, 6, ty < b.y, p.accent);
        haloText(ctx, p, 'x', X, b.y + 10, { font: font(600, fs, true), color: p.ink2 });
      }
    } else if (s0.mode === 'remainder') {
      const sp = TF[s0.fR];
      const f = fnOf(s0.fR, s0.a);
      const xlo = Math.min(sp.window.x[0], rem.lo - 0.05 * s0.delta);
      const xhi = Math.max(sp.window.x[1], rem.hi + 0.05 * s0.delta);
      const inner = insetBox(outer, PAD);
      const gap = 30;
      const hTop = Math.round((inner.h - gap) * 0.55);
      const top = makePlot({ x: inner.x, y: inner.y, w: inner.w, h: hTop }, { min: xlo, max: xhi }, { min: sp.window.y[0], max: sp.window.y[1], label: 'y' });
      plotRef.current = top;
      shadeX(ctx, top, rem.lo, rem.hi, p.deltaBand);
      drawAxes(ctx, top, p);
      zeroLines(ctx, top, p);
      stroke(ctx, top, f, xlo, xhi, p.curve, 2.4);
      stroke(ctx, top, rem.T, xlo, xhi, p.accent, 2.2);
      const v0 = f(s0.x0R);
      if (Number.isFinite(v0)) dot(ctx, top.px(s0.x0R), top.py(v0), 5.5, p.curve, p.paper);
      // the legend, left of the reset / full-screen buttons in the top-right corner
      haloText(ctx, p, `T${sub(s0.nR)}`, top.box.x + top.box.w - TOOLS_W, top.box.y + 12, { font: font(700, fs, true), color: p.accent, align: 'right' });
      haloText(ctx, p, 'f', top.box.x + top.box.w - TOOLS_W, top.box.y + 30, { font: font(700, fs, true), color: p.curve, align: 'right' });
      // bottom: the error on a log axis
      const eps = 10 ** -s0.epsE;
      const B = rem.info.B;
      const emax = rem.err.max;
      const pos = [eps, B, emax].filter((v) => v > 0 && Number.isFinite(v));
      let topE = Math.ceil(Math.log10(Math.max(...pos)) + 0.2);
      let botE = Math.min(Math.floor(Math.log10(Math.min(...pos))) - 3, topE - 4);
      botE = Math.max(botE, topE - 18, -17);
      if (topE <= botE) topE = botE + 1;
      const bot = makePlot(
        { x: inner.x, y: inner.y + hTop + gap, w: inner.w, h: inner.h - hTop - gap },
        { min: xlo, max: xhi, label: 'x' },
        { min: 10 ** botE, max: 10 ** topE, scale: 'log', label: 'השגיאה' },
      );
      shadeX(ctx, bot, rem.lo, rem.hi, p.deltaBand);
      drawAxes(ctx, bot, p);
      const bb = bot.box;
      // ε dashed, B solid
      const ye = bot.py(eps);
      line(ctx, bb.x, ye, bb.x + bb.w, ye, p.eps, 1.6, [6, 4]);
      haloText(ctx, p, `ε = ${epsText(s0.epsE)}`, bb.x + 6, ye - 9, { font: font(700), color: p.eps, align: 'left' });
      if (B > 0) {
        const yb = clamp(bot.py(B), bb.y, bb.y + bb.h);
        line(ctx, bot.px(rem.lo), yb, bot.px(rem.hi), yb, p.ink, 2.2);
        haloText(ctx, p, 'B', bot.px(rem.hi) + 4, yb, { font: font(700), color: p.ink, align: 'left' });
      }
      // the sampled error
      ctx.save();
      ctx.beginPath();
      ctx.rect(bb.x, bb.y - 2, bb.w, bb.h + 4);
      ctx.clip();
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const floor = 10 ** botE;
      rem.err.xs.forEach((x, i) => {
        const e = rem.err.es[i];
        // below the window the curve leaves through the bottom edge (clipped), it does not run along it
        const y = bot.py(Number.isFinite(e) ? Math.max(e, floor / 100) : floor / 100);
        if (i) ctx.lineTo(bot.px(x), y);
        else ctx.moveTo(bot.px(x), y);
      });
      ctx.stroke();
      ctx.restore();
      if (emax > floor) dot(ctx, bot.px(rem.err.at), bot.py(emax), 4.5, p.accent, p.paper);
    } else if (s0.mode === 'lead') {
      const L = LEAD[s0.g];
      const ax = Math.abs(s0.xG);
      const W = Math.min(1.6 * ax, L.xMax);
      const one = (x: number) => L.c * x ** L.k;
      const two = (x: number) => one(x) + L.d * x ** L.m;
      const cand = [Math.abs(L.c) * W ** L.k + Math.abs(L.d) * W ** L.m, Math.abs(L.g(ax)), Math.abs(L.g(-ax))].filter(Number.isFinite);
      const Y = 1.3 * Math.max(...cand);
      const plot = makePlot(insetBox(outer, { ...PAD, l: 62 }), { min: -W, max: W, label: 'x' }, { min: -Y, max: Y, label: 'y' });
      plotRef.current = plot;
      const b = plot.box;
      drawAxes(ctx, plot, p);
      zeroLines(ctx, plot, p);
      stroke(ctx, plot, L.g, -W, W, p.curve, 2.6);
      stroke(ctx, plot, one, -W, W, p.limit, 2, [7, 5]);
      if (s0.next) stroke(ctx, plot, two, -W, W, p.accent, 2.2);
      if (L.hole0) ring(ctx, plot.px(0), plot.py(L.c), 5, p.curve, p.paper);
      const X = plot.px(s0.xG);
      line(ctx, X, b.y, X, b.y + b.h, withAlpha(p.ink, 0.35), 1, [1, 3]);
      const gx = L.g(s0.xG);
      if (Number.isFinite(gx)) dot(ctx, X, plot.py(gx), 5, p.curve, p.paper);
      ring(ctx, X, plot.py(one(s0.xG)), 5, p.limit, 'transparent', 2);
      if (s0.next) square(ctx, X, plot.py(two(s0.xG)), 3.5, p.accent, p.paper);
      haloText(ctx, p, 'g', b.x + 10, b.y + 12, { font: font(700, fs + 1, true), color: p.curve, align: 'left' });
      haloText(ctx, p, monoText(L.cText, L.k), b.x + 10, b.y + 30, { font: font(700), color: p.limit, align: 'left' });
      if (s0.next) haloText(ctx, p, `${monoText(L.cText, L.k)} ${L.dText.startsWith('−') ? '−' : '+'} ${monoText(L.dText.replace('−', ''), L.m)}`, b.x + 10, b.y + 48, { font: font(700), color: p.accent, align: 'left' });
    } else if (s0.mode === 'radius') {
      const sp = TF[s0.fS];
      const win = sp.window;
      const plot = makePlot(insetBox(outer, PAD), { min: win.x[0], max: win.x[1], label: 'x' }, { min: win.y[0], max: win.y[1], label: 'y' });
      plotRef.current = plot;
      const b = plot.box;
      drawAxes(ctx, plot, p);
      zeroLines(ctx, plot, p);
      const f = fnOf(s0.fS, s0.a);
      stroke(ctx, plot, f, win.x[0], win.x[1], p.curve, 2.6);
      stroke(ctx, plot, rad.S(s0.nS), win.x[0], win.x[1], p.accent, 2.2, [], 600);
      // the interval of convergence on the x-axis (or along the bottom when y = 0 is not in view)
      const yAxis = win.y[0] < 0 && win.y[1] > 0 ? plot.py(0) : b.y + b.h - 6;
      const R = rad.R;
      const L0 = Number.isFinite(R) ? Math.max(-R, win.x[0]) : win.x[0];
      const R0 = Number.isFinite(R) ? Math.min(R, win.x[1]) : win.x[1];
      line(ctx, plot.px(L0), yAxis, plot.px(R0), yAxis, withAlpha(p.delta, 0.85), 6);
      if (!Number.isFinite(R)) {
        triangle(ctx, b.x + 8, yAxis, 6, true, p.delta);
        triangle(ctx, b.x + b.w - 8, yAxis, 6, true, p.delta);
      } else {
        for (const [x, kind] of [
          [-R, rad.ends?.left],
          [R, rad.ends?.right],
        ] as [number, string | undefined][]) {
          if (x < win.x[0] || x > win.x[1]) continue;
          if (kind === 'conv') dot(ctx, plot.px(x), yAxis, 6, p.delta, p.paper);
          else if (kind === 'div') ring(ctx, plot.px(x), yAxis, 6, p.delta, p.paper, 2.4);
          else line(ctx, plot.px(x), yAxis - 8, plot.px(x), yAxis + 8, p.delta, 2.4);
        }
      }
      // the probe
      const X = plot.px(s0.xS);
      line(ctx, X, b.y, X, b.y + b.h, withAlpha(p.ink, 0.35), 1, [1, 3]);
      const fx = f(s0.xS);
      if (Number.isFinite(fx) && plot.py(fx) >= b.y && plot.py(fx) <= b.y + b.h) dot(ctx, X, plot.py(fx), 4.5, p.curve, p.paper);
      const sx = rad.S(s0.nS)(s0.xS);
      const sy = plot.py(sx);
      if (sy >= b.y && sy <= b.y + b.h) square(ctx, X, sy, 4, p.accent, p.paper);
      else triangle(ctx, X, sy < b.y ? b.y + 9 : b.y + b.h - 9, 6, sy < b.y, p.accent);
      haloText(ctx, p, `T${sub(s0.nS)}`, b.x + b.w - TOOLS_W, b.y + 12, { font: font(700, fs, true), color: p.accent, align: 'right' });
      // the complex plane: ±i and the disc of radius R
      if (s0.complex && (s0.fS === 'lorentz' || s0.fS === 'arctan')) {
        const size = below ? INSET_NARROW : 132;
        // wide: the plot's top-left corner; narrow: centred under the plot, below the x-axis title
        const ix = below ? b.x + (b.w - size) / 2 : b.x + 8;
        const iy = below ? b.y + b.h + 46 : b.y + 8;
        ctx.save();
        ctx.fillStyle = withAlpha(p.paper, 0.95);
        ctx.strokeStyle = p.rule;
        ctx.lineWidth = 1;
        ctx.fillRect(ix, iy, size, size);
        ctx.strokeRect(ix, iy, size, size);
        ctx.restore();
        const span = Math.max(1.5, Math.abs(s0.xS) * 1.15);
        const cx = ix + size / 2;
        const cy = iy + size / 2;
        const k = size / 2 / span;
        line(ctx, ix + 4, cy, ix + size - 4, cy, p.ink3, 1);
        line(ctx, cx, iy + 4, cx, iy + size - 4, p.ink3, 1);
        ctx.save();
        ctx.fillStyle = p.deltaBand;
        ctx.strokeStyle = p.delta;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(cx, cy, R * k, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        ring(ctx, cx, cy - k, 4.5, p.pointOut, p.paper, 2.2);
        ring(ctx, cx, cy + k, 4.5, p.pointOut, p.paper, 2.2);
        haloText(ctx, p, 'i', cx + 10, cy - k, { font: font(700, fs - 1, true), color: p.pointOut, align: 'left' });
        haloText(ctx, p, '−i', cx + 10, cy + k, { font: font(700, fs - 1, true), color: p.pointOut, align: 'left' });
        const px = cx + clamp(s0.xS * k, -size / 2 + 4, size / 2 - 4);
        if (Math.abs(s0.xS) < R) dot(ctx, px, cy, 4, p.pointIn, p.paper);
        else ring(ctx, px, cy, 4, p.pointOut, p.paper, 2);
        haloText(ctx, p, 'Re', ix + size - 6, cy + 10, { font: font(600, fs - 2), color: p.ink2, align: 'right' });
        haloText(ctx, p, 'Im', cx - 6, iy + 9, { font: font(600, fs - 2), color: p.ink2, align: 'right' });
      }
    } else {
      const sp = LEIBNIZ[s0.series];
      const sums = leibnizSums(s0.series);
      const N = s0.nL + 1;
      const logX = N > 50;
      const xAxis = logX ? { min: 1, max: 10 ** Math.ceil(Math.log10(N * 1.3)), scale: 'log' as const, label: 'n' } : { min: 0, max: Math.max(12, N + 1), label: 'n' };
      const bnext = sp.b(N);
      // below ~1e-9 of S the tick labels would need more digits than a double has: the points then sit on the line
      const Y = Math.max(1.6 * bnext, 1e-9 * Math.max(1, Math.abs(sp.S)));
      const sig = clamp(Math.ceil(Math.log10(Math.max(Math.abs(sp.S), 1e-3) / Y)) + 2, 2, 12);
      const plot = makePlot(
        insetBox(outer, { ...PAD, l: 30 + 7 * sig }),
        xAxis,
        { min: sp.S - Y, max: sp.S + Y, label: 'Sₙ', format: (v) => minus(Number(v.toPrecision(sig)).toString()) },
      );
      plotRef.current = plot;
      const b = plot.box;
      drawAxes(ctx, plot, p);
      const yS = plot.py(sp.S);
      line(ctx, b.x, yS, b.x + b.w, yS, p.limit, 2);
      haloText(ctx, p, `S = ${sp.sText}`, b.x + b.w - 6, yS - 11, { font: font(700), color: p.limit, align: 'right' });
      const r = N > 200 ? 2 : N > 50 ? 2.6 : 3.4;
      for (let k = 1; k <= N; k++) {
        const y = plot.py(sums[k]);
        if (y < b.y || y > b.y + b.h) {
          if (N <= 50) triangle(ctx, plot.px(k), y < b.y ? b.y + 6 : b.y + b.h - 6, 4, y < b.y, withAlpha(p.curve, 0.6));
          continue;
        }
        if (N > 50) {
          // many small points: no paper rim, it would wash them out
          ctx.fillStyle = p.curve;
          ctx.beginPath();
          ctx.arc(plot.px(k), y, r, 0, TAU);
          ctx.fill();
        } else dot(ctx, plot.px(k), y, r, p.curve, p.paper);
      }
      const Xn = plot.px(s0.nL);
      const Xn1 = plot.px(N);
      const yn = plot.py(sums[s0.nL]);
      const yn1 = plot.py(sums[N]);
      if (s0.bracket) {
        const Xb = (Xn + Xn1) / 2;
        line(ctx, Xb, yn, Xb, yn1, p.accent, 2.4);
        line(ctx, Xb - 6, yn, Xb + 6, yn, p.accent, 2.4);
        line(ctx, Xb - 6, yn1, Xb + 6, yn1, p.accent, 2.4);
        dot(ctx, Xb, yS, 4.5, p.limit, p.paper);
      }
      dot(ctx, Xn, yn, 5.5, p.accent, p.paper);
      square(ctx, Xn1, yn1, 4.5, p.accent, p.paper);
      haloText(ctx, p, `S${sub(s0.nL)}`, Xn - 8, yn + (sums[s0.nL] > sp.S ? -13 : 13), { font: font(700, fs, true), color: p.accent, align: 'right' });
    }
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1.6, worldHeight: 1, animate: false });
  useEffect(invalidate, [setup, narrow, build, rem, rad]);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const upd = () => setNarrow(el.getBoundingClientRect().width < 520);
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const aspect = setup.mode === 'remainder' ? (narrow ? 0.75 : 1.15) : narrow ? (insetBelow(setup) ? 0.72 : 0.95) : 1.45;

  /* ---------------------------------------------------------------- learner changes */
  /** The learner changed the figure: apply, then tick whatever the change completes. */
  const apply = (patch: Partial<Setup>) => {
    const prev = cur.current;
    const next: Setup = { ...prev, ...patch };
    commit(next);
    for (const id of props.tasks ?? []) {
      const rule = RULES[id];
      if (!rule) continue;
      const touched = rule.needs.some((key) => key in patch);
      if (rule.event) {
        // an event task ticks on the learner's act itself (its state compares with the state before)
        if (touched && rule.state(next, patch, prev, base.current)) done(id);
        continue;
      }
      if (!rule.state(next, patch, prev, base.current)) {
        held.current.delete(id);
        continue;
      }
      if (!touched || held.current.has(id)) continue;
      done(id);
    }
    // rem-widen: the base δ is the smallest δ since n, f, x₀ or a changed
    if ('nR' in patch || 'fR' in patch || 'x0R' in patch || 'a' in patch) base.current = { delta: next.delta, B: remB(next) };
    else if ('delta' in patch && next.delta < base.current.delta) base.current = { delta: next.delta, B: remB(next) };
  };

  const setN = (n: number) => {
    const c = cur.current;
    if (c.mode === 'build') apply({ nB: clamp(Math.round(n), 0, N_BUILD) });
    else if (c.mode === 'remainder') apply({ nR: clamp(Math.round(n), 0, N_BUILD) });
    else if (c.mode === 'radius') apply({ nS: clamp(Math.round(n), 0, N_RADIUS) });
  };
  const stepL = (d: number) => {
    const c = cur.current;
    const i = clamp(nsIndex(c.nL) + d, 0, NS.length - 1);
    if (NS[i] !== c.nL) apply({ nL: NS[i] });
  };
  const setLeadE = (e: number) => {
    const c = cur.current;
    const ee = clamp(roundTo(e, LEAD_E_STEP), 0, LEAD_E_MAX);
    const x = (c.xG < 0 ? -1 : 1) * 10 ** -ee;
    if (x !== c.xG) apply({ xG: x });
  };
  const choosePreset = (id: string) => {
    const c = cur.current;
    if ((c.mode === 'build' || c.mode === 'remainder' || c.mode === 'radius') && isTfId(id)) {
      if (c.mode === 'build') apply({ fB: id, x0B: TF[id].x0, xB: probeOf(id, null) });
      else if (c.mode === 'remainder') apply({ fR: id, x0R: TF[id].x0, delta: TF[id].delta });
      else if (hasSeriesAt0(id)) apply({ fS: id, xS: probeOf(id, null) });
      setLive(`נבחרה הפונקציה ${fullText(id, c.a)}.`);
    } else if (c.mode === 'lead' && isLeadId(id)) {
      apply({ g: id });
      setLive(`נבחרה הפונקציה ${LEAD[id].text}.`);
    } else if (c.mode === 'leibniz' && isLeibnizId(id)) {
      apply({ series: id });
      setLive(`נבחר הטור ${LEIBNIZ[id].text}.`);
    }
  };

  const xOfPointer = (e: PointerEvent) => {
    const plot = plotRef.current;
    if (!plot) return null;
    return plot.x.min + ((e.offsetX - plot.box.x) / plot.box.w) * (plot.x.max - plot.x.min);
  };
  const fromPointer = (e: PointerEvent) => {
    const c = cur.current;
    const x = xOfPointer(e);
    if (x === null) return;
    if (c.mode === 'build') {
      const w = TF[c.fB].window.x;
      if (drag.current === 'x0') {
        const r = TF[c.fB].x0Range;
        if (!r) return;
        const v = clamp(roundTo(x, 0.05), r[0], r[1]);
        if (v !== c.x0B) apply({ x0B: v });
      } else {
        const v = clamp(roundTo(x, 0.01), w[0], w[1]);
        if (v !== c.xB) apply({ xB: v });
      }
    } else if (c.mode === 'radius') {
      const w = TF[c.fS].window.x;
      const v = clamp(roundTo(x, 0.01), w[0], w[1]);
      if (v !== c.xS) apply({ xS: v });
    }
  };
  const onPointerDown = (e: PointerEvent) => {
    const c = cur.current;
    if (c.mode !== 'build' && c.mode !== 'radius') return;
    const plot = plotRef.current;
    if (!plot) return;
    drag.current = 'probe';
    if (c.mode === 'build' && TF[c.fB].x0Range && Math.abs(e.offsetX - plot.px(c.x0B)) <= 12 && Math.abs(e.offsetX - plot.px(c.xB)) > 4) drag.current = 'x0';
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    fromPointer(e);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (drag.current) fromPointer(e);
  };
  const onPointerUp = () => {
    if (drag.current) setLive(describe());
    drag.current = null;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const c = cur.current;
    const k = e.key;
    const lr = k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : 0;
    const ud = k === 'ArrowDown' ? -1 : k === 'ArrowUp' ? 1 : 0;
    if (!lr && !ud) return;
    e.preventDefault();
    if (c.mode === 'build' || c.mode === 'radius') {
      const id = c.mode === 'build' ? c.fB : c.fS;
      const w = TF[id].window.x;
      if (lr) {
        const step = roundTo((w[1] - w[0]) / 100, 0.01);
        if (c.mode === 'build') apply({ xB: clamp(roundTo(c.xB + lr * step, 0.01), w[0], w[1]) });
        else apply({ xS: clamp(roundTo(c.xS + lr * step, 0.01), w[0], w[1]) });
      } else setN((c.mode === 'build' ? c.nB : c.nS) + ud);
    } else if (c.mode === 'remainder') {
      if (ud) setN(c.nR + ud);
      else apply({ delta: clamp(roundTo(c.delta + lr * 0.05, 0.05), 0.1, 3) });
    } else if (c.mode === 'lead') {
      if (lr) setLeadE(-Math.log10(Math.abs(c.xG)) - lr * LEAD_E_STEP);
    } else if (lr) stepL(lr);
    setLive(describe());
  };

  /* ---------------------------------------------------------------- text */
  const M = (q: { children: ComponentChildren }) => <bdi dir="ltr">{q.children}</bdi>;
  /** binom's exponent next to f in the fn readouts */
  const aPart = (id: TfId) =>
    id === 'binom' ? (
      <>
        , <M>a = {aText(setup.a)}</M>
      </>
    ) : null;
  const sw = (kind: 'f' | 't' | 'lim' | 'err') => <span class={`tl-sw tl-sw-${kind}`} aria-hidden="true" />;

  function describe(): string {
    const s = cur.current;
    if (s.mode === 'build') return `x = ${fmt(s.xB)}: f(x) = ${fmt(fnOf(s.fB, s.a)(s.xB), 6)}, T${sub(s.nB)}(x) = ${fmt(build.T(s.xB), 6)}.`;
    if (s.mode === 'remainder') return `החסם B = ${fmt(remB(s), 3)}, השגיאה הגדולה שנדגמה ${fmt(remErr(s), 3)}.`;
    if (s.mode === 'lead') return `x = ${fmtLeadX(s.xG)}: המנה ${fmt(LEAD[s.g].g(s.xG) / s.xG ** LEAD[s.g].k, 6)}.`;
    if (s.mode === 'radius') return `x = ${fmt(s.xS)}: הסכום החלקי מסדר ${s.nS} הוא ${fmt(rad.S(s.nS)(s.xS), 6)}.`;
    const sums = leibnizSums(s.series);
    return `n = ${s.nL}: הסכום החלקי ${fmt(sums[s.nL], 8)}.`;
  }

  let readout: ComponentChildren;
  let label: string;
  const offered = props.presets ?? DEFAULT_PRESETS[setup.mode];
  let chips: string[] = [];

  if (setup.mode === 'build') {
    const s = setup;
    const f = fnOf(s.fB, s.a);
    const fx = f(s.xB);
    const tx = build.T(s.xB);
    const deg = degreeOf(s.fB, s.a);
    const Tn = `T${sub(s.nB)}`;
    chips = offered.filter(isTfId);
    label = `איור חי: הפונקציה ${fullText(s.fB, s.a)} ופולינום טיילור שלה מסדר ${s.nB} סביב x₀ = ${fmtPoint(s.x0B)}. בנקודה x = ${fmt(s.xB)} הפונקציה ${fmt(fx)} והפולינום ${fmt(tx)}. במקלדת: חץ ימינה ושמאלה מזיז את x, חץ למעלה ולמטה משנה את הסדר.`;
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>f(x) = {textOf(s.fB, s.a)}</M>
          {aPart(s.fB)}, <M>x₀ = {fmtPoint(s.x0B)}</M>
        </span>
        <span class="q" data-readout="n">
          <M>
            n = <b>{s.nB}</b>
          </M>
        </span>
        <span class="q tl-poly" data-readout="poly">
          {sw('t')}
          <M>
            {Tn}(x) = {polyText(build.c, s.x0B, s.nB)}
          </M>
        </span>
        {deg !== undefined && s.nB >= deg && (
          <span class="q" data-readout="same">
            <b>
              {Tn} זהה ל-f
            </b>
            : <M>f</M> פולינום ממעלה {deg}, והסדר {s.nB} לא קטן ממנה.
          </span>
        )}
        <span class="q" data-readout="x">
          <M>
            x = <b>{fmt(s.xB)}</b>
          </M>
        </span>
        <span class="q" data-readout="fx">
          {sw('f')}
          {Number.isFinite(fx) ? (
            <M>
              f(x) = <b>{fmt(fx, 6)}</b>
            </M>
          ) : (
            <>
              <M>f(x)</M> <b>לא מוגדרת</b>
            </>
          )}
        </span>
        <span class="q" data-readout="tx">
          {sw('t')}
          <M>
            {Tn}(x) = <b>{fmt(tx, 6)}</b>
          </M>
        </span>
        <span class="q" data-readout="err">
          {sw('err')}
          <M>
            |f(x) − {Tn}(x)| = <b>{Number.isFinite(fx) ? fmt(Math.abs(fx - tx), 3) : '—'}</b>
          </M>
        </span>
        {build.band && (
          <span class="q" data-readout="band">
            {sw('err')}
            השגיאה קטנה מ-<M>{tolText(s.tol)}·max(1, |f|)</M> בקטע{' '}
            <M>
              [{fmt(build.band.lo, 3)}, {fmt(build.band.hi, 3)}]
            </M>
            {!build.band.loBounded || !build.band.hiBounded ? ' (עד קצה האיור)' : ''} (בדיקה מספרית, לא הוכחה)
          </span>
        )}
      </>
    );
  } else if (setup.mode === 'remainder') {
    const s = setup;
    const info = rem.info;
    const eps = 10 ** -s.epsE;
    const k = s.nR + 1;
    const dk = `f⁽${sup(k)}⁾`;
    const clipped = rem.lo > s.x0R - s.delta + 1e-12 || rem.hi < s.x0R + s.delta - 1e-12;
    chips = offered.filter(isTfId);
    const how: ComponentChildren = (() => {
      switch (info.how) {
        case 'one':
          return 'חסם: כל נגזרת חסומה ב-1';
        case 'zero':
          return (
            <>
              <M>{dk} = 0</M>: <M>T{sub(s.nR)}</M> זהה ל-f, והשארית אפס
            </>
          );
        case 'sampled':
          return 'M נדגם על פני הקטע (בדיקה מספרית, לא הוכחה)';
        default:
          return `${info.at === 0 && info.how === 'poly' ? 'בנקודה 0' : 'בקצה הקטע'}, שם הנגזרת הכי גדולה בערך מוחלט (מדויק)`;
      }
    })();
    label = `איור חי: הפונקציה ${fullText(s.fR, s.a)} ופולינום טיילור מסדר ${s.nR} סביב ${fmtPoint(s.x0R)} על הקטע מ-${fmt(rem.lo, 3)} עד ${fmt(rem.hi, 3)}. למטה, בסולם לוגריתמי, השגיאה שנדגמה, חסם לגרנז׳ B = ${fmt(info.B, 3)} והדיוק ε = ${fmt(eps)}.`;
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>f(x) = {textOf(s.fR, s.a)}</M>
          {aPart(s.fR)}, <M>x₀ = {fmtPoint(s.x0R)}</M>
        </span>
        <span class="q" data-readout="n">
          <M>
            n = <b>{s.nR}</b>
          </M>
        </span>
        <span class="q" data-readout="interval">
          הקטע{' '}
          <M>
            [{fmt(rem.lo, 4)}, {fmt(rem.hi, 4)}]
          </M>
          {clipped ? ' (נחתך לתחום ההגדרה)' : ''}
        </span>
        <span class="q" data-readout="M">
          {info.how === 'ends' || info.how === 'poly' ? (
            <>
              <M>
                M = |{dk}({fmt(info.at, 3)})| = <b>{fmt(info.M, 4)}</b>
              </M>
              : {how}
            </>
          ) : (
            <>
              <M>
                M = <b>{fmt(info.M, 4)}</b>
              </M>
              . {how}
            </>
          )}
        </span>
        <span class="q" data-readout="B">
          <M>
            B = M·d{sup(k)}/{k}! = <b>{fmt(info.B, 3)}</b>
          </M>
          , <M>d = {fmt(info.d, 3)}</M>
        </span>
        <span class="q" data-readout="err">
          {sw('t')}
          השגיאה הגדולה ביותר שנדגמה: <M>{fmt(rem.err.max, 3)}</M> (בדיקה מספרית)
        </span>
        <span class="q" data-readout="verdict">
          <b>
            {info.B < eps ? (
              <>
                <M>B &lt; ε</M>: הסדר מספיק
              </>
            ) : (
              <>
                <M>B ≥ ε</M>: צריך סדר גבוה יותר
              </>
            )}
          </b>
        </span>
      </>
    );
  } else if (setup.mode === 'lead') {
    const s = setup;
    const L = LEAD[s.g];
    const gx = L.g(s.xG);
    const one = L.c * s.xG ** L.k;
    const q = gx / s.xG ** L.k;
    const lead = monoText(L.cText, L.k);
    const nxt = `${lead} ${L.dText.startsWith('−') ? '−' : '+'} ${monoText(L.dText.replace('−', ''), L.m)}`;
    chips = offered.filter(isLeadId);
    label = `איור חי: הפונקציה ${L.text} ליד 0 והאיבר המוביל שלה ${lead}. ב-x = ${fmtLeadX(s.xG)} המנה של g(x) ב-x בחזקת ${L.k} היא ${fmt(q, 6)}, והגבול ${L.cText}.`;
    readout = (
      <>
        <span class="q" data-readout="fn">
          {sw('f')}
          <M>g(x) = {L.text}</M>
        </span>
        <span class="q" data-readout="lead">
          {sw('lim')}
          האיבר המוביל: <M>{lead}</M>
        </span>
        {s.next && (
          <span class="q" data-readout="next">
            {sw('t')}
            עם האיבר הבא: <M>{nxt}</M>
          </span>
        )}
        <span class="q" data-readout="x">
          <M>
            x = <b>{fmtLeadX(s.xG)}</b>
          </M>
        </span>
        <span class="q" data-readout="gx">
          <M>
            g(x) = <b>{Number.isFinite(gx) ? fmt(gx, 6) : '—'}</b>
          </M>
          {Number.isFinite(gx) ? '' : ' (לא מוגדרת)'}
        </span>
        <span class="q" data-readout="cx">
          <M>
            {L.k === 0 ? 'c' : lead} = <b>{fmt(one, 6)}</b>
          </M>
        </span>
        <span class="q" data-readout="quot">
          {sw('lim')}
          <M>
            {L.k === 0 ? 'g(x)' : `g(x)/x${L.k === 1 ? '' : sup(L.k)}`} = <b>{Number.isFinite(q) ? fmt(q, 6) : '—'}</b> → {L.cText}
          </M>
        </span>
        {s.next && Number.isFinite(gx) && (
          <span class="q" data-readout="errs">
            <M>|g − ({lead})| = {fmt(Math.abs(L.rest(s.xG, 1)), 3)}</M>, <M>|g − ({nxt})| = {fmt(Math.abs(L.rest(s.xG, 2)), 3)}</M>
          </span>
        )}
      </>
    );
  } else if (setup.mode === 'radius') {
    const s = setup;
    const f = fnOf(s.fS, s.a);
    const fx = f(s.xS);
    const R = rad.R;
    const Rtext = !Number.isFinite(R) ? '∞' : s.fS === 'tan' ? 'π/2' : fmt(R);
    const ax = Math.abs(s.xS);
    const term = rad.c[s.nS] * s.xS ** s.nS;
    const atEnd = Number.isFinite(R) && Math.abs(ax - R) < 1e-9;
    chips = offered.filter((id) => isTfId(id) && hasSeriesAt0(id));
    const verdict = !Number.isFinite(R)
      ? `${ltr('R = ∞')}: הטור מתכנס ל-${ltr('f(x)')} בכל x.`
      : atEnd
        ? rad.ends
          ? `${ltr('|x| = R')}: ${(s.xS < 0 ? rad.ends.left : rad.ends.right) === 'conv' ? 'בקצה הזה הטור מתכנס' : 'בקצה הזה הטור מתבדר'}.`
          : `${ltr('|x| = R')}: הקצה לא נבדק כאן.`
        : ax < R
          ? `${ltr('|x| < R')}: האיברים קטנים, והטור מתכנס ל-${ltr('f(x)')}.`
          : `${ltr('|x| > R')}: האיברים לא קטנים: הטור מתבדר.`;
    label = `איור חי: הפונקציה ${fullText(s.fS, s.a)} והסכום החלקי מסדר ${s.nS} של הטור שלה סביב 0. רדיוס ההתכנסות ${Rtext}; על ציר x קטע ההתכנסות, קצה מלא אם הטור מתכנס בו וחלול אם לא. ${verdict}`;
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>f(x) = {textOf(s.fS, s.a)}</M>
          {aPart(s.fS)}, <M>R = {Rtext}</M>
        </span>
        <span class="q" data-readout="n">
          <M>
            n = <b>{s.nS}</b>
          </M>
        </span>
        <span class="q" data-readout="x">
          <M>
            x = <b>{fmt(s.xS)}</b>
          </M>
        </span>
        <div class="tl-tablewrap" data-readout="table">
          <table class="tl-table" dir="ltr">
            <tbody>
              {[5, 10, 20, 40].map((n) => (
                <tr key={n} class={n === s.nS ? 'now' : ''}>
                  <td>T{sub(n)}(x)</td>
                  <td>{fmt(rad.S(n)(s.xS), 8)}</td>
                </tr>
              ))}
              <tr class="f">
                <td>f(x)</td>
                <td>{Number.isFinite(fx) ? fmt(fx, 8) : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <span class="q" data-readout="term">
          {sw('t')}
          האיבר{' '}
          <M>
            a{sub(s.nS)}x{sup(s.nS)} = {fmt(term, 3)}
          </M>
          {Number.isFinite(fx) ? '' : <>, ו-<M>f(x)</M> לא מוגדרת</>}
        </span>
        <span class="q" data-readout="verdict">
          <b>{verdict}</b>
        </span>
        {s.complex && (s.fS === 'lorentz' || s.fS === 'arctan') && (
          <span class="q" data-readout="complex">
            הנקודות <M>±i</M>, שבהן <M>1 + x² = 0</M>, במרחק 1 מ-0: הטור לא רואה מעבר להן, גם על הציר הממשי.
          </span>
        )}
      </>
    );
  } else {
    const s = setup;
    const sp = LEIBNIZ[s.series];
    const sums = leibnizSums(s.series);
    const sn = sums[s.nL];
    const err = Math.abs(sp.S - sn);
    const tiny = err < 1e-15 * Math.max(1, Math.abs(sp.S));
    const bText = fmtLog10(sp.log10b(s.nL + 1));
    chips = offered.filter(isLeibnizId);
    label = `איור חי: הסכומים החלקיים של הטור ${sp.text}, לסירוגין מעל ומתחת לסכום ${sp.sText}. ב-n = ${s.nL} הסכום החלקי ${fmt(sn, 8)}, והחסם על השגיאה ${bText}.`;
    readout = (
      <>
        <span class="q" data-readout="fn">
          <M>
            {sp.text} = {sp.sText}
          </M>
        </span>
        <span class="q" data-readout="n">
          <M>
            n = <b>{s.nL}</b>
          </M>
        </span>
        <span class="q" data-readout="sn">
          {sw('t')}
          <M>
            S{sub(s.nL)} = <b>{fmt(sn, 10)}</b>
          </M>
        </span>
        <span class="q" data-readout="bound">
          החסם{' '}
          <M>
            b{sub(s.nL + 1)} = <b>{bText}</b>
          </M>
        </span>
        <span class="q" data-readout="err">
          {sw('lim')}
          השגיאה האמיתית{' '}
          <M>
            |S − S{sub(s.nL)}| = <b>{tiny ? '≈ 0' : fmt(err, 4)}</b>
          </M>
          {tiny ? ' (מתחת לדיוק המחשב)' : ''}, לא יותר מהחסם
        </span>
        {s.bracket && (
          <span class="q" data-readout="bracket">
            {sw('t')}
            הסכום <M>S</M> בין <M>S{sub(s.nL)}</M> ל-<M>S{sub(s.nL + 1)}</M>:{' '}
            <M>
              [{fmt(Math.min(sn, sums[s.nL + 1]), 10)}, {fmt(Math.max(sn, sums[s.nL + 1]), 10)}]
            </M>
          </span>
        )}
      </>
    );
  }

  /* ---------------------------------------------------------------- controls */
  const s = setup;
  const curPresetId = s.mode === 'build' ? s.fB : s.mode === 'remainder' ? s.fR : s.mode === 'radius' ? s.fS : s.mode === 'lead' ? s.g : s.series;
  // a preset a step chose stays visible among the chips
  if (chips.length > 1 && !chips.includes(curPresetId)) chips = [...chips, curPresetId];
  const presetName = (id: string) => (isTfId(id) ? textOf(id, s.a) : isLeadId(id) ? LEAD[id].text : isLeibnizId(id) ? LEIBNIZ[id].sText : id);
  const fMode: TfId | null = s.mode === 'build' ? s.fB : s.mode === 'remainder' ? s.fR : s.mode === 'radius' ? s.fS : null;
  const hook = (attr: string, v: string, child: ComponentChildren) => (
    <span key={`${attr}-${v}`} class="tl-hook" {...{ [`data-${attr}`]: v }}>
      {child}
    </span>
  );
  const nBtns = (minusOk: boolean, plusOk: boolean, onMinus: () => void, onPlus: () => void) => (
    <div class="group" role="group" aria-label="שינוי הסדר">
      <button type="button" class="btn" data-action="n-minus" aria-label="הקטנה באחד" disabled={!minusOk} onClick={onMinus}>
        −
      </button>
      <button type="button" class="btn" data-action="n-plus" aria-label="הגדלה באחד" disabled={!plusOk} onClick={onPlus}>
        +
      </button>
    </div>
  );
  const x0Slider = (id: TfId, v: number, key: 'x0B' | 'x0R') => {
    const r = TF[id].x0Range;
    if (!r) return null;
    return hook(
      'slider',
      'x0',
      <Slider label="נקודת הפיתוח x₀" value={v} min={r[0]} max={r[1]} step={0.05} format={(x) => fmtPoint(x)} onChange={(x) => apply({ [key]: clamp(roundTo(x, 0.05), r[0], r[1]) } as Partial<Setup>)} />,
    );
  };
  const aSlider =
    fMode === 'binom'
      ? hook('slider', 'a', <Slider label="המעריך a" value={s.a} min={-3} max={3} step={0.05} format={(x) => fmt(x, 3)} onChange={(x) => apply({ a: clamp(roundTo(x, 0.05), -3, 3) })} />)
      : null;

  const controls = (
    <>
      {modes.length > 1 && (
        <div class="group" role="group" aria-label="מה מציג האיור">
          {modes.map((m) => hook('mode', m, <Toggle label={MODE_LABEL[m]} on={s.mode === m} onChange={() => apply({ mode: m })} />))}
        </div>
      )}
      {chips.length > 1 && (
        <div class="group" role="group" aria-label="הפונקציה">
          {chips.map((id) => hook('preset', id, <Toggle label={<bdi dir="ltr">{presetName(id)}</bdi>} on={curPresetId === id} onChange={() => choosePreset(id)} />))}
        </div>
      )}
      {s.mode === 'build' && (
        <>
          {hook('slider', 'n', <Slider label="הסדר n" value={s.nB} min={0} max={N_BUILD} step={1} format={(v) => String(v)} onChange={(v) => setN(v)} />)}
          {nBtns(s.nB > 0, s.nB < N_BUILD, () => setN(s.nB - 1), () => setN(s.nB + 1))}
          {x0Slider(s.fB, s.x0B, 'x0B')}
          {hook(
            'slider',
            'x',
            <Slider
              label="הנקודה x"
              value={s.xB}
              min={TF[s.fB].window.x[0]}
              max={TF[s.fB].window.x[1]}
              step={0.01}
              format={(x) => fmt(x)}
              onChange={(x) => apply({ xB: roundTo(x, 0.01) })}
            />,
          )}
          {aSlider}
          <div class="group" role="group" aria-label="מה להציג">
            {hook('toggle', 'ladder', <Toggle label="הסדרים הקודמים" on={s.ladder} swatch="var(--accent)" onChange={(on) => apply({ ladder: on })} />)}
            {hook('toggle', 'band', <Toggle label="רצועת דיוק" on={s.band} swatch="var(--eps)" onChange={(on) => apply({ band: on })} />)}
          </div>
          {s.band && (
            <div class="group" role="group" aria-label="הדיוק של הרצועה">
              {TOLS.map((t) => hook('tol', tolText(t), <Toggle label={<bdi dir="ltr">{tolText(t)}</bdi>} on={s.tol === t} onChange={() => apply({ tol: t })} />))}
            </div>
          )}
        </>
      )}
      {s.mode === 'remainder' && (
        <>
          {hook('slider', 'n', <Slider label="הסדר n" value={s.nR} min={0} max={N_BUILD} step={1} format={(v) => String(v)} onChange={(v) => setN(v)} />)}
          {x0Slider(s.fR, s.x0R, 'x0R')}
          {hook('slider', 'delta', <Slider label="חצי הרוחב δ" value={s.delta} min={0.1} max={3} step={0.05} format={(x) => fmt(x, 3)} onChange={(x) => apply({ delta: clamp(roundTo(x, 0.05), 0.1, 3) })} />)}
          {hook('slider', 'eps', <Slider label="הדיוק ε" value={s.epsE} min={1} max={8} step={1} format={(e) => epsText(e)} onChange={(e) => apply({ epsE: clamp(Math.round(e), 1, 8) })} />)}
          {aSlider}
        </>
      )}
      {s.mode === 'lead' && (
        <>
          {hook(
            'slider',
            'x',
            <Slider label="המרחק |x|" value={roundTo(-Math.log10(Math.abs(s.xG)), LEAD_E_STEP)} min={0} max={LEAD_E_MAX} step={LEAD_E_STEP} format={() => fmtLeadX(Math.abs(s.xG))} onChange={(e) => setLeadE(e)} />,
          )}
          <div class="group" role="group" aria-label="מה להציג">
            {hook('toggle', 'sign', <Toggle label="x שלילי" on={s.xG < 0} onChange={(on) => apply({ xG: (on ? -1 : 1) * Math.abs(s.xG) })} />)}
            {hook('toggle', 'next', <Toggle label="האיבר הבא" on={s.next} swatch="var(--accent)" onChange={(on) => apply({ next: on })} />)}
          </div>
        </>
      )}
      {s.mode === 'radius' && (
        <>
          {hook('slider', 'n', <Slider label="הסדר n" value={s.nS} min={0} max={N_RADIUS} step={1} format={(v) => String(v)} onChange={(v) => setN(v)} />)}
          {hook(
            'slider',
            'x',
            <Slider
              label="הנקודה x"
              value={s.xS}
              min={TF[s.fS].window.x[0]}
              max={TF[s.fS].window.x[1]}
              step={0.01}
              format={(x) => fmt(x)}
              onChange={(x) => apply({ xS: roundTo(x, 0.01) })}
            />,
          )}
          {aSlider}
          {(s.fS === 'lorentz' || s.fS === 'arctan') && (
            <div class="group" role="group" aria-label="מה להציג">
              {hook('toggle', 'complex', <Toggle label="המישור המרוכב" on={s.complex} swatch="var(--delta)" onChange={(on) => apply({ complex: on })} />)}
            </div>
          )}
        </>
      )}
      {s.mode === 'leibniz' && (
        <>
          {hook('slider', 'n', <Slider label="מספר האיברים n" value={nsIndex(s.nL)} min={0} max={NS.length - 1} step={1} format={() => String(s.nL)} onChange={(i) => apply({ nL: NS[clamp(Math.round(i), 0, NS.length - 1)] })} />)}
          {nBtns(s.nL > 1, s.nL < LEIBNIZ_MAX, () => stepL(-1), () => stepL(1))}
          <div class="group" role="group" aria-label="מה להציג">
            {hook('toggle', 'bracket', <Toggle label="סוגר" on={s.bracket} swatch="var(--accent)" onChange={(on) => apply({ bracket: on })} />)}
          </div>
        </>
      )}
    </>
  );

  return (
    <SimShell
      fig={props.id}
      label={label}
      canvasRef={canvasRef}
      aspect={aspect}
      live={live}
      tasks={tasks}
      cursor={s.mode === 'build' || s.mode === 'radius' ? 'ew-resize' : 'default'}
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
      controls={controls}
    />
  );
}
