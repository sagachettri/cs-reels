import { z } from 'zod';
import { objectId, jsonField, paginationQuery } from './common.js';

export const feedQuery = z.object({
  ...paginationQuery,
  category: z.string().trim().toLowerCase().max(60).optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
});

export const searchQuery = z.object({
  ...paginationQuery,
  q: z.string().trim().min(1, 'Enter something to search for.').max(100),
  category: z.string().trim().toLowerCase().max(60).optional(),
});

export const listQuery = z.object({ ...paginationQuery });

const resource = z.object({
  title: z.string().trim().min(1, 'Resource title is required.').max(100),
  url: z
    .string()
    .trim()
    .max(500)
    .refine((value) => {
      try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    }, 'Resource link must be a valid http(s) URL.'),
  type: z.enum(['docs', 'article', 'practice', 'video']).default('article'),
});

const emptyToUndefined = (value) => (value === '' ? undefined : value);

// No defaults here on purpose: the Mongoose model fills defaults on create,
// and PATCH must only change the fields that were actually sent.
const reelShape = {
  title: z.string().trim().min(3, 'Title must be at least 3 characters.').max(120),
  description: z.string().trim().min(10, 'Description must be at least 10 characters.').max(500),
  category: objectId,
  tags: jsonField(z.array(z.string().trim().toLowerCase().min(1).max(30)).max(8, 'At most 8 tags.')),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  keyTakeaway: z.string().trim().max(300),
  resources: jsonField(z.array(resource).max(5, 'At most 5 resources.')),
  creditName: z.string().trim().max(80),
  status: z.enum(['draft', 'published']),
  durationSec: z.preprocess(emptyToUndefined, z.coerce.number().positive().max(600)),
};

export const createReelBody = z.object({
  title: reelShape.title,
  description: reelShape.description,
  category: reelShape.category,
  tags: reelShape.tags.optional(),
  level: reelShape.level.optional(),
  keyTakeaway: reelShape.keyTakeaway.optional(),
  resources: reelShape.resources.optional(),
  creditName: reelShape.creditName.optional(),
  status: reelShape.status.optional(),
  durationSec: reelShape.durationSec.optional(),
});

export const updateReelBody = z.object(reelShape).partial();

export const adminReelsQuery = z.object({
  ...paginationQuery,
  status: z.enum(['draft', 'published', 'removed']).optional(),
  q: z.string().trim().max(100).optional(),
});

export const reportBody = z.object({
  reason: z.enum(['inaccurate', 'copyright', 'inappropriate', 'broken-media', 'other']),
  details: z.string().trim().max(500).optional(),
});

export const categoryBody = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(40),
  description: z.string().trim().max(200).optional(),
  order: z.coerce.number().int().min(0).max(1000).optional(),
});

export const updateCategoryBody = categoryBody.partial();

export const adminReportsQuery = z.object({
  ...paginationQuery,
  status: z.enum(['open', 'reviewed', 'dismissed', 'actioned']).optional(),
});

export const updateReportBody = z.object({
  status: z.enum(['reviewed', 'dismissed', 'actioned']),
  unpublishReel: z.boolean().optional(),
});
