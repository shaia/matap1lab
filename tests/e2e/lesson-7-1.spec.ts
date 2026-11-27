import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/7-1/';
const FIGS = ['fig-7-1a', 'fig-7-1b'];
const TASKS = [
  'fig-7-1a:family-parallel',
  'fig-7-1a:family-through',
  'fig-7-1a:family-split',
  'fig-7-1b:area-flat',
  'fig-7-1b:area-strip',
  'fig-7-1b:area-negative',
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

// AntiLab's hooks (src/sims/AntiLab.tsx, header comment): readouts [data-readout=…]
//   family: fn, x, fx, c (C, and C₂ for recip), through (with "נקודה נתונה" on)
//   area:   fn, a, x, area, parts, fx, strip (with "פס צר" on), showf, gauss-note (gauss only)
// controls [data-control=…] input: family x, c, c2, x0, y0; area a, x, dx (value = log10 dx). Toggles and the reset
// are buttons by name. Negative numbers use U+2212.
const readout = (page: Page, fig: string, id: string) => page.locator(`#${fig} [data-readout="${id}"]`);

/** Set a range input as a student would: the value, then an input event. */
const slide = (s: Locator, v: number) =>
  s.evaluate((el: HTMLInputElement, value) => {
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);

test.describe('lesson 7.1: the antiderivative and the fundamental theorem', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('פונקציה קדומה והמשפט היסודי');
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

  test('both figures start on 3x² − 2: the family x³ − 2x + C with C = 0, and its area from 0', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page, 'fig-7-1a');
    await expect(readout(page, 'fig-7-1a', 'fn')).toContainText('3x² − 2');
    await expect(readout(page, 'fig-7-1a', 'fn')).toContainText('x³ − 2x');
    await expect(readout(page, 'fig-7-1a', 'c')).toContainText('C = 0');
    await ready(page, 'fig-7-1b');
    await expect(readout(page, 'fig-7-1b', 'fn')).toContainText('3x² − 2');
    await expect(readout(page, 'fig-7-1b', 'a')).toContainText('a = 0');
  });

  test('text steps drive the family figure: a given point, and two constants for 1/x', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-7-1a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator('.step[data-fig="fig-7-1a"]');
    // Explore 3 (poly, poly through (1, 2), recip); definition cos; plus-c poly; two pieces recip; sin; lorentz
    await expect(steps).toHaveCount(8);

    // the point (1, 2) with C = 0: the bold member x³ − 2x does not pass through it yet
    await steps.nth(1).scrollIntoViewIfNeeded();
    await steps.nth(1).click();
    await expect(readout(page, 'fig-7-1a', 'through')).toContainText('עדיין לא עוברת');

    // 1/x with C = 0 on the right and C₂ = 2 on the left
    await steps.nth(5).scrollIntoViewIfNeeded();
    await steps.nth(5).click();
    await expect(readout(page, 'fig-7-1a', 'fn')).toContainText('ln|x|');
    await expect(readout(page, 'fig-7-1a', 'c')).toContainText('C₂ = 2');
  });

  test('text steps drive the area figure: ln x is the area under 1/t, and e^(−x²) has an area function', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-7-1b');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator('.step[data-fig="fig-7-1b"]');
    // definite poly; area function cos; strip cos; showF cos; flat cos; ln (recip from 1 to e); gauss
    await expect(steps).toHaveCount(7);

    // F(x) − F(a) lies on A(x): the readout says they are equal
    await steps.nth(3).scrollIntoViewIfNeeded();
    await steps.nth(3).click();
    await expect(readout(page, 'fig-7-1b', 'showf')).toContainText('F(x) − F(a)');

    // the area under 1/t from 1 to e is 1
    await steps.nth(5).scrollIntoViewIfNeeded();
    await steps.nth(5).click();
    await expect(readout(page, 'fig-7-1b', 'area')).toContainText(/=\s*1\s*$/);

    // the bell curve: no formula, but the area from 0 to 1 is 0.7468
    await steps.nth(6).scrollIntoViewIfNeeded();
    await steps.nth(6).click();
    await expect(readout(page, 'fig-7-1b', 'area')).toContainText('0.7468');
    await expect(readout(page, 'fig-7-1b', 'gauss-note')).toBeVisible();
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-7-1"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the reader moves C to 3: x³ − 2x + 3 passes through (1, 2), and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-7-1a');
    await fig.getByRole('button', { name: 'נקודה נתונה', exact: true }).click();
    await slide(fig.locator('[data-control="x0"] input'), 1);
    await slide(fig.locator('[data-control="y0"] input'), 2);
    await slide(fig.locator('[data-control="c"] input'), 3);
    await expect(readout(page, 'fig-7-1a', 'through')).toContainText('הפונקציה הקדומה שעוברת דרך הנקודה');
    await expect(readout(page, 'fig-7-1a', 'through')).toContainText('C = 3');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-7-1a:family-through']).toBeTruthy();
  });

  test('the reader narrows the strip under cos x at x = 0.5 to dx = 0.01: strip area / dx is 0.8752, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-7-1b');
    await fig.locator('[data-control="preset"] select').selectOption('cos');
    await slide(fig.locator('[data-control="a"] input'), 0);
    await slide(fig.locator('[data-control="x"] input'), 0.5);
    await fig.getByRole('button', { name: 'פס צר', exact: true }).click();
    await slide(fig.locator('[data-control="dx"] input'), -2);
    await expect(readout(page, 'fig-7-1b', 'strip')).toContainText('0.8752');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-7-1b:area-strip']).toBeTruthy();
  });

  test('the Check has its five bank questions, and 2 is graded correct for Q-7.1-ftc-sin', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-7.1-which-antideriv', 'Q-7.1-power', 'Q-7.1-trig-table', 'Q-7.1-ftc-sin', 'Q-7.1-ftc-constant']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-7.1-ftc-sin"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-numeric input').fill('2');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-7-1-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-7-1-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-7-1-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors the misconception remedies link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'antiderivative',
      'plus-c',
      'two-pieces',
      'table',
      'power-rule',
      'exp-rows',
      'trig-rows',
      'linearity',
      'definite',
      'reversed-limits',
      'ftc',
      'ftc-statement',
      'ftc-recipe',
      'area-flat',
      'ln-area',
      'no-formula',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
