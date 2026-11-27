import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/7-5/';
const FIGS = ['fig-7-5a', 'fig-7-5b'];
const TASKS = [
  'fig-7-5a:power-period',
  'fig-7-5a:power-split',
  'fig-7-5b:tri-drag',
  'fig-7-5b:tri-edge',
  'fig-7-5b:tri-kind',
  'fig-7-5b:half-drag',
  'fig-7-5b:half-pi',
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

// TrigSubLab's hooks (src/sims/TrigSubLab.tsx, header comment): one element per quantity, each with data-readout.
//   power:     fn, x, area, half
//   triangle:  fn, theta, trig, sides, root, dx; edge at x = ±a of the sin kind
//   halfangle: x, t, cos, sin, dxdt; note for |x| ≥ 3.0
// Mode buttons "הצבה טריגונומטרית", "טנגנס חצי הזווית"; toggle "פירוק לחלקים"; [data-control="x"] input (the slider of
// x, step 0.01); [data-control="preset"] select. Negative numbers use U+2212.
const readout = (page: Page, fig: string, id: string) => page.locator(`#${fig} [data-readout="${id}"]`);

/** Set a range input as a student would: the value, then an input event. */
const slide = (s: Locator, v: number) =>
  s.evaluate((el: HTMLInputElement, value) => {
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);

const task = async (page: Page, id: string) => ((await progress(page))?.tasks ?? {})[id];

test.describe('lesson 7.5: trigonometric integrals and substitutions', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('אינטגרלים טריגונומטריים');
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

  test('the figures start on sin²x and on the substitution x = a sin θ', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page, 'fig-7-5a');
    await expect(readout(page, 'fig-7-5a', 'fn')).toContainText('sin²x');
    await ready(page, 'fig-7-5b');
    await expect(readout(page, 'fig-7-5b', 'fn')).toContainText('x = a sin θ');
  });

  test('text steps drive the power figure: sin³x has no constant part', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-7-5a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator('.step[data-fig="fig-7-5a"]');
    // Explore 2 (sin2, sin3); even power 1 (sin2 split); odd power 1 (sin3 split); many forms 1 (sincos)
    await expect(steps).toHaveCount(5);

    await steps.nth(3).scrollIntoViewIfNeeded();
    await steps.nth(3).click();
    await expect(readout(page, 'fig-7-5a', 'fn')).toContainText('sin³x');
    await expect(readout(page, 'fig-7-5a', 'half')).toContainText('אין חלק קבוע');

    await steps.nth(4).scrollIntoViewIfNeeded();
    await steps.nth(4).click();
    await expect(readout(page, 'fig-7-5a', 'fn')).toContainText('sin x cos x');
  });

  test('text steps drive the substitution figure: x = 1/cos θ at x = 2 has θ = π/3, the half angle at x = 1 has t = tan ½', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-7-5b');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator('.step[data-fig="fig-7-5b"]');
    // trig substitution: sin (a = 2, x = 1), sec (a = 1, x = 2), tan (the wire); half angle: x = 1
    await expect(steps).toHaveCount(4);

    await steps.nth(0).scrollIntoViewIfNeeded();
    await steps.nth(0).click();
    await expect(readout(page, 'fig-7-5b', 'theta')).toContainText('0.5236');
    await expect(readout(page, 'fig-7-5b', 'root')).toContainText('1.732');

    await steps.nth(1).scrollIntoViewIfNeeded();
    await steps.nth(1).click();
    await expect(readout(page, 'fig-7-5b', 'fn')).toContainText('x = a/cos θ');
    await expect(readout(page, 'fig-7-5b', 'theta')).toContainText('1.047');

    await steps.nth(3).scrollIntoViewIfNeeded();
    await steps.nth(3).click();
    await expect(readout(page, 'fig-7-5b', 't')).toContainText('0.5463');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-7-5"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the reader moves x to π under sin²x: the area is π/2, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-7-5a');
    await slide(fig.locator('[data-control="x"] input'), 3.14);
    await expect(readout(page, 'fig-7-5a', 'area')).toContainText('1.571');
    await expect.poll(() => task(page, 'fig-7-5a:power-period')).toBeTruthy();
  });

  test('the reader drags x to a under x = a sin θ: θ = π/2 and the root vanishes, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-7-5b');
    await slide(fig.locator('[data-control="x"] input'), 2);
    await expect(readout(page, 'fig-7-5b', 'edge')).toBeVisible();
    await expect(readout(page, 'fig-7-5b', 'theta')).toContainText('1.571');
    await expect.poll(() => task(page, 'fig-7-5b:tri-edge')).toBeTruthy();
  });

  test('the reader takes the half angle near π: t grows without bound, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-7-5b');
    await fig.getByRole('button', { name: 'טנגנס חצי הזווית', exact: true }).click();
    await slide(fig.locator('[data-control="x"] input'), 3.05);
    await expect(readout(page, 'fig-7-5b', 'note')).toBeVisible();
    await expect.poll(() => task(page, 'fig-7-5b:half-pi')).toBeTruthy();
  });

  test('the Check has its five bank questions, and π/4 is graded correct for Q-7.5-cos2-definite', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-7.5-cos2-definite', 'Q-7.5-which-route', 'Q-7.5-three-answers', 'Q-7.5-trig-sub-choose', 'Q-7.5-weier-int']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-7.5-cos2-definite"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-numeric input').fill('0.7854');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-7-5-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-7-5-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-7-5-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors the misconception remedies link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'even-power',
      'identities-reminder',
      'double-angle',
      'power-rule-trap',
      'rms',
      'odd-power',
      'which-way',
      'many-forms',
      'trig-sub',
      'trig-sub-radius',
      'circle-area',
      'which-identity',
      'wire-field',
      'weierstrass',
      'weier-dx',
      'weier-domain',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
