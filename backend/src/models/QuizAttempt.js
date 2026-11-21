import mongoose from 'mongoose';

const attemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    reel: { type: mongoose.Schema.Types.ObjectId, ref: 'Reel', required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
    score: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 1 },
    answers: { type: [Number], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

attemptSchema.index({ user: 1, createdAt: -1 });
attemptSchema.index({ user: 1, quiz: 1 });
attemptSchema.index({ reel: 1 });

export const QuizAttempt = mongoose.model('QuizAttempt', attemptSchema);
