import { expect, test, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/6-4/';
const FIGS = ['fig-6-4a', 'fig-6-4b'];
const TASKS = [
  'fig-6-4a:radius-outside',
  'fig-6-4a:radius-edge',
  'fig-6-4a:radius-complex',
  'fig-6-4b:leibniz-bracket',
  'fig-6-4b:leibniz-bound',
  'fig-6-4b:leibniz-fast',
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
// TaylorLab's readout (src/sims/TaylorLab.tsx), one element per quantity with data-readout, as in LimitLab.
// TaylorLab's readouts (src/sims/TaylorLab.tsx header): radius fn, table, verdict; leibniz fn, sn, bound, err.
// Negative numbers use U+2212.
const readout = (page: Page, fig: string, id: string) => page.locator(`#${fig} [data-readout="${id}"]`);

test.describe('lesson 6.4: the domain of convergence and Leibniz-type series', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('תחום ההתכנסות');
    await expect(page.locator('.katex-error')).toHaveCount(0);
  });

  test('both figures hydrate and draw, in LTR math space', async ({ page }) => {
    await page.goto(LESSON);
    for (const fig of FIGS) {
      const c = page.locator(`#${fig} canvas`).first();
      await c.scrollIntoViewIfNeeded();
      await hydrated(c);
      await expect(c).toHaveCSS('direction', 'ltr');
      await expect.poll(() => inked(c)).toBeGreaterThan(200);
    }
  });

  test('each figure starts in its own state: 1/(1 + x²) at x = 0.5; the series of ln 2 at n = 4', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page, 'fig-6-4a');
    await expect(readout(page, 'fig-6-4a', 'fn')).toContainText('1 + x²');
    await expect(readout(page, 'fig-6-4a', 'verdict')).not.toContainText('מתבדר');
    await ready(page, 'fig-6-4b');
    await expect(readout(page, 'fig-6-4b', 'fn')).toContainText('ln');
    // S_4 = 7/12 ≈ 0.5833, the bound b_5 = 1/5
    await expect(readout(page, 'fig-6-4b', 'sn')).toContainText('0.583');
    await expect(readout(page, 'fig-6-4b', 'bound')).toContainText('0.2');
  });

  test('text steps drive the radius figure: the geometric series at x = −2 diverges', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-6-4a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator('.step[data-fig="fig-6-4a"]');
    // Explore 3; convergence 1; standard radii 2 (sin at 6, geometric at −2); the break 2 (ln at −0.9, 1/(1 + x²)
    // with the complex plane); the ends 1 (arctan at 1)
    await expect(steps).toHaveCount(9);

    // the geometric series at x = −2: outside the radius
    await steps.nth(5).scrollIntoViewIfNeeded();
    await steps.nth(5).click();
    await expect(readout(page, 'fig-6-4a', 'verdict')).toContainText('מתבדר');

    // sin at x = 6: inside an infinite radius, S_40(6) ≈ −0.27942
    await steps.nth(4).scrollIntoViewIfNeeded();
    await steps.nth(4).click();
    await expect(readout(page, 'fig-6-4a', 'table')).toContainText('0.279');
    await expect(readout(page, 'fig-6-4a', 'verdict')).not.toContainText('מתבדר');
  });

  test('text steps drive the Leibniz figure: π/4 after 50 terms, 1/e after 4', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-6-4b');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator('.step[data-fig="fig-6-4b"]');
    // ln 2 at n = 4; ln 2 at n = 10; π/4 at n = 50; 1/e at n = 4
    await expect(steps).toHaveCount(4);

    // π/4 at n = 50: the bound b_51 = 1/101 ≈ 0.0099
    await steps.nth(2).scrollIntoViewIfNeeded();
    await steps.nth(2).click();
    await expect(readout(page, 'fig-6-4b', 'bound')).toContainText('9.9·10⁻³');

    // 1/e at n = 4: S_4 = 1/3, the bound b_5 = 1/24 ≈ 0.0417
    await steps.nth(3).scrollIntoViewIfNeeded();
    await steps.nth(3).click();
    await expect(readout(page, 'fig-6-4b', 'sn')).toContainText('0.333');
    await expect(readout(page, 'fig-6-4b', 'bound')).toContainText('0.041');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-6-4"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the reader turns on the complex plane for 1/(1 + x²): the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-6-4a');
    await fig.getByRole('button', { name: 'המישור המרוכב' }).click();
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-6-4a:radius-complex']).toBeTruthy();
  });

  test('the reader moves n with the bracket on: S stays inside it and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-6-4b');
    const slider = fig.locator('[data-slider="n"] input[type=range]');
    await slider.focus();
    await slider.press('ArrowRight');
    // n = 5 (if the slider steps by one): S_5 = 47/60 ≈ 0.7833, above ln 2
    await expect(readout(page, 'fig-6-4b', 'sn')).not.toContainText('0.5833');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-6-4b:leibniz-bracket']).toBeTruthy();
  });

  test('the Check has its five bank questions, and 1/5040 is graded correct for Q-6.4-sin1-error', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-6.4-radius-std', 'Q-6.4-radius-3x', 'Q-6.4-sin1-error', 'Q-6.4-radius-x2', 'Q-6.4-compose-plan']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-6.4-sin1-error"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-numeric input').fill('1/5040');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-6-4-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-6-4-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-6-4-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors the misconception remedies link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'convergence',
      'standard-radii',
      'beyond-radius',
      'substitution-radius',
      'why-radius',
      'complex-break',
      'endpoints',
      'leibniz',
      'leibniz-bound',
      'leibniz-sign',
      'leibniz-count',
      'compose',
      'convergence-physics',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
