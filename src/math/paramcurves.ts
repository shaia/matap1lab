/**
 * Parametrised curves (lesson 9.1): a curve as the path of a moving point r(t), its Cartesian equation, its world line
 * and a space curve.
 *
 * MODEL SPECIFICATION
 *   A plane preset of PC is a vector function r: [t0, t1] -> R^2 given by exact closed forms for r and r' (`dr`). The
 *   CURVE is the image {r(t)}; the parametrisation also fixes a direction and a speed, which belong to r and not to the
 *   curve. `eq` is a Cartesian equation F(x, y) = 0 (`resid` = F) that EVERY point of the curve satisfies; the curve may
 *   cover only part of the equation's set (`eqNote` says which part), and `eqSet` returns the whole set as polylines
 *   (drawn faintly behind the curve). The WORLD LINE of r is its graph {(t, x(t), y(t))} in R^3; its shadow on the plane
 *   t = t0 is the curve itself. Two presets that are `twin`s trace the same set with different world lines
 *   (circle / twice, parab / parab4: parab4(u) = parab(u^2)).
 *   A space preset of SC is r: [t0, t1] -> R^3 (the helix r = (cos t, sin t, p t / 2 pi) rises exactly p per turn; p is
 *   a parameter of the preset), with a bounding box that fixes the view.
 *   Everything is closed-form: no numerical integration, no probing, nothing here is a numerical estimate. `sample`
 *   and `worldLine` only evaluate r at equally spaced parameters.
 */

import type { Vec3 } from './vec';

export type P2 = readonly [number, number];

export const TAU = 2 * Math.PI;

export type PcId = 'segment' | 'circle' | 'ellipse' | 'parab' | 'parab4' | 'halfparab' | 'nodal' | 'twice';
export type ScId = 'helix' | 'segment3';

export interface PcPreset {
  id: PcId;
  /** the parametrisation as TeX (for lessons) */
  tex: string;
  /** the parametrisation as plain text (for the figure's readout and select) */
  text: string;
  rangeText: string;
  r: (t: number) => P2;
  dr: (t: number) => P2;
  range: readonly [number, number];
  /** the Cartesian equation as TeX, or null when there is none */
  eq: string | null;
  eqText: string | null;
  /** Hebrew, the continuation of "העקום הוא …": which part of the equation's set the curve covers */
  eqNote: string;
  /** F(x, y): zero exactly on the equation's set */
  resid: (x: number, y: number) => number;
  /** the whole set of the equation, as polylines clipped near the window */
  eqSet: () => P2[][];
  window: { x: readonly [number, number]; y: readonly [number, number] };
  /** the preset that traces the same set with another parametrisation */
  twin: PcId | null;
}

const line = (f: (u: number) => P2, a: number, b: number, n = 240): P2[] => Array.from({ length: n + 1 }, (_, i) => f(a + ((b - a) * i) / n));

