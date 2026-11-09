import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

function makeLimiter({ windowMs, limit, message, keyGenerator }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => env.isTest,
    ...(keyGenerator ? { keyGenerator } : {}),
    handler: (req, res, next) => next(new ApiError(429, 'RATE_LIMITED', message)),
  });
}

export const apiLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  message: 'Too many requests. Please slow down and try again shortly.',
});

export const authLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: 'Too many attempts. Please wait a few minutes and try again.',
});

export const reportLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  message: 'You have sent too many reports. Please try again later.',
});

// Per logged-in user (this runs after authenticate).
export const aiLimiter = makeLimiter({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  message: 'You have used the AI features a lot in a short time. Please wait a few minutes.',
  keyGenerator: (req) => String(req.user._id),
});
