/**
 * Number and index formatting shared by the figures' readouts and descriptions.
 * (Moved out of advinfilab's contraction.ts when the platform was forked.)
 */
const SUB = '₀₁₂₃₄₅₆₇₈₉';
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
export const sub = (k: number) => String(k).replace(/\d/g, (d) => SUB[Number(d)]);
export const sup = (k: number) => String(k).replace(/-/g, '⁻').replace(/\d/g, (d) => SUP[Number(d)]);

/** 6 significant figures, plain between 0.01 and 10⁴, otherwise a·10ⁿ; U+2212 for the minus sign */
export function fmtNum(v: number): string {
  if (!Number.isFinite(v)) return v > 0 ? '∞' : '−∞';
  if (v === 0) return '0';
  const a = Math.abs(v);
  const trim = (s: string) => (s.includes('.') ? s.replace(/\.?0+$/, '') : s);
  let body: string;
  if (a >= 0.01 && a < 1e4) body = trim(Number(a.toPrecision(6)).toFixed(6));
  else {
    const e = Math.floor(Math.log10(a));
    let mant = Number((a / 10 ** e).toPrecision(4));
    let ee = e;
    if (mant >= 10) {
      mant /= 10;
      ee += 1;
    }
    body = `${trim(mant.toFixed(3))}·10${sup(ee)}`;
  }
  return v < 0 ? `−${body}` : body;
}
