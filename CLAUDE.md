# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the project

**Backend** (Flask proxy, port 8080):
```bash
.venv/bin/python server.py
# or
source .venv/bin/activate && python server.py
```

**Frontend** (static files, port 3000 — any static server works):
```bash
npx serve . -p 3000
# or
python -m http.server 3000
```

**Install Python dependencies:**
```bash
python -m venv .venv
.venv/bin/pip install -r requirements.txt
```

> **WSL2 note:** The Flask server binds to `0.0.0.0`. To reach it from a Windows browser, set up a port proxy in PowerShell (admin):
> ```powershell
> netsh interface portproxy add v4tov4 listenport=8080 listenaddress=127.0.0.1 connectport=8080 connectaddress=<WSL_IP>
> ```
> Get the WSL IP with `ip addr show eth0` inside WSL.

## Architecture

Two-process app with no build step. The frontend uses native ES modules (`type="module"`) and **must be served** — opening `index.html` as `file://` won't work.

- **`server.py`** — Flask proxy that forwards requests to `https://api-content.ingresso.com/v0` with `partnership=home`. Handles CORS. Three endpoints: `/theaters`, `/theaters/city/<id>`, `/sessions/city/<city_id>/theater/<theater_id>`.

- **`src/api.js`** — Thin fetch wrapper with in-memory `Map` cache. Hardcoded to `http://localhost:8080`.

- **`src/scheduler.js`** — Pure logic (no DOM). `flattenSessions()` normalizes the nested API response (`dateGroups → movies → rooms → sessions`) into a flat array, filtering by date and skipping `enabled: false` entries. `findNextSessions()` filters by wait window (default 15–180 min) and assigns feasibility: `ideal` (≤60 min wait), `ok` (≤120 min), `long_wait` (>120 min). `buildMarathon()` computes summary stats over an ordered list of selected sessions.

- **`src/app.js`** — Orchestrates state and DOM events. State object: `theaters`, `cities`, `sessions` (flat), `marathon` (ordered selected sessions), `selectedDate`, and `_dateGroups` (raw API data — added dynamically when sessions are fetched, not declared in the initial state literal). Selection is strictly sequential: city → theater → date → first session → additional sessions. `resetStep(from)` cascades resets downward from a given step name.

- **`src/ui.js`** — Pure rendering functions (receive data + callbacks, write `innerHTML`, attach listeners). `renderSessionList` groups flat sessions by `movieId` before rendering. `renderNextSessions` and `renderMarathon` use the `feasibility` field to apply CSS modifier classes (`--ideal`, `--ok`, `--long_wait`).

- **`index.html`** — Single page, sidebar/content layout. Steps 1–3 (city/theater/date/session list) are in `.sidebar`; steps 4–5 (suggestions + marathon) are in `.content`. Steps become visible via `step--active` class.

## Key data flow

1. `getTheaters()` returns all theaters; cities are derived client-side from `theater.cityId/cityName`.
2. Theater `<select>` value is a JSON string `{id, cityId}` to avoid extra lookups during session fetching.
3. `getSessions()` returns the raw date-grouped array stored as `state._dateGroups`; `flattenSessions(state._dateGroups, date)` is called on every date change.
4. Marathon is built incrementally: first session via `onSessionSelect`, additional ones via `onNextSessionSelect`. Removing step `i` truncates `state.marathon` to `[0..i)`, then recalculates suggestions from the new last item.

## API session structure

The sessions endpoint returns an array of date groups:
```
response[]              ← one entry per date
  .date                 ← "YYYY-MM-DD"
  .movies[]
    .title, .duration   ← duration is a string in minutes, e.g. "120"
    .rooms[]
      .sessions[]
        .time           ← "HH:MM"
        .type[]         ← ["Dublado"] | ["Legendado"]
        .enabled        ← boolean, skip if false
        .id
```
