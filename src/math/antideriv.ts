/**
 * MODEL SPECIFICATION
 *
 * System:        real functions f of one real variable with a STORED antiderivative F in closed form (registry AD),
 *                and candidate answers G to "find an antiderivative of f" with their derivative dG in closed form
 *                (registry CHK). Chapter 7.1 (the family F + C, the area function, the fundamental theorem) and 7.6
 *                (checking an answer by differentiating it). The core of AntiLab. Evaluated in IEEE double precision.
 * Dynamics:      none.
 * Boundary:      every closed form below (F, dG, the constants between correct candidates, the zeros of f) was
 *                recomputed with sympy on 2026-11-27 (screens/tools/ch7_presets.py). Whether a candidate is correct is
 *                STORED (dG = f on every piece, decided by sympy), never decided by sampling; the tests check the
 *                stored dG against centralDiff of G, and the stored verdict against dG − f on a grid. An antiderivative
 *                is defined on each interval (`pieces`) of the domain of f: for 1/x the constant may differ on the two
 *                pieces, which is the point of the preset `recip`.
 *                `gauss` (e^(−x²)) has an antiderivative that is not in the table: its F is the area function from 0 by
 *                composite Simpson, a PROBE (the theorem says the area function exists; no formula is claimed).
 *                areaFn(id, a, x) = ∫ₐˣ f: exact F(x) − F(a) when F is stored and a, x lie in one piece, Simpson for
 *                gauss, NaN across a break of the domain. signedParts splits [a, x] at the stored zeros of f.
 * Ignored:       exact arithmetic; the behaviour of f off its window.
 * Valid when:    a and x lie in one piece of the domain (else NaN); x is not a pole of f or of a candidate G.
 * Failure modes: near a pole (1/x at 0, the ends of (−1, 1)) values overflow the plot: the figure clips them and never
 *                joins two pieces. Simpson on gauss is accurate to ~1e-12 on the window, not exact.
 */

import { simpson } from './multivar';

export type Fn = (x: number) => number;
/** an open interval of the domain, an infinite end is ±Infinity */
export type Piece = readonly [number, number];

const PI = Math.PI;
const L = (s: string) => String.fromCharCode(0x2066) + s.replace(/ /g, String.fromCharCode(0xa0)) + String.fromCharCode(0x2069);

export interface AdWindow {
  /** the x range of every panel */
  x: readonly [number, number];
  /** y range of the panel with f */
  y: readonly [number, number];
  /** y range for an antiderivative F (the family panel widens it by the constants −3…3) */
  yF: readonly [number, number];
  /** y range of the area function A(x) = ∫ₐˣ f for any a in the window */
  yA: readonly [number, number];
}

export interface AdSpec {
  id: AdId;
  tex: string;
  /** plain label for readouts and the select */
  text: string;
  f: Fn;
  /** an antiderivative: closed form, or for gauss the Simpson area function from 0 (a probe) */
  F: Fn;
  /** TeX of F; null when there is no closed form */
  Ftex: string | null;
  Ftext: string | null;
  /** F is a closed form (false only for gauss) */
  exact: boolean;
  /** the open intervals of the domain of f */
  pieces: readonly Piece[];
  /** the zeros of f in the open interval (lo, hi), all of them sign changes */
  zeros: (lo: number, hi: number) => number[];
  window: AdWindow;
  /** default probe x of the family mode */
  probe: number;
  /** default handles of the area mode */
  a0: number;
  x0: number;
  /** default point (x0, y0) of the "through a point" task of the family mode */
  through: readonly [number, number];
}

export const AD_IDS = ['poly', 'cos', 'sin', 'exp', 'recip', 'lorentz', 'gauss'] as const;
export type AdId = (typeof AD_IDS)[number];
/** the presets the family mode offers: gauss has no closed form of F */
export const FAMILY_IDS = ['poly', 'cos', 'sin', 'exp', 'recip', 'lorentz'] as const satisfies readonly AdId[];
export const isAdId = (s: unknown): s is AdId => typeof s === 'string' && (AD_IDS as readonly string[]).includes(s);
export const isFamilyId = (s: unknown): s is AdId => typeof s === 'string' && (FAMILY_IDS as readonly string[]).includes(s);

const ALL: Piece = [-Infinity, Infinity];

/** the k π + shift (k an integer) inside the open interval (lo, hi) */
function lattice(shift: number, lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let k = Math.ceil((lo - shift) / PI) - 1; k <= Math.floor((hi - shift) / PI) + 1; k++) {
    const z = shift + k * PI;
    if (z > lo + 1e-12 && z < hi - 1e-12) out.push(z);
  }
  return out;
}

