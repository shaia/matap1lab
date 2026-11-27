import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/analysis';
import {
  APPROACH,
  APPROACH_IDS,
  EXTREME,
  H_DECADES,
  IVT,
  approachRows,
  bisectInit,
  bisectStep,
  decadesPassed,
  extremes,
  levelPoints,
  oneSidedValue,
  signChanges,
  sinRecipScale,
  type ApproachId,
  type BisectState,
  type OneSided,
  type Verdict,
} from '~/math/limits';

// constants recomputed with sympy 2026-11-26: limits -1/2, -1, 1; one-sided 7 and 9; roots 1.32471795724475,
// 0.739085133215161; x^3 - x - 3 = 0 at 1.67169988165716; cos x - x = 0.3 at 0.551657170166885

const WITH_LIMIT: ApproachId[] = ['removable-p3', 'removable-p4', 'sinc', 'cont'];

/** the classification, derived independently from the stored one-sided limits and f(a) */
function classify(left: OneSided, right: OneSided, fa: number | null): Verdict {
  if (left.kind === 'inf' || right.kind === 'inf') return 'infinite';
  if (left.kind === 'none' || right.kind === 'none') return 'none';
  if (left.value !== right.value) return 'jump';
  return fa === left.value ? 'continuous' : 'removable';
}

describe('limits: the stored classification agrees with the stored one-sided limits and f(a)', () => {
  it('every preset: verdict, limit and jump follow from left, right and f(a)', () => {
    const off: string[] = [];
    for (const id of APPROACH_IDS) {
      const s = APPROACH[id];
      if (classify(s.left, s.right, s.fa) !== s.verdict) off.push(`${id}: verdict`);
      const fin = s.left.kind === 'finite' && s.right.kind === 'finite';
      const expectLimit = fin && (s.left as { value: number }).value === (s.right as { value: number }).value ? (s.left as { value: number }).value : null;
      if (s.limit !== expectLimit) off.push(`${id}: limit`);
      const expectJump = s.verdict === 'jump' ? oneSidedValue(s.right) - oneSidedValue(s.left) : null;
      if (s.jump !== expectJump) off.push(`${id}: jump`);
    }
    expect(off).toEqual([]);
  });

  it('stored f(a) is what the formula gives at a (NaN = undefined)', () => {
    const off: string[] = [];
    for (const id of APPROACH_IDS) {
      const s = APPROACH[id];
      const v = s.f(s.a);
      if (s.fa === null ? !Number.isNaN(v) : v !== s.fa) off.push(id);
    }
    expect(off).toEqual([]);
  });
});

