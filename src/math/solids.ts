/**
 * MODEL SPECIFICATION
 *
 * System:        plane regions bounded by two graphs (registry AREA: the area between them, cut into strips) and solids
 *                of revolution made by turning a plane region about a line (registry REV: disks, washers and
 *                cylindrical shells). Lesson 8.5; the core of SolidLab. Evaluated in IEEE double precision.
 * Dynamics:      none.
 * Boundary:      every intersection, area, partial-volume antiderivative and volume below is a STORED closed form,
 *                recomputed with sympy on 2026-11-27 (the chapter brief's screens/tools/ch8_presets.py, and a check of
 *                each P(x) = ∫ₐˣ A(t) dt against sympy's integral: the difference simplifies to 0 and P(a) = 0).
 *                AREA: two curves f, g of the strip variable v (y = f(x) when v = x; x = f(y) when v = y). Between
 *                consecutive intersections the order of the curves is fixed, so the region is a list of strip FORMS
 *                {lo, hi, top, bottom} with a stored exact area each (`cross` swaps at 0: 4 + 4). `yint` also has
 *                `alt`, the same region cut into vertical strips in x, where the lower boundary changes at x = 0
 *                (−√(x + 1) on [−1, 0], x − 1 on [0, 3]: 4/3 + 19/6 = 9/2).
 *                REV: the region bottom(x) ≤ y ≤ top(x), a ≤ x ≤ b, turned about the horizontal line y = k (disk,
 *                washer: R = top − k, r = bottom − k, the slice area π(R² − r²)) or about the y-axis (shell: radius x,
 *                height top − bottom, the "slice" area 2π·radius·height, which times dx is the shell's volume).
 *                partialVolume(id, x) = ∫ₐˣ A(t) dt from the stored antiderivative P; volume(id) = P(b), stored exactly
 *                as text too.
 * Ignored:       exact arithmetic; regions whose rotation axis cuts them (none here: R ≥ r ≥ 0, radius ≥ 0).
 * Valid when:    a ≤ x ≤ b for REV, the strip variable inside [lo, hi] of its forms for AREA (outside: NaN / null).
 * Failure modes: none on the stated ranges; the stored values are exact up to rounding.
 */

export type Fn = (x: number) => number;

const PI = Math.PI;

/* ------------------------------------------------------------------ the area between two graphs */

/** one interval of the strip variable on which the order of the two boundaries is fixed */
export interface StripForm {
  lo: number;
  hi: number;
  /** the upper boundary (v = x) or the right one (v = y), as a function of the strip variable */
  top: Fn;
  bottom: Fn;
  /** which curve of the preset is the top (right) boundary here: drives the two fill patterns */
  upper: 'f' | 'g';
  /** "(2 − x²) − x": the strip's height (length) as top − bottom */
  heightText: string;
  /** the exact area of this part and its text */
  area: number;
  areaText: string;
}

export interface AreaSpec {
  id: AreaId;
  /** plain label for the select and the readout */
  text: string;
  /** the strip variable the region is meant for: x (vertical strips) or y (horizontal strips) */
  variable: 'x' | 'y';
  /** the two curves as functions of `variable`: y = f(x), or x = f(y) when variable = y */
  f: Fn;
  g: Fn;
  fText: string;
  gText: string;
  /** the intersections, in `variable`, sorted; exact */
  cuts: readonly number[];
  cutsText: readonly string[];
  /** the intersection points (x, y) in the plane, exact */
  points: readonly { x: number; y: number; text: string }[];
  /** the region cut into strips of `variable` */
  forms: readonly StripForm[];
  /** the same region cut into strips of the other variable (yint only) */
  alt: { variable: 'x' | 'y'; forms: readonly StripForm[] } | null;
  /** the whole area, exact, and its text ("4 + 4 = 8") */
  area: number;
  areaText: string;
  /** the plane window of the figure */
  window: { x: readonly [number, number]; y: readonly [number, number] };
  /** the default strip position (in `variable`) and, for alt, in the other variable */
  v0: number;
  alt0: number;
}

