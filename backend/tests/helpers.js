import './setupEnv.js';
import mongoose from 'mongoose';
import request from 'supertest';
import bcrypt from 'bcryptjs';

const { default: app } = await import('../src/app.js');
const { env } = await import('../src/config/env.js');
const { User } = await import('../src/models/User.js');
const { Category } = await import('../src/models/Category.js');
const { Reel } = await import('../src/models/Reel.js');

export { app, env, User, Category, Reel };

export async function connectTestDb() {
  await mongoose.connect(process.env.MONGODB_URI);
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
}

export async function clearTestDb() {
  await Promise.all(Object.values(mongoose.models).map((model) => model.deleteMany({})));
}

export async function disconnectTestDb() {
  await mongoose.disconnect();
}

export const PASSWORD = 'Passw0rdTest';

export async function loginAgent({ role = 'user', email, name = 'Test User' } = {}) {
  const address = email || `${role}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const user = await User.create({
    name,
    email: address,
    passwordHash: await bcrypt.hash(PASSWORD, 4),
    role,
  });
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email: address, password: PASSWORD });
  if (res.status !== 200) throw new Error(`Test login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, user };
}

export async function makeCategory(name = 'DSA', slug = 'dsa') {
  return Category.create({ name, slug });
}

let counter = 0;
export async function makeReel(category, adminId, overrides = {}) {
  counter += 1;
  return Reel.create({
    title: `Reel number ${counter}`,
    description: 'A short description for this test reel.',
    videoUrl: `https://ik.example.com/v${counter}.mp4`,
    videoFileId: `vid_${counter}`,
    thumbnailFileId: `thumb_${counter}`,
    category: category._id,
    uploadedBy: adminId,
    status: 'published',
    ...overrides,
  });
}

export const fakeMp4 = () => Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(200)]);
export const fakePng = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100)]);
