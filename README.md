# Scheme Saathi

A Telegram bot (also on WhatsApp) that asks citizens a few simple questions, matches them to Indian government schemes they may be eligible for, and gives the benefits, documents needed and the official link to apply. It works in **English, Hindi and Malayalam**. A daily **pipeline** watches official portals for new schemes and application windows and alerts eligible users when applications open or are about to close.

Built with Next.js 16 (App Router) and TypeScript. Data lives in **Supabase (Postgres)** in production and in Node's built-in SQLite locally; Groq is optional.

**Deploy:** [Vercel + Supabase guide](docs/DEPLOY-VERCEL.md) · **Docs:** [Codebase & features](docs/CODEBASE.md) · [Flows](docs/FLOW.md) · [Decisions](docs/DECISIONS.md) · [Content review](docs/REVIEW.md)

## How it works

```
WhatsApp ─┐                        ┌─ eligibility engine (src/lib/eligibility.ts)
Telegram ─┼─► webhook ─► agent ────┼─ scheme catalogue (SQLite; seeded from src/lib/schemes/seed.ts)
Web sim  ─┘   (src/app/api/*)      └─ Groq (optional): free-text answers, Q&A
                 (src/lib/agent.ts)

Cron ─► /api/pipeline/run (202, runs in background) ─► fetch official sources ─► extract schemes + windows ─► review queue
                              (src/lib/pipeline/*)          (Groq, or heuristic)             admin approves ─► notify eligible users
```

- **Conversation:** language → age → gender → state → rural/urban → occupation → (land, for farmers) → income band → category → disability → BPL card → daughter under 10. Answers can be a button tap, a number, a label in any of the three languages, or free text (Groq interprets it when configured).
- **Privacy:** the bot never asks for Aadhaar, PAN, bank, card or passport numbers. If a user sends one, it is refused and not stored.
- **Consent and deletion (DPDP Act 2023):** after choosing a language, users see what is stored and why and must agree before any question; declining stores nothing. `/delete` (or “delete my data” in any of the three languages) erases the profile, settings and alert history after a confirmation.
- **After the questions:** the user gets a ranked list (open windows first), can reply with a number for details, ask free-form questions (Groq answers in their language, grounded in their matched schemes), or use `menu`, `schemes`, `restart`, `language`, `alerts on` / `alerts off`, `help`.
- **Alerts:** a scheme triggers an "applications open" alert when its window is open or the pipeline just discovered it, and a reminder 3 days before it closes. Each user gets each alert once per window.

## Run locally

```bash
npm install
cp .env.development.example .env   # APP_ENV=development; everything else is optional
npm run dev                        # http://localhost:3000 — /try has the bot simulator
```

Other commands:

| Command | What it does |
| --- | --- |
| `npm test` | Conversation, eligibility, pipeline and configuration tests |
| `npm run check:env` | Validate `.env` for the current `APP_ENV` without starting the server |
| `npm run pipeline` | Run discovery + notifications once (`-- --force` re-reads unchanged pages, `-- --no-notify` skips alerts) |
| `npm run seed` | Reload the built-in catalogue after editing `src/lib/schemes/seed.ts` |
| `npm run telegram:set-webhook` | Register `APP_BASE_URL/api/telegram/webhook` with Telegram |

Admin: `/admin`. Sign in with `ADMIN_TOKEN` (open without a token in development). Tabs:

| Tab | What it does |
| --- | --- |
| **Dashboard** | Review queue (approve or reject pipeline findings), stats, live pipeline logs, Run now |
| **Schemes** | Edit any scheme in three languages (rules as validated JSON), hide or show it; CSV exports of schemes, a fact check sheet and a translation review sheet |
| **Broadcast** | Message all subscribed users who gave consent, optionally only one channel or language; delivery counts per broadcast |
| **Insights** | Drop off funnel (how many people reached each question, who stalled there for over 24 hours, the worst step), languages, channels, consent declines and deletions; anonymised users CSV |

## Monitoring

- **Error tracking:** set `SENTRY_DSN` to send server errors (unhandled request errors, failed sends, failed pipeline runs) to Sentry or any Sentry-compatible service such as GlitchTip. It uses Sentry's standard ingest API with no extra package; browser errors and performance tracing would need the full `@sentry/nextjs` SDK.
- **Telegram alerts:** with `ADMIN_TELEGRAM_CHAT_ID` set, the admin gets a Telegram message when errors happen (at most one per `ERROR_ALERT_MINUTES`, default 10, with a count of suppressed ones), when a pipeline run fails, and when items wait for review or a source fails.

## Environments: `APP_ENV`

One variable switches the behaviour profile. It defaults to `NODE_ENV`, so `npm run dev` is development and `npm start` is production unless you set it.

| | `APP_ENV=development` | `APP_ENV=production` |
| --- | --- | --- |
| Template | `.env.development.example` | `.env.production.example` |
| Missing settings | Warnings at startup | **Server refuses to start** and lists what is missing |
| Required | Nothing | `APP_BASE_URL` (https), `CRON_SECRET`, `ADMIN_TOKEN` (16+ chars), at least one channel, and that channel's secrets |
| `/admin` | Open if `ADMIN_TOKEN` is unset | Login form, httpOnly session cookie, 10 attempts per 15 min |
| `/api/pipeline/run` | Open if `CRON_SECRET` is unset | `Authorization: Bearer $CRON_SECRET` required |
| Webhooks | Signature/secret checks skipped if unset | Telegram secret and WhatsApp HMAC signature always checked |
| Logs | Readable, `debug` level | One JSON object per line, `info` level |
| Headers | Security headers | Security headers + HSTS |

Check a config before deploying with `npm run check:env`.

## Deploy to production

