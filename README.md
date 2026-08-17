# Ordinex (OXfinal)

Legal consultation platform for citizens and lawyers in the Philippines — AI case analysis, lawyer booking, video consults, and messaging.

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
| `npm run phone:tunnel:dev` | HTTPS Cloudflare tunnel to Vite `:5173` (use with `dev:all`) |
| `npm run phone:preview` | Serve production build on `:4173` (API proxy enabled) |
| `npm run phone:tunnel` | HTTPS Cloudflare tunnel to preview `:4173` |
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

## Test on iPhone (Safari home screen)

Ordinex can open as a home-screen app on iPhone. Use **Safari** (not Chrome).

### Fast path (recommended)

1. On your laptop, start the stack:
   ```bash
   npm run dev:all
   ```
2. In a **second** terminal, start an HTTPS tunnel:
   ```bash
   npm run phone:tunnel:dev
   ```
3. Cloudflare prints a URL like `https://xxxx.trycloudflare.com`.
4. On your iPhone, open that link in **Safari**. Confirm the site loads and you can log in.
5. Tap **Share** → **Add to Home Screen** → **Add**.
6. Open the new Ordinex icon — it should launch full-screen.

Keep both laptop processes running while you use the phone. Same Wi‑Fi is not required (internet on phone + laptop is enough).

### Full PWA build path (optional)

```bash
npm run server:dev
npm run build
npm run phone:preview
npm run phone:tunnel
```

Then use the printed `https://…` URL in Safari the same way (Share → Add to Home Screen).

**Notes:** Email/password login works through the Vite proxy. Google Sign-In may fail on a changing tunnel hostname unless OAuth / `FRONTEND_URL` match that host.

## External services

- **Groq** — AI case analysis and booking chat translation (`GROQ_API_KEY` in `server/.env`)
- Copy `server/.env.example` → `server/.env` for local API config

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
   - Build: install + Vite build + Prisma generate
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
   - Optional: `SMTP_*`, `SEMAPHORE_API_KEY`, `GOOGLE_CLIENT_ID/SECRET`, `ADMIN_EMAILS`
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
