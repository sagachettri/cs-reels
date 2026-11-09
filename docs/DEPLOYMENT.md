# CS Reels: Deployment guide

## 0. Before you start
- Push the project to a GitHub repository (the root `.gitignore` already excludes `.env` and `node_modules`). Check with `git status` that no `.env` is staged.
- Local development must already work.

## 1. MongoDB Atlas (production database)
1. Use the same free M0 cluster, or create a second database name such as `csreels_prod` in the connection string.
2. Network Access: allow `0.0.0.0/0` (Render's addresses change). Keep a strong database password.
3. Run the seed once against it from your computer: put the Atlas string, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` in `backend/.env` and run `npm run seed`.

## 2. ImageKit
1. Create an account at imagekit.io (free plan). Check its current storage and bandwidth limits on their pricing page.
2. Developer options → API keys: copy the **Private key** (never the one on the frontend). Put it in `IMAGEKIT_PRIVATE_KEY`.
3. Keep `IMAGEKIT_FOLDER=/cs-reels`. Videos are served from your ImageKit URL endpoint automatically.

## 3. Gemini (AI)
1. aistudio.google.com → Get API key.
2. Set `GEMINI_API_KEY`. In AI Studio check which model is currently free for you and set `GEMINI_MODEL` accordingly (default `gemini-2.5-flash-lite`). If the AI answers "unavailable", the model name is the first thing to check.

## 4. Backend on Render
1. New → Web Service → connect the GitHub repo.
2. Root Directory: `backend`. Build command: `npm install`. Start command: `npm start`. Instance: Free.
3. Environment variables:

| Name | Value |
|---|---|
| NODE_ENV | production |
| MONGODB_URI | your Atlas string |
| JWT_SECRET | 48+ random characters (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
| CLIENT_ORIGIN | your Vercel URL, e.g. `https://cs-reels.vercel.app` (fill in after step 5, then redeploy) |
| IMAGEKIT_PRIVATE_KEY | from step 2 |
| MAX_VIDEO_MB | 50 |
| GEMINI_API_KEY, GEMINI_MODEL | from step 3 |

4. After deploy, open `https://YOUR-BACKEND.onrender.com/api/health`: you should see `"database":"connected"`.
5. The free plan sleeps after inactivity; the first request can take about a minute. Open the health URL before a demo.

## 5. Frontend on Vercel
1. Edit `frontend/vercel.json`: replace `YOUR-BACKEND-NAME.onrender.com` with your Render host. Commit and push.
2. New Project → import the repo → Root Directory `frontend` → Framework Vite (build `npm run build`, output `dist`).
3. Deploy. Then set `CLIENT_ORIGIN` on Render to the Vercel URL and redeploy the backend.

Why the rewrite: the browser talks only to your Vercel domain (`/api/...` is forwarded to Render), so the login cookie is first-party and is not blocked as a third-party cookie.

## 6. Final checks on the live site
- [ ] `/api/health` through the Vercel URL works.
- [ ] Register, log out, log in, refresh: stays logged in.
- [ ] Admin login, upload a small video (under 4 MB first), publish, watch on your phone.
- [ ] Upload a larger video (20 to 50 MB). See the risk below if it fails.
- [ ] AI explain, quiz, chat.

## Risks I could not test from here
1. **Large uploads through Vercel's rewrite.** I could not confirm Vercel's request-size and time limits for forwarded requests. If a 20 to 50 MB upload fails on the live site while small ones work, the fix is one of: (a) buy a cheap custom domain and serve the app at `app.yourdomain` and the API at `api.yourdomain` (cookies then work without the proxy, and the frontend calls the API directly), or (b) switch uploads to ImageKit client-side signed upload. Tell me and I will implement it.
2. **Render free tier memory (512 MB).** Uploads are held in memory briefly; 50 MB is fine for one admin. Do not raise `MAX_VIDEO_MB` much.
3. **Gemini free-tier limits** change; the app caches answers and limits each user, and shows a friendly message when the limit is hit.
