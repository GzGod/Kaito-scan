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
const REQUEST_DELAY_MS = 1200;
const RATE_LIMIT_DELAY_MS = 30000;
const LINE_CONCURRENCY = 5;

const DEFAULT_HEADERS = {
  accept: "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  origin: "https://kaito.ai",
  referer: "https://kaito.ai/",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
};

const MINDSHARE_TYPES = [
  { type: "heatmap", sort_type: "desc" },
  { type: "topDelta", sort_type: "asc" },
];

const MINDSHARE_DURATIONS = ["24h", "7d", "30d", "3m", "6m", "12m"];
const LINE_DURATIONS = ["7d", "30d", "3m", "6m", "12m"];
const KOL_DURATIONS = ["7d", "30d", "3m", "6m", "12m"];

const SOURCES = [
  {
    key: "pre-tge",
    tickerParams: {
      pre_tge: "true",
      nft: "false",
      ex_official: "false",
      weighted: "false",
      api_version: "v2",
    },
    lineParams: {
      pre_tge: "true",
      nft: "false",
      ex_official: "false",
      weighted: "false",
    },
    collectKols: false,
  },
  {
    key: "infomarkets",
    tickerParams: {
      topic_id: "INFOMKT",
      nft: "false",
      ex_official: "false",
      weighted: "false",
      api_version: "v2",
    },
    lineParams: {
      topic_id: "INFOMKT",
      nft: "false",
      ex_official: "false",
      weighted: "false",
    },
    kolParams: {
      topic_id: "INFOMKT",
      community_tier: "tier1",
      language_filter: "all",
    },
    collectKols: true,
  },
  {
    key: "exchange",
    tickerParams: {
      categories: "EXCHANGE",
      nft: "false",
      ex_official: "false",
      weighted: "true",
      api_version: "v2",
    },
    lineParams: {
      nft: "false",
      ex_official: "false",
      weighted: "true",
    },
    collectKols: false,
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

  if (!hash.startsWith(prefix)) {
    return false;
  }

  if (fractional === 0) {
    return true;
  }

  return Number.parseInt(hash.charAt(whole), 16) < threshold;
}

function solvePow(challenge, difficulty) {
  let nonce = 0;

  for (;;) {
    const payload = `${challenge}:${nonce}`;
    const hash = hashHex(payload);
    if (isValidHash(hash, difficulty)) {
      return {
        nonce: String(nonce),
        hash,
      };
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

  if (!decrypted) {
    throw new Error("DES decryption returned empty plaintext");
  }

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

  try {
    return JSON.parse(payloadText);
  } catch (error) {
    throw new Error(`Non-JSON payload for ${label}: ${payloadText.slice(0, 400)}`);
  }
}

async function getPowHeaders() {
  const response = await fetch(`${BASE_URL}/analysis/session/validate`, {
    headers: DEFAULT_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`Challenge request failed: ${response.status} ${response.statusText}`);
  }

  const data = await readResponsePayload(response, "challenge");
  const challenge = data?.challenge;
  const difficulty = Number(data?.difficulty);

  if (!challenge || Number.isNaN(difficulty)) {
    throw new Error(`Unexpected challenge payload: ${JSON.stringify(data)}`);
  }

  const { nonce, hash } = solvePow(challenge, difficulty);
  return {
    "x-challenge": challenge,
    "x-nonce": nonce,
    "x-hash": hash,
  };
}

async function fetchProtectedJson(baseUrl, route, params, label) {
  const url = new URL(route, `${baseUrl}/`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  let lastError;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    if (attempt > 1) {
      await sleep(REQUEST_DELAY_MS);
    }

    const powHeaders = await getPowHeaders();
    const response = await fetch(url, {
      headers: {
        ...DEFAULT_HEADERS,
        ...powHeaders,
      },
    });

    if (response.ok) {
      return readResponsePayload(response, label);
    }

    const body = await response.text();
    lastError = new Error(
      `${label} failed on attempt ${attempt}: ${response.status} ${response.statusText}\n${body.slice(0, 400)}`
    );

    if (response.status === 429) {
      console.log(`[rate-limit] ${label} hit 429, waiting ${RATE_LIMIT_DELAY_MS / 1000}s`);
      await sleep(RATE_LIMIT_DELAY_MS);
      continue;
    }

    if (response.status !== 401 && response.status !== 403) {
      throw lastError;
    }
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
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  if (Array.isArray(payload?.items)) {
    return payload.items;
  }
  if (Array.isArray(payload?.result)) {
    return payload.result;
  }
  return [];
}

function extractTicker(item) {
  return (
    item?.ticker ||
    item?.symbol ||
    item?.name ||
    item?.id ||
    item?.project?.ticker ||
    item?.project?.name ||
    null
  );
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runner() {
    for (;;) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= items.length) {
        return;
      }
      results[current] = await worker(items[current], current);
    }
  }

  const size = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: size }, () => runner()));
  return results;
}

