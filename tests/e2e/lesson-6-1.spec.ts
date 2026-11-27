import { expect, test, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/6-1/';
const FIG = 'fig-6-1a';
const TASKS = [`${FIG}:build-order2`, `${FIG}:build-move`, `${FIG}:build-poly`];

/** Bring the figure into view, wait for its island, stop text steps from driving it, and reset it. */
async function ready(page: Page) {
  const f = page.locator(`#${FIG}`);
  await f.scrollIntoViewIfNeeded();
  await hydrated(f.locator('canvas').first());
  await freezeSteps(page);
  await f.getByRole('button', { name: 'איפוס' }).click();
  return f;
}

// TaylorLab's hooks (header comment of src/sims/TaylorLab.tsx): build-mode readouts fn ("f(x) = cos x, x₀ = 0"), n,
// poly ("T₂(x) = 1 − x²/2", powers of (x − x₀), U+2212 minus), same ("T₃ זהה ל-f", only then); the order buttons are
// [data-action="n-minus|n-plus"].
const readout = (page: Page, id: string) => page.locator(`#${FIG} [data-readout="${id}"]`);

test.describe('lesson 6.1: higher derivatives and the Taylor polynomial', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('פולינום טיילור');
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

  test('the figure starts on cos x about 0 at order 1: the horizontal tangent y = 1', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page);
    await expect(readout(page, 'fn')).toContainText('cos');
    await expect(readout(page, 'n')).toContainText('1');
  });

  test('text steps drive the figure: ln x about 1, and a polynomial that is its own T₃', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator(`#${FIG}`);
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator(`.step[data-fig="${FIG}"]`);
    // Explore 3; building the polynomial 5; recipe 1; about another point 1; a polynomial is its own 1; orders 1 and 2 2
    await expect(steps).toHaveCount(13);

    // ln x about 1, order 3: the polynomial is written in powers of (x − 1)
    await steps.nth(9).scrollIntoViewIfNeeded();
    await steps.nth(9).click();
    await expect(readout(page, 'fn')).toContainText('ln');
    await expect(readout(page, 'poly')).toContainText('x − 1');

    // x³ − 2x + 1 about 0, order 3: T₃ is f itself
    await steps.nth(10).scrollIntoViewIfNeeded();
    await steps.nth(10).click();
    await expect(readout(page, 'same')).toContainText('זהה');
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

  test('the reader raises the order from 1 to 2: the parabola 1 − x²/2 appears and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page);
    await fig.locator('[data-action="n-plus"]').click();
    await expect(readout(page, 'n')).toContainText('2');
    await expect(readout(page, 'poly')).toContainText('x²');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})[`${FIG}:build-order2`]).toBeTruthy();
  });

  test('the Check has its five bank questions, and e + e(x−1) + e(x−1)²/2 is graded correct for Q-6.1-exp-at1', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-6.1-poly-vanish', 'Q-6.1-tangent-is-T1', 'Q-6.1-exp-at1', 'Q-6.1-nth-pattern', 'Q-6.1-osculating']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-6.1-exp-at1"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-expr input').fill('e + e*(x-1) + e*(x-1)^2/2');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-6-1-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-6-1-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-6-1-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors the misconception remedies link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'higher-derivatives',
      'chain-each-time',
      'nth-formula',
      'taylor-picture',
      'taylor-definition',
      'factorial-why',
      'taylor-local',
      'taylor-recipe',
      'about-x0',
      'poly-self',
      'osculating',
      'taylor-physics',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
