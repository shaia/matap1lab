import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/2-5/';
const FIGS = ['fig-2-5a', 'fig-2-5b', 'fig-2-5c'];

/** Bring a figure into view, wait for its island, stop text steps from driving it, and reset it. */
async function ready(page: Page, fig: string) {
  const f = page.locator(`#${fig}`);
  await f.scrollIntoViewIfNeeded();
  await hydrated(f.locator('canvas').first());
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

// SurfaceLab's controls and readout (src/sims/SurfaceLab.tsx): three toggles "x = c" / "y = c" / "z = c", the slider
// "מקום המישור", a <select> of surfaces when several are offered, and rows with data-readout: surface, plane,
// substitute, section, type, detail, empty. Minus signs are U+2212, squares are "²".
const readout = (fig: Locator, name: string) => fig.locator(`[data-readout="${name}"]`);
const axis = (fig: Locator, a: 'x' | 'y' | 'z') => fig.getByRole('button', { name: `${a} = c`, exact: true }).click();
const place = (fig: Locator, c: number) => slide(fig.locator('label.slider', { hasText: 'מקום המישור' }).locator('input'), c);
const surface = (fig: Locator, id: string) => fig.locator('.sf-select select').selectOption(id);
const task = async (page: Page, id: string) => (await progress(page))?.tasks?.[id];

test.describe('lesson 2.5: surfaces in space and their sections', () => {
  test('the page loads with its title, and the three figures draw in LTR math space', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('משטחים במרחב וחתכים');
    await expect(page.locator('.katex-error')).toHaveCount(0);
    for (const id of FIGS) {
      const fig = page.locator(`#${id}`);
      await fig.scrollIntoViewIfNeeded();
      const space = fig.locator('canvas').first();
      const flat = fig.locator('.sf-plane canvas');
      await expect(space).toHaveCSS('direction', 'ltr');
      await expect.poll(() => inked(space)).toBeGreaterThan(200);
      await expect.poll(() => inked(flat)).toBeGreaterThan(100);
    }
  });

  test('fig a: the notes’ ellipsoid: z = 0 is the ellipse x²/4 + y²/9 = 1, z = 3/4 shrinks it to 7/16', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-5a');
    await expect(readout(fig, 'surface')).toContainText('x²/4 + y²/9 + z² = 1');
    await expect(readout(fig, 'plane')).toContainText('z = 0');
    await expect(readout(fig, 'section')).toContainText('x²/4 + y²/9 = 1');
    await expect(readout(fig, 'type')).toContainText('אליפסה');
    await place(fig, 0.75);
    await expect(readout(fig, 'section')).toContainText('x²/4 + y²/9 = 7/16');
    await expect(readout(fig, 'detail')).toContainText('√7/2');
    await axis(fig, 'y');
    await place(fig, 0);
    await expect(readout(fig, 'section')).toContainText('x²/4 + z² = 1');
  });

  test('fig a: at z = 1 the section is a single point (ellipsoid-point), and at z = 5/4 there is none', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-5a');
    expect(await task(page, 'fig-2-5a:ellipsoid-point')).toBeFalsy();
    await place(fig, 1);
    await expect(readout(fig, 'section')).toContainText('x²/4 + y²/9 = 0');
    await expect(readout(fig, 'type')).toContainText('נקודה בודדת');
    await expect.poll(() => task(page, 'fig-2-5a:ellipsoid-point')).toBeTruthy();
    await place(fig, 1.25);
    await expect(readout(fig, 'section')).toContainText('x²/4 + y²/9 = −9/16');
    await expect(readout(fig, 'type')).toContainText('אין חתך');
  });

  test('a text step drives the figure: the second Explore step cuts the ellipsoid by y = 0', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-2-5a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const step = page.locator('.step[data-fig="fig-2-5a"]').nth(1);
    await step.scrollIntoViewIfNeeded();
    await step.click();
    await expect(readout(fig, 'plane')).toContainText('y = 0');
    await expect(readout(fig, 'section')).toContainText('x²/4 + z² = 1');
  });

  test('fig b: the cone: circles of radius |c|, and the pair of lines z = ±x in y = 0 (cone-lines)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-5b');
    await expect(readout(fig, 'surface')).toContainText('x² + y² − z² = 0');
    await expect(readout(fig, 'section')).toContainText('x² + y² = 4');
    await expect(readout(fig, 'type')).toContainText('מעגל ברדיוס');
    expect(await task(page, 'fig-2-5b:cone-lines')).toBeFalsy();
    await axis(fig, 'y');
    await place(fig, 0);
    await expect(readout(fig, 'section')).toContainText('z = ±x');
    await expect(readout(fig, 'type')).toContainText('זוג ישרים נחתכים');
    await expect.poll(() => task(page, 'fig-2-5b:cone-lines')).toBeTruthy();
    await axis(fig, 'x');
    await place(fig, 1);
    await expect(readout(fig, 'type')).toContainText('היפרבולה');
  });

  test('fig b: the one-sheet hyperboloid has a waist of radius 1 and two lines in x = 1 (hyperboloid-lines)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-5b');
    await surface(fig, 'hyperboloid1');
    await place(fig, 0);
    await expect(readout(fig, 'section')).toContainText('x² + y² = 1');
    await axis(fig, 'x');
    await expect(readout(fig, 'section')).toContainText('y² − z² = 1');
    await expect(readout(fig, 'type')).toContainText('היפרבולה');
    await place(fig, 1);
    await expect(readout(fig, 'section')).toContainText('z = ±y');
    await expect.poll(() => task(page, 'fig-2-5b:hyperboloid-lines')).toBeTruthy();
  });

  test('fig b: the two-sheet hyperboloid is not met by z = 0 (no-intersection); the saddle has two lines at z = 0 (saddle-lines)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-5b');
    await surface(fig, 'hyperboloid2');
    await expect(readout(fig, 'section')).toContainText('x² + y² = 3');
    await place(fig, 0);
    await expect(readout(fig, 'section')).toContainText('x² + y² = −1');
    await expect(readout(fig, 'type')).toContainText('אין חתך');
    await expect.poll(() => task(page, 'fig-2-5b:no-intersection')).toBeTruthy();
    await surface(fig, 'saddle');
    await axis(fig, 'y');
    await expect(readout(fig, 'section')).toContainText('z = x²');
    await axis(fig, 'z');
    await expect(readout(fig, 'section')).toContainText('y = ±x');
    await expect.poll(() => task(page, 'fig-2-5b:saddle-lines')).toBeTruthy();
  });

  test('fig b: the cylinder x² + y² = 1 has the same circle at every height, and two parallel lines in x = 0', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-5b');
    await surface(fig, 'cylinder');
    for (const c of [-2, 0.5, 3]) {
      await place(fig, c);
      await expect(readout(fig, 'section')).toContainText('x² + y² = 1');
    }
    await axis(fig, 'x');
    await place(fig, 0);
    await expect(readout(fig, 'section')).toContainText('y = ±1');
    await expect(readout(fig, 'type')).toContainText('זוג ישרים מקבילים');
  });

  test('fig c: the hidden surface shows no name or equation; a wrong name is refused, the right one after two own cuts ticks mystery-identify', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-5c');
    await expect(readout(fig, 'surface')).toContainText('משטח נסתר');
    await expect(readout(fig, 'substitute')).toHaveCount(0);
    await expect(readout(fig, 'section')).toContainText('x² + y² = 1');
    await place(fig, 2);
    await expect(readout(fig, 'section')).toContainText('x² + y² = 5');
    await fig.getByRole('button', { name: 'חרוט', exact: true }).click();
    await expect(fig.locator('[data-feedback="no"]')).toBeVisible();
    expect(await task(page, 'fig-2-5c:mystery-identify')).toBeFalsy();
    await axis(fig, 'x');
    await place(fig, 0);
    await expect(readout(fig, 'type')).toContainText('היפרבולה');
    await fig.getByRole('button', { name: 'היפרבולואיד חד-יריעתי', exact: true }).click();
    await expect(fig.locator('[data-feedback="ok"]')).toBeVisible();
    await expect(readout(fig, 'surface')).toContainText('x² + y² − z² = 1');
    await expect.poll(() => task(page, 'fig-2-5c:mystery-identify')).toBeTruthy();
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-2-5"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of [
      'fig-2-5a:ellipsoid-point',
      'fig-2-5b:cone-lines',
      'fig-2-5b:hyperboloid-lines',
      'fig-2-5b:no-intersection',
      'fig-2-5b:saddle-lines',
      'fig-2-5c:mystery-identify',
    ]) {
      expect(tasks[t]).toBeFalsy();
    }
  });

  test('the Check has its six bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-2.5-name', 'Q-2.5-missing-variable', 'Q-2.5-sheets-why', 'Q-2.5-sections-identify', 'Q-2.5-saddle-sections', 'Q-2.5-projection']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-2-5-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });

  test('the anchors the misconception register links to exist', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of [
      'sections',
      'ellipsoid',
      'parallel-sections',
      'cone',
      'conic-sections',
      'square-with-coefficient',
      'hyperboloids',
      'sheets',
      'paraboloids',
      'cone-vs-paraboloid',
      'cylinders',
      'missing-variable',
      'sketch-recipe',
      'identify',
      'general-plane',
      'surfaces-physics',
    ]) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
  });
});
