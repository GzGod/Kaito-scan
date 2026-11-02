const DURATIONS = ['24h', '7d', '30d', '3m', '6m', '12m'];
const KOL_DURATIONS = ['7d', '30d', '3m', '6m', '12m'];
const ARENA_VOICE_DURATIONS = ['7d', '30d', '3m', '6m', '12m'];
const ARENA_COMPANY_DURATIONS = DURATIONS;
const ARENA_VERTICALS = ['stock', 'ai', 'crypto'];

const VIEWS = [
  { id: 'arena-voices',    label: 'Top Voices',     group: 'Arena', mode: 'arena',   sub: 'voices' },
  { id: 'arena-companies', label: 'Top Companies',  group: 'Arena', mode: 'arena',   sub: 'companies' },
  { id: 'pre-tge',         label: 'Pre-TGE',        group: 'Classic', dataset: 'heatmap',  source: 'pre-tge' },
  { id: 'pre-tge-delta',   label: 'Pre-TGE movers', group: 'Classic', dataset: 'topDelta', source: 'pre-tge' },
  { id: 'pre-tge-gainer',  label: 'Pre-TGE gainers',group: 'Classic', dataset: 'topGainer',source: 'pre-tge' },
  { id: 'infomarkets',     label: 'Info markets',   group: 'Classic', dataset: 'heatmap',  source: 'infomarkets' },
  { id: 'info-gainer',     label: 'Info gainers',   group: 'Classic', dataset: 'topGainer',source: 'infomarkets' },
  { id: 'exchange',        label: 'Exchange',       group: 'Classic', dataset: 'heatmap',  source: 'exchange' },
  { id: 'exchange-gainer', label: 'Exchange gainers',group:'Classic', dataset: 'topGainer',source: 'exchange' },
  { id: 'kols',            label: 'KOL leaderboard',group: 'Classic', dataset: 'kols',     source: 'infomarkets', durations: KOL_DURATIONS },
];

function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function normalizeItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
}

function firstNumber(item, fields) {
  for (const f of fields) {
    const v = Number(item?.[f]);
    if (Number.isFinite(v)) return v;
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
  const parts = [item?.fullname, item?.sector].filter(Boolean);
  return parts.slice(0, 1).join('');
}

function itemMindshare(item, dataset, duration) {
  if (dataset === 'topDelta') return firstNumber(item, [`change_${duration}_ratio`, 'change_24h_ratio', 'mindshare_delta', 'delta', 'change']);
  if (dataset === 'topGainer') return firstNumber(item, ['mindshare_gain', 'gain', `change_${duration}_ratio`, 'change_24h_ratio', 'mindshare_delta', 'delta', 'mindshare', `last_${duration}_mindshare`]);
  return firstNumber(item, ['mindshare', `last_${duration}_mindshare`, 'last_24h_mindshare', 'score']);
}

function itemDelta(item, duration) {
  return firstNumber(item, ['mindshare_delta', `change_${duration}`, `change_${duration}_ratio`, 'change_24h', 'change_24h_ratio', 'delta', 'change']);
}

function buildPayload(snapshots) {
  const out = {};

  for (const mode of ['voices', 'companies']) {
    const durations = mode === 'voices' ? ARENA_VOICE_DURATIONS : ARENA_COMPANY_DURATIONS;
    for (const vertical of ARENA_VERTICALS) {
      const viewId = `arena-${mode}`;
      if (!out[viewId]) out[viewId] = {};
      if (!out[viewId][vertical]) out[viewId][vertical] = {};
      for (const duration of durations) {
        const source = `arena-${mode}-${vertical}`;
        out[viewId][vertical][duration] = snapshotItems(snapshots, source, duration, 'leaderboard').slice(0, 100).map((item, i) => ({
          rank: item?.rank || i + 1,
          name: itemName(item, 'leaderboard'),
          username: item?.username || null,
          avatar: item?.avatar || null,
          sub: itemSubline(item),
          mindshare: itemMindshare(item, 'leaderboard', duration),
          delta: itemDelta(item, duration),
        }));
      }
    }
  }

  for (const view of VIEWS.filter((v) => v.mode !== 'arena')) {
    const durations = view.durations || DURATIONS;
    out[view.id] = {};
    for (const duration of durations) {
      out[view.id][duration] = snapshotItems(snapshots, view.source, duration, view.dataset).slice(0, 50).map((item, i) => ({
        rank: item?.rank || item?.snapshot_rank || i + 1,
        name: itemName(item, view.dataset),
        sub: itemSubline(item),
        mindshare: itemMindshare(item, view.dataset, duration),
        delta: itemDelta(item, duration),
        signed: view.dataset === 'topDelta' || view.dataset === 'topGainer',
      }));
    }
  }

  return out;
}

function renderDashboard(store) {
  const snapshots = store.snapshots || {};
  const payload = buildPayload(snapshots);
  const payloadJson = JSON.stringify(payload).replace(/</g, '\\u003c');
  const viewsJson = JSON.stringify(VIEWS).replace(/</g, '\\u003c');
  const totalKeys = Object.keys(snapshots).length;
  const updatedAt = store.updatedAt || null;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kaito Scan</title>
<style>
:root{
  --bg:#0b0d11;
  --nav:#0f1217;
  --surface:#151920;
  --surface2:#1c2029;
  --line:rgba(255,255,255,0.07);
  --line2:rgba(255,255,255,0.12);
  --txt:#dde3ec;
  --txt2:#7a8899;
  --txt3:#48555f;
  --accent:#3ecf8e;
  --accent-dim:rgba(62,207,142,0.12);
  --accent-border:rgba(62,207,142,0.35);
  --up:#3ecf8e;
  --down:#f06070;
  --up-dim:rgba(62,207,142,0.12);
  --down-dim:rgba(240,96,112,0.1);
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--txt);font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;font-size:14px;line-height:1.5;height:100dvh;display:flex;flex-direction:column;overflow:hidden}
a{color:inherit;text-decoration:none}
button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}

