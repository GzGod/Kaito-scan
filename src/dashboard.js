const DURATIONS = ['24h', '7d', '30d', '3m', '6m', '12m'];
const KOL_DURATIONS = ['7d', '30d', '3m', '6m', '12m'];
const ARENA_VOICE_DURATIONS = ['7d', '30d', '3m', '6m', '12m'];
const ARENA_COMPANY_DURATIONS = DURATIONS;
const ARENA_VERTICALS = ['stock', 'ai', 'crypto'];

const VIEWS = [
  { id: 'arena-voices',    label: 'Top Voices',        group: 'Arena', mode: 'arena', sub: 'voices' },
  { id: 'arena-companies', label: 'Top Companies',     group: 'Arena', mode: 'arena', sub: 'companies' },
  { id: 'arena-language',  label: 'By language',       group: 'Arena', mode: 'arena-language' },
  { id: 'arena-sf',        label: 'SF count rank',     group: 'Arena', mode: 'arena-sf' },
  { id: 'arena-github',    label: 'GitHub repos',      group: 'Arena', mode: 'arena-github' },
  { id: 'pre-tge',         label: 'Pre-TGE',           group: 'Classic', dataset: 'heatmap',  source: 'pre-tge' },
  { id: 'pre-tge-delta',   label: 'Pre-TGE movers',    group: 'Classic', dataset: 'topDelta', source: 'pre-tge' },
  { id: 'infomarkets',     label: 'Info markets',      group: 'Classic', dataset: 'heatmap',  source: 'infomarkets' },
  { id: 'exchange',        label: 'Exchange',          group: 'Classic', dataset: 'heatmap',  source: 'exchange' },
  { id: 'kols',            label: 'KOL leaderboard',   group: 'Classic', dataset: 'kols',     source: 'infomarkets', durations: KOL_DURATIONS },
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

  for (const view of VIEWS.filter((v) => v.mode !== 'arena' && v.mode !== 'arena-language' && v.mode !== 'arena-sf' && v.mode !== 'arena-github')) {
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

  // Language EN leaderboard (per vertical, voice durations)
  out['arena-language'] = {};
  for (const vertical of ARENA_VERTICALS) {
    out['arena-language'][vertical] = {};
    for (const duration of ARENA_VOICE_DURATIONS) {
      out['arena-language'][vertical][duration] = {};
      for (const lang of ['en', 'zh']) {
        out['arena-language'][vertical][duration][lang] = snapshotItems(snapshots, `arena-voices-${vertical}`, duration, `language-${lang}`).slice(0, 100).map((item, i) => ({
          rank: item?.rank || i + 1,
          name: item?.name || item?.username || '',
          username: item?.username || null,
          avatar: item?.avatar || null,
          sub: null,
          mindshare: Number(item?.mindshare || 0),
          delta: Number(item?.mindshare_delta || 0),
        }));
      }
    }
  }

  // Smart Followers change (per vertical, voice durations)
  out['arena-sf'] = {};
  for (const vertical of ARENA_VERTICALS) {
    out['arena-sf'][vertical] = {};
    for (const duration of ARENA_VOICE_DURATIONS) {
      out['arena-sf'][vertical][duration] = snapshotItems(snapshots, `arena-voices-${vertical}`, duration, 'smart-followers').slice(0, 100).map((item, i) => ({
        rank: item?.rank || i + 1,
        name: item?.name || item?.username || '',
        username: item?.username || null,
        avatar: item?.avatar || null,
        sub: null,
        count: Number(item?.count || 0),
        change: Number(item?.change || 0),
        isSF: true,
      }));
    }
  }

  // GitHub repos (AI only, voice durations)
  out['arena-github'] = {};
  for (const duration of ARENA_VOICE_DURATIONS) {
    out['arena-github'][duration] = snapshotItems(snapshots, 'arena-voices-ai', duration, 'github-repos').slice(0, 50).map((item, i) => ({
      rank: item?.repo_rank || i + 1,
      name: item?.repo || '',
      sub: item?.repo_description || null,
      url: item?.repo_url || null,
      score: Number(item?.score || 0),
      stars: Number(item?.star_count || 0),
      forks: Number(item?.fork_count || 0),
      mentions: Number(item?.mention_count || 0),
      isGithub: true,
    }));
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
  --bg:#f9f9f8;
  --nav:#f3f2ef;
  --surface:#ffffff;
  --surface2:#f3f2ef;
  --line:#e5e4e0;
  --line2:#ccc9c2;
  --txt:#1a1915;
  --txt2:#6b6860;
  --txt3:#a09d97;
  --accent:#c96442;
  --accent-dim:rgba(201,100,66,0.08);
  --accent-border:rgba(201,100,66,0.35);
  --up:#2a7d4f;
  --down:#c0392b;
  --up-dim:rgba(42,125,79,0.08);
  --down-dim:rgba(192,57,43,0.08);
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--txt);font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;font-size:13px;line-height:1.4}
a{color:inherit;text-decoration:none}
button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}

