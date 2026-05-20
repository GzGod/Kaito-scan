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

- Updates every hour at minute 05.
- Example: 08:05, 09:05, 10:05.
- Also fetches once on boot if no snapshot exists.
- Default scrape concurrency: 5.

## Current Datasets

- pre-tge:24h:heatmap
- pre-tge:24h:topDelta
- infomarkets:24h:heatmap
- exchange:24h:heatmap
- infomarkets:7d:kols

## Auth

All /api/* routes require:

Authorization: Bearer YOUR_API_KEY

The dashboard / is public.

## API

- GET /api/status
- GET /api/live
- GET /api/pre-tge?limit=50
- GET /api/pre-tge/top-delta?limit=50
- GET /api/infomarkets?limit=50
- GET /api/infomarkets/kols?limit=50
- GET /api/exchange?limit=50
- GET /api/snapshot/:key?limit=50
- POST /api/admin/update

## Usage Docs

See docs/USAGE.md.

## Railway

Start command:

npm start

Environment variables:

SCRAPE_CONCURRENCY=5
API_KEY=YOUR_API_KEY

## Local Development

npm install
npm start