.topbar{height:52px;flex-shrink:0;border-bottom:0.5px solid var(--line);display:flex;align-items:center;gap:0;padding:0 20px;justify-content:space-between}
.logo{font-size:15px;font-weight:500;letter-spacing:.01em;color:var(--txt)}
.logo span{color:var(--accent)}
.top-meta{display:flex;align-items:center;gap:16px}
.top-badge{font-size:12px;color:var(--txt2);background:var(--surface);border:0.5px solid var(--line);border-radius:6px;padding:3px 10px;font-variant-numeric:tabular-nums}
.top-badge b{color:var(--txt);font-weight:500}
.top-links{display:flex;gap:6px}
.top-links a{font-size:12px;color:var(--txt2);border:0.5px solid var(--line);border-radius:6px;padding:3px 9px}
.top-links a:hover{color:var(--txt);border-color:var(--line2)}

.body{flex:1;display:flex;overflow:hidden}

.nav{width:200px;flex-shrink:0;border-right:0.5px solid var(--line);overflow-y:auto;padding:12px 0;background:var(--nav)}
.nav-group{margin-bottom:4px}
.nav-group-label{font-size:11px;color:var(--txt3);text-transform:uppercase;letter-spacing:.08em;padding:8px 16px 4px}
.nav-item{display:flex;align-items:center;gap:8px;padding:7px 16px;font-size:13px;color:var(--txt2);cursor:pointer;border-left:2px solid transparent}
.nav-item:hover{color:var(--txt);background:rgba(255,255,255,0.03)}
.nav-item.active{color:var(--accent);background:var(--accent-dim);border-left-color:var(--accent)}

.main{flex:1;display:flex;flex-direction:column;overflow:hidden}

.toolbar{height:48px;flex-shrink:0;border-bottom:0.5px solid var(--line);display:flex;align-items:center;gap:12px;padding:0 20px;background:var(--nav)}
.toolbar-title{font-size:15px;font-weight:500;color:var(--txt);margin-right:8px}
.seg{display:flex;gap:4px;flex-wrap:wrap}
.seg button{height:28px;padding:0 11px;font-size:12px;border:0.5px solid var(--line);border-radius:6px;color:var(--txt2)}
.seg button:hover{border-color:var(--line2);color:var(--txt)}
.seg button.on{border-color:var(--accent-border);background:var(--accent-dim);color:var(--accent)}
.seg button:disabled{opacity:0.3;cursor:default}
.seg-div{width:0.5px;height:20px;background:var(--line);margin:0 4px}
.row-count{margin-left:auto;font-size:12px;color:var(--txt3);font-variant-numeric:tabular-nums}

