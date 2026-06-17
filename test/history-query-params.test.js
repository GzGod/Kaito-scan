const assert = require('node:assert/strict');
const test = require('node:test');

const { parseHistoryQuery } = require('../src/history-query');

test('parses day history query with Shanghai date bounds and limit cap', () => {
  const url = new URL('http://localhost/api/history/query?source=pre-tge&dataset=heatmap&duration=24h&from=2026-06-01&to=2026-06-09&interval=day&limit=999');
  const result = parseHistoryQuery(url, new Date('2026-06-15T04:00:00.000Z'));

  assert.equal(result.ok, true);
  assert.equal(result.query.source, 'pre-tge');
  assert.equal(result.query.dataset, 'heatmap');
  assert.equal(result.query.duration, '24h');
  assert.equal(result.query.interval, 'day');
  assert.equal(result.query.limit, 500);
  assert.equal(result.query.from, '2026-06-01');
  assert.equal(result.query.to, '2026-06-09');
  assert.equal(result.query.fromUtc, '2026-05-31T16:00:00.000Z');
  assert.equal(result.query.toExclusiveUtc, '2026-06-09T16:00:00.000Z');
});

test('defaults to last seven Shanghai dates through today', () => {
  const url = new URL('http://localhost/api/history/query?source=exchange&dataset=heatmap&duration=30d');
  const result = parseHistoryQuery(url, new Date('2026-06-15T04:00:00.000Z'));

  assert.equal(result.ok, true);
  assert.equal(result.query.interval, 'hour');
  assert.equal(result.query.limit, 50);
  assert.equal(result.query.from, '2026-06-09');
  assert.equal(result.query.to, '2026-06-15');
});

test('rejects unsupported dataset and duration combinations', () => {
  const badDataset = parseHistoryQuery(
    new URL('http://localhost/api/history/query?source=exchange&dataset=kols&duration=7d'),
    new Date('2026-06-15T04:00:00.000Z')
  );
  assert.equal(badDataset.ok, false);
  assert.equal(badDataset.status, 400);
  assert.equal(badDataset.error, 'unsupported dataset');

  const badDuration = parseHistoryQuery(
    new URL('http://localhost/api/history/query?source=infomarkets&dataset=kols&duration=24h'),
    new Date('2026-06-15T04:00:00.000Z')
  );
  assert.equal(badDuration.ok, false);
  assert.equal(badDuration.status, 400);
  assert.equal(badDuration.error, 'unsupported duration');
});

test('parses arena history source combinations', () => {
  const voices = parseHistoryQuery(
    new URL('http://localhost/api/history/query?source=arena-voices-stock&dataset=leaderboard&duration=7d'),
    new Date('2026-06-15T04:00:00.000Z')
  );
  assert.equal(voices.ok, true);
  assert.equal(voices.query.source, 'arena-voices-stock');
  assert.equal(voices.query.dataset, 'leaderboard');

  const badVoiceDuration = parseHistoryQuery(
    new URL('http://localhost/api/history/query?source=arena-voices-stock&dataset=leaderboard&duration=24h'),
    new Date('2026-06-15T04:00:00.000Z')
  );
  assert.equal(badVoiceDuration.ok, false);
  assert.equal(badVoiceDuration.error, 'unsupported duration');

  const companies = parseHistoryQuery(
    new URL('http://localhost/api/history/query?source=arena-companies-stock&dataset=leaderboard&duration=24h'),
    new Date('2026-06-15T04:00:00.000Z')
  );
  assert.equal(companies.ok, true);
});