.topbar{height:44px;border-bottom:1px solid var(--line);display:flex;align-items:center;padding:0 16px;justify-content:space-between;position:sticky;top:0;z-index:10;background:var(--surface)}
.logo{font-size:14px;font-weight:600;color:var(--txt);letter-spacing:-.01em}
.logo span{color:var(--accent)}
.top-meta{display:flex;align-items:center;gap:12px}
.top-badge{font-size:11px;color:var(--txt2);background:var(--surface2);border:1px solid var(--line);border-radius:5px;padding:2px 8px;font-variant-numeric:tabular-nums}
.top-badge b{color:var(--txt);font-weight:500}
.top-links{display:flex;gap:4px}
.top-links a{font-size:11px;color:var(--txt2);border:1px solid var(--line);border-radius:5px;padding:2px 8px}
.top-links a:hover{color:var(--txt);border-color:var(--line2);background:var(--surface2)}

.body{display:flex;min-height:calc(100vh - 44px)}

.nav{width:180px;flex-shrink:0;border-right:1px solid var(--line);padding:8px 0;background:var(--nav);position:sticky;top:44px;height:calc(100vh - 44px);overflow-y:auto}
.nav-group{margin-bottom:2px}
.nav-group-label{font-size:10px;color:var(--txt3);text-transform:uppercase;letter-spacing:.08em;padding:8px 12px 3px}
.nav-item{display:flex;align-items:center;padding:5px 12px;font-size:12px;color:var(--txt2);cursor:pointer;border-left:2px solid transparent}
.nav-item:hover{color:var(--txt);background:rgba(0,0,0,0.03)}
.nav-item.active{color:var(--accent);background:var(--accent-dim);border-left-color:var(--accent);font-weight:500}

.main{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0}

.toolbar{height:40px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:8px;padding:0 16px;background:var(--surface);flex-shrink:0}
.toolbar-title{font-size:13px;font-weight:500;color:var(--txt);margin-right:6px}
.seg{display:flex;gap:3px;flex-wrap:wrap}
.seg button{height:24px;padding:0 9px;font-size:11px;border:1px solid var(--line);border-radius:5px;color:var(--txt2);background:var(--surface)}
.seg button:hover{border-color:var(--line2);color:var(--txt);background:var(--surface2)}
.seg button.on{border-color:var(--accent-border);background:var(--accent-dim);color:var(--accent);font-weight:500}
.seg button:disabled{opacity:0.35;cursor:default}
.seg-div{width:1px;height:16px;background:var(--line);margin:0 2px}
.row-count{margin-left:auto;font-size:11px;color:var(--txt3);font-variant-numeric:tabular-nums}

