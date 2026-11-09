import { Reel } from '../models/Reel.js';
import { Like } from '../models/Like.js';
import { SavedReel } from '../models/SavedReel.js';
import { Report } from '../models/Report.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/helpers.js';

async function assertPublishedReel(id) {
  const reel = await Reel.findOne({ _id: id, status: 'published' }).select('_id').lean();
  if (!reel) throw new ApiError(404, 'REEL_NOT_FOUND', 'This reel was not found.');
}

// Adds one (user, reel) row. The counter only changes when a row was really created,
// so repeated or simultaneous requests can never inflate the count.
async function addEntry(Model, counterField, userId, reelId) {
  let created = false;
  try {
    const result = await Model.updateOne(
      { user: userId, reel: reelId },
      { $setOnInsert: { user: userId, reel: reelId } },
      { upsert: true }
    );
    created = result.upsertedCount === 1;
  } catch (error) {
    if (error.code !== 11000) throw error; // lost a race with an identical request: already exists
  }
  if (created) await Reel.updateOne({ _id: reelId }, { $inc: { [counterField]: 1 } });
}

async function removeEntry(Model, counterField, userId, reelId) {
  const result = await Model.deleteOne({ user: userId, reel: reelId });
  if (result.deletedCount === 1) {
    await Reel.updateOne({ _id: reelId, [counterField]: { $gt: 0 } }, { $inc: { [counterField]: -1 } });
  }
}

async function counters(reelId) {
  const reel = await Reel.findById(reelId).select('likesCount savesCount').lean();
  return { likesCount: reel?.likesCount || 0, savesCount: reel?.savesCount || 0 };
}

export async function likeReel(req, res) {
  const { id } = req.valid.params;
  await assertPublishedReel(id);
  await addEntry(Like, 'likesCount', req.user._id, id);
  return sendSuccess(res, { liked: true, ...(await counters(id)) });
}

export async function unlikeReel(req, res) {
  const { id } = req.valid.params;
  await removeEntry(Like, 'likesCount', req.user._id, id);
  return sendSuccess(res, { liked: false, ...(await counters(id)) });
}

export async function saveReel(req, res) {
  const { id } = req.valid.params;
  await assertPublishedReel(id);
  await addEntry(SavedReel, 'savesCount', req.user._id, id);
  return sendSuccess(res, { saved: true, ...(await counters(id)) });
}

export async function unsaveReel(req, res) {
  const { id } = req.valid.params;
  await removeEntry(SavedReel, 'savesCount', req.user._id, id);
  return sendSuccess(res, { saved: false, ...(await counters(id)) });
}

export async function reportReel(req, res) {
  const { id } = req.valid.params;
  await assertPublishedReel(id);
  const { reason, details } = req.valid.body;

  try {
    await Report.create({ reel: id, reporter: req.user._id, reason, details: details || '' });
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, 'ALREADY_REPORTED', 'You have already reported this reel.');
    }
    throw error;
  }
  return sendSuccess(res, null, 201, 'Thanks. Your report was sent to the admin.');
}
