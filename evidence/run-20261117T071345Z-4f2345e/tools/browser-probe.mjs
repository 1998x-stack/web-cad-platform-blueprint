/**
 * Browser launch probe (local evidence helper, not a committed test).
 * Records, per engine, whether the pinned Playwright build is present and can launch.
 *   node evidence/<RUN_ID>/artifacts/browser-probe.mjs
 */
import {chromium, firefox, webkit} from 'playwright';
import {readFileSync} from 'node:fs';

const pinned = JSON.parse(readFileSync(new URL('../../../node_modules/playwright-core/browsers.json', import.meta.url)));
const rev = Object.fromEntries(pinned.browsers.map(b => [b.name, `${b.name}@${b.revision} (${b.browserVersion})`]));

const out = {
  playwright: JSON.parse(readFileSync(new URL('../../../node_modules/playwright/package.json', import.meta.url))).version,
  pinnedBuilds: {chromium: rev.chromium, headlessShell: rev['chromium-headless-shell'], firefox: rev.firefox, webkit: rev.webkit},
  probedUtc: new Date().toISOString(),
  engines: [],
};
for (const [name, type] of [['chromium', chromium], ['firefox', firefox], ['webkit', webkit]]) {
  const entry = {name};
  try {
    const browser = await type.launch({headless: true});
    entry.launched = true;
    entry.version = browser.version();
    await browser.close();
  } catch (err) {
    entry.launched = false;
    entry.error = String(err.message).split('\n')[0];
  }
  out.engines.push(entry);
}
out.summary = out.engines.map(e => `${e.name}=${e.launched ? 'OK ' + e.version : 'UNAVAILABLE'}`).join(' | ');
console.log(JSON.stringify(out, null, 2));
