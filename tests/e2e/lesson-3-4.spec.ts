import { expect, test, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/3-4/';
const FIGS = ['fig-3-4a', 'fig-3-4b', 'fig-3-4c'];
const TASKS = [
  'fig-3-4a:euler-pi',
  'fig-3-4a:euler-cos',
  'fig-3-4b:exp-copies',
  'fig-3-4b:exp-vertical',
  'fig-3-4b:exp-negative',
  'fig-3-4c:log-negative',
  'fig-3-4c:log-unit',
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

// ComplexMap's readout (src/sims/ComplexMap.tsx) is one block, `.cm-readout`, with a row per quantity:
//   euler: θ in degrees and as a π-multiple, e^(iθ), e^(−iθ), and with cosSin the half-sum and half-difference
//   exp:   z, e^z = e^x(cos y + i sin y), |w| and Arg w, w
//   log:   w with |w| and Arg w, Log w, and the values for k = −2…2
// Numbers have 3 decimals with trailing zeros dropped; negative numbers use U+2212.
const readout = (page: Page, fig: string) => page.locator(`#${fig} .cm-readout`);

test.describe('lesson 3.4: the complex exponential and logarithm', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('האקספוננט והלוגריתם המרוכבים');
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

  test('each figure starts in its own mode: θ = 60°, z = 0.5 + πi/3, w = 1 + i', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page, 'fig-3-4a');
    await expect(readout(page, 'fig-3-4a')).toContainText('60°');
    await expect(readout(page, 'fig-3-4a')).toContainText('π/3');
    await ready(page, 'fig-3-4b');
    // |e^z| = e^0.5 ≈ 1.649
    await expect(readout(page, 'fig-3-4b')).toContainText('1.649');
    await ready(page, 'fig-3-4c');
    // Log(1 + i) = ln √2 + iπ/4 ≈ 0.347 + 0.785i
    await expect(readout(page, 'fig-3-4c')).toContainText('0.347 + 0.785i');
  });

  test('text steps drive the figures: e^(iπ) = −1, the copies, and Log of a negative number', async ({ page }) => {
    await page.goto(LESSON);
    const euler = page.locator('#fig-3-4a');
    await euler.scrollIntoViewIfNeeded();
    await hydrated(euler.locator('canvas'));
    const eulerSteps = page.locator('.step[data-fig="fig-3-4a"]');
    // 2 Explore steps, 2 in "what we already know", 1 in "cos and sin through the exponential"
    await expect(eulerSteps).toHaveCount(5);
    await eulerSteps.nth(2).scrollIntoViewIfNeeded();
    await eulerSteps.nth(2).click();
    await expect(readout(page, 'fig-3-4a')).toContainText('180°');
    await expect(readout(page, 'fig-3-4a')).toContainText('−1 + 0i');

    const exp = page.locator('#fig-3-4b');
    await exp.scrollIntoViewIfNeeded();
    await hydrated(exp.locator('canvas'));
    const expSteps = page.locator('.step[data-fig="fig-3-4b"]');
    // 1 in the definition, 2 on lines, 2 on periodicity
    await expect(expSteps).toHaveCount(5);
    await expSteps.nth(4).scrollIntoViewIfNeeded();
    await expSteps.nth(4).click();
    await expect(readout(page, 'fig-3-4b')).toContainText('מחזוריות');

    const log = page.locator('#fig-3-4c');
    await log.scrollIntoViewIfNeeded();
    await hydrated(log.locator('canvas'));
    const logSteps = page.locator('.step[data-fig="fig-3-4c"]');
    await expect(logSteps).toHaveCount(4);
    // w = −1.5: Log w = ln 1.5 + iπ ≈ 0.405 + 3.142i
    await logSteps.nth(2).scrollIntoViewIfNeeded();
    await logSteps.nth(2).click();
    await expect(readout(page, 'fig-3-4c')).toContainText('0.405 + 3.142i');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-3-4"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the reader turns θ to 180° with the keyboard, and euler-pi is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-4a');
    // from 60°: eight presses of shift + arrow, 15° each
    await fig.locator('canvas').focus();
    for (let k = 0; k < 8; k++) await page.keyboard.press('Shift+ArrowRight');
    await expect(readout(page, 'fig-3-4a')).toContainText('180°');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-3-4a:euler-pi']).toBeTruthy();
  });

  test('the reader turns the copies on, and exp-copies is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-4b');
    await fig.getByRole('button', { name: /העתקים/ }).click();
    await expect(readout(page, 'fig-3-4b')).toContainText('מחזוריות');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-3-4b:exp-copies']).toBeTruthy();
  });

  test('the Check has its five bank questions, and −e is graded correct for Q-3.4-exp-value', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-3.4-exp-value', 'Q-3.4-exp-periodic', 'Q-3.4-log-principal', 'Q-3.4-log-rule', 'Q-3.4-cos-exp']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-3.4-exp-value"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-numeric input').fill('-2.71828');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-3-4-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-3-4-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-3-4-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors the misconception register links to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'euler-recap',
      'cos-sin-exp',
      'cos-sin-uses',
      'binomial-reminder',
      'ln-reminder',
      'exp-definition',
      'exp-modulus',
      'exp-lines',
      'exp-periodic',
      'cos-complex',
      'log-all',
      'log-recipe',
      'log-principal',
      'log-negative',
      'log-rules',
      'exp-physics',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
