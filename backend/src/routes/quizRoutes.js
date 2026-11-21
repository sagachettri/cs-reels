import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { quizLimiter } from '../middleware/rateLimit.js';
import { idParams } from '../validators/common.js';
import { submitQuizBody, attemptsQuery } from '../validators/quiz.js';
import * as quizzes from '../controllers/quizController.js';

const router = Router();

router.use(authenticate);
router.get('/attempts', validate({ query: attemptsQuery }), quizzes.listAttempts);
router.post('/:id/submit', quizLimiter, validate({ params: idParams, body: submitQuizBody }), quizzes.submitQuiz);

export default router;
