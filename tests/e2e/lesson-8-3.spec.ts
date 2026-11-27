import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/8-3/';
const FIGS = ['fig-8-3a', 'fig-8-3b'];
const TASKS = [
  'fig-8-3a:tail-far',
  'fig-8-3a:tail-p',
  'fig-8-3a:tail-slow',
  'fig-8-3a:spike-eps',
  'fig-8-3a:spike-p',
  'fig-8-3b:cmp-bound',
  'fig-8-3b:cmp-div',
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

// ImproperLab's hooks (src/sims/ImproperLab.tsx, header comment): mode buttons "קצה אינסופי", "פונקציה לא חסומה",
// "מבחן ההשוואה"; [data-control="preset"] select (tail, compare); inputs [data-control=…]: tail r (log₁₀ R), p;
// spike eps (log₁₀ ε), p; compare r (log₁₀ R). Readouts [data-readout=…]: tail fn, closed, r, int, limit; spike fn,
// closed, eps, int, limit; compare fn, r, intf, intg, relation, verdict. Negative numbers use U+2212.
const readout = (page: Page, fig: string, id: string) => page.locator(`#${fig} [data-readout="${id}"]`);

/** Set a range input as a student would: the value, then an input event. */
const slide = (s: Locator, v: number) =>
  s.evaluate((el: HTMLInputElement, value) => {
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);

test.describe('lesson 8.3: improper integrals', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('אינטגרלים לא אמיתיים');
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

  test('the figures start on 1/x² from 1 to R = 5 and on e^(−x²) below e^(−x)', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page, 'fig-8-3a');
    await expect(readout(page, 'fig-8-3a', 'fn')).toContainText('1/xᵖ');
    await expect(readout(page, 'fig-8-3a', 'fn')).toContainText('p = 2');
    await expect(readout(page, 'fig-8-3a', 'r')).toContainText('R = 5');
    await expect(readout(page, 'fig-8-3a', 'limit')).toContainText('מתכנס');
    const b = await ready(page, 'fig-8-3b');
    await expect(readout(page, 'fig-8-3b', 'fn')).toContainText('e^(−x²)');
    await expect(readout(page, 'fig-8-3b', 'verdict')).toContainText('מתכנס');
    // two mode buttons on the first figure, none on the second
    const a = page.locator('#fig-8-3a');
    await expect(a.getByRole('button', { name: 'קצה אינסופי', exact: true })).toHaveCount(1);
    await expect(a.getByRole('button', { name: 'פונקציה לא חסומה', exact: true })).toHaveCount(1);
    await expect(b.getByRole('button', { name: 'מבחן ההשוואה', exact: true })).toHaveCount(0);
  });

  test('text steps drive the first figure: 1/x diverges, π/2 for 1/(1 + x²), and the spike of 1/√x', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-8-3a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator('.step[data-fig="fig-8-3a"]');
    // Explore 3 (p = 2, p = 1, spike 1/√x); definition exp, lorentz; powers p = 1.5, p = 0.5; unbounded spike p = 0.5,
    // p = 2; exp-standard exp
    await expect(steps).toHaveCount(10);

    // p = 1: no limit line, the readout says it grows without bound
    await steps.nth(1).scrollIntoViewIfNeeded();
    await steps.nth(1).click();
    await expect(readout(page, 'fig-8-3a', 'limit')).toContainText('גדל בלי גבול');

    // arctan R → π/2
    await steps.nth(4).scrollIntoViewIfNeeded();
    await steps.nth(4).click();
    await expect(readout(page, 'fig-8-3a', 'limit')).toContainText('π/2');

    // p = 1/2 at R = 100: 2√R − 2 = 18
    await steps.nth(6).scrollIntoViewIfNeeded();
    await steps.nth(6).click();
    await expect(readout(page, 'fig-8-3a', 'int')).toContainText('18');

    // the spike of 1/√x from ε = 0.01: 2 − 2√ε = 1.8, converging to 2
    await steps.nth(7).scrollIntoViewIfNeeded();
    await steps.nth(7).click();
    await expect(readout(page, 'fig-8-3a', 'int')).toContainText('1.8');
    await expect(readout(page, 'fig-8-3a', 'limit')).toContainText('מתכנס');

    // the spike of 1/x² from ε = 0.01: 1/ε − 1 = 99, diverging
    await steps.nth(8).scrollIntoViewIfNeeded();
    await steps.nth(8).click();
    await expect(readout(page, 'fig-8-3a', 'int')).toContainText('99');
    await expect(readout(page, 'fig-8-3a', 'limit')).toContainText('גדל בלי גבול');
  });

  test('text steps drive the comparison figure: (2 + sin x)/x above 1/x diverges', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-8-3b');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator('.step[data-fig="fig-8-3b"]');
    // comparison exp2, div, root; physics atan
    await expect(steps).toHaveCount(4);
    await steps.nth(1).scrollIntoViewIfNeeded();
    await steps.nth(1).click();
    await expect(readout(page, 'fig-8-3b', 'fn')).toContainText('(2 + sin x)/x');
    await expect(readout(page, 'fig-8-3b', 'verdict')).toContainText('מתבדר');
    await expect(readout(page, 'fig-8-3b', 'intf')).toContainText('חישוב נומרי');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-8-3"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the reader drags R to 1000 under 1/x²: the area is 0.999, and tail-far is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-8-3a');
    await slide(fig.locator('[data-control="r"] input'), 3);
    await expect(readout(page, 'fig-8-3a', 'int')).toContainText('0.999');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-8-3a:tail-far']).toBeTruthy();
  });

  test('the reader picks (2 + sin x)/x and drags R to 100: it diverges, and cmp-div is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-8-3b');
    await fig.locator('[data-control="preset"] select').selectOption('div');
    await slide(fig.locator('[data-control="r"] input'), 2);
    await expect(readout(page, 'fig-8-3b', 'r')).toContainText('R = 100');
    await expect(readout(page, 'fig-8-3b', 'verdict')).toContainText('מתבדר');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-8-3b:cmp-div']).toBeTruthy();
  });

  test('the Check has its five bank questions, and 4 is graded correct for Q-8.3-exp', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-8.3-infinite', 'Q-8.3-exp', 'Q-8.3-power-unbounded', 'Q-8.3-hidden-singularity', 'Q-8.3-compare-mc']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-8.3-exp"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-numeric input').fill('4');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-8-3-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-8-3-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-8-3-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors the misconception remedies link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'definition',
      'recipe-tail',
      'powers',
      'not-enough',
      'unbounded',
      'mirror',
      'p-table',
      'exp-standard',
      'split',
      'hidden',
      'whole-line',
      'comparison',
      'comparison-test',
      'comparison-direction',
      'power-compare',
      'power-recipe',
      'limit-compare',
      'physics',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