async function collectMindshare(source) {
  const results = {};
  const tickers = new Set();

  for (const duration of MINDSHARE_DURATIONS) {
    for (const config of MINDSHARE_TYPES) {
      const key = `${config.type}-${duration}`;
      const payload = await fetchProtectedJson(
        AI_BASE_URL,
        "tickers/mindshare",
        {
          ...source.tickerParams,
          sort_type: config.sort_type,
          type: config.type,
          duration,
        },
        `${source.key}-${key}`
      );
      results[key] = payload;
      console.log(`[${source.key}] [mindshare] ${key}`);

      for (const item of normalizeItems(payload)) {
        const ticker = extractTicker(item);
        if (ticker) {
          tickers.add(ticker);
        }
      }
    }
  }

  return {
    results,
    tickers: Array.from(tickers).sort(),
  };
}

async function collectLines(source, tickers) {
  const files = {};

  for (const duration of LINE_DURATIONS) {
    const entries = await runWithConcurrency(tickers, LINE_CONCURRENCY, async (ticker) => {
      const key = `${ticker}-${duration}`;
      console.log(`[${source.key}] [line] ${key}`);
      const payload = await fetchProtectedJson(
        AI_BASE_URL,
        "tickers/mindshare-line",
        {
          ...source.lineParams,
          ticker,
          duration,
        },
        `${source.key}-${key}`
      );
      await sleep(REQUEST_DELAY_MS);
      return [key, payload];
    });

    const results = Object.fromEntries(entries);
    const name = `${source.key}-lines-${duration}`.concat('.json');
    files[name] = await writeJson(name, results);
  }

  return files;
}

async function collectKols(source) {
  if (!source.collectKols) {
    return null;
  }

  const results = {};
  for (const duration of KOL_DURATIONS) {
    const key = `leaderboard-${duration}`;
    results[key] = await fetchProtectedJson(
      AI_BASE_URL,
      "kol/mindshare/top-leaderboard",
      {
        ...source.kolParams,
        duration,
        top_n: 100,
      },
      `${source.key}-${key}`
    );
    console.log(`[${source.key}] [leaderboard] ${key}`);
  }

  return results;
}

async function collectSource(source) {
  const startedAt = new Date().toISOString();
  const mindshare = await collectMindshare(source);
  const lineFiles = await collectLines(source, mindshare.tickers);
  const kols = await collectKols(source);

  const manifest = {
    source: source.key,
    startedAt,
    completedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    aiBaseUrl: AI_BASE_URL,
    tickerCount: mindshare.tickers.length,
    files: {},
  };

  manifest.files[`${source.key}-mindshare.json`] = await writeJson(
    `${source.key}-mindshare.json`,
    mindshare.results
  );
  manifest.files[`${source.key}-tickers.json`] = await writeJson(
    `${source.key}-tickers.json`,
    mindshare.tickers
  );

  if (kols) {
    manifest.files[`${source.key}-leaderboard.json`] = await writeJson(
      `${source.key}-leaderboard.json`,
      kols
    );
  }

  Object.assign(manifest.files, lineFiles);

  manifest.files[`${source.key}-manifest.json`] = await writeJson(
    `${source.key}-manifest.json`,
    manifest
  );

  return manifest;
}

async function main() {
  const summary = {
    startedAt: new Date().toISOString(),
    completedAt: null,
    sources: {},
  };

  for (const source of SOURCES) {
    summary.sources[source.key] = await collectSource(source);
  }

  summary.completedAt = new Date().toISOString();
  summary.summaryFile = await writeJson("mindshare-unified-manifest.json", summary);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
