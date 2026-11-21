import mongoose from 'mongoose';

// Daily activity counters per user. Powers the 7-day chart and the learning streak.
const activitySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // the user's local day, YYYY-MM-DD
    views: { type: Number, default: 0, min: 0 },
    quizzes: { type: Number, default: 0, min: 0 },
  },
  { timestamps: false }
);

activitySchema.index({ user: 1, day: 1 }, { unique: true });

export const ActivityDay = mongoose.model('ActivityDay', activitySchema);
