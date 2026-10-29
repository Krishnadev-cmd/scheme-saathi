# Scheme Saathi: decision log

Key technical and product decisions, written as short records: the context, what was decided, and the trade-offs. When changing one of these, add a new entry rather than rewriting history.

Status values: **Accepted** (current), **Revisit** (fine for now, likely to change at scale).

---

### D1. One Next.js app for bot, website, admin and pipeline
**Status:** Accepted

**Context.** We need webhooks for two messaging platforms, a public site, an admin view and a scheduled job.

**Decision.** A single Next.js 16 App Router project. Webhooks and the pipeline are route handlers; the site and admin are pages; business logic lives in framework-independent `src/lib/`.

**Trade-offs.** One deploy, one codebase, shared types. The pipeline shares compute with webhooks; if runs get long, move `runPipeline()` to a separate worker (it has no Next.js dependency).

---

### D2. Channel-agnostic agent with thin adapters
**Status:** Accepted

**Decision.** `agent.handleMessage()` takes `{ text, optionId }` and returns `OutMessage[]` (text + options). Telegram, WhatsApp and the web simulator only translate formats.

**Why.** The same conversation, tests and fixes apply to every channel. The `/try` demo is the real bot, not a mock.

**Trade-offs.** Channel-specific richness (WhatsApp list sections, Telegram inline layouts) is limited to what `OutMessage` can describe.

---

### D3. Deterministic question flow; AI only for interpretation
**Status:** Accepted

**Context.** An "LLM agent that chats freely" is flexible but unpredictable, slower, costlier, and hard to test. Eligibility needs structured facts.

**Decision.** A fixed state machine asks the questions and stores structured answers. Groq is used only to (a) map free text to an offered option, (b) extract age/state, (c) answer follow-up questions grounded in matched schemes, (d) extract schemes in the pipeline.

**Why.** Predictable UX, reliable eligibility, works fully without an API key, and testable with plain unit tests.

**Trade-offs.** Less conversational than a free agent; users can't answer several questions in one message.

---

### D4. Never collect identity numbers
**Status:** Accepted

**Decision.** The profile contains only broad attributes. Messages matching Aadhaar, PAN, card or passport patterns are refused and not persisted (message text is never stored at all).

**Why.** Organisation policy and user safety: the bot doesn't need them, and storing them would create a high-value target.

