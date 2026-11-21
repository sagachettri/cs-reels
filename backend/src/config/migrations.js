import { Quiz } from '../models/Quiz.js';

// Safe to run on every start. Upgrades data created by the Round 2 version:
//  1. quizzes saved before difficulty existed become "medium" quizzes
//  2. the old "one quiz per reel" unique index is replaced by "one per reel and difficulty"
export async function runMigrations() {
  await Quiz.updateMany({ difficulty: { $exists: false } }, { $set: { difficulty: 'medium' } });
  await Quiz.syncIndexes();
}
