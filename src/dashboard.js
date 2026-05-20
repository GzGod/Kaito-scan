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

function renderRows(items, label, value, limit = 50) {
  return items.slice(0, limit).map((item, index) => `
    <tr><td>${index + 1}</td><td>${esc(label(item))}</td><td>${esc(value(item))}</td></tr>`).join('');
}

function renderDashboard(store) {
  const snapshots = store.snapshots || {};
  const pre = normalizeItems(snapshots['pre-tge:24h:heatmap']?.data);
  const preDelta = normalizeItems(snapshots['pre-tge:24h:topDelta']?.data);
  const info = normalizeItems(snapshots['infomarkets:24h:heatmap']?.data);
  const exchange = normalizeItems(snapshots['exchange:24h:heatmap']?.data);
  const kols = normalizeItems(snapshots['infomarkets:7d:kols']?.data);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kaito Scan</title><style>
:root{color-scheme:dark;--bg:#0b0d10;--panel:#12161b;--panel2:#171c22;--text:#e8edf2;--muted:#9aa6b2;--line:#28303a;--accent:#5fd0ff}*{box-sizing:border-box}body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:var(--bg);color:var(--text);line-height:1.45}.wrap{width:min(1440px,calc(100vw - 32px));margin:24px auto 48px}h1{margin:0 0 8px;font-size:28px}.meta{color:var(--muted);margin-bottom:20px;font-size:14px}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:24px}.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 16px}.card .k{color:var(--muted);font-size:13px;margin-bottom:6px}.card .v{font-size:24px;font-weight:700}.section{margin-top:24px;background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden}.section h2{margin:0;padding:14px 16px;font-size:18px;background:var(--panel2);border-bottom:1px solid var(--line)}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;min-width:520px}th,td{padding:10px 12px;border-bottom:1px solid var(--line);text-align:left;font-size:14px}th{color:var(--muted);font-weight:600;background:var(--panel2)}tr:hover td{background:rgba(95,208,255,.04)}a{color:var(--accent)}</style></head>
<body><div class="wrap"><h1>Kaito Scan</h1><div class="meta">Updated at ${esc(store.updatedAt || 'not updated yet')} | Next updates run every hour at :05</div>
<div class="stats"><div class="card"><div class="k">pre-tge 24h</div><div class="v">${pre.length}</div></div><div class="card"><div class="k">pre-tge topDelta</div><div class="v">${preDelta.length}</div></div><div class="card"><div class="k">infomarkets 24h</div><div class="v">${info.length}</div></div><div class="card"><div class="k">exchange 24h</div><div class="v">${exchange.length}</div></div><div class="card"><div class="k">infomarkets KOL 7d</div><div class="v">${kols.length}</div></div></div>
${section('pre-tge 24h Top ' + Math.min(50, pre.length), 'Ticker', 'Mindshare', renderRows(pre, x => x.ticker, x => pct(x.mindshare || x.last_24h_mindshare)))}
${section('pre-tge 24h Movers Top ' + Math.min(50, preDelta.length), 'Ticker', 'Change', renderRows(preDelta, x => x.ticker, x => pct(x.change_24h_ratio)))}
${section('infomarkets 24h Top ' + Math.min(50, info.length), 'Ticker', 'Mindshare', renderRows(info, x => x.ticker, x => pct(x.mindshare || x.last_24h_mindshare)))}
${section('exchange 24h Top ' + Math.min(50, exchange.length), 'Ticker', 'Mindshare', renderRows(exchange, x => x.ticker, x => pct(x.mindshare || x.last_24h_mindshare)))}
${section('infomarkets KOL 7d Top ' + Math.min(50, kols.length), 'Username', 'Mindshare', renderRows(kols, x => '@' + x.username, x => pct(x.mindshare)))}
</div></body></html>`;
}

function section(title, labelHeader, valueHeader, rows) {
  return `<div class="section"><h2>${esc(title)}</h2><div class="table-wrap"><table><thead><tr><th>#</th><th>${esc(labelHeader)}</th><th>${esc(valueHeader)}</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

module.exports = { renderDashboard };
