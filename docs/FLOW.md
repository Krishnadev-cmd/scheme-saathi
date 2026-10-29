# Scheme Saathi: flows

How data and control move through the system at runtime. Diagrams are Mermaid (they render on GitHub and in most Markdown viewers). See [CODEBASE.md](CODEBASE.md) for file responsibilities.

---

## 1. System overview

```mermaid
flowchart LR
  subgraph Users
    WA[WhatsApp user]
    TG[Telegram user]
    WEB[Browser /try]
  end

  WA -- Meta Cloud API --> WAH[/api/whatsapp/webhook/]
  TG -- Bot API --> TGH[/api/telegram/webhook/]
  WEB --> CH[/api/chat/]

  WAH --> AG[agent.handleMessage]
  TGH --> AG
  CH --> AG

  AG <--> DB[(SQLite: users, schemes,<br/>notifications, runs)]
  AG --> EL[eligibility.matchSchemes]
  AG -. optional .-> LLM[Groq via llm.ts]

  CRON[Vercel Cron / npm run pipeline / Admin button] --> PR[/api/pipeline/run/]
  PR --> PIPE[pipeline.runPipeline]
  PIPE --> SRC[Official portals]
  PIPE -. optional .-> LLM
  PIPE <--> DB
  PIPE --> NOT[notify.notifyUsers]
  NOT --> CHN[channels.notifyUser]
  CHN --> WA
  CHN --> TG
```

---

## 2. Inbound message flow (all channels)

```mermaid
sequenceDiagram
  participant U as User
  participant P as WhatsApp / Telegram
  participant W as Webhook route
  participant A as agent.ts
  participant D as db.ts
  participant C as Groq (optional)

  U->>P: "hi" / taps a button
  P->>W: POST update
  W->>W: verify secret / HMAC signature
  W-->>P: 200 OK immediately
  Note over W: rest runs in after()
  W->>D: getOrCreateUser(channel, id)
  W->>A: handleMessage(user, {text, optionId})
  A->>A: route() (see section 3)
  A-->>C: only if free text needs interpreting
  A->>D: saveUser(user)
  A-->>W: OutMessage[]
  W->>P: send replies (buttons / list / text)
  P->>U: messages
```

Channel specifics:

| Step | WhatsApp | Telegram | Web `/try` |
| --- | --- | --- | --- |
| Auth | `X-Hub-Signature-256` HMAC with app secret | `X-Telegram-Bot-Api-Secret-Token` header | Session id format check |
| Dedup | In-memory set of message ids (Meta retries) | Not needed | Not needed |
| Button taps | `interactive.button_reply` / `list_reply` id | `callback_query.data` | `optionId` in body |
| Options render | ≤3 reply buttons, else list (≤10 rows) | Inline keyboard, one per row | Stacked buttons |
| Response | After `200`, via Graph API | After `200`, via `sendMessage` | Inline JSON response |

---

## 3. Conversation state machine

```mermaid
stateDiagram-v2
  [*] --> language
  language --> consent: language chosen
  consent --> age: I agree
  consent --> [*]: No, thanks (nothing stored)
  age --> gender
  gender --> state
  state --> area
  area --> occupation
  occupation --> ownsLand: farmer
  occupation --> income: anything else
  ownsLand --> income
  income --> category
  category --> disability
  disability --> bpl
  bpl --> girlChild: age ≥ 18
  bpl --> done: age < 18
  girlChild --> done
  done --> done: menu / schemes / number / question
  done --> age: restart / "Update my details"
  done --> language: "language"
```

### Routing inside `route()` (every message)

