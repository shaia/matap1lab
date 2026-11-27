/**
 * The product rule, the chain rule and the derivative of an inverse function, as pictures (RulesLab's core, chapter
 * 5.3–5.4).
 *
 * MODEL SPECIFICATION
 * - System: real functions of one variable given by preset formulas, each with its derivative in CLOSED FORM
 *   (recomputed with sympy, 2026-11-27), evaluated in IEEE doubles. Every exact value a figure shows comes from a closed
 *   form; every measured value (a difference Δu, a ratio Δy/Δu) is a probe and is labelled as one.
 * - Product (`PAIRS`): two factors u(x), v(x) > 0 on the pair's range. The rectangle of sides u(x) and v(x) grows to
 *   u(x + Δx) by v(x + Δx); with Δu = u(x + Δx) − u(x) and Δv = v(x + Δx) − v(x) the change of area is EXACTLY
 *     Δ(uv) = v·Δu + u·Δv + Δu·Δv
 *   (an algebraic identity, no limit taken): the two strips v·Δu, u·Δv and the corner Δu·Δv. Divided by Δx the strips
 *   tend to v·u′ + u·v′ and the corner to u′·v′·0 = 0 (corner/Δx = (Δu/Δx)(Δv/Δx)·Δx). `productParts` computes Δ(uv)
 *   directly as u(x+Δx)v(x+Δx) − u(x)v(x), so the identity is checked, not assumed. Δv may be negative (sin x past
 *   π/2): the strip u·Δv and the corner are then areas removed, and the sum is still exact with signs.
 * - Boundary of the product: x + Δx stays at most the pair's `reach` (`dxMax`), so v > 0 on [x, x + Δx]
 *   (sin x up to x = 3, sin 3 ≈ 0.141 > 0); Δx ∈ (0, 1].
 * - Chain (`CHAIN`): y = f(u) with u = g(x). An interval [x, x + Δx] goes to [g(x), g(x + Δx)] (endpoint images; the
 *   order is reversed when Δu < 0) and then to [f(g(x)), f(g(x + Δx))]. The measured stretch factors are Δu/Δx and
 *   Δy/Δu (undefined when Δu = 0 exactly); their product is Δy/Δx identically (it is the same fraction), and as
 *   Δx → 0 it tends to f′(g(x))·g′(x), the exact derivative (`chainExact`). The error of Δy/Δx is O(Δx) (a one-sided
 *   difference quotient), so its RELATIVE error is small only where the exact derivative is not small: near a zero of
 *   the derivative the measured product is close to 0 in absolute terms, not in relative ones.
 * - Zeros of the chain derivative (`zeros`): the exact points of the window where one factor vanishes, with the factor:
 *   sin-x3 at 0 (inner, 3x² = 0) and ±∛(π/2) (outer, cos u = 0 at u = ±π/2); sq-lin at −1/3 (outer, 2u = 0);
 *   exp-neg-sq and sqrt-1px2 at 0 (inner). At a listed zero `chainExact` returns that factor as an exact 0.
 * - Inverse (`INVERSE`): f strictly increasing on its domain, its inverse f⁻¹ in closed form (ln, ∛, arcsin, arctan,
 *   and for x³ + x + 1 Cardano's formula: x³ + x + (1 − y) = 0 has p = 1 > 0, so exactly one real root
 *   ∛(−q/2 + √D) + ∛(−q/2 − √D), q = 1 − y, D = q²/4 + 1/27). The mirror of A = (a, f(a)) in y = x is A′ = (f(a), a)
 *   on the graph of f⁻¹; a line of slope m through A mirrors to a line of slope 1/m through A′ (run and rise swap), so
 *   (f⁻¹)′(f(a)) = 1/f′(a) when f′(a) ≠ 0. Where f′(a) = 0 (`flat`: x³ at 0, sin at ±π/2) the mirror tangent is
 *   vertical and f⁻¹ is not differentiable at f(a). `inverseSlopes` returns m = 0 EXACTLY at a listed flat point (cos
 *   of the double π/2 is 6·10⁻¹⁷, not 0).
 * - Ignored: nothing mathematical; floating-point rounding only (a difference quotient with Δx = 10⁻⁴ of values of
 *   size ~10 carries a rounding error ~10⁻¹¹, far below what a readout shows).
 */

export type Fn = (x: number) => number;

/* ---------------------------------------------------------------- product */

