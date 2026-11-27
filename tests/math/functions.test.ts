/**
 * src/math/functions.ts, filed by accuracy category: exact identities (the registry's hard-coded facts against the rules
 * they describe), analytic values (transformations, composition domains, one-to-one restrictions with known answers),
 * probes against known answers (intersections, coincidence). A sweep over many points collects its failures and asserts
 * once. Quantities are compared by relativeError; against an exact 0 the bound is absolute, 1e-12, because the rules
 * are evaluated in double precision and a value that is 0 in exact arithmetic is of order 1e-16 here.
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/vec';
import {
  FN,
  FN_IDS,
  clippedPieces,
  coincidesOnWindow,
  composeDomain,
  composeFn,
  countIntersections,
  definedSet,
  dirAt,
  domainOf,
  fnOf,
  horizontalHits,
  inIntervals,
  intersections,
  intervalsText,
  isOneToOne,
  mirrorFn,
  monoOf,
  rangeOf,
  shiftFn,
  transformFn,
  turningPoints,
  zerosOf,
  type FnId,
} from '~/math/functions';

const PI = Math.PI;
const HALF_PI = PI / 2;
/** sample points: a dyadic grid on [−8, 8] (exact in binary, so domain edges at integers are hit exactly) and far points */
const GRID: number[] = [];
for (let i = -512; i <= 512; i++) GRID.push(i / 64);
const FAR = [-1000, -100, 100, 1000];
/** the far points overflow or round to the limit for these (exp(1000) = ∞, tanh(100) = 1), so they are not sampled there */
const NO_FAR: FnId[] = ['exp', 'sinh', 'cosh', 'tanh', 'gauss', 'sin2'];
const REAL_IDS = FN_IDS.filter((id) => id !== 'const');

const cases: [FnId, number, number, boolean][] = [
  ['x2', 0, 3, true],
  ['x2', -3, -0.5, true],
  ['x2', -1, 1, false],
  ['abs', 0, 2, true],
  ['abs', -1, 1, false],
  ['cubic', -1, 1, true],
  ['cubic', 1, 2.5, true],
  ['cubic', -1.5, 1.5, false],
  ['cubic', -2.5, 2.5, false],
  ['sin', -HALF_PI, HALF_PI, true],
  ['sin', 0, PI, false],
  ['cos', 0, PI, true],
  ['cos', -1, 1, false],
  ['cosh', 0, 3, true],
  ['cosh', -1, 3, false],
  ['sinh', -3, 3, true],
  ['exp', -5, 5, true],
  ['semicircle', 0, 2, true],
  ['semicircle', -2, 2, false],
  ['recip', -1, 1, true],
  ['rational', -3, 3, true],
  ['tan', -1.5, 1.5, true],
  ['tan', -1.5, 2, false],
  ['quad', 1, 5, true],
  ['quad', -3, 5, false],
  ['gauss', -3, 0, true],
  ['gauss', -1, 1, false],
  ['const', -1, 1, false],
];

