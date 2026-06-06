# API Performance Notes

This service serves the real-time Kaito snapshots from memory. The scraper still updates the in-memory store and PostgreSQL history on the hourly `xx:05` schedule; public real-time API reads do not trigger Kaito requests.

## Optimized Real-Time Paths

- `GET /api/catalog`
- `GET /api/live/index`
- `GET /api/live`
- `GET /api/snapshots`
- `GET /api/snapshot/:key`
- `GET /api/pre-tge`
- `GET /api/pre-tge/top-delta`
- `GET /api/infomarkets`
- `GET /api/infomarkets/kols`
- `GET /api/exchange`

The existing request paths, query parameters, authorization header, and JSON field structure remain unchanged.

## Response Optimizations

- Pre-serialized JSON cache for real-time snapshots.
- Compact JSON responses to reduce transfer size.
- Pre-compressed Brotli and gzip responses when the client sends `Accept-Encoding`.
- Stable `ETag` headers for cached real-time responses.
- `304 Not Modified` support via `If-None-Match`.
- Bounded dynamic response cache for common `limit` query variants.

For external clients, prefer this flow:

1. Call `/api/catalog` or `/api/live/index` to discover available snapshot keys.
2. Call the specific dataset endpoint with `duration` and optional `limit`.
3. Reuse the returned `ETag` with `If-None-Match` on repeated polling.
4. Send `Accept-Encoding: br, gzip`.

## Local Benchmark Snapshot

Measured locally after the optimization with Brotli enabled:

| Endpoint | Wire Size | Concurrency | p50 | p95 | Errors |
|---|---:|---:|---:|---:|---:|
| `/api/catalog` | 615 B | 50 | 3.44 ms | 9.01 ms | 0 |
| `/api/infomarkets?duration=24h` | 133,828 B | 30 | 4.82 ms | 6.23 ms | 0 |
| `/api/live` | 625,834 B | 20 | 12.30 ms | 16.68 ms | 0 |

Before optimization, `/api/live` was about 22 MB pretty-printed JSON and roughly 137 ms p50 locally. The optimized path serves a compact, pre-compressed cached response.
