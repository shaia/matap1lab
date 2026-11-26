/**
 * MODEL SPECIFICATION
 *
 * System:        the conic sections of lessons 2.1-2.2 as plane curves given by an equation, with their
 *                parametrisations and their classification from the general second-degree equation without an xy term.
 *                  ellipse     ((x−h)/a)² + ((y−k)/b)² = 1,  a, b > 0 (a circle when a = b); P(t) = (h + a cos t, k + b sin t)
 *                  parabola    y = a(x−h)² + k, P(t) = (h + t, k + a t²); or sideways x = a(y−k)² + h, P(t) = (h + a t², k + t)
 *                  hyperbola   ((x−h)/a)² − ((y−k)/b)² = 1 (opens left/right) with P(u) = (h ± a√(1+u²), k + b u);
 *                              ((y−k)/b)² − ((x−h)/a)² = 1 (opens up/down) with P(u) = (h + a u, k ± b√(1+u²));
 *                              (x−h)(y−k) = c, c ≠ 0, with P(t) = (h ± t, k + c/(±t)), t > 0.
 *                              Asymptotes of the first two: y − k = ±(b/a)(x − h); of the third: x = h and y = k.
 *                General      A x² + C y² + D x + E y + F = 0 with integer coefficients. Completing the square:
 *                              A(x−h)² + C(y−k)² + lx·x + ly·y = R, with h = −D/(2A) when A ≠ 0 (else lx = D),
 *                              k = −E/(2C) when C ≠ 0 (else ly = E), R = D²/(4A) + E²/(4C) − F (a term is absent when its
 *                              coefficient is 0). Every h, k, R is an exact rational ({n, d} in lowest terms).
 * Classification (exact, on the rational R and the signs of A, C):
 *                A, C ≠ 0 with the same sign: R of that sign → ellipse (circle if A = C); R = 0 → point; else empty.
 *                A, C ≠ 0 with opposite signs: R ≠ 0 → hyperbola (opens left/right when R/A > 0, else up/down);
 *                R = 0 → pair of intersecting lines y − k = ±√(−A/C)(x − h).
 *                exactly one of A, C zero: the other variable's linear coefficient ≠ 0 → parabola; = 0 → two parallel
 *                lines (R/A > 0), one line (R = 0) or empty.
 *                A = C = 0: a line (D or E ≠ 0), the whole plane (F = 0) or empty.
 * Exactness:     the completed-square data and the classification use rationals and are exact; expanding the completed
 *                form gives back (A, C, D, E, F) exactly (`expandCompleted`). Curve points are IEEE doubles, the
 *                residual of a point of the curve is ~1e-15 relative to the size of the terms.
 * Exact trig:    for angles that are multiples of 30° or 45° cos and sin are r√m with r rational and m ∈ {1, 2, 3}
 *                (`exactCosSin`); coordinates h + a·cos t with a, h rational are then exact surds (`fmtSurdSum`).
 * Ignored:       the sampled polylines (`samplePolylines`) are a drawing aid: hyperbola branches are sampled with
 *                cosh / sinh (resp. an exponential for xy = c) over a finite range, so they stop where the figure's
 *                window ends; the branches are separate polylines and are never joined.
 * Valid when:    a, b, |c| > 0 for the named shapes; integer coefficients below ~1e6 for the exact classification.
 *
 * Drives the figure ConicLab (lessons 2.1-2.2). A numerical probe never proves: tests/math/conics.test.ts checks the
 * identities exactly (completion of the square, classification) and the parametrisations by residuals.
 */

import { fmtFrac, frac, fracToNumber, sqrtParts, type Frac } from './space';

export type Pt = [number, number];

/** a line through (x0, y0) in the direction (dx, dy) */
export interface Line {
  x0: number;
  y0: number;
  dx: number;
  dy: number;
}

export type Shape =
  | { kind: 'ellipse'; h: number; k: number; a: number; b: number }
  | { kind: 'parabolaV'; h: number; k: number; a: number }
  | { kind: 'parabolaH'; h: number; k: number; a: number }
  | { kind: 'hyperbolaX'; h: number; k: number; a: number; b: number }
  | { kind: 'hyperbolaY'; h: number; k: number; a: number; b: number }
  | { kind: 'hyperbolaXY'; h: number; k: number; c: number }
  | { kind: 'lines'; lines: Line[] }
  | { kind: 'point'; h: number; k: number }
  | { kind: 'none' };

