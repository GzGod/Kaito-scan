const http = require('http');
const { renderDashboard } = require('./dashboard');
const { getNextFiveMinute, runUpdate, scheduleHourlyAtFive } = require('./worker');
const { getSnapshot, getStore, listSnapshots, loadStore } = require('./store');

const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.API_KEY || '';
const SUPPORTED_DURATIONS = ['24h', '7d', '30d', '3m', '6m', '12m'];
const KOL_DURATIONS = ['7d', '30d', '3m', '6m', '12m'];

const DATASET_ROUTES = {
  '/api/pre-tge': { source: 'pre-tge', dataset: 'heatmap', defaultDuration: '24h' },
  '/api/pre-tge/top-delta': { source: 'pre-tge', dataset: 'topDelta', defaultDuration: '24h' },
  '/api/infomarkets': { source: 'infomarkets', dataset: 'heatmap', defaultDuration: '24h' },
  '/api/infomarkets/kols': { source: 'infomarkets', dataset: 'kols', defaultDuration: '7d', durations: KOL_DURATIONS },
  '/api/exchange': { source: 'exchange', dataset: 'heatmap', defaultDuration: '24h' },
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=30',
    'access-control-allow-origin': '*',
  });
  res.end(body);
}

function sendHtml(res, html) {
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'public, max-age=30',
  });
  res.end(html);
}

function isAuthorized(req) {
  if (!API_KEY) return true;
  const authorization = req.headers.authorization || '';
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
  return bearer === API_KEY;
}

function filterSnapshot(snapshot, limit) {
  if (!snapshot) return null;
  const data = snapshot.data;
  const items = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : Array.isArray(data?.items) ? data.items : Array.isArray(data?.result) ? data.result : null;
  if (!items || !limit) return snapshot;
  return { ...snapshot, count: Math.min(items.length, limit), data: items.slice(0, limit) };
}

function getRequestedDuration(url, fallback, supportedDurations = SUPPORTED_DURATIONS) {
  const duration = url.searchParams.get('duration') || fallback;
  return supportedDurations.includes(duration) ? duration : null;
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/') return sendHtml(res, renderDashboard(getStore()));

  if (url.pathname.startsWith('/api/') && !isAuthorized(req)) {
    return sendJson(res, 401, { error: 'unauthorized' });
  }

  if (url.pathname === '/api/status') {
    const store = getStore();
    return sendJson(res, 200, {
      updatedAt: store.updatedAt,
      nextUpdateAt: getNextFiveMinute().toISOString(),
      lastRun: store.lastRun,
      lastError: store.lastError,
      keys: Object.keys(store.snapshots || {}),
    });
  }

  if (url.pathname === '/api/live') return sendJson(res, 200, getStore());

  if (url.pathname === '/api/snapshots') return sendJson(res, 200, { snapshots: listSnapshots() });

  if (url.pathname.startsWith('/api/snapshot/')) {
    const key = decodeURIComponent(url.pathname.replace('/api/snapshot/', ''));
    const limit = Number(url.searchParams.get('limit') || 0);
    const snapshot = filterSnapshot(getSnapshot(key), limit);
    if (!snapshot) return sendJson(res, 404, { error: 'snapshot not found', key });
    return sendJson(res, 200, snapshot);
  }

  if (DATASET_ROUTES[url.pathname]) {
    const route = DATASET_ROUTES[url.pathname];
    const duration = getRequestedDuration(url, route.defaultDuration, route.durations);
    if (!duration) {
      return sendJson(res, 400, {
        error: 'unsupported duration',
        supportedDurations: route.durations || SUPPORTED_DURATIONS,
      });
    }
    const limit = Number(url.searchParams.get('limit') || 0);
    const key = `${route.source}:${duration}:${route.dataset}`;
    const snapshot = filterSnapshot(getSnapshot(key), limit);
    if (!snapshot) return sendJson(res, 404, { error: 'snapshot not found', key });
    return sendJson(res, 200, snapshot);
  }

  if (url.pathname === '/api/admin/update' && req.method === 'POST') {
    const result = await runUpdate('manual-api');
    return sendJson(res, result.ok ? 200 : 500, result);
  }

  sendJson(res, 404, { error: 'not found' });
}

async function main() {
  console.log(`API auth enabled: ${Boolean(API_KEY)}`);
  await loadStore();
  if (!getStore().updatedAt) runUpdate('boot').catch((error) => console.error(error));
  scheduleHourlyAtFive();
  http.createServer((req, res) => {
    handle(req, res).catch((error) => {
      console.error(error);
      sendJson(res, 500, { error: error.message });
    });
  }).listen(PORT, () => console.log(`Kaito Scan listening on ${PORT}`));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

