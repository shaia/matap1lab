import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/7-3/';
const FIG = 'fig-7-3a';
const TASKS = [`${FIG}:parts-move`, `${FIG}:parts-start`];

/** Bring the figure into view, wait for its island, stop text steps from driving it, and reset it. */
async function ready(page: Page) {
  const f = page.locator(`#${FIG}`);
  await f.scrollIntoViewIfNeeded();
  await hydrated(f.locator('canvas').first());
  await freezeSteps(page);
  await f.getByRole('button', { name: 'איפוס' }).click();
  return f;
}

// MethodLab's hooks (src/sims/MethodLab.tsx, header comment), parts mode:
//   [data-readout=…] fn, uv, range, uT, vT, vdu, udv, sum, rect, identity (and note, only for xsin)
//   [data-control="preset"] select (option values = PARTS ids), [data-control="T"] / [data-control="t0"] inputs (step
//   0.01); buttons "צביעת שני השטחים" (split), "איפוס". Numbers have 4 significant figures, minus is U+2212.
const readout = (page: Page, id: string) => page.locator(`#${FIG} [data-readout="${id}"]`);

/** Set a range input as a student would: the value, then an input event. */
const slide = (s: Locator, v: number) =>
  s.evaluate((el: HTMLInputElement, value) => {
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);

test.describe('lesson 7.3: integration by parts', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('אינטגרציה בחלקים');
    await expect(page.locator('.katex-error')).toHaveCount(0);
  });

  test('the figure hydrates and draws, in LTR math space', async ({ page }) => {
    await page.goto(LESSON);
    const c = page.locator(`#${FIG} canvas`).first();
    await c.scrollIntoViewIfNeeded();
    await hydrated(c);
    await expect(c).toHaveCSS('direction', 'ltr');
    await expect.poll(() => inked(c)).toBeGreaterThan(200);
  });

  test('the figure starts on ∫x·eˣ dx with u = x, and the two areas add up to the rectangle', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page);
    await expect(readout(page, 'fn')).toContainText('x·eˣ');
    await expect(readout(page, 'uv')).toContainText('u = x');
    const sum = (await readout(page, 'sum').locator('b').textContent())?.trim();
    const rect = (await readout(page, 'rect').locator('b').textContent())?.trim();
    expect(sum).toBeTruthy();
    expect(sum).toBe(rect);
  });

  test('text steps drive the figure: the rectangle 2e², the note on v = 1 − cos x, and ∫ v du = 2 for ln x', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator(`#${FIG}`);
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator(`.step[data-fig="${FIG}"]`);
    // Explore 2 (xex, lnx); the picture 1 (xex, T = 2); which factor 1 (xsin); the factor 1 (lnx, T = 3)
    await expect(steps).toHaveCount(5);

    await steps.nth(2).scrollIntoViewIfNeeded();
    await steps.nth(2).click();
    await expect(readout(page, 'rect')).toContainText('14.78');
    await expect(readout(page, 'vdu')).toContainText('6.389');
    await expect(readout(page, 'udv')).toContainText('8.389');

    await steps.nth(3).scrollIntoViewIfNeeded();
    await steps.nth(3).click();
    await expect(readout(page, 'fn')).toContainText('x·sin x');
    await expect(readout(page, 'note')).toContainText('1 − cos x');

    await steps.nth(4).scrollIntoViewIfNeeded();
    await steps.nth(4).click();
    await expect(readout(page, 'fn')).toContainText('ln x');
    await expect(readout(page, 'vdu').locator('b')).toHaveText('2');
    await expect(readout(page, 'rect')).toContainText('3.296');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator(`.step[data-fig="${FIG}"]`).all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the reader moves T from 1.5 to 2 on ∫x·eˣ dx: the sum is the rectangle 2e², and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page);
    await slide(fig.locator('[data-control="T"] input'), 2);
    await expect(readout(page, 'sum')).toContainText('14.78');
    await expect(readout(page, 'rect')).toContainText('14.78');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})[`${FIG}:parts-move`]).toBeTruthy();
  });

  test('the reader moves t₀ to 1.5 on ∫ln x dx: the small rectangle is subtracted, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page);
    await fig.locator('[data-control="preset"] select').selectOption('lnx');
    await slide(fig.locator('[data-control="t0"] input'), 1.5);
    // T = 3: u(T)v(T) − u(t₀)v(t₀) = 3 ln 3 − 1.5 ln 1.5 ≈ 2.688; ∫v du = 1.5; ∫u dv ≈ 1.188
    await expect(readout(page, 'rect')).toContainText('2.688');
    await expect(readout(page, 'vdu')).toContainText('1.5');
    await expect(readout(page, 'udv')).toContainText('1.188');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})[`${FIG}:parts-start`]).toBeTruthy();
  });

  test('the Check has its five bank questions, and x sin x + cos x + 5 is graded correct for Q-7.3-xcos', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-7.3-choose', 'Q-7.3-xcos', 'Q-7.3-x2ex', 'Q-7.3-cycle', 'Q-7.3-atan']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-7.3-xcos"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-expr input').fill('x*sin(x)+cos(x)+5');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-7-3-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-7-3-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-7-3-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors the misconception remedies link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'parts-formula',
      'product-rule-reminder',
      'parts-picture',
      'which-factor',
      'repeated',
      'cycle',
      'cycle-swap',
      'one-times',
      'parts-physics',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
