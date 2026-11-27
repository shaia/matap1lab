import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/9-3/';
const FIGS = ['fig-9-3a', 'fig-9-3b'];
const TASKS = [
  'fig-9-3a:pg-refine',
  'fig-9-3a:pg-below',
  'fig-9-3a:sp-param',
  'fig-9-3a:sp-twice',
  'fig-9-3b:pl-sweep',
  'fig-9-3b:pl-triangle',
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

// ArcLab's hooks (src/sims/ArcLab.tsx, header comment):
//   buttons by name: modes "מצולע חסום", "מהירות ואורך", "עקום קוטבי"; toggles "האורך המדויק" (polygon), "המשולש הקטן"
//   (polar); "הפעלה" / "עצירה"; "איפוס"
//   [data-control="preset"] select, [data-control="param"] select (speed: t, t2 / t, sq, twice)
//   [data-control=…] input: n (polygon), t (speed), theta, dtheta (polar; the value is log₁₀ dθ)
//   [data-readout=…]: polygon fn, n, poly, exact, diff; speed fn, t, speed, arc, total (at the end of the range);
//                     polar fn, theta, r, dr, integrand, arc, triangle
// Numbers have 4 significant figures (sci); below 0.01 they are written m·10⁻ᵏ. Negative numbers use U+2212.
const readout = (page: Page, fig: string, id: string) => page.locator(`#${fig} [data-readout="${id}"]`);
const done = async (page: Page, task: string) => ((await progress(page))?.tasks ?? {})[task];

/** Set a range input as a student would: the value, then an input event. */
const slide = (s: Locator, v: number) =>
  s.evaluate((el: HTMLInputElement, value) => {
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);

test.describe('lesson 9.3: arc length', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('אורך עקום');
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

  test('the figures start on the parabola with two chords (√2 + √10) and on the spiral at θ = 1.2', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page, 'fig-9-3a');
    await expect(readout(page, 'fig-9-3a', 'n')).toContainText('2');
    await expect(readout(page, 'fig-9-3a', 'poly')).toContainText('4.576');
    await expect(readout(page, 'fig-9-3a', 'exact')).toHaveCount(0);
    await ready(page, 'fig-9-3b');
    await expect(readout(page, 'fig-9-3b', 'theta')).toContainText('1.2');
    await expect(readout(page, 'fig-9-3b', 'triangle')).toHaveCount(0);
  });

  test('text steps drive the arc figure: L₁₆ next to L, and the same s(t) in two parametrisations', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-9-3a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator('.step[data-fig="fig-9-3a"]');
    // Explore (parab n 2; notes t at 1); polygon parab n 4 exact, n 16 exact; s(t) notes t at 0.5; independence notes t2
    // at 1/√2; arc-length param circle t at π; graph cosh n 4 exact; no formula ellipse n 8 exact
    await expect(steps).toHaveCount(9);

    // L₁₆ ≈ 4.6455, L = √17 + arsinh(4)/4 ≈ 4.6468, the difference ≈ 0.00126
    await steps.nth(3).scrollIntoViewIfNeeded();
    await steps.nth(3).click();
    await expect(readout(page, 'fig-9-3a', 'poly')).toContainText('4.646');
    await expect(readout(page, 'fig-9-3a', 'exact')).toContainText('4.64678');
    await expect(readout(page, 'fig-9-3a', 'diff')).toContainText('1.26·10⁻³');

    // (t, t²) at t = 1/2 and (t², t⁴) at t = 1/√2: the same point (1/2, 1/4), the same s ≈ 0.5739, speeds √2 and 2
    await steps.nth(4).scrollIntoViewIfNeeded();
    await steps.nth(4).click();
    await expect(readout(page, 'fig-9-3a', 'arc')).toContainText('0.5739');
    await expect(readout(page, 'fig-9-3a', 'speed')).toContainText('1.414');
    await steps.nth(5).scrollIntoViewIfNeeded();
    await steps.nth(5).click();
    await expect(readout(page, 'fig-9-3a', 'arc')).toContainText('0.5739');
    await expect(readout(page, 'fig-9-3a', 'speed')).toContainText(/=\s*2\s*$/);

    // the catenary y = cosh x on [−1, 1]: L = 2 sinh 1 ≈ 2.3504
    await steps.nth(7).scrollIntoViewIfNeeded();
    await steps.nth(7).click();
    await expect(readout(page, 'fig-9-3a', 'exact')).toContainText('2.3504');
  });

  test('text steps drive the polar figure: the little triangle at θ = π on the spiral', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-9-3b');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator('.step[data-fig="fig-9-3b"]');
    // spiral θ = π; spiral θ = π with the triangle, dθ = 0.1; logspiral θ = 2π
    await expect(steps).toHaveCount(3);

    await steps.nth(1).scrollIntoViewIfNeeded();
    await steps.nth(1).click();
    // r dθ ≈ 0.3142, dr = 0.1, hypotenuse √(0.3142² + 0.1²) ≈ 0.3297; s(π) ≈ 6.110
    await expect(readout(page, 'fig-9-3b', 'triangle')).toContainText('0.3297');
    await expect(readout(page, 'fig-9-3b', 'arc')).toContainText('6.11');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-9-3"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the reader turns the exact length on and refines the parabola to n = 32: the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-9-3a');
    await fig.getByRole('button', { name: 'האורך המדויק', exact: true }).click();
    await slide(fig.locator('[data-control="n"] input'), 32);
    // L₃₂ ≈ 4.64647, 3.16·10⁻⁴ below L
    await expect(readout(page, 'fig-9-3a', 'poly')).toContainText('4.646');
    await expect(readout(page, 'fig-9-3a', 'diff')).toContainText('3.16·10⁻⁴');
    await expect.poll(() => done(page, 'fig-9-3a:pg-refine')).toBeTruthy();
  });

  test('the reader switches the notes curve to (t², t⁴) and moves t to the end: the same length, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-9-3a');
    await fig.getByRole('button', { name: 'מהירות ואורך', exact: true }).click();
    await fig.locator('[data-control="param"] select').selectOption('t2');
    await slide(fig.locator('[data-control="t"] input'), Math.SQRT2);
    await expect(readout(page, 'fig-9-3a', 'total')).toContainText('4.64678');
    await expect(readout(page, 'fig-9-3a', 'total')).toContainText('זה אורך העקום');
    await expect.poll(() => done(page, 'fig-9-3a:sp-param')).toBeTruthy();
  });

  test('the reader shrinks dθ on the spiral with the triangle on: the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-9-3b');
    await fig.getByRole('button', { name: 'המשולש הקטן', exact: true }).click();
    // the dθ slider is logarithmic: its value is log₁₀ dθ
    await slide(fig.locator('[data-control="dtheta"] input'), -2);
    await expect(readout(page, 'fig-9-3b', 'triangle')).toContainText('0.01');
    await expect.poll(() => done(page, 'fig-9-3b:pl-triangle')).toBeTruthy();
  });

  test('the Check has its five bank questions, and 14/3 is graded correct for Q-9.3-graph-length', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-9.3-helix-length', 'Q-9.3-setup', 'Q-9.3-unit-speed', 'Q-9.3-graph-length', 'Q-9.3-polar-circle']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-9.3-graph-length"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-numeric input').fill('14/3');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-9-3-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-9-3-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-9-3-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors the misconception remedies link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'polygon-to-integral',
      'chord-shorter',
      'abs-root',
      'speed-times-time',
      'arc-length-function',
      'independence',
      'when-independent',
      'arc-length-param',
      'unit-speed-turns',
      'graph-length',
      'no-formula',
      'polar-length',
      'r-only',
      'space-length',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
