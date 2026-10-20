# ADAL AI

**«Әділ шешім. Ашық қоғам.» · «Понятные решения. Честное общество.»**

ADAL AI is a bilingual (Russian / Kazakh) AI-powered web assistant that helps people in Kazakhstan understand situations that may involve corruption, unofficial payments, or unfair treatment, and find a lawful next step. It was built for the IT competition category **«3-бағыт. IT-шешім»**.

> ADAL is an independent prototype. It is **not** an official government service, it does not submit complaints, contact authorities, or give legal determinations.

## Features

| Feature | Description |
| --- | --- |
| **AI assistant** (core) | Chat in your own words. The server sends the conversation to the configured AI API with a central system prompt and returns a structured analysis: understanding → concerns → what to clarify → action plan → where to go → next step. |
| Language & greeting | The server detects Kazakh vs Russian from the user's **latest** message and instructs the model to reply in it. The greeting (`Сәлем! Мен — ADAL AI көмекшісімін. 👋` / `Привет! Я — ADAL, твой цифровой помощник. 👋`) is added **only on the first reply** of a conversation and stripped from follow-ups, enforced server-side even if the model ignores the instruction. |
| Complaint drafting | «Составить обращение / Өтініш дайындау»: neutral draft from the user's own text (or the user's messages from the current chat), with `[placeholders]` for missing data, a verification checklist, editing, copy, regenerate, new draft. Nothing is submitted. |
| Educational game | 8 original fictional scenarios (RU/KZ), answer checking, explanations, points (+10, +5 streak bonus from 3 in a row), progress bar, result, 4 badges, restart. |
| Official resources | eOtinish, eGov, Gov.kz, Әділет — clearly marked as external official sites; 112 emergency note. |
| Feedback | «Предложить улучшение / Ұсыныс жіберу» — validated form. With Supabase configured it is stored in the `feedback` table (insert-only via RLS) and success is shown **only after the database confirms the insert**. Without Supabase it stays a clearly labelled local demo: nothing is sent or stored. |
| Full RU/KZ UI | Separate dictionaries (`src/i18n/ru.ts`, `src/i18n/kk.ts`), RU default, choice persisted in `localStorage` (only the language preference). |

## Tech stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · Lucide icons · self-hosted Inter & Source Serif 4 fonts · a small Node HTTP server (`server/`) run with `tsx` · **AIHubMix** (OpenAI-compatible Chat Completions) for AI · **Supabase** PostgreSQL (`@supabase/supabase-js`, server-side only) for feedback storage.

```
server/
  index.ts         HTTP server: /api/health, /api/chat, /api/complaint, /api/feedback, static files, security headers, rate limits
  handlers.ts      request handling, greeting/language logic, error mapping, feedback storage
  provider.ts      AIHubMix adapter (OpenAI-compatible /chat/completions; legacy Anthropic format kept)
  supabase.ts      server-side Supabase client + feedback insert (anon/publishable key, RLS insert-only)
  systemPrompt.ts  central ADAL system prompt + complaint prompt (server-only)
  config.ts        AIHUBMIX_* env configuration; demo mode when incomplete
  lang.ts, greeting.ts, validation.ts, rateLimit.ts, demo.ts
src/
  views/           Home, Assistant, Complaint, Quiz, Resources, Feedback
  components/      Header, Footer, Logo, Markdown (safe renderer), SectionHeader
  i18n/            ru.ts, kk.ts, provider
  data/            quiz.ts, resources.ts
  lib/             api client, router, validation, quiz logic
tests/             node:test suites (server, client logic, AIHubMix + Supabase integration with mocked HTTP)
supabase/
  schema.sql       feedback table, CHECK constraints, RLS insert-only policy, column grants
```

## Install & run

Requires Node.js ≥ 20.12.

```bash
npm install
cp .env.example .env        # then fill in your real AI settings (see below)
npm run dev                 # API on :8787 + Vite on http://localhost:5173 (proxy /api)
```

Production:

```bash
npm run build
npm start                   # serves dist/ + API on http://localhost:8787
```

Checks: `npm run typecheck`, `npm run lint`, `npm test`.

## Integrations and configuration

