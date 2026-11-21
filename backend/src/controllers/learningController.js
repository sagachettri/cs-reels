import { Reel } from '../models/Reel.js';
import { ReelView } from '../models/ReelView.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess, buildPagination } from '../utils/helpers.js';
import { serializeReels } from '../services/reelService.js';
import { rankReelsForUser } from '../services/recommendationService.js';
import { buildProgress } from '../services/progressService.js';
import { bumpActivity } from '../services/activityService.js';

// Called by the app when a logged-in student has really watched a reel for a few seconds.
export async function recordView(req, res) {
  const { id } = req.valid.params;
  const { watchedSec = 0, completed = false, tzOffset = 0 } = req.valid.body;

  const exists = await Reel.exists({ _id: id, status: 'published' });
  if (!exists) throw new ApiError(404, 'REEL_NOT_FOUND', 'This reel was not found.');

  const now = new Date();
  const set = { lastViewedAt: now };
  if (completed) set.completed = true;

  const view = await ReelView.findOneAndUpdate(
    { user: req.user._id, reel: id },
    {
      $set: set,
      $setOnInsert: { firstViewedAt: now },
      $inc: { viewCount: 1 },
      $max: { maxWatchSec: watchedSec },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  ).lean();

  await bumpActivity(req.user._id, 'views', tzOffset);
  return sendSuccess(res, { viewCount: view.viewCount, completed: view.completed });
}

// "For you": ranked from the student's real likes, saves, views and quiz results (guests get popular and new reels).
export async function recommended(req, res) {
  const { page, limit } = req.valid.query;
  const { ranked, personalized } = await rankReelsForUser(req.user?._id || null);

  const slice = ranked.slice((page - 1) * limit, page * limit);
  const reels = await serializeReels(
    slice.map((entry) => entry.reel),
    req.user?._id
  );
  const withReasons = reels.map((reel, index) => ({ ...reel, reason: slice[index].reason }));

  return sendSuccess(res, {
    reels: withReasons,
    personalized,
    pagination: buildPagination(page, limit, ranked.length),
  });
}

export async function progress(req, res) {
  return sendSuccess(res, await buildProgress(req.user._id, req.valid.query.tzOffset));
}
