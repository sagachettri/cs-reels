import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import {
  app, env, Reel,
  connectTestDb, clearTestDb, disconnectTestDb,
  loginAgent, makeCategory, makeReel,
} from './helpers.js';
import { startGeminiMock } from './mocks.js';
import { Quiz } from '../src/models/Quiz.js';
import { QuizAttempt } from '../src/models/QuizAttempt.js';
import { ActivityDay } from '../src/models/ActivityDay.js';
import { cacheClear } from '../src/services/ai/cache.js';
import { dayKey } from '../src/services/activityService.js';
import { runMigrations } from '../src/config/migrations.js';

// correct answers are [0, 1, 0]
const quizJson = {
  questions: [
    { question: 'What does binary search require?', options: ['Sorted data', 'Random data', 'A hash map', 'A graph'], correctIndex: 0, explanation: 'It halves a sorted range each step.' },
    { question: 'What is its time complexity?', options: ['O(n)', 'O(log n)', 'O(n^2)', 'O(1)'], correctIndex: 1, explanation: 'The range halves every step.' },
    { question: 'Which pointer moves after a smaller middle?', options: ['Left', 'Right', 'Neither', 'Both'], correctIndex: 0, explanation: 'Move left up when the target is larger.' },
  ],
};

describe('quizzes: difficulty, hidden answers, server-side scoring, history', () => {
  let gemini, admin, user, other, reel;
  const original = { ...env.ai };

  before(async () => {
    await connectTestDb();
    gemini = await startGeminiMock();
    env.ai.geminiBaseUrl = gemini.baseUrl;
  });
  after(async () => {
    Object.assign(env.ai, original);
    await gemini.close();
    await disconnectTestDb();
  });
  beforeEach(async () => {
    await clearTestDb();
    gemini.reset();
    cacheClear();
    env.ai.geminiApiKey = 'test_gemini_key';
    gemini.state.handler = () => ({ text: JSON.stringify(quizJson) });
    admin = await loginAgent({ role: 'admin' });
    user = await loginAgent({ role: 'user' });
    other = await loginAgent({ role: 'user' });
    const cat = await makeCategory('DSA', 'dsa');
    reel = await makeReel(cat, admin.user._id, { title: 'Binary search intuition', tags: ['search'] });
  });

  const start = (agent, difficulty) =>
    agent.post(`/api/ai/reels/${reel._id}/quiz`).send(difficulty ? { difficulty } : {});
  const submit = (agent, quizId, answers, extra = {}) =>
    agent.post(`/api/quizzes/${quizId}/submit`).send({ answers, ...extra });

  it('never sends correct answers or explanations before submission', async () => {
    const res = await start(user.agent);
    assert.equal(res.status, 200);
    const text = JSON.stringify(res.body);
    assert.equal(text.includes('correctIndex'), false);
    assert.equal(text.includes('explanation'), false);
    assert.equal(text.includes('It halves a sorted range'), false);
    const quiz = res.body.data.quiz;
    assert.equal(quiz.difficulty, 'medium');
    assert.ok(quiz.quizId);
    assert.equal(quiz.questions.length, 3);
    assert.equal(quiz.questions[0].options.length, 4);
    assert.deepEqual(res.body.data.previous, { attempts: 0, bestPercentage: null, lastAttemptAt: null });
  });

  it('keeps a separate stored quiz for each difficulty and asks the AI for the right level', async () => {
    for (const level of ['easy', 'medium', 'hard']) {
      const res = await start(user.agent, level);
      assert.equal(res.status, 200, level);
      assert.equal(res.body.data.quiz.difficulty, level);
    }
    assert.equal(await Quiz.countDocuments({ reel: reel._id }), 3);
    assert.equal(gemini.state.calls.length, 3);
    const prompts = gemini.state.calls.map((c) => c.body.contents[0].parts[0].text);
    assert.match(prompts[0], /Difficulty: Easy/);
    assert.match(prompts[1], /Difficulty: Medium/);
    assert.match(prompts[2], /Difficulty: Hard/);

    const again = await start(other.agent, 'hard');
    assert.equal(again.body.data.cached, true);
    assert.equal(gemini.state.calls.length, 3);

    assert.equal((await start(user.agent, 'impossible')).status, 400);
  });

  it('scores on the server: perfect, partial and zero', async () => {
    const quizId = (await start(user.agent)).body.data.quiz.quizId;

    const perfect = await submit(user.agent, quizId, [0, 1, 0]);
    assert.equal(perfect.status, 201);
    assert.equal(perfect.body.data.score, 3);
    assert.equal(perfect.body.data.total, 3);
    assert.equal(perfect.body.data.percentage, 100);
    assert.equal(perfect.body.data.attemptNumber, 1);
    assert.equal(perfect.body.data.bestPercentage, 100);
    const first = perfect.body.data.results[0];
    assert.equal(first.correct, true);
    assert.equal(first.correctIndex, 0);
    assert.equal(first.selectedIndex, 0);
    assert.match(first.explanation, /sorted range/);

    const partial = await submit(user.agent, quizId, [0, 0, 1]);
    assert.equal(partial.body.data.score, 1);
    assert.equal(partial.body.data.percentage, 33);
    assert.equal(partial.body.data.attemptNumber, 2);
    assert.equal(partial.body.data.bestPercentage, 100);
    assert.deepEqual(partial.body.data.results.map((r) => r.correct), [true, false, false]);

    const zero = await submit(user.agent, quizId, [3, 3, 3]);
    assert.equal(zero.body.data.score, 0);
    assert.equal(zero.body.data.attemptNumber, 3);

    assert.equal(await QuizAttempt.countDocuments({ user: user.user._id }), 3);
  });

  it('cannot be tricked into a higher score from the browser', async () => {
    const quizId = (await start(user.agent)).body.data.quiz.quizId;
    const res = await submit(user.agent, quizId, [3, 3, 3], { score: 3, percentage: 100, correctIndex: [3, 3, 3] });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.score, 0);
    const saved = await QuizAttempt.findOne({ user: user.user._id });
    assert.equal(saved.score, 0);
  });

  it('retry shows the best score so far and the retake count', async () => {
    const quizId = (await start(user.agent)).body.data.quiz.quizId;
    await submit(user.agent, quizId, [0, 0, 0]);
    const again = await start(user.agent);
    assert.equal(again.body.data.previous.attempts, 1);
    assert.equal(again.body.data.previous.bestPercentage, 67);
    assert.equal(again.body.data.quiz.quizId, quizId);
  });

  it('validates submissions', async () => {
    const quizId = (await start(user.agent)).body.data.quiz.quizId;

    const short = await submit(user.agent, quizId, [0, 1]);
    assert.equal(short.status, 400);
    assert.equal(short.body.error.code, 'ANSWERS_INCOMPLETE');

    assert.equal((await submit(user.agent, quizId, [0, 1, 4])).status, 400);
    assert.equal((await submit(user.agent, quizId, [0, 1, -1])).status, 400);
    assert.equal((await submit(user.agent, quizId, [0, 1, 1.5])).status, 400);
    assert.equal((await submit(user.agent, quizId, ['0', '1', '0'])).status, 400);
    assert.equal((await submit(user.agent, quizId, [])).status, 400);
    assert.equal((await submit(user.agent, quizId, [0, 1, 0], { tzOffset: 5000 })).status, 400);
    assert.equal((await submit(user.agent, 'not-an-id', [0, 1, 0])).status, 400);
    assert.equal((await submit(user.agent, new mongoose.Types.ObjectId().toString(), [0, 1, 0])).status, 404);
    assert.equal((await request(app).post(`/api/quizzes/${quizId}/submit`).send({ answers: [0, 1, 0] })).status, 401);
    assert.equal(await QuizAttempt.countDocuments(), 0);
  });

  it('refuses to start or submit a quiz for an unpublished reel', async () => {
    const quizId = (await start(user.agent)).body.data.quiz.quizId;
    await Reel.updateOne({ _id: reel._id }, { status: 'draft' });
    assert.equal((await start(user.agent)).status, 404);
    assert.equal((await submit(user.agent, quizId, [0, 1, 0])).status, 404);
  });

  it('requires login to start a quiz', async () => {
    assert.equal((await request(app).post(`/api/ai/reels/${reel._id}/quiz`).send({})).status, 401);
  });

  it('keeps a private history, newest first, with paging and a per-reel filter', async () => {
    const cat2 = await makeCategory('Web', 'web');
    const reel2 = await makeReel(cat2, admin.user._id, { title: 'How REST works' });
    const quizId = (await start(user.agent)).body.data.quiz.quizId;
    for (const answers of [[0, 1, 0], [0, 0, 0], [1, 1, 1]]) await submit(user.agent, quizId, answers);
    await QuizAttempt.create({
      user: user.user._id, quiz: new mongoose.Types.ObjectId(), reel: reel2._id, category: cat2._id,
      difficulty: 'easy', score: 2, total: 3, answers: [0, 0, 0],
    });
    await submit(other.agent, quizId, [0, 1, 0]);

    const page1 = await user.agent.get('/api/quizzes/attempts?limit=3&page=1');
    assert.equal(page1.status, 200);
    assert.equal(page1.body.data.pagination.total, 4);
    assert.equal(page1.body.data.attempts.length, 3);
    assert.equal(page1.body.data.attempts[0].reel.title, 'How REST works');
    assert.equal(page1.body.data.attempts[0].percentage, 67);
    assert.equal(page1.body.data.pagination.hasMore, true);

    const forReel = await user.agent.get(`/api/quizzes/attempts?reel=${reel._id}`);
    assert.equal(forReel.body.data.attempts.length, 3);
    assert.ok(forReel.body.data.attempts.every((a) => a.reel.title === 'Binary search intuition'));

    const otherHistory = await other.agent.get('/api/quizzes/attempts');
    assert.equal(otherHistory.body.data.attempts.length, 1);
    assert.equal((await request(app).get('/api/quizzes/attempts')).status, 401);
  });

  it('counts quiz activity for the student\'s own local day', async () => {
    const quizId = (await start(user.agent)).body.data.quiz.quizId;
    await submit(user.agent, quizId, [0, 1, 0], { tzOffset: 330 });
    await submit(user.agent, quizId, [0, 1, 0], { tzOffset: 330 });
    const row = await ActivityDay.findOne({ user: user.user._id });
    assert.equal(row.day, dayKey(new Date(), 330));
    assert.equal(row.quizzes, 2);
  });

  it('upgrades Round 2 data: old quizzes become "medium" and a second difficulty can be stored', async () => {
    // Recreate the Round 2 situation: unique index on reel only, quiz without a difficulty field.
    await Quiz.collection.dropIndexes();
    await Quiz.collection.createIndex({ reel: 1 }, { unique: true, name: 'reel_1' });
    await Quiz.collection.insertOne({
      reel: reel._id, contentHash: 'legacy', model: 'old',
      questions: quizJson.questions, createdAt: new Date(), updatedAt: new Date(),
    });
    await assert.rejects(Quiz.collection.insertOne({ reel: reel._id, contentHash: 'x', questions: [] }));

    await runMigrations();
    await runMigrations(); // safe to run again

    const legacy = await Quiz.findOne({ contentHash: 'legacy' }).lean();
    assert.equal(legacy.difficulty, 'medium');
    const names = (await Quiz.collection.indexes()).map((i) => i.name);
    assert.equal(names.includes('reel_1'), false);
    assert.equal(names.includes('reel_1_difficulty_1'), true);

    await Quiz.create({ reel: reel._id, difficulty: 'easy', contentHash: 'new', questions: quizJson.questions });
    assert.equal(await Quiz.countDocuments({ reel: reel._id }), 2);
  });
});
