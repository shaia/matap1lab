/**
 * Taylor polynomials, remainders, series and Leibniz series for chapter 6 (TaylorLab's core).
 *
 * MODEL SPECIFICATION
 * - System: a real function f of one variable from the registry `TF` (16 presets, one of them, `binom`, with a real
 *   parameter a), evaluated in IEEE doubles; f(x) = NaN outside its open domain. The lead presets `LEAD` (g about 0,
 *   lesson 6.3) and the Leibniz series `LEIBNIZ` (lesson 6.4) are separate small registries.
 * - Jets: a jet `Jet = number[]` holds the coefficients c₀ … c_N of Σ cₖ(x − x₀)ᵏ, the Taylor polynomial of order N of
 *   some function about x₀. Arithmetic on jets is truncated power-series arithmetic: sum, product (Cauchy, truncated),
 *   quotient (by long division of series, b₀ ≠ 0), and the elementary functions by their standard recurrences, each
 *   derived from a first-order differential equation the function satisfies:
 *     exp:    e′ = u′e                    → k eₖ = Σⱼ₌₁ᵏ j uⱼ eₖ₋ⱼ
 *     log:    u′ = l′u                     → lₖ = (uₖ − (1/k) Σⱼ₌₁ᵏ⁻¹ j lⱼ uₖ₋ⱼ)/u₀            (u₀ > 0)
 *     sin/cos together: s′ = u′c, c′ = −u′s
 *     sinh/cosh together: s′ = u′c, c′ = u′s
 *     pow:    p′u = a u′p                  → pₖ = Σⱼ₌₁ᵏ ((a + 1)j − k) uⱼ pₖ₋ⱼ /(k u₀)          (u₀ > 0)
 *     atan:   w′ = u′/(1 + u²), integrated term by term; tan = sin/cos.
 *   They are exact up to rounding (no finite difference anywhere): a Taylor coefficient at any x₀ is f⁽ᵏ⁾(x₀)/k! to
 *   ~1e-15 relative for the orders used here (≤ 61). tests/math/taylor.test.ts checks them against sympy.
 * - Remainder (`remainderInfo`, `remainderBound`): the Lagrange form R_n(x) = f⁽ⁿ⁺¹⁾(c)(x − x₀)ⁿ⁺¹/(n + 1)! (stated
 *   without proof in the course) gives |R_n| ≤ B = M·dⁿ⁺¹/(n + 1)! on [lo, hi] ∋ x₀, with d = max(|lo − x₀|, |hi − x₀|)
 *   and M = max |f⁽ⁿ⁺¹⁾| on [lo, hi]. How M is taken (`TfSpec.bound`):
 *     'ends'    M = the larger of |f⁽ⁿ⁺¹⁾| at the two ends: EXACT, because |f⁽ⁿ⁺¹⁾| is monotone on the domain (exp, ln1p,
 *               geom, sqrt1p, ln, sqrt, binom: |f⁽ᵏ⁾| = C·|1 ± x|^power) or even and increasing in |x| (cosh: |cosh|,
 *               |sinh|; tan: every derivative is a polynomial in tan x with non-negative coefficients, even or odd);
 *     'one'     sin, cos: the standard M = 1 (every derivative is ±sin or ±cos);
 *     'poly'    x³ − 2x + 1: the ends and the interior critical point 0 of |f′| = |3x² − 2| (exact);
 *     'sampled' gauss, lorentz, arctan, expsin: |f⁽ⁿ⁺¹⁾| oscillates; M is the largest of 801 grid values, a PROBE
 *               (it can miss a peak between grid points by a little; the figure says so).
 *   When f is a polynomial of degree ≤ n (poly, binom with a ∈ {0, 1, 2, 3}) f⁽ⁿ⁺¹⁾ ≡ 0, M = B = 0 (how = 'zero').
 * - Error probes: `sampledMaxError` is the largest |f − T_n| on a grid; `goodBand` scans outward from x₀ for the
 *   interval where |f − T_n| ≤ tol·max(1, |f|) and refines its ends by bisection. Both are probes, never proofs.
 * - Series about 0 (`partialSum`, `seriesCoeffs`): the partial sum S_n(x) = Σₖ₌₀ⁿ cₖxᵏ. The radius of convergence and
 *   the behaviour at the ends (`radius`, `ends`) are STORED facts of the standard series (sympy / the textbook), never
 *   inferred from partial sums: the course has no convergence tests.
 * - Leibniz series (`LEIBNIZ`): Σₖ₌₁^∞ (−1)ᵏ⁺¹ bₖ with bₖ decreasing to 0; S_n = the sum of the first n terms; the stored
 *   exact sum S (sympy). |S − S_n| ≤ b_{n+1} and S lies between S_n and S_{n+1} (the Leibniz bound, a theorem).
 * - Lead presets (`LEAD`): g(x) and its remainders after one and two terms are summed from the series of g (order
 *   LEAD_N = 60) where |x| < sr, never by subtracting nearly equal numbers, so they keep ~1e-15 relative down to
 *   |x| = 10⁻³ (the closed form sin x − x there keeps only ~7 digits); beyond sr the closed form loses at most a factor
 *   ~5. tests/math/taylor.test.ts checks them against sympy at ±10⁻¹, ±10⁻², ±10⁻³.
 * - Valid when: x₀ is inside the domain and away from its ends (the recurrences divide by u₀ for log and pow).
 * - Failure modes: near a pole the coefficients grow like 1/distᵏ and partial sums of order 60 overflow nothing but
 *   lose meaning outside the radius (they grow without bound: that is the picture); far outside the radius S_n(x) of
 *   order 60 can reach 1e30 and is drawn clipped. Partial sums of alternating series with large terms (e^(−x²) at
 *   |x| = 3) cancel digits: about 1e-13 absolute.
 */

import { factorial } from './analysis';

export type Fn = (x: number) => number;
/** coefficients c₀ … c_N of Σ cₖ(x − x₀)ᵏ */
export type Jet = number[];

/* ------------------------------------------------------------------ jets */

