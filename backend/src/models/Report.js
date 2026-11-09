import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    reel: { type: mongoose.Schema.Types.ObjectId, ref: 'Reel', required: true },
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: {
      type: String,
      enum: ['inaccurate', 'copyright', 'inappropriate', 'broken-media', 'other'],
      required: true,
    },
    details: { type: String, trim: true, maxlength: 500, default: '' },
    status: { type: String, enum: ['open', 'reviewed', 'dismissed', 'actioned'], default: 'open' },
  },
  { timestamps: true }
);

reportSchema.index({ reel: 1, reporter: 1 }, { unique: true });
reportSchema.index({ status: 1, createdAt: -1 });

export const Report = mongoose.model('Report', reportSchema);
