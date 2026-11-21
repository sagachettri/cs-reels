import { Reel } from '../models/Reel.js';
import { Like } from '../models/Like.js';
import { SavedReel } from '../models/SavedReel.js';
import { ReelView } from '../models/ReelView.js';
import { QuizAttempt } from '../models/QuizAttempt.js';
import { reelPopulate } from './reelService.js';

// Simple, explainable scoring: no machine learning, every suggestion comes with a plain-language reason.
const WEIGHTS = { like: 3, save: 4, view: 1, completed: 1, attempt: 1 };
export const WEAK_SCORE_THRESHOLD = 60; // quiz average (%) below this marks a topic as "needs practice"
const LEVELS = ['beginner', 'intermediate', 'advanced'];
const FRESH_MS = 14 * 24 * 60 * 60 * 1000;

function add(map, key, weight) {
  map.set(key, (map.get(key) || 0) + weight);
}

export async function rankReelsForUser(userId) {
  const candidatesPromise = Reel.find({ status: 'published' })
    .sort({ createdAt: -1 })
    .limit(300)
    .populate(reelPopulate)
    .lean();

  let likes = [];
  let saves = [];
  let views = [];
  let attemptStats = [];
  if (userId) {
    [likes, saves, views, attemptStats] = await Promise.all([
      Like.find({ user: userId }).sort({ createdAt: -1 }).limit(300).select('reel').lean(),
      SavedReel.find({ user: userId }).sort({ createdAt: -1 }).limit(300).select('reel').lean(),
      ReelView.find({ user: userId }).sort({ lastViewedAt: -1 }).limit(500).select('reel completed').lean(),
      QuizAttempt.aggregate([
        { $match: { user: userId } },
        {
          $group: {
            _id: '$category',
            attempts: { $sum: 1 },
            avg: { $avg: { $multiply: [{ $divide: ['$score', '$total'] }, 100] } },
          },
        },
      ]),
    ]);
  }
  const candidates = await candidatesPromise;

  // What do we know about the reels the user interacted with?
  const signalIds = new Set([...likes, ...saves, ...views].map((row) => String(row.reel)));
  const signalReels = signalIds.size
    ? await Reel.find({ _id: { $in: [...signalIds] } }).select('category tags level').lean()
    : [];
  const byId = new Map(signalReels.map((r) => [String(r._id), r]));

  const categoryWeight = new Map();
  const tagWeight = new Map();
  const levelWeight = new Map();
  function credit(reelId, weight) {
    const reel = byId.get(String(reelId));
    if (!reel) return;
    add(categoryWeight, String(reel.category), weight);
    reel.tags.forEach((tag) => add(tagWeight, tag, weight));
    add(levelWeight, reel.level, weight);
  }
  likes.forEach((row) => credit(row.reel, WEIGHTS.like));
  saves.forEach((row) => credit(row.reel, WEIGHTS.save));
  views.forEach((row) => credit(row.reel, WEIGHTS.view + (row.completed ? WEIGHTS.completed : 0)));

  const weakTopics = new Map(); // categoryId -> quiz average %
  for (const stat of attemptStats) {
    add(categoryWeight, String(stat._id), stat.attempts * WEIGHTS.attempt);
    if (stat.avg < WEAK_SCORE_THRESHOLD) weakTopics.set(String(stat._id), Math.round(stat.avg));
  }

  const personalized = categoryWeight.size > 0;
  const watched = new Set(views.map((row) => String(row.reel)));

  let preferredLevel = null;
  if (levelWeight.size) {
    preferredLevel = [...levelWeight.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  const now = Date.now();
  const ranked = candidates.map((reel) => {
    const categoryId = String(reel.category._id);
    const categoryScore = Math.min(categoryWeight.get(categoryId) || 0, 20);

    let tagScore = 0;
    let bestTag = null;
    let bestTagWeight = 0;
    for (const tag of reel.tags) {
      const w = tagWeight.get(tag) || 0;
      tagScore += Math.min(w, 6) * 0.5;
      if (w > bestTagWeight) {
        bestTagWeight = w;
        bestTag = tag;
      }
    }

    const weakAverage = weakTopics.get(categoryId);
    const weakBoost = weakAverage !== undefined ? 4 : 0;

    let levelBonus = 0;
    if (preferredLevel) {
      const gap = Math.abs(LEVELS.indexOf(reel.level) - LEVELS.indexOf(preferredLevel));
      levelBonus = gap === 0 ? 1 : gap === 1 ? 0.5 : 0;
    }

    const popularity = Math.log1p((reel.likesCount || 0) + (reel.savesCount || 0)) * 0.3;
    const isFresh = now - new Date(reel.createdAt).getTime() < FRESH_MS;
    const seen = watched.has(String(reel._id));

    const score =
      categoryScore + tagScore + weakBoost + levelBonus + popularity + (isFresh ? 0.5 : 0) - (seen ? 100 : 0);

    let reason;
    if (seen) reason = 'Watch again to revise';
    else if (weakBoost) reason = `Strengthen ${reel.category.name}: your quiz average there is ${weakAverage}%`;
    else if (bestTag) reason = `Because you engage with #${bestTag}`;
    else if (categoryScore > 0) reason = `Because you like ${reel.category.name} reels`;
    else if (personalized) reason = 'Something new to explore';
    else reason = isFresh ? 'New on CS Reels' : 'Popular on CS Reels';

    return { reel, score, reason };
  });

  ranked.sort((a, b) => b.score - a.score || new Date(b.reel.createdAt) - new Date(a.reel.createdAt));
  return { ranked, personalized };
}
