import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {
  app, env, Reel,
  connectTestDb, clearTestDb, disconnectTestDb,
  loginAgent, makeCategory, makeReel,
} from './helpers.js';
import { Like } from '../src/models/Like.js';
import { SavedReel } from '../src/models/SavedReel.js';

describe('feed, search, categories, likes, saves, reports', () => {
  let admin, user, dsa, web;

  before(connectTestDb);
  after(disconnectTestDb);
  beforeEach(async () => {
    await clearTestDb();
    admin = await loginAgent({ role: 'admin' });
    user = await loginAgent({ role: 'user' });
    dsa = await makeCategory('DSA', 'dsa');
    web = await makeCategory('Web Development', 'web-development');
  });

  it('returns an empty feed (not an error) when there are no reels', async () => {
    const res = await request(app).get('/api/reels');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.reels, []);
    assert.equal(res.body.data.pagination.total, 0);
    assert.equal(res.body.data.pagination.hasMore, false);
  });

  it('lets guests browse, paginates, and hides drafts', async () => {
    for (let i = 0; i < 12; i += 1) await makeReel(dsa, admin.user._id);
    await makeReel(dsa, admin.user._id, { status: 'draft', title: 'Secret draft reel' });

    const page1 = await request(app).get('/api/reels?limit=5&page=1');
    assert.equal(page1.status, 200);
    assert.equal(page1.body.data.reels.length, 5);
    assert.equal(page1.body.data.pagination.total, 12);
    assert.equal(page1.body.data.pagination.hasMore, true);

    const page3 = await request(app).get('/api/reels?limit=5&page=3');
    assert.equal(page3.body.data.reels.length, 2);
    assert.equal(page3.body.data.pagination.hasMore, false);

    const titles = [...page1.body.data.reels, ...page3.body.data.reels].map((r) => r.title);
    assert.equal(titles.includes('Secret draft reel'), false);

    const first = page1.body.data.reels[0];
    assert.equal(first.liked, false);
    assert.equal('videoFileId' in first, false);
  });

  it('filters by category and level, and 404s on an unknown category', async () => {
    await makeReel(dsa, admin.user._id, { level: 'beginner' });
    await makeReel(web, admin.user._id, { level: 'advanced' });

    const cat = await request(app).get('/api/reels?category=web-development');
    assert.equal(cat.body.data.reels.length, 1);
    assert.equal(cat.body.data.reels[0].category.slug, 'web-development');

    const level = await request(app).get('/api/reels?level=beginner');
    assert.equal(level.body.data.reels.length, 1);

    const unknown = await request(app).get('/api/reels?category=nope');
    assert.equal(unknown.status, 404);

    const badLimit = await request(app).get('/api/reels?limit=500');
    assert.equal(badLimit.status, 400);
  });

  it('searches title, description, tags and category name, safely', async () => {
    await makeReel(dsa, admin.user._id, { title: 'Binary search intuition', tags: ['search', 'arrays'] });
    await makeReel(web, admin.user._id, { title: 'How REST works', description: 'Understand HTTP verbs and resources.', tags: ['api'] });

    const byTitle = await request(app).get('/api/reels/search?q=binary');
    assert.equal(byTitle.body.data.reels.length, 1);

    const partial = await request(app).get('/api/reels/search?q=INTUI');
    assert.equal(partial.body.data.reels.length, 1);

    const byDescription = await request(app).get('/api/reels/search?q=verbs');
    assert.equal(byDescription.body.data.reels[0].title, 'How REST works');

    const byTag = await request(app).get('/api/reels/search?q=arrays');
    assert.equal(byTag.body.data.reels.length, 1);

    const byCategory = await request(app).get('/api/reels/search?q=web dev');
    assert.equal(byCategory.body.data.reels[0].title, 'How REST works');

    const none = await request(app).get('/api/reels/search?q=zzzzzz');
    assert.equal(none.body.data.reels.length, 0);

    // Regex characters are treated as plain text, so ".*" must not match everything.
    const regex = await request(app).get('/api/reels/search?q=' + encodeURIComponent('.*'));
    assert.equal(regex.body.data.reels.length, 0);

    const empty = await request(app).get('/api/reels/search?q=');
    assert.equal(empty.status, 400);
  });

  it('lists categories with published reel counts', async () => {
    await makeReel(dsa, admin.user._id);
    await makeReel(dsa, admin.user._id, { status: 'draft' });
    const res = await request(app).get('/api/categories');
    const dsaRow = res.body.data.categories.find((c) => c.slug === 'dsa');
    assert.equal(dsaRow.reelCount, 1);
  });

  it('returns a reel, 404s for drafts (guests), and 400s on a bad id', async () => {
    const draft = await makeReel(dsa, admin.user._id, { status: 'draft' });
    const live = await makeReel(dsa, admin.user._id);

    assert.equal((await request(app).get(`/api/reels/${live._id}`)).status, 200);
    assert.equal((await request(app).get(`/api/reels/${draft._id}`)).status, 404);
    assert.equal((await admin.agent.get(`/api/reels/${draft._id}`)).status, 200);
    assert.equal((await request(app).get('/api/reels/not-an-id')).status, 400);
  });

  it('suggests related reels by shared tags and category, excluding itself', async () => {
    const base = await makeReel(dsa, admin.user._id, { tags: ['graphs', 'bfs'] });
    const close = await makeReel(web, admin.user._id, { tags: ['bfs'], title: 'Tag match only' });
    await makeReel(web, admin.user._id, { tags: ['css'], title: 'Unrelated' });

    const res = await request(app).get(`/api/reels/${base._id}/related`);
    const titles = res.body.data.reels.map((r) => r.title);
    assert.deepEqual(titles, ['Tag match only']);
    assert.equal(res.body.data.reels.some((r) => r.id === String(base._id)), false);
    assert.ok(close);
  });

  describe('likes', () => {
    it('requires login', async () => {
      const reel = await makeReel(dsa, admin.user._id);
      const res = await request(app).post(`/api/reels/${reel._id}/like`);
      assert.equal(res.status, 401);
    });

    it('likes once, never double counts, and unlikes cleanly', async () => {
      const reel = await makeReel(dsa, admin.user._id);
      const url = `/api/reels/${reel._id}/like`;

      const first = await user.agent.post(url);
      assert.equal(first.body.data.likesCount, 1);
      const second = await user.agent.post(url);
      assert.equal(second.body.data.likesCount, 1);
      assert.equal(await Like.countDocuments({ reel: reel._id }), 1);

      const off = await user.agent.delete(url);
      assert.equal(off.body.data.likesCount, 0);
      const offAgain = await user.agent.delete(url);
      assert.equal(offAgain.body.data.likesCount, 0);
    });

    it('stays correct when the same like arrives many times at once', async () => {
      const reel = await makeReel(dsa, admin.user._id);
      await Promise.all(Array.from({ length: 8 }, () => user.agent.post(`/api/reels/${reel._id}/like`)));
      const fresh = await Reel.findById(reel._id);
      assert.equal(fresh.likesCount, 1);
      assert.equal(await Like.countDocuments({ reel: reel._id }), 1);
    });

    it('counts likes from different users and shows the liked flag per user', async () => {
      const other = await loginAgent({ role: 'user' });
      const reel = await makeReel(dsa, admin.user._id);
      await user.agent.post(`/api/reels/${reel._id}/like`);
      await other.agent.post(`/api/reels/${reel._id}/like`);

      const mine = await user.agent.get('/api/reels');
      assert.equal(mine.body.data.reels[0].likesCount, 2);
      assert.equal(mine.body.data.reels[0].liked, true);
      const guest = await request(app).get('/api/reels');
      assert.equal(guest.body.data.reels[0].liked, false);
    });

    it('cannot like a draft or missing reel', async () => {
      const draft = await makeReel(dsa, admin.user._id, { status: 'draft' });
      assert.equal((await user.agent.post(`/api/reels/${draft._id}/like`)).status, 404);
      assert.equal((await user.agent.post('/api/reels/64b64b64b64b64b64b64b64b/like')).status, 404);
    });
  });

  describe('saved and liked lists', () => {
    it('saves, lists, paginates and removes', async () => {
      const reels = [];
      for (let i = 0; i < 3; i += 1) reels.push(await makeReel(dsa, admin.user._id));
      for (const r of reels) {
        const res = await user.agent.post(`/api/reels/${r._id}/save`);
        assert.equal(res.body.data.saved, true);
      }
      await user.agent.post(`/api/reels/${reels[0]._id}/save`); // duplicate
      assert.equal(await SavedReel.countDocuments({ user: user.user._id }), 3);

      const page1 = await user.agent.get('/api/users/me/saved?limit=2&page=1');
      assert.equal(page1.body.data.reels.length, 2);
      assert.equal(page1.body.data.pagination.total, 3);
      assert.equal(page1.body.data.reels[0].saved, true);
      assert.equal(page1.body.data.reels[0].id, String(reels[2]._id)); // newest saved first

      await user.agent.delete(`/api/reels/${reels[0]._id}/save`);
      const after = await user.agent.get('/api/users/me/saved');
      assert.equal(after.body.data.pagination.total, 2);
      assert.equal((await request(app).get('/api/users/me/saved')).status, 401);
    });

    it('does not list unpublished reels and reports accurate profile counts', async () => {
      const live = await makeReel(dsa, admin.user._id);
      const soon = await makeReel(dsa, admin.user._id);
      await user.agent.post(`/api/reels/${live._id}/like`);
      await user.agent.post(`/api/reels/${soon._id}/like`);
      await Reel.updateOne({ _id: soon._id }, { status: 'draft' });

      const liked = await user.agent.get('/api/users/me/liked');
      assert.equal(liked.body.data.reels.length, 1);
      const profile = await user.agent.get('/api/users/me');
      assert.equal(profile.body.data.stats.likedCount, 1);
      assert.equal(profile.body.data.user.email.includes('@'), true);
    });

    it('updates the profile name', async () => {
      const res = await user.agent.patch('/api/users/me').send({ name: 'New Name' });
      assert.equal(res.body.data.user.name, 'New Name');
      assert.equal((await user.agent.patch('/api/users/me').send({ name: 'x' })).status, 400);
    });
  });

  describe('reports', () => {
    it('accepts one report per user, validates reasons, and shows them to admins only', async () => {
      const reel = await makeReel(dsa, admin.user._id);
      const url = `/api/reels/${reel._id}/report`;

      assert.equal((await user.agent.post(url).send({ reason: 'bogus' })).status, 400);
      assert.equal((await user.agent.post(url).send({ reason: 'inaccurate', details: 'Wrong complexity' })).status, 201);
      const dup = await user.agent.post(url).send({ reason: 'inaccurate' });
      assert.equal(dup.status, 409);
      assert.equal((await request(app).post(url).send({ reason: 'other' })).status, 401);

      assert.equal((await user.agent.get('/api/admin/reports')).status, 403);
      const list = await admin.agent.get('/api/admin/reports');
      assert.equal(list.body.data.reports.length, 1);
      assert.equal(list.body.data.reports[0].reason, 'inaccurate');

      const id = list.body.data.reports[0].id;
      const act = await admin.agent.patch(`/api/admin/reports/${id}`).send({ status: 'actioned', unpublishReel: true });
      assert.equal(act.status, 200);
      assert.equal((await Reel.findById(reel._id)).status, 'draft');
    });
  });
});

void env;
