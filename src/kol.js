const { fetchProtectedJson, normalizeItems } = require('./scraper');
const { getStore, listSnapshots } = require('./store');

const SCOPES = ['crypto', 'ai', 'trading'];
const SCOPE_ALIASES = { stock: 'trading', equity: 'trading', equity_trading: 'trading' };
const CACHE_TTL_MS = Number(process.env.KOL_CACHE_TTL_MS || 60 * 60 * 1000);
const CACHE_MAX_ENTRIES = 5000;
const BATCH_LIMIT = 50;
const BATCH_LIMIT_ALL_SCOPES = 20;
const BATCH_CONCURRENCY = 4;

class KolError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const cache = new Map();
const learnedHandles = new Map();
let handleIndex = new Map();
let handleIndexVersion;

function resolveScope(value) {
  const scope = String(value || 'all').toLowerCase();
  if (scope === 'all') return 'all';
  const resolved = SCOPE_ALIASES[scope] || scope;
  if (!SCOPES.includes(resolved)) {
    throw new KolError(400, 'unsupported scope', { supportedScopes: ['all', ...SCOPES, 'stock'] });
  }
  return resolved;
}

function remember(username, userId) {
  if (!username || !userId) return;
  learnedHandles.set(String(username).toLowerCase(), String(userId));
}

function rebuildHandleIndex() {
  const version = getStore().updatedAt;
  if (version === handleIndexVersion) return;
  const next = new Map();
  for (const snapshot of listSnapshots()) {
    for (const item of normalizeItems(snapshot.data)) {
      if (item?.username && item?.user_id) next.set(String(item.username).toLowerCase(), String(item.user_id));
    }
  }
  handleIndex = next;
  handleIndexVersion = version;
}

const HANDLE_PATTERN = /^[A-Za-z0-9_]{1,15}$/;
const HANDLE_LOOKUP_TIMEOUT_MS = 10000;
const HANDLE_MISS_TTL_MS = 10 * 60 * 1000;
const handleMisses = new Map();
const handleLookups = new Map();

