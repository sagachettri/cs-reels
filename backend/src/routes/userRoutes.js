import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { updateMeBody } from '../validators/auth.js';
import { listQuery } from '../validators/reel.js';
import * as users from '../controllers/userController.js';

const router = Router();

router.use(authenticate);
router.get('/me', users.getProfile);
router.patch('/me', validate({ body: updateMeBody }), users.updateProfile);
router.get('/me/saved', validate({ query: listQuery }), users.listSaved);
router.get('/me/liked', validate({ query: listQuery }), users.listLiked);

export default router;