All variables are read **only by the Node server** (no `VITE_` prefix), so they never reach the browser bundle. Copy `.env.example` to `.env` locally, or set them in your host's secret settings. If any are missing the site still starts; `GET /api/health` and the server start-up log say what is missing.

| Variable | Required | Meaning |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | for live AI (default provider) | OpenRouter key. If set, ADAL uses OpenRouter with `minimax/minimax-m3.1-flash:free` (override with `OPENROUTER_MODEL`). `AI_PROVIDER=aihubmix` forces AIHubMix instead. Other `OPENROUTER_*` tuning variables are listed in `.env.example`. |
| `AIHUBMIX_ACCESS_KEY` | alternative AI provider | AIHubMix **inference** API key (console → API Keys). Sent as `Authorization: Bearer …`. Not an account-management key. `AIHUBMIX_API_KEY` is accepted as an alias. |
| `AIHUBMIX_MODEL` | for live AI | A chat model id copied from https://aihubmix.com/models. It must support `/v1/chat/completions`. |
| `SUPABASE_URL` | for feedback storage | `https://<project-ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | for feedback storage | Public **anon** key or the newer **publishable** key (`sb_publishable_…`; `SUPABASE_PUBLISHABLE_KEY` also works). |
| `AIHUBMIX_BASE_URL` | no | Defaults to `https://aihubmix.com/v1`. Backup host from AIHubMix docs: `https://api.inferera.com/v1`. Must be HTTPS. |
| `AIHUBMIX_TIMEOUT_MS`, `AIHUBMIX_MAX_TOKENS`, `AIHUBMIX_TEMPERATURE` | no | Defaults 45000 / 1400 / 0.4. `AIHUBMIX_TEMPERATURE=default` = don't send temperature. |
| `PORT`, `RATE_LIMIT_PER_MIN`, `FEEDBACK_RATE_LIMIT_PER_MIN` | no | 8787; 20/min per IP for chat and complaint; 3/min per IP for feedback. |

`SUPABASE_SERVICE_ROLE_KEY` is **not used**. No ADAL feature needs elevated database rights, so don't add it to this app.

The old generic `AI_PROVIDER` / `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` variables still work as a fallback if no `AIHUBMIX_*` variables are set.

### 0. OpenRouter: MiniMax M3.1 Flash (free)

Module: `server/openrouter.ts`. It uses the official `openai` SDK and changes only `baseURL` (`https://openrouter.ai/api/v1`) and `apiKey`.

- **Timeouts and retries:** each attempt times out after `OPENROUTER_TIMEOUT_MS`. Retries happen only on 408/429/5xx and network errors, up to 2 by default. The delay follows `Retry-After` when present, otherwise exponential back-off with jitter. If `Retry-After` is longer than 10 s, the request fails right away. Timeouts are not retried.
- **Free-model limits:** OpenRouter allows 20 requests/min and 50 requests/day (1000/day after buying ≥10 credits). A daily-limit 429 is detected from the message or the `X-RateLimit-*` headers and becomes `free_limit`. The user sees a clear RU/KZ message, and the request is not retried.
- **Concurrency:** a semaphore (`server/semaphore.ts`) allows `OPENROUTER_MAX_CONCURRENCY` (2) requests at once, with a queue of up to `OPENROUTER_MAX_QUEUE` (20). Beyond that, requests fail with `busy`.
- **Tool calling and structured outputs** are not assumed. ADAL's chat doesn't use them. Run `npm run probe:openrouter` to check them with two separate test requests; this uses 2 requests from the free daily quota. OpenRouter's model list advertises `tools` and `response_format` for this model but not `structured_outputs`, so trust only the probe result.
- **Example:** `npm run ask -- "Что такое eOtinish?"` (see `scripts/ask-example.ts`). In code:

```ts
import { ask, describeError } from './server/openrouter.ts';
try {
  const answer: string = await ask('Кратко: что такое eOtinish?');
  console.log(answer);
} catch (e: unknown) {
  console.error(describeError(e, 'ru')); // e.g. «Дневной лимит бесплатной модели исчерпан…»
}
```

### 1. AIHubMix (alternative provider)

