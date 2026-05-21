# Kaito Scan

Cached Kaito mindshare snapshots with a dashboard and JSON API.

Live dashboard:

https://kaito-scan-production.up.railway.app

Status API:

https://kaito-scan-production.up.railway.app/api/status

## What It Does

Kaito Scan fetches selected Kaito mindshare datasets on a schedule and serves cached snapshots through its own API.

The service does not proxy user requests to Kaito. API users only read cached data.

## Update Schedule

- Updates every hour at minute `05`.
- Example: `08:05`, `09:05`, `10:05`.
- Also fetches once on boot if no snapshot exists.
- Default scrape concurrency: `5`.

## Current Datasets

Supported durations:

```text
24h, 7d, 30d, 3m, 6m, 12m
```

For every duration, the worker collects:

```text
pre-tge:<duration>:heatmap
pre-tge:<duration>:topDelta
infomarkets:<duration>:heatmap
exchange:<duration>:heatmap

Info KOL snapshots are collected for 7d, 30d, 3m, 6m, and 12m only:

infomarkets:<duration>:kols
```

That is `29` cached snapshots per update.

## Auth

All `/api/*` routes require:

```text
Authorization: Bearer YOUR_API_KEY
```

The dashboard `/` is public.

## API

- `GET /api/status`
- `GET /api/live`
- `GET /api/pre-tge?duration=7d&limit=50`
- `GET /api/pre-tge/top-delta?duration=30d&limit=50`
- `GET /api/infomarkets?duration=3m&limit=50`
- `GET /api/infomarkets/kols?duration=12m&limit=100`
- `GET /api/exchange?duration=30d&limit=50`
- `GET /api/snapshot/:key?limit=50`
- `POST /api/admin/update`

## Usage Docs

See `docs/USAGE.md`.

## Railway

Start command:

```bash
npm start
```

Environment variables:

```text
SCRAPE_CONCURRENCY=5
API_KEY=YOUR_API_KEY
```

## Local Development

```bash
npm install
npm start
```

