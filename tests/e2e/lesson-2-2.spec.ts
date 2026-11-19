import { expect, test, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/2-2/';
const FIGS = ['fig-2-2a', 'fig-2-2b', 'fig-2-2c'];

/** Bring a figure into view, wait for its island, stop text steps from driving it, and reset it. */
async function ready(page: Page, fig: string) {
  const f = page.locator(`#${fig}`);
  await f.scrollIntoViewIfNeeded();
  await hydrated(f.locator('canvas'));
  await freezeSteps(page);
  await f.getByRole('button', { name: 'איפוס' }).click();
  return f;
}

// ConicLab's readout (src/sims/ConicLab.tsx): one row per quantity, each with data-readout. Parabola: equation, vertex,
// open, param, point. Hyperbola: equation, shape, asymptotes, param, point. Identify: equation, completed, type,
// detail-0…. Negative numbers use U+2212.
const row = (page: Page, fig: string, id: string) => page.locator(`#${fig} [data-readout="${id}"]`);

test.describe('lesson 2.2: parabola and hyperbolas', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('פרבולה והיפרבולות');
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

  test('each figure starts at its own curve: y = x², x²/16 − y²/4 = 1, and the ellipse of the recipe', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page, 'fig-2-2a');
    await expect(row(page, 'fig-2-2a', 'equation')).toContainText('y = x²');
    await expect(row(page, 'fig-2-2a', 'vertex')).toContainText('(0, 0)');
    await expect(row(page, 'fig-2-2a', 'point')).toContainText('P = (1, 1)');

    await ready(page, 'fig-2-2b');
    await expect(row(page, 'fig-2-2b', 'equation')).toContainText('x²/16 − y²/4 = 1');
    await expect(row(page, 'fig-2-2b', 'asymptotes')).toContainText('y = ±(1/2)x');

    await ready(page, 'fig-2-2c');
    await expect(row(page, 'fig-2-2c', 'equation')).toContainText('x² + 4y² − 2x + 8y − 11 = 0');
    await expect(row(page, 'fig-2-2c', 'completed')).toContainText('(x − 1)² + 4(y + 1)² = 16');
    await expect(row(page, 'fig-2-2c', 'type')).toContainText('אליפסה');
  });

  test('text steps drive the parabola: y = 0.5x², then the vertex (1, 1), then −2(x − 1)² + 3', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-2-2a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const steps = page.locator('.step[data-fig="fig-2-2a"]');
    await expect(steps).toHaveCount(6);
    const eq = row(page, 'fig-2-2a', 'equation');

    await steps.nth(1).scrollIntoViewIfNeeded();
    await steps.nth(1).click();
    await expect(eq).toContainText('y = 0.5x²');
    await expect(row(page, 'fig-2-2a', 'point')).toContainText('P = (2, 2)');

    await steps.nth(2).scrollIntoViewIfNeeded();
    await steps.nth(2).click();
    await expect(eq).toContainText('y = (x − 1)² + 1');
    await expect(row(page, 'fig-2-2a', 'vertex')).toContainText('(1, 1)');

    await steps.nth(4).scrollIntoViewIfNeeded();
    await steps.nth(4).click();
    await expect(eq).toContainText('y = −2(x − 1)² + 3');
    await expect(row(page, 'fig-2-2a', 'point')).toContainText('P = (2, 1)');

    await steps.nth(5).scrollIntoViewIfNeeded();
    await steps.nth(5).click();
    await expect(eq).toContainText('x = (y − 1)² − 2');
  });

  test('text steps drive the hyperbola: opening up and down, the asymptotes, then xy = 1', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-2-2b');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const steps = page.locator('.step[data-fig="fig-2-2b"]');
    await expect(steps).toHaveCount(5);
    const eq = row(page, 'fig-2-2b', 'equation');

    await steps.nth(1).scrollIntoViewIfNeeded();
    await steps.nth(1).click();
    await expect(eq).toContainText('y²/4 − x²/4 = 1');
    await expect(row(page, 'fig-2-2b', 'asymptotes')).toContainText('y = ±x');

    await steps.nth(2).scrollIntoViewIfNeeded();
    await steps.nth(2).click();
    await expect(eq).toContainText('x²/16 − y²/4 = 1');

    await steps.nth(3).scrollIntoViewIfNeeded();
    await steps.nth(3).click();
    await expect(eq).toContainText('xy = 1');
    await expect(row(page, 'fig-2-2b', 'asymptotes')).toContainText('x = 0');
    await expect(row(page, 'fig-2-2b', 'point')).toContainText('(2, 1/2)');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-2-2"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of [
      'fig-2-2a:par-point',
      'fig-2-2a:par-down',
      'fig-2-2a:par-vertex',
      'fig-2-2a:par-sideways',
      'fig-2-2b:hyp-vertical',
      'fig-2-2b:hyp-asym-2',
      'fig-2-2b:hyp-xy-asym',
      'fig-2-2b:hyp-branch',
      'fig-2-2c:id-circle',
      'fig-2-2c:id-parabola',
      'fig-2-2c:id-ellipse-to-hyperbola',
      'fig-2-2c:id-lines',
      'fig-2-2c:id-point',
      'fig-2-2c:id-empty',
    ]) {
      expect(tasks[t]).toBeFalsy();
    }
  });

  test('the reader turns the hyperbola (x − 2)² − (y + 1)² = 1 into a pair of lines by raising F, and the task ticks', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-2c');
    await fig.locator('[data-preset="2"]').click();
    await expect(row(page, 'fig-2-2c', 'completed')).toContainText('(x − 2)² − (y + 1)² = 1');
    await expect(row(page, 'fig-2-2c', 'type')).toContainText('היפרבולה');
    await fig.getByRole('button', { name: 'הגדלת המקדם F' }).click();
    await expect(row(page, 'fig-2-2c', 'completed')).toContainText('(x − 2)² − (y + 1)² = 0');
    await expect(row(page, 'fig-2-2c', 'type')).toContainText('זוג ישרים נחתכים');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-2-2c:id-lines']).toBeTruthy();
  });

  test('the Check has its five bank questions, and −3 is graded correct for Q-2.2-vertex', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-2.2-opening', 'Q-2.2-vertex', 'Q-2.2-asymptote-slope', 'Q-2.2-complete-square', 'Q-2.2-param-hyperbola']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-2.2-vertex"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-numeric input').fill('-3');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-2-2-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-2-2-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-2-2-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors other pages link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['parabola', 'hyperbola', 'asymptotes', 'xy-hyperbola', 'param', 'identify', 'degenerate', 'physics']) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
