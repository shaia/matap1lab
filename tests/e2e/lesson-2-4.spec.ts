import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/2-4/';
const FIGS = ['fig-2-4a', 'fig-2-4b', 'fig-2-4c'];
const TASKS = [
  'fig-2-4a:space-neg-z',
  'fig-2-4a:space-two-r',
  'fig-2-4a:space-cyl-axis',
  'fig-2-4b:space-cone-sweep',
  'fig-2-4b:space-latitude',
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

// CoordinateLab's readout (src/sims/CoordinateLab.tsx, mode 'space'): one row per quantity, each with data-readout:
// to-xyz, to-cyl (cylindrical) or to-sph and cyl-r (spherical), latitude, surfaces, solid, solid-in, angle.
const row = (fig: Locator, id: string) => fig.locator(`[data-readout="${id}"]`);
/** a slider of the figure by its label ("r", "θ", "θ (מציר z)", "φ", "z") */
const slider = (fig: Locator, label: RegExp) =>
  fig.locator('label.slider').filter({ has: fig.page().locator('.slider-label', { hasText: label }) }).locator('input[type="range"]');

test.describe('lesson 2.4: cylindrical and spherical coordinates', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('קואורדינטות גליליות וכדוריות');
    await expect(page.locator('.katex-error')).toHaveCount(0);
  });

  test('the three figures hydrate and draw, in LTR math space', async ({ page }) => {
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

  test('each figure starts at its own point: cylindrical (2, 60°, 1), spherical (2, 30°, 60°), and the ball', async ({ page }) => {
    await page.goto(LESSON);
    const a = await ready(page, 'fig-2-4a');
    await expect(row(a, 'to-xyz')).toContainText('x = r cos θ = 2·cos 60° = 1,');
    await expect(row(a, 'to-xyz')).toContainText('y = r sin θ = 2·sin 60° = 1.73');
    await expect(row(a, 'to-cyl')).toContainText('θ = 60° = π/3');

    const b = await ready(page, 'fig-2-4b');
    await expect(row(b, 'to-xyz')).toContainText('x = r sin θ cos φ = 0.5,');
    await expect(row(b, 'to-xyz')).toContainText('z = r cos θ = 2·cos 30° = 1.73');
    await expect(row(b, 'to-sph')).toContainText('θ = arccos(z/r) = 30° = π/6');
    await expect(row(b, 'cyl-r')).toContainText('r sin θ = 2·sin 30° = 1 ');

    const c = await ready(page, 'fig-2-4c');
    await expect(row(c, 'solid')).toContainText('0 ≤ r ≤ 2,  0 ≤ θ ≤ π,  0 ≤ φ < 2π');
    await expect(row(c, 'solid-in')).toContainText('בתוך הגוף');
  });

  test('a text step drives the figure: cylindrical, then spherical (2, 60°, 60°), then a point on the floor', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-2-4a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const steps = page.locator('.step[data-fig="fig-2-4a"]');
    await expect(steps).toHaveCount(3);

    // the second step moves the figure away from its initial state, so the cylindrical row below is the first step's doing
    await steps.nth(1).scrollIntoViewIfNeeded();
    await steps.nth(1).click();
    await expect(row(fig, 'to-xyz')).toContainText('x = r sin θ cos φ = 0.87,');
    await expect(row(fig, 'to-xyz')).toContainText('y = r sin θ sin φ = 1.5,');
    await expect(row(fig, 'to-xyz')).toContainText('z = r cos θ = 2·cos 60° = 1');
    await expect(row(fig, 'cyl-r')).toContainText('2·sin 60° = 1.73');

    await steps.nth(0).scrollIntoViewIfNeeded();
    await steps.nth(0).click();
    await expect(row(fig, 'to-cyl')).toContainText('r = √(x² + y²)');
    await expect(row(fig, 'to-xyz')).toContainText('2·cos 60° = 1,');

    await steps.nth(2).scrollIntoViewIfNeeded();
    await steps.nth(2).click();
    await expect(row(fig, 'to-xyz')).toContainText('z = r cos θ = 2.5·cos 90° = 0');
    await expect(row(fig, 'cyl-r')).toContainText('2.5·sin 90° = 2.5');
  });

  test('the same point in both systems: spherical (2, 30°, 60°) is cylindrical (1, 60°, 1.73)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-4b');
    await fig.getByRole('button', { name: 'גליליות', exact: true }).click();
    await expect(row(fig, 'to-cyl')).toContainText('= 1,   θ = 60° = π/3,   z = 1.73');
    await fig.getByRole('button', { name: 'כדוריות', exact: true }).click();
    await expect(row(fig, 'to-sph')).toContainText('r = √(x² + y² + z²) = 2,');
  });

  test('the notes’ latitude is 90° minus θ, and the θ-surface is a cone', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-4b');
    await fig.getByRole('button', { name: 'זווית הרוחב של הסיכומים' }).click();
    await expect(row(fig, 'latitude')).toContainText('90° − 30° = 60°');
    await slider(fig, /^θ/).fill('60');
    await expect(row(fig, 'latitude')).toContainText('90° − 60° = 30°');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-2-4b:space-latitude']).toBeTruthy();

    await fig.getByRole('button', { name: /^θ/ }).click();
    await expect(row(fig, 'surfaces')).toContainText('חרוט סביב ציר z');
    await slider(fig, /^θ/).fill('90');
    await expect(row(fig, 'surfaces')).toContainText('מישור xy');
  });

  test('the reader’s own moves tick the tasks: the negative z-axis, the two r’s, the z-axis in cylindrical', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-4a');
    await fig.getByRole('button', { name: 'כדוריות', exact: true }).click();
    await slider(fig, /^θ/).fill('180');
    await expect(row(fig, 'to-sph')).toContainText('θ = arccos(z/r) = 180° = π');
    await expect(row(fig, 'angle')).toContainText('לא מוגדר');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-2-4a:space-neg-z']).toBeTruthy();

    await slider(fig, /^r$/).fill('2');
    await slider(fig, /^θ/).fill('30');
    await expect(row(fig, 'cyl-r')).toContainText('r sin θ = 2·sin 30° = 1 ');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-2-4a:space-two-r']).toBeTruthy();

    await fig.getByRole('button', { name: 'גליליות', exact: true }).click();
    await slider(fig, /^r$/).fill('0');
    await expect(row(fig, 'to-cyl')).toContainText('θ = לא מוגדרת');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-2-4a:space-cyl-axis']).toBeTruthy();
  });

  test('a solid: the point is inside the cylinder, and outside once r passes 2', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-4c');
    await fig.getByRole('button', { name: 'גליליות', exact: true }).click();
    await fig.getByRole('button', { name: 'גליל', exact: true }).click();
    await expect(row(fig, 'solid')).toContainText('0 ≤ r ≤ 2,  0 ≤ θ < 2π,  0 ≤ z ≤ 3');
    await slider(fig, /^r$/).fill('1');
    await slider(fig, /^z$/).fill('2');
    await expect(row(fig, 'solid-in')).toContainText('בתוך הגוף');
    await slider(fig, /^r$/).fill('2.5');
    await expect(row(fig, 'solid-in')).toContainText('מחוץ לגוף');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-2-4"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the Check has its seven bank questions, and 1.732 (√3) is graded correct for Q-2.4-cyl-to-cart', async ({ page }) => {
    await page.goto(LESSON);
    const ids = ['Q-2.4-cyl-to-cart', 'Q-2.4-sph-z', 'Q-2.4-planes', 'Q-2.4-cart-to-sph', 'Q-2.4-notes-translate', 'Q-2.4-choose', 'Q-2.4-under-cone'];
    for (const id of ids) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-2.4-cyl-to-cart"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-numeric input').fill('1.732');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-2-4-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-2-4-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-2-4-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors other pages link to exist, and the three videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'cylindrical', 'spherical', 'same-letters', 'two-r', 'theta-clash', 'coordinate-surfaces', 'sphere-cylindrical',
      'cone-words', 'conventions', 'translation', 'solids', 'cone-side', 'coordinates-physics',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(3);
  });
});
