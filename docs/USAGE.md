# Kaito Scan — API 使用文档

Kaito Scan 每小时从 Kaito 抓取 mindshare 快照并缓存，通过 REST API 对外提供。

## Base URL

```
https://kaito-scan-production.up.railway.app
```

## 认证

所有 `/api/*` 路由均需要在 Header 中传入 API Key：

```
Authorization: Bearer YOUR_API_KEY
```

Dashboard 首页 `/` 不需要认证，公开访问。

## 更新频率

- 每小时 `:05` 分自动抓取一次（如 08:05、09:05）
- 手动触发：`POST /api/admin/update`
- API 请求只读缓存，不会触发 Kaito 实时请求

---

## 快照总览

当前共 **132 个快照**，每次更新全部刷新。

### Classic 数据集（Tickers）

支持时间段：`24h` `7d` `30d` `3m` `6m` `12m`

| 端点路径 | 快照 key 格式 |
|---|---|
| `GET /api/pre-tge` | `pre-tge:<duration>:heatmap` |
| `GET /api/pre-tge/top-delta` | `pre-tge:<duration>:topDelta` |
| `GET /api/pre-tge/kols` | `pre-tge:<duration>:kols` |
| `GET /api/infomarkets` | `infomarkets:<duration>:heatmap` |
| `GET /api/exchange` | `exchange:<duration>:heatmap` |

KOL 榜只支持 `7d` `30d` `3m` `6m` `12m`（不含 24h）：

| 端点路径 | 快照 key 格式 |
|---|---|
| `GET /api/infomarkets/kols` | `infomarkets:<duration>:kols` |

### Arena 数据集

**Top Voices**（支持 `7d` `30d` `3m` `6m` `12m`）：

| vertical 参数 | 快照 key 格式 |
|---|---|
| `stock` | `arena-voices-stock:<duration>:leaderboard` |
| `ai` | `arena-voices-ai:<duration>:leaderboard` |
| `crypto` | `arena-voices-crypto:<duration>:leaderboard` |

**Top Companies**（支持 `24h` `7d` `30d` `3m` `6m` `12m`）：

| vertical 参数 | 快照 key 格式 |
|---|---|
| `stock` | `arena-companies-stock:<duration>:leaderboard` |
| `ai` | `arena-companies-ai:<duration>:leaderboard` |
| `crypto` | `arena-companies-crypto:<duration>:leaderboard` |

**Language Region**（EN/ZH/KO，支持 `7d` `30d` `3m` `6m` `12m`）：

```
arena-voices-<vertical>:<duration>:language-en
arena-voices-<vertical>:<duration>:language-zh
arena-voices-<vertical>:<duration>:language-ko
```

`vertical` 为 `stock` / `ai` / `crypto`。语言只支持 `en` `zh` `ko`——`ja`、`es` 等其他值返回 400。韩语区在 trading 和 crypto 两个分类数据较多（7d 约 95–100 人），AI 分类较少（7d 只有 6 人，12m 才有 98 人）。

**Smart Followers**（支持 `7d` `30d` `3m` `6m` `12m`）：

```
arena-voices-stock:<duration>:smart-followers
arena-voices-ai:<duration>:smart-followers
arena-voices-crypto:<duration>:smart-followers
```

**Top Gainer（多时间段 delta）**：

```
arena-voices-stock:all:delta-all
arena-voices-ai:all:delta-all
arena-voices-crypto:all:delta-all
```

**GitHub Repos（AI 专属，支持 `7d` `30d` `3m` `6m` `12m`）**：

```
arena-voices-ai:<duration>:github-repos
```

---

## API 端点

### 服务状态

```
GET /api/status
```

返回更新状态、下次计划时间、上次运行信息、错误、所有快照 key 列表。

```bash
curl https://kaito-scan-production.up.railway.app/api/status \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 所有当前快照

```
GET /api/live
```

返回全部快照的完整数据。

```bash
curl https://kaito-scan-production.up.railway.app/api/live \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 所有快照 key 列表

```
GET /api/catalog
```

返回所有快照的 key、数量、最后更新时间。

```bash
curl https://kaito-scan-production.up.railway.app/api/catalog \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Pre-TGE Heatmap

```
GET /api/pre-tge?duration=24h&limit=50
```

```bash
curl "https://kaito-scan-production.up.railway.app/api/pre-tge?duration=7d&limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Pre-TGE Top Delta

```
GET /api/pre-tge/top-delta?duration=24h&limit=50
```

