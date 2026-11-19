import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/2-1/';
const FIGS = ['fig-2-1a', 'fig-2-1b', 'fig-2-1c'];
const TASKS = ['ell-top', 'ell-circle-2', 'ell-unit', 'ell-tall', 'ell-axes-centre'].map((t) => `fig-2-1a:${t}`);

/** Bring a figure into view, wait for its island, stop text steps from driving it, and reset it. */
async function ready(page: Page, fig: string) {
  const f = page.locator(`#${fig}`);
  await f.scrollIntoViewIfNeeded();
  await hydrated(f.locator('canvas'));
  await freezeSteps(page);
  await f.getByRole('button', { name: 'איפוס' }).click();
  return f;
}

// ConicLab's readout (src/sims/ConicLab.tsx, mode 'ellipse'): one row per quantity, each with data-readout:
// equation ("x²/16 + y²/4 = 1", "(x + 2)²/9 + (y − 1)²/9 = 1"), axes, circle (only when a = b), param, point, unit
// (only with the unit circle on), why. Minus signs are U+2212.
const readout = (fig: Locator, id: string) => fig.locator(`[data-readout="${id}"]`);
const press = async (fig: Locator, name: 'a' | 'b' | 'h' | 'k', dir: 'inc' | 'dec', times: number) => {
  for (let i = 0; i < times; i++) await fig.locator(`[data-stepper="${name}"] [data-step="${dir}"]`).click();
};
const task = async (page: Page, id: string) => ((await progress(page))?.tasks ?? {})[id];

test.describe('lesson 2.1: circle and ellipse, equation and parametrisation', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('מעגל ואליפסה');
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

  test('each figure starts at its own curve: the unit circle, the ellipse a = 4, b = 2, the circle about (−2, 1)', async ({ page }) => {
    await page.goto(LESSON);
    const a = await ready(page, 'fig-2-1a');
    await expect(readout(a, 'equation')).toContainText('x²/1 + y²/1 = 1');
    await expect(readout(a, 'param')).toContainText('(cos t,  sin t)');
    await expect(readout(a, 'point')).toContainText('t = π/6 (30°)');
    await expect(readout(a, 'point')).toContainText('(0.866, 0.5)');

    const b = await ready(page, 'fig-2-1b');
    await expect(readout(b, 'equation')).toContainText('x²/16 + y²/4 = 1');
    await expect(readout(b, 'axes')).toContainText('a = 4');
    await expect(readout(b, 'axes')).toContainText('b = 2');
    await expect(readout(b, 'param')).toContainText('(4 cos t,  2 sin t)');
    // (it starts at t = 0, not 45°: with the unit circle on, 45° would show the answer of pred-2-1 before its section)
    await expect(readout(b, 'point')).toContainText('t = 0 (0°)');
    await expect(readout(b, 'point')).toContainText('P = (4, 0)');
    await expect(readout(b, 'unit')).toContainText('(1, 0)');

    const c = await ready(page, 'fig-2-1c');
    await expect(readout(c, 'equation')).toContainText('(x + 2)²/9 + (y − 1)²/9 = 1');
    await expect(readout(c, 'circle')).toContainText('מעגל ברדיוס 3');
    await expect(readout(c, 'param')).toContainText('(−2 + 3 cos t,  1 + 3 sin t)');
    await expect(readout(c, 'point')).toContainText('(1, 1)');
  });

  test('a text step drives the figure: the ellipse x²/9 + y²/4 = 1 at t = 0, then the unit circle', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-2-1a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const steps = page.locator('.step[data-fig="fig-2-1a"]');
    await expect(steps).toHaveCount(4);

    // the third step moves the figure away from its initial state, so the unit circle below is the second step's doing
    await steps.nth(2).scrollIntoViewIfNeeded();
    await steps.nth(2).click();
    // (the step starts at t = 0, not 45°: with the unit circle on, 45° would show the answer of pred-2-1)
    await expect(readout(fig, 'equation')).toContainText('x²/9 + y²/4 = 1');
    await expect(readout(fig, 'point')).toContainText('t = 0');
    await expect(readout(fig, 'point')).toContainText('(3, 0)');

    await steps.nth(1).scrollIntoViewIfNeeded();
    await steps.nth(1).click();
    await expect(readout(fig, 'equation')).toContainText('x²/1 + y²/1 = 1');
    await expect(readout(fig, 'point')).toContainText('t = 0');
    await expect(readout(fig, 'point')).toContainText('(1, 0)');
  });

  test('fig c: its second step shows the ellipse about (1, −1) with P = (3, −1 + √3) at t = 60°', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-2-1c');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const steps = page.locator('.step[data-fig="fig-2-1c"]');
    await expect(steps).toHaveCount(2);
    await steps.nth(1).scrollIntoViewIfNeeded();
    await steps.nth(1).click();
    await expect(readout(fig, 'equation')).toContainText('(x − 1)²/16 + (y + 1)²/4 = 1');
    await expect(readout(fig, 'param')).toContainText('(1 + 4 cos t,  −1 + 2 sin t)');
    await expect(readout(fig, 'point')).toContainText('t = π/3 (60°)');
    await expect(readout(fig, 'point')).toContainText('(3, 0.7321)');
  });

  test('the reader turns the unit circle into a circle of radius 2 (ell-circle-2), then makes it taller than wide (ell-tall)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-1a');
    expect(await task(page, 'fig-2-1a:ell-circle-2')).toBeFalsy();
    await press(fig, 'a', 'inc', 2);
    await press(fig, 'b', 'inc', 2);
    await expect(readout(fig, 'equation')).toContainText('x²/4 + y²/4 = 1');
    await expect(readout(fig, 'circle')).toContainText('מעגל ברדיוס 2');
    await expect.poll(() => task(page, 'fig-2-1a:ell-circle-2')).toBeTruthy();

    expect(await task(page, 'fig-2-1a:ell-tall')).toBeFalsy();
    await press(fig, 'b', 'inc', 2);
    await expect(readout(fig, 'equation')).toContainText('x²/4 + y²/9 = 1');
    await expect.poll(() => task(page, 'fig-2-1a:ell-tall')).toBeTruthy();
  });

  test('the reader sets a = 3, b = 2 and the centre (1, −2): the equation has x − 1 and y + 2 (ell-axes-centre)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-1a');
    await press(fig, 'a', 'inc', 4);
    await press(fig, 'b', 'inc', 2);
    await press(fig, 'h', 'inc', 1);
    await press(fig, 'k', 'dec', 2);
    await expect(readout(fig, 'equation')).toContainText('(x − 1)²/9 + (y + 2)²/4 = 1');
    await expect(readout(fig, 'param')).toContainText('(1 + 3 cos t,  −2 + 2 sin t)');
    await expect.poll(() => task(page, 'fig-2-1a:ell-axes-centre')).toBeTruthy();
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-2-1"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the Check has its five bank questions, and 3*sin(t) is graded correct for Q-2.1-ellipse-param', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-2.1-unit-circle-eq', 'Q-2.1-ellipse-param', 'Q-2.1-shift', 'Q-2.1-stretch', 'Q-2.1-param-angle']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-2.1-ellipse-param"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-expr input').fill('3*sin(t)');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-2-1-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-2-1-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-2-1-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors other pages link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of [
      'param-idea',
      'param-range',
      'half-curve',
      'curve-vs-param',
      'stretch',
      'ellipse-standard',
      'rhs-one',
      'read-axes',
      'ellipse-param',
      'param-not-angle',
      'shift',
      'complete-square',
      'square-reminder',
      'physics',
    ]) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
