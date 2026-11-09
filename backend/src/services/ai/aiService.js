import crypto from 'node:crypto';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { Quiz } from '../../models/Quiz.js';
import * as gemini from './providers/gemini.js';
import { cacheGet, cacheSet } from './cache.js';
import {
  TUTOR_SYSTEM,
  QUIZ_SYSTEM,
  CHAT_SYSTEM,
  explainPrompt,
  summaryPrompt,
  quizPrompt,
} from './prompts.js';

// To switch provider later: add a file in ./providers exposing generate() and register it here.
const providers = { gemini };

function provider() {
  const selected = providers[env.ai.provider];
  if (!selected) {
    throw new ApiError(503, 'AI_NOT_CONFIGURED', `Unknown AI provider "${env.ai.provider}".`);
  }
  return selected;
}

export function contentHash(reel) {
  const material = JSON.stringify([reel.title, reel.description, reel.keyTakeaway, reel.tags, reel.level]);
  return crypto.createHash('sha256').update(material).digest('hex').slice(0, 16);
}

async function cachedText(reel, kind, promptBuilder) {
  const key = `${kind}:${reel._id}:${contentHash(reel)}`;
  const hit = cacheGet(key);
  if (hit) return { text: hit, cached: true };

  const text = await provider().generate({
    system: TUTOR_SYSTEM,
    messages: [{ role: 'user', content: promptBuilder() }],
    temperature: 0.4,
  });
  cacheSet(key, text);
  return { text, cached: false };
}

export function explainReel(reel, mode) {
  return cachedText(reel, `explain-${mode}`, () => explainPrompt(reel, mode));
}

export function summarizeReel(reel) {
  return cachedText(reel, 'summary', () => summaryPrompt(reel));
}

// ---------- quiz ----------
const questionSchema = z.object({
  question: z.string().trim().min(5).max(300),
  options: z
    .array(z.string().trim().min(1).max(200))
    .length(4)
    .refine((options) => new Set(options.map((o) => o.toLowerCase())).size === 4, 'Options must be different.'),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().trim().min(5).max(400),
});

const quizSchema = z.object({
  questions: z.preprocess(
    (value) => (Array.isArray(value) ? value.slice(0, 5) : value),
    z.array(questionSchema).min(3).max(5)
  ),
});

function parseQuiz(raw) {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return quizSchema.parse(JSON.parse(cleaned)).questions;
}

async function generateQuestions(reel) {
  let lastError;
  // One retry: models occasionally return malformed JSON.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const raw = await provider().generate({
      system: QUIZ_SYSTEM,
      messages: [{ role: 'user', content: quizPrompt(reel) }],
      json: true,
      temperature: attempt === 1 ? 0.5 : 0.2,
    });
    try {
      return parseQuiz(raw);
    } catch (error) {
      lastError = error;
    }
  }
  console.error('AI quiz output failed validation:', lastError?.message);
  throw new ApiError(502, 'AI_BAD_RESPONSE', 'The AI could not produce a valid quiz this time. Please try again.');
}

export async function getOrCreateQuiz(reel) {
  const hash = contentHash(reel);
  const existing = await Quiz.findOne({ reel: reel._id }).lean();
  if (existing && existing.contentHash === hash) {
    return { questions: existing.questions, cached: true };
  }

  const questions = await generateQuestions(reel);
  await Quiz.findOneAndUpdate(
    { reel: reel._id },
    { reel: reel._id, contentHash: hash, questions, model: env.ai.geminiModel },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
  return { questions, cached: false };
}

// ---------- chat ----------
export function chat(messages) {
  return provider().generate({ system: CHAT_SYSTEM, messages, temperature: 0.5 });
}
