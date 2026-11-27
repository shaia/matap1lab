import { describe, expect, it } from 'vitest';
import { grade, parseNumber } from '~/assessment/check';
import { compileExpr, evalConstant, normalizeExpr, sameFunction } from '~/assessment/expr';
import type { Question } from '~/content.config';

const spec = (over: Partial<Parameters<typeof sameFunction>[2]> = {}) => ({
  variables: ['x'],
  domain: [-2, 2] as [number, number],
  upToConstant: false,
  seed: 'test',
  ...over,
});

describe('normalizeExpr: hand-written notation becomes mathjs syntax', () => {
  it('reads π, √, ln, arctan, |…|, · and the minus sign', () => {
    expect(normalizeExpr('2π')).toBe('2pi');
    expect(normalizeExpr('√(x+1)')).toBe('sqrt(x+1)');
    expect(normalizeExpr('√x')).toBe('sqrt(x)');
    expect(normalizeExpr('ln|x|')).toBe('log(abs(x))');
    expect(normalizeExpr('arctan(x)')).toBe('atan(x)');
    expect(normalizeExpr('2·x − 1')).toBe('2*x - 1');
  });
  it('applies a function written without parentheses to one short argument', () => {
    expect(normalizeExpr('sin x')).toBe('sin(x)');
    expect(normalizeExpr('ln 2')).toBe('log(2)');
    expect(normalizeExpr('cos 2t')).toBe('cos(2t)');
  });
});

describe('sameFunction: equivalent forms are accepted', () => {
  it('accepts algebraically equal forms of a derivative', () => {
    expect(sameFunction('2 sin(x) cos(x)', 'sin(2x)', spec())).toBe(true);
    expect(sameFunction('x e^x + e^x', '(x+1)*exp(x)', spec())).toBe(true);
    expect(sameFunction('1/(1+x^2)', 'd', spec({ variables: ['d'] }))).toBe(false);
  });
  it('rejects a wrong sign and a missing factor', () => {
    expect(sameFunction('-sin(2x)', 'sin(2x)', spec())).toBe(false);
    expect(sameFunction('sin(2x)', '2*sin(2x)', spec())).toBe(false);
  });
  it('an antiderivative is right up to a constant, with or without a typed + C', () => {
    const anti = spec({ upToConstant: true });
    expect(sameFunction('sin(x)^2/2', '-cos(2x)/4', anti)).toBe(true);
    expect(sameFunction('x^3/3 + 7', 'x^3/3', anti)).toBe(true);
    expect(sameFunction('x^3/3 + C', 'x^3/3', anti)).toBe(true);
    expect(sameFunction('x^3', 'x^3/3', anti)).toBe(false);
    // without upToConstant a shifted answer is wrong
    expect(sameFunction('x^3/3 + 7', 'x^3/3', spec())).toBe(false);
  });
  it('samples only where the key is defined: ln x on a box with x > 0', () => {
    const pos = spec({ domain: [0.2, 3] });
    expect(sameFunction('ln(x^2)', '2 log(x)', pos)).toBe(true);
    expect(sameFunction('ln|x|', 'log(x)', pos)).toBe(true);
  });
  it('reads superscript digits as powers, as a phone keyboard types them: u², x⁻¹, t¹⁰', () => {
    expect(normalizeExpr('u²')).toBe('u^(2)');
    expect(normalizeExpr('x⁻¹')).toBe('x^(-1)');
    const u = spec({ variables: ['u'], domain: [-3, 3] });
    expect(sameFunction('2-√(1+u²)', '2 - sqrt(1 + u^2)', u)).toBe(true);
    expect(sameFunction('x⁻¹ + t¹⁰', 'x^(-1) + t^10', spec({ variables: ['x', 't'], domain: [0.5, 2] }))).toBe(true);
    expect(sameFunction('2x³', '2*x^3', spec())).toBe(true);
  });

  it('reads a variable right before "(" as a product, as formulas are printed: n(n+1)(2n+1)', () => {
    expect(normalizeExpr('n(n+1)')).toBe('n*(n+1)');
    expect(normalizeExpr('sin(x)')).toBe('sin(x)');
    const n = spec({ variables: ['n'], domain: [1, 50] });
    expect(sameFunction('27/n^3 * n(n+1)(2n+1)/6', '9*(n+1)*(2*n+1)/(2*n^2)', n)).toBe(true);
    expect(sameFunction('x(x+1)', 'x^2+x', spec())).toBe(true);
  });
  it('handles several variables', () => {
    const xy = spec({ variables: ['x', 'y'] });
    expect(sameFunction('y^2 + 2x y', 'y*(y + 2*x)', xy)).toBe(true);
    expect(sameFunction('y^2 + x y', 'y*(y + 2*x)', xy)).toBe(false);
  });
});

