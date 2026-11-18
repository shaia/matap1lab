import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/1-5/';

/** Bring a figure into view, wait for its island, stop text steps from driving it, and reset it. */
async function ready(page: Page, fig: string) {
  const f = page.locator(`#${fig}`);
  await f.scrollIntoViewIfNeeded();
  await hydrated(f.locator('canvas'));
  await freezeSteps(page);
  await f.getByRole('button', { name: 'איפוס' }).click();
  return f;
}

const task = async (page: Page, id: string) => (await progress(page))?.tasks?.[id];
const readout = (fig: Locator, id: string) => fig.locator(`[data-readout="${id}"]`);

/** VectorLab (src/sims/VectorLab.tsx) by keyboard: Space cycles the selected vector (a first, then b), arrows move it one unit. */
async function selectB(page: Page, fig: Locator) {
  await fig.locator('canvas').focus();
  await page.keyboard.press('Space'); // a
  await page.keyboard.press('Space'); // b
}
const press = async (page: Page, key: string, times = 1) => {
  for (let i = 0; i < times; i++) await page.keyboard.press(key);
};

/** SpaceLab (src/sims/SpaceLab.tsx): one click on a stepper of a vector's component. */
const stepper = (fig: Locator, vec: 'a' | 'b' | 'c', comp: 'x' | 'y' | 'z', dir: 'inc' | 'dec') =>
  fig.locator(`[data-vec="${vec}"] [data-comp="${comp}"] button[data-step="${dir}"]`);
const clicks = async (b: Locator, times: number) => {
  for (let i = 0; i < times; i++) await b.click();
};

