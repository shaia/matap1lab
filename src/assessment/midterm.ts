/**
 * The midterm (מבחן אמצע): as in course 80114, one written test on chapters 1–8 (the syllabus: "a midterm
 * in week 9 on weeks 1–7"). Pure, no Astro imports: the page, the runner, lint and the unit tests share it.
 *
 * A paper is five exam questions of 25 points, one per block of chapters below; the student answers four
 * and the grade is the sum of the four best question scores (out of 100). Ids are Q-mid-<paper>-<k>, where
 * k is the block, so a paper is read off its ids and the questions of one block can be written in one file
 * (src/content/midterm/block-<k>.yaml) without touching another block's file.
 *
 * The real midterm's length and format are not known (no past 80114 midterm has been mapped); the timer's
 * default is a suggestion and the page says so.
 */

export interface MidtermBlock {
  k: number;
  chapters: number[];
  title: string;
}

export const MIDTERM_BLOCKS: readonly MidtermBlock[] = [
  { k: 1, chapters: [1, 2], title: 'וקטורים, קואורדינטות וצורות' },
  { k: 2, chapters: [3], title: 'מספרים מרוכבים' },
  { k: 3, chapters: [4, 5], title: 'פונקציות, גבולות ונגזרות' },
  { k: 4, chapters: [6], title: 'טורי טיילור' },
  { k: 5, chapters: [7, 8], title: 'אינטגרלים' },
];

/** how many of the five questions count */
export const MIDTERM_COUNTED = 4;
/** the timer's default, in minutes: a suggestion, not the real midterm's length */
export const MIDTERM_MINUTES = 180;
export const MIDTERM_LAST_CHAPTER = 8;

const ID = /^Q-mid-(\d+)-(\d+)$/;

/** "Q-mid-2-4" → { paper: 2, block: 4 } */
export function midtermPlace(id: string): { paper: number; block: number } | null {
  const m = id.match(ID);
  return m ? { paper: Number(m[1]), block: Number(m[2]) } : null;
}

export const isMidterm = (id: string): boolean => ID.test(id);

/** The Hebrew name of a paper: 1 → "א". */
export const paperLetter = (paper: number): string => 'אבגדהוזחט'[paper - 1] ?? String(paper);

/**
 * The grade: the sum of the MIDTERM_COUNTED best question scores, rounded to a tenth, and which
 * questions (by index) counted. Ties keep the earlier question.
 */
export function midtermGrade(scores: readonly number[]): { grade: number; counted: number[] } {
  const order = scores.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s || a.i - b.i);
  const counted = order
    .slice(0, MIDTERM_COUNTED)
    .map((x) => x.i)
    .sort((a, b) => a - b);
  const grade = counted.reduce((sum, i) => sum + scores[i], 0);
  return { grade: Math.round(grade * 10) / 10, counted };
}

/** Papers present in a list of question ids, each complete or not, in order. */
export function papersOf(ids: readonly string[]): { paper: number; blocks: number[] }[] {
  const by = new Map<number, number[]>();
  for (const id of ids) {
    const p = midtermPlace(id);
    if (!p) continue;
    by.set(p.paper, [...(by.get(p.paper) ?? []), p.block].sort((a, b) => a - b));
  }
  return [...by.entries()].sort(([a], [b]) => a - b).map(([paper, blocks]) => ({ paper, blocks }));
}
