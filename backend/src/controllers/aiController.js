import { Reel } from '../models/Reel.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/helpers.js';
import { reelPopulate } from '../services/reelService.js';
import { toPublicQuiz, attemptSummary } from '../services/quizService.js';
import * as ai from '../services/ai/aiService.js';

const BASED_ON = ['title', 'description', 'key takeaway', 'tags', 'transcript or notes (if the admin added them)'];

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

// Starts a quiz. The answers and explanations are NOT included: they are revealed only after submission.
export async function quiz(req, res) {
  const reel = await loadReel(req.valid.params.id);
  const { difficulty } = req.valid.body;
  const { quiz: stored, cached } = await ai.getOrCreateQuiz(reel, difficulty);
  const previous = await attemptSummary(req.user._id, stored._id);
  return sendSuccess(res, { quiz: toPublicQuiz(stored), cached, previous, basedOn: BASED_ON });
}

// General CS tutor (not tied to a reel).
export async function chat(req, res) {
  const reply = await ai.chat(req.valid.body.messages);
  return sendSuccess(res, { reply });
}

// Follow-up conversation about one reel.
export async function reelChat(req, res) {
  const reel = await loadReel(req.valid.params.id);
  const reply = await ai.reelChat(reel, req.valid.body.messages);
  return sendSuccess(res, { reply, basedOn: BASED_ON });
}
