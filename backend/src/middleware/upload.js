import multer from 'multer';
import { env } from '../config/env.js';

// Files are kept in memory only briefly, then streamed to ImageKit. Nothing is written to disk.
const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.upload.maxVideoBytes, files: 2, fields: 20 },
});

export const uploadReelFiles = uploader.fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
]);