export const AREA_IDS = ['parab', 'cross', 'yint'] as const;
export type AreaId = (typeof AREA_IDS)[number];
export const isAreaId = (s: unknown): s is AreaId => typeof s === 'string' && (AREA_IDS as readonly string[]).includes(s);

export const AREA: Record<AreaId, AreaSpec> = {
  parab: {
    id: 'parab',
    text: 'y = 2 − x², y = x',
    variable: 'x',
    f: (x) => 2 - x * x,
    g: (x) => x,
    fText: 'y = 2 − x²',
    gText: 'y = x',
    cuts: [-2, 1],
    cutsText: ['−2', '1'],
    points: [
      { x: -2, y: -2, text: '(−2, −2)' },
      { x: 1, y: 1, text: '(1, 1)' },
    ],
    forms: [{ lo: -2, hi: 1, top: (x) => 2 - x * x, bottom: (x) => x, upper: 'f', heightText: '(2 − x²) − x', area: 9 / 2, areaText: '9/2' }],
    alt: null,
    area: 9 / 2,
    areaText: '9/2',
    window: { x: [-2.7, 1.7], y: [-2.8, 2.6] },
    v0: -0.5,
    alt0: -0.5,
  },
  cross: {
    id: 'cross',
    text: 'y = x³, y = 4x',
    variable: 'x',
    f: (x) => x * x * x,
    g: (x) => 4 * x,
    fText: 'y = x³',
    gText: 'y = 4x',
    cuts: [-2, 0, 2],
    cutsText: ['−2', '0', '2'],
    points: [
      { x: -2, y: -8, text: '(−2, −8)' },
      { x: 0, y: 0, text: '(0, 0)' },
      { x: 2, y: 8, text: '(2, 8)' },
    ],
    forms: [
      { lo: -2, hi: 0, top: (x) => x * x * x, bottom: (x) => 4 * x, upper: 'f', heightText: 'x³ − 4x', area: 4, areaText: '4' },
      { lo: 0, hi: 2, top: (x) => 4 * x, bottom: (x) => x * x * x, upper: 'g', heightText: '4x − x³', area: 4, areaText: '4' },
    ],
    alt: null,
    area: 8,
    areaText: '4 + 4 = 8',
    window: { x: [-2.6, 2.6], y: [-9.5, 9.5] },
    v0: -1,
    alt0: -1,
  },
  yint: {
    id: 'yint',
    text: 'x = y² − 1, x = y + 1',
    variable: 'y',
    f: (y) => y * y - 1,
    g: (y) => y + 1,
    fText: 'x = y² − 1',
    gText: 'x = y + 1',
    cuts: [-1, 2],
    cutsText: ['−1', '2'],
    points: [
      { x: 0, y: -1, text: '(0, −1)' },
      { x: 3, y: 2, text: '(3, 2)' },
    ],
    forms: [{ lo: -1, hi: 2, top: (y) => y + 1, bottom: (y) => y * y - 1, upper: 'g', heightText: '(y + 1) − (y² − 1)', area: 9 / 2, areaText: '9/2' }],
    alt: {
      variable: 'x',
      forms: [
        {
          lo: -1,
          hi: 0,
          top: (x) => Math.sqrt(Math.max(0, x + 1)),
          bottom: (x) => -Math.sqrt(Math.max(0, x + 1)),
          upper: 'f',
          heightText: '√(x + 1) − (−√(x + 1))',
          area: 4 / 3,
          areaText: '4/3',
        },
        {
          lo: 0,
          hi: 3,
          top: (x) => Math.sqrt(Math.max(0, x + 1)),
          bottom: (x) => x - 1,
          upper: 'f',
          heightText: '√(x + 1) − (x − 1)',
          area: 19 / 6,
          areaText: '19/6',
        },
      ],
    },
    area: 9 / 2,
    areaText: '9/2',
    window: { x: [-1.6, 3.6], y: [-1.8, 2.8] },
    v0: 0.5,
    alt0: 1.5,
  },
};

