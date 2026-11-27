/**
 * MODEL SPECIFICATION
 *
 * System:        real functions of one real variable, given in closed form together with their first and second
 *                derivatives (f, f1 = f′, f2 = f″), evaluated in IEEE double precision. Chapter 6.5 (curve
 *                sketching) and SketchLab's core.
 * Dynamics:      none.
 * Boundary:      every fact SketchLab shows is STORED here, exact, recomputed with sympy on 2026-11-27
 *                (screens/tools/sketch_check.py): the domain, the vertical asymptotes, the asymptotes at ±∞ (a line
 *                y = mx + b or none), the critical points with their kind, the inflection points, and the sign of f′
 *                and of f″ on every interval between them. Nothing is inferred from sampling: the figure draws its
 *                strips and marks from these lists, and tests/math/sketch.test.ts checks them against the closed forms
 *                and against centralDiff / secondDiff.
 *                The `local` presets store, about a point a, the residual r(h) = f(a + h) − f(a) and, with the tangent
 *                subtracted, r_T(h) = f(a + h) − f(a) − f′(a)·h, each written in a form without catastrophic
 *                cancellation near h = 0 (e.g. 1 − cos h = 2 sin²(h/2)), and their exact leading and next terms
 *                c·hᵏ + d·hᵐ (sympy series). The verdict (extremum or not) follows from k and the sign of c.
 * Ignored:       exact arithmetic; points off the window.
 * Valid when:    x is in the domain (f, f1, f2 return NaN outside it, and at a vertical asymptote).
 * Failure modes: near a vertical asymptote values overflow the plot (the figure clips them and never joins the two
 *                branches); the closed-form f of a local preset loses relative accuracy near a, which is why the
 *                figure plots the stable residual r(h), never f(a + h) − f(a).
 */

export type Fn = (x: number) => number;

/** an exact value: the number, a plain label for readouts, and TeX */
export interface Val {
  v: number;
  text: string;
  tex: string;
}

const val = (v: number, text: string, tex: string): Val => ({ v, text, tex });
const int = (v: number): Val => val(v, v < 0 ? `−${-v}` : String(v), String(v));
export const NEG_INF: Val = val(-Infinity, '−∞', '-\\infty');
export const POS_INF: Val = val(Infinity, '∞', '\\infty');

/** an interval of the domain; an infinite end is never closed */
export interface DomainPiece {
  lo: Val;
  hi: Val;
  loClosed: boolean;
  hiClosed: boolean;
}

/** an open interval on which f′ (or f″) keeps the sign `sign` */
export interface SignPiece {
  lo: Val;
  hi: Val;
  sign: 1 | -1;
}

/** the line y = mx + b */
export interface Line {
  m: number;
  b: number;
  text: string;
  tex: string;
}

export type CritKind = 'max' | 'min' | 'none';

export interface CritPoint {
  x: Val;
  y: Val;
  /** 'none': f′ = 0 but f′ keeps its sign, no extremum (a flat point) */
  kind: CritKind;
}

export interface InflPoint {
  x: Val;
  y: Val;
}

export const SKETCH_IDS = ['cubic', 'quartic', 'oblique', 'gauss', 'xlnx', 'lorentz'] as const;
export type SketchId = (typeof SKETCH_IDS)[number];
export const isSketchId = (s: unknown): s is SketchId => typeof s === 'string' && (SKETCH_IDS as readonly string[]).includes(s);

export interface SketchSpec {
  id: SketchId;
  tex: string;
  text: string;
  f: Fn;
  f1: Fn;
  f2: Fn;
  f1text: string;
  f1tex: string;
  f2text: string;
  f2tex: string;
  /** the domain as disjoint intervals, left to right */
  domain: DomainPiece[];
  window: { x: [number, number]; y: [number, number] };
  /** vertical asymptotes x = v */
  vertical: Val[];
  /** the asymptote as x → −∞ and as x → +∞ (null: none; `left` is null too when the domain is bounded on the left) */
  atInf: { left: Line | null; right: Line | null };
  crit: CritPoint[];
  infl: InflPoint[];
  /** the sign of f′ on the intervals between the critical points and the breaks of the domain, left to right */
  mono: SignPiece[];
  /** the sign of f″ on the intervals between the inflection points and the breaks of the domain, left to right */
  conc: SignPiece[];
  /** end points of the graph that are not attained (hollow), e.g. (0, 0) for x ln x */
  holes: { x: Val; y: Val }[];
  /** a plain Hebrew sentence about the behaviour at the ends of the domain, when the asymptote list says too little */
  note?: string;
  /** the probe's starting x: no task holds there */
  x0: number;
}

