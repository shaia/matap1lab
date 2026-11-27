import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/9-4/';
const FIG = 'fig-9-4a';
const TASKS = [`${FIG}:fr-split`, `${FIG}:fr-spin`, `${FIG}:fr-top`];

/** Bring the figure into view, wait for its island, stop text steps from driving it, and reset it. */
async function ready(page: Page) {
  const f = page.locator(`#${FIG}`);
  await f.scrollIntoViewIfNeeded();
  await hydrated(f.locator('canvas').first());
  await freezeSteps(page);
  await f.getByRole('button', { name: 'איפוס' }).click();
  return f;
}

// VelocityLab's hooks (src/sims/VelocityLab.tsx, header comment), mode 'frame':
//   buttons by name: "פירוק התאוצה" (split), "המעגל הצמוד" (circle), "הפעלה" / "עצירה" (play), "איפוס"
//   [data-control="preset"] select (the curve, option values are the VC ids); [data-control="t"] input
//   [data-readout=…]: fn, scale (with split), t, speed, notangent (only at v = 0), at, an, kappa, rho
// Numbers have 3 significant figures and use U+2212 for minus.
const readout = (page: Page, id: string) => page.locator(`#${FIG} [data-readout="${id}"]`);
const done = async (page: Page, task: string) => ((await progress(page))?.tasks ?? {})[task];

/** Set a range input as a student would: the value, then an input event. */
const slide = (s: Locator, v: number) =>
  s.evaluate((el: HTMLInputElement, value) => {
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);

test.describe('lesson 9.4: tangential and normal acceleration (enrichment)', () => {
  test('the page loads with its title, the enrichment mark and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('תאוצה משיקית ונורמלית');
    await expect(page.locator('.chip', { hasText: 'העשרה' }).first()).toBeVisible();
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

  test('the figure starts on the parabola at t = 1/2: |v| = a_T = a_N = √2, κ = 1/√2', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page);
    await expect(readout(page, 'speed')).toContainText('1.41');
    await expect(readout(page, 'at')).toContainText('1.41');
    await expect(readout(page, 'an')).toContainText('1.41');
    await expect(readout(page, 'kappa')).toContainText('0.707');
    await expect(readout(page, 'notangent')).toHaveCount(0);
  });

  test('text steps drive the figure: the cusp, the throw, the speeding circle and the top of the throw', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator(`#${FIG}`);
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator(`.step[data-fig="${FIG}"]`);
    // Explore: parab 0.5; spin 1 split; throw 0.3 circle. T: ellipse 1; cusp 0. N: ellipse 4. Split: parab 0.5 split.
    // Signs: throw 0.3 split; throw 1.3 split. Speeding circle: spin 1 split; spin 2 split. Curvature: ellipse 0.3
    // circle; ellipse 1.2 circle. Osculating: throw 0.8 circle.
    await expect(steps).toHaveCount(14);

    const go = async (n: number) => {
      await steps.nth(n).scrollIntoViewIfNeeded();
      await steps.nth(n).click();
    };

    // the cusp of (t², t³) at t = 0: v = 0, no tangent
    await go(4);
    await expect(readout(page, 'notangent')).toBeVisible();

    // the throw on the way up, t = 0.3: a_T = −50/√61 ≈ −6.40, a_N = 60/√61 ≈ 7.68
    await go(7);
    await expect(readout(page, 'at')).toContainText('−6.4');
    await expect(readout(page, 'an')).toContainText('7.68');

    // the circle that speeds up, t = 2: a_T = 2, a_N = 2t² = 8
    await go(10);
    await expect(readout(page, 'at')).toContainText(/=\s*2\s*$/);
    await expect(readout(page, 'an')).toContainText(/=\s*8\s*$/);

    // the top of the throw, t = 0.8: a_T = 0, a_N = 10, ρ = 36/10
    await go(13);
    await expect(readout(page, 'at')).toContainText(/=\s*0\s*$/);
    await expect(readout(page, 'an')).toContainText('10');
    await expect(readout(page, 'rho')).toContainText('3.6');
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

  test('the reader turns the split on and moves t on the parabola: the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page);
    await fig.getByRole('button', { name: 'פירוק התאוצה', exact: true }).click();
    await slide(fig.locator('[data-control="t"] input'), 1.2);
    // at t = 1.2: |v| = √6.76 = 2.6, a_T = 4.8/2.6 ≈ 1.85, a_N = 2/2.6 ≈ 0.769
    await expect(readout(page, 'at')).toContainText('1.85');
    await expect(readout(page, 'an')).toContainText('0.769');
    await expect.poll(() => done(page, `${FIG}:fr-split`)).toBeTruthy();
  });

  test('the reader moves t by more than 1 on the speeding circle: a_T stays 2, a_N grows, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page);
    await fig.locator('[data-control="preset"] select').selectOption('spin');
    await fig.getByRole('button', { name: 'פירוק התאוצה', exact: true }).click();
    await slide(fig.locator('[data-control="t"] input'), 2.6);
    // a_T = 2, a_N = 2t² = 13.52
    await expect(readout(page, 'at')).toContainText(/=\s*2\s*$/);
    await expect(readout(page, 'an')).toContainText('13.5');
    await expect.poll(() => done(page, `${FIG}:fr-spin`)).toBeTruthy();
  });

  test('the reader brings the throw to its top with the osculating circle on: ρ = 3.6, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page);
    await fig.locator('[data-control="preset"] select').selectOption('throw');
    await fig.getByRole('button', { name: 'המעגל הצמוד', exact: true }).click();
    await slide(fig.locator('[data-control="t"] input'), 0.8);
    await expect(readout(page, 'rho')).toContainText('3.6');
    await expect.poll(() => done(page, `${FIG}:fr-top`)).toBeTruthy();
  });

  test('the Check has its five bank questions, and 1/4 is graded correct for Q-9.4-circle-curvature', async ({ page }) => {
    await page.goto(LESSON);
    const ids = ['Q-9.4-unit-tangent', 'Q-9.4-circle-curvature', 'Q-9.4-normal-component', 'Q-9.4-tangential-sign', 'Q-9.4-osculating'];
    for (const id of ids) await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    const card = page.locator('[data-qid="Q-9.4-circle-curvature"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-numeric input').fill('1/4');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    await expect(page.locator('[id^="ex-9-4-"]')).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-9-4-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-9-4-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors the misconception remedies link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'unit-tangent',
      'unit-normal',
      'split',
      'recipe-split',
      'two-jobs',
      'signs',
      'speeding-circle',
      'curvature',
      'graph-curvature',
      'osculating',
      'helix-curvature',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
