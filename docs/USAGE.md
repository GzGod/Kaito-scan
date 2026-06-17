# Kaito Scan Usage

Kaito Scan keeps cached Kaito mindshare snapshots and serves them through your own API.

## Base URL

Production:

https://kaito-scan-production.up.railway.app

## Authentication

All `/api/*` routes require an Authorization header:

```text
Authorization: Bearer YOUR_API_KEY
```

The dashboard `/` is public.

## Update Schedule

- The worker updates every hour at minute `05`.
- Examples: `08:05`, `09:05`, `10:05`.
- API requests read cached snapshots only.
- API requests do not trigger Kaito requests.
- Default scrape concurrency is `5`.

## Supported Durations

The service collects each dataset for these durations:

```text
24h, 7d, 30d, 3m, 6m, 12m
```

## Current Datasets

For every supported duration, the service collects ticker snapshots:

```text
pre-tge:<duration>:heatmap
pre-tge:<duration>:topDelta
infomarkets:<duration>:heatmap
exchange:<duration>:heatmap

Info KOL snapshots are collected for 7d, 30d, 3m, 6m, and 12m only:

infomarkets:<duration>:kols
```

New Arena snapshots:

```text
arena-voices-stock:<duration>:leaderboard
arena-voices-ai:<duration>:leaderboard
arena-voices-crypto:<duration>:leaderboard
arena-companies-stock:<duration>:leaderboard
arena-companies-ai:<duration>:leaderboard
arena-companies-crypto:<duration>:leaderboard
```

Top Voices supports `7d`, `30d`, `3m`, `6m`, and `12m`.
Top Companies supports `24h`, `7d`, `30d`, `3m`, `6m`, and `12m`.

That is `62` snapshots per update.

Not available yet:

```text
ct-leaderboard
vcarena
```

## API Endpoints

### Status

```text
GET /api/status
```

Returns update status, next scheduled update time, last run info, errors, and available snapshot keys.

```bash
curl https://kaito-scan-production.up.railway.app/api/status \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### All Live Data

```text
GET /api/live
```

Returns all current snapshots.

```bash
curl https://kaito-scan-production.up.railway.app/api/live \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### pre-tge Heatmap

```text
GET /api/pre-tge?duration=24h&limit=50
```

`duration` can be `24h`, `7d`, `30d`, `3m`, `6m`, or `12m`. Default is `24h`.

```bash
curl "https://kaito-scan-production.up.railway.app/api/pre-tge?duration=7d&limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### pre-tge Top Delta

```text
GET /api/pre-tge/top-delta?duration=24h&limit=50
```

Default duration is `24h`.

```bash
curl "https://kaito-scan-production.up.railway.app/api/pre-tge/top-delta?duration=30d&limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### infomarkets Heatmap

```text
GET /api/infomarkets?duration=24h&limit=50
```

Default duration is `24h`.

```bash
curl "https://kaito-scan-production.up.railway.app/api/infomarkets?duration=3m&limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### infomarkets KOL Leaderboard

```text
GET /api/infomarkets/kols?duration=7d&limit=50
```

Default duration is `7d`. KOL supports `7d`, `30d`, `3m`, `6m`, and `12m`; Kaito currently rejects `24h` for this endpoint.

```bash
curl "https://kaito-scan-production.up.railway.app/api/infomarkets/kols?duration=12m&limit=100" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### exchange Heatmap

```text
GET /api/exchange?duration=24h&limit=50
```

Default duration is `24h`.

```bash
curl "https://kaito-scan-production.up.railway.app/api/exchange?duration=30d&limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Arena Top Voices

```text
GET /api/arena/voices?vertical=stock&duration=7d&limit=50
```

`vertical` can be `stock`, `ai`, or `crypto`. Top Voices supports `7d`, `30d`, `3m`, `6m`, and `12m`.

```bash
curl "https://kaito-scan-production.up.railway.app/api/arena/voices?vertical=crypto&duration=7d&limit=100" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Arena Top Companies

