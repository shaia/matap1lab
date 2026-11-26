import { expect, test, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/3-2/';
const FIGS = ['fig-3-2a', 'fig-3-2b'];
const TASKS = [
  'fig-3-2a:second-quadrant',
  'fig-3-2a:third-quadrant',
  'fig-3-2a:on-axis',
  'fig-3-2a:conjugate',
  'fig-3-2b:region-inside',
  'fig-3-2b:region-boundary',
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

// ComplexPlane's readout (src/sims/ComplexPlane.tsx): one element per quantity, each with data-readout.
//   polar:  z, mod, arg ("0.927 (53.1°)", "3π/4 (135°)"), atan, conj (when on)
//   add:    sum, parts, diff and dist (when `sub` is on)
//   region: kind, q, test, verdict
// Numbers have 3 significant figures; negative numbers use U+2212.
const readout = (page: Page, fig: string, id: string) => page.locator(`#${fig} [data-readout="${id}"]`);

test.describe('lesson 3.2: the Gauss plane', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('מישור גאוס');
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

  test('each figure starts in its own state: z = 3 + 4i, and the disk around 1 + 2i', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page, 'fig-3-2a');
    await expect(readout(page, 'fig-3-2a', 'z')).toContainText('3 + 4i');
    await expect(readout(page, 'fig-3-2a', 'mod')).toContainText('5');
    await expect(readout(page, 'fig-3-2a', 'arg')).toContainText('53.1');
    await ready(page, 'fig-3-2b');
    await expect(readout(page, 'fig-3-2b', 'kind')).toContainText('עיגול');
    await expect(readout(page, 'fig-3-2b', 'verdict')).toContainText('בחוץ');
  });

  test('text steps drive the plane: the second quadrant against arctan, the Predict sum 8i, the distance 5, Arg(−2 − i)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-3-2a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator('.step[data-fig="fig-3-2a"]');
    // Explore 3; the plane 3 (definition, addition, subtraction); conjugate 1; modulus 1; triangle inequality 1;
    // distance 1; argument 2 (definition, recipe)
    await expect(steps).toHaveCount(12);

    // z = −3 + 4i: Arg ≈ 126.87°, the calculator's arctan(y/x) ≈ −53.13°
    await steps.nth(1).scrollIntoViewIfNeeded();
    await steps.nth(1).click();
    await expect(readout(page, 'fig-3-2a', 'arg')).toContainText('127');
    await expect(readout(page, 'fig-3-2a', 'atan')).toContainText('−53.1');

    // the answer to the Predict: (3 + 4i) + (−3 + 4i) = 8i
    await steps.nth(8).scrollIntoViewIfNeeded();
    await steps.nth(8).click();
    await expect(readout(page, 'fig-3-2a', 'sum')).toContainText('8i');

    // |z − w| for z = 4 + 6i, w = 1 + 2i is 5
    await steps.nth(9).scrollIntoViewIfNeeded();
    await steps.nth(9).click();
    await expect(readout(page, 'fig-3-2a', 'diff')).toContainText('3 + 4i');
    await expect(readout(page, 'fig-3-2a', 'dist')).toContainText('5');

    // the recipe: Arg(−2 − i) = arctan(1/2) − π ≈ −2.68 (−153°), arctan(y/x) ≈ 0.464
    await steps.nth(11).scrollIntoViewIfNeeded();
    await steps.nth(11).click();
    await expect(readout(page, 'fig-3-2a', 'arg')).toContainText('−2.68');
    await expect(readout(page, 'fig-3-2a', 'atan')).toContainText('0.464');
  });

  test('text steps drive the sets figure: disk, bisector, sector across the negative real axis', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-3-2b');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator('.step[data-fig="fig-3-2b"]');
    // circle, disk, annulus, bisector, Re > 1, Im > −1, sector, sector across π
    await expect(steps).toHaveCount(8);

    // |z + 3| ≤ 1 with q = −1.5 + 0.5i: |q + 3| ≈ 1.58 > 1, outside
    await steps.nth(1).scrollIntoViewIfNeeded();
    await steps.nth(1).click();
    await expect(readout(page, 'fig-3-2b', 'kind')).toContainText('עיגול');
    await expect(readout(page, 'fig-3-2b', 'verdict')).toContainText('בחוץ');

    // |z − 1| = |z − i| with q = 1 + i, on the line y = x
    await steps.nth(3).scrollIntoViewIfNeeded();
    await steps.nth(3).click();
    await expect(readout(page, 'fig-3-2b', 'kind')).toContainText('האנך האמצעי');
    await expect(readout(page, 'fig-3-2b', 'verdict')).toContainText('על השפה');

    // 135° ≤ … ≤ −135° counter-clockwise: q = −2 + 0.5i is inside
    await steps.nth(7).scrollIntoViewIfNeeded();
    await steps.nth(7).click();
    await expect(readout(page, 'fig-3-2b', 'kind')).toContainText('גזרה');
    await expect(readout(page, 'fig-3-2b', 'verdict')).toContainText('בפנים');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-3-2"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the reader turns the conjugate on: z̄ appears and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-2a');
    await fig.getByRole('button', { name: 'צמוד' }).click();
    // z = 3 + 4i: z̄ = 3 − 4i and zz̄ = 25
    await expect(readout(page, 'fig-3-2a', 'conj')).toContainText('3 − 4i');
    await expect(readout(page, 'fig-3-2a', 'conj')).toContainText('25');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-3-2a:conjugate']).toBeTruthy();
  });

  test('the reader switches the plane to addition mode', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-2a');
    await fig.getByRole('button', { name: 'חיבור' }).click();
    await expect(readout(page, 'fig-3-2a', 'sum')).toBeVisible();
    await expect(readout(page, 'fig-3-2a', 'mod')).toHaveCount(0);
  });

  test('the Check has its five bank questions, and 13 is graded correct for Q-3.2-modulus', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-3.2-reflect', 'Q-3.2-modulus', 'Q-3.2-arg-q3', 'Q-3.2-circle-set', 'Q-3.2-triangle']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-3.2-modulus"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-numeric input').fill('13');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-3-2-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-3-2-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-3-2-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors the misconception remedies link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'plane',
      'conjugate-reflection',
      'modulus',
      'modulus-properties',
      'triangle-inequality',
      'distance',
      'trig-reminder',
      'argument',
      'principal-argument',
      'argument-quadrant',
      'sets',
      'distance-sets',
      'bisector',
      'half-planes',
      'arg-sets',
      'combined-sets',
      'tangent-directions',
      'gauss-physics',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