const P = (lo: Val, hi: Val, sign: 1 | -1): SignPiece => ({ lo, hi, sign });
const ALL: DomainPiece[] = [{ lo: NEG_INF, hi: POS_INF, loClosed: false, hiClosed: false }];
const ZERO_LINE: Line = { m: 0, b: 0, text: 'y = 0', tex: 'y=0' };
const E = Math.E;
const R3 = Math.sqrt(3);

const x1 = int(1);
const x0 = int(0);
const xm1 = int(-1);
const x2 = int(2);
const x3 = int(3);
const xInvE = val(1 / E, '1/e', '\\frac{1}{e}');
const xInvR3 = val(1 / R3, '1/√3', '\\frac{1}{\\sqrt{3}}');
const xmInvR3 = val(-1 / R3, '−1/√3', '-\\frac{1}{\\sqrt{3}}');
const yInvRootE = val(Math.exp(-0.5), '1/√e', 'e^{-1/2}');

export const SK: Record<SketchId, SketchSpec> = {
  cubic: {
    id: 'cubic',
    tex: 'x^3-3x',
    text: 'x³ − 3x',
    f: (x) => x * x * x - 3 * x,
    f1: (x) => 3 * (x - 1) * (x + 1),
    f2: (x) => 6 * x,
    f1text: '3(x − 1)(x + 1)',
    f1tex: '3(x-1)(x+1)',
    f2text: '6x',
    f2tex: '6x',
    domain: ALL,
    window: { x: [-3, 3], y: [-4.5, 4.5] },
    vertical: [],
    atInf: { left: null, right: null },
    crit: [
      { x: xm1, y: int(2), kind: 'max' },
      { x: x1, y: int(-2), kind: 'min' },
    ],
    infl: [{ x: x0, y: x0 }],
    mono: [P(NEG_INF, xm1, 1), P(xm1, x1, -1), P(x1, POS_INF, 1)],
    conc: [P(NEG_INF, x0, -1), P(x0, POS_INF, 1)],
    holes: [],
    x0: 2,
  },
  quartic: {
    id: 'quartic',
    tex: 'x^4-4x^3',
    text: 'x⁴ − 4x³',
    f: (x) => x * x * x * (x - 4),
    f1: (x) => 4 * x * x * (x - 3),
    f2: (x) => 12 * x * (x - 2),
    f1text: '4x²(x − 3)',
    f1tex: '4x^2(x-3)',
    f2text: '12x(x − 2)',
    f2tex: '12x(x-2)',
    domain: ALL,
    window: { x: [-1.5, 4.5], y: [-32, 12] },
    vertical: [],
    atInf: { left: null, right: null },
    crit: [
      { x: x0, y: x0, kind: 'none' },
      { x: x3, y: int(-27), kind: 'min' },
    ],
    infl: [
      { x: x0, y: x0 },
      { x: x2, y: int(-16) },
    ],
    mono: [P(NEG_INF, x0, -1), P(x0, x3, -1), P(x3, POS_INF, 1)],
    conc: [P(NEG_INF, x0, 1), P(x0, x2, -1), P(x2, POS_INF, 1)],
    holes: [],
    x0: 4,
  },
  oblique: {
    id: 'oblique',
    tex: '\\frac{x^2-3}{x-2}',
    text: '(x² − 3)/(x − 2)',
    f: (x) => (x === 2 ? NaN : (x * x - 3) / (x - 2)),
    f1: (x) => (x === 2 ? NaN : ((x - 1) * (x - 3)) / ((x - 2) * (x - 2))),
    f2: (x) => (x === 2 ? NaN : 2 / ((x - 2) * (x - 2) * (x - 2))),
    f1text: '(x − 1)(x − 3)/(x − 2)²',
    f1tex: '\\frac{(x-1)(x-3)}{(x-2)^2}',
    f2text: '2/(x − 2)³',
    f2tex: '\\frac{2}{(x-2)^3}',
    domain: [
      { lo: NEG_INF, hi: x2, loClosed: false, hiClosed: false },
      { lo: x2, hi: POS_INF, loClosed: false, hiClosed: false },
    ],
    window: { x: [-10, 10], y: [-10, 14] },
    vertical: [x2],
    atInf: {
      left: { m: 1, b: 2, text: 'y = x + 2', tex: 'y=x+2' },
      right: { m: 1, b: 2, text: 'y = x + 2', tex: 'y=x+2' },
    },
    crit: [
      { x: x1, y: x2, kind: 'max' },
      { x: x3, y: int(6), kind: 'min' },
    ],
    infl: [],
    mono: [P(NEG_INF, x1, 1), P(x1, x2, -1), P(x2, x3, -1), P(x3, POS_INF, 1)],
    conc: [P(NEG_INF, x2, -1), P(x2, POS_INF, 1)],
    holes: [],
    x0: 5,
  },
  gauss: {
    id: 'gauss',
    tex: 'e^{-x^2/2}',
    text: 'e^(−x²/2)',
    f: (x) => Math.exp((-x * x) / 2),
    f1: (x) => -x * Math.exp((-x * x) / 2),
    f2: (x) => (x * x - 1) * Math.exp((-x * x) / 2),
    f1text: '−x·e^(−x²/2)',
    f1tex: '-x\\,e^{-x^2/2}',
    f2text: '(x² − 1)·e^(−x²/2)',
    f2tex: '(x^2-1)\\,e^{-x^2/2}',
    domain: ALL,
    window: { x: [-4, 4], y: [-0.3, 1.3] },
    vertical: [],
    atInf: { left: ZERO_LINE, right: ZERO_LINE },
    crit: [{ x: x0, y: x1, kind: 'max' }],
    infl: [
      { x: xm1, y: yInvRootE },
      { x: x1, y: yInvRootE },
    ],
    mono: [P(NEG_INF, x0, 1), P(x0, POS_INF, -1)],
    conc: [P(NEG_INF, xm1, 1), P(xm1, x1, -1), P(x1, POS_INF, 1)],
    holes: [],
    x0: 2,
  },
  xlnx: {
    id: 'xlnx',
    tex: 'x\\ln x',
    text: 'x ln x',
    f: (x) => (x > 0 ? x * Math.log(x) : NaN),
    f1: (x) => (x > 0 ? Math.log(x) + 1 : NaN),
    f2: (x) => (x > 0 ? 1 / x : NaN),
    f1text: 'ln x + 1',
    f1tex: '\\ln x+1',
    f2text: '1/x',
    f2tex: '\\frac{1}{x}',
    domain: [{ lo: x0, hi: POS_INF, loClosed: false, hiClosed: false }],
    window: { x: [-0.5, 3], y: [-0.8, 3] },
    vertical: [],
    atInf: { left: null, right: null },
    crit: [{ x: xInvE, y: val(-1 / E, '−1/e', '-\\frac{1}{e}'), kind: 'min' }],
    infl: [],
    mono: [P(x0, xInvE, -1), P(xInvE, POS_INF, 1)],
    conc: [P(x0, POS_INF, 1)],
    holes: [{ x: x0, y: x0 }],
    note: 'אין אסימפטוטות. כש-x שואף ל-0 מימין, הערכים שואפים ל-0: נקודת הקצה (0, 0) חלולה, כי 0 לא בתחום.',
    x0: 2,
  },
  lorentz: {
    id: 'lorentz',
    tex: '\\frac{1}{1+x^2}',
    text: '1/(1 + x²)',
    f: (x) => 1 / (1 + x * x),
    f1: (x) => (-2 * x) / ((1 + x * x) * (1 + x * x)),
    f2: (x) => (2 * (3 * x * x - 1)) / ((1 + x * x) * (1 + x * x) * (1 + x * x)),
    f1text: '−2x/(1 + x²)²',
    f1tex: '-\\frac{2x}{(1+x^2)^2}',
    f2text: '2(3x² − 1)/(1 + x²)³',
    f2tex: '\\frac{2(3x^2-1)}{(1+x^2)^3}',
    domain: ALL,
    window: { x: [-4, 4], y: [-0.3, 1.3] },
    vertical: [],
    atInf: { left: ZERO_LINE, right: ZERO_LINE },
    crit: [{ x: x0, y: x1, kind: 'max' }],
    infl: [
      { x: xmInvR3, y: val(0.75, '3/4', '\\frac{3}{4}') },
      { x: xInvR3, y: val(0.75, '3/4', '\\frac{3}{4}') },
    ],
    mono: [P(NEG_INF, x0, 1), P(x0, POS_INF, -1)],
    conc: [P(NEG_INF, xmInvR3, 1), P(xmInvR3, xInvR3, -1), P(xInvR3, POS_INF, 1)],
    holes: [],
    x0: 2,
  },
};