test.describe('lesson 1.5: the triple product and determinants', () => {
  test('both figures draw, in LTR math space', async ({ page }) => {
    await page.goto(LESSON);
    const canvases = page.locator('.sim-stage canvas');
    await expect(canvases).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      const c = canvases.nth(i);
      await c.scrollIntoViewIfNeeded();
      await expect(c).toHaveCSS('direction', 'ltr');
      await expect.poll(() => inked(c)).toBeGreaterThan(200);
    }
  });

  test('a text step drives figure 1.5א: the first Explore step shows the 3 by 2 rectangle, determinant 6', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-1-5a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const step = page.locator('.step[data-fig="fig-1-5a"]').nth(0);
    await step.scrollIntoViewIfNeeded();
    await step.click();
    await expect(readout(fig, 'a')).toContainText('(3, 0)');
    await expect(readout(fig, 'b')).toContainText('(0, 2)');
    await expect(readout(fig, 'cross')).toContainText('3·2 − 0·0 = 6');
  });

  test('figure 1.5א: det(a, b) = 5 for (3,1), (1,2); a clockwise b makes it negative (cross-into); a parallel b makes it 0 (cross-parallel)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-5a');
    await expect(readout(fig, 'cross')).toContainText('3·2 − 1·1 = 5');
    await expect(readout(fig, 'cross-dir')).toContainText('החוצה מהדף');
    expect(await task(page, 'fig-1-5a:cross-into')).toBeFalsy();

    await selectB(page, fig);
    await press(page, 'ArrowDown', 2); // b = (1, 0): 3·0 − 1·1 = −1
    await expect(readout(fig, 'b')).toContainText('(1, 0)');
    await expect(readout(fig, 'cross')).toContainText('= −1');
    await expect(readout(fig, 'cross-dir')).toContainText('לתוך הדף');
    await expect.poll(() => task(page, 'fig-1-5a:cross-into')).toBeTruthy();
    expect(await task(page, 'fig-1-5a:cross-parallel')).toBeFalsy();

    await press(page, 'ArrowRight', 2);
    await press(page, 'ArrowUp'); // b = (3, 1) = a: no parallelogram
    await expect(readout(fig, 'b')).toContainText('(3, 1)');
    await expect(readout(fig, 'cross')).toContainText('3·1 − 1·3 = 0');
    await expect.poll(() => task(page, 'fig-1-5a:cross-parallel')).toBeTruthy();
  });

  test('figure 1.5א: reversing the order swaps the rows and flips the sign (cross-swap)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-5a');
    expect(await task(page, 'fig-1-5a:cross-swap')).toBeFalsy();
    await fig.getByRole('button', { name: /סדר הפוך/ }).click();
    await expect(readout(fig, 'cross')).toContainText('1·1 − 2·3 = −5');
    await expect(readout(fig, 'cross-dir')).toContainText('לתוך הדף');
    await expect.poll(() => task(page, 'fig-1-5a:cross-swap')).toBeTruthy();
  });

  test('figure 1.5ב: the default box has determinant 9 = a·(b×c), volume 9, a right-handed triple', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-5b');
    await expect(readout(fig, 'matrix')).toContainText('a, b, c');
    await expect(readout(fig, 'det')).toContainText('= 2·4 − 0·2 + 1·1 = 9');
    await expect(readout(fig, 'triple')).toContainText('(4, −2, 1)');
    await expect(readout(fig, 'triple')).toContainText('= 9');
    await expect(readout(fig, 'volume')).toContainText('V = |9| = 9');
    await expect(readout(fig, 'orientation')).toContainText('שלשה ימנית');
  });

  test('figure 1.5ב: swapping a and b flips the sign and keeps the volume (box-swap, box-negative)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-5b');
    expect(await task(page, 'fig-1-5b:box-swap')).toBeFalsy();
    await fig.locator('[data-action="swap-ab"]').click();
    await expect(readout(fig, 'det')).toContainText('= −9');
    await expect(readout(fig, 'volume')).toContainText('V = |−9| = 9');
    await expect(readout(fig, 'orientation')).toContainText('שלשה שמאלית');
    await expect.poll(() => task(page, 'fig-1-5b:box-swap')).toBeTruthy();
    await expect.poll(() => task(page, 'fig-1-5b:box-negative')).toBeTruthy();
  });

  test('figure 1.5ב: c = a + b = (3, 2, 1) flattens the box: determinant 0, one plane, no two vectors parallel (box-flat)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-5b');
    await clicks(stepper(fig, 'c', 'x', 'inc'), 3);
    await clicks(stepper(fig, 'c', 'y', 'inc'), 1);
    expect(await task(page, 'fig-1-5b:box-flat')).toBeFalsy();
    await clicks(stepper(fig, 'c', 'z', 'dec'), 1);
    await expect(readout(fig, 'det')).toContainText('= 0');
    await expect(readout(fig, 'volume')).toContainText('V = |0| = 0');
    await expect(readout(fig, 'orientation')).toContainText('במישור אחד');
    await expect.poll(() => task(page, 'fig-1-5b:box-flat')).toBeTruthy();
  });

  test('figure 1.5ב: c = (0, −2, 2) gives volume exactly 6 with no vector on an axis (box-volume-6)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-5b');
    await clicks(stepper(fig, 'c', 'y', 'dec'), 2); // c = (0, −1, 2): det 7
    await expect(readout(fig, 'volume')).toContainText('V = |7| = 7');
    expect(await task(page, 'fig-1-5b:box-volume-6')).toBeFalsy();
    await clicks(stepper(fig, 'c', 'y', 'dec'), 1); // c = (0, −2, 2): det 2·4 + 1·(−2) = 6
    await expect(readout(fig, 'volume')).toContainText('V = |6| = 6');
    await expect.poll(() => task(page, 'fig-1-5b:box-volume-6')).toBeTruthy();
  });

  test('figure 1.5ב: the normal a×b and the height of c appear with the toggle', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-5b');
    await expect(readout(fig, 'normal')).toHaveCount(0);
    await fig.getByRole('button', { name: /הנורמל והגובה/ }).click();
    await expect(readout(fig, 'normal')).toContainText('(−2, 1, 4)');
    await expect(readout(fig, 'height')).toContainText('√21');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig="fig-1-5a"], .step[data-fig="fig-1-5b"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of [
      'fig-1-5a:cross-into',
      'fig-1-5a:cross-parallel',
      'fig-1-5a:cross-swap',
      'fig-1-5b:box-volume-6',
      'fig-1-5b:box-swap',
      'fig-1-5b:box-negative',
      'fig-1-5b:box-flat',
    ]) {
      expect(tasks[t]).toBeFalsy();
    }
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-1.5-det3', 'Q-1.5-area2', 'Q-1.5-sign', 'Q-1.5-triple', 'Q-1.5-coplanar-tf']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-1-5-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });

  test('the anchors that misconception remedies link to exist', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of [
      'det2',
      'det2-sign',
      'det3',
      'triple-product',
      'volume',
      'orientation',
      'det-properties',
      'cyclic',
      'det-scale',
      'coplanar',
      'four-points',
      'uses',
      'tetrahedron',
      'skew-lines',
      'physics',
    ]) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
  });
});
