import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/7-4/';
const FIG = 'fig-7-4a';
const TASKS = ['pf-sum', 'pf-pole', 'pf-far', 'fit-exact'].map((t) => `${FIG}:${t}`);

/** Bring the figure into view, wait for its island, stop text steps from driving it, and reset it. */
async function ready(page: Page) {
  const f = page.locator(`#${FIG}`);
  await f.scrollIntoViewIfNeeded();
  await hydrated(f.locator('canvas').first());
  await freezeSteps(page);
  await f.getByRole('button', { name: 'איפוס' }).click();
  return f;
}

// FractionLab's hooks (src/sims/FractionLab.tsx, header comment): mode buttons "פירוק לשברים" / "התאמת מקדמים";
// "סכום האיברים"; cover-up toggles [data-control="coverup-<j>"] (pole index = the denominator's factor order);
// term toggles [data-control="term-<i>"]; [data-control="preset"] select; [data-control="x" | "A" | "B"] inputs.
// Readouts: pieces fn, x, fx, terms, dominant, sum, cover; fit fn, attempt, A, B, verdict. Minus is U+2212.
const readout = (page: Page, id: string) => page.locator(`#${FIG} [data-readout="${id}"]`);

/** Set a range input as a student would: the value, then an input event. */
const slide = (s: Locator, v: number) =>
  s.evaluate((el: HTMLInputElement, value) => {
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);

const task = async (page: Page, t: string) => ((await progress(page))?.tasks ?? {})[`${FIG}:${t}`];

test.describe('lesson 7.4: partial fractions', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('שברים חלקיים');
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

  test('the figure starts on 1/(x² − 1), not on the notes example whose coefficient is a bank answer', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page);
    await expect(readout(page, 'fn')).toContainText('1/((x − 1)(x + 1))');
    await expect(readout(page, 'terms')).not.toContainText('−2/(x − 1)');
  });

  test('text steps drive the figure: a wrong B blows up at x = −2, and the cover-ups read 2 and 3', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator(`#${FIG}`);
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator(`.step[data-fig="${FIG}"]`);
    // Explore 4 (two, three, improper, fit); idea 1; coefficients: fit with B wrong, cover-up of fitA; repeated 1;
    // quadratic 1; division 1
    await expect(steps).toHaveCount(10);

    // A = 2, B = 1 (sign slip): the residual blows up at the pole of B
    await steps.nth(5).scrollIntoViewIfNeeded();
    await steps.nth(5).click();
    await expect(readout(page, 'verdict')).toContainText('x = −2');
    await expect(readout(page, 'verdict')).not.toContainText('השארית מתאפסת');

    // the cover-up of x − 1 in (x + 5)/((x − 1)(x + 2)) at x = 1.05: (x + 5)/(x + 2) ≈ 1.98, on its way to 2
    await steps.nth(6).scrollIntoViewIfNeeded();
    await steps.nth(6).click();
    await expect(readout(page, 'cover')).toContainText(/1\.98/);

    // the repeated pole: (x − 1)²·R(x) = x + 2 = 3.2 at x = 1.2, on its way to 3
    await steps.nth(7).scrollIntoViewIfNeeded();
    await steps.nth(7).click();
    await expect(readout(page, 'fn')).toContainText('(x + 2)/(x − 1)²');
    await expect(readout(page, 'cover')).toContainText('3.2');
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

  test('the reader turns the sum on with every term shown: it lies on R, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page);
    await fig.getByRole('button', { name: 'סכום האיברים' }).click();
    await expect(readout(page, 'sum')).toContainText('כל האיברים מוצגים');
    await expect.poll(() => task(page, 'pf-sum')).toBeTruthy();
  });

  test('the reader covers x − 1 in the three-pole function and walks to the pole: about 2/3, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page);
    await fig.locator('[data-control="preset"] select').selectOption('three');
    await fig.locator('[data-control="coverup-1"]').click();
    await slide(fig.locator('[data-control="x"] input'), 1.005);
    await expect(readout(page, 'cover')).toContainText(/0\.66/);
    await expect.poll(() => task(page, 'pf-pole')).toBeTruthy();
  });

  test('the reader walks far along x³/(x² − 1): R(x) − x < 0.1 only from about x = 10.1, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page);
    await fig.locator('[data-control="preset"] select').selectOption('improper');
    await slide(fig.locator('[data-control="x"] input'), 6);
    await page.waitForTimeout(200);
    expect(await task(page, 'pf-far')).toBeFalsy();
    await slide(fig.locator('[data-control="x"] input'), 11);
    await expect.poll(() => task(page, 'pf-far')).toBeTruthy();
  });

  test('the reader fits A = 2 and B = −1 by the sliders: the residual vanishes, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page);
    await fig.getByRole('button', { name: 'התאמת מקדמים' }).click();
    await fig.locator('[data-control="preset"] select').selectOption('fitA');
    await slide(fig.locator('[data-control="A"] input'), 2);
    await expect(readout(page, 'verdict')).toContainText('x = −2');
    await slide(fig.locator('[data-control="B"] input'), -1);
    await expect(readout(page, 'verdict')).toContainText('השארית מתאפסת');
    await expect.poll(() => task(page, 'fit-exact')).toBeTruthy();
  });

  test('the Check has its five bank questions, and 1/3 is graded correct for Q-7.4-coverup-C', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-7.4-form', 'Q-7.4-coverup-C', 'Q-7.4-division', 'Q-7.4-arctan-basic', 'Q-7.4-mixed']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-7.4-coverup-C"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-numeric input').fill('1/3');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-7-4-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-7-4-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-7-4-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors the misconception remedies link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'idea',
      'coefficients',
      'factoring',
      'coverup',
      'repeated',
      'quadratic',
      'repeated-quadratic',
      'integrate-pieces',
      'arctan',
      'complete-square',
      'split-numerator',
      'division',
      'long-division',
      'recipe',
      'physics',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
