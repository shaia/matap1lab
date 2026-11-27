import { expect, test, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/7-6/';
const FIG = 'fig-7-6a';
const TASKS = [`${FIG}:check-wrong`, `${FIG}:check-constant`, `${FIG}:check-pieces`];

/** Bring the figure into view, wait for its island, stop text steps from driving it, and reset it. */
async function ready(page: Page) {
  const f = page.locator(`#${FIG}`);
  await f.scrollIntoViewIfNeeded();
  await hydrated(f.locator('canvas').first());
  await freezeSteps(page);
  await f.getByRole('button', { name: 'איפוס' }).click();
  return f;
}

// AntiLab's hooks (src/sims/AntiLab.tsx, header comment), check mode: the toggle "השוואה בין שתי תשובות" and "איפוס"
// by role and name; [data-control="preset"] select (CHK ids x-sinx, 2sincos, asin, atan, recip2), [data-control="cand"]
// select and, with compare on, [data-control="compare"] select (values are candidate indexes, in the brief's table
// order); readouts [data-readout=…] fn, cand, deriv, verdict, why (a wrong candidate), diff (with compare).
// Numbers use U+2212 for minus.
const readout = (page: Page, id: string) => page.locator(`#${FIG} [data-readout="${id}"]`);

test.describe('lesson 7.6: tables and strategy', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('טבלאות ואסטרטגיה');
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

  test('the figure starts on the hook: sin²x is an antiderivative of 2 sin x cos x', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page);
    await expect(readout(page, 'fn')).toContainText('2 sin x cos x');
    await expect(readout(page, 'cand')).toContainText('sin²x');
    await expect(readout(page, 'verdict')).toContainText('התשובה נכונה');
  });

  test('text steps drive the figure: a product integrated factor by factor is wrong, arctan(1/x) differs by ±π/2', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator(`#${FIG}`);
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator(`.step[data-fig="${FIG}"]`);
    // Explore 2 (2sincos, atan); the check by differentiation 2 (x-sinx right, x-sinx factor by factor); two answers 3
    // (2sincos, asin and atan with compare)
    await expect(steps).toHaveCount(7);

    await steps.nth(3).scrollIntoViewIfNeeded();
    await steps.nth(3).click();
    await expect(readout(page, 'fn')).toContainText('x sin x');
    await expect(readout(page, 'verdict')).toContainText('התשובה שגויה');
    await expect(readout(page, 'why')).toBeVisible();

    await steps.nth(4).scrollIntoViewIfNeeded();
    await steps.nth(4).click();
    await expect(readout(page, 'diff')).toContainText('קבוע');

    await steps.nth(6).scrollIntoViewIfNeeded();
    await steps.nth(6).click();
    await expect(readout(page, 'diff')).toContainText('π/2');
    await expect(readout(page, 'diff')).toContainText('−π/2');
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

  test('the reader picks the wrong answer −2 sin x cos x: the verdict says so, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page);
    await fig.locator('[data-control="cand"] select').selectOption('3');
    await expect(readout(page, 'verdict')).toContainText('התשובה שגויה');
    await expect(readout(page, 'deriv')).toContainText('2 sin²x − 2 cos²x');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})[`${FIG}:check-wrong`]).toBeTruthy();
  });

  test('the reader compares arctan x with −arctan(1/x): a different constant on each side of 0, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page);
    await fig.locator('[data-control="preset"] select').selectOption('atan');
    await fig.getByRole('button', { name: 'השוואה בין שתי תשובות' }).click();
    await fig.locator('[data-control="compare"] select').selectOption('1');
    await expect(readout(page, 'diff')).toContainText('π/2');
    await expect(readout(page, 'diff')).toContainText('−π/2');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})[`${FIG}:check-pieces`]).toBeTruthy();
  });

  test('the Check has its five bank questions, and ½·arctan((x − 3)/2) is graded correct for Q-7.6-complete-atan', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-7.6-complete-atan', 'Q-7.6-method-sub', 'Q-7.6-check-true', 'Q-7.6-find-slip', 'Q-7.6-no-formula']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-7.6-complete-atan"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-expr input').fill('atan((x-3)/2)/2');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-7-6-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-7-6-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-7-6-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors the misconception remedies link to exist, the tables render, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'check-by-derivative',
      'spot-check',
      'two-answers',
      'table',
      'table-new',
      'ln-row',
      'complete-square',
      'table-substitution',
      'strategy',
      'no-formula',
      'divide-by-inner',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    // the basic table and the new rows (the strategy is a list, to fit the 513 px column)
    await expect(page.locator('#table table')).toHaveCount(2);
    await expect(page.locator('#strategy table')).toHaveCount(0);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
