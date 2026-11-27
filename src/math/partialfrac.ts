/**
 * MODEL SPECIFICATION
 *
 * System:        proper and improper rational functions R(x) = P(x) / Q(x) with real coefficients, each given
 *                together with its EXACT partial-fraction decomposition (lesson 7.4) and FractionLab's core.
 *                Q is stored as a product of factors: a linear factor (x − a)ᵏ or an irreducible quadratic factor
 *                x² + px + q. The decomposition is a list of terms: a polynomial part (an improper R), a term
 *                A/(x − a)ᵏ, or a term (Bx + C)/(x² + px + q). Every coefficient is a stored fraction, recomputed with
 *                sympy `apart` on 2026-11-27 (screens/tools/ch7_presets.py) and re-derived by the cover-up method in
 *                tests/math/partialfrac.test.ts.
 * Dynamics:      none.
 * Boundary:      every fact the figure shows is STORED here, never inferred from sampling: the terms, their TeX and
 *                plain-text forms, the antiderivative of each term (as TeX and as a function), the poles with their
 *                order and top coefficient, the plot window. R itself is evaluated as P(x) divided by the product of
 *                its factors; the cover-up value (x − a)ᵏ·R(x) divides P by the product of the OTHER factors, so it is
 *                defined (and equal to the top coefficient) exactly at x = a, with no 0/0.
 *                The `fit` presets (two, fitA, notes) store the two linear terms A/(x − a) + B/(x − b) the learner is
 *                asked to find; the residual R − (A/(x − a) + B/(x − b)) equals (A₀ − A)/(x − a) + (B₀ − B)/(x − b)
 *                exactly, and is drawn from that form (no cancellation near a pole).
 * Ignored:       exact arithmetic (IEEE double); the antiderivative of a term is one antiderivative on each interval
 *                between poles (the constants of integration are not tracked).
 * Valid when:    x is not a pole of the function evaluated. At a pole R and the terms with that pole return NaN;
 *                coverUp stays finite. An irreducible quadratic factor has q − p²/4 > 0.
 * Failure modes: near a pole values overflow the plot: the figure splits every curve at its poles and clips far values,
 *                so no vertical segment is drawn across a pole.
 */

export type Fn = (x: number) => number;
/** a stored fraction [numerator, denominator], denominator > 0 */
export type Frac = readonly [number, number];

const frac = (f: Frac) => f[0] / f[1];
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const reduce = (n: number, d: number): Frac => {
  const g = gcd(n, d) || 1;
  const s = d < 0 ? -1 : 1;
  return [(s * n) / g, (s * d) / g];
};
const minus = (s: string) => s.replace(/-/g, '−');
const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const sup = (n: number) => String(n).split('').map((c) => SUP[c] ?? c).join('');

/* ------------------------------------------------------------------ text and TeX builders */

/** "x − 1", "x + 2", "x" */
const xaText = (a: number) => (a === 0 ? 'x' : a > 0 ? `x − ${a}` : `x + ${-a}`);
const xaTex = (a: number) => (a === 0 ? 'x' : a > 0 ? `x - ${a}` : `x + ${-a}`);

/** the denominator (x − a)ᵏ as plain text */
const linDenText = (a: number, k: number) => (k === 1 ? (a === 0 ? 'x' : `(${xaText(a)})`) : a === 0 ? `x${sup(k)}` : `(${xaText(a)})${sup(k)}`);

/** A/(x − a)ᵏ as plain text: "−2/(x − 1)", "(1/2)/(x − 1)", "1/(x − 1)²" */
function linText(a: number, k: number, A: Frac): string {
  const [n, d] = A;
  const sign = n < 0 ? '−' : '';
  const top = d === 1 ? `${Math.abs(n)}` : `(${Math.abs(n)}/${d})`;
  const den = linDenText(a, k);
  return `${sign}${top}/${den}`;
}

