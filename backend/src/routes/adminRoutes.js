import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { uploadReelFiles } from '../middleware/upload.js';
import { idParams } from '../validators/common.js';
import {
  createReelBody,
  updateReelBody,
  adminReelsQuery,
  categoryBody,
  updateCategoryBody,
  adminReportsQuery,
  updateReportBody,
} from '../validators/reel.js';
import * as admin from '../controllers/adminController.js';

const router = Router();

// Every admin route: must be logged in AND have the admin role (checked on the server).
router.use(authenticate, requireRole('admin'));

router.get('/stats', admin.getStats);

router.get('/reels', validate({ query: adminReelsQuery }), admin.listAdminReels);
router.post('/reels', uploadReelFiles, validate({ body: createReelBody }), admin.createReel);
router.patch('/reels/:id', validate({ params: idParams, body: updateReelBody }), admin.updateReel);
router.delete('/reels/:id', validate({ params: idParams }), admin.deleteReel);

router.post('/categories', validate({ body: categoryBody }), admin.createCategory);
router.patch('/categories/:id', validate({ params: idParams, body: updateCategoryBody }), admin.updateCategory);
router.delete('/categories/:id', validate({ params: idParams }), admin.deleteCategory);

router.get('/reports', validate({ query: adminReportsQuery }), admin.listReports);
router.patch('/reports/:id', validate({ params: idParams, body: updateReportBody }), admin.updateReport);

export default router;
