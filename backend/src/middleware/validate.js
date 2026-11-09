import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';

// Validates req.body / req.query / req.params against zod schemas.
// Parsed (and cleaned) values are stored on req.valid because Express 5 makes req.query read-only.
export function validate({ body, query, params } = {}) {
  return (req, res, next) => {
    try {
      req.valid = {};
      if (params) req.valid.params = params.parse(req.params);
      if (query) req.valid.query = query.parse(req.query);
      if (body) req.valid.body = body.parse(req.body ?? {});
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.issues.map((issue) => ({
          field: issue.path.join('.') || 'body',
          message: issue.message,
        }));
        const first = details[0];
        const message = first.field === 'body' ? first.message : `${first.field}: ${first.message}`;
        return next(new ApiError(400, 'VALIDATION_ERROR', message, details));
      }
      next(error);
    }
  };
}