```bash
curl "https://kaito-scan-production.up.railway.app/api/pre-tge/top-delta?duration=30d&limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Pre-TGE KOL Leaderboard

```
GET /api/pre-tge/kols?duration=7d&limit=50
```

pre-TGE 赛道自己的 KOL 榜，和 `infomarkets/kols` 是不同的排名——两者只有约 5/100 重合。评分维度也不同：用 mentions / insightfulness / originality，而不是 mindshare。

duration 支持 `7d` `30d` `3m` `6m` `12m`。

```bash
curl "https://kaito-scan-production.up.railway.app/api/pre-tge/kols?duration=7d&limit=100" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

每个条目包含 `rank` `user_id` `username` `name` `bio` `mindshare` `mention_score` `insightfullness` `originality` `follower_net_worth` `follower_count` `smart_follower_count`。

### Info Markets Heatmap

```
GET /api/infomarkets?duration=24h&limit=50
```

```bash
curl "https://kaito-scan-production.up.railway.app/api/infomarkets?duration=3m&limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Info KOL Leaderboard

```
GET /api/infomarkets/kols?duration=7d&limit=50
```

duration 支持 `7d` `30d` `3m` `6m` `12m`，不支持 `24h`。

```bash
curl "https://kaito-scan-production.up.railway.app/api/infomarkets/kols?duration=12m&limit=100" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Exchange Heatmap

```
GET /api/exchange?duration=24h&limit=50
```

```bash
curl "https://kaito-scan-production.up.railway.app/api/exchange?duration=30d&limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Arena Top Voices

```
GET /api/arena/voices?vertical=stock&duration=7d&limit=50
```

`vertical`：`stock` `ai` `crypto`
`duration`：`7d` `30d` `3m` `6m` `12m`

```bash
curl "https://kaito-scan-production.up.railway.app/api/arena/voices?vertical=crypto&duration=7d&limit=100" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Arena Top Companies

```
GET /api/arena/companies?vertical=stock&duration=24h&limit=50
```

`vertical`：`stock` `ai` `crypto`
`duration`：`24h` `7d` `30d` `3m` `6m` `12m`

```bash
curl "https://kaito-scan-production.up.railway.app/api/arena/companies?vertical=stock&duration=24h&limit=100" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 按 Key 读取任意快照

```
GET /api/snapshot/:key?limit=50
```

`key` 需要 URL 编码（`:` 编码为 `%3A`）。

```bash
curl "https://kaito-scan-production.up.railway.app/api/snapshot/pre-tge%3A24h%3Aheatmap?limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"

curl "https://kaito-scan-production.up.railway.app/api/snapshot/arena-voices-crypto%3A7d%3Aleaderboard?limit=100" \
  -H "Authorization: Bearer YOUR_API_KEY"

curl "https://kaito-scan-production.up.railway.app/api/snapshot/arena-voices-stock%3Aall%3Adelta-all" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Sparkline 代理（折线图数据）

```
GET /api/proxy/mindshare-line?user_ids=ID1,ID2&vertical=trading&duration=7d
```

转发 Kaito 的 `batch_mindshare_line` 端点，返回指定用户的历史 mindshare 折线数据。`vertical` 使用 Kaito 内部名称：`trading`（对应 stock）、`ai`、`crypto`。

```bash
curl "https://kaito-scan-production.up.railway.app/api/proxy/mindshare-line?user_ids=258480276,14470&vertical=crypto&duration=7d" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Tickert 折线（单个 ticker 的 mindshare 历史）

```
GET /api/proxy/ticker-line?ticker=BTC&duration=7d
```

转发 Kaito 的 `tickers/mindshare-line`。返回该 ticker 的 mindshare 时间序列。`duration` 支持 `24h` `7d` `30d` `3m` `6m` `12m` `all`（不支持 `1y`）。

- `24h` 返回小时级数据（`interval: "1h"`，约 25 个点）
- 其余按天（`interval: "1d"`），`all` 返回全部历史约 2500 个点
- ticker 不存在时返回全 0 序列，不是 404

```bash
curl "https://kaito-scan-production.up.railway.app/api/proxy/ticker-line?ticker=BTC&duration=30d" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

响应：

```json
{
  "result": {
    "interval": "1d",
    "result": [
      { "timestamp": 1793836800000, "mindshare": 0.1313526192337764 }
    ]
  },
  "tickerData": {
    "fullname": "Bitcoin",
    "ticker_id": "BTC",
    "display_ticker": "BTC",
    "logo": "https://kaito-public-assets.s3.us-west-2.amazonaws.com/ticker-icons/BTC/..."
  }
}
```

### 互动量历史（全站 / 单个 ticker）

```
GET /api/proxy/engagement?duration=7d
GET /api/proxy/engagement?ticker=BTC&duration=30d
```

转发 Kaito 的 `tickers/engagement`。

不传 `ticker` 时返回全站聚合的互动量序列。传 `ticker` 时额外返回**该 ticker 的价格序列**，并且互动量也是该 ticker 单独的：