const zeros = (n: number): number[] => new Array<number>(n).fill(0);
const order = (a: Jet, b?: Jet) => (b ? Math.min(a.length, b.length) : a.length) - 1;

/** the jet of the variable x about x₀: x₀ + 1·(x − x₀) */
export function jvar(x0: number, N: number): Jet {
  const j = zeros(N + 1);
  j[0] = x0;
  if (N >= 1) j[1] = 1;
  return j;
}

/** the jet of a constant */
export function jconst(c: number, N: number): Jet {
  const j = zeros(N + 1);
  j[0] = c;
  return j;
}

export function jadd(a: Jet, b: Jet): Jet {
  const N = order(a, b);
  const out = zeros(N + 1);
  for (let k = 0; k <= N; k++) out[k] = a[k] + b[k];
  return out;
}

export function jsub(a: Jet, b: Jet): Jet {
  const N = order(a, b);
  const out = zeros(N + 1);
  for (let k = 0; k <= N; k++) out[k] = a[k] - b[k];
  return out;
}

export const jscale = (a: Jet, s: number): Jet => a.map((c) => c * s);

/** the product, truncated (Cauchy) */
export function jmul(a: Jet, b: Jet): Jet {
  const N = order(a, b);
  const out = zeros(N + 1);
  for (let k = 0; k <= N; k++) {
    let s = 0;
    for (let j = 0; j <= k; j++) s += a[j] * b[k - j];
    out[k] = s;
  }
  return out;
}

/** the quotient a/b by long division of series (b₀ ≠ 0, else NaN) */
export function jdiv(a: Jet, b: Jet): Jet {
  const N = order(a, b);
  const out = zeros(N + 1);
  for (let k = 0; k <= N; k++) {
    let s = a[k];
    for (let j = 1; j <= k; j++) s -= b[j] * out[k - j];
    out[k] = s / b[0];
  }
  return out;
}

export function jexp(u: Jet): Jet {
  const N = order(u);
  const e = zeros(N + 1);
  e[0] = Math.exp(u[0]);
  for (let k = 1; k <= N; k++) {
    let s = 0;
    for (let j = 1; j <= k; j++) s += j * u[j] * e[k - j];
    e[k] = s / k;
  }
  return e;
}

/** ln u (u₀ > 0, else NaN) */
export function jlog(u: Jet): Jet {
  const N = order(u);
  const l = zeros(N + 1);
  l[0] = u[0] > 0 ? Math.log(u[0]) : NaN;
  for (let k = 1; k <= N; k++) {
    let s = 0;
    for (let j = 1; j < k; j++) s += j * l[j] * u[k - j];
    l[k] = (u[k] - s / k) / u[0];
  }
  return l;
}

/** sin u and cos u together */
export function jsincos(u: Jet): [Jet, Jet] {
  const N = order(u);
  const s = zeros(N + 1);
  const c = zeros(N + 1);
  s[0] = Math.sin(u[0]);
  c[0] = Math.cos(u[0]);
  for (let k = 1; k <= N; k++) {
    let ss = 0;
    let cc = 0;
    for (let j = 1; j <= k; j++) {
      ss += j * u[j] * c[k - j];
      cc += j * u[j] * s[k - j];
    }
    s[k] = ss / k;
    c[k] = -cc / k;
  }
  return [s, c];
}

export const jsin = (u: Jet): Jet => jsincos(u)[0];
export const jcos = (u: Jet): Jet => jsincos(u)[1];

export function jtan(u: Jet): Jet {
  const [s, c] = jsincos(u);
  return jdiv(s, c);
}

/** sinh u and cosh u together */
export function jsinhcosh(u: Jet): [Jet, Jet] {
  const N = order(u);
  const s = zeros(N + 1);
  const c = zeros(N + 1);
  s[0] = Math.sinh(u[0]);
  c[0] = Math.cosh(u[0]);
  for (let k = 1; k <= N; k++) {
    let ss = 0;
    let cc = 0;
    for (let j = 1; j <= k; j++) {
      ss += j * u[j] * c[k - j];
      cc += j * u[j] * s[k - j];
    }
    s[k] = ss / k;
    c[k] = cc / k;
  }
  return [s, c];
}

export const jsinh = (u: Jet): Jet => jsinhcosh(u)[0];
export const jcosh = (u: Jet): Jet => jsinhcosh(u)[1];

/** u^a for real a, base u₀ > 0 (else NaN) */
export function jpow(u: Jet, a: number): Jet {
  const N = order(u);
  const p = zeros(N + 1);
  p[0] = u[0] > 0 ? u[0] ** a : NaN;
  for (let k = 1; k <= N; k++) {
    let s = 0;
    for (let j = 1; j <= k; j++) s += ((a + 1) * j - k) * u[j] * p[k - j];
    p[k] = s / (k * u[0]);
  }
  return p;
}

export const jsqrt = (u: Jet): Jet => jpow(u, 0.5);

/** arctan u: w′ = u′/(1 + u²), integrated term by term, w₀ = arctan u₀ */
export function jatan(u: Jet): Jet {
  const N = order(u);
  const w = zeros(N + 1);
  w[0] = Math.atan(u[0]);
  if (N === 0) return w;
  const du = zeros(N);
  for (let k = 0; k < N; k++) du[k] = (k + 1) * u[k + 1];
  const um = u.slice(0, N);
  const q = jdiv(du, jadd(jconst(1, N - 1), jmul(um, um)));
  for (let k = 1; k <= N; k++) w[k] = q[k - 1] / k;
  return w;
}

/** The polynomial Σ cₖ(x − x₀)ᵏ as a function (Horner). */
export function taylorPoly(c: readonly number[], x0: number): Fn {
  return (x) => {
    const u = x - x0;
    let s = 0;
    for (let k = c.length - 1; k >= 0; k--) s = s * u + c[k];
    return s;
  };
}

/* ------------------------------------------------------------------ the registry */

export type TfId =
  | 'exp'
  | 'sin'
  | 'cos'
  | 'ln1p'
  | 'geom'
  | 'lorentz'
  | 'tan'
  | 'expsin'
  | 'arctan'
  | 'sqrt1p'
  | 'binom'
  | 'gauss'
  | 'poly'
  | 'ln'
  | 'sqrt'
  | 'cosh';