/** true when x is in the domain of the preset */
export function inDomain(id: SketchId, x: number): boolean {
  return SK[id].domain.some((d) => (x > d.lo.v || (d.loClosed && x === d.lo.v)) && (x < d.hi.v || (d.hiClosed && x === d.hi.v)));
}

/** the piece of `pieces` that contains x in its interior, or null (at a boundary or outside) */
export function pieceAt(pieces: SignPiece[], x: number): SignPiece | null {
  return pieces.find((p) => x > p.lo.v && x < p.hi.v) ?? null;
}

/** the asymptote at the side of x (x < 0: as x → −∞), or null */
export function asymLineAt(id: SketchId, x: number): Line | null {
  return x < 0 ? SK[id].atInf.left : SK[id].atInf.right;
}

/** f(x) − (mx + b) for the asymptote on the side of x; NaN when there is none or x is outside the domain */
export function asymGap(id: SketchId, x: number): number {
  const l = asymLineAt(id, x);
  if (!l) return NaN;
  return SK[id].f(x) - (l.m * x + l.b);
}

/* ------------------------------------------------------------------ local presets */

/** the term c·(x − a)ᵏ */
export interface Term {
  k: number;
  c: Val;
  text: string;
  tex: string;
}

export const LOCAL_IDS = ['ex1x', 'cosh-cos', 'cos4', 'sinh-sin', 'tan-sin', 'quartic0', 'quartic3', 'sin-pi'] as const;
export type LocalId = (typeof LOCAL_IDS)[number];
export const isLocalId = (s: unknown): s is LocalId => typeof s === 'string' && (LOCAL_IDS as readonly string[]).includes(s);