export const PC: Record<PcId, PcPreset> = {
  segment: {
    id: 'segment',
    tex: '\\vec r(t)=(-2+4t,\\,-1+2t),\\ 0\\le t\\le 1',
    text: '(−2 + 4t, −1 + 2t)',
    rangeText: '0 ≤ t ≤ 1',
    r: (t) => [-2 + 4 * t, -1 + 2 * t],
    dr: () => [4, 2],
    range: [0, 1],
    eq: 'y=\\frac{x}{2}',
    eqText: 'y = x/2',
    eqNote: 'רק הקטע −2 ≤ x ≤ 2 של הישר',
    resid: (x, y) => y - x / 2,
    eqSet: () => [line((x) => [x, x / 2], -4, 4, 2)],
    window: { x: [-3, 3], y: [-2, 2] },
    twin: null,
  },
  circle: {
    id: 'circle',
    tex: '\\vec r(t)=(\\cos t,\\,\\sin t),\\ 0\\le t\\le 2\\pi',
    text: '(cos t, sin t)',
    rangeText: '0 ≤ t ≤ 2π',
    r: (t) => [Math.cos(t), Math.sin(t)],
    dr: (t) => [-Math.sin(t), Math.cos(t)],
    range: [0, TAU],
    eq: 'x^2+y^2=1',
    eqText: 'x² + y² = 1',
    eqNote: 'כל המעגל, פעם אחת, נגד כיוון השעון, מהנקודה (1, 0)',
    resid: (x, y) => x * x + y * y - 1,
    eqSet: () => [line((t) => [Math.cos(t), Math.sin(t)], 0, TAU)],
    window: { x: [-1.6, 1.6], y: [-1.3, 1.3] },
    twin: 'twice',
  },
  ellipse: {
    id: 'ellipse',
    tex: '\\vec r(t)=(2\\cos t,\\,\\sin t),\\ 0\\le t\\le 2\\pi',
    text: '(2 cos t, sin t)',
    rangeText: '0 ≤ t ≤ 2π',
    r: (t) => [2 * Math.cos(t), Math.sin(t)],
    dr: (t) => [-2 * Math.sin(t), Math.cos(t)],
    range: [0, TAU],
    eq: '\\frac{x^2}{4}+y^2=1',
    eqText: 'x²/4 + y² = 1',
    eqNote: 'כל האליפסה, פעם אחת, נגד כיוון השעון, מהנקודה (2, 0)',
    resid: (x, y) => (x * x) / 4 + y * y - 1,
    eqSet: () => [line((t) => [2 * Math.cos(t), Math.sin(t)], 0, TAU)],
    window: { x: [-2.6, 2.6], y: [-1.5, 1.5] },
    twin: null,
  },
  parab: {
    id: 'parab',
    tex: '\\vec r(t)=(t,\\,t^2),\\ 0\\le t\\le 2',
    text: '(t, t²)',
    rangeText: '0 ≤ t ≤ 2',
    r: (t) => [t, t * t],
    dr: (t) => [1, 2 * t],
    range: [0, 2],
    eq: 'y=x^2',
    eqText: 'y = x²',
    eqNote: 'רק החלק 0 ≤ x ≤ 2 של הפרבולה',
    resid: (x, y) => y - x * x,
    eqSet: () => [line((x) => [x, x * x], -3, 3)],
    window: { x: [-1.5, 2.5], y: [-0.5, 4.5] },
    twin: 'parab4',
  },
  parab4: {
    id: 'parab4',
    tex: '\\vec r(t)=(t^2,\\,t^4),\\ 0\\le t\\le \\sqrt2',
    text: '(t², t⁴)',
    rangeText: '0 ≤ t ≤ √2',
    r: (t) => [t * t, t ** 4],
    dr: (t) => [2 * t, 4 * t ** 3],
    range: [0, Math.SQRT2],
    eq: 'y=x^2',
    eqText: 'y = x²',
    eqNote: 'רק החלק 0 ≤ x ≤ 2 של הפרבולה, אותו חלק אבל במהירות אחרת',
    resid: (x, y) => y - x * x,
    eqSet: () => [line((x) => [x, x * x], -3, 3)],
    window: { x: [-1.5, 2.5], y: [-0.5, 4.5] },
    twin: 'parab',
  },
  halfparab: {
    id: 'halfparab',
    tex: '\\vec r(t)=(\\sin t,\\,\\sin^2 t),\\ 0\\le t\\le 2\\pi',
    text: '(sin t, sin² t)',
    rangeText: '0 ≤ t ≤ 2π',
    r: (t) => [Math.sin(t), Math.sin(t) ** 2],
    dr: (t) => [Math.cos(t), 2 * Math.sin(t) * Math.cos(t)],
    range: [0, TAU],
    eq: 'y=x^2',
    eqText: 'y = x²',
    eqNote: 'רק החלק −1 ≤ x ≤ 1 של הפרבולה, והוא עובר בו הלוך וחזור',
    resid: (x, y) => y - x * x,
    eqSet: () => [line((x) => [x, x * x], -2.2, 2.2)],
    window: { x: [-2, 2], y: [-0.5, 2.5] },
    twin: null,
  },
  nodal: {
    id: 'nodal',
    tex: '\\vec r(t)=(t^2-1,\\,t^3-t),\\ -1.6\\le t\\le 1.6',
    text: '(t² − 1, t³ − t)',
    rangeText: '−1.6 ≤ t ≤ 1.6',
    r: (t) => [t * t - 1, t ** 3 - t],
    dr: (t) => [2 * t, 3 * t * t - 1],
    range: [-1.6, 1.6],
    eq: 'y^2=x^2(x+1)',
    eqText: 'y² = x²(x + 1)',
    eqNote: 'החלק של הקבוצה שבטווח t שנבחר, והוא חותך את עצמו בראשית',
    resid: (x, y) => y * y - x * x * (x + 1),
    eqSet: () => [line((t) => [t * t - 1, t ** 3 - t], -2.2, 2.2, 440)],
    window: { x: [-2, 3], y: [-3, 3] },
    twin: null,
  },
  twice: {
    id: 'twice',
    tex: '\\vec r(t)=(\\cos 2t,\\,\\sin 2t),\\ 0\\le t\\le 2\\pi',
    text: '(cos 2t, sin 2t)',
    rangeText: '0 ≤ t ≤ 2π',
    r: (t) => [Math.cos(2 * t), Math.sin(2 * t)],
    dr: (t) => [-2 * Math.sin(2 * t), 2 * Math.cos(2 * t)],
    range: [0, TAU],
    eq: 'x^2+y^2=1',
    eqText: 'x² + y² = 1',
    eqNote: 'כל המעגל, פעמיים, נגד כיוון השעון',
    resid: (x, y) => x * x + y * y - 1,
    eqSet: () => [line((t) => [Math.cos(t), Math.sin(t)], 0, TAU)],
    window: { x: [-1.6, 1.6], y: [-1.3, 1.3] },
    twin: 'circle',
  },
};

