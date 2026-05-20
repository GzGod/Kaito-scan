const fs = require('fs/promises');
const path = require('path');

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
    const raw = await fs.readFile(SNAPSHOT_FILE, 'utf8');
    memory = JSON.parse(raw);
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('Failed to load snapshot store:', error.message);
  }
  return memory;
}

async function saveScrapeResult(result) {
  await ensureDataDir();
  const snapshots = {};
  for (const snapshot of result.snapshots) snapshots[snapshot.key] = snapshot;
  memory = {
    updatedAt: result.completedAt,
    snapshots,
    lastRun: {
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      concurrency: result.concurrency,
      count: result.snapshots.length,
    },
    lastError: null,
  };
  await fs.writeFile(SNAPSHOT_FILE, JSON.stringify(memory, null, 2));
  return memory;
}

async function setError(error) {
  memory.lastError = {
    message: error.message,
    at: new Date().toISOString(),
  };
  await ensureDataDir();
  await fs.writeFile(SNAPSHOT_FILE, JSON.stringify(memory, null, 2));
}

function getStore() {
  return memory;
}

function getSnapshot(key) {
  return memory.snapshots[key] || null;
}

function listSnapshots() {
  return Object.values(memory.snapshots || {});
}

module.exports = {
  getSnapshot,
  getStore,
  listSnapshots,
  loadStore,
  saveScrapeResult,
  setError,
};