/** A/(x − a)ᵏ as TeX, signed: -\frac{2}{x - 1}, \frac{1}{2(x - 1)}, \frac{3}{(x - 1)^{2}} */
function linTex(a: number, k: number, A: Frac): string {
  const [n, d] = A;
  const sign = n < 0 ? '-' : '';
  const core = k === 1 ? (a === 0 ? 'x' : xaTex(a)) : a === 0 ? `x^{${k}}` : `(${xaTex(a)})^{${k}}`;
  const needParens = d > 1 && k === 1 && a !== 0;
  const den = `${d > 1 ? d : ''}${needParens ? `(${core})` : core}`;
  return `${sign}\\frac{${Math.abs(n)}}{${den}}`;
}

/** a polynomial with integer coefficients (ascending) as a descending sum */
function polyStr(c: readonly number[], tex: boolean): string {
  const parts: { neg: boolean; body: string }[] = [];
  for (let i = c.length - 1; i >= 0; i--) {
    const v = c[i];
    if (v === 0) continue;
    const m = i === 0 ? '' : i === 1 ? 'x' : tex ? `x^{${i}}` : `x${sup(i)}`;
    const mag = Math.abs(v);
    const body = i === 0 ? `${mag}` : mag === 1 ? m : `${mag}${m}`;
    parts.push({ neg: v < 0, body });
  }
  if (parts.length === 0) return '0';
  let s = '';
  parts.forEach((p, j) => {
    if (j === 0) s += (p.neg ? '-' : '') + p.body;
    else s += (p.neg ? ' - ' : ' + ') + p.body;
  });
  return tex ? s : minus(s);
}

/** the integral of a polynomial (zero constant) as TeX and text */
function polyAnti(c: readonly number[], tex: boolean): string {
  const parts: { neg: boolean; body: string }[] = [];
  for (let i = c.length - 1; i >= 0; i--) {
    if (c[i] === 0) continue;
    const [n, d] = reduce(c[i], i + 1);
    const m = i + 1 === 1 ? 'x' : tex ? `x^{${i + 1}}` : `x${sup(i + 1)}`;
    const mag = Math.abs(n);
    let body: string;
    if (tex) body = d === 1 ? (mag === 1 ? m : `${mag}${m}`) : `\\frac{${mag === 1 ? '' : mag}${m}}{${d}}`;
    else body = d === 1 ? (mag === 1 ? m : `${mag}${m}`) : `${mag === 1 ? '' : mag}${m}/${d}`;
    parts.push({ neg: n < 0, body });
  }
  if (parts.length === 0) return '0';
  let s = '';
  parts.forEach((p, j) => {
    if (j === 0) s += (p.neg ? '-' : '') + p.body;
    else s += (p.neg ? ' - ' : ' + ') + p.body;
  });
  return tex ? s : minus(s);
}

const evalPoly = (c: readonly number[], x: number) => c.reduceRight((acc, v) => acc * x + v, 0);

/* ------------------------------------------------------------------ terms */

interface TermBase {
  /** plain text of the term, signed ("−2/(x − 1)") */
  text: string;
  /** TeX of the term, signed */
  tex: string;
  /** TeX of an antiderivative of the term (no "+C") */
  antiTex: string;
  /** plain text of the antiderivative */
  antiText: string;
  /** the term as a function (NaN at its pole) */
  value: Fn;
  /** an antiderivative on each interval between poles */
  anti: Fn;
  /** the real pole of the term, or null (a polynomial, an irreducible quadratic) */
  pole: number | null;
}

export type PFTerm =
  | (TermBase & { kind: 'poly'; coeffs: readonly number[] })
  | (TermBase & { kind: 'lin'; a: number; k: number; A: Frac; coef: number })
  | (TermBase & { kind: 'quad'; p: number; q: number; B: number; C: number });