export type EndKind = 'conv' | 'div';
export type BoundKind = 'ends' | 'one' | 'poly' | 'sampled';

export interface TfSpec {
  tex: string;
  /** a plain label for readouts (binom: use `textOf(id, a)`) */
  text: string;
  /** f(x), NaN outside the domain; `a` is binom's exponent (ignored by the others) */
  f: (x: number, a?: number) => number;
  /** the jet of order N about x₀ */
  jet: (x0: number, N: number, a?: number) => Jet;
  /** the open domain (binom: `domainOf`, it depends on a) */
  domain: [number, number];
  window: { x: [number, number]; y: [number, number] };
  /** the default expansion point */
  x0: number;
  /** the range of the x₀ slider and drag; null = x₀ fixed */
  x0Range: [number, number] | null;
  /** about x₀ = 0: the radius of convergence (Infinity: every x); absent when x₀ = 0 is outside the domain */
  radius?: number;
  /** about x₀ = 0, only when the radius is finite: the series at x = −R and x = R */
  ends?: { left: EndKind; right: EndKind };
  /** how M of the Lagrange bound is taken (see the MODEL SPECIFICATION) */
  bound: BoundKind;
  /** the degree when f is a polynomial */
  degree?: number;
  /** the default half-width δ of the remainder interval and the default probe x */
  delta: number;
  probe: number;
}

const ALL: [number, number] = [-Infinity, Infinity];
const nanOut = (v: number) => (Number.isFinite(v) ? v : NaN);

export const TF: Record<TfId, TfSpec> = {
  exp: {
    tex: 'e^{x}',
    text: 'eˣ',
    f: (x) => Math.exp(x),
    jet: (x0, N) => jexp(jvar(x0, N)),
    domain: ALL,
    window: { x: [-3, 3], y: [-1, 8] },
    x0: 0,
    x0Range: [-2, 2],
    radius: Infinity,
    bound: 'ends',
    delta: 1,
    probe: 1,
  },
  sin: {
    tex: '\\sin x',
    text: 'sin x',
    f: (x) => Math.sin(x),
    jet: (x0, N) => jsin(jvar(x0, N)),
    domain: ALL,
    window: { x: [-7, 7], y: [-2.5, 2.5] },
    x0: 0,
    x0Range: [-3, 3],
    radius: Infinity,
    bound: 'one',
    delta: 1,
    probe: 2,
  },
  cos: {
    tex: '\\cos x',
    text: 'cos x',
    f: (x) => Math.cos(x),
    jet: (x0, N) => jcos(jvar(x0, N)),
    domain: ALL,
    window: { x: [-7, 7], y: [-2.5, 2.5] },
    x0: 0,
    x0Range: [-3, 3],
    radius: Infinity,
    bound: 'one',
    delta: 1,
    probe: 1,
  },
  ln1p: {
    tex: '\\ln(1+x)',
    text: 'ln(1 + x)',
    f: (x) => (x > -1 ? Math.log1p(x) : NaN),
    jet: (x0, N) => jlog(jadd(jconst(1, N), jvar(x0, N))),
    domain: [-1, Infinity],
    window: { x: [-1.5, 3], y: [-3, 2.5] },
    x0: 0,
    x0Range: [-0.5, 2],
    radius: 1,
    ends: { left: 'div', right: 'conv' },
    bound: 'ends',
    delta: 0.5,
    probe: 0.5,
  },
  geom: {
    tex: '\\frac{1}{1-x}',
    text: '1/(1 − x)',
    f: (x) => (x < 1 ? 1 / (1 - x) : NaN),
    jet: (x0, N) => jdiv(jconst(1, N), jsub(jconst(1, N), jvar(x0, N))),
    domain: [-Infinity, 1],
    window: { x: [-2.5, 1.5], y: [-2, 6] },
    x0: 0,
    x0Range: [-1.5, 0.5],
    radius: 1,
    ends: { left: 'div', right: 'div' },
    bound: 'ends',
    delta: 0.5,
    probe: 0.5,
  },
  lorentz: {
    tex: '\\frac{1}{1+x^2}',
    text: '1/(1 + x²)',
    f: (x) => 1 / (1 + x * x),
    jet: (x0, N) => {
      const v = jvar(x0, N);
      return jdiv(jconst(1, N), jadd(jconst(1, N), jmul(v, v)));
    },
    domain: ALL,
    window: { x: [-3, 3], y: [-0.8, 1.6] },
    x0: 0,
    x0Range: [-2, 2],
    radius: 1,
    ends: { left: 'div', right: 'div' },
    bound: 'sampled',
    delta: 0.5,
    probe: 0.5,
  },
  tan: {
    tex: '\\tan x',
    text: 'tan x',
    f: (x) => (Math.abs(x) < Math.PI / 2 ? Math.tan(x) : NaN),
    jet: (x0, N) => jtan(jvar(x0, N)),
    domain: [-Math.PI / 2, Math.PI / 2],
    window: { x: [-2, 2], y: [-4, 4] },
    x0: 0,
    x0Range: [-1, 1],
    radius: Math.PI / 2,
    ends: { left: 'div', right: 'div' },
    bound: 'ends',
    delta: 0.5,
    probe: 0.8,
  },
  expsin: {
    tex: 'e^{\\sin x}',
    text: 'e^(sin x)',
    f: (x) => Math.exp(Math.sin(x)),
    jet: (x0, N) => jexp(jsin(jvar(x0, N))),
    domain: ALL,
    window: { x: [-7, 7], y: [-0.5, 3.2] },
    x0: 0,
    x0Range: [-3, 3],
    radius: Infinity,
    bound: 'sampled',
    delta: 1,
    probe: 1,
  },
  arctan: {
    tex: '\\arctan x',
    text: 'arctan x',
    f: (x) => Math.atan(x),
    jet: (x0, N) => jatan(jvar(x0, N)),
    domain: ALL,
    window: { x: [-3, 3], y: [-2, 2] },
    x0: 0,
    x0Range: [-2, 2],
    radius: 1,
    ends: { left: 'conv', right: 'conv' },
    bound: 'sampled',
    delta: 0.5,
    probe: 0.5,
  },
  sqrt1p: {
    tex: '\\sqrt{1+x}',
    text: '√(1 + x)',
    f: (x) => (x > -1 ? Math.sqrt(1 + x) : NaN),
    jet: (x0, N) => jsqrt(jadd(jconst(1, N), jvar(x0, N))),
    domain: [-1, Infinity],
    window: { x: [-1.5, 3], y: [-0.5, 2.5] },
    x0: 0,
    x0Range: [-0.5, 2],
    radius: 1,
    ends: { left: 'conv', right: 'conv' },
    bound: 'ends',
    delta: 0.5,
    probe: 0.5,
  },
  binom: {
    tex: '(1+x)^{a}',
    text: '(1 + x)ᵃ',
    f: (x, a = 0.5) => (x > domainOf('binom', a)[0] ? nanOut((1 + x) ** a) : NaN),
    jet: (x0, N, a = 0.5) => jpow(jadd(jconst(1, N), jvar(x0, N)), a),
    domain: [-1, Infinity],
    window: { x: [-1.5, 2.5], y: [-1, 5] },
    x0: 0,
    x0Range: [-0.5, 1.5],
    radius: 1,
    bound: 'ends',
    delta: 0.5,
    probe: 0.5,
  },
  gauss: {
    tex: 'e^{-x^2}',
    text: 'e^(−x²)',
    f: (x) => Math.exp(-x * x),
    jet: (x0, N) => {
      const v = jvar(x0, N);
      return jexp(jscale(jmul(v, v), -1));
    },
    domain: ALL,
    window: { x: [-3.5, 3.5], y: [-0.6, 1.5] },
    x0: 0,
    x0Range: [-2, 2],
    radius: Infinity,
    bound: 'sampled',
    delta: 1,
    probe: 1,
  },
  poly: {
    tex: 'x^3-2x+1',
    text: 'x³ − 2x + 1',
    f: (x) => x * x * x - 2 * x + 1,
    jet: (x0, N) => {
      const v = jvar(x0, N);
      return jadd(jsub(jmul(jmul(v, v), v), jscale(v, 2)), jconst(1, N));
    },
    domain: ALL,
    window: { x: [-2.5, 2.5], y: [-4, 6] },
    x0: 0,
    x0Range: [-1.5, 1.5],
    radius: Infinity,
    bound: 'poly',
    degree: 3,
    delta: 1,
    probe: 1.5,
  },
  ln: {
    tex: '\\ln x',
    text: 'ln x',
    f: (x) => (x > 0 ? Math.log(x) : NaN),
    jet: (x0, N) => jlog(jvar(x0, N)),
    domain: [0, Infinity],
    window: { x: [-0.2, 4], y: [-3, 2] },
    x0: 1,
    x0Range: [0.5, 3],
    bound: 'ends',
    delta: 0.5,
    probe: 1.5,
  },
  sqrt: {
    tex: '\\sqrt{x}',
    text: '√x',
    f: (x) => (x > 0 ? Math.sqrt(x) : NaN),
    jet: (x0, N) => jsqrt(jvar(x0, N)),
    domain: [0, Infinity],
    window: { x: [-0.5, 9], y: [-1, 4] },
    x0: 4,
    x0Range: [1, 8],
    bound: 'ends',
    delta: 1,
    probe: 5,
  },
  cosh: {
    tex: '\\cosh x',
    text: 'cosh x',
    f: (x) => Math.cosh(x),
    jet: (x0, N) => jcosh(jvar(x0, N)),
    domain: ALL,
    window: { x: [-3, 3], y: [-1, 6] },
    x0: 0,
    x0Range: [-2, 2],
    radius: Infinity,
    bound: 'ends',
    delta: 1,
    probe: 1,
  },
};

