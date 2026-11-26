import { expect, test, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/3-1/';
const FIGS = ['fig-3-1a', 'fig-3-1b', 'fig-3-1c'];
const TASKS = [
  'fig-3-1a:sum-real',
  'fig-3-1a:sub-length',
  'fig-3-1b:times-i',
  'fig-3-1b:real-product',
  'fig-3-1b:div-conj',
  'fig-3-1c:quadratic-double',
  'fig-3-1c:quadratic-complex',
  'fig-3-1c:quadratic-imag',
];

/** Bring a figure into view, wait for its island, stop text steps from driving it, and reset it. */
async function ready(page: Page, fig: string) {
  const f = page.locator(`#${fig}`);
  await f.scrollIntoViewIfNeeded();
  await hydrated(f.locator('canvas'));
  await freezeSteps(page);
  await f.getByRole('button', { name: 'איפוס' }).click();
  return f;
}

// ComplexPlane's readout (src/sims/ComplexPlane.tsx): one element per quantity, each with data-readout.
//   add:       sum ("(2 + i) + (1 + 2i) = 3 + 3i"), parts, with sub also diff, dist
//   multiply:  zw ("(2 + i)(1 + i) = 1 + 3i"), mods, args, argzw, with div also div
//   quadratic: eq, disc ("Δ = b² − 4c = 16"), roots
// Negative numbers use U+2212.
const readout = (page: Page, fig: string, id: string) => page.locator(`#${fig} [data-readout="${id}"]`);

test.describe('lesson 3.1: arithmetic with complex numbers', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('חשבון עם מספרים מרוכבים');
    await expect(page.locator('.katex-error')).toHaveCount(0);
  });

  test('the three figures hydrate and draw, in LTR math space', async ({ page }) => {
    await page.goto(LESSON);
    for (const fig of FIGS) {
      const c = page.locator(`#${fig} canvas`);
      await expect(c).toHaveCount(1);
      await c.scrollIntoViewIfNeeded();
      await hydrated(c);
      await expect(c).toHaveCSS('direction', 'ltr');
      await expect.poll(() => inked(c)).toBeGreaterThan(200);
    }
  });

  test('each figure starts in its own mode: the sum 3 + 3i, the product 1 + 3i, two real roots', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page, 'fig-3-1a');
    await expect(readout(page, 'fig-3-1a', 'sum')).toContainText('3 + 3i');
    await ready(page, 'fig-3-1b');
    await expect(readout(page, 'fig-3-1b', 'zw')).toContainText('1 + 3i');
    await ready(page, 'fig-3-1c');
    await expect(readout(page, 'fig-3-1c', 'disc')).toContainText('16');
    await expect(readout(page, 'fig-3-1c', 'roots')).toContainText('שני שורשים ממשיים');
  });

  test('text steps drive the figures: (1 + i)² = 2i, then the conjugate pair 1 ± 2i', async ({ page }) => {
    await page.goto(LESSON);
    const mult = page.locator('#fig-3-1b');
    await mult.scrollIntoViewIfNeeded();
    await hydrated(mult.locator('canvas'));
    await expect(page.locator('.step[data-fig="fig-3-1a"]')).toHaveCount(4);
    const multSteps = page.locator('.step[data-fig="fig-3-1b"]');
    // the recipe, the prediction's answer, times i, the conjugate, the division, a real quotient
    await expect(multSteps).toHaveCount(6);
    await multSteps.nth(1).scrollIntoViewIfNeeded();
    await multSteps.nth(1).click();
    await expect(readout(page, 'fig-3-1b', 'zw')).toContainText('= 2i');
    await multSteps.nth(4).scrollIntoViewIfNeeded();
    await multSteps.nth(4).click();
    await expect(readout(page, 'fig-3-1b', 'div')).toContainText('2 − i');

    const quad = page.locator('#fig-3-1c');
    await quad.scrollIntoViewIfNeeded();
    await hydrated(quad.locator('canvas'));
    const quadSteps = page.locator('.step[data-fig="fig-3-1c"]');
    await expect(quadSteps).toHaveCount(4);
    await quadSteps.nth(1).scrollIntoViewIfNeeded();
    await quadSteps.nth(1).click();
    await expect(readout(page, 'fig-3-1c', 'roots')).toContainText('שורש כפול');
    await quadSteps.nth(2).scrollIntoViewIfNeeded();
    await quadSteps.nth(2).click();
    await expect(readout(page, 'fig-3-1c', 'roots')).toContainText('זוג צמוד');
    await expect(readout(page, 'fig-3-1c', 'roots')).toContainText('1 + 2i');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-3-1"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the reader presses w = i, the product is iz, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-1b');
    await fig.getByRole('button', { name: 'w = i', exact: true }).click();
    // z = 2 + i after the reset: iz = −1 + 2i
    await expect(readout(page, 'fig-3-1b', 'zw')).toContainText('2i');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-3-1b:times-i']).toBeTruthy();
  });

  test('the Check has its five bank questions, and 14 is graded correct for Q-3.1-product', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-3.1-im-real', 'Q-3.1-product', 'Q-3.1-divide', 'Q-3.1-why-conjugate', 'Q-3.1-quadratic']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-3.1-product"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-numeric input').fill('14');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-3-1-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-3-1-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-3-1-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors other pages link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'complex-definition',
      're-im',
      'sqrt-negative',
      'complex-add',
      'complex-multiply',
      'complex-square',
      'i-powers',
      'bombelli',
      'conjugate',
      'complex-divide',
      'why-conjugate',
      'conj-equations',
      'quadratic-negative',
      'square-reminder',
      'sum-product',
      'conjugate-roots',
      'complex-physics',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
