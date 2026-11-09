import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app, User, connectTestDb, clearTestDb, disconnectTestDb } from './helpers.js';

const valid = { name: 'Soni Singh', email: 'soni@example.com', password: 'Passw0rd123' };

describe('authentication', () => {
  before(connectTestDb);
  beforeEach(clearTestDb);
  after(disconnectTestDb);

  it('registers a user, sets an HTTP-only cookie and never returns the password', async () => {
    const res = await request(app).post('/api/auth/register').send(valid);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.email, valid.email);
    assert.equal(res.body.data.user.role, 'user');
    assert.equal(JSON.stringify(res.body).includes('passwordHash'), false);
    assert.equal(JSON.stringify(res.body).includes(valid.password), false);
    const cookie = res.headers['set-cookie'].join(';');
    assert.match(cookie, /token=/);
    assert.match(cookie, /HttpOnly/i);
  });

  it('stores only a bcrypt hash', async () => {
    await request(app).post('/api/auth/register').send(valid);
    const user = await User.findOne({ email: valid.email }).select('+passwordHash');
    assert.notEqual(user.passwordHash, valid.password);
    assert.match(user.passwordHash, /^\$2[aby]\$/);
  });

  it('ignores a role sent during registration (no privilege escalation)', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...valid, role: 'admin' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.role, 'user');
  });

  it('rejects invalid registration data with readable messages', async () => {
    const badEmail = await request(app).post('/api/auth/register').send({ ...valid, email: 'nope' });
    assert.equal(badEmail.status, 400);
    assert.equal(badEmail.body.error.code, 'VALIDATION_ERROR');

    const weak = await request(app).post('/api/auth/register').send({ ...valid, password: 'short' });
    assert.equal(weak.status, 400);

    const noDigit = await request(app).post('/api/auth/register').send({ ...valid, password: 'onlyletters' });
    assert.equal(noDigit.status, 400);

    const missing = await request(app).post('/api/auth/register').send({});
    assert.equal(missing.status, 400);
  });

  it('rejects a duplicate email, ignoring letter case', async () => {
    await request(app).post('/api/auth/register').send(valid);
    const again = await request(app).post('/api/auth/register').send({ ...valid, email: 'SONI@example.com' });
    assert.equal(again.status, 409);
    assert.equal(again.body.error.code, 'EMAIL_TAKEN');
  });

  it('logs in with correct credentials', async () => {
    await request(app).post('/api/auth/register').send(valid);
    const res = await request(app).post('/api/auth/login').send({ email: valid.email, password: valid.password });
    assert.equal(res.status, 200);
    assert.match(res.headers['set-cookie'].join(';'), /token=/);
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    await request(app).post('/api/auth/register').send(valid);
    const wrong = await request(app).post('/api/auth/login').send({ email: valid.email, password: 'WrongPass123' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'Passw0rd123' });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.body.error.message, unknown.body.error.message);
  });

  it('blocks NoSQL injection attempts in the login body', async () => {
    await request(app).post('/api/auth/register').send(valid);
    const res = await request(app).post('/api/auth/login').send({ email: { $ne: null }, password: { $ne: null } });
    assert.equal(res.status, 400);
  });

  it('protects /me and supports logout', async () => {
    const anonymous = await request(app).get('/api/auth/me');
    assert.equal(anonymous.status, 401);

    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(valid);
    const me = await agent.get('/api/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.data.user.email, valid.email);

    const out = await agent.post('/api/auth/logout');
    assert.equal(out.status, 200);
    const after = await agent.get('/api/auth/me');
    assert.equal(after.status, 401);
  });

  it('rejects a tampered token', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', 'token=not.a.real.token');
    assert.equal(res.status, 401);
  });

  it('returns JSON errors for bad JSON and unknown routes', async () => {
    const bad = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad');
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error.code, 'INVALID_JSON');
    const missing = await request(app).get('/api/does-not-exist');
    assert.equal(missing.status, 404);
    assert.equal(missing.body.success, false);
  });
});
