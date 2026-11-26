import { expect, test, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/3-3/';
const FIGS = ['fig-3-3a', 'fig-3-3b'];
const TASKS = [
  'fig-3-3a:times-i',
  'fig-3-3a:unit-rotate',
  'fig-3-3a:real-product',
  'fig-3-3a:div-conj',
  'fig-3-3b:power-unit',
  'fig-3-3b:power-real',
  'fig-3-3b:power-shrink',
];

/** Bring a figure into view, wait for its island, stop text steps from driving it, and reset it. */
async function ready(page: Page, fig: string) {
  const f = page.locator(`#${fig}`);
  await f.scrollIntoViewIfNeeded();
  await hydrated(f.locator('canvas').first());
  await freezeSteps(page);
  await f.getByRole('button', { name: 'איפוס' }).click();
  return f;
}

// ComplexPlane's readout (src/sims/ComplexPlane.tsx): one element per quantity, each with data-readout.
//   multiply: zw ("(2 + i)(1 + i) = 1 + 3i"), mods, args, argzw, div
//   power:    z, rn, ntheta ("3π/2 (270°)"), zn
// Negative numbers use U+2212.
const readout = (page: Page, fig: string, id: string) => page.locator(`#${fig} [data-readout="${id}"]`);

test.describe('lesson 3.3: polar form and Euler’s formula', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('הצורה הקוטבית ונוסחת אוילר');
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

  test('each figure starts in its own mode: (2 + i)(1 + i) = 1 + 3i, and the sixth power of 1.1 cis 45°', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page, 'fig-3-3a');
    await expect(readout(page, 'fig-3-3a', 'zw')).toContainText('1 + 3i');
    await ready(page, 'fig-3-3b');
    await expect(readout(page, 'fig-3-3b', 'ntheta')).toContainText('270°');
  });

  test('text steps drive the figures: w = 2 stretches, w = 0.8 + 0.6i only turns, the powers of cis 30° close at 360°', async ({ page }) => {
    await page.goto(LESSON);
    const mult = page.locator('#fig-3-3a');
    await mult.scrollIntoViewIfNeeded();
    await hydrated(mult.locator('canvas').first());
    const multSteps = page.locator('.step[data-fig="fig-3-3a"]');
    // 3 Explore steps, 1 in "multiplication: rotation and stretch", 1 in the special cases
    await expect(multSteps).toHaveCount(5);
    await multSteps.nth(1).scrollIntoViewIfNeeded();
    await multSteps.nth(1).click();
    await expect(readout(page, 'fig-3-3a', 'zw')).toContainText('4 + 2i');
    await multSteps.nth(4).scrollIntoViewIfNeeded();
    await multSteps.nth(4).click();
    // (2 + i)(0.8 + 0.6i) = 1 + 2i, the same length √5 as z
    await expect(readout(page, 'fig-3-3a', 'zw')).toContainText('1 + 2i');

    const pow = page.locator('#fig-3-3b');
    await pow.scrollIntoViewIfNeeded();
    await hydrated(pow.locator('canvas').first());
    const powSteps = page.locator('.step[data-fig="fig-3-3b"]');
    await expect(powSteps).toHaveCount(3);
    await powSteps.nth(1).scrollIntoViewIfNeeded();
    await powSteps.nth(1).click();
    await expect(readout(page, 'fig-3-3b', 'ntheta')).toContainText('360°');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-3-3"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the reader presses w = i: z turns a quarter turn and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-3a');
    await fig.getByRole('button', { name: 'w = i', exact: true }).click();
    // (2 + i)·i = −1 + 2i
    await expect(readout(page, 'fig-3-3a', 'zw')).toContainText('−1 + 2i');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-3-3a:times-i']).toBeTruthy();
  });

  test('the Check has its five bank questions, and 16 is graded correct for Q-3.3-power', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-3.3-polar-form', 'Q-3.3-product-arg', 'Q-3.3-rotate-i', 'Q-3.3-power', 'Q-3.3-demoivre-truths']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-3.3-power"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-numeric input').fill('16');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-3-3-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-3-3-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-3-3-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors other pages link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'polar-form',
      'trig-reminder',
      'polar-positive-r',
      'polar-multiply',
      'multiply-geometry',
      'multiply-by-i',
      'rotate-about-point',
      'de-moivre',
      'demoivre-trig',
      'euler-formula',
      'polar-physics',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
