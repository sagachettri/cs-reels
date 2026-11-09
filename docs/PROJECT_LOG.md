# CS Reels: Project Log

## Team
- Soni Singh and Sagar Chettri. Both worked on the frontend and the backend (roughly equal split).
- An AI assistant (Claude by Anthropic) was used during development to help plan, write and debug code and documentation; the team ran, tested and integrated the result.

## Status
| Phase | State |
|---|---|
| 1 Planning | Done |
| 2 Setup | Done (verified in sandbox; Soni to confirm on own machine) |
| 3 Authentication | Built and automatically tested |
| 4 Reels backend (feed, categories, search, pagination) | Built and automatically tested |
| 5 Reels frontend (vertical feed, player) | Built; behaviour tested in jsdom, not in a real browser |
| 6 Likes, saves, profile, reports | Built and automatically tested |
| 7 Admin dashboard and ImageKit upload | Built; ImageKit tested against a mock only |
| 8 AI (Explainer, Summary, Quiz, Chat) | Built; Gemini tested against a mock only |
| 9 Testing and refinement | Automated suites done; manual checklist in TESTING.md is for Soni |
| 10 Deployment and documentation | Guides written; the deployment itself is for Soni |

## Approved decisions
- Stack: React + Vite, Express 5, MongoDB Atlas + Mongoose, JWT in HTTP-only cookies, ImageKit, Vercel + Render, Gemini.
- Separate Category collection. Vercel `/api` rewrite. Guests browse and watch; login for like, save, report, AI.
- Creator = admin. Videos are uploaded to ImageKit; no embeds.
- MVP first; AI is MVP+ (Explainer, then Quiz; Summary and Chat were added too).

## Changes from the original plan (and why)
| Plan | What was built | Reason |
|---|---|---|
| bcrypt | bcryptjs (same bcrypt algorithm) | pure JavaScript, no native build step that can fail on Windows or new Node versions |
| Jest + Supertest | Node's built-in test runner + Supertest (backend), Vitest + Testing Library (frontend) | no extra config for ES modules; fewer packages |
| MongoDB text index for search | case-insensitive partial match on title, description, tags, category name (input escaped) | supports partial words ("binar" finds "binary"); fine for hundreds of reels. A text index is the upgrade path for thousands |
| ImageKit and Gemini SDKs | direct REST calls with `fetch` | fewer dependencies, no SDK version risk, easy to explain |
| Pages list (14) | same 14 plus `/categories` (topic list) and a 404 page | the Category page is per topic, so a topic list was needed |
| Category pages | `/category/:slug` shows a grid, not the vertical feed | avoids duplicating the feed page |
| Like/save as toggle | POST to add, DELETE to remove | repeating a request is safe |

## Known limitations
- Replacing the video file of an existing reel is not supported (upload a new reel).
- Quiz scoring happens in the browser (answers are sent with the quiz); it is a learning aid, not an exam.
- Chat history is not stored; it lives in the page until refresh.
- AI sees only reel text, not the video. No transcription.
- Search ranks by newest, not relevance.
- Video through the Vercel proxy: see "Risks" in DEPLOYMENT.md.

## Files
- Backend: `server.js`, `scripts/seed.js`, `src/app.js`, `src/config/{env,db}.js`, `src/models/{User,Category,Reel,Like,SavedReel,Quiz,Report}.js`, `src/middleware/{auth,validate,upload,rateLimit,errorHandler}.js`, `src/validators/{common,auth,reel,ai}.js`, `src/controllers/{auth,user,category,reel,interaction,admin,ai}Controller.js`, `src/routes/*Routes.js`, `src/services/{reelService,fileChecks,imagekitService}.js`, `src/services/ai/{aiService,prompts,cache}.js`, `src/services/ai/providers/gemini.js`, `src/utils/{ApiError,auth,helpers}.js`, `tests/*`.
- Frontend: `src/{main,App}.jsx`, `index.css`, `layouts/*`, `pages/*` (+ `pages/admin/*`), `components/*` (+ `components/admin/*`), `context/{Auth,Toast}Context.jsx`, `hooks/*`, `services/*`, `utils/*`, `test/*`, `vercel.json`.