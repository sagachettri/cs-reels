# CS Reels: Testing

## 1. Automated tests

### Backend (83 tests)
Run: `cd backend && npm test`
Needs a MongoDB. It uses a **separate database named `csreels_test`** (derived from your `MONGODB_URI`, or set `TEST_MONGODB_URI`). It refuses to run unless the database name ends in `_test`, and it empties that database on every test.

What they cover (against a real MongoDB):
- **Auth:** valid and invalid registration, duplicate email (any letter case), password stored only as a bcrypt hash, role ignored at signup, login success/failure with identical error messages, NoSQL-injection body rejected, cookie is HttpOnly, `/me`, logout, tampered token, bad JSON.
- **Feed and search:** empty feed, pagination, drafts hidden, category/level filters, unknown category, partial and tag and category-name search, regex characters treated as text, related reels, invalid ids.
- **Likes and saves:** login required, no double counting, repeated and 8 simultaneous requests leave the count at 1, counts across users, flags per user, drafts cannot be liked, saved/liked lists with pagination, unpublished reels hidden.
- **Reports:** validation, one per user per reel, admin-only listing, "unpublish reel" action.
- **Admin:** guests get 401 and users 403 on every admin route; categories (duplicate, rename, in-use protection); upload success; draft by default; custom thumbnail; bad file type, fake video (wrong bytes), missing video, bad category, bad fields, unsafe link all rejected **before** ImageKit is contacted; oversize; ImageKit failure leaves no database record; thumbnail failure deletes the already-uploaded video; storage not configured; edit changes only sent fields; delete removes likes, saves and ImageKit files; stats.
- **Final round, quizzes:** answers and explanations never sent before submission; separate stored quiz per difficulty and the AI asked for the right level; server-side scoring (perfect, partial, zero); extra fields from a client cannot raise the score; retry, attempt count and best score; validation of every kind of bad answer list; unpublished reels refused; private, paginated history; daily activity in the student's time zone; and the upgrade of Round 2 data (old index replaced, old quizzes become "medium").
- **Final round, learning:** real view tracking (counts, best watch time, sticky completion, validation, drafts refused); recommendations (guest and brand-new student fallback, ranking from likes/saves/views, reasons, weak-topic push, pagination, route not mistaken for a reel id, different students get different results); progress (honest zeros, exact counts per topic, unpublished and other students' data excluded, 7-day chart, streak rules including gaps and month boundaries); transcript storage and visibility; cascade delete of views and attempts; admin view/quiz totals; reel-scoped AI chat (context, history, validation, drafts).
- **AI (provider mocked):** login required, missing key, text-only prompt and key sent in a header, caching, summary, drafts rejected, quiz validation, storage and reuse, regeneration when text changes, fenced JSON accepted, retry on malformed JSON, clean 502 when still invalid, provider 429/500 mapped to friendly errors, chat validation.

### Frontend (60 tests)
Run: `cd frontend && npm test`
Runs the real React app in a simulated browser (jsdom) with the API mocked. Covers (original features): landing, feed (loading data, empty, error and retry), guest like redirects to login, protected and admin routes, registration validation, login (success, wrong password, redirect back), optimistic like with rollback, save/unsave, report dialog, profile, reel detail, AI explainer errors, quiz flow, chat with retry, admin dashboard, upload validation and form fields, publish and delete, category-in-use error.

Final round additions: difficulty choice, no answers shown while taking a quiz, server scoring display, retake and change difficulty, submit failure; reel-scoped AI chat with conversation memory and retry; For you tab and reasons; progress dashboard (real numbers, 7-day chart, topic bars and statuses, quiz history, recommendations, empty state, error, login guard); watch tracking rules (time counted, finished at 85%, scroll-past ignored, guests not tracked, detail page reports once on leaving); admin transcript field; dashboard totals; navigation.

### Results from my run
- Backend: 83 passed, 0 failed (Node 22, MongoDB 8.3.7). This includes all 51 tests from the MVP, unchanged and still passing.
- Frontend: 60 passed, 0 failed; production build succeeds. The one MVP test that checked the old quiz screen was replaced because the quiz was intentionally redesigned.
- Live smoke test of the real server (not mocks for our own code): started on a database in the MVP state, confirmed the automatic upgrade, then registered a student, recorded a view, got recommendations, took a hard quiz twice, asked the reel chat, and read the progress page data; all checks passed.
- Also run by hand earlier: seed script (twice, so it is repeatable), server start, login and admin call through the Vite proxy with a real HttpOnly cookie.

### What these tests could NOT prove
- **Real ImageKit** and **real Gemini** were never called (no keys here). Their request formats follow the public docs; the mocks check that we send the key and the file correctly. Your first real upload and first real AI call are the true test (checklist below).
- **A real browser** was not used: video playback, scroll-snap, autoplay, IntersectionObserver and the layout on phones are not covered.
- **Node 24** and **Atlas** were not used by me.

## 2. Manual checklist for you (about 30 minutes)
Tick each item. If something fails, send me the exact message and which step.

**Setup**
- [ ] `npm run seed` prints "Categories ready (6)" and "Admin account created".
- [ ] Backend and frontend start; `http://localhost:5000/api/health` shows `"database":"connected"`.

**Guest**
- [ ] `/` loads; topics appear as chips.
- [ ] `/feed` shows "No reels yet" before any upload.
- [ ] Pressing a like button sends you to the login page.
- [ ] `/saved` and `/admin` send you to login.

**Accounts**
- [ ] Register a normal user (try a weak password first: you should see a clear message).
- [ ] Log out, log in again; refresh the page: you stay logged in.
- [ ] As a normal user open `/admin`: you see "Admins only".

**Admin (log in with your admin account)**
- [ ] Manage content, Categories: add a category; rename it; try deleting one that has reels (should be refused).
- [ ] Upload reel: try a PDF (rejected), then a real MP4 under 50 MB with title, description, category, tags, one resource link. Watch the progress bar. It lands on Manage content.
- [ ] Open the reel in ImageKit's media library: the file is there.
- [ ] Upload with a thumbnail image, and once without (a frame should appear automatically; if the grid shows a play-icon placeholder, tell me).
- [ ] Edit a reel (title), unpublish it (it disappears for guests), publish it again.

**Reels experience (use your phone too: same Wi-Fi, open `http://YOUR-PC-IP:5173`)**
- [ ] Upload 3+ reels. The feed shows one at a time; swiping or arrow keys moves to the next; only the visible one plays; tapping pauses/plays; the speaker icon turns sound on.
- [ ] Like, save: counts change; refresh keeps them; Saved/Liked pages list them; Profile counts match.
- [ ] Search a word from a title, a tag, and a topic name.
- [ ] Report a reel as a user; as admin see it under Reports and use "Unpublish reel".
- [ ] Break the video URL on purpose (or go offline): a "could not be loaded" message with Try again appears.

**AI (needs `GEMINI_API_KEY`)**
- [ ] Open a reel: "Explain simply", "Explain in detail", "Summarize" each answer.
- [ ] "Generate quiz": answer, submit, see the score and explanations. Reload and generate again: it is instant (stored).
- [ ] AI Tutor page: ask a CS question, a follow-up, then an off-topic question (it should politely decline).
- [ ] Remove the key from `.env`, restart: the app shows a clear "not configured" message instead of crashing.

**Final round: new features (use at least 4 reels, 2 topics, one normal student account)**
- [ ] Log in as the student and open a reel's **Learn** page: the **Ask the AI about this reel** box answers a starter question, then a follow-up that clearly uses the earlier answer.
- [ ] Add notes in **Admin → Manage content → Edit** (Transcript or notes), then ask the AI a question the notes answer: it should use them.
- [ ] **Test yourself:** pick Hard, start the quiz. No answers or explanations are visible. Answer, submit: you see the score, the correct answers and explanations, attempt 1. Press **Retake this quiz** and score differently: attempt 2 and the best score is kept. Try **Easy** as well: different questions.
- [ ] In the browser tools (F12, Network tab), look at the quiz start response: it must not contain `correctIndex` or explanations.
- [ ] Watch a reel in the feed for more than 5 seconds, scroll on. Open **Progress**: reels watched increased. Scroll past a reel in under 2 seconds: it is not counted.
- [ ] **Progress** shows: stat cards, the 7-day chart with today's bar, a bar per topic, quiz history, recommended reels with reasons. Score badly (under 60%) on one topic: it shows **Needs practice** and its reels appear with a "Strengthen..." reason.
- [ ] **Feed → For you** (logged in): reels show a reason line; **Latest** returns to the normal feed. A new student with no activity sees popular and new reels.
- [ ] A different student account sees a different **For you** order after liking different topics.
- [ ] Restart the backend: it starts normally (the data upgrade is automatic) and old reels, likes and saves are all still there.

**Responsive and accessibility**
- [ ] Narrow the browser window to phone width: bottom navigation appears; nothing overflows sideways.
- [ ] Press Tab through the login form and the feed: focus is always visible.