export interface LocalSpec {
  id: LocalId;
  tex: string;
  text: string;
  f: Fn;
  f1: Fn;
  f2: Fn;
  a: Val;
  fa: Val;
  /** f′(a) */
  f1a: Val;
  /** r(h) = f(a + h) − f(a), in a stable form */
  r: Fn;
  /** r_T(h) = f(a + h) − f(a) − f′(a)·h, in a stable form */
  rt: Fn;
  /** the leading and the next term of r (powers of h = x − a) */
  lead: Term;
  next: Term;
  /** the same for r_T */
  leadT: Term;
  nextT: Term;
  /** half the width of the window at zoom 1 (in h) */
  w0: number;
}

const T = (k: number, c: Val, text: string, tex: string): Term => ({ k, c, text, tex });
const q = (p: number, d: number, sign = 1): Val =>
  val((sign * p) / d, `${sign < 0 ? '−' : ''}${p}${d === 1 ? '' : '/' + d}`, `${sign < 0 ? '-' : ''}${d === 1 ? p : `\\frac{${p}}{${d}}`}`);
const sinHalf2 = (h: number) => {
  const s = Math.sin(h / 2);
  return 2 * s * s;
};
/**
 * sinh h − sin h = 2(h³/3! + h⁷/7! + h¹¹/11! + h¹⁵/15! + …): the series for |h| ≤ 1 (the first term left out is below
 * 1e-16 of the sum there), the plain difference beyond (where it cancels less than one digit)
 */
