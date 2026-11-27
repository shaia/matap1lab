import { expect, test, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/6-2/';
const FIG = 'fig-6-2a';
const TASKS = ['fig-6-2a:rem-enough', 'fig-6-2a:rem-widen', 'fig-6-2a:rem-gap'];

/** Bring the figure into view, wait for its island, stop text steps from driving it, and reset it. */
async function ready(page: Page) {
  const f = page.locator(`#${FIG}`);
  await f.scrollIntoViewIfNeeded();
  await hydrated(f.locator('canvas').first());
  await freezeSteps(page);
  await f.getByRole('button', { name: 'איפוס' }).click();
  return f;
}

// TaylorLab's readout in mode 'remainder' (header comment of src/sims/TaylorLab.tsx): fn, n, interval, M (with how it
// was taken), B, err (sampled max, a probe), verdict ("B < ε: הסדר מספיק" / "B ≥ ε: צריך סדר גבוה יותר").
const readout = (page: Page, id: string) => page.locator(`#${FIG} [data-readout="${id}"]`);

/** Raise the order n as the learner does, one step at a time, with the arrow key on the n slider (0…20). */
async function raiseOrderTo(page: Page, n: number, from: number) {
  const slider = page.locator(`#${FIG} [data-slider="n"] input[type=range], #${FIG} input[type=range][data-slider="n"]`).first();
  await slider.focus();
  for (let k = from; k < n; k++) await slider.press('ArrowRight');
  await expect(readout(page, 'n')).toContainText(String(n));
}

test.describe('lesson 6.2: Taylor’s formula with the Lagrange remainder', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('שארית לגרנז׳');
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

  test('the figure starts with eˣ, T₁ on [−1, 1] and ε = 10⁻⁵: M = e at the right end, the order is not enough', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page);
    // M = e at the right end; B = e/2 ≈ 1.359 (screens/tools/lesson-6-2-fig.ts)
    await expect(readout(page, 'M')).toContainText('2.718');
    await expect(readout(page, 'M')).toContainText('בקצה הקטע');
    await expect(readout(page, 'B')).toContainText('1.3');
    await expect(readout(page, 'verdict')).toContainText('צריך סדר גבוה יותר');
  });

  test('text steps drive the figure: cos on |x| ≤ π/4 needs n = 8; sin with n = 8 is enough', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator(`#${FIG}`);
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator(`.step[data-fig="${FIG}"]`);
    // Explore 3; the picture 1; the recipe 1; the calculator 2 (cos n = 7, sin n = 8); the pendulum 1
    await expect(steps).toHaveCount(8);

    // cos, n = 7, δ = π/4, ε = 10⁻⁶: B ≈ 3.59·10⁻⁶ ≥ ε
    await steps.nth(5).scrollIntoViewIfNeeded();
    await steps.nth(5).click();
    await expect(readout(page, 'verdict')).toContainText('צריך סדר גבוה יותר');

    // sin, n = 8, same interval: B ≈ 3.13·10⁻⁷ < ε
    await steps.nth(6).scrollIntoViewIfNeeded();
    await steps.nth(6).click();
    await expect(readout(page, 'verdict')).toContainText('הסדר מספיק');
    // M = 1 for sin and cos, said in the readout
    await expect(readout(page, 'M')).toContainText('חסומה ב-1');
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

  test('the reader raises n from 1 to 8: the bound e/9! drops below 10⁻⁵ and rem-enough is ticked', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page);
    await raiseOrderTo(page, 8, 1);
    // B = e/9! ≈ 7.49·10⁻⁶
    await expect(readout(page, 'verdict')).toContainText('הסדר מספיק');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-6-2a:rem-enough']).toBeTruthy();
  });

  test('the Check has its five bank questions, and 6 is graded correct for Q-6.2-order-e', async ({ page }) => {
    await page.goto(LESSON);
    const ids = ['Q-6.2-formula', 'Q-6.2-c-depends', 'Q-6.2-ln-bound', 'Q-6.2-sign', 'Q-6.2-order-e'];
    for (const id of ids) await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    const card = page.locator('[data-qid="Q-6.2-order-e"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-numeric input').fill('6');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    await expect(page.locator('[id^="ex-6-2-"]')).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-6-2-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-6-2-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors the misconception remedies link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'remainder-picture',
      'lagrange-form',
      'remainder-order',
      'c-unknown',
      'why-it-works',
      'bound-recipe',
      'skip-zero',
      'remainder-sign',
      'choose-order',
      'remainder-physics',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
