const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || '';
const PG_CONNECTION_TIMEOUT_MS = Number(process.env.PG_CONNECTION_TIMEOUT_MS || 10000);
const PG_QUERY_TIMEOUT_MS = Number(process.env.PG_QUERY_TIMEOUT_MS || 60000);
const PG_STATEMENT_TIMEOUT_MS = Number(process.env.PG_STATEMENT_TIMEOUT_MS || 60000);
const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: PG_CONNECTION_TIMEOUT_MS,
      query_timeout: PG_QUERY_TIMEOUT_MS,
      statement_timeout: PG_STATEMENT_TIMEOUT_MS,
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

async function readQuery(text, params) {
  if (!pool) throw new Error('DATABASE_URL is not configured');
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await pool.query(text, params);
    } catch (error) {
      lastError = error;
      const message = String(error.message || '');
      const retryable = message.includes('timeout') || message.includes('Connection terminated') || message.includes('ECONNRESET');
      if (!retryable || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  throw lastError;
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

async function querySnapshotHistory({ source, dataset, duration, interval, fromUtc, toExclusiveUtc, limit }) {
  if (!pool) return { enabled: false };
  const metadataSql = interval === 'day'
    ? `
      WITH ranked AS (
        SELECT
          id,
          run_id,
          key,
          source,
          dataset,
          duration,
          item_count,
          updated_at,
          created_at,
          ROW_NUMBER() OVER (
            PARTITION BY (created_at AT TIME ZONE 'Asia/Shanghai')::date
            ORDER BY created_at DESC
          ) AS rn
        FROM snapshots
        WHERE source = $1
          AND dataset = $2
          AND duration = $3
          AND created_at >= $4::timestamptz
          AND created_at < $5::timestamptz
      )
      SELECT
        id,
        run_id AS "runId",
        key,
        source,
        dataset,
        duration,
        item_count AS "itemCount",
        updated_at AS "updatedAt",
        created_at AS "createdAt"
      FROM ranked
      WHERE rn = 1
      ORDER BY created_at ASC
    `
    : `
      SELECT
        id,
        run_id AS "runId",
        key,
        source,
        dataset,
        duration,
        item_count AS "itemCount",
        updated_at AS "updatedAt",
        created_at AS "createdAt"
      FROM snapshots
      WHERE source = $1
        AND dataset = $2
        AND duration = $3
        AND created_at >= $4::timestamptz
        AND created_at < $5::timestamptz
      ORDER BY created_at ASC
    `;

  const metadata = await readQuery(metadataSql, [source, dataset, duration, fromUtc, toExclusiveUtc]);
  if (!metadata.rows.length) return { enabled: true, snapshots: [] };

  const dataResult = await readQuery(
    `
      SELECT
        selected.id,
        COALESCE(jsonb_agg(limited.elem ORDER BY limited.ord) FILTER (WHERE limited.elem IS NOT NULL), '[]'::jsonb) AS data
      FROM (
        SELECT id, data
        FROM snapshots
        WHERE id = ANY($1::bigint[])
      ) selected
      LEFT JOIN LATERAL (
        SELECT elem, ord
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(selected.data) = 'array' THEN selected.data
            WHEN jsonb_typeof(selected.data->'data') = 'array' THEN selected.data->'data'
            WHEN jsonb_typeof(selected.data->'items') = 'array' THEN selected.data->'items'
            WHEN jsonb_typeof(selected.data->'result') = 'array' THEN selected.data->'result'
            ELSE '[]'::jsonb
          END
        ) WITH ORDINALITY AS items(elem, ord)
        WHERE ord <= $2
      ) limited ON TRUE
      GROUP BY selected.id
    `,
    [metadata.rows.map((snapshot) => snapshot.id), limit]
  );
  const dataById = new Map(dataResult.rows.map((row) => [String(row.id), row.data]));
  const snapshots = metadata.rows.map((snapshot) => {
    const items = dataById.get(String(snapshot.id)) || [];
    return {
      ...snapshot,
      count: Math.min(snapshot.itemCount, limit),
      data: items,
    };
  });

  return { enabled: true, snapshots };
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
  querySnapshotHistory,
  saveHistory,
};
