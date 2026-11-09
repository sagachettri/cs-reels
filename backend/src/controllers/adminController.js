import { Reel } from '../models/Reel.js';
import { Category } from '../models/Category.js';
import { Like } from '../models/Like.js';
import { SavedReel } from '../models/SavedReel.js';
import { Quiz } from '../models/Quiz.js';
import { Report } from '../models/Report.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess, buildPagination, escapeRegex, slugify } from '../utils/helpers.js';
import { reelPopulate, serializeReel } from '../services/reelService.js';
import { validateVideoFile, validateThumbnailFile } from '../services/fileChecks.js';
import { uploadFile, deleteFile, autoThumbnailUrl } from '../services/imagekitService.js';

// ---------------- stats ----------------
export async function getStats(req, res) {
  const [users, published, drafts, likes, saves, openReports, topReels, categories] = await Promise.all([
    User.countDocuments(),
    Reel.countDocuments({ status: 'published' }),
    Reel.countDocuments({ status: 'draft' }),
    Like.countDocuments(),
    SavedReel.countDocuments(),
    Report.countDocuments({ status: 'open' }),
    Reel.find({ status: 'published' }).sort({ likesCount: -1, savesCount: -1 }).limit(5).populate(reelPopulate).lean(),
    Category.countDocuments(),
  ]);

  return sendSuccess(res, {
    stats: { users, publishedReels: published, draftReels: drafts, likes, saves, openReports, categories },
    topReels: topReels.map((reel) => serializeReel(reel)),
  });
}

// ---------------- reels ----------------
export async function listAdminReels(req, res) {
  const { page, limit, status, q } = req.valid.query;
  const filter = {};
  if (status) filter.status = status;
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: pattern }, { description: pattern }, { tags: pattern }];
  }

  const [reels, total] = await Promise.all([
    Reel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate(reelPopulate)
      .lean(),
    Reel.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    reels: reels.map((reel) => serializeReel(reel)),
    pagination: buildPagination(page, limit, total),
  });
}

async function assertCategoryExists(id) {
  const exists = await Category.exists({ _id: id });
  if (!exists) throw new ApiError(400, 'CATEGORY_NOT_FOUND', 'The selected category does not exist.');
}

export async function createReel(req, res) {
  const data = req.valid.body;
  const videoFile = req.files?.video?.[0];
  const thumbFile = req.files?.thumbnail?.[0];

  // 1. Validate everything BEFORE anything is uploaded.
  const videoExt = validateVideoFile(videoFile);
  const thumbExt = validateThumbnailFile(thumbFile);
  await assertCategoryExists(data.category);

  const baseName = slugify(data.title).slice(0, 60) || 'reel';
  const uploaded = [];

  try {
    // 2. Upload to ImageKit.
    const video = await uploadFile({
      buffer: videoFile.buffer,
      mimetype: videoFile.mimetype,
      fileName: `${baseName}.${videoExt}`,
      tags: ['cs-reels', 'video'],
    });
    uploaded.push(video.fileId);

    let thumbnailUrl = autoThumbnailUrl(video.url);
    let thumbnailFileId = '';
    if (thumbFile) {
      const thumb = await uploadFile({
        buffer: thumbFile.buffer,
        mimetype: thumbFile.mimetype,
        fileName: `${baseName}-thumb.${thumbExt}`,
        tags: ['cs-reels', 'thumbnail'],
      });
      uploaded.push(thumb.fileId);
      thumbnailUrl = thumb.url;
      thumbnailFileId = thumb.fileId;
    }

    // 3. Save the database record only after the uploads succeeded.
    const reel = await Reel.create({
      ...data,
      videoUrl: video.url,
      videoFileId: video.fileId,
      thumbnailUrl,
      thumbnailFileId,
      uploadedBy: req.user._id,
    });

    const populated = await Reel.findById(reel._id).populate(reelPopulate).lean();
    return sendSuccess(res, { reel: serializeReel(populated) }, 201, 'Reel uploaded.');
  } catch (error) {
    // 4. Something failed: remove anything already uploaded so no orphan files remain.
    await Promise.all(uploaded.map((fileId) => deleteFile(fileId)));
    throw error;
  }
}

