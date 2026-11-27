import { describe, expect, it } from 'vitest';
import { centralDiff, relativeError } from '~/math/analysis';
import {
  AD,
  AD_IDS,
  CHK,
  CHK_IDS,
  FAMILY_IDS,
  areaFn,
  candPieces,
  diffOf,
  nearestZero,
  pieceIndex,
  signedParts,
  stripArea,
  type ChkId,
  type Piece,
} from '~/math/antideriv';
import { simpson } from '~/math/multivar';

// Every stored closed form was recomputed with sympy on 2026-11-27 (screens/tools/ch7_presets.py and cas.py):
// (x³ − 2x)′ = 3x² − 2; (ln|x|)′ = 1/x; (arctan x)′ = 1/(1 + x²); candidate derivatives
//   (sin x − x cos x)′ = x sin x; (−(x²/2)cos x)′ = (x²/2) sin x − x cos x; (x cos x − sin x)′ = −x sin x;
//   (−2 sin x cos x)′ = 2 sin²x − 2 cos²x; (√(1 − x²))′ = −x/√(1 − x²); (ln(1 + x²))′ = 2x/(1 + x²);
//   (ln|x² − 1|)′ = 2x/(x² − 1); (½ ln|(x − 1)/(x + 1)|)′ = 1/(x² − 1); (−arctan(1/x))′ = 1/(1 + x²).
// Constants between correct candidates: arcsin x + arccos x = π/2; arctan x + arctan(1/x) = ±π/2 (sign of x);
//   sin²x + cos²x = 1; sin²x + cos(2x)/2 = 1/2; −cos²x + cos(2x)/2 = −1/2.
// ∫₀¹ e^(−x²) dx = 0.746824132812427 (sympy).

/** |num − exact| ≤ tol·max(1, |exact|): relative, with an absolute floor where the exact value crosses 0 */
const near = (num: number, exact: number, tol: number) => Math.abs(num - exact) <= tol * Math.max(1, Math.abs(exact));

/** n+1 points of [lo, hi] (clipped to the window) at least `gap` from the piece ends, strictly inside the piece */
function grid(piece: Piece, win: readonly [number, number], n = 40, gap = 0.08): number[] {
  const lo = Math.max(piece[0], win[0]) + (piece[0] > win[0] ? gap : 0);
  const hi = Math.min(piece[1], win[1]) - (piece[1] < win[1] ? gap : 0);
  const out: number[] = [];
  for (let i = 0; i <= n; i++) out.push(lo + ((hi - lo) * i) / n);
  return out;
}

