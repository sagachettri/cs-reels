import { User } from '../models/User.js';
import { Like } from '../models/Like.js';
import { SavedReel } from '../models/SavedReel.js';
import { sendSuccess, buildPagination } from '../utils/helpers.js';
import { toPublicUser } from '../utils/auth.js';
import { listUserReels, countUserReels, serializeReels } from '../services/reelService.js';

export async function getProfile(req, res) {
  const [savedCount, likedCount] = await Promise.all([
    countUserReels(SavedReel, req.user._id),
    countUserReels(Like, req.user._id),
  ]);
  return sendSuccess(res, { user: toPublicUser(req.user), stats: { savedCount, likedCount } });
}

export async function updateProfile(req, res) {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { name: req.valid.body.name },
    { returnDocument: 'after', runValidators: true }
  ).lean();
  return sendSuccess(res, { user: toPublicUser(user) }, 200, 'Profile updated.');
}

function listHandler(Model) {
  return async (req, res) => {
    const { page, limit } = req.valid.query;
    const { reels, total } = await listUserReels(Model, req.user._id, page, limit);
    const items = await serializeReels(reels, req.user._id);
    return sendSuccess(res, { reels: items, pagination: buildPagination(page, limit, total) });
  };
}

export const listSaved = listHandler(SavedReel);
export const listLiked = listHandler(Like);
