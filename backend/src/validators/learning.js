import { z } from 'zod';
import { paginationQuery } from './common.js';

const tzOffset = z.coerce.number().int().min(-840).max(840);

export const viewBody = z.object({
  watchedSec: z.number().min(0).max(3600).optional(),
  completed: z.boolean().optional(),
  tzOffset: tzOffset.optional(),
});

export const recommendedQuery = z.object({ ...paginationQuery });

export const progressQuery = z.object({ tzOffset: tzOffset.default(0) });