export const TF_IDS = Object.keys(TF) as TfId[];
export const isTfId = (x: unknown): x is TfId => typeof x === 'string' && x in TF;
/** the presets with a series about 0 (the radius mode) */
export const hasSeriesAt0 = (id: TfId): boolean => TF[id].radius !== undefined;

/** binom with a ∈ {0, 1, 2, 3} is a polynomial (radius ∞, domain ℝ) */
const binomPoly = (a: number) => Number.isInteger(a) && a >= 0 && a <= 3;

/** the open domain of a preset (binom: ℝ when it is a polynomial, else x > −1) */
export function domainOf(id: TfId, a = 0.5): [number, number] {
  if (id === 'binom') return binomPoly(a) ? ALL : [-1, Infinity];
  return TF[id].domain;
}

/** the radius of convergence about 0 */
export function radiusOf(id: TfId, a = 0.5): number | undefined {
  if (id === 'binom') return binomPoly(a) ? Infinity : 1;
  return TF[id].radius;
}

/** the ends of the interval of convergence about 0 (finite radius only; binom: not shown) */
export function endsOf(id: TfId, a = 0.5): { left: EndKind; right: EndKind } | undefined {
  if (id === 'binom') return undefined;
  const R = radiusOf(id, a);
  return R !== undefined && Number.isFinite(R) ? TF[id].ends : undefined;
}

/** the degree when f is a polynomial (poly 3; binom with a ∈ {0, 1, 2, 3}: a) */
export function degreeOf(id: TfId, a = 0.5): number | undefined {
  if (id === 'binom') return binomPoly(a) ? a : undefined;
  return TF[id].degree;
}

/**
 * The radius of convergence about x₀, where the figure shows one: about 0 the stored radius; about x₀ ≠ 0 the
 * distance to the nearest point where the function breaks (also a complex one): arctan and 1/(1 + x²) √(1 + x₀²)
 * (to ±i), ln(1 + x) and √(1 + x) 1 + x₀, 1/(1 − x) |1 − x₀|, ln x and √x x₀; entire functions ∞. null: not shown.
 */
