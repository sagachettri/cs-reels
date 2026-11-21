import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { progressQuery } from '../validators/learning.js';
import * as learning from '../controllers/learningController.js';

const router = Router();

router.get('/', authenticate, validate({ query: progressQuery }), learning.progress);

export default router;