**Trade-offs.** The regex can have false positives on long numbers (e.g. a 12-digit string that isn't Aadhaar). We accept that: the user just gets a warning and the same question again.

---

### D5. "Unknown never disqualifies" eligibility
**Status:** Accepted

**Decision.** A rule excludes a user only when the relevant profile field is known and conflicts.

**Why.** Missing a scheme someone qualifies for is worse than showing one they don't, since every result says "confirm on the official portal".

**Trade-offs.** Some over-inclusion (e.g. PM-JAY shown when BPL status is unknown). Rules are approximations of official criteria, not legal determinations.

---

### D6. Income as bands, not exact numbers
**Status:** Accepted

**Decision.** Five bands; each stores its upper bound for `maxIncome` checks.

**Why.** Easier and less intrusive to answer, fits on buttons, and most schemes use slab thresholds anyway.

**Trade-offs.** Edge cases at band boundaries (e.g. a ₹9 lakh limit is checked against the "above ₹8 lakh" bound and excluded).

---

### D7. Seed catalogue in code, pipeline for change
**Status:** Accepted

**Decision.** 25 schemes are hand-written in `seed.ts` with three-language content. The pipeline adds new schemes and windows on top. `seedCatalogue()` preserves windows found by the pipeline.

**Why.** Reliable, reviewed baseline content and translations from day one; automation handles what changes often (dates, new launches).

**Trade-offs.** Amounts in `seed.ts` need periodic human review.

---

### D8. Groq with structured outputs and graceful degradation
**Status:** Accepted

**Decision.** Model `openai/gpt-oss-120b` (overridable with `GROQ_MODEL`) through Groq's OpenAI-compatible API. Extraction and interpretation use Zod schemas via `zodResponseFormat`, so responses are validated JSON. Every call returns `null`/`[]` on error and callers fall back to rules.

**Why.** Schema validation removes brittle parsing; fallbacks reduce dead ends; the bot never breaks because the AI is unavailable.

**Trade-offs.** Every free-text interpretation uses the configured Groq model. Lower `reasoning_effort` is used for these small calls; a different model can be set per deployment via `GROQ_MODEL`.

---

### D9. Pipeline: hash-based change detection, bounded input
**Status:** Accepted

**Decision.** Each source's extracted text is hashed; unchanged pages are skipped unless `--force`. Pages are capped at 120k characters, and truncation is logged.

**Why.** Most government pages change rarely; skipping them saves cost and time. The cap bounds cost per run.

**Trade-offs.** Content beyond the cap is not analysed. JS-rendered sites (myScheme) yield little text; PIB currently blocks non-browser clients (HTTP 403). More or better sources improve coverage more than anything else.

---

### D10. Heuristic mode without AI
**Status:** Accepted

**Decision.** Without an API key, the pipeline only updates deadlines for known schemes by finding "last date / closing date / apply by … <date>" within 400 characters of the scheme name.

**Why.** Keeps the alert feature useful for zero-cost deployments.

**Trade-offs.** It never discovers new schemes, and it misses dates far from the name.

---

### D11. Alerts: once per window, claim before send
**Status:** Accepted

**Decision.** Notifications are keyed by `user + scheme + kind + window dates`. The row is inserted (claimed) before sending and deleted if delivery fails. Seed schemes without a window never alert.

**Why.** No duplicates across overlapping runs, automatic retry for failed deliveries, a new alert when next year's round opens, and no spam about always-open schemes.

**Trade-offs.** A crash between claim and send loses that one alert.

---

### D12. WhatsApp 24 hour rule handled explicitly
**Status:** Accepted

**Decision.** `lastInboundAt` is stored per user. Alerts inside 24 hours go as normal messages; after that they need an approved template (`WHATSAPP_NOTIFY_TEMPLATE`), otherwise they're retried later.

**Why.** Meta rejects free-form business-initiated messages outside the service window.

**Trade-offs.** Templates need Meta approval in each language and cost per conversation.

---

### D13. Webhooks acknowledge first, process in `after()`
**Status:** Accepted

**Decision.** Return `200` immediately; run the agent and replies in Next's `after()`. WhatsApp message ids are de-duplicated in memory.

**Why.** Groq calls can take seconds; platforms retry slow webhooks, which caused duplicate replies.

**Trade-offs.** The in-memory dedup set is per process; with several instances, a retry could be handled twice. Move to a DB/Redis check at scale. **(Revisit)**

---

### D14. SQLite via `node:sqlite`, isolated in `db.ts`
**Status:** Superseded by D35 (SQLite stays for local development and Docker)

**Decision.** Node's built-in SQLite with no ORM and no extra dependency. All SQL lives in `db.ts`.

**Why.** Zero setup, fast, fine for a VM/container with a persistent disk, easy local development and tests (temp DB file).

**Trade-offs.** Not usable on serverless platforms with ephemeral disks (e.g. Vercel) and single-writer. The plan for production scale is Postgres or Turso by reimplementing `db.ts` only.

---

### D15. Hand-written bot translations, not machine translation at runtime
**Status:** Accepted

**Decision.** All bot strings and option labels exist in English, Hindi and Malayalam in `i18n.ts`; seed schemes are translated in `seed.ts`; the pipeline asks Groq for all three languages at extraction time.

**Why.** Consistent, reviewable wording; no latency or cost per message; works without AI.

**Trade-offs.** Adding a language means translating every string. Pipeline translations should be spot-checked.

---

### D16. Plain CSS design tokens instead of a CSS framework
**Status:** Accepted

**Decision.** `globals.css` defines the WhatsApp palette, a fixed spacing scale (2 to 96 px), a radius scale and easing curves. Pages use small CSS files with readable class names.

**Why.** The UI is small; tokens enforce consistency without adding Tailwind/PostCSS setup; easy to read for anyone.

**Trade-offs.** No utility classes; larger UI growth may justify Tailwind later.

---

### D17. WhatsApp palette with accessibility adjustments
**Status:** Superseded by D27

**Decision.** Teal Green `#075E54` for headings, dark bands and dark buttons; Light Green `#25D366` as the CTA fill with **near-black text** (white on it is only about 2:1 contrast); Spring Sky `#34B7F1` used only for decorative read ticks (too light for text); `#DCF8C6` and `#ECE5DD` for bubbles and warm sections.

**Why.** Familiar to WhatsApp users while meeting text contrast guidelines.

---

### D18. One design typeface plus script fallbacks
**Status:** Accepted

**Decision.** Manrope for the design; Noto Sans Devanagari and Noto Sans Malayalam loaded only to render Hindi and Malayalam glyphs. No italics anywhere (bot `_notes_` render as small muted text).

**Why.** A consistent look, and Manrope has no Indic glyphs, so the fallbacks are functionally required.

---

### D19. Motion: purposeful, physics-like, and optional
**Status:** Accepted

**Decision.** Custom cubic-bezier curves, IntersectionObserver for scroll reveals (no scroll listeners), transitions over keyframes for interactive elements, `:active` press feedback, hover effects only on fine pointers, and `prefers-reduced-motion` fallbacks (opacity only; chat demo shown instantly).

**Why.** Motion explains the product (chat demo, alert preview) and makes it feel responsive without hurting performance or accessibility.

---

### D20. Homepage built from the real catalogue
**Status:** Accepted

**Decision.** Scheme cards, counts and FAQ numbers come from `seed.ts` and `DEFAULT_SOURCES` at build time. No testimonials or invented statistics.

**Why.** Honest proof and no drift between what the site claims and what the bot does. The page stays fully static.

**Trade-offs.** Schemes discovered by the pipeline appear in the bot but not on the homepage until the next build.

---

### D21. CTAs degrade to the in-browser demo
**Status:** Accepted

**Decision.** Primary CTA opens WhatsApp (`wa.me`) when `NEXT_PUBLIC_WHATSAPP_NUMBER` is set, otherwise `/try`. The label changes accordingly, and a duplicate secondary link is hidden.

**Why.** No dead links before the bot numbers exist; the site is useful from day one.

---

### D22. Simple token auth for admin and cron
**Status:** Superseded by D25 for admin; cron unchanged

**Decision.** `/admin?token=` and `Authorization: Bearer $CRON_SECRET`. Both are open in development when unset and closed in production.

**Trade-offs.** A token in the URL can leak through history or logs, which D25 fixes.

---

### D23. One `APP_ENV` switch with fail fast production validation
**Status:** Accepted

**Context.** Settings were read ad hoc with `process.env` in many files, and a production deployment with a missing secret would silently run with open endpoints.

**Decision.** `APP_ENV` (`development` or `production`, defaulting to `NODE_ENV`) selects a behaviour profile. All configuration goes through `src/lib/env.ts`, validated with Zod. In production, missing or weak required values are errors and the server exits at startup; in development they are warnings and the relaxed defaults apply. Two templates, `.env.development.example` and `.env.production.example`, document both profiles.

**Why.** Misconfiguration shows up at deploy time, not as a security hole. A separate `APP_ENV` lets you run a production build locally in development mode (or the reverse) without fighting `NODE_ENV`, which Next.js sets itself.

**Trade-offs.** Validation is skipped during `next build` (secrets usually aren't available to CI), so the check happens when the server starts.

---

### D24. Docker standalone image with SQLite on a volume
**Status:** Accepted

**Decision.** `output: "standalone"`; a multi stage Dockerfile on `node:24-slim`, non root user, `/app/data` volume, `/api/health` health check. `npm start` runs the same standalone server outside Docker.

**Why.** Small reproducible image that matches the SQLite choice (D14): one container, one persistent disk.

**Trade-offs.** One instance only, since SQLite and the in memory rate limiter and dedup are per process. Scaling out needs Postgres and a shared store such as Redis.

---

### D25. Admin sign in with an httpOnly session cookie
**Status:** Accepted

**Decision.** `/admin` shows a login form; a server action checks the token in constant time, then sets an httpOnly, SameSite=Strict cookie (Secure in production) scoped to `/admin` for 12 hours. The cookie holds an HMAC derived from the token, not the token. Logins are limited to 10 attempts per IP per 15 minutes.

**Why.** Keeps the secret out of URLs, browser history and access logs, and slows down guessing.

**Trade-offs.** Still a single shared token. Use a real identity provider when several people need access.

---

### D26. Defensive defaults for public endpoints
**Status:** Accepted

**Decision.** Security headers on every response (nosniff, frame deny, referrer policy, permissions policy, HSTS in production), no `X-Powered-By`, `no-store` on APIs, `noindex` on admin, `robots.txt` disallowing `/admin` and `/api/`. The web demo (`/api/chat`) is rate limited per IP, rejects oversized messages, and can be switched off with `ENABLE_WEB_DEMO=false`. Errors return generic messages; details go to the log.

**Why.** `/api/chat` can trigger paid Groq calls and is unauthenticated by design.

---

### D27. Telegram as the primary channel and visual theme
**Status:** Accepted

**Context.** Telegram bots are free to run, need no business verification or message templates, and can message users at any time, so alerts are always deliverable. WhatsApp requires Meta approval, paid templates and the 24 hour rule (D12).

**Decision.** Telegram is the main call to action everywhere (nav, hero, final section, `/try`): "Open in Telegram" when `NEXT_PUBLIC_TELEGRAM_BOT` is set, otherwise "Try Scheme Saathi" opening the demo. WhatsApp stays as the secondary link ("or chat on WhatsApp"). The UI uses the Telegram palette:

| Token | Value | Use |
| --- | --- | --- |
| `--brand` | `#2AABEE` | Telegram blue: logo, accents, avatar, fills. Never for text (white on it is about 2.6:1) |
| `--action` | `#1877BC` | Deeper Telegram blue for buttons and links (white on it is 4.8:1) |
| `--night` | `#17212B` | Telegram dark theme: headings, dark bands, admin bar |
| `--bubble-out` | `#EEFFDE` | Telegram outgoing bubble |
| `--tick` | `#4FAE4E` | Telegram read ticks |
| `--wall` | `#D5E3EE` | Chat wallpaper |
| `--mist` | `#EEF4F9` | Cool section background |

Chat mock ups copy Telegram's patterns: white header with "bot" status, rounded bubbles with a small tail corner, a translucent service pill, and bot buttons as an inline keyboard under the message (two columns when there are more than three).

**Why.** Puts users on the channel that works best for alerts and costs nothing to operate, and the familiar look tells them where the bot lives.

**Trade-offs.** WhatsApp has more users in India; it remains one tap away, and the bot behaves identically on both.

---

### D28. Human review before anything the pipeline finds goes live
**Status:** Accepted

**Context.** AI extraction (and the date heuristic) can misread a page. Before this change, a wrong deadline or an invented scheme was published and alerted to every eligible user at once.

**Decision.** New schemes are stored with `review: "pending"` and window changes as `pendingWindow`. `isLive()` keeps them out of results and alerts. The admin page shows each item with a plain English summary of who qualifies and links to the source; **Approve** publishes it and alerts eligible users in the background, **Reject** hides it permanently (rejected schemes and window keys are remembered so they are never proposed again). Review state lives on the scheme JSON, so no migration was needed.

**Why.** One wrong alert reaches every eligible user and erodes trust; one approval click per finding is cheap.

**Trade-offs.** Alerts wait for a human. The admin gets a Telegram message when items are queued (`ADMIN_TELEGRAM_CHAT_ID`) to keep that delay short.

---

### D29. Background pipeline runs with a database lock
**Status:** Accepted

**Context.** The endpoint used to wait for the whole run, which with Groq can take minutes: longer than typical proxy timeouts (Nginx defaults to 60 seconds). Two triggers at once could also run two pipelines in parallel.

**Decision.** `/api/pipeline/run` claims a lock (`tryStartPipelineRun()`, a single `BEGIN IMMEDIATE` transaction on `pipeline_runs`), replies `202 {runId}` and runs the work in Next's `after()`. A second trigger gets `409`. Runs still `running` after 30 minutes are marked abandoned, so a crash can't block the pipeline forever. The log is saved after every step; `/api/pipeline/status` and the auto-refreshing admin page show progress. `?wait=1` keeps the old blocking behaviour for scripts.

**Why.** Cron jobs and proxies never time out, runs never overlap, and progress is visible. The pipeline stays inside the app, so there is still nothing extra to deploy (only a daily trigger).

**Trade-offs.** The lock is per database, which matches the single-instance SQLite design (D14, D24). If the process restarts mid-run, that run is only released after 30 minutes.

---

### D30. Consent before any question, and self-service deletion
**Status:** Accepted

**Context.** India's Digital Personal Data Protection Act, 2023 expects a clear notice, consent before processing, and a way to erase data.

**Decision.** After the language choice the bot shows a short notice (what is stored, why, how to delete, privacy link) with **I agree / No, thanks**. Declining deletes the row, so nothing is kept. Existing users without `consent_at` are asked once and then resume where they were. `/delete` (or "delete my data" in all three languages) asks for confirmation and then deletes the user row and their alert history. Anonymous counters record how many people declined or deleted, with no ids. Broadcasts only go to users who consented.

**Trade-offs.** One more step before the first question, which the funnel now measures. This is a technical baseline, not legal advice: the privacy policy text still needs legal review.

---

### D31. Admin tools in separate tabs, with safe defaults
**Status:** Accepted

**Decision.** The admin is split into Dashboard, Schemes, Broadcast and Insights. Scheme edits are validated (https links, ordered dates, rules JSON checked against a strict schema) and marked `editedAt`, so `npm run seed` never overwrites them; schemes can be hidden instead of deleted. Broadcasts need a confirmation tick, go only to consented and subscribed users, are delivered in the background in each user's language, and are recorded with sent and skipped counts. The funnel is derived from each user's current step (reached, stalled over 24 hours, active). CSV exports replace chat ids with a one-way code and guard against spreadsheet formula injection.

**Trade-offs.** The funnel shows where people are now, not a full event history. Event-level analytics would need an events table.

---

### D32. SDK-free error tracking, plus throttled Telegram alerts
**Status:** Accepted

**Context.** npm on the build machine was broken (a Node upgrade left its bundled npm missing a module), so new packages could not be installed; Sentry's SDK also adds weight for a mostly server-side app.

**Decision.** `lib/monitoring.ts` posts errors to Sentry's standard envelope endpoint when `SENTRY_DSN` is set, so any Sentry-compatible service works. `log.error()` and Next's `onRequestError` both report there, and send the admin a Telegram alert at most once per `ERROR_ALERT_MINUTES` with a count of suppressed errors. A blocked bot (Telegram 403) is logged as a warning, not an error.

**Trade-offs.** No browser error capture, breadcrumbs or performance tracing. Switch to `@sentry/nextjs` if those are needed.

---

### D33. Delivery counts must be true
**Status:** Accepted

**Context.** `sendTelegram()` and `sendWhatsApp()` logged failures but never reported them, so failed alerts were counted as sent and never retried, and a network error could stop an alert run.

**Decision.** Both return `true` only when every message was accepted and never throw. `notifyUser()` passes that through, so the alert claim is released and retried on the next run, and broadcast counts are real.

---

### D34. Human content review, supported by exports
**Status:** Accepted

**Decision.** Translation and fact-check sheets are exported from the admin panel for native speakers and checkers; corrections go back through the scheme editor or `i18n.ts`. The first fact check (29 Oct 2026) fixed six scheme entries and removed two invented eligibility limits; see [REVIEW.md](REVIEW.md) for what changed and what still needs a person.

---

### D35. Supabase Postgres in production, SQLite locally, one set of queries
**Status:** Accepted

**Context.** Production moves to Vercel, whose functions have no persistent disk and run as many short-lived instances, so SQLite would lose data.

**Decision.** `lib/sql.ts` provides a small async driver with two backends: `postgres` (postgres.js) when `DATABASE_URL` is set, Node's SQLite otherwise. Queries in `lib/db.ts` are written once with `?` placeholders and casts like `?::jsonb` that SQLite ignores. The Postgres schema lives in `supabase/migrations/` (idempotent), uses jsonb for structured values and enables RLS with no policies so Supabase's public API exposes nothing. Every database function became async. The whole test suite runs on both backends; Postgres tests use PGlite (real Postgres in WebAssembly) through the same driver and migration.

**Trade-offs.** Timestamps stay ISO text in Postgres (identical behaviour to SQLite and correct ordering), not `timestamptz`.

---

### D36. Vercel-safe production: build-time gate, serverless-safe state
**Status:** Accepted

**Decision.**
- `vercel-build` validates config and **fails the deployment** on errors with the list of fixes, migrates and seeds the database, then builds. At runtime on Vercel a config error is logged instead of calling `process.exit`, which would crash every cold start.
- Production on Vercel requires `DATABASE_URL` (postgres:// only). A direct 5432 Supabase URL triggers a warning to use the 6543 pooler. Connections: one per instance, prepared statements off.
- In-memory state that was wrong on serverless moved to Postgres: rate limits (`rate_limits`), webhook retry de-duplication for WhatsApp and Telegram (`processed_messages`), and the pipeline lock (a unique partial index allows one `running` row).
- `output: "standalone"` only off Vercel. `APP_BASE_URL` defaults to the Vercel production domain. The pipeline has a time budget (200 s on Vercel) and `maxDuration = 300` on the routes and pages that run background work.

**Trade-offs.** Broadcasts and alert runs are bounded by one function's duration (about 5,000 messages). A queue (e.g. Vercel Queues or a Supabase job) would be the next step beyond that.

---

### D37. The Docker / VM path stays supported
**Status:** Accepted

**Decision.** Without `DATABASE_URL` the app still runs on SQLite with the standalone server (`npm start`, Dockerfile). With `DATABASE_URL` the same Docker image runs against Supabase. Nothing in the code is Vercel-only.
