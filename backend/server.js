import app from './src/app.js';
import { env } from './src/config/env.js';
import { connectDB } from './src/config/db.js';
import { runMigrations } from './src/config/migrations.js';

async function start() {
  try {
    await connectDB();
    await runMigrations();
    app.listen(env.port, () => {
      console.log(`Server running on http://localhost:${env.port} (${env.nodeEnv})`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

start();
