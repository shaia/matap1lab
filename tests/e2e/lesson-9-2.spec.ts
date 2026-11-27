import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/9-2/';
const FIGS = ['fig-9-2a', 'fig-9-2b'];
const TASKS = [
  'fig-9-2a:sc-shrink',
  'fig-9-2a:sc-side',
  'fig-9-2a:sc-cusp',
  'fig-9-2b:mo-accel',
  'fig-9-2b:mo-speed',
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

// VelocityLab's hooks (src/sims/VelocityLab.tsx, header comment):
//   buttons by name: modes "מנת הפרש", "תנועה"; secant "h > 0", "h < 0", "המשיק", "קירוב לינארי"; motion "וקטור התאוצה",
//   "הפעלה" / "עצירה"; "איפוס"
//   [data-control=…]: preset (select, values = VC ids), h (log10 |h|, −3…log10 2), t
//   [data-readout=…]: secant fn, scale, t, h, quotient, v, angle (not at v = 0), vzero (only at v = 0), tangent, approx;
//                     motion fn, scale, t, r, v, speed, a, a-abs
// Negative numbers use U+2212.
const readout = (page: Page, fig: string, id: string) => page.locator(`#${fig} [data-readout="${id}"]`);
const done = async (page: Page, task: string) => ((await progress(page))?.tasks ?? {})[task];

/** Set a range input as a student would: the value, then an input event. */
const slide = (s: Locator, v: number) =>
  s.evaluate((el: HTMLInputElement, value) => {
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);

test.describe('lesson 9.2: the velocity vector and the tangent line', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('וקטור המהירות והישר המשיק');
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

  test('the figures start on (t, t²) at t = 0.5 with h = 1 (angle ≈ 18.4°) and on the throw at t = 0.3 (|v| = √61)', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page, 'fig-9-2a');
    // Δr/h = (1, 2t + h) = (1, 2), v = (1, 1): the angle between them is atan 2 − 45° ≈ 18.43°
    await expect(readout(page, 'fig-9-2a', 'quotient')).toContainText(/\(1,\s*2\)/);
    await expect(readout(page, 'fig-9-2a', 'v')).toContainText(/\(1,\s*1\)/);
    await expect(readout(page, 'fig-9-2a', 'angle')).toContainText('18.4');
    await expect(readout(page, 'fig-9-2a', 'tangent')).toHaveCount(0);
    await ready(page, 'fig-9-2b');
    // v(0.3) = (6, 5), |v| = √61 ≈ 7.81
    await expect(readout(page, 'fig-9-2b', 'speed')).toContainText('7.81');
    await expect(readout(page, 'fig-9-2b', 'a')).toHaveCount(0);
  });

  test('text steps drive the secant figure: the quotient (1, 1.01) at h = 0.01, and v = 0 at the cusp', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-9-2a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator('.step[data-fig="fig-9-2a"]');
    // Explore 3 (parab h 1, parab h 0.5, cusp t 0.6); derivative h 0.1, h 0.01; tangent; linear approx h 0.5, h 0.1;
    // zero velocity: cusp t 0, cycloid t 6.28
    await expect(steps).toHaveCount(10);

    await steps.nth(4).scrollIntoViewIfNeeded();
    await steps.nth(4).click();
    await expect(readout(page, 'fig-9-2a', 'quotient')).toContainText('1.01');

    // the linear approximation with h = 0.1: the distance from r(t + h) is h² = 0.01
    await steps.nth(7).scrollIntoViewIfNeeded();
    await steps.nth(7).click();
    await expect(readout(page, 'fig-9-2a', 'approx')).toContainText('0.01');

    await steps.nth(8).scrollIntoViewIfNeeded();
    await steps.nth(8).click();
    await expect(readout(page, 'fig-9-2a', 'vzero')).toBeVisible();
    await expect(readout(page, 'fig-9-2a', 'angle')).toHaveCount(0);
  });

  test('text steps drive the motion figure: the top of the throw, and the circle with a = −r', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-9-2b');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator('.step[data-fig="fig-9-2b"]');
    // circle t 1; throw t 0.3, throw t 0.8 with accel; circle t 1, circle t 2 with accel; ellipse t 0.6 with accel;
    // throw t 1.6 with accel
    await expect(steps).toHaveCount(7);

    // at the top, t = 0.8: v = (6, 0), a = (0, −10)
    await steps.nth(2).scrollIntoViewIfNeeded();
    await steps.nth(2).click();
    await expect(readout(page, 'fig-9-2b', 'speed')).toContainText(/\b6\b/);
    await expect(readout(page, 'fig-9-2b', 'a-abs')).toContainText('10');

    // the circle of radius 2 at ω = 1: |a| = 2
    await steps.nth(4).scrollIntoViewIfNeeded();
    await steps.nth(4).click();
    await expect(readout(page, 'fig-9-2b', 'a-abs')).toContainText(/\b2\b/);
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-9-2"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the reader shrinks h to 0.01: the angle drops below 1°, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-9-2a');
    // the slider is log10 |h|: −2 is h = 0.01; then Δr/h = (1, 1.01) and the angle ≈ 0.285°
    await slide(fig.locator('[data-control="h"] input, input[data-control="h"]').first(), -2);
    await expect(readout(page, 'fig-9-2a', 'quotient')).toContainText('1.01');
    await expect(readout(page, 'fig-9-2a', 'angle')).toContainText(/0\.28|0\.29/);
    await expect.poll(() => done(page, 'fig-9-2a:sc-shrink')).toBeTruthy();
  });

  test('the reader switches h to negative: the quotient still points forward, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-9-2a');
    await fig.getByRole('button', { name: 'h < 0', exact: true }).click();
    // h = −1: Δr/h = (1, 2t + h) = (1, 0), its first component still positive
    await expect(readout(page, 'fig-9-2a', 'h')).toContainText('−1');
    await expect(readout(page, 'fig-9-2a', 'quotient')).toContainText(/\(1,\s*0\)/);
    await expect.poll(() => done(page, 'fig-9-2a:sc-side')).toBeTruthy();
  });

  test('the reader moves t to the cusp of (t², t³): v = 0, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-9-2a');
    await fig.locator('[data-control="preset"] select, select[data-control="preset"]').first().selectOption('cusp');
    await slide(fig.locator('[data-control="t"] input, input[data-control="t"]').first(), 0);
    await expect(readout(page, 'fig-9-2a', 'vzero')).toBeVisible();
    await expect.poll(() => done(page, 'fig-9-2a:sc-cusp')).toBeTruthy();
  });

  test('the reader turns the acceleration on for the circle: |a| = 2, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-9-2b');
    await fig.locator('[data-control="preset"] select, select[data-control="preset"]').first().selectOption('circle');
    await fig.getByRole('button', { name: 'וקטור התאוצה', exact: true }).click();
    await expect(readout(page, 'fig-9-2b', 'speed')).toContainText(/\b2\b/);
    await expect(readout(page, 'fig-9-2b', 'a-abs')).toContainText(/\b2\b/);
    await expect.poll(() => done(page, 'fig-9-2b:mo-accel')).toBeTruthy();
  });

  test('the Check has its five bank questions, and 3 is graded correct for Q-9.2-speed', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-9.2-speed', 'Q-9.2-velocity-direction', 'Q-9.2-accel', 'Q-9.2-slope', 'Q-9.2-linear-approx']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-9.2-speed"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-numeric input').fill('3');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-9-2-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-9-2-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-9-2-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors the misconception remedies link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'derivative',
      'componentwise',
      'speed',
      'tangent-line',
      'linear-approx',
      'parametric-slope',
      'zero-velocity',
      'tangent-velocity',
      'acceleration',
      'circular-accel',
      'product-rules',
      'speed-change',
      'differential',
      'integrate-back',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
