import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/8-5/';
const BT = 'fig-8-5a'; // SolidLab, between
const SV = 'fig-8-5b'; // SolidLab, disk (with the shell mode button)
const FIGS = [BT, SV];
const TASKS = [
  `${BT}:bt-strip`,
  `${BT}:bt-cross`,
  `${BT}:bt-dy`,
  `${SV}:dk-slide`,
  `${SV}:dk-washer`,
  `${SV}:sh-slide`,
  `${SV}:sh-unroll`,
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

// SolidLab's hooks (src/sims/SolidLab.tsx, header comment): mode buttons "שטח בין גרפים", "שיטת הדיסקות",
// "שיטת הקליפות הגליליות"; toggles "הצגת השטח", "פסים אופקיים" (yint only), "הצגת הנפח כולו", "פריסת הקליפה"; "איפוס".
// [data-control="preset"] select (the presets of the current mode), [data-control="x"] input (strip / slice / shell).
// Readouts: between fn, cuts, strip, area (with showArea); disk fn, x, radii, slice, partial, volume (with showVolume);
// shell fn, x, height, slice, partial, slab (with unroll), volume (with showVolume). Negative numbers use U+2212.
const readout = (page: Page, fig: string, id: string) => page.locator(`#${fig} [data-readout="${id}"]`);
const taskDone = async (page: Page, t: string) => ((await progress(page))?.tasks ?? {})[t];

/** Set a range input as a student would: the value, then an input event. */
const slide = (s: Locator, v: number) =>
  s.evaluate((el: HTMLInputElement, value) => {
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);

test.describe('lesson 8.5: areas between graphs and volumes of solids of revolution', () => {
  test('the page loads with its title and no KaTeX error', async ({ page }) => {
    const res = await page.goto(LESSON);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('שטחים ונפחי גופי סיבוב');
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

  test('the figures start with the area and the whole volume hidden', async ({ page }) => {
    await page.goto(LESSON);
    await ready(page, BT);
    await expect(readout(page, BT, 'cuts')).toContainText('−2');
    await expect(readout(page, BT, 'area')).toHaveCount(0);
    await ready(page, SV);
    await expect(readout(page, SV, 'fn')).toContainText('ציר');
    await expect(readout(page, SV, 'volume')).toHaveCount(0);
  });

  test('text steps drive the area figure: 9/2 between the parabola and the line, 4 + 4 = 8 when the graphs cross', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator(`#${BT}`);
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator(`.step[data-fig="${BT}"]`);
    // Explore parab, cross; area-between parab (area on); crossing cross (area on); area-dy yint
    await expect(steps).toHaveCount(5);

    await steps.nth(2).scrollIntoViewIfNeeded();
    await steps.nth(2).click();
    await expect(readout(page, BT, 'area')).toContainText('9/2');

    await steps.nth(3).scrollIntoViewIfNeeded();
    await steps.nth(3).click();
    await expect(readout(page, BT, 'area')).toContainText('4 + 4 = 8');

    // the horizontal strips of yint: the area stays hidden there
    await steps.nth(4).scrollIntoViewIfNeeded();
    await steps.nth(4).click();
    await expect(readout(page, BT, 'strip')).toContainText('y =');
    await expect(readout(page, BT, 'area')).toHaveCount(0);
  });

  test('text steps drive the solid figure: the sphere 32π/3, the washer about y = −1 11π/6, the cone on its base 2π/3', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator(`#${SV}`);
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator(`.step[data-fig="${SV}"]`);
    // disks cone; sphere; washers washer; axis-line offaxis; disks-y bowl (the solid about the y-axis); shells bowl;
    // cone-y; sinshell
    await expect(steps).toHaveCount(8);

    await steps.nth(1).scrollIntoViewIfNeeded();
    await steps.nth(1).click();
    await expect(readout(page, SV, 'volume')).toContainText('32π/3');

    await steps.nth(3).scrollIntoViewIfNeeded();
    await steps.nth(3).click();
    await expect(readout(page, SV, 'volume')).toContainText('11π/6');
    await expect(readout(page, SV, 'radii')).toContainText('טבעת');

    // the solid about the y-axis, before shells are taught: shell mode, the whole volume hidden
    await steps.nth(4).scrollIntoViewIfNeeded();
    await steps.nth(4).click();
    await expect(readout(page, SV, 'height')).toBeVisible();
    await expect(readout(page, SV, 'volume')).toHaveCount(0);

    await steps.nth(6).scrollIntoViewIfNeeded();
    await steps.nth(6).click();
    await expect(readout(page, SV, 'height')).toBeVisible();
    await expect(readout(page, SV, 'volume')).toContainText('2π/3');

    await steps.nth(7).scrollIntoViewIfNeeded();
    await steps.nth(7).click();
    await expect(readout(page, SV, 'volume')).toContainText('2π²');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-8-5"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of TASKS) expect(tasks[t]).toBeFalsy();
  });

  test('the reader picks x³ and 4x and moves the strip across 0: the top curve changes, and the task is ticked', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, BT);
    await fig.locator('[data-control="preset"] select').selectOption('cross');
    await expect(readout(page, BT, 'strip')).toContainText('למעלה f');
    await slide(fig.locator('[data-control="x"] input'), 1);
    await expect(readout(page, BT, 'strip')).toContainText('למעלה g');
    await expect.poll(() => taskDone(page, `${BT}:bt-cross`)).toBeTruthy();
  });

  test('the reader picks the washer and slides to x = 0.6: r > 0, and the task is ticked; then unrolls a shell', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, SV);
    await fig.locator('[data-control="preset"] select').selectOption('washer');
    await slide(fig.locator('[data-control="x"] input'), 0.6);
    await expect(readout(page, SV, 'radii')).toContainText('טבעת');
    await expect(readout(page, SV, 'radii')).toContainText('0.36');
    await expect.poll(() => taskDone(page, `${SV}:dk-washer`)).toBeTruthy();

    await fig.getByRole('button', { name: 'שיטת הקליפות הגליליות', exact: true }).click();
    await expect(readout(page, SV, 'height')).toBeVisible();
    await fig.getByRole('button', { name: 'פריסת הקליפה', exact: true }).click();
    await expect(readout(page, SV, 'slab')).toBeVisible();
    await expect.poll(() => taskDone(page, `${SV}:sh-unroll`)).toBeTruthy();
  });

  test('the Check has its five bank questions, and 8π is graded correct for Q-8.5-disc-basic', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-8.5-area-basic', 'Q-8.5-disc-basic', 'Q-8.5-washer', 'Q-8.5-shell-basic', 'Q-8.5-shell-radius-tf']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const card = page.locator('[data-qid="Q-8.5-disc-basic"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    await card.locator('.q-numeric input').fill('8π');
    await card.getByRole('button', { name: /בדיקה/ }).first().click();
    await expect(card).toHaveClass(/is-right/);
    await expect(card.locator('.q-feedback.ok')).toBeVisible();
  });

  test('the six worked examples are there, with solutions closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    const examples = page.locator('[id^="ex-8-5-"]');
    await expect(examples).toHaveCount(6);
    for (let n = 1; n <= 6; n++) {
      const solution = page.locator(`[id="ex-8-5-${n}"] details.solution`);
      await expect(solution).toHaveCount(1);
      await expect(solution).not.toHaveAttribute('open', '');
    }
    const first = page.locator('[id="ex-8-5-1"] details.solution');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('.solution-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.solution-body')).toBeVisible();
  });

  test('the anchors the misconception remedies link to exist, and both videos are listed', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'area-between',
      'top-minus-bottom',
      'area-crossing',
      'area-dy',
      'slices',
      'disks',
      'washers',
      'axis-line',
      'disks-y',
      'shells',
      'shell-radius',
      'choose-method',
      'infinite-volume',
    ];
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.watch')).toHaveCount(2);
  });
});
