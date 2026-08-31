# Deploy Guide — Agentic Research Assistant (Derve)

This guide deploys the app to **production**:

| Part | Where | How |
|---|---|---|
| **Backend** (FastAPI + LangGraph) | **Render** | **Docker container** (web service) |
| **Frontend** (Next.js) | **Vercel** | Native Next.js build |

The database (Neon Postgres), vector store (Qdrant Cloud), and AI providers are all
**externally hosted** and shared between local dev and production, so no new DB setup
is required below — you reuse the credentials you already have.

> The `docs/` folder is git-ignored in this repo, so this file lives at the repo root
> (`DEPLOY.md`) to make sure it is committed and visible.

---

## 1. Architecture overview

```
Browser (Vercel frontend, e.g. https://my-app.vercel.app)
        │  HTTPS + CORS (origins = Vercel URL)
        ▼
Render web service — FastAPI / LangGraph (Docker)   ← uvicorn on $PORT
        │
        ├── Neon Postgres  (users, reports, threads/checkpoints, memory/store)
        ├── Qdrant Cloud   (embedded document chunks)
        ├── Groq / Gemini  (LLM)
        ├── Tavily         (web search)
        └── LangSmith      (tracing, optional)
```

Two things matter for production that are **already handled in the code** you are
deploying:

- **CORS** is now configurable via `CORS_ORIGINS` (comma-separated). You must set it to
  your Vercel URL, otherwise the browser will block requests.
- The backend expects the `PORT` env var that Render injects automatically.

---

## 2. Prerequisites (accounts you need)

Create / log into all of these **before** starting:

1. **GitHub** — your repo must be on GitHub (`FaizanAhmeddd27/Agentic-Research-Assistant`).
2. **Neon** — cloud Postgres (you already have this working locally).
3. **Qdrant Cloud** — vector store (already used locally).
4. **Groq** — LLM API (already used locally).
5. **Gemini (Google AI Studio)** — second LLM provider (optional).
6. **Tavily** — web search API (already used locally).
7. **LangSmith** — tracing (optional).
8. **Render** — hosts the backend Docker container.
9. **Vercel** — hosts the Next.js frontend.

---

## 3. Steps that are the same for local & prod (do once, already done)

These are already wired up in the repo — just make sure the following files exist and
are pushed:

- `backend/Dockerfile` — container definition for the FastAPI app.
- `backend/.dockerignore` — keeps secrets/caches out of the image.
- `backend/.env.example` — template of backend env vars (no secrets inside).
- `frontend/.env.example` — template of frontend env vars.

> Secrets are **never** committed. `.env` / `.env.local` are git-ignored.

---

## 4. Push the repo to GitHub

If you haven't pushed your latest changes yet:

```bash
git add -A
git commit -m "deploy: dockerize backend, add production config"
git push origin main
```

This uploads the `backend/Dockerfile`, the `app/` code, and `next.config.ts` that Render
and Vercel will build from.

---

# PART A — Deploy the BACKEND to RENDER (via Docker)

## A1. Create the Web Service (Docker)

