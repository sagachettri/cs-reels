import mongoose from 'mongoose';
import { Reel } from '../models/Reel.js';
import { Like } from '../models/Like.js';
import { SavedReel } from '../models/SavedReel.js';

export const reelPopulate = [
  { path: 'category', select: 'name slug' },
  { path: 'uploadedBy', select: 'name' },
];

// Shape of a reel as sent to the frontend. Never exposes ImageKit file ids.
export function serializeReel(reel, state = {}) {
  const category = reel.category && reel.category._id
    ? { id: String(reel.category._id), name: reel.category.name, slug: reel.category.slug }
    : null;

  return {
    id: String(reel._id),
    title: reel.title,
    description: reel.description,
    videoUrl: reel.videoUrl,
    thumbnailUrl: reel.thumbnailUrl || '',
    durationSec: reel.durationSec ?? null,
    category,
    tags: reel.tags || [],
    level: reel.level,
    keyTakeaway: reel.keyTakeaway || '',
    resources: (reel.resources || []).map((r) => ({ title: r.title, url: r.url, type: r.type })),
    creator: reel.creditName || reel.uploadedBy?.name || 'CS Reels',
    creditName: reel.creditName || '',
    status: reel.status,
    likesCount: reel.likesCount || 0,
    savesCount: reel.savesCount || 0,
    createdAt: reel.createdAt,
    updatedAt: reel.updatedAt,
    liked: Boolean(state.liked),
    saved: Boolean(state.saved),
  };
}

// Adds liked / saved flags for the logged-in user (guests always get false).
export async function serializeReels(reels, userId) {
  if (!userId || reels.length === 0) {
    return reels.map((reel) => serializeReel(reel));
  }
  const ids = reels.map((r) => r._id);
  const [likes, saves] = await Promise.all([
    Like.find({ user: userId, reel: { $in: ids } }).select('reel').lean(),
    SavedReel.find({ user: userId, reel: { $in: ids } }).select('reel').lean(),
  ]);
  const likedSet = new Set(likes.map((l) => String(l.reel)));
  const savedSet = new Set(saves.map((s) => String(s.reel)));
  return reels.map((reel) =>
    serializeReel(reel, { liked: likedSet.has(String(reel._id)), saved: savedSet.has(String(reel._id)) })
  );
}

export async function serializeOne(reel, userId) {
  const [serialized] = await serializeReels([reel], userId);
  return serialized;
}

// Published reels a user liked / saved, newest first, with an accurate total.
export async function listUserReels(Model, userId, page, limit) {
  const userObjectId = new mongoose.Types.ObjectId(String(userId));
  const [result] = await Model.aggregate([
    { $match: { user: userObjectId } },
    { $lookup: { from: Reel.collection.name, localField: 'reel', foreignField: '_id', as: 'reelDoc' } },
    { $unwind: '$reelDoc' },
    { $match: { 'reelDoc.status': 'published' } },
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $facet: {
        items: [{ $skip: (page - 1) * limit }, { $limit: limit }, { $project: { reel: 1 } }],
        total: [{ $count: 'count' }],
      },
    },
  ]);

  const total = result.total[0]?.count || 0;
  const ids = result.items.map((item) => item.reel);
  const reels = await Reel.find({ _id: { $in: ids } }).populate(reelPopulate).lean();
  const byId = new Map(reels.map((r) => [String(r._id), r]));
  const ordered = ids.map((id) => byId.get(String(id))).filter(Boolean);
  return { reels: ordered, total };
}

export async function countUserReels(Model, userId) {
  const { total } = await listUserReels(Model, userId, 1, 1);
  return total;
}
