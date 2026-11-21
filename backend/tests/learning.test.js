import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import {
  app, Reel,
  connectTestDb, clearTestDb, disconnectTestDb,
  loginAgent, makeCategory, makeReel,
} from './helpers.js';
import { ReelView } from '../src/models/ReelView.js';
import { ActivityDay } from '../src/models/ActivityDay.js';
import { QuizAttempt } from '../src/models/QuizAttempt.js';
import { Like } from '../src/models/Like.js';
import { SavedReel } from '../src/models/SavedReel.js';
import { dayKey, computeStreaks } from '../src/services/activityService.js';

const daysAgo = (n, offset = 0) => dayKey(new Date(Date.now() - n * 86400000), offset);

describe('learning activity, recommendations and progress', () => {
  let admin, user, other, dsa, web;

  before(connectTestDb);
  after(disconnectTestDb);
  beforeEach(async () => {
    await clearTestDb();
    admin = await loginAgent({ role: 'admin' });
    user = await loginAgent({ role: 'user' });
    other = await loginAgent({ role: 'user' });
    dsa = await makeCategory('DSA', 'dsa');
    web = await makeCategory('Web Development', 'web-development');
  });

  describe('watch tracking', () => {
    it('records real views, keeps the best watch time, and completion sticks', async () => {
      const reel = await makeReel(dsa, admin.user._id);
      const url = `/api/reels/${reel._id}/view`;

      const first = await user.agent.post(url).send({ watchedSec: 12 });
      assert.equal(first.status, 200);
      assert.equal(first.body.data.viewCount, 1);

      const second = await user.agent.post(url).send({ watchedSec: 5, completed: true });
      assert.equal(second.body.data.viewCount, 2);
      assert.equal(second.body.data.completed, true);

      const third = await user.agent.post(url).send({ watchedSec: 30 });
      assert.equal(third.body.data.completed, true);

      const row = await ReelView.findOne({ user: user.user._id, reel: reel._id });
      assert.equal(row.viewCount, 3);
      assert.equal(row.maxWatchSec, 30);
      assert.equal(await ReelView.countDocuments(), 1);
    });

    it('counts the day in the student\'s own time zone', async () => {
      const reel = await makeReel(dsa, admin.user._id);
      await user.agent.post(`/api/reels/${reel._id}/view`).send({ watchedSec: 4, tzOffset: 330 });
      const row = await ActivityDay.findOne({ user: user.user._id });
      assert.equal(row.day, dayKey(new Date(), 330));
      assert.equal(row.views, 1);
    });

    it('needs login, a published reel, and valid data', async () => {
      const reel = await makeReel(dsa, admin.user._id);
      const draft = await makeReel(dsa, admin.user._id, { status: 'draft' });
      assert.equal((await request(app).post(`/api/reels/${reel._id}/view`).send({})).status, 401);
      assert.equal((await user.agent.post(`/api/reels/${draft._id}/view`).send({})).status, 404);
      assert.equal((await user.agent.post('/api/reels/nope/view').send({})).status, 400);
      assert.equal((await user.agent.post(`/api/reels/${reel._id}/view`).send({ watchedSec: -1 })).status, 400);
      assert.equal((await user.agent.post(`/api/reels/${reel._id}/view`).send({ watchedSec: 99999 })).status, 400);
      assert.equal((await user.agent.post(`/api/reels/${reel._id}/view`).send({ completed: 'yes' })).status, 400);
      assert.equal(await ReelView.countDocuments(), 0);
    });
  });

  describe('recommendations', () => {
    it('gives guests popular and new reels, without personal flags', async () => {
      await makeReel(dsa, admin.user._id, { likesCount: 5 });
      await makeReel(web, admin.user._id, { status: 'draft' });
      const res = await request(app).get('/api/reels/recommended');
      assert.equal(res.status, 200);
      assert.equal(res.body.data.personalized, false);
      assert.equal(res.body.data.reels.length, 1);
      assert.ok(res.body.data.reels[0].reason);
      assert.equal(res.body.data.reels[0].liked, false);
    });

    it('treats a brand-new student as not personalised yet', async () => {
      await makeReel(dsa, admin.user._id);
      const res = await user.agent.get('/api/reels/recommended');
      assert.equal(res.body.data.personalized, false);
      assert.match(res.body.data.reels[0].reason, /New on CS Reels|Popular on CS Reels/);
    });

    it('ranks by what the student really likes, saves and watches, and explains why', async () => {
      const a1 = await makeReel(dsa, admin.user._id, { title: 'Reel A1', tags: ['arrays'] });
      const a2 = await makeReel(dsa, admin.user._id, { title: 'Reel A2', tags: ['arrays', 'sorting'] });
      const a3 = await makeReel(dsa, admin.user._id, { title: 'Reel A3', tags: ['graphs'] });
      const b1 = await makeReel(web, admin.user._id, { title: 'Reel B1', tags: ['css'] });
      await makeReel(dsa, admin.user._id, { title: 'Hidden draft', status: 'draft', tags: ['arrays'] });

      await Like.create({ user: user.user._id, reel: a1._id });
      await SavedReel.create({ user: user.user._id, reel: a1._id });
      await ReelView.create({ user: user.user._id, reel: a1._id, viewCount: 2, completed: true });

      const res = await user.agent.get('/api/reels/recommended');
      assert.equal(res.status, 200);
      assert.equal(res.body.data.personalized, true);
      const titles = res.body.data.reels.map((r) => r.title);
      assert.deepEqual(titles, ['Reel A2', 'Reel A3', 'Reel B1', 'Reel A1']);
      assert.equal(titles.includes('Hidden draft'), false);

      const byTitle = Object.fromEntries(res.body.data.reels.map((r) => [r.title, r]));
      assert.equal(byTitle['Reel A2'].reason, 'Because you engage with #arrays');
      assert.equal(byTitle['Reel A3'].reason, 'Because you like DSA reels');
      assert.equal(byTitle['Reel B1'].reason, 'Something new to explore');
      assert.equal(byTitle['Reel A1'].reason, 'Watch again to revise');
      assert.equal(byTitle['Reel A1'].liked, true);
      assert.ok(a2 && a3 && b1);
    });

    it('steers a student back to topics where quiz scores are low', async () => {
      const a1 = await makeReel(dsa, admin.user._id, { title: 'Reel A1', tags: ['arrays'] });
      await makeReel(dsa, admin.user._id, { title: 'Reel A2', tags: ['arrays'] });
      await makeReel(web, admin.user._id, { title: 'Reel B1', tags: ['css'] });
      await Like.create({ user: user.user._id, reel: a1._id });
      await QuizAttempt.create({
        user: user.user._id, quiz: new mongoose.Types.ObjectId(), reel: (await makeReel(web, admin.user._id, { status: 'draft' }))._id,
        category: web._id, difficulty: 'medium', score: 1, total: 5, answers: [0, 0, 0, 0, 0],
      });

      const res = await user.agent.get('/api/reels/recommended');
      const b1 = res.body.data.reels.find((r) => r.title === 'Reel B1');
      assert.equal(b1.reason, 'Strengthen Web Development: your quiz average there is 20%');
      assert.equal(res.body.data.reels[0].title, 'Reel B1');
    });

    it('does not treat the route as a reel id, and paginates', async () => {
      for (let i = 0; i < 5; i += 1) await makeReel(dsa, admin.user._id);
      const p1 = await user.agent.get('/api/reels/recommended?limit=2&page=1');
      const p3 = await user.agent.get('/api/reels/recommended?limit=2&page=3');
      assert.equal(p1.status, 200);
      assert.equal(p1.body.data.reels.length, 2);
      assert.equal(p1.body.data.pagination.total, 5);
      assert.equal(p1.body.data.pagination.hasMore, true);
      assert.equal(p3.body.data.reels.length, 1);
      assert.equal((await user.agent.get('/api/reels/recommended?limit=99')).status, 400);
    });

    it('is personal: another student gets a different ranking', async () => {
      const a = await makeReel(dsa, admin.user._id, { title: 'Reel A', tags: ['arrays'] });
      await makeReel(dsa, admin.user._id, { title: 'Reel A-next', tags: ['arrays'] });
      const w = await makeReel(web, admin.user._id, { title: 'Reel W', tags: ['css'] });
      await makeReel(web, admin.user._id, { title: 'Reel W-next', tags: ['css'] });
      await Like.create({ user: user.user._id, reel: a._id });
      await Like.create({ user: other.user._id, reel: w._id });
      const mine = (await user.agent.get('/api/reels/recommended')).body.data.reels.map((r) => r.title);
      const theirs = (await other.agent.get('/api/reels/recommended')).body.data.reels.map((r) => r.title);
      assert.equal(mine[0], 'Reel A-next');
      assert.equal(theirs[0], 'Reel W-next');
    });
  });

  describe('progress dashboard', () => {
    it('requires login and validates the time zone', async () => {
      assert.equal((await request(app).get('/api/progress')).status, 401);
      assert.equal((await user.agent.get('/api/progress?tzOffset=9999')).status, 400);
    });

    it('shows honest zeros for a student with no activity', async () => {
      await makeReel(dsa, admin.user._id);
      const res = await user.agent.get('/api/progress');
      assert.equal(res.status, 200);
      const { summary, categories, weekly, recentAttempts } = res.body.data;
      assert.deepEqual(
        { w: summary.reelsWatched, q: summary.quizzesAttempted, avg: summary.averageScore, s: summary.currentStreak, l: summary.savedCount },
        { w: 0, q: 0, avg: null, s: 0, l: 0 }
      );
      assert.equal(weekly.length, 7);
      assert.ok(weekly.every((d) => d.views === 0 && d.quizzes === 0));
      assert.equal(categories.find((c) => c.slug === 'dsa').totalReels, 1);
      assert.equal(categories.find((c) => c.slug === 'dsa').status, 'not-started');
      assert.deepEqual(recentAttempts, []);
    });

    it('counts exactly what the student did, per topic', async () => {
      const a1 = await makeReel(dsa, admin.user._id, { title: 'Reel A1' });
      const a2 = await makeReel(dsa, admin.user._id, { title: 'Reel A2' });
      const b1 = await makeReel(web, admin.user._id, { title: 'Reel B1' });
      const hidden = await makeReel(web, admin.user._id, { title: 'Hidden', status: 'draft' });

      await ReelView.create({ user: user.user._id, reel: a1._id, viewCount: 3, completed: true });
      await ReelView.create({ user: user.user._id, reel: b1._id, viewCount: 1 });
      await ReelView.create({ user: user.user._id, reel: hidden._id, viewCount: 1 }); // unpublished: not counted
      await ReelView.create({ user: other.user._id, reel: a2._id, viewCount: 1 }); // someone else's
      await Like.create({ user: user.user._id, reel: a1._id });
      await SavedReel.create({ user: user.user._id, reel: a2._id });
      const quiz = new mongoose.Types.ObjectId();
      const base = { user: user.user._id, quiz, difficulty: 'medium', total: 5, answers: [0, 0, 0, 0, 0] };
      await QuizAttempt.create({ ...base, reel: a1._id, category: dsa._id, score: 4 });
      await QuizAttempt.create({ ...base, reel: b1._id, category: web._id, score: 1 });

      const res = await user.agent.get('/api/progress');
      const { summary, categories, recentAttempts } = res.body.data;
      assert.equal(summary.reelsWatched, 2);
      assert.equal(summary.reelsCompleted, 1);
      assert.equal(summary.watchEvents, 4);
      assert.equal(summary.quizzesAttempted, 2);
      assert.equal(summary.distinctQuizzes, 1);
      assert.equal(summary.averageScore, 50);
      assert.equal(summary.bestScore, 80);
      assert.equal(summary.savedCount, 1);
      assert.equal(summary.likedCount, 1);

      const d = categories.find((c) => c.slug === 'dsa');
      const w = categories.find((c) => c.slug === 'web-development');
      assert.deepEqual({ t: d.totalReels, w: d.watched, avg: d.averageScore, st: d.status }, { t: 2, w: 1, avg: 80, st: 'strong' });
      assert.deepEqual({ t: w.totalReels, w: w.watched, avg: w.averageScore, st: w.status }, { t: 1, w: 1, avg: 20, st: 'needs-practice' });
      assert.equal(recentAttempts.length, 2);
      assert.equal(recentAttempts[0].percentage, 20);
    });

    it('builds the 7-day chart and the streak from real activity days', async () => {
      const keys = (n) => daysAgo(n);
      await ActivityDay.create([
        { user: user.user._id, day: keys(0), views: 2, quizzes: 1 },
        { user: user.user._id, day: keys(1), views: 1, quizzes: 0 },
        { user: user.user._id, day: keys(2), views: 0, quizzes: 1 },
        { user: user.user._id, day: keys(10), views: 4, quizzes: 0 },
        { user: user.user._id, day: keys(11), views: 1, quizzes: 0 },
        { user: user.user._id, day: keys(12), views: 1, quizzes: 0 },
        { user: user.user._id, day: keys(13), views: 1, quizzes: 0 },
      ]);
      const res = await user.agent.get('/api/progress');
      const { summary, weekly } = res.body.data;
      assert.equal(summary.currentStreak, 3);
      assert.equal(summary.longestStreak, 4);
      assert.equal(summary.activeDays, 7);
      assert.equal(weekly[6].date, keys(0));
      assert.deepEqual({ v: weekly[6].views, q: weekly[6].quizzes }, { v: 2, q: 1 });
      assert.deepEqual({ v: weekly[4].views, q: weekly[4].quizzes }, { v: 0, q: 1 });
      assert.equal(weekly[0].views, 0);
    });

    it('keeps yesterday\'s streak alive until the student studies today', async () => {
      await ActivityDay.create([
        { user: user.user._id, day: daysAgo(1), views: 1 },
        { user: user.user._id, day: daysAgo(2), views: 1 },
      ]);
      const res = await user.agent.get('/api/progress');
      assert.equal(res.body.data.summary.currentStreak, 2);
    });
  });

  describe('streak calculation', () => {
    it('handles gaps, today, and empty history', () => {
      assert.deepEqual(computeStreaks([], '2026-11-10'), { current: 0, longest: 0 });
      assert.deepEqual(computeStreaks(['2026-11-10', '2026-11-09', '2026-11-08'], '2026-11-10'), { current: 3, longest: 3 });
      assert.deepEqual(computeStreaks(['2026-11-09', '2026-11-08'], '2026-11-10'), { current: 2, longest: 2 });
      assert.deepEqual(computeStreaks(['2026-11-07', '2026-11-05', '2026-11-04'], '2026-11-10'), { current: 0, longest: 2 });
      assert.deepEqual(computeStreaks(['2026-11-30', '2026-12-01'], '2026-12-01'), { current: 2, longest: 2 });
    });
  });

  describe('transcript and notes', () => {
    it('is stored by admins, shown on the reel page, and not repeated in long lists', async () => {
      const reel = await makeReel(dsa, admin.user._id);
      const text = 'Binary search compares the middle element first.';
      const patch = await admin.agent.patch(`/api/admin/reels/${reel._id}`).send({ transcript: text });
      assert.equal(patch.status, 200);

      const one = await request(app).get(`/api/reels/${reel._id}`);
      assert.equal(one.body.data.reel.transcript, text);
      assert.equal(one.body.data.reel.hasTranscript, true);

      const feed = await request(app).get('/api/reels');
      assert.equal(feed.body.data.reels[0].hasTranscript, true);
      assert.equal('transcript' in feed.body.data.reels[0], false);

      const adminList = await admin.agent.get('/api/admin/reels');
      assert.equal(adminList.body.data.reels[0].transcript, text);

      assert.equal((await admin.agent.patch(`/api/admin/reels/${reel._id}`).send({ transcript: 'x'.repeat(4001) })).status, 400);
    });

    it('deleting a reel also removes its views and quiz attempts', async () => {
      const reel = await makeReel(dsa, admin.user._id);
      await ReelView.create({ user: user.user._id, reel: reel._id });
      await QuizAttempt.create({
        user: user.user._id, quiz: new mongoose.Types.ObjectId(), reel: reel._id, category: dsa._id,
        difficulty: 'easy', score: 1, total: 3, answers: [0, 0, 0],
      });
      await admin.agent.delete(`/api/admin/reels/${reel._id}`);
      assert.equal(await ReelView.countDocuments(), 0);
      assert.equal(await QuizAttempt.countDocuments(), 0);
      assert.equal(await Reel.countDocuments(), 0);
    });

    it('shows view and quiz totals to admins', async () => {
      const reel = await makeReel(dsa, admin.user._id);
      await ReelView.create({ user: user.user._id, reel: reel._id });
      const res = await admin.agent.get('/api/admin/stats');
      assert.equal(res.body.data.stats.reelViews, 1);
      assert.equal(res.body.data.stats.quizAttempts, 0);
    });
  });
});
