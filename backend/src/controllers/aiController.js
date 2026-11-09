import { Reel } from '../models/Reel.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/helpers.js';
import { reelPopulate } from '../services/reelService.js';
import * as ai from '../services/ai/aiService.js';

const BASED_ON = ['title', 'description', 'key takeaway', 'tags'];

async function loadReel(id) {
  const reel = await Reel.findOne({ _id: id, status: 'published' }).populate(reelPopulate).lean();
  if (!reel) throw new ApiError(404, 'REEL_NOT_FOUND', 'This reel was not found.');
  return reel;
}

export async function explain(req, res) {
  const reel = await loadReel(req.valid.params.id);
  const { mode } = req.valid.body;
  const { text, cached } = await ai.explainReel(reel, mode);
  return sendSuccess(res, { explanation: text, mode, cached, basedOn: BASED_ON });
}

export async function summary(req, res) {
  const reel = await loadReel(req.valid.params.id);
  const { text, cached } = await ai.summarizeReel(reel);
  return sendSuccess(res, { summary: text, cached, basedOn: BASED_ON });
}

export async function quiz(req, res) {
  const reel = await loadReel(req.valid.params.id);
  const { questions, cached } = await ai.getOrCreateQuiz(reel);
  return sendSuccess(res, {
    quiz: {
      reelId: String(reel._id),
      questions: questions.map((q) => ({
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
      })),
    },
    cached,
    basedOn: BASED_ON,
  });
}

export async function chat(req, res) {
  const reply = await ai.chat(req.valid.body.messages);
  return sendSuccess(res, { reply });
}
