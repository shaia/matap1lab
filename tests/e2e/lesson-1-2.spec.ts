import { expect, test, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/1-2/';
const FIGS = ['fig-1-2a', 'fig-1-2b', 'fig-1-2c'];

/** Bring a figure into view, wait for its island, stop text steps from driving it, and reset it. */
async function ready(page: Page, fig: string) {
  const f = page.locator(`#${fig}`);
  await f.scrollIntoViewIfNeeded();
  await hydrated(f.locator('canvas'));
  await freezeSteps(page);
  await f.getByRole('button', { name: 'איפוס' }).click();
  return f;
}

// VectorLab's readout (src/sims/VectorLab.tsx, mode 'dot'): one element per quantity, each with data-readout:
// a, a-mag, b, b-mag, theta, dot ("a·b = 2·4 + 3·1 = 11"), dot-cos, proj. Negative numbers use U+2212 and stand in
// brackets inside the sum.
const dotReadout = (page: Page, fig: string) => page.locator(`#${fig} [data-readout="dot"]`);

test.describe('lesson 1.2: the dot product', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('המכפלה הסקלרית');
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

  test('each figure starts at its own vectors: 11, 10 and 11 J', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page, 'fig-1-2a');
    await expect(dotReadout(page, 'fig-1-2a')).toHaveText(/a·b = 2·4 \+ 3·1 = 11\s*$/);
    await ready(page, 'fig-1-2b');
    await expect(dotReadout(page, 'fig-1-2b')).toHaveText(/a·b = 1·4 \+ 3·2 = 10\s*$/);
    await expect(page.locator('#fig-1-2b [data-readout="theta"]')).toContainText('45°');
    await expect(page.locator('#fig-1-2b [data-readout="proj"]')).toContainText('2.24');
    await ready(page, 'fig-1-2c');
    await expect(dotReadout(page, 'fig-1-2c')).toHaveText(/F·d = 2·4 \+ 3·1 = 11 J\s*$/);
  });

  test('a text step drives the figure: a·b is 12, then 11 for b = (4, 1), then 0 for b = (3, −2)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-1-2a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const steps = page.locator('.step[data-fig="fig-1-2a"]');
    await expect(steps).toHaveCount(3);
    const dot = dotReadout(page, 'fig-1-2a');

    // the first step moves the figure away from its initial state, so the 11 below is the second step's doing
    await steps.nth(0).scrollIntoViewIfNeeded();
    await steps.nth(0).click();
    await expect(dot).toHaveText(/a·b = 3·4 \+ 2·0 = 12\s*$/);

    await steps.nth(1).scrollIntoViewIfNeeded();
    await steps.nth(1).click();
    await expect(fig.locator('[data-readout="a"]')).toContainText('a = (2, 3)');
    await expect(fig.locator('[data-readout="b"]')).toContainText('b = (4, 1)');
    await expect(dot).toHaveText(/a·b = 2·4 \+ 3·1 = 11\s*$/);

    await steps.nth(2).scrollIntoViewIfNeeded();
    await steps.nth(2).click();
    await expect(fig.locator('[data-readout="b"]')).toContainText('b = (3, −2)');
    await expect(dot).toHaveText(/a·b = 2·3 \+ 3·\(−2\) = 0\s*$/);
    await expect(fig.locator('[data-readout="theta"]')).toContainText('90°');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-1-2"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of ['fig-1-2a:dot-obtuse', 'fig-1-2a:dot-zero-tilted', 'fig-1-2a:dot-max']) {
      expect(tasks[t]).toBeFalsy();
    }
  });

  test('the Check has its five bank questions, and −7 is graded correct for Q-1.2-dot', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-1.2-dot', 'Q-1.2-props', 'Q-1.2-perp', 'Q-1.2-angle', 'Q-1.2-scalar-proj']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-1.2-dot"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-numeric input').fill('-7');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-1-2-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-1-2-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-1-2-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors other pages link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['dot-definition', 'dot-properties', 'angle', 'dot-sign', 'perpendicular', 'projection', 'work']) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
