# Kaito Scan 使用文档

Kaito Scan 会把 Kaito 的 mindshare 数据先缓存下来，再通过你自己的 API 对外提供。

## 基础地址

生产环境：

https://kaito-scan-production.up.railway.app

## 身份验证

所有 `/api/*` 路由都需要带 Authorization 头：

```text
Authorization: Bearer YOUR_API_KEY
```

仪表盘 `/` 是公开的。

## 更新频率

- worker 每小时在 `05` 分更新一次。
- 例如：`08:05`、`09:05`、`10:05`。
- API 只读取缓存快照，不会临时请求 Kaito。
- 默认抓取并发数是 `5`。

## 支持的时间跨度

当前每个数据集支持这些跨度：

```text
24h, 7d, 30d, 3m, 6m, 12m
```

## 当前数据集

对每个支持的跨度，服务会抓取这些 ticker 快照：

```text
pre-tge:<duration>:heatmap
pre-tge:<duration>:topDelta
infomarkets:<duration>:heatmap
exchange:<duration>:heatmap
```

Info KOL 只抓这些跨度：

```text
infomarkets:7d:kols
infomarkets:30d:kols
infomarkets:3m:kols
infomarkets:6m:kols
infomarkets:12m:kols
```

也就是说，每次更新共有 `29` 个缓存快照。

暂未支持：

```text
ct-leaderboard
vcarena
```

## API 接口

### 状态

```text
GET /api/status
```

返回更新状态、下一次计划更新时间、最近一次运行信息、错误信息和可用快照 key。

```bash
curl https://kaito-scan-production.up.railway.app/api/status \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 全部实时数据

```text
GET /api/live
```

返回当前所有快照。

```bash
curl https://kaito-scan-production.up.railway.app/api/live \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### pre-tge 热力图

```text
GET /api/pre-tge?duration=24h&limit=50
```

`duration` 可选：`24h`、`7d`、`30d`、`3m`、`6m`、`12m`。默认是 `24h`。

```bash
curl "https://kaito-scan-production.up.railway.app/api/pre-tge?duration=7d&limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### pre-tge Top Delta

```text
GET /api/pre-tge/top-delta?duration=24h&limit=50
```

默认跨度是 `24h`。

```bash
curl "https://kaito-scan-production.up.railway.app/api/pre-tge/top-delta?duration=30d&limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### infomarkets 热力图

```text
GET /api/infomarkets?duration=24h&limit=50
```

默认跨度是 `24h`。

```bash
curl "https://kaito-scan-production.up.railway.app/api/infomarkets?duration=3m&limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### infomarkets KOL 排行榜

```text
GET /api/infomarkets/kols?duration=7d&limit=50
```

默认跨度是 `7d`。

Info KOL 支持：

```text
7d, 30d, 3m, 6m, 12m
```

Kaito 目前不接受这个接口的 `24h`。

```bash
curl "https://kaito-scan-production.up.railway.app/api/infomarkets/kols?duration=12m&limit=100" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### exchange 热力图

```text
GET /api/exchange?duration=24h&limit=50
```

默认跨度是 `24h`。

```bash
curl "https://kaito-scan-production.up.railway.app/api/exchange?duration=30d&limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 按 key 读取任意快照

```text
GET /api/snapshot/:key?limit=50
```

示例：

```bash
curl "https://kaito-scan-production.up.railway.app/api/snapshot/pre-tge:24h:heatmap?limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"

curl "https://kaito-scan-production.up.railway.app/api/snapshot/infomarkets:12m:kols?limit=100" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 手动更新

```text
POST /api/admin/update
```

手动触发一次新的抓取。

```bash
curl -X POST https://kaito-scan-production.up.railway.app/api/admin/update \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## 返回格式

单个快照响应示例：

```json
{
  "key": "pre-tge:7d:heatmap",
  "source": "pre-tge",
  "dataset": "heatmap",
  "duration": "7d",
  "updatedAt": "2026-05-20T00:05:12.000Z",
  "count": 50,
  "data": []
}
```

如果传了 `limit`，`data` 数组只会返回前 N 条。

## Railway 环境变量

建议配置：

```text
SCRAPE_CONCURRENCY=5
API_KEY=YOUR_API_KEY
```

Railway 会自动提供 `PORT`。

## 本地运行

安装依赖：

```bash
npm install
```

启动服务：

```bash
npm start
```

打开：

```text
http://localhost:3000
http://localhost:3000/api/status
```

如果设置了 `API_KEY`，本地调用 API 时也要带上授权头。

## 备注

- API 用户读取的是缓存快照。
- API 请求不会去实时打 Kaito。
- 服务每小时在 `05` 分更新。
- Railway 文件系统不适合长期保存历史数据。
- 如果要保留长期历史，后面可以加 Postgres 或对象存储。

## 历史数据 API

配置 `DATABASE_URL` 后，每次成功抓取都会写入 Postgres。

### 查看最近的抓取批次

```text
GET /api/history/runs?limit=24
```

```bash
curl "https://kaito-scan-production.up.railway.app/api/history/runs?limit=24" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 查看某一批次里的快照

```text
GET /api/history/run/:runId
```

```bash
curl "https://kaito-scan-production.up.railway.app/api/history/run/1" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 查看某个快照 key 的历史记录

```text
GET /api/history/snapshot/:key?limit=24
```

```bash
curl "https://kaito-scan-production.up.railway.app/api/history/snapshot/pre-tge:24h:heatmap?limit=24" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 读取某一条历史快照

```text
GET /api/history/item/:id?limit=50
```

```bash
curl "https://kaito-scan-production.up.railway.app/api/history/item/1?limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```
