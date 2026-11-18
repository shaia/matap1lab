import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/1-1/';
const FIGS = ['fig-1-1a', 'fig-1-1b'];

/** Bring a figure into view, wait for its island, stop text steps from driving it, and reset it. */
async function ready(page: Page, fig: string) {
  const f = page.locator(`#${fig}`);
  await f.scrollIntoViewIfNeeded();
  await hydrated(f.locator('canvas'));
  await freezeSteps(page);
  await f.getByRole('button', { name: 'איפוס' }).click();
  return f;
}

/** Set a range input as a student would: the value, then an input event. */
const slide = (s: Locator, v: number) =>
  s.evaluate((el: HTMLInputElement, value) => {
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);

// VectorLab's readout (src/sims/VectorLab.tsx): one element per quantity, each with data-readout. Mode 'one':
// a, a-mag, unit ("û = a/|a| = (3/5, 4/5)"), scaled ("−2a = (−4, −2)"), scaled-mag. Mode 'two': a, a-mag, b, b-mag,
// sum, sum-mag, diff, diff-mag, theta. Negative numbers use U+2212.
const readout = (fig: Locator, name: string) => fig.locator(`[data-readout="${name}"]`);
const task = async (page: Page, id: string) => (await progress(page))?.tasks?.[id];

/** Move the selected tip with the arrow keys, as a keyboard user does (the canvas owns the key handler). */
async function keys(page: Page, fig: Locator, ...presses: string[]) {
  await fig.locator('canvas').focus();
  for (const k of presses) await page.keyboard.press(k);
}

test.describe('lesson 1.1: vectors, arrow and coordinates', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('וקטורים: חץ וקואורדינטות');
    await expect(page.locator('.katex-error')).toHaveCount(0);
  });

  test('both figures hydrate and draw, in LTR math space', async ({ page }) => {
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

  test('the figures start at the walk of the hook: (3, 4) of length 5, and (3, 0) + (0, 4) = (3, 4)', async ({ page }) => {
    await page.goto(LESSON);
    const a = await ready(page, 'fig-1-1a');
    await expect(readout(a, 'a')).toContainText('a = (3, 4)');
    await expect(readout(a, 'a-mag')).toHaveText(/\|a\| = 5\s*$/);
    const b = await ready(page, 'fig-1-1b');
    await expect(readout(b, 'sum')).toContainText('a+b = (3, 4)');
    await expect(readout(b, 'sum-mag')).toHaveText(/\|a\+b\| = 5\s*$/);
  });

  test('text steps drive figure 1.1א: 2a, the unit vector, −2a and û = (3/5, 4/5)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-1-1a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const steps = page.locator('.step[data-fig="fig-1-1a"]');
    await expect(steps).toHaveCount(7);

    // Explore, second step: a = (2, 1) and k = 2
    await steps.nth(1).scrollIntoViewIfNeeded();
    await steps.nth(1).click();
    await expect(readout(fig, 'a')).toContainText('a = (2, 1)');
    await expect(readout(fig, 'scaled')).toContainText('2a = (4, 2)');

    // Explore, third step: the unit vector of (4, 2)
    await steps.nth(2).scrollIntoViewIfNeeded();
    await steps.nth(2).click();
    await expect(readout(fig, 'unit')).toContainText('0.894');
    await expect(readout(fig, 'scaled')).toHaveCount(0);

    // Explain "scalar multiple": k = −2 flips the arrow, and the length stays positive
    await steps.nth(5).scrollIntoViewIfNeeded();
    await steps.nth(5).click();
    await expect(readout(fig, 'scaled')).toContainText('−2a = (−4, −2)');
    await expect(readout(fig, 'scaled-mag')).toContainText('√20 ≈ 4.47');

    // Explain "unit vector": (3, 4) / 5
    await steps.nth(6).scrollIntoViewIfNeeded();
    await steps.nth(6).click();
    await expect(readout(fig, 'unit')).toContainText('(3/5, 4/5)');
  });

  test('text steps drive figure 1.1ב: components add to (4, 3), and the reader turns on a − b = (3, 1)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-1-1b');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const steps = page.locator('.step[data-fig="fig-1-1b"]');
    await expect(steps).toHaveCount(6);

    await steps.nth(1).scrollIntoViewIfNeeded();
    await steps.nth(1).click();
    await expect(readout(fig, 'a')).toContainText('a = (5, 1)');
    await expect(readout(fig, 'b')).toContainText('b = (−1, 2)');
    await expect(readout(fig, 'sum')).toContainText('a+b = (4, 3)');
    await expect(readout(fig, 'sum-mag')).toHaveText(/\|a\+b\| = 5\s*$/);

    await steps.nth(3).scrollIntoViewIfNeeded();
    await steps.nth(3).click();
    // the step sets the two vectors and leaves the difference off: the reader turns it on (task diff-order)
    await expect(readout(fig, 'a')).toContainText('a = (4, 3)');
    await expect(readout(fig, 'b')).toContainText('b = (1, 2)');
    await expect(readout(fig, 'sum')).toHaveCount(0);
    await expect(readout(fig, 'diff')).toHaveCount(0);
    await fig.getByRole('button', { name: 'a−b', exact: true }).click();
    await expect(readout(fig, 'diff')).toContainText('a−b = (3, 1)');
  });

  test('figure 1.1א: another vector of length 5 ticks unit-length, and a negative k ticks negative-k', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-1a');
    await keys(page, fig, 'ArrowRight');
    await expect(readout(fig, 'a')).toContainText('a = (4, 4)');
    await page.waitForTimeout(200);
    expect(await task(page, 'fig-1-1a:unit-length')).toBeFalsy();
    await keys(page, fig, 'ArrowDown');
    await expect(readout(fig, 'a')).toContainText('a = (4, 3)');
    await expect(readout(fig, 'a-mag')).toHaveText(/\|a\| = 5\s*$/);
    await expect.poll(() => task(page, 'fig-1-1a:unit-length')).toBeTruthy();

    await fig.getByRole('button', { name: 'כפל במספר' }).click();
    await page.waitForTimeout(200);
    expect(await task(page, 'fig-1-1a:negative-k')).toBeFalsy();
    // the k slider indexes K_STEPS = [−3, −2, −1, −½, ½, 1, 2, 3]: index 1 is k = −2
    await slide(fig.locator('input[type=range]'), 1);
    await expect(readout(fig, 'scaled')).toContainText('−2a = (−8, −6)');
    await expect(readout(fig, 'scaled-mag')).toHaveText(/= 10\s*$/);
    await expect.poll(() => task(page, 'fig-1-1a:negative-k')).toBeTruthy();
  });

  test('figure 1.1ב: perpendicular, same-line, cancel and diff-order are ticked by the reader’s own moves', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-1b');
    // Space selects a, Space again selects b; then the arrows move b from (0, 4)
    await keys(page, fig, 'Space', 'Space', 'ArrowDown');
    await expect(readout(fig, 'b')).toContainText('b = (0, 3)');
    await expect.poll(() => task(page, 'fig-1-1b:perpendicular')).toBeTruthy();
    expect(await task(page, 'fig-1-1b:same-line')).toBeFalsy();

    await keys(page, fig, 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowRight');
    await expect(readout(fig, 'b')).toContainText('b = (1, 0)');
    await expect(readout(fig, 'sum-mag')).toHaveText(/\|a\+b\| = 4\s*$/);
    await expect.poll(() => task(page, 'fig-1-1b:same-line')).toBeTruthy();
    expect(await task(page, 'fig-1-1b:cancel')).toBeFalsy();

    await keys(page, fig, 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft');
    await expect(readout(fig, 'b')).toContainText('b = (−3, 0)');
    await expect(readout(fig, 'sum')).toContainText('a+b = (0, 0)');
    await expect.poll(() => task(page, 'fig-1-1b:cancel')).toBeTruthy();

    // the difference: the reader turns it on and then moves a vector
    await fig.getByRole('button', { name: 'a−b', exact: true }).click();
    await expect(readout(fig, 'diff')).toContainText('a−b = (6, 0)');
    await page.waitForTimeout(200);
    expect(await task(page, 'fig-1-1b:diff-order')).toBeFalsy();
    await keys(page, fig, 'ArrowUp');
    await expect(readout(fig, 'diff')).toContainText('a−b = (6, −1)');
    await expect.poll(() => task(page, 'fig-1-1b:diff-order')).toBeTruthy();
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-1-1"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of [
      'fig-1-1a:unit-length',
      'fig-1-1a:negative-k',
      'fig-1-1b:same-line',
      'fig-1-1b:perpendicular',
      'fig-1-1b:cancel',
      'fig-1-1b:diff-order',
    ]) {
      expect(tasks[t]).toBeFalsy();
    }
  });

  test('the Check has its five bank questions, and 3 is graded correct for Q-1.1-section', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-1.1-ab', 'Q-1.1-unit', 'Q-1.1-diagonal', 'Q-1.1-scale-tf', 'Q-1.1-section']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-1.1-section"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-numeric input').fill('3');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-1-1-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-1-1-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-1-1-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors other pages link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of [
      'components',
      'length',
      'scalar-multiple',
      'parallel',
      'unit-vector',
      'addition',
      'triangle-inequality',
      'point-to-point',
      'position-vs-displacement',
      'parallelogram-diagonals',
      'segment',
      'physics',
    ]) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
