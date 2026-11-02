#!/usr/bin/env node
// kaito-probe.js — explore Kaito hub API endpoints without an account
// Usage: node kaito-probe.js 2>&1 | tee probe-results.json

const crypto = require('crypto');
const CryptoJS = require('crypto-js');
const fs = require('fs/promises');

const BASE_URL = 'https://hub.kaito.ai/api/v1';
const AI_BASE_URL = `${BASE_URL}/gateway/ai`;
const ARENA_BASE_URL = BASE_URL;
const RESPONSE_KEY_HEX = 'ab962e791e6675b2';
const RESPONSE_IV_HEX = '22d28b1b5b4e0a4d';

const DEFAULT_HEADERS = {
  accept: 'application/json, text/plain, */*',
  'accept-language': 'en-US,en;q=0.9',
  origin: 'https://kaito.ai',
  referer: 'https://kaito.ai/',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
};

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function hashHex(input) { return crypto.createHash('sha256').update(input).digest('hex'); }

function isValidHash(hash, difficulty) {
  const whole = Math.floor(difficulty);
  const frac = difficulty - whole;
  const threshold = Math.ceil(16 * (1 - frac)) % 16;
  if (!hash.startsWith('0'.repeat(whole))) return false;
  if (frac === 0) return true;
  return parseInt(hash.charAt(whole), 16) < threshold;
}

function solvePow(challenge, difficulty) {
  let nonce = 0;
  for (;;) {
    const hash = hashHex(`${challenge}:${nonce}`);
    if (isValidHash(hash, difficulty)) return { nonce: String(nonce), hash };
    nonce++;
  }
}

