import { describe, expect, it } from 'vitest';
import { centralDiff, relativeError } from '~/math/analysis';
import { simpson } from '~/math/multivar';
import {
  AREA,
  AREA_IDS,
  DISK_IDS,
  REV,
  REV_IDS,
  SHELL_IDS,
  formsOf,
  partialVolume,
  sliceAt,
  sliceSum,
  stripAt,
  stripRange,
  volume,
} from '~/math/solids';

// Every stored closed form was recomputed with sympy on 2026-11-27 (scratch script, and the brief's ch8_presets.py):
// intersections 2 − x² = x ⇔ x ∈ {−2, 1}; x³ = 4x ⇔ x ∈ {−2, 0, 2}; y² − 1 = y + 1 ⇔ y ∈ {−1, 2};
// areas 9/2, 4 + 4, 9/2, and yint in x-strips ∫₋₁⁰ 2√(x + 1) dx = 4/3, ∫₀³ (√(x + 1) − (x − 1)) dx = 19/6;
// P(x) − ∫ₐˣ A(t) dt simplifies to 0 and P(a) = 0 for all eight solids; volumes 2π/3, π²/2, 32π/3, 8π/5, 11π/6, π/2, 2π²,
// 2π/3.

const near = (num: number, exact: number, tol: number) => Math.abs(num - exact) <= tol * Math.max(1, Math.abs(exact));
const PI = Math.PI;

