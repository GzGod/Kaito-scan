# Kaito Scan Arena 接口调用文档

本文档只说明新版 Arena 数据接口，按 `Top Voices / Top Companies` 和 `stock / ai / crypto` 分类调用。

## 基础信息

生产地址：

```text
https://kaito-scan-production.up.railway.app
```

所有 `/api/*` 接口都需要 Bearer key：

```text
Authorization: Bearer YOUR_API_KEY
```

服务每小时 `05` 分更新一次。外部请求只读取缓存，不会临时请求 Kaito。

## 分类规则

### 类型

```text
voices
companies
```

### 市场分类

```text
stock
ai
crypto
```

### 时间跨度

Top Voices 支持：

```text
7d, 30d, 3m, 6m, 12m
```

Top Companies 支持：

```text
24h, 7d, 30d, 3m, 6m, 12m
```

## 实时接口

### Top Voices

```text
GET /api/arena/voices?vertical=stock&duration=7d&limit=50
```

参数：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `vertical` | 否 | `stock`、`ai`、`crypto`，默认 `stock` |
| `duration` | 否 | `7d`、`30d`、`3m`、`6m`、`12m`，默认 `7d` |
| `limit` | 否 | 返回前 N 条，不传则返回缓存里的全部数据 |

示例：

```bash
curl "https://kaito-scan-production.up.railway.app/api/arena/voices?vertical=crypto&duration=30d&limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Top Companies

```text
GET /api/arena/companies?vertical=crypto&duration=7d&limit=50
```

参数：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `vertical` | 否 | `stock`、`ai`、`crypto`，默认 `stock` |
| `duration` | 否 | `24h`、`7d`、`30d`、`3m`、`6m`、`12m`，默认 `24h` |
| `limit` | 否 | 返回前 N 条，不传则返回缓存里的全部数据 |

示例：

```bash
curl "https://kaito-scan-production.up.railway.app/api/arena/companies?vertical=crypto&duration=12m&limit=100" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## 快照 Key

如果需要直接按 key 读取缓存，可用：

```text
GET /api/snapshot/:key?limit=50
```

Top Voices key：

```text
arena-voices-stock:<duration>:leaderboard
arena-voices-ai:<duration>:leaderboard
arena-voices-crypto:<duration>:leaderboard
```

Top Companies key：

```text
arena-companies-stock:<duration>:leaderboard
arena-companies-ai:<duration>:leaderboard
arena-companies-crypto:<duration>:leaderboard
```

示例：

```bash
curl "https://kaito-scan-production.up.railway.app/api/snapshot/arena-companies-crypto:7d:leaderboard?limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## 历史数据接口

历史查询统一使用：

```text
GET /api/history/query
```

参数：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `source` | 是 | 具体数据源，例如 `arena-voices-crypto` |
| `dataset` | 是 | Arena 固定使用 `leaderboard` |
| `duration` | 是 | 对应类型支持的时间跨度 |
| `from` | 否 | 开始日期，格式 `YYYY-MM-DD`，按北京时间解释 |
| `to` | 否 | 结束日期，格式 `YYYY-MM-DD`，按北京时间解释 |
| `interval` | 否 | `hour` 或 `day`，默认 `hour` |
| `limit` | 否 | 每个历史快照返回前 N 条，默认 `50`，最大 `500` |

示例：查询 Crypto Top Companies 每日历史：

```bash
curl "https://kaito-scan-production.up.railway.app/api/history/query?source=arena-companies-crypto&dataset=leaderboard&duration=7d&from=2026-06-01&to=2026-06-18&interval=day&limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

示例：查询 AI Top Voices 每小时历史：

```bash
curl "https://kaito-scan-production.up.railway.app/api/history/query?source=arena-voices-ai&dataset=leaderboard&duration=30d&from=2026-06-18&to=2026-06-18&interval=hour&limit=100" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## 返回格式

实时接口返回单个快照：

```json
{
  "key": "arena-companies-crypto:7d:leaderboard",
  "source": "arena-companies-crypto",
  "dataset": "leaderboard",
  "duration": "7d",
  "updatedAt": "2026-06-17T16:29:47.442Z",
  "count": 50,
  "data": []
}
```

常见字段：

| 字段 | 说明 |
| --- | --- |
| `rank` | 排名 |
| `username` | Top Voices 常见字段 |
| `name` | 用户名或公司名 |
| `company_id` | Top Companies 常见字段 |
| `mindshare` | mindshare 小数，`0.1234` 表示 `12.34%` |
| `mindshare_delta` | mindshare 变化值 |

## 错误响应

未带 key：

```json
{ "error": "unauthorized" }
```

不支持的市场分类：

```json
{ "error": "unsupported vertical" }
```

不支持的时间跨度：

```json
{ "error": "unsupported duration" }
```
