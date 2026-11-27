import { expect, test, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/4-6/';
const FIGS = ['fig-4-6a', 'fig-4-6b', 'fig-4-6c'];
const TASKS = [
  'fig-4-6a:approach-close',
  'fig-4-6a:approach-jump',
  'fig-4-6a:approach-fill',
  'fig-4-6b:ivt-bisect',
  'fig-4-6b:ivt-fail',
  'fig-4-6c:extreme-open',
  'fig-4-6c:extreme-closed',
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

// LimitLab's readout (src/sims/LimitLab.tsx): one element per quantity, each with data-readout.
//   approach: fn, h, fa ("לא מוגדרת" at a hole), table, limits and verdict (with classify), fill (with fill)
//   ivt:      fn, interval ("… אחרי n חציות"), signs, verdict, points
//   extreme:  fn, interval, max, min ("לא מתקבל" when only approached)
// Negative numbers use U+2212.
const readout = (page: Page, fig: string, id: string) => page.locator(`#${fig} [data-readout="${id}"]`);

test.describe('lesson 4.6: limits and continuity, intuitively', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('גבולות ורציפות');
    await expect(page.locator('.katex-error')).toHaveCount(0);
  });

  test('the three figures hydrate and draw, in LTR math space', async ({ page }) => {
    await page.goto(LESSON);
    for (const fig of FIGS) {
      const c = page.locator(`#${fig} canvas`).first();
      await c.scrollIntoViewIfNeeded();
      await hydrated(c);
      await expect(c).toHaveCSS('direction', 'ltr');
      await expect.poll(() => inked(c)).toBeGreaterThan(200);
    }
  });

  test('each figure starts in its own state: the hole of notes p. 4, x³ − x − 1 on [1, 2], x² on [−1, 2]', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page, 'fig-4-6a');
    await expect(readout(page, 'fig-4-6a', 'fn')).toContainText('(x² − 5x + 6)/(x − 2)');
    await expect(readout(page, 'fig-4-6a', 'fa')).toContainText('לא מוגדרת');
    await ready(page, 'fig-4-6b');
    await expect(readout(page, 'fig-4-6b', 'fn')).toContainText('x³ − x − 1');
    await ready(page, 'fig-4-6c');
    await expect(readout(page, 'fig-4-6c', 'fn')).toContainText('x²');
    await expect(readout(page, 'fig-4-6c', 'max')).toContainText('4');
    await expect(readout(page, 'fig-4-6c', 'max')).not.toContainText('לא מתקבל');
  });

  test('text steps drive the approach figure: the jump of notes p. 6, 1/x, sin(1/x)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-4-6a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator('.step[data-fig="fig-4-6a"]');
    // Explore 3; limit idea 1; 0/0 2; one-sided 2; infinite 2; sin x / x 1; sin(1/x) 1
    await expect(steps).toHaveCount(12);

    // the jump of notes p. 6: left limit 7, right limit 9
    await steps.nth(6).scrollIntoViewIfNeeded();
    await steps.nth(6).click();
    await expect(readout(page, 'fig-4-6a', 'verdict')).toContainText('קפיצה');
    await expect(readout(page, 'fig-4-6a', 'limits')).toContainText('7');
    await expect(readout(page, 'fig-4-6a', 'limits')).toContainText('9');

    // 1/x at 0: infinite
    await steps.nth(8).scrollIntoViewIfNeeded();
    await steps.nth(8).click();
    await expect(readout(page, 'fig-4-6a', 'verdict')).toContainText('אינסופית');

    // sin(1/x) at 0: no limit
    await steps.nth(11).scrollIntoViewIfNeeded();
    await steps.nth(11).click();
    await expect(readout(page, 'fig-4-6a', 'verdict')).toContainText('אין גבול');
  });

  test('text steps drive the IVT and extreme figures: 1/x is not continuous; (0.5, 3] misses its maximum', async ({ page }) => {
    await page.goto(LESSON);
    const ivt = page.locator('#fig-4-6b');
    await ivt.scrollIntoViewIfNeeded();
    await hydrated(ivt.locator('canvas').first());
    const ivtSteps = page.locator('.step[data-fig="fig-4-6b"]');
    // IVT 2 (cubic, cos x − x); hypotheses 1 (1/x); bisection 1
    await expect(ivtSteps).toHaveCount(4);
    await ivtSteps.nth(2).scrollIntoViewIfNeeded();
    await ivtSteps.nth(2).click();
    await expect(readout(page, 'fig-4-6b', 'verdict')).toContainText('לא רציפה');

    const ext = page.locator('#fig-4-6c');
    await ext.scrollIntoViewIfNeeded();
    await hydrated(ext.locator('canvas').first());
    const extSteps = page.locator('.step[data-fig="fig-4-6c"]');
    // x² closed; x on (0, 1); 1/x on (0.5, 3]; 1/x on (0, 3]; sin x on (0, 2π)
    await expect(extSteps).toHaveCount(5);
    await extSteps.nth(2).scrollIntoViewIfNeeded();
    await extSteps.nth(2).click();
    await expect(readout(page, 'fig-4-6c', 'max')).toContainText('לא מתקבל');
    await expect(readout(page, 'fig-4-6c', 'min')).not.toContainText('לא מתקבל');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-4-6"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the reader fills the hole: the limit −1 closes it and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-6a');
    await fig.getByRole('button', { name: 'סגירת החור' }).click();
    await expect(readout(page, 'fig-4-6a', 'fill')).toContainText('−1');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-4-6a:approach-fill']).toBeTruthy();
  });

  test('the reader bisects six times: [1.3125, 1.328125] and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-6b');
    const halve = fig.getByRole('button', { name: 'חצייה' });
    for (let i = 0; i < 6; i++) await halve.click();
    await expect(readout(page, 'fig-4-6b', 'interval')).toContainText('1.3125');
    await expect(readout(page, 'fig-4-6b', 'interval')).toContainText('6');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-4-6b:ivt-bisect']).toBeTruthy();
  });

  test('the reader opens the right end of [−1, 2]: the maximum 4 is no longer attained', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-6c');
    await fig.getByRole('button', { name: 'קצה ימני סגור' }).click();
    await expect(readout(page, 'fig-4-6c', 'max')).toContainText('לא מתקבל');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-4-6c:extreme-open']).toBeTruthy();
  });

  test('the Check has its five bank questions, and −1 is graded correct for Q-4.6-notes-cancel', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-4.6-notes-cancel', 'Q-4.6-jump', 'Q-4.6-one-sided', 'Q-4.6-sinx-x-infinity', 'Q-4.6-ivt-recip']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-4.6-notes-cancel"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-numeric input').fill('-1');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-4-6-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-4-6-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-4-6-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors the misconception remedies link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'limit-idea',
      'limit-rules',
      'zero-over-zero',
      'conjugate',
      'one-sided',
      'infinite-limits',
      'zero-denominator',
      'limits-at-infinity',
      'infinity-minus-infinity',
      'squeeze',
      'sinc',
      'sinc-why',
      'continuity',
      'classify',
      'sinc-fill',
      'no-limit',
      'glue',
      'ivt',
      'ivt-hypotheses',
      'existence-uniqueness',
      'hiker',
      'bisection',
      'extreme',
      'limits-physics',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
