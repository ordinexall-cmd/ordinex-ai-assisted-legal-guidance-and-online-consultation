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
| `npm run build` | Production frontend build |
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
| `npm run test:e2e` | Playwright smoke (starts Vite dev server) |

## External services

- **Groq** — AI case analysis and booking chat translation (`GROQ_API_KEY` in `server/.env`)
- Copy `server/.env.example` → `server/.env` for local API config

## License & compliance

- Project code: MIT — see [`LICENSE`](LICENSE) (includes third-party OSS credits)
- Full lockfile package list: [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) (`npm run licenses:generate`)
- Privacy (RA 10173) and Terms: [`docs/legal/`](docs/legal/) and in-app routes `/privacy`, `/terms`, `/licenses`
