import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/analysis';
import {
  LEAD,
  LEAD_IDS,
  LEIBNIZ,
  LEIBNIZ_IDS,
  LEIBNIZ_MAX,
  TF,
  TF_IDS,
  degreeOf,
  fnOf,
  goodBand,
  leadingTerm,
  leibnizOrderFor,
  leibnizSums,
  partialSum,
  polyText,
  radiusAbout,
  radiusOf,
  ratApprox,
  remainderInfo,
  remainderInterval,
  sampledMaxError,
  seriesCoeffs,
  taylorCoeffs,
  taylorPoly,
  type LeadId,
  type TfId,
} from '~/math/taylor';

/*
 * Every exact coefficient below was computed with sympy on 2026-11-27 (screens/tools/taylor-ch6.py: series(f, x, x0, 9))
 * and pasted as rationals, or as sympy's exact form (jscode) when a constant is irrational.
 */

const S3 = Math.sqrt(3);
const E = Math.E;
const EI = Math.exp(-1);

/** [id, a (binom), x0, c₀ … c₈] */
const SYMPY: [TfId, number, number, number[]][] = [
  ['exp', 0.5, 0, [1, 1, 1 / 2, 1 / 6, 1 / 24, 1 / 120, 1 / 720, 1 / 5040, 1 / 40320]],
  ['exp', 0.5, Math.LN2, [2, 2, 1, 1 / 3, 1 / 12, 1 / 60, 1 / 360, 1 / 2520, 1 / 20160]],
  ['sin', 0.5, 0, [0, 1, 0, -1 / 6, 0, 1 / 120, 0, -1 / 5040, 0]],
  ['sin', 0.5, Math.PI / 6, [1 / 2, (1 / 2) * S3, -1 / 4, (-1 / 12) * S3, 1 / 48, (1 / 240) * S3, -1 / 1440, (-1 / 10080) * S3, 1 / 80640]],
  ['cos', 0.5, 0, [1, 0, -1 / 2, 0, 1 / 24, 0, -1 / 720, 0, 1 / 40320]],
  ['cos', 0.5, Math.PI / 3, [1 / 2, (-1 / 2) * S3, -1 / 4, (1 / 12) * S3, 1 / 48, (-1 / 240) * S3, -1 / 1440, (1 / 10080) * S3, 1 / 80640]],
  ['ln1p', 0.5, 0, [0, 1, -1 / 2, 1 / 3, -1 / 4, 1 / 5, -1 / 6, 1 / 7, -1 / 8]],
  ['ln1p', 0.5, 1, [Math.log(2), 1 / 2, -1 / 8, 1 / 24, -1 / 64, 1 / 160, -1 / 384, 1 / 896, -1 / 2048]],
  ['geom', 0.5, 0, [1, 1, 1, 1, 1, 1, 1, 1, 1]],
  ['geom', 0.5, -1, [1 / 2, 1 / 4, 1 / 8, 1 / 16, 1 / 32, 1 / 64, 1 / 128, 1 / 256, 1 / 512]],
  ['lorentz', 0.5, 0, [1, 0, -1, 0, 1, 0, -1, 0, 1]],
  ['lorentz', 0.5, 1, [1 / 2, -1 / 2, 1 / 4, 0, -1 / 8, 1 / 8, -1 / 16, 0, 1 / 32]],
  ['tan', 0.5, 0, [0, 1, 0, 1 / 3, 0, 2 / 15, 0, 17 / 315, 0]],
  ['tan', 0.5, Math.PI / 4, [1, 2, 2, 8 / 3, 10 / 3, 64 / 15, 244 / 45, 2176 / 315, 554 / 63]],
  ['expsin', 0.5, 0, [1, 1, 1 / 2, 0, -1 / 8, -1 / 15, -1 / 240, 1 / 90, 31 / 5760]],
  ['expsin', 0.5, Math.PI / 2, [E, 0, (-1 / 2) * E, 0, (1 / 6) * E, 0, (-31 / 720) * E, 0, (379 / 40320) * E]],
  ['arctan', 0.5, 0, [0, 1, 0, -1 / 3, 0, 1 / 5, 0, -1 / 7, 0]],
  ['arctan', 0.5, 1, [(1 / 4) * Math.PI, 1 / 2, -1 / 4, 1 / 12, 0, -1 / 40, 1 / 48, -1 / 112, 0]],
  ['sqrt1p', 0.5, 0, [1, 1 / 2, -1 / 8, 1 / 16, -5 / 128, 7 / 256, -21 / 1024, 33 / 2048, -429 / 32768]],
  ['sqrt1p', 0.5, 3, [2, 1 / 4, -1 / 64, 1 / 512, -5 / 16384, 7 / 131072, -21 / 2097152, 33 / 16777216, -429 / 1073741824]],
  ['binom', 0.5, 0, [1, 1 / 2, -1 / 8, 1 / 16, -5 / 128, 7 / 256, -21 / 1024, 33 / 2048, -429 / 32768]],
  ['binom', -2, 0, [1, -2, 3, -4, 5, -6, 7, -8, 9]],
  ['binom', -2, 1, [1 / 4, -1 / 4, 3 / 16, -1 / 8, 5 / 64, -3 / 64, 7 / 256, -1 / 64, 9 / 1024]],
  ['binom', 1 / 3, 0, [1, 1 / 3, -1 / 9, 5 / 81, -10 / 243, 22 / 729, -154 / 6561, 374 / 19683, -935 / 59049]],
  ['binom', 3, 0, [1, 3, 3, 1, 0, 0, 0, 0, 0]],
  ['gauss', 0.5, 0, [1, 0, -1, 0, 1 / 2, 0, -1 / 6, 0, 1 / 24]],
  ['gauss', 0.5, 1, [EI, -2 * EI, EI, (2 / 3) * EI, (-5 / 6) * EI, (1 / 15) * EI, (23 / 90) * EI, (-29 / 315) * EI, (-103 / 2520) * EI]],
  ['poly', 0.5, 0, [1, -2, 0, 1, 0, 0, 0, 0, 0]],
  ['poly', 0.5, 1, [0, 1, 3, 1, 0, 0, 0, 0, 0]],
  ['ln', 0.5, 1, [0, 1, -1 / 2, 1 / 3, -1 / 4, 1 / 5, -1 / 6, 1 / 7, -1 / 8]],
  ['ln', 0.5, 2, [Math.log(2), 1 / 2, -1 / 8, 1 / 24, -1 / 64, 1 / 160, -1 / 384, 1 / 896, -1 / 2048]],
  ['sqrt', 0.5, 4, [2, 1 / 4, -1 / 64, 1 / 512, -5 / 16384, 7 / 131072, -21 / 2097152, 33 / 16777216, -429 / 1073741824]],
  ['sqrt', 0.5, 9, [3, 1 / 6, -1 / 216, 1 / 3888, -5 / 279936, 7 / 5038848, -7 / 60466176, 11 / 1088391168, -143 / 156728328192]],
  ['cosh', 0.5, 0, [1, 0, 1 / 2, 0, 1 / 24, 0, 1 / 720, 0, 1 / 40320]],
  ['cosh', 0.5, Math.LN2, [Math.cosh(Math.log(2)), Math.sinh(Math.log(2)), 5 / 8, 1 / 8, 5 / 96, 1 / 160, 1 / 576, 1 / 6720, 1 / 32256]],
];

