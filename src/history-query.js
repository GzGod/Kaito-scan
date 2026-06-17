const { DATASET_ROUTES, SUPPORTED_DURATIONS } = require('./routes');

const MAX_HISTORY_ITEM_LIMIT = 500;
const DEFAULT_HISTORY_ITEM_LIMIT = 50;
const DEFAULT_HISTORY_DAYS = 7;
const HISTORY_INTERVALS = ['hour', 'day'];

const DATASET_COMBINATIONS = Object.values(DATASET_ROUTES).flatMap((route) => {
  const durations = route.durations || SUPPORTED_DURATIONS;
  if (!route.sourcePrefix) {
    return [{
      source: route.source,
      dataset: route.dataset,
      durations,
    }];
  }
  return (route.verticals || []).map((vertical) => ({
    source: `${route.sourcePrefix}-${vertical}`,
    dataset: route.dataset,
    durations,
  }));
});

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatShanghaiDate(date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

function shiftDate(dateText, days) {
  const [year, month, day] = dateText.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function parseDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }
  return value;
}

function shanghaiDateToUtcStart(dateText) {
  const [year, month, day] = dateText.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, -8, 0, 0, 0)).toISOString();
}

function clampLimit(value) {
  const parsed = Number(value || DEFAULT_HISTORY_ITEM_LIMIT);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_HISTORY_ITEM_LIMIT;
  return Math.min(Math.floor(parsed), MAX_HISTORY_ITEM_LIMIT);
}

function findDatasetCombination(source, dataset) {
  return DATASET_COMBINATIONS.find((item) => item.source === source && item.dataset === dataset) || null;
}

function parseHistoryQuery(url, now = new Date()) {
  const source = url.searchParams.get('source') || '';
  const dataset = url.searchParams.get('dataset') || '';
  const duration = url.searchParams.get('duration') || '';
  const interval = url.searchParams.get('interval') || 'hour';
  const combination = findDatasetCombination(source, dataset);

  if (!combination) {
    return {
      ok: false,
      status: 400,
      error: 'unsupported dataset',
      supported: DATASET_COMBINATIONS.map(({ source: itemSource, dataset: itemDataset, durations }) => ({
        source: itemSource,
        dataset: itemDataset,
        durations,
      })),
    };
  }

  if (!combination.durations.includes(duration)) {
    return {
      ok: false,
      status: 400,
      error: 'unsupported duration',
      supportedDurations: combination.durations,
    };
  }

  if (!HISTORY_INTERVALS.includes(interval)) {
    return {
      ok: false,
      status: 400,
      error: 'unsupported interval',
      supportedIntervals: HISTORY_INTERVALS,
    };
  }

  const today = formatShanghaiDate(now);
  const to = parseDateOnly(url.searchParams.get('to') || today);
  if (!to) return { ok: false, status: 400, error: 'invalid to date' };

  const defaultFrom = shiftDate(to, -(DEFAULT_HISTORY_DAYS - 1));
  const from = parseDateOnly(url.searchParams.get('from') || defaultFrom);
  if (!from) return { ok: false, status: 400, error: 'invalid from date' };
  if (from > to) return { ok: false, status: 400, error: 'invalid date range' };

  return {
    ok: true,
    query: {
      source,
      dataset,
      duration,
      interval,
      from,
      to,
      fromUtc: shanghaiDateToUtcStart(from),
      toExclusiveUtc: shanghaiDateToUtcStart(shiftDate(to, 1)),
      limit: clampLimit(url.searchParams.get('limit')),
    },
  };
}

module.exports = {
  DEFAULT_HISTORY_ITEM_LIMIT,
  HISTORY_INTERVALS,
  MAX_HISTORY_ITEM_LIMIT,
  parseHistoryQuery,
};
