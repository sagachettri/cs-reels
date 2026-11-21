import { Quiz } from '../models/Quiz.js';
import { Reel } from '../models/Reel.js';
import { QuizAttempt } from '../models/QuizAttempt.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess, buildPagination } from '../utils/helpers.js';
import { gradeAnswers, attemptSummary } from '../services/quizService.js';
import { bumpActivity } from '../services/activityService.js';

export async function submitQuiz(req, res) {
  const quiz = await Quiz.findById(req.valid.params.id).lean();
  if (!quiz) throw new ApiError(404, 'QUIZ_NOT_FOUND', 'This quiz was not found.');

  const reel = await Reel.findOne({ _id: quiz.reel, status: 'published' }).select('category').lean();
  if (!reel) throw new ApiError(404, 'REEL_NOT_FOUND', 'This reel is no longer available.');

  const { answers, tzOffset } = req.valid.body;
  if (answers.length !== quiz.questions.length) {
    throw new ApiError(400, 'ANSWERS_INCOMPLETE', `Answer all ${quiz.questions.length} questions before submitting.`);
  }

  const grade = gradeAnswers(quiz, answers);
  const previousAttempts = await QuizAttempt.countDocuments({ user: req.user._id, quiz: quiz._id });

  const attempt = await QuizAttempt.create({
    user: req.user._id,
    quiz: quiz._id,
    reel: quiz.reel,
    category: reel.category,
    difficulty: quiz.difficulty,
    score: grade.score,
    total: grade.total,
    answers,
  });
  await bumpActivity(req.user._id, 'quizzes', tzOffset || 0);

  const summary = await attemptSummary(req.user._id, quiz._id);
  return sendSuccess(
    res,
    {
      attemptId: String(attempt._id),
      difficulty: quiz.difficulty,
      score: grade.score,
      total: grade.total,
      percentage: grade.percentage,
      attemptNumber: previousAttempts + 1,
      bestPercentage: summary.bestPercentage,
      results: grade.results,
    },
    201
  );
}

export async function listAttempts(req, res) {
  const { page, limit, reel } = req.valid.query;
  const filter = { user: req.user._id };
  if (reel) filter.reel = reel;

  const [attempts, total] = await Promise.all([
    QuizAttempt.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('reel', 'title thumbnailUrl')
      .lean(),
    QuizAttempt.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    attempts: attempts.map((a) => ({
      id: String(a._id),
      quizId: String(a.quiz),
      reel: a.reel ? { id: String(a.reel._id), title: a.reel.title, thumbnailUrl: a.reel.thumbnailUrl || '' } : null,
      difficulty: a.difficulty,
      score: a.score,
      total: a.total,
      percentage: Math.round((a.score / a.total) * 100),
      createdAt: a.createdAt,
    })),
    pagination: buildPagination(page, limit, total),
  });
}
