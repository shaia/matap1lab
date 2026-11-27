/**
 * MODEL SPECIFICATION
 *
 * System:        three facts behind the trigonometric integrals of lesson 7.5 and TrigSubLab's core, all in closed
 *                form in IEEE double precision:
 *                (1) POW: powers of sin and cos reduced with the identities sin²x = (1 − cos 2x)/2,
 *                    cos²x = (1 + cos 2x)/2, sin x cos x = sin(2x)/2 and sin³x = sin x − sin x cos²x, each stored as
 *                    f, its identity form as a list of parts (a constant part or an oscillating part), and the signed
 *                    area ∫₀ˣ f in closed form;
 *                (2) halfAngle: the substitution t = tan(x/2), with cos x = (1 − t²)/(1 + t²),
 *                    sin x = 2t/(1 + t²) and dx = 2 dt/(1 + t²);
 *                (3) triSub: the right triangle of a trigonometric substitution, kind `sin` (x = a sin θ, root
 *                    √(a² − x²) = a cos θ), `tan` (x = a tan θ, root √(a² + x²) = a/cos θ) and `sec`
 *                    (x = a/cos θ, root √(x² − a²) = a tan θ).
 * Dynamics:      none.
 * Boundary:      every closed form was recomputed with sympy on 2026-11-27 (screens/tools/cas.py and
 *                screens/tools/ch7_presets.py): the four identities, the four areas from 0 (∫₀ˣ sin³ =
 *                (1 − cos x)²(cos x + 2)/3), t = sin x/(1 + cos x) = tan(x/2), d(2 arctan t)/dt = 2/(1 + t²),
 *                dx/dθ = a cos θ, a/cos²θ, a sin θ/cos²θ. tests/math/trigint.test.ts checks them against
 *                Simpson's rule, centralDiff and Pythagoras. No sec, csc or cot appears: write 1/cos θ.
 * Ignored:       exact arithmetic; the sign conventions of θ beyond the principal branch used here
 *                (sin: θ in [−π/2, π/2]; tan: θ in (−π/2, π/2); sec: θ in [0, π/2) for x ≥ a).
 * Valid when:    sin: |x| ≤ a; sec: x ≥ a; halfAngle: |x| < π (t is finite there; at x = ±π the substitution breaks
 *                down: t → ±∞). Outside its domain triSub returns NaN fields.
 * Failure modes: at the edge x = ±a of the `sin` kind the root is exactly 0 and dx/dθ = 0 (the substitution is not
 *                invertible there as an integral over dθ in the usual way); near x = ±π t grows like 2/(π − |x|).
 */

export type Fn = (x: number) => number;

const sq = (v: number) => v * v;

/* ------------------------------------------------------------------ powers of sin and cos */

export type PowId = 'sin2' | 'cos2' | 'sincos' | 'sin3';
export const POW_IDS: readonly PowId[] = ['sin2', 'cos2', 'sincos', 'sin3'];

/** one part of an identity form: a constant (drawn as a horizontal line) or an oscillating part (a wave) */
export interface Part {
  kind: 'const' | 'osc';
  tex: string;
  /** plain label for readouts and the canvas */
  text: string;
  f: Fn;
}

export interface PowSpec {
  id: PowId;
  tex: string;
  text: string;
  f: Fn;
  /** the identity form as a sum of parts: the parts add up to f */
  parts: Part[];
  identityTex: string;
  identityText: string;
  /** ∫₀ˣ f, closed form */
  area: Fn;
  areaTex: string;
  areaText: string;
  /** sin², cos²: the constant part's area x/2 and the oscillating part's area, which stays within ±1/4 */
  constArea: Fn | null;
  oscArea: Fn | null;
  oscBound: number | null;
  /** x-window of the figure and the y-window for f */
  window: { x: [number, number]; y: [number, number] };
}

const WIN: PowSpec['window'] = { x: [0, 2 * Math.PI], y: [-1.2, 1.2] };

