import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { reportLimiter } from '../middleware/rateLimit.js';
import { idParams } from '../validators/common.js';
import { feedQuery, searchQuery, reportBody } from '../validators/reel.js';
import * as reels from '../controllers/reelController.js';
import * as interactions from '../controllers/interactionController.js';

const router = Router();

// Public (guests allowed). optionalAuth adds liked/saved flags when logged in.
router.get('/', optionalAuth, validate({ query: feedQuery }), reels.listReels);
router.get('/search', optionalAuth, validate({ query: searchQuery }), reels.searchReels); // must stay above /:id
router.get('/:id', optionalAuth, validate({ params: idParams }), reels.getReel);
router.get('/:id/related', optionalAuth, validate({ params: idParams }), reels.relatedReels);

// Login required.
router.post('/:id/like', authenticate, validate({ params: idParams }), interactions.likeReel);
router.delete('/:id/like', authenticate, validate({ params: idParams }), interactions.unlikeReel);
router.post('/:id/save', authenticate, validate({ params: idParams }), interactions.saveReel);
router.delete('/:id/save', authenticate, validate({ params: idParams }), interactions.unsaveReel);
router.post(
  '/:id/report',
  authenticate,
  reportLimiter,
  validate({ params: idParams, body: reportBody }),
  interactions.reportReel
);

export default router;