/**
 * LEAD presets near 0: [x, g(x), g(x) − c xᵏ, g(x) − c xᵏ − d xᵐ], exact values from sympy on 2026-11-27
 * (screens/tools/lead-ch6.py, x as an exact rational, 20 significant digits). The closed form sin x − x at 10⁻³ gives
 * 1.6666665833e-10 with ~7 good digits only, and sin x − x + x³/6 there is pure noise against 1.98e-25.
 */
const LEAD_SYMPY: Record<LeadId, [number, number, number, number][]> = {
  'sin-x': [
    [1e-1, -1.6658335317184769319e-4, 8.3313494818973480865e-8, -1.9838514359852468256e-11],
    [-1e-1, 1.6658335317184769319e-4, -8.3313494818973480865e-8, 1.9838514359852468256e-11],
    [1e-2, -1.6666583333531745756e-7, 8.3333134920910493577e-13, -1.9841242283975669376e-18],
    [-1e-2, 1.6666583333531745756e-7, -8.3333134920910493577e-13, 1.9841242283975669376e-18],
    [1e-3, -1.6666665833333353175e-10, 8.3333331349206376764e-18, -1.9841269565696651535e-25],
    [-1e-3, 1.6666665833333353175e-10, -8.3333331349206376764e-18, 1.9841269565696651535e-25],
  ],
  '1-cos': [
    [1e-1, 4.9958347219742339044e-3, -4.165278025766095562e-6, 1.3886409005711046789e-9],
    [-1e-1, 4.9958347219742339044e-3, -4.165278025766095562e-6, 1.3886409005711046789e-9],
    [1e-2, 4.9999583334722219742e-5, -4.1666527778025793375e-10, 1.38888640873291446e-15],
    [-1e-2, 4.9999583334722219742e-5, -4.1666527778025793375e-10, 1.38888640873291446e-15],
    [1e-3, 4.9999995833333472222e-7, -4.1666665277777802579e-14, 1.3888888640873018629e-21],
    [-1e-3, 4.9999995833333472222e-7, -4.1666665277777802579e-14, 1.3888888640873018629e-21],
  ],
  'exp-1-x': [
    [1e-1, 5.1709180756476248117e-3, 1.7091807564762481171e-4, 4.2514089809581450412e-6],
    [-1e-1, 4.8374180359595731643e-3, -1.6258196404042683575e-4, 4.0847026262398309157e-6],
    [1e-2, 5.0167084168057542165e-5, 1.6708416805754216546e-7, 4.1750139087549879024e-10],
    [-1e-2, 4.9833749168053573906e-5, -1.6625083194642609402e-7, 4.1583472024057264385e-10],
    [1e-3, 5.0016670834166805575e-7, 1.6670834166805575399e-10, 4.1675001389087326392e-14],
    [-1e-3, 4.9983337499166805536e-7, -1.6662500833194464283e-10, 4.1658334722023834323e-14],
  ],
  'ln1p-x': [
    [1e-1, -4.6898201956751399561e-3, 3.1017980432486004395e-4, -2.3153529008473289381e-5],
    [-1e-1, -5.3605156578263012275e-3, -3.605156578263012275e-4, -2.7182324492967894168e-5],
    [1e-2, -4.9669146831917151785e-5, 3.3085316808284821536e-7, -2.4801652504851179758e-9],
    [-1e-2, -5.0335853501441183549e-5, -3.3585350144118354886e-7, -2.5201681078502155242e-9],
    [1e-3, -4.996669164668331906e-7, 3.3308353316680939892e-10, -2.498001665239344128e-13],
    [-1e-3, -5.0033358353350014298e-7, -3.3358353350014298225e-10, -2.5020016680964892073e-13],
  ],
  'tan-x': [
    [1e-1, 3.3467208545054505808e-4, 1.3387521172117247467e-6, 5.4187838783914133791e-9],
    [-1e-1, -3.3467208545054505808e-4, -1.3387521172117247467e-6, -5.4187838783914133791e-9],
    [1e-2, 3.3334666720637107672e-7, 1.3333873037743390769e-11, 5.3970441005743531347e-16],
    [-1e-2, -3.3334666720637107672e-7, -1.3333873037743390769e-11, -5.3970441005743531347e-16],
    [1e-3, 3.3333346666672063494e-10, 1.3333338730160917108e-16, 5.3968275837751367648e-23],
    [-1e-3, -3.3333346666672063494e-10, -1.3333338730160917108e-16, -5.3968275837751367648e-23],
  ],
  sinc: [
    [1e-1, 9.9833416646828152307e-1, -1.6658335317184769319e-3, 8.3313494818973480865e-7],
    [-1e-1, 9.9833416646828152307e-1, -1.6658335317184769319e-3, 8.3313494818973480865e-7],
    [1e-2, 9.9998333341666646825e-1, -1.6666583333531745756e-5, 8.3333134920910493577e-11],
    [-1e-2, 9.9998333341666646825e-1, -1.6666583333531745756e-5, 8.3333134920910493577e-11],
    [1e-3, 9.9999983333334166667e-1, -1.6666665833333353175e-7, 8.3333331349206376764e-15],
    [-1e-3, 9.9999983333334166667e-1, -1.6666665833333353175e-7, 8.3333331349206376764e-15],
  ],
};

