# Kaito Scan

Cached Kaito mindshare snapshots with a dashboard and JSON API.

The app does not proxy user requests to Kaito. It updates snapshots on boot and then every hour at minute `:05`, for example `08:05`, `09:05`, `10:05`. API requests only read the latest saved snapshot.

## Data currently collected

- `pre-tge:24h:heatmap`
- `pre-tge:24h:topDelta`
- `infomarkets:24h:heatmap`
- `exchange:24h:heatmap`
- `infomarkets:7d:kols`

## API

```text
GET /api/status
GET /api/live
GET /api/pre-tge?limit=50
GET /api/pre-tge/top-delta?limit=50
GET /api/infomarkets?limit=50
GET /api/infomarkets/kols?limit=50
GET /api/exchange?limit=50
GET /api/snapshot/:key?limit=50
POST /api/admin/update
```

If `API_KEY` is set, `POST /api/admin/update` requires:

```text
x-api-key: <API_KEY>
```

## Railway

Railway can deploy this as a normal web service.

```bash
npm install
npm start
```

Environment variables:

```text
PORT=3000
SCRAPE_CONCURRENCY=5
API_KEY=optional-admin-key
```

## Notes

Snapshots are stored in `data/snapshots.json`. On Railway, attach a persistent volume if you want snapshots to survive container rebuilds. The service also refreshes on boot if no snapshot exists.

## Usage Docs

See [docs/USAGE.md](docs/USAGE.md).


## Live Deployment

Dashboard: https://kaito-scan-production.up.railway.app

Status API: https://kaito-scan-production.up.railway.app/api/status