```mermaid
flowchart TD
  M[Incoming text / optionId] --> S{Looks like Aadhaar,<br/>PAN, card, passport?}
  S -- yes --> W[Warn, do not store,<br/>repeat current question]
  S -- no --> B{optionId starts with<br/>scheme: or menu:?}
  B -- scheme: --> DET[Scheme details]
  B -- menu: --> MA[Menu action]
  B -- no --> CMD{Global command?<br/>restart, language,<br/>alerts on/off, help}
  CMD -- yes --> CA[Run command]
  CMD -- no --> L{step = language?}
  L -- yes --> SL[Set language →<br/>first unanswered question]
  L -- no --> Q{step ≠ done?}
  Q -- yes --> AA[applyAnswer → valid?]
  AA -- no --> RE[Re-ask with options]
  AA -- yes --> NX[nextStep]
  NX -- more questions --> ASK[Ask next question]
  NX -- done --> RES[Send results +<br/>alerts-on confirmation]
  Q -- no --> D{menu / schemes /<br/>number / other}
  D -- menu --> MENU[Menu]
  D -- schemes --> RES2[Results]
  D -- number --> DET2[Details of Nth result]
  D -- other --> LLMQ{Groq available?}
  LLMQ -- yes --> ANS[Grounded answer in user's language]
  LLMQ -- no --> HELP[Help + menu]
```

### How an answer is understood (`resolveChoice`)

1. Tapped button id matches an option → use it.
2. Number `1..n` → nth option.
3. Option id or label in **any** language (case-insensitive) → that option.
4. Yes/no words: `yes, haan, हाँ, അതെ, ഉണ്ട്` / `no, nahi, नहीं, ഇല്ല`.
5. Groq `interpretChoice()` (returns only an offered id or null).
6. Otherwise "please choose" with the options again.

Age uses the first 1 to 3 digit number, then Groq. State uses the alias table, then Groq, then the alias table again on Groq's answer.

---

## 4. Eligibility and ranking

```mermaid
flowchart LR
  ALL[All schemes] --> C1{window closed?}
  C1 -- yes --> X[drop]
  C1 -- no --> C2{passes rules?<br/>unknown fields never fail}
  C2 -- no --> X
  C2 -- yes --> SORT[Sort: open → rolling → upcoming,<br/>then specificity score]
  SORT --> TOP[Top 10 → lastResults]
```

Specificity score (higher shows first): occupation +3, state +3, category +2, disability/girl child/land +2, gender +1, income +1, BPL +1, age +1.

---

## 5. Discovery pipeline

```mermaid
flowchart TD
  T[Trigger: cron 03:30 UTC / CLI / Admin] --> RUN[startPipelineRun]
  RUN --> LOOP{{for each source}}
  LOOP --> F[fetch, 20 s timeout]
  F -- error --> LOGF[log ✗, next source]
  F --> TXT[HTML/RSS → text<br/>links kept as label + URL]
  TXT --> H{hash unchanged<br/>and not --force?}
  H -- yes --> SKIP[log =, next source]
  H -- no --> CAP[cap at 120k chars, log if cut]
  CAP --> MODE{Groq configured?}
  MODE -- yes --> EX[extractSchemes → validated JSON]
  EX --> MERGE{matches existing<br/>scheme by name?}
  MERGE -- yes, new dates --> UPD[update window ↻]
  MERGE -- no, not closed --> ADD[insert new scheme +,<br/>mark newly discovered]
  MODE -- no --> HEU[heuristicWindows:<br/>known name + 'last date … date']
  HEU --> UPD
  UPD --> SH[save hash]
  ADD --> SH
  SH --> LOOP
  LOOP -- done --> N[notifyUsers]
  N --> FIN[finishPipelineRun ok + log]
```

---

## 6. Alert flow

```mermaid
flowchart TD
  S[Each scheme] --> W{window status}
  W -- open, or rolling and<br/>newly discovered --> OP[opened alert candidate]
  W -- open and closes in ≤ 3 days --> CL[closing soon candidate]
  W -- other --> NO[skip]
  OP --> U{{each subscribed user<br/>with completed profile}}
  CL --> U
  U --> E{passes rules?}
  E -- no --> NO2[skip]
  E -- yes --> K{already sent for this<br/>window key?}
  K -- yes --> NO3[skip]
  K -- no --> CLAIM[markNotified = claim]
  CLAIM --> CH{channel}
  CH -- Telegram --> TGS[send text]
  CH -- WhatsApp, active < 24h --> WAS[send text]
  CH -- WhatsApp, inactive --> TPL{template configured?}
  TPL -- yes --> WAT[send template]
  TPL -- no --> FAIL[unclaim → retry next run]
  TGS --> OK[count sent]
  WAS --> OK
  WAT --> OK
```