export type PairId = 'x-x2' | 'x2-sin' | 'lin-lin';
export const PAIR_IDS: PairId[] = ['x-x2', 'x2-sin', 'lin-lin'];

export interface PairSpec {
  id: PairId;
  /** plain-text labels for readouts and canvases */
  uText: string;
  vText: string;
  duText: string;
  dvText: string;
  u: Fn;
  du: Fn;
  v: Fn;
  dv: Fn;
  /** the slider range of x */
  xRange: [number, number];
  /** x + Δx never exceeds this (v > 0 up to it) */
  reach: number;
  defaultX: number;
}

export const PAIRS: Record<PairId, PairSpec> = {
  'x-x2': {
    id: 'x-x2',
    uText: 'x',
    vText: 'x²',
    duText: '1',
    dvText: '2x',
    u: (x) => x,
    du: () => 1,
    v: (x) => x * x,
    dv: (x) => 2 * x,
    xRange: [0.5, 3],
    reach: 4,
    defaultX: 2,
  },
  'x2-sin': {
    id: 'x2-sin',
    uText: 'x²',
    vText: 'sin x',
    duText: '2x',
    dvText: 'cos x',
    u: (x) => x * x,
    du: (x) => 2 * x,
    v: Math.sin,
    dv: Math.cos,
    xRange: [0.3, 2.8],
    reach: 3,
    defaultX: 1,
  },
  'lin-lin': {
    id: 'lin-lin',
    uText: 'x + 1',
    vText: '2x + 1',
    duText: '1',
    dvText: '2',
    u: (x) => x + 1,
    du: () => 1,
    v: (x) => 2 * x + 1,
    dv: () => 2,
    xRange: [0, 3],
    reach: 4,
    defaultX: 1,
  },
};

export const isPairId = (x: unknown): x is PairId => typeof x === 'string' && (PAIR_IDS as string[]).includes(x);

export const DX_MIN = 0.01;
/** the largest Δx allowed at x: at most 1, and x + Δx ≤ reach */
export const dxMax = (id: PairId, x: number): number => Math.max(DX_MIN, Math.min(1, PAIRS[id].reach - x));

export interface ProductParts {
  U: number;
  V: number;
  U2: number;
  V2: number;
  du: number;
  dv: number;
  /** u(x+Δx)·v(x+Δx) − u(x)·v(x), computed directly */
  duv: number;
  /** the strip v·Δu */
  stripV: number;
  /** the strip u·Δv */
  stripU: number;
  /** v·Δu + u·Δv */
  sum: number;
  /** Δu·Δv */
  corner: number;
  /** Δu·Δv / Δx */
  cornerRatio: number;
  /** Δu·Δv / Δ(uv) (NaN when Δ(uv) = 0) */
  share: number;
}

export function productParts(id: PairId, x: number, dx: number): ProductParts {
  const s = PAIRS[id];
  const U = s.u(x);
  const V = s.v(x);
  const U2 = s.u(x + dx);
  const V2 = s.v(x + dx);
  const du = U2 - U;
  const dv = V2 - V;
  const duv = U2 * V2 - U * V;
  const stripV = V * du;
  const stripU = U * dv;
  const corner = du * dv;
  return { U, V, U2, V2, du, dv, duv, stripV, stripU, sum: stripV + stripU, corner, cornerRatio: corner / dx, share: duv === 0 ? NaN : corner / duv };
}

/** (uv)′(x) = u′v + uv′, exact */
export const productDerivative = (id: PairId, x: number): number => {
  const s = PAIRS[id];
  return s.du(x) * s.v(x) + s.u(x) * s.dv(x);
};

/* ---------------------------------------------------------------- chain */

export type ChainId = 'sin-x3' | 'sq-lin' | 'exp-neg-sq' | 'sqrt-1px2';
export const CHAIN_IDS: ChainId[] = ['sin-x3', 'sq-lin', 'exp-neg-sq', 'sqrt-1px2'];

export interface ChainZero {
  x: number;
  /** which factor vanishes: g′(x) (inner) or f′(g(x)) (outer) */
  factor: 'inner' | 'outer';
}

export interface ChainSpec {
  id: ChainId;
  /** the outer function of u and the inner function of x, plain text */
  outerText: string;
  innerText: string;
  /** the composite, plain text */
  text: string;
  /** f′(u) and g′(x), plain text */
  dOuterText: string;
  dInnerText: string;
  g: Fn;
  dg: Fn;
  f: Fn;
  df: Fn;
  xRange: [number, number];
  defaultX: number;
  zeros: ChainZero[];
}

