import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/9-1/';
const FIGS = ['fig-9-1a', 'fig-9-1b'];
const TASKS = [
  'fig-9-1a:pc-trace',
  'fig-9-1a:pc-part',
  'fig-9-1a:pc-cross',
  'fig-9-1b:wl-compare',
  'fig-9-1b:wl-rotate',
  'fig-9-1b:sp-pitch',
  'fig-9-1b:sp-shadow',
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

// ParamLab's hooks (src/sims/ParamLab.tsx, header comment):
//   buttons by name: modes "התחקות", "קו עולם", "עקום במרחב"; toggles "המשך העקום", "המשוואה הקרטזית" (trace),
//   "אותו עקום בפרמטריזציה אחרת" (world, circle / parab), "הצל על מישור xy" (space); "הפעלה" / "עצירה"; "איפוס"
//   [data-control=…]: preset (select, option values = preset ids), t, p (space, helix), az (world, space)
//   [data-readout=…]: trace fn, t, x, y, eq (showEq), cross (nodal, t ≥ 1); world fn, t, point, compare;
//                     space fn, t, point, pitch (helix), shadow
// Negative numbers use U+2212.
const readout = (page: Page, fig: string, id: string) => page.locator(`#${fig} [data-readout="${id}"]`);
const done = async (page: Page, task: string) => ((await progress(page))?.tasks ?? {})[task];

/** Set a range input as a student would: the value, then an input event. */
const slide = (s: Locator, v: number) =>
  s.evaluate((el: HTMLInputElement, value) => {
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);

const pick = (fig: Locator, preset: string) => fig.locator('[data-control="preset"] select').selectOption(preset);

test.describe('lesson 9.1: parametrised curves', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('עקום בפרמטריזציה');
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

  test('the figures start on (t, t²) at t = 0.5 and on the circle at t = 3.14', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page, 'fig-9-1a');
    await expect(readout(page, 'fig-9-1a', 'x')).toContainText('0.5');
    await expect(readout(page, 'fig-9-1a', 'y')).toContainText('0.25');
    await expect(readout(page, 'fig-9-1a', 'eq')).toHaveCount(0);
    await ready(page, 'fig-9-1b');
    // (cos 3.14, sin 3.14) ≈ (−1, 0.0016)
    await expect(readout(page, 'fig-9-1b', 'point')).toContainText('−1');
    await expect(readout(page, 'fig-9-1b', 'compare')).toHaveCount(0);
  });

  test('text steps drive the trace figure: the ellipse equation, the arc |x| ≤ 1, the crossing at the origin', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-9-1a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator('.step[data-fig="fig-9-1a"]');
    // Explore: circle t = 0, halfparab t = 0, nodal t = −1.6; parab t = 1; ellipse with the equation;
    // halfparab t = 2.5 with the equation; nodal t = 1.3; segment t = 0.5; twice t = π/4; parab4 t = 1
    await expect(steps).toHaveCount(10);

    // r(1) = (1, 1) on (t, t²)
    await steps.nth(3).scrollIntoViewIfNeeded();
    await steps.nth(3).click();
    await expect(readout(page, 'fig-9-1a', 'x')).toContainText(/=\s*1\s*$/);
    await expect(readout(page, 'fig-9-1a', 'y')).toContainText(/=\s*1\s*$/);

    await steps.nth(4).scrollIntoViewIfNeeded();
    await steps.nth(4).click();
    await expect(readout(page, 'fig-9-1a', 'eq')).toContainText('x²/4 + y² = 1');

    await steps.nth(5).scrollIntoViewIfNeeded();
    await steps.nth(5).click();
    await expect(readout(page, 'fig-9-1a', 'eq')).toContainText('−1 ≤ x ≤ 1');

    await steps.nth(6).scrollIntoViewIfNeeded();
    await steps.nth(6).click();
    await expect(readout(page, 'fig-9-1a', 'cross')).toBeVisible();

    // the midpoint of the segment from (−2, −1) to (2, 1) at t = 1/2
    await steps.nth(7).scrollIntoViewIfNeeded();
    await steps.nth(7).click();
    await expect(readout(page, 'fig-9-1a', 'x')).toContainText(/=\s*0\s*$/);
    await expect(readout(page, 'fig-9-1a', 'y')).toContainText(/=\s*0\s*$/);
  });

  test('text steps drive the world-line and space figure: two world lines, then the helix with rise 2', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-9-1b');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator('.step[data-fig="fig-9-1b"]');
    // world: circle t = 2π; parab with compare; nodal t = 1.6; space: helix p = 1; helix p = 2 with shadow; segment3 t = 1/2
    await expect(steps).toHaveCount(6);

    await steps.nth(1).scrollIntoViewIfNeeded();
    await steps.nth(1).click();
    await expect(readout(page, 'fig-9-1b', 'compare')).toBeVisible();

    await steps.nth(4).scrollIntoViewIfNeeded();
    await steps.nth(4).click();
    await expect(readout(page, 'fig-9-1b', 'pitch')).toContainText(/=\s*2\s*$/);
    await expect(readout(page, 'fig-9-1b', 'shadow')).toBeVisible();

    // the midpoint of the segment from (2, 0, 0) to (0, 2, 2)
    await steps.nth(5).scrollIntoViewIfNeeded();
    await steps.nth(5).click();
    await expect(readout(page, 'fig-9-1b', 'point')).toContainText(/\(\s*1\s*,\s*1\s*,\s*1\s*\)/);
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-9-1"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the reader moves t to the end of (t, t²): the point reaches (2, 4), and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-9-1a');
    await slide(fig.locator('[data-control="t"] input'), 2);
    await expect(readout(page, 'fig-9-1a', 'y')).toContainText(/=\s*4\s*$/);
    await expect.poll(() => done(page, 'fig-9-1a:pc-trace')).toBeTruthy();
  });

  test('the reader turns the equation on for (sin t, sin² t) and moves t past 3π/2: the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-9-1a');
    await pick(fig, 'halfparab');
    await fig.getByRole('button', { name: 'המשוואה הקרטזית', exact: true }).click();
    await slide(fig.locator('[data-control="t"] input'), 5);
    // sin 5 ≈ −0.9589: still inside |x| ≤ 1
    await expect(readout(page, 'fig-9-1a', 'x')).toContainText('−0.95');
    await expect(readout(page, 'fig-9-1a', 'eq')).toContainText('−1 ≤ x ≤ 1');
    await expect.poll(() => done(page, 'fig-9-1a:pc-part')).toBeTruthy();
  });

  test('the reader moves the nodal curve past t = 1: back at the origin, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-9-1a');
    await pick(fig, 'nodal');
    await slide(fig.locator('[data-control="t"] input'), 1.2);
    await expect(readout(page, 'fig-9-1a', 'cross')).toBeVisible();
    await expect.poll(() => done(page, 'fig-9-1a:pc-cross')).toBeTruthy();
  });

  test('the reader compares the two world lines of the circle and turns the view: both tasks are ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-9-1b');
    await fig.getByRole('button', { name: 'אותו עקום בפרמטריזציה אחרת', exact: true }).click();
    await expect(readout(page, 'fig-9-1b', 'compare')).toContainText('cos 2t');
    await expect.poll(() => done(page, 'fig-9-1b:wl-compare')).toBeTruthy();
    const az = fig.locator('[data-control="az"] input');
    const from = Number(await az.inputValue());
    await slide(az, (from + 40) % 360);
    await expect.poll(() => done(page, 'fig-9-1b:wl-rotate')).toBeTruthy();
  });

  test('the reader opens the helix, changes its rise and turns the shadow on: both tasks are ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-9-1b');
    await fig.getByRole('button', { name: 'עקום במרחב', exact: true }).click();
    await slide(fig.locator('[data-control="p"] input'), 2);
    await expect(readout(page, 'fig-9-1b', 'pitch')).toContainText(/=\s*2\s*$/);
    await expect.poll(() => done(page, 'fig-9-1b:sp-pitch')).toBeTruthy();
    await fig.getByRole('button', { name: 'הצל על מישור xy', exact: true }).click();
    await expect(readout(page, 'fig-9-1b', 'shadow')).toBeVisible();
    await expect.poll(() => done(page, 'fig-9-1b:sp-shadow')).toBeTruthy();
  });

  test('the Check has its five bank questions, and 2 − 3t is graded correct for Q-9.1-segment', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-9.1-eliminate', 'Q-9.1-part-of-line', 'Q-9.1-segment', 'Q-9.1-helix-pitch', 'Q-9.1-curve-vs-graph']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-9.1-segment"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-expr input').fill('2-3t');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-9-1-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-9-1-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-9-1-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors the misconception remedies link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'vector-function',
      'three-words',
      'eliminate',
      'which-part',
      'self-cross',
      'standard',
      'segment',
      'circle-ellipse',
      'centre-shift',
      'orientation',
      'graph-param',
      'many-params',
      'world-line',
      'helix',
      'on-surface',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