function decryptV1(ciphertext) {
  const dec = CryptoJS.DES.decrypt(
    { ciphertext: CryptoJS.enc.Base64.parse(ciphertext) },
    CryptoJS.enc.Hex.parse(RESPONSE_KEY_HEX),
    { iv: CryptoJS.enc.Hex.parse(RESPONSE_IV_HEX), mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
  ).toString(CryptoJS.enc.Utf8);
  if (!dec) throw new Error('DES decryption empty');
  return dec;
}

async function readPayload(res, label) {
  const text = await res.text();
  const enc = res.headers.get('encryption');
  const ver = res.headers.get('encryptionversion');
  let body = text;
  if (enc === 'true') {
    if (ver !== 'v1') throw new Error(`Unknown encryption ${ver} for ${label}`);
    body = decryptV1(text);
  }
  return JSON.parse(body);
}

async function getPowHeaders() {
  const res = await fetch(`${BASE_URL}/analysis/session/validate`, { headers: DEFAULT_HEADERS });
  if (!res.ok) throw new Error(`Challenge ${res.status}`);
  const data = await readPayload(res, 'challenge');
  const { nonce, hash } = solvePow(data.challenge, Number(data.difficulty));
  return { 'x-challenge': data.challenge, 'x-nonce': nonce, 'x-hash': hash };
}

async function probe(baseUrl, route, params, label) {
  await sleep(600);
  try {
    const pow = await getPowHeaders();
    const url = new URL(route, `${baseUrl}/`);
    Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') url.searchParams.set(k, String(v)); });
    const res = await fetch(url, { headers: { ...DEFAULT_HEADERS, ...pow } });
    const status = res.status;
    if (!res.ok) {
      const body = await res.text();
      return { label, url: url.toString(), status, ok: false, error: body.slice(0, 200) };
    }
    const data = await readPayload(res, label);
    const items = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : Array.isArray(data?.items) ? data.items : Array.isArray(data?.result) ? data.result : [];
    const keys = items.length > 0 ? Object.keys(items[0]) : (typeof data === 'object' ? Object.keys(data) : []);
    return { label, url: url.toString(), status, ok: true, itemCount: items.length, topLevelKeys: typeof data === 'object' ? Object.keys(data) : [], itemKeys: keys, sample: items.slice(0, 2) };
  } catch (err) {
    return { label, status: 0, ok: false, error: String(err.message).slice(0, 200) };
  }
}

async function main() {
  const results = [];
  const log = (r) => { results.push(r); process.stderr.write(`[${r.ok ? 'OK ' : 'ERR'}] ${r.label}: status=${r.status} items=${r.itemCount ?? '-'} keys=${(r.itemKeys || []).join(',')}\n`); };

  const verticals = { voices: ['trading', 'ai', 'crypto'], companies: ['equity', 'ai', 'crypto'] };
  const durations = ['7d', '30d', '3m'];

  // 1. Existing sector leaderboard (sector=ALL) — baseline
  for (const [mode, verts] of Object.entries(verticals)) {
    const companyPrefix = mode === 'companies' ? 'company_' : '';
    for (const v of verts) {
      for (const dur of durations) {
        log(await probe(ARENA_BASE_URL, `voices/${v}/${companyPrefix}sector_leaderboard`, { sector: 'ALL', duration: dur, offset: 0, limit: 5 }, `${mode}/${v}/sector_leaderboard/${dur}`));
      }
    }
  }

  // 2. Sector leaderboard with specific sectors (voices/trading)
  const sectors = ['DeFi', 'L1', 'L2', 'NFT', 'Gaming', 'Infra', 'Meme', 'RWA', 'AI', 'Exchange'];
  for (const sector of sectors) {
    log(await probe(ARENA_BASE_URL, `voices/trading/sector_leaderboard`, { sector, duration: '7d', offset: 0, limit: 5 }, `voices/trading/sector/${sector}`));
  }

  // 3. Region leaderboard — try different endpoint names
  const regionRoutes = [
    'voices/trading/region_leaderboard',
    'voices/trading/language_leaderboard',
    'voices/trading/geo_leaderboard',
    'voices/crypto/region_leaderboard',
  ];
  for (const route of regionRoutes) {
    log(await probe(ARENA_BASE_URL, route, { duration: '7d', offset: 0, limit: 5 }, `probe/${route}`));
    log(await probe(ARENA_BASE_URL, route, { region: 'EN', duration: '7d', offset: 0, limit: 5 }, `probe/${route}/EN`));
    log(await probe(ARENA_BASE_URL, route, { language: 'en', duration: '7d', offset: 0, limit: 5 }, `probe/${route}/lang`));
  }

  // 4. Smart following / trending
  const sfRoutes = [
    'voices/trading/smart_following_leaderboard',
    'voices/trading/trending_leaderboard',
    'voices/trading/smart_follower_leaderboard',
    'voices/crypto/smart_following_leaderboard',
    'kol/smart_following/leaderboard',
    'kol/trending/leaderboard',
  ];
  for (const route of sfRoutes) {
    log(await probe(ARENA_BASE_URL, route, { duration: '7d', offset: 0, limit: 5 }, `probe/${route}`));
    log(await probe(AI_BASE_URL, route.replace(/^voices\//, 'kol/'), { duration: '7d', limit: 5 }, `probe/ai/${route}`));
  }

  // 5. topGainer absolute vs relative toggle
  log(await probe(AI_BASE_URL, 'tickers/mindshare', { api_version: 'v2', nft: 'false', ex_official: 'false', weighted: 'false', sort_type: 'desc', type: 'topGainer', duration: '7d', pre_tge: 'true', top_gainer_type: 'absolute' }, 'topGainer/absolute'));
  log(await probe(AI_BASE_URL, 'tickers/mindshare', { api_version: 'v2', nft: 'false', ex_official: 'false', weighted: 'false', sort_type: 'desc', type: 'topGainer', duration: '7d', pre_tge: 'true', top_gainer_type: 'relative' }, 'topGainer/relative'));
  log(await probe(AI_BASE_URL, 'tickers/mindshare', { api_version: 'v2', nft: 'false', ex_official: 'false', weighted: 'false', sort_type: 'desc', type: 'topGainer', duration: '7d', pre_tge: 'true', metric: 'absolute' }, 'topGainer/metric-absolute'));

  // 6. CT leaderboard
  const ctRoutes = [
    'kol/ct/leaderboard', 'kol/ct_leaderboard', 'kol/mindshare/ct-leaderboard',
    'voices/trading/ct_leaderboard', 'ct/leaderboard',
  ];
  for (const route of ctRoutes) {
    log(await probe(AI_BASE_URL, route, { duration: '7d', limit: 5 }, `probe/ct/${route}`));
    log(await probe(ARENA_BASE_URL, route, { duration: '7d', limit: 5 }, `probe/ct-arena/${route}`));
  }

  // 7. VCArena
  const vcRoutes = [
    'vcarena/leaderboard', 'vc/leaderboard', 'vc/mindshare/leaderboard',
    'voices/vc/sector_leaderboard', 'kol/vc/leaderboard',
  ];
  for (const route of vcRoutes) {
    log(await probe(AI_BASE_URL, route, { duration: '7d', limit: 5 }, `probe/vc/${route}`));
    log(await probe(ARENA_BASE_URL, route, { duration: '7d', limit: 5 }, `probe/vc-arena/${route}`));
  }

  // 8. Additional Arena page sizes
  log(await probe(ARENA_BASE_URL, 'voices/trading/sector_leaderboard', { sector: 'ALL', duration: '7d', offset: 20, limit: 5 }, 'voices/trading/offset-20'));
  log(await probe(ARENA_BASE_URL, 'voices/trading/sector_leaderboard', { sector: 'ALL', duration: '7d', offset: 50, limit: 5 }, 'voices/trading/offset-50'));

  const out = JSON.stringify(results, null, 2);
  await fs.writeFile('probe-results.json', out);
  process.stderr.write(`\nDone. ${results.length} probes. Results saved to probe-results.json\n`);
  process.stderr.write(`OK: ${results.filter((r) => r.ok).length}  ERR: ${results.filter((r) => !r.ok).length}\n`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
