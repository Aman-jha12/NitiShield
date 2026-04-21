# ClaimShield

ClaimShield is an MVP full-stack app that **estimates health insurance claim rejection risk**, **explains likely reasons**, and **suggests corrective actions** before submission. It includes **JWT authentication**, **saved analyses** in PostgreSQL, **Redis-backed upload sessions**, and a **Python AI microservice** for parsing, LLM-style extraction (OpenAI / Hugging Face optional), rule-based cross-reference, a small **scikit-learn** model, and **appeal letter** generation.

## Architecture

| Layer | Stack |
|--------|--------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, Recharts (gauge), jsPDF (report) |
| API | Node.js + Express (`server/`), JWT, Multer uploads, Prisma |
| AI | Python + Flask (`ai-service/`), pdfplumber / PyMuPDF, Tesseract OCR fallback |
| Data | PostgreSQL, Redis (optional cache for `/upload` sessions) |

## Prerequisites

- Node.js 20+
- Python 3.11+ (for `ai-service/`)
- PostgreSQL (see `docker-compose.yml`; default port **5433**)
- Redis (optional; default **6379**)
- **Tesseract** + **Poppler** (optional, for OCR / `pdf2image` on scanned PDFs)

## Quick start

1. **Environment**

   Copy `.env.example` to `.env` and set at least:

   - `DATABASE_URL` — e.g. `postgresql://postgres:postgres@localhost:5433/rate_limitter?schema=public`
   - `JWT_SECRET` — long random string
   - `NEXT_PUBLIC_API_URL` — `http://localhost:4000`
   - `AI_SERVICE_URL` — `http://127.0.0.1:5000`
   - `REDIS_URL` — optional, `redis://localhost:6379`

   For richer extraction and explanations, set `OPENAI_API_KEY` (or Hugging Face token + model per `.env.example`). Without keys, the service uses **deterministic heuristics** and templates.

2. **Database**

   ```bash
   npx prisma migrate dev
   npx prisma db seed
   ```

   Demo user (after seed): `demo@claimshield.local` / `password123`.

3. **Install**

   ```bash
   npm install
   pip install -r ai-service/requirements.txt
   ```

4. **Run services** (three terminals)

   ```bash
   # Terminal A — AI service
   cd ai-service
   python app.py
   ```

   ```bash
   # Terminal B — Express API
   cd server
   npm run dev
   ```

   ```bash
   # Terminal C — Next.js
   npm run dev
   ```

   Or run web + API together from the repo root:

   ```bash
   npm run dev:all
   ```

5. **Use the app**

   Open [http://localhost:3000](http://localhost:3000) → **Upload** policy + hospital documents → **Analyze** → review probability, violations, reasons, suggestions → **Generate appeal letter** or **Download PDF report**.

## API (Express)

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/auth/register` | Email + password (≥8 chars) |
| `POST` | `/auth/login` | Returns JWT |
| `POST` | `/upload` | Multipart `policy`, `hospital[]`; optional `Authorization` |
| `POST` | `/analyze` | Multipart files **or** JSON `{ "uploadSessionId" }` after `/upload` |
| `POST` | `/appeal` | JSON: `structured`, `cross_reference`, `probability` |
| `GET` | `/analyses` | JWT — list saved runs |
| `GET` | `/analyses/:id` | JWT — one run |
| `GET` | `/analytics/summary` | JWT — simple aggregates |

## AI service (Flask)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/health` | Liveness |
| `POST` | `/analyze` | Multipart `policy`, `hospital[]` or JSON/text fields |
| `POST` | `/appeal` | Appeal letter from structured result |

On first scoring run, a **logistic regression** model is trained on **synthetic data** and saved under `ai-service/ml/rejection_model.joblib` (ignored by git).

## Project layout

- `src/app/` — Next.js App Router (landing, auth, upload, results, dashboard)
- `server/src/` — Express API
- `ai-service/` — Parsing, extraction, cross-reference, ML, explanations
- `prisma/` — Schema and migrations

## Notes

- This is an **MVP**: predictions are **illustrative**, not licensed medical or legal advice.
- OAuth via NextAuth remains available under `/api/auth/*`; ClaimShield’s saved analyses use **Express JWT** (`/login`, `/register`).
