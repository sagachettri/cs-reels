import { z } from 'zod';
import { objectId, paginationQuery } from './common.js';

const tzOffset = z.coerce.number().int().min(-840).max(840);

export const startQuizBody = z.object({
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
});

export const submitQuizBody = z.object({
  answers: z.array(z.number().int().min(0).max(3)).min(1).max(5),
  tzOffset: tzOffset.optional(),
});

export const attemptsQuery = z.object({
  ...paginationQuery,
  reel: objectId.optional(),
});
