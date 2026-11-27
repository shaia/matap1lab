import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/8-2/';
const SUB = 'fig-8-2a'; // MethodLab, subst
const SYM = 'fig-8-2b'; // DefIntLab, symmetry
const UPP = 'fig-8-2c'; // DefIntLab, upper
const TASKS = [
  `${SUB}:subst-move`,
  `${SYM}:sym-mirror`,
  `${SYM}:sym-width`,
  `${SYM}:sym-parts`,
  `${UPP}:up-move`,
  `${UPP}:up-strip`,
  `${UPP}:up-const`,
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

// MethodLab's hooks (src/sims/MethodLab.tsx, header comment), subst mode: readouts fn, formula, a, x, u, xarea, uarea,
// equal; [data-control="x"] input; button "איפוס".
// DefIntLab's hooks (src/sims/DefIntLab.tsx, header comment): symmetry readouts fn, a, left, right, total, kind, mirror
// (with mirror), parts (with parts); toggles "שיקוף החצי השמאלי", "החלק הזוגי והאי-זוגי"; [data-control="a"] input.
// upper readouts fn, x, limits, G, gprime, strip (with strip); toggle "פס צר"; [data-control="x"] input,
// [data-control="dx"] input (log10 dx); [data-control="preset"] select. Negative numbers use U+2212.
const readout = (page: Page, fig: string, id: string) => page.locator(`#${fig} [data-readout="${id}"]`);
const taskDone = async (page: Page, t: string) => ((await progress(page))?.tasks ?? {})[t];

/** Set a range input as a student would: the value, then an input event. */
const slide = (s: Locator, v: number) =>
  s.evaluate((el: HTMLInputElement, value) => {
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);

test.describe('lesson 8.2: substitution in a definite integral, symmetry, a variable upper limit', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('החלפת משתנה באינטגרל מסוים');
    await expect(page.locator('.katex-error')).toHaveCount(0);
  });

  test('the three figures hydrate and draw, in LTR math space', async ({ page }) => {
    await page.goto(LESSON);
    for (const fig of [SUB, SYM, UPP]) {
      const c = page.locator(`#${fig} canvas`).first();
      await c.scrollIntoViewIfNeeded();
      await hydrated(c);
      await expect(c).toHaveCSS('direction', 'ltr');
      await expect.poll(() => inked(c)).toBeGreaterThan(200);
    }
  });

  test('substitution: the reader moves x to 2, the new upper limit is u = 4 and both areas are sin 4 ≈ −0.7568', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, SUB);
    await expect(readout(page, SUB, 'fn')).toContainText('2x·cos(x²)');
    await slide(fig.locator('[data-control="x"] input'), 2);
    await expect(readout(page, SUB, 'u')).toContainText('4');
    await expect(readout(page, SUB, 'xarea')).toContainText('−0.7568');
    await expect(readout(page, SUB, 'uarea')).toContainText('−0.7568');
    await expect.poll(() => taskDone(page, `${SUB}:subst-move`)).toBeTruthy();
  });

  test('symmetry: x³ − 2x on [−1, 1] has halves 0.75 and −0.75; the reader turns the mirror on and widens a, and the total stays 0', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, SYM);
    await expect(readout(page, SYM, 'left')).toContainText('0.75');
    await expect(readout(page, SYM, 'right')).toContainText('−0.75');
    await expect(readout(page, SYM, 'total')).toContainText('0');
    await expect(readout(page, SYM, 'kind')).toContainText('החלקים מתבטלים');
    await fig.getByRole('button', { name: 'שיקוף החצי השמאלי' }).click();
    await expect(readout(page, SYM, 'mirror')).toBeVisible();
    await expect.poll(() => taskDone(page, `${SYM}:sym-mirror`)).toBeTruthy();
    // ∫ from 0 to 1.5 of (x³ − 2x) = 1.5⁴/4 − 1.5² = −63/64 = −0.984375
    await slide(fig.locator('[data-control="a"] input'), 1.5);
    await expect(readout(page, SYM, 'right')).toContainText('−0.9844');
    await expect(readout(page, SYM, 'total')).toContainText('0');
    await expect.poll(() => taskDone(page, `${SYM}:sym-width`)).toBeTruthy();
  });

  test('variable limit: the reader picks ∫ from x to 2x of dt/t and moves x, G stays ln 2 ≈ 0.6931 with G′ = 0', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, UPP);
    await fig.locator('[data-control="preset"] select').selectOption('recip-2x');
    await expect(readout(page, UPP, 'G')).toContainText('0.6931');
    await slide(fig.locator('[data-control="x"] input'), 2);
    await expect(readout(page, UPP, 'G')).toContainText('0.6931');
    await expect(readout(page, UPP, 'gprime')).toContainText('= 0');
    await expect.poll(() => taskDone(page, `${UPP}:up-const`)).toBeTruthy();
    await expect.poll(() => taskDone(page, `${UPP}:up-move`)).toBeTruthy();
  });

  test('text steps drive the figures: sin 4 at x = 2, the counterexample 3x² − 1, and the constant ln 2', async ({ page }) => {
    await page.goto(LESSON);
    for (const fig of [SUB, SYM, UPP]) {
      const c = page.locator(`#${fig} canvas`).first();
      await c.scrollIntoViewIfNeeded();
      await hydrated(c);
    }
    const subSteps = page.locator(`.step[data-fig="${SUB}"]`);
    const symSteps = page.locator(`.step[data-fig="${SYM}"]`);
    const upSteps = page.locator(`.step[data-fig="${UPP}"]`);
    // SUB: explore 2 (xcosx2, sqrt), idea 1 (x = 2). SYM: cubic, quart, zero, exp. UPP: cos-x, cos-x strip, gauss-x,
    // cos-x2, recip-2x.
    await expect(subSteps).toHaveCount(3);
    await expect(symSteps).toHaveCount(4);
    await expect(upSteps).toHaveCount(5);

    await subSteps.nth(2).scrollIntoViewIfNeeded();
    await subSteps.nth(2).click();
    await expect(readout(page, SUB, 'uarea')).toContainText('−0.7568');

    await symSteps.nth(2).scrollIntoViewIfNeeded();
    await symSteps.nth(2).click();
    await expect(readout(page, SYM, 'fn')).toContainText('3x²');
    await expect(readout(page, SYM, 'total')).toContainText('0');
    await expect(readout(page, SYM, 'kind')).toContainText('זוגית');

    await upSteps.nth(4).scrollIntoViewIfNeeded();
    await upSteps.nth(4).click();
    await expect(readout(page, UPP, 'G')).toContainText('0.6931');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const fig of [SUB, SYM, UPP]) {
      for (const step of await page.locator(`.step[data-fig="${fig}"]`).all()) {
        await step.scrollIntoViewIfNeeded();
        await page.waitForTimeout(120);
      }
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the Check has its five bank questions, and 2x·e^(−x⁴) is graded correct for Q-8.2-ftc-chain', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-8.2-new-limits', 'Q-8.2-sub-sign', 'Q-8.2-odd', 'Q-8.2-ftc-constant-lower', 'Q-8.2-ftc-chain']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-8.2-ftc-chain"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-expr input').fill('2x*e^(-x^4)');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-8-2-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-8-2-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-8-2-1"] details.solution');
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
      'recipe',
      'new-limits',
      'du-factor',
      'decreasing',
      'subst-physics',
      'symmetry',
      'even-double',
      'odd-conditions',
      'converse',
      'even-odd-parts',
      'upper',
      'lower-constant',
      'chain',
      'two-limits',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
