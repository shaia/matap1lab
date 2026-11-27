import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/5-2/';
const FIG = 'fig-5-2a';
const TASKS = [`${FIG}:linear-small`, `${FIG}:linear-cross`];

/** Bring the figure into view, wait for its island, stop text steps from driving it, and reset it. */
async function ready(page: Page) {
  const f = page.locator(`#${FIG}`);
  await f.scrollIntoViewIfNeeded();
  await hydrated(f.locator('canvas').first());
  await freezeSteps(page);
  await f.getByRole('button', { name: 'איפוס' }).click();
  return f;
}

// DerivLab's readout in mode 'linear' (src/sims/DerivLab.tsx): fn, a ("a = 3, f(a) = 9, f′(a) = 6 (מדויק)"), dx, fx, L,
// Dy, dy, err, ratio, each with data-readout. Negative numbers use U+2212.
const readout = (page: Page, id: string) => page.locator(`#${FIG} [data-readout="${id}"]`);
const slider = (fig: Locator, label: RegExp) =>
  fig.locator('label.slider').filter({ has: fig.page().locator('.slider-label', { hasText: label }) }).locator('input[type="range"]');

test.describe('lesson 5.2: the tangent line, linear approximation and differentials', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('קירוב לינארי');
    await expect(page.locator('.katex-error')).toHaveCount(0);
  });

  test('the figure hydrates and draws, in LTR math space', async ({ page }) => {
    await page.goto(LESSON);
    const c = page.locator(`#${FIG} canvas`).first();
    await c.scrollIntoViewIfNeeded();
    await hydrated(c);
    await expect(c).toHaveCSS('direction', 'ltr');
    await expect.poll(() => inked(c)).toBeGreaterThan(200);
  });

  test('the figure starts on the tangent of notes p. 7: x² at 3, dx = 1, Δy = 7, dy = 6, error 1', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page);
    await expect(readout(page, 'fn')).toContainText('x²');
    await expect(readout(page, 'a')).toContainText('a = 3');
    await expect(readout(page, 'a')).toContainText('f′(a) = 6');
    await expect(readout(page, 'Dy')).toContainText('= 7');
    await expect(readout(page, 'dy')).toContainText('= 6');
    await expect(readout(page, 'err')).toContainText('1');
  });

  test('text steps drive the figure: x³ at 0, sin at 0 (slope 1), x² at 3 with dx = 0.1', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator(`#${FIG}`);
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator(`.step[data-fig="${FIG}"]`);
    // Explore 3 (x², √x, x³ − 3x); tangent 2 (x² at 3, x³ at 0); linear approximation 2 (√x at 4, sin at 0); differential 1
    await expect(steps).toHaveCount(8);

    // x³ at 0: the tangent is the x-axis
    await steps.nth(4).scrollIntoViewIfNeeded();
    await steps.nth(4).click();
    await expect(readout(page, 'fn')).toContainText('x³');
    await expect(readout(page, 'a')).toContainText('f′(a) = 0');

    // sin at 0: the slope 1 of sin h / h → 1
    await steps.nth(6).scrollIntoViewIfNeeded();
    await steps.nth(6).click();
    await expect(readout(page, 'fn')).toContainText('sin x');
    await expect(readout(page, 'a')).toContainText('f′(a) = 1');

    // x² at 3, dx = 0.1: dy = 0.6, Δy = 0.61, the gap (dx)² = 0.01
    await steps.nth(7).scrollIntoViewIfNeeded();
    await steps.nth(7).click();
    await expect(readout(page, 'dy')).toContainText('0.6');
    await expect(readout(page, 'Dy')).toContainText('0.61');
    await expect(readout(page, 'err')).toContainText('0.01');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator(`.step[data-fig="${FIG}"]`).all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the reader shrinks dx to 0.1: the error is (dx)² = 0.01, a tenth of the step, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page);
    await slider(fig, /הצעד dx/).fill('0.1');
    await expect(readout(page, 'err')).toContainText('0.01');
    await expect(readout(page, 'ratio')).toContainText('0.1');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})[`${FIG}:linear-small`]).toBeTruthy();
  });

  test('on x³ − 3x at 2 the reader finds the second meeting point x = −4 (dx = −6) and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator(`#${FIG}`);
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    // the third Explore step switches to x³ − 3x at a = 2 (the figure has no function buttons); then freeze the steps
    const steps = page.locator(`.step[data-fig="${FIG}"]`);
    await steps.nth(2).scrollIntoViewIfNeeded();
    await steps.nth(2).click();
    await expect(readout(page, 'fn')).toContainText('x³ − 3x');
    await freezeSteps(page);
    await fig.scrollIntoViewIfNeeded();
    await slider(fig, /הצעד dx/).fill('-6');
    await expect(readout(page, 'fx')).toContainText('−52');
    await expect(readout(page, 'L')).toContainText('−52');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})[`${FIG}:linear-cross`]).toBeTruthy();
  });

  test('the Check has its five bank questions, and 2.025 is graded correct for Q-5.2-sqrt-approx', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-5.2-sqrt-approx', 'Q-5.2-notation-same', 'Q-5.2-dy-vs-Dy', 'Q-5.2-relative-error', 'Q-5.2-units']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-5.2-sqrt-approx"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-numeric input').fill('2.025');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-5-2-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-5-2-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-5-2-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors the misconception remedies link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'tangent',
      'tangent-recipe',
      'slope-is-number',
      'linearity',
      'tangent-crosses',
      'linear-approx',
      'why-linear',
      'approx-near',
      'small-angle',
      'near-zero-list',
      'differential',
      'dy-vs-Dy',
      'error-estimate',
      'relative-error',
      'notation',
      'evaluate-after',
      'units',
      'linear-physics',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