export function radiusAbout(id: TfId, x0: number, a = 0.5): number | null {
  if (x0 === 0) return radiusOf(id, a) ?? null;
  switch (id) {
    case 'arctan':
    case 'lorentz':
      return Math.sqrt(1 + x0 * x0);
    case 'ln1p':
    case 'sqrt1p':
      return 1 + x0;
    case 'geom':
      return Math.abs(1 - x0);
    case 'ln':
    case 'sqrt':
      return x0;
    case 'exp':
    case 'sin':
    case 'cos':
    case 'expsin':
    case 'gauss':
    case 'poly':
    case 'cosh':
      return Infinity;
    case 'binom':
      return binomPoly(a) ? Infinity : null;
    default:
      return null;
  }
}

/** a plain label; binom is always "(1 + x)ᵃ" (its exponent is given apart, `aText`), so its chip never reads like
 * another preset's (√(1 + x) is binom at a = 1/2) */
export function textOf(id: TfId, _a = 0.5): string {
  return TF[id].text;
}

/** binom's exponent as text: 1/2, −2, 1/3, 0.75 */
export function aText(a: number): string {
  const q = ratApprox(a, 12);
  const s = q ? (q[1] === 1 ? `${q[0]}` : `${q[0]}/${q[1]}`) : String(Number(a.toPrecision(4)));
  return s.replace(/-/g, '−');
}

/** f of a preset as a plain function */
export const fnOf = (id: TfId, a = 0.5): Fn => (x) => TF[id].f(x, a);

/** The Taylor coefficients c₀ … c_n of a preset about x₀: cₖ = f⁽ᵏ⁾(x₀)/k!, from jets. */
export const taylorCoeffs = (id: TfId, x0: number, n: number, a = 0.5): number[] => TF[id].jet(x0, n, a);

/* ------------------------------------------------------------------ series about 0 */

const SERIES_N = 61;
const seriesCache = new Map<string, number[]>();

/** the coefficients c₀ … c_N (N ≤ 61) of the series about 0 */
export function seriesCoeffs(id: TfId, N: number, a = 0.5): number[] {
  const key = `${id}:${a}`;
  let c = seriesCache.get(key);
  if (!c) {
    c = TF[id].jet(0, SERIES_N, a);
    seriesCache.set(key, c);
  }
  return c.slice(0, Math.min(N, SERIES_N) + 1);
}

/** S_n(x) = Σₖ₌₀ⁿ cₖxᵏ, the series about 0 to order n (Horner) */
export function partialSum(id: TfId, n: number, x: number, a = 0.5): number {
  const c = seriesCoeffs(id, n, a);
  let s = 0;
  for (let k = c.length - 1; k >= 0; k--) s = s * x + c[k];
  return s;
}

/* ------------------------------------------------------------------ leading terms */

/** The first coefficient of a jet with order ≥ `from` that is not zero (|c| > tol·max(1, |c₀|)), with its order. */
export function leadingTerm(jet: Jet, from = 0, tol = 1e-12): { k: number; c: number } | null {
  const scale = Math.max(1, Math.abs(jet[0]));
  for (let k = from; k < jet.length; k++) if (Math.abs(jet[k]) > tol * scale) return { k, c: jet[k] };
  return null;
}

/* ------------------------------------------------------------------ remainder */

/** the interval [x₀ − δ, x₀ + δ] clipped to the domain, keeping 2% of the distance to a finite end away from it */
export function remainderInterval(id: TfId, x0: number, delta: number, a = 0.5): [number, number] {
  const [dl, dh] = domainOf(id, a);
  const lo = Number.isFinite(dl) ? Math.max(x0 - delta, dl + 0.02 * (x0 - dl)) : x0 - delta;
  const hi = Number.isFinite(dh) ? Math.min(x0 + delta, dh - 0.02 * (dh - x0)) : x0 + delta;
  return [lo, hi];
}

export type RemainderHow = 'ends' | 'one' | 'poly' | 'zero' | 'sampled';

export interface RemainderInfo {
  /** max |f⁽ⁿ⁺¹⁾| on [lo, hi] (exact, the standard 1, or sampled) */
  M: number;
  /** where M was found (ends, poly, sampled); NaN for 'one' and 'zero' */
  at: number;
  how: RemainderHow;
  /** d = max(|lo − x₀|, |hi − x₀|) */
  d: number;
  /** the Lagrange bound B = M·dⁿ⁺¹/(n + 1)! */
  B: number;
}

const SAMPLES_M = 801;

/** The Lagrange bound on [lo, hi] and how M was taken (see the MODEL SPECIFICATION). */
export function remainderInfo(id: TfId, x0: number, n: number, lo: number, hi: number, a = 0.5): RemainderInfo {
  const spec = TF[id];
  const d = Math.max(Math.abs(lo - x0), Math.abs(hi - x0));
  const k = n + 1;
  const fact = factorial(k);
  const deg = degreeOf(id, a);
  if (deg !== undefined && k > deg) return { M: 0, at: NaN, how: 'zero', d, B: 0 };
  if (spec.bound === 'one') return { M: 1, at: NaN, how: 'one', d, B: d ** k / fact };
  /** |cₖ(x)| = |f⁽ᵏ⁾(x)|/k! */
  const ck = (x: number) => Math.abs(spec.jet(x, k, a)[k]);
  let best = -1;
  let at = lo;
  const consider = (x: number) => {
    const v = ck(x);
    if (v > best) [best, at] = [v, x];
  };
  if (spec.bound === 'sampled') {
    for (let i = 0; i < SAMPLES_M; i++) consider(lo + ((hi - lo) * i) / (SAMPLES_M - 1));
  } else {
    consider(lo);
    consider(hi);
    if (spec.bound === 'poly' && lo < 0 && 0 < hi) consider(0);
  }
  return { M: best * fact, at, how: spec.bound === 'sampled' ? 'sampled' : spec.bound === 'poly' ? 'poly' : 'ends', d, B: best * d ** k };
}

/** B = M·max(|lo − x₀|, |hi − x₀|)ⁿ⁺¹/(n + 1)! */
export const remainderBound = (id: TfId, x0: number, n: number, lo: number, hi: number, a = 0.5): number =>
  remainderInfo(id, x0, n, lo, hi, a).B;

