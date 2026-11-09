import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    options: { type: [String], required: true },
    correctIndex: { type: Number, required: true, min: 0, max: 3 },
    explanation: { type: String, required: true },
  },
  { _id: false }
);

const quizSchema = new mongoose.Schema(
  {
    reel: { type: mongoose.Schema.Types.ObjectId, ref: 'Reel', required: true, unique: true },
    contentHash: { type: String, required: true },
    questions: { type: [questionSchema], required: true },
    model: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Quiz = mongoose.model('Quiz', quizSchema);