/** the strip forms of a preset: its own variable, or the alternative cut (yint only) when `alt` */
export function formsOf(id: AreaId, alt = false): { variable: 'x' | 'y'; forms: readonly StripForm[] } {
  const s = AREA[id];
  return alt && s.alt ? s.alt : { variable: s.variable, forms: s.forms };
}

/** the range of the strip variable that the region covers */
export function stripRange(id: AreaId, alt = false): [number, number] {
  const { forms } = formsOf(id, alt);
  return [forms[0].lo, forms[forms.length - 1].hi];
}

export interface Strip {
  /** the index of the form that holds v */
  k: number;
  form: StripForm;
  top: number;
  bottom: number;
  /** top − bottom, ≥ 0 */
  height: number;
}

/** the strip at v (in the forms' variable); at a cut the form to the right is taken; null outside the region */
export function stripAt(id: AreaId, v: number, alt = false): Strip | null {
  const { forms } = formsOf(id, alt);
  const [lo, hi] = [forms[0].lo, forms[forms.length - 1].hi];
  if (!(v >= lo && v <= hi)) return null;
  let k = forms.findIndex((fm) => v >= fm.lo && v < fm.hi);
  if (k < 0) k = forms.length - 1;
  const form = forms[k];
  const top = form.top(v);
  const bottom = form.bottom(v);
  return { k, form, top, bottom, height: top - bottom };
}

/** the exact area of the region (the sum of its forms' stored areas) */
export const regionArea = (id: AreaId): number => AREA[id].area;

/* ------------------------------------------------------------------ solids of revolution */

export type RevMethod = 'disk' | 'washer' | 'shell';

export interface RevSpec {
  id: RevId;
  method: RevMethod;
  /** the axis of rotation: the horizontal line y = k, or the y-axis (x = 0) */
  axis: { kind: 'h'; k: number } | { kind: 'v'; c: number };
  /** the axis as an equation, e.g. "y = 0", "y = −1", "x = 0" */
  axisText: string;
  /** the region bottom(x) ≤ y ≤ top(x), a ≤ x ≤ b */
  a: number;
  b: number;
  top: Fn;
  bottom: Fn;
  topText: string;
  bottomText: string;
  rangeText: string;
  /** disk / washer: the outer and inner radii R(x) = top − k, r(x) = bottom − k (r = 0 for a disk) */
  R: Fn;
  r: Fn;
  Rtext: string;
  rtext: string;
  /** shell: the radius (distance to the axis) and the height */
  radiusText: string;
  heightText: string;
  /** the partial volume P(x) = ∫ₐˣ A(t) dt, closed form, P(a) = 0 */
  P: Fn;
  Ptext: string;
  volume: number;
  volumeText: string;
  /** the plane window of the figure (holds the region and its mirror image in the axis) */
  window: { x: readonly [number, number]; y: readonly [number, number] };
  /** the default slice / shell position */
  x0: number;
}

export const REV_IDS = ['cone', 'sine', 'sphere', 'washer', 'offaxis', 'bowl', 'sinshell', 'cone-y'] as const;
export type RevId = (typeof REV_IDS)[number];
/** the presets of the disk mode (disks and washers) and of the shell mode */
export const DISK_IDS = ['cone', 'sine', 'sphere', 'washer', 'offaxis'] as const satisfies readonly RevId[];
export const SHELL_IDS = ['bowl', 'sinshell', 'cone-y'] as const satisfies readonly RevId[];
export const isRevId = (s: unknown): s is RevId => typeof s === 'string' && (REV_IDS as readonly string[]).includes(s);
export const isDiskId = (s: unknown): s is RevId => typeof s === 'string' && (DISK_IDS as readonly string[]).includes(s);
export const isShellId = (s: unknown): s is RevId => typeof s === 'string' && (SHELL_IDS as readonly string[]).includes(s);

const zero: Fn = () => 0;
const nanFn: Fn = () => NaN;

