import { Reel } from '../models/Reel.js';
import { Category } from '../models/Category.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess, buildPagination, escapeRegex } from '../utils/helpers.js';
import { reelPopulate, serializeReels, serializeOne } from '../services/reelService.js';

async function resolveCategoryId(slug) {
  const category = await Category.findOne({ slug }).select('_id').lean();
  if (!category) throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'That category does not exist.');
  return category._id;
}

async function pageOfReels(filter, page, limit, userId) {
  const [reels, total] = await Promise.all([
    Reel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate(reelPopulate)
      .lean(),
    Reel.countDocuments(filter),
  ]);
  return { reels: await serializeReels(reels, userId), pagination: buildPagination(page, limit, total) };
}

export async function listReels(req, res) {
  const { page, limit, category, level } = req.valid.query;
  const filter = { status: 'published' };
  if (category) filter.category = await resolveCategoryId(category);
  if (level) filter.level = level;

  return sendSuccess(res, await pageOfReels(filter, page, limit, req.user?._id));
}

export async function searchReels(req, res) {
  const { page, limit, q, category } = req.valid.query;
  const pattern = new RegExp(escapeRegex(q), 'i');

  // "Category" search: match reels whose category name matches the text as well.
  const matchingCategories = await Category.find({ name: pattern }).select('_id').lean();

  const filter = {
    status: 'published',
    $or: [
      { title: pattern },
      { description: pattern },
      { tags: pattern },
      { category: { $in: matchingCategories.map((c) => c._id) } },
    ],
  };
  if (category) filter.category = await resolveCategoryId(category);

  return sendSuccess(res, await pageOfReels(filter, page, limit, req.user?._id));
}

async function findVisibleReel(id, user) {
  const reel = await Reel.findById(id).populate(reelPopulate).lean();
  const isAdmin = user?.role === 'admin';
  if (!reel || (reel.status !== 'published' && !isAdmin)) {
    throw new ApiError(404, 'REEL_NOT_FOUND', 'This reel was not found.');
  }
  return reel;
}

export async function getReel(req, res) {
  const reel = await findVisibleReel(req.valid.params.id, req.user);
  return sendSuccess(res, { reel: await serializeOne(reel, req.user?._id) });
}

// Content-based and rule-based (not machine learning): shared tags weigh more than a shared category.
export async function relatedReels(req, res) {
  const reel = await findVisibleReel(req.valid.params.id, req.user);

  const candidates = await Reel.find({
    status: 'published',
    _id: { $ne: reel._id },
    $or: [{ category: reel.category._id }, { tags: { $in: reel.tags } }],
  })
    .sort({ createdAt: -1 })
    .limit(40)
    .populate(reelPopulate)
    .lean();

  const ownTags = new Set(reel.tags);
  const scored = candidates
    .map((candidate) => {
      const sharedTags = candidate.tags.filter((tag) => ownTags.has(tag)).length;
      const sameCategory = String(candidate.category._id) === String(reel.category._id) ? 1 : 0;
      return { candidate, score: sharedTags * 2 + sameCategory };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((entry) => entry.candidate);

  return sendSuccess(res, { reels: await serializeReels(scored, req.user?._id) });
}
