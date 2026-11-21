import { QuizAttempt } from '../models/QuizAttempt.js';

// What the browser may see BEFORE submitting: questions and options only.
// correctIndex and explanation stay on the server until the answers are submitted.
export function toPublicQuiz(quiz) {
  return {
    quizId: String(quiz._id),
    reelId: String(quiz.reel),
    difficulty: quiz.difficulty,
    questions: quiz.questions.map((q) => ({ question: q.question, options: q.options })),
  };
}

// Scores on the server so the result cannot be faked from the browser.
export function gradeAnswers(quiz, answers) {
  const results = quiz.questions.map((q, index) => {
    const selectedIndex = answers[index];
    return {
      question: q.question,
      options: q.options,
      selectedIndex,
      correctIndex: q.correctIndex,
      correct: selectedIndex === q.correctIndex,
      explanation: q.explanation,
    };
  });
  const score = results.filter((r) => r.correct).length;
  return { score, total: results.length, percentage: Math.round((score / results.length) * 100), results };
}

export async function attemptSummary(userId, quizId) {
  const [row] = await QuizAttempt.aggregate([
    { $match: { user: userId, quiz: quizId } },
    {
      $group: {
        _id: null,
        attempts: { $sum: 1 },
        bestScore: { $max: '$score' },
        total: { $first: '$total' },
        lastAt: { $max: '$createdAt' },
      },
    },
  ]);
  if (!row) return { attempts: 0, bestPercentage: null, lastAttemptAt: null };
  return {
    attempts: row.attempts,
    bestPercentage: Math.round((row.bestScore / row.total) * 100),
    lastAttemptAt: row.lastAt,
  };
}