.content{flex:1;overflow:auto}
table{width:100%;border-collapse:collapse}
thead th{position:sticky;top:0;z-index:2;background:var(--surface);border-bottom:0.5px solid var(--line2);font-size:11px;font-weight:500;color:var(--txt3);text-transform:uppercase;letter-spacing:.06em;padding:10px 14px;white-space:nowrap}
thead th.r{text-align:right}
tbody tr{border-bottom:0.5px solid var(--line)}
tbody tr:hover td{background:rgba(255,255,255,0.025)}
td{padding:10px 14px;vertical-align:middle}
.td-rank{width:48px;color:var(--txt3);font-size:13px;font-variant-numeric:tabular-nums}
.td-name{min-width:140px}
.name-main{font-size:13px;font-weight:500;color:var(--txt)}
.name-sub{font-size:12px;color:var(--txt2);margin-top:1px}
.td-bar{width:140px;padding-right:16px}
.bar-wrap{display:flex;align-items:center;gap:8px}
.bar-track{flex:1;height:4px;background:var(--surface2);border-radius:2px;overflow:hidden}
.bar-fill{height:100%;background:var(--accent);border-radius:2px;min-width:1px}
.bar-val{font-size:12px;color:var(--txt2);font-variant-numeric:tabular-nums;white-space:nowrap;min-width:48px;text-align:right}
.td-delta{width:90px;text-align:right;font-size:13px;font-variant-numeric:tabular-nums;white-space:nowrap}
.delta-up{color:var(--up)}
.delta-dn{color:var(--down)}
.delta-flat{color:var(--txt3)}
.delta-chip{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:4px;font-size:12px}
.delta-chip.up{background:var(--up-dim);color:var(--up)}
.delta-chip.dn{background:var(--down-dim);color:var(--down)}
.delta-chip.flat{color:var(--txt3)}
.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px;color:var(--txt3);font-size:13px;gap:8px}

@media(max-width:700px){.nav{display:none}.td-bar{display:none}}
</style>
</head>
<body>
<header class="topbar">
  <div class="logo">Kaito<span>.</span>Scan</div>
  <div class="top-meta">
    <span class="top-badge" id="badge-updated"><b>—</b></span>
    <span class="top-badge" id="badge-snapshots"><b>${totalKeys}</b> snapshots</span>
    <nav class="top-links">
      <a href="/api/status">Status</a>
      <a href="/api/catalog">Catalog</a>
    </nav>
  </div>
</header>

<div class="body">
  <nav class="nav" id="nav"></nav>

  <div class="main">
    <div class="toolbar" id="toolbar">
      <span class="toolbar-title" id="toolbar-title">—</span>
      <div id="seg-vertical" class="seg" style="display:none">
        <button data-v="stock" class="on" data-control="vertical">Stock</button>
        <button data-v="ai" data-control="vertical">AI</button>
        <button data-v="crypto" data-control="vertical">Crypto</button>
      </div>
      <div class="seg-div" id="seg-div" style="display:none"></div>
      <div id="seg-duration" class="seg"></div>
      <span class="row-count" id="row-count"></span>
    </div>
    <div class="content">
      <table id="main-table">
        <thead id="thead"></thead>
        <tbody id="tbody"></tbody>
      </table>
    </div>
  </div>
</div>

<script>
const DATA = ${payloadJson};
const VIEWS = ${viewsJson};
const VOICE_DURATIONS = ${JSON.stringify(ARENA_VOICE_DURATIONS)};
const COMPANY_DURATIONS = ${JSON.stringify(ARENA_COMPANY_DURATIONS)};
const updatedAt = ${JSON.stringify(updatedAt)};

const st = { view: 'arena-voices', vertical: 'stock', duration: '7d' };

function fmtPct(v, signed) {
  const n = Number(v || 0);
  const s = signed && n > 0 ? '+' : '';
  return s + (n * 100).toFixed(2) + '%';
}
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function buildNav() {
  const nav = document.getElementById('nav');
  const groups = {};
  VIEWS.forEach((v) => { if (!groups[v.group]) groups[v.group] = []; groups[v.group].push(v); });
  nav.innerHTML = Object.entries(groups).map(([g, items]) =>
    '<div class="nav-group"><div class="nav-group-label">' + esc(g) + '</div>' +
    items.map((v) => '<div class="nav-item" data-view="' + esc(v.id) + '">' + esc(v.label) + '</div>').join('') +
    '</div>'
  ).join('');
  nav.querySelectorAll('.nav-item').forEach((el) => {
    el.addEventListener('click', () => { st.view = el.dataset.view; render(); });
  });
}

