const required = ['MONGODB_URI', 'JWT_SECRET'];

const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(
    `Missing required environment variable(s): ${missing.join(', ')}. ` +
      'Create backend/.env (copy backend/.env.example) and fill them in.'
  );
  process.exit(1);
}

if (process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be at least 32 characters long. See backend/.env.example.');
  process.exit(1);
}

const nodeEnv = process.env.NODE_ENV || 'development';

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: Number(process.env.PORT) || 5000,
  mongodbUri: process.env.MONGODB_URI,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',

  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: '7d',
  cookieMaxAgeMs: 7 * 24 * 60 * 60 * 1000,

  admin: {
    name: process.env.ADMIN_NAME || 'Admin',
    email: process.env.ADMIN_EMAIL || '',
    password: process.env.ADMIN_PASSWORD || '',
  },

  upload: {
    maxVideoBytes: (Number(process.env.MAX_VIDEO_MB) || 50) * 1024 * 1024,
    maxThumbnailBytes: 5 * 1024 * 1024,
  },

  imagekit: {
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY || '',
    folder: process.env.IMAGEKIT_FOLDER || '/cs-reels',
    uploadUrl: process.env.IMAGEKIT_UPLOAD_URL || 'https://upload.imagekit.io/api/v1/files/upload',
    apiUrl: process.env.IMAGEKIT_API_URL || 'https://api.imagekit.io/v1',
  },

  ai: {
    provider: process.env.AI_PROVIDER || 'gemini',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite',
    geminiBaseUrl:
      process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
    timeoutMs: 30000,
  },
};