export const REV: Record<RevId, RevSpec> = {
  cone: {
    id: 'cone',
    method: 'disk',
    axis: { kind: 'h', k: 0 },
    axisText: 'y = 0',
    a: 0,
    b: 2,
    top: (x) => x / 2,
    bottom: zero,
    topText: 'y = x/2',
    bottomText: 'y = 0',
    rangeText: '0 ≤ x ≤ 2',
    R: (x) => x / 2,
    r: zero,
    Rtext: 'x/2',
    rtext: '0',
    radiusText: '',
    heightText: '',
    P: (x) => (PI * x ** 3) / 12,
    Ptext: 'πx³/12',
    volume: (2 * PI) / 3,
    volumeText: '2π/3',
    window: { x: [-0.3, 2.3], y: [-1.25, 1.25] },
    x0: 1,
  },
  sine: {
    id: 'sine',
    method: 'disk',
    axis: { kind: 'h', k: 0 },
    axisText: 'y = 0',
    a: 0,
    b: PI,
    top: Math.sin,
    bottom: zero,
    topText: 'y = sin x',
    bottomText: 'y = 0',
    rangeText: '0 ≤ x ≤ π',
    R: Math.sin,
    r: zero,
    Rtext: 'sin x',
    rtext: '0',
    radiusText: '',
    heightText: '',
    P: (x) => PI * (x / 2 - Math.sin(2 * x) / 4),
    Ptext: 'π(x/2 − sin(2x)/4)',
    volume: (PI * PI) / 2,
    volumeText: 'π²/2',
    window: { x: [-0.3, 3.45], y: [-1.25, 1.25] },
    x0: 1,
  },
  sphere: {
    id: 'sphere',
    method: 'disk',
    axis: { kind: 'h', k: 0 },
    axisText: 'y = 0',
    a: -2,
    b: 2,
    top: (x) => Math.sqrt(Math.max(0, 4 - x * x)),
    bottom: zero,
    topText: 'y = √(4 − x²)',
    bottomText: 'y = 0',
    rangeText: '−2 ≤ x ≤ 2',
    R: (x) => Math.sqrt(Math.max(0, 4 - x * x)),
    r: zero,
    Rtext: '√(4 − x²)',
    rtext: '0',
    radiusText: '',
    heightText: '',
    P: (x) => PI * (4 * x - x ** 3 / 3 + 16 / 3),
    Ptext: 'π(4x − x³/3 + 16/3)',
    volume: (32 * PI) / 3,
    volumeText: '32π/3',
    window: { x: [-2.4, 2.4], y: [-2.4, 2.4] },
    x0: -1,
  },
  washer: {
    id: 'washer',
    method: 'washer',
    axis: { kind: 'h', k: 0 },
    axisText: 'y = 0',
    a: -1,
    b: 1,
    top: () => 1,
    bottom: (x) => x * x,
    topText: 'y = 1',
    bottomText: 'y = x²',
    rangeText: '−1 ≤ x ≤ 1',
    R: () => 1,
    r: (x) => x * x,
    Rtext: '1',
    rtext: 'x²',
    radiusText: '',
    heightText: '',
    P: (x) => PI * (x - x ** 5 / 5 + 4 / 5),
    Ptext: 'π(x − x⁵/5 + 4/5)',
    volume: (8 * PI) / 5,
    volumeText: '8π/5',
    window: { x: [-1.35, 1.35], y: [-1.25, 1.25] },
    x0: -0.5,
  },
  offaxis: {
    id: 'offaxis',
    method: 'washer',
    axis: { kind: 'h', k: -1 },
    axisText: 'y = −1',
    a: 0,
    b: 1,
    top: Math.sqrt,
    bottom: zero,
    topText: 'y = √x',
    bottomText: 'y = 0',
    rangeText: '0 ≤ x ≤ 1',
    R: (x) => Math.sqrt(x) + 1,
    r: () => 1,
    Rtext: '√x + 1',
    rtext: '1',
    radiusText: '',
    heightText: '',
    P: (x) => PI * (x * x / 2 + (4 * x ** 1.5) / 3),
    Ptext: 'π(x²/2 + 4x√x/3)',
    volume: (11 * PI) / 6,
    volumeText: '11π/6',
    window: { x: [-0.3, 1.3], y: [-3.25, 1.25] },
    x0: 0.5,
  },
  bowl: {
    id: 'bowl',
    method: 'shell',
    axis: { kind: 'v', c: 0 },
    axisText: 'x = 0',
    a: 0,
    b: 1,
    top: (x) => x * x,
    bottom: zero,
    topText: 'y = x²',
    bottomText: 'y = 0',
    rangeText: '0 ≤ x ≤ 1',
    R: nanFn,
    r: nanFn,
    Rtext: '',
    rtext: '',
    radiusText: 'x',
    heightText: 'x²',
    P: (x) => (PI * x ** 4) / 2,
    Ptext: 'πx⁴/2',
    volume: PI / 2,
    volumeText: 'π/2',
    window: { x: [-1.3, 1.3], y: [-0.25, 1.25] },
    x0: 0.5,
  },
  sinshell: {
    id: 'sinshell',
    method: 'shell',
    axis: { kind: 'v', c: 0 },
    axisText: 'x = 0',
    a: 0,
    b: PI,
    top: Math.sin,
    bottom: zero,
    topText: 'y = sin x',
    bottomText: 'y = 0',
    rangeText: '0 ≤ x ≤ π',
    R: nanFn,
    r: nanFn,
    Rtext: '',
    rtext: '',
    radiusText: 'x',
    heightText: 'sin x',
    P: (x) => 2 * PI * (Math.sin(x) - x * Math.cos(x)),
    Ptext: '2π(sin x − x cos x)',
    volume: 2 * PI * PI,
    volumeText: '2π²',
    window: { x: [-3.45, 3.45], y: [-0.3, 1.3] },
    x0: 1,
  },
  'cone-y': {
    id: 'cone-y',
    method: 'shell',
    axis: { kind: 'v', c: 0 },
    axisText: 'x = 0',
    a: 0,
    b: 1,
    top: (x) => 2 - 2 * x,
    bottom: zero,
    topText: 'y = 2 − 2x',
    bottomText: 'y = 0',
    rangeText: '0 ≤ x ≤ 1',
    R: nanFn,
    r: nanFn,
    Rtext: '',
    rtext: '',
    radiusText: 'x',
    heightText: '2 − 2x',
    P: (x) => 2 * PI * (x * x - (2 * x ** 3) / 3),
    Ptext: '2π(x² − 2x³/3)',
    volume: (2 * PI) / 3,
    volumeText: '2π/3',
    window: { x: [-1.3, 1.3], y: [-0.25, 2.25] },
    x0: 0.5,
  },
};