1. Create an account at https://console.aihubmix.com and create an API key. In the console, ideally restrict the key to the model you chose, set a spending cap, and set an expiry date.
2. Pick a chat model from https://aihubmix.com/models (or the auth-free catalog `https://aihubmix.com/api/v1/models?type=llm&sort_by=order`). Copy the model id exactly. Check the model page at `https://aihubmix.com/model/<id>/llms.txt` to make sure it lists `POST /v1/chat/completions`. Not every catalog entry is a chat model. AIHubMix also offers free models (https://aihubmix.com/models/free) for testing. Model ids change over time, so ADAL has no hard-coded default.
3. Set `AIHUBMIX_ACCESS_KEY` and `AIHUBMIX_MODEL`, then restart the server.
4. Check that it works:
   - `curl localhost:8787/api/health` should return `"mode":"live","provider":"aihubmix","model":"<id>"`.
   - Optional direct check from the AIHubMix docs: `curl -s https://aihubmix.com/v1/chat/completions -H "Authorization: Bearer $AIHUBMIX_ACCESS_KEY" -H "Content-Type: application/json" -d '{"model":"'"$AIHUBMIX_MODEL"'","messages":[{"role":"user","content":"Reply with exactly: AIHubMix is connected"}],"max_tokens":64}'`. Check the reply **body**, not just HTTP 200.
   - Open `/#/assistant`. The badge should read «AI подключён». Send a Russian message: the first reply starts with «Привет! Я — ADAL, твой цифровой помощник. 👋», and follow-up replies don't repeat it.

How it works: the server sends `POST {AIHUBMIX_BASE_URL}/chat/completions` with the central ADAL system prompt plus the trimmed conversation (max 24 messages / 30k chars). If the model rejects optional parameters (HTTP 400), the server retries once without `temperature`/`max_tokens`. Errors map to clear RU/KZ messages:

| AIHubMix response | UI error |
| --- | --- |
| 401, or 403 key/IP/model restriction | `auth` |
| 403 `insufficient_user_quota` | `quota` (top up the balance) |
| 404, or 503 "Incorrect model ID" | `model_unavailable` (check `AIHUBMIX_MODEL`) |
| 429, or 503 provider throttling | `rate_limited` |
| timeout / network / 5xx | `timeout` / `upstream` |
| empty or non-JSON body | `invalid_response` |

Logs contain only the error class, HTTP status and the AIHubMix trace id (`tid`). They never contain prompts, replies or keys.

### 2. Supabase (feedback storage only)

What is stored: only suggestions from «Предложить улучшение» (category, text, optional e-mail, UI language, timestamp).
What is **not** stored: AI conversations, complaint drafts, corruption reports, quiz progress, IP addresses. Quiz and educational content stay static in the code because a database adds nothing for this MVP.

1. Create a project at https://supabase.com/dashboard.
2. Open **SQL Editor → New query**, paste [`supabase/schema.sql`](supabase/schema.sql), and click **Run**. You can safely run it more than once. It creates:
   - Table `public.feedback`, with `id`, `created_at`, `category`, `message`, `contact_email`, `lang`, and CHECK constraints that mirror the app's validation. These reject 12-digit ИИН-like and card-like numbers.
   - RLS enabled with a single policy `feedback_insert_only` (INSERT for `anon`, `authenticated`). There are **no** SELECT/UPDATE/DELETE policies.
   - Privileges: all revoked from `anon`/`authenticated`, then `INSERT` granted on the four user columns only.
3. Under **Project Settings → API (API Keys)**, copy the Project URL and the anon/publishable key into `SUPABASE_URL` / `SUPABASE_ANON_KEY`. Restart the server.
4. Check that it works:
   - `/api/health` should return `"feedbackStorage":"supabase"`. This only means the variables are set; it does not prove the schema was applied.
   - Submit the form at `/#/feedback`. «Спасибо! Предложение сохранено» appears only after Supabase confirms the insert. The new row should show up in **Table Editor → feedback**.
   - Security check: `curl "$SUPABASE_URL/rest/v1/feedback?select=*" -H "apikey: $SUPABASE_ANON_KEY"` should return a permission error (`42501`), not rows.
5. To read feedback, use the Supabase Dashboard (Table Editor). For retention, the commented `delete … older than 12 months` statement at the end of `schema.sql` can be run manually or scheduled.