function poly(coeffs: number[]): PFTerm {
  const antiCoeffs = coeffs;
  return {
    kind: 'poly',
    coeffs,
    text: polyStr(coeffs, false),
    tex: polyStr(coeffs, true),
    antiTex: polyAnti(antiCoeffs, true),
    antiText: polyAnti(antiCoeffs, false),
    value: (x) => evalPoly(coeffs, x),
    anti: (x) => coeffs.reduce((s, c, i) => s + (c * x ** (i + 1)) / (i + 1), 0),
    pole: null,
  };
}

function lin(a: number, k: number, A: Frac): PFTerm {
  const coef = frac(A);
  let antiTex: string;
  let antiText: string;
  if (k === 1) {
    const mag = Math.abs(A[0]);
    const c = A[1] === 1 ? (mag === 1 ? '' : `${mag}`) : `\\frac{${mag}}{${A[1]}}`;
    const ct = A[1] === 1 ? (mag === 1 ? '' : `${mag}`) : `(${mag}/${A[1]})`;
    const arg = a === 0 ? '|x|' : `|${xaTex(a)}|`;
    antiTex = `${A[0] < 0 ? '-' : ''}${c}\\ln${arg}`;
    antiText = `${A[0] < 0 ? '−' : ''}${ct}${ct ? '·' : ''}ln${a === 0 ? '|x|' : `|${xaText(a)}|`}`;
  } else {
    // −A / ((k − 1)(x − a)^(k−1))
    const B = reduce(-A[0], A[1] * (k - 1));
    antiTex = linTex(a, k - 1, B);
    antiText = linText(a, k - 1, B);
  }
  return {
    kind: 'lin',
    a,
    k,
    A,
    coef,
    text: linText(a, k, A),
    tex: linTex(a, k, A),
    antiTex,
    antiText,
    value: (x) => (x === a ? NaN : coef / (x - a) ** k),
    anti: k === 1 ? (x) => (x === a ? NaN : coef * Math.log(Math.abs(x - a))) : (x) => (x === a ? NaN : -coef / ((k - 1) * (x - a) ** (k - 1))),
    pole: a,
  };
}

/** (Bx + C)/(x² + px + q); the text and TeX are written for p = 0, q = 1 (the only one in the registry) */
function quad(p: number, q: number, B: number, C: number): PFTerm {
  if (p !== 0 || q !== 1) throw new Error('quad(): text and TeX are written for x² + 1 only');
  const numText = C === 0 ? `${B === 1 ? '' : B === -1 ? '−' : B}x` : B === 0 ? `${C}` : `(${B === 1 ? '' : B === -1 ? '−' : B}x ${C < 0 ? '−' : '+'} ${Math.abs(C)})`;
  const numTex = C === 0 ? `${B === 1 ? '' : B === -1 ? '-' : B}x` : B === 0 ? `${C}` : `${B === 1 ? '' : B === -1 ? '-' : B}x ${C < 0 ? '-' : '+'} ${Math.abs(C)}`;
  const parts: { neg: boolean; tex: string; text: string }[] = [];
  if (B !== 0) {
    const m = Math.abs(B);
    parts.push({ neg: B < 0, tex: `${m === 1 ? '\\frac{1}{2}' : `\\frac{${m}}{2}`}\\ln(x^{2} + 1)`, text: `${m === 1 ? '(1/2)' : `(${m}/2)`}·ln(x² + 1)` });
  }
  if (C !== 0) {
    const m = Math.abs(C);
    parts.push({ neg: C < 0, tex: `${m === 1 ? '' : m}\\arctan x`, text: `${m === 1 ? '' : `${m}·`}arctan x` });
  }
  const join = (key: 'tex' | 'text') => parts.map((pt, j) => (j === 0 ? (pt.neg ? (key === 'tex' ? '-' : '−') : '') : pt.neg ? (key === 'tex' ? ' - ' : ' − ') : ' + ') + pt[key]).join('');
  const s = Math.sqrt(q - (p * p) / 4);
  return {
    kind: 'quad',
    p,
    q,
    B,
    C,
    text: `${numText}/(x² + 1)`,
    tex: `${B < 0 && C === 0 ? '-' : ''}\\frac{${B < 0 && C === 0 ? numTex.replace(/^-/, '') : numTex}}{x^{2} + 1}`,
    antiTex: join('tex'),
    antiText: join('text'),
    value: (x) => (B * x + C) / (x * x + p * x + q),
    anti: (x) => (B / 2) * Math.log(x * x + p * x + q) + ((C - (B * p) / 2) / s) * Math.atan((x + p / 2) / s),
    pole: null,
  };
}

