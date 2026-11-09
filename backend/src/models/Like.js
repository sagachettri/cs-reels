import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reel: { type: mongoose.Schema.Types.ObjectId, ref: 'Reel', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// One like / save per user per reel, enforced by the database itself.
schema.index({ user: 1, reel: 1 }, { unique: true });
schema.index({ user: 1, createdAt: -1 });
schema.index({ reel: 1 });

export const Like = mongoose.model('Like', schema);
