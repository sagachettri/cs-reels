import http from 'node:http';

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

// Fake ImageKit: records uploads and deletions, and can be told to fail.
export async function startImageKitMock() {
  const state = { uploads: [], deleted: [], failUploadNumber: null, uploadCount: 0 };

  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      if (req.method === 'POST' && req.url === '/upload') {
        state.uploadCount += 1;
        if (state.failUploadNumber === state.uploadCount) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ message: 'boom' }));
        }
        const body = Buffer.concat(chunks).toString('latin1');
        const fileName = (body.match(/name="fileName"\r\n\r\n([^\r\n]+)/) || [])[1] || 'file';
        const fileId = `file_${state.uploadCount}`;
        state.uploads.push({ fileId, fileName, auth: req.headers.authorization });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ fileId, url: `https://ik.example.com/cs-reels/${fileName}` }));
      }
      if (req.method === 'DELETE' && req.url.startsWith('/files/')) {
        state.deleted.push(decodeURIComponent(req.url.replace('/files/', '')));
        res.writeHead(204);
        return res.end();
      }
      res.writeHead(404);
      res.end();
    });
  });

  const port = await listen(server);
  return {
    state,
    uploadUrl: `http://127.0.0.1:${port}/upload`,
    apiUrl: `http://127.0.0.1:${port}`,
    reset() {
      state.uploads = [];
      state.deleted = [];
      state.failUploadNumber = null;
      state.uploadCount = 0;
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

// Fake Gemini: the test decides what each call returns.
export async function startGeminiMock() {
  const state = { calls: [], handler: null };

  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
      state.calls.push({ url: req.url, key: req.headers['x-goog-api-key'], body });
      const reply = state.handler ? state.handler(body, state.calls.length) : { text: 'default reply' };
      if (reply.status) {
        res.writeHead(reply.status, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: { message: 'mock error' } }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: reply.text }] } }] }));
    });
  });

  const port = await listen(server);
  return {
    state,
    baseUrl: `http://127.0.0.1:${port}`,
    reset() {
      state.calls = [];
      state.handler = null;
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
