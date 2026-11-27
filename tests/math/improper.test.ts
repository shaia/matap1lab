import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/analysis';
import {
  CMP,
  CMP_IDS,
  CMP_R_MAX,
  SPIKE,
  TAIL,
  TAIL_IDS,
  cmpF,
  cmpG,
  cmpTable,
  spikeIntegral,
  spikeLimit,
  tailIntegral,
  tailLimit,
} from '~/math/improper';
import { simpson } from '~/math/multivar';

// Every stored closed form and constant was recomputed with sympy on 2026-11-27:
//   ∫₁ᴿ x^(−p) = (R^(1−p) − 1)/(1 − p), ln R at p = 1; ∫₀ᴿ 1/(1 + x²) = arctan R; ∫₀ᴿ e^(−x) = 1 − e^(−R);
//   ∫_ε¹ x^(−p) = (1 − ε^(1−p))/(1 − p), −ln ε at p = 1; ∫₁ᴿ e^(−x) = e^(−1) − e^(−R); ∫₁ᴿ (π/2)/x² = π/2 − π/(2R);
//   ∫₁ᴿ x^(−3/2) = 2 − 2/√R; ∫₁^∞ e^(−x²) = √π(1 − erf 1)/2 = 0.139402792640331;
//   ∫₁^∞ arctan x / x² = π/4 + ln 2 / 2 = 1.131971753677421; ∫₁^∞ 1/√(x³ + 1) = 1.894759968012013 (numeric).

const PS = [0.3, 0.5, 0.75, 0.95, 1, 1.05, 1.5, 2, 3];

/** ∫ₐᴿ f by Simpson after the substitution x = a + eᵘ − 1 (dx = eᵘ du), which spreads the panels where f varies
 * fast (near a) and thins them where it is flat: an accurate reference for the slowly decaying integrands here */
const refInt = (f: (x: number) => number, a: number, R: number, n = 20000) =>
  simpson((u) => f(a + Math.expm1(u)) * Math.exp(u), 0, Math.log1p(R - a), n);

describe('exact identities: the closed forms of the running integrals equal Simpson of f', () => {
  it('TAIL: ∫ₐᴿ f against Simpson for several R and p', () => {
    const off: string[] = [];
    for (const id of TAIL_IDS) {
      const s = TAIL[id];
      for (const p of s.usesP ? PS : [1])
        for (const R of [1.5, 3, 12, 50]) {
          const sim = refInt((x) => s.f(x, p), s.a, R);
          const ex = tailIntegral(id, R, p);
          if (relativeError(ex, sim) > 1e-9) off.push(`${id} p=${p} R=${R}: ${ex} vs ${sim}`);
        }
    }
    expect(off).toEqual([]);
  });

  it('SPIKE: ∫_ε¹ 1/xᵖ against Simpson on [ε, 1] for several ε and p (log-substituted, x = eᵘ)', () => {
    const off: string[] = [];
    const s = SPIKE.pow;
    for (const p of PS)
      for (const eps of [0.5, 0.1, 1e-2, 1e-4]) {
        // ∫_ε¹ x^(−p) dx = ∫_(ln ε)^0 e^((1−p)u) du: smooth, so Simpson is accurate even for small ε
        const sim = simpson((u) => s.f(Math.exp(u), p) * Math.exp(u), Math.log(eps), 0, 4000);
        const ex = spikeIntegral('pow', eps, p);
        if (relativeError(ex, sim) > 1e-9) off.push(`p=${p} ε=${eps}: ${ex} vs ${sim}`);
      }
    expect(off).toEqual([]);
  });

  it('the p = 1 branch is continuous: the closed form at p = 1 ± δ tends to ln R (tail) and −ln ε (spike)', () => {
    const off: string[] = [];
    for (const d of [1e-3, 1e-6, 1e-9, 1e-13]) {
      for (const R of [2, 100, 1e4]) {
        for (const p of [1 - d, 1 + d]) {
          const v = tailIntegral('pow', R, p);
          if (relativeError(v, Math.log(R)) > 10 * d * Math.log(R) + 1e-12) off.push(`tail p=${p} R=${R}: ${v}`);
        }
      }
      for (const eps of [0.5, 1e-3, 1e-6]) {
        for (const p of [1 - d, 1 + d]) {
          const v = spikeIntegral('pow', eps, p);
          if (relativeError(v, -Math.log(eps)) > 10 * d * Math.abs(Math.log(eps)) + 1e-12) off.push(`spike p=${p} ε=${eps}: ${v}`);
        }
      }
    }
    expect(off).toEqual([]);
    expect(tailIntegral('pow', 100, 1)).toBe(Math.log(100));
    expect(spikeIntegral('pow', 0.01, 1)).toBe(-Math.log(0.01));
  });

  it('the closed forms of the CMP references: ∫₁ᴿ g against Simpson of g', () => {
    const off: string[] = [];
    for (const id of CMP_IDS)
      for (const R of [1.5, 4, 30, 400]) {
        const sim = refInt(CMP[id].g, 1, R);
        if (relativeError(cmpG(id, R), sim) > 1e-9) off.push(`${id} R=${R}: ${cmpG(id, R)} vs ${sim}`);
      }
    expect(off).toEqual([]);
  });
});

