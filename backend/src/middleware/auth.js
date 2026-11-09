import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { COOKIE_NAME, verifyToken } from '../utils/auth.js';

async function loadUserFromCookie(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = verifyToken(token);
    return await User.findById(payload.sub).lean();
  } catch {
    return null;
  }
}

// Requires a logged-in user.
export async function authenticate(req, res, next) {
  const user = await loadUserFromCookie(req);
  if (!user) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Please log in to continue.'));
  }
  req.user = user;
  next();
}

// Attaches req.user when logged in, but lets guests through.
export async function optionalAuth(req, res, next) {
  req.user = (await loadUserFromCookie(req)) || null;
  next();
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return next(new ApiError(403, 'FORBIDDEN', 'You do not have permission to do that.'));
    }
    next();
  };
}
