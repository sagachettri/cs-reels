// Must be imported BEFORE anything from src/, because src/config/env.js reads process.env once.
function testDatabaseUri() {
  if (process.env.TEST_MONGODB_URI) return process.env.TEST_MONGODB_URI;

  const main = process.env.MONGODB_URI;
  if (main) {
    // Same cluster, but a separate database called csreels_test (never your real data).
    const match = main.match(/^(mongodb(?:\+srv)?:\/\/[^/]+)\/?([^?]*)(\?.*)?$/);
    if (match) return `${match[1]}/csreels_test${match[3] || ''}`;
  }
  return 'mongodb://127.0.0.1:27017/csreels_test';
}

const uri = testDatabaseUri();
const dbName = (uri.match(/\/([^/?]+)(\?|$)/) || [])[1] || '';
if (!dbName.endsWith('_test')) {
  throw new Error(`Refusing to run tests: database name "${dbName}" must end with "_test".`);
}

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = uri;
process.env.JWT_SECRET = 'test-secret-for-automated-tests-only-0123456789abcdef';
process.env.IMAGEKIT_PRIVATE_KEY = 'test_private_key';
process.env.GEMINI_API_KEY = 'test_gemini_key';
