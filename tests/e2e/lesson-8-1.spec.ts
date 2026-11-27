import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/8-1/';
const FIGS = ['fig-8-1a', 'fig-8-1b'];
const TASKS = [
  'fig-8-1a:rs-refine',
  'fig-8-1a:rs-rule',
  'fig-8-1a:rs-negative',
  'fig-8-1a:pr-outside',
  'fig-8-1a:pr-compare',
  'fig-8-1b:mo-turn',
  'fig-8-1b:mo-abs',
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

// RiemannLab's hooks (src/sims/RiemannLab.tsx, header comment):
//   buttons by name: modes "סכום רימן", "מהירות והעתק", "תכונות האינטגרל"; rules "שמאלי", "ימני", "אמצע"; toggles
//   "האינטגרל המדויק" (sum), "הדרך שעבר הגוף" (motion); "איפוס"
//   [data-control=…]: preset (select), n (sum, 1…64), t (motion), c (props add)
//   [data-readout=…]: sum fn, n, dx, rule, sum, rects, exact, diff, parts; motion fn, t, v, disp, dist, dir;
//                     props add fn, c, ac, cb, total, identity, reverse; props cmp fn, g-int, f-int, compare
// Negative numbers use U+2212.
const readout = (page: Page, fig: string, id: string) => page.locator(`#${fig} [data-readout="${id}"]`);
const done = async (page: Page, task: string) => ((await progress(page))?.tasks ?? {})[task];

/** Set a range input as a student would: the value, then an input event. */
const slide = (s: Locator, v: number) =>
  s.evaluate((el: HTMLInputElement, value) => {
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);

test.describe('lesson 8.1: Riemann sums and area', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('סכומי רימן ושטח');
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

  test('the figures start on x² with two right rectangles (sum 5) and on v = 2 − t at t = 0.5', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page, 'fig-8-1a');
    await expect(readout(page, 'fig-8-1a', 'n')).toContainText('2');
    await expect(readout(page, 'fig-8-1a', 'rule')).toContainText('ימני');
    await expect(readout(page, 'fig-8-1a', 'sum')).toContainText(/=\s*5\s*$/);
    await expect(readout(page, 'fig-8-1a', 'exact')).toHaveCount(0);
    await ready(page, 'fig-8-1b');
    await expect(readout(page, 'fig-8-1b', 'disp')).toContainText('0.875');
  });

  test('text steps drive the sum figure: M₈ of x² next to 8/3, and sin split at c = 1', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-8-1a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator('.step[data-fig="fig-8-1a"]');
    // Explore 3 (sq right 2, sq right 8 exact, cos mid 4); definition sq mid 2; limit sq mid 8, sq right 64;
    // monotone sq left 8, recip left 8; signed cos mid 16; additivity add c = 1; comparison add c = 2
    await expect(steps).toHaveCount(11);

    // the midpoint sum with 8 pieces is 85/32 = 2.65625, the integral 8/3
    await steps.nth(4).scrollIntoViewIfNeeded();
    await steps.nth(4).click();
    await expect(readout(page, 'fig-8-1a', 'rule')).toContainText('אמצע');
    await expect(readout(page, 'fig-8-1a', 'sum')).toContainText('2.656');
    await expect(readout(page, 'fig-8-1a', 'exact')).toContainText(/8\/3|2\.666/);

    // additivity: ∫₀¹ sin ≈ 0.4597, ∫₁^π sin ≈ 1.5403, together 2
    await steps.nth(9).scrollIntoViewIfNeeded();
    await steps.nth(9).click();
    await expect(readout(page, 'fig-8-1a', 'ac')).toContainText(/0\.4597|0\.460/);
    await expect(readout(page, 'fig-8-1a', 'cb')).toContainText('1.54');
    await expect(readout(page, 'fig-8-1a', 'total')).toContainText(/=\s*2\s*$/);
  });

  test('text steps drive the motion figure: displacement 0 and distance 4 at t = 4', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-8-1b');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator('.step[data-fig="fig-8-1b"]');
    // reverse t = 2; reverse t = 4; reverse t = 4 with abs; swing t = 3π/2 with abs; forward t = 2π with abs
    await expect(steps).toHaveCount(5);

    await steps.nth(2).scrollIntoViewIfNeeded();
    await steps.nth(2).click();
    await expect(readout(page, 'fig-8-1b', 'disp')).toContainText(/=\s*0\s*$/);
    await expect(readout(page, 'fig-8-1b', 'dist')).toContainText(/=\s*4\s*$/);
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-8-1"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the reader turns the exact integral on and refines x² to n = 32: the difference shrinks, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-8-1a');
    await fig.getByRole('button', { name: 'האינטגרל המדויק', exact: true }).click();
    await slide(fig.locator('[data-control="n"] input'), 32);
    // R₃₂ of x² on [0, 2] is 715/256 ≈ 2.7930: 0.1263 above 8/3
    await expect(readout(page, 'fig-8-1a', 'sum')).toContainText('2.79');
    await expect(readout(page, 'fig-8-1a', 'diff')).toContainText('0.126');
    await expect.poll(() => done(page, 'fig-8-1a:rs-refine')).toBeTruthy();
  });

  test('the reader switches from the right sum to the left one on x²: the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-8-1a');
    await fig.getByRole('button', { name: 'שמאלי', exact: true }).click();
    // L₂ of x² on [0, 2]: f(0) + f(1) = 1
    await expect(readout(page, 'fig-8-1a', 'rule')).toContainText('שמאלי');
    await expect.poll(() => done(page, 'fig-8-1a:rs-rule')).toBeTruthy();
  });

  test('the reader drags c beyond π: the identity still holds, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-8-1a');
    await fig.getByRole('button', { name: 'תכונות האינטגרל', exact: true }).click();
    await slide(fig.locator('[data-control="c"] input'), 4);
    // ∫₀⁴ sin = 1 − cos 4 ≈ 1.6536, ∫₄^π sin = 1 + cos 4 ≈ 0.3464
    await expect(readout(page, 'fig-8-1a', 'ac')).toContainText(/1\.653|1\.654/);
    await expect(readout(page, 'fig-8-1a', 'reverse')).toBeVisible();
    await expect.poll(() => done(page, 'fig-8-1a:pr-outside')).toBeTruthy();
  });

  test('the reader moves t past the turn of v = 2 − t: the body turns, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-8-1b');
    await slide(fig.locator('[data-control="t"] input'), 3);
    // ∫₀³ (2 − t) dt = 3/2
    await expect(readout(page, 'fig-8-1b', 'disp')).toContainText('1.5');
    await expect.poll(() => done(page, 'fig-8-1b:mo-turn')).toBeTruthy();
  });

  test('the Check has its five bank questions, and 7/4 is graded correct for Q-8.1-left-sum', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-8.1-left-sum', 'Q-8.1-over-under', 'Q-8.1-signed-area', 'Q-8.1-linearity', 'Q-8.1-additivity']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-8.1-left-sum"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-numeric input').fill('7/4');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-8-1-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-8-1-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-8-1-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors the misconception remedies link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'riemann-sum',
      'sample-points',
      'limit-of-sums',
      'by-hand',
      'a-number',
      'monotone',
      'signed-area',
      'cancel',
      'properties',
      'linearity-8',
      'additivity',
      'limits-order',
      'comparison',
      'displacement',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
