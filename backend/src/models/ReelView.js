import mongoose from 'mongoose';

// One row per (user, reel): what the user has actually watched.
const viewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reel: { type: mongoose.Schema.Types.ObjectId, ref: 'Reel', required: true },
    viewCount: { type: Number, default: 0, min: 0 },
    maxWatchSec: { type: Number, default: 0, min: 0 },
    completed: { type: Boolean, default: false },
    firstViewedAt: { type: Date, default: Date.now },
    lastViewedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

viewSchema.index({ user: 1, reel: 1 }, { unique: true });
viewSchema.index({ user: 1, lastViewedAt: -1 });
viewSchema.index({ reel: 1 });

export const ReelView = mongoose.model('ReelView', viewSchema);