```json
{
  "interval": "1d",
  "price": {
    "success": true,
    "dayChange": "0.34%",
    "priceData": [16542.45, 16619.06, ...],
    "priceTimeseriesData": [["timestamp", 1672531200, ...], ["Price", 16542.45, ...]]
  },
  "result": {
    "total": {
      "timestamp": [1672531200000, ...],
      "charts": [
        { "title": "Price", "data": [...] },
        { "title": "Total document mentions", "data": [...] },
        { "title": "Total engagement", "data": [...] },
        { "title": "Smart engagement", "data": [...] }
      ]
    }
  },
  "summaryData": { "document": 2108841, "engagement": 384631226, "smartEngagement": 2044799 }
}
```

`result.total.charts` 里的四条序列是 price / mentions / engagement / smart engagement，可直接拿来画价格和热度的对比图。

```bash
curl "https://kaito-scan-production.up.railway.app/api/proxy/engagement?duration=30d" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

响应：

```json
{
  "interval": "1d",
  "result": {
    "total":      { "timestamp": [...], "mindshare": [...] },
    "document":   { "timestamp": [...], "value": [...] },
    "engagement": { "timestamp": [...], "value": [...] },
    "twitterInCircleEngagement": { "timestamp": [...], "value": [...] }
  },
  "summaryData": { "document": 224335508, "engagement": 27250871075, "smartEngagement": 43655161 }
}
```

### 手动触发更新

```
POST /api/admin/update
```

```bash
curl -X POST https://kaito-scan-production.up.railway.app/api/admin/update \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

## KOL Smart Followers API

按需查询任意 KOL 的 smart followers 数据（被多少 Kaito 认定的 smart 账号关注），数据源是 Kaito 的 `voices/social_card` 接口，不需要 Kaito 账号。

- 实时向 Kaito 查询，单个 KOL 首次约 2–5 秒，之后缓存 1 小时（约 1ms）
- `:id` 可以是 Twitter 数字 ID，也可以是用户名（带不带 `@` 都行，不区分大小写）
- 用户名先在缓存榜单里查对应 ID；查不到时自动通过 fxtwitter 解析，结果记住，下次直接命中。首次解析会多 2–3 秒；不存在的用户名会被记 10 分钟，期间直接返回 404
- `scope`：`all`（默认，三个分类一次返回）、`crypto`、`ai`、`trading`（`stock` 是 `trading` 的别名）

### 单个 KOL 概览

```
GET /api/kol/:id?scope=all
```

```bash
curl "https://kaito-scan-production.up.railway.app/api/kol/jukan05" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

响应：

```json
{
  "userId": "1836240683268759552",
  "username": "jukan05",
  "name": "Jukan",
  "avatar": "https://pbs.twimg.com/profile_images/...",
  "bio": "@citrini",
  "language": "English",
  "identityTags": ["analyst", "market_commentator"],
  "scope": "all",
  "smartFollowers": 4158,
  "followers": 222076,
  "sfLabel": "Elite",
  "smartEngagement": 8144,
  "impression": 253682462,
  "categories": {
    "crypto":  { "smartFollowers": 1337, "relevantTweetCount": 947 },
    "ai":      { "smartFollowers": 934,  "relevantTweetCount": 732 },
    "trading": { "smartFollowers": 1029, "relevantTweetCount": 1300 }
  }
}
```

| 字段 | 含义 |
|---|---|
| `smartFollowers` | 关注他的 smart 账号总数（全分类） |
| `categories.<scope>.smartFollowers` | 该分类下的 smart 关注者数 |
| `sfLabel` | Kaito 给的 smart follower 等级标签，如 `Elite` |
| `followers` | 推特总粉丝数 |
| `smartEngagement` | smart 账号互动量 |
| `topics` | 该 KOL 主要涉及的 topic 标签（来自 Kaito 的 cross leaderboard，如 `["ETH","NEAR"]`） |
| `tickers` | 该 KOL 关联的 ticker 列表，每项含 `ticker` `name` `logo` |

传单个 scope（如 `?scope=crypto`）时没有 `categories`，改为顶层的 `smartFollowers`（该分类）和 `relevantTweetCount`。

### 关注他的 Smart 账号（详情）

```
GET /api/kol/:id/followers?scope=crypto
```

必须指定单个 scope（默认 `crypto`）。除概览字段外，额外返回：

- `topSmartFollowers`：关注他的头部 smart 账号列表（约 35 个），每项含 `userId` `username` `name` `avatar` `mindshare`
- `smartFollowerRank` / `smartFollowerShare`：smart follower 排名和占比的历史序列
- `mindshareRank` / `mindshareShare`、`smartFollowerBreakdown`、`engagementDetails`、`impressionDetails`、`contentFormat`、`contentActivity`、`sponsored`、`cryptoRolePercentage`（Kaito 原样透传）

```bash
curl "https://kaito-scan-production.up.railway.app/api/kol/jukan05/followers?scope=crypto" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 批量查询

