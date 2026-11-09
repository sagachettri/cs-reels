import mongoose from 'mongoose';

const resourceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    url: { type: String, required: true, trim: true, maxlength: 500 },
    type: { type: String, enum: ['docs', 'article', 'practice', 'video'], default: 'article' },
  },
  { _id: false }
);

const reelSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 500 },
    videoUrl: { type: String, required: true },
    videoFileId: { type: String, required: true },
    thumbnailUrl: { type: String, default: '' },
    thumbnailFileId: { type: String, default: '' },
    durationSec: { type: Number, min: 0 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    tags: {
      type: [{ type: String, trim: true, lowercase: true, maxlength: 30 }],
      default: [],
      validate: { validator: (v) => v.length <= 8, message: 'A reel can have at most 8 tags.' },
    },
    level: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
    keyTakeaway: { type: String, trim: true, maxlength: 300, default: '' },
    resources: {
      type: [resourceSchema],
      default: [],
      validate: { validator: (v) => v.length <= 5, message: 'A reel can have at most 5 resources.' },
    },
    creditName: { type: String, trim: true, maxlength: 80, default: '' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['draft', 'published', 'removed'], default: 'draft' },
    likesCount: { type: Number, default: 0, min: 0 },
    savesCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

reelSchema.index({ status: 1, createdAt: -1 });
reelSchema.index({ category: 1, status: 1, createdAt: -1 });
reelSchema.index({ tags: 1 });

export const Reel = mongoose.model('Reel', reelSchema);
