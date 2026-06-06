const SUPPORTED_DURATIONS = ['24h', '7d', '30d', '3m', '6m', '12m'];
const KOL_DURATIONS = ['7d', '30d', '3m', '6m', '12m'];

const DATASET_ROUTES = {
  '/api/pre-tge': { source: 'pre-tge', dataset: 'heatmap', defaultDuration: '24h' },
  '/api/pre-tge/top-delta': { source: 'pre-tge', dataset: 'topDelta', defaultDuration: '24h' },
  '/api/infomarkets': { source: 'infomarkets', dataset: 'heatmap', defaultDuration: '24h' },
  '/api/infomarkets/kols': { source: 'infomarkets', dataset: 'kols', defaultDuration: '7d', durations: KOL_DURATIONS },
  '/api/exchange': { source: 'exchange', dataset: 'heatmap', defaultDuration: '24h' },
};

module.exports = {
  DATASET_ROUTES,
  KOL_DURATIONS,
  SUPPORTED_DURATIONS,
};
