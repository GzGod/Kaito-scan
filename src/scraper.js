const crypto = require('crypto');
const CryptoJS = require('crypto-js');

const BASE_URL = 'https://hub.kaito.ai/api/v1';
const AI_BASE_URL = `${BASE_URL}/gateway/ai`;
const RESPONSE_KEY_HEX = 'ab962e791e6675b2';
const RESPONSE_IV_HEX = '22d28b1b5b4e0a4d';
const REQUEST_DELAY_MS = 500;
const RATE_LIMIT_DELAY_MS = 20000;
const MAX_ATTEMPTS = 6;
const CONCURRENCY = Number(process.env.SCRAPE_CONCURRENCY || 6);
const RATE_LIMIT_RECOVERY_MS = Number(process.env.SCRAPE_RATE_LIMIT_RECOVERY_MS || 5000);
const FETCH_TIMEOUT_MS = Number(process.env.SCRAPE_FETCH_TIMEOUT_MS || 30000);
const DURATIONS = ['24h', '7d', '30d', '3m', '6m', '12m'];
const KOL_DURATIONS = ['7d', '30d', '3m', '6m', '12m'];

const metrics = {
  challengeRequests: 0,
  challengeMs: 0,
  challengeRetries: 0,
  powMs: 0,
  protectedRequests: 0,
  protectedMs: 0,
  rateLimits: 0,
  transientErrors: 0,
  globalRateLimitWaits: 0,
};

let rateLimitUntil = 0;
let serialUntil = 0;
let serialQueue = Promise.resolve();

function resetMetrics() {
  Object.keys(metrics).forEach((key) => {
    metrics[key] = 0;
  });
}

function getMetrics() {
  return { ...metrics };
}

async function waitForGlobalRateLimit() {
  const waitMs = rateLimitUntil - Date.now();
  if (waitMs <= 0) return;
  metrics.globalRateLimitWaits += 1;
  await sleep(waitMs);
}

async function runWithTemporarySerialGate(fn) {
  if (Date.now() >= serialUntil) return fn();
  const previous = serialQueue;
  let release;
  serialQueue = new Promise((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}

const DEFAULT_HEADERS = {
  accept: 'application/json, text/plain, */*',
  'accept-language': 'en-US,en;q=0.9',
  origin: 'https://kaito.ai',
  referer: 'https://kaito.ai/',
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
};

function tickerMindshareJob({ source, dataset, duration, params }) {
  return {
    key: `${source}:${duration}:${dataset}`,
    source,
    dataset,
    duration,
    route: 'tickers/mindshare',
    params: { ...params, duration },
  };
}

function kolMindshareJob({ source, duration, params }) {
  return {
    key: `${source}:${duration}:kols`,
    source,
    dataset: 'kols',
    duration,
    route: 'kol/mindshare/top-leaderboard',
    params: { ...params, duration },
  };
}

function tickerJobs() {
  return DURATIONS.flatMap((duration) => [
    tickerMindshareJob({
      source: 'pre-tge',
      dataset: 'heatmap',
      duration,
      params: {
        api_version: 'v2',
        nft: 'false',
        ex_official: 'false',
        weighted: 'false',
        sort_type: 'desc',
        type: 'heatmap',
        pre_tge: 'true',
      },
    }),
    tickerMindshareJob({
      source: 'pre-tge',
      dataset: 'topDelta',
      duration,
      params: {
        api_version: 'v2',
        nft: 'false',
        ex_official: 'false',
        weighted: 'false',
        sort_type: 'asc',
        type: 'topDelta',
        pre_tge: 'true',
      },
    }),
    tickerMindshareJob({
      source: 'infomarkets',
      dataset: 'heatmap',
      duration,
      params: {
        api_version: 'v2',
        nft: 'false',
        ex_official: 'false',
        weighted: 'false',
        sort_type: 'desc',
        type: 'heatmap',
        topic_id: 'INFOMKT',
      },
    }),
    tickerMindshareJob({
      source: 'exchange',
      dataset: 'heatmap',
      duration,
      params: {
        api_version: 'v2',
        nft: 'false',
        ex_official: 'false',
        weighted: 'true',
        categories: 'EXCHANGE',
        sort_type: 'desc',
        type: 'heatmap',
      },
    }),
  ]);
}

function kolJobs() {
  return KOL_DURATIONS.map((duration) => kolMindshareJob({
    source: 'infomarkets',
    duration,
    params: {
      top_n: 100,
      topic_id: 'INFOMKT',
      community_tier: 'tier1',
      language_filter: 'all',
    },
  }));
}

function buildJobs() {
  return [...tickerJobs(), ...kolJobs()];
}

const JOBS = buildJobs();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function hashHex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function isValidHash(hash, difficulty) {
  const whole = Math.floor(difficulty);
  const fractional = difficulty - whole;
  const threshold = Math.ceil(16 * (1 - fractional)) % 16;
  const prefix = '0'.repeat(whole);
  if (!hash.startsWith(prefix)) return false;
  if (fractional === 0) return true;
  return Number.parseInt(hash.charAt(whole), 16) < threshold;
}

function solvePow(challenge, difficulty) {
  let nonce = 0;
  for (;;) {
    const payload = `${challenge}:${nonce}`;
    const hash = hashHex(payload);
    if (isValidHash(hash, difficulty)) return { nonce: String(nonce), hash };
    nonce += 1;
  }
}

function decryptV1Payload(ciphertext) {
  const decrypted = CryptoJS.DES.decrypt(
    { ciphertext: CryptoJS.enc.Base64.parse(ciphertext) },
    CryptoJS.enc.Hex.parse(RESPONSE_KEY_HEX),
    {
      iv: CryptoJS.enc.Hex.parse(RESPONSE_IV_HEX),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    }
  ).toString(CryptoJS.enc.Utf8);
  if (!decrypted) throw new Error('DES decryption returned empty plaintext');
  return decrypted;
}

async function readResponsePayload(response, label) {
  const text = await response.text();
  const encryption = response.headers.get('encryption');
  const encryptionVersion = response.headers.get('encryptionversion');
  let payloadText = text;
  if (encryption === 'true') {
    if (encryptionVersion !== 'v1') {
      throw new Error(`Unsupported encryption version for ${label}: ${encryptionVersion}`);
    }
    payloadText = decryptV1Payload(text);
  }
  return JSON.parse(payloadText);
}

async function getPowHeaders() {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    await waitForGlobalRateLimit();
    const challengeStartedAt = performance.now();
    metrics.challengeRequests += 1;
    const response = await fetchWithTimeout(`${BASE_URL}/analysis/session/validate`, { headers: DEFAULT_HEADERS });
    metrics.challengeMs += performance.now() - challengeStartedAt;
    if (response.ok) {
      const data = await readResponsePayload(response, 'challenge');
      const powStartedAt = performance.now();
      const { nonce, hash } = solvePow(data.challenge, Number(data.difficulty));
      metrics.powMs += performance.now() - powStartedAt;
      return {
        'x-challenge': data.challenge,
        'x-nonce': nonce,
        'x-hash': hash,
      };
    }

    lastError = new Error(`Challenge request failed: ${response.status} ${response.statusText}`);
    if ([429, 502, 503, 504].includes(response.status) && attempt < MAX_ATTEMPTS) {
      metrics.challengeRetries += 1;
      const delay = response.status === 429
        ? RATE_LIMIT_DELAY_MS + Math.floor(Math.random() * 3000)
        : REQUEST_DELAY_MS * attempt + Math.floor(Math.random() * 1000);
      if (response.status === 429) rateLimitUntil = Math.max(rateLimitUntil, Date.now() + delay);
      await sleep(delay);
      continue;
    }
    throw lastError;
  }
  throw lastError;
}

async function fetchProtectedJson(route, params, label) {
  const url = new URL(route, `${AI_BASE_URL}/`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });

  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 1) await sleep(REQUEST_DELAY_MS);
    await waitForGlobalRateLimit();
    const powHeaders = await getPowHeaders();
    await waitForGlobalRateLimit();
    const protectedStartedAt = performance.now();
    metrics.protectedRequests += 1;
    const response = await runWithTemporarySerialGate(() => fetchWithTimeout(url, { headers: { ...DEFAULT_HEADERS, ...powHeaders } }));
    metrics.protectedMs += performance.now() - protectedStartedAt;
    if (response.ok) return readResponsePayload(response, label);

    const body = await response.text();
    lastError = new Error(`${label} failed on attempt ${attempt}: ${response.status} ${response.statusText}\n${body.slice(0, 300)}`);
    if (response.status === 429) {
      metrics.rateLimits += 1;
      const delay = RATE_LIMIT_DELAY_MS + Math.floor(Math.random() * 3000);
      rateLimitUntil = Math.max(rateLimitUntil, Date.now() + delay);
      serialUntil = Math.max(serialUntil, Date.now() + delay + RATE_LIMIT_RECOVERY_MS);
      console.log(`[rate-limit] ${label} 429, wait ${Math.round(delay / 1000)}s`);
      await sleep(delay);
      continue;
    }
    if ([502, 503, 504].includes(response.status) && attempt < MAX_ATTEMPTS) {
      metrics.transientErrors += 1;
      const delay = REQUEST_DELAY_MS * attempt + Math.floor(Math.random() * 1000);
      console.log(`[transient] ${label} ${response.status}, retry in ${delay}ms`);
      await sleep(delay);
      continue;
    }
    throw lastError;
  }
  throw lastError;
}

function normalizeItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function runner() {
    for (;;) {
      const current = nextIndex++;
      if (current >= items.length) return;
      results[current] = await worker(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runner()));
  return results;
}

async function scrapeLive() {
  resetMetrics();
  const startedAt = new Date().toISOString();
  const snapshots = await runWithConcurrency(JOBS, CONCURRENCY, async (job) => {
    const payload = await fetchProtectedJson(job.route, job.params, job.key);
    const items = normalizeItems(payload);
    return {
      key: job.key,
      source: job.source,
      dataset: job.dataset,
      duration: job.duration,
      route: job.route,
      params: job.params,
      updatedAt: new Date().toISOString(),
      count: items.length,
      data: payload,
    };
  });

  return {
    startedAt,
    completedAt: new Date().toISOString(),
    concurrency: CONCURRENCY,
    metrics: getMetrics(),
    snapshots,
  };
}

module.exports = {
  DURATIONS,
  KOL_DURATIONS,
  JOBS,
  buildJobs,
  getMetrics,
  normalizeItems,
  scrapeLive,
};

