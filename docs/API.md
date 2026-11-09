# CS Reels: API reference

Base path: `/api`. Authentication is a JWT stored in an HTTP-only cookie named `token` (set by login/register, cleared by logout). The browser sends it automatically.

**Success:** `{ "success": true, "data": { ... }, "message"?: "..." }`
**Error:** `{ "success": false, "error": { "code": "...", "message": "...", "details"?: [...] } }`

Common errors: `400 VALIDATION_ERROR`, `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409` (duplicate), `413 FILE_TOO_LARGE`, `415` (bad file type), `429 RATE_LIMITED`, `500 INTERNAL_ERROR`.

Pagination: `?page=1&limit=10` (limit 1 to 30). Lists return `pagination: { page, limit, total, totalPages, hasMore }`.

Auth column: **-** public, **opt** works for guests (adds liked/saved flags when logged in), **user** login required, **admin** admin role required.

## Health
| Method | URL | Auth | Result |
|---|---|---|---|
| GET | /health | - | `{ status, environment, database, time }` |

## Authentication
| Method | URL | Auth | Body | Success | Errors |
|---|---|---|---|---|---|
| POST | /auth/register | - | `name` (2-50), `email`, `password` (8-72, letter + number) | 201 `{ user }` + cookie | 400, 409 `EMAIL_TAKEN` |
| POST | /auth/login | - | `email`, `password` | 200 `{ user }` + cookie | 400, 401 `INVALID_CREDENTIALS` |
| POST | /auth/logout | user | - | 200, cookie cleared | 401 |
| GET | /auth/me | user | - | 200 `{ user }` | 401 |

`user` = `{ id, name, email, role, createdAt }`. A role sent at registration is ignored; admins are created with `npm run seed`.

## Users
| Method | URL | Auth | Notes |
|---|---|---|---|
| GET | /users/me | user | `{ user, stats: { savedCount, likedCount } }` |
| PATCH | /users/me | user | body `{ name }` |
| GET | /users/me/saved | user | paginated published reels the user saved, newest first |
| GET | /users/me/liked | user | same for likes |

## Categories
| Method | URL | Auth | Notes |
|---|---|---|---|
| GET | /categories | - | `{ categories: [{ id, name, slug, description, reelCount }] }` (reelCount = published reels) |

## Reels
| Method | URL | Auth | Query / body | Notes |
|---|---|---|---|---|
| GET | /reels | opt | `page, limit, category` (slug), `level` | published reels, newest first; 404 `CATEGORY_NOT_FOUND` |
| GET | /reels/search | opt | `q` (1-100 chars, required), `category`, `page, limit` | matches title, description, tags and category name; input is escaped |
| GET | /reels/:id | opt | | 404 for drafts unless admin |
| GET | /reels/:id/related | opt | | up to 6, rule-based: shared tags weigh more than shared category |
| POST / DELETE | /reels/:id/like | user | | idempotent; returns `{ liked, likesCount, savesCount }` |
| POST / DELETE | /reels/:id/save | user | | returns `{ saved, likesCount, savesCount }` |
| POST | /reels/:id/report | user | `reason` (inaccurate, copyright, inappropriate, broken-media, other), `details?` | 409 `ALREADY_REPORTED` |

Reel object: `id, title, description, videoUrl, thumbnailUrl, durationSec, category{id,name,slug}, tags[], level, keyTakeaway, resources[{title,url,type}], creator, creditName, status, likesCount, savesCount, createdAt, updatedAt, liked, saved`.

## Admin (all require the admin role)
| Method | URL | Notes |
|---|---|---|
| GET | /admin/stats | `{ stats: { users, publishedReels, draftReels, likes, saves, openReports, categories }, topReels }` |
| GET | /admin/reels | `page, limit, status, q`; includes drafts |
| POST | /admin/reels | `multipart/form-data`: `video` (MP4/WebM, required), `thumbnail?` (JPG/PNG/WebP), `title, description, category`, optional `tags` (JSON array string), `level, keyTakeaway, resources` (JSON string), `creditName, status` (default draft), `durationSec`. Validates first, uploads to ImageKit, then saves; on failure uploaded files are deleted. |
| PATCH | /admin/reels/:id | any subset of the editable fields (not the video file) |
| DELETE | /admin/reels/:id | also removes likes, saves, quiz, reports and the ImageKit files |
| POST | /admin/categories | `name, description?, order?` |
| PATCH | /admin/categories/:id | |
| DELETE | /admin/categories/:id | 409 `CATEGORY_IN_USE` if reels use it |
| GET | /admin/reports | `status, page, limit` |
| PATCH | /admin/reports/:id | `status` (reviewed, dismissed, actioned), `unpublishReel?` |

## AI (login required, limited to 30 requests per 10 minutes per user)
The AI sees only a reel's text fields (title, category, level, description, key takeaway, tags), never the video.

| Method | URL | Body | Success |
|---|---|---|---|
| POST | /ai/reels/:id/explain | `{ mode: "simple" \| "detailed" }` | `{ explanation, mode, cached, basedOn }` |
| POST | /ai/reels/:id/summary | - | `{ summary, cached, basedOn }` |
| POST | /ai/reels/:id/quiz | - | `{ quiz: { reelId, questions: [{ question, options[4], correctIndex, explanation }] }, cached, basedOn }`; stored in MongoDB and regenerated if the reel text changes |
| POST | /ai/chat | `{ messages: [{ role: "user"\|"assistant", content }] }` (1-12 messages, last from user, each up to 1000 chars) | `{ reply }` |

AI errors: `503 AI_NOT_CONFIGURED`, `429 AI_RATE_LIMITED`, `502 AI_UNAVAILABLE`, `502 AI_BAD_RESPONSE` (invalid quiz after one retry), `504 AI_TIMEOUT`.
