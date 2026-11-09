import { z } from 'zod';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id.');

export const idParams = z.object({ id: objectId });

export const paginationQuery = {
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(30).default(10),
};

// Accepts a real value or a JSON string (needed for multipart form fields).
export function jsonField(schema) {
  return z.preprocess((value) => {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }, schema);
}