/* ------------------------------------------------------------------ registry */

/** a factor of the denominator */
export type Factor = { kind: 'lin'; a: number; k: number } | { kind: 'quad'; p: number; q: number };

const factorVal = (f: Factor, x: number) => (f.kind === 'lin' ? (x - f.a) ** f.k : x * x + f.p * x + f.q);
const factorTex = (f: Factor) => (f.kind === 'lin' ? (f.a === 0 ? (f.k === 1 ? 'x' : `x^{${f.k}}`) : f.k === 1 ? `(${xaTex(f.a)})` : `(${xaTex(f.a)})^{${f.k}}`) : `(x^{2} ${f.p === 0 ? '' : f.p > 0 ? `+ ${f.p}x ` : `- ${-f.p}x `}${f.q >= 0 ? '+' : '-'} ${Math.abs(f.q)})`);
const factorText = (f: Factor) => (f.kind === 'lin' ? linDenText(f.a, f.k) : `(x² ${f.p === 0 ? '' : f.p > 0 ? `+ ${f.p}x ` : `− ${-f.p}x `}${f.q >= 0 ? '+' : '−'} ${Math.abs(f.q)})`);

/** a real pole: its order, the top coefficient (of A/(x − a)ᵏ with k the order) and the term that carries it */
export interface PFPole {
  a: number;
  order: number;
  coef: number;
  coefFrac: Frac;
  termIndex: number;
  /** "x = 1" */
  text: string;
}

export interface PFSpec {
  id: PFId;
  /** R(x) as plain text and TeX */
  text: string;
  tex: string;
  /** the numerator, ascending coefficients, and the denominator's factors */
  num: readonly number[];
  den: readonly Factor[];
  terms: readonly PFTerm[];
  /** the real poles, in the order of the denominator's factors (and of the terms) */
  poles: readonly PFPole[];
  window: { x: readonly [number, number]; y: readonly [number, number] };
  /** the probe's starting x in the `pieces` mode */
  x0: number;
  /** the `fit` mode: A/(x − a) + B/(x − b), the exact A and B, or null when the preset is not offered there */
  fit: { a: number; b: number; A: number; B: number } | null;
  /** is the degree of P at least the degree of Q */
  improper: boolean;
}

export const PF_IDS = ['notes', 'two', 'three', 'repeated', 'quad', 'improper', 'fitA'] as const;
export type PFId = (typeof PF_IDS)[number];
export const FIT_IDS = ['two', 'fitA', 'notes'] as const;
export type FitId = (typeof FIT_IDS)[number];

const isPFId = (s: unknown): s is PFId => typeof s === 'string' && (PF_IDS as readonly string[]).includes(s);
export const isPF = isPFId;
export const isFit = (s: unknown): s is FitId => typeof s === 'string' && (FIT_IDS as readonly string[]).includes(s);