/* ---------- exact rationals ---------- */

const ZERO: Frac = frac(0);
const fadd = (x: Frac, y: Frac): Frac => frac(x.n * y.d + y.n * x.d, x.d * y.d);
const fsub = (x: Frac, y: Frac): Frac => frac(x.n * y.d - y.n * x.d, x.d * y.d);
const fmul = (x: Frac, y: Frac): Frac => frac(x.n * y.n, x.d * y.d);
const fdiv = (x: Frac, y: Frac): Frac => frac(x.n * y.d, x.d * y.n);
const fneg = (x: Frac): Frac => frac(-x.n, x.d);
const fabs = (x: Frac): Frac => frac(Math.abs(x.n), x.d);
const fsign = (x: Frac): number => Math.sign(x.n);
const fnum = fracToNumber;

/** x with a denominator dividing 4 (half-integers and quarters, the values the figure uses) as an exact fraction */
export const toFrac = (x: number): Frac => frac(Math.round(x * 4), 4);

/* ---------- parametrisations and residuals ---------- */

export const ellipsePoint = (h: number, k: number, a: number, b: number, t: number): Pt => [h + a * Math.cos(t), k + b * Math.sin(t)];
export const parabolaPointV = (h: number, k: number, a: number, t: number): Pt => [h + t, k + a * t * t];
export const parabolaPointH = (h: number, k: number, a: number, t: number): Pt => [h + a * t * t, k + t];
/** the branch sign σ = ±1 picks the right (+) or left (−) branch */
export const hyperbolaPointX = (h: number, k: number, a: number, b: number, u: number, branch: 1 | -1): Pt => [h + branch * a * Math.sqrt(1 + u * u), k + b * u];
/** the branch sign σ = ±1 picks the upper (+) or lower (−) branch */
export const hyperbolaPointY = (h: number, k: number, a: number, b: number, u: number, branch: 1 | -1): Pt => [h + a * u, k + branch * b * Math.sqrt(1 + u * u)];
/** (h + σt, k + c/(σt)) with t > 0: σ = +1 the branch with x > h, σ = −1 the other */
export const hyperbolaPointXY = (h: number, k: number, c: number, t: number, branch: 1 | -1): Pt => [h + branch * t, k + (branch * c) / t];

/** the parameter t ∈ [0, 2π) of the point of the ellipse in the direction of (x, y) from the centre */
export function ellipseParam(h: number, k: number, a: number, b: number, x: number, y: number): number {
  const t = Math.atan2((y - k) / b, (x - h) / a);
  return t < 0 ? t + 2 * Math.PI : t;
}

/** 0 exactly on the curve (for a `lines` shape: the product of the lines' implicit forms; NaN for `none`) */
export function residual(s: Shape, x: number, y: number): number {
  switch (s.kind) {
    case 'ellipse':
      return ((x - s.h) / s.a) ** 2 + ((y - s.k) / s.b) ** 2 - 1;
    case 'parabolaV':
      return y - (s.k + s.a * (x - s.h) ** 2);
    case 'parabolaH':
      return x - (s.h + s.a * (y - s.k) ** 2);
    case 'hyperbolaX':
      return ((x - s.h) / s.a) ** 2 - ((y - s.k) / s.b) ** 2 - 1;
    case 'hyperbolaY':
      return ((y - s.k) / s.b) ** 2 - ((x - s.h) / s.a) ** 2 - 1;
    case 'hyperbolaXY':
      return (x - s.h) * (y - s.k) - s.c;
    case 'lines': {
      let p = 1;
      for (const l of s.lines) p *= (x - l.x0) * l.dy - (y - l.y0) * l.dx;
      return p;
    }
    case 'point':
      return Math.hypot(x - s.h, y - s.k);
    default:
      return NaN;
  }
}

