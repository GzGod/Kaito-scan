const fs = require('fs/promises');
const path = require('path');
const { getLatestRun, hasDatabase, initDatabase, saveHistory } = require('./db');
const { rebuildResponseCache } = require('./response-cache');
const { decodeSnapshot, encodeSnapshot } = require('./compact');

const DATA_DIR = path.join(process.cwd(), 'data');
const SNAPSHOT_FILE = path.join(DATA_DIR, 'snapshots.json');

let memory = {
  updatedAt: null,
  snapshots: {},
  lastRun: null,
  lastError: null,
};

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function loadStore() {
  try {
    await initDatabase();
  } catch (error) {
    // The database is optional: the service must still serve cached snapshots
    // when Postgres is unreachable or not yet provisioned.
    console.warn('Database unavailable, continuing without history storage:', error.message);
  }
  try {
    const raw = await fs.readFile(SNAPSHOT_FILE, 'utf8');
    memory = JSON.parse(raw);
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('Failed to load snapshot store:', error.message);
  }
  memory = { ...memory, snapshots: expandSnapshots(memory.snapshots || {}) };
  rebuildResponseCache(memory);
  return memory;
}

function expandSnapshots(snapshots) {
  const out = {};
  for (const [key, snapshot] of Object.entries(snapshots)) out[key] = decodeSnapshot(snapshot);
  return out;
}

function compactSnapshots(snapshots) {
  const out = {};
  for (const [key, snapshot] of Object.entries(snapshots)) out[key] = encodeSnapshot(snapshot);
  return out;
}

async function saveScrapeResult(result) {
  await ensureDataDir();
  const snapshots = { ...(memory.snapshots || {}) };
  for (const snapshot of result.snapshots) snapshots[snapshot.key] = snapshot;
  const failures = Array.isArray(result.failures) ? result.failures : [];
  const completedAt = result.completedAt || new Date().toISOString();
  memory = {
    updatedAt: result.snapshots.length ? completedAt : memory.updatedAt,
    snapshots,
    lastRun: {
      startedAt: result.startedAt,
      completedAt,
      concurrency: result.concurrency,
      count: result.snapshots.length,
      failedCount: failures.length,
      failures,
      history: null,
    },
    lastError: failures.length
      ? {
          message: `${failures.length} scrape job${failures.length === 1 ? '' : 's'} failed`,
          at: completedAt,
          failures,
        }
      : null,
  };
  let history = null;
  try {
    history = await saveHistory(result);
  } catch (error) {
    console.warn('Failed to persist scrape history:', error.message);
  }
  memory.lastRun.history = history;
  rebuildResponseCache(memory);
  await writeStoreFile();
  return memory;
}

async function writeStoreFile() {
  const onDisk = { ...memory, snapshots: compactSnapshots(memory.snapshots || {}) };
  await fs.writeFile(SNAPSHOT_FILE, JSON.stringify(onDisk));
}

async function setError(error) {
  memory.lastError = {
    message: error.message,
    at: new Date().toISOString(),
  };
  await ensureDataDir();
  await writeStoreFile();
}

function getStore() {
  return { ...memory, database: { enabled: hasDatabase() } };
}

async function getDatabaseStatus() {
  if (!hasDatabase()) return { enabled: false, latestRun: null };
  try {
    return { enabled: true, latestRun: await getLatestRun() };
  } catch (error) {
    return { enabled: true, reachable: false, error: String(error.message).slice(0, 200), latestRun: null };
  }
}

function getSnapshot(key) {
  return memory.snapshots[key] || null;
}

function listSnapshots() {
  return Object.values(memory.snapshots || {});
}

module.exports = {
  getDatabaseStatus,
  getSnapshot,
  getStore,
  listSnapshots,
  loadStore,
  saveScrapeResult,
  setError,
};
