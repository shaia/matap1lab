import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/8-4/';
const FIGS = ['fig-8-4a', 'fig-8-4b'];
const TASKS = [
  'fig-8-4a:nr-convex',
  'fig-8-4a:nr-refine',
  'fig-8-4a:nr-simpson',
  'fig-8-4b:err-double',
  'fig-8-4b:err-compare',
];

/** Bring a figure into view, wait for its island, stop text steps from driving it, and reset it. */
async function ready(page: Page, fig: string) {
  const f = page.locator(`#${fig}`);
  await f.scrollIntoViewIfNeeded();
  await hydrated(f.locator('canvas').first());
  await freezeSteps(page);
  await f.getByRole('button', { name: 'איפוס', exact: true }).click();
  return f;
}

// NumericLab's hooks (src/sims/NumericLab.tsx, header comment): readouts [data-readout=…]
//   rules: fn, n, approx, exact, error, bound, other (with both), even (Simpson chosen)
//   error: fn, n, err-trap, err-simp, ratio-trap, ratio-simp, compare
// controls: [data-control="preset"] select; [data-control="n"] input (rules: n; error: log₂ n, 1…8). Buttons by name
// (exact): "טרפז", "סימפסון", "השוואה לכלל השני", "איפוס". Numbers use U+2212 for minus.
const readout = (page: Page, fig: string, id: string) => page.locator(`#${fig} [data-readout="${id}"]`);