/** the asymptotes of a hyperbola shape (empty for any other shape) */
export function asymptotes(s: Shape): Line[] {
  if (s.kind === 'hyperbolaX' || s.kind === 'hyperbolaY') {
    return [
      { x0: s.h, y0: s.k, dx: s.a, dy: s.b },
      { x0: s.h, y0: s.k, dx: s.a, dy: -s.b },
    ];
  }
  if (s.kind === 'hyperbolaXY') {
    return [
      { x0: s.h, y0: s.k, dx: 0, dy: 1 },
      { x0: s.h, y0: s.k, dx: 1, dy: 0 },
    ];
  }
  return [];
}

/* ---------- sampling for drawing ---------- */

export interface Box {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
}

const BIG = 1e4;

/** points of f(s) for s in [s0, s1], cut into separate runs where a point is not finite or absurdly far away */
function run(f: (s: number) => Pt, s0: number, s1: number, n: number): Pt[][] {
  const out: Pt[][] = [];
  let cur: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const p = f(s0 + ((s1 - s0) * i) / n);
    if (Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) < BIG && Math.abs(p[1]) < BIG) cur.push(p);
    else if (cur.length) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

/** the curve as separate polylines (a hyperbola's branches are never joined; a closed curve repeats its first point) */
export function samplePolylines(s: Shape, box: Box): Pt[][] {
  switch (s.kind) {
    case 'ellipse':
      return run((t) => ellipsePoint(s.h, s.k, s.a, s.b, t), 0, 2 * Math.PI, 480);
    case 'parabolaV':
      return run((x) => [x, s.k + s.a * (x - s.h) ** 2], box.xmin - 1, box.xmax + 1, 600);
    case 'parabolaH':
      return run((y) => [s.h + s.a * (y - s.k) ** 2, y], box.ymin - 1, box.ymax + 1, 600);
    case 'hyperbolaX':
      return ([1, -1] as const).flatMap((sg) => run((u) => [s.h + sg * s.a * Math.cosh(u), s.k + s.b * Math.sinh(u)], -6, 6, 600));
    case 'hyperbolaY':
      return ([1, -1] as const).flatMap((sg) => run((u) => [s.h + s.a * Math.sinh(u), s.k + sg * s.b * Math.cosh(u)], -6, 6, 600));
    case 'hyperbolaXY':
      return ([1, -1] as const).flatMap((sg) => run((u) => [s.h + sg * Math.exp(u), s.k + (sg * s.c) / Math.exp(u)], -5, 5, 600));
    case 'lines': {
      const L = 60;
      return s.lines.map((l) => {
        const n = Math.hypot(l.dx, l.dy) || 1;
        return [
          [l.x0 - (l.dx / n) * L, l.y0 - (l.dy / n) * L],
          [l.x0 + (l.dx / n) * L, l.y0 + (l.dy / n) * L],
        ] as Pt[];
      });
    }
    default:
      return [];
  }
}

/* ---------- the general equation ---------- */

/** A x² + C y² + D x + E y + F = 0 */
export interface Coeffs {
  A: number;
  C: number;
  D: number;
  E: number;
  F: number;
}

/** A(x−h)² + C(y−k)² + lx·x + ly·y = R; h is null when A = 0 (then lx = D), k is null when C = 0 (then ly = E) */
export interface Completed {
  A: number;
  C: number;
  h: Frac | null;
  k: Frac | null;
  lx: number;
  ly: number;
  R: Frac;
}

export function completeSquare(c: Coeffs): Completed {
  const { A, C, D, E, F } = c;
  const h = A !== 0 ? frac(-D, 2 * A) : null;
  const k = C !== 0 ? frac(-E, 2 * C) : null;
  const tx = A !== 0 ? frac(D * D, 4 * A) : ZERO;
  const ty = C !== 0 ? frac(E * E, 4 * C) : ZERO;
  return { A, C, h, k, lx: A === 0 ? D : 0, ly: C === 0 ? E : 0, R: fsub(fadd(tx, ty), frac(F)) };
}

/** the coefficients obtained by expanding the completed form (rational; equal to the original when it is correct) */
export function expandCompleted(f: Completed): { A: Frac; C: Frac; D: Frac; E: Frac; F: Frac } {
  const h = f.h ?? ZERO;
  const k = f.k ?? ZERO;
  const A = frac(f.A);
  const C = frac(f.C);
  const D = f.A !== 0 ? fmul(frac(-2 * f.A), h) : frac(f.lx);
  const E = f.C !== 0 ? fmul(frac(-2 * f.C), k) : frac(f.ly);
  const F = fsub(fadd(fmul(A, fmul(h, h)), fmul(C, fmul(k, k))), f.R);
  return { A, C, D, E, F };
}