const CBRT_HALF_PI = Math.cbrt(Math.PI / 2);

export const CHAIN: Record<ChainId, ChainSpec> = {
  'sin-x3': {
    id: 'sin-x3',
    outerText: 'sin u',
    innerText: 'x³',
    text: 'sin(x³)',
    dOuterText: 'cos u',
    dInnerText: '3x²',
    g: (x) => x * x * x,
    dg: (x) => 3 * x * x,
    f: Math.sin,
    df: Math.cos,
    xRange: [-1.5, 1.5],
    defaultX: 1,
    zeros: [
      { x: -CBRT_HALF_PI, factor: 'outer' },
      { x: 0, factor: 'inner' },
      { x: CBRT_HALF_PI, factor: 'outer' },
    ],
  },
  'sq-lin': {
    id: 'sq-lin',
    outerText: 'u²',
    innerText: '3x + 1',
    text: '(3x + 1)²',
    dOuterText: '2u',
    dInnerText: '3',
    g: (x) => 3 * x + 1,
    dg: () => 3,
    f: (u) => u * u,
    df: (u) => 2 * u,
    xRange: [-1, 1],
    defaultX: 0.5,
    zeros: [{ x: -1 / 3, factor: 'outer' }],
  },
  'exp-neg-sq': {
    id: 'exp-neg-sq',
    outerText: 'eᵘ',
    innerText: '−x²',
    text: 'e^(−x²)',
    dOuterText: 'eᵘ',
    dInnerText: '−2x',
    g: (x) => -x * x,
    dg: (x) => -2 * x,
    f: Math.exp,
    df: Math.exp,
    xRange: [-2, 2],
    defaultX: 1,
    zeros: [{ x: 0, factor: 'inner' }],
  },
  'sqrt-1px2': {
    id: 'sqrt-1px2',
    outerText: '√u',
    innerText: '1 + x²',
    text: '√(1 + x²)',
    dOuterText: '1/(2√u)',
    dInnerText: '2x',
    g: (x) => 1 + x * x,
    dg: (x) => 2 * x,
    f: Math.sqrt,
    df: (u) => 1 / (2 * Math.sqrt(u)),
    xRange: [-2, 2],
    defaultX: 1,
    zeros: [{ x: 0, factor: 'inner' }],
  },
};

export const isChainId = (x: unknown): x is ChainId => typeof x === 'string' && (CHAIN_IDS as string[]).includes(x);

export interface ChainExact {
  /** g′(x) */
  inner: number;
  /** f′(g(x)) */
  outer: number;
  /** f′(g(x))·g′(x) */
  d: number;
  /** the listed zero at x, if x is one */
  zero: ChainZero | null;
}

/** the exact factors of the chain rule at x; a listed zero gives its factor as an exact 0 */
export function chainExact(id: ChainId, x: number): ChainExact {
  const s = CHAIN[id];
  const zero = s.zeros.find((z) => z.x === x) ?? null;
  const inner = zero?.factor === 'inner' ? 0 : s.dg(x);
  const outer = zero?.factor === 'outer' ? 0 : s.df(s.g(x));
  return { inner, outer, d: inner * outer, zero };
}

export interface ChainMeasured {
  du: number;
  dy: number;
  /** Δu/Δx */
  inner: number;
  /** Δy/Δu (NaN when Δu = 0) */
  outer: number;
  /** Δy/Δx */
  total: number;
}

/** the measured stretch factors over [x, x + Δx] (a probe) */
export function chainMeasured(id: ChainId, x: number, dx: number): ChainMeasured {
  const s = CHAIN[id];
  const u0 = s.g(x);
  const u1 = s.g(x + dx);
  const du = u1 - u0;
  const dy = s.f(u1) - s.f(u0);
  return { du, dy, inner: du / dx, outer: du === 0 ? NaN : dy / du, total: dy / dx };
}

/** the composite y = f(g(x)) */
export const chainFn = (id: ChainId): Fn => {
  const s = CHAIN[id];
  return (x) => s.f(s.g(x));
};

/* ---------------------------------------------------------------- inverse */

