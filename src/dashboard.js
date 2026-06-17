const DURATIONS = ['24h', '7d', '30d', '3m', '6m', '12m'];
const KOL_DURATIONS = ['7d', '30d', '3m', '6m', '12m'];
const ARENA_VOICE_DURATIONS = ['7d', '30d', '3m', '6m', '12m'];
const ARENA_COMPANY_DURATIONS = DURATIONS;
const ARENA_VERTICALS = ['stock', 'ai', 'crypto'];

const CLASSIC_DATASETS = [
  { source: 'pre-tge', dataset: 'heatmap', title: 'Pre-TGE', label: 'Project', value: 'Mindshare' },
  { source: 'pre-tge', dataset: 'topDelta', title: 'Pre-TGE Movers', label: 'Project', value: 'Change' },
  { source: 'infomarkets', dataset: 'heatmap', title: 'Info Markets', label: 'Ticker', value: 'Mindshare' },
  { source: 'exchange', dataset: 'heatmap', title: 'Exchange', label: 'Ticker', value: 'Mindshare' },
  { source: 'infomarkets', dataset: 'kols', title: 'Info KOL', label: 'Username', value: 'Mindshare', durations: KOL_DURATIONS },
];

function pct(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '0.00%';
  return `${(number * 100).toFixed(2)}%`;
}

function signedPct(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '0.00%';
  const sign = number > 0 ? '+' : '';
  return `${sign}${(number * 100).toFixed(2)}%`;
}