/** Simpson's panels: ~200 per unit of length, at least 40 */
export function gaussArea(a: number, x: number): number {
  const n = Math.max(40, 2 * Math.ceil(Math.abs(x - a) * 100));
  return simpson(gaussF, a, x, n);
}
const gaussF: Fn = (x) => Math.exp(-x * x);

const S23 = Math.sqrt(2 / 3);

export const AD: Record<AdId, AdSpec> = {
  poly: {
    id: 'poly',
    tex: '3x^2-2',
    text: '3x² − 2',
    f: (x) => 3 * x * x - 2,
    F: (x) => x ** 3 - 2 * x,
    Ftex: 'x^3-2x',
    Ftext: 'x³ − 2x',
    exact: true,
    pieces: [ALL],
    zeros: (lo, hi) => [-S23, S23].filter((z) => z > lo + 1e-12 && z < hi - 1e-12),
    window: { x: [-2, 2], y: [-3, 10], yF: [-4, 4], yA: [-8.5, 8.5] },
    probe: 1,
    a0: 0,
    x0: 1.5,
    through: [1, 2],
  },
  cos: {
    id: 'cos',
    tex: '\\cos x',
    text: 'cos x',
    f: Math.cos,
    F: Math.sin,
    Ftex: '\\sin x',
    Ftext: 'sin x',
    exact: true,
    pieces: [ALL],
    zeros: (lo, hi) => lattice(PI / 2, lo, hi),
    window: { x: [-2 * PI, 2 * PI], y: [-1.6, 1.6], yF: [-1.6, 1.6], yA: [-2.4, 2.4] },
    probe: 1,
    a0: 0,
    x0: 1,
    through: [0, 1],
  },
  sin: {
    id: 'sin',
    tex: '\\sin x',
    text: 'sin x',
    f: Math.sin,
    F: (x) => -Math.cos(x),
    Ftex: '-\\cos x',
    Ftext: '−cos x',
    exact: true,
    pieces: [ALL],
    zeros: (lo, hi) => lattice(0, lo, hi),
    window: { x: [-2 * PI, 2 * PI], y: [-1.6, 1.6], yF: [-1.6, 1.6], yA: [-2.4, 2.4] },
    probe: 1,
    a0: 0,
    x0: 1,
    through: [0, 0],
  },
  exp: {
    id: 'exp',
    tex: 'e^{x}',
    text: 'eˣ',
    f: Math.exp,
    F: Math.exp,
    Ftex: 'e^{x}',
    Ftext: 'eˣ',
    exact: true,
    pieces: [ALL],
    zeros: () => [],
    window: { x: [-3, 2], y: [-1, 8], yF: [-1, 8], yA: [-8, 8] },
    probe: 0,
    a0: -1,
    x0: 1,
    through: [0, 3],
  },
  recip: {
    id: 'recip',
    tex: '\\frac{1}{x}',
    text: '1/x',
    f: (x) => 1 / x,
    F: (x) => Math.log(Math.abs(x)),
    Ftex: '\\ln|x|',
    Ftext: 'ln|x|',
    exact: true,
    pieces: [
      [-Infinity, 0],
      [0, Infinity],
    ],
    zeros: () => [],
    window: { x: [-4, 4], y: [-4, 4], yF: [-2.5, 2.5], yA: [-4, 4] },
    probe: 2,
    a0: 1,
    x0: 2.5,
    through: [1, 2],
  },
  lorentz: {
    id: 'lorentz',
    tex: '\\frac{1}{1+x^2}',
    text: '1/(1 + x²)',
    f: (x) => 1 / (1 + x * x),
    F: Math.atan,
    Ftex: '\\arctan x',
    Ftext: 'arctan x',
    exact: true,
    pieces: [ALL],
    zeros: () => [],
    window: { x: [-5, 5], y: [-0.3, 1.3], yF: [-1.8, 1.8], yA: [-3.2, 3.2] },
    probe: 1,
    a0: 0,
    x0: 2,
    through: [0, 1],
  },
  gauss: {
    id: 'gauss',
    tex: 'e^{-x^2}',
    text: 'e^(−x²)',
    f: gaussF,
    F: (x) => gaussArea(0, x),
    Ftex: null,
    Ftext: null,
    exact: false,
    pieces: [ALL],
    zeros: () => [],
    window: { x: [-3, 3], y: [-0.3, 1.3], yF: [-1, 1], yA: [-2, 2] },
    probe: 1,
    a0: 0,
    x0: 1,
    through: [0, 0],
  },
};