async function lookupHandleRemote(handle) {
  const response = await fetch(`https://api.fxtwitter.com/${encodeURIComponent(handle)}`, {
    headers: { 'user-agent': 'kaito-scan/1.0' },
    signal: AbortSignal.timeout(HANDLE_LOOKUP_TIMEOUT_MS),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new KolError(502, 'handle lookup failed', { status: response.status });
  const body = await response.json();
  const id = body?.user?.id;
  return id && /^\d+$/.test(String(id)) ? String(id) : null;
}

async function resolveUserId(input) {
  const raw = String(input || '').trim().replace(/^@/, '');
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return raw;
  if (!HANDLE_PATTERN.test(raw)) return null;
  rebuildHandleIndex();
  const key = raw.toLowerCase();
  const known = handleIndex.get(key) || learnedHandles.get(key);
  if (known) return known;

  const missedAt = handleMisses.get(key);
  if (missedAt && Date.now() - missedAt < HANDLE_MISS_TTL_MS) return null;

  if (!handleLookups.has(key)) {
    const lookup = lookupHandleRemote(raw)
      .then((id) => {
        if (id) learnedHandles.set(key, id);
        else handleMisses.set(key, Date.now());
        return id;
      })
      .finally(() => handleLookups.delete(key));
    handleLookups.set(key, lookup);
  }
  return handleLookups.get(key);
}

function cached(key, loader) {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.promise;
  const promise = loader();
  cache.delete(key);
  cache.set(key, { promise, expiresAt: now + CACHE_TTL_MS });
  promise.catch(() => cache.delete(key));
  while (cache.size > CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value);
  return promise;
}

function isEmpty(payload) {
  return !payload || typeof payload !== 'object' || Object.keys(payload).length === 0;
}

function fetchSocialCard(kind, scope, userId) {
  return cached(`${kind}:${scope}:${userId}`, async () => {
    const payload = await fetchProtectedJson(
      `voices/social_card/${scope}/${kind}`,
      { user_id: userId },
      `kol-${kind}:${scope}:${userId}`,
      'arena',
    );
    if (isEmpty(payload)) return null;
    remember(payload.profile?.username, payload.profile?.user_id);
    for (const follower of payload.top_smart_followers || []) remember(follower.username, follower.user_id);
    return payload;
  });
}

function profileFields(profile = {}) {
  return {
    userId: profile.user_id ? String(profile.user_id) : null,
    username: profile.username || null,
    name: profile.name || null,
    avatar: profile.avatar || null,
    bio: profile.bio || null,
    language: profile.language || null,
    identityTags: profile.identity_tags || [],
  };
}

function scopeFields(payload) {
  return {
    smartFollowers: payload.segment_smart_follower ?? null,
    relevantTweetCount: payload.relevant_tweet_count ?? null,
  };
}

function totals(payload) {
  return {
    smartFollowers: payload.smart_follower ?? null,
    followers: payload.followers ?? null,
    sfLabel: payload.sf_label || null,
    smartEngagement: payload.smart_engagement ?? null,
    impression: payload.impression ?? null,
  };
}

function notFound(input) {
  return new KolError(404, 'kol not found', {
    input,
    hint: 'the handle does not exist, or Kaito has no social card for this account',
  });
}

async function getKolAllScopes(userId, input) {
  const overviews = await Promise.all(SCOPES.map((scope) => fetchSocialCard('overview', scope, userId)));
  const first = overviews.find(Boolean);
  if (!first) throw notFound(input);
  const categories = {};
  SCOPES.forEach((scope, index) => {
    categories[scope] = overviews[index] ? scopeFields(overviews[index]) : null;
  });
  return { ...profileFields(first.profile), scope: 'all', ...totals(first), categories };
}

async function getKolScope(userId, input, scope, detail) {
  const payload = await fetchSocialCard(detail ? 'details' : 'overview', scope, userId);
  if (!payload) throw notFound(input);
  const result = { ...profileFields(payload.profile), scope, ...totals(payload), ...scopeFields(payload) };
  if (!detail) return result;
  return {
    ...result,
    topSmartFollowers: (payload.top_smart_followers || []).map((follower) => ({
      userId: follower.user_id ? String(follower.user_id) : null,
      username: follower.username || null,
      name: follower.name || null,
      avatar: follower.avatar || null,
      mindshare: follower.mindshare ?? null,
    })),
    smartFollowerBreakdown: payload.smart_follower_breakdown ?? null,
    smartFollowerShare: payload.smart_follower_share ?? null,
    smartFollowerRank: payload.smart_follower_rank ?? null,
    mindshareShare: payload.mindshare_share ?? null,
    mindshareRank: payload.mindshare_rank ?? null,
    engagementDetails: payload.engagement_details ?? null,
    impressionDetails: payload.impression_details ?? null,
    contentFormat: payload.content_format ?? null,
    contentActivity: payload.content_activity ?? null,
    sponsored: payload.sponsored ?? null,
    cryptoRolePercentage: payload.crypto_role_percentage ?? null,
  };
}

async function getKol(input, { scope: rawScope, detail = false } = {}) {
  const scope = resolveScope(rawScope);
  if (detail && scope === 'all') {
    throw new KolError(400, 'detail requires a single scope', { supportedScopes: [...SCOPES, 'stock'] });
  }
  const userId = await resolveUserId(input);
  if (!userId) throw notFound(input);
  if (scope === 'all') return getKolAllScopes(userId, input);
  return getKolScope(userId, input, scope, detail);
}

async function getKolBatch(inputs, { scope: rawScope } = {}) {
  const scope = resolveScope(rawScope);
  const unique = [...new Set(inputs.map((input) => String(input).trim()).filter(Boolean))];
  const limit = scope === 'all' ? BATCH_LIMIT_ALL_SCOPES : BATCH_LIMIT;
  if (!unique.length) throw new KolError(400, 'ids required');
  if (unique.length > limit) throw new KolError(400, 'too many ids', { limit, scope });

  const items = {};
  const errors = {};
  const unresolved = [];
  let next = 0;
  async function runner() {
    while (next < unique.length) {
      const input = unique[next++];
      try {
        items[input] = await getKol(input, { scope });
      } catch (error) {
        items[input] = null;
        if (error instanceof KolError && error.status === 404) unresolved.push(input);
        else errors[input] = String(error.message).slice(0, 300);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(BATCH_CONCURRENCY, unique.length) }, runner));
  return { scope, count: unique.length, items, unresolved, errors };
}

module.exports = {
  KolError,
  getKol,
  getKolBatch,
  resolveUserId,
};
