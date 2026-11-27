import { expect, test, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/4-4/';
const FIGS = ['fig-4-4a', 'fig-4-4b', 'fig-4-4c'];
const TASKS = [
  'fig-4-4a:trig-second',
  'fig-4-4a:trig-period',
  'fig-4-4a:trig-tan-undef',
  'fig-4-4b:wave-period',
  'fig-4-4b:wave-shift',
  'fig-4-4b:wave-flip',
  'fig-4-4c:arc-negative',
  'fig-4-4c:arc-cos-obtuse',
  'fig-4-4c:arc-edge',
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

// CircleLab's readout (src/sims/CircleLab.tsx): rows .cl-row with the value in .cl-math (LTR), negatives with U+2212.
//   trig: "θ = 60° = π/3 rad", "(cos θ, sin θ) = (…)", "tan θ = …"
//   wave: "|A| = 1", "2π/ω = 2π", "−φ/ω = 0"
//   arc:  "arcsin 0.5 = π/6 rad = 30°", the range, and the list of angles in (−180°, 180°]
const readout = (page: Page, fig: string) => page.locator(`#${fig} .cl-readout`);

test.describe('lesson 4.4: trigonometric functions and their inverses', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('פונקציות טריגונומטריות והפוכותיהן');
    await expect(page.locator('.katex-error')).toHaveCount(0);
  });

  test('the three figures hydrate and draw, in LTR math space', async ({ page }) => {
    await page.goto(LESSON);
    for (const fig of FIGS) {
      const c = page.locator(`#${fig} canvas`).first();
      await c.scrollIntoViewIfNeeded();
      await hydrated(c);
      await expect(c).toHaveCSS('direction', 'ltr');
      await expect.poll(() => inked(c)).toBeGreaterThan(200);
    }
  });

  test('each figure starts in its own state: θ = 60°, the plain sine wave, arcsin 0.5 = 30°', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page, 'fig-4-4a');
    await expect(readout(page, 'fig-4-4a')).toContainText('θ = 60°');
    await ready(page, 'fig-4-4b');
    await expect(readout(page, 'fig-4-4b')).toContainText('2π/ω = 2π');
    await ready(page, 'fig-4-4c');
    await expect(readout(page, 'fig-4-4c')).toContainText('π/6');
    await expect(readout(page, 'fig-4-4c')).toContainText('30°');
  });

  test('text steps drive the figures: tan at 80°, the shift −π/4 of sin(2x + π/2), arccos(−√2/2) = 3π/4', async ({ page }) => {
    await page.goto(LESSON);

    const trig = page.locator('#fig-4-4a');
    await trig.scrollIntoViewIfNeeded();
    await hydrated(trig.locator('canvas').first());
    const trigSteps = page.locator('.step[data-fig="fig-4-4a"]');
    // 3 Explore steps and 1 in "the graph of tan"
    await expect(trigSteps).toHaveCount(4);
    await trigSteps.nth(3).scrollIntoViewIfNeeded();
    await trigSteps.nth(3).click();
    await expect(readout(page, 'fig-4-4a')).toContainText('θ = 80°');

    const wave = page.locator('#fig-4-4b');
    await wave.scrollIntoViewIfNeeded();
    await hydrated(wave.locator('canvas').first());
    const waveSteps = page.locator('.step[data-fig="fig-4-4b"]');
    // amplitude, period, phase shift
    await expect(waveSteps).toHaveCount(3);
    await waveSteps.nth(2).scrollIntoViewIfNeeded();
    await waveSteps.nth(2).click();
    await expect(readout(page, 'fig-4-4b')).toContainText('−π/4');

    const arc = page.locator('#fig-4-4c');
    await arc.scrollIntoViewIfNeeded();
    await hydrated(arc.locator('canvas').first());
    const arcSteps = page.locator('.step[data-fig="fig-4-4c"]');
    // why restrict, arccos, arctan, and two in "computing values"
    await expect(arcSteps).toHaveCount(5);
    await arcSteps.nth(3).scrollIntoViewIfNeeded();
    await arcSteps.nth(3).click();
    await expect(readout(page, 'fig-4-4c')).toContainText('3π/4');
    await expect(readout(page, 'fig-4-4c')).toContainText('135°');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-4-4"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the reader moves v below 0 with arcsin: the principal angle is negative and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-4c');
    await fig.locator('input[type="range"]').first().fill('-0.5');
    // arcsin(−0.5) = −π/6 = −30°
    await expect(readout(page, 'fig-4-4c')).toContainText('−30°');
    await expect.poll(async () => ((await progress(page))?.tasks ?? {})['fig-4-4c:arc-negative']).toBeTruthy();
  });

  test('the Check has its five bank questions, and π/4 is graded correct for arcsin(sin 3π/4)', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-4.4-period-3sin2x', 'Q-4.4-phase-shift', 'Q-4.4-arcsin-def', 'Q-4.4-why-restrict', 'Q-4.4-arcsin-sin-value']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-4.4-arcsin-sin-value"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-numeric input').fill('π/4');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-4-4-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-4-4-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-4-4-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors other pages link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'trig-graphs',
      'trig-reminder',
      'tan-graph',
      'wave',
      'amplitude',
      'period',
      'phase-shift',
      'oscillations',
      'why-restrict',
      'inverse-trig',
      'arcsin',
      'arccos',
      'arccos-negative',
      'arctan',
      'arc-values',
      'arc-compositions',
      'arcsin-sin',
      'cos-arcsin',
      'triangle-method',
      'arctan-sum',
      'inverse-physics',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