```
GET  /api/kol/batch?ids=jukan05,hosseeb,1836240683268759552&scope=crypto
POST /api/kol/batch   body: {"ids": [...], "scope": "crypto"}
```

单次上限：`scope=all` 时 20 个，单个 scope 时 50 个（`all` 每个 KOL 要请求 3 次）。

```bash
curl -X POST "https://kaito-scan-production.up.railway.app/api/kol/batch" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "content-type: application/json" \
  -d '{"ids":["jukan05","hosseeb","blknoiz06"],"scope":"crypto"}'
```

响应：

```json
{
  "scope": "crypto",
  "count": 3,
  "items": {
    "jukan05":   { "userId": "1836240683268759552", "smartFollowers": 1337, "...": "..." },
    "hosseeb":   { "userId": "231208649", "smartFollowers": 5099, "...": "..." },
    "blknoiz06": { "userId": "973261472", "smartFollowers": 6026, "...": "..." }
  },
  "unresolved": [],
  "errors": {}
}
```

`items` 的 key 是你传入的原始值；查不到的为 `null` 并列入 `unresolved`；Kaito 请求失败的列入 `errors`。

### 错误码

| HTTP | 情况 |
|---|---|
| 400 | `scope` 不支持；`detail` 配 `scope=all`；批量为空或超上限；body 不是合法 JSON |
| 404 | 用户名不存在，或该账号在 Kaito 没有数据 |
| 502 | Kaito 或 fxtwitter 上游请求失败（限流或接口变更） |

---

## 响应格式

单个快照响应结构：

```json
{
  "key": "pre-tge:7d:heatmap",
  "source": "pre-tge",
  "dataset": "heatmap",
  "duration": "7d",
  "updatedAt": "2026-11-03T08:05:12.000Z",
  "count": 50,
  "data": [
    {
      "rank": 1,
      "ticker": "AAVE",
      "mindshare": 0.0421,
      "change_7d": 0.0031
    }
  ]
}
```

Arena leaderboard 响应结构（voices/companies）：

```json
{
  "key": "arena-voices-crypto:7d:leaderboard",
  "data": [
    {
      "rank": 1,
      "user_id": "123456",
      "name": "Stan Druckenmiller",
      "username": "standuquesne",
      "avatar": "https://pbs.twimg.com/profile_images/...",
      "mindshare": 0.0966,
      "mindshare_delta": 0.0966
    }
  ]
}
```

Delta-all 响应结构：

```json
{
  "key": "arena-voices-stock:all:delta-all",
  "data": [
    {
      "rank": 1,
      "username": "jukan05",
      "avatar": "https://pbs.twimg.com/...",
      "mindshare": 0.0049,
      "change_7d": 0.00093,
      "change_30d": 0.00086,
      "change_3m": 0.00055,
      "change_6m": 0.00049,
      "change_12m": 0.00079
    }
  ]
}
```

`limit` 参数控制 `data` 数组返回的最大条数，默认无限制。

---

## 历史数据 API

配置 `DATABASE_URL` 环境变量后，每次成功抓取的数据会写入 Postgres，支持历史查询。

### 查询历史快照

```
GET /api/history/query
```

参数：

```
source=pre-tge | infomarkets | exchange | arena-voices-stock | arena-voices-ai | arena-voices-crypto | arena-companies-stock | arena-companies-ai | arena-companies-crypto
dataset=heatmap | topDelta | kols | leaderboard | delta-all
duration=24h | 7d | 30d | 3m | 6m | 12m
from=2026-10-01
to=2026-11-03
interval=hour | day
limit=50
```

`interval=day` 按上海时区日历天分组，每天取最新一条。

```bash
curl "https://kaito-scan-production.up.railway.app/api/history/query?source=arena-voices-crypto&dataset=leaderboard&duration=7d&from=2026-10-01&to=2026-11-03&interval=day&limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 最近抓取记录

```
GET /api/history/runs?limit=24
```

### 某次抓取的所有快照

```
GET /api/history/run/:runId
```

### 某个 key 的历史记录

```
GET /api/history/snapshot/:key?limit=24
```

```bash
curl "https://kaito-scan-production.up.railway.app/api/history/snapshot/arena-voices-stock%3A7d%3Aleaderboard?limit=24" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 读取单条历史快照

```
GET /api/history/item/:id?limit=50
```

---

## 本地运行

```bash
npm install
npm start
```

访问：

```
http://localhost:3000
http://localhost:3000/api/status
```

## Railway 环境变量

```
API_KEY=YOUR_API_KEY
SCRAPE_CONCURRENCY=5
DATABASE_URL=postgres://...   # 可选，开启历史存储
```

`PORT` 由 Railway 自动注入。
