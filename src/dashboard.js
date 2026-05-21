const DURATIONS = ['24h', '7d', '30d', '3m', '6m', '12m'];
const KOL_DURATIONS = ['7d', '30d', '3m', '6m', '12m'];

const DATASETS = [
  { source: 'pre-tge', dataset: 'heatmap', title: 'pre-tge', label: 'Ticker', value: 'Mindshare' },
  { source: 'pre-tge', dataset: 'topDelta', title: 'pre-tge Movers', label: 'Ticker', value: 'Change' },
  { source: 'infomarkets', dataset: 'heatmap', title: 'infomarkets', label: 'Ticker', value: 'Mindshare' },
  { source: 'exchange', dataset: 'heatmap', title: 'exchange', label: 'Ticker', value: 'Mindshare' },
  { source: 'infomarkets', dataset: 'kols', title: 'infomarkets KOL', label: 'Username', value: 'Mindshare', durations: KOL_DURATIONS },
];

function pct(v) {
  return `${(Number(v || 0) * 100).toFixed(2)}%`;
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
}

function firstNumber(item, fields) {
  for (const field of fields) {
    const value = Number(item?.[field]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function itemLabel(item, dataset) {
  if (dataset === 'kols') return item?.username ? `@${item.username}` : item?.name || item?.id || '';
  return item?.ticker || item?.symbol || item?.name || '';
}

function itemValue(item, dataset, duration) {
  if (dataset === 'topDelta') {
    return pct(firstNumber(item, [`change_${duration}_ratio`, 'change_24h_ratio', 'mindshare_delta', 'delta', 'change']));
  }
  return pct(firstNumber(item, ['mindshare', `last_${duration}_mindshare`, 'last_24h_mindshare', 'score']));
}

function rows(items, dataset, duration, limit = 50) {
  return items.slice(0, limit).map((item, index) => `
    <tr><td>${index + 1}</td><td>${esc(itemLabel(item, dataset))}</td><td>${esc(itemValue(item, dataset, duration))}</td></tr>`).join('');
}

function snapshotItems(snapshots, source, duration, dataset) {
  return normalizeItems(snapshots[`${source}:${duration}:${dataset}`]?.data);
}

function summaryCards(snapshots) {
  return DATASETS.flatMap((entry) => (entry.durations || DURATIONS).map((duration) => {
    const count = snapshotItems(snapshots, entry.source, duration, entry.dataset).length;
    return `<div class="card"><div class="k">${esc(entry.title)} ${esc(duration)}</div><div class="v">${count}</div></div>`;
  })).join('');
}

function sections(snapshots) {
  return DATASETS.flatMap((entry) => (entry.durations || DURATIONS).map((duration) => {
    const items = snapshotItems(snapshots, entry.source, duration, entry.dataset);
    return section(
      `${entry.title} ${duration} Top ${Math.min(50, items.length)}`,
      entry.label,
      entry.value,
      rows(items, entry.dataset, duration)
    );
  })).join('');
}

function renderDashboard(store) {
  const snapshots = store.snapshots || {};
  const totalSnapshots = Object.keys(snapshots).length;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kaito Scan</title><style>
:root{color-scheme:dark;--bg:#0b0d10;--panel:#12161b;--panel2:#171c22;--text:#e8edf2;--muted:#9aa6b2;--line:#28303a;--accent:#5fd0ff}*{box-sizing:border-box}body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:var(--bg);color:var(--text);line-height:1.45}.wrap{width:min(1440px,calc(100vw - 32px));margin:24px auto 48px}h1{margin:0 0 8px;font-size:28px}.meta{color:var(--muted);margin-bottom:20px;font-size:14px}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:24px}.card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:12px 14px}.card .k{color:var(--muted);font-size:13px;margin-bottom:6px}.card .v{font-size:24px;font-weight:700}.section{margin-top:20px;background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden}.section h2{margin:0;padding:12px 14px;font-size:17px;background:var(--panel2);border-bottom:1px solid var(--line)}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;min-width:520px}th,td{padding:9px 12px;border-bottom:1px solid var(--line);text-align:left;font-size:14px}th{color:var(--muted);font-weight:600;background:var(--panel2)}tr:hover td{background:rgba(95,208,255,.04)}a{color:var(--accent)}</style></head>
<body><div class="wrap"><h1>Kaito Scan</h1><div class="meta">Updated at ${esc(store.updatedAt || 'not updated yet')} | ${totalSnapshots} snapshots | Updates run every hour at :05</div>
<div class="stats">${summaryCards(snapshots)}</div>
${sections(snapshots)}
</div></body></html>`;
}

function section(title, labelHeader, valueHeader, bodyRows) {
  return `<div class="section"><h2>${esc(title)}</h2><div class="table-wrap"><table><thead><tr><th>#</th><th>${esc(labelHeader)}</th><th>${esc(valueHeader)}</th></tr></thead><tbody>${bodyRows}</tbody></table></div></div>`;
}

module.exports = { renderDashboard };

