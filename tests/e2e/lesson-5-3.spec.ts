import { expect, test, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/5-3/';
const FIGS = ['fig-5-3a', 'fig-5-3b'];
const TASKS = ['fig-5-3a:product-corner', 'fig-5-3b:chain-small', 'fig-5-3b:chain-zero'];

/** Bring a figure into view, wait for its island, stop text steps from driving it, and reset it. */
async function ready(page: Page, fig: string) {
  const f = page.locator(`#${fig}`);
  await f.scrollIntoViewIfNeeded();
  await hydrated(f.locator('canvas').first());
  await freezeSteps(page);
  await f.getByRole('button', { name: 'איפוס' }).click();
  return f;
}

// RulesLab's readout (src/sims/RulesLab.tsx): one element per quantity, each with data-readout.
//   product: pair, x, dx, duv, sum, corner (with its share of Δ(uv)), cornerRatio
//   chain:   fn, x, dx (10⁻ⁿ on whole decades), stretchInner, stretchOuter, stretch, exact (with "ולכן הנגזרת 0" at a zero)
// Negative numbers use U+2212. Sliders: product "הנקודה x", "הצעד Δx"; chain "הנקודה x", "אורך הקטע Δx" (value v
// means Δx = 10⁻ᵛ). Chain preset buttons carry the plain formula, e.g. "sin(x³)".
const readout = (page: Page, fig: string, id: string) => page.locator(`#${fig} [data-readout="${id}"]`);

test.describe('lesson 5.3: the rules of differentiation and the chain rule', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('כללי הגזירה');
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

  test('each figure starts in its own state: x · x² at 2 with Δx = 0.5; (3x + 1)² at 0', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page, 'fig-5-3a');
    // Δ(uv) = 2.5³ − 2³ = 7.625 = strips 2 + 4.5 + corner 1.125
    await expect(readout(page, 'fig-5-3a', 'duv')).toContainText('7.625');
    await expect(readout(page, 'fig-5-3a', 'sum')).toContainText('6.5');
    await expect(readout(page, 'fig-5-3a', 'corner')).toContainText('1.125');
    await ready(page, 'fig-5-3b');
    await expect(readout(page, 'fig-5-3b', 'fn')).toContainText('3x + 1');
    // exact: g′(0) = 3, f′(g(0)) = 2, product 6
    await expect(readout(page, 'fig-5-3b', 'exact')).toContainText('6');
  });

  test('text steps drive the product figure: Δx = 0.05 shrinks the corner', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-5-3a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator('.step[data-fig="fig-5-3a"]');
    // Explore 2 (x · x², x + 1 · 2x + 1); product rule 2 (Δx = 0.5, Δx = 0.05)
    await expect(steps).toHaveCount(4);
    await steps.nth(3).scrollIntoViewIfNeeded();
    await steps.nth(3).click();
    await expect(readout(page, 'fig-5-3a', 'dx')).toContainText('0.05');
    // Δ(uv) = 2.05³ − 8 = 0.615125
    await expect(readout(page, 'fig-5-3a', 'duv')).toContainText('0.6151');
  });

  test('text steps drive the chain figure: e^(−x²) flips the interval, sin(x³) of the notes is positive at 1', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-5-3b');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator('.step[data-fig="fig-5-3b"]');
    // chain rule 1 ((3x + 1)²); negative stretch 1 (e^(−x²)); notes' slip 1 (sin(x³)); at a point 1 (√(1 + x²))
    await expect(steps).toHaveCount(4);

    await steps.nth(1).scrollIntoViewIfNeeded();
    await steps.nth(1).click();
    await expect(readout(page, 'fig-5-3b', 'stretchInner')).toContainText('−2.1');
    await expect(readout(page, 'fig-5-3b', 'exact')).toContainText('−0.735');

    await steps.nth(2).scrollIntoViewIfNeeded();
    await steps.nth(2).click();
    // 3 cos 1 ≈ 1.6209, with a plus sign (the notes write a minus)
    await expect(readout(page, 'fig-5-3b', 'exact')).toContainText('1.6209');
    await expect(readout(page, 'fig-5-3b', 'stretchInner')).toContainText('3.31');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-5-3"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the reader shrinks Δx to 0.05 and the corner task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-3a');
    await fig.getByRole('slider', { name: 'הצעד Δx' }).fill('0.05');
    await expect(readout(page, 'fig-5-3a', 'dx')).toContainText('0.05');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-5-3a:product-corner']).toBeTruthy();
  });

  test('the reader shrinks the interval to 10⁻³: the measured product nears the exact 6', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-3b');
    await fig.getByRole('slider', { name: 'אורך הקטע Δx' }).fill('3');
    await expect(readout(page, 'fig-5-3b', 'dx')).toContainText('10⁻³');
    // (3x + 1)² at 0 with Δx = 10⁻³: Δy/Δx = 6.009
    await expect(readout(page, 'fig-5-3b', 'stretch')).toContainText('6.009');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-5-3b:chain-small']).toBeTruthy();
  });

  test('the reader moves x to 0 in sin(x³): one factor vanishes and the derivative is 0', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-3b');
    await fig.getByRole('button', { name: 'sin(x³)' }).click();
    await fig.getByRole('slider', { name: 'הנקודה x' }).fill('0');
    await expect(readout(page, 'fig-5-3b', 'exact')).toContainText('ולכן הנגזרת 0');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-5-3b:chain-zero']).toBeTruthy();
  });

  test('the Check has its five bank questions, and the product rule is graded correct for Q-5.3-product-basic', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-5.3-product-basic', 'Q-5.3-quotient-check', 'Q-5.3-chain-meaning', 'Q-5.3-chain-table', 'Q-5.3-one-point']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-5.3-product-basic"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-expr input').fill('2x*sin(x)+x^2*cos(x)');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-5-3-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-5-3-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-5-3-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors the misconception remedies link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'rules-idea',
      'sum-rule',
      'basic-derivatives',
      'power-rule',
      'trig-derivatives',
      'exp-derivative',
      'product-rule',
      'quotient-rule',
      'quotient-slip',
      'chain-rule',
      'chain-recipe',
      'power-vs-exp',
      'chain-slip',
      'chain-layers',
      'chain-at-point',
      'combine',
      'check-point',
      'rules-physics',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
