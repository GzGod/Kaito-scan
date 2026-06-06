function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  sendJsonBody(res, status, body);
}

function sendJsonBody(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=30',
    'access-control-allow-origin': '*',
    ...extraHeaders,
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

function getSnapshotItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.result)) return data.result;
  return null;
}

function filterSnapshot(snapshot, limit) {
  if (!snapshot) return null;
  const items = getSnapshotItems(snapshot.data);
  if (!items || !limit) return snapshot;
  return { ...snapshot, count: Math.min(items.length, limit), data: items.slice(0, limit) };
}

function getRequestedDuration(url, fallback, supportedDurations) {
  const duration = url.searchParams.get('duration') || fallback;
  return supportedDurations.includes(duration) ? duration : null;
}

module.exports = {
  filterSnapshot,
  getRequestedDuration,
  getSnapshotItems,
  sendHtml,
  sendJson,
  sendJsonBody,
};
