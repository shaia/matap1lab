import { expect, test, type Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { midtermGrade, midtermPlace } from '../../src/assessment/midterm';
import { hydrated } from './helpers';

/**
 * The midterm (מבחן אמצע, chapters 1–8): a paper of five exam questions, the four best counted. The keys are
 * read from the YAML, so the test answers the formula and number parts right and checks the grade the page
 * computes against midtermGrade.
 */

interface Part {
  label: string;
  type: string;
  points: number;
  answer?: number | string;
}
interface Q {
  id: string;
  parts: Part[];
}

const DIR = join(import.meta.dirname, '../../src/content/midterm');
const all: Q[] = readdirSync(DIR)
  .filter((f) => f.endsWith('.yaml'))
  .flatMap((f) => parse(readFileSync(join(DIR, f), 'utf8')) as Q[]);
const paper = (n: number) =>
  all.filter((q) => midtermPlace(q.id)?.paper === n).sort((a, b) => midtermPlace(a.id)!.block - midtermPlace(b.id)!.block);
const typed = (p: Part) => p.type === 'numeric' || p.type === 'expr';
const PATH = '/test/midterm/';

const begin = async (page: Page, n: number) => {
  await page.goto(`${PATH}?paper=${n}`);
  const startBtn = page.getByRole('button', { name: 'התחלת המבחן' });
  await hydrated(startBtn);
  await expect(page.getByRole('radio', { name: `גרסה ${'אבג'[n - 1]}` })).toBeChecked();
  await startBtn.click();
  await expect(page.locator('[data-phase="running"]')).toBeVisible();
};

test.describe(PATH, () => {
  test('every paper has five questions, each with an answer box and a full-solution part', () => {
    for (const n of [1, 2, 3]) {
      const qs = paper(n);
      expect(qs.map((q) => midtermPlace(q.id)!.block), `paper ${n}`).toEqual([1, 2, 3, 4, 5]);
      for (const q of qs) {
        expect(q.parts.some((p) => p.type === 'open'), q.id).toBe(true);
        expect(q.parts.some((p) => p.type !== 'open'), q.id).toBe(true);
      }
    }
  });

  test('the intro offers every paper, with the clock on by default', async ({ page }) => {
    await page.goto(PATH);
    await hydrated(page.getByRole('button', { name: 'התחלת המבחן' }));
    await expect(page.getByRole('radio')).toHaveCount(3);
    await expect(page.getByRole('checkbox', { name: 'מבחן עם שעון' })).toBeChecked();
    await expect(page.getByRole('spinbutton')).toHaveValue('180');
  });

  test('a blank paper scores 0 and opens every model solution for self-checking', async ({ page }) => {
    await begin(page, 2);
    await expect(page.getByRole('timer')).toBeVisible();
    await expect(page.locator('[data-phase="running"] article.mid-q')).toHaveCount(5);
    await page.getByRole('button', { name: 'הגשת המבחן' }).first().click();
    await expect(page.locator('[data-phase="grading"]')).toBeVisible();
    await expect(page.getByTestId('grade')).toHaveText('0/100');
    await expect(page.getByTestId('q-score')).toHaveCount(5);
    const opens = paper(2).flatMap((q) => q.parts.filter((p) => p.type === 'open')).length;
    await expect(page.locator('.open-model')).toHaveCount(opens);
  });

  test('right answers and a full self-check give the grade of the four best questions', async ({ page }) => {
    // a whole paper answered and self-checked: ~40 actions on a page of several thousand math nodes, each traced;
    // ~40 s here, and the CI runner is ~2.5x slower
    test.setTimeout(150_000);
    const qs = paper(1);
    await begin(page, 1);
    for (const q of qs) {
      for (const p of q.parts.filter(typed)) {
        await page.locator(`[data-phase="running"] .qcard[data-qid="${q.id}/${p.label}"] input`).fill(String(p.answer));
      }
    }
    await page.getByRole('button', { name: 'הגשת המבחן' }).last().click();
    await expect(page.locator('[data-phase="grading"]')).toBeVisible();

    for (const q of qs) {
      for (const p of q.parts.filter(typed)) {
        await expect(page.locator(`.qcard[data-qid="${q.id}/${p.label}"] .q-verdict`), `${q.id}/${p.label}`).toHaveText(/^נכון/);
      }
    }
    const autoScores = qs.map((q) => q.parts.filter(typed).reduce((s, p) => s + p.points, 0));
    await expect(page.getByTestId('grade')).toHaveText(`${midtermGrade(autoScores).grade}/100`);

    // self-check every open part with every rubric line ticked: full points
    for (const q of qs) {
      for (const p of q.parts.filter((x) => x.type === 'open')) {
        const card = page.locator(`.open-part[data-qid="${q.id}/${p.label}"]`);
        // tick the whole rubric in one action (each traced action snapshots the heavy page)
        await card.locator('.open-rubric input[type="checkbox"]').evaluateAll((boxes) => boxes.forEach((b) => (b as HTMLInputElement).click()));
        await card.getByRole('button', { name: 'סיימתי את הבדיקה' }).click();
        await expect(card.locator('.q-verdict')).toContainText(`${p.points} מתוך ${p.points}`);
      }
    }
    const full = qs.map((q) => q.parts.reduce((s, p) => s + (typed(p) || p.type === 'open' ? p.points : 0), 0));
    await expect(page.getByTestId('grade')).toHaveText(`${midtermGrade(full).grade}/100`);
  });

  test('fits a phone without sideways scroll while the test runs', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await begin(page, 3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test('the contents page and chapter 8 link to it', async ({ page }) => {
    for (const from of ['/', '/practice/ch8/', '/summary/ch8/']) {
      await page.goto(from);
      await expect(page.locator('a[href$="/test/midterm/"]'), from).toHaveCount(1);
    }
  });
});
