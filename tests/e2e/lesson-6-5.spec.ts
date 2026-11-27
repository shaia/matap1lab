import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/6-5/';
const FIGS = ['fig-6-5a', 'fig-6-5b'];
const TASKS = [
  'fig-6-5a:sketch-flat',
  'fig-6-5a:sketch-max',
  'fig-6-5a:sketch-inflect',
  'fig-6-5a:sketch-asym',
  'fig-6-5b:local-zoom',
  'fig-6-5b:local-flat-max',
  'fig-6-5b:local-tangent',
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

// SketchLab's hooks (src/sims/SketchLab.tsx, header comment): one element per quantity, each with data-readout.
//   sketch: fn, x, fx, f1x, f2x; domain / asym (+ gap) / mono / conc / points when the layer is on
//   local:  fn, zoom, residual, lead, order ("k = 4"), coef, next, verdict, note
// Layer toggles and the reset are buttons by name; [data-control="preset"] select, [data-control="x"] input (the
// probe), [data-control="zoom"] input (log10 of the zoom). Negative numbers use U+2212.
const readout = (page: Page, fig: string, id: string) => page.locator(`#${fig} [data-readout="${id}"]`);

/** Set a range input as a student would: the value, then an input event. */
const slide = (s: Locator, v: number) =>
  s.evaluate((el: HTMLInputElement, value) => {
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);

test.describe('lesson 6.5: sketching graphs', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('שרטוט גרפים');
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

  test('each figure starts on the track of the hook: x⁴ − 4x³, and near 0 its leading term has order 3', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page, 'fig-6-5a');
    await expect(readout(page, 'fig-6-5a', 'fn')).toContainText('x⁴ − 4x³');
    await ready(page, 'fig-6-5b');
    await expect(readout(page, 'fig-6-5b', 'fn')).toContainText('x⁴ − 4x³');
    await expect(readout(page, 'fig-6-5b', 'order')).toContainText('k = 3');
    await expect(readout(page, 'fig-6-5b', 'verdict')).toContainText('חוצה');
  });

  test('text steps drive the sketch figure: the bell curve has inflection points, (x² − 3)/(x − 2) has none', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-6-5a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator('.step[data-fig="fig-6-5a"]');
    // Explore 3; recap 2 (cubic, quartic); convexity 1; inflection 2 (gauss, quartic); oblique 1; recipe 2 (oblique,
    // x ln x); resonance 1
    await expect(steps).toHaveCount(12);

    // the bell curve: two inflection points
    await steps.nth(6).scrollIntoViewIfNeeded();
    await steps.nth(6).click();
    await expect(readout(page, 'fig-6-5a', 'fn')).toContainText('e^(−x²/2)');
    await expect(readout(page, 'fig-6-5a', 'points')).toContainText('נקודת פיתול');

    // the full investigation of (x² − 3)/(x − 2): the oblique asymptote, and no inflection point
    await steps.nth(9).scrollIntoViewIfNeeded();
    await steps.nth(9).click();
    await expect(readout(page, 'fig-6-5a', 'asym')).toContainText('y = x + 2');
    await expect(readout(page, 'fig-6-5a', 'points')).toContainText('אין נקודות פיתול');
    await expect(readout(page, 'fig-6-5a', 'points')).toContainText('מקסימום מקומי');
  });

  test('text steps drive the local figure: −x⁴/24 is a maximum although f″(0) = 0', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-6-5b');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator('.step[data-fig="fig-6-5b"]');
    // leading behaviour: quartic0, quartic3, ex1x, cos4, sinh-sin, sin-pi; physics: quartic3 zoomed
    await expect(steps).toHaveCount(7);

    await steps.nth(1).scrollIntoViewIfNeeded();
    await steps.nth(1).click();
    await expect(readout(page, 'fig-6-5b', 'order')).toContainText('k = 2');
    await expect(readout(page, 'fig-6-5b', 'verdict')).toContainText('מינימום מקומי');

    await steps.nth(3).scrollIntoViewIfNeeded();
    await steps.nth(3).click();
    await expect(readout(page, 'fig-6-5b', 'order')).toContainText('k = 4');
    await expect(readout(page, 'fig-6-5b', 'verdict')).toContainText('מקסימום מקומי');

    await steps.nth(4).scrollIntoViewIfNeeded();
    await steps.nth(4).click();
    await expect(readout(page, 'fig-6-5b', 'order')).toContainText('k = 3');
    await expect(readout(page, 'fig-6-5b', 'verdict')).toContainText('חוצה');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-6-5"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the reader moves the probe far along (x² − 3)/(x − 2): the gap to y = x + 2 is 1/8 at x = 10, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-6-5a');
    await fig.locator('[data-control="preset"] select').selectOption('oblique');
    await fig.getByRole('button', { name: 'אסימפטוטות', exact: true }).click();
    await slide(fig.locator('[data-control="x"] input'), 10);
    await expect(readout(page, 'fig-6-5a', 'gap')).toContainText('0.125');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-6-5a:sketch-asym']).toBeTruthy();
  });

  test('the reader zooms ×100 on the flat point of x⁴ − 4x³ and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-6-5b');
    await slide(fig.locator('[data-control="zoom"] input'), 2);
    await expect(readout(page, 'fig-6-5b', 'zoom')).toContainText('100');
    await expect(readout(page, 'fig-6-5b', 'order')).toContainText('k = 3');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-6-5b:local-zoom']).toBeTruthy();
  });

  test('the Check has its five bank questions, and 2 is graded correct for Q-6.5-inflection', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-6.5-asymptotes', 'Q-6.5-inflection', 'Q-6.5-convex', 'Q-6.5-x4', 'Q-6.5-flat-cubic']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-6.5-inflection"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-numeric input').fill('2');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-6-5-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-6-5-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-6-5-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors the misconception remedies link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'recap',
      'derivative-reminder',
      'vertical-asymptotes',
      'convexity',
      'inflection',
      'fpp-zero',
      'inflection-vs-critical',
      'oblique',
      'asymptote-degree',
      'recipe',
      'check-values',
      'resonance',
      'leading-behaviour',
      'second-derivative-test',
      'sketch-physics',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