function getItems() {
  const view = VIEWS.find((v) => v.id === st.view);
  if (!view) return [];
  if (view.mode === 'arena') {
    return ((DATA[st.view] || {})[st.vertical] || {})[st.duration] || [];
  }
  return (DATA[st.view] || {})[st.duration] || [];
}

function getDurations() {
  const view = VIEWS.find((v) => v.id === st.view);
  if (!view) return DURATIONS;
  if (view.mode === 'arena') return st.view === 'arena-voices' ? VOICE_DURATIONS : COMPANY_DURATIONS;
  return view.durations || ${JSON.stringify(DURATIONS)};
}

function render() {
  const view = VIEWS.find((v) => v.id === st.view);
  if (!view) return;

  document.querySelectorAll('.nav-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.view === st.view);
  });

  document.getElementById('toolbar-title').textContent = view.label;

  const isArena = view.mode === 'arena';
  const segV = document.getElementById('seg-vertical');
  const segDiv = document.getElementById('seg-div');
  segV.style.display = isArena ? '' : 'none';
  segDiv.style.display = isArena ? '' : 'none';
  if (isArena) {
    segV.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === st.vertical));
  }

  const durations = getDurations();
  if (!durations.includes(st.duration)) st.duration = durations[0];
  const segD = document.getElementById('seg-duration');
  segD.innerHTML = durations.map((d) =>
    '<button data-v="' + d + '" data-control="duration" class="' + (d === st.duration ? 'on' : '') + '">' + d + '</button>'
  ).join('');
  segD.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => { st.duration = b.dataset.v; render(); });
  });

  const items = getItems();
  const maxMs = Math.max(...items.map((it) => Math.abs(Number(it.mindshare || 0))), 0.0001);
  const signed = items[0]?.signed || false;
  const isKol = view.id === 'kols';
  const hasAvatar = items.some((it) => it.avatar);

  document.getElementById('thead').innerHTML =
    '<tr><th style="width:48px">#</th><th>' + (isKol ? 'Account' : 'Name') + '</th>' +
    '<th>Mindshare</th>' +
    '<th class="r" style="width:110px">Delta</th></tr>';

  document.getElementById('tbody').innerHTML = items.length
    ? items.map((it) => {
        const ms = Number(it.mindshare || 0);
        const d = Number(it.delta || 0);
        const barW = Math.round(Math.abs(ms) / maxMs * 100);
        const dClass = d > 0 ? 'up' : d < 0 ? 'dn' : 'flat';
        const arrow = d > 0 ? '↑' : d < 0 ? '↓' : '';
        const avatarHtml = hasAvatar
          ? (it.avatar
              ? '<img src="' + esc(it.avatar) + '" width="24" height="24" loading="lazy" onerror="this.style.visibility=\'hidden\'" style="border-radius:50%;vertical-align:middle;margin-right:8px;flex-shrink:0">'
              : '<span style="display:inline-block;width:24px;height:24px;border-radius:50%;background:var(--surface2);margin-right:8px;flex-shrink:0"></span>')
          : '';
        return '<tr>' +
          '<td class="td-rank">' + esc(it.rank) + '</td>' +
          '<td class="td-name"><div class="name-main" style="display:flex;align-items:center">' + avatarHtml + esc(it.name) + '</div>' + (it.sub ? '<div class="name-sub">' + esc(it.sub) + '</div>' : '') + '</td>' +
          '<td class="td-bar"><div class="bar-wrap"><div class="bar-track"><div class="bar-fill" style="width:' + barW + '%"></div></div><span class="bar-val">' + fmtPct(ms, signed) + '</span></div></td>' +
          '<td class="td-delta"><span class="delta-chip ' + dClass + '">' + arrow + ' ' + fmtPct(d, true) + '</span></td>' +
          '</tr>';
      }).join('')
    : '<tr><td colspan="4"><div class="empty-state">No cached data — next update at :05</div></td></tr>';

  document.getElementById('row-count').textContent = items.length + ' rows';
}

segV_init: {
  document.getElementById('seg-vertical').querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => { st.vertical = b.dataset.v; render(); });
  });
}

if (updatedAt) {
  const d = new Date(updatedAt);
  const fmt = d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
  document.getElementById('badge-updated').innerHTML = 'Updated <b>' + fmt + '</b>';
}

buildNav();
render();
</script>
</body>
</html>`;
}

module.exports = { renderDashboard };
