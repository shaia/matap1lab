import { describe, expect, it } from 'vitest';
import { centralDiff, relativeError } from '~/math/analysis';
import {
  A_MAX,
  A_MIN,
  Gof,
  SYM,
  SYM_IDS,
  UP,
  UP_IDS,
  numInt,
  partIntegrals,
  stripClose,
  symIntegral,
  symParts,
  upArea,
  upper,
  upperStrip,
} from '~/math/defint';
import { simpson } from '~/math/multivar';

// Every stored closed form was recomputed with sympy on 2026-11-27 (screens/tools/cas.py, screens/tools/ch8_presets.py):
// (x⁴/4 − x²)′ = x³ − 2x; (x sin x + cos x)′ = x cos x; (x⁵/5 − x³ + x)′ = x⁴ − 3x² + 1; (x³ − x)′ = 3x² − 1;
// ∫₋₁¹ (3x² − 1) dx = 0; cosh x + sinh x = eˣ; ∫₋ₐᵃ eˣ dx = 2 sinh a; ∫₀^{x²} cos t dt = sin(x²), its derivative
// 2x cos(x²); ∫ₓ^{2x} dt/t = ln 2; ∫₀¹ e^(−t²) dt = 0.746824132812427; ∫₀³ e^(−t²) dt = 0.886207348259521.

/** |num − exact| ≤ tol·max(1, |exact|): relative, with an absolute floor where the exact value crosses 0 */
const near = (num: number, exact: number, tol: number) => Math.abs(num - exact) <= tol * Math.max(1, Math.abs(exact));
const grid = (lo: number, hi: number, n: number) => Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n);
const aGrid = grid(A_MIN, A_MAX, 28);

