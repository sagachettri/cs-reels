import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

export function notFound(req, res, next) {
  next(new ApiError(404, 'NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`));
}

function translateError(err) {
  if (err instanceof ApiError) return err;

  if (err.type === 'entity.parse.failed') {
    return new ApiError(400, 'INVALID_JSON', 'Request body contains invalid JSON.');
  }
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const mb = Math.round(env.upload.maxVideoBytes / (1024 * 1024));
      return new ApiError(413, 'FILE_TOO_LARGE', `File is too large. The limit is ${mb} MB.`);
    }
    return new ApiError(400, 'UPLOAD_ERROR', 'The upload was not accepted. Check the files and try again.');
  }
  if (err.name === 'CastError') {
    return new ApiError(400, 'INVALID_ID', 'The provided id is not valid.');
  }
  if (err.name === 'ValidationError' && err.errors) {
    return new ApiError(400, 'VALIDATION_ERROR', 'Some fields are invalid.');
  }
  if (err.code === 11000) {
    return new ApiError(409, 'DUPLICATE', 'That record already exists.');
  }
  return null;
}

// Express recognises error handlers by their four parameters, so `next` must stay.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const known = translateError(err);

  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong. Please try again later.';
  let details;

  if (known) {
    statusCode = known.statusCode;
    code = known.code;
    message = known.message;
    details = known.details;
  } else if (!env.isProduction) {
    // Development only: show the real message to help debugging. Never the stack trace.
    message = err.message || message;
  }

  if (statusCode >= 500 && !env.isTest) {
    console.error(err);
  }

  const body = { success: false, error: { code, message } };
  if (details) body.error.details = details;
  res.status(statusCode).json(body);
}
