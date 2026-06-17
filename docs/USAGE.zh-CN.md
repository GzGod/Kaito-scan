# Kaito Scan 使用文档

Kaito Scan 会按小时抓取 Kaito 数据，写入本地缓存和 Railway Postgres，然后通过你自己的 API 对外提供。

## 基础地址

```text
https://kaito-scan-production.up.railway.app
```

## 鉴权

所有 `/api/*` 路由都需要：

```text
Authorization: Bearer YOUR_API_KEY
```

首页 `/` 是公开 Dashboard。

## 更新频率

- 每小时 `05` 分更新一次，例如 `08:05`、`09:05`。
- API 只读缓存快照，不会因为外部请求临时打 Kaito。
- 默认抓取并发由 `SCRAPE_CONCURRENCY` 控制。

## 实时数据接口

### 全部数据

```text
GET /api/live
```

### 状态

```text
GET /api/status
```

返回最近更新时间、下次更新时间、最近一次运行状态、数据库状态、当前快照 key 列表。

## 已支持数据集

### 原有 Mindshare 数据

```text
GET /api/pre-tge?duration=24h&limit=50
GET /api/pre-tge/top-delta?duration=24h&limit=50
GET /api/infomarkets?duration=24h&limit=50
GET /api/infomarkets/kols?duration=7d&limit=50
GET /api/exchange?duration=24h&limit=50
```

支持时间跨度：

```text
24h, 7d, 30d, 3m, 6m, 12m
```

注意：`/api/infomarkets/kols` 不支持 `24h`，只支持：

```text
7d, 30d, 3m, 6m, 12m
```

### 新版 Arena Top Voices

```text
GET /api/arena/voices?vertical=stock&duration=7d&limit=50
```

参数：

```text
vertical=stock | ai | crypto
duration=7d | 30d | 3m | 6m | 12m
limit=50
```

示例：

```bash
curl "https://kaito-scan-production.up.railway.app/api/arena/voices?vertical=crypto&duration=7d&limit=100" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

快照 key 格式：

```text
arena-voices-stock:<duration>:leaderboard
arena-voices-ai:<duration>:leaderboard
arena-voices-crypto:<duration>:leaderboard
```

### 新版 Arena Top Companies

```text
GET /api/arena/companies?vertical=stock&duration=24h&limit=50
```

参数：

```text
vertical=stock | ai | crypto
duration=24h | 7d | 30d | 3m | 6m | 12m
limit=50
```

示例：

```bash
curl "https://kaito-scan-production.up.railway.app/api/arena/companies?vertical=stock&duration=24h&limit=100" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

快照 key 格式：

```text
arena-companies-stock:<duration>:leaderboard
arena-companies-ai:<duration>:leaderboard
arena-companies-crypto:<duration>:leaderboard
```

## 按 key 读取任意快照

```text
GET /api/snapshot/:key?limit=50
```

示例：

```bash
curl "https://kaito-scan-production.up.railway.app/api/snapshot/arena-voices-stock:7d:leaderboard?limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## 返回格式

```json
{
  "key": "arena-voices-crypto:7d:leaderboard",
  "source": "arena-voices-crypto",
  "dataset": "leaderboard",
  "duration": "7d",
  "updatedAt": "2026-06-17T15:05:12.000Z",
  "count": 100,
  "data": []
}
```

`limit` 只限制响应里的 `data` 数组长度，不改变数据库里保存的原始快照。

## 历史数据接口

配置 `DATABASE_URL` 后，每次成功抓取都会写入 Railway Postgres。

```text
GET /api/history/query
```

参数：

```text
source=pre-tge | infomarkets | exchange | arena-voices-stock | arena-voices-ai | arena-voices-crypto | arena-companies-stock | arena-companies-ai | arena-companies-crypto
dataset=heatmap | topDelta | kols | leaderboard
duration=24h | 7d | 30d | 3m | 6m | 12m
from=2026-06-01
to=2026-06-09
interval=hour | day
limit=50
```

规则：

- `interval=hour`：返回范围内每小时抓到的快照。
- `interval=day`：按北京时间自然日分组，每天返回当天最新一条快照。
- `limit`：限制每个 snapshot 内 `data` 返回前 N 条，默认 `50`，最大 `500`。
- `from/to`：按北京时间日期解析；不传 `to` 默认今天，不传 `from` 默认最近 7 天。

示例：

```bash
curl "https://kaito-scan-production.up.railway.app/api/history/query?source=arena-companies-stock&dataset=leaderboard&duration=24h&interval=day&limit=100" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## 环境变量

```text
API_KEY=YOUR_API_KEY
DATABASE_URL=postgresql://...
SCRAPE_CONCURRENCY=5
SCRAPE_FETCH_TIMEOUT_MS=30000
SCRAPE_RATE_LIMIT_RECOVERY_MS=5000
```

Railway 会自动提供 `PORT`。

## 本地运行

```bash
npm install
npm start
```

本地地址：

```text
http://localhost:3000
```

## 当前不支持

```text
ct-leaderboard
vcarena
```