describe('compileExpr: errors name the problem', () => {
  it('reports an unknown variable by name', () => {
    const c = compileExpr('x + y', ['x']);
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.error).toContain('y');
  });
  it('reports a formula that does not parse', () => {
    expect(compileExpr('sin(x', ['x']).ok).toBe(false);
  });
  it('accepts function names that are not variables', () => {
    expect(compileExpr('exp(x) + sqrt(x)', ['x']).ok).toBe(true);
  });
});

describe('exact constants in numeric answers', () => {
  it('evaluates π, √, ln and e exactly', () => {
    expect(evalConstant('3π/2')).toBeCloseTo((3 * Math.PI) / 2, 12);
    expect(evalConstant('2√3')).toBeCloseTo(2 * Math.sqrt(3), 12);
    expect(evalConstant('ln 2')).toBeCloseTo(Math.LN2, 12);
    expect(evalConstant('e^2')).toBeCloseTo(Math.E ** 2, 12);
    expect(evalConstant('x+1')).toBeNull();
  });
  it('parseNumber keeps plain numbers and falls back to exact values', () => {
    expect(parseNumber('0.75')).toBe(0.75);
    expect(parseNumber('3/4')).toBe(0.75);
    expect(parseNumber('2.5e-3')).toBe(0.0025);
    expect(parseNumber('π/4')).toBeCloseTo(Math.PI / 4, 12);
    expect(parseNumber('(1+√2)/2')).toBeCloseTo((1 + Math.SQRT2) / 2, 12);
    expect(parseNumber('1/(2+√3)/4')).toBeCloseTo(1 / (2 + Math.sqrt(3)) / 4, 12);
    expect(parseNumber('1/0')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
  });
});

describe('grade: expr questions', () => {
  const q = {
    id: 'Q-7.3-test',
    type: 'expr',
    objectives: ['OBJ-7.3-1'],
    prompt: '',
    qualitative: false,
    level: 'basic',
    hints: [],
    confidence: true,
    shuffle: true,
    answer: 'x*exp(x) - exp(x)',
    answerTex: '$xe^x-e^x+C$',
    variables: ['x'],
    domain: [-2, 2],
    upToConstant: true,
    correctFeedback: 'ok',
    wrongFeedback: 'no',
    commonWrong: [{ expr: 'x*exp(x)', feedback: 'forgot the second term', misconception: 'MC-parts' }],
  } as unknown as Question;
  it('accepts the key up to a constant and shows the answer', () => {
    // a space before "(" is a product: e^x·(x−1), not e^(x(x−1))
    const v = grade(q, { type: 'expr', text: 'e^x (x-1) + C' });
    expect(v.correct).toBe(true);
    expect(v.feedback.join(' ')).toContain('xe^x');
  });
  it('traces a known wrong formula to its misconception', () => {
    expect(grade(q, { type: 'expr', text: 'x e^x' })).toMatchObject({ correct: false, misconception: 'MC-parts' });
  });
  it('names a sign error', () => {
    expect(grade(q, { type: 'expr', text: 'exp(x) - x exp(x)' }).feedback[0]).toContain('הסימן');
  });
});