describe('exact identities: parity on a symmetric interval', () => {
  it('the stored parity holds on a grid: odd f(−x) = −f(x), even f(−x) = f(x), neither fails both somewhere', () => {
    const off: string[] = [];
    for (const id of SYM_IDS) {
      const s = SYM[id];
      const xs = grid(0, 3.3, 66);
      if (s.kind === 'odd') for (const x of xs) if (!near(s.f(-x), -s.f(x), 1e-14)) off.push(`${id} x=${x}: not odd`);
      if (s.kind === 'even') for (const x of xs) if (!near(s.f(-x), s.f(x), 1e-14)) off.push(`${id} x=${x}: not even`);
      if (s.kind === 'neither') {
        if (!xs.some((x) => !near(s.f(-x), s.f(x), 1e-6))) off.push(`${id}: looks even`);
        if (!xs.some((x) => !near(s.f(-x), -s.f(x), 1e-6))) off.push(`${id}: looks odd`);
      }
    }
    expect(off).toEqual([]);
  });

  it('the stored antiderivative F has F′ = f (centralDiff) on a grid of the window', () => {
    const off: string[] = [];
    for (const id of SYM_IDS) {
      const s = SYM[id];
      if (!s.F) continue;
      for (const x of grid(-3.2, 3.2, 64)) {
        const d = centralDiff(s.F, x);
        if (!near(d, s.f(x), 1e-7)) off.push(`${id} x=${x.toFixed(2)}: F′=${d} f=${s.f(x)}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('odd ⇒ ∫₋ₐ⁰ = −∫₀ᵃ and the total is 0; even ⇒ ∫₋ₐ⁰ = ∫₀ᵃ and the total is 2∫₀ᵃ', () => {
    const off: string[] = [];
    for (const id of SYM_IDS) {
      const s = SYM[id];
      for (const a of aGrid) {
        const { left, right, total } = symParts(id, a);
        if (s.kind === 'odd') {
          if (!near(left, -right, 1e-12)) off.push(`${id} a=${a}: left ${left} right ${right}`);
          if (Math.abs(total) > 1e-12 * Math.max(1, Math.abs(right))) off.push(`${id} a=${a}: total ${total}`);
        }
        if (s.kind === 'even') {
          if (!near(left, right, 1e-10)) off.push(`${id} a=${a}: left ${left} right ${right}`);
          if (!near(total, 2 * right, 1e-10)) off.push(`${id} a=${a}: total ${total}`);
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('symParts against Simpson of f over each half (gauss included)', () => {
    const off: string[] = [];
    for (const id of SYM_IDS)
      for (const a of [0.2, 0.7, 1.3, 2.1, 3]) {
        const { left, right } = symParts(id, a);
        const sl = simpson(SYM[id].f, -a, 0, 4000);
        const sr = simpson(SYM[id].f, 0, a, 4000);
        if (!near(left, sl, 1e-9) || !near(right, sr, 1e-9)) off.push(`${id} a=${a}: ${left}/${sl}, ${right}/${sr}`);
      }
    expect(off).toEqual([]);
  });

  it('exp: the even part cosh is even, the odd part sinh is odd, they sum to eˣ; ∫₋ₐᵃ sinh = 0 and ∫₋ₐᵃ cosh = 2 sinh a = ∫₋ₐᵃ eˣ', () => {
    const p = SYM.exp.parts!;
    const off: string[] = [];
    for (const x of grid(-3, 3, 60)) {
      if (!near(p.even(-x), p.even(x), 1e-14)) off.push(`even part x=${x}`);
      if (!near(p.odd(-x), -p.odd(x), 1e-14)) off.push(`odd part x=${x}`);
      if (!near(p.even(x) + p.odd(x), SYM.exp.f(x), 1e-14)) off.push(`sum x=${x}`);
      if (!near(centralDiff(p.evenF, x), p.even(x), 1e-7) || !near(centralDiff(p.oddF, x), p.odd(x), 1e-7)) off.push(`part F′ x=${x}`);
    }
    for (const a of aGrid) {
      const pi = partIntegrals('exp', a)!;
      if (pi.odd !== 0) off.push(`a=${a}: ∫ sinh = ${pi.odd}`);
      if (!near(pi.even, 2 * Math.sinh(a), 1e-14)) off.push(`a=${a}: ∫ cosh = ${pi.even}`);
      if (!near(symParts('exp', a).total, pi.even + pi.odd, 1e-13)) off.push(`a=${a}: total ≠ even + odd`);
    }
    expect(off).toEqual([]);
    expect(partIntegrals('cubic', 1)).toBeNull();
  });

  it('zero: ∫₋₁¹ (3x² − 1) dx = 0 although f is even and not odd (the counterexample)', () => {
    expect(SYM.zero.kind).toBe('even');
    expect(symParts('zero', 1).total).toBe(0);
    expect(SYM.zero.f(-0.5)).not.toBeCloseTo(-SYM.zero.f(0.5), 6);
    // away from a = 1 the total is 2(a³ − a) ≠ 0
    expect(symParts('zero', 1.5).total).toBeCloseTo(3.75, 12);
  });

  it('the defaults: a₀ in the slider range; only gauss lacks a closed form', () => {
    const off: string[] = [];
    for (const id of SYM_IDS) {
      const s = SYM[id];
      if (!(s.a0 >= A_MIN && s.a0 <= A_MAX)) off.push(`${id}: a0`);
      if ((s.F === null) !== (id === 'gauss')) off.push(`${id}: F`);
      if ((s.parts !== null) !== (s.kind === 'neither')) off.push(`${id}: parts`);
      if (!(s.window.x[0] <= -A_MAX && s.window.x[1] >= A_MAX)) off.push(`${id}: window`);
    }
    expect(off).toEqual([]);
  });
});

describe('exact identities: an integral with a variable limit', () => {
  it('the stored G equals ∫ from h(x) to g(x) of f through the antiderivative in t', () => {
    const off: string[] = [];
    for (const id of UP_IDS) {
      const s = UP[id];
      if (!s.G) continue;
      for (const x of grid(s.xr[0], s.xr[1], 40)) {
        const viaFt = s.Ft(s.g(x)) - s.Ft(s.h(x));
        if (!near(s.G(x), viaFt, 1e-12)) off.push(`${id} x=${x}: G=${s.G(x)} Ft=${viaFt}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('G′ by the formula f(g)g′ − f(h)h′ equals the stored dG and centralDiff of G on a grid', () => {
    const off: string[] = [];
    for (const id of UP_IDS) {
      const s = UP[id];
      for (const x of grid(s.xr[0], s.xr[1], 40)) {
        const { Gprime } = upper(id, x);
        if (!near(Gprime, s.dG(x), 1e-12)) off.push(`${id} x=${x}: formula ${Gprime} stored ${s.dG(x)}`);
        const d = centralDiff((v) => Gof(id, v), x, 1e-4);
        if (!near(d, s.dG(x), 1e-6)) off.push(`${id} x=${x}: centralDiff ${d} stored ${s.dG(x)}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('the stored Ft has Ft′ = f where it is a closed form', () => {
    const off: string[] = [];
    for (const id of UP_IDS) {
      const s = UP[id];
      if (!s.exact) continue;
      for (const t of grid(Math.max(0.3, s.tWin.x[0]), s.tWin.x[1], 40)) if (!near(centralDiff(s.Ft, t), s.f(t), 1e-7)) off.push(`${id} t=${t}`);
    }
    expect(off).toEqual([]);
  });

  it('recip-2x: G is the constant ln 2 for every x > 0 and G′ = 0 (both limits move)', () => {
    const off: string[] = [];
    const s = UP['recip-2x'];
    for (const x of grid(s.xr[0], s.xr[1], 52)) {
      const G = s.Ft(s.g(x)) - s.Ft(s.h(x));
      if (Math.abs(G - Math.LN2) > 1e-15) off.push(`x=${x}: G=${G}`);
      if (Math.abs(upper('recip-2x', x).Gprime) > 1e-15) off.push(`x=${x}: G′=${upper('recip-2x', x).Gprime}`);
      if (Math.abs(upperStrip('recip-2x', x, 0.1).change) > 1e-15) off.push(`x=${x}: strip change`);
    }
    expect(off).toEqual([]);
  });

  it('upperStrip: top + bottom = G(x + dx) − G(x), widths are g(x + dx) − g(x) and h(x + dx) − h(x)', () => {
    const off: string[] = [];
    for (const id of UP_IDS) {
      const s = UP[id];
      for (const x of grid(s.xr[0], s.xr[1], 12))
        for (const dx of [0.005, 0.05, 0.5]) {
          const st = upperStrip(id, x, dx);
          const dG = Gof(id, x + dx) - Gof(id, x);
          if (Math.abs(st.change - dG) > 1e-9) off.push(`${id} x=${x} dx=${dx}: ${st.change} vs ${dG}`);
          if (!near(st.top.width, s.g(x + dx) - s.g(x), 1e-14)) off.push(`${id}: top width`);
          if (!near(st.bottom.width, s.h(x + dx) - s.h(x), 1e-14)) off.push(`${id}: bottom width`);
          if (!s.hMoves && st.bottom.area !== 0) off.push(`${id}: constant lower limit adds area`);
        }
    }
    expect(off).toEqual([]);
  });

  it('the defaults: x₀ inside the slider range, x and g(x), h(x) inside the windows', () => {
    const off: string[] = [];
    for (const id of UP_IDS) {
      const s = UP[id];
      if (!(s.x0 > s.xr[0] && s.x0 < s.xr[1])) off.push(`${id}: x0`);
      for (const x of grid(s.xr[0], s.xr[1], 20)) {
        if (x < s.xWin.x[0] || x > s.xWin.x[1]) off.push(`${id}: x=${x} outside the G panel`);
        for (const t of [s.g(x), s.h(x)]) if (t < s.tWin.x[0] || t > s.tWin.x[1]) off.push(`${id}: t=${t} outside the f panel`);
        if (s.g(x) < s.h(x)) off.push(`${id}: g < h at x=${x}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('dragging a limit inverts it: gInv(g(x)) = x, hInv(h(x)) = x', () => {
    const off: string[] = [];
    for (const id of UP_IDS) {
      const s = UP[id];
      for (const x of grid(s.xr[0], s.xr[1], 20)) {
        if (!near(s.gInv(s.g(x), x), x, 1e-12)) off.push(`${id} gInv x=${x}`);
        if (s.hInv && !near(s.hInv(s.h(x)), x, 1e-12)) off.push(`${id} hInv x=${x}`);
      }
    }
    expect(off).toEqual([]);
  });
});

describe('analytic limits: strip area / dx → G′(x) as dx → 0', () => {
  it('the error of strip / dx shrinks in proportion to dx (forward difference, error ≈ G″dx/2)', () => {
    const off: string[] = [];
    for (const id of UP_IDS) {
      const s = UP[id];
      for (const x of grid(s.xr[0] + 0.1, s.xr[1] - 0.1, 8)) {
        const Gp = upper(id, x).Gprime;
        const e1 = Math.abs(upperStrip(id, x, 1e-3).perDx - Gp);
        const e2 = Math.abs(upperStrip(id, x, 1e-4).perDx - Gp);
        const G2 = (s.dG(x + 1e-4) - s.dG(x - 1e-4)) / 2e-4;
        // the error at dx = 1e-4 is G″·dx/2 to first order
        if (Math.abs(e2 - Math.abs(G2) * 5e-5) > 2e-7 + 0.01 * Math.abs(G2) * 5e-5) off.push(`${id} x=${x}: e(1e-4)=${e2} G″dx/2=${Math.abs(G2) * 5e-5}`);
        if (e1 > 1e-12 && !(e2 < e1 / 5)) off.push(`${id} x=${x}: e(1e-3)=${e1} e(1e-4)=${e2}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('the task up-strip is reachable at every preset’s default x with the smallest dx of the slider (0.005)', () => {
    const off: string[] = [];
    for (const id of UP_IDS) {
      const x = UP[id].x0;
      const st = upperStrip(id, x, 0.005);
      if (!stripClose(st.perDx, upper(id, x).Gprime)) off.push(`${id}: ${st.perDx} vs ${upper(id, x).Gprime}`);
      // and a coarse strip is NOT close, so the task needs the shrinking (except where G′ ≡ 0)
      const coarse = upperStrip(id, x, 0.5);
      if (id !== 'recip-2x' && stripClose(coarse.perDx, upper(id, x).Gprime)) off.push(`${id}: dx = 0.5 already close`);
      // the header of DefIntLab.tsx promises dx = 0.02 is enough at the default x of these three
      if (id !== 'gauss-x' && !stripClose(upperStrip(id, x, 0.02).perDx, upper(id, x).Gprime)) off.push(`${id}: dx = 0.02 not enough at x0`);
    }
    expect(off).toEqual([]);
  });
});

describe('probes: the numeric integrals of e^(−x²) against sympy', () => {
  it('∫₀¹ e^(−t²) dt and ∫₀³ e^(−t²) dt agree with sympy to 1e-10', () => {
    expect(relativeError(Gof('gauss-x', 1), 0.746824132812427)).toBeLessThan(1e-10);
    expect(relativeError(Gof('gauss-x', 3), 0.886207348259521)).toBeLessThan(1e-10);
    expect(relativeError(symParts('gauss', 1).right, 0.746824132812427)).toBeLessThan(1e-10);
    expect(symParts('gauss', 1).exact).toBe(false);
    expect(upper('gauss-x', 1).exact).toBe(false);
  });

  it('numInt and upArea are signed: reversing the limits changes the sign', () => {
    const off: string[] = [];
    for (const [lo, hi] of [
      [0, 1],
      [0.5, 2.5],
      [-1, 2],
    ] as const) {
      if (!near(numInt(Math.cos, hi, lo), -numInt(Math.cos, lo, hi), 1e-14)) off.push(`numInt ${lo} ${hi}`);
      if (!near(upArea('gauss-x', hi, lo), -upArea('gauss-x', lo, hi), 1e-14)) off.push(`upArea ${lo} ${hi}`);
      if (!near(symIntegral('xcos', hi, lo), -symIntegral('xcos', lo, hi), 1e-14)) off.push(`symIntegral ${lo} ${hi}`);
    }
    expect(off).toEqual([]);
  });
});
