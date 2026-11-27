import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/5-4/';
const FIGS = ['fig-5-4a', 'fig-5-4b'];
const TASKS = [
  'fig-5-4a:implicit-horizontal',
  'fig-5-4a:implicit-vertical',
  'fig-5-4a:implicit-branch',
  'fig-5-4b:inverse-recip',
  'fig-5-4b:inverse-flat',
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

// ImplicitLab (src/sims/ImplicitLab.tsx), implicit mode: readouts eq, p, slope ("y′ = −3/4 = −0.75",
//   "y′ = 0: משיק אופקי…", "משיק אנכי: …"), formula, check, and others (with the toggle "חתיכה שהיא גרף y(x)").
//   P walks along the curve with ←/→ on the focused canvas (circle from (3, 4): 93 × ← reaches (5, 0)).
// RulesLab (src/sims/RulesLab.tsx), inverse mode: readouts fn, a, fa ("f(a) = 3"), m, minv ("… = 1/m = 0.25" or
//   "משיק אנכי: ההפוכה אינה גזירה כאן"); preset buttons "eˣ", "x³", "sin x", "tan x", "x³ + x + 1"; slider "הנקודה a".
// Negative numbers use U+2212.
const readout = (page: Page, fig: string, id: string) => page.locator(`#${fig} [data-readout="${id}"]`);
const slider = (fig: Locator, label: RegExp) =>
  fig.locator('label.slider').filter({ has: fig.page().locator('.slider-label', { hasText: label }) }).locator('input[type="range"]');
const task = async (page: Page, id: string) => ((await progress(page))?.tasks ?? {})[id];

test.describe('lesson 5.4: implicit differentiation and the derivative of an inverse function', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('גזירה סתומה');
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

  test('each figure starts in its own state: the circle at (3, 4), eˣ at a = 1', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page, 'fig-5-4a');
    await expect(readout(page, 'fig-5-4a', 'eq')).toContainText('x² + y² = 25');
    await expect(readout(page, 'fig-5-4a', 'slope')).toContainText('−3/4');
    await ready(page, 'fig-5-4b');
    await expect(readout(page, 'fig-5-4b', 'fn')).toContainText('eˣ');
    await expect(readout(page, 'fig-5-4b', 'minv')).toContainText('1/m');
  });

  test('text steps drive the implicit figure: the vertical tangent at (5, 0), the folium at (3, 3)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-5-4a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator('.step[data-fig="fig-5-4a"]');
    // Explore 2 (circle, folium with branch); idea 1 (circle with branch); recipe 1 (tilted); tangents 2 (circle at (5, 0), folium)
    await expect(steps).toHaveCount(6);

    await steps.nth(3).scrollIntoViewIfNeeded();
    await steps.nth(3).click();
    await expect(readout(page, 'fig-5-4a', 'eq')).toContainText('x² + xy + y² = 7');
    await expect(readout(page, 'fig-5-4a', 'slope')).toContainText('−4/5');

    await steps.nth(4).scrollIntoViewIfNeeded();
    await steps.nth(4).click();
    await expect(readout(page, 'fig-5-4a', 'slope')).toContainText('משיק אנכי');

    await steps.nth(5).scrollIntoViewIfNeeded();
    await steps.nth(5).click();
    await expect(readout(page, 'fig-5-4a', 'eq')).toContainText('x³ + y³ = 6xy');
    await expect(readout(page, 'fig-5-4a', 'slope')).toContainText('−1');
  });

  test('text steps drive the inverse figure: 1/4 for x³ + x + 1 at 3, a vertical tangent for ∛x at 0', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-5-4b');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator('.step[data-fig="fig-5-4b"]');
    // inverse-derivative (eˣ), the recipe (x³ + x + 1), f′ = 0 (x³), ln (eˣ at 0), arcsin (sin at π/6), arctan (tan at π/4)
    await expect(steps).toHaveCount(6);

    await steps.nth(1).scrollIntoViewIfNeeded();
    await steps.nth(1).click();
    await expect(readout(page, 'fig-5-4b', 'fa')).toContainText('3');
    await expect(readout(page, 'fig-5-4b', 'minv')).toContainText('0.25');

    await steps.nth(2).scrollIntoViewIfNeeded();
    await steps.nth(2).click();
    await expect(readout(page, 'fig-5-4b', 'minv')).toContainText('משיק אנכי');

    await steps.nth(5).scrollIntoViewIfNeeded();
    await steps.nth(5).click();
    await expect(readout(page, 'fig-5-4b', 'minv')).toContainText('0.5');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-5-4"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the reader walks P to the right end of the circle: a vertical tangent, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-4a');
    const canvas = fig.locator('canvas').first();
    await canvas.focus();
    for (let i = 0; i < 93; i++) await canvas.press('ArrowLeft');
    await expect(readout(page, 'fig-5-4a', 'slope')).toContainText('משיק אנכי');
    await expect.poll(() => task(page, 'fig-5-4a:implicit-vertical')).toBeTruthy();
  });

  test('the reader turns on the graph piece and moves P: the other points appear, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-4a');
    await fig.getByRole('button', { name: /חתיכה שהיא גרף/ }).click();
    const canvas = fig.locator('canvas').first();
    await canvas.focus();
    await canvas.press('ArrowRight');
    await expect(readout(page, 'fig-5-4a', 'others')).toBeVisible();
    await expect.poll(() => task(page, 'fig-5-4a:implicit-branch')).toBeTruthy();
  });

  test('the reader moves a on x³ + x + 1 to 1: the slopes 4 and 0.25, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-4b');
    await fig.getByRole('button', { name: 'x³ + x + 1', exact: true }).click();
    await slider(fig, /הנקודה a/).fill('1');
    await expect(readout(page, 'fig-5-4b', 'fa')).toContainText('3');
    await expect(readout(page, 'fig-5-4b', 'm')).toContainText('4');
    await expect(readout(page, 'fig-5-4b', 'minv')).toContainText('0.25');
    await expect.poll(() => task(page, 'fig-5-4b:inverse-recip')).toBeTruthy();
  });

  test('the reader brings a to 0 on x³: the inverse has a vertical tangent, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-4b');
    await fig.getByRole('button', { name: 'x³', exact: true }).click();
    await slider(fig, /הנקודה a/).fill('0');
    await expect(readout(page, 'fig-5-4b', 'minv')).toContainText('משיק אנכי');
    await expect.poll(() => task(page, 'fig-5-4b:inverse-flat')).toBeTruthy();
  });

  test('the Check has its five bank questions, and 1/2 is graded correct for Q-5.4-inverse-exp', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-5.4-implicit-expr', 'Q-5.4-inverse-exp', 'Q-5.4-arccos', 'Q-5.4-xx', 'Q-5.4-vertical']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-5.4-inverse-exp"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-numeric input').fill('1/2');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-5-4-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-5-4-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-5-4-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors the misconception remedies link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'implicit-idea',
      'implicit-branch',
      'implicit-recipe',
      'implicit-tangents',
      'folium',
      'implicit-why',
      'implicit-physics',
      'inverse-derivative',
      'inverse-point',
      'inverse-flat',
      'ln-derivative',
      'inverse-trig-derivatives',
      'arcsin-derivative',
      'arccos-derivative',
      'arctan-derivative',
      'real-power',
      'log-diff',
      'log-diff-last',
      'inverse-physics',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
