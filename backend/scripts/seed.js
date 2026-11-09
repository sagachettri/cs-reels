// Run with: npm run seed
// Creates the default categories and the admin account (from ADMIN_* in .env). Safe to run many times.
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Category } from '../src/models/Category.js';
import { User } from '../src/models/User.js';
import { slugify } from '../src/utils/helpers.js';
import { registerBody } from '../src/validators/auth.js';

const DEFAULT_CATEGORIES = [
  ['Programming', 'Language features, tips and tricks'],
  ['DSA', 'Data structures and algorithms'],
  ['Web Development', 'Frontend, backend and how the web works'],
  ['Core CS', 'OS, DBMS, networks and other fundamentals'],
  ['Career & Opportunities', 'Resumes, GitHub, internships and hackathons'],
  ['Tech Explained', 'How real-world technology works'],
];

async function main() {
  await mongoose.connect(env.mongodbUri);

  for (const [index, [name, description]] of DEFAULT_CATEGORIES.entries()) {
    await Category.updateOne(
      { slug: slugify(name) },
      { $setOnInsert: { name, slug: slugify(name), description, order: index } },
      { upsert: true }
    );
  }
  console.log(`Categories ready (${DEFAULT_CATEGORIES.length}).`);

  const { name, email, password } = env.admin;
  if (!email || !password) {
    console.log('ADMIN_EMAIL / ADMIN_PASSWORD not set in .env, so no admin account was created.');
  } else {
    const parsed = registerBody.safeParse({ name, email, password });
    if (!parsed.success) {
      console.error('Admin details are invalid:', parsed.error.issues.map((i) => i.message).join(' '));
      process.exitCode = 1;
    } else {
      const existing = await User.findOne({ email: parsed.data.email });
      if (existing) {
        existing.role = 'admin';
        await existing.save();
        console.log(`Existing user ${parsed.data.email} is now an admin (password unchanged).`);
      } else {
        const passwordHash = await bcrypt.hash(parsed.data.password, 10);
        await User.create({ name: parsed.data.name, email: parsed.data.email, passwordHash, role: 'admin' });
        console.log(`Admin account created: ${parsed.data.email}`);
      }
    }
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Seed failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
