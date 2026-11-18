import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/1-4/';
const FIGS = ['fig-1-4a', 'fig-1-4b', 'fig-1-4c', 'fig-1-4d'];

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

/** Press a key on a figure's canvas `n` times (VectorLab: Space selects the next vector, arrows move its tip one square). */
async function press(fig: Locator, key: string, n = 1) {
  const canvas = fig.locator('.sim-stage canvas');
  await canvas.focus();
  for (let i = 0; i < n; i++) await canvas.press(key);
}

/** SpaceLab's steppers: one − / + pair per component of each vector (src/sims/SpaceLab.tsx). */
async function bump(fig: Locator, vec: 'a' | 'b', comp: 'x' | 'y' | 'z', by: number) {
  const b = fig.locator(`[data-vec="${vec}"] [data-comp="${comp}"] button[data-step="${by > 0 ? 'inc' : 'dec'}"]`);
  for (let i = 0; i < Math.abs(by); i++) await b.click();
}

const task = async (page: Page, id: string) => (await progress(page))?.tasks?.[id];
const readout = (fig: Locator, id: string) => fig.locator(`[data-readout="${id}"]`);

test.describe('lesson 1.4: the cross product', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('המכפלה הווקטורית');
    await expect(page.locator('.katex-error')).toHaveCount(0);
  });

  test('the four figures hydrate and draw, in LTR math space', async ({ page }) => {
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

  test('a text step drives the first figure: 6, then 5, then −5 in the reversed order', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-1-4a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const steps = page.locator('.step[data-fig="fig-1-4a"]');
    await expect(steps).toHaveCount(3);

    await steps.nth(0).scrollIntoViewIfNeeded();
    await steps.nth(0).click();
    await expect(readout(fig, 'cross')).toContainText('3·2 − 0·0 = 6');
    await expect(readout(fig, 'cross-dir')).toContainText('החוצה מהדף');

    await steps.nth(1).scrollIntoViewIfNeeded();
    await steps.nth(1).click();
    await expect(readout(fig, 'cross')).toContainText('3·2 − 1·1 = 5');
    await expect(readout(fig, 'theta')).toContainText('45°');

    await steps.nth(2).scrollIntoViewIfNeeded();
    await steps.nth(2).click();
    await expect(readout(fig, 'cross')).toContainText('1·1 − 2·3 = −5');
    await expect(readout(fig, 'cross-dir')).toContainText('לתוך הדף');
  });

  test('fig a: (3, 1)×(1, 2) is 5 out of the page; the order flips it; clockwise goes in; parallel gives zero', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-4a');
    await expect(readout(fig, 'cross')).toContainText('a₁b₂ − a₂b₁ = 3·2 − 1·1 = 5');
    await expect(readout(fig, 'cross-sin')).toContainText('= 5');
    await expect(readout(fig, 'cross-dir')).toContainText('החוצה מהדף');

    await fig.getByRole('button', { name: /סדר הפוך/ }).click();
    await expect(readout(fig, 'cross')).toContainText('= −5');
    await expect(readout(fig, 'cross-dir')).toContainText('לתוך הדף');
    await expect.poll(() => task(page, 'fig-1-4a:cross-swap')).toBeTruthy();
    await fig.getByRole('button', { name: /סדר הפוך/ }).click();

    // b: (1, 2) → (1, −1): the turn from a to b is now clockwise
    await press(fig, 'Space', 2);
    await press(fig, 'ArrowDown', 3);
    await expect(readout(fig, 'cross')).toContainText('= −4');
    await expect.poll(() => task(page, 'fig-1-4a:cross-into')).toBeTruthy();

    // b: (1, −1) → (3, 1), along a
    await press(fig, 'ArrowRight', 2);
    await press(fig, 'ArrowUp', 2);
    await expect(readout(fig, 'cross-dir')).toContainText('אפס');
    await expect.poll(() => task(page, 'fig-1-4a:cross-parallel')).toBeTruthy();
  });

  test('fig b: face-on the arrow is ⊙, and turned around it is ⊗', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-4b');
    await slide(fig.locator('input[type=range]').first(), 90);
    await expect(fig).toContainText('מבט ישר על הדף');
    await expect.poll(() => task(page, 'fig-1-4b:see-out')).toBeTruthy();
    await fig.getByRole('button', { name: '⊗ לתוך הדף' }).click();
    await expect.poll(() => task(page, 'fig-1-4b:see-in')).toBeTruthy();
  });

  test('fig c: (2, 1, 0)×(0, 2, 1) = (1, −2, 4), area √21, perpendicular to both; the four tasks', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-4c');
    await expect(readout(fig, 'cross')).toContainText('a×b = (1, −2, 4)');
    await expect(readout(fig, 'area')).toContainText('√21 ≈ 4.583');
    await expect(readout(fig, 'check-f')).toHaveText(/= 0\s*$/);
    await expect(readout(fig, 'check-g')).toHaveText(/= 0\s*$/);

    await fig.getByRole('button', { name: /סדר הפוך/ }).click();
    await expect(readout(fig, 'cross')).toContainText('b×a = (−1, 2, −4)');
    await expect.poll(() => task(page, 'fig-1-4c:cross-swap')).toBeTruthy();
    await fig.getByRole('button', { name: /סדר הפוך/ }).click();

    // b: (0, 2, 1) → (2, 1, 0) = a: parallel, the product is the zero vector
    await bump(fig, 'b', 'x', 2);
    await bump(fig, 'b', 'y', -1);
    await bump(fig, 'b', 'z', -1);
    await expect(readout(fig, 'cross')).toContainText('a×b = (0, 0, 0)');
    await expect(readout(fig, 'area')).toContainText('וקטור האפס');
    await expect.poll(() => task(page, 'fig-1-4c:cross-zero')).toBeTruthy();

    // a → (3, 0, 0), b → (1, 2, 0): not perpendicular, area exactly 6
    await bump(fig, 'a', 'x', 1);
    await bump(fig, 'a', 'y', -1);
    await bump(fig, 'b', 'x', -1);
    await bump(fig, 'b', 'y', 1);
    await expect(readout(fig, 'cross')).toContainText('a×b = (0, 0, 6)');
    await expect(readout(fig, 'area')).toContainText('= 6');
    await expect.poll(() => task(page, 'fig-1-4c:area-6')).toBeTruthy();

    // a → (3, 1, 0): neither vector on an axis, the product along +z
    await bump(fig, 'a', 'y', 1);
    await expect(readout(fig, 'cross')).toContainText('a×b = (0, 0, 5)');
    await expect.poll(() => task(page, 'fig-1-4c:cross-k')).toBeTruthy();
  });

  test('fig d: the torque of F = (1, 3) N at r = (3, 1) m is 8 N·m out of the page; a force along r gives none', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-4d');
    await expect(readout(fig, 'cross')).toContainText('r₁F₂ − r₂F₁ = 3·3 − 1·1 = 8 N·m');
    await expect(readout(fig, 'cross-dir')).toContainText('החוצה מהדף');
    // F: (1, 3) → (3, 1), along r
    await press(fig, 'Space', 2);
    await press(fig, 'ArrowRight', 2);
    await press(fig, 'ArrowDown', 2);
    await expect(readout(fig, 'cross')).toContainText('= 0 N·m');
    await expect(readout(fig, 'cross-dir')).toContainText('אפס');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator(FIGS.map((f) => `.step[data-fig="${f}"]`).join(', ')).all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of [
      'fig-1-4a:cross-into',
      'fig-1-4a:cross-parallel',
      'fig-1-4a:cross-swap',
      'fig-1-4b:see-out',
      'fig-1-4b:see-in',
      'fig-1-4c:cross-zero',
      'fig-1-4c:cross-swap',
      'fig-1-4c:cross-k',
      'fig-1-4c:area-6',
    ]) {
      expect(tasks[t], t).toBeFalsy();
    }
  });

  test('the Check has its five bank questions, and the six worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-1.4-compute', 'Q-1.4-ijk', 'Q-1.4-parallel-zero', 'Q-1.4-triangle', 'Q-1.4-torque']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-1-4-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });

  test('the anchors the misconception register links to exist, and the page does not scroll sideways', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of [
      'cross-idea',
      'cross-formula',
      'middle-sign',
      'det-scheme',
      'cross-check',
      'cross-geometry',
      'cross-perpendicular',
      'cross-magnitude',
      'triangle-half',
      'cross-properties',
      'cross-order',
      'dot-vs-cross',
      'plane-normal',
      'torque',
    ]) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
    const sw = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sw).toBeLessThanOrEqual(0);
  });
});