describe('analytic limits: the closed forms tend to the stated limits', () => {
  it('the standard values: ∫₁^∞ 1/x² = 1, ∫₁^∞ x^(−3) = 1/2, ∫₀^∞ 1/(1 + x²) = π/2, ∫₀^∞ e^(−x) = 1, ∫₀¹ 1/√x = 2', () => {
    expect(tailLimit('pow', 2)).toBe(1);
    expect(tailLimit('pow', 3)).toBe(0.5);
    expect(tailLimit('lorentz', 1)).toBe(Math.PI / 2);
    expect(tailLimit('exp', 1)).toBe(1);
    expect(spikeLimit('pow', 0.5)).toBe(2);
    expect(tailLimit('pow', 1)).toBe(Infinity);
    expect(tailLimit('pow', 0.5)).toBe(Infinity);
    expect(spikeLimit('pow', 1)).toBe(Infinity);
    expect(spikeLimit('pow', 2)).toBe(Infinity);
  });

  it('every finite limit is approached: |I(R) − L| shrinks as R grows and is small at R = 10⁸ (tail) / ε = 10⁻¹² (spike)', () => {
    const off: string[] = [];
    for (const id of TAIL_IDS)
      for (const p of TAIL[id].usesP ? PS : [1]) {
        const L = tailLimit(id, p);
        if (!Number.isFinite(L)) continue;
        const gaps = [1e2, 1e4, 1e6, 1e8].map((R) => Math.abs(tailIntegral(id, R, p) - L));
        for (let k = 1; k < gaps.length; k++) if (!(gaps[k] < gaps[k - 1] || gaps[k] === 0)) off.push(`${id} p=${p}: gap not shrinking ${gaps}`);
        // the gap is the tail ∫_R^∞ f: R^(1−p)/(p − 1) for pow, < 1/R for lorentz, e^(−R) for exp
        const want = id === 'pow' ? 1e8 ** (1 - p) / (p - 1) : 1e-8;
        if (gaps[3] > want * (1 + 1e-6) + 1e-15) off.push(`${id} p=${p}: gap ${gaps[3]} > ${want}`);
      }
    for (const p of PS) {
      const L = spikeLimit('pow', p);
      if (!Number.isFinite(L)) continue;
      const gaps = [1e-2, 1e-4, 1e-8, 1e-12].map((e) => Math.abs(spikeIntegral('pow', e, p) - L));
      for (let k = 1; k < gaps.length; k++) if (!(gaps[k] < gaps[k - 1])) off.push(`spike p=${p}: gap not shrinking`);
      // the gap is ∫₀^ε x^(−p) = ε^(1−p)/(1 − p)
      if (Math.abs(gaps[3] - 1e-12 ** (1 - p) / (1 - p)) > 1e-9 * L) off.push(`spike p=${p}: gap ${gaps[3]}`);
    }
    expect(off).toEqual([]);
  });

  it('∫₁ᴿ 1/xᵖ grows without bound for p ≤ 1: increasing in R and above any bound M at R = M^(1/(1−p)) (ln R > M at R = e^M)', () => {
    const off: string[] = [];
    for (const p of [0.3, 0.5, 0.75, 0.95, 1]) {
      let prev = 0;
      for (const R of [2, 10, 1e2, 1e3, 1e4, 1e6, 1e9]) {
        const v = tailIntegral('pow', R, p);
        if (!(v > prev)) off.push(`p=${p} R=${R}: not increasing`);
        prev = v;
      }
      for (const M of [10, 100, 1000]) {
        const R = p === 1 ? Math.exp(M + 1) : (M * (1 - p) + 2) ** (1 / (1 - p));
        if (!(tailIntegral('pow', R, p) > M)) off.push(`p=${p}: I(${R}) ≤ ${M}`);
      }
    }
    // and the spike for p ≥ 1 grows as ε shrinks
    for (const p of [1, 1.5, 2, 3]) {
      let prev = 0;
      for (const e of [0.5, 0.1, 1e-2, 1e-4, 1e-6]) {
        const v = spikeIntegral('pow', e, p);
        if (!(v > prev)) off.push(`spike p=${p} ε=${e}: not increasing`);
        prev = v;
      }
    }
    expect(off).toEqual([]);
  });
});

