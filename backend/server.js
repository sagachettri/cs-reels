import app from './src/app.js';
import { env } from './src/config/env.js';
import { connectDB } from './src/config/db.js';

async function start() {
  try {
    await connectDB();
    app.listen(env.port, () => {
      console.log(`Server running on http://localhost:${env.port} (${env.nodeEnv})`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

start();
