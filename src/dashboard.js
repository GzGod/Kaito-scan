const DURATIONS = ['24h', '7d', '30d', '3m', '6m', '12m'];
const KOL_DURATIONS = ['7d', '30d', '3m', '6m', '12m'];
const ARENA_VOICE_DURATIONS = ['7d', '30d', '3m', '6m', '12m'];
const ARENA_COMPANY_DURATIONS = DURATIONS;
const ARENA_VERTICALS = ['stock', 'ai', 'crypto'];

const CLASSIC_DATASETS = [
  { source: 'pre-tge', dataset: 'heatmap', title: 'Pre-TGE heatmap', label: 'Project', value: 'Mindshare' },
  { source: 'pre-tge', dataset: 'topDelta', title: 'Pre-TGE movers', label: 'Project', value: 'Change' },
  { source: 'pre-tge', dataset: 'topGainer', title: 'Pre-TGE gainers', label: 'Project', value: 'Gain' },
  { source: 'infomarkets', dataset: 'heatmap', title: 'Info markets', label: 'Ticker', value: 'Mindshare' },
  { source: 'infomarkets', dataset: 'topGainer', title: 'Info gainers', label: 'Ticker', value: 'Gain' },
  { source: 'exchange', dataset: 'heatmap', title: 'Exchange', label: 'Ticker', value: 'Mindshare' },
  { source: 'exchange', dataset: 'topGainer', title: 'Exchange gainers', label: 'Ticker', value: 'Gain' },
  { source: 'infomarkets', dataset: 'kols', title: 'Info KOL', label: 'Username', value: 'Mindshare', durations: KOL_DURATIONS },
];

function pct(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '0.00%';
  return `${(n * 100).toFixed(2)}%`;
}

function signedPct(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '0.00%';
  const sign = n > 0 ? '+' : '';
  return `${sign}${(n * 100).toFixed(2)}%`;
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
    const v = Number(item?.[field]);
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
  const parts = [
    item?.fullname,
    item?.company_id && item?.name !== item.company_id ? item.company_id : '',
    item?.sector,
  ].filter(Boolean);
  return parts.slice(0, 2).join(' · ');
}

