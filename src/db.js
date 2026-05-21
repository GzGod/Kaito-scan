const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || '';
const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
    })
  : null;

let initialized = false;

function hasDatabase() {
  return Boolean(pool);
}

async function query(text, params) {
  if (!pool) throw new Error('DATABASE_URL is not configured');
  await initDatabase();
  return pool.query(text, params);
}

async function initDatabase() {
  if (!pool || initialized) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS scrape_runs (
      id BIGSERIAL PRIMARY KEY,
      started_at TIMESTAMPTZ NOT NULL,
      completed_at TIMESTAMPTZ NOT NULL,
      concurrency INTEGER NOT NULL,
      snapshot_count INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id BIGSERIAL PRIMARY KEY,
      run_id BIGINT NOT NULL REFERENCES scrape_runs(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      source TEXT NOT NULL,
      dataset TEXT NOT NULL,
      duration TEXT NOT NULL,
      route TEXT NOT NULL,
      params JSONB NOT NULL,
      data JSONB NOT NULL,
      item_count INTEGER NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_snapshots_key_created_at ON snapshots(key, created_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_snapshots_source_dataset_duration ON snapshots(source, dataset, duration, created_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_snapshots_run_id ON snapshots(run_id)');
  initialized = true;
}

async function saveHistory(result) {
  if (!pool) return { enabled: false };
  await initDatabase();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const runResult = await client.query(
      `INSERT INTO scrape_runs (started_at, completed_at, concurrency, snapshot_count)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [result.startedAt, result.completedAt, result.concurrency, result.snapshots.length]
    );
    const runId = runResult.rows[0].id;
    for (const snapshot of result.snapshots) {
      await client.query(
        `INSERT INTO snapshots
          (run_id, key, source, dataset, duration, route, params, data, item_count, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10)`,
        [
          runId,
          snapshot.key,
          snapshot.source,
          snapshot.dataset,
          snapshot.duration,
          snapshot.route,
          JSON.stringify(snapshot.params || {}),
          JSON.stringify(snapshot.data),
          snapshot.count,
          snapshot.updatedAt,
        ]
      );
    }
    await client.query('COMMIT');
    return { enabled: true, runId: Number(runId), snapshots: result.snapshots.length };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getLatestRun() {
  if (!pool) return null;
  const result = await query(
    `SELECT id, started_at AS "startedAt", completed_at AS "completedAt", concurrency, snapshot_count AS "snapshotCount", created_at AS "createdAt"
     FROM scrape_runs
     ORDER BY id DESC
     LIMIT 1`
  );
  return result.rows[0] || null;
}

async function listRuns(limit = 24) {
  const safeLimit = Math.min(Math.max(Number(limit) || 24, 1), 500);
  const result = await query(
    `SELECT id, started_at AS "startedAt", completed_at AS "completedAt", concurrency, snapshot_count AS "snapshotCount", created_at AS "createdAt"
     FROM scrape_runs
     ORDER BY id DESC
     LIMIT $1`,
    [safeLimit]
  );
  return result.rows;
}

async function listSnapshotHistory(key, limit = 24) {
  const safeLimit = Math.min(Math.max(Number(limit) || 24, 1), 500);
  const result = await query(
    `SELECT id, run_id AS "runId", key, source, dataset, duration, item_count AS "count", updated_at AS "updatedAt", created_at AS "createdAt"
     FROM snapshots
     WHERE key = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [key, safeLimit]
  );
  return result.rows;
}

async function getHistoricalSnapshot(id, limit = 0) {
  const result = await query(
    `SELECT id, run_id AS "runId", key, source, dataset, duration, route, params, data, item_count AS "count", updated_at AS "updatedAt", created_at AS "createdAt"
     FROM snapshots
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  const snapshot = result.rows[0] || null;
  if (!snapshot || !limit) return snapshot;
  const items = Array.isArray(snapshot.data)
    ? snapshot.data
    : Array.isArray(snapshot.data?.data)
      ? snapshot.data.data
      : Array.isArray(snapshot.data?.items)
        ? snapshot.data.items
        : Array.isArray(snapshot.data?.result)
          ? snapshot.data.result
          : null;
  if (!items) return snapshot;
  return { ...snapshot, count: Math.min(items.length, limit), data: items.slice(0, limit) };
}

async function getRunSnapshots(runId) {
  const result = await query(
    `SELECT id, run_id AS "runId", key, source, dataset, duration, item_count AS "count", updated_at AS "updatedAt", created_at AS "createdAt"
     FROM snapshots
     WHERE run_id = $1
     ORDER BY key ASC`,
    [runId]
  );
  return result.rows;
}

async function closeDatabase() {
  if (pool) await pool.end();
}

module.exports = {
  closeDatabase,
  getHistoricalSnapshot,
  getLatestRun,
  getRunSnapshots,
  hasDatabase,
  initDatabase,
  listRuns,
  listSnapshotHistory,
  query,
  saveHistory,
};
