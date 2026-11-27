import { describe, expect, it } from 'vitest';
import { centralDiff, relativeError, secondDiff } from '~/math/analysis';
import {
  LOCAL,
  LOCAL_IDS,
  SK,
  SKETCH_IDS,
  asymGap,
  inDomain,
  localTerms,
  localWindow,
  pieceAt,
  verdictOf,
  type SignPiece,
  type SketchId,
} from '~/math/sketch';

// Every stored fact was recomputed with sympy on 2026-11-27 (screens/tools/sketch_check.py): critical points
// cubic −1 (max, 2), 1 (min, −2); quartic 0 (f′ keeps its sign), 3 (min, −27), inflections 0, 2 (−16); oblique 1 (max, 2),
// 3 (min, 6), x = 2, y = x + 2; gauss 0 (max, 1), ±1 (e^(−1/2)); xlnx 1/e (min, −1/e); lorentz 0 (max, 1), ±1/√3 (3/4).
// Series about a: eˣ − 1 − x = x²/2 + x³/6; cosh − cos = x² + x⁶/360; 1 − cos − x²/2 = −x⁴/24 + x⁶/720;
// sinh − sin = x³/3 + x⁷/2520; tan − sin = x³/2 + x⁵/8; x⁴ − 4x³ = −4x³ + x⁴ (a = 0) and −27 + 18h² + 8h³ + h⁴ (a = 3);
// sin(π + h) = −h + h³/6 − h⁵/120, minus the tangent −h: h³/6 − h⁵/120.

/**
 * Finite differences against a closed form that crosses 0: near a zero the relative error is undefined, so the
 * comparison is |num − exact| ≤ tol·max(1, |exact|). The finite-difference error is ~h²|f‴| + ε|f|/h ≈ 1e-10 for
 * centralDiff (h = 1e-5) and ~1e-7 for secondDiff (h = 1e-4, rounding ε|f|/h² dominates), on values of size ≤ ~100.
 */
const near = (num: number, exact: number, tol: number) => Math.abs(num - exact) <= tol * Math.max(1, Math.abs(exact));

/** sample points of the window that lie in the domain, at least `gap` from every break of the domain */
function grid(id: SketchId, n = 241, gap = 0.05): number[] {
  const s = SK[id];
  const [lo, hi] = s.window.x;
  const breaks = s.domain.flatMap((d) => [d.lo.v, d.hi.v]).filter(Number.isFinite);
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const x = lo + ((hi - lo) * i) / n;
    if (inDomain(id, x) && breaks.every((b) => Math.abs(x - b) >= gap)) out.push(x);
  }
  return out;
}