describe('limits: the table converges to the stored limit', () => {
  it('presets with a limit: both sides within 1e-5 (relative) at h = 1e-6', () => {
    const off: string[] = [];
    for (const id of WITH_LIMIT) {
      const s = APPROACH[id];
      const [row] = approachRows(id, [1e-6]);
      if (relativeError(row.fl, s.limit as number) > 1e-5) off.push(`${id} left ${row.fl}`);
      if (relativeError(row.fr, s.limit as number) > 1e-5) off.push(`${id} right ${row.fr}`);
    }
    expect(off).toEqual([]);
  });

  it('presets with a limit: the error shrinks at every decade of h from 1 down to 1e-5 (floating point still sees the trend)', () => {
    const off: string[] = [];
    for (const id of ['removable-p3', 'removable-p4', 'sinc'] as ApproachId[]) {
      const s = APPROACH[id];
      const rows = approachRows(id, H_DECADES);
      for (let i = 1; i < rows.length - 1; i++) {
        for (const side of ['fl', 'fr'] as const) {
          const e0 = Math.abs(rows[i - 1][side] - (s.limit as number));
          const e1 = Math.abs(rows[i][side] - (s.limit as number));
          if (!(e1 < e0)) off.push(`${id} ${side} decade ${i}`);
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('floating-point table of the removable presets keeps 1e-9 absolute accuracy at h = 1e-6 (no catastrophic cancellation)', () => {
    const off: string[] = [];
    for (const id of ['removable-p3', 'removable-p4'] as ApproachId[]) {
      const s = APPROACH[id];
      const [row] = approachRows(id, [1e-6]);
      // the exact function value at a ± h after cancelling the vanishing factor
      const exact = (h: number, sgn: number) => (id === 'removable-p3' ? (sgn * h - 1) / (2 + sgn * h) : sgn * h - 1);
      if (Math.abs(row.fl - exact(1e-6, -1)) > 1e-9) off.push(`${id} left`);
      if (Math.abs(row.fr - exact(1e-6, 1)) > 1e-9) off.push(`${id} right`);
      expect(s.limit).not.toBeNull();
    }
    expect(off).toEqual([]);
  });

  it('the hole is a hole: f(a) is NaN for every removable preset', () => {
    const off = APPROACH_IDS.filter((id) => APPROACH[id].verdict === 'removable' && !Number.isNaN(APPROACH[id].f(APPROACH[id].a)));
    expect(off).toEqual([]);
  });

  it('decadesPassed lists the decades not smaller than h', () => {
    expect(decadesPassed(1)).toEqual([1]);
    expect(decadesPassed(1e-3)).toEqual([1, 1e-1, 1e-2, 1e-3]);
    expect(decadesPassed(3e-3)).toEqual([1, 1e-1, 1e-2]);
    expect(decadesPassed(1e-6)).toEqual(H_DECADES);
  });
});

describe('limits: the jump presets differ across the point by the stored jump', () => {
  it('jump-p6 and sign: f(a + h) − f(a − h) is the stored jump within 10h, at every decade ≤ 1e-2', () => {
    const off: string[] = [];
    for (const id of ['jump-p6', 'sign'] as ApproachId[]) {
      const s = APPROACH[id];
      for (const row of approachRows(id, H_DECADES.filter((h) => h <= 1e-2))) {
        if (Math.abs(row.fr - row.fl - (s.jump as number)) > 10 * row.h) off.push(`${id} h=${row.h}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('jump-p6: the left side tends to 7 and the right side to 9; f(3) = 9 = the right limit', () => {
    const [row] = approachRows('jump-p6', [1e-6]);
    expect(relativeError(row.fl, 7)).toBeLessThan(1e-6);
    expect(relativeError(row.fr, 9)).toBeLessThan(1e-5);
    expect(APPROACH['jump-p6'].f(3)).toBe(9);
  });
});

describe('limits: infinite presets grow without bound at the stored sign', () => {
  it('recip and recip2: |f(a ± h)| = 1/h or 1/h², increasing at every decade, with the stored sign', () => {
    const off: string[] = [];
    for (const id of ['recip', 'recip2'] as ApproachId[]) {
      const s = APPROACH[id];
      const rows = approachRows(id, H_DECADES);
      rows.forEach((r, i) => {
        const want = id === 'recip' ? 1 / r.h : 1 / (r.h * r.h);
        if (relativeError(Math.abs(r.fl), want) > 1e-12 || relativeError(Math.abs(r.fr), want) > 1e-12) off.push(`${id} magnitude h=${r.h}`);
        if (Math.sign(r.fl) !== Math.sign(oneSidedValue(s.left)) || Math.sign(r.fr) !== Math.sign(oneSidedValue(s.right))) off.push(`${id} sign h=${r.h}`);
        if (i > 0 && !(Math.abs(r.fr) > Math.abs(rows[i - 1].fr))) off.push(`${id} growth h=${r.h}`);
      });
    }
    expect(off).toEqual([]);
  });
});

describe('limits: sin(1/x) has no limit, it oscillates between -1 and 1 at every scale', () => {
  it('on (0, h] it takes values within 1e-3 of both -1 and 1, for h = 10^-k (k = 0…12) and for off-decade h', () => {
    const off: number[] = [];
    const hs = [...Array.from({ length: 13 }, (_, k) => 10 ** -k), 3.7e-5, 0.0123, 7e-9];
    for (const h of hs) {
      const { min, max } = sinRecipScale(h);
      if (!(min < -0.999 && max > 0.999)) off.push(h);
    }
    expect(off).toEqual([]);
  });

  it('the table of values at x = 10^-k is not a proof: at x = 1/(kπ) the function is 0 and at x = 1/(π/2 + 2kπ) it is 1', () => {
    const f = APPROACH['sin-recip'].f;
    const zeros = [1, 10, 100, 1000].map((k) => Math.abs(f(1 / (k * Math.PI))));
    const ones = [0, 1, 10, 100, 1000].map((k) => f(1 / (Math.PI / 2 + 2 * k * Math.PI)));
    expect(Math.max(...zeros)).toBeLessThan(1e-9);
    expect(Math.min(...ones)).toBeGreaterThan(1 - 1e-12);
  });
});

function runBisect(id: 'cubic' | 'cos-x' | 'recip', k: number, a: number, b: number, n: number): BisectState[] {
  const out = [bisectInit(a, b)];
  for (let i = 0; i < n; i++) {
    const next = bisectStep(id, k, out[out.length - 1]);
    if (!next) break;
    out.push(next);
  }
  return out;
}

describe('IVT: bisection brackets the root and halves the interval at every step', () => {
  it('cubic on [1, 2], k = 0: brackets 1.32472 (to 5 decimals) and the length is exactly 2^-n', () => {
    const seq = runBisect('cubic', 0, 1, 2, 30);
    const off: string[] = [];
    seq.forEach((s, n) => {
      if (s.b - s.a !== 2 ** -n) off.push(`length n=${n}`);
      if (!(s.a <= IVT.cubic.root0! && IVT.cubic.root0! <= s.b)) off.push(`bracket n=${n}`);
    });
    expect(seq.length).toBe(31);
    expect(off).toEqual([]);
    expect(Math.abs((seq[30].a + seq[30].b) / 2 - 1.32471795724475)).toBeLessThan(1e-8);
    expect((seq[20].a + seq[20].b) / 2).toBeCloseTo(1.32472, 5);
  });

  it('cos x − x on [0, 1], k = 0: brackets 0.739085 and the length is exactly 2^-n', () => {
    const seq = runBisect('cos-x', 0, 0, 1, 30);
    const off: string[] = [];
    seq.forEach((s, n) => {
      if (s.b - s.a !== 2 ** -n) off.push(`length n=${n}`);
      if (!(s.a <= IVT['cos-x'].root0! && IVT['cos-x'].root0! <= s.b)) off.push(`bracket n=${n}`);
    });
    expect(off).toEqual([]);
    expect((seq[20].a + seq[20].b) / 2).toBeCloseTo(0.739085, 5);
  });

  it('a level k ≠ 0: cubic at k = 2 closes in on 1.67169988165716, cos x − x at k = 0.3 on 0.551657170166885', () => {
    const c = runBisect('cubic', 2, 1, 2, 40);
    const d = runBisect('cos-x', 0.3, 0, 1, 40);
    const mid = (s: BisectState) => (s.a + s.b) / 2;
    expect(Math.abs(mid(c[40]) - 1.67169988165716)).toBeLessThan(1e-10);
    expect(Math.abs(mid(d[40]) - 0.551657170166885)).toBeLessThan(1e-10);
  });

  it('the kept half always has f − k of opposite signs at its ends (cubic, 30 steps)', () => {
    const off: number[] = [];
    runBisect('cubic', 0, 1, 2, 30).forEach((s, n) => {
      if (!signChanges('cubic', 0, s.a, s.b)) off.push(n);
    });
    expect(off).toEqual([]);
  });

  it('no sign change at the ends: nothing to halve (cubic on [1.5, 2] at k = 0)', () => {
    expect(signChanges('cubic', 0, 1.5, 2)).toBe(false);
    expect(bisectStep('cubic', 0, bisectInit(1.5, 2))).toBeNull();
  });
});

describe('IVT: 1/x changes sign across its pole, but there is no root', () => {
  it('on [−1, 0.8] the bisection closes in on 0 (the interval always contains 0) and f is not defined there', () => {
    const seq = runBisect('recip', 0, -1, 0.8, 40);
    const off: number[] = [];
    seq.forEach((s, n) => {
      const holds0 = s.a <= 0 && 0 <= s.b;
      if (!holds0) off.push(n);
    });
    const last = seq[seq.length - 1];
    expect(off).toEqual([]);
    expect(last.b - last.a).toBeLessThan(1e-11);
    expect(Number.isNaN(IVT.recip.f(0))).toBe(true);
    expect(IVT.recip.continuousOn(-1, 0.8)).toBe(false);
    expect(IVT.recip.continuousOn(0.2, 3)).toBe(true);
  });

  it('on [−1, 1] the first midpoint is the pole: the interval collapses to {0}', () => {
    const s1 = bisectStep('recip', 0, bisectInit(-1, 1));
    expect(s1).toEqual({ a: 0, b: 0, steps: 1, collapsed: true });
    expect(bisectStep('recip', 0, s1!)).toBeNull();
  });

  it('no c has 1/c = 0, and 1/c = 2 only at c = 0.5; level points are exact', () => {
    expect(levelPoints('recip', 0, -1, 1)).toEqual([]);
    expect(levelPoints('recip', 2, 0.1, 1)).toEqual([0.5]);
    expect(levelPoints('recip', 2, 0.6, 1)).toEqual([]);
  });
});

describe('IVT: level points of the continuous presets', () => {
  it('cubic k = 0 on [1, 2] has the single root 1.32471795724475; cos x − x at k = 0 has 0.739085133215161', () => {
    const c = levelPoints('cubic', 0, 1, 2);
    const d = levelPoints('cos-x', 0, 0, 1);
    expect(c).toHaveLength(1);
    expect(d).toHaveLength(1);
    expect(Math.abs(c[0] - 1.32471795724475)).toBeLessThan(1e-9);
    expect(Math.abs(d[0] - 0.739085133215161)).toBeLessThan(1e-9);
  });

  it('a level outside the values on the interval has no point (cubic k = 6 on [1, 2] where f runs from −1 to 5)', () => {
    expect(levelPoints('cubic', 6, 1, 2)).toEqual([]);
  });
});

describe('extreme values: attained or only approached, per preset and end type', () => {
  it('x² on [−1, 2]: max 4 at the right end, min 0 at the interior point 0 (attained whatever the ends)', () => {
    const closed = extremes('x2', -1, 2, true, true);
    expect(closed.max).toMatchObject({ value: 4, attained: true, at: [2] });
    expect(closed.min).toMatchObject({ value: 0, attained: true, at: [0] });
    const openRight = extremes('x2', -1, 2, true, false);
    expect(openRight.max).toMatchObject({ value: 4, attained: false, at: [], approachedAt: [2] });
    expect(openRight.min.attained).toBe(true);
    const openLeft = extremes('x2', -1, 2, false, true);
    expect(openLeft.max).toMatchObject({ value: 4, attained: true });
  });

  it('x² on [−1, 1]: the maximum 1 is attained at both ends, and still attained when one end is open', () => {
    expect(extremes('x2', -1, 1, true, true).max.at).toEqual([-1, 1]);
    expect(extremes('x2', -1, 1, true, false).max).toMatchObject({ value: 1, attained: true, at: [-1] });
    expect(extremes('x2', -1, 1, false, false).max).toMatchObject({ value: 1, attained: false });
  });

  it('1/x on [0.5, 3]: max 2 at 0.5, min 1/3 at 3; opening an end loses exactly that value', () => {
    const closed = extremes('recip', 0.5, 3, true, true);
    expect(closed.max).toMatchObject({ value: 2, attained: true, at: [0.5] });
    expect(closed.min.value).toBeCloseTo(1 / 3, 14);
    expect(closed.min).toMatchObject({ attained: true, at: [3] });
    const openLeft = extremes('recip', 0.5, 3, false, true);
    expect(openLeft.max).toMatchObject({ value: 2, attained: false, approachedAt: [0.5] });
    expect(openLeft.min.attained).toBe(true);
    const openRight = extremes('recip', 0.5, 3, true, false);
    expect(openRight.min).toMatchObject({ attained: false, approachedAt: [3] });
    expect(openRight.max.attained).toBe(true);
  });

  it('1/x on (0, 3]: unbounded above (sup +∞, never attained, even when the left toggle says closed), min 1/3 attained', () => {
    for (const lc of [true, false]) {
      const r = extremes('recip', 0, 3, lc, true);
      expect(r.max).toMatchObject({ value: Infinity, attained: false });
      expect(r.min.attained).toBe(true);
      expect(r.min.value).toBeCloseTo(1 / 3, 14);
    }
  });

  it('x on [0, 1]: both attained when closed, neither when open, one when half open', () => {
    const cases: [boolean, boolean, boolean, boolean][] = [
      [true, true, true, true],
      [false, false, false, false],
      [true, false, true, false],
      [false, true, false, true],
    ];
    const off: string[] = [];
    for (const [lc, rc, minAtt, maxAtt] of cases) {
      const r = extremes('lin', 0, 1, lc, rc);
      if (r.min.value !== 0 || r.max.value !== 1) off.push(`values ${lc}${rc}`);
      if (r.min.attained !== minAtt || r.max.attained !== maxAtt) off.push(`attained ${lc}${rc}`);
    }
    expect(off).toEqual([]);
  });

  it('sin x on [0, 2π]: max 1 at π/2 and min −1 at 3π/2, attained for all four end types', () => {
    const off: string[] = [];
    for (const lc of [true, false]) {
      for (const rc of [true, false]) {
        const r = extremes('sin', 0, 2 * Math.PI, lc, rc);
        if (r.max.value !== 1 || !r.max.attained || r.max.at[0] !== Math.PI / 2) off.push(`max ${lc}${rc}`);
        if (r.min.value !== -1 || !r.min.attained || r.min.at[0] !== (3 * Math.PI) / 2) off.push(`min ${lc}${rc}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('sin x on [0, π/2]: the maximum 1 is attained only if the right end is closed (the critical point is the end)', () => {
    expect(extremes('sin', 0, Math.PI / 2, true, true).max).toMatchObject({ value: 1, attained: true });
    expect(extremes('sin', 0, Math.PI / 2, true, false).max).toMatchObject({ value: 1, attained: false });
  });

  it('the exact extremes agree with a brute-force grid over the closed interval (x², sin, 1/x on [0.5, 3])', () => {
    const off: string[] = [];
    const cases: [keyof typeof EXTREME, number, number][] = [
      ['x2', -1, 2],
      ['sin', 0, 2 * Math.PI],
      ['recip', 0.5, 3],
    ];
    for (const [id, a, b] of cases) {
      const f = EXTREME[id].f;
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i <= 2000; i++) {
        const v = f(a + ((b - a) * i) / 2000);
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
      const r = extremes(id, a, b, true, true);
      if (Math.abs(r.max.value - hi) > 1e-5 || Math.abs(r.min.value - lo) > 1e-5) off.push(id);
    }
    expect(off).toEqual([]);
  });
});
