import { describe, expect, it } from 'vitest';
import { centralDiff, relativeError } from '~/math/analysis';
import {
  FIT_IDS,
  PF,
  PF_IDS,
  coverUp,
  dominantTerm,
  evalR,
  evalSum,
  evalTerm,
  fitAttempt,
  fitExact,
  fitResidual,
  fitTarget,
  fitWrong,
  polesOfR,
  polesOfTerms,
  termAnti,
  type PFId,
} from '~/math/partialfrac';

// Every decomposition was recomputed with sympy `apart` on 2026-11-27 (screens/tools/ch7_presets.py):
// notes −2/(x−1) + 5/(x−2); two (1/2)/(x−1) − (1/2)/(x+1); three −(1/2)/x + (2/3)/(x−1) + (5/6)/(x+2);
// repeated 1/(x−1) + 3/(x−1)²; quad 1/x − x/(x²+1) (antiderivative ln|x| − ln(x²+1)/2); improper x + (1/2)/(x−1) + (1/2)/(x+1);
// fitA 2/(x−1) − 1/(x+2).

/** grid points of the plot window at least `gap` from every pole of R */
function grid(id: PFId, n = 241, gap = 0.05): number[] {
  const s = PF[id];
  const [lo, hi] = s.window.x;
  const poles = polesOfR(id);
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const x = lo + ((hi - lo) * i) / n;
    if (poles.every((a) => Math.abs(x - a) >= gap)) out.push(x);
  }
  return out;
}
const ALL = (id: PFId) => PF[id].terms.map((_, i) => i);