/** Set a range input as a student would: the value, then an input event. */
const slide = (s: Locator, v: number) =>
  s.evaluate((el: HTMLInputElement, value) => {
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);

const ticked = async (page: Page, id: string) => ((await progress(page))?.tasks ?? {})[id];

test.describe('lesson 8.4: numerical integration', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('שיטות נומריות');
    await expect(page.locator('.katex-error')).toHaveCount(0);
  });

  test('the two figures hydrate and draw, in LTR math space', async ({ page }) => {
    await page.goto(LESSON);
    for (const fig of FIGS) {
      const c = page.locator(`#${fig} canvas`).first();
      await c.scrollIntoViewIfNeeded();
      await hydrated(c);
      await expect(c).toHaveCSS('direction', 'ltr');
      await expect.poll(() => inked(c)).toBeGreaterThan(200);
    }
  });

  test('the figures start on 1/x with two trapezoids, and on eˣ at n = 4', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page, 'fig-8-4a');
    await expect(readout(page, 'fig-8-4a', 'fn')).toContainText('1/x');
    await expect(readout(page, 'fig-8-4a', 'n')).toContainText('n = 2');
    await expect(readout(page, 'fig-8-4a', 'approx')).toContainText('כלל הטרפז');
    await ready(page, 'fig-8-4b');
    await expect(readout(page, 'fig-8-4b', 'fn')).toContainText('eˣ');
    await expect(readout(page, 'fig-8-4b', 'n')).toContainText('n = 4');
  });

  test('text steps drive the rules figure: Simpson on 1/x with n = 4, and a cubic Simpson gets exactly', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-8-4a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator('.step[data-fig="fig-8-4a"]');
    // Explore 3 (exp 8, recip 2, recip 4); why-numeric gauss; trapezoid recip 4; convex exp 2; concave sin 4;
    // Simpson recip 4 with both; cubic Simpson 2
    await expect(steps).toHaveCount(9);

    // the trapezoid on 1/x with n = 4: T₄ = 1171/1680 = 0.6970238095
    await steps.nth(4).scrollIntoViewIfNeeded();
    await steps.nth(4).click();
    await expect(readout(page, 'fig-8-4a', 'approx')).toContainText('0.6970238095');

    // Simpson on the same five values, with the trapezoid dashed: S₄ = 1747/2520 = 0.6932539683
    await steps.nth(7).scrollIntoViewIfNeeded();
    await steps.nth(7).click();
    await expect(readout(page, 'fig-8-4a', 'approx')).toContainText('0.6932539683');
    await expect(readout(page, 'fig-8-4a', 'even')).toBeVisible();
    await expect(readout(page, 'fig-8-4a', 'other')).toContainText('0.6970238095');

    // x³ with one parabola: the error is 0
    await steps.nth(8).scrollIntoViewIfNeeded();
    await steps.nth(8).click();
    await expect(readout(page, 'fig-8-4a', 'fn')).toContainText('x³');
    await expect(readout(page, 'fig-8-4a', 'error')).toContainText(/=\s*0\s*$/);
  });

  test('text steps drive the error figure: sin x at n = 8 shows the trapezoid ratio ≈ 4', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-8-4b');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator('.step[data-fig="fig-8-4b"]');
    // error-rate exp 4; doubling sin 8; gauss 4; choose-n sin 16
    await expect(steps).toHaveCount(4);
    await steps.nth(1).scrollIntoViewIfNeeded();
    await steps.nth(1).click();
    await expect(readout(page, 'fig-8-4b', 'fn')).toContainText('sin x');
    await expect(readout(page, 'fig-8-4b', 'n')).toContainText('n = 8');
    await expect(readout(page, 'fig-8-4b', 'ratio-trap')).toContainText('≈ 4');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-8-4"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the reader takes eˣ down to three trapezoids: the chords lie above, the error is positive, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-8-4a');
    await fig.locator('[data-control="preset"] select').selectOption('exp');
    await slide(fig.locator('[data-control="n"] input'), 3);
    await expect(readout(page, 'fig-8-4a', 'n')).toContainText('n = 3');
    // T₃ − I > 0: no minus sign in the error
    await expect(readout(page, 'fig-8-4a', 'error')).not.toContainText('− I = −');
    await expect.poll(() => ticked(page, 'fig-8-4a:nr-convex')).toBeTruthy();
  });

  test('the reader switches to Simpson: the even-n note appears, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-8-4a');
    await fig.getByRole('button', { name: 'סימפסון', exact: true }).click();
    await expect(readout(page, 'fig-8-4a', 'even')).toBeVisible();
    await expect(readout(page, 'fig-8-4a', 'approx')).toContainText('כלל סימפסון');
    await expect.poll(() => ticked(page, 'fig-8-4a:nr-simpson')).toBeTruthy();
  });

  test('the reader moves the error marker to n = 64: Simpson wins by more than 1000, and both tasks are ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-8-4b');
    await slide(fig.locator('[data-control="n"] input'), 6);
    await expect(readout(page, 'fig-8-4b', 'n')).toContainText('n = 64');
    const text = (await readout(page, 'fig-8-4b', 'compare').locator('b').textContent()) ?? '';
    // sci() writes a ratio ≥ 10⁴ as "m·10ᵏ" with superscript digits
    const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
    const [mant, pow] = text.replace(/−/g, '-').split('·10');
    const exp = pow ? Number([...pow].map((c) => (c === '⁻' ? '-' : String(SUP.indexOf(c)))).join('')) : 0;
    expect(Number(mant) * 10 ** exp).toBeGreaterThan(1000);
    await expect.poll(() => ticked(page, 'fig-8-4b:err-compare')).toBeTruthy();
    await expect.poll(() => ticked(page, 'fig-8-4b:err-double')).toBeTruthy();
  });

  test('the Check has its five bank questions, and 2.75 is graded correct for Q-8.4-trap-basic', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-8.4-trap-basic', 'Q-8.4-simpson-basic', 'Q-8.4-concave', 'Q-8.4-double-trap', 'Q-8.4-choose-method']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-8.4-trap-basic"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-numeric input').fill('2.75');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-8-4-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-8-4-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-8-4-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors the misconception remedies link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'why-numeric',
      'trapezoid',
      'trap-weights',
      'trap-recipe',
      'error-def',
      'trap-convex',
      'simpson',
      'parabola-area',
      'simpson-weights',
      'simpson-even',
      'data-tables',
      'simpson-cubic',
      'error-rate',
      'error-bounds',
      'doubling',
      'choose-n',
      'choose-recipe',
      'bound-max',
      'round-up',
      'choose-method',
      'physics',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
