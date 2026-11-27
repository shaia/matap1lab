import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/4-2/';
const FIGS = ['fig-4-2a', 'fig-4-2b', 'fig-4-2c'];
const TASKS = [
  'fig-4-2a:shift-right',
  'fig-4-2a:stretch-x',
  'fig-4-2a:reflect-y',
  'fig-4-2a:match',
  'fig-4-2b:solve-none',
  'fig-4-2b:solve-one',
  'fig-4-2b:solve-three',
  'fig-4-2c:parity-even',
  'fig-4-2c:parity-odd',
  'fig-4-2c:period-find',
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

// GraphLab's readout (src/sims/GraphLab.tsx): one element per quantity, each with data-readout.
//   transform: formula, params ("a = 0, b = 1, A = 1, c = 0"), with a target also target ("הגרף חופף ליעד" / "…עוד לא חופף…")
//   solve:     count ("מספר הפתרונות בחלון (בדיקה מספרית): <b>N</b>"), equation, roots
//   parity:    mirror (when a copy is chosen: "זהה לגרף" / "לא זהה לגרף"), shift (when T ≠ 0)
// Negative numbers use U+2212.
const readout = (page: Page, fig: string, id: string) => page.locator(`#${fig} [data-readout="${id}"]`);
const slider = (fig: Locator, label: RegExp) =>
  fig.locator('label.slider').filter({ has: fig.page().locator('.slider-label', { hasText: label }) }).locator('input[type="range"]');

test.describe('lesson 4.2: shifts and stretches of graphs', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('הזזות ומתיחות של גרפים');
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

  test('each figure starts in its own mode: the base pulse, two roots of the parabola, no copy', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page, 'fig-4-2a');
    await expect(readout(page, 'fig-4-2a', 'params')).toContainText('b = 1');
    await expect(readout(page, 'fig-4-2a', 'target')).toHaveCount(0);
    await ready(page, 'fig-4-2b');
    await expect(readout(page, 'fig-4-2b', 'count')).toContainText('בדיקה מספרית');
    await expect(readout(page, 'fig-4-2b', 'count').locator('b')).toHaveText('2');
    await ready(page, 'fig-4-2c');
    await expect(readout(page, 'fig-4-2c', 'mirror')).toHaveCount(0);
  });

  test('text steps drive the figures: sin x = −1/2 in the window, x³ = 2x + 1, the target to match', async ({ page }) => {
    await page.goto(LESSON);
    await expect(page.locator('.step[data-fig="fig-4-2a"]')).toHaveCount(12);
    await expect(page.locator('.step[data-fig="fig-4-2c"]')).toHaveCount(4);

    const solve = page.locator('#fig-4-2b');
    await solve.scrollIntoViewIfNeeded();
    await hydrated(solve.locator('canvas'));
    const solveSteps = page.locator('.step[data-fig="fig-4-2b"]');
    // the parabola, the cubic, sin x = −1/2, x³ = 2x + 1, eˣ = 2x + 1
    await expect(solveSteps).toHaveCount(5);
    await solveSteps.nth(2).scrollIntoViewIfNeeded();
    await solveSteps.nth(2).click();
    await expect(readout(page, 'fig-4-2b', 'count').locator('b')).toHaveText('4');
    await solveSteps.nth(3).scrollIntoViewIfNeeded();
    await solveSteps.nth(3).click();
    await expect(readout(page, 'fig-4-2b', 'count').locator('b')).toHaveText('3');
    await solveSteps.nth(4).scrollIntoViewIfNeeded();
    await solveSteps.nth(4).click();
    await expect(readout(page, 'fig-4-2b', 'count').locator('b')).toHaveText('2');

    const transform = page.locator('#fig-4-2a');
    await transform.scrollIntoViewIfNeeded();
    await hydrated(transform.locator('canvas'));
    const matchStep = page.locator('.step[data-fig="fig-4-2a"]').nth(11);
    await matchStep.scrollIntoViewIfNeeded();
    await matchStep.click();
    await expect(readout(page, 'fig-4-2a', 'target')).toContainText('עוד לא חופף');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-4-2"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the reader shifts the pulse right, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-2a');
    await slider(fig, /הזזה ימינה a/).fill('1');
    await expect(readout(page, 'fig-4-2a', 'params')).toContainText('a = 1');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-4-2a:shift-right']).toBeTruthy();
  });

  test('the reader lowers the line below the vertex: no solution in the window, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-2b');
    await slider(fig, /הקבוע k/).fill('-4.5');
    await expect(readout(page, 'fig-4-2b', 'count').locator('b')).toHaveText('0');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-4-2b:solve-none']).toBeTruthy();
  });

  test('the reader mirrors the even pulse in the y-axis: the copy coincides, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-2c');
    await fig.getByRole('button', { name: 'שיקוף בציר y' }).click();
    await expect(readout(page, 'fig-4-2c', 'mirror')).toContainText('זהה לגרף');
    await expect(readout(page, 'fig-4-2c', 'mirror')).not.toContainText('לא זהה');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-4-2c:parity-even']).toBeTruthy();
  });

  test('the Check has its five bank questions, and 4 is graded correct for Q-4.2-sin-half-count', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-4.2-shift-read', 'Q-4.2-stretch', 'Q-4.2-sin-half-count', 'Q-4.2-parity', 'Q-4.2-period-sum']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-4.2-sin-half-count"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-numeric input').fill('4');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-4-2-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-4-2-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-4-2-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors other pages link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'shift',
      'shift-predict',
      'stretch',
      'reflect',
      'transform-order',
      'transform-physics',
      'cooling',
      'graphical-solve',
      'periodic-count',
      'graph-ends',
      'abs-graph',
      'parity-definition',
      'neither',
      'parity-rules',
      'periodic',
      'period-scaling',
      'period-sum',
      'parity-physics',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