/** The largest |f − T_n| on a grid of [lo, hi]: a probe. */
export function sampledMaxError(id: TfId, x0: number, n: number, lo: number, hi: number, a = 0.5, samples = 401): number {
  const T = taylorPoly(taylorCoeffs(id, x0, n, a), x0);
  const f = fnOf(id, a);
  let m = 0;
  for (let i = 0; i < samples; i++) {
    const x = lo + ((hi - lo) * i) / (samples - 1);
    const e = Math.abs(f(x) - T(x));
    if (e > m) m = e;
  }
  return m;
}

/* ------------------------------------------------------------------ the band where T_n is good (a probe) */

export interface Band {
  lo: number;
  hi: number;
  /** false: the scan reached the edge of the window or of the domain on that side */
  loBounded: boolean;
  hiBounded: boolean;
}

/**
 * The interval around x₀, inside `win` and the domain, where |f − T_n| ≤ tol·max(1, |f|): scanned outward from x₀ in
 * `steps` steps per side, each crossing refined by bisection. A probe: a narrow dip between grid points can be missed.
 */
export function goodBand(id: TfId, x0: number, n: number, tol: number, win: [number, number], a = 0.5, steps = 600): Band {
  const T = taylorPoly(taylorCoeffs(id, x0, n, a), x0);
  const f = fnOf(id, a);
  const ok = (x: number) => {
    const v = f(x);
    return Number.isFinite(v) && Math.abs(v - T(x)) <= tol * Math.max(1, Math.abs(v));
  };
  const [dl, dh] = domainOf(id, a);
  const eps = 1e-9 * (win[1] - win[0]);
  const edgeLo = Math.max(win[0], dl + eps);
  const edgeHi = Math.min(win[1], dh - eps);
  const side = (edge: number): { at: number; bounded: boolean } => {
    const span = edge - x0;
    if (Math.abs(span) < eps) return { at: x0, bounded: false };
    let prev = x0;
    for (let i = 1; i <= steps; i++) {
      const x = x0 + (span * i) / steps;
      if (!ok(x)) {
        let p = prev;
        let q = x;
        for (let j = 0; j < 40; j++) {
          const m = 0.5 * (p + q);
          if (ok(m)) p = m;
          else q = m;
        }
        return { at: p, bounded: true };
      }
      prev = x;
    }
    return { at: edge, bounded: false };
  };
  const L = side(edgeLo);
  const H = side(edgeHi);
  return { lo: L.at, hi: H.at, loBounded: L.bounded, hiBounded: H.bounded };
}

/* ------------------------------------------------------------------ formatting a polynomial */

/**
 * The fraction p/q with q ≤ maxDen equal to c within tol·|c| (continued fractions), or null. A convergent of an
 * irrational number also comes close (|c − p/q| ≈ 1/(q·q′), e ≈ 1084483/398959 to 2e-13 relative), so a fraction is
 * accepted only when it is far closer than a convergent typically is: |c − p/q|·q² ≤ 10⁻³ as well. A true fraction
 * carried through the recurrences is off by ~1e-16 relative and passes; e/k!, √3/2, ln 2 do not.
 */
export function ratApprox(c: number, maxDen = 1e6, tol = 1e-12): [number, number] | null {
  if (!Number.isFinite(c)) return null;
  if (c === 0) return [0, 1];
  const sgn = c < 0 ? -1 : 1;
  const ac = Math.abs(c);
  let h0 = 0;
  let h1 = 1;
  let k0 = 1;
  let k1 = 0;
  let xx = ac;
  for (let i = 0; i < 64; i++) {
    const t = Math.floor(xx);
    const h2 = t * h1 + h0;
    const k2 = t * k1 + k0;
    if (k2 > maxDen) break;
    [h0, h1, k0, k1] = [h1, h2, k1, k2];
    const err = Math.abs(ac - h1 / k1);
    if (err <= tol * ac && err * k1 * k1 <= 1e-3) return [sgn * h1, k1];
    const frac = xx - t;
    if (frac < 1e-18) break;
    xx = 1 / frac;
  }
  return null;
}

const SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (k: number) => String(k).replace(/\d/g, (d) => SUPS[Number(d)]);
const minus = (s: string) => s.replace(/-/g, '−');
/** 4 significant digits, no exponent below 1e-4 … (then a·10ⁿ) */
function sig4(v: number): string {
  const av = Math.abs(v);
  if (av !== 0 && (av < 1e-4 || av >= 1e6)) {
    const e = Math.floor(Math.log10(av));
    const m = Number((v / 10 ** e).toPrecision(4));
    return minus(`${m}·10${e < 0 ? '⁻' + sup(-e) : sup(e)}`);
  }
  return minus(String(Number(v.toPrecision(4))));
}

/** the expansion point in a readout: a decimal with ≤ 4 places as it is (slider values), else a short fraction, else
 * 4 significant digits (π → 3.142) */
export function fmtPoint(x0: number): string {
  const r4 = Math.round(x0 * 1e4);
  if (Math.abs(x0 * 1e4 - r4) < 1e-6 && Math.abs(x0) < 1e6) return minus(String(r4 / 1e4));
  const q = ratApprox(x0, 100, 1e-12);
  if (q) return minus(q[1] === 1 ? `${q[0]}` : `${q[0]}/${q[1]}`);
  return sig4(x0);
}

/** True when cₖ is a rounding remnant of an exact zero: below 1e-12 of its neighbours. */
function isZeroCoeff(c: readonly number[], k: number): boolean {
  if (c[k] === 0) return true;
  const nb = Math.max(Math.abs(c[k - 1] ?? 0), Math.abs(c[k + 1] ?? 0));
  return Math.abs(c[k]) <= 1e-12 * nb;
}

/**
 * The polynomial Σₖ₌₀ⁿ cₖ(x − x₀)ᵏ as plain text: powers of (x − x₀) (of x when x₀ = 0); a coefficient that is p/q
 * with q ≤ 10⁶ (to 1e-12) is written as a fraction ("x²/2", "5(x − 4)³/16384"), any other with 4 significant digits;
 * zero terms are left out. `c` may carry c_{n+1} beyond the order (it only helps to recognise rounding zeros).
 */
