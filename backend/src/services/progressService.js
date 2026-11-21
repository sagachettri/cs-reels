import { Reel } from '../models/Reel.js';
import { Category } from '../models/Category.js';
import { Like } from '../models/Like.js';
import { SavedReel } from '../models/SavedReel.js';
import { ReelView } from '../models/ReelView.js';
import { QuizAttempt } from '../models/QuizAttempt.js';
import { ActivityDay } from '../models/ActivityDay.js';
import { countUserReels } from './reelService.js';
import { dayKey, computeStreaks } from './activityService.js';
import { WEAK_SCORE_THRESHOLD } from './recommendationService.js';

const STRONG_SCORE_THRESHOLD = 80;

// Every number here is counted from real records: views, quiz attempts, saves, likes and daily activity.
export async function buildProgress(userId, tzOffset = 0) {
  const todayKey = dayKey(new Date(), tzOffset);
  const cutoff = dayKey(new Date(Date.now() - 400 * 86400000), tzOffset);

  const [viewsByCategory, attemptsByCategory, attemptTotals, reelsByCategory, categories, savedCount, likedCount, days, recent] =
    await Promise.all([
      ReelView.aggregate([
        { $match: { user: userId } },
        { $lookup: { from: Reel.collection.name, localField: 'reel', foreignField: '_id', as: 'reelDoc' } },
        { $unwind: '$reelDoc' },
        { $match: { 'reelDoc.status': 'published' } },
        {
          $group: {
            _id: '$reelDoc.category',
            watched: { $sum: 1 },
            completed: { $sum: { $cond: ['$completed', 1, 0] } },
            events: { $sum: '$viewCount' },
          },
        },
      ]),
      QuizAttempt.aggregate([
        { $match: { user: userId } },
        {
          $group: {
            _id: '$category',
            attempts: { $sum: 1 },
            avg: { $avg: { $multiply: [{ $divide: ['$score', '$total'] }, 100] } },
            best: { $max: { $multiply: [{ $divide: ['$score', '$total'] }, 100] } },
          },
        },
      ]),
      QuizAttempt.aggregate([
        { $match: { user: userId } },
        {
          $group: {
            _id: null,
            attempts: { $sum: 1 },
            avg: { $avg: { $multiply: [{ $divide: ['$score', '$total'] }, 100] } },
            best: { $max: { $multiply: [{ $divide: ['$score', '$total'] }, 100] } },
            quizzes: { $addToSet: '$quiz' },
          },
        },
      ]),
      Reel.aggregate([{ $match: { status: 'published' } }, { $group: { _id: '$category', total: { $sum: 1 } } }]),
      Category.find().sort({ order: 1, name: 1 }).lean(),
      countUserReels(SavedReel, userId),
      countUserReels(Like, userId),
      ActivityDay.find({ user: userId, day: { $gte: cutoff } }).sort({ day: -1 }).lean(),
      QuizAttempt.find({ user: userId }).sort({ createdAt: -1 }).limit(5).populate('reel', 'title').lean(),
    ]);

  const viewMap = new Map(viewsByCategory.map((row) => [String(row._id), row]));
  const attemptMap = new Map(attemptsByCategory.map((row) => [String(row._id), row]));
  const totalMap = new Map(reelsByCategory.map((row) => [String(row._id), row.total]));

  const categoryProgress = categories.map((category) => {
    const id = String(category._id);
    const views = viewMap.get(id);
    const attempts = attemptMap.get(id);
    const watched = views?.watched || 0;
    const averageScore = attempts ? Math.round(attempts.avg) : null;

    let status = 'not-started';
    if (watched > 0 || attempts) status = 'in-progress';
    if (averageScore !== null && averageScore < WEAK_SCORE_THRESHOLD) status = 'needs-practice';
    if (averageScore !== null && averageScore >= STRONG_SCORE_THRESHOLD) status = 'strong';

    return {
      id,
      name: category.name,
      slug: category.slug,
      totalReels: totalMap.get(id) || 0,
      watched,
      completed: views?.completed || 0,
      quizAttempts: attempts?.attempts || 0,
      averageScore,
      status,
    };
  });

  const overall = attemptTotals[0];
  const reelsWatched = viewsByCategory.reduce((sum, row) => sum + row.watched, 0);
  const reelsCompleted = viewsByCategory.reduce((sum, row) => sum + row.completed, 0);
  const watchEvents = viewsByCategory.reduce((sum, row) => sum + row.events, 0);

  const streaks = computeStreaks(days.map((d) => d.day), todayKey);
  const byDay = new Map(days.map((d) => [d.day, d]));
  const weekly = [];
  for (let i = 6; i >= 0; i -= 1) {
    const key = dayKey(new Date(Date.now() - i * 86400000), tzOffset);
    const row = byDay.get(key);
    weekly.push({ date: key, views: row?.views || 0, quizzes: row?.quizzes || 0 });
  }

  return {
    summary: {
      reelsWatched,
      reelsCompleted,
      watchEvents,
      quizzesAttempted: overall?.attempts || 0,
      distinctQuizzes: overall?.quizzes?.length || 0,
      averageScore: overall ? Math.round(overall.avg) : null,
      bestScore: overall ? Math.round(overall.best) : null,
      savedCount,
      likedCount,
      activeDays: days.length,
      currentStreak: streaks.current,
      longestStreak: streaks.longest,
    },
    categories: categoryProgress,
    weekly,
    recentAttempts: recent.map((a) => ({
      id: String(a._id),
      reel: a.reel ? { id: String(a.reel._id), title: a.reel.title } : null,
      difficulty: a.difficulty,
      score: a.score,
      total: a.total,
      percentage: Math.round((a.score / a.total) * 100),
      createdAt: a.createdAt,
    })),
  };
}