.content{flex:1;min-height:0;overflow-y:auto}
table{width:100%;border-collapse:collapse}
thead th{position:sticky;top:0;z-index:2;background:var(--surface2);border-bottom:1px solid var(--line2);font-size:10px;font-weight:600;color:var(--txt3);text-transform:uppercase;letter-spacing:.06em;padding:6px 12px;white-space:nowrap}
thead th.r{text-align:right}
tbody tr{border-bottom:1px solid var(--line)}
tbody tr:hover td{background:rgba(0,0,0,0.02)}
td{padding:6px 12px;vertical-align:middle}
.td-rank{width:36px;color:var(--txt3);font-size:12px;font-variant-numeric:tabular-nums}
.td-name{min-width:120px}
.name-main{font-size:12px;font-weight:500;color:var(--txt)}
.name-sub{font-size:11px;color:var(--txt2);margin-top:1px}
.td-bar{width:160px;padding-right:12px}
.bar-wrap{display:flex;align-items:center;gap:6px}
.bar-track{flex:1;height:3px;background:var(--line2);border-radius:2px;overflow:hidden}
.bar-fill{height:100%;background:var(--accent);border-radius:2px;min-width:1px;opacity:0.7}
.bar-val{font-size:11px;color:var(--txt2);font-variant-numeric:tabular-nums;white-space:nowrap;min-width:44px;text-align:right}
.td-delta{width:88px;text-align:right;font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap}
.delta-chip{display:inline-flex;align-items:center;gap:2px;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:500}
.delta-chip.up{background:var(--up-dim);color:var(--up)}
.delta-chip.dn{background:var(--down-dim);color:var(--down)}
.delta-chip.flat{color:var(--txt3)}
.empty-state{display:flex;align-items:center;justify-content:center;height:160px;color:var(--txt3);font-size:12px}

@media(max-width:700px){.nav{display:none}.td-bar{display:none}}
</style>
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
.delta-chip{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:4px;font-size:12px}
.delta-chip.up{background:var(--up-dim);color:var(--up)}
.delta-chip.dn{background:var(--down-dim);color:var(--down)}
.delta-chip.flat{color:var(--txt3)}
.empty-state{display:flex;align-items:center;justify-content:center;height:200px;color:var(--txt3);font-size:13px}

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
      <div id="seg-language" class="seg" style="display:none">
        <button data-v="en" class="on" data-control="language">EN</button>
        <button data-v="zh" data-control="language">ZH</button>
      </div>
      <div class="seg-div" id="seg-lang-div" style="display:none"></div>
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
const ALL_DURATIONS = ${JSON.stringify(DURATIONS)};
const updatedAt = ${JSON.stringify(updatedAt)};

const st = { view: 'arena-voices', vertical: 'stock', duration: '7d', language: 'en' };

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
  if (view.mode === 'arena-language') {
    return (((DATA['arena-language'] || {})[st.vertical] || {})[st.duration] || {})[st.language] || [];
  }
  if (view.mode === 'arena-sf') {
    return ((DATA['arena-sf'] || {})[st.vertical] || {})[st.duration] || [];
  }
  if (view.mode === 'arena-github') {
    return (DATA['arena-github'] || {})[st.duration] || [];
  }
  return (DATA[st.view] || {})[st.duration] || [];
}

function getDurations() {
  const view = VIEWS.find((v) => v.id === st.view);
  if (!view) return ALL_DURATIONS;
  if (view.mode === 'arena') return st.view === 'arena-voices' ? VOICE_DURATIONS : COMPANY_DURATIONS;
  if (view.mode === 'arena-language' || view.mode === 'arena-sf') return VOICE_DURATIONS;
  if (view.mode === 'arena-github') return VOICE_DURATIONS;
  return view.durations || ALL_DURATIONS;
}

