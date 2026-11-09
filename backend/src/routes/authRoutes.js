import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { registerBody, loginBody } from '../validators/auth.js';
import * as auth from '../controllers/authController.js';

const router = Router();

router.post('/register', authLimiter, validate({ body: registerBody }), auth.register);
router.post('/login', authLimiter, validate({ body: loginBody }), auth.login);
router.post('/logout', authenticate, auth.logout);
router.get('/me', authenticate, auth.me);

export default router;
