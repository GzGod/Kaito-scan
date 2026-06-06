const crypto = require('crypto');
const zlib = require('zlib');

const cachedResponses = new Map();
const MAX_CACHED_RESPONSES = 256;

function createJsonCacheEntry(data) {
  const body = JSON.stringify(data);
  const buffer = Buffer.from(body);
  const etag = `"${crypto.createHash('sha1').update(body).digest('hex')}"`;
  return {
    body,
    buffer,
    gzip: zlib.gzipSync(buffer, { level: 6 }),
    br: zlib.brotliCompressSync(buffer, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 5,
      },
    }),
    byteLength: buffer.length,
    etag,
  };
}

function setCachedJson(key, data) {
  if (cachedResponses.size >= MAX_CACHED_RESPONSES && !cachedResponses.has(key)) {
    const oldestKey = cachedResponses.keys().next().value;
    cachedResponses.delete(oldestKey);
  }
  cachedResponses.set(key, createJsonCacheEntry(data));
}

function getCachedJson(key) {
  return cachedResponses.get(key) || null;
}

function rebuildResponseCache(store) {
  cachedResponses.clear();
  setCachedJson('live', store);
  setCachedJson('snapshots', { snapshots: Object.values(store.snapshots || {}) });
  setCachedJson('catalog', buildCatalog(store));

  for (const [key, snapshot] of Object.entries(store.snapshots || {})) {
    setCachedJson(`snapshot:${key}`, snapshot);
  }
}

function buildCatalog(store) {
  const snapshots = Object.values(store.snapshots || {}).map((snapshot) => ({
    key: snapshot.key,
    source: snapshot.source,
    dataset: snapshot.dataset,
    duration: snapshot.duration,
    route: snapshot.route,
    count: snapshot.count,
    updatedAt: snapshot.updatedAt,
  }));
  return {
    updatedAt: store.updatedAt,
    lastRun: store.lastRun,
    lastError: store.lastError,
    snapshots,
  };
}

module.exports = {
  getCachedJson,
  rebuildResponseCache,
  setCachedJson,
};
