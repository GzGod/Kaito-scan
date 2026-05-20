# Kaito Scan Usage Guide

Kaito Scan is a cached data API service.

It does not request Kaito when users call your API. The service fetches Kaito data on a schedule, stores the latest snapshots, and API users only read those cached snapshots.

## Live URL

Dashboard:

https://kaito-scan-production.up.railway.app

Status API:

https://kaito-scan-production.up.railway.app/api/status

## Auth

All API routes under /api/* require this header:

Authorization: Bearer YOUR_API_KEY

Current API key:

ks_2Q3fr6OgRDMLHLVKXg8LnBDhgZSWcuM4y5Oe47d9usY

Example:

curl https://kaito-scan-production.up.railway.app/api/status \
  -H "Authorization: Bearer YOUR_API_KEY"

The dashboard page / is public. API routes are protected.

## Update Schedule

The service updates every hour at minute 05.

Examples:

00:05
01:05
02:05
08:05
09:05
10:05

The service also tries to fetch data once on boot if no snapshot exists.

Default scrape concurrency is 5.

Set with:

SCRAPE_CONCURRENCY=5

## Current Datasets

The service currently collects these snapshots:

pre-tge:24h:heatmap
pre-tge:24h:topDelta
infomarkets:24h:heatmap
exchange:24h:heatmap
infomarkets:7d:kols

Not available yet:

ct-leaderboard
vcarena

## API Endpoints

### Status

GET /api/status

Returns update status, next scheduled update time, last run info, errors, and available snapshot keys.

Example:

curl https://kaito-scan-production.up.railway.app/api/status \
  -H "Authorization: Bearer YOUR_API_KEY"

### All Live Data

GET /api/live

Returns all current snapshots.

Example:

curl https://kaito-scan-production.up.railway.app/api/live \
  -H "Authorization: Bearer YOUR_API_KEY"

### pre-tge 24h heatmap

GET /api/pre-tge?limit=50

Example:

curl "https://kaito-scan-production.up.railway.app/api/pre-tge?limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"

### pre-tge 24h topDelta

GET /api/pre-tge/top-delta?limit=50

Example:

curl "https://kaito-scan-production.up.railway.app/api/pre-tge/top-delta?limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"

### infomarkets 24h heatmap

GET /api/infomarkets?limit=50

Example:

curl "https://kaito-scan-production.up.railway.app/api/infomarkets?limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"

### infomarkets KOL 7d

GET /api/infomarkets/kols?limit=50

Example:

curl "https://kaito-scan-production.up.railway.app/api/infomarkets/kols?limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"

### exchange 24h heatmap

GET /api/exchange?limit=50

Example:

curl "https://kaito-scan-production.up.railway.app/api/exchange?limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"

### Read Any Snapshot By Key

GET /api/snapshot/:key?limit=50

Examples:

curl "https://kaito-scan-production.up.railway.app/api/snapshot/pre-tge:24h:heatmap?limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"

curl "https://kaito-scan-production.up.railway.app/api/snapshot/infomarkets:7d:kols?limit=100" \
  -H "Authorization: Bearer YOUR_API_KEY"

## Manual Update

POST /api/admin/update

This manually triggers a new scrape.

Example:

curl -X POST https://kaito-scan-production.up.railway.app/api/admin/update \
  -H "Authorization: Bearer YOUR_API_KEY"

## Response Shape

A single snapshot response looks like this:

{
  "key": "pre-tge:24h:heatmap",
  "source": "pre-tge",
  "dataset": "heatmap",
  "duration": "24h",
  "updatedAt": "2026-05-20T00:05:12.000Z",
  "count": 50,
  "data": []
}

If you pass limit, the data array returns only the first N items.

## Railway Environment Variables

Recommended variables:

SCRAPE_CONCURRENCY=5
API_KEY=YOUR_API_KEY

Railway provides PORT automatically.

## Local Run

Install dependencies:

npm install

Start server:

npm start

Open:

http://localhost:3000
http://localhost:3000/api/status

For local API calls, include your API key if API_KEY is set.

## Notes

- API users read your cached snapshots.
- API calls do not trigger Kaito requests.
- The service updates every hour at minute 05.
- Railway filesystem is not guaranteed to be permanent across rebuilds.
- For long-term history, add Postgres or object storage later.
