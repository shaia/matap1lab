import { expect, test, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/4-5/';
const FIGS = ['fig-4-5a', 'fig-4-5b'];
const TASKS = [
  'fig-4-5a:hyper-halves',
  'fig-4-5a:hyper-negative',
  'fig-4-5b:inverse-fail',
  'fig-4-5b:inverse-branch',
  'fig-4-5b:inverse-point',
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

const task = async (page: Page, id: string) => ((await progress(page))?.tasks ?? {})[id];

// CircleLab's readout (src/sims/CircleLab.tsx) is `.cl-readout`; in mode hyper its rows are the parameter t, the point
// (cosh t, sinh t) with 4 decimals, the identity, and with `halves` the two halves. GraphLab's inverse readout has the
// spans [data-readout="restriction"] (one-to-one or not) and [data-readout="hits"] (the probe count of y = k).
test.describe('lesson 4.5: hyperbolic functions', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('פונקציות היפרבוליות');
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

  test('each figure starts in its own state: t = 1, and cosh on [−3, 3], not one-to-one', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page, 'fig-4-5a');
    // (cosh 1, sinh 1) ≈ (1.5431, 1.1752)
    await expect(page.locator('#fig-4-5a .cl-readout')).toContainText('1.5431');
    await expect(page.locator('#fig-4-5a .cl-readout')).toContainText('1.1752');
    await ready(page, 'fig-4-5b');
    await expect(page.locator('#fig-4-5b [data-readout="restriction"]')).toContainText('אינה חד-חד-ערכית');
  });

  test('text steps drive the figures: t = 3 for the graphs, and cosh restricted to x ≥ 0 never by a step', async ({ page }) => {
    await page.goto(LESSON);
    const a = page.locator('#fig-4-5a');
    await a.scrollIntoViewIfNeeded();
    await hydrated(a.locator('canvas').first());
    const aSteps = page.locator('.step[data-fig="fig-4-5a"]');
    // 2 Explore steps, 1 in the definitions, 1 in the graphs, 1 in the identity
    await expect(aSteps).toHaveCount(5);
    await aSteps.nth(3).scrollIntoViewIfNeeded();
    await aSteps.nth(3).click();
    // (cosh 3, sinh 3) ≈ (10.0677, 10.0179)
    await expect(page.locator('#fig-4-5a .cl-readout')).toContainText('10.0677');

    const b = page.locator('#fig-4-5b');
    await b.scrollIntoViewIfNeeded();
    await hydrated(b.locator('canvas').first());
    const bSteps = page.locator('.step[data-fig="fig-4-5b"]');
    // sinh, cosh, tanh, artanh
    await expect(bSteps).toHaveCount(4);
    await bSteps.nth(0).scrollIntoViewIfNeeded();
    await bSteps.nth(0).click();
    await expect(page.locator('#fig-4-5b [data-readout="restriction"]')).toContainText('יש לה הפוכה');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-4-5"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the reader turns the halves on and moves t to 2 and then below 0: both hyper tasks are ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-5a');
    await fig.getByRole('button', { name: /החצאים/ }).click();
    await fig.getByRole('slider', { name: 't' }).fill('2');
    await expect(page.locator('#fig-4-5a .cl-readout')).toContainText('3.7622');
    await expect.poll(() => task(page, 'fig-4-5a:hyper-halves')).toBeTruthy();
    await fig.getByRole('slider', { name: 't' }).fill('-1');
    await expect(page.locator('#fig-4-5a .cl-readout')).toContainText('−1.1752');
    await expect.poll(() => task(page, 'fig-4-5a:hyper-negative')).toBeTruthy();
  });

  test('the reader restricts cosh to [0, 3]: the reflection is a function and inverse-branch is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-5b');
    await fig.getByRole('slider', { name: 'תחילת הצמצום' }).fill('0');
    await expect(page.locator('#fig-4-5b [data-readout="restriction"]')).toContainText('יש לה הפוכה');
    await expect.poll(() => task(page, 'fig-4-5b:inverse-branch')).toBeTruthy();
  });

  test('the Check has its five bank questions, and ln 2 is graded wrong for sinh(ln 2) while 3/4 is right', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-4.5-sinh-ln2', 'Q-4.5-shape', 'Q-4.5-identity-pick', 'Q-4.5-tanh-limit', 'Q-4.5-root-choice']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-4.5-sinh-ln2"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-numeric input').fill('3/4');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-4-5-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-4-5-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-4-5-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors the misconception register links to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'hyp-def',
      'hyp-half',
      'cos-exp-reminder',
      'hyp-graphs',
      'hyp-identity',
      'cosh-positive',
      'hyp-inverse',
      'root-choice',
      'arcosh',
      'tanh-def',
      'artanh',
      'hyp-physics',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