export function polyText(c: readonly number[], x0: number, n = c.length - 1): string {
  const base = x0 === 0 ? 'x' : `(x ${x0 < 0 ? '+' : '−'} ${fmtPoint(Math.abs(x0))})`;
  const parts: { neg: boolean; body: string }[] = [];
  for (let k = 0; k <= n; k++) {
    if (isZeroCoeff(c, k)) continue;
    const v = c[k];
    const neg = v < 0;
    const av = Math.abs(v);
    const pw = k === 0 ? '' : k === 1 ? base : `${base}${sup(k)}`;
    const q = ratApprox(av);
    let body: string;
    if (q) {
      const [p, d] = q;
      if (k === 0) body = d === 1 ? `${p}` : `${p}/${d}`;
      else body = `${p === 1 ? '' : p}${pw}${d === 1 ? '' : `/${d}`}`;
    } else body = k === 0 ? sig4(av) : `${sig4(av)}${pw}`;
    parts.push({ neg, body });
  }
  if (parts.length === 0) return '0';
  return parts.map((t, i) => (i === 0 ? (t.neg ? '−' : '') + t.body : `${t.neg ? ' − ' : ' + '}${t.body}`)).join('');
}

/* ------------------------------------------------------------------ lead presets (lesson 6.3) */

export type LeadId = 'sin-x' | '1-cos' | 'exp-1-x' | 'ln1p-x' | 'tan-x' | 'sinc';

export interface LeadSpec {
  tex: string;
  text: string;
  /** g(x), NaN where undefined: summed from its series where |x| < `sr`, else from its closed form (see `LEAD`) */
  g: Fn;
  /** g(x) minus its leading term (terms = 1), or minus the leading and the next term (terms = 2), computed the same
   * way, so the remainder keeps its own digits (never g(x) − c xᵏ by subtraction near 0) */
  rest: (x: number, terms: 1 | 2) => number;
  /** below this |x|, g and `rest` are summed from the series of order LEAD_N (truncation below 1e-18 relative) */
  sr: number;
  /** the jet of g about 0 */
  jet: (N: number) => Jet;
  /** the leading term c xᵏ and the next one d xᵐ (sympy, 2026-11-27) */
  k: number;
  c: number;
  cText: string;
  m: number;
  d: number;
  dText: string;
  /** g is undefined at 0 (a hole at (0, c)) */
  hole0?: boolean;
  /** the largest half-width of the plot window (tan x − x has poles at ±π/2) */
  xMax: number;
}

const shiftDown = (j: Jet): Jet => [...j.slice(1), 0];

/** the order of the series that LEAD sums near 0 */
export const LEAD_N = 60;

/** A LEAD preset as written below: `g` is its closed form, which cancels digits near 0 (sin x − x at 10⁻³ is 1.7e-10
 * from two numbers of size 1e-3, so its last ~7 digits are rounding noise), and `sr` is where the series takes over. */
type LeadBase = Omit<LeadSpec, 'rest'>;

/**
 * g and its remainders without cancellation. For |x| < sr: Σ cⱼxʲ from the jet of order LEAD_N, by Horner from the
 * highest order down, each coefficient exact to rounding and every term computed on its own, so the sum keeps ~1e-16
 * relative (the remainder after one or two terms is the same sum started at the next order). The series converges
 * there with truncation below 1e-18 relative: the entire ones (sin, cos, exp) at |x| < 1 by 1/61!, tan x − x at
 * |x| < 0.8 by (1.6/π)⁶¹, ln(1 + x) − x at |x| < 0.5 by 2⁻⁶¹. For |x| ≥ sr: the closed form, where the cancellation
 * costs at most a factor ~5 (tan 0.8 against tan 0.8 − 0.8; ln 1.5 against ln 1.5 − 0.5).
 */
function accurateLead(base: LeadBase): LeadSpec {
  const c = base.jet(LEAD_N);
  const tail = (x: number, from: number) => {
    let v = 0;
    for (let j = LEAD_N; j >= from; j--) v = v * x + c[j];
    return v * x ** from;
  };
  const direct = base.g;
  const near = (x: number) => Math.abs(x) < base.sr && !(base.hole0 && x === 0);
  return {
    ...base,
    g: (x) => (near(x) ? tail(x, 0) : direct(x)),
    rest: (x, terms) => {
      if (near(x)) return tail(x, terms === 1 ? base.k + 1 : base.m + 1);
      const v = direct(x) - base.c * x ** base.k;
      return terms === 1 ? v : v - base.d * x ** base.m;
    },
  };
}