/** a coefficient agrees when its relative error is ≤ 1e-12; an exact 0 is matched within 1e-14 absolute (the
 * recurrences sum O(1) terms, so a rounding remnant of a zero is ~1e-16 here) */
const agrees = (got: number, want: number) => (want === 0 ? Math.abs(got) <= 1e-14 : relativeError(got, want) <= 1e-12);

describe('taylor: exact identities (jets against sympy)', () => {
  it('every registry id, about x₀ = 0 (or its default) and one x₀ ≠ 0, to order 8', () => {
    const off: string[] = [];
    const seen = new Set<TfId>();
    for (const [id, a, x0, want] of SYMPY) {
      seen.add(id);
      const got = taylorCoeffs(id, x0, 8, a);
      for (let k = 0; k <= 8; k++) if (!agrees(got[k], want[k])) off.push(`${id} a=${a} x0=${x0} c${k}: ${got[k]} vs ${want[k]}`);
    }
    expect(off).toEqual([]);
    expect([...seen].sort()).toEqual([...TF_IDS].sort());
  });

  it('poly equals its own T₃ (everywhere, not only near x₀), at several x₀', () => {
    const off: string[] = [];
    for (const x0 of [0, 1, -1.5, 0.35]) {
      const T = taylorPoly(taylorCoeffs('poly', x0, 3), x0);
      const higher = taylorCoeffs('poly', x0, 8).slice(4);
      if (higher.some((c) => c !== 0)) off.push(`x0=${x0}: c4..c8 not 0`);
      for (let x = -5; x <= 5; x += 0.25) if (Math.abs(T(x) - TF.poly.f(x)) > 1e-12 * Math.max(1, Math.abs(x) ** 3)) off.push(`x0=${x0} x=${x}`);
    }
    expect(off).toEqual([]);
  });

  it('the stored lead and next terms are the first two non-zero coefficients of each jet', () => {
    const off: string[] = [];
    for (const id of LEAD_IDS) {
      const s = LEAD[id];
      const j = s.jet(8);
      const l = leadingTerm(j);
      const nx = l && leadingTerm(j, l.k + 1);
      if (!l || l.k !== s.k || relativeError(l.c, s.c) > 1e-12) off.push(`${id} lead ${JSON.stringify(l)}`);
      if (!nx || nx.k !== s.m || relativeError(nx.c, s.d) > 1e-12) off.push(`${id} next ${JSON.stringify(nx)}`);
    }
    expect(off).toEqual([]);
  });

  it('the Leibniz sums are the stored exact values (sympy: ln 2, π/4, 1/e, sin 1)', () => {
    expect(LEIBNIZ.ln2.S).toBe(Math.log(2));
    expect(LEIBNIZ.pi4.S).toBe(Math.PI / 4);
    expect(LEIBNIZ.einv.S).toBe(Math.exp(-1));
    expect(LEIBNIZ.sin1.S).toBe(Math.sin(1));
  });

  it('fractions: ratApprox finds p/q (q ≤ 10⁶) and refuses e/8!; polyText writes T_n', () => {
    expect(ratApprox(-429 / 32768)).toEqual([-429, 32768]);
    expect(ratApprox(1 / 40320)).toEqual([1, 40320]);
    expect(ratApprox(E / 40320)).toBeNull();
    expect(polyText(taylorCoeffs('cos', 0, 3), 0, 2)).toBe('1 − x²/2');
    expect(polyText(taylorCoeffs('sqrt', 4, 3), 4, 2)).toBe('2 + (x − 4)/4 − (x − 4)²/64');
    expect(polyText(taylorCoeffs('sin', Math.PI, 4), Math.PI, 3)).toBe('−(x − 3.142) + (x − 3.142)³/6');
    expect(polyText(taylorCoeffs('exp', 1, 2), 1, 1)).toBe('2.718 + 2.718(x − 1)');
    expect(polyText(taylorCoeffs('poly', 0, 4), 0, 3)).toBe('1 − 2x + x³');
  });
});

