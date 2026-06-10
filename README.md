# HattrickDash

A self-hosted, local-first analytics and management dashboard for
[Hattrick](https://www.hattrick.org) managers. Connects to Hattrick via the
official CHPP API and gives you everything in one place: league standings,
finances, lineup planning with the Loddar-Stats indicator, transfer history,
stadium analysis (including an Arenasizer), training, and youth team data.

Runs locally on port `8765`. Your data stays on your own machine.

## Features

- **Team overview** — league table, schedule, top scorers, financial
  breakdown, stadium attendance, team value
- **Squad** — full skill table with sortable columns + injury calculator
- **Matches** — possessions, ratings (mid/def/att split), attack/defense
  statistics per match
- **Lineup** — pitch canvas, formation assistant, tactical details with
  Loddar-Stats / HatStats / Squad scores, save/load, a **rating preview**
  (Hattrick computes the predicted mid/def/att ratings without setting the
  lineup), and **submit the lineup directly to Hattrick**
- **Transfers** — history, P/L charts, scouting recommendations
- **Finance** — weekly income/expense breakdown, cashflow charts
- **Stadium** — capacity overview + Arenasizer (recommended size based on
  fan club)
- **Training** — weekly history, training type distribution
- **Youth team** — squad with scouted skills, matches, training, and
  promotion recommendations

## Requirements

- Python 3.11 or later
- A Hattrick account (free)

## Quick start

```bash
# 1. Clone
git clone https://github.com/yourname/hattrickdash.git
cd hattrickdash/hattrickdash

# 2. Install dependencies
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS / Linux:
source .venv/bin/activate

pip install -r requirements.txt

# 3. Start the app
python -m uvicorn main:app --reload --port 8765
```

Open `http://localhost:8765` in your browser. The first time you run it,
**Settings → Login** walks you through the OAuth-PIN flow.

## Setup — OAuth login

The CHPP application credentials are bundled with the project — you do
**not** need to register your own CHPP app. Just authorise this
installation against your own Hattrick account:

1. **Open Settings → Login** in the dashboard.

2. Click **"OAuth starten – Hattrick-Login öffnen"**. A new tab opens
   on `hattrick.org` where you log in with your manager account and
   approve access for HattrickDash. Hattrick then shows you a PIN.

3. Paste the PIN back into HattrickDash. The app exchanges it for an
   OAuth token, auto-detects your team ID, and restarts the scheduler.

4. Optionally hit **Settings → Daten-Pull → ⚡ Full-Init** to pull team,
   players, matches, finances etc. for the first time (1–2 minutes,
   rate-limited).

After that, the scheduler runs daily at 06:00 (team/players/finance/etc.),
matchday at 23:00 on Tue/Sat (matches), and weekly on Mondays
(transfers). All polling respects Hattrick's rate limits (max 12
requests/minute, 5-second delay between calls).

### Maintainer note: rotating the bundled Consumer Secret

The CHPP **Consumer Key** is plain text in
`hattrickdash/_app_credentials.py` (Hattrick rules explicitly allow this —
the consumer key identifies the app). The **Consumer Secret** is stored
AES-256-GCM-encrypted with an obfuscation key embedded in the same file
(matching the established pattern of long-running Hattrick community
tools). To rotate it after a key change at
`chpp.hattrick.org/Apps/User/EditApp.aspx`:

```bash
python hattrickdash/_encrypt_tool.py
# enter the new plaintext secret (input is hidden)
# paste the resulting base64 line into _app_credentials.py
```

Forks who prefer their own CHPP application can either edit
`_app_credentials.py` directly or override at runtime via the
`HATTRICK_CONSUMER_KEY` / `HATTRICK_CONSUMER_SECRET` environment
variables.

## Hattrick CHPP compliance

This app follows Hattrick's published CHPP rules. In particular:

- **No replication of Hattrick Supporter features.** Individual player
  skill progression history is part of the Hattrick Supporter
  package — this app does **not** track or display per-player skill
  history over time. Only the current snapshot is stored and shown.
- **Stadium and finance history** is collected and visualized, since
  it's not part of the Supporter feature set.
- **OAuth tokens** stay on your local machine (`config.json`,
  gitignored).

## Privacy

- All data stays on your machine — no cloud, no telemetry, no analytics.
- The SQLite database (`data/hattrickdash.db`) and your CHPP credentials
  (`config.json`) are excluded from git via `.gitignore`.
- Logs (`logs/app.log`) may contain match IDs and team IDs — they too
  are gitignored.

## Stack

- **Backend:** Python 3.11+, FastAPI, SQLAlchemy 2, APScheduler
- **CHPP client:** `requests-oauthlib` for OAuth 1.0a, `lxml` for XML parsing
- **Frontend:** vanilla HTML/CSS/JS + Alpine.js for reactivity, Chart.js
  via CDN. **No build chain** — open the page, refresh, done.
- **Pitch:** HTML Canvas, no external library.

## Project layout

```
hattrickdash/
├── main.py                  FastAPI entry point
├── config.py                Paths, OAuth state (config.json - gitignored)
├── database.py              SQLAlchemy setup, sessions
├── scheduler.py             APScheduler jobs (daily / matchday / weekly)
├── chpp/
│   ├── auth.py              OAuth 1.0a flow
│   ├── client.py            HTTP client with rate-limit + retry
│   ├── parser.py            XML → dict
│   └── fetcher.py           One function per CHPP endpoint
├── models/                  SQLAlchemy ORM (team / player / match / ...)
├── services/                Business logic per domain
├── api/                     FastAPI routers per page
└── static/                  Frontend (index.html + js/pages/*.js)
```

## Contributing

PRs welcome. Notes:

- Keep the no-build-chain principle — no React, no Webpack, no Vite.
  Pure browser code.
- All API responses must be Pydantic-validated.
- Errors are logged via `logging`, never printed.
- Anything that touches Hattrick must go through the rate-limiting CHPP
  client (`chpp/client.py`).

## License

**PolyForm Noncommercial License 1.0.0** — see [LICENSE](LICENSE).

In plain terms: you may use, run, study, modify, and share this software
**free of charge for any noncommercial purpose** (personal use, hobby,
your own Hattrick team, clubs, schools, non-profits). You may **not** sell
it, offer it as a paid product or service, or otherwise use it
commercially / to make money — and you may not redistribute it (modified
or 1:1) for commercial purposes. Keep the copyright notice with any copy
you pass on. This keeps the tool free for the Hattrick community, in line
with the spirit of the CHPP rules.

## Acknowledgements

Thanks to the Hattrick team for providing the CHPP API to the manager
community.

## Trademark notice

Hattrick™ is a trademark of Extralives AB. This project is an independent
community tool and is not affiliated with or endorsed by Hattrick.
