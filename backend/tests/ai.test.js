import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {
  app, env, Reel,
  connectTestDb, clearTestDb, disconnectTestDb,
  loginAgent, makeCategory, makeReel,
} from './helpers.js';
import { startGeminiMock } from './mocks.js';
import { Quiz } from '../src/models/Quiz.js';
import { cacheClear } from '../src/services/ai/cache.js';

const goodQuiz = {
  questions: [
    { question: 'What does binary search require?', options: ['Sorted data', 'Random data', 'A hash map', 'A graph'], correctIndex: 0, explanation: 'It halves a sorted range each step.' },
    { question: 'What is its time complexity?', options: ['O(n)', 'O(log n)', 'O(n^2)', 'O(1)'], correctIndex: 1, explanation: 'The range halves every step.' },
    { question: 'Which pointer moves after a smaller middle?', options: ['Left', 'Right', 'Neither', 'Both'], correctIndex: 0, explanation: 'Move left up when the target is larger.' },
  ],
};

describe('AI features (provider mocked, real validation and caching)', () => {
  let gemini, admin, user, reel;
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
    admin = await loginAgent({ role: 'admin' });
    user = await loginAgent({ role: 'user' });
    const cat = await makeCategory('DSA', 'dsa');
    reel = await makeReel(cat, admin.user._id, { title: 'Binary search intuition', tags: ['search'] });
  });

  it('requires login', async () => {
    const res = await request(app).post(`/api/ai/reels/${reel._id}/explain`).send({});
    assert.equal(res.status, 401);
  });

  it('reports a clear error when the AI key is missing', async () => {
    env.ai.geminiApiKey = '';
    const res = await user.agent.post(`/api/ai/reels/${reel._id}/explain`).send({ mode: 'simple' });
    assert.equal(res.status, 503);
    assert.equal(res.body.error.code, 'AI_NOT_CONFIGURED');
  });

  it('explains a reel from its text only, sends the key in a header, and caches the answer', async () => {
    gemini.state.handler = () => ({ text: 'Binary search halves the range each step.' });

    const first = await user.agent.post(`/api/ai/reels/${reel._id}/explain`).send({ mode: 'simple' });
    assert.equal(first.status, 200);
    assert.equal(first.body.data.explanation, 'Binary search halves the range each step.');
    assert.equal(first.body.data.cached, false);
    assert.ok(first.body.data.basedOn.includes('description'));

    const call = gemini.state.calls[0];
    assert.equal(call.key, 'test_gemini_key');
    const prompt = call.body.contents[0].parts[0].text;
    assert.match(prompt, /Binary search intuition/);
    assert.match(call.body.systemInstruction.parts[0].text, /cannot see or hear the video/);

    const second = await user.agent.post(`/api/ai/reels/${reel._id}/explain`).send({ mode: 'simple' });
    assert.equal(second.body.data.cached, true);
    assert.equal(gemini.state.calls.length, 1);

    await user.agent.post(`/api/ai/reels/${reel._id}/explain`).send({ mode: 'detailed' });
    assert.equal(gemini.state.calls.length, 2);

    assert.equal((await user.agent.post(`/api/ai/reels/${reel._id}/explain`).send({ mode: 'weird' })).status, 400);
  });

  it('summarizes a reel', async () => {
    gemini.state.handler = () => ({ text: 'You learn how to search sorted data fast.' });
    const res = await user.agent.post(`/api/ai/reels/${reel._id}/summary`).send({});
    assert.equal(res.status, 200);
    assert.match(res.body.data.summary, /search sorted data/);
  });

  it('does not use AI on drafts or unknown reels', async () => {
    await Reel.updateOne({ _id: reel._id }, { status: 'draft' });
    assert.equal((await user.agent.post(`/api/ai/reels/${reel._id}/explain`).send({})).status, 404);
    assert.equal((await user.agent.post('/api/ai/reels/64b64b64b64b64b64b64b64b/quiz').send({})).status, 404);
    assert.equal(gemini.state.calls.length, 0);
  });

  it('generates, validates, stores and reuses a quiz', async () => {
    gemini.state.handler = () => ({ text: JSON.stringify(goodQuiz) });

    const res = await user.agent.post(`/api/ai/reels/${reel._id}/quiz`).send({});
    assert.equal(res.status, 200);
    assert.equal(res.body.data.quiz.questions.length, 3);
    assert.equal(res.body.data.quiz.questions[0].options.length, 4);
    assert.equal(res.body.data.cached, false);
    assert.equal(gemini.state.calls[0].body.generationConfig.responseMimeType, 'application/json');
    assert.equal(await Quiz.countDocuments(), 1);

    const again = await user.agent.post(`/api/ai/reels/${reel._id}/quiz`).send({});
    assert.equal(again.body.data.cached, true);
    assert.equal(gemini.state.calls.length, 1);

    // Editing the reel text invalidates the stored quiz.
    await admin.agent.patch(`/api/admin/reels/${reel._id}`).send({ description: 'Completely rewritten description text.' });
    const regenerated = await user.agent.post(`/api/ai/reels/${reel._id}/quiz`).send({});
    assert.equal(regenerated.body.data.cached, false);
    assert.equal(gemini.state.calls.length, 2);
    assert.equal(await Quiz.countDocuments(), 1);
  });

  it('accepts JSON wrapped in a code fence and trims extra questions', async () => {
    const six = { questions: [...goodQuiz.questions, ...goodQuiz.questions] };
    gemini.state.handler = () => ({ text: '```json\n' + JSON.stringify(six) + '\n```' });
    const res = await user.agent.post(`/api/ai/reels/${reel._id}/quiz`).send({});
    assert.equal(res.status, 200);
    assert.equal(res.body.data.quiz.questions.length, 5);
  });

  it('retries once when the first AI answer is malformed', async () => {
    gemini.state.handler = (body, n) => (n === 1 ? { text: 'not json at all' } : { text: JSON.stringify(goodQuiz) });
    const res = await user.agent.post(`/api/ai/reels/${reel._id}/quiz`).send({});
    assert.equal(res.status, 200);
    assert.equal(gemini.state.calls.length, 2);
  });

  it('fails cleanly (502) when the AI keeps returning invalid quizzes, and stores nothing', async () => {
    const broken = { questions: [{ question: 'Only one?', options: ['a', 'b'], correctIndex: 9, explanation: 'x' }] };
    gemini.state.handler = () => ({ text: JSON.stringify(broken) });
    const res = await user.agent.post(`/api/ai/reels/${reel._id}/quiz`).send({});
    assert.equal(res.status, 502);
    assert.equal(res.body.error.code, 'AI_BAD_RESPONSE');
    assert.equal(gemini.state.calls.length, 2);
    assert.equal(await Quiz.countDocuments(), 0);
  });

  it('maps provider errors to friendly messages', async () => {
    gemini.state.handler = () => ({ status: 429 });
    const limited = await user.agent.post(`/api/ai/reels/${reel._id}/explain`).send({});
    assert.equal(limited.status, 429);
    assert.equal(limited.body.error.code, 'AI_RATE_LIMITED');

    gemini.state.handler = () => ({ status: 500 });
    const down = await user.agent.post(`/api/ai/reels/${reel._id}/summary`).send({});
    assert.equal(down.status, 502);
    assert.equal(down.body.error.code, 'AI_UNAVAILABLE');
    assert.equal(JSON.stringify(down.body).includes('mock error'), false);
  });

  it('answers chat questions, keeps the conversation, and validates input', async () => {
    gemini.state.handler = () => ({ text: 'A process has its own memory; threads share it.' });
    const messages = [
      { role: 'user', content: 'What is a thread?' },
      { role: 'assistant', content: 'A thread is a unit of execution.' },
      { role: 'user', content: 'How is it different from a process?' },
    ];
    const res = await user.agent.post('/api/ai/chat').send({ messages });
    assert.equal(res.status, 200);
    assert.match(res.body.data.reply, /threads share/);

    const sent = gemini.state.calls[0].body;
    assert.deepEqual(sent.contents.map((c) => c.role), ['user', 'model', 'user']);
    assert.match(sent.systemInstruction.parts[0].text, /Computer Science/);

    const endsWithAssistant = await user.agent.post('/api/ai/chat').send({ messages: messages.slice(0, 2) });
    assert.equal(endsWithAssistant.status, 400);
    assert.equal((await user.agent.post('/api/ai/chat').send({ messages: [] })).status, 400);
    assert.equal((await user.agent.post('/api/ai/chat').send({ messages: [{ role: 'user', content: 'x'.repeat(1001) }] })).status, 400);
    assert.equal((await user.agent.post('/api/ai/chat').send({ messages: [{ role: 'system', content: 'hi' }] })).status, 400);
    assert.equal((await request(app).post('/api/ai/chat').send({ messages })).status, 401);
  });
});
