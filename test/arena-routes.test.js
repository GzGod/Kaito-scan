const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ARENA_COMPANY_DURATIONS,
  ARENA_VOICE_DURATIONS,
  ARENA_VERTICALS,
  DATASET_ROUTES,
  resolveRouteKey,
} = require('../src/routes');
const { buildJobs } = require('../src/scraper');

test('buildJobs includes arena voices and companies for each supported vertical', () => {
  const jobs = buildJobs();

  for (const vertical of ARENA_VERTICALS) {
    const voiceRouteVertical = vertical === 'stock' ? 'trading' : vertical;
    const companyRouteVertical = vertical === 'stock' ? 'equity' : vertical;

    for (const duration of ARENA_VOICE_DURATIONS) {
      const job = jobs.find((item) => item.key === `arena-voices-${vertical}:${duration}:leaderboard`);
      assert.ok(job, `missing arena voices ${vertical} ${duration}`);
      assert.equal(job.route, `voices/${voiceRouteVertical}/sector_leaderboard`);
      assert.deepEqual(job.params, {
        sector: 'ALL',
        duration,
        offset: 0,
        limit: 100,
      });
    }

    for (const duration of ARENA_COMPANY_DURATIONS) {
      const job = jobs.find((item) => item.key === `arena-companies-${vertical}:${duration}:leaderboard`);
      assert.ok(job, `missing arena companies ${vertical} ${duration}`);
      assert.equal(job.route, `voices/${companyRouteVertical}/company_sector_leaderboard`);
      assert.deepEqual(job.params, {
        sector: 'ALL',
        duration,
        offset: 0,
        limit: 100,
      });
    }
  }
});

test('arena routes resolve public stock vertical to Kaito equity key', () => {
  const url = new URL('http://localhost/api/arena/voices?vertical=stock&duration=7d');
  const route = DATASET_ROUTES[url.pathname];

  assert.equal(resolveRouteKey(route, url), 'arena-voices-stock:7d:leaderboard');
});

test('arena routes reject unsupported verticals', () => {
  const url = new URL('http://localhost/api/arena/companies?vertical=gaming&duration=24h');
  const route = DATASET_ROUTES[url.pathname];

  assert.equal(resolveRouteKey(route, url), null);
});
