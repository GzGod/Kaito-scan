const { scrapeLive } = require('./scraper');
const { saveScrapeResult, setError } = require('./store');

let running = false;

function getNextFiveMinute(now = new Date()) {
  const next = new Date(now);
  next.setMinutes(5, 0, 0);
  if (now >= next) next.setHours(next.getHours() + 1);
  return next;
}

async function runUpdate(reason = 'manual') {
  if (running) return { skipped: true, reason: 'already-running' };
  running = true;
  try {
    console.log(`[worker] scrape started (${reason})`);
    const result = await scrapeLive();
    await saveScrapeResult(result);
    console.log(`[worker] scrape completed at ${result.completedAt}`);
    if (result.metrics) console.log(`[worker] scrape metrics ${JSON.stringify(result.metrics)}`);
    return { ok: true, completedAt: result.completedAt };
  } catch (error) {
    console.error('[worker] scrape failed:', error);
    await setError(error);
    return { ok: false, error: error.message };
  } finally {
    running = false;
  }
}

function scheduleHourlyAtFive() {
  const scheduleNext = () => {
    const next = getNextFiveMinute();
    const delay = next.getTime() - Date.now();
    console.log(`[worker] next scheduled scrape at ${next.toISOString()}`);
    setTimeout(async () => {
      await runUpdate('scheduled');
      scheduleNext();
    }, delay);
  };
  scheduleNext();
}

module.exports = {
  getNextFiveMinute,
  runUpdate,
  scheduleHourlyAtFive,
};
