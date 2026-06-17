# Railway 历史数据查询接口说明

这份文档说明 `GET /api/history/query` 的作用和调用方式。这个接口用于让外部服务通过你的 Kaito Scan 服务读取 Railway Postgres 里的历史快照数据。

## 这个接口解决什么问题

原来的实时接口只适合读取当前缓存数据，例如：

```text
GET /api/pre-tge?duration=24h&limit=50
GET /api/infomarkets?duration=7d&limit=50
GET /api/exchange?duration=30d&limit=50
```

这些接口返回的是“最新一次抓取结果”。

新的历史接口可以按时间范围查询数据库里保存过的历史快照，例如：

```text
2026-06-01 到 2026-06-09 的 pre-tge 每日数据
某一天内每小时的 exchange 榜单变化
过去 7 天 infomarkets KOL 榜单历史
```

它适合外部服务做：

- 历史趋势图
- 项目 mindshare 变化分析
- 每日榜单归档
- 外部数据同步
- 回测和报表生成

## 鉴权方式

所有 `/api/*` 接口都沿用同一个 Bearer key。

请求头必须带：

```text
Authorization: Bearer YOUR_API_KEY
```

示例：

```bash
curl "https://kaito-scan-production.up.railway.app/api/history/query?source=pre-tge&dataset=heatmap&duration=24h" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

如果没有带 key，返回：

```json
{
  "error": "unauthorized"
}
```

HTTP 状态码是 `401`。

## 接口地址

```text
GET /api/history/query
```

生产环境完整地址：

```text
https://kaito-scan-production.up.railway.app/api/history/query
```

## 查询参数

| 参数 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `source` | 是 | - | 数据来源，可选 `pre-tge`、`infomarkets`、`exchange`、`arena-voices-stock`、`arena-voices-ai`、`arena-voices-crypto`、`arena-companies-stock`、`arena-companies-ai`、`arena-companies-crypto` |
| `dataset` | 是 | - | 数据集，可选 `heatmap`、`topDelta`、`kols`、`leaderboard` |
| `duration` | 是 | - | 时间跨度，可选 `24h`、`7d`、`30d`、`3m`、`6m`、`12m` |
| `from` | 否 | 最近 7 天起始日 | 查询开始日期，格式 `YYYY-MM-DD`，按北京时间解释 |
| `to` | 否 | 今天 | 查询结束日期，格式 `YYYY-MM-DD`，按北京时间解释，包含当天 |
| `interval` | 否 | `hour` | 返回粒度，可选 `hour` 或 `day` |
| `limit` | 否 | `50` | 每个快照内最多返回多少条 item，最大 `500` |

## 支持的数据组合

### pre-tge 热力图

```text
source=pre-tge
dataset=heatmap
duration=24h | 7d | 30d | 3m | 6m | 12m
```

### pre-tge Top Delta

```text
source=pre-tge
dataset=topDelta
duration=24h | 7d | 30d | 3m | 6m | 12m
```

### infomarkets 热力图

```text
source=infomarkets
dataset=heatmap
duration=24h | 7d | 30d | 3m | 6m | 12m
```

### infomarkets KOL 榜单

```text
source=infomarkets
dataset=kols
duration=7d | 30d | 3m | 6m | 12m
```

注意：`infomarkets/kols` 不支持 `24h`。

### exchange 热力图

```text
source=exchange
dataset=heatmap
duration=24h | 7d | 30d | 3m | 6m | 12m
```

### Arena Top Voices

```text
source=arena-voices-stock | arena-voices-ai | arena-voices-crypto
dataset=leaderboard
duration=7d | 30d | 3m | 6m | 12m
```

注意：Top Voices 不支持 `24h`。

### Arena Top Companies

```text
source=arena-companies-stock | arena-companies-ai | arena-companies-crypto
dataset=leaderboard
duration=24h | 7d | 30d | 3m | 6m | 12m
```

## interval 的含义

### `interval=hour`

返回时间范围内每小时保存的快照。

服务每小时在 `05` 分抓取一次，所以通常会看到类似：

```text
08:05
09:05
10:05
```

适合做小时级趋势分析。

示例：查询 2026-06-09 当天每小时的 pre-tge 数据：

```bash
curl "https://kaito-scan-production.up.railway.app/api/history/query?source=pre-tge&dataset=heatmap&duration=24h&from=2026-06-09&to=2026-06-09&interval=hour&limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### `interval=day`

按北京时间自然日分组，每天只返回当天最新一条快照。

适合做日报、周报、项目区间对比。

示例：查询 2026-06-01 到 2026-06-09 每天最新的 pre-tge 数据：

