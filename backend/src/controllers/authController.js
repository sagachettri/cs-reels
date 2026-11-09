import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/helpers.js';
import { signToken, setAuthCookie, clearAuthCookie, toPublicUser } from '../utils/auth.js';

const BCRYPT_ROUNDS = 10;
// Compared against when the email does not exist, so response time does not reveal which emails are registered.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password-1', BCRYPT_ROUNDS);

export async function register(req, res) {
  const { name, email, password } = req.valid.body;

  const existing = await User.findOne({ email }).lean();
  if (existing) {
    throw new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  let user;
  try {
    user = await User.create({ name, email, passwordHash, role: 'user' });
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
    }
    throw error;
  }

  setAuthCookie(res, signToken(user._id));
  return sendSuccess(res, { user: toPublicUser(user) }, 201, 'Account created.');
}

export async function login(req, res) {
  const { email, password } = req.valid.body;

  const user = await User.findOne({ email }).select('+passwordHash');
  const matches = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !matches) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  setAuthCookie(res, signToken(user._id));
  return sendSuccess(res, { user: toPublicUser(user) }, 200, 'Logged in.');
}

export async function logout(req, res) {
  clearAuthCookie(res);
  return sendSuccess(res, null, 200, 'Logged out.');
}

export async function me(req, res) {
  return sendSuccess(res, { user: toPublicUser(req.user) });
}