function build(
  id: PFId,
  num: number[],
  den: Factor[],
  terms: PFTerm[],
  window: PFSpec['window'],
  x0: number,
  fitIds: boolean,
): PFSpec {
  const poles: PFPole[] = [];
  for (const f of den) {
    if (f.kind !== 'lin') continue;
    const ti = terms.findIndex((t) => t.kind === 'lin' && t.a === f.a && t.k === f.k);
    const t = terms[ti];
    if (!t || t.kind !== 'lin') throw new Error(`${id}: no top term for the pole ${f.a}`);
    poles.push({ a: f.a, order: f.k, coef: t.coef, coefFrac: t.A, termIndex: ti, text: minus(`x = ${f.a}`) });
  }
  const numTex = polyStr(num, true);
  const numText = polyStr(num, false);
  const denTex = den.map(factorTex).join('');
  const denText = den.map(factorText).join('');
  const degNum = num.reduce((m, c, i) => (c !== 0 ? i : m), 0);
  const degDen = den.reduce((s, f) => s + (f.kind === 'lin' ? f.k : 2), 0);
  let fit: PFSpec['fit'] = null;
  if (fitIds) {
    const [t0, t1] = terms;
    if (t0.kind !== 'lin' || t1.kind !== 'lin' || t0.k !== 1 || t1.k !== 1) throw new Error(`${id}: fit needs two simple linear terms`);
    fit = { a: t0.a, b: t1.a, A: t0.coef, B: t1.coef };
  }
  return {
    id,
    text: `${num.filter((c) => c !== 0).length > 1 ? `(${numText})` : numText}/${den.length > 1 ? `(${denText})` : denText}`,
    tex: `\\frac{${numTex}}{${denTex.replace(/^\(([^()]*)\)$/, '$1')}}`,
    num,
    den,
    terms,
    poles,
    window,
    x0,
    fit,
    improper: degNum >= degDen,
  };
}

const L = (a: number, k = 1): Factor => ({ kind: 'lin', a, k });
const Q: Factor = { kind: 'quad', p: 0, q: 1 };

export const PF: Record<PFId, PFSpec> = {
  notes: build('notes', [-1, 3], [L(1), L(2)], [lin(1, 1, [-2, 1]), lin(2, 1, [5, 1])], { x: [-2, 5], y: [-10, 10] }, 3, true),
  two: build('two', [1], [L(1), L(-1)], [lin(1, 1, [1, 2]), lin(-1, 1, [-1, 2])], { x: [-3, 3], y: [-6, 6] }, 2, true),
  three: build('three', [1, 0, 1], [L(0), L(1), L(-2)], [lin(0, 1, [-1, 2]), lin(1, 1, [2, 3]), lin(-2, 1, [5, 6])], { x: [-4, 4], y: [-8, 8] }, 3, false),
  repeated: build('repeated', [2, 1], [L(1, 2)], [lin(1, 1, [1, 1]), lin(1, 2, [3, 1])], { x: [-2, 4], y: [-10, 10] }, 3, false),
  quad: build('quad', [1], [L(0), Q], [lin(0, 1, [1, 1]), quad(0, 1, -1, 0)], { x: [-3, 3], y: [-5, 5] }, 2, false),
  improper: build('improper', [0, 0, 0, 1], [L(1), L(-1)], [poly([0, 1]), lin(1, 1, [1, 2]), lin(-1, 1, [1, 2])], { x: [-12, 12], y: [-14, 14] }, 3, false),
  fitA: build('fitA', [5, 1], [L(1), L(-2)], [lin(1, 1, [2, 1]), lin(-2, 1, [-1, 1])], { x: [-4, 4], y: [-8, 8] }, 3, true),
};

/* ------------------------------------------------------------------ evaluation */

/** R(x); NaN at a pole */
export function evalR(id: PFId, x: number): number {
  const s = PF[id];
  const d = s.den.reduce((p, f) => p * factorVal(f, x), 1);
  return d === 0 ? NaN : evalPoly(s.num, x) / d;
}

/** the i-th term of the decomposition at x */
export function evalTerm(id: PFId, i: number, x: number): number {
  return PF[id].terms[i].value(x);
}

/** an antiderivative of the i-th term at x */
export function termAnti(id: PFId, i: number, x: number): number {
  return PF[id].terms[i].anti(x);
}

