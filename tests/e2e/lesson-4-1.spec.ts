import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/4-1/';
const FIGS = ['fig-4-1a', 'fig-4-1b'];
const TASKS = ['fig-4-1a:read-zero', 'fig-4-1a:read-turn', 'fig-4-1a:read-outside', 'fig-4-1b:compose-break', 'fig-4-1b:compose-swap'];

/** Bring a figure into view, wait for its island, stop text steps from driving it, and reset it. */
async function ready(page: Page, fig: string) {
  const f = page.locator(`#${fig}`);
  await f.scrollIntoViewIfNeeded();
  await hydrated(f.locator('canvas').first());
  await freezeSteps(page);
  await f.getByRole('button', { name: 'איפוס' }).click();
  return f;
}

// GraphLab's readout (src/sims/GraphLab.tsx): one element per quantity, each with data-readout.
//   read:    x, fx ("f(x) = −3" or "f(x) לא מוגדרת"), zeros, with the toggles also domain, range, mono
//   compose: chain ("x = 4 → g(x) = 5 → f(g(x)) = 2.24"), domain (a probe on the window)
// Negative numbers use U+2212.
const readout = (page: Page, fig: string, id: string) => page.locator(`#${fig} [data-readout="${id}"]`);

/** Set a range input as a student would: the value, then an input event. */
const slide = (s: Locator, v: number) =>
  s.evaluate((el: HTMLInputElement, value) => {
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);
const cursor = (fig: Locator) =>
  fig.locator('label.slider').filter({ has: fig.page().locator('.slider-label', { hasText: 'הסמן x' }) }).locator('input[type="range"]');
const task = async (page: Page, id: string) => ((await progress(page))?.tasks ?? {})[id];

test.describe('lesson 4.1: function, domain, graph, image and composition', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('פונקציה: תחום, גרף, תמונה והרכבה');
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

  test('each figure starts in its own mode: f(0) = −3 on the parabola, and the chain 4 → 5 → √5', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page, 'fig-4-1a');
    await expect(readout(page, 'fig-4-1a', 'fx')).toContainText('−3');
    await ready(page, 'fig-4-1b');
    await expect(readout(page, 'fig-4-1b', 'chain')).toContainText('5');
    await expect(readout(page, 'fig-4-1b', 'chain')).toContainText('2.24');
  });

  test('text steps drive the figures: the domain of √(x² − 2x − 3), the image of x², a broken chain, the swap', async ({ page }) => {
    await page.goto(LESSON);
    const read = page.locator('#fig-4-1a');
    await read.scrollIntoViewIfNeeded();
    await hydrated(read.locator('canvas').first());
    const readSteps = page.locator('.step[data-fig="fig-4-1a"]');
    // explore: quad, semicircle; domain: sqrt, recip, sqrt-quad, ln; image: x2, rational; reading: quad, quad mono, rational mono
    await expect(readSteps).toHaveCount(11);
    await readSteps.nth(4).scrollIntoViewIfNeeded();
    await readSteps.nth(4).click();
    await expect(readout(page, 'fig-4-1a', 'domain')).toContainText('[3, ∞)');
    await readSteps.nth(6).scrollIntoViewIfNeeded();
    await readSteps.nth(6).click();
    await expect(readout(page, 'fig-4-1a', 'range')).toContainText('[0, ∞)');

    const comp = page.locator('#fig-4-1b');
    await comp.scrollIntoViewIfNeeded();
    await hydrated(comp.locator('canvas').first());
    const compSteps = page.locator('.step[data-fig="fig-4-1b"]');
    // the chain at 4, broken at 1, swapped at 4, 1/(1/x) at 2, √(x²) at −2
    await expect(compSteps).toHaveCount(5);
    await compSteps.nth(1).scrollIntoViewIfNeeded();
    await compSteps.nth(1).click();
    await expect(readout(page, 'fig-4-1b', 'chain')).toContainText('לא מוגדרת');
    await compSteps.nth(2).scrollIntoViewIfNeeded();
    await compSteps.nth(2).click();
    await expect(readout(page, 'fig-4-1b', 'chain')).toContainText('−3');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-4-1"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the reader moves the cursor to the zero −1 of x² − 2x − 3, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-1a');
    await slide(cursor(fig), -1);
    await expect(readout(page, 'fig-4-1a', 'fx')).toContainText('0');
    await expect.poll(() => task(page, 'fig-4-1a:read-zero')).toBeTruthy();
  });

  test('the reader breaks the chain at x = 1, then swaps the order at x = 4', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-1b');
    await slide(cursor(fig), 1);
    await expect(readout(page, 'fig-4-1b', 'chain')).toContainText('לא מוגדרת');
    await expect.poll(() => task(page, 'fig-4-1b:compose-break')).toBeTruthy();
    await slide(cursor(fig), 4);
    await fig.getByRole('button', { name: 'g ∘ f' }).click();
    // g(f(4)) = g(2) = −3, while f(g(4)) = √5
    await expect(readout(page, 'fig-4-1b', 'chain')).toContainText('−3');
    await expect.poll(() => task(page, 'fig-4-1b:compose-swap')).toBeTruthy();
  });

  test('the Check has its five bank questions, and 9x^2-12x+5 is graded correct for Q-4.1-compose-fg', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of [
      'Q-4.1-domain-root-frac',
      'Q-4.1-image-recip',
      'Q-4.1-compose-fg',
      'Q-4.1-compose-domain',
      'Q-4.1-increasing-vs-negative',
    ]) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    // the expanded form of f(g(x)) = (3x − 2)² + 1 is the same function
    const card = page.locator('[data-qid="Q-4.1-compose-fg"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-expr input').fill('9x^2-12x+5');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-4-1-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-4-1-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-4-1-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors other pages link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'function-definition',
      'graph',
      'domain',
      'domain-all-conditions',
      'gamma-domain',
      'ln-sign',
      'physical-domain',
      'image',
      'domain-vs-image',
      'image-solve',
      'image-interval',
      'reading-graph',
      'intercepts',
      'increasing',
      'height-vs-direction',
      'composition',
      'compose-value',
      'compose-vs-product',
      'composition-domain',
      'compose-order',
      'simplify-domain',
      'decompose',
      'functions-physics',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
