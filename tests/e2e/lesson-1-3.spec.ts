import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/1-3/';

/** Bring a figure into view, wait for its island, stop text steps from driving it, and reset it. */
async function ready(page: Page, fig: string) {
  const f = page.locator(`#${fig}`);
  await f.scrollIntoViewIfNeeded();
  await hydrated(f.locator('canvas'));
  await freezeSteps(page);
  await f.getByRole('button', { name: 'איפוס' }).click();
  return f;
}

/** SpaceLab's steppers (src/sims/SpaceLab.tsx): one row per vector (data-vec), one cell per component (data-comp). */
const cell = (fig: Locator, vec: string, comp: 'x' | 'y' | 'z') => fig.locator(`[data-vec="${vec}"] [data-comp="${comp}"]`);

/** Press + or − until the component shows `target`, as a student would. */
async function setComp(fig: Locator, vec: string, comp: 'x' | 'y' | 'z', target: number) {
  const c = cell(fig, vec, comp);
  const read = async () => Number((await c.locator('[data-value]').innerText()).replace('−', '-'));
  for (let guard = 0; guard < 10; guard++) {
    const now = await read();
    if (now === target) return;
    await c.locator(`[data-step="${now < target ? 'inc' : 'dec'}"]`).click();
  }
  expect(await read()).toBe(target);
}
const setVec = async (fig: Locator, vec: string, v: [number, number, number]) => {
  await setComp(fig, vec, 'x', v[0]);
  await setComp(fig, vec, 'y', v[1]);
  await setComp(fig, vec, 'z', v[2]);
};
const readout = (fig: Locator, id: string) => fig.locator(`[data-readout="${id}"]`);
const task = async (page: Page, id: string) => (await progress(page))?.tasks?.[id];

test.describe('lesson 1.3: lines and planes', () => {
  test('the three figures draw, in LTR math space', async ({ page }) => {
    await page.goto(LESSON);
    const canvases = page.locator('.sim-stage canvas');
    await expect(canvases).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      const c = canvases.nth(i);
      await c.scrollIntoViewIfNeeded();
      await expect(c).toHaveCSS('direction', 'ltr');
      await expect.poll(() => inked(c)).toBeGreaterThan(200);
    }
  });

  test('fig a: the plane x + 2y + 2z = 5 and the line meet at t = 2, X = (1, 2, 0)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-3a');
    await expect(readout(fig, 'plane')).toContainText('x + 2y + 2z = 5');
    await expect(readout(fig, 'line')).toContainText('x = −1 + t,  y = t,  z = 2 − t');
    await expect(readout(fig, 'line-dot')).toContainText('= 1');
    await expect(readout(fig, 'line-t')).toContainText('= 2');
    await expect(readout(fig, 'line-point')).toContainText('X = (1, 2, 0)');
  });

  test('a text step drives the figure: the third Explore step makes the line parallel to the plane', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-1-3a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const step = page.locator('.step[data-fig="fig-1-3a"]').nth(2);
    await step.scrollIntoViewIfNeeded();
    await step.click();
    await expect(readout(fig, 'line-result')).toContainText('הישר מקביל למישור');
    await expect(readout(fig, 'line-point')).toHaveCount(0);
  });

  test('fig a: the reader’s own parallel direction ticks line-parallel, a direction along n ticks line-perpendicular', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-3a');
    expect(await task(page, 'fig-1-3a:line-parallel')).toBeFalsy();
    await setVec(fig, 'v', [0, 1, -1]); // (0, 1, −1)·(1, 2, 2) = 0, and A = (−1, 0, 2) is off the plane
    await expect(readout(fig, 'line-result')).toContainText('הישר מקביל למישור');
    await expect.poll(() => task(page, 'fig-1-3a:line-parallel')).toBeTruthy();
    await setVec(fig, 'v', [1, 2, 2]);
    await expect.poll(() => task(page, 'fig-1-3a:line-perpendicular')).toBeTruthy();
  });

  test('fig b: Q = (1, 2, 3) is at distance 1 from 2x − 2y + z = 4; moving it to (2, 1, 2) puts it on the plane (point-on-plane)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-3b');
    await expect(readout(fig, 'plane')).toContainText('2x − 2y + z = 4');
    await expect(readout(fig, 'point')).toContainText('= −3');
    await expect(readout(fig, 'distance')).toContainText('3/√9 = 1');
    expect(await task(page, 'fig-1-3b:point-on-plane')).toBeFalsy();
    await setVec(fig, 'q', [2, 1, 2]);
    await expect(readout(fig, 'distance')).toContainText('Q על המישור');
    await expect.poll(() => task(page, 'fig-1-3b:point-on-plane')).toBeTruthy();
  });

  test('fig b: moving P₀ to (1, 1, 0) gives d = 0 and ticks plane-through-origin', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-3b');
    await setVec(fig, 'p0', [1, 1, 0]);
    await expect(readout(fig, 'plane')).toContainText('2x − 2y + z = 0');
    await expect.poll(() => task(page, 'fig-1-3b:plane-through-origin')).toBeTruthy();
  });

  test('fig c: with A = (1, 0, 2) and v = (2, −1, 0) the line is contained in the plane', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-3c');
    await expect(readout(fig, 'line-point')).toContainText('X = (1, 2, 0)');
    await setVec(fig, 'v', [2, -1, 0]);
    await expect(readout(fig, 'line-result')).toContainText('הישר מקביל למישור');
    await setVec(fig, 'a', [1, 0, 2]);
    await expect(readout(fig, 'line-result')).toContainText('הישר מוכל במישור');
  });

  test('fig c: Q = (3, 2, 2) is at distance 2 with foot (7/3, 2/3, 2/3); Q = (4, 3, 2) is at distance 3 (distance-3)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-3c');
    await fig.getByRole('button', { name: 'נקודה Q' }).click();
    await expect(readout(fig, 'point')).toContainText('= 6');
    await expect(readout(fig, 'distance')).toContainText('6/√9 = 2');
    await expect(readout(fig, 'foot')).toContainText('F = (7/3, 2/3, 2/3)');
    expect(await task(page, 'fig-1-3c:distance-3')).toBeFalsy();
    await setVec(fig, 'q', [4, 3, 2]);
    await expect(readout(fig, 'distance')).toContainText('9/√9 = 3');
    await expect.poll(() => task(page, 'fig-1-3c:distance-3')).toBeTruthy();
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-1-3"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of ['fig-1-3a:line-parallel', 'fig-1-3a:line-perpendicular', 'fig-1-3b:point-on-plane', 'fig-1-3b:plane-through-origin', 'fig-1-3c:distance-3']) {
      expect(tasks[t]).toBeFalsy();
    }
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-1.3-on-line', 'Q-1.3-canonical-zero', 'Q-1.3-normal-read', 'Q-1.3-line-plane', 'Q-1.3-distance']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-1-3-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });

  test('the anchors the misconception register links to exist', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of [
      'line-parametric',
      'point-on-line',
      'line-canonical',
      'canonical-zero',
      'plane-equation',
      'plane-coefficients',
      'normal-vs-in-plane',
      'plane-d',
      'point-on-plane',
      'line-plane',
      'line-parallel-plane',
      'distance',
    ]) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
  });
});
