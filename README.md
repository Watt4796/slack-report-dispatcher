# BooleanMaths — Rate-Limited Slack Report Dispatcher

A daily attribution/ROAS report dispatcher that pushes reports to client Slack channels
without tripping Slack's incoming-webhook rate limit (~1 msg/sec), and never drops a report
on a `429`.

## Architecture at a glance

Four long-running things, plus MongoDB and Redis:

| Process | Command | What it does |
|---|---|---|
| API server | `npm run dev -w server` | Express API; registers the 9 AM cron on boot |
| Slack worker | `npm run worker -w server` | Consumes `slack-reports`, strictly 1 job/sec, handles `429`/`Retry-After` |
| Scheduler worker | `npm run scheduler:worker -w server` | Consumes `daily-aggregation-trigger`; aggregates + enqueues, never talks to Slack itself |
| Client | `npm run dev -w client` | React (Vite) settings dashboard |

`npm run dev` from the repo root starts all four together.

## Prerequisites

- Node 18+ (the server uses ES modules and top-level `await`)
- Docker (for MongoDB + Redis)
- 5 real Slack incoming webhook URLs — see Section 3 of the brief for how to generate them

## Setup

```bash
git clone <this-repo>
cd booleanmaths-slack-dispatcher
cp .env.example .env
```

Edit `.env`:
- Set `SEED_SLACK_WEBHOOK_URLS` to your 5 real webhook URLs, comma-separated, no spaces needed.
- Leave `SLACK_ENDPOINT_OVERRIDE` pointed at the mock endpoint while developing/testing.
  Remove or comment out that line to have the worker post to each client's real webhook instead.

```bash
docker compose up -d      # Mongo on :27017, Redis on :6379
npm install                # installs the server + client workspaces
npm run seed -w server     # seeds 5 clients + 3 days of daily_stats
```

## Running it

```bash
npm run dev
```

Open the dashboard at `http://localhost:5173`.

## Verifying the pipeline

Sanity-check the aggregation math against seeded data:

```bash
npm run check:aggregation -w server
```

Trigger a real run on demand — the same code path the 9 AM cron uses:

```bash
curl -X POST http://localhost:4000/api/reports/run-now
```

Prove the `429`/`Retry-After` handling end-to-end with a burst of synthetic jobs against the
mock endpoint (run the worker in one terminal first):

```bash
npm run worker -w server            # terminal 1
npm run verify:429 -w server -- 20  # terminal 2
```

With a 20% mock failure rate and a 3s pause per `429`, this should take noticeably longer
than 20 seconds and end with `PASS — no jobs were dropped`.

## How the mock Slack endpoint works

`POST /api/mock-slack-webhook` rejects ~20% of requests with `429` and a `Retry-After: 3`
header, per Section 6 of the brief — this exists so the rate-limit handling can be proven
locally without risking a real Slack token ban. Point `SLACK_ENDPOINT_OVERRIDE` at it during
development; unset it for the real run.

## Environment variables

| Variable | Purpose |
|---|---|
| `PORT` | API server port (default `4000`) |
| `MONGO_URI` | MongoDB connection string |
| `REDIS_URL` | Redis connection string (used by BullMQ) |
| `SEED_SLACK_WEBHOOK_URLS` | 5 comma-separated real webhook URLs, used only by the seed script |
| `SLACK_ENDPOINT_OVERRIDE` | If set, the worker posts here instead of each client's own webhook — point at the mock endpoint for testing |
| `REPORT_TIMEZONE` | Timezone for the 9 AM cron (default `Asia/Kolkata`) |
| `VITE_API_BASE_URL` | Base URL the client uses to reach the API |

## Project structure

```
server/src/
  app.js, server.js          Express app + entrypoint
  config/db.js                Mongoose connection
  models/                     Client, DailyStat, NotificationLog
  services/
    aggregateDailyReports.js  The ROAS aggregation pipeline (all math done in Mongo)
    dispatchDailyReports.js   Aggregates, then enqueues + writes pending logs
  queue/                      Redis connection + the slack-reports BullMQ queue
  worker/                     The rate-limited Slack worker + Block Kit builder
  scheduler/                  The 9 AM repeatable job + its own worker
  routes/                     clients, notifications, reports (run-now), mockSlack
  scripts/                    seed, check:aggregation, enqueue, verify:429
client/src/
  App.jsx, styles.css         Dashboard shell
  api.js                      Fetch helpers
  components/                 ClientSettingsTable, NotificationLogsTable, RunReportButton, StatusBadge
```

## Design notes

- **Aggregation is entirely DB-side.** The sum, currency conversion, ROAS division, and
  rounding all happen inside a single MongoDB `aggregate()` call — nothing is pulled into
  memory and `.map()`'d over.
- **The `429` path never touches a retry-attempt counter.** `worker.rateLimit()` +
  `throw Worker.RateLimitError()` is called outside any try/catch that would otherwise treat
  it as a generic failure — BullMQ intercepts that specific error internally and re-queues
  the job without firing `'failed'` or incrementing `attempts`.
- **The scheduler queue is separate from the dispatch queue.** `daily-aggregation-trigger`
  only does DB/aggregation work; `slack-reports` is the only queue the 1 job/sec limiter
  applies to.
- **Everything is idempotent by `${clientId}-${reportDate}`.** Jobs and notification log rows
  are both keyed this way, so re-running a trigger for the same day never double-sends.

## Scripts reference (run from repo root)

| Script | Does |
|---|---|
| `npm run dev` | Starts server, client, worker, and scheduler together |
| `npm run seed` | Seeds 5 clients + 3 days of `daily_stats` |
| `npm run check:aggregation` | Prints the ROAS pipeline's output for seeded data |
| `npm run enqueue` | Manually runs `dispatchDailyReports()` once |
| `npm run verify:429 -w server -- 20` | Proves the 429/Retry-After path with N synthetic jobs |
| `npm run worker` | Starts the slack-reports worker alone |
| `npm run scheduler:worker` | Starts the scheduler worker alone |