export const PC_IDS = ['segment', 'circle', 'ellipse', 'parab', 'parab4', 'halfparab', 'nodal', 'twice'] as const satisfies readonly PcId[];
export const isPcId = (x: unknown): x is PcId => typeof x === 'string' && x in PC;

export interface ScPreset {
  id: ScId;
  text: string;
  rangeText: string;
  /** r(t) for the rise per turn p (ignored by presets without a pitch) */
  r: (t: number, p: number) => Vec3;
  dr: (t: number, p: number) => Vec3;
  range: readonly [number, number];
  /** the box the view must show */
  box: { lo: Vec3; hi: Vec3 };
  hasPitch: boolean;
}

export const SC: Record<ScId, ScPreset> = {
  helix: {
    id: 'helix',
    text: '(cos t, sin t, p·t/2π)',
    rangeText: '0 ≤ t ≤ 4π',
    r: (t, p) => [Math.cos(t), Math.sin(t), (p * t) / TAU],
    dr: (t, p) => [-Math.sin(t), Math.cos(t), p / TAU],
    range: [0, 2 * TAU],
    box: { lo: [-1.4, -1.4, 0], hi: [1.4, 1.4, 6.3] },
    hasPitch: true,
  },
  segment3: {
    id: 'segment3',
    text: '(2 − 2t, 2t, 2t)',
    rangeText: '0 ≤ t ≤ 1',
    r: (t) => [2 - 2 * t, 2 * t, 2 * t],
    dr: () => [-2, 2, 2],
    range: [0, 1],
    box: { lo: [-0.4, -0.4, -0.4], hi: [2.5, 2.5, 2.5] },
    hasPitch: false,
  },
};

export const SC_IDS = ['helix', 'segment3'] as const satisfies readonly ScId[];
export const isScId = (x: unknown): x is ScId => typeof x === 'string' && x in SC;

export const HELIX_P = { min: 0, max: 3, default: 1 } as const;

/** the parameter at which a figure starts: a quarter of the way along the range */
export const startT = (range: readonly [number, number]): number => range[0] + 0.25 * (range[1] - range[0]);

export const point = (id: PcId, t: number): P2 => PC[id].r(t);
/** r'(t): used by tests and by the tangent hint of the `trace` mode */
export const velocity = (id: PcId, t: number): P2 => PC[id].dr(t);

/** n + 1 points at equal parameter steps over the preset's range */
export function sample(id: PcId, n: number): P2[] {
  const [a, b] = PC[id].range;
  return Array.from({ length: n + 1 }, (_, i) => PC[id].r(a + ((b - a) * i) / n));
}

/** the world line: n + 1 points (t, x(t), y(t)) */
export function worldLine(id: PcId, n: number): [number, number, number][] {
  const [a, b] = PC[id].range;
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = a + ((b - a) * i) / n;
    const [x, y] = PC[id].r(t);
    return [t, x, y];
  });
}

export interface Crossing {
  t1: number;
  t2: number;
  p: P2;
}

/** the parameters at which a preset passes through the same point twice (only `nodal`: t = ±1 at the origin) */
export function selfCrossings(id: 'nodal'): Crossing[] {
  void id;
  return [{ t1: -1, t2: 1, p: [0, 0] }];
}

export const spacePoint = (id: ScId, t: number, p: number = HELIX_P.default): Vec3 => SC[id].r(t, p);
export const spaceVelocity = (id: ScId, t: number, p: number = HELIX_P.default): Vec3 => SC[id].dr(t, p);
export function spaceSample(id: ScId, n: number, p: number = HELIX_P.default): Vec3[] {
  const [a, b] = SC[id].range;
  return Array.from({ length: n + 1 }, (_, i) => SC[id].r(a + ((b - a) * i) / n, p));
}