```bash
curl "https://kaito-scan-production.up.railway.app/api/history/query?source=pre-tge&dataset=heatmap&duration=24h&from=2026-06-01&to=2026-06-09&interval=day&limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## 返回格式

成功响应示例：

```json
{
  "source": "pre-tge",
  "dataset": "heatmap",
  "duration": "24h",
  "interval": "day",
  "from": "2026-06-01",
  "to": "2026-06-09",
  "count": 9,
  "snapshots": [
    {
      "id": "12993",
      "runId": "449",
      "key": "pre-tge:24h:heatmap",
      "source": "pre-tge",
      "dataset": "heatmap",
      "duration": "24h",
      "itemCount": 52,
      "count": 50,
      "updatedAt": "2026-06-09T08:05:00.687Z",
      "createdAt": "2026-06-09T08:05:08.728Z",
      "data": []
    }
  ]
}
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `source` | 请求的数据来源 |
| `dataset` | 请求的数据集 |
| `duration` | 请求的时间跨度 |
| `interval` | 返回粒度，`hour` 或 `day` |
| `from` | 查询开始日期，北京时间 |
| `to` | 查询结束日期，北京时间 |
| `count` | 返回的快照数量 |
| `snapshots` | 历史快照数组 |
| `snapshots[].id` | 数据库里的 snapshot id |
| `snapshots[].runId` | 对应抓取批次 id |
| `snapshots[].key` | 快照 key，例如 `pre-tge:24h:heatmap` |
| `snapshots[].itemCount` | 原始快照里的 item 总数 |
| `snapshots[].count` | 本次实际返回的 item 数量，受 `limit` 控制 |
| `snapshots[].createdAt` | 快照写入数据库时间 |
| `snapshots[].updatedAt` | 快照抓取完成时间 |
| `snapshots[].data` | Kaito 原始 item 数据，字段不做重命名 |

## data 里的常见字段

不同数据集的 item 字段可能不同。以 `pre-tge/heatmap` 为例，常见字段包括：

```text
rank
ticker
fullname
mindshare
change_24h
change_7d
change_30d
change_3m
change_24h_ratio
change_7d_ratio
change_30d_ratio
change_3m_ratio
```

其中：

- `mindshare` 是小数，例如 `0.3349` 表示 `33.49%`。
- `change_24h`、`change_7d`、`change_30d`、`change_3m` 是百分点变化的小数形式。
- 比如 `change_24h = 0.0123` 可以展示成 `+1.23pp`。
- `*_ratio` 是相对变化比例，不是百分点。

## 常用调用示例

### 1. 查询 pre-tge 每日历史

```bash
curl "https://kaito-scan-production.up.railway.app/api/history/query?source=pre-tge&dataset=heatmap&duration=24h&from=2026-06-01&to=2026-06-09&interval=day&limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 2. 查询 pre-tge 每小时历史

```bash
curl "https://kaito-scan-production.up.railway.app/api/history/query?source=pre-tge&dataset=heatmap&duration=24h&from=2026-06-09&to=2026-06-09&interval=hour&limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 3. 查询 exchange 最近 7 天 30d 维度历史

```bash
curl "https://kaito-scan-production.up.railway.app/api/history/query?source=exchange&dataset=heatmap&duration=30d&interval=day&limit=100" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 4. 查询 infomarkets KOL 榜单历史

```bash
curl "https://kaito-scan-production.up.railway.app/api/history/query?source=infomarkets&dataset=kols&duration=7d&from=2026-06-01&to=2026-06-09&interval=day&limit=100" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 5. 查询 pre-tge Top Delta 历史

```bash
curl "https://kaito-scan-production.up.railway.app/api/history/query?source=pre-tge&dataset=topDelta&duration=24h&from=2026-06-01&to=2026-06-09&interval=day&limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 6. 查询 Arena Top Voices 历史

```bash
curl "https://kaito-scan-production.up.railway.app/api/history/query?source=arena-voices-crypto&dataset=leaderboard&duration=7d&interval=day&limit=100" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 7. 查询 Arena Top Companies 历史

```bash
curl "https://kaito-scan-production.up.railway.app/api/history/query?source=arena-companies-stock&dataset=leaderboard&duration=24h&interval=day&limit=100" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## 错误响应

### 未授权

```json
{
  "error": "unauthorized"
}
```

HTTP 状态码：`401`

### 不支持的数据集组合

```json
{
  "error": "unsupported dataset"
}
```

HTTP 状态码：`400`

### 不支持的 duration

```json
{
  "error": "unsupported duration",
  "supportedDurations": ["7d", "30d", "3m", "6m", "12m"]
}
```

HTTP 状态码：`400`

### 不支持的 interval

```json
{
  "error": "unsupported interval",
  "supportedIntervals": ["hour", "day"]
}
```

HTTP 状态码：`400`

### 数据库不可用

```json
{
  "error": "database unavailable"
}
```

HTTP 状态码：`503`

## 外部服务使用建议

- 如果做趋势图，优先用 `interval=day`，响应更小。
- 如果做小时级监控或回放，使用 `interval=hour`。
- 外部服务最好缓存结果，不要高频重复请求长时间范围。
- `limit` 根据业务需要设置，常见项目榜用 `50` 就够。
- 如果要全量 item，最多只能设置到 `500`。
- 返回的 `data` 是 Kaito 原始字段，建议外部服务自己做字段映射和展示格式化。

## 和旧历史接口的区别

旧接口仍然保留：

```text
GET /api/history/runs
GET /api/history/run/:runId
GET /api/history/snapshot/:key
GET /api/history/item/:id
```

旧接口更偏底层，适合人工排查某一次抓取。

新接口：

```text
GET /api/history/query
```

更适合外部服务直接按日期范围拿历史数据。