1. Go to [dashboard.render.com](https://dashboard.render.com) and log in.
2. Click **New → Web Service**.
3. **Connect your GitHub repo** (`FaizanAhmeddd27/Agentic-Research-Assistant`).
   If it doesn't appear, click **Configure account** → grant Render access to that repo.
4. Render detects the project. In the settings form set:
   - **Name:** `derve-backend`
   - **Runtime:** `Docker`
   - **Root Directory:** `backend`  ← **critical.** The Dockerfile is inside `backend/`,
     and setting the root directory makes Render use `backend/` as the Docker build context.
   - **Instance type:** `Free` (see limitations in section 8) or a paid plan.
   - **Health Check Path:** `/health`
5. Click **Create Web Service**. Render builds the image and deploys.

> The first build can take a few minutes (it installs Python deps and preloads the
> embedding model into the image).

## A2. Set environment variables (secrets)

After the service is created:

1. Open your service → **Environment** tab.
2. Add **Environment Variables**. Use the **"secret"** flag for anything sensitive.

| Key | Example / source |
|---|---|
| `DATABASE_URL` | Your Neon pooled URL, e.g. `postgresql://…@ep-….pooler.c-….aws.neon.tech/neondb?sslmode=require&channel_binding=require` |
| `QDRANT_URL` | `https://<your-cluster>.qdrant.io` |
| `QDRANT_API_KEY` | Your Qdrant key (secret) |
| `GROQ_API_KEY` | Your Groq key (secret) |
| `GEMINI_API_KEY` | Your Gemini key (secret) |
| `TAVILY_API_KEY` | Your Tavily key (secret) |
| `LANGSMITH_API_KEY` | Your LangSmith key (secret, optional) |
| `LANGSMITH_PROJECT` | `Derve` |
| `LANGSMITH_TRACING` | `true` |
| `LANGSMITH_ENDPOINT` | `https://api.smith.langchain.com` |
| `AUTH_SECRET` | A long random string (secret) — generate with `openssl rand -hex 32` |
| `CORS_ORIGINS` | **Your Vercel URL**, e.g. `https://my-app.vercel.app` (see Part C) |

> `PORT` is provided automatically by Render — do **not** set it manually.

3. Save, then Render triggers a redeploy so the new env vars take effect. Wait for the
   deploy to finish and show **Live**.

## A3. Verify the backend

Visit your backend health endpoint:

```
https://<your-backend>.onrender.com/health
```

You should see JSON: `{"status":"ok"}`

> Free instances sleep after ~15 min of inactivity. The first request after a sleep will
> have a **cold start** delay (up to ~1 min) while it wakes up. See section 8.

---

# PART B — Deploy the FRONTEND to VERCEL

## B1. Import the project

1. Go to [vercel.com](https://vercel.com) and log in.
2. Click **Add New → Project**.
3. **Import** your GitHub repo `Agentic-Research-Assistant`.
4. In **Configure Project**, set:
   - **Framework Preset:** `Next.js` (auto-detected).
   - **Root Directory:** `frontend`  ← **critical.** The Next.js app lives in `frontend/`.
   - Build command: `next build` (default).
   - Output directory: leave default (`.next`).

## B2. Set environment variables

Still on the project config page (or later under **Settings → Environment Variables**),
add:

| Key | Value (production) |
|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | `https://<your-backend>.onrender.com` (from Part A, no trailing slash) |

> `NEXT_PUBLIC_*` variables are inlined into the browser bundle at **build time**, so
> after changing it you must redeploy (see section 7).

Request a **Production environment** variable. Then click **Deploy**.

## B3. Verify the frontend

Open your Vercel URL (e.g. `https://my-app.vercel.app`). You should see the login page.
Sign up / log in and run a research session end-to-end.

> No NextAuth / `DATABASE_URL` / `NEXTAUTH_*` variables are needed on Vercel — auth and
> the database are fully handled by the FastAPI backend.

---

# PART C — Wire them together (CORS)

The browser talks to a different origin (Vercel) than the backend (Render), so you must
allow it via CORS.

1. Set the backend env var `CORS_ORIGINS` to your **exact** frontend URL.
   - One domain: `CORS_ORIGINS=https://my-app.vercel.app`
   - Multiple domains: `CORS_ORIGINS=https://my-app.vercel.app,https://www.example.com`
2. Re-deploy the backend (Render) so it picks up the new value.
3. Test the flow again. If the browser console shows a **CORS** error, double-check the
   origin string matches exactly (including `https://` and no trailing slash).

---

# PART D — Full smoke test (after both are live)

1. Open the Vercel URL in a normal browser tab.
2. **Sign up** with a new email → you land on the Dashboard.
3. Click **New Research**, type a question, and hit **Start Research**.
4. Watch the timeline stream (Planning → Retrieving → Critiquing → Writing → Review).
5. On the review panel, click **Approve & Finalize** → the final report renders.
6. Confirm:
   - The thread appears in **Dashboard / History**.
   - Completing a session creates entries under **Memory**.
   - Upload a document in **Settings** and re-run to exercise RAG.
7. **Reload the page / reopen your browser** and confirm the thread, report, and memory
   all persist (they are stored in Neon).

---

# PART E — Updating / redeploying later

**Every push to `main`** auto-triggers a new deploy on both Render and Vercel (if you
connected the repos in the dashboard). No manual action needed for code changes.

If you only changed **environment variables** (not code): go to each service →
**Environment** tab → update → **Deploy** (or **Redeploy**) from the top-right menu.

Always redeploy after changing `NEXT_PUBLIC_BACKEND_URL` or `CORS_ORIGINS`, because they
are baked in at build time.

---

# PART F — Free-tier limitations (important, read)

The **free tier** has limits that matter for this app:

| Limit | Impact |
|---|---|
| Backend **sleeps after 15 min** without traffic | Cold starts → first fetch takes up to ~1 min. Lots of users / infrequent use feels slow. |
| **Cold start on every wake** | The embedding model is baked into the Docker image (see `backend/Dockerfile`), so the biggest download is avoided — but provider connections still re-init. |
| **512 MB RAM** (free) | Fine for this app (no PyTorch), but a very heavy concurrent load could hit memory. |
| Render free **doesn't keep web services always-on** | Long-running research during idle windows may be interrupted by sleep. |

**Recommendations if you want reliability:**
- Use a paid **Starter** (or higher) web service on Render → no sleep, always-on, faster
  cold start, more RAM.
- If SSE streams keep dropping during long runs on a free instance, this is almost
  certainly the 15-minute sleep — upgrading to an always-on plan fixes it.

---

# PART G — Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Browser **CORS** error on login/API calls | `CORS_ORIGINS` not set to the exact Vercel URL, or backend not redeployed after setting it. |
| Backend health endpoint times out / slow first hit | Free tier cold start — wait ~1 min and retry. |
| Build fails at the Docker stage | Make sure **Root Directory = `backend`** in Render (the Dockerfile is there). |
| Frontend can't reach backend ("failed to fetch") | `NEXT_PUBLIC_BACKEND_URL` wrong, missing trailing-slash mismatch, or backend asleep. |
| Auth token invalid after redeploy | `AUTH_SECRET` changed between deploys — keep it the same, or log in again. |
| Threads/memory don't persist | Verify `DATABASE_URL` (Neon) is set; checkpoints/memory are stored there. |

---

## Files you just deployed

```
backend/Dockerfile          # Render builds this image
backend/.dockerignore       # keeps .env, caches out of the image
backend/.env.example        # template of backend env vars (no secrets)
backend/app/config.py       # reads env vars (incl. CORS_ORIGINS)
backend/app/main.py         # FastAPI entrypoint (uvicorn app.main:app)
frontend/.env.example       # template of frontend env vars
frontend/src/lib/api.ts     # uses NEXT_PUBLIC_BACKEND_URL for all calls
```
