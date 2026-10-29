# Deploying to Vercel with Supabase

Production runs on **Vercel** (serverless) with **Supabase** (Postgres) as the database. The app picks Postgres automatically when `DATABASE_URL` is set; locally it still uses SQLite.

What happens on every deployment (`vercel-build` in `package.json`):

1. **Config check** (`scripts/vercel-build.ts`). With `APP_ENV=production`, any missing or invalid required variable **stops the deployment** and prints exactly what to fix.
2. **Database migration**: applies `supabase/migrations/*.sql` (idempotent) and seeds the 25 built-in schemes, keeping any admin edits.
3. **`next build`**.

## 1. Create the Supabase project

1. Go to supabase.com → **New project**. Choose the **Mumbai (ap-south-1)** region to stay close to users, and save the database password.
2. Open **Connect** (top of the project page) → **Connection string** → **Transaction pooler**. Copy the URI. It looks like:
   ```
   postgresql://postgres.<project-ref>:<PASSWORD>@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
   ```
   Use the **transaction pooler (port 6543)**, not the direct connection (5432). Serverless functions open many short-lived connections, and the pooler is built for that.
3. You don't need to create tables. The first deployment does it. To do it by hand instead, paste `supabase/migrations/20261029000000_init.sql` into the Supabase **SQL editor**, or run `npm run db:migrate` locally with `DATABASE_URL` set.

**Security:** the migration enables **Row Level Security on every table with no policies**. Supabase's public REST API (the `anon` key) therefore can't read any data, while the app, connecting with the database password, can. Don't add the Supabase anon or service keys to the app; it doesn't use them.

## 2. Create the Vercel project

1. Push this folder to GitHub, then on vercel.com choose **Add New → Project** and import the repository. The framework is detected as Next.js, so keep the default build settings. Vercel runs `vercel-build` automatically.
2. **Settings → Environment Variables**: add these for the **Production** environment.

| Variable | Value | Required |
| --- | --- | --- |
| `APP_ENV` | `production` | yes |
| `DATABASE_URL` | the Supabase **transaction pooler** URI from step 1 | yes |
| `CRON_SECRET` | random, 16+ characters (`openssl rand -hex 32`) | yes |
| `ADMIN_TOKEN` | random, 16+ characters, your admin password | yes |
| `TELEGRAM_BOT_TOKEN` | from @BotFather | yes (or WhatsApp) |
| `TELEGRAM_WEBHOOK_SECRET` | random, 16+ characters (letters, digits, `_`, `-`) | with Telegram |
| `NEXT_PUBLIC_TELEGRAM_BOT` | bot username without `@` | for the website button |
| `APP_BASE_URL` | `https://your-domain` | optional: defaults to the Vercel production domain |
| `ADMIN_TELEGRAM_CHAT_ID` | your chat id | recommended (alerts) |
| `SENTRY_DSN` | Sentry/GlitchTip DSN | recommended |
| `GROQ_API_KEY` | Groq API key | optional (AI features) |
| `WHATSAPP_*`, `NEXT_PUBLIC_WHATSAPP_NUMBER` | see the WhatsApp guide in the README | optional |

3. **Deploy.** The build log starts with `▶ Scheme Saathi build check`. If something is missing, the log lists it and the deployment stops before anything goes live.
4. Check `https://<your-domain>/api/health`. It should show `"status":"ok"`, `"database":"postgres"` and `"schemes":25`.

**Preview deployments** (every pull request) use the **Preview** environment's variables. Either give Preview its own values, ideally pointing at a separate Supabase project or branch so tests don't touch real users, or set `APP_ENV=development` for Preview. Otherwise preview builds stop at the config check.

## 3. Connect Telegram

Register the webhook once per domain, from your computer:

```bash
APP_BASE_URL=https://your-domain TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... npm run telegram:set-webhook
```

Or call the Bot API directly:

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-domain/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

For WhatsApp, set the Meta webhook URL to `https://your-domain/api/whatsapp/webhook`.

## 4. Daily pipeline

`vercel.json` schedules `GET /api/pipeline/run` every day at 03:30 UTC (09:00 IST). Vercel sends `Authorization: Bearer $CRON_SECRET` automatically. The route replies `202` straight away and keeps working in the background. Check **Vercel → Project → Settings → Cron Jobs**, or the admin dashboard, for runs.

## Serverless limits to know

| Limit | How the app handles it |
| --- | --- |
| Functions stop after their maximum duration (`maxDuration = 300` s is set on the pipeline route and the admin pages; check what your Vercel plan allows) | The pipeline stops starting new sources after `PIPELINE_TIME_BUDGET_SECONDS` (200 s by default on Vercel). Unfinished sources are picked up on the next run, and unchanged pages are skipped |
| Broadcasts run in the background of one request | About 50 ms per message, so roughly 5,000 recipients fit in 300 s. Split larger audiences by channel or language |
| Many instances, each with its own memory | Rate limits, webhook retry de-duplication and the pipeline lock are stored in Postgres, so they hold across instances |
| No persistent disk | SQLite is refused in production on Vercel (`DATABASE_URL` required). Pipeline sources can be set with `PIPELINE_SOURCES` (JSON) instead of `data/sources.json` |
| Connection limits | One Postgres connection per instance (`DATABASE_POOL_MAX`, default 1 on Vercel), through Supabase's pooler, with prepared statements off as transaction mode requires |
| A bad config at runtime | It can't happen silently: the build check blocks the deploy. If variables change later, requests fail with a clear `ConfigError` in the logs instead of crashing the function |

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Build stops with `✖ Deployment stopped` | Add the variables listed above it, then redeploy |
| `Database tables are missing` in logs | Run `npm run db:migrate` with `DATABASE_URL`, or redeploy (the build migrates) |
| `too many connections` / timeouts | Use the **6543** pooler URI, not 5432 |
| `password authentication failed` | Re-copy the URI and replace `[YOUR-PASSWORD]`; URL-encode special characters (`@` → `%40`) |
| Bot doesn't reply | `getWebhookInfo` on the Bot API; check the webhook URL uses your Vercel domain and the secret matches |
| Cron not running | Cron jobs only run on the production deployment; confirm `CRON_SECRET` is set for Production |

## Moving existing SQLite data

Fresh deployments start empty, apart from the seeded schemes. To keep users from a local SQLite database, export them from the admin panel or with the `sqlite3` CLI, then insert them into Supabase with the SQL editor. The columns are identical.
