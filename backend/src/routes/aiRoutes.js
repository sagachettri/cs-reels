import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { aiLimiter } from '../middleware/rateLimit.js';
import { idParams } from '../validators/common.js';
import { explainBody, chatBody } from '../validators/ai.js';
import * as ai from '../controllers/aiController.js';

const router = Router();

router.use(authenticate, aiLimiter);

router.post('/reels/:id/explain', validate({ params: idParams, body: explainBody }), ai.explain);
router.post('/reels/:id/summary', validate({ params: idParams }), ai.summary);
router.post('/reels/:id/quiz', validate({ params: idParams }), ai.quiz);
router.post('/chat', validate({ body: chatBody }), ai.chat);

export default router;
