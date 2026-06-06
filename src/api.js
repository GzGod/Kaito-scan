const { renderDashboard } = require('./dashboard');
const { getNextFiveMinute, runUpdate } = require('./worker');
const { getDatabaseStatus, getSnapshot, getStore, listSnapshots } = require('./store');
const { getHistoricalSnapshot, getRunSnapshots, listRuns, listSnapshotHistory } = require('./db');
const { DATASET_ROUTES, SUPPORTED_DURATIONS } = require('./routes');
const { getCachedJson, setCachedJson } = require('./response-cache');
const { filterSnapshot, getRequestedDuration, sendHtml, sendJson, sendJsonBody } = require('./http-utils');

function sendCachedJson(req, res, cacheKey) {
  const cached = getCachedJson(cacheKey);
  if (!cached) return false;
  if (req.headers['if-none-match'] === cached.etag) {
    res.writeHead(304, {
      etag: cached.etag,
      'cache-control': 'public, max-age=30',
      'access-control-allow-origin': '*',
    });
    res.end();
    return true;
  }
  const acceptEncoding = String(req.headers['accept-encoding'] || '');
  if (acceptEncoding.includes('br')) {
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=30',
      'access-control-allow-origin': '*',
      'content-encoding': 'br',
      'content-length': cached.br.length,
      etag: cached.etag,
      vary: 'Accept-Encoding',
    });
    res.end(cached.br);
    return true;
  }
  const acceptsGzip = acceptEncoding.includes('gzip');
  if (acceptsGzip) {
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=30',
      'access-control-allow-origin': '*',
      'content-encoding': 'gzip',
      'content-length': cached.gzip.length,
      etag: cached.etag,
      vary: 'Accept-Encoding',
    });
    res.end(cached.gzip);
    return true;
  }
  sendJsonBody(res, 200, cached.buffer, {
    etag: cached.etag,
    'content-length': cached.byteLength,
    vary: 'Accept-Encoding',
  });
  return true;
}

function isAuthorized(req, apiKey) {
  if (!apiKey) return true;
  const authorization = req.headers.authorization || '';
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
  return bearer === apiKey;
}

async function sendStatus(res) {
  const store = getStore();
  const database = await getDatabaseStatus();
  return sendJson(res, 200, {
    updatedAt: store.updatedAt,
    nextUpdateAt: getNextFiveMinute().toISOString(),
    lastRun: store.lastRun,
    lastError: store.lastError,
    database,
    keys: Object.keys(store.snapshots || {}),
  });
}

function getRequestCacheKey(url) {
  return `request:${url.pathname}?${url.searchParams.toString()}`;
}

async function sendDatasetSnapshot(req, url, res, route) {
  const requestCacheKey = getRequestCacheKey(url);
  if (sendCachedJson(req, res, requestCacheKey)) return;

  const duration = getRequestedDuration(url, route.defaultDuration, route.durations || SUPPORTED_DURATIONS);
  if (!duration) {
    return sendJson(res, 400, {
      error: 'unsupported duration',
      supportedDurations: route.durations || SUPPORTED_DURATIONS,
    });
  }

  const limit = Number(url.searchParams.get('limit') || 0);
  const key = `${route.source}:${duration}:${route.dataset}`;
  if (!limit && sendCachedJson(req, res, `snapshot:${key}`)) return;
  const snapshot = filterSnapshot(getSnapshot(key), limit);
  if (!snapshot) return sendJson(res, 404, { error: 'snapshot not found', key });
  setCachedJson(requestCacheKey, snapshot);
  if (sendCachedJson(req, res, requestCacheKey)) return;
  return sendJson(res, 200, snapshot);
}

async function handleHistoryRoute(url, res) {
  if (url.pathname === '/api/history/runs') {
    const limit = Number(url.searchParams.get('limit') || 24);
    sendJson(res, 200, { runs: await listRuns(limit) });
    return true;
  }

  if (url.pathname.startsWith('/api/history/run/')) {
    const runId = Number(decodeURIComponent(url.pathname.replace('/api/history/run/', '')));
    if (!Number.isFinite(runId)) {
      sendJson(res, 400, { error: 'invalid run id' });
      return true;
    }
    sendJson(res, 200, { runId, snapshots: await getRunSnapshots(runId) });
    return true;
  }

  if (url.pathname.startsWith('/api/history/snapshot/')) {
    const key = decodeURIComponent(url.pathname.replace('/api/history/snapshot/', ''));
    const limit = Number(url.searchParams.get('limit') || 24);
    sendJson(res, 200, { key, history: await listSnapshotHistory(key, limit) });
    return true;
  }

  if (url.pathname.startsWith('/api/history/item/')) {
    const id = Number(decodeURIComponent(url.pathname.replace('/api/history/item/', '')));
    if (!Number.isFinite(id)) {
      sendJson(res, 400, { error: 'invalid snapshot history id' });
      return true;
    }
    const limit = Number(url.searchParams.get('limit') || 0);
    const snapshot = await getHistoricalSnapshot(id, limit);
    if (!snapshot) {
      sendJson(res, 404, { error: 'historical snapshot not found', id });
      return true;
    }
    sendJson(res, 200, snapshot);
    return true;
  }

  return false;
}

function createRequestHandler({ apiKey }) {
  return async function handle(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === '/') return sendHtml(res, renderDashboard(getStore()));

    if (url.pathname.startsWith('/api/') && !isAuthorized(req, apiKey)) {
      return sendJson(res, 401, { error: 'unauthorized' });
    }

    if (url.pathname === '/api/status') return sendStatus(res);
    if (url.pathname === '/api/catalog' || url.pathname === '/api/live/index') {
      if (sendCachedJson(req, res, 'catalog')) return;
      return sendJson(res, 200, { updatedAt: getStore().updatedAt, snapshots: listSnapshots().map(({ data, params, ...snapshot }) => snapshot) });
    }
    if (url.pathname === '/api/live') {
      if (!url.searchParams.toString() && sendCachedJson(req, res, 'live')) return;
      return sendJson(res, 200, getStore());
    }
    if (url.pathname === '/api/snapshots') {
      if (!url.searchParams.toString() && sendCachedJson(req, res, 'snapshots')) return;
      return sendJson(res, 200, { snapshots: listSnapshots() });
    }

    if (await handleHistoryRoute(url, res)) return;

    if (url.pathname.startsWith('/api/snapshot/')) {
      const requestCacheKey = getRequestCacheKey(url);
      if (sendCachedJson(req, res, requestCacheKey)) return;
      const key = decodeURIComponent(url.pathname.replace('/api/snapshot/', ''));
      const limit = Number(url.searchParams.get('limit') || 0);
      if (!limit && sendCachedJson(req, res, `snapshot:${key}`)) return;
      const snapshot = filterSnapshot(getSnapshot(key), limit);
      if (!snapshot) return sendJson(res, 404, { error: 'snapshot not found', key });
      setCachedJson(requestCacheKey, snapshot);
      if (sendCachedJson(req, res, requestCacheKey)) return;
      return sendJson(res, 200, snapshot);
    }

    if (DATASET_ROUTES[url.pathname]) return sendDatasetSnapshot(req, url, res, DATASET_ROUTES[url.pathname]);

    if (url.pathname === '/api/admin/update' && req.method === 'POST') {
      const result = await runUpdate('manual-api');
      return sendJson(res, result.ok ? 200 : 500, result);
    }

    return sendJson(res, 404, { error: 'not found' });
  };
}

module.exports = {
  createRequestHandler,
  isAuthorized,
};
