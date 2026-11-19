import { expect, test, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/2-3/';
const FIGS = ['fig-2-3a', 'fig-2-3b', 'fig-2-3c'];
const TASKS = [
  'fig-2-3a:polar-quadrant-2',
  'fig-2-3a:polar-same-arctan',
  'fig-2-3a:polar-axis',
  'fig-2-3a:polar-wrap',
  'fig-2-3b:curve-cos-closes',
  'fig-2-3b:curve-sin-circle',
  'fig-2-3b:curve-cardioid-origin',
  'fig-2-3b:curve-cardioid-left',
  'fig-2-3c:region-quarter-ring',
  'fig-2-3c:region-disc',
  'fig-2-3c:region-sector',
  'fig-2-3c:region-r-only',
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

// CoordinateLab's readout (src/sims/CoordinateLab.tsx): one element per quantity, each with data-readout.
//   polar:  to-xy, to-polar, quadrant, arctan, theta ("135° = 3π/4"), trap, wrap
//   curve:  equation, theta, r, xy, cartesian, range
//   region: region ("1 ≤ r ≤ 2,   0 ≤ θ ≤ π/2"), q-point, q-r, q-theta, q-verdict
// Negative numbers use U+2212.
const readout = (page: Page, fig: string, id: string) => page.locator(`#${fig} [data-readout="${id}"]`);

test.describe('lesson 2.3: polar coordinates', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('קואורדינטות קוטביות');
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

  test('each figure starts in its own mode: P at (2, 30°), the circle r = 2, the quarter ring', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page, 'fig-2-3a');
    await expect(readout(page, 'fig-2-3a', 'theta')).toContainText('30°');
    await expect(readout(page, 'fig-2-3a', 'to-xy')).toContainText('1.73');
    await expect(readout(page, 'fig-2-3a', 'quadrant')).toContainText('ראשון');
    await ready(page, 'fig-2-3b');
    await expect(readout(page, 'fig-2-3b', 'equation')).toContainText('r = 2');
    await expect(readout(page, 'fig-2-3b', 'cartesian')).toContainText('x² + y² = 4');
    await ready(page, 'fig-2-3c');
    await expect(readout(page, 'fig-2-3c', 'region')).toContainText('1 ≤ r ≤ 2');
    await expect(readout(page, 'fig-2-3c', 'q-verdict')).toContainText('בתוך התחום');
  });

  test('text steps drive the polar figure: (1, 1) at 45°, then 300° against arctan = −60°, then (1, −1) at 315°', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-2-3a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const steps = page.locator('.step[data-fig="fig-2-3a"]');
    // 3 Explore steps, 2 in the definition (before and after the trigonometry reminder), 1 in "the right quadrant"
    await expect(steps).toHaveCount(6);

    await steps.nth(1).scrollIntoViewIfNeeded();
    await steps.nth(1).click();
    await expect(readout(page, 'fig-2-3a', 'theta')).toContainText('45°');
    await expect(readout(page, 'fig-2-3a', 'arctan')).toContainText('45°');

    await steps.nth(2).scrollIntoViewIfNeeded();
    await steps.nth(2).click();
    await expect(readout(page, 'fig-2-3a', 'theta')).toContainText('300°');
    await expect(readout(page, 'fig-2-3a', 'arctan')).toContainText('−60°');
    await expect(readout(page, 'fig-2-3a', 'quadrant')).toContainText('רביעי');

    await steps.nth(5).scrollIntoViewIfNeeded();
    await steps.nth(5).click();
    await expect(readout(page, 'fig-2-3a', 'theta')).toContainText('315°');
    await expect(readout(page, 'fig-2-3a', 'arctan')).toContainText('−45°');
  });

  test('text steps drive the curve and the region figures', async ({ page }) => {
    await page.goto(LESSON);
    const curve = page.locator('#fig-2-3b');
    await curve.scrollIntoViewIfNeeded();
    await hydrated(curve.locator('canvas'));
    const curveSteps = page.locator('.step[data-fig="fig-2-3b"]');
    await expect(curveSteps).toHaveCount(6);
    // the cardioid, traced to 90°: r = 1 + cos 90° = 1, the point (0, 1)
    await curveSteps.nth(2).scrollIntoViewIfNeeded();
    await curveSteps.nth(2).click();
    await expect(readout(page, 'fig-2-3b', 'equation')).toContainText('r = 1 + cos θ');
    await expect(readout(page, 'fig-2-3b', 'theta')).toContainText('90°');
    await expect(readout(page, 'fig-2-3b', 'xy')).toContainText('(0, 1)');
    // r = 2cos θ is the circle (x − 1)² + y² = 1
    await curveSteps.nth(4).scrollIntoViewIfNeeded();
    await curveSteps.nth(4).click();
    await expect(readout(page, 'fig-2-3b', 'equation')).toContainText('r = 2cos θ');
    await expect(readout(page, 'fig-2-3b', 'cartesian')).toContainText('(x − 1)² + y² = 1');

    const region = page.locator('#fig-2-3c');
    await region.scrollIntoViewIfNeeded();
    await hydrated(region.locator('canvas'));
    const regionSteps = page.locator('.step[data-fig="fig-2-3c"]');
    await expect(regionSteps).toHaveCount(2);
    await regionSteps.nth(1).scrollIntoViewIfNeeded();
    await regionSteps.nth(1).click();
    await expect(readout(page, 'fig-2-3c', 'region')).toContainText('0 ≤ r ≤ 2');
    await expect(readout(page, 'fig-2-3c', 'q-point')).toContainText('(0, 1)');
    await expect(readout(page, 'fig-2-3c', 'q-verdict')).toContainText('בתוך התחום');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-2-3"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the reader builds the quarter ring of quadrant II with the steppers, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-3c');
    // from 1 ≤ r ≤ 2, 0° ≤ θ ≤ 90°: first β up to 180°, then α up to 90° (α may not pass β − 15°)
    const beta = fig.locator('[data-stepper="beta"] [data-step="inc"]');
    const alpha = fig.locator('[data-stepper="alpha"] [data-step="inc"]');
    for (let k = 0; k < 6; k++) await beta.click();
    for (let k = 0; k < 6; k++) await alpha.click();
    await expect(fig.locator('[data-stepper="alpha"] [data-value]')).toHaveText('90°');
    await expect(fig.locator('[data-stepper="beta"] [data-value]')).toHaveText('180°');
    await expect(readout(page, 'fig-2-3c', 'q-theta')).toContainText('✗');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-2-3c:region-quarter-ring']).toBeTruthy();
  });

  test('the Check has its five bank questions, and −2 is graded correct for Q-2.3-to-cartesian', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-2.3-to-cartesian', 'Q-2.3-angle-quadrant', 'Q-2.3-same-point', 'Q-2.3-circle-to-polar', 'Q-2.3-annulus']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-2.3-to-cartesian"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-numeric input').fill('-2');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-2-3-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-2-3-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-2-3-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors other pages link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'polar-definition',
      'trig-reminder',
      'polar-not-unique',
      'angle-quadrant',
      'angle-symmetric-range',
      'polar-square',
      'polar-intersect',
      'polar-curves',
      'polar-grid',
      'polar-sketch',
      'polar-extreme',
      'polar-translate',
      'polar-regions',
      'polar-offcentre',
      'polar-physics',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