/** the index of the piece holding x, −1 at a break (or NaN) */
export function pieceIndex(pieces: readonly Piece[], x: number): number {
  return pieces.findIndex(([lo, hi]) => x > lo && x < hi);
}

/** ∫ₐˣ f: exact from F, Simpson for gauss, NaN across a break of the domain (or at a pole) */
export function areaFn(id: AdId, a: number, x: number): number {
  const s = AD[id];
  const ia = pieceIndex(s.pieces, a);
  if (ia < 0 || ia !== pieceIndex(s.pieces, x)) return NaN;
  return s.exact ? s.F(x) - s.F(a) : gaussArea(a, x);
}

/** the area of the strip [x, x + dx] under f */
export const stripArea = (id: AdId, x: number, dx: number): number => areaFn(id, x, x + dx);

/**
 * The areas between the graph of f and the axis over [min(a, x), max(a, x)]: `pos` where f > 0, `neg` where f < 0,
 * both as non-negative areas, exact from F at the stored zeros of f. NaN across a break. For x ≥ a,
 * areaFn(a, x) = pos − neg; for x < a it is −(pos − neg).
 */
export function signedParts(id: AdId, a: number, x: number): { pos: number; neg: number } {
  const s = AD[id];
  const lo = Math.min(a, x);
  const hi = Math.max(a, x);
  if (pieceIndex(s.pieces, lo) < 0 || pieceIndex(s.pieces, lo) !== pieceIndex(s.pieces, hi)) return { pos: NaN, neg: NaN };
  const cuts = [lo, ...s.zeros(lo, hi), hi];
  let pos = 0;
  let neg = 0;
  for (let i = 0; i + 1 < cuts.length; i++) {
    const part = areaFn(id, cuts[i], cuts[i + 1]);
    if (s.f((cuts[i] + cuts[i + 1]) / 2) >= 0) pos += part;
    else neg -= part;
  }
  return { pos, neg };
}

/** the zero of f nearest to x where f changes sign inside the window, with its distance; null if there is none */
export function nearestZero(id: AdId, x: number): { z: number; d: number } | null {
  const s = AD[id];
  let best: { z: number; d: number } | null = null;
  for (const z of s.zeros(s.window.x[0], s.window.x[1])) {
    const d = Math.abs(x - z);
    if (!best || d < best.d) best = { z, d };
  }
  return best;
}

/* ------------------------------------------------------------------------------------------- check registry */

export const CHK_IDS = ['x-sinx', '2sincos', 'asin', 'atan', 'recip2'] as const;
export type ChkId = (typeof CHK_IDS)[number];
export const isChkId = (s: unknown): s is ChkId => typeof s === 'string' && (CHK_IDS as readonly string[]).includes(s);

export interface Cand {
  tex: string;
  /** plain text of the candidate answer G */
  text: string;
  /** plain text of its derivative, in closed form */
  dtext: string;
  G: Fn;
  /** G′ in closed form (sympy) */
  dG: Fn;
  /** dG = f on every piece, decided by sympy */
  correct: boolean;
  /** for a wrong one: the slip behind it, Hebrew plain text (math fragments in U+2066…U+2069) */
  why?: string;
  /** the misconception id of the slip where one fits */
  mc?: string;
  /** the pieces where G is defined (default: the pieces of f) */
  dom?: readonly Piece[];
}

/** G_i − G_j for two correct candidates (i < j): its constant on a piece where both are defined */
export interface DiffPiece {
  lo: number;
  hi: number;
  v: number;
  text: string;
}

export interface ChkSpec {
  id: ChkId;
  tex: string;
  text: string;
  f: Fn;
  pieces: readonly Piece[];
  window: { x: readonly [number, number]; y: readonly [number, number]; yG: readonly [number, number] };
  cands: readonly Cand[];
  /** key `${i}-${j}` with i < j: G_i − G_j on each piece (only for pairs of correct candidates) */
  diffs: Readonly<Record<string, readonly DiffPiece[]>>;
}

const sin = Math.sin;
const cos = Math.cos;
const dp = (v: number, text: string, lo = -Infinity, hi = Infinity): DiffPiece => ({ lo, hi, v, text });

