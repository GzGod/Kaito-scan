const http = require('http');
const { API_KEY, PORT } = require('./config');
const { createRequestHandler } = require('./api');
const { sendJson } = require('./http-utils');
const { getStore, loadStore } = require('./store');
const { runUpdate, scheduleHourlyAtFive } = require('./worker');

async function main() {
  console.log(`API auth enabled: ${Boolean(API_KEY)}`);
  await loadStore();
  if (!getStore().updatedAt) runUpdate('boot').catch((error) => console.error(error));
  scheduleHourlyAtFive();

  const handle = createRequestHandler({ apiKey: API_KEY });
  http.createServer((req, res) => {
    handle(req, res).catch((error) => {
      console.error(error);
      sendJson(res, 500, { error: error.message });
    });
  }).listen(PORT, () => console.log(`Kaito Scan listening on ${PORT}`));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