export const POW: Record<PowId, PowSpec> = {
  sin2: {
    id: 'sin2',
    tex: '\\sin^2 x',
    text: 'sin²x',
    f: (x) => Math.sin(x) ** 2,
    parts: [
      { kind: 'const', tex: '\\tfrac12', text: '1/2', f: () => 0.5 },
      { kind: 'osc', tex: '-\\tfrac12\\cos 2x', text: '−cos(2x)/2', f: (x) => -Math.cos(2 * x) / 2 },
    ],
    identityTex: '\\tfrac12-\\tfrac12\\cos 2x',
    identityText: '1/2 − cos(2x)/2',
    area: (x) => x / 2 - Math.sin(2 * x) / 4,
    areaTex: '\\tfrac{x}{2}-\\tfrac{\\sin 2x}{4}',
    areaText: 'x/2 − sin(2x)/4',
    constArea: (x) => x / 2,
    oscArea: (x) => -Math.sin(2 * x) / 4,
    oscBound: 0.25,
    window: WIN,
  },
  cos2: {
    id: 'cos2',
    tex: '\\cos^2 x',
    text: 'cos²x',
    f: (x) => Math.cos(x) ** 2,
    parts: [
      { kind: 'const', tex: '\\tfrac12', text: '1/2', f: () => 0.5 },
      { kind: 'osc', tex: '\\tfrac12\\cos 2x', text: 'cos(2x)/2', f: (x) => Math.cos(2 * x) / 2 },
    ],
    identityTex: '\\tfrac12+\\tfrac12\\cos 2x',
    identityText: '1/2 + cos(2x)/2',
    area: (x) => x / 2 + Math.sin(2 * x) / 4,
    areaTex: '\\tfrac{x}{2}+\\tfrac{\\sin 2x}{4}',
    areaText: 'x/2 + sin(2x)/4',
    constArea: (x) => x / 2,
    oscArea: (x) => Math.sin(2 * x) / 4,
    oscBound: 0.25,
    window: WIN,
  },
  sincos: {
    id: 'sincos',
    tex: '\\sin x\\cos x',
    text: 'sin x cos x',
    f: (x) => Math.sin(x) * Math.cos(x),
    parts: [{ kind: 'osc', tex: '\\tfrac12\\sin 2x', text: 'sin(2x)/2', f: (x) => Math.sin(2 * x) / 2 }],
    identityTex: '\\tfrac12\\sin 2x',
    identityText: 'sin(2x)/2',
    area: (x) => Math.sin(x) ** 2 / 2,
    areaTex: '\\tfrac{\\sin^2 x}{2}',
    areaText: 'sin²x/2',
    constArea: null,
    oscArea: null,
    oscBound: null,
    window: WIN,
  },
  sin3: {
    id: 'sin3',
    tex: '\\sin^3 x',
    text: 'sin³x',
    f: (x) => Math.sin(x) ** 3,
    parts: [
      { kind: 'osc', tex: '\\sin x', text: 'sin x', f: (x) => Math.sin(x) },
      { kind: 'osc', tex: '-\\sin x\\cos^2 x', text: '−sin x cos²x', f: (x) => -Math.sin(x) * Math.cos(x) ** 2 },
    ],
    identityTex: '\\sin x-\\sin x\\cos^2 x',
    identityText: 'sin x − sin x cos²x',
    area: (x) => (sq(1 - Math.cos(x)) * (Math.cos(x) + 2)) / 3,
    areaTex: '\\tfrac{(1-\\cos x)^2(\\cos x+2)}{3}',
    areaText: '(1 − cos x)²(cos x + 2)/3',
    constArea: null,
    oscArea: null,
    oscBound: null,
    window: WIN,
  },
};

export const isPowId = (s: unknown): s is PowId => typeof s === 'string' && s in POW;

/** the identity form evaluated: the sum of the parts */
export const identityValue = (id: PowId, x: number): number => POW[id].parts.reduce((s, p) => s + p.f(x), 0);

/* ------------------------------------------------------------------ the substitution t = tan(x/2) */

