import { expect, test, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/4-3/';
const FIGS = ['fig-4-3a', 'fig-4-3b', 'fig-4-3c'];
const TASKS = [
  'fig-4-3a:bases-below-one',
  'fig-4-3a:bases-e',
  'fig-4-3a:bases-log',
  'fig-4-3b:compound-far',
  'fig-4-3c:race-cross',
  'fig-4-3c:race-log',
  'fig-4-3c:race-ratio',
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

// ExpLab's readout (src/sims/ExpLab.tsx) is one block, `.ex-readout`, with a row per quantity:
//   bases:    "a = 2", whether aˣ increases ("עולה") or decreases ("יורד"; the a < 1 beside it is an LTR island with
//             no-break spaces, so it is not matched), a⁰ = 1, and with log also ln a
//   compound: the story, "(1 + 1/n)^n = <8 decimals>", the gap to e
//   race:     the cursor "x = …", both values, with ratio the quotient, and the last crossing on the window "x ≈ …"
// Numbers drop trailing zeros; negative numbers use U+2212.
const readout = (page: Page, fig: string) => page.locator(`#${fig} .ex-readout`);

test.describe('lesson 4.3: exponential, logarithm and powers', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('אקספוננט, לוגריתם וחזקות');
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

  test('each figure starts in its own state: a = 2, n = 1, x¹⁰ against eˣ on x ≤ 10', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page, 'fig-4-3a');
    await expect(readout(page, 'fig-4-3a')).toContainText('a = 2');
    await ready(page, 'fig-4-3b');
    // (1 + 1/1)¹ = 2
    await expect(readout(page, 'fig-4-3b')).toContainText('2.00000000');
    await ready(page, 'fig-4-3c');
    // on (0, 10] the only crossing of x¹⁰ and eˣ is near 1.1183 (sympy: 1.118326)
    await expect(readout(page, 'fig-4-3c')).toContainText('x = 10');
    await expect(readout(page, 'fig-4-3c')).toContainText('1.1183');
  });

  test('text steps drive the figures: base ⅓, monthly interest, and the crossing at 35.77', async ({ page }) => {
    await page.goto(LESSON);
    const bases = page.locator('#fig-4-3a');
    await bases.scrollIntoViewIfNeeded();
    await hydrated(bases.locator('canvas'));
    const baseSteps = page.locator('.step[data-fig="fig-4-3a"]');
    // 2 Explore steps, 3 in "the exponential function" (definition, base below one, bigger base), 1 in "log base a"
    await expect(baseSteps).toHaveCount(6);
    await baseSteps.nth(3).scrollIntoViewIfNeeded();
    await baseSteps.nth(3).click();
    await expect(readout(page, 'fig-4-3a')).toContainText('a = 0.333');
    await expect(readout(page, 'fig-4-3a')).toContainText('יורד');

    const comp = page.locator('#fig-4-3b');
    await comp.scrollIntoViewIfNeeded();
    await hydrated(comp.locator('canvas'));
    const compSteps = page.locator('.step[data-fig="fig-4-3b"]');
    await expect(compSteps).toHaveCount(2);
    await compSteps.nth(1).scrollIntoViewIfNeeded();
    await compSteps.nth(1).click();
    // (1 + 1/12)¹² = 2.61303529…
    await expect(readout(page, 'fig-4-3b')).toContainText('2.61303529');

    const race = page.locator('#fig-4-3c');
    await race.scrollIntoViewIfNeeded();
    await hydrated(race.locator('canvas'));
    const raceSteps = page.locator('.step[data-fig="fig-4-3c"]');
    await expect(raceSteps).toHaveCount(5);
    await raceSteps.nth(2).scrollIntoViewIfNeeded();
    await raceSteps.nth(2).click();
    // window x ≤ 50: the last crossing of x¹⁰ and eˣ is at 35.7715 (sympy: 35.771521)
    await expect(readout(page, 'fig-4-3c')).toContainText('x = 30');
    await expect(readout(page, 'fig-4-3c')).toContainText('35.7715');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-4-3"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the reader lowers a below 1 with the keyboard, and bases-below-one is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-3a');
    // from ln a = ln 2 ≈ 0.693: eight presses of shift + left, 0.1 each, bring ln a to about −0.11 (a ≈ 0.9)
    await fig.locator('canvas').focus();
    for (let k = 0; k < 8; k++) await page.keyboard.press('Shift+ArrowLeft');
    await expect(readout(page, 'fig-4-3a')).toContainText('יורד');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-4-3a:bases-below-one']).toBeTruthy();
  });

  test('the reader raises n past 1000 with the keyboard, and compound-far is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-3b');
    // each shift + right adds 0.5 to log10 n (rounded to a whole n): eight presses reach several thousand
    await fig.locator('canvas').focus();
    for (let k = 0; k < 8; k++) await page.keyboard.press('Shift+ArrowRight');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-4-3b:compound-far']).toBeTruthy();
  });

  test('the reader turns the logarithmic value axis on, and race-log is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-3c');
    await fig.getByRole('button', { name: /ציר ערכים לוגריתמי/ }).click();
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-4-3c:race-log']).toBeTruthy();
  });

  test('the Check has its five bank questions, and x³ is graded correct for Q-4.3-e-3lnx', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-4.3-half-power', 'Q-4.3-e-limit', 'Q-4.3-e-3lnx', 'Q-4.3-bases', 'Q-4.3-crossover']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-4.3-e-3lnx"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-expr input').fill('x^3');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-4-3-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-4-3-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-4-3-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors the misconception register links to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'exp-bases',
      'powers-reminder',
      'base-below-one',
      'compare-bases',
      'inverse',
      'log-base',
      'log-behaviour',
      'e-limit',
      'ln-def',
      'inverse-domain',
      'log-rules',
      'change-base',
      'solve-exp',
      'decay',
      'growth-race',
      'why-exp-wins',
      'faster-not-bigger',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
