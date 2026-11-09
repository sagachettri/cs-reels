import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {
  app, env, Reel,
  connectTestDb, clearTestDb, disconnectTestDb,
  loginAgent, makeCategory, makeReel, fakeMp4, fakePng,
} from './helpers.js';
import { startImageKitMock } from './mocks.js';
import { Like } from '../src/models/Like.js';
import { SavedReel } from '../src/models/SavedReel.js';

describe('admin: authorization, categories, uploads, edit, delete', () => {
  let admin, user, dsa, ik;
  const originalImagekit = { ...env.imagekit };
  const originalMax = env.upload.maxVideoBytes;

  before(async () => {
    await connectTestDb();
    ik = await startImageKitMock();
    env.imagekit.uploadUrl = ik.uploadUrl;
    env.imagekit.apiUrl = ik.apiUrl;
  });
  after(async () => {
    Object.assign(env.imagekit, originalImagekit);
    env.upload.maxVideoBytes = originalMax;
    await ik.close();
    await disconnectTestDb();
  });
  beforeEach(async () => {
    await clearTestDb();
    ik.reset();
    env.imagekit.privateKey = 'test_private_key';
    admin = await loginAgent({ role: 'admin' });
    user = await loginAgent({ role: 'user' });
    dsa = await makeCategory('DSA', 'dsa');
  });

  function upload(agent, fields = {}, { video = fakeMp4(), thumb = null, videoType = 'video/mp4' } = {}) {
    const req = agent.post('/api/admin/reels');
    const body = {
      title: 'Binary search intuition',
      description: 'Why halving the search space is so fast.',
      category: String(dsa._id),
      tags: JSON.stringify(['search', 'Arrays']),
      resources: JSON.stringify([{ title: 'MDN', url: 'https://developer.mozilla.org', type: 'docs' }]),
      ...fields,
    };
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) req.field(key, value);
    }
    if (video) req.attach('video', video, { filename: 'clip.mp4', contentType: videoType });
    if (thumb) req.attach('thumbnail', thumb, { filename: 'thumb.png', contentType: 'image/png' });
    return req;
  }

  it('rejects guests (401) and normal users (403) on every admin route', async () => {
    const routes = [
      ['get', '/api/admin/stats'],
      ['get', '/api/admin/reels'],
      ['post', '/api/admin/reels'],
      ['post', '/api/admin/categories'],
      ['get', '/api/admin/reports'],
    ];
    for (const [method, url] of routes) {
      assert.equal((await request(app)[method](url)).status, 401, `guest ${method} ${url}`);
      assert.equal((await user.agent[method](url)).status, 403, `user ${method} ${url}`);
    }
  });

  it('manages categories: create, duplicate, rename, delete, and protects ones in use', async () => {
    const created = await admin.agent.post('/api/admin/categories').send({ name: 'Operating Systems', description: 'Processes' });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.category.slug, 'operating-systems');

    const dup = await admin.agent.post('/api/admin/categories').send({ name: 'operating systems' });
    assert.equal(dup.status, 409);

    const id = created.body.data.category.id;
    const renamed = await admin.agent.patch(`/api/admin/categories/${id}`).send({ name: 'OS Basics' });
    assert.equal(renamed.body.data.category.slug, 'os-basics');

    await makeReel(dsa, admin.user._id);
    const blocked = await admin.agent.delete(`/api/admin/categories/${dsa._id}`);
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.error.code, 'CATEGORY_IN_USE');

    assert.equal((await admin.agent.delete(`/api/admin/categories/${id}`)).status, 200);
  });

  it('uploads a valid reel to ImageKit and saves it as a draft by default', async () => {
    const res = await upload(admin.agent);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const reel = res.body.data.reel;
    assert.equal(reel.status, 'draft');
    assert.deepEqual(reel.tags, ['search', 'arrays']);
    assert.match(reel.videoUrl, /^https:\/\/ik\.example\.com\//);
    assert.match(reel.thumbnailUrl, /ik-thumbnail\.jpg$/);
    assert.equal('videoFileId' in reel, false);
    assert.equal(ik.state.uploads.length, 1);
    assert.match(ik.state.uploads[0].auth, /^Basic /);

    const stored = await Reel.findById(reel.id);
    assert.equal(stored.videoFileId, 'file_1');

    const publicFeed = await request(app).get('/api/reels');
    assert.equal(publicFeed.body.data.reels.length, 0);
  });

  it('uploads a custom thumbnail and can publish immediately', async () => {
    const res = await upload(admin.agent, { status: 'published', durationSec: '42' }, { thumb: fakePng() });
    assert.equal(res.status, 201);
    assert.equal(ik.state.uploads.length, 2);
    assert.equal(res.body.data.reel.durationSec, 42);
    assert.match(res.body.data.reel.thumbnailUrl, /thumb\.png$/);
    const feed = await request(app).get('/api/reels');
    assert.equal(feed.body.data.reels.length, 1);
  });

  it('rejects bad uploads BEFORE contacting ImageKit', async () => {
    const noVideo = await upload(admin.agent, {}, { video: null });
    assert.equal(noVideo.status, 400);

    const fakeVideo = await upload(admin.agent, {}, { video: Buffer.from('this is just text, not a video') });
    assert.equal(fakeVideo.status, 415);

    const wrongType = await upload(admin.agent, {}, { videoType: 'application/pdf' });
    assert.equal(wrongType.status, 415);

    const badCategory = await upload(admin.agent, { category: '64b64b64b64b64b64b64b64b' });
    assert.equal(badCategory.status, 400);

    const badFields = await upload(admin.agent, { title: 'x' });
    assert.equal(badFields.status, 400);

    const badLink = await upload(admin.agent, { resources: JSON.stringify([{ title: 'x', url: 'javascript:alert(1)' }]) });
    assert.equal(badLink.status, 400);

    assert.equal(ik.state.uploads.length, 0);
    assert.equal(await Reel.countDocuments(), 0);
  });

  it('rejects an oversized video', async () => {
    env.upload.maxVideoBytes = 100;
    // multer's limit was fixed at import time, so the service-level check is what fires here.
    const res = await upload(admin.agent);
    env.upload.maxVideoBytes = originalMax;
    assert.equal(res.status, 413);
    assert.equal(ik.state.uploads.length, 0);
  });

  it('leaves no database record when ImageKit fails', async () => {
    ik.state.failUploadNumber = 1;
    const res = await upload(admin.agent);
    assert.equal(res.status, 502);
    assert.equal(await Reel.countDocuments(), 0);
  });

  it('removes the already-uploaded video when the thumbnail upload fails', async () => {
    ik.state.failUploadNumber = 2;
    const res = await upload(admin.agent, {}, { thumb: fakePng() });
    assert.equal(res.status, 502);
    assert.equal(await Reel.countDocuments(), 0);
    assert.deepEqual(ik.state.deleted, ['file_1']);
  });

  it('reports a clear error when storage is not configured', async () => {
    env.imagekit.privateKey = '';
    const res = await upload(admin.agent);
    assert.equal(res.status, 503);
    assert.equal(res.body.error.code, 'STORAGE_NOT_CONFIGURED');
  });

  it('edits only the fields that were sent', async () => {
    const reel = await makeReel(dsa, admin.user._id, { tags: ['keep', 'these'], level: 'advanced', keyTakeaway: 'Keep me' });

    const res = await admin.agent.patch(`/api/admin/reels/${reel._id}`).send({ title: 'A brand new title' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.reel.title, 'A brand new title');
    assert.deepEqual(res.body.data.reel.tags, ['keep', 'these']);
    assert.equal(res.body.data.reel.level, 'advanced');
    assert.equal(res.body.data.reel.keyTakeaway, 'Keep me');

    assert.equal((await admin.agent.patch(`/api/admin/reels/${reel._id}`).send({})).status, 400);
    assert.equal((await admin.agent.patch(`/api/admin/reels/${reel._id}`).send({ level: 'expert' })).status, 400);
    assert.equal((await admin.agent.patch('/api/admin/reels/64b64b64b64b64b64b64b64b').send({ title: 'Valid title' })).status, 404);

    const publish = await admin.agent.patch(`/api/admin/reels/${reel._id}`).send({ status: 'draft' });
    assert.equal(publish.body.data.reel.status, 'draft');
  });

  it('deletes a reel together with its likes, saves and stored files', async () => {
    const reel = await makeReel(dsa, admin.user._id);
    await user.agent.post(`/api/reels/${reel._id}/like`);
    await user.agent.post(`/api/reels/${reel._id}/save`);

    const res = await admin.agent.delete(`/api/admin/reels/${reel._id}`);
    assert.equal(res.status, 200);
    assert.equal(await Reel.countDocuments(), 0);
    assert.equal(await Like.countDocuments(), 0);
    assert.equal(await SavedReel.countDocuments(), 0);
    assert.deepEqual(ik.state.deleted.sort(), [reel.thumbnailFileId, reel.videoFileId].sort());
    assert.equal((await admin.agent.delete(`/api/admin/reels/${reel._id}`)).status, 404);
  });

  it('lists all reels including drafts, with status filter and search', async () => {
    await makeReel(dsa, admin.user._id, { title: 'Published one' });
    await makeReel(dsa, admin.user._id, { title: 'Draft one', status: 'draft' });

    const all = await admin.agent.get('/api/admin/reels');
    assert.equal(all.body.data.pagination.total, 2);
    const drafts = await admin.agent.get('/api/admin/reels?status=draft');
    assert.equal(drafts.body.data.reels.length, 1);
    const search = await admin.agent.get('/api/admin/reels?q=published');
    assert.equal(search.body.data.reels.length, 1);
  });

  it('returns dashboard statistics', async () => {
    const reel = await makeReel(dsa, admin.user._id);
    await makeReel(dsa, admin.user._id, { status: 'draft' });
    await user.agent.post(`/api/reels/${reel._id}/like`);

    const res = await admin.agent.get('/api/admin/stats');
    assert.equal(res.status, 200);
    const { stats, topReels } = res.body.data;
    assert.equal(stats.publishedReels, 1);
    assert.equal(stats.draftReels, 1);
    assert.equal(stats.likes, 1);
    assert.equal(stats.users, 2);
    assert.equal(topReels[0].likesCount, 1);
  });
});
