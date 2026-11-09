import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const COOKIE_NAME = 'token';

export function signToken(userId) {
  return jwt.sign({}, env.jwtSecret, { subject: String(userId), expiresIn: env.jwtExpiresIn });
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

function baseCookieOptions() {
  return { httpOnly: true, secure: env.isProduction, sameSite: 'lax', path: '/' };
}

export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, { ...baseCookieOptions(), maxAge: env.cookieMaxAgeMs });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, baseCookieOptions());
}

export function toPublicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}
