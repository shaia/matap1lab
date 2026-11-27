import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/7-2/';
const FIG = 'fig-7-2a';
const TASKS = ['fig-7-2a:subst-move', 'fig-7-2a:subst-strip'];

/** Bring the figure into view, wait for its island, stop text steps from driving it, and reset it. */
async function ready(page: Page) {
  const f = page.locator(`#${FIG}`);
  await f.scrollIntoViewIfNeeded();
  await hydrated(f.locator('canvas').first());
  await freezeSteps(page);
  await f.getByRole('button', { name: 'איפוס' }).click();
  return f;
}

// MethodLab's hooks (src/sims/MethodLab.tsx, header comment), subst mode: readouts fn, formula, a, x, u, xarea, uarea,
// equal, and with the strip on widths, strips, ratio. Buttons by name: "רצועה צרה" (strip), "איפוס" (reset);
// [data-control="preset"] select, [data-control="x"] / [data-control="a"] inputs, [data-control="dx"] input (log10 dx,
// only while the strip is on). Negative numbers use U+2212.
const readout = (page: Page, id: string) => page.locator(`#${FIG} [data-readout="${id}"]`);

/** Set a range input as a student would: the value, then an input event. */
const slide = (s: Locator, v: number) =>
  s.evaluate((el: HTMLInputElement, value) => {
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);

test.describe('lesson 7.2: integration by substitution', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('אינטגרציה בהצבה');
    await expect(page.locator('.katex-error')).toHaveCount(0);
  });

  test('the figure hydrates and draws, in LTR math space', async ({ page }) => {
    await page.goto(LESSON);
    const c = page.locator(`#${FIG} canvas`).first();
    await c.scrollIntoViewIfNeeded();
    await hydrated(c);
    await expect(c).toHaveCSS('direction', 'ltr');
    await expect.poll(() => inked(c)).toBeGreaterThan(200);
  });

  test('the figure starts on ∫2x·cos(x²) dx with u = x², and at x = 1.2 both areas are sin 1.44 ≈ 0.9915', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page);
    await expect(readout(page, 'fn')).toContainText('2x·cos(x²)');
    await expect(readout(page, 'formula')).toContainText('u = x²');
    await expect(readout(page, 'xarea')).toContainText('0.9915');
    await expect(readout(page, 'uarea')).toContainText('0.9915');
    await expect(readout(page, 'equal')).toContainText('שני השטחים שווים');
  });

  test('text steps drive the figure: the prediction on 2x·e^(−x²), the linear u = 2x + 1, and the disk x/√(1 + x²)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator(`#${FIG}`);
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator(`.step[data-fig="${FIG}"]`);
    // Explore 2 (xcosx2, strip); idea 1; recipe 1 (xexp); why 1 (strip); linear 1 (lin); physics 1 (sqrt)
    await expect(steps).toHaveCount(7);

    await steps.nth(3).scrollIntoViewIfNeeded();
    await steps.nth(3).click();
    await expect(readout(page, 'fn')).toContainText('e^(−x²)');
    await expect(readout(page, 'equal')).toContainText('שני השטחים שווים');

    await steps.nth(5).scrollIntoViewIfNeeded();
    await steps.nth(5).click();
    await expect(readout(page, 'formula')).toContainText('u = 2x + 1');
    await expect(readout(page, 'widths')).toBeVisible();

    await steps.nth(6).scrollIntoViewIfNeeded();
    await steps.nth(6).click();
    await expect(readout(page, 'fn')).toContainText('√(1 + x²)');
    await expect(readout(page, 'widths')).toHaveCount(0);
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator(`.step[data-fig="${FIG}"]`).all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the reader moves x to 2: both areas are sin 4 ≈ −0.7568, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page);
    await slide(fig.locator('[data-control="x"] input'), 2);
    await expect(readout(page, 'xarea')).toContainText('−0.7568');
    await expect(readout(page, 'uarea')).toContainText('−0.7568');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})[TASKS[0]]).toBeTruthy();
  });

  test('the reader turns the strip on and shrinks dx to 0.02 at x = 1.5: the strip ratio is 1.007, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page);
    await fig.getByRole('button', { name: 'רצועה צרה' }).click();
    await slide(fig.locator('[data-control="x"] input'), 1.5);
    await slide(fig.locator('[data-control="dx"] input'), -1.7);
    // f(u)·du / (h(x)·dx) = (g(x + dx) − g(x)) / (g′(x)·dx) = 1 + dx/(2x) = 1 + 0.02/3
    await expect(readout(page, 'ratio')).toContainText('1.007');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})[TASKS[1]]).toBeTruthy();
  });

  test('the Check has its five bank questions, and (2x+1)^6/12 is graded correct for Q-7.2-linear', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-7.2-linear', 'Q-7.2-which-works', 'Q-7.2-find-slip', 'Q-7.2-tan', 'Q-7.2-log-power']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-7.2-linear"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-expr input').fill('(2x+1)^6/12');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-7-2-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-7-2-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-7-2-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors the misconception remedies link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'idea',
      'recipe',
      'dx-factor',
      'all-in-u',
      'why',
      'linear',
      'only-linear',
      'fprime-f',
      'inner-sign',
      'log-or-atan',
      'u-uprime',
      'choose',
      'subst-physics',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