describe('exact identities: the stored antiderivative F has F′ = f on every piece', () => {
  it('centralDiff(F) equals f on a grid of every piece of every closed-form preset', () => {
    const off: string[] = [];
    for (const id of AD_IDS) {
      const s = AD[id];
      if (!s.exact) continue;
      for (const piece of s.pieces)
        for (const x of grid(piece, s.window.x)) {
          const d = centralDiff(s.F, x);
          if (!near(d, s.f(x), 1e-6)) off.push(`${id} x=${x.toFixed(3)}: F′=${d} f=${s.f(x)}`);
        }
    }
    expect(off).toEqual([]);
  });

  it('the pieces of every preset cover the window except the listed breaks', () => {
    const off: string[] = [];
    for (const id of AD_IDS) {
      const s = AD[id];
      const [lo, hi] = s.window.x;
      if (pieceIndex(s.pieces, (lo + hi) / 2 + 0.013) < 0) off.push(`${id}: middle of the window in no piece`);
      if (!(s.probe > lo && s.probe < hi)) off.push(`${id}: probe outside window`);
      if (pieceIndex(s.pieces, s.probe) < 0 || pieceIndex(s.pieces, s.a0) < 0 || pieceIndex(s.pieces, s.x0) < 0) off.push(`${id}: default handle in a break`);
      if (pieceIndex(s.pieces, s.a0) !== pieceIndex(s.pieces, s.x0)) off.push(`${id}: default a and x in different pieces`);
    }
    expect(off).toEqual([]);
  });

  it('the family presets are the closed-form presets, gauss is not among them', () => {
    expect([...FAMILY_IDS]).toEqual(AD_IDS.filter((i) => i !== 'gauss'));
    expect(AD.gauss.exact).toBe(false);
    expect(AD.gauss.Ftex).toBeNull();
  });

  it('areaFn equals Simpson of f for every preset on a grid of a, x in one piece', () => {
    const off: string[] = [];
    for (const id of AD_IDS) {
      const s = AD[id];
      for (const piece of s.pieces) {
        const g = grid(piece, s.window.x, 6, 0.3);
        for (const a of g)
          for (const x of g) {
            if (a === x) continue;
            const exact = areaFn(id, a, x);
            const sim = simpson(s.f, a, x, 4000);
            if (relativeError(exact, sim) > 1e-8 && Math.abs(exact - sim) > 1e-10) off.push(`${id} ${a.toFixed(2)}→${x.toFixed(2)}: ${exact} vs ${sim}`);
          }
      }
    }
    expect(off).toEqual([]);
  });

  it('signedParts: pos − neg = areaFn for x ≥ a, and the zeros split the interval where f changes sign', () => {
    const off: string[] = [];
    for (const id of AD_IDS) {
      const s = AD[id];
      for (const piece of s.pieces) {
        const g = grid(piece, s.window.x, 12, 0.3);
        for (const a of g)
          for (const x of g) {
            if (x < a) continue;
            const { pos, neg } = signedParts(id, a, x);
            if (pos < -1e-12 || neg < -1e-12) off.push(`${id} ${a}→${x}: negative part`);
            if (!near(pos - neg, areaFn(id, a, x), 1e-9)) off.push(`${id} ${a.toFixed(2)}→${x.toFixed(2)}: pos − neg ≠ A`);
            // the parts against Simpson of |f| and of f on the sign pieces
            const abs = simpson((t) => Math.abs(s.f(t)), a, x, 4000);
            if (x > a && !near(pos + neg, abs, 1e-6)) off.push(`${id} ${a.toFixed(2)}→${x.toFixed(2)}: pos + neg ≠ ∫|f|`);
          }
      }
    }
    expect(off).toEqual([]);
  });

  it('the listed zeros of f are zeros and f changes sign there', () => {
    const off: string[] = [];
    for (const id of AD_IDS) {
      const s = AD[id];
      for (const z of s.zeros(s.window.x[0], s.window.x[1])) {
        if (Math.abs(s.f(z)) > 1e-12) off.push(`${id}: f(${z}) = ${s.f(z)}`);
        if (s.f(z - 1e-3) * s.f(z + 1e-3) >= 0) off.push(`${id}: no sign change at ${z}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('areas of the known cases: ∫₀^π sin = 2, ∫₀^(π/2) cos = 1, ∫₋₁¹ (3x² − 2) = −2, ∫₁^e 1/x = 1 and the parts of sin on [0, 2π]', () => {
    expect(areaFn('sin', 0, Math.PI)).toBeCloseTo(2, 12);
    expect(areaFn('cos', 0, Math.PI / 2)).toBeCloseTo(1, 12);
    expect(areaFn('poly', -1, 1)).toBeCloseTo(-2, 12);
    expect(areaFn('recip', 1, Math.E)).toBeCloseTo(1, 12);
    const p = signedParts('sin', 0, 2 * Math.PI);
    expect(p.pos).toBeCloseTo(2, 12);
    expect(p.neg).toBeCloseTo(2, 12);
    expect(areaFn('lorentz', -1, 1)).toBeCloseTo(Math.PI / 2, 12);
  });

  it('a break of the domain gives NaN, never a number: 1/x from −1 to 1', () => {
    expect(areaFn('recip', -1, 1)).toBeNaN();
    expect(areaFn('recip', 0, 1)).toBeNaN();
    expect(signedParts('recip', -2, 2).pos).toBeNaN();
    expect(stripArea('recip', -0.01, 0.02)).toBeNaN();
    expect(areaFn('recip', 1, 3)).toBeCloseTo(Math.log(3), 12);
    expect(areaFn('recip', -3, -1)).toBeCloseTo(-Math.log(3), 12);
  });
});

describe('analytic limits: strip area / dx → f(x) as dx → 0', () => {
  it('the ratio is within |f′(x)|·dx/2 + O(dx²) of f(x) and the error shrinks with dx, for every preset', () => {
    const off: string[] = [];
    for (const id of AD_IDS) {
      const s = AD[id];
      for (const piece of s.pieces)
        for (const x of grid(piece, s.window.x, 8, 0.4)) {
          const err = (dx: number) => Math.abs(stripArea(id, x, dx) / dx - s.f(x));
          const dxs = [0.5, 0.1, 0.02, 0.005];
          const errs = dxs.map(err);
          const f1 = Math.abs(centralDiff(s.f, x));
          // each error is bounded by |f′|·dx/2 plus a second-order term (f″ ≲ 20 on these windows)
          dxs.forEach((dx, k) => {
            if (errs[k] > (f1 * dx) / 2 + 20 * dx * dx) off.push(`${id} x=${x.toFixed(2)} dx=${dx}: error ${errs[k]}`);
          });
          if (errs[3] > 0.1 * Math.abs(s.f(x)) + 0.02) off.push(`${id} x=${x.toFixed(2)}: ratio at dx = 0.005 off by ${errs[3]}`);
        }
    }
    expect(off).toEqual([]);
  });

  it('the area function A(x) = ∫ₐˣ f has derivative f(x) (exact F and the gauss probe)', () => {
    const off: string[] = [];
    for (const id of AD_IDS) {
      const s = AD[id];
      for (const piece of s.pieces) {
        const g = grid(piece, s.window.x, 6, 0.5);
        const a = g[1];
        for (const x of g) {
          const d = centralDiff((t) => areaFn(id, a, t), x, 1e-4);
          if (!near(d, s.f(x), 1e-6)) off.push(`${id} x=${x.toFixed(2)}: A′=${d} f=${s.f(x)}`);
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('nearestZero finds the zero of f nearest to x', () => {
    expect(nearestZero('sin', 3)!.z).toBeCloseTo(Math.PI, 12);
    expect(nearestZero('cos', 1.5)!.z).toBeCloseTo(Math.PI / 2, 12);
    expect(nearestZero('poly', 0.9)!.z).toBeCloseTo(Math.sqrt(2 / 3), 12);
    expect(nearestZero('exp', 0)).toBeNull();
  });
});

describe('gauss: the area function against a known value', () => {
  it('∫₀¹ e^(−x²) dx = 0.746824132812427 (sympy)', () => {
    expect(areaFn('gauss', 0, 1)).toBeCloseTo(0.746824132812427, 10);
  });
  it('∫₋₃³ e^(−x²) dx = √π·erf(3) = 1.772414696519042 (sympy), and A is odd about a = 0', () => {
    expect(areaFn('gauss', -3, 3)).toBeCloseTo(1.772414696519042, 9);
    const off: string[] = [];
    for (let x = 0.2; x <= 3; x += 0.2) if (Math.abs(areaFn('gauss', 0, x) + areaFn('gauss', 0, -x)) > 1e-12) off.push(`x=${x}`);
    expect(off).toEqual([]);
  });
});

describe('exact identities: the check registry', () => {
  const pairs = (id: ChkId) => CHK[id].cands.map((c, k) => ({ c, k }));

  it('every stored dG equals centralDiff of its G on a grid of the candidate pieces', () => {
    const off: string[] = [];
    for (const id of CHK_IDS) {
      const s = CHK[id];
      for (const { c, k } of pairs(id))
        for (const piece of candPieces(id, k))
          for (const x of grid(piece, s.window.x, 30, 0.1)) {
            const d = centralDiff(c.G, x, 1e-6);
            if (!near(d, c.dG(x), 1e-5)) off.push(`${id}[${k}] x=${x.toFixed(3)}: G′=${d} dG=${c.dG(x)}`);
          }
    }
    expect(off).toEqual([]);
  });

  it('a correct candidate has dG = f on every piece, a wrong one has dG ≠ f somewhere', () => {
    const off: string[] = [];
    for (const id of CHK_IDS) {
      const s = CHK[id];
      for (const { c, k } of pairs(id)) {
        let worst = 0;
        for (const piece of s.pieces) for (const x of grid(piece, s.window.x, 40, 0.1)) worst = Math.max(worst, Math.abs(c.dG(x) - s.f(x)) / Math.max(1, Math.abs(s.f(x))));
        if (c.correct && worst > 1e-12) off.push(`${id}[${k}] marked correct but dG − f = ${worst}`);
        if (!c.correct && worst < 1e-3) off.push(`${id}[${k}] marked wrong but dG = f`);
        if (!c.correct && !c.why) off.push(`${id}[${k}] wrong without a slip`);
        if (c.correct && c.why) off.push(`${id}[${k}] correct with a slip`);
      }
    }
    expect(off).toEqual([]);
  });

  it('every preset has at least one correct and one wrong candidate, the first candidate is correct, texts are plain', () => {
    const off: string[] = [];
    for (const id of CHK_IDS) {
      const s = CHK[id];
      if (!s.cands[0].correct) off.push(`${id}: first candidate wrong`);
      if (!s.cands.some((c) => c.correct) || !s.cands.some((c) => !c.correct)) off.push(`${id}: needs both kinds`);
      for (const c of s.cands) if (/[\\{}]/.test(c.text) || /[\\{}]/.test(c.dtext)) off.push(`${id}: TeX in plain text ${c.text}`);
    }
    expect(off).toEqual([]);
  });

  it('two correct candidates differ by the listed constant on each piece where both are defined', () => {
    const off: string[] = [];
    for (const id of CHK_IDS) {
      const s = CHK[id];
      for (let i = 0; i < s.cands.length; i++)
        for (let j = 0; j < s.cands.length; j++) {
          if (i === j) continue;
          const d = diffOf(id, i, j);
          const bothCorrect = s.cands[i].correct && s.cands[j].correct;
          if (bothCorrect !== (d !== null)) off.push(`${id} ${i},${j}: constant listed = ${d !== null}, both correct = ${bothCorrect}`);
          if (!d) continue;
          for (const piece of d) {
            for (const x of grid([piece.lo, piece.hi], s.window.x, 30, 0.1)) {
              const diff = s.cands[i].G(x) - s.cands[j].G(x);
              if (!near(diff, piece.v, 1e-12)) off.push(`${id} ${i}−${j} x=${x.toFixed(3)}: ${diff} vs ${piece.v}`);
            }
          }
        }
    }
    expect(off).toEqual([]);
  });

  it('the constants named in the brief: π/2, ±π/2 per piece, 1, 1/2, −1/2, −3', () => {
    expect(diffOf('asin', 0, 1)![0].v).toBeCloseTo(Math.PI / 2, 14);
    const at = diffOf('atan', 0, 1)!;
    expect(at.map((p) => p.v)).toEqual([-Math.PI / 2, Math.PI / 2]);
    expect(at[0].hi).toBe(0);
    expect(at[1].lo).toBe(0);
    expect(diffOf('2sincos', 0, 1)![0].v).toBe(1);
    expect(diffOf('2sincos', 0, 2)![0].v).toBe(0.5);
    expect(diffOf('2sincos', 1, 2)![0].v).toBe(-0.5);
    expect(diffOf('x-sinx', 0, 1)![0].v).toBe(-3);
    // swapping the order negates the constant and its text
    expect(diffOf('x-sinx', 1, 0)![0].v).toBe(3);
    expect(diffOf('x-sinx', 1, 0)![0].text).toBe('3');
    expect(diffOf('atan', 1, 0)!.map((p) => p.text)).toEqual(['π/2', '−π/2']);
    expect(diffOf('recip2', 0, 1)).toBeNull();
    expect(diffOf('atan', 0, 2)).toBeNull();
  });

  it('wrong candidates are pairwise different functions (no wrong pair has a constant difference)', () => {
    const off: string[] = [];
    for (const id of CHK_IDS) {
      const s = CHK[id];
      for (let i = 0; i < s.cands.length; i++)
        for (let j = i + 1; j < s.cands.length; j++) {
          if (s.cands[i].correct && s.cands[j].correct) continue;
          const xs = grid(s.pieces[0], s.window.x, 20, 0.1);
          const maxDd = Math.max(...xs.map((x) => Math.abs(s.cands[i].dG(x) - s.cands[j].dG(x))));
          if (maxDd < 1e-3) off.push(`${id} ${i},${j}: equal derivatives`);
        }
    }
    expect(off).toEqual([]);
  });

  it('the pieces of recip2 and the correct candidate agree with the finite jumps of ln|(x − 1)/(x + 1)| across x = ±1 only (G is undefined there)', () => {
    const s = CHK.recip2;
    expect(pieceIndex(s.pieces, 0)).toBe(1);
    expect(pieceIndex(s.pieces, 1)).toBe(-1);
    expect(pieceIndex(s.pieces, -1)).toBe(-1);
    expect(Number.isFinite(s.cands[0].G(1))).toBe(false);
  });
});