/** the polynomial A x² + C y² + D x + E y + F */
export const evalPoly = (c: Coeffs, x: number, y: number): number => c.A * x * x + c.C * y * y + c.D * x + c.E * y + c.F;

export type ConicType = 'circle' | 'ellipse' | 'parabola' | 'hyperbola' | 'point' | 'empty' | 'two-lines' | 'parallel-lines' | 'double-line' | 'line' | 'plane';

export interface Classification {
  type: ConicType;
  form: Completed;
  shape: Shape;
}

const sqrtR = (x: Frac): number => Math.sqrt(fnum(x));

export function classifyConic(c: Coeffs): Classification {
  const form = completeSquare(c);
  const { A, C, R } = form;
  const hn = form.h ? fnum(form.h) : 0;
  const kn = form.k ? fnum(form.k) : 0;
  const rs = fsign(R);
  const make = (type: ConicType, shape: Shape): Classification => ({ type, form, shape });
  const none = make('empty', { kind: 'none' });

  if (A !== 0 && C !== 0) {
    if (A * C > 0) {
      if (rs === 0) return make('point', { kind: 'point', h: hn, k: kn });
      if (rs * Math.sign(A) < 0) return none;
      const a = sqrtR(fdiv(R, frac(A)));
      const b = sqrtR(fdiv(R, frac(C)));
      return make(A === C ? 'circle' : 'ellipse', { kind: 'ellipse', h: hn, k: kn, a, b });
    }
    if (rs === 0) {
      const s = Math.sqrt(-A / C);
      return make('two-lines', {
        kind: 'lines',
        lines: [
          { x0: hn, y0: kn, dx: 1, dy: s },
          { x0: hn, y0: kn, dx: 1, dy: -s },
        ],
      });
    }
    if (rs * Math.sign(A) > 0) return make('hyperbola', { kind: 'hyperbolaX', h: hn, k: kn, a: sqrtR(fdiv(R, frac(A))), b: sqrtR(fneg(fdiv(R, frac(C)))) });
    return make('hyperbola', { kind: 'hyperbolaY', h: hn, k: kn, a: sqrtR(fneg(fdiv(R, frac(A)))), b: sqrtR(fdiv(R, frac(C))) });
  }
  if (A !== 0) {
    if (c.E !== 0) return make('parabola', { kind: 'parabolaV', h: hn, k: fnum(fdiv(R, frac(c.E))), a: -A / c.E });
    if (rs === 0) return make('double-line', { kind: 'lines', lines: [{ x0: hn, y0: 0, dx: 0, dy: 1 }] });
    if (rs * Math.sign(A) < 0) return none;
    const d = sqrtR(fdiv(R, frac(A)));
    return make('parallel-lines', {
      kind: 'lines',
      lines: [
        { x0: hn - d, y0: 0, dx: 0, dy: 1 },
        { x0: hn + d, y0: 0, dx: 0, dy: 1 },
      ],
    });
  }
  if (C !== 0) {
    if (c.D !== 0) return make('parabola', { kind: 'parabolaH', h: fnum(fdiv(R, frac(c.D))), k: kn, a: -C / c.D });
    if (rs === 0) return make('double-line', { kind: 'lines', lines: [{ x0: 0, y0: kn, dx: 1, dy: 0 }] });
    if (rs * Math.sign(C) < 0) return none;
    const d = sqrtR(fdiv(R, frac(C)));
    return make('parallel-lines', {
      kind: 'lines',
      lines: [
        { x0: 0, y0: kn - d, dx: 1, dy: 0 },
        { x0: 0, y0: kn + d, dx: 1, dy: 0 },
      ],
    });
  }
  if (c.D !== 0 || c.E !== 0) {
    const p: Pt = c.D !== 0 ? [-c.F / c.D, 0] : [0, -c.F / c.E];
    return make('line', { kind: 'lines', lines: [{ x0: p[0], y0: p[1], dx: -c.E, dy: c.D }] });
  }
  return c.F === 0 ? make('plane', { kind: 'none' }) : none;
}

