import { expect, test, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/6-3/';
const FIGS = ['fig-6-3a', 'fig-6-3b'];
const TASKS = ['fig-6-3a:build-band', 'fig-6-3a:build-odd', 'fig-6-3b:lead-close', 'fig-6-3b:lead-next'];

/** Bring a figure into view, wait for its island, stop text steps from driving it, and reset it. */
async function ready(page: Page, fig: string) {
  const f = page.locator(`#${fig}`);
  await f.scrollIntoViewIfNeeded();
  await hydrated(f.locator('canvas').first());
  await freezeSteps(page);
  await f.getByRole('button', { name: 'איפוס' }).click();
  return f;
}

// TaylorLab's hooks (src/sims/TaylorLab.tsx, header comment): readouts [data-readout="…"]
//   build: fn, n, poly ("T₃(x) = x − x³/6"), x, fx, tx, err, band (band on)
//   lead:  fn, lead, next (next on), x, gx, cx, quot ("g(x)/x³ = … → −1/6"), errs (next on)
// preset chips [data-preset="<id>"] button; sliders [data-slider="n|x"] input[type=range] (lead x: −log₁₀|x|, 0…3);
// buttons [data-action="n-plus|n-minus"]; toggles [data-toggle="band|next|…"] button. Minus is U+2212.
const readout = (page: Page, fig: string, id: string) => page.locator(`#${fig} [data-readout="${id}"]`);

test.describe('lesson 6.3: the expansions of the elementary functions', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('הפיתוחים של הפונקציות האלמנטריות');
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

  test('each figure starts in its own state: eˣ with its tangent and the band; sin x − x near 0', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page, 'fig-6-3a');
    await expect(readout(page, 'fig-6-3a', 'fn')).toContainText('eˣ');
    await expect(readout(page, 'fig-6-3a', 'poly')).toContainText('1 + x');
    await expect(readout(page, 'fig-6-3a', 'band')).toBeVisible();
    await ready(page, 'fig-6-3b');
    await expect(readout(page, 'fig-6-3b', 'fn')).toContainText('sin x − x');
    await expect(readout(page, 'fig-6-3b', 'quot')).toContainText('1/6');
    // the preset whose quotient answers the Check question Q-6.3-lim-cos is not offered
    await expect(page.locator('#fig-6-3b [data-preset="1-cos"]')).toHaveCount(0);
  });

  test('text steps drive the build figure: sin x, then the binomial series with a = 1/2', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-6-3a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator('.step[data-fig="fig-6-3a"]');
    // Explore 3 (exp, sin, geom); Taylor series 1; exp, sin/cos 2; geometric 1; binomial 1
    await expect(steps).toHaveCount(8);

    await steps.nth(1).scrollIntoViewIfNeeded();
    await steps.nth(1).click();
    await expect(readout(page, 'fig-6-3a', 'fn')).toContainText('sin x');
    await expect(readout(page, 'fig-6-3a', 'poly')).toContainText('x³/6');

    await steps.nth(7).scrollIntoViewIfNeeded();
    await steps.nth(7).click();
    await expect(readout(page, 'fig-6-3a', 'fn')).toContainText('(1 + x)');
    await expect(readout(page, 'fig-6-3a', 'poly')).toContainText('x³/16');
  });

  test('text steps drive the lead figure: eˣ − 1 − x leads with x²/2', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-6-3b');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator('.step[data-fig="fig-6-3b"]');
    // limits 1 (sin x − x); how many terms 1 (ln(1 + x) − x); leading term 2 (eˣ − 1 − x, tan x − x)
    await expect(steps).toHaveCount(4);
    await steps.nth(2).scrollIntoViewIfNeeded();
    await steps.nth(2).click();
    await expect(readout(page, 'fig-6-3b', 'fn')).toContainText('eˣ − 1 − x');
    await expect(readout(page, 'fig-6-3b', 'lead')).toContainText('x²/2');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-6-3"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the reader raises the order of sin x from 3 to 4: T₄ = T₃ and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-6-3a');
    await fig.locator('[data-preset="sin"] button').click();
    await fig.locator('[data-slider="n"] input[type=range]').fill('3');
    const before = (await readout(page, 'fig-6-3a', 'poly').innerText()).split('=').pop()?.trim();
    expect(before).toContain('x³/6');
    await fig.locator('[data-action="n-plus"]').click();
    await expect(readout(page, 'fig-6-3a', 'n')).toContainText('4');
    expect((await readout(page, 'fig-6-3a', 'poly').innerText()).split('=').pop()?.trim()).toBe(before);
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-6-3a:build-odd']).toBeTruthy();
  });

  test('the reader brings x close to 0: (sin x − x)/x³ approaches −1/6 and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-6-3b');
    // −log₁₀|x| = 2.5: |x| ≈ 0.0032
    await fig.locator('[data-slider="x"] input[type=range]').fill('2.5');
    await expect(readout(page, 'fig-6-3b', 'quot')).toContainText('0.1666');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-6-3b:lead-close']).toBeTruthy();
  });

  test('the Check has its five bank questions, and 1/2 is graded correct for Q-6.3-lim-cos', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-6.3-cos-series', 'Q-6.3-gauss', 'Q-6.3-exp-sin', 'Q-6.3-diff-geom', 'Q-6.3-lim-cos']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-6.3-lim-cos"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-numeric input').fill('1/2');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-6-3-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-6-3-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-6-3-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors the misconception remedies link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'taylor-series',
      'uniqueness',
      'exp-sin-cos',
      'sin-cos',
      'signs',
      'geometric',
      'binomial',
      'binomial-form',
      'new-from-old',
      'substitution',
      'product',
      'differentiate',
      'integrate',
      'ln-series',
      'arctan-series',
      'table',
      'derivs-from-series',
      'limits-by-series',
      'how-many-terms',
      'leading-term',
      'euler',
      'why-e',
      'series-physics',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
