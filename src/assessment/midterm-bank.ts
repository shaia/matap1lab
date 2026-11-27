/** The midterm's papers, at build time: complete papers only, rendered for the browser (TeX done here). */

import { getCollection } from 'astro:content';
import type { ExamQuestion } from '~/content.config';
import { MIDTERM_BLOCKS, midtermPlace } from './midterm';
import { renderQuestion } from './render';

export interface MidtermPaper {
  paper: number;
  /** one question per block, in block order */
  questions: ExamQuestion[];
}

let cache: MidtermPaper[] | null = null;

export async function midtermPapers(): Promise<MidtermPaper[]> {
  if (cache) return cache;
  const by = new Map<number, ExamQuestion[]>();
  for (const q of await getCollection('midterm')) {
    const place = midtermPlace(q.data.id);
    if (!place) continue;
    by.set(place.paper, [...(by.get(place.paper) ?? []), q.data as ExamQuestion]);
  }
  const block = (q: ExamQuestion) => midtermPlace(q.id)!.block;
  cache = [...by.entries()]
    // a paper is shown only when it has a question from every block (lint lists the incomplete ones)
    .filter(([, qs]) => MIDTERM_BLOCKS.every((b) => qs.some((q) => block(q) === b.k)))
    .sort(([a], [b]) => a - b)
    .map(([paper, qs]) => ({
      paper,
      questions: qs.sort((a, b) => block(a) - block(b)).map((q) => renderQuestion(q) as ExamQuestion),
    }));
  return cache;
}
