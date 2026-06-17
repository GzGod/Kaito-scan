const SUPPORTED_DURATIONS = ['24h', '7d', '30d', '3m', '6m', '12m'];
const KOL_DURATIONS = ['7d', '30d', '3m', '6m', '12m'];
const ARENA_PUBLIC_VERTICALS = ['stock', 'ai', 'crypto'];
const ARENA_VERTICALS = ARENA_PUBLIC_VERTICALS;
const ARENA_VOICE_DURATIONS = ['7d', '30d', '3m', '6m', '12m'];
const ARENA_COMPANY_DURATIONS = SUPPORTED_DURATIONS;

const DATASET_ROUTES = {
  '/api/pre-tge': { source: 'pre-tge', dataset: 'heatmap', defaultDuration: '24h' },
  '/api/pre-tge/top-delta': { source: 'pre-tge', dataset: 'topDelta', defaultDuration: '24h' },
  '/api/infomarkets': { source: 'infomarkets', dataset: 'heatmap', defaultDuration: '24h' },
  '/api/infomarkets/kols': { source: 'infomarkets', dataset: 'kols', defaultDuration: '7d', durations: KOL_DURATIONS },
  '/api/exchange': { source: 'exchange', dataset: 'heatmap', defaultDuration: '24h' },
  '/api/arena/voices': {
    sourcePrefix: 'arena-voices',
    dataset: 'leaderboard',
    defaultDuration: '7d',
    durations: ARENA_VOICE_DURATIONS,
    verticals: ARENA_PUBLIC_VERTICALS,
    defaultVertical: 'stock',
  },
  '/api/arena/companies': {
    sourcePrefix: 'arena-companies',
    dataset: 'leaderboard',
    defaultDuration: '24h',
    durations: ARENA_COMPANY_DURATIONS,
    verticals: ARENA_PUBLIC_VERTICALS,
    defaultVertical: 'stock',
  },
};

function getRequestedVertical(url, fallback = 'stock', supportedVerticals = ARENA_PUBLIC_VERTICALS) {
  const requested = url.searchParams.get('vertical') || fallback;
  return supportedVerticals.includes(requested) ? requested : null;
}

function resolveRouteKey(route, url) {
  if (!route) return null;
  const duration = url.searchParams.get('duration') || route.defaultDuration;
  const supportedDurations = route.durations || SUPPORTED_DURATIONS;
  if (!supportedDurations.includes(duration)) return null;
  if (!route.sourcePrefix) return `${route.source}:${duration}:${route.dataset}`;

  const vertical = getRequestedVertical(url, route.defaultVertical, route.verticals);
  if (!vertical) return null;
  return `${route.sourcePrefix}-${vertical}:${duration}:${route.dataset}`;
}

module.exports = {
  ARENA_COMPANY_DURATIONS,
  ARENA_PUBLIC_VERTICALS,
  ARENA_VERTICALS,
  ARENA_VOICE_DURATIONS,
  DATASET_ROUTES,
  getRequestedVertical,
  KOL_DURATIONS,
  resolveRouteKey,
  SUPPORTED_DURATIONS,
};