export interface HalfAngle {
  x: number;
  t: number;
  cos: number;
  sin: number;
  /** cos x written with t: (1 − t²)/(1 + t²) */
  cosFromT: number;
  /** sin x written with t: 2t/(1 + t²) */
  sinFromT: number;
  /** dx/dt = 2/(1 + t²) */
  dxdt: number;
}

export function halfAngle(x: number): HalfAngle {
  const t = Math.tan(x / 2);
  const d = 1 + t * t;
  return { x, t, cos: Math.cos(x), sin: Math.sin(x), cosFromT: (1 - t * t) / d, sinFromT: (2 * t) / d, dxdt: 2 / d };
}

/* ------------------------------------------------------------------ trigonometric substitution */

export type TriKind = 'sin' | 'tan' | 'sec';
export const TRI_KINDS: readonly TriKind[] = ['sin', 'tan', 'sec'];
export const isTriKind = (s: unknown): s is TriKind => s === 'sin' || s === 'tan' || s === 'sec';

export interface TriSub {
  kind: TriKind;
  a: number;
  x: number;
  theta: number;
  /** the three sides of the right triangle: hypotenuse, the side opposite θ, the side adjacent to θ (signed: the
   * opposite side has the sign of x for `sin` and `tan`) */
  hyp: number;
  opp: number;
  adj: number;
  /** the square root of the kind, from the closed form in x */
  root: number;
  /** dx/dθ */
  dxdtheta: number;
}

/** the allowed x for a kind: sin |x| ≤ a, tan |x| ≤ 2a (θ ≤ 63°), sec a ≤ x ≤ 3a (θ ≤ 70.5°) */
export function xRange(kind: TriKind, a: number): [number, number] {
  return kind === 'sin' ? [-a, a] : kind === 'tan' ? [-2 * a, 2 * a] : [a, 3 * a];
}
/** the starting x of a kind (never an edge of its range) */
export const xDefault = (kind: TriKind, a: number): number => (kind === 'sin' ? 0.6 * a : kind === 'tan' ? a : 2 * a);
export function clampTri(kind: TriKind, a: number, x: number): number {
  const [lo, hi] = xRange(kind, a);
  return Math.max(lo, Math.min(hi, x));
}

/** the root of a kind as a function of θ: a cos θ, a/cos θ, a tan θ */
export function rootOfTheta(kind: TriKind, a: number, theta: number): number {
  return kind === 'sin' ? a * Math.cos(theta) : kind === 'tan' ? a / Math.cos(theta) : a * Math.tan(theta);
}
/** x as a function of θ: a sin θ, a tan θ, a/cos θ */
export function xOfTheta(kind: TriKind, a: number, theta: number): number {
  return kind === 'sin' ? a * Math.sin(theta) : kind === 'tan' ? a * Math.tan(theta) : a / Math.cos(theta);
}

export function triSub(kind: TriKind, a: number, x: number): TriSub {
  const bad = kind === 'sin' ? Math.abs(x) > a * (1 + 1e-12) : kind === 'sec' ? x < a * (1 - 1e-12) : false;
  if (bad || !(a > 0)) return { kind, a, x, theta: NaN, hyp: NaN, opp: NaN, adj: NaN, root: NaN, dxdtheta: NaN };
  if (kind === 'sin') {
    const root = Math.sqrt(Math.max(0, (a - x) * (a + x)));
    const theta = Math.asin(Math.max(-1, Math.min(1, x / a)));
    return { kind, a, x, theta, hyp: a, opp: x, adj: root, root, dxdtheta: root };
  }
  if (kind === 'tan') {
    const root = Math.sqrt(a * a + x * x);
    const theta = Math.atan(x / a);
    return { kind, a, x, theta, hyp: root, opp: x, adj: a, root, dxdtheta: (a * a + x * x) / a };
  }
  const root = Math.sqrt(Math.max(0, (x - a) * (x + a)));
  const theta = Math.acos(Math.min(1, a / x));
  return { kind, a, x, theta, hyp: x, opp: root, adj: a, root, dxdtheta: (root * x) / a };
}
