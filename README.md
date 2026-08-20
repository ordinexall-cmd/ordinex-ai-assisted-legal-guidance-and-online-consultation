# Ordinex (OXfinal)

Legal consultation platform for citizens and lawyers in the Philippines — AI-assisted pre-guidance (case identification), lawyer booking, video consults, and messaging.

## Repository layout

```
OXfinal/
├── public/              Static assets (favicon, icons)
├── docs/legal/          Privacy Policy & Terms of Service
├── src/                 React + TypeScript frontend (Vite)
│   ├── components/      UI by feature (booking, dashboard, shell, …)
│   ├── context/         React context providers
│   ├── hooks/           Shared hooks
│   ├── pages/           Route-level screens
│   ├── services/        API and socket clients
│   └── utils/           Pure helpers
├── server/              Node.js API (Express, Prisma, Socket.IO)
│   ├── prisma/          Schema, seeds, migrations
│   └── src/
│       ├── routes/      HTTP route handlers
│       ├── services/    Business logic (AI, bookings, translate, …)
│       ├── socket/      Real-time booking events
│       └── middleware/
└── .github/workflows/   CI
```

## Shell navigation

Logged-in app pages use a **vertical icon sidebar** (`AppSideNav`) with labels on hover. Marketing pages (`/`) use `MarketingNav`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Frontend dev server |
| `npm run dev:all` | Frontend + API together |
| `npm run build` | Production frontend build |
| `npm run preview` | Serve production build locally |
| `npm run server:dev` | API dev server |
| `npm run server:seed` | Seed database |
| `npm run server:reset-demo` | Fresh demo data (requires `CONFIRM_RESET_DEMO=1` or `--yes`) |
| `npm run server:defense-reset` | Wipe all users and re-seed demo accounts |
| `npm run server:test:defense-flow` | E2E API: analyze → book → lawyer linked-analysis |
| `npm run server:sync-demo` | Upsert demo accounts only |
| `npm run server:verify` | Check server env |
| `npm run server:test:smoke` | DB + optional health smoke |
| `npm run server:test:api` | HTTP API checks (server must be running) |
| `npm run server:test:demo` | Login + role checks for the citizen and lawyer demo accounts |
| `npm run server:test:socket` | Socket.IO connect smoke (server must be running) |

## iPhone home screen (PWA)

Ordinex is a PWA on your deployed Render URL. On iPhone, use **Safari**:

1. Open `https://<your-app>.onrender.com` in Safari and log in.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Open the Ordinex icon — it launches full-screen from the same URL.

For local LAN testing during development, use the Network URL Vite prints when you run `npm run dev:all` (same Wi‑Fi as your laptop).

## External services

- **Groq** — AI case identification and booking chat translation (`GROQ_API_KEY` in `server/.env`)
- **Gemini** — Live consultation captions (`GEMINI_API_KEY`). Tap **Start listening** in the video room; silence / lone `.` clips are dropped.
- Copy `server/.env.example` → `server/.env` for local API config

## Video consultations (PeerJS)

Private 1:1 video uses **PeerJS** WebRTC (no paid video SaaS).

- Both parties must open the **deployed HTTPS** URL (e.g. Render). Camera fails on plain `http://` LAN (“operation is insecure”).
- Join order is retried automatically. If laptop ↔ phone still cannot see each other across networks, add a free TURN provider and set on the **frontend** env (Vite):
  - `VITE_TURN_URL` (e.g. `turn:openrelay.metered.ca:80`)
  - `VITE_TURN_USERNAME` / `VITE_TURN_CREDENTIAL`
  - Or `VITE_ICE_SERVERS` as a JSON array of `RTCIceServer` objects
- Optional PeerServer override: `VITE_PEERJS_HOST`, `VITE_PEERJS_PATH`, `VITE_PEERJS_SECURE=true`
- In-call: manual **Record**, **Share screen**, tap the PiP tile to **swap** views, side **Chat**, transcript strip below (Gemini when listening).

## Deploy (free) — Render + Neon

Ordinex deploys as **one** Render Web Service that serves the built SPA, the API,
Socket.IO, and auth-gated uploads on a single origin. Postgres is hosted on Neon
(the Render free database expires after 30 days, so do not use it).

1. **Database (Neon, free):** create a project at [neon.tech](https://neon.tech).
   Copy the **pooled** connection string into `DATABASE_URL` and the **direct**
   string into `DIRECT_URL`.
2. **Web service (Render, free):** New → Blueprint, point it at this repo
   (or New → Web Service, instance type **Free**). The included
   [`render.yaml`](render.yaml) sets:
   - Build: `npm install --include=dev` + Vite build + Prisma generate
     (`--include=dev` is required so Vite/TypeScript install even when
     `NODE_ENV=production`)
   - Start: `prisma db push` then `node src/index.js` (schema sync lives here
     because Free instances do not support pre-deploy commands)
   - Health check: `/api/health`
   - Instance type: **Free** (do not pick Starter — that is paid compute)
3. **Environment variables** (Render dashboard → Environment):
   - `JWT_SECRET` — generated automatically (or set a 32+ char random value)
   - `DATABASE_URL`, `DIRECT_URL` — from Neon (if you only have one URL, paste
     it into both)
   - `GROQ_API_KEY` (and optional `GEMINI_API_KEY`)
   - `FRONTEND_URL` and `API_PUBLIC_URL` — optional; they default to the Render
     URL. Set both to `https://<your-app>.onrender.com` once you know it.
   - `NODE_ENV=production`, `TRUST_PROXY=1`, `PAYMENTS_MODE=simulated`
   - `SMTP_*`, `GOOGLE_CLIENT_ID/SECRET`, `ADMIN_EMAILS`
4. **First deploy:** Render builds, then on start pushes the Prisma schema to
   Neon. Verify `https://<your-app>.onrender.com/api/health` returns
   `{"status":"ok"}`, then optionally seed demo data from a local machine
   (`npm run server:seed`) pointed at the same `DATABASE_URL`.

Free-tier notes: the service sleeps after ~15 min idle (first request ~1 min cold
start); the local `uploads/` disk is ephemeral (wiped on redeploy/restart); Neon
scales to zero when idle. Set `PAYMENTS_MODE=paymongo` only with valid
`PAYMONGO_SECRET_KEY`, `PAYMONGO_PUBLIC_KEY`, and `PAYMONGO_WEBHOOK_SECRET`.

## License & compliance

- Project code: MIT — see [`LICENSE`](LICENSE) (includes third-party OSS credits)
- Full lockfile package list: [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) (`npm run licenses:generate`)
- Privacy (RA 10173) and Terms: [`docs/legal/`](docs/legal/) and in-app routes `/privacy`, `/terms`, `/licenses`