describe('taylor: analytic limits', () => {
  it('lead presets: g(x)/(c xᵏ) → 1, and |g/(c xᵏ) − 1| ≈ |d/c|·|x|^(m−k) at |x| = 10⁻², 10⁻³ (both signs)', () => {
    const off: string[] = [];
    for (const id of LEAD_IDS) {
      const s = LEAD[id];
      for (const x of [1e-2, -1e-2, 1e-3, -1e-3]) {
        const q = s.g(x) / (s.c * x ** s.k);
        const predicted = Math.abs((s.d / s.c) * Math.abs(x) ** (s.m - s.k));
        if (Math.abs(Math.abs(q - 1) - predicted) > 0.05 * predicted) off.push(`${id} x=${x}: ${q - 1} vs ${predicted}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('lead presets keep their digits near 0: g, g − c xᵏ and g − c xᵏ − d xᵐ against sympy at ±10⁻¹, ±10⁻², ±10⁻³ (≤ 1e-14 relative)', () => {
    const off: string[] = [];
    for (const id of LEAD_IDS) {
      const s = LEAD[id];
      for (const [x, g, r1, r2] of LEAD_SYMPY[id]) {
        for (const [name, got, want] of [
          ['g', s.g(x), g],
          ['rest1', s.rest(x, 1), r1],
          ['rest2', s.rest(x, 2), r2],
        ] as const) {
          if (!(relativeError(got, want) <= 1e-14)) off.push(`${id} ${name} x=${x}: ${got} vs ${want}`);
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('lead presets: just inside |x| = sr the series agrees with the closed form (no seam; ≤ 1e-14 relative)', () => {
    const closed: Record<LeadId, (x: number) => number> = {
      'sin-x': (x) => Math.sin(x) - x,
      '1-cos': (x) => 1 - Math.cos(x),
      'exp-1-x': (x) => Math.exp(x) - 1 - x,
      'ln1p-x': (x) => Math.log(1 + x) - x,
      'tan-x': (x) => Math.tan(x) - x,
      sinc: (x) => Math.sin(x) / x,
    };
    const off: string[] = [];
    for (const id of LEAD_IDS) {
      const s = LEAD[id];
      for (const x of [s.sr * (1 - 2 ** -50), -s.sr * (1 - 2 ** -50)]) {
        if (!(relativeError(s.g(x), closed[id](x)) <= 1e-14)) off.push(`${id} x=${x}: ${s.g(x)} vs ${closed[id](x)}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('radius about x₀ ≠ 0 is the distance to the nearest break (±i for arctan, 1/(1+x²))', () => {
    expect(radiusAbout('arctan', 1)).toBeCloseTo(Math.SQRT2, 14);
    expect(radiusAbout('lorentz', -2)).toBeCloseTo(Math.sqrt(5), 14);
    expect(radiusAbout('ln1p', 0.5)).toBe(1.5);
    expect(radiusAbout('geom', -1)).toBe(2);
    expect(radiusAbout('ln', 1)).toBe(1);
    expect(radiusAbout('sqrt', 4)).toBe(4);
    expect(radiusAbout('tan', 0.3)).toBeNull();
    expect(radiusOf('binom', 2)).toBe(Infinity);
    expect(radiusOf('binom', 0.5)).toBe(1);
    expect(degreeOf('binom', 3)).toBe(3);
  });
});

describe('taylor: convergence', () => {
  const withRadius = TF_IDS.filter((id) => TF[id].radius !== undefined);

  it('inside the radius the partial sums of order 60 approach f (x = R/2, or x = 2 when R = ∞; e^(sin x), whose coefficients decay slowly, is still 7e-12 off at order 60 there: 1e-10)', () => {
    const off: string[] = [];
    for (const id of withRadius) {
      const R = radiusOf(id)!;
      const x = Number.isFinite(R) ? R / 2 : 2;
      const tol = id === 'expsin' ? 1e-10 : 1e-12;
      for (const xx of [x, -x]) {
        const f = TF[id].f(xx, 0.5);
        const e60 = Math.abs(partialSum(id, 60, xx) - f);
        const e30 = Math.abs(partialSum(id, 30, xx) - f);
        if (e60 > tol * Math.max(1, Math.abs(f))) off.push(`${id} at ${xx}: ${e60}`);
        if (e30 > 1e-14 && !(e60 < e30)) off.push(`${id} at ${xx}: no progress`);
      }
    }
    expect(off).toEqual([]);
  });

  it('outside the radius they grow: |S_60 − S_40| > |S_40 − S_20| > 1 at x = 1.5R (both sides)', () => {
    const off: string[] = [];
    for (const id of withRadius) {
      const R = radiusOf(id)!;
      if (!Number.isFinite(R)) continue;
      for (const x of [1.5 * R, -1.5 * R]) {
        const [s20, s40, s60] = [20, 40, 60].map((n) => partialSum(id, n, x));
        // the odd series (tan, arctan) see only odd orders: compare 21, 41, 61 as well
        const [t21, t41, t61] = [21, 41, 61].map((n) => partialSum(id, n, x));
        const grows = (a: number, b: number, c: number) => Math.abs(c - b) > Math.abs(b - a) && Math.abs(b - a) > 1;
        if (!grows(s20, s40, s60) && !grows(t21, t41, t61)) off.push(`${id} at ${x}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('the stored ends: the terms cₙRⁿ do not tend to 0 at a divergent end of geom, lorentz, tan; they do at the convergent ones', () => {
    const off: string[] = [];
    const term = (id: TfId, x: number) => {
      const c = seriesCoeffs(id, 61);
      return Math.max(Math.abs(c[60] * x ** 60), Math.abs(c[61] * x ** 61));
    };
    for (const id of ['geom', 'lorentz', 'tan'] as TfId[]) {
      const R = radiusOf(id)!;
      if (term(id, R) < 0.5 || term(id, -R) < 0.5) off.push(`${id}: terms shrink`);
    }
    for (const id of ['ln1p', 'arctan', 'sqrt1p'] as TfId[]) if (term(id, 1) > 0.05) off.push(`${id}: terms stay`);
    expect(off).toEqual([]);
  });

  it('Leibniz: S lies between S_n and S_{n+1} and |S − S_n| ≤ b_{n+1}, for n = 1 … 2000', () => {
    const off: string[] = [];
    for (const id of LEIBNIZ_IDS) {
      const sp = LEIBNIZ[id];
      const s = leibnizSums(id);
      for (let n = 1; n <= LEIBNIZ_MAX; n++) {
        const lo = Math.min(s[n], s[n + 1]);
        const hi = Math.max(s[n], s[n + 1]);
        const slack = 4e-16 * n;
        if (sp.S < lo - slack || sp.S > hi + slack) off.push(`${id} n=${n} bracket`);
        if (Math.abs(sp.S - s[n]) > sp.b(n + 1) + slack) off.push(`${id} n=${n} bound`);
      }
    }
    expect(off.slice(0, 5)).toEqual([]);
  });

  it('the orders of the brief: b_{n+1} < 10⁻³ at n ≥ 1000 (ln 2), 500 (π/4); < 10⁻⁶ at 10 (1/e), 5 (sin 1); < 10⁻⁴ at 8 (1/e)', () => {
    expect(leibnizOrderFor('ln2', 1e-3)).toBe(1000);
    expect(leibnizOrderFor('pi4', 1e-3)).toBe(500);
    expect(leibnizOrderFor('einv', 1e-6)).toBe(10);
    expect(leibnizOrderFor('sin1', 1e-6)).toBe(5);
    expect(leibnizOrderFor('einv', 1e-4)).toBe(8);
  });
});

describe('taylor: the Lagrange bound is never below the sampled error', () => {
  it('every preset, orders 0–10, on its default interval [x₀ − δ, x₀ + δ] (clipped to the domain)', () => {
    const off: string[] = [];
    for (const id of TF_IDS) {
      const s = TF[id];
      const [lo, hi] = remainderInterval(id, s.x0, s.delta);
      for (let n = 0; n <= 10; n++) {
        const B = remainderInfo(id, s.x0, n, lo, hi).B;
        const err = sampledMaxError(id, s.x0, n, lo, hi);
        if (!(B >= err - 1e-14)) off.push(`${id} n=${n}: B=${B} err=${err}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('the exact M at an end equals the largest sampled |f⁽ⁿ⁺¹⁾| (the monotone presets, with x₀ moved and δ = 1.5)', () => {
    const off: string[] = [];
    for (const id of TF_IDS.filter((i) => TF[i].bound === 'ends' || TF[i].bound === 'poly')) {
      const s = TF[id];
      for (const x0 of [s.x0, s.x0Range![1]]) {
        const [lo, hi] = remainderInterval(id, x0, 1.5);
        for (let n = 0; n <= 6; n++) {
          const info = remainderInfo(id, x0, n, lo, hi);
          if (info.how === 'zero') continue;
          let m = 0;
          for (let i = 0; i <= 400; i++) m = Math.max(m, Math.abs(s.jet(lo + ((hi - lo) * i) / 400, n + 1)[n + 1]));
          const sampledM = m * [1, 1, 2, 6, 24, 120, 720, 5040][n + 1];
          if (sampledM > info.M * (1 + 1e-9)) off.push(`${id} x0=${x0} n=${n}: ${sampledM} > ${info.M}`);
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('sin and cos take M = 1; poly and (1 + x)³ have a zero remainder from n = 3', () => {
    expect(remainderInfo('sin', 0, 4, -1, 1)).toMatchObject({ M: 1, how: 'one', B: 1 / 120 });
    expect(remainderInfo('poly', 0, 3, -1, 1)).toMatchObject({ M: 0, how: 'zero', B: 0 });
    expect(remainderInfo('binom', 0, 3, -0.5, 0.5, 3)).toMatchObject({ M: 0, how: 'zero', B: 0 });
  });
});

describe('taylor: the band where T_n is good (a probe)', () => {
  it('cos about 0, n = 2, 1%: the band ends where |cos x − 1 + x²/2| = 0.01 (sympy: x = 0.7028123671…)', () => {
    // sympy 2026-11-27: nsolve(cos(x) - 1 + x**2/2 - Rational(1,100), x, 0.7) = 0.702812367177450 (|cos x| ≤ 1, so the
    // tolerance 0.01·max(1, |cos x|) is 0.01; the error x⁴/24 − … is positive there)
    const b = goodBand('cos', 0, 2, 0.01, [-7, 7]);
    expect(b.loBounded && b.hiBounded).toBe(true);
    expect(relativeError(b.hi, 0.70281236717745)).toBeLessThan(1e-9);
    expect(relativeError(-b.lo, 0.70281236717745)).toBeLessThan(1e-9);
  });

  it('f and T_n agree at x₀ for every preset and order (value of the jet = f(x₀))', () => {
    const off: string[] = [];
    for (const id of TF_IDS) {
      const s = TF[id];
      const c = taylorCoeffs(id, s.x0, 20);
      if (relativeError(c[0], fnOf(id)(s.x0)) > 1e-15 && Math.abs(c[0] - fnOf(id)(s.x0)) > 1e-15) off.push(id);
    }
    expect(off).toEqual([]);
  });
});