export type InvId = 'exp' | 'cube' | 'sin' | 'tan' | 'x3px1';
export const INV_IDS: InvId[] = ['exp', 'cube', 'sin', 'tan', 'x3px1'];

export interface InvSpec {
  id: InvId;
  fText: string;
  finvText: string;
  f: Fn;
  df: Fn;
  finv: Fn;
  /** (f⁻¹)′(y) by its own closed form */
  dfinv: Fn;
  /** where f is drawn (its domain, clipped to the window); open ends are excluded */
  domain: { lo: number; hi: number; open: boolean };
  /** the slider range of a */
  aRange: [number, number];
  defaultA: number;
  /** the square window [lo, hi]² */
  window: [number, number];
  /** the points a with f′(a) = 0, exact */
  flat: number[];
}

/** the real root of x³ + x + 1 = y (Cardano: p = 1 > 0, one real root) */
export function invX3px1(y: number): number {
  const q = 1 - y;
  const D = (q * q) / 4 + 1 / 27;
  const s = Math.sqrt(D);
  return Math.cbrt(-q / 2 + s) + Math.cbrt(-q / 2 - s);
}

const HALF_PI = Math.PI / 2;

export const INVERSE: Record<InvId, InvSpec> = {
  exp: {
    id: 'exp',
    fText: 'eˣ',
    finvText: 'ln x',
    f: Math.exp,
    df: Math.exp,
    finv: Math.log,
    dfinv: (y) => 1 / y,
    domain: { lo: -Infinity, hi: Infinity, open: false },
    aRange: [-2, 1.5],
    defaultA: 1,
    window: [-2.5, 5],
    flat: [],
  },
  cube: {
    id: 'cube',
    fText: 'x³',
    finvText: '∛x',
    f: (x) => x * x * x,
    df: (x) => 3 * x * x,
    finv: Math.cbrt,
    dfinv: (y) => 1 / (3 * Math.cbrt(y) ** 2),
    domain: { lo: -Infinity, hi: Infinity, open: false },
    aRange: [-1.5, 1.5],
    defaultA: 1,
    window: [-3.5, 3.5],
    flat: [0],
  },
  sin: {
    id: 'sin',
    fText: 'sin x',
    finvText: 'arcsin x',
    f: Math.sin,
    df: Math.cos,
    finv: Math.asin,
    dfinv: (y) => 1 / Math.sqrt(1 - y * y),
    domain: { lo: -HALF_PI, hi: HALF_PI, open: false },
    aRange: [-HALF_PI, HALF_PI],
    defaultA: 0.5,
    window: [-1.9, 1.9],
    flat: [-HALF_PI, HALF_PI],
  },
  tan: {
    id: 'tan',
    fText: 'tan x',
    finvText: 'arctan x',
    f: Math.tan,
    df: (x) => 1 / Math.cos(x) ** 2,
    finv: Math.atan,
    dfinv: (y) => 1 / (1 + y * y),
    domain: { lo: -HALF_PI, hi: HALF_PI, open: true },
    aRange: [-1.25, 1.25],
    defaultA: 0.7,
    window: [-3.5, 3.5],
    flat: [],
  },
  x3px1: {
    id: 'x3px1',
    fText: 'x³ + x + 1',
    finvText: 'f⁻¹',
    f: (x) => x * x * x + x + 1,
    df: (x) => 3 * x * x + 1,
    finv: invX3px1,
    dfinv: (y) => {
      const x = invX3px1(y);
      return 1 / (3 * x * x + 1);
    },
    domain: { lo: -Infinity, hi: Infinity, open: false },
    aRange: [-1.3, 1.3],
    defaultA: 0.5,
    window: [-3, 5],
    flat: [],
  },
};

export const isInvId = (x: unknown): x is InvId => typeof x === 'string' && (INV_IDS as string[]).includes(x);

export interface InverseSlopes {
  fa: number;
  /** f′(a); exactly 0 at a listed flat point */
  m: number;
  /** (f⁻¹)′(f(a)) = 1/m; Infinity when m = 0 (vertical tangent) */
  minv: number;
  vertical: boolean;
}

export function inverseSlopes(id: InvId, a: number): InverseSlopes {
  const s = INVERSE[id];
  const flat = s.flat.includes(a);
  const m = flat ? 0 : s.df(a);
  return { fa: s.f(a), m, minv: m === 0 ? Infinity : 1 / m, vertical: m === 0 };
}