describe('exact identities: the regions between two graphs', () => {
  it('every stored intersection is a root of f − g', () => {
    const off: string[] = [];
    for (const id of AREA_IDS) {
      const s = AREA[id];
      for (const c of s.cuts) if (Math.abs(s.f(c) - s.g(c)) > 1e-12) off.push(`${id} at ${c}: f − g = ${s.f(c) - s.g(c)}`);
      // and the plane points are on both curves
      for (const pt of s.points) {
        const v = s.variable === 'x' ? pt.x : pt.y;
        const w = s.variable === 'x' ? pt.y : pt.x;
        if (Math.abs(s.f(v) - w) > 1e-12 || Math.abs(s.g(v) - w) > 1e-12) off.push(`${id} point ${pt.text} off a curve`);
      }
    }
    expect(off).toEqual([]);
  });

  it('f − g changes sign at each interior cut and nowhere else between the cuts (a grid probe)', () => {
    const off: string[] = [];
    for (const id of AREA_IDS) {
      const s = AREA[id];
      for (let i = 0; i + 1 < s.cuts.length; i++) {
        const [lo, hi] = [s.cuts[i], s.cuts[i + 1]];
        const sg = Math.sign(s.f((lo + hi) / 2) - s.g((lo + hi) / 2));
        for (let k = 1; k < 200; k++) {
          const v = lo + ((hi - lo) * k) / 200;
          if (Math.sign(s.f(v) - s.g(v)) !== sg) off.push(`${id} sign change inside (${lo}, ${hi}) at ${v}`);
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('each form: top ≥ bottom, the top is the named curve, and the stored area equals Simpson of top − bottom', () => {
    const off: string[] = [];
    for (const id of AREA_IDS) {
      const s = AREA[id];
      for (const alt of s.alt ? [false, true] : [false]) {
        for (const fm of formsOf(id, alt).forms) {
          for (let k = 0; k <= 100; k++) {
            const v = fm.lo + ((fm.hi - fm.lo) * k) / 100;
            if (fm.top(v) - fm.bottom(v) < -1e-12) off.push(`${id}${alt ? ' alt' : ''} top < bottom at ${v}`);
            if (!alt) {
              const named = fm.upper === 'f' ? s.f(v) : s.g(v);
              if (Math.abs(named - fm.top(v)) > 1e-12) off.push(`${id} the top is not ${fm.upper} at ${v}`);
            }
          }
          // √ has an infinite slope at the vertex of the yint parabola: substitute x = −1 + s² there (smooth integrand)
          const num =
            alt && fm.lo === -1
              ? simpson((t) => (fm.top(-1 + t * t) - fm.bottom(-1 + t * t)) * 2 * t, 0, Math.sqrt(fm.hi + 1), 2000)
              : simpson((v) => fm.top(v) - fm.bottom(v), fm.lo, fm.hi, 2000);
          if (!near(num, fm.area, 1e-10)) off.push(`${id}${alt ? ' alt' : ''} [${fm.lo}, ${fm.hi}]: Simpson ${num}, stored ${fm.area}`);
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('the whole area equals Simpson of |f − g| between the outer cuts, and the sum of the parts, in both cuts of yint', () => {
    const off: string[] = [];
    for (const id of AREA_IDS) {
      const s = AREA[id];
      let num = 0;
      for (let i = 0; i + 1 < s.cuts.length; i++) num += simpson((v) => Math.abs(s.f(v) - s.g(v)), s.cuts[i], s.cuts[i + 1], 2000);
      if (!near(num, s.area, 1e-10)) off.push(`${id}: Simpson ${num}, stored ${s.area}`);
      for (const alt of s.alt ? [false, true] : [false]) {
        const sum = formsOf(id, alt).forms.reduce((acc, fm) => acc + fm.area, 0);
        if (!near(sum, s.area, 1e-14)) off.push(`${id}${alt ? ' alt' : ''}: parts ${sum}, whole ${s.area}`);
      }
    }
    expect(off).toEqual([]);
    expect([AREA.parab.area, AREA.cross.area, AREA.yint.area]).toEqual([4.5, 8, 4.5]);
  });

  it('the two cuts of yint describe the same region: a point is inside by x-strips iff inside by y-strips', () => {
    const off: string[] = [];
    const s = AREA.yint;
    for (let i = 0; i <= 60; i++)
      for (let j = 0; j <= 60; j++) {
        const x = -1.2 + (4.4 * i) / 60 + 1e-3;
        const y = -1.2 + (3.4 * j) / 60 + 1e-3;
        const sy = stripAt('yint', y);
        const sx = stripAt('yint', x, true);
        const inY = !!sy && x > sy.bottom && x < sy.top;
        const inX = !!sx && y > sx.bottom && y < sx.top;
        if (inY !== inX) off.push(`(${x.toFixed(3)}, ${y.toFixed(3)}): y-strips ${inY}, x-strips ${inX}`);
      }
    expect(off).toEqual([]);
    expect(stripRange('yint', true)).toEqual([-1, 3]);
    expect(s.alt?.forms.map((f) => f.areaText)).toEqual(['4/3', '19/6']);
  });

  it('stripAt: cross takes x³ on top left of 0 and 4x right of 0; outside the region it is null', () => {
    expect(stripAt('cross', -1)?.form.upper).toBe('f');
    expect(stripAt('cross', 1)?.form.upper).toBe('g');
    expect(stripAt('cross', -1)?.height).toBe(3);
    expect(stripAt('cross', 1)?.height).toBe(3);
    expect(stripAt('parab', 1.5)).toBeNull();
    expect(stripAt('parab', -0.5)?.height).toBe(2.25);
  });
});

describe('exact identities: the solids of revolution', () => {
  it('partialVolume′ = the slice area (centralDiff on a grid inside every [a, b])', () => {
    const off: string[] = [];
    for (const id of REV_IDS) {
      const s = REV[id];
      for (let k = 1; k < 40; k++) {
        const x = s.a + ((s.b - s.a) * k) / 40;
        const d = centralDiff((t) => partialVolume(id, t), x, 1e-5);
        const A = sliceAt(id, x).area;
        if (!near(d, A, 1e-7)) off.push(`${id} x=${x.toFixed(3)}: P′=${d}, A=${A}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('partialVolume(a) = 0 and partialVolume(b) = volume', () => {
    const off: string[] = [];
    for (const id of REV_IDS) {
      const s = REV[id];
      if (Math.abs(partialVolume(id, s.a)) > 1e-12) off.push(`${id}: P(a) = ${partialVolume(id, s.a)}`);
      if (relativeError(partialVolume(id, s.b), volume(id)) > 1e-14) off.push(`${id}: P(b) = ${partialVolume(id, s.b)}, V = ${volume(id)}`);
    }
    expect(off).toEqual([]);
  });

  it('the stored volumes are the brief’s exact values', () => {
    const exact: Record<string, number> = {
      cone: (2 * PI) / 3,
      sine: (PI * PI) / 2,
      sphere: (32 * PI) / 3,
      washer: (8 * PI) / 5,
      offaxis: (11 * PI) / 6,
      bowl: PI / 2,
      sinshell: 2 * PI * PI,
      'cone-y': (2 * PI) / 3,
    };
    const off = REV_IDS.filter((id) => relativeError(volume(id), exact[id]) > 1e-15);
    expect(off).toEqual([]);
  });

  it('cone and cone-y are the cone πr²h/3 with r = 1, h = 2; sphere is (4/3)π·2³', () => {
    const cone = (PI * 1 * 1 * 2) / 3;
    expect(relativeError(volume('cone'), cone)).toBeLessThan(1e-15);
    expect(relativeError(volume('cone-y'), cone)).toBeLessThan(1e-15);
    expect(relativeError(volume('sphere'), (4 / 3) * PI * 8)).toBeLessThan(1e-15);
  });

  it('the volume equals Simpson of the slice area over [a, b]', () => {
    const off: string[] = [];
    for (const id of REV_IDS) {
      const s = REV[id];
      // offaxis: A = π(x + 2√x) has an infinite slope at 0; substitute x = t² there
      const num = id === 'offaxis' ? simpson((t) => sliceAt(id, t * t).area * 2 * t, 0, 1, 2000) : simpson((x) => sliceAt(id, x).area, s.a, s.b, 2000);
      if (!near(num, volume(id), 1e-10)) off.push(`${id}: Simpson ${num}, V ${volume(id)}`);
    }
    expect(off).toEqual([]);
  });

  it('radii and shells: R ≥ r ≥ 0 for disks and washers, r = 0 exactly for disks, height ≥ 0 for shells; R − r is the region’s height', () => {
    const off: string[] = [];
    for (const id of DISK_IDS) {
      const s = REV[id];
      for (let k = 0; k <= 50; k++) {
        const x = s.a + ((s.b - s.a) * k) / 50;
        const sl = sliceAt(id, x);
        if (sl.kind === 'shell') {
          off.push(`${id} is a shell`);
          continue;
        }
        if (!(sl.R >= sl.r - 1e-12 && sl.r >= 0)) off.push(`${id} x=${x}: R=${sl.R} r=${sl.r}`);
        if (s.method === 'disk' && sl.r !== 0) off.push(`${id} disk with r=${sl.r}`);
        if (Math.abs(sl.R - sl.r - (s.top(x) - s.bottom(x))) > 1e-12) off.push(`${id} x=${x}: R − r ≠ top − bottom`);
      }
    }
    for (const id of SHELL_IDS) {
      const s = REV[id];
      for (let k = 0; k <= 50; k++) {
        const x = s.a + ((s.b - s.a) * k) / 50;
        const sl = sliceAt(id, x);
        if (sl.kind !== 'shell') off.push(`${id} is not a shell`);
        else if (!(sl.height >= -1e-12 && sl.radius === x)) off.push(`${id} x=${x}: radius ${sl.radius}, height ${sl.height}`);
      }
    }
    expect(off).toEqual([]);
    expect(sliceAt('offaxis', 0.25)).toMatchObject({ kind: 'washer', R: 1.5, r: 1 });
  });

  it('partialVolume is NaN outside [a, b]', () => {
    expect(partialVolume('cone', -0.1)).toBeNaN();
    expect(partialVolume('cone', 2.1)).toBeNaN();
  });
});

describe('analytic limits: a sum of n slices tends to the volume', () => {
  it('the midpoint sum of n slices approaches V, its error shrinking about 4× when n doubles (smooth slice areas)', () => {
    const off: string[] = [];
    for (const id of REV_IDS) {
      const V = volume(id);
      const e = [50, 100, 200, 400].map((n) => Math.abs(sliceSum(id, n) - V));
      if (!(e[3] / V < 1e-3)) off.push(`${id}: relative error at n = 400 is ${e[3] / V}`);
      // sin²x on [0, π]: the midpoint sum is already exact up to rounding (its error ~1e-15 cannot shrink further)
      for (let i = 0; i + 1 < e.length; i++) if (e[i + 1] > 1e-12 && !(e[i + 1] < e[i])) off.push(`${id}: error grew from ${e[i]} to ${e[i + 1]}`);
      // offaxis's A(x) = π(x + 2√x) is not smooth at 0 (the error falls like n^(−3/2)); the others are smooth
      if (id !== 'offaxis' && e[3] > 1e-12) {
        const ratio = e[2] / e[3];
        if (!(ratio > 3.8 && ratio < 4.2)) off.push(`${id}: error ratio at n = 200 → 400 is ${ratio}`);
      }
    }
    expect(off).toEqual([]);
  });
});