const sinhMinusSin = (h: number) => {
  if (Math.abs(h) > 1) return Math.sinh(h) - Math.sin(h);
  const h4 = h * h * h * h;
  return 2 * h * h * h * (1 / 6 + h4 * (1 / 5040 + h4 * (1 / 39916800 + h4 / 1307674368000)));
};
const sinhHalf2 = (h: number) => {
  const s = Math.sinh(h / 2);
  return 2 * s * s;
};

/** shared by every preset whose tangent at a is horizontal: then r_T = r */
function flat(base: Omit<LocalSpec, 'rt' | 'leadT' | 'nextT'>): LocalSpec {
  return { ...base, rt: base.r, leadT: base.lead, nextT: base.next };
}

export const LOCAL: Record<LocalId, LocalSpec> = {
  ex1x: flat({
    id: 'ex1x',
    tex: 'e^x-1-x',
    text: 'eˣ − 1 − x',
    f: (x) => Math.expm1(x) - x,
    f1: (x) => Math.expm1(x),
    f2: (x) => Math.exp(x),
    a: int(0),
    fa: int(0),
    f1a: int(0),
    r: (h) => Math.expm1(h) - h,
    lead: T(2, q(1, 2), 'x²/2', '\\frac{x^2}{2}'),
    next: T(3, q(1, 6), 'x³/6', '\\frac{x^3}{6}'),
    w0: 1.5,
  }),
  'cosh-cos': flat({
    id: 'cosh-cos',
    tex: '\\cosh x-\\cos x',
    text: 'cosh x − cos x',
    f: (x) => sinhHalf2(x) + sinHalf2(x),
    f1: (x) => Math.sinh(x) + Math.sin(x),
    f2: (x) => Math.cosh(x) + Math.cos(x),
    a: int(0),
    fa: int(0),
    f1a: int(0),
    r: (h) => sinhHalf2(h) + sinHalf2(h),
    lead: T(2, q(1, 1), 'x²', 'x^2'),
    next: T(6, q(1, 360), 'x⁶/360', '\\frac{x^6}{360}'),
    w0: 1.5,
  }),
  cos4: flat({
    id: 'cos4',
    tex: '1-\\cos x-\\frac{x^2}{2}',
    text: '1 − cos x − x²/2',
    f: (x) => sinHalf2(x) - (x * x) / 2,
    f1: (x) => Math.sin(x) - x,
    f2: (x) => Math.cos(x) - 1,
    a: int(0),
    fa: int(0),
    f1a: int(0),
    r: (h) => sinHalf2(h) - (h * h) / 2,
    lead: T(4, q(1, 24, -1), '−x⁴/24', '-\\frac{x^4}{24}'),
    next: T(6, q(1, 720), 'x⁶/720', '\\frac{x^6}{720}'),
    w0: 2.5,
  }),
  'sinh-sin': flat({
    id: 'sinh-sin',
    tex: '\\sinh x-\\sin x',
    text: 'sinh x − sin x',
    f: (x) => Math.sinh(x) - Math.sin(x),
    f1: (x) => Math.cosh(x) - Math.cos(x),
    f2: (x) => Math.sinh(x) + Math.sin(x),
    a: int(0),
    fa: int(0),
    f1a: int(0),
    r: sinhMinusSin,
    lead: T(3, q(1, 3), 'x³/3', '\\frac{x^3}{3}'),
    next: T(7, q(1, 2520), 'x⁷/2520', '\\frac{x^7}{2520}'),
    w0: 2,
  }),
  'tan-sin': flat({
    id: 'tan-sin',
    tex: '\\tan x-\\sin x',
    text: 'tan x − sin x',
    f: (x) => Math.tan(x) * sinHalf2(x),
    f1: (x) => 1 / (Math.cos(x) * Math.cos(x)) - Math.cos(x),
    f2: (x) => Math.sin(x) * (1 + 2 / (Math.cos(x) * Math.cos(x) * Math.cos(x))),
    a: int(0),
    fa: int(0),
    f1a: int(0),
    r: (h) => Math.tan(h) * sinHalf2(h),
    lead: T(3, q(1, 2), 'x³/2', '\\frac{x^3}{2}'),
    next: T(5, q(1, 8), 'x⁵/8', '\\frac{x^5}{8}'),
    w0: 1.2,
  }),
  quartic0: flat({
    id: 'quartic0',
    tex: 'x^4-4x^3',
    text: 'x⁴ − 4x³',
    f: (x) => x * x * x * (x - 4),
    f1: (x) => 4 * x * x * (x - 3),
    f2: (x) => 12 * x * (x - 2),
    a: int(0),
    fa: int(0),
    f1a: int(0),
    r: (h) => h * h * h * (h - 4),
    lead: T(3, q(4, 1, -1), '−4x³', '-4x^3'),
    next: T(4, q(1, 1), 'x⁴', 'x^4'),
    w0: 1.5,
  }),
  quartic3: flat({
    id: 'quartic3',
    tex: 'x^4-4x^3',
    text: 'x⁴ − 4x³',
    f: (x) => x * x * x * (x - 4),
    f1: (x) => 4 * x * x * (x - 3),
    f2: (x) => 12 * x * (x - 2),
    a: int(3),
    fa: int(-27),
    f1a: int(0),
    // x⁴ − 4x³ + 27 = (x − 3)²(x² + 2x + 3); with x = 3 + h: h²(h² + 8h + 18)
    r: (h) => h * h * (h * h + 8 * h + 18),
    lead: T(2, q(18, 1), '18(x − 3)²', '18(x-3)^2'),
    next: T(3, q(8, 1), '8(x − 3)³', '8(x-3)^3'),
    w0: 1.5,
  }),
  'sin-pi': {
    id: 'sin-pi',
    tex: '\\sin x',
    text: 'sin x',
    f: (x) => Math.sin(x),
    f1: (x) => Math.cos(x),
    f2: (x) => -Math.sin(x),
    a: val(Math.PI, 'π', '\\pi'),
    fa: int(0),
    f1a: int(-1),
    // sin(π + h) = −sin h
    r: (h) => -Math.sin(h),
    rt: (h) => h - Math.sin(h),
    lead: T(1, q(1, 1, -1), '−(x − π)', '-(x-\\pi)'),
    next: T(3, q(1, 6), '(x − π)³/6', '\\frac{(x-\\pi)^3}{6}'),
    leadT: T(3, q(1, 6), '(x − π)³/6', '\\frac{(x-\\pi)^3}{6}'),
    nextT: T(5, q(1, 120, -1), '−(x − π)⁵/120', '-\\frac{(x-\\pi)^5}{120}'),
    w0: 3,
  },
};