function itemMindshare(item, dataset, duration) {
  if (dataset === 'topDelta') {
    return firstNumber(item, [`change_${duration}_ratio`, 'change_24h_ratio', 'mindshare_delta', 'delta', 'change']);
  }
  if (dataset === 'topGainer') {
    return firstNumber(item, ['mindshare_gain', 'gain', `change_${duration}_ratio`, 'change_24h_ratio', 'mindshare_delta', 'delta', 'mindshare', `last_${duration}_mindshare`]);
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

function classicPayload(snapshots) {
  const payload = {};
  for (const entry of CLASSIC_DATASETS) {
    const key = `${entry.source}:${entry.dataset}`;
    const durations = entry.durations || DURATIONS;
    payload[key] = { dataset: entry.dataset, durations, rows: {} };
    for (const duration of durations) {
      payload[key].rows[duration] = snapshotItems(snapshots, entry.source, duration, entry.dataset).slice(0, 50).map((item, index) => ({
        rank: item?.rank || item?.snapshot_rank || index + 1,
        name: itemName(item, entry.dataset),
        subline: itemSubline(item),
        value: itemMindshare(item, entry.dataset, duration),
        delta: itemDelta(item, duration),
      }));
    }
  }
  return payload;
}

function renderDashboard(store) {
  const snapshots = store.snapshots || {};
  const arenaData = arenaPayload(snapshots);
  const classicData = classicPayload(snapshots);
  const arenaJson = JSON.stringify(arenaData).replace(/</g, '\\u003c');
  const classicJson = JSON.stringify(classicData).replace(/</g, '\\u003c');
  const totalKeys = Object.keys(snapshots).length;
  const arenaKeys = Object.keys(snapshots).filter((k) => k.startsWith('arena-')).length;
  const classicKeys = totalKeys - arenaKeys;
  const updatedAt = store.updatedAt ? new Date(store.updatedAt).toLocaleString('en-US', { timeZone: 'Asia/Shanghai', hour12: false }) : 'not yet';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kaito Scan</title>
<style>
:root{
  --surface-0:#0d0f12;
  --surface-1:#13171c;
  --surface-2:#1a1f26;
  --text-primary:#e8edf2;
  --text-secondary:#8a98a8;
  --text-muted:#56636f;
  --text-accent:#4cc9a0;
  --text-success:#45d483;
  --text-danger:#ff6b6b;
  --border:rgba(255,255,255,0.08);
  --border-strong:rgba(255,255,255,0.16);
  --border-accent:rgba(76,201,160,0.4);
  --bg-accent:rgba(76,201,160,0.1);
  --radius:8px;
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;font-size:16px;font-weight:400;line-height:1.7;color:var(--text-primary);background:var(--surface-0)}
h2{font-size:18px;font-weight:500;color:var(--text-primary)}
h3{font-size:16px;font-weight:500;color:var(--text-primary)}
.page{padding:1.5rem 1.25rem 3rem}
.topbar{display:flex;align-items:baseline;justify-content:space-between;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap}
.site-name{font-size:22px;font-weight:500;color:var(--text-primary)}
.site-meta{font-size:13px;color:var(--text-secondary);margin-top:2px}
.topbar-links{display:flex;gap:8px}
.topbar-links a{font-size:13px;color:var(--text-accent);text-decoration:none;border:0.5px solid var(--border);border-radius:var(--radius);padding:4px 10px}
.topbar-links a:hover{border-color:var(--border-strong)}
.stat-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:1.5rem}
.stat{border:0.5px solid var(--border);border-radius:12px;padding:1rem 1.25rem;background:var(--surface-2)}
.stat-label{font-size:13px;color:var(--text-secondary);margin-bottom:4px}
.stat-value{font-size:22px;font-weight:500;color:var(--text-primary);font-variant-numeric:tabular-nums}
.layout{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(280px,0.9fr);gap:16px}
.panel{border:0.5px solid var(--border);border-radius:12px;background:var(--surface-2);overflow:hidden}
.panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:0.5px solid var(--border);background:var(--surface-1)}
.badge{font-size:12px;color:var(--text-secondary);border:0.5px solid var(--border);border-radius:999px;padding:2px 10px;white-space:nowrap;font-variant-numeric:tabular-nums}
.seg-row{display:flex;align-items:center;gap:8px;padding:10px 16px;border-bottom:0.5px solid var(--border);flex-wrap:wrap;background:var(--surface-1)}
.seg-label{font-size:12px;color:var(--text-secondary);width:60px;flex-shrink:0}
.seg{display:flex;gap:4px;flex-wrap:wrap}
.seg button{height:26px;padding:0 10px;font-size:12px;border:0.5px solid var(--border);border-radius:6px;background:transparent;color:var(--text-secondary);cursor:pointer}
.seg button:hover{border-color:var(--border-strong);color:var(--text-primary)}
.seg button.on{border-color:var(--border-accent);background:var(--bg-accent);color:var(--text-accent)}
.seg button:disabled{opacity:0.3;cursor:default}
.tbl-wrap{overflow:auto}
table{width:100%;border-collapse:collapse;min-width:480px}
th,td{padding:9px 12px;border-bottom:0.5px solid var(--border);text-align:left;font-size:13px;vertical-align:middle}
th{font-size:12px;color:var(--text-secondary);font-weight:500;background:var(--surface-1)}
.col-rank{width:44px;color:var(--text-muted);font-variant-numeric:tabular-nums}
.col-num{text-align:right;font-variant-numeric:tabular-nums}
.row-name{font-weight:500;color:var(--text-primary)}
.row-sub{font-size:12px;color:var(--text-secondary);margin-top:1px}
.pos{color:var(--text-success)}
.neg{color:var(--text-danger)}
.muted{color:var(--text-muted)}
.empty{text-align:center;color:var(--text-muted);padding:24px}
.side{display:flex;flex-direction:column;gap:12px}
.classic-controls{display:flex;gap:4px;flex-wrap:wrap;padding:8px 12px;border-bottom:0.5px solid var(--border);background:var(--surface-1)}
.classic-controls button{height:24px;padding:0 9px;font-size:12px;border:0.5px solid var(--border);border-radius:6px;background:transparent;color:var(--text-secondary);cursor:pointer}
.classic-controls button:hover{border-color:var(--border-strong);color:var(--text-primary)}
.classic-controls button.on{border-color:var(--border-accent);background:var(--bg-accent);color:var(--text-accent)}
.api-list{padding:12px 14px;display:flex;flex-direction:column;gap:8px}
.api-row{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 10px;border:0.5px solid var(--border);border-radius:var(--radius)}
.api-row code{font-size:12px;color:var(--text-accent);font-family:ui-monospace,monospace}
.api-row span{font-size:12px;color:var(--text-secondary)}
@media(max-width:900px){.layout{grid-template-columns:1fr}.seg-label{width:100%}}
@media(max-width:560px){.stat-row{grid-template-columns:1fr 1fr}}
</style>
</head>
<body>
<div class="page">
  <header class="topbar">
    <div>
      <div class="site-name">Kaito Scan</div>
      <div class="site-meta">Updated ${esc(updatedAt)} · cached snapshots · hourly at :05</div>
    </div>
    <nav class="topbar-links">
      <a href="/api/status">Status</a>
      <a href="/api/catalog">Catalog</a>
    </nav>
  </header>

  <div class="stat-row">
    <div class="stat"><div class="stat-label">Total snapshots</div><div class="stat-value">${totalKeys}</div></div>
    <div class="stat"><div class="stat-label">Arena snapshots</div><div class="stat-value">${arenaKeys}</div></div>
    <div class="stat"><div class="stat-label">Classic snapshots</div><div class="stat-value">${classicKeys}</div></div>
    <div class="stat"><div class="stat-label">Update minute</div><div class="stat-value">:05</div></div>
  </div>

  <div class="layout">
    <section class="panel">
      <div class="panel-head">
        <h2 id="arena-title">Top voices · stock · 7d</h2>
        <span class="badge" id="arena-count">—</span>
      </div>
      <div class="seg-row">
        <span class="seg-label">Type</span>
        <div class="seg" data-control="mode">
          <button type="button" data-value="voices" class="on">Top Voices</button>
          <button type="button" data-value="companies">Top Companies</button>
        </div>
      </div>
      <div class="seg-row">
        <span class="seg-label">Market</span>
        <div class="seg" data-control="vertical">
          <button type="button" data-value="stock" class="on">Stock</button>
          <button type="button" data-value="ai">AI</button>
          <button type="button" data-value="crypto">Crypto</button>
        </div>
      </div>
      <div class="seg-row">
        <span class="seg-label">Duration</span>
        <div class="seg" data-control="duration">
          ${DURATIONS.map((d) => `<button type="button" data-value="${esc(d)}">${esc(d)}</button>`).join('')}
        </div>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th class="col-rank">#</th><th>Name</th><th class="col-num">Mindshare</th><th class="col-num">Delta</th></tr></thead>
          <tbody id="arena-body"></tbody>
        </table>
      </div>
    </section>

    <aside class="side">
      <section class="panel">
        <div class="panel-head"><h3>API endpoints</h3><span class="badge">Bearer key</span></div>
        <div class="api-list">
          <div class="api-row"><code>/api/arena/voices</code><span>vertical + duration</span></div>
          <div class="api-row"><code>/api/arena/companies</code><span>vertical + duration</span></div>
          <div class="api-row"><code>/api/pre-tge/top-gainer</code><span>new</span></div>
          <div class="api-row"><code>/api/infomarkets/top-gainer</code><span>new</span></div>
          <div class="api-row"><code>/api/exchange/top-gainer</code><span>new</span></div>
          <div class="api-row"><code>/api/history/query</code><span>hour / day history</span></div>
          <div class="api-row"><code>/api/snapshot/:key</code><span>raw snapshot</span></div>
        </div>
      </section>
      ${CLASSIC_DATASETS.map((entry) => {
        const durations = entry.durations || DURATIONS;
        const key = `${entry.source}:${entry.dataset}`;
        return `<section class="panel">
          <div class="panel-head">
            <h3>${esc(entry.title)}</h3>
            <span class="badge" data-classic-count="${esc(key)}">—</span>
          </div>
          <div class="classic-controls" data-classic-control="${esc(key)}">
            ${durations.map((d) => `<button type="button" data-duration="${esc(d)}">${esc(d)}</button>`).join('')}
          </div>
          <div class="tbl-wrap">
            <table>
              <thead><tr><th class="col-rank">#</th><th>${esc(entry.label)}</th><th class="col-num">${esc(entry.value)}</th><th class="col-num">Delta</th></tr></thead>
              <tbody data-classic-body="${esc(key)}"></tbody>
            </table>
          </div>
        </section>`;
      }).join('')}
    </aside>
  </div>
</div>
<script>
const AD=${arenaJson};
const CD=${classicJson};
const VOICE_DURATIONS = ${JSON.stringify(ARENA_VOICE_DURATIONS)};
const COMPANY_DURATIONS = ${JSON.stringify(ARENA_COMPANY_DURATIONS)};
const st={mode:'voices',vertical:'stock',duration:'7d'};
const lbl={voices:'Top Voices',companies:'Top Companies',stock:'Stock',ai:'AI',crypto:'Crypto'};
function esc(v){return String(v??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function fmtPct(v,signed){const n=Number(v||0);const s=signed&&n>0?'+':'';return s+(n*100).toFixed(2)+'%';}
function rowHtml(rank,name,sub,val,delta,signed){
  const dc=delta>0?'pos':delta<0?'neg':'muted';
  return '<tr><td class="col-rank muted">'+esc(rank)+'</td><td><div class="row-name">'+esc(name)+'</div>'+(sub?'<div class="row-sub">'+esc(sub)+'</div>':'')+'</td><td class="col-num">'+fmtPct(val,signed)+'</td><td class="col-num '+dc+'">'+fmtPct(delta,true)+'</td></tr>';
}
function renderArena(){
  const allowed=st.mode==='voices'?VOICE_DURATIONS:COMPANY_DURATIONS;
  if(!allowed.includes(st.duration))st.duration=allowed[0];
  document.querySelectorAll('[data-control="duration"] button').forEach((b)=>{
    const ok=allowed.includes(b.dataset.value);
    b.disabled=!ok;
    b.className=b.dataset.value===st.duration?'on':'';
  });
  ['mode','vertical'].forEach((k)=>{
    document.querySelectorAll('[data-control="'+k+'"] button').forEach((b)=>{b.className=b.dataset.value===st[k]?'on':'';});
  });
  const items=(((AD[st.mode]||{})[st.vertical]||{})[st.duration]||[]);
  document.getElementById('arena-title').textContent=lbl[st.mode]+' · '+lbl[st.vertical]+' · '+st.duration;
  document.getElementById('arena-count').textContent=items.length+' items';
  document.getElementById('arena-body').innerHTML=items.slice(0,50).map((it)=>rowHtml(it.rank,it.name,it.subline,it.mindshare,it.delta,false)).join('')||'<tr><td colspan="4" class="empty">No data yet</td></tr>';
}
function renderClassic(key,dur){
  const block=CD[key];
  if(!block)return;
  const items=((block.rows||{})[dur]||[]);
  const body=document.querySelector('[data-classic-body="'+key+'"]');
  const cnt=document.querySelector('[data-classic-count="'+key+'"]');
  if(cnt)cnt.textContent=items.length+' items';
  document.querySelectorAll('[data-classic-control="'+key+'"] button').forEach((b)=>{b.className=b.dataset.duration===dur?'on':'';});
  if(!body)return;
  const signed=block.dataset==='topDelta'||block.dataset==='topGainer';
  body.innerHTML=items.slice(0,12).map((it)=>rowHtml(it.rank,it.name,it.subline,it.value,it.delta,signed)).join('')||'<tr><td colspan="4" class="empty">No data yet</td></tr>';
}
document.querySelectorAll('[data-control] button').forEach((b)=>{
  b.addEventListener('click',()=>{
    if(b.disabled)return;
    st[b.parentElement.dataset.control]=b.dataset.value;
    renderArena();
  });
});
document.querySelectorAll('[data-classic-control] button').forEach((b)=>{
  b.addEventListener('click',()=>renderClassic(b.parentElement.dataset.classicControl,b.dataset.duration));
});
renderArena();
Object.entries(CD).forEach(([k,block])=>renderClassic(k,block.durations[0]));
</script>
</body>
</html>`;
}

module.exports = { renderDashboard };
