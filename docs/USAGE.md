# Kaito Scan ʹ���ĵ�

Kaito Scan ��һ�����������ݷ������������û����� API ʱʵʱ���� Kaito�������ɷ����Լ����ƻ�ץȡ���ݲ�������գ�API ֻ�������һ�ο��ա�

## ���²���

������������ȳ���ץȡһ�����ݡ�����������п��գ���ֱ�Ӷ�ȡ���п��ա�

֮��ᰴ��ʵʱ��ÿСʱ�� 05 �����Զ�����һ�Σ����磺

```text
00:05
01:05
02:05
08:05
09:05
10:05
```

������Ĭ���� 5������ͨ�������������ã�

```text
SCRAPE_CONCURRENCY=5
```

## ��ǰ�ɼ�������

��ǰ����ɼ����� 5 �����ݣ�

```text
pre-tge:24h:heatmap
pre-tge:24h:topDelta
infomarkets:24h:heatmap
exchange:24h:heatmap
infomarkets:7d:kols
```

��δ��ͨ��

```text
ct-leaderboard
vcarena
```

## ҳ��

��ҳ��һ�� HTML ���壺

```text
GET /
```

չʾ��

- pre-tge 24h Top 50
- pre-tge 24h Movers
- infomarkets 24h Top 50
- exchange 24h Top 50
- infomarkets KOL 7d Top 50

## API

### ״̬

```text
GET /api/status
```

���ط���״̬��������ʱ�䡢��һ�θ���ʱ�䡢���� snapshot key��

ʾ����

```bash
curl https://kaito-scan-production.up.railway.app/api/status \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### ȫ������

```text
GET /api/live
```

���ص�ǰ�ڴ��е�ȫ�����ա�

```bash
curl https://kaito-scan-production.up.railway.app/api/live \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### pre-tge 24h heatmap

```text
GET /api/pre-tge?limit=50
```

```bash
curl "https://kaito-scan-production.up.railway.app/api/pre-tge?limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### pre-tge 24h topDelta

```text
GET /api/pre-tge/top-delta?limit=50
```

```bash
curl "https://kaito-scan-production.up.railway.app/api/pre-tge/top-delta?limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### infomarkets 24h heatmap

```text
GET /api/infomarkets?limit=50
```

```bash
curl "https://kaito-scan-production.up.railway.app/api/infomarkets?limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### infomarkets KOL 7d

```text
GET /api/infomarkets/kols?limit=50
```

```bash
curl "https://kaito-scan-production.up.railway.app/api/infomarkets/kols?limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### exchange 24h heatmap

```text
GET /api/exchange?limit=50
```

```bash
curl "https://kaito-scan-production.up.railway.app/api/exchange?limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### �� key ��ȡ�������

```text
GET /api/snapshot/:key?limit=50
```

ע�� key ����ð�ţ�URL �п���ֱ��ʹ�ã�Ҳ���� URL encode��

```bash
curl "https://kaito-scan-production.up.railway.app/api/snapshot/pre-tge:24h:heatmap?limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
curl "https://kaito-scan-production.up.railway.app/api/snapshot/infomarkets:7d:kols?limit=100" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## �ֶ���������

```text
POST /api/admin/update
```

��������˻������� `API_KEY`����Ҫ�� header��

```text
Authorization: Bearer YOUR_API_KEY
```

ʾ����

```bash
curl -X POST https://kaito-scan-production.up.railway.app/api/admin/update \
  -H "Authorization: Bearer YOUR_API_KEY"
```

���û������ `API_KEY`������ӿڲ���Ҫ��Ȩ����ʽ�������������� `API_KEY`��

## ���ؽṹ

�������շ��ؽṹ�������£�

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

���ʹ�� `limit`��`data` ��ֻ����ǰ N ����

## Railway ��������

�������ã�

```text
SCRAPE_CONCURRENCY=5
API_KEY=�Լ�����һ����һ�������ַ���
```

Railway ���Զ��ṩ��

```text
PORT
```

## ��������

```bash
npm install
npm start
```

Ȼ����ʣ�

```text
http://localhost:3000
http://localhost:3000/api/status
```

## ע������

- API ���ص��Ǳ����񱣴�Ŀ��գ���������ʱʵʱץȡ Kaito��
- �û����� API ���ᴥ�� Kaito ����
- ����ÿСʱ�� 05 ���Ӹ���һ�Ρ�
- Railway Ĭ���ļ�ϵͳ����֤���ڳ־û������Ҫ���ڱ�����ʷ���գ���������� Postgres �����洢��

