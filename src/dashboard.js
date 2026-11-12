const DURATIONS = ['24h', '7d', '30d', '3m', '6m', '12m'];
const KOL_DURATIONS = ['7d', '30d', '3m', '6m', '12m'];
const ARENA_VOICE_DURATIONS = ['7d', '30d', '3m', '6m', '12m'];
const ARENA_COMPANY_DURATIONS = DURATIONS;
const ARENA_VERTICALS = ['stock', 'ai', 'crypto'];

const VIEWS = [
  { id: 'arena-voices',    label: 'Top Voices',      group: 'Arena', mode: 'arena', sub: 'voices' },
  { id: 'arena-companies', label: 'Top Companies',   group: 'Arena', mode: 'arena', sub: 'companies' },
  { id: 'arena-delta-all', label: 'Top Gainer',      group: 'Arena', mode: 'arena-delta-all' },
  { id: 'arena-language',  label: 'By language',     group: 'Arena', mode: 'arena-language' },
  { id: 'arena-sf',        label: 'SF count rank',   group: 'Arena', mode: 'arena-sf' },
  { id: 'arena-github',    label: 'GitHub repos',    group: 'Arena', mode: 'arena-github' },
  { id: 'pre-tge',         label: 'Pre-TGE',         group: 'Classic', dataset: 'heatmap',  source: 'pre-tge' },
  { id: 'pre-tge-delta',   label: 'Pre-TGE movers',  group: 'Classic', dataset: 'topDelta', source: 'pre-tge' },
  { id: 'infomarkets',     label: 'Info markets',    group: 'Classic', dataset: 'heatmap',  source: 'infomarkets' },
  { id: 'exchange',        label: 'Exchange',        group: 'Classic', dataset: 'heatmap',  source: 'exchange' },
  { id: 'kols',            label: 'KOL leaderboard', group: 'Classic', dataset: 'kols',     source: 'infomarkets', durations: KOL_DURATIONS },
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
      for (const lang of ['en', 'zh', 'ko']) {
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

  // Delta-all: multi-period gainer table (no duration, one snapshot per vertical)
  out['arena-delta-all'] = {};
  for (const vertical of ARENA_VERTICALS) {
    out['arena-delta-all'][vertical] = snapshotItems(snapshots, `arena-voices-${vertical}`, 'all', 'delta-all').slice(0, 100).map((item, i) => ({
      rank: item?.rank || item?.snapshot_rank || i + 1,
      name: item?.name || item?.username || '',
      username: item?.username || null,
      avatar: item?.avatar || null,
      mindshare: Number(item?.mindshare || item?.last_7d_mindshare || 0),
      d7: Number(item?.change_7d || 0),
      d30: Number(item?.change_30d || 0),
      d3m: Number(item?.change_3m || 0),
      d6m: Number(item?.change_6m || 0),
      d12m: Number(item?.change_12m || 0),
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
  --bg:#0e1117;--surface:#161b24;--surface2:#1c2333;--line:#252d3d;--line2:#2e3a4e;
  --txt:#e2e8f0;--txt2:#8896a8;--txt3:#556070;
  --accent:#c96442;--up:#22c55e;--down:#ef4444;
  --up-dim:rgba(34,197,94,0.15);--down-dim:rgba(239,68,68,0.15);
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden}
body{background:var(--bg);color:var(--txt);font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;font-size:13px;line-height:1.4;display:flex;flex-direction:column}
a{color:inherit;text-decoration:none}
button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}
.topbar{height:42px;border-bottom:1px solid var(--line);display:flex;align-items:center;padding:0 14px;flex-shrink:0;background:var(--surface)}
.logo{font-size:13px;font-weight:600;color:var(--txt);margin-right:14px;white-space:nowrap;letter-spacing:-.01em}
.logo span{color:var(--accent)}
.tabs{display:flex;align-items:stretch;height:100%;flex:1;overflow-x:auto;scrollbar-width:none}
.tabs::-webkit-scrollbar{display:none}
.tab-group{display:flex;align-items:stretch}
.tab-sep{width:1px;background:var(--line);margin:8px 3px;flex-shrink:0}
.tab{display:flex;align-items:center;padding:0 11px;font-size:11px;color:var(--txt2);cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap;height:100%}
.tab:hover{color:var(--txt);background:rgba(255,255,255,0.03)}
.tab.active{color:var(--accent);border-bottom-color:var(--accent);font-weight:500}
.top-right{display:flex;align-items:center;gap:10px;margin-left:12px;flex-shrink:0}
.badge{font-size:11px;color:var(--txt3);font-variant-numeric:tabular-nums}
.top-links a{font-size:11px;color:var(--txt3);margin-left:8px}
.top-links a:hover{color:var(--txt2)}
.filterbar{height:34px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:6px;padding:0 14px;flex-shrink:0;background:var(--surface)}
.seg{display:flex;gap:2px}
.seg button{height:22px;padding:0 8px;font-size:11px;border:1px solid var(--line2);border-radius:4px;color:var(--txt2);background:transparent}
.seg button:hover{border-color:var(--txt3);color:var(--txt)}
.seg button.on{border-color:var(--accent);background:rgba(201,100,66,0.12);color:var(--accent);font-weight:500}
.seg button:disabled{opacity:0.3;cursor:default}
.filter-sep{width:1px;height:14px;background:var(--line2);margin:0 2px}
.row-count{margin-left:auto;font-size:11px;color:var(--txt3);font-variant-numeric:tabular-nums}
.workspace{flex:1;display:flex;overflow:hidden;min-height:0}
.pane-left{flex:1;min-width:0;overflow:hidden;border-right:1px solid var(--line);position:relative}
.pane-right{width:420px;flex-shrink:0;overflow-y:auto}
.treemap-wrap{position:absolute;inset:0;padding:6px}
table{width:100%;border-collapse:collapse}
thead th{position:sticky;top:0;z-index:2;background:var(--surface2);border-bottom:1px solid var(--line2);font-size:10px;font-weight:600;color:var(--txt3);text-transform:uppercase;letter-spacing:.06em;padding:5px 10px;white-space:nowrap}
thead th.r{text-align:right}
tbody tr{border-bottom:1px solid var(--line)}
tbody tr:hover td{background:rgba(255,255,255,0.025)}
td{padding:4px 10px;vertical-align:middle;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.c-rank{width:28px;color:var(--txt3);font-size:11px;font-variant-numeric:tabular-nums;text-align:right;padding-right:6px}
.c-name{width:100%}
.n-main{font-size:12px;font-weight:500;color:var(--txt);display:flex;align-items:center;gap:6px}
.n-sub{font-size:11px;color:var(--txt2);margin-top:1px;padding-left:28px}
.c-ms{width:180px}
.ms-inner{display:flex;align-items:center;gap:5px}
.bar-t{width:70px;flex-shrink:0;height:3px;background:var(--line2);border-radius:2px;overflow:hidden}
.bar-f{height:100%;background:var(--accent);opacity:.75;border-radius:2px;min-width:1px}
.ms-v{font-size:11px;color:var(--txt2);font-variant-numeric:tabular-nums;width:44px;text-align:right;flex-shrink:0}
.c-d{width:72px;text-align:right}
.c-d7,.c-d30,.c-d3m,.c-d6m,.c-d12m{width:64px;text-align:right}
.chip{display:inline-flex;align-items:center;gap:1px;padding:1px 4px;border-radius:3px;font-size:10px;font-weight:600;font-variant-numeric:tabular-nums}
.chip.up{background:var(--up-dim);color:var(--up)}
.chip.dn{background:var(--down-dim);color:var(--down)}
.chip.flat{color:var(--txt3)}
.empty-state{display:flex;align-items:center;justify-content:center;height:100px;color:var(--txt3);font-size:12px}
.treemap-wrap{width:100%;height:100%;padding:8px}
svg.tm{width:100%;height:100%}
.tm-cell{cursor:pointer}
.tm-cell:hover rect{opacity:.82}
</style>
</head>
<body>
<header class="topbar">
  <div class="logo">Kaito<span>.</span>Scan</div>
  <div class="tabs" id="tabs"></div>
  <div class="top-right">
    <span class="badge" id="badge-updated"></span>
    <span class="badge" id="badge-snaps">${totalKeys} snapshots</span>
    <nav class="top-links">
      <a href="/api/status">Status</a>
      <a href="/api/catalog">Catalog</a>
    </nav>
  </div>
</header>
<div class="filterbar">
  <div id="seg-vertical" class="seg" style="display:none">
    <button data-v="stock" class="on">Stock</button>
    <button data-v="ai">AI</button>
    <button data-v="crypto">Crypto</button>
  </div>
  <div class="filter-sep" id="fsep-v" style="display:none"></div>
  <div id="seg-language" class="seg" style="display:none">
    <button data-v="en" class="on">EN</button>
    <button data-v="zh">ZH</button>
    <button data-v="ko">KO</button>
  </div>
  <div class="filter-sep" id="fsep-l" style="display:none"></div>
  <div id="seg-duration" class="seg"></div>
  <span class="row-count" id="row-count"></span>
</div>
<div class="workspace">
  <div class="pane-left" id="pane-left"></div>
  <div class="pane-right" id="pane-right" style="display:none">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px 6px;border-bottom:1px solid var(--line);flex-shrink:0">
      <span style="font-size:13px;font-weight:600;color:var(--txt)">Top Gainer</span>
      <div style="display:flex;gap:3px" id="bps-toggle">
        <button id="btn-abs" style="font-size:11px;padding:2px 8px;border:1px solid var(--line2);border-radius:4px;color:var(--up);background:rgba(34,197,94,0.12);font-weight:500">Absolute (bps)</button>
        <button id="btn-rel" style="font-size:11px;padding:2px 8px;border:1px solid var(--line2);border-radius:4px;color:var(--txt2);background:transparent">Relative (%)</button>
      </div>
    </div>
    <table><thead id="thead-r"></thead><tbody id="tbody-r"></tbody></table>
  </div>
</div>
<script>
const DATA=${payloadJson};
const VIEWS=${viewsJson};
const VOICE_DURATIONS=${JSON.stringify(ARENA_VOICE_DURATIONS)};
const COMPANY_DURATIONS=${JSON.stringify(ARENA_COMPANY_DURATIONS)};
const ALL_DURATIONS=${JSON.stringify(DURATIONS)};
const updatedAt=${JSON.stringify(updatedAt)};
const st={view:'arena-voices',vertical:'stock',duration:'7d',language:'en',deltaCol:'d7',deltaMode:'abs'};

function fmtPct(v,s){const n=Number(v||0);return(s&&n>0?'+':'')+(n*100).toFixed(2)+'%';}
function fmtBps(n){const v=n*10000;return(v>0?'+':'')+v.toFixed(0)+'bps';}
function esc(v){return String(v??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function chip(v,fmt){const n=Number(v||0);const cl=n>0?'up':n<0?'dn':'flat';const ar=n>0?'▲':n<0?'▼':'';return '<span class="chip '+cl+'">'+ar+' '+esc(fmt(n))+'</span>';}
function av(it){if(!it.avatar)return '<span style="display:inline-block;width:22px;height:22px;border-radius:50%;background:var(--line2);flex-shrink:0"></span>';return '<img src="'+esc(it.avatar)+'" width="22" height="22" loading="lazy" onerror="this.style.visibility=&quot;hidden&quot;" style="border-radius:50%;flex-shrink:0">';}

function buildTabs(){
  const el=document.getElementById('tabs');
  const groups={};VIEWS.forEach((v)=>{if(!groups[v.group])groups[v.group]=[];groups[v.group].push(v);});
  const keys=Object.keys(groups);
  el.innerHTML=keys.map((g,gi)=>'<div class="tab-group">'+groups[g].map((v)=>'<button class="tab" data-view="'+esc(v.id)+'">'+esc(v.label)+'</button>').join('')+'</div>'+(gi<keys.length-1?'<div class="tab-sep"></div>':'')).join('');
  el.querySelectorAll('.tab').forEach((b)=>b.addEventListener('click',()=>{st.view=b.dataset.view;render();}));
}

function getItems(){
  const view=VIEWS.find((v)=>v.id===st.view);if(!view)return[];
  if(view.mode==='arena')return((DATA[st.view]||{})[st.vertical]||{})[st.duration]||[];
  if(view.mode==='arena-language')return((((DATA['arena-language']||{})[st.vertical]||{})[st.duration])||{})[st.language]||[];
  if(view.mode==='arena-sf')return((DATA['arena-sf']||{})[st.vertical]||{})[st.duration]||[];
  if(view.mode==='arena-github')return(DATA['arena-github']||{})[st.duration]||[];
  if(view.mode==='arena-delta-all')return(DATA['arena-delta-all']||{})[st.vertical]||[];
  return(DATA[st.view]||{})[st.duration]||[];
}

function getDurations(){
  const view=VIEWS.find((v)=>v.id===st.view);if(!view)return ALL_DURATIONS;
  if(view.mode==='arena')return st.view==='arena-voices'?VOICE_DURATIONS:COMPANY_DURATIONS;
  if(view.mode==='arena-language'||view.mode==='arena-sf')return VOICE_DURATIONS;
  if(view.mode==='arena-github')return VOICE_DURATIONS;
  if(view.mode==='arena-delta-all')return[];
  return view.durations||ALL_DURATIONS;
}

function treemap(items,container){
  const W=container.parentElement.clientWidth||600,H=container.parentElement.clientHeight||400;
  const top=items.slice(0,30);
  const total=top.reduce((s,it)=>s+Math.abs(Number(it.mindshare||0)),0)||1;
  top.forEach((it)=>{it._a=Math.abs(Number(it.mindshare||0))/total*W*H;});
  function sq(nodes,x,y,w,h){
    if(!nodes.length)return[];
    const res=[];let rem=[...nodes];let cx=x,cy=y,cw=w,ch=h;
    while(rem.length){
      const hz=cw>=ch;const sh=hz?ch:cw;let row=[];let ra=0;let best=Infinity;
      for(let i=0;i<rem.length;i++){row.push(rem[i]);ra+=rem[i]._a;const rl=ra/sh;const ww=row.reduce((m,n)=>Math.max(m,Math.max(n._a/rl,rl/(n._a||1))),0);if(ww>best){row.pop();ra-=rem[i]._a;break;}best=ww;}
      if(!row.length){row=[rem[0]];ra=rem[0]._a;}
      const rl=ra/sh;let pos=hz?cy:cx;
      row.forEach((n)=>{res.push(hz?{x:cx,y:pos,w:rl,h:n._a/rl,item:n}:{x:pos,y:cy,w:n._a/rl,h:rl,item:n});pos+=n._a/rl;});
      if(hz){cx+=rl;cw-=rl;}else{cy+=rl;ch-=rl;}
      rem=rem.slice(row.length);
    }
    return res;
  }
  const rects=sq(top,0,0,W,H);
  const svg=rects.map((r,ri)=>{
    const it=r.item;const d=Number(it.delta||0);
    const fill=d>0.003?'#1a3a2a':d<-0.003?'#3a1a1a':'#1c2333';
    const tc=d>0.003?'#4ade80':d<-0.003?'#f87171':'#94a3b8';
    const fs=Math.min(16,Math.max(9,Math.sqrt(r.w*r.h)/7));
    const pad=6;
    let inner='';
    // avatar circle top-left (only if cell large enough)
    if(r.w>60&&r.h>40&&it.avatar){
      const aSize=Math.min(24,Math.floor(r.h/4));
      inner+='<image href="'+esc(it.avatar)+'" x="'+(r.x+pad)+'" y="'+(r.y+pad)+'" width="'+aSize+'" height="'+aSize+'" clip-path="url(#cp'+ri+')" preserveAspectRatio="xMidYMid slice"/>';
      inner+='<clipPath id="cp'+ri+'"><circle cx="'+(r.x+pad+aSize/2)+'" cy="'+(r.y+pad+aSize/2)+'" r="'+(aSize/2)+'"/></clipPath>';
    }
    // rank badge top-right (top 3 only)
    if(it.rank<=3&&r.w>60&&r.h>30){
      inner+='<text x="'+(r.x+r.w-pad)+'" y="'+(r.y+pad+14)+'" font-size="14px" font-weight="700" fill="rgba(255,255,255,0.5)" text-anchor="end" dominant-baseline="auto" style="pointer-events:none">'+esc(String(it.rank))+'</text>';
    }
    // name
    if(r.w>44&&r.h>30){
      const avatarH=(r.w>60&&r.h>40&&it.avatar)?Math.min(24,Math.floor(r.h/4))+4:0;
      const nameY=r.y+pad+avatarH+(avatarH>0?4:0);
      inner+='<text x="'+(r.x+pad)+'" y="'+nameY+'" font-size="'+fs+'px" font-weight="700" fill="'+tc+'" dominant-baseline="hanging" style="pointer-events:none">'+esc(it.name)+'</text>';
      if(r.h>nameY-r.y+fs+14){
        inner+='<text x="'+(r.x+pad)+'" y="'+(nameY+fs+3)+'" font-size="11px" fill="'+tc+'" opacity=".8" dominant-baseline="hanging" style="pointer-events:none">'+esc((Math.abs(Number(it.mindshare||0))*100).toFixed(2)+'%')+'</text>';
      }
    }
    // sparkline placeholder (filled by fetchSparklines)
    inner+='<g class="spark" data-uid="'+(it.username||'')+'" data-x="'+r.x+'" data-y="'+r.y+'" data-w="'+r.w+'" data-h="'+r.h+'" data-tc="'+tc+'"></g>';
    return '<g class="tm-cell"><rect x="'+(r.x+1)+'" y="'+(r.y+1)+'" width="'+(r.w-2)+'" height="'+(r.h-2)+'" fill="'+fill+'" rx="3"/><defs></defs>'+inner+'</g>';
  }).join('');
  container.innerHTML='<svg class="tm" id="tm-svg" viewBox="0 0 '+W+' '+H+'">'+svg+'</svg>';
}

function fetchSparklines(items,vertical){
  const uids=items.slice(0,30).filter(it=>it.username).map(it=>it.username).join(',');
  if(!uids)return;
  const vmap={stock:'trading',ai:'ai',crypto:'crypto'};
  const v=vmap[vertical]||vertical;
  fetch('/api/proxy/mindshare-line?user_ids='+encodeURIComponent(uids)+'&vertical='+v+'&duration=7d')
    .then(r=>r.ok?r.json():null).then(data=>{
      if(!data)return;
      document.querySelectorAll('.spark').forEach(g=>{
        const uid=g.dataset.uid;if(!uid||!data[uid])return;
        const vals=data[uid];if(!vals||vals.length<2)return;
        const x=Number(g.dataset.x),y=Number(g.dataset.y),w=Number(g.dataset.w),h=Number(g.dataset.h),tc=g.dataset.tc;
        if(w<40||h<30)return;
        const sparkH=Math.min(30,h*0.25);const sparkY=y+h-sparkH-4;const sparkX=x+4;const sparkW=w-8;
        const mn=Math.min(...vals),mx=Math.max(...vals),range=mx-mn||1;
        const pts=vals.map((v2,i)=>{
          const px=sparkX+i/(vals.length-1)*sparkW;
          const py=sparkY+sparkH-(v2-mn)/range*sparkH;
          return px+','+py;
        }).join(' ');
        g.innerHTML='<polyline points="'+pts+'" fill="none" stroke="'+tc+'" stroke-width="1.2" opacity=".55"/>';
      });
    }).catch(()=>{});
}

function renderDeltaRight(items,activeCol){
  const cols=['d7','d30','d3m','d6m','d12m'];
  const colLabels={'d7':'Δ7D','d30':'Δ30D','d3m':'Δ3M','d6m':'Δ6M','d12m':'Δ12M'};
  const ac=activeCol||'d7';
  const thCells=cols.map(c=>'<th class="r dt-col" data-col="'+c+'" style="width:64px;cursor:pointer'+(c===ac?';background:rgba(34,197,94,0.1);color:#4ade80':'')+'">'+(c===ac?'▶ ':'')+colLabels[c]+'</th>').join('');
  document.getElementById('thead-r').innerHTML='<tr><th class="c-rank">#</th><th>Name</th><th class="r" style="width:60px">Current</th>'+thCells+'</tr>';
  document.getElementById('tbody-r').innerHTML=items.slice(0,50).map(it=>{
    const cells=cols.map(c=>{
      const val=Number(it[c]||0);
      const isAc=c===ac;
      const bps=(val*10000).toFixed(0);
      const cl=val>0?'up':val<0?'dn':'flat';
      const ar=val>0?'▲':val<0?'▼':'';
      const style=isAc?'background:rgba(34,197,94,0.07)':'';
      return '<td class="r dt-col" data-col="'+c+'" style="'+style+'"><span class="chip '+cl+'">'+ar+' '+(val>0?'+':'')+bps+'bps'+'</span></td>';
    }).join('');
    return '<tr><td class="c-rank">'+esc(it.rank)+'</td><td class="c-name"><div class="n-main">'+av(it)+esc(it.name)+'</div></td><td class="r" style="color:var(--txt2)">'+esc(fmtPct(it.mindshare,false))+'</td>'+cells+'</tr>';
  }).join('')||'<tr><td colspan="8"><div class="empty-state">No data yet</div></td></tr>';
  // click to switch active column
  document.querySelectorAll('#thead-r .dt-col').forEach(th=>{
    th.addEventListener('click',()=>{
      st.deltaCol=th.dataset.col;
      renderDeltaRight((DATA['arena-delta-all']||{})[st.vertical]||[],st.deltaCol);
    });
  });
}

function renderTable(thead,tbody,items,view){
  const isKol=view.id==='kols';
  const isDelta=view.mode==='arena-delta-all';
  const isSF=view.mode==='arena-sf';
  const isGH=view.mode==='arena-github';
  if(isDelta){
    thead.innerHTML='<tr><th class="c-rank">#</th><th>Name</th><th class="r">Current</th><th class="r c-d7">Δ7D</th><th class="r c-d30">Δ30D</th><th class="r c-d3m">Δ3M</th><th class="r c-d6m">Δ6M</th><th class="r c-d12m">Δ12M</th></tr>';
    tbody.innerHTML=items.slice(0,100).map((it)=>'<tr><td class="c-rank">'+esc(it.rank)+'</td><td class="c-name"><div class="n-main">'+av(it)+esc(it.name)+'</div></td><td class="c-d r">'+esc(fmtPct(it.mindshare,false))+'</td><td class="c-d7">'+chip(it.d7,(n)=>fmtBps(n))+'</td><td class="c-d30">'+chip(it.d30,(n)=>fmtBps(n))+'</td><td class="c-d3m">'+chip(it.d3m,(n)=>fmtBps(n))+'</td><td class="c-d6m">'+chip(it.d6m,(n)=>fmtBps(n))+'</td><td class="c-d12m">'+chip(it.d12m,(n)=>fmtBps(n))+'</td></tr>').join('')||'<tr><td colspan="8"><div class="empty-state">No data yet</div></td></tr>';
    return;
  }
  if(isGH){
    const mx=Math.max(...items.map((it)=>Number(it.score||0)),0.001);
    thead.innerHTML='<tr><th class="c-rank">#</th><th>Repo</th><th class="r">Score</th><th class="r">Stars</th><th class="r">Forks</th></tr>';
    tbody.innerHTML=items.map((it)=>{const bw=Math.round(Number(it.score||0)/mx*100);return '<tr><td class="c-rank">'+esc(it.rank)+'</td><td class="c-name"><div class="n-main">'+(it.url?'<a href="'+esc(it.url)+'" target="_blank" style="color:var(--accent)">'+esc(it.name)+'</a>':esc(it.name))+'</div>'+(it.sub?'<div class="n-sub">'+esc(it.sub)+'</div>':'')+'</td><td class="c-ms"><div class="ms-inner"><div class="bar-t"><div class="bar-f" style="width:'+bw+'%"></div></div><span class="ms-v">'+esc(it.score.toFixed(1))+'</span></div></td><td class="r" style="color:var(--txt2)">★ '+esc(it.stars.toLocaleString())+'</td><td class="r" style="color:var(--txt2)">'+esc(it.forks.toLocaleString())+'</td></tr>';}).join('')||'<tr><td colspan="5"><div class="empty-state">No data yet</div></td></tr>';
    return;
  }
  if(isSF){
    const mx=Math.max(...items.map((it)=>Number(it.count||0)),1);
    thead.innerHTML='<tr><th class="c-rank">#</th><th>Account</th><th>Smart followers</th><th class="r c-d">Change</th></tr>';
    tbody.innerHTML=items.map((it)=>{const bw=Math.round(Number(it.count||0)/mx*100);const ch=Number(it.change||0);return '<tr><td class="c-rank">'+esc(it.rank)+'</td><td class="c-name"><div class="n-main">'+av(it)+esc(it.name)+'</div></td><td class="c-ms"><div class="ms-inner"><div class="bar-t"><div class="bar-f" style="width:'+bw+'%"></div></div><span class="ms-v">'+esc(Number(it.count).toLocaleString())+'</span></div></td><td class="c-d">'+chip(ch,(n)=>(n>0?'+':'')+Math.round(n).toLocaleString())+'</td></tr>';}).join('')||'<tr><td colspan="4"><div class="empty-state">No data yet</div></td></tr>';
    return;
  }
  const mx=Math.max(...items.map((it)=>Math.abs(Number(it.mindshare||0))),0.0001);
  const signed=items[0]?.signed||false;
  const hasAv=items.some((it)=>it.avatar);
  thead.innerHTML='<tr><th class="c-rank">#</th><th>'+(isKol?'Account':'Name')+'</th><th>Mindshare</th><th class="r c-d">Delta</th></tr>';
  tbody.innerHTML=items.map((it)=>{const ms=Number(it.mindshare||0);const d=Number(it.delta||0);const bw=Math.round(Math.abs(ms)/mx*100);return '<tr><td class="c-rank">'+esc(it.rank)+'</td><td class="c-name"><div class="n-main">'+(hasAv?av(it):'')+esc(it.name)+'</div>'+(it.sub?'<div class="n-sub">'+esc(it.sub)+'</div>':'')+'</td><td class="c-ms"><div class="ms-inner"><div class="bar-t"><div class="bar-f" style="width:'+bw+'%"></div></div><span class="ms-v">'+esc(fmtPct(ms,signed))+'</span></div></td><td class="c-d">'+chip(d,(n)=>fmtPct(n,true))+'</td></tr>';}).join('')||'<tr><td colspan="4"><div class="empty-state">No data yet</div></td></tr>';
}

function render(){
  const view=VIEWS.find((v)=>v.id===st.view);if(!view)return;
  document.querySelectorAll('.tab').forEach((b)=>b.classList.toggle('active',b.dataset.view===st.view));

  const hasV=view.mode==='arena'||view.mode==='arena-language'||view.mode==='arena-sf'||view.mode==='arena-delta-all';
  const hasL=view.mode==='arena-language';
  const hasDur=view.mode!=='arena-delta-all';
  const isArenaMain=view.mode==='arena';

  const segV=document.getElementById('seg-vertical');
  const fsepV=document.getElementById('fsep-v');
  const segL=document.getElementById('seg-language');
  const fsepL=document.getElementById('fsep-l');
  const segD=document.getElementById('seg-duration');
  segV.style.display=hasV?'':'none';fsepV.style.display=hasV?'':'none';
  segL.style.display=hasL?'':'none';fsepL.style.display=hasL?'':'none';
  segD.style.display=hasDur?'':'none';
  if(hasV)segV.querySelectorAll('button').forEach((b)=>b.classList.toggle('on',b.dataset.v===st.vertical));
  if(hasL)segL.querySelectorAll('button').forEach((b)=>b.classList.toggle('on',b.dataset.v===st.language));
  if(hasDur){
    const dur=getDurations();if(!dur.includes(st.duration))st.duration=dur[0];
    segD.innerHTML=dur.map((d)=>'<button data-v="'+d+'" class="'+(d===st.duration?'on':'')+'">' +d+'</button>').join('');
    segD.querySelectorAll('button').forEach((b)=>b.addEventListener('click',()=>{st.duration=b.dataset.v;render();}));
  }

  const pL=document.getElementById('pane-left');
  const pR=document.getElementById('pane-right');
  const items=getItems();

  if(isArenaMain){
    pR.style.display='';
    const tw=document.createElement('div');tw.className='treemap-wrap';
    pL.innerHTML='';pL.appendChild(tw);
    requestAnimationFrame(()=>{
      treemap(items,tw);
      fetchSparklines(items,st.vertical);
    });
    renderDeltaRight((DATA['arena-delta-all']||{})[st.vertical]||[],st.deltaCol);
  } else {
    pR.style.display='none';
    pL.innerHTML='<table><thead id="thead-l"></thead><tbody id="tbody-l"></tbody></table>';
    renderTable(document.getElementById('thead-l'),document.getElementById('tbody-l'),items,view);
  }
  document.getElementById('row-count').textContent=items.length+' items';
}

document.getElementById('seg-vertical').querySelectorAll('button').forEach((b)=>b.addEventListener('click',()=>{st.vertical=b.dataset.v;render();}));
document.getElementById('seg-language').querySelectorAll('button').forEach((b)=>b.addEventListener('click',()=>{st.language=b.dataset.v;render();}));
if(updatedAt){const d=new Date(updatedAt);document.getElementById('badge-updated').textContent='Updated '+d.toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});}
document.getElementById('btn-abs').addEventListener('click',()=>{
  st.deltaMode='abs';
  document.getElementById('btn-abs').style.cssText='font-size:11px;padding:2px 8px;border:1px solid var(--line2);border-radius:4px;color:var(--up);background:rgba(34,197,94,0.12);font-weight:500';
  document.getElementById('btn-rel').style.cssText='font-size:11px;padding:2px 8px;border:1px solid var(--line2);border-radius:4px;color:var(--txt2);background:transparent';
  renderDeltaRight((DATA['arena-delta-all']||{})[st.vertical]||[],st.deltaCol);
});
document.getElementById('btn-rel').addEventListener('click',()=>{
  st.deltaMode='rel';
  document.getElementById('btn-rel').style.cssText='font-size:11px;padding:2px 8px;border:1px solid var(--line2);border-radius:4px;color:var(--up);background:rgba(34,197,94,0.12);font-weight:500';
  document.getElementById('btn-abs').style.cssText='font-size:11px;padding:2px 8px;border:1px solid var(--line2);border-radius:4px;color:var(--txt2);background:transparent';
  renderDeltaRight((DATA['arena-delta-all']||{})[st.vertical]||[],st.deltaCol);
});
buildTabs();render();
window.addEventListener('resize',()=>{const v=VIEWS.find((x)=>x.id===st.view);if(v&&v.mode==='arena')render();});
</script>
</body>
</html>`;
}

module.exports = { renderDashboard };
