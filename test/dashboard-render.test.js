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