export const CHK: Record<ChkId, ChkSpec> = {
  'x-sinx': {
    id: 'x-sinx',
    tex: 'x\\sin x',
    text: 'x sin x',
    f: (x) => x * sin(x),
    pieces: [ALL],
    window: { x: [-5, 5], y: [-5.5, 5.5], yG: [-8, 8] },
    cands: [
      { tex: '\\sin x-x\\cos x', text: 'sin x − x cos x', dtext: 'x sin x', G: (x) => sin(x) - x * cos(x), dG: (x) => x * sin(x), correct: true },
      { tex: '\\sin x-x\\cos x+3', text: 'sin x − x cos x + 3', dtext: 'x sin x', G: (x) => sin(x) - x * cos(x) + 3, dG: (x) => x * sin(x), correct: true },
      {
        tex: '-\\frac{x^2}{2}\\cos x',
        text: '−(x²/2)·cos x',
        dtext: '(x²/2)·sin x − x cos x',
        G: (x) => -(x * x / 2) * cos(x),
        dG: (x) => (x * x / 2) * sin(x) - x * cos(x),
        correct: false,
        why: `אינטגרלים של מכפלה לא מחשבים גורם אחרי גורם: ${L('∫x sin x dx')} אינו מכפלת ${L('∫x dx')} ב-${L('∫sin x dx')}.`,
        mc: 'MC-c7-product-integral',
      },
      {
        tex: 'x\\cos x-\\sin x',
        text: 'x cos x − sin x',
        dtext: '−x sin x',
        G: (x) => x * cos(x) - sin(x),
        dG: (x) => -x * sin(x),
        correct: false,
        why: `טעות סימן: זו הקדומה של ${L('−x sin x')}, לא של ${L('x sin x')}. הנגזרת הפוכה ל-f.`,
      },
    ],
    diffs: { '0-1': [dp(-3, '−3')] },
  },
  '2sincos': {
    id: '2sincos',
    tex: '2\\sin x\\cos x',
    text: '2 sin x cos x',
    f: (x) => 2 * sin(x) * cos(x),
    pieces: [ALL],
    window: { x: [-4, 4], y: [-2.5, 2.5], yG: [-2.5, 2.5] },
    cands: [
      { tex: '\\sin^2 x', text: 'sin²x', dtext: '2 sin x cos x', G: (x) => sin(x) ** 2, dG: (x) => 2 * sin(x) * cos(x), correct: true },
      { tex: '-\\cos^2 x', text: '−cos²x', dtext: '2 sin x cos x', G: (x) => -(cos(x) ** 2), dG: (x) => 2 * sin(x) * cos(x), correct: true },
      { tex: '-\\frac{\\cos 2x}{2}', text: '−cos(2x)/2', dtext: 'sin 2x', G: (x) => -cos(2 * x) / 2, dG: (x) => sin(2 * x), correct: true },
      {
        tex: '-2\\sin x\\cos x',
        text: '−2 sin x cos x',
        dtext: '2 sin²x − 2 cos²x',
        G: (x) => -2 * sin(x) * cos(x),
        dG: (x) => 2 * sin(x) ** 2 - 2 * cos(x) ** 2,
        correct: false,
        why: `אינטגרציה של כל גורם לחוד: ${L('2 sin x')} נותן ${L('−2 cos x')}, ${L('cos x')} נותן ${L('sin x')}, והמכפלה היא ${L('−f')} עצמה. כשגוזרים אותה מקבלים ${L('2 sin²x − 2 cos²x')}, לא f.`,
        mc: 'MC-c7-product-integral',
      },
    ],
    diffs: { '0-1': [dp(1, '1')], '0-2': [dp(0.5, '1/2')], '1-2': [dp(-0.5, '−1/2')] },
  },
  asin: {
    id: 'asin',
    tex: '\\frac{1}{\\sqrt{1-x^2}}',
    text: '1/√(1 − x²)',
    f: (x) => 1 / Math.sqrt(1 - x * x),
    pieces: [[-1, 1]],
    window: { x: [-1.2, 1.2], y: [-0.5, 5], yG: [-2, 2] },
    cands: [
      { tex: '\\arcsin x', text: 'arcsin x', dtext: '1/√(1 − x²)', G: Math.asin, dG: (x) => 1 / Math.sqrt(1 - x * x), correct: true, dom: [[-1, 1]] },
      { tex: '-\\arccos x', text: '−arccos x', dtext: '1/√(1 − x²)', G: (x) => -Math.acos(x), dG: (x) => 1 / Math.sqrt(1 - x * x), correct: true, dom: [[-1, 1]] },
      {
        tex: '\\sqrt{1-x^2}',
        text: '√(1 − x²)',
        dtext: '−x/√(1 − x²)',
        G: (x) => Math.sqrt(1 - x * x),
        dG: (x) => -x / Math.sqrt(1 - x * x),
        correct: false,
        why: `זה לא ${L('arcsin x')}: הנגזרת של ${L('√(1 − x²)')} היא ${L('−x/√(1 − x²)')}, ולא ${L('1/√(1 − x²)')}. שורש במונה אינו שורש במכנה.`,
        dom: [[-1, 1]],
      },
    ],
    diffs: { '0-1': [dp(PI / 2, 'π/2', -1, 1)] },
  },
  atan: {
    id: 'atan',
    tex: '\\frac{1}{1+x^2}',
    text: '1/(1 + x²)',
    f: (x) => 1 / (1 + x * x),
    pieces: [ALL],
    window: { x: [-5, 5], y: [-1.2, 1.2], yG: [-3.5, 3.5] },
    cands: [
      { tex: '\\arctan x', text: 'arctan x', dtext: '1/(1 + x²)', G: Math.atan, dG: (x) => 1 / (1 + x * x), correct: true },
      {
        tex: '-\\arctan\\frac{1}{x}',
        text: '−arctan(1/x)',
        dtext: '1/(1 + x²)',
        G: (x) => -Math.atan(1 / x),
        dG: (x) => 1 / (1 + x * x),
        correct: true,
        dom: [
          [-Infinity, 0],
          [0, Infinity],
        ],
      },
      {
        tex: '\\ln(1+x^2)',
        text: 'ln(1 + x²)',
        dtext: '2x/(1 + x²)',
        G: (x) => Math.log(1 + x * x),
        dG: (x) => (2 * x) / (1 + x * x),
        correct: false,
        why: `המכנה ${L('1 + x²')} לא גורר לוגריתם: הנגזרת של ${L('ln(1 + x²)')} היא ${L('2x/(1 + x²)')}. הקדומה של ${L('1/(1 + x²)')} היא ${L('arctan x')}.`,
        mc: 'MC-c7-atan-vs-log',
      },
    ],
    diffs: { '0-1': [dp(-PI / 2, '−π/2', -Infinity, 0), dp(PI / 2, 'π/2', 0, Infinity)] },
  },
  recip2: {
    id: 'recip2',
    tex: '\\frac{1}{x^2-1}',
    text: '1/(x² − 1)',
    f: (x) => 1 / (x * x - 1),
    pieces: [
      [-Infinity, -1],
      [-1, 1],
      [1, Infinity],
    ],
    window: { x: [-3, 3], y: [-4, 4], yG: [-3, 3] },
    cands: [
      {
        tex: '\\frac12\\ln\\left|\\frac{x-1}{x+1}\\right|',
        text: '½·ln|(x − 1)/(x + 1)|',
        dtext: '1/(x² − 1)',
        G: (x) => 0.5 * Math.log(Math.abs((x - 1) / (x + 1))),
        dG: (x) => 1 / (x * x - 1),
        correct: true,
      },
      {
        tex: '\\ln|x^2-1|',
        text: 'ln|x² − 1|',
        dtext: '2x/(x² − 1)',
        G: (x) => Math.log(Math.abs(x * x - 1)),
        dG: (x) => (2 * x) / (x * x - 1),
        correct: false,
        why: `לקחו לוגריתם של המכנה: הנגזרת של ${L('ln|x² − 1|')} היא ${L('2x/(x² − 1)')}. זה היה נכון רק אילו במונה היה ${L('2x')}.`,
        mc: 'MC-c7-log-of-denominator',
      },
    ],
    diffs: {},
  },
};

/** the constant G_i − G_j on each piece for two correct candidates, or null when the difference is not constant */
export function diffOf(id: ChkId, i: number, j: number): DiffPiece[] | null {
  if (i === j) return null;
  const lo = Math.min(i, j);
  const hi = Math.max(i, j);
  const d = CHK[id].diffs[`${lo}-${hi}`];
  if (!d) return null;
  if (i < j) return [...d];
  return d.map((p) => ({ ...p, v: -p.v, text: p.v === 0 ? '0' : p.text.startsWith('−') ? p.text.slice(1) : `−${p.text}` }));
}

/** the pieces where candidate k is defined */
export const candPieces = (id: ChkId, k: number): readonly Piece[] => CHK[id].cands[k].dom ?? CHK[id].pieces;