describe('comparison: the stored relations, the tables and the limits', () => {
  it('f ≤ g on [1, 1000] for the converging presets and f ≥ g for div (a grid check of the stored relation)', () => {
    const off: string[] = [];
    for (const id of CMP_IDS) {
      const s = CMP[id];
      for (let i = 0; i <= 4000; i++) {
        const x = 1 + (999 * i) / 4000;
        const d = s.f(x) - s.g(x);
        if (s.relation === 'le' ? d > 1e-15 : d < -1e-15) off.push(`${id} x=${x}: f − g = ${d}`);
      }
      if ((s.relation === 'le') !== (s.verdict === 'converges')) off.push(`${id}: relation and verdict disagree`);
      if ((s.verdict === 'converges') !== Number.isFinite(s.gLimit)) off.push(`${id}: verdict and ∫g disagree`);
    }
    expect(off).toEqual([]);
  });

  it('the f tables start at 0, never decrease in R (f > 0; past x ≈ 6 the increments of e^(−x²) fall below the rounding of the sum) and stay below the limit of ∫g', () => {
    const off: string[] = [];
    for (const id of CMP_IDS) {
      const t = cmpTable(id);
      if (t[0] !== 0) off.push(`${id}: table starts at ${t[0]}`);
      for (let i = 1; i < t.length; i++) if (!(t[i] >= t[i - 1])) off.push(`${id}: decreasing at ${i}`);
      if (!(t[100] > t[50] && t[t.length - 1] > t[100])) off.push(`${id}: not growing`);
      const s = CMP[id];
      if (Number.isFinite(s.gLimit) && !(t[t.length - 1] < s.gLimit)) off.push(`${id}: table end ${t[t.length - 1]} ≥ ${s.gLimit}`);
      for (const R of [1.5, 10, 100, 999.97, 1000]) if (s.relation === 'le' ? cmpF(id, R) > cmpG(id, R) : cmpF(id, R) < cmpG(id, R)) off.push(`${id} R=${R}: ∫f vs ∫g order`);
    }
    expect(off).toEqual([]);
  });

  it('cmpF between grid points equals Simpson of f on [1, R]', () => {
    const off: string[] = [];
    for (const id of CMP_IDS)
      for (const R of [1, 1.013, 2.718, 17.3, 333.333, 1000]) {
        // div oscillates (sin x): plain Simpson with h ≈ 0.005; the others decay: the substituted reference
        const sim = R === 1 ? 0 : id === 'div' ? simpson(CMP[id].f, 1, R, 2 * Math.ceil((R - 1) * 100) + 2) : refInt(CMP[id].f, 1, R);
        if (Math.abs(cmpF(id, R) - sim) > 1e-8 * Math.max(1, Math.abs(sim))) off.push(`${id} R=${R}: ${cmpF(id, R)} vs ${sim}`);
      }
    expect(off).toEqual([]);
  });

  it('the stored limits ∫₁^∞ f match the integral mapped onto (0, 1] (relative 1e−9), and the table at 1000 plus the tail (relative 1e−6)', () => {
    // exp2: x = 1/t, ∫₀¹ e^(−1/t²)/t² dt; atan: x = 1/t, ∫₀¹ arctan(1/t) dt (π/2 at t = 0);
    // root: x = s^(−2), ∫₀¹ 2/√(1 + s⁶) ds
    const mapped: Record<string, (t: number) => number> = {
      exp2: (t) => (t === 0 ? 0 : Math.exp(-1 / (t * t)) / (t * t)),
      atan: (t) => (t === 0 ? Math.PI / 2 : Math.atan(1 / t)),
      root: (s) => 2 / Math.sqrt(1 + s ** 6),
    };
    // ∫_1000^∞ f: exp2 below e^(−10⁶) (0); atan = π/2000 − ∫₀^(1/1000) arctan u du; root ≈ 2/√1000 (relative 5e−10)
    const u = 1e-3;
    const tail: Record<string, number> = {
      exp2: 0,
      atan: Math.PI / 2000 - (u * Math.atan(u) - 0.5 * Math.log1p(u * u)),
      root: 2 / Math.sqrt(1000),
    };
    const off: string[] = [];
    for (const id of ['exp2', 'atan', 'root'] as const) {
      const L = CMP[id].fLimit as number;
      const m = simpson(mapped[id], 0, 1, 4000);
      if (relativeError(m, L) > 1e-9) off.push(`${id}: mapped ${m} vs stored ${L}`);
      const t = cmpF(id, CMP_R_MAX) + tail[id];
      if (relativeError(t, L) > 1e-6) off.push(`${id}: table + tail ${t} vs ${L}`);
    }
    expect(off).toEqual([]);
    expect(CMP.div.fLimit).toBeNull();
    expect(CMP.atan.fLimit).toBeCloseTo(Math.PI / 4 + Math.log(2) / 2, 14);
  });

  it('div: ∫₁ᴿ f ≥ ln R and keeps growing; it equals 2 ln R + Si(R) − Si(1) (Si by Simpson)', () => {
    const Si = (x: number) => simpson((t) => (t === 0 ? 1 : Math.sin(t) / t), 0, x, 2 * Math.ceil(x * 100) + 2);
    const off: string[] = [];
    let prev = 0;
    for (const R of [2, 10, 100, 500, 1000]) {
      const v = cmpF('div', R);
      if (!(v >= Math.log(R))) off.push(`R=${R}: ${v} < ln R`);
      if (!(v > prev)) off.push(`R=${R}: not growing`);
      prev = v;
      const ex = 2 * Math.log(R) + Si(R) - Si(1);
      if (relativeError(v, ex) > 1e-8) off.push(`R=${R}: ${v} vs ${ex}`);
    }
    expect(off).toEqual([]);
  });
});