/**
 * What the leading term c·hᵏ of a residual says about the graph near a: k even and c > 0, the residual is positive on
 * both sides ('min'); k even and c < 0, negative on both sides ('max'); k odd, it changes sign ('cross'). For r this is
 * the local extremum test; for r_T it says whether the graph lies above the tangent, below it, or crosses it.
 */
export type LocalVerdict = 'min' | 'max' | 'cross';
export const verdictOf = (t: Term): LocalVerdict => (t.k % 2 === 1 ? 'cross' : t.c.v > 0 ? 'min' : 'max');

/** the term in force: r or, with the tangent subtracted, r_T */
export const localTerms = (id: LocalId, tangent: boolean) =>
  tangent ? { lead: LOCAL[id].leadT, next: LOCAL[id].nextT, r: LOCAL[id].rt } : { lead: LOCAL[id].lead, next: LOCAL[id].next, r: LOCAL[id].r };

/**
 * The window of the local view at zoom z ≥ 1: h runs over [−w0/z, w0/z] and the residual over [−H/zᵏ, H/zᵏ] with
 * H = 1.3·|c|·w0ᵏ, so the leading term c·hᵏ reaches the same height on screen at every zoom.
 */
export function localWindow(id: LocalId, tangent: boolean, zoom: number): { w: number; h: number; yScale: number } {
  const s = LOCAL[id];
  const { lead } = localTerms(id, tangent);
  const w = s.w0 / zoom;
  const yScale = zoom ** lead.k;
  return { w, h: (1.3 * Math.abs(lead.c.v) * s.w0 ** lead.k) / yScale, yScale };
}
