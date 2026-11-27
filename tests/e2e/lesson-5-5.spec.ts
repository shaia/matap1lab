import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/5-5/';
const FIGS = ['fig-5-5a', 'fig-5-5b'];
const TASKS = ['fig-5-5a:sign-max', 'fig-5-5a:sign-flat', 'fig-5-5a:sign-end', 'fig-5-5b:related-fast', 'fig-5-5b:related-slow'];

/** Bring a figure into view, wait for its island, stop text steps from driving it, and reset it. */
async function ready(page: Page, fig: string) {
  const f = page.locator(`#${fig}`);
  await f.scrollIntoViewIfNeeded();
  await hydrated(f.locator('canvas').first());
  await freezeSteps(page);
  await f.getByRole('button', { name: 'איפוס' }).click();
  return f;
}

// SlopeGraph (src/sims/SlopeGraph.tsx), sign mode: fn, x, fx, dfx, trend ("עולה" / "יורדת" / "נקודה קריטית: <kind>"),
//   crit, gmax and gmin (with the closed interval; "(רק בקצה)" when attained only at an end).
// ImplicitLab (src/sims/ImplicitLab.tsx), related mode: preset, q, rate, dep, depRate (with sign).
// Negative numbers use U+2212.
const readout = (page: Page, fig: string, id: string) => page.locator(`#${fig} [data-readout="${id}"]`);
/** a slider of a figure by its label (SimShell's Slider: label.slider > .slider-label + input[type=range]) */
const slider = (fig: Locator, label: string | RegExp) =>
  fig.locator('label.slider').filter({ has: fig.page().locator('.slider-label', { hasText: label }) }).locator('input[type="range"]');
const ticked = (page: Page, task: string) => expect.poll(async () => ((await progress(page))?.tasks ?? {})[task]).toBeTruthy();

