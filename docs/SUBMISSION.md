# Prototype submission: checklist

## A. Status
| Item | Status |
|---|---|
| Demo video: https://youtu.be/jIJvZNRs0OM | Done. Confirm it plays in an incognito window (Unlisted or Public, not Private) |
| Screenshots in `docs/screenshots/` | Rename `02-feed.png.png` to `02-feed.png` (section B) |
| README credits, team and AI wording | Done |
| GitHub repository | Create it and push (section D) |
| Live link | Not deployed. Run instructions are in the README |

## B. Screenshots
Windows hides file extensions, so one file was saved as `02-feed.png.png`. In PowerShell, from the project root:
```powershell
Rename-Item docs\screenshots\02-feed.png.png 02-feed.png
dir docs\screenshots
```
You must see exactly: `01-landing.png`, `02-feed.png`, `03-reel-detail.png`, `04-quiz.png`, `05-search.png`, `06-ai-tutor.png`, `07-admin-upload.png`, `08-admin-dashboard.png`. Names are case-sensitive on GitHub.

## C. Demo content and the originality rule
The rules prohibit presenting third-party work as original. The README credits the YouTube channel (@tech_edu.26) for the one screen-recorded reel and does not claim it as yours. For extra safety, ask the creator for permission (a short comment or message is enough), or replace that reel with your own recording and delete that line from the README credits.

## D. Push to GitHub
1. github.com → **New repository** → name `cs-reels` → **Public** → do **not** add a README → Create.
2. In the terminal, from the folder that contains `backend` and `frontend`:
```bash
git init
git add .
git status
```
Check the list: **no `.env`**, no `node_modules`. Then:
```bash
git commit -m "CS Reels prototype"
git branch -M main
git remote add origin https://github.com/sonisingh01/cs-reels.git
git push -u origin main
```
- "remote origin already exists": `git remote set-url origin https://github.com/sonisingh01/cs-reels.git`, then `git push -u origin main`.
- "Author identity unknown": `git config --global user.name "Soni Singh"` and `git config --global user.email "your-github-email"`, then commit again.
- Password asked: use a Personal Access Token (GitHub → Settings → Developer settings → Personal access tokens, scope `repo`).
3. Open the repo in an **incognito window**: README renders, images show, no `.env` in the file list.
4. If a real key or password was ever pushed, delete that key at its provider and create a new one.

## E. Deployment
Not deployed for this submission; judges follow "Run it locally" in the README. If you deploy later, follow `docs/DEPLOYMENT.md` and add the live link to the README table.

## F. Text for the submission form

**Project title:** CS Reels

**One-line pitch:** Short-form learning videos for computer science students, with saves, topics, search and AI-powered explanations and quizzes.

**Short description:** CS Reels is a learning-only reels platform for CS students. Instead of endless entertainment scrolling, students swipe through short videos that each teach one concept in DSA, web development, core CS or career preparation. They can search, filter by topic and level, like and save reels, follow resource links, and use AI (Google Gemini) to get a simpler explanation of a reel, take an auto-generated quiz, or ask an AI tutor questions. Admins upload and manage reels through a dashboard. The app has secure login (HTTP-only cookies, hashed passwords, server-side roles), media storage on ImageKit, and automated tests (51 backend, 32 frontend).

**Core features demonstrated:** vertical reels feed; accounts; topics, levels and search; likes and saves; admin upload and management; AI explainer, quiz and tutor.

**Tech stack:** React, Vite, Node.js, Express, MongoDB, ImageKit, Google Gemini API.

**Team:** Soni Singh and Sagar Chettri (frontend and backend, shared roughly equally)

**GitHub:** https://github.com/sonisingh01/cs-reels
**Demo video:** https://youtu.be/jIJvZNRs0OM
**Live link:** none; runs locally, see the README for step-by-step instructions

## G. Rules check
- **Accessible:** repository is Public; the video link works in incognito.
- **Original work:** the README credits libraries, services, the AI assistant (Claude) and the demo-video creators. AI assistance is allowed by the hackathon. Be ready in judging to explain how every part of the project works.
- **No secrets** in the repository (`git status` must not list `.env`).