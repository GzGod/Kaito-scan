#!/usr/bin/env node

const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const CryptoJS = require("crypto-js");

const BASE_URL = "https://hub.kaito.ai/api/v1";
const AI_BASE_URL = `${BASE_URL}/gateway/ai`;
const OUTPUT_DIR = path.join(process.cwd(), "output");
const RESPONSE_KEY_HEX = "ab962e791e6675b2";
const RESPONSE_IV_HEX = "22d28b1b5b4e0a4d";
const REQUEST_DELAY_MS = 500;
const RATE_LIMIT_DELAY_MS = 20000;
const CONCURRENCY = 5;

const DEFAULT_HEADERS = {
  accept: "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  origin: "https://kaito.ai",
  referer: "https://kaito.ai/",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
};

const JOBS = [
  {
    source: "pre-tge",
    route: "tickers/mindshare",
    params: {
      api_version: "v2",
      nft: "false",
      ex_official: "false",
      weighted: "false",
      sort_type: "desc",
      type: "heatmap",
      duration: "24h",
      pre_tge: "true",
    },
    file: "live-pre-tge-24h-heatmap.json",
  },
  {
    source: "pre-tge",
    route: "tickers/mindshare",
    params: {
      api_version: "v2",
      nft: "false",
      ex_official: "false",
      weighted: "false",
      sort_type: "asc",
      type: "topDelta",
      duration: "24h",
      pre_tge: "true",
    },
    file: "live-pre-tge-24h-topdelta.json",
  },
  {
    source: "infomarkets",
    route: "tickers/mindshare",
    params: {
      api_version: "v2",
      nft: "false",
      ex_official: "false",
      weighted: "false",
      sort_type: "desc",
      type: "heatmap",
      duration: "24h",
      topic_id: "INFOMKT",
    },
    file: "live-infomarkets-24h-heatmap.json",
  },
  {
    source: "exchange",
    route: "tickers/mindshare",
    params: {
      api_version: "v2",
      nft: "false",
      ex_official: "false",
      weighted: "true",
      categories: "EXCHANGE",
      sort_type: "desc",
      type: "heatmap",
      duration: "24h",
    },
    file: "live-exchange-24h-heatmap.json",
  },
  {
    source: "infomarkets",
    route: "kol/mindshare/top-leaderboard",
    params: {
      duration: "7d",
      top_n: 100,
      topic_id: "INFOMKT",
      community_tier: "tier1",
      language_filter: "all",
    },
    file: "live-infomarkets-kol-7d.json",
  },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hashHex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function isValidHash(hash, difficulty) {
  const whole = Math.floor(difficulty);
  const fractional = difficulty - whole;
  const threshold = Math.ceil(16 * (1 - fractional)) % 16;
  const prefix = "0".repeat(whole);
  if (!hash.startsWith(prefix)) return false;
  if (fractional === 0) return true;
  return Number.parseInt(hash.charAt(whole), 16) < threshold;
}

function solvePow(challenge, difficulty) {
  let nonce = 0;
  for (;;) {
    const payload = `${challenge}:${nonce}`;
    const hash = hashHex(payload);
    if (isValidHash(hash, difficulty)) {
      return { nonce: String(nonce), hash };
    }
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
  if (!decrypted) throw new Error("DES decryption returned empty plaintext");
  return decrypted;
}

async function readResponsePayload(response, label) {
  const text = await response.text();
  const encryption = response.headers.get("encryption");
  const encryptionVersion = response.headers.get("encryptionversion");
  let payloadText = text;
  if (encryption === "true") {
    if (encryptionVersion !== "v1") {
      throw new Error(`Unsupported encryption version for ${label}: ${encryptionVersion}`);
    }
    payloadText = decryptV1Payload(text);
  }
  return JSON.parse(payloadText);
}

async function getPowHeaders() {
  const response = await fetch(`${BASE_URL}/analysis/session/validate`, { headers: DEFAULT_HEADERS });
  if (!response.ok) throw new Error(`Challenge request failed: ${response.status} ${response.statusText}`);
  const data = await readResponsePayload(response, "challenge");
  const { nonce, hash } = solvePow(data.challenge, Number(data.difficulty));
  return {
    "x-challenge": data.challenge,
    "x-nonce": nonce,
    "x-hash": hash,
  };
}

async function fetchProtectedJson(route, params, label) {
  const url = new URL(route, `${AI_BASE_URL}/`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  let lastError;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    if (attempt > 1) await sleep(REQUEST_DELAY_MS);
    const powHeaders = await getPowHeaders();
    const response = await fetch(url, {
      headers: {
        ...DEFAULT_HEADERS,
        ...powHeaders,
      },
    });

    if (response.ok) return await readResponsePayload(response, label);

    const body = await response.text();
    lastError = new Error(`${label} failed on attempt ${attempt}: ${response.status} ${response.statusText}\n${body.slice(0, 300)}`);

    if (response.status === 429) {
      console.log(`[rate-limit] ${label} 429, wait ${RATE_LIMIT_DELAY_MS / 1000}s`);
      await sleep(RATE_LIMIT_DELAY_MS);
      continue;
    }

    throw lastError;
  }
  throw lastError;
}

async function writeJson(name, data) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const filePath = path.join(OUTPUT_DIR, name);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  return filePath;
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
    while (true) {
      const current = nextIndex++;
      if (current >= items.length) return;
      results[current] = await worker(items[current], current);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runner()));
  return results;
}

async function main() {
  const startedAt = new Date().toISOString();
  const results = await runWithConcurrency(JOBS, CONCURRENCY, async (job) => {
    const payload = await fetchProtectedJson(job.route, job.params, job.file);
    const file = await writeJson(job.file, payload);
    const items = normalizeItems(payload);
    return {
      source: job.source,
      file,
      count: items.length,
      fetchedAt: new Date().toISOString(),
      route: job.route,
      params: job.params,
      sample: items.slice(0, 5),
    };
  });

  const summary = {
    startedAt,
    completedAt: new Date().toISOString(),
    concurrency: CONCURRENCY,
    jobs: results,
  };

  await writeJson('live-fast-summary.json', summary);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