describe('sketch: exact identities, f1 and f2 are the derivatives of f', () => {
  it('every preset: f1 = centralDiff(f) and f2 = centralDiff(f1) = secondDiff(f) on a grid of the window', () => {
    const off: string[] = [];
    for (const id of SKETCH_IDS) {
      const s = SK[id];
      for (const x of grid(id)) {
        if (!near(centralDiff(s.f, x), s.f1(x), 1e-7)) off.push(`${id} f1 at ${x}`);
        if (!near(centralDiff(s.f1, x), s.f2(x), 1e-7)) off.push(`${id} f2 (from f1) at ${x}`);
        if (!near(secondDiff(s.f, x), s.f2(x), 1e-5)) off.push(`${id} f2 (from f) at ${x}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('every local preset: f1, f2 are the derivatives of f, and r, r_T are the residuals, on |h| ∈ [0.1, w0]', () => {
    const off: string[] = [];
    for (const id of LOCAL_IDS) {
      const s = LOCAL[id];
      const a = s.a.v;
      for (let i = 0; i <= 80; i++) {
        const h = -s.w0 + (2 * s.w0 * i) / 80;
        const x = a + h;
        if (!near(centralDiff(s.f, x), s.f1(x), 1e-7)) off.push(`${id} f1 at ${x}`);
        if (!near(centralDiff(s.f1, x), s.f2(x), 1e-7)) off.push(`${id} f2 at ${x}`);
        if (Math.abs(h) < 0.1) continue;
        // away from a the plain difference has no cancellation to speak of: relative 1e-12
        if (relativeError(s.r(h), s.f(x) - s.fa.v) > 1e-12) off.push(`${id} r at h = ${h}`);
        if (relativeError(s.rt(h), s.f(x) - s.fa.v - s.f1a.v * h) > 1e-12) off.push(`${id} r_T at h = ${h}`);
      }
      // the stored f(a), f′(a): exact values (an exact 0 compared absolutely: rounding of sin π is 1.2e-16)
      if (Math.abs(s.f(a) - s.fa.v) > 1e-14) off.push(`${id} f(a)`);
      if (Math.abs(s.f1(a) - s.f1a.v) > 1e-14) off.push(`${id} f′(a)`);
    }
    expect(off).toEqual([]);
  });

  it('the plain values of the TeX-free labels agree with the numbers (spot checks of the exact constants)', () => {
    expect(SK.gauss.infl[0].y.v).toBe(Math.exp(-0.5));
    expect(relativeError(SK.xlnx.crit[0].x.v, 1 / Math.E)).toBeLessThan(1e-15);
    expect(relativeError(SK.lorentz.infl[1].x.v ** 2, 1 / 3)).toBeLessThan(1e-15);
  });
});

describe('sketch: the stored points are what the closed forms say', () => {
  it('critical points: f(x) is the stored value, f′(x) = 0, and the kind matches the sign of f′ on both sides', () => {
    const off: string[] = [];
    for (const id of SKETCH_IDS) {
      const s = SK[id];
      for (const c of s.crit) {
        const x = c.x.v;
        // an exact value compared relatively; the exact 0 of f(0) and f′ absolutely (rounding of 1/e is 1e-16)
        if (c.y.v === 0 ? Math.abs(s.f(x)) > 1e-15 : relativeError(s.f(x), c.y.v) > 1e-14) off.push(`${id} f(${c.x.text})`);
        if (Math.abs(s.f1(x)) > 1e-14) off.push(`${id} f′(${c.x.text}) ≠ 0`);
        const left = Math.sign(centralDiff(s.f, x - 0.01));
        const right = Math.sign(centralDiff(s.f, x + 0.01));
        const kind = left > 0 && right < 0 ? 'max' : left < 0 && right > 0 ? 'min' : 'none';
        if (kind !== c.kind) off.push(`${id} kind at ${c.x.text}: ${kind}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('inflection points: f(x) is the stored value, f″(x) = 0, and f″ changes sign there (secondDiff on both sides)', () => {
    const off: string[] = [];
    for (const id of SKETCH_IDS) {
      const s = SK[id];
      for (const p of s.infl) {
        const x = p.x.v;
        if (p.y.v === 0 ? Math.abs(s.f(x)) > 1e-15 : relativeError(s.f(x), p.y.v) > 1e-14) off.push(`${id} f(${p.x.text})`);
        if (Math.abs(s.f2(x)) > 1e-14) off.push(`${id} f″(${p.x.text}) ≠ 0`);
        const l = Math.sign(secondDiff(s.f, x - 0.01));
        const r = Math.sign(secondDiff(s.f, x + 0.01));
        if (!(l * r < 0)) off.push(`${id} f″ keeps its sign at ${p.x.text}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('the critical and inflection points are ALL the zeros of f′ and f″ in the window (a sign-change scan finds no other)', () => {
    const off: string[] = [];
    for (const id of SKETCH_IDS) {
      const s = SK[id];
      const xs = grid(id, 4001, 0.002);
      for (const [g, listed, name] of [
        [s.f1, s.crit.map((c) => c.x.v), 'f′'],
        [s.f2, s.infl.map((p) => p.x.v), 'f″'],
      ] as const) {
        for (let i = 1; i < xs.length; i++) {
          const [u, w] = [xs[i - 1], xs[i]];
          if (s.domain.some((d) => (d.lo.v > u && d.lo.v < w) || (d.hi.v > u && d.hi.v < w))) continue; // across a break of the domain
          if (g(u) * g(w) < 0 && !listed.some((v) => v >= u && v <= w)) off.push(`${id}: ${name} changes sign in [${u}, ${w}]`);
        }
      }
    }
    expect(off).toEqual([]);
  });
});

describe('sketch: the stored sign intervals', () => {
  /** pieces are left to right, contiguous except across a break of the domain, and cover the domain */
  function cover(id: SketchId, pieces: SignPiece[]): string[] {
    const s = SK[id];
    const bad: string[] = [];
    const ends = s.domain.flatMap((d) => [d.lo.v, d.hi.v]);
    if (pieces[0].lo.v !== s.domain[0].lo.v) bad.push('first piece starts off the domain');
    if (pieces[pieces.length - 1].hi.v !== s.domain[s.domain.length - 1].hi.v) bad.push('last piece ends off the domain');
    for (let i = 1; i < pieces.length; i++) if (pieces[i].lo.v !== pieces[i - 1].hi.v) bad.push(`gap at ${i}`);
    for (const p of pieces) if (!(p.lo.v < p.hi.v)) bad.push(`empty piece ${p.lo.text}..${p.hi.text}`);
    // every inner boundary is a listed zero or a break of the domain
    return [...bad, ...pieces.slice(1).map((p) => p.lo.v).filter((b) => !ends.includes(b) && !Number.isFinite(b)).map((b) => `odd boundary ${b}`)];
  }

  it('f′ and f″ have the stored sign on every grid point of every piece', () => {
    const off: string[] = [];
    for (const id of SKETCH_IDS) {
      const s = SK[id];
      off.push(...cover(id, s.mono).map((m) => `${id} mono: ${m}`), ...cover(id, s.conc).map((m) => `${id} conc: ${m}`));
      for (const x of grid(id, 1201, 1e-3)) {
        const pm = pieceAt(s.mono, x);
        const pc = pieceAt(s.conc, x);
        if (pm && Math.sign(s.f1(x)) !== pm.sign) off.push(`${id} f′ sign at ${x}`);
        if (pc && Math.sign(s.f2(x)) !== pc.sign) off.push(`${id} f″ sign at ${x}`);
        if (!pm && !s.crit.some((c) => c.x.v === x)) off.push(`${id} no mono piece at ${x}`);
        if (!pc && !s.infl.some((p) => p.x.v === x)) off.push(`${id} no conc piece at ${x}`);
      }
      // the boundaries of the pieces are exactly the zeros and the breaks of the domain
      const breaks = new Set([...s.domain.flatMap((d) => [d.lo.v, d.hi.v]), ...s.vertical.map((v) => v.v)]);
      const monoB = s.mono.slice(1).map((p) => p.lo.v);
      const concB = s.conc.slice(1).map((p) => p.lo.v);
      for (const b of monoB) if (!breaks.has(b) && !s.crit.some((c) => c.x.v === b)) off.push(`${id} mono boundary ${b}`);
      for (const b of concB) if (!breaks.has(b) && !s.infl.some((p) => p.x.v === b)) off.push(`${id} conc boundary ${b}`);
      for (const c of s.crit) if (!monoB.includes(c.x.v)) off.push(`${id} critical ${c.x.text} is no boundary`);
      for (const p of s.infl) if (!concB.includes(p.x.v)) off.push(`${id} inflection ${p.x.text} is no boundary`);
    }
    expect(off).toEqual([]);
  });
});

describe('sketch: analytic limits, the asymptotes', () => {
  it('vertical asymptotes: |f| grows past 1e5 at a distance 1e-6 on both sides', () => {
    const off: string[] = [];
    for (const id of SKETCH_IDS) for (const v of SK[id].vertical) for (const d of [-1e-6, 1e-6]) if (!(Math.abs(SK[id].f(v.v + d)) > 1e5)) off.push(`${id} at ${v.text}`);
    expect(off).toEqual([]);
  });

  it('lines at ±∞: the gap f − (mx + b) shrinks like a decade per decade of x, below 1e-5 at |x| = 1e6', () => {
    const off: string[] = [];
    for (const id of SKETCH_IDS) {
      for (const sgn of [-1, 1]) {
        const x = sgn * 1e6;
        if (!inDomain(id, x)) continue;
        const line = sgn < 0 ? SK[id].atInf.left : SK[id].atInf.right;
        if (line && !(Math.abs(asymGap(id, x)) < 1e-5)) off.push(`${id} at ${sgn}∞: gap ${asymGap(id, x)}`);
        // no listed line: f/x is unbounded (cubic, quartic, x ln x), so no line y = mx + b fits
        if (!line && !(Math.abs(SK[id].f(x) / x) > 10)) off.push(`${id} at ${sgn}∞: f/x bounded`);
      }
    }
    expect(off).toEqual([]);
  });

  it('oblique: the gap is exactly 1/(x − 2); the task sketch-asym (|x| ≥ 8, gap < 0.15) is reachable in the window', () => {
    const off: string[] = [];
    for (const x of [-10, -8, 8, 8.7, 10]) if (relativeError(asymGap('oblique', x), 1 / (x - 2)) > 1e-12) off.push(`gap at ${x}`);
    expect(off).toEqual([]);
    // at x = 8 the gap is 1/6 > 0.15; from x = 2 + 1/0.15 ≈ 8.67 on (and at every x ≤ −8) it is below 0.15
    expect(Math.abs(asymGap('oblique', 8))).toBeGreaterThan(0.15);
    expect(Math.abs(asymGap('oblique', 8.7))).toBeLessThan(0.15);
    expect(Math.abs(asymGap('oblique', -8))).toBeLessThan(0.15);
    expect(SK.oblique.window.x[1]).toBeGreaterThanOrEqual(8.7);
  });

  it('x ln x → 0 as x → 0⁺ (the hollow end point (0, 0)), f is undefined at 0', () => {
    expect(Math.abs(SK.xlnx.f(1e-12))).toBeLessThan(1e-10);
    expect(Number.isNaN(SK.xlnx.f(0))).toBe(true);
    expect(SK.xlnx.holes).toEqual([{ x: expect.objectContaining({ v: 0 }), y: expect.objectContaining({ v: 0 }) }]);
  });
});

describe('sketch: analytic limits, the leading term of the local presets', () => {
  it('r(h)/(c hᵏ) → 1 as h → 0 from both sides, as fast as the next term says', () => {
    const off: string[] = [];
    for (const id of LOCAL_IDS) {
      for (const tangent of [false, true]) {
        const { lead, next, r } = localTerms(id, tangent);
        for (const h0 of [1e-2, 1e-3]) {
          for (const sgn of [-1, 1]) {
            const h = sgn * h0;
            const ratio = r(h) / (lead.c.v * h ** lead.k);
            const bound = 2 * Math.abs(next.c.v / lead.c.v) * h0 ** (next.k - lead.k) + 1e-12;
            if (!(Math.abs(ratio - 1) <= bound)) off.push(`${id}${tangent ? ' T' : ''} at h = ${h}: ratio ${ratio}`);
          }
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('the next term is the next one: (r − c hᵏ)/(d hᵐ) within 5% of 1 at h = ±0.1, ±0.05', () => {
    const off: string[] = [];
    for (const id of LOCAL_IDS) {
      for (const tangent of [false, true]) {
        const { lead, next, r } = localTerms(id, tangent);
        for (const h of [-0.1, -0.05, 0.05, 0.1]) {
          const ratio = (r(h) - lead.c.v * h ** lead.k) / (next.c.v * h ** next.k);
          if (!(Math.abs(ratio - 1) < 0.05)) off.push(`${id}${tangent ? ' T' : ''} at h = ${h}: ${ratio}`);
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('the verdicts: ex1x, cosh-cos, quartic3 min; cos4 max; sinh-sin, tan-sin, quartic0, sin-pi cross; sin-pi with the tangent crosses at order 3', () => {
    const v = Object.fromEntries(LOCAL_IDS.map((id) => [id, verdictOf(LOCAL[id].lead)]));
    expect(v).toEqual({
      ex1x: 'min',
      'cosh-cos': 'min',
      cos4: 'max',
      'sinh-sin': 'cross',
      'tan-sin': 'cross',
      quartic0: 'cross',
      quartic3: 'min',
      'sin-pi': 'cross',
    });
    expect(LOCAL['sin-pi'].leadT.k).toBe(3);
    // the flat presets: the tangent is horizontal, so subtracting it changes nothing
    for (const id of LOCAL_IDS) if (id !== 'sin-pi') expect(LOCAL[id].f1a.v).toBe(0);
  });

  it('cos4 is a maximum although f″(0) = 0: f″ vanishes at 0 and r < 0 on both sides', () => {
    const s = LOCAL.cos4;
    expect(Math.abs(s.f2(0))).toBe(0);
    const off = [-0.5, -0.1, -1e-3, 1e-3, 0.1, 0.5].filter((h) => !(s.r(h) < 0));
    expect(off).toEqual([]);
  });

  it('the zoom window keeps the leading term at the same height on screen: c·wᵏ / H is the same at z = 1, 10, 1000', () => {
    const off: string[] = [];
    for (const id of LOCAL_IDS) {
      for (const tangent of [false, true]) {
        const { lead } = localTerms(id, tangent);
        const ref = localWindow(id, tangent, 1);
        const at1 = (lead.c.v * ref.w ** lead.k) / ref.h;
        for (const z of [10, 1000]) {
          const wz = localWindow(id, tangent, z);
          if (relativeError((lead.c.v * wz.w ** lead.k) / wz.h, at1) > 1e-12) off.push(`${id} z = ${z}`);
        }
      }
    }
    expect(off).toEqual([]);
  });
});
