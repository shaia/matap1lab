import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/5-1/';
const FIGS = ['fig-5-1a', 'fig-5-1b', 'fig-5-1c'];
const TASKS = [
  'fig-5-1a:motion-rest',
  'fig-5-1a:motion-back',
  'fig-5-1a:motion-vel',
  'fig-5-1b:secant-close',
  'fig-5-1b:secant-sides',
  'fig-5-1b:secant-steep',
  'fig-5-1c:zoom-straight',
  'fig-5-1c:zoom-corner',
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

// Readouts (src/sims/SlopeGraph.tsx, src/sims/DerivLab.tsx): one element per quantity, each with data-readout.
//   SlopeGraph motion: fn, t, x, v, dir ("נע קדימה" / "נע אחורה" / "עוצר")
//   DerivLab secant:   fn, x0, h, quotient, table, slope (with the tangent: f′(x0), "אין משיק" or "משיק אנכי")
//   DerivLab zoom:     fn, x0, zoom, verdict ("נראה כמו ישר" for z ≥ 50, "פינה…", "משיק אנכי…"), slope
// Negative numbers use U+2212.
const readout = (page: Page, fig: string, id: string) => page.locator(`#${fig} [data-readout="${id}"]`);

/** a slider of a figure by the text of its label ("הזמן t", "הצעד |h|", "ההגדלה") */
const slider = (fig: Locator, label: string) =>
  fig.locator('label.slider').filter({ has: fig.page().locator('.slider-label', { hasText: label }) }).locator('input[type="range"]');

/** a function button of DerivLab (its label is the function's text, e.g. "|x|", "∛x") */
const fnButton = (fig: Locator, text: string) => fig.getByRole('group', { name: 'הפונקציה' }).getByRole('button', { name: text, exact: true });

const ticked = (page: Page, task: string) => expect.poll(async () => ((await progress(page))?.tasks ?? {})[task]).toBeTruthy();

test.describe('lesson 5.1: velocity and the difference quotient', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('מהירות ומנת הפרשים');
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

  test('each figure starts in its own state: back-and-forth motion, x² at 1, x² unzoomed', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page, 'fig-5-1a');
    await expect(readout(page, 'fig-5-1a', 'fn')).toContainText('t³ − 6t² + 9t');
    await expect(readout(page, 'fig-5-1a', 'dir')).toContainText('נע קדימה');
    await ready(page, 'fig-5-1b');
    await expect(readout(page, 'fig-5-1b', 'fn')).toContainText('x²');
    await expect(readout(page, 'fig-5-1b', 'quotient')).toContainText('3');
    await ready(page, 'fig-5-1c');
    await expect(readout(page, 'fig-5-1c', 'fn')).toContainText('x²');
  });

  test('text steps drive the motion figure: the ball stops at its top, the body moves back at t = 2', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-5-1a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator('.step[data-fig="fig-5-1a"]');
    // Explore 2 (back-forth, ball); velocity: ball t = 1, t = 3, t = 2 (the prediction), t = 3 with v; back-forth t = 2
    await expect(steps).toHaveCount(7);

    await steps.nth(4).scrollIntoViewIfNeeded();
    await steps.nth(4).click();
    await expect(readout(page, 'fig-5-1a', 'dir')).toContainText('עוצר');
    await expect(readout(page, 'fig-5-1a', 'x')).toContainText('20');

    await steps.nth(6).scrollIntoViewIfNeeded();
    await steps.nth(6).click();
    await expect(readout(page, 'fig-5-1a', 'dir')).toContainText('נע אחורה');
    await expect(readout(page, 'fig-5-1a', 'v')).toContainText('−3');
  });

  test('text steps drive the secant and zoom figures: a corner has no tangent, ∛x has a vertical one', async ({ page }) => {
    await page.goto(LESSON);
    const sec = page.locator('#fig-5-1b');
    await sec.scrollIntoViewIfNeeded();
    await hydrated(sec.locator('canvas').first());
    const secSteps = page.locator('.step[data-fig="fig-5-1b"]');
    // x² with h = 1; x² with the tangent; x³; |x|; the kink; ∛x; √x
    await expect(secSteps).toHaveCount(7);
    await secSteps.nth(1).scrollIntoViewIfNeeded();
    await secSteps.nth(1).click();
    await expect(readout(page, 'fig-5-1b', 'slope')).toContainText('2');
    await secSteps.nth(3).scrollIntoViewIfNeeded();
    await secSteps.nth(3).click();
    await expect(readout(page, 'fig-5-1b', 'slope')).toContainText('אין משיק');
    await secSteps.nth(5).scrollIntoViewIfNeeded();
    await secSteps.nth(5).click();
    await expect(readout(page, 'fig-5-1b', 'slope')).toContainText('משיק אנכי');

    const zoom = page.locator('#fig-5-1c');
    await zoom.scrollIntoViewIfNeeded();
    await hydrated(zoom.locator('canvas').first());
    const zoomSteps = page.locator('.step[data-fig="fig-5-1c"]');
    // x² at 1; |x| at 0; ∛x at 0
    await expect(zoomSteps).toHaveCount(3);
    await zoomSteps.nth(1).scrollIntoViewIfNeeded();
    await zoomSteps.nth(1).click();
    await expect(readout(page, 'fig-5-1c', 'verdict')).toContainText('פינה');
    await zoomSteps.nth(2).scrollIntoViewIfNeeded();
    await zoomSteps.nth(2).click();
    await expect(readout(page, 'fig-5-1c', 'verdict')).toContainText('משיק אנכי');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-5-1"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the reader finds a stop, a backward stretch, and then shows the velocity graph', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-1a');
    const t = slider(fig, 'הזמן');
    await t.fill('2');
    await expect(readout(page, 'fig-5-1a', 'dir')).toContainText('נע אחורה');
    await ticked(page, 'fig-5-1a:motion-back');
    await t.fill('1');
    await expect(readout(page, 'fig-5-1a', 'dir')).toContainText('עוצר');
    await ticked(page, 'fig-5-1a:motion-rest');
    await fig.getByRole('button', { name: 'גרף מהירות' }).click();
    await ticked(page, 'fig-5-1a:motion-vel');
  });

  test('the reader shrinks h for x² at 1: the quotient 2.001 at h = 10⁻³, and the exact slope 2', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-1b');
    // the |h| slider holds −log10|h|
    await slider(fig, 'הצעד').fill('3');
    await expect(readout(page, 'fig-5-1b', 'quotient')).toContainText('2.001');
    await ticked(page, 'fig-5-1b:secant-close');
    await fig.getByRole('button', { name: 'משיק', exact: true }).click();
    await expect(readout(page, 'fig-5-1b', 'slope')).toContainText('2');
  });

  test('the reader tries both sides at the corner of |x| and shrinks h at the vertical tangent of ∛x', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-1b');
    await fnButton(fig, '|x|').click();
    await slider(fig, 'הצעד').fill('2');
    await fig.getByRole('button', { name: 'מימין', exact: true }).click();
    await expect(readout(page, 'fig-5-1b', 'quotient')).toContainText('1');
    await fig.getByRole('button', { name: 'משמאל', exact: true }).click();
    await expect(readout(page, 'fig-5-1b', 'quotient')).toContainText('−1');
    await ticked(page, 'fig-5-1b:secant-sides');

    await fnButton(fig, '∛x').click();
    await slider(fig, 'הצעד').fill('3');
    await expect(readout(page, 'fig-5-1b', 'quotient')).toContainText('100');
    await ticked(page, 'fig-5-1b:secant-steep');
  });

  test('the reader zooms: x² looks straight, the corner of |x| stays', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-1c');
    // the zoom slider holds log10 z
    await slider(fig, 'ההגדלה').fill('2');
    await expect(readout(page, 'fig-5-1c', 'verdict')).toContainText('נראה כמו ישר');
    await ticked(page, 'fig-5-1c:zoom-straight');
    await fnButton(fig, '|x|').click();
    await slider(fig, 'ההגדלה').fill('1');
    await slider(fig, 'ההגדלה').fill('2.5');
    await expect(readout(page, 'fig-5-1c', 'verdict')).toContainText('פינה');
    await ticked(page, 'fig-5-1c:zoom-corner');
  });

  test('the Check has its five bank questions, and 5 is graded correct for Q-5.1-avg-velocity', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-5.1-slope-reading', 'Q-5.1-avg-velocity', 'Q-5.1-plug-h0', 'Q-5.1-recip', 'Q-5.1-abs-corner']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-5.1-avg-velocity"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-numeric input').fill('5');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-5-1-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-5-1-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-5-1-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors the misconception remedies link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'velocity-slope',
      'avg-to-instant',
      'reading-rules',
      'derivative-def',
      'def-recipe',
      'algebra-tricks',
      'value-vs-slope',
      'not-differentiable',
      'vertical',
      'diff-implies-cont',
      'abs-formula',
      'zoom',
      'derivative-physics',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