function render() {
  const view = VIEWS.find((v) => v.id === st.view);
  if (!view) return;

  document.querySelectorAll('.nav-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.view === st.view);
  });

  document.getElementById('toolbar-title').textContent = view.label;

  const hasVertical = view.mode === 'arena' || view.mode === 'arena-language' || view.mode === 'arena-sf';
  const hasLanguage = view.mode === 'arena-language';
  const segV = document.getElementById('seg-vertical');
  const segDiv = document.getElementById('seg-div');
  const segLang = document.getElementById('seg-language');
  const segLangDiv = document.getElementById('seg-lang-div');
  segV.style.display = hasVertical ? '' : 'none';
  segDiv.style.display = hasVertical ? '' : 'none';
  segLang.style.display = hasLanguage ? '' : 'none';
  segLangDiv.style.display = hasLanguage ? '' : 'none';
  if (hasVertical) {
    segV.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === st.vertical));
  }
  if (hasLanguage) {
    segLang.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === st.language));
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

  // GitHub repos view
  if (view.mode === 'arena-github') {
    const maxScore = Math.max(...items.map((it) => Number(it.score || 0)), 0.0001);
    document.getElementById('thead').innerHTML =
      '<tr><th style="width:48px">#</th><th>Repo</th><th>Score</th><th class="r" style="width:120px">Stars / Forks</th></tr>';
    document.getElementById('tbody').innerHTML = items.length
      ? items.map((it) => {
          const barW = Math.round(Number(it.score || 0) / maxScore * 100);
          return '<tr>' +
            '<td class="td-rank">' + esc(it.rank) + '</td>' +
            '<td class="td-name"><div class="name-main">' + (it.url ? '<a href="' + esc(it.url) + '" target="_blank" style="color:var(--accent)">' + esc(it.name) + '</a>' : esc(it.name)) + '</div>' + (it.sub ? '<div class="name-sub">' + esc(it.sub) + '</div>' : '') + '</td>' +
            '<td class="td-bar"><div class="bar-wrap"><div class="bar-track"><div class="bar-fill" style="width:' + barW + '%"></div></div><span class="bar-val">' + esc(it.score.toFixed(1)) + '</span></div></td>' +
            '<td class="td-delta" style="color:var(--txt2)">★ ' + esc(it.stars.toLocaleString()) + ' · ' + esc(it.forks.toLocaleString()) + '</td>' +
            '</tr>';
        }).join('')
      : '<tr><td colspan="4"><div class="empty-state">No cached data — next update at :05</div></td></tr>';
    document.getElementById('row-count').textContent = items.length + ' repos';
    return;
  }

  // Smart Followers view
  if (view.mode === 'arena-sf') {
    const maxCount = Math.max(...items.map((it) => Number(it.count || 0)), 1);
    const hasAvatar = items.some((it) => it.avatar);
    document.getElementById('thead').innerHTML =
      '<tr><th style="width:48px">#</th><th>Account</th><th>Smart followers</th><th class="r" style="width:110px">Change</th></tr>';
    document.getElementById('tbody').innerHTML = items.length
      ? items.map((it) => {
          const barW = Math.round(Number(it.count || 0) / maxCount * 100);
          const ch = Number(it.change || 0);
          const dClass = ch > 0 ? 'up' : ch < 0 ? 'dn' : 'flat';
          const arrow = ch > 0 ? '↑' : ch < 0 ? '↓' : '';
          const avatarHtml = hasAvatar
            ? (it.avatar ? '<img src="' + esc(it.avatar) + '" width="24" height="24" loading="lazy" onerror="this.style.visibility=&quot;hidden&quot;" style="border-radius:50%;vertical-align:middle;margin-right:8px;flex-shrink:0">' : '<span style="display:inline-block;width:24px;height:24px;border-radius:50%;background:var(--surface2);margin-right:8px;flex-shrink:0"></span>')
            : '';
          return '<tr>' +
            '<td class="td-rank">' + esc(it.rank) + '</td>' +
            '<td class="td-name"><div class="name-main" style="display:flex;align-items:center">' + avatarHtml + esc(it.name) + '</div></td>' +
            '<td class="td-bar"><div class="bar-wrap"><div class="bar-track"><div class="bar-fill" style="width:' + barW + '%"></div></div><span class="bar-val">' + esc(Number(it.count).toLocaleString()) + '</span></div></td>' +
            '<td class="td-delta"><span class="delta-chip ' + dClass + '">' + arrow + ' ' + esc((ch > 0 ? '+' : '') + ch.toLocaleString()) + '</span></td>' +
            '</tr>';
        }).join('')
      : '<tr><td colspan="4"><div class="empty-state">No cached data — next update at :05</div></td></tr>';
    document.getElementById('row-count').textContent = items.length + ' rows';
    return;
  }

  // Default: mindshare views (leaderboard, language, classic)
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
              ? '<img src="' + esc(it.avatar) + '" width="24" height="24" loading="lazy" onerror="this.style.visibility=&quot;hidden&quot;" style="border-radius:50%;vertical-align:middle;margin-right:8px;flex-shrink:0">'
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
  document.getElementById('seg-language').querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => { st.language = b.dataset.v; render(); });
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