function esc(value) {
  return String(value ?? '')
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

function snapshotItems(snapshots, source, duration, dataset) {
  return normalizeItems(snapshots[`${source}:${duration}:${dataset}`]?.data);
}

function itemName(item, dataset) {
  if (dataset === 'kols' || item?.username) return item?.username ? `@${item.username}` : item?.name || item?.id || '';
  return item?.ticker || item?.symbol || item?.name || item?.company_id || '';
}

function itemSubline(item) {
  const parts = [
    item?.fullname,
    item?.company_id && item?.name !== item.company_id ? item.company_id : '',
    item?.sector,
  ].filter(Boolean);
  return parts.slice(0, 2).join(' - ');
}

function itemMindshare(item, dataset, duration) {
  if (dataset === 'topDelta') {
    return firstNumber(item, [`change_${duration}_ratio`, 'change_24h_ratio', 'mindshare_delta', 'delta', 'change']);
  }
  return firstNumber(item, ['mindshare', `last_${duration}_mindshare`, 'last_24h_mindshare', 'score']);
}

function itemDelta(item, duration) {
  return firstNumber(item, [
    'mindshare_delta',
    `change_${duration}`,
    `change_${duration}_ratio`,
    'change_24h',
    'change_24h_ratio',
    'delta',
    'change',
  ]);
}

function tableRows(items, { dataset, duration, nameHeader = 'Name', valueHeader = 'Mindshare', limit = 50 } = {}) {
  const rows = items.slice(0, limit).map((item, index) => {
    const value = itemMindshare(item, dataset, duration);
    const delta = itemDelta(item, duration);
    const deltaClass = delta > 0 ? 'pos' : delta < 0 ? 'neg' : 'flat';
    const rank = item?.rank || index + 1;
    const subline = itemSubline(item);
    return `<tr>
      <td class="rank">${esc(rank)}</td>
      <td><div class="name">${esc(itemName(item, dataset))}</div>${subline ? `<div class="sub">${esc(subline)}</div>` : ''}</td>
      <td class="num">${dataset === 'topDelta' ? signedPct(value) : pct(value)}</td>
      <td class="num ${deltaClass}">${signedPct(delta)}</td>
    </tr>`;
  }).join('');
  return `<table>
    <thead><tr><th>#</th><th>${esc(nameHeader)}</th><th>${esc(valueHeader)}</th><th>Delta</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4" class="empty">No cached data yet</td></tr>'}</tbody>
  </table>`;
}

function arenaPayload(snapshots) {
  const payload = {};
  for (const mode of ['voices', 'companies']) {
    payload[mode] = {};
    const durations = mode === 'voices' ? ARENA_VOICE_DURATIONS : ARENA_COMPANY_DURATIONS;
    for (const vertical of ARENA_VERTICALS) {
      payload[mode][vertical] = {};
      for (const duration of durations) {
        const source = `arena-${mode}-${vertical}`;
        payload[mode][vertical][duration] = snapshotItems(snapshots, source, duration, 'leaderboard').slice(0, 100).map((item, index) => ({
          rank: item?.rank || index + 1,
          name: itemName(item, 'leaderboard'),
          subline: itemSubline(item),
          mindshare: itemMindshare(item, 'leaderboard', duration),
          delta: itemDelta(item, duration),
        }));
      }
    }
  }
  return payload;
}

function summaryCards(snapshots) {
  const arenaCount = Object.keys(snapshots).filter((key) => key.startsWith('arena-')).length;
  const cards = [
    { label: 'Total Snapshots', value: Object.keys(snapshots).length },
    { label: 'Arena Snapshots', value: arenaCount },
    { label: 'Classic Snapshots', value: Object.keys(snapshots).length - arenaCount },
    { label: 'Update Minute', value: ':05' },
  ];
  return cards.map((card) => `<div class="metric"><div class="metric-label">${esc(card.label)}</div><div class="metric-value">${esc(card.value)}</div></div>`).join('');
}

function arenaCounts(snapshots) {
  return ['voices', 'companies'].map((mode) => {
    const durations = mode === 'voices' ? ARENA_VOICE_DURATIONS : ARENA_COMPANY_DURATIONS;
    const cells = ARENA_VERTICALS.map((vertical) => {
      const total = durations.reduce((sum, duration) => (
        sum + snapshotItems(snapshots, `arena-${mode}-${vertical}`, duration, 'leaderboard').length
      ), 0);
      return `<div class="count-cell"><span>${esc(vertical.toUpperCase())}</span><strong>${esc(total)}</strong></div>`;
    }).join('');
    return `<div class="count-block"><div class="count-title">Top ${esc(mode === 'voices' ? 'Voices' : 'Companies')}</div><div class="count-grid">${cells}</div></div>`;
  }).join('');
}

function classicSections(snapshots) {
  return CLASSIC_DATASETS.map((entry) => {
    const duration = entry.defaultDuration || (entry.durations || DURATIONS)[0];
    const items = snapshotItems(snapshots, entry.source, duration, entry.dataset);
    return `<section class="panel classic-card">
      <div class="panel-head">
        <div><p class="eyebrow">Classic</p><h3>${esc(entry.title)}</h3></div>
        <span class="pill">${esc(duration)}</span>
      </div>
      <div class="table-wrap">${tableRows(items, {
        dataset: entry.dataset,
        duration,
        nameHeader: entry.label,
        valueHeader: entry.value,
        limit: 12,
      })}</div>
    </section>`;
  }).join('');
}

function renderDashboard(store) {
  const snapshots = store.snapshots || {};
  const arenaData = arenaPayload(snapshots);
  const arenaJson = JSON.stringify(arenaData).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Kaito Scan</title>
  <style>
    :root{color-scheme:dark;--bg:#08090b;--panel:#111418;--panel2:#171b20;--text:#eef2f6;--muted:#8e9aa7;--line:#252b33;--accent:#42c7b7;--accent2:#d7b56d;--bad:#ff6d6d;--good:#45d483}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.45}
    .wrap{width:min(1480px,calc(100vw - 32px));margin:22px auto 48px}.topbar{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:18px}
    h1{margin:0;font-size:30px;letter-spacing:0}.meta{color:var(--muted);font-size:13px;margin-top:6px}.actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
    .link-btn,.seg button{height:34px;border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:7px;padding:0 12px;font-size:13px;text-decoration:none;cursor:pointer}.link-btn:hover,.seg button:hover{border-color:#3a4654}
    .metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:16px}.metric{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:12px 14px}.metric-label{font-size:12px;color:var(--muted);text-transform:uppercase}.metric-value{font-size:25px;font-weight:750;margin-top:4px}
    .layout{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(320px,.85fr);gap:16px}.panel{background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden}.panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line);background:var(--panel2)}.panel-head h2,.panel-head h3{margin:0;font-size:18px}.eyebrow{margin:0 0 4px;color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.08em}.pill{display:inline-flex;align-items:center;height:28px;border:1px solid var(--line);border-radius:999px;padding:0 10px;color:var(--muted);font-size:12px;white-space:nowrap}
    .controls{padding:12px 16px;border-bottom:1px solid var(--line);display:grid;gap:10px;background:#0d1013}.control-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.control-label{width:72px;color:var(--muted);font-size:12px;text-transform:uppercase}.seg{display:flex;gap:6px;flex-wrap:wrap}.seg button.active{background:var(--accent);border-color:var(--accent);color:#04110f;font-weight:750}.seg button:disabled{opacity:.35;cursor:not-allowed}
    .arena-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:12px 16px;border-bottom:1px solid var(--line)}.count-block{border:1px solid var(--line);border-radius:8px;padding:10px;background:#0d1013}.count-title{font-size:13px;color:var(--muted);margin-bottom:8px}.count-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.count-cell{border:1px solid #20262d;border-radius:7px;padding:8px}.count-cell span{display:block;color:var(--muted);font-size:11px}.count-cell strong{display:block;margin-top:3px;font-size:18px}
    .table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;min-width:620px}th,td{padding:10px 12px;border-bottom:1px solid var(--line);text-align:left;font-size:13px;vertical-align:middle}th{color:var(--muted);font-weight:650;background:#101419;position:sticky;top:0;z-index:1}.rank{width:54px;color:var(--muted)}.name{font-weight:700}.sub{margin-top:2px;color:var(--muted);font-size:12px}.num{text-align:right;font-variant-numeric:tabular-nums}.pos{color:var(--good)}.neg{color:var(--bad)}.flat{color:var(--muted)}tr:hover td{background:rgba(66,199,183,.045)}.empty{text-align:center;color:var(--muted);padding:24px}
    .side{display:grid;gap:16px}.classic-grid{display:grid;gap:12px}.classic-card table{min-width:520px}.classic-card .panel-head{padding:12px 14px}.classic-card .panel-head h3{font-size:16px}.classic-card th,.classic-card td{padding:8px 10px}
    .api-list{padding:14px 16px;display:grid;gap:10px}.api-line{display:flex;justify-content:space-between;gap:12px;border:1px solid var(--line);border-radius:7px;padding:9px 10px;background:#0d1013}.api-line code{color:var(--accent);font-size:12px;white-space:nowrap}.api-line span{color:var(--muted);font-size:12px;text-align:right}
    @media (max-width:980px){.topbar{display:block}.actions{justify-content:flex-start;margin-top:12px}.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.layout{grid-template-columns:1fr}.arena-summary{grid-template-columns:1fr}.control-label{width:100%;}.control-row{display:block}.seg{margin-top:6px}}
    @media (max-width:560px){.wrap{width:min(100vw - 20px,1480px);margin-top:14px}.metrics{grid-template-columns:1fr}.metric-value{font-size:22px}h1{font-size:25px}.panel-head{align-items:flex-start}.api-line{display:block}.api-line span{display:block;text-align:left;margin-top:5px}}
  </style>
</head>
<body>
  <div class="wrap">
    <header class="topbar">
      <div>
        <h1>Kaito Scan</h1>
        <div class="meta">Updated at ${esc(store.updatedAt || 'not updated yet')} - cached API data - hourly at :05</div>
      </div>
      <div class="actions">
        <a class="link-btn" href="/api/status">Status</a>
        <a class="link-btn" href="/api/live/index">Catalog</a>
      </div>
    </header>

    <div class="metrics">${summaryCards(snapshots)}</div>

    <main class="layout">
      <section class="panel">
        <div class="panel-head">
          <div><p class="eyebrow">Arena</p><h2 id="arena-title">Top Voices · Stock · 7d</h2></div>
          <span class="pill" id="arena-count">0 items</span>
        </div>
        <div class="controls">
          <div class="control-row"><div class="control-label">Type</div><div class="seg" data-control="mode">
            <button type="button" data-value="voices" class="active">Top Voices</button>
            <button type="button" data-value="companies">Top Companies</button>
          </div></div>
          <div class="control-row"><div class="control-label">Market</div><div class="seg" data-control="vertical">
            <button type="button" data-value="stock" class="active">Stock</button>
            <button type="button" data-value="ai">AI</button>
            <button type="button" data-value="crypto">Crypto</button>
          </div></div>
          <div class="control-row"><div class="control-label">Duration</div><div class="seg" data-control="duration">
            ${DURATIONS.map((duration) => `<button type="button" data-value="${esc(duration)}">${esc(duration)}</button>`).join('')}
          </div></div>
        </div>
        <div class="arena-summary">${arenaCounts(snapshots)}</div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Name</th><th>Mindshare</th><th>Delta</th></tr></thead>
            <tbody id="arena-body"></tbody>
          </table>
        </div>
      </section>

      <aside class="side">
        <section class="panel">
          <div class="panel-head"><div><p class="eyebrow">External API</p><h3>Live Endpoints</h3></div><span class="pill">Bearer key</span></div>
          <div class="api-list">
            <div class="api-line"><code>/api/arena/voices</code><span>vertical + duration</span></div>
            <div class="api-line"><code>/api/arena/companies</code><span>vertical + duration</span></div>
            <div class="api-line"><code>/api/history/query</code><span>hour/day history</span></div>
            <div class="api-line"><code>/api/snapshot/:key</code><span>raw cached snapshot</span></div>
          </div>
        </section>
        <div class="classic-grid">${classicSections(snapshots)}</div>
      </aside>
    </main>
  </div>
  <script>
    const ARENA_DATA = ${arenaJson};
    const DURATIONS = ${JSON.stringify(DURATIONS)};
    const VOICE_DURATIONS = ${JSON.stringify(ARENA_VOICE_DURATIONS)};
    const COMPANY_DURATIONS = ${JSON.stringify(ARENA_COMPANY_DURATIONS)};
    const state = { mode: 'voices', vertical: 'stock', duration: '7d' };
    const labels = { voices: 'Top Voices', companies: 'Top Companies', stock: 'Stock', ai: 'AI', crypto: 'Crypto' };
    const fmtPct = (value, signed = false) => {
      const number = Number(value || 0);
      const sign = signed && number > 0 ? '+' : '';
      return sign + (number * 100).toFixed(2) + '%';
    };
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    function setActive(control, value) {
      document.querySelectorAll('[data-control="' + control + '"] button').forEach((button) => {
        button.classList.toggle('active', button.dataset.value === value);
      });
    }
    function renderArena() {
      const allowed = state.mode === 'voices' ? VOICE_DURATIONS : COMPANY_DURATIONS;
      if (!allowed.includes(state.duration)) state.duration = allowed[0];
      document.querySelectorAll('[data-control="duration"] button').forEach((button) => {
        const enabled = allowed.includes(button.dataset.value);
        button.disabled = !enabled;
        button.classList.toggle('active', button.dataset.value === state.duration);
      });
      setActive('mode', state.mode);
      setActive('vertical', state.vertical);
      const items = (((ARENA_DATA[state.mode] || {})[state.vertical] || {})[state.duration] || []);
      document.getElementById('arena-title').textContent = labels[state.mode] + ' - ' + labels[state.vertical] + ' - ' + state.duration;
      document.getElementById('arena-count').textContent = items.length + ' items';
      document.getElementById('arena-body').innerHTML = items.slice(0, 50).map((item) => {
        const deltaClass = item.delta > 0 ? 'pos' : item.delta < 0 ? 'neg' : 'flat';
        const subline = item.subline ? '<div class="sub">' + escapeHtml(item.subline) + '</div>' : '';
        return '<tr><td class="rank">' + escapeHtml(item.rank) + '</td><td><div class="name">' + escapeHtml(item.name) + '</div>' + subline + '</td><td class="num">' + fmtPct(item.mindshare) + '</td><td class="num ' + deltaClass + '">' + fmtPct(item.delta, true) + '</td></tr>';
      }).join('') || '<tr><td colspan="4" class="empty">No cached data yet</td></tr>';
    }
    document.querySelectorAll('[data-control] button').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.disabled) return;
        state[button.parentElement.dataset.control] = button.dataset.value;
        renderArena();
      });
    });
    renderArena();
  </script>
</body>
</html>`;
}

module.exports = { renderDashboard };
