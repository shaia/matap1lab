/** What the student sees for each kind of solution step (STEP_KINDS in content.config.ts). */

import type { STEP_KINDS } from '~/lib/schemas';

export const STEP_LABEL: Record<(typeof STEP_KINDS)[number], string> = {
  given: 'נתון',
  // most goals in this course are a computation, not a proof: the label must fit both
  goal: 'מבקשים',
  idea: 'רעיון',
  definition: 'הגדרה',
  theorem: 'משפט',
  step: 'צעד',
  computation: 'חישוב',
  check: 'בדיקה',
  result: 'מסקנה',
};
