# Scraper Performance Notes

The scraper fetches 29 Kaito snapshots per run. Each protected Kaito request requires a one-time proof-of-work challenge header; the same solved challenge cannot be reused across multiple data requests.

## What Was Tested

Local test runs showed these broad patterns:

| Concurrency | Typical Result | Notes |
|---:|---|---|
| 5 | ~11-14 seconds | Stable, low 429 risk |
| 6 | ~10-12 seconds | Best stable default in testing |
| 7+ | Faster when lucky, but can trigger 429 waves | Long-tail runs can exceed 70 seconds |
| 10 | ~7-9 seconds when clean | Too risky as default because bursts can trigger Kaito rate limits |

The dominant cost is network time for Kaito challenge and protected data requests. Local proof-of-work computation is negligible, usually only a few milliseconds per full scrape.

## Code-Level Optimizations

- Default scrape concurrency raised from 5 to 6.
- Added scrape metrics for challenge requests, protected requests, 429s, transient errors, and timing.
- Added retry handling for transient `502`, `503`, and `504` responses.
- Added jitter around 429 backoff to avoid synchronized retries.
- Added a global rate-limit gate so one 429 pauses other workers instead of letting them continue to collide with Kaito.
- Added a short serial recovery window after 429s to reduce repeated bursts.
- Added fetch timeouts so a single stalled request cannot hang a full scrape indefinitely.
- Worker logs scrape metrics after successful runs.

## Tunables

- `SCRAPE_CONCURRENCY`: default `6`.
- `SCRAPE_FETCH_TIMEOUT_MS`: default `30000`.
- `SCRAPE_RATE_LIMIT_RECOVERY_MS`: default `5000`.

For production, keep the default concurrency unless logs show sustained clean runs and a clear need for faster updates. The service only scrapes hourly at `xx:05`, so stability matters more than shaving a few seconds off the scrape.

## Current Local Validation

Final default run:

```json
{
  "seconds": 10.91,
  "snapshots": 29,
  "rateLimits": 0,
  "transientErrors": 0
}
```

At this point, the remaining bottleneck is Kaito-side network latency and one-time challenge validation per request. Since challenge headers cannot be reused, further speedups mostly require accepting more rate-limit risk or changing infrastructure/network placement rather than pure code changes.