export async function updateReel(req, res) {
  const { id } = req.valid.params;
  const changes = req.valid.body;
  if (Object.keys(changes).length === 0) {
    throw new ApiError(400, 'NO_CHANGES', 'Send at least one field to update.');
  }
  if (changes.category) await assertCategoryExists(changes.category);

  const reel = await Reel.findById(id);
  if (!reel) throw new ApiError(404, 'REEL_NOT_FOUND', 'This reel was not found.');

  Object.assign(reel, changes);
  await reel.save();

  const populated = await Reel.findById(id).populate(reelPopulate).lean();
  return sendSuccess(res, { reel: serializeReel(populated) }, 200, 'Reel updated.');
}

export async function deleteReel(req, res) {
  const { id } = req.valid.params;
  const reel = await Reel.findById(id).lean();
  if (!reel) throw new ApiError(404, 'REEL_NOT_FOUND', 'This reel was not found.');

  await Promise.all([
    Reel.deleteOne({ _id: id }),
    Like.deleteMany({ reel: id }),
    SavedReel.deleteMany({ reel: id }),
    Quiz.deleteMany({ reel: id }),
    Report.deleteMany({ reel: id }),
  ]);

  // Best effort: the database is already consistent even if storage cleanup fails.
  await Promise.all([deleteFile(reel.videoFileId), deleteFile(reel.thumbnailFileId)]);

  return sendSuccess(res, null, 200, 'Reel deleted.');
}

// ---------------- categories ----------------
function serializeCategory(c) {
  return { id: String(c._id), name: c.name, slug: c.slug, description: c.description, order: c.order };
}

export async function createCategory(req, res) {
  const { name, description, order } = req.valid.body;
  const slug = slugify(name);
  if (!slug) throw new ApiError(400, 'VALIDATION_ERROR', 'Category name must contain letters or numbers.');

  const clash = await Category.findOne({ $or: [{ name }, { slug }] }).lean();
  if (clash) throw new ApiError(409, 'CATEGORY_EXISTS', 'A category with this name already exists.');

  const category = await Category.create({ name, slug, description: description || '', order: order ?? 0 });
  return sendSuccess(res, { category: serializeCategory(category) }, 201, 'Category created.');
}

export async function updateCategory(req, res) {
  const { id } = req.valid.params;
  const changes = { ...req.valid.body };
  if (Object.keys(changes).length === 0) {
    throw new ApiError(400, 'NO_CHANGES', 'Send at least one field to update.');
  }

  if (changes.name) {
    changes.slug = slugify(changes.name);
    const clash = await Category.findOne({
      _id: { $ne: id },
      $or: [{ name: changes.name }, { slug: changes.slug }],
    }).lean();
    if (clash) throw new ApiError(409, 'CATEGORY_EXISTS', 'A category with this name already exists.');
  }

  const category = await Category.findByIdAndUpdate(id, changes, { returnDocument: 'after', runValidators: true }).lean();
  if (!category) throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Category not found.');
  return sendSuccess(res, { category: serializeCategory(category) }, 200, 'Category updated.');
}

export async function deleteCategory(req, res) {
  const { id } = req.valid.params;
  const inUse = await Reel.countDocuments({ category: id });
  if (inUse > 0) {
    throw new ApiError(
      409,
      'CATEGORY_IN_USE',
      `This category is used by ${inUse} reel(s). Move or delete those reels first.`
    );
  }
  const result = await Category.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Category not found.');
  return sendSuccess(res, null, 200, 'Category deleted.');
}

// ---------------- reports ----------------
export async function listReports(req, res) {
  const { page, limit, status } = req.valid.query;
  const filter = status ? { status } : {};

  const [reports, total] = await Promise.all([
    Report.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('reel', 'title status')
      .populate('reporter', 'name email')
      .lean(),
    Report.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    reports: reports.map((r) => ({
      id: String(r._id),
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: r.createdAt,
      reel: r.reel ? { id: String(r.reel._id), title: r.reel.title, status: r.reel.status } : null,
      reporter: r.reporter ? { name: r.reporter.name, email: r.reporter.email } : null,
    })),
    pagination: buildPagination(page, limit, total),
  });
}

export async function updateReport(req, res) {
  const { id } = req.valid.params;
  const { status, unpublishReel } = req.valid.body;

  const report = await Report.findByIdAndUpdate(id, { status }, { returnDocument: 'after' }).lean();
  if (!report) throw new ApiError(404, 'REPORT_NOT_FOUND', 'Report not found.');

  if (unpublishReel) {
    await Reel.updateOne({ _id: report.reel }, { status: 'draft' });
  }
  return sendSuccess(res, null, 200, 'Report updated.');
}