const LEAD_BASE: Record<LeadId, LeadBase> = {
  'sin-x': {
    tex: '\\sin x-x',
    text: 'sin x − x',
    g: (x) => Math.sin(x) - x,
    sr: 1,
    jet: (N) => jsub(jsin(jvar(0, N)), jvar(0, N)),
    k: 3,
    c: -1 / 6,
    cText: '−1/6',
    m: 5,
    d: 1 / 120,
    dText: '1/120',
    xMax: 4,
  },
  '1-cos': {
    tex: '1-\\cos x',
    text: '1 − cos x',
    g: (x) => 2 * Math.sin(x / 2) ** 2,
    sr: 1,
    jet: (N) => jsub(jconst(1, N), jcos(jvar(0, N))),
    k: 2,
    c: 1 / 2,
    cText: '1/2',
    m: 4,
    d: -1 / 24,
    dText: '−1/24',
    xMax: 4,
  },
  'exp-1-x': {
    tex: 'e^{x}-1-x',
    text: 'eˣ − 1 − x',
    g: (x) => Math.expm1(x) - x,
    sr: 1,
    jet: (N) => jsub(jsub(jexp(jvar(0, N)), jconst(1, N)), jvar(0, N)),
    k: 2,
    c: 1 / 2,
    cText: '1/2',
    m: 3,
    d: 1 / 6,
    dText: '1/6',
    xMax: 3,
  },
  'ln1p-x': {
    tex: '\\ln(1+x)-x',
    text: 'ln(1 + x) − x',
    g: (x) => (x > -1 ? Math.log1p(x) - x : NaN),
    sr: 0.5,
    jet: (N) => jsub(jlog(jadd(jconst(1, N), jvar(0, N))), jvar(0, N)),
    k: 2,
    c: -1 / 2,
    cText: '−1/2',
    m: 3,
    d: 1 / 3,
    dText: '1/3',
    xMax: 3,
  },
  'tan-x': {
    tex: '\\tan x-x',
    text: 'tan x − x',
    g: (x) => (Math.abs(x) < Math.PI / 2 ? Math.tan(x) - x : NaN),
    sr: 0.8,
    jet: (N) => jsub(jtan(jvar(0, N)), jvar(0, N)),
    k: 3,
    c: 1 / 3,
    cText: '1/3',
    m: 5,
    d: 2 / 15,
    dText: '2/15',
    xMax: 1.5,
  },
  sinc: {
    tex: '\\frac{\\sin x}{x}',
    text: 'sin x / x',
    g: (x) => (x === 0 ? NaN : Math.sin(x) / x),
    sr: 1,
    /** sin x / x = (x − x³/6 + …)/x: the series of sin shifted down by one */
    jet: (N) => shiftDown(jsin(jvar(0, N + 1))).slice(0, N + 1),
    k: 0,
    c: 1,
    cText: '1',
    m: 2,
    d: -1 / 6,
    dText: '−1/6',
    hole0: true,
    xMax: 8,
  },
};

export const LEAD = Object.fromEntries(Object.entries(LEAD_BASE).map(([id, b]) => [id, accurateLead(b)])) as Record<LeadId, LeadSpec>;

export const LEAD_IDS = Object.keys(LEAD) as LeadId[];
export const isLeadId = (x: unknown): x is LeadId => typeof x === 'string' && x in LEAD;

/** "c xᵏ" as text: −x³/6, x²/2, 1 */
export function monoText(cText: string, k: number): string {
  const neg = cText.startsWith('−');
  const body = neg ? cText.slice(1) : cText;
  const [p, q] = body.split('/');
  const pw = k === 0 ? '' : k === 1 ? 'x' : `x${sup(k)}`;
  const head = k === 0 ? p : `${p === '1' ? '' : p}${pw}`;
  return `${neg ? '−' : ''}${head}${q ? `/${q}` : ''}`;
}

/* ------------------------------------------------------------------ Leibniz series (lesson 6.4) */

export type LeibnizId = 'ln2' | 'pi4' | 'einv' | 'sin1';

export interface LeibnizSpec {
  tex: string;
  /** the series as plain text */
  text: string;
  /** bₖ for k ≥ 1 */
  b: (k: number) => number;
  /** log₁₀ bₖ (for bₖ below the smallest double) */
  log10b: (k: number) => number;
  /** the exact sum (sympy) */
  S: number;
  sText: string;
}

/** log₁₀ m! for m up to the largest order a figure uses */
const LOG10_FACT: number[] = (() => {
  const t = [0];
  for (let m = 1; m <= 4100; m++) t.push(t[m - 1] + Math.log10(m));
  return t;
})();

export const LEIBNIZ: Record<LeibnizId, LeibnizSpec> = {
  ln2: {
    tex: '1-\\tfrac12+\\tfrac13-\\tfrac14+\\cdots',
    text: '1 − 1/2 + 1/3 − 1/4 + …',
    b: (k) => 1 / k,
    log10b: (k) => -Math.log10(k),
    S: Math.LN2,
    sText: 'ln 2',
  },
  pi4: {
    tex: '1-\\tfrac13+\\tfrac15-\\tfrac17+\\cdots',
    text: '1 − 1/3 + 1/5 − 1/7 + …',
    b: (k) => 1 / (2 * k - 1),
    log10b: (k) => -Math.log10(2 * k - 1),
    S: Math.PI / 4,
    sText: 'π/4',
  },
  einv: {
    tex: '1-1+\\tfrac1{2!}-\\tfrac1{3!}+\\cdots',
    text: '1 − 1 + 1/2! − 1/3! + …',
    b: (k) => 1 / factorial(k - 1),
    log10b: (k) => -LOG10_FACT[k - 1],
    S: Math.exp(-1),
    sText: '1/e',
  },
  sin1: {
    tex: '1-\\tfrac1{3!}+\\tfrac1{5!}-\\tfrac1{7!}+\\cdots',
    text: '1 − 1/3! + 1/5! − 1/7! + …',
    b: (k) => 1 / factorial(2 * k - 1),
    log10b: (k) => -LOG10_FACT[2 * k - 1],
    S: Math.sin(1),
    sText: 'sin 1',
  },
};

export const LEIBNIZ_IDS = Object.keys(LEIBNIZ) as LeibnizId[];
export const isLeibnizId = (x: unknown): x is LeibnizId => typeof x === 'string' && x in LEIBNIZ;
export const LEIBNIZ_MAX = 2000;

const sumsCache = new Map<LeibnizId, number[]>();

/** S_0 = 0, S_1, …, S_{N} (N = LEIBNIZ_MAX + 1): S_n = Σₖ₌₁ⁿ (−1)ᵏ⁺¹ bₖ */
export function leibnizSums(id: LeibnizId): number[] {
  let s = sumsCache.get(id);
  if (!s) {
    const sp = LEIBNIZ[id];
    s = [0];
    for (let k = 1; k <= LEIBNIZ_MAX + 1; k++) s.push(s[k - 1] + (k % 2 === 1 ? 1 : -1) * sp.b(k));
    sumsCache.set(id, s);
  }
  return s;
}

/** the smallest n ≥ 1 with b_{n+1} < eps (the order the Leibniz bound needs) */
export function leibnizOrderFor(id: LeibnizId, eps: number): number {
  const sp = LEIBNIZ[id];
  const le = Math.log10(eps);
  for (let n = 1; n <= 100_000; n++) if (sp.log10b(n + 1) < le) return n;
  return Infinity;
}