/* ---------- exact trig for multiples of 30° and 45° ---------- */

/** r·√m */
export interface Surd {
  r: Frac;
  m: number;
}

export const surdValue = (s: Surd): number => fnum(s.r) * Math.sqrt(s.m);
export const surdScale = (f: Frac, s: Surd): Surd => ({ r: fmul(f, s.r), m: s.m });
const surdNeg = (s: Surd): Surd => ({ r: fneg(s.r), m: s.m });
const S = (n: number, d: number, m: number): Surd => ({ r: frac(n, d), m });

/** cos and sin of an angle in degrees when it is a multiple of 30° or 45°; null otherwise */
export function exactCosSin(deg: number): { cos: Surd; sin: Surd } | null {
  if (!Number.isInteger(deg)) return null;
  const d = ((deg % 360) + 360) % 360;
  const q = Math.floor(d / 90);
  const rem = d % 90;
  const base: Record<number, [Surd, Surd]> = {
    0: [S(1, 1, 1), S(0, 1, 1)],
    30: [S(1, 2, 3), S(1, 2, 1)],
    45: [S(1, 2, 2), S(1, 2, 2)],
    60: [S(1, 2, 1), S(1, 2, 3)],
  };
  const b = base[rem];
  if (!b) return null;
  const [c, s] = b;
  const rot: [Surd, Surd][] = [
    [c, s],
    [surdNeg(s), c],
    [surdNeg(c), surdNeg(s)],
    [s, surdNeg(c)],
  ];
  const [cos, sin] = rot[q];
  return { cos, sin };
}

/** the surd's own text: "0", "1/2", "√3/2", "−3√2/4" (sign U+2212) */
export function fmtSurd(s: Surd): string {
  if (s.r.n === 0) return '0';
  const { k, m } = sqrtParts(s.m);
  const r = fmul(s.r, frac(k)); // r√(k²m) = rk√m
  if (m === 1) return fmtFrac(r);
  const n = Math.abs(r.n);
  const num = `${n === 1 ? '' : n}√${m}`;
  return `${r.n < 0 ? '−' : ''}${num}${r.d === 1 ? '' : `/${r.d}`}`;
}

/** base + term as text: "1 + √3/2", "−2 − 3√2/4", "3" */
export function fmtSurdSum(base: Frac, term: Surd): string {
  if (term.r.n === 0) return fmtFrac(base);
  const { k, m } = sqrtParts(term.m);
  if (m === 1) return fmtFrac(fadd(base, fmul(term.r, frac(k)))); // a rational term joins the base
  const t = fmtSurd(term);
  if (base.n === 0) return t;
  return t.startsWith('−') ? `${fmtFrac(base)} − ${t.slice(1)}` : `${fmtFrac(base)} + ${t}`;
}

/** the angle in degrees as a multiple of π: 30 → "π/6", 90 → "π/2", 0 → "0", 360 → "2π", 15 → "π/12" */
export function fmtPiFraction(deg: number): string {
  if (deg === 0) return '0';
  const f = frac(deg, 180);
  const num = f.n === 1 ? 'π' : `${f.n}π`;
  return f.d === 1 ? num : `${num}/${f.d}`;
}

/* ---------- text: equations with their actual numbers (sign U+2212) ---------- */

const absInt = (n: number): string => String(Math.abs(n));

/** "x", "(x − 1)", "(y + 2)" for the symbol shifted by the centre coordinate c */
export function fmtShift(sym: string, c: Frac): string {
  if (c.n === 0) return sym;
  return `(${sym} ${c.n < 0 ? '+' : '−'} ${fmtFrac(fabs(c))})`;
}
/** the square of a shifted symbol: "x²" or "(x − 1)²" */
export const fmtShiftSq = (sym: string, c: Frac): string => `${fmtShift(sym, c)}²`;

interface Term {
  neg: boolean;
  text: string;
}
function joinTerms(ts: Term[]): string {
  if (!ts.length) return '0';
  return ts.map((t, i) => (i === 0 ? `${t.neg ? '−' : ''}${t.text}` : ` ${t.neg ? '−' : '+'} ${t.text}`)).join('');
}
const coefText = (n: number): string => (Math.abs(n) === 1 ? '' : absInt(n));

