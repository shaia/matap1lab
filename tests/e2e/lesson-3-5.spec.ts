import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/3-5/';
const FIGS = ['fig-3-5a', 'fig-3-5b'];
const TASKS = [
  'fig-3-5a:roots-move',
  'fig-3-5a:roots-unity',
  'fig-3-5a:roots-n',
  'fig-3-5b:quadratic-double',
  'fig-3-5b:quadratic-complex',
  'fig-3-5b:quadratic-imag',
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
//   roots:     w ("w = …, |w| = …, Arg w = …"), radius ("|w|^(1/n) = …"), angle ("Arg w / n = …"),
//              step ("2π/n = … (…°)"), principal ("z₀ = …")
//   quadratic: eq, disc ("Δ = b² − 4c = …"), roots
// Negative numbers use U+2212.
const readout = (page: Page, fig: string, id: string) => page.locator(`#${fig} [data-readout="${id}"]`);

/** a slider of the figure by its label ("מספר השורשים n", "המקדם b", "המקדם c") */
const slider = (fig: Locator, label: RegExp) =>
  fig.locator('label.slider').filter({ has: fig.page().locator('.slider-label', { hasText: label }) }).locator('input[type="range"]');

test.describe('lesson 3.5: n-th roots', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('שורשים מסדר n');
    await expect(page.locator('.katex-error')).toHaveCount(0);
  });

  test('the two figures hydrate and draw, in LTR math space', async ({ page }) => {
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

  test('each figure starts in its own mode: the cube roots of −8, the quadratic z² − 2z + 2', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page, 'fig-3-5a');
    await expect(readout(page, 'fig-3-5a', 'radius')).toContainText('= 2');
    await expect(readout(page, 'fig-3-5a', 'step')).toContainText('120°');
    await expect(readout(page, 'fig-3-5a', 'angle')).toContainText('60°');
    await ready(page, 'fig-3-5b');
    await expect(readout(page, 'fig-3-5b', 'disc')).toContainText('−4');
    await expect(readout(page, 'fig-3-5b', 'roots')).toContainText('זוג צמוד');
  });

  test('text steps drive the roots figure: z⁴ = −16, then z³ = 8i, then the sixth roots of unity', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-3-5a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const steps = page.locator('.step[data-fig="fig-3-5a"]');
    // 2 Explore steps, 1 in "all n roots", 1 in "regular polygon", 1 in "roots of unity"
    await expect(steps).toHaveCount(5);

    await steps.nth(2).scrollIntoViewIfNeeded();
    await steps.nth(2).click();
    await expect(readout(page, 'fig-3-5a', 'radius')).toContainText('= 2');
    await expect(readout(page, 'fig-3-5a', 'step')).toContainText('90°');

    await steps.nth(3).scrollIntoViewIfNeeded();
    await steps.nth(3).click();
    await expect(readout(page, 'fig-3-5a', 'angle')).toContainText('30°');
    await expect(readout(page, 'fig-3-5a', 'step')).toContainText('120°');

    await steps.nth(4).scrollIntoViewIfNeeded();
    await steps.nth(4).click();
    await expect(readout(page, 'fig-3-5a', 'radius')).toContainText('= 1');
    await expect(readout(page, 'fig-3-5a', 'step')).toContainText('60°');
  });

  test('text steps drive the quadratic figure: 1 ± i, then ±2i', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-3-5b');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const steps = page.locator('.step[data-fig="fig-3-5b"]');
    await expect(steps).toHaveCount(2);
    await steps.nth(1).scrollIntoViewIfNeeded();
    await steps.nth(1).click();
    await expect(readout(page, 'fig-3-5b', 'disc')).toContainText('−16');
    await expect(readout(page, 'fig-3-5b', 'roots')).toContainText('זוג צמוד');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-3-5"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the reader sets n = 6 with the slider: a hexagon, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-5a');
    await slider(fig, /מספר השורשים/).fill('6');
    await expect(readout(page, 'fig-3-5a', 'step')).toContainText('60°');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-3-5a:roots-n']).toBeTruthy();
  });

  test('the reader puts b = 0 and c > 0: purely imaginary roots, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-5b');
    await slider(fig, /המקדם b/).fill('0');
    await slider(fig, /המקדם c/).fill('2');
    await expect(readout(page, 'fig-3-5b', 'disc')).toContainText('−8');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-3-5b:quadratic-imag']).toBeTruthy();
  });

  test('the Check has its five bank questions, and 1.732 is graded correct for Q-3.5-cube-roots', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-3.5-count', 'Q-3.5-cube-roots', 'Q-3.5-spacing', 'Q-3.5-unity-sixth', 'Q-3.5-factor']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-3.5-cube-roots"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-numeric input').fill('1.732');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-3-5-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-3-5-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-3-5-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors other pages link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'nth-roots',
      'root-recipe',
      'root-modulus',
      'root-angle',
      'why-n',
      'root-notation',
      'regular-polygon',
      'roots-of-unity',
      'roots-sum',
      'polynomial-equations',
      'complex-quadratic',
      'complex-sqrt',
      'quadratic-formula',
      'binomial-equations',
      'fta',
      'conjugate-pairs',
      'real-factoring',
      'roots-physics',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