describe('exact identities: the registry against its own rules', () => {
  it('f is NaN exactly outside its exact domain (sampled on a dyadic grid)', () => {
    const off: string[] = [];
    for (const id of FN_IDS) {
      const dom = domainOf(id, -9, 9);
      for (const x of [...GRID, PI / 2, -PI / 2, 3 * PI / 2]) {
        if (id === 'const') continue;
        const defined = !Number.isNaN(FN[id].f(x));
        if (defined !== inIntervals(dom, x)) off.push(`${id}@${x}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('every registry id has all the fields, and the window is a non-degenerate box', () => {
    const bad: string[] = [];
    for (const id of FN_IDS) {
      const s = FN[id];
      if (s.id !== id || !s.tex || !s.text || !s.domainText || !s.rangeText) bad.push(id);
      if (!(s.window.x[0] < s.window.x[1] && s.window.y[0] < s.window.y[1])) bad.push(`${id}:window`);
      if (s.at('x') !== s.text) bad.push(`${id}:at(x)`);
    }
    expect(bad).toEqual([]);
    expect(FN_IDS.length).toBe(28);
  });

  it('parity claims hold on a sample; a null parity is violated by some sampled point', () => {
    const off: string[] = [];
    for (const id of REAL_IDS) {
      const f = FN[id].f;
      const par = FN[id].parity;
      let evenOk = true;
      let oddOk = true;
      let violated = false;
      for (const x of GRID.filter((v) => v > 0)) {
        const a = f(x);
        if (Number.isNaN(a)) continue;
        const b = f(-x);
        if (Number.isNaN(b) || Math.abs(a - b) > 1e-12 * Math.max(1, Math.abs(a))) evenOk = false;
        if (Number.isNaN(b) || Math.abs(a + b) > 1e-12 * Math.max(1, Math.abs(a))) oddOk = false;
        if (!evenOk && !oddOk) violated = true;
      }
      for (const x of GRID.filter((v) => v < 0)) {
        const a = f(x);
        if (Number.isNaN(a)) continue;
        const b = f(-x);
        if (Number.isNaN(b)) violated = true;
      }
      if (par === 'even' && !evenOk) off.push(`${id}:even`);
      if (par === 'odd' && !oddOk) off.push(`${id}:odd`);
      if (par === null && !(violated || (!evenOk && !oddOk))) off.push(`${id}:null`);
    }
    expect(off).toEqual([]);
  });

  it('the period is a period on a sample and no smaller fraction of it is', () => {
    const off: string[] = [];
    for (const id of REAL_IDS) {
      const p = FN[id].period;
      if (p === null) continue;
      const f = FN[id].f;
      const holds = (q: number) => GRID.every((x) => {
        const a = f(x);
        const b = f(x + q);
        return Number.isNaN(a) ? Number.isNaN(b) : Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a));
      });
      if (!holds(p)) off.push(`${id}:not a period`);
      for (const div of [2, 3, 4, 6]) if (holds(p / div)) off.push(`${id}:p/${div} is also a period`);
    }
    expect(off).toEqual([]);
  });

  it('the listed zeros are zeros, and every sign change of the sample is next to a listed zero', () => {
    const off: string[] = [];
    for (const id of REAL_IDS) {
      const f = FN[id].f;
      const zs = zerosOf(id, -9, 9);
      for (const z of zs) if (!(Math.abs(f(z)) < 1e-12)) off.push(`${id}: f(${z}) = ${f(z)}`);
      const xs: number[] = [];
      for (let i = 0; i <= 1800; i++) xs.push(-9 + i * 0.01);
      for (let i = 0; i < xs.length - 1; i++) {
        const a = f(xs[i]);
        const b = f(xs[i + 1]);
        if (Number.isNaN(a) || Number.isNaN(b) || a * b >= 0) continue;
        // a sign change through a pole (tan, 1/x, rational) is not a zero: |value| is large there
        if (Math.abs(a) > 50 || Math.abs(b) > 50) continue;
        if (!zs.some((z) => z >= xs[i] - 1e-9 && z <= xs[i + 1] + 1e-9)) off.push(`${id}: unlisted sign change at ${xs[i]}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('the exact ranges contain every sampled value and each finite end is approached within 0.05', () => {
    const off: string[] = [];
    for (const id of REAL_IDS) {
      const f = FN[id].f;
      const rng = rangeOf(id);
      const vals = [...GRID, ...(NO_FAR.includes(id) ? [] : FAR)].map((x) => f(x)).filter((v) => !Number.isNaN(v));
      for (const v of vals) if (!inIntervals(rng, v)) off.push(`${id}: ${v} outside ${intervalsText(rng)}`);
      const lo = Math.min(...vals);
      const hi = Math.max(...vals);
      for (const iv of rng) {
        if (Number.isFinite(iv.lo) && !vals.some((v) => Math.abs(v - iv.lo) < 0.05)) off.push(`${id}: never near ${iv.lo}`);
        if (Number.isFinite(iv.hi) && !vals.some((v) => Math.abs(v - iv.hi) < 0.05)) off.push(`${id}: never near ${iv.hi}`);
      }
      if (rng.every((iv) => iv.lo === -Infinity) && !(lo < -4)) off.push(`${id}: not unbounded below`);
      if (rng.some((iv) => iv.hi === Infinity) && !(hi > 4)) off.push(`${id}: not unbounded above`);
    }
    expect(off).toEqual([]);
  });

  it('the monotone pieces agree with sampling, cover the sampled domain and are strictly monotone', () => {
    const off: string[] = [];
    for (const id of REAL_IDS) {
      const f = FN[id].f;
      const pieces = monoOf(id, -9, 9);
      for (const x of GRID) {
        if (!Number.isNaN(f(x)) && !pieces.some((p) => x >= p.lo && x <= p.hi)) off.push(`${id}: ${x} in no piece`);
      }
      for (const p of pieces) {
        const xs = GRID.filter((x) => (p.loOpen ? x > p.lo : x >= p.lo) && (p.hiOpen ? x < p.hi : x <= p.hi) && !Number.isNaN(f(x)));
        for (let i = 0; i + 1 < xs.length; i++) {
          if (xs[i + 1] - xs[i] > 0.016) continue; // consecutive grid points only
          const d = f(xs[i + 1]) - f(xs[i]);
          if (p.dir === 'inc' && !(d > -1e-14)) off.push(`${id}: not increasing at ${xs[i]}`);
          if (p.dir === 'dec' && !(d < 1e-14)) off.push(`${id}: not decreasing at ${xs[i]}`);
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('turning points of the registry: x², |x|, cosh, gauss, quad at their extremum; cubic ±1; none for monotone or split ones', () => {
    const t = (id: FnId) => turningPoints(id, -9, 9);
    expect(t('x2')).toEqual([0]);
    expect(t('abs')).toEqual([0]);
    expect(t('cosh')).toEqual([0]);
    expect(t('gauss')).toEqual([0]);
    expect(t('quad')).toEqual([1]);
    expect(t('cubic')).toEqual([-1, 1]);
    expect(t('semicircle')).toEqual([0]);
    expect(t('ln-abs')).toEqual([]);
    expect(t('recip2')).toEqual([]);
    expect(t('sqrt-quad')).toEqual([]);
    expect(t('exp')).toEqual([]);
    const s = t('sin');
    const want = [-5, -3, -1, 1, 3, 5].map((m) => (m * PI) / 2);
    expect(s.length).toBe(6);
    expect(want.filter((w, i) => relativeError(s[i], w) > 1e-12)).toEqual([]);
  });

  it('dirAt reads the direction from the registry at a point and is null outside the domain', () => {
    expect(dirAt('quad', 0)).toBe('dec');
    expect(dirAt('quad', 2)).toBe('inc');
    expect(dirAt('sqrt', -1)).toBeNull();
    expect(dirAt('sin', 0)).toBe('inc');
    expect(dirAt('sin', 2)).toBe('dec');
    expect(dirAt('cos', 1)).toBe('dec');
    expect(dirAt('tan', 1.5)).toBe('inc');
    expect(dirAt('tan', PI / 2)).toBeNull();
  });
});

describe('analytic values: facts that are known without the registry', () => {
  it('quad has zeros −1 and 3 and its vertex (1, −4); the cubic has turning points ±1 with values ∓2', () => {
    expect(zerosOf('quad', -9, 9)).toEqual([-1, 3]);
    expect(FN.quad.f(1)).toBe(-4);
    expect(zerosOf('cubic', -9, 9).map((z) => FN.cubic.f(z)).every((v) => Math.abs(v) < 1e-12)).toBe(true);
    expect(FN.cubic.f(-1)).toBe(2);
    expect(FN.cubic.f(1)).toBe(-2);
  });

  it('the rational function of the notes (x − 2)/(x + 1): zero 2, f(0) = −2, undefined at −1, never equal to 1', () => {
    const f = FN.rational.f;
    expect(f(2)).toBe(0);
    expect(f(0)).toBe(-2);
    expect(Number.isNaN(f(-1))).toBe(true);
    const hits = [...GRID, ...FAR].filter((x) => f(x) === 1);
    expect(hits).toEqual([]);
  });

  it('the transformation y = A·f((x − a)/b) + c moves, stretches and reflects as stated', () => {
    const f = FN.x2.f;
    const off: string[] = [];
    for (const [a, b, A, c] of [[1, 1, 1, 0], [0, 2, 1, 0], [0, -1, 1, 0], [2, 0.5, -3, 4], [-1, -2, 0.5, -1]]) {
      const g = transformFn(f, { a, b, A, c });
      for (const x of GRID) {
        const exact = A * ((x - a) / b) ** 2 + c;
        if (relativeError(g(x), exact) > 1e-12) off.push(`${a},${b},${A},${c}@${x}`);
      }
    }
    expect(off).toEqual([]);
    expect(Number.isNaN(transformFn(f, { a: 0, b: 0, A: 1, c: 0 })(1))).toBe(true);
    // b < 0 reflects x² in the y-axis: unchanged; sqrt reflected becomes defined for x ≤ 0
    const r = transformFn(FN.sqrt.f, { a: 0, b: -1, A: 1, c: 0 });
    expect(r(-4)).toBe(2);
    expect(Number.isNaN(r(4))).toBe(true);
  });

  it('a mirror and a shift are the formulas f(−x), −f(−x), f(x + T)', () => {
    expect(mirrorFn(FN.sqrt.f, 'y')(-9)).toBe(3);
    expect(mirrorFn(FN.x3.f, 'origin')(2)).toBe(8);
    expect(shiftFn(FN.x2.f, 1)(2)).toBe(9);
    expect(composeFn(FN.sqrt.f, FN.quad.f)(4)).toBe(Math.sqrt(5));
  });

  it('the domain of sqrt∘quad is the domain of sqrt-quad on the window, with its closed ends −1 and 3', () => {
    const d = composeDomain(FN.sqrt.f, FN.quad.f, -6, 6);
    expect(d).toEqual([
      { lo: -6, hi: -1, loOpen: false, hiOpen: false },
      { lo: 3, hi: 6, loOpen: false, hiOpen: false },
    ]);
    const probe = GRID.filter((x) => Math.abs(x) <= 6).filter((x) => inIntervals(d, x) !== inIntervals(domainOf('sqrt-quad'), x));
    expect(probe).toEqual([]);
  });

  it('the domain of ln∘abs is x ≠ 0 with an open hole; the domain of quad∘sqrt is [0, ∞) on the window', () => {
    const d = composeDomain(FN.ln.f, FN.abs.f, -5, 5);
    expect(d).toEqual([
      { lo: -5, hi: 0, loOpen: false, hiOpen: true },
      { lo: 0, hi: 5, loOpen: true, hiOpen: false },
    ]);
    expect(composeDomain(FN.quad.f, FN.sqrt.f, -2, 8)).toEqual([{ lo: 0, hi: 8, loOpen: false, hiOpen: false }]);
  });

  it('the chain breaks where g(x) leaves the domain of f: sqrt∘quad is undefined on (−1, 3), quad∘sqrt is defined there', () => {
    const f = FN.sqrt.f;
    const g = FN.quad.f;
    expect(Number.isFinite(g(1)) && Number.isNaN(f(g(1)))).toBe(true);
    expect(Number.isFinite(composeFn(g, f)(1))).toBe(true);
    expect(composeFn(f, g)(1)).toBeNaN();
  });

  it('f∘g ≠ g∘f for sqrt and quad at x = 4 (√5 against 4 − 4 − 3 = −3), and equal for lin ∘ lin at the fixed point −1', () => {
    expect(composeFn(FN.sqrt.f, FN.quad.f)(4)).not.toBe(composeFn(FN.quad.f, FN.sqrt.f)(4));
    expect(composeFn(FN.quad.f, FN.sqrt.f)(4)).toBe(-3);
    expect(composeFn(FN.lin.f, FN.lin.f)(-1)).toBe(FN.lin.f(FN.lin.f(-1)));
  });
});

describe('analytic values: one-to-one restrictions with known answers', () => {
  it.each(cases)('%s restricted to [%f, %f] is one-to-one: %s', (id, lo, hi, expected) => {
    expect(isOneToOne(id, lo, hi)).toBe(expected);
  });

  it('clipped pieces report the pieces a restriction meets', () => {
    expect(clippedPieces('cubic', -2, 2).map((c) => c.piece.dir)).toEqual(['inc', 'dec', 'inc']);
    expect(clippedPieces('cubic', -0.5, 0.5).map((c) => c.piece.dir)).toEqual(['dec']);
  });
});

describe('probes against known answers: intersections', () => {
  const cubic = FN.cubic.f;
  const constant = (k: number) => () => k;

  it('the line y = k meets x³ − 3x in 3, 3, 2, 2, 1, 1 points for k = 0, 1, 2 (tangent at −1), −2 (tangent at 1), 3, −3', () => {
    const got = [0, 1, 2, -2, 3, -3].map((k) => countIntersections(cubic, constant(k), -4, 4));
    expect(got).toEqual([3, 3, 2, 2, 1, 1]);
  });

  it("lesson 4.2's solve states: x³ = 2x + 1 at −1 and (1 ± √5)/2, eˣ = 2x + 1 at 0 and 1.25643120862617 (sympy), on [−4, 4]", () => {
    const off: string[] = [];
    const cases: [string, (x: number) => number, (x: number) => number, number[]][] = [
      ['x3 = lin', FN.x3.f, (x) => 2 * x + 1, [-1, (1 - Math.sqrt(5)) / 2, (1 + Math.sqrt(5)) / 2]],
      ['exp = lin', FN.exp.f, (x) => 2 * x + 1, [0, 1.2564312086261697]],
    ];
    for (const [name, f, g, want] of cases) {
      const xs = intersections(f, g, -4, 4).xs;
      if (xs.length !== want.length) off.push(`${name}: ${xs.length} roots`);
      else want.forEach((w, i) => { if (!(Math.abs(xs[i] - w) < 1e-9)) off.push(`${name}: ${xs[i]} vs ${w}`); });
    }
    expect(off).toEqual([]);
  });

  it('the roots at k = 0 are −√3, 0, √3 to 1e-9 and the tangent root at k = 2 is −1', () => {
    const r0 = intersections(cubic, constant(0), -4, 4).xs;
    const want = [-Math.sqrt(3), 0, Math.sqrt(3)];
    const off = want.filter((w, i) => !(Math.abs((r0[i] ?? NaN) - w) < 1e-9));
    expect(off).toEqual([]);
    const r2 = intersections(cubic, constant(2), -4, 4).xs;
    expect(Math.abs(r2[0] - -1)).toBeLessThan(1e-6);
    expect(Math.abs(r2[1] - 2)).toBeLessThan(1e-9);
  });

  it('x² and x³ meet at 0 (a tangency) and 1; e^x = x² has one root, −0.703467422498 (sympy); √x and ln x never meet', () => {
    expect(intersections(FN.x2.f, FN.x3.f, -2, 2).xs.map((x) => Math.round(x * 1e4) / 1e4)).toEqual([0, 1]);
    const e = intersections(FN.exp.f, FN.x2.f, -5, 5).xs;
    expect(e.length).toBe(1);
    expect(relativeError(e[0], -0.703467422498392)).toBeLessThan(1e-9);
    expect(countIntersections(FN.sqrt.f, FN.ln.f, 0.001, 100)).toBe(0);
  });

  it('the cubic meets the line 2x + 1 at the three real roots of x³ − 5x − 1 (sympy: −2.12842, −0.20164, 2.33006)', () => {
    const r = intersections(cubic, FN.lin.f, -4, 4).xs;
    const want = [-2.12841906384458, -0.201639675723405, 2.33005873956798];
    expect(r.length).toBe(3);
    expect(want.filter((w, i) => relativeError(r[i], w) > 1e-9)).toEqual([]);
  });

  it('a pole is not an intersection (1/x with the x-axis), and a domain edge that is a zero is (√(x² − 2x − 3) = 0 at −1 and 3)', () => {
    expect(countIntersections(FN.recip.f, constant(0), -4, 4)).toBe(0);
    expect(countIntersections(FN.tan.f, constant(0), -1.5, 1.5)).toBe(1);
    const r = intersections(FN['sqrt-quad'].f, constant(0), -5, 7).xs;
    expect(r.length).toBe(2);
    expect(Math.abs(r[0] + 1)).toBeLessThan(1e-9);
    expect(Math.abs(r[1] - 3)).toBeLessThan(1e-9);
  });

  it('sin x = 0 on [−2π, 2π] has 5 roots (−2π, −π, 0, π, 2π) and the periodic lattice of zeros agrees', () => {
    const r = intersections(Math.sin, constant(0), -2 * PI, 2 * PI).xs;
    expect(r.length).toBe(5);
    expect(zerosOf('sin', -2 * PI, 2 * PI).length).toBe(5);
  });

  it('identical functions are reported as coincident, not counted', () => {
    const r = intersections(cubic, cubic, -4, 4);
    expect(r.coincident).toBe(true);
    expect(countIntersections(cubic, cubic, -4, 4)).toBe(Infinity);
  });

  it('horizontal hits of a restriction: x² on [−2, 2] at k = 1 is 2, on [0, 2] is 1, at k = 5 is 0; sin on [0, 2π] at 0.5 is 2', () => {
    expect(horizontalHits(FN.x2.f, 1, -2, 2)).toBe(2);
    expect(horizontalHits(FN.x2.f, 1, 0, 2)).toBe(1);
    expect(horizontalHits(FN.x2.f, 5, -2, 2)).toBe(0);
    expect(horizontalHits(FN.x2.f, 0, -2, 2)).toBe(1);
    expect(horizontalHits(Math.sin, 0.5, 0, 2 * PI)).toBe(2);
  });

  it('the one-to-one verdict agrees with the horizontal-line test: some sampled value is hit twice iff the restriction is not one-to-one', () => {
    const off: string[] = [];
    for (const [id, lo, hi, expected] of cases) {
      if (id === 'const') continue;
      const f = FN[id].f;
      let twice = false;
      for (let i = 0; i <= 40 && !twice; i++) {
        const k = f(lo + ((hi - lo) * (i + 0.5)) / 41);
        if (Number.isFinite(k) && Math.abs(k) < 1e5 && horizontalHits(f, k, lo, hi, 800) >= 2) twice = true;
      }
      if (twice === expected) off.push(`${id}[${lo},${hi}]`);
    }
    expect(off).toEqual([]);
  });
});

describe('probes against known answers: coincidence and definedness', () => {
  it('parity: the copy f(−x) coincides with f for the even functions and −f(−x) for the odd ones, on a symmetric window', () => {
    const off: string[] = [];
    for (const id of REAL_IDS) {
      const { parity, window } = FN[id];
      const [lo, hi] = [-Math.min(-window.x[0], window.x[1]), Math.min(-window.x[0], window.x[1])];
      const f = FN[id].f;
      const yes = (kind: 'y' | 'origin') => coincidesOnWindow(f, mirrorFn(f, kind), lo, hi);
      if (yes('y') !== (parity === 'even')) off.push(`${id}:y`);
      if (yes('origin') !== (parity === 'odd')) off.push(`${id}:origin`);
    }
    expect(off).toEqual([]);
  });

  it('periodicity: f(x + T) coincides with f exactly at the period and its multiples, not at half of it', () => {
    const off: string[] = [];
    for (const id of REAL_IDS) {
      const p = FN[id].period;
      if (p === null) continue;
      const f = FN[id].f;
      if (!coincidesOnWindow(f, shiftFn(f, p), -6, 6, { tol: 1e-9 })) off.push(`${id}:p`);
      if (!coincidesOnWindow(f, shiftFn(f, 2 * p), -6, 6, { tol: 1e-9 })) off.push(`${id}:2p`);
      if (coincidesOnWindow(f, shiftFn(f, p / 2), -6, 6)) off.push(`${id}:p/2`);
    }
    expect(off).toEqual([]);
  });

  it('a one-sample difference is seen, and a pair undefined on different sets does not coincide', () => {
    expect(coincidesOnWindow(FN.x2.f, FN.x3.f, -2, 2)).toBe(false);
    expect(coincidesOnWindow(FN.sqrt.f, FN.ln.f, 0.5, 5)).toBe(false);
    expect(coincidesOnWindow(FN.sqrt.f, (x) => (x < 0 ? NaN : Math.sqrt(x)), -2, 5)).toBe(true);
    expect(coincidesOnWindow(FN.sqrt.f, FN.x2.f, -2, -1)).toBe(false);
  });

  it('definedSet finds the domains of the registry on a window: the same intervals as the exact ones, ends to 1e-9', () => {
    const off: string[] = [];
    for (const id of REAL_IDS) {
      if (id === 'tan') continue;
      const win = FN[id].window.x;
      const found = definedSet(FN[id].f, win[0], win[1], 600);
      const exact = domainOf(id, win[0], win[1])
        .map((iv) => ({ lo: Math.max(iv.lo, win[0]), hi: Math.min(iv.hi, win[1]), loOpen: iv.lo < win[0] ? false : iv.loOpen, hiOpen: iv.hi > win[1] ? false : iv.hiOpen }))
        .filter((iv) => iv.lo <= iv.hi);
      if (found.length !== exact.length) {
        off.push(`${id}: ${found.length} runs, expected ${exact.length}`);
        continue;
      }
      found.forEach((iv, i) => {
        const e = exact[i];
        if (Math.abs(iv.lo - e.lo) > 1e-9 || Math.abs(iv.hi - e.hi) > 1e-9 || iv.loOpen !== e.loOpen || iv.hiOpen !== e.hiOpen) off.push(`${id}: ${JSON.stringify(iv)} vs ${JSON.stringify(e)}`);
      });
    }
    expect(off).toEqual([]);
  });

  it('fnOf(const, k) is the constant k', () => {
    expect(fnOf('const', 2.5)(-7)).toBe(2.5);
    expect(rangeOf('const', 2.5)).toEqual([{ lo: 2.5, hi: 2.5, loOpen: false, hiOpen: false }]);
  });

  it('intervalsText writes the exact domains', () => {
    expect(intervalsText(domainOf('rational'))).toBe('(−∞, −1) ∪ (−1, ∞)');
    expect(intervalsText(domainOf('semicircle'))).toBe('[−2, 2]');
    expect(intervalsText(rangeOf('gauss'))).toBe('(0, 1]');
  });
});