test.describe('lesson 5.5: the derivative table and its uses', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('טבלת הנגזרות');
    await expect(page.locator('.katex-error')).toHaveCount(0);
  });

  test('both figures hydrate and draw, in LTR math space', async ({ page }) => {
    await page.goto(LESSON);
    for (const fig of FIGS) {
      const c = page.locator(`#${fig} canvas`).first();
      await c.scrollIntoViewIfNeeded();
      await hydrated(c);
      await expect(c).toHaveCSS('direction', 'ltr');
      await expect.poll(() => inked(c)).toBeGreaterThan(200);
    }
  });

  test('each figure starts in its own state: x³ − 3x at x = −2 (rising), the ladder at x = 4', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page, 'fig-5-5a');
    await expect(readout(page, 'fig-5-5a', 'fn')).toContainText('x³ − 3x');
    await expect(readout(page, 'fig-5-5a', 'trend')).toContainText('עולה');
    await expect(readout(page, 'fig-5-5a', 'crit')).toContainText('מקסימום מקומי');
    await ready(page, 'fig-5-5b');
    await expect(readout(page, 'fig-5-5b', 'preset')).toContainText('סולם');
    // y′ = −(4/3)·1 at x = 4
    await expect(readout(page, 'fig-5-5b', 'depRate')).toContainText('−');
    await expect(readout(page, 'fig-5-5b', 'depRate')).toContainText('1.33');
  });

  test('text steps drive the sign figure: x³ has a flat point, the box peaks at 128, the ball turns at 20 m', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-5-5a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator('.step[data-fig="fig-5-5a"]');
    // Explore 3; monotone 1; read f′ 1; sign test 1; closed interval 1; the box 1; distance 1
    await expect(steps).toHaveCount(9);

    // the sign test on x³: a critical point that is not an extremum
    await steps.nth(5).scrollIntoViewIfNeeded();
    await steps.nth(5).click();
    await expect(readout(page, 'fig-5-5a', 'fn')).toContainText('x³');
    await expect(readout(page, 'fig-5-5a', 'crit')).toContainText('לא נקודת קיצון');

    // x³ − 3x on [0, 3]: the maximum 18 is attained only at the end 3
    await steps.nth(6).scrollIntoViewIfNeeded();
    await steps.nth(6).click();
    await expect(readout(page, 'fig-5-5a', 'gmax')).toContainText('18');
    await expect(readout(page, 'fig-5-5a', 'gmax')).toContainText('רק בקצה');
    await expect(readout(page, 'fig-5-5a', 'gmin')).toContainText('2');

    // the box of the hook on [0, 6]: 128 at x = 2
    await steps.nth(7).scrollIntoViewIfNeeded();
    await steps.nth(7).click();
    await expect(readout(page, 'fig-5-5a', 'fn')).toContainText('x(12 − 2x)²');
    await expect(readout(page, 'fig-5-5a', 'gmax')).toContainText('128');

    // the ball: the top at t = 2, h = 20
    await steps.nth(8).scrollIntoViewIfNeeded();
    await steps.nth(8).click();
    await expect(readout(page, 'fig-5-5a', 'fn')).toContainText('20t − 5t²');
    await expect(readout(page, 'fig-5-5a', 'gmax')).toContainText('20');
  });

  test('text steps drive the related-rates figure: ladder, cone at h = 2, balloon at r = 3', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-5-5b');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator('.step[data-fig="fig-5-5b"]');
    await expect(steps).toHaveCount(3);

    // the cone: dh/dt = 8/(πh²) = 2/π ≈ 0.637 at h = 2
    await steps.nth(1).scrollIntoViewIfNeeded();
    await steps.nth(1).click();
    await expect(readout(page, 'fig-5-5b', 'preset')).toContainText('חרוט הפוך');
    await expect(readout(page, 'fig-5-5b', 'depRate')).toContainText('0.63');

    // the balloon: dV/dt = 8πr² = 72π ≈ 226 at r = 3
    await steps.nth(2).scrollIntoViewIfNeeded();
    await steps.nth(2).click();
    await expect(readout(page, 'fig-5-5b', 'preset')).toContainText('בלון');
    await expect(readout(page, 'fig-5-5b', 'depRate')).toContainText('226');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-5-5"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the reader moves the cursor to −1: a local maximum, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-5a');
    await slider(fig, 'הנקודה x').fill('-1');
    await expect(readout(page, 'fig-5-5a', 'trend')).toContainText('מקסימום מקומי');
    await ticked(page, 'fig-5-5a:sign-max');
  });

  test('the reader turns the interval on and moves b to 3: the maximum 18 is at the end, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-5a');
    await fig.getByRole('button', { name: 'קטע סגור' }).click();
    await slider(fig, 'הקצה הימני b').fill('3');
    await expect(readout(page, 'fig-5-5a', 'gmax')).toContainText('18');
    await expect(readout(page, 'fig-5-5a', 'gmax')).toContainText('רק בקצה');
    await ticked(page, 'fig-5-5a:sign-end');
  });

  test('the reader pulls the ladder out to x = 4.85: the top falls faster than 3 m/s, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-5b');
    await slider(fig, 'המרחק x מהקיר').fill('4.85');
    // y = √(25 − 4.85²) ≈ 1.215, dy/dt = −4.85/1.215 ≈ −3.99
    await expect(readout(page, 'fig-5-5b', 'depRate')).toContainText('−3.9');
    await ticked(page, 'fig-5-5b:related-fast');
  });

  test('the reader fills the cone to h = 5.5: the water rises slowly, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-5b');
    await fig.getByRole('button', { name: 'מיכל חרוטי' }).click();
    await slider(fig, 'עומק המים h').fill('5.5');
    // dh/dt = 8/(π·30.25) ≈ 0.0842
    await expect(readout(page, 'fig-5-5b', 'depRate')).toContainText('0.084');
    await ticked(page, 'fig-5-5b:related-slow');
  });

  test('the Check has its five bank questions, and 200π is graded correct for Q-5.5-balloon', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-5.5-cosh', 'Q-5.5-balloon', 'Q-5.5-ladder', 'Q-5.5-decreasing', 'Q-5.5-fprime-formula']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-5.5-balloon"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-numeric input').fill('200π');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-5-5-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-5-5-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-5-5-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors the misconception remedies link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'full-table',
      'base-a',
      'ln-abs',
      'hyp-derivs',
      'table',
      'monotone',
      'mvt',
      'interval-caveat',
      'read-fprime',
      'local-extrema',
      'fermat',
      'sign-test',
      'closed-interval',
      'optimize',
      'open-interval',
      'unique-root',
      'distance',
      'extrema-physics',
      'related-rates',
      'ladder',
      'related-recipe',
      'cone',
      'balloon',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