/** "x² + 4y² − 2x + 8y − 11 = 0" */
export function fmtPoly(c: Coeffs): string {
  const ts: Term[] = [];
  const add = (n: number, body: string, bare = false) => {
    if (n !== 0) ts.push({ neg: n < 0, text: bare ? absInt(n) : `${coefText(n)}${body}` });
  };
  add(c.A, 'x²');
  add(c.C, 'y²');
  add(c.D, 'x');
  add(c.E, 'y');
  add(c.F, '', true);
  return `${joinTerms(ts)} = 0`;
}

/** "(x − 1)² + 4(y + 1)² = 16": the completed form with its right-hand side */
export function fmtCompleted(f: Completed): string {
  const ts: Term[] = [];
  if (f.A !== 0) ts.push({ neg: f.A < 0, text: `${coefText(f.A)}${fmtShiftSq('x', f.h!)}` });
  if (f.C !== 0) ts.push({ neg: f.C < 0, text: `${coefText(f.C)}${fmtShiftSq('y', f.k!)}` });
  if (f.lx !== 0) ts.push({ neg: f.lx < 0, text: `${coefText(f.lx)}x` });
  if (f.ly !== 0) ts.push({ neg: f.ly < 0, text: `${coefText(f.ly)}y` });
  return `${joinTerms(ts)} = ${fmtFrac(f.R)}`;
}

/** √f for a positive rational f in exact form: "4", "3/2", "√3", "√6/2" */
export function fmtSqrtFrac(f: Frac): string {
  const { k, m } = sqrtParts(f.n * f.d);
  const q = frac(k, f.d);
  if (m === 1) return fmtFrac(q);
  const num = `${q.n === 1 ? '' : q.n}√${m}`;
  return q.d === 1 ? num : `${num}/${q.d}`;
}

/* ---------- exact points for the parameter values the figure uses (quarters and halves) ---------- */

type Branch = 1 | -1;

/** the point (h + a cos t, k + b sin t) as exact text when t (degrees) is a multiple of 30° or 45°; null otherwise */
export function ellipsePointText(h: number, k: number, a: number, b: number, deg: number): [string, string] | null {
  const e = exactCosSin(deg);
  if (!e) return null;
  return [fmtSurdSum(toFrac(h), surdScale(toFrac(a), e.cos)), fmtSurdSum(toFrac(k), surdScale(toFrac(b), e.sin))];
}

/** the exact point of the parabola for a parameter that is a multiple of 1/4: always rational */
export function parabolaPointExact(h: number, k: number, a: number, t: number, sideways: boolean): [Frac, Frac] {
  const fh = toFrac(h);
  const fk = toFrac(k);
  const ft = toFrac(t);
  const q = fmul(toFrac(a), fmul(ft, ft));
  return sideways ? [fadd(fh, q), fadd(fk, ft)] : [fadd(fh, ft), fadd(fk, q)];
}

/** √(1 + u²) for u a multiple of 1/4: (1/d)·√(d² + n²) */
function sqrt1pu2(u: number): Surd {
  const f = toFrac(u);
  return { r: frac(1, f.d), m: f.d * f.d + f.n * f.n };
}

/**
 * the point of a hyperbola as exact text: 'x' → (h + σa√(1+u²), k + bu); 'y' → (h + au, k + σb√(1+u²));
 * 'xy' → (h + σt, k + σc/t) with t = u > 0
 */
export function hyperbolaPointText(kind: 'x' | 'y' | 'xy', h: number, k: number, a: number, b: number, c: number, u: number, branch: Branch): [string, string] {
  const fh = toFrac(h);
  const fk = toFrac(k);
  const fu = toFrac(u);
  if (kind === 'x') return [fmtSurdSum(fh, surdScale(fmul(toFrac(a), frac(branch)), sqrt1pu2(u))), fmtFrac(fadd(fk, fmul(toFrac(b), fu)))];
  if (kind === 'y') return [fmtFrac(fadd(fh, fmul(toFrac(a), fu))), fmtSurdSum(fk, surdScale(fmul(toFrac(b), frac(branch)), sqrt1pu2(u)))];
  return [fmtFrac(fadd(fh, fmul(frac(branch), fu))), fmtFrac(fadd(fk, fmul(frac(branch), fdiv(toFrac(c), fu))))];
}
