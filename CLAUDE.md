# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PGMais Team Dashboard — a full-stack Jira Cloud management tool. FastAPI backend (Python 3.11+) + React 19 frontend (Vite 7). SQLite for caching/persistence. AI features via OpenRouter (Claude Sonnet).

## Build & Run Commands

### Backend
```bash
cd backend
pip install -r ../requirements.txt
python main.py                  # Uvicorn on port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev                     # Vite dev server on port 5173
npm run build                   # Production build → dist/
npm run lint                    # ESLint
```

### Docker (full stack)
```bash
docker-compose up
```

## Architecture

**Backend** (`backend/main.py` ~1068 lines): Single FastAPI app with all routes. Layered as middleware → routes → helpers → clients.

- `jira_client.py` — Jira Cloud REST API integration (parallel fetches for active, done-this-week, done-last-week, 30-day history)
- `auth.py` — JWT authentication (8h expiry), admin/user management, bcrypt password hashing
- `cache.py` — 3-tier caching: in-memory (fast) → SQLite (persistent) → TTL auto-expiry. Dashboard cache = 5min, historical = 1hr
- `security.py` — Input validation, output sanitization, rate limiting
- `models.py` — Pydantic models for Issue, DevSummary, KPI, etc.
- `database.py` — SQLite init & queries
- JSON files (`users.json`, `bus.json`, `priority_requests.json`, `account_ranking.json`) — local config/state storage

**Frontend** (`frontend/src/App.jsx` ~565 lines): Single-page app, no router. App.jsx is the orchestrator — fetches data, manages auth state, passes props down to views.

- State management: React Hooks only (useState, useEffect, useMemo). No Redux/Zustand.
- Filtering: All client-side via useMemo (no server-side filtering)
- Auto-refresh: 5-minute polling interval
- Views: DashboardHome, KanbanView, ManagementView, ProductView, TimelineView, PrioritizationView, AdminView, AIInsightsView
- `apiUrl.js` — Resolves API base URL (VITE_API_URL → localhost:8000 → auto-detect for Codespaces)

**Data flow**: Frontend → `GET /api/dashboard` (JWT in Authorization header) → Backend fetches Jira in parallel → caches response → returns devs, backlog, done_issues, KPIs.

## Key API Endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/dashboard` | JWT | Core data (cached 5min) |
| `POST /api/refresh` | JWT + refresh secret | Force Jira re-fetch |
| `GET /api/health` | None | Health check |
| `POST /api/auth/login` | None | Login |
| `GET/POST/PUT/DELETE /api/admin/*` | Admin | BU, ranking, admin management |
| `GET/POST/DELETE /api/priority-requests` | JWT | Priority queue |

## Environment Variables

Backend `.env` (see `backend/.env.example`):
- `JIRA_EMAIL`, `JIRA_TOKEN`, `JIRA_BASE_URL`, `JIRA_PROJECT` — Jira Cloud credentials
- `JWT_SECRET`, `REFRESH_SECRET` — Auth secrets
- `OPENROUTER_API_KEY` — AI features
- `ALLOWED_ORIGINS` — CORS origins

Frontend: `VITE_API_URL`, `VITE_REFRESH_SECRET`, `VITE_POSTHOG_KEY`

## Auth & Roles

Two role tiers: regular users and admins. BU types: `Operacional` and `Gestao`. Allowed email domains: `@pgmais`, `@ciclo`. Admin-only features: account ranking, BU management, admin management. Gestao role can deprioritize issues.

## Language

The application UI, commit messages, and code comments are in Brazilian Portuguese. Follow this convention.