Window key = `opened:<openDate>..<closeDate>` (or `closing_soon:…`), so next year's round with new dates alerts again.

---

## 7. Website flows

| Page | Flow |
| --- | --- |
| `/` | Static at build. Hero content animates in; chat demo plays once in view (language tabs replay it); sections fade up via IntersectionObserver; tagline words light up one by one; scheme filters run client-side over data baked in from `seed.ts` |
| CTA buttons | `links.ts`: WhatsApp `wa.me/<number>?text=hi` and Telegram `t.me/<bot>?start=hi` if configured, otherwise `/try` |
| `/try` | Loads/creates a `localStorage` session id → sends hidden "hi" → renders replies; button taps send `optionId`; "New chat" creates a new session |
| `/admin` | Server-rendered on each request; token check; "Run now" is a server action calling `runPipeline()` then revalidating the page |

---

## 8. Setup flow (operator)

```mermaid
flowchart LR
  A[npm install] --> B[cp .env.development.example .env]
  B --> C[npm run dev → test at /try]
  C --> D{Deploy with public HTTPS}
  D --> E[Telegram: BotFather token →<br/>npm run telegram:set-webhook]
  D --> F[WhatsApp: Meta app → webhook URL +<br/>verify token → subscribe messages]
  D --> G[Set CRON_SECRET, ADMIN_TOKEN,<br/>optional GROQ_API_KEY]
  F --> H[Get notification template approved]
  G --> P[cp .env.production.example .env<br/>npm run check:env]
  P --> Q[docker build + docker run<br/>behind HTTPS proxy]
  Q --> I[Cron calls /api/pipeline/run daily]
```

---

## 9. Startup and configuration flow

```mermaid
flowchart TD
  S[Server starts] --> R[instrumentation.register → startup.ts]
  R --> E[env.ts parses process.env with Zod]
  E --> M{APP_ENV}
  M -- development --> DW[Print warnings, keep running]
  M -- production --> V{Any errors?}
  V -- yes --> X[Print each error, exit 1]
  V -- no --> OK[Serve requests]
  OK --> A{Request type}
  A -- webhook --> W[Check Telegram secret / WhatsApp HMAC]
  A -- /api/pipeline/run --> C[Check Bearer CRON_SECRET]
  A -- /admin --> L[Check session cookie, else login form]
  A -- /api/chat --> RL[Per IP rate limit]
```

---

## 10. Pipeline trigger, review queue and approval

```mermaid
sequenceDiagram
  participant C as Cron / Admin "Run now"
  participant R as /api/pipeline/run
  participant P as executePipelineRun
  participant Q as Review queue (db)
  participant A as Admin
  participant U as Users

  C->>R: GET (Bearer CRON_SECRET)
  R->>R: beginPipelineRun() lock
  alt another run in progress
    R-->>C: 409 {runId}
  else lock acquired
    R-->>C: 202 {runId, statusUrl}
    R->>P: after(): run in background
    P->>Q: proposeNewScheme / proposeWindow
    P->>A: Telegram: "N items waiting for review"
    A->>Q: Approve or Reject on /admin
    Q->>U: on approve: notifyUsers() alerts eligible users
  end
```

Nothing found by the pipeline is visible to users (`isLive()` is false) until it is approved. Rejected schemes and rejected windows are remembered, so the pipeline never proposes them again.

---

## 11. Consent and deletion

```mermaid
flowchart TD
  L[Language chosen] --> N[Consent notice: what is stored, why, /delete, privacy link]
  N -- I agree --> C[consent_at saved] --> Q[First question]
  N -- No, thanks --> X[Row deleted, counter consent_declined +1] --> W[Reply with website link]
  E[Existing user without consent_at] --> N
  D["/delete or 'delete my data'"] --> K{Confirm?}
  K -- Yes, delete --> R[deleteUser: profile, settings, alert history removed; counter data_deleted +1]
  K -- Cancel --> S[Nothing deleted, continue]
```
