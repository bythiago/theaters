# AGENTS.md

## Project Overview

Cinema Marathon Planner — SPA for planning double/triple movie sessions at cinemas. Portuguese (pt-BR) UI.

**Stack:** Flask proxy (Python) + vanilla ES modules (zero build step).

## Quick Start

```bash
# Backend (Flask, port 8080)
python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python server.py

# Frontend (port 3000, must be served — file:// won't work)
npx serve . -p 3000
```

**Docker:** `docker compose up --build` → serves everything on port 8080.

## Architecture

Two-process app, no build step. Frontend uses native ES modules (`type="module"`).

- **`server.py`** — Flask proxy to `https://api-content.ingresso.com/v0` with `partnership=home`. Three API endpoints: `/theaters`, `/theaters/city/<id>`, `/sessions/city/<city_id>/theater/<theater_id>`. Serves static files via catch-all.

- **`src/api.js`** — Fetch wrapper with `Map` cache (TTL: 5 min). Uses `window.location.origin` for BASE_URL.

- **`src/scheduler.js`** — Pure logic: `flattenSessions()` normalizes API response (dateGroups → movies → rooms → sessions) into flat array. `findNextSessions()` filters by wait window (15–180 min), assigns feasibility: `ideal` (≤60), `ok` (≤120), `long_wait` (>120). `buildMarathon()` computes stats.

- **`src/app.js`** — State orchestration: `{ theaters, cities, sessions, selectedDate, marathon, _dateGroups }`. Sequential flow: city → theater → date → session → marathon. `resetStep(from)` cascades resets.

- **`src/ui.js`** — Pure rendering functions (innerHTML + listeners). Groups sessions by `movieId`. Uses `feasibility` for CSS classes (`--ideal`, `--ok`, `--long_wait`).

- **`index.html`** — Steps 1–3 (`.sidebar`), steps 4–5 (`.content`). Visibility via `step--active` class.

## Key Conventions

- **Language:** All UI text in Portuguese (pt-BR). Date formatting uses `Intl` or manual `pt-BR` locale.
- **CSS:** BEM naming, dark theme with CSS custom properties in `:root`. Font: Inter (Google Fonts).
- **Accessibility:** Skip links, `aria-live="polite"` on dynamic regions, `aria-label` on interactive elements, `.sr-only` for screen-reader-only content.
- **State:** Theater select value is JSON string `{id, cityId}` to avoid extra lookups.
- **Session data:** `enabled: false` entries must be skipped. Duration is string in minutes.

## Deployment

- **GitHub Pages:** Auto-deploys on push to `main` via `.github/workflows/deploy.yml`.
- **Docker:** Single service, Python 3.12-slim, binds to `0.0.0.0:8080`.
- **WSL2:** Needs `netsh interface portproxy` for browser access from Windows host.

## Gotchas

- Frontend **must** be served (ES modules don't work with `file://` protocol).
- No tests, linter, or typechecker configured in this repo.
- `api.js` cache has no invalidation beyond TTL — stale data possible within 5 min window.
- `_dateGroups` is added dynamically to state (not in initial literal) when sessions are fetched.
- `ordinal()` in `ui.js` returns ordinal suffix for Portuguese (e.g., "2º", "3º").