**Vercel + Supabase (recommended).** Follow [docs/DEPLOY-VERCEL.md](docs/DEPLOY-VERCEL.md). In short: create a Supabase project, put its **transaction pooler** URI in `DATABASE_URL` along with `APP_ENV=production` and the secrets in Vercel's Environment Variables, and deploy. Every deployment validates the config (and stops if something required is missing), migrates the database, seeds the schemes, then builds.

| Command | What it does |
| --- | --- |
| `npm run db:migrate` | Create or update the Postgres schema (`supabase/migrations`) and seed the schemes |
| `npm test` | Every test on SQLite **and** on Postgres (PGlite with the real migration) |

**Docker (recommended).** The image runs the standalone Next.js server as a non root user, stores SQLite on a volume and has a health check.

```bash
cp .env.production.example .env      # fill in every REQUIRED value
docker build -t scheme-saathi --build-arg NEXT_PUBLIC_WHATSAPP_NUMBER=919876543210 --build-arg NEXT_PUBLIC_TELEGRAM_BOT=SchemeSaathiBot .
docker run -d --name saathi --restart unless-stopped --env-file .env -p 3000:3000 -v saathi-data:/app/data scheme-saathi
```

Put it behind an HTTPS reverse proxy (Caddy, Nginx, or your host's load balancer), then register the webhooks against `APP_BASE_URL` and schedule the pipeline with `curl -H "Authorization: Bearer $CRON_SECRET" $APP_BASE_URL/api/pipeline/run`.

**Without Docker.** `npm ci && npm run build && npm start` on a server with Node 22.13+ and a persistent disk; keep it running with systemd or pm2.

**Monitoring.** `GET /api/health` returns status, environment, enabled channels and the last pipeline run.

## Connect the channels

**Telegram**
1. Create a bot with [@BotFather](https://t.me/BotFather) and put the token in `TELEGRAM_BOT_TOKEN`.
2. Set `TELEGRAM_WEBHOOK_SECRET` to a random string and `APP_BASE_URL` to your public HTTPS URL (use a tunnel such as `ngrok http 3000` locally).
3. `npm run telegram:set-webhook`

**WhatsApp (Meta Cloud API)**
1. Create an app at developers.facebook.com and add the WhatsApp product. Copy the access token and phone number ID into `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID`, and the app secret into `WHATSAPP_APP_SECRET`.
2. Set the webhook URL to `https://<your-domain>/api/whatsapp/webhook`, choose a verify token, put the same value in `WHATSAPP_VERIFY_TOKEN`, and subscribe to the `messages` field.
3. For alerts: WhatsApp only allows free-form messages within 24 hours of the user's last message. To reach users after that, create and get approval for a **utility template** with two body variables (`{{1}}` scheme name, `{{2}}` details) in English, Hindi and Malayalam, and set `WHATSAPP_NOTIFY_TEMPLATE`. Without a template, alerts to inactive WhatsApp users are skipped and retried on the next run.

**Groq (optional, recommended)**
Set `GROQ_API_KEY`. This turns on free-text understanding, multilingual Q&A, and AI extraction in the pipeline: new schemes come with their eligibility rules, windows and en/hi/ml translations. Requests use `openai/gpt-oss-120b` (change with `GROQ_MODEL`). Without a key the bot works rule-based, and the pipeline only picks up deadlines for schemes already in the catalogue.

## The pipeline

Sources are in `src/lib/pipeline/sources.ts` (National Scholarship Portal, PM Internship, myScheme, PIB press releases, Kerala DCE scholarships, kerala.gov.in). To change them, create `data/sources.json` with the same shape. Each run:

1. Fetches every source and skips pages whose content hash hasn't changed.
2. Extracts schemes and application windows (Groq), or looks for "last date …" next to known scheme names (heuristic).
3. **Queues** new schemes and window changes in the admin **review queue**. Nothing reaches users until an admin approves it; approving publishes the item and alerts eligible users straight away.
4. Sends reminders for approved windows that are opening or closing.
5. Messages the admin on Telegram (`ADMIN_TELEGRAM_CHAT_ID`) when items are waiting for review or a source failed.

**It is not a separate service.** The pipeline runs inside the app; it only needs a daily trigger. `GET /api/pipeline/run` replies **202** at once with a `runId` and does the work in the background, so proxies and cron jobs never time out. Only one run can happen at a time (another trigger gets **409**), and a run stuck for 30 minutes is marked abandoned. Check progress at `/api/pipeline/status?id=<runId>` (same `Bearer CRON_SECRET`), or on the admin page, which refreshes itself while a run is going. Add `?wait=1` to block until the run finishes.

Scheduling: `vercel.json` runs it daily at 09:00 IST through Vercel Cron (set `CRON_SECRET`). When self-hosting, add a cron entry on the server that calls the app directly:

```bash
30 3 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/pipeline/run
```

`npm run pipeline` does the same from a checkout of the code (it is not available inside the Docker image).

Known limitation: PIB currently returns HTTP 403 to non-browser clients, and myScheme renders mostly client-side, so these two yield little. Adding more official sources (state portals, ministry notices) improves coverage.

## Deployment notes

- Storage is SQLite through `node:sqlite` (Node ≥ 22.13), all in `src/lib/db.ts`. That works on a VM or container with a persistent disk. For serverless hosting such as Vercel, whose filesystem is ephemeral, reimplement the functions in `db.ts` against Postgres or Turso.
- Webhooks reply right away and do the work after the response (`after()`), so slow Groq calls don't cause platform retries.

## Data accuracy

`src/lib/schemes/seed.ts` has 25 established central and Kerala schemes with benefits written in all three languages. Amounts and rules change, so review them periodically. Every result tells users that eligibility is indicative and must be confirmed on the official portal.