The browser never talks to Supabase. It calls `POST /api/feedback`, the server validates the input again and rate-limits it (3/min per IP), then inserts with `return=minimal`. Feedback is not anonymous if the visitor enters an e-mail, and the UI says so.

### Running locally

```bash
npm install
cp .env.example .env    # fill in values (or leave placeholders to run in demo mode)
npm run dev             # API :8787 + Vite http://localhost:5173 (proxies /api)
```

### Testing

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

`tests/integrations.test.ts` covers the AIHubMix request shape, parameter-retry, error mapping, config/placeholder handling, Supabase insert request (anon key, no `select`), DB-rejection handling and feedback validation, all with mocked HTTP. Real end-to-end checks need your credentials (see the steps above).

## Demo mode vs live mode

| | Without credentials | With credentials |
| --- | --- | --- |
| Chat | Pre-written fictional guidance, every reply labelled «Демо-ответ · не сгенерирован ИИ». The greeting rule still applies. | Real AIHubMix model responses, labelled «Сгенерировано ИИ» |
| Complaint | Fixed template with the user's text, labelled «Демо-шаблон» | Model-written draft + checklist |
| Feedback | Labelled local demo; nothing sent or stored | Stored in Supabase; success only after DB confirmation |
| Quiz, resources, RU/KZ UI | Fully functional | Fully functional |

## Deploy

Any Node host (Render, Railway, Fly.io, a VPS) or Docker:

```bash
docker build -t adal-ai .
docker run -p 8787:8787 --env-file .env adal-ai
```

On Render / Railway / Fly.io: build command `npm ci && npm run build`, start command `npm start`, and add `AIHUBMIX_ACCESS_KEY`, `AIHUBMIX_MODEL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` as secret environment variables. Never commit `.env`. It is already in `.gitignore`. Put the app behind HTTPS. If behind a proxy, `X-Forwarded-For` is used for rate limiting.

## Privacy & security

- No registration. The conversation exists only in the tab's memory and is cleared by «Новый диалог» or closing the tab. Conversations and complaint drafts are never written to a database. The only stored data is feedback that a visitor submits on purpose.
- Visible warnings not to share ИИН/ЖСН, passwords, or bank details. The feedback form rejects text with 12-digit or card-like numbers.
- The AIHubMix key and Supabase settings stay on the server. Verified: the built JS bundle contains no keys, URLs or env-variable names; the only matches are the public brand names in the privacy text.
- The server logs only method, path, status and duration — never message content.
- Model output is rendered by a small React Markdown renderer (no `dangerouslySetInnerHTML`); only `http(s)` links are clickable.
- Input limits (4000 chars/message, 8000 chars/complaint, 64 KB body), JSON validation, `system` role rejected from clients, in-memory rate limiting, timeouts, CSP and other security headers.
- User text is sent to AIHubMix and the upstream vendor of the chosen model. Their data policies apply. ADAL does not claim anonymity or end-to-end encryption.

## Known limitations

- Language detection is heuristic (Kazakh-specific letters + common words); mixed messages follow the dominant signal.
- Rate limiting is per process (in memory), and it trusts `X-Forwarded-For`. Run behind a proxy that sets this header.
- Official resource list is short by design; agency structures change, so the AI is told to point users to Gov.kz to find the current relevant agency rather than inventing contacts.
- AI answers are informational guidance, not legal advice.

## Competition demo flow (≈5 min)

1. Open the landing page — show the hero, Analyze / Plan / Act, «Как это работает», privacy section.
2. Click **RU / KZ** in the header — the whole interface switches; reload to show it is remembered.
3. Click **«Описать проблему»** and type a fictional case, e.g. «В университете у меня требуют деньги за хорошую оценку. Что делать?» — show the first-reply greeting and the structured analysis and action plan.
4. Send a follow-up in Kazakh («Рахмет! Енді қайда жүгінемін?») — reply switches to Kazakh **without** a second greeting.
5. Click **«Составить обращение»** → «Взять из текущего диалога» → «Составить черновик»; edit a line, press **«Копировать»**, show the checklist and disclaimer.
6. Open **«Тест»**, answer a few scenarios — show explanations, points, streak, final badges, restart.
7. Close with «Полезные ресурсы»: ADAL educates and helps citizens make informed, lawful decisions, and directs them to official channels such as eOtinish — it never replaces authorities.
