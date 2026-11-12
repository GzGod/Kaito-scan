// Snapshots are arrays of objects that all carry the same 30-40 keys, so most
// of the bytes are repeated field names. Storing them column-wise and rounding
// floats to 6 significant digits cuts a full run from ~23MB to ~7MB without
// changing what any endpoint returns: encode() is only used for persistence and
// in-memory snapshots stay expanded.

const SIGNIFICANT_DIGITS = Number(process.env.SNAPSHOT_SIG_DIGITS || 6);
// Below this a snapshot is too small for the column overhead to pay off.
const MIN_ROWS = 20;

function roundNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return value;
  if (value === 0 || Number.isInteger(value)) return value;
  return Number(value.toPrecision(SIGNIFICANT_DIGITS));
}

function roundDeep(value) {
  if (typeof value === 'number') return roundNumber(value);
  if (Array.isArray(value)) return value.map(roundDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, inner] of Object.entries(value)) out[key] = roundDeep(inner);
    return out;
  }
  return value;
}

// Column encoding fills absent keys with null, which would invent fields the
// source never had. Rows must be plain objects that all share one key set:
// 35 datasets (the KOL leaderboards) are ragged and fall back to rounding.
function isEncodable(rows) {
  if (!Array.isArray(rows) || rows.length < MIN_ROWS) return false;
  if (!rows.every((row) => row && typeof row === 'object' && !Array.isArray(row))) return false;
  const reference = Object.keys(rows[0]).sort().join('\u0000');
  return rows.every((row) => Object.keys(row).sort().join('\u0000') === reference);
}

function encodeRows(rows) {
  const columns = [];
  const seen = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
  }
  const encoded = rows.map((row) => columns.map((key) => roundDeep(row[key] ?? null)));
  return { format: 'table', columns, rows: encoded };
}

function decodeRows(payload) {
  if (!payload || payload.format !== 'table') return null;
  const { columns, rows } = payload;
  if (!Array.isArray(columns) || !Array.isArray(rows)) return null;
  return rows.map((row) => {
    const item = {};
    for (let i = 0; i < columns.length; i += 1) item[columns[i]] = row[i];
    return item;
  });
}

// Encode the `data` field of a snapshot when it is a uniform array of records.
// Anything else (already encoded, nested payloads, short lists) passes through.
function encodeSnapshot(snapshot) {
  if (!snapshot || !snapshot.data) return snapshot;
  const { data } = snapshot;
  if (data && data.format === 'table') return snapshot;
  if (!isEncodable(data)) return roundOnly(snapshot);
  return { ...snapshot, data: encodeRows(data) };
}

function roundOnly(snapshot) {
  return { ...snapshot, data: roundDeep(snapshot.data) };
}

function decodeSnapshot(snapshot) {
  if (!snapshot || !snapshot.data) return snapshot;
  const rows = decodeRows(snapshot.data);
  if (!rows) return snapshot;
  return { ...snapshot, data: rows };
}

module.exports = {
  SIGNIFICANT_DIGITS,
  decodeSnapshot,
  encodeSnapshot,
  roundDeep,
};