```text
GET /api/arena/companies?vertical=stock&duration=24h&limit=50
```

`vertical` can be `stock`, `ai`, or `crypto`. Top Companies supports `24h`, `7d`, `30d`, `3m`, `6m`, and `12m`.

```bash
curl "https://kaito-scan-production.up.railway.app/api/arena/companies?vertical=stock&duration=24h&limit=100" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Read Any Snapshot By Key

```text
GET /api/snapshot/:key?limit=50
```

Examples:

```bash
curl "https://kaito-scan-production.up.railway.app/api/snapshot/pre-tge:24h:heatmap?limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"

curl "https://kaito-scan-production.up.railway.app/api/snapshot/infomarkets:12m:kols?limit=100" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Manual Update

```text
POST /api/admin/update
```

This manually triggers a new scrape.

```bash
curl -X POST https://kaito-scan-production.up.railway.app/api/admin/update \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Response Shape

A single snapshot response looks like this:

```json
{
  "key": "pre-tge:7d:heatmap",
  "source": "pre-tge",
  "dataset": "heatmap",
  "duration": "7d",
  "updatedAt": "2026-05-20T00:05:12.000Z",
  "count": 50,
  "data": []
}
```

If you pass `limit`, the `data` array returns only the first N items.

## Railway Environment Variables

Recommended variables:

```text
SCRAPE_CONCURRENCY=5
API_KEY=YOUR_API_KEY
```

Railway provides `PORT` automatically.

## Local Run

Install dependencies:

```bash
npm install
```

Start server:

```bash
npm start
```

Open:

```text
http://localhost:3000
http://localhost:3000/api/status
```

For local API calls, include your API key if `API_KEY` is set.

## Notes

- API users read your cached snapshots.
- API calls do not trigger Kaito requests.
- The service updates every hour at minute `05`.
- Railway filesystem is not guaranteed to be permanent across rebuilds.
- For long-term history, add Postgres or object storage later.


## History API

When `DATABASE_URL` is configured, every successful scrape is stored in Postgres.

### Query Historical Snapshots

```text
GET /api/history/query
```

Query parameters:

```text
source=pre-tge | infomarkets | exchange
dataset=heatmap | topDelta | kols
duration=24h | 7d | 30d | 3m | 6m | 12m
from=2026-06-01
to=2026-06-09
interval=hour | day
limit=50
```

Arena history sources are concrete per vertical:

```text
arena-voices-stock
arena-voices-ai
arena-voices-crypto
arena-companies-stock
arena-companies-ai
arena-companies-crypto
```

Use `dataset=leaderboard` for Arena history.

`interval=hour` returns every hourly snapshot in the range. `interval=day` groups by Asia/Shanghai calendar day and returns the latest snapshot for each day. `limit` caps items inside each snapshot; default is `50`, maximum is `500`.

```bash
curl "https://kaito-scan-production.up.railway.app/api/history/query?source=pre-tge&dataset=heatmap&duration=24h&from=2026-06-01&to=2026-06-09&interval=day&limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Response:

```json
{
  "source": "pre-tge",
  "dataset": "heatmap",
  "duration": "24h",
  "interval": "day",
  "from": "2026-06-01",
  "to": "2026-06-09",
  "count": 9,
  "snapshots": []
}
```

### List Recent Runs

```text
GET /api/history/runs?limit=24
```

```bash
curl "https://kaito-scan-production.up.railway.app/api/history/runs?limit=24" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### List Snapshots In One Run

```text
GET /api/history/run/:runId
```

```bash
curl "https://kaito-scan-production.up.railway.app/api/history/run/1" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### List History For One Snapshot Key

```text
GET /api/history/snapshot/:key?limit=24
```

```bash
curl "https://kaito-scan-production.up.railway.app/api/history/snapshot/pre-tge:24h:heatmap?limit=24" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Read One Historical Snapshot

```text
GET /api/history/item/:id?limit=50
```

```bash
curl "https://kaito-scan-production.up.railway.app/api/history/item/1?limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```
