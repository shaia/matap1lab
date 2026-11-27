import { describe, expect, it } from 'vitest';
import { MIDTERM_BLOCKS, MIDTERM_COUNTED, midtermGrade, midtermPlace, papersOf, paperLetter } from '~/assessment/midterm';
import { allObjectives } from '~/course';

describe('midterm ids', () => {
  it('reads the paper and the block off an id, and nothing off another id', () => {
    expect(midtermPlace('Q-mid-2-4')).toEqual({ paper: 2, block: 4 });
    expect(midtermPlace('Q-8-exam-1')).toBeNull();
    expect(midtermPlace('Q-mid-2-4/א')).toBeNull();
  });

  it('names papers by Hebrew letters', () => {
    expect([1, 2, 3].map(paperLetter)).toEqual(['א', 'ב', 'ג']);
  });

  it('groups ids into papers with their blocks in order', () => {
    expect(papersOf(['Q-mid-2-3', 'Q-mid-1-5', 'Q-mid-1-1', 'Q-1-exam-1'])).toEqual([
      { paper: 1, blocks: [1, 5] },
      { paper: 2, blocks: [3] },
    ]);
  });
});

describe('the blocks cover the midterm material exactly', () => {
  it('chapters 1–8, each in one block, in order', () => {
    expect(MIDTERM_BLOCKS.flatMap((b) => b.chapters)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(MIDTERM_BLOCKS.map((b) => b.k)).toEqual([1, 2, 3, 4, 5]);
  });

  it('every block has objectives in the course map', () => {
    const empty = MIDTERM_BLOCKS.filter((b) => !allObjectives.some((o) => b.chapters.includes(Number(o.id.match(/^OBJ-(\d+)\./)?.[1]))));
    expect(empty).toEqual([]);
  });
});

describe('the grade is the sum of the four best questions', () => {
  it('drops the lowest of five', () => {
    expect(MIDTERM_COUNTED).toBe(4);
    expect(midtermGrade([25, 10, 20, 0, 25])).toEqual({ grade: 80, counted: [0, 1, 2, 4] });
  });

  it('keeps the earlier question on a tie, and rounds to a tenth', () => {
    expect(midtermGrade([5, 5, 5, 5, 5]).counted).toEqual([0, 1, 2, 3]);
    expect(midtermGrade([10.04, 0.03, 0, 0, 0]).grade).toBe(10.1);
  });

  it('is at most 100 for a full paper', () => {
    expect(midtermGrade([25, 25, 25, 25, 25]).grade).toBe(100);
  });
});
