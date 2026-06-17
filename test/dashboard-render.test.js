const assert = require('node:assert/strict');
const test = require('node:test');

const { renderDashboard } = require('../src/dashboard');

function arenaSnapshot(source, duration, name) {
  return {
    key: `${source}:${duration}:leaderboard`,
    source,
    dataset: 'leaderboard',
    duration,
    updatedAt: '2026-06-18T00:05:00.000Z',
    count: 1,
    data: [{
      rank: 1,
      username: source.includes('voices') ? name : undefined,
      name,
      company_id: name.toUpperCase(),
      logo: 'https://example.com/logo.png',
      mindshare: 0.1234,
      mindshare_delta: 0.0101,
    }],
  };
}

function classicSnapshot(source, dataset, duration, name) {
  return {
    key: `${source}:${duration}:${dataset}`,
    source,
    dataset,
    duration,
    updatedAt: '2026-06-18T00:05:00.000Z',
    count: 1,
    data: [{
      rank: 1,
      ticker: name,
      fullname: `${name} Full`,
      username: dataset === 'kols' ? name : undefined,
      mindshare: 0.2345,
      change_24h: 0.01,
      change_7d: 0.02,
      change_30d: 0.03,
      change_3m: 0.04,
      change_6m: 0.05,
      change_12m: 0.06,
    }],
  };
}

test('dashboard groups arena data by type, vertical, and duration without rendering logos', () => {
  const html = renderDashboard({
    updatedAt: '2026-06-18T00:05:00.000Z',
    snapshots: {
      'arena-voices-stock:7d:leaderboard': arenaSnapshot('arena-voices-stock', '7d', 'stock_voice'),
      'arena-voices-ai:30d:leaderboard': arenaSnapshot('arena-voices-ai', '30d', 'ai_voice'),
      'arena-voices-crypto:12m:leaderboard': arenaSnapshot('arena-voices-crypto', '12m', 'crypto_voice'),
      'arena-companies-stock:24h:leaderboard': arenaSnapshot('arena-companies-stock', '24h', 'StockCo'),
      'arena-companies-ai:6m:leaderboard': arenaSnapshot('arena-companies-ai', '6m', 'AICo'),
      'arena-companies-crypto:12m:leaderboard': arenaSnapshot('arena-companies-crypto', '12m', 'CryptoCo'),
    },
  });

  assert.match(html, /Top Voices/);
  assert.match(html, /Top Companies/);
  assert.match(html, /Stock/);
  assert.match(html, /AI/);
  assert.match(html, /Crypto/);
  assert.match(html, /data-control="mode"/);
  assert.match(html, /data-control="vertical"/);
  assert.match(html, /data-control="duration"/);
  assert.match(html, /CryptoCo/);
  assert.match(html, /crypto_voice/);
  assert.match(html, /const VOICE_DURATIONS = \["7d","30d","3m","6m","12m"\]/);
  assert.match(html, /const COMPANY_DURATIONS = \["24h","7d","30d","3m","6m","12m"\]/);
  assert.doesNotMatch(html, /<img\b/i);
  assert.doesNotMatch(html, /logo\.png/);
});

test('dashboard exposes all supported classic durations instead of only 24h', () => {
  const html = renderDashboard({
    updatedAt: '2026-06-18T00:05:00.000Z',
    snapshots: {
      'pre-tge:24h:heatmap': classicSnapshot('pre-tge', 'heatmap', '24h', 'PRE24'),
      'pre-tge:7d:heatmap': classicSnapshot('pre-tge', 'heatmap', '7d', 'PRE7D'),
      'pre-tge:30d:heatmap': classicSnapshot('pre-tge', 'heatmap', '30d', 'PRE30D'),
      'pre-tge:3m:heatmap': classicSnapshot('pre-tge', 'heatmap', '3m', 'PRE3M'),
      'pre-tge:6m:heatmap': classicSnapshot('pre-tge', 'heatmap', '6m', 'PRE6M'),
      'pre-tge:12m:heatmap': classicSnapshot('pre-tge', 'heatmap', '12m', 'PRE12M'),
      'infomarkets:7d:kols': classicSnapshot('infomarkets', 'kols', '7d', 'kol_7d'),
      'infomarkets:12m:kols': classicSnapshot('infomarkets', 'kols', '12m', 'kol_12m'),
    },
  });

  assert.match(html, /data-classic-control="pre-tge:heatmap"/);
  assert.match(html, /data-classic-control="infomarkets:kols"/);
  assert.match(html, /data-duration="24h"/);
  assert.match(html, /data-duration="7d"/);
  assert.match(html, /data-duration="30d"/);
  assert.match(html, /data-duration="3m"/);
  assert.match(html, /data-duration="6m"/);
  assert.match(html, /data-duration="12m"/);
  assert.match(html, /PRE12M/);
  assert.match(html, /kol_12m/);
});
