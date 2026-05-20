# Kaito Scan 使用文档

Kaito Scan 是一个缓存型数据服务。它不会在用户请求 API 时实时请求 Kaito，而是由服务自己按计划抓取数据并保存快照，API 只返回最近一次快照。

## 更新策略

服务启动后会先尝试抓取一次数据。如果本地已有快照，会直接读取已有快照。

之后会按真实时钟每小时第 05 分钟自动更新一次，例如：

```text
00:05
01:05
02:05
08:05
09:05
10:05
```

并发数默认是 5，可以通过环境变量设置：

```text
SCRAPE_CONCURRENCY=5
```

## 当前采集的数据

当前服务采集以下 5 组数据：

```text
pre-tge:24h:heatmap
pre-tge:24h:topDelta
infomarkets:24h:heatmap
exchange:24h:heatmap
infomarkets:7d:kols
```

暂未打通：

```text
ct-leaderboard
vcarena
```

## 页面

首页是一个 HTML 看板：

```text
GET /
```

展示：

- pre-tge 24h Top 50
- pre-tge 24h Movers
- infomarkets 24h Top 50
- exchange 24h Top 50
- infomarkets KOL 7d Top 50

## API

### 状态

```text
GET /api/status
```

返回服务状态、最后更新时间、下一次更新时间、可用 snapshot key。

示例：

```bash
curl https://kaito-scan-production.up.railway.app/api/status
```

### 全部快照

```text
GET /api/live
```

返回当前内存中的全部快照。

```bash
curl https://kaito-scan-production.up.railway.app/api/live
```

### pre-tge 24h heatmap

```text
GET /api/pre-tge?limit=50
```

```bash
curl "https://kaito-scan-production.up.railway.app/api/pre-tge?limit=50"
```

### pre-tge 24h topDelta

```text
GET /api/pre-tge/top-delta?limit=50
```

```bash
curl "https://kaito-scan-production.up.railway.app/api/pre-tge/top-delta?limit=50"
```

### infomarkets 24h heatmap

```text
GET /api/infomarkets?limit=50
```

```bash
curl "https://kaito-scan-production.up.railway.app/api/infomarkets?limit=50"
```

### infomarkets KOL 7d

```text
GET /api/infomarkets/kols?limit=50
```

```bash
curl "https://kaito-scan-production.up.railway.app/api/infomarkets/kols?limit=50"
```

### exchange 24h heatmap

```text
GET /api/exchange?limit=50
```

```bash
curl "https://kaito-scan-production.up.railway.app/api/exchange?limit=50"
```

### 按 key 读取任意快照

```text
GET /api/snapshot/:key?limit=50
```

注意 key 里有冒号，URL 中可以直接使用，也可以 URL encode。

```bash
curl "https://kaito-scan-production.up.railway.app/api/snapshot/pre-tge:24h:heatmap?limit=50"
curl "https://kaito-scan-production.up.railway.app/api/snapshot/infomarkets:7d:kols?limit=100"
```

## 手动触发更新

```text
POST /api/admin/update
```

如果设置了环境变量 `API_KEY`，需要带 header：

```text
x-api-key: YOUR_API_KEY
```

示例：

```bash
curl -X POST https://kaito-scan-production.up.railway.app/api/admin/update \
  -H "x-api-key: YOUR_API_KEY"
```

如果没有设置 `API_KEY`，这个接口不需要鉴权。正式公开服务建议设置 `API_KEY`。

## 返回结构

单个快照返回结构大致如下：

```json
{
  "key": "pre-tge:24h:heatmap",
  "source": "pre-tge",
  "dataset": "heatmap",
  "duration": "24h",
  "updatedAt": "2026-05-20T00:05:12.000Z",
  "count": 50,
  "data": []
}
```

如果使用 `limit`，`data` 会只返回前 N 条。

## Railway 环境变量

建议设置：

```text
SCRAPE_CONCURRENCY=5
API_KEY=自己生成一个长一点的随机字符串
```

Railway 会自动提供：

```text
PORT
```

## 本地运行

```bash
npm install
npm start
```

然后访问：

```text
http://localhost:3000
http://localhost:3000/api/status
```

## 注意事项

- API 返回的是本服务保存的快照，不是请求时实时抓取 Kaito。
- 用户调用 API 不会触发 Kaito 请求。
- 服务每小时第 05 分钟更新一次。
- Railway 默认文件系统不保证长期持久化。如果要长期保存历史快照，后续建议接 Postgres 或对象存储。