/** the sum of the terms listed in `show` (indexes); with every term shown it equals R */
export function evalSum(id: PFId, show: readonly number[], x: number): number {
  return show.reduce((s, i) => s + evalTerm(id, i, x), 0);
}

/**
 * Cover-up: (x − a)ᵏ·R(x) for the pole's highest power k, computed as P(x) over the product of the OTHER factors, so it
 * is finite at x = a, where it equals the pole's top coefficient. Returns NaN for an index with no pole.
 */
export function coverUp(id: PFId, poleIndex: number, x: number): number {
  const s = PF[id];
  const pole = s.poles[poleIndex];
  if (!pole) return NaN;
  const d = s.den.reduce((p, f) => (f.kind === 'lin' && f.a === pole.a ? p : p * factorVal(f, x)), 1);
  return d === 0 ? NaN : evalPoly(s.num, x) / d;
}

/** the real poles of the terms listed in `show` (where the sum of those terms breaks), ascending, distinct */
export function polesOfTerms(id: PFId, show: readonly number[]): number[] {
  const out = new Set<number>();
  for (const i of show) {
    const p = PF[id].terms[i]?.pole;
    if (p !== null && p !== undefined) out.add(p);
  }
  return [...out].sort((a, b) => a - b);
}

/** every real pole of R, ascending, distinct */
export function polesOfR(id: PFId): number[] {
  return [...new Set(PF[id].poles.map((p) => p.a))].sort((a, b) => a - b);
}

/** the nearest real pole of R to x, with its distance (null when there is none) */
export function nearestPole(id: PFId, x: number): { a: number; dist: number } | null {
  let best: { a: number; dist: number } | null = null;
  for (const a of polesOfR(id)) {
    const dist = Math.abs(x - a);
    if (!best || dist < best.dist) best = { a, dist };
  }
  return best;
}

/** the index (among `show`) of the term of largest absolute value at x, or -1 when none is shown or all are NaN */
export function dominantTerm(id: PFId, show: readonly number[], x: number): number {
  let best = -1;
  let size = -1;
  for (const i of show) {
    const v = Math.abs(evalTerm(id, i, x));
    if (Number.isFinite(v) && v > size) {
      size = v;
      best = i;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ the fit mode */

/** the exact A and B of a fit preset */
export function fitTarget(id: FitId): { A: number; B: number } {
  const f = PF[id].fit;
  if (!f) throw new Error(`${id} is not a fit preset`);
  return { A: f.A, B: f.B };
}

/** the attempt A/(x − a) + B/(x − b) */
export function fitAttempt(id: FitId, A: number, B: number, x: number): number {
  const f = PF[id].fit!;
  return x === f.a || x === f.b ? NaN : A / (x - f.a) + B / (x - f.b);
}

/** R − attempt, in the form (A₀ − A)/(x − a) + (B₀ − B)/(x − b): exactly 0 at the exact A, B */
export function fitResidual(id: FitId, A: number, B: number, x: number): number {
  const f = PF[id].fit!;
  return x === f.a || x === f.b ? NaN : (f.A - A) / (x - f.a) + (f.B - B) / (x - f.b);
}

/** both coefficients exact (within 1e-9) */
export function fitExact(id: FitId, A: number, B: number): boolean {
  const f = PF[id].fit!;
  return Math.abs(A - f.A) < 1e-9 && Math.abs(B - f.B) < 1e-9;
}

/** which of the two poles of a fit preset have a wrong coefficient: [A wrong, B wrong] */
export function fitWrong(id: FitId, A: number, B: number): [boolean, boolean] {
  const f = PF[id].fit!;
  return [Math.abs(A - f.A) >= 1e-9, Math.abs(B - f.B) >= 1e-9];
}

/** "A/(x − 1) + B/(x + 1)" */
export function fitText(id: FitId): string {
  const f = PF[id].fit!;
  return `A/(${xaText(f.a)}) + B/(${xaText(f.b)})`;
}