describe('exact identities: the decomposition', () => {
  it('the terms sum to R on a grid away from the poles, for every preset (relative error 1e-12)', () => {
    const off: string[] = [];
    for (const id of PF_IDS) {
      for (const x of grid(id)) {
        const r = evalR(id, x);
        const s = evalSum(id, ALL(id), x);
        if (!(relativeError(s, r) <= 1e-12 || Math.abs(s - r) <= 1e-12)) off.push(`${id} x=${x}: R=${r} sum=${s}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('R equals the closed forms written out by hand at x = 3 and x = −0.5', () => {
    const closed: Record<PFId, (x: number) => number> = {
      notes: (x) => (3 * x - 1) / ((x - 1) * (x - 2)),
      two: (x) => 1 / (x * x - 1),
      three: (x) => (x * x + 1) / (x * (x - 1) * (x + 2)),
      repeated: (x) => (x + 2) / ((x - 1) * (x - 1)),
      quad: (x) => 1 / (x * (x * x + 1)),
      improper: (x) => x ** 3 / (x * x - 1),
      fitA: (x) => (x + 5) / ((x - 1) * (x + 2)),
    };
    const off: string[] = [];
    for (const id of PF_IDS) for (const x of [3, -0.5, 2.25]) if (relativeError(evalR(id, x), closed[id](x)) > 1e-13) off.push(`${id} x=${x}`);
    expect(off).toEqual([]);
  });

  it('the coefficient of each simple linear term is the cover-up value at its pole (derived independently of the stored fractions)', () => {
    const off: string[] = [];
    for (const id of PF_IDS) {
      PF[id].poles.forEach((p, j) => {
        const v = coverUp(id, j, p.a);
        if (relativeError(v, p.coef) > 1e-13) off.push(`${id} pole ${p.a}: coverUp ${v} vs stored ${p.coef}`);
      });
    }
    expect(off).toEqual([]);
  });

  it('an antiderivative of each term differentiates back to the term (centralDiff, away from the poles)', () => {
    const off: string[] = [];
    for (const id of PF_IDS) {
      PF[id].terms.forEach((_t, i) => {
        for (const x of grid(id, 60, 0.3)) {
          const d = centralDiff((u) => termAnti(id, i, u), x);
          const e = evalTerm(id, i, x);
          if (Math.abs(d - e) > 1e-7 * Math.max(1, Math.abs(e))) off.push(`${id} term ${i} x=${x}: ${d} vs ${e}`);
        }
      });
    }
    expect(off).toEqual([]);
  });

  it('the registry is consistent: a quadratic term has no real pole, the improper preset has a polynomial part, poles list in term order', () => {
    const off: string[] = [];
    for (const id of PF_IDS) {
      const s = PF[id];
      if (s.terms.some((t) => t.kind === 'quad') && polesOfTerms(id, ALL(id)).length !== s.poles.length) off.push(`${id}: quad pole bookkeeping`);
      if (s.improper !== s.terms.some((t) => t.kind === 'poly')) off.push(`${id}: improper vs polynomial part`);
      for (const p of s.poles) {
        const t = s.terms[p.termIndex];
        if (t.kind !== 'lin' || t.a !== p.a || t.k !== p.order) off.push(`${id}: pole ${p.a} points at the wrong term`);
      }
      if (!s.tex || !s.text || s.terms.some((t) => !t.tex || !t.antiTex || !t.text)) off.push(`${id}: missing tex`);
    }
    expect(off).toEqual([]);
  });

  it('the stored TeX of the antiderivatives is the one in the brief', () => {
    expect(PF.quad.terms[1].antiTex).toBe('-\\frac{1}{2}\\ln(x^{2} + 1)');
    expect(PF.notes.terms[0].antiTex).toBe('-2\\ln|x - 1|');
    expect(PF.two.terms[0].antiTex).toBe('\\frac{1}{2}\\ln|x - 1|');
    expect(PF.repeated.terms[1].antiTex).toBe('-\\frac{3}{x - 1}');
    expect(PF.improper.terms[0].antiTex).toBe('\\frac{x^{2}}{2}');
  });
});

describe('analytic limits: the cover-up value tends to the coefficient', () => {
  it('(x − a)ᵏ·R(x) → the top coefficient as x → a, from both sides, with the error shrinking linearly in h', () => {
    const off: string[] = [];
    for (const id of PF_IDS) {
      PF[id].poles.forEach((p, j) => {
        for (const side of [-1, 1]) {
          const err = (h: number) => Math.abs(coverUp(id, j, p.a + side * h) - p.coef);
          const e2 = err(1e-2);
          const e3 = err(1e-3);
          const e4 = err(1e-4);
          // exact up to O(h): each tenfold step cuts the error at least fivefold (or it is already 0 to rounding)
          if (!(e3 <= e2 / 5 + 1e-13 && e4 <= e3 / 5 + 1e-12)) off.push(`${id} pole ${p.a} side ${side}: ${e2}, ${e3}, ${e4}`);
          if (e4 > 1e-2) off.push(`${id} pole ${p.a} side ${side}: not close at h = 1e-4 (${e4})`);
        }
      });
    }
    expect(off).toEqual([]);
  });

  it('near a pole the term carrying it dominates (distance 1e-3), and R itself blows up like coef/(x − a)ᵏ', () => {
    const off: string[] = [];
    for (const id of PF_IDS) {
      for (const p of PF[id].poles) {
        const x = p.a + 1e-3;
        if (dominantTerm(id, ALL(id), x) !== p.termIndex) off.push(`${id} pole ${p.a}: dominant term ${dominantTerm(id, ALL(id), x)}`);
        const ratio = evalR(id, x) / (p.coef / (x - p.a) ** p.order);
        if (Math.abs(ratio - 1) > 0.05) off.push(`${id} pole ${p.a}: R / leading part = ${ratio}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('improper: R(x) − x → 0 like 1/x; it is below 0.1 only from |x| ≈ 10.1 on (the window is ±12)', () => {
    const d = (x: number) => Math.abs(evalR('improper', x) - x);
    expect(d(6)).toBeGreaterThan(0.1);
    expect(d(10.2)).toBeLessThan(0.1);
    expect(d(-10.2)).toBeLessThan(0.1);
    expect(d(12)).toBeLessThan(0.1);
    expect(relativeError(d(100), 100 / (100 * 100 - 1))).toBeLessThan(1e-12);
  });

  it('a pole is not defined: R and the terms of that pole are NaN there, coverUp is not', () => {
    const off: string[] = [];
    for (const id of PF_IDS) {
      PF[id].poles.forEach((p, j) => {
        if (!Number.isNaN(evalR(id, p.a))) off.push(`${id}: R(${p.a}) defined`);
        if (!Number.isNaN(evalTerm(id, p.termIndex, p.a))) off.push(`${id}: term defined at its pole`);
        if (!Number.isFinite(coverUp(id, j, p.a))) off.push(`${id}: coverUp not finite at ${p.a}`);
      });
    }
    expect(off).toEqual([]);
  });
});

describe('the fit residual vanishes exactly at the right coefficients', () => {
  it('fit presets are two, fitA and notes, with the exact A and B of the decomposition', () => {
    expect(FIT_IDS).toEqual(['two', 'fitA', 'notes']);
    expect(fitTarget('two')).toEqual({ A: 0.5, B: -0.5 });
    expect(fitTarget('fitA')).toEqual({ A: 2, B: -1 });
    expect(fitTarget('notes')).toEqual({ A: -2, B: 5 });
  });

  it('the residual is 0 at the exact A and B, and equals R − attempt for any A and B (grid, away from the poles)', () => {
    const off: string[] = [];
    for (const id of FIT_IDS) {
      const { A, B } = fitTarget(id);
      for (const x of grid(id)) {
        if (fitResidual(id, A, B, x) !== 0) off.push(`${id} x=${x}: residual at the exact values is not 0`);
        for (const [a, b] of [
          [0, 0],
          [A + 0.05, B],
          [A, B - 1.5],
          [3.35, -4.2],
        ] as const) {
          const direct = evalR(id, x) - fitAttempt(id, a, b, x);
          const closed = fitResidual(id, a, b, x);
          if (Math.abs(direct - closed) > 1e-9 * Math.max(1, Math.abs(direct))) off.push(`${id} A=${a} B=${b} x=${x}: ${direct} vs ${closed}`);
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('a wrong coefficient leaves a residual that is not 0 and blows up at its own pole only', () => {
    const off: string[] = [];
    for (const id of FIT_IDS) {
      const { A, B } = fitTarget(id);
      const f = PF[id].fit!;
      const bigAt = (a: number, b: number, x: number) => Math.abs(fitResidual(id, a, b, x)) > 1e3;
      // A off by 0.05: large near a, small near b
      if (!bigAt(A + 0.05, B, f.a + 1e-6)) off.push(`${id}: A wrong does not blow up at a`);
      if (bigAt(A + 0.05, B, f.b + 1e-6)) off.push(`${id}: A wrong blows up at b`);
      if (!bigAt(A, B - 0.05, f.b + 1e-6)) off.push(`${id}: B wrong does not blow up at b`);
      if (bigAt(A, B - 0.05, f.a + 1e-6)) off.push(`${id}: B wrong blows up at a`);
      const wrong = fitWrong(id, A + 0.05, B);
      if (!(wrong[0] && !wrong[1])) off.push(`${id}: fitWrong flags ${wrong}`);
      if (fitExact(id, A + 0.05, B) || fitExact(id, A, B + 0.05) || !fitExact(id, A, B) || !fitExact(id, A + 1e-12, B - 1e-12)) off.push(`${id}: fitExact`);
      // a slider step of 0.05 away from exact is never exact
      for (const dA of [-0.05, 0.05]) if (fitExact(id, Number((A + dA).toPrecision(10)), B)) off.push(`${id}: step off counts as exact`);
    }
    expect(off).toEqual([]);
  });

  it('the exact values lie on the 0.05 slider grid of [−6, 6]', () => {
    const off: string[] = [];
    for (const id of FIT_IDS) {
      const { A, B } = fitTarget(id);
      for (const v of [A, B]) if (Math.abs(v) > 6 || Math.abs(v / 0.05 - Math.round(v / 0.05)) > 1e-9) off.push(`${id}: ${v} is off the slider grid`);
    }
    expect(off).toEqual([]);
  });
});
