import { POINTS_PER_CORRECT, STREAK_BONUS } from '../data/quiz';

/** Points for one answer given the streak after this answer. */
export function pointsFor(correct: boolean, streakAfter: number): number {
  return correct ? POINTS_PER_CORRECT + (streakAfter >= 3 ? STREAK_BONUS : 0) : 0;
}

export function computeBadges(results: boolean[], total: number) {
  let streak = 0;
  let best = 0;
  for (const r of results) {
    streak = r ? streak + 1 : 0;
    best = Math.max(best, streak);
  }
  const correct = results.filter(Boolean).length;
  return {
    first: results.length === total,
    streak: best >= 3,
    expert: correct >= 6,
    perfect: correct === total,
  };
}