export type Slice =
  | { kind: 'disk' | 'washer'; R: number; r: number; area: number }
  | { kind: 'shell'; radius: number; height: number; area: number };

/** the slice at x: a disk / washer π(R² − r²), or a shell 2π·radius·height (times dx it is the slice's volume) */
export function sliceAt(id: RevId, x: number): Slice {
  const s = REV[id];
  if (s.method === 'shell') {
    const c = s.axis.kind === 'v' ? s.axis.c : 0;
    const radius = Math.abs(x - c);
    const height = s.top(x) - s.bottom(x);
    return { kind: 'shell', radius, height, area: 2 * PI * radius * height };
  }
  const R = s.R(x);
  const r = s.r(x);
  return { kind: s.method, R, r, area: PI * (R * R - r * r) };
}

/** the volume of the slices from a to x, from the stored antiderivative (exact up to rounding); NaN outside [a, b] */
export function partialVolume(id: RevId, x: number): number {
  const s = REV[id];
  if (!(x >= s.a - 1e-12 && x <= s.b + 1e-12)) return NaN;
  return s.P(Math.min(s.b, Math.max(s.a, x)));
}

/** the whole volume, stored exactly */
export const volume = (id: RevId): number => REV[id].volume;

/** a midpoint sum of n slices of equal thickness: Σ A(xᵢ*) Δx, the Riemann sum behind V = ∫ A(x) dx (a probe) */
export function sliceSum(id: RevId, n: number): number {
  const s = REV[id];
  const dx = (s.b - s.a) / n;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += sliceAt(id, s.a + (i + 0.5) * dx).area;
  return sum * dx;
}
