# Browser matrix — run-20261117T071345Z-4f2345e

## Engines actually executed

Playwright 1.57.0 pinned builds, launched headless on this host. Versions were read back from
each live browser (`tools/browser-probe.mjs` -> `artifacts/browser-probe.json`), not assumed:

| Engine | Pinned build | Version reported by the live browser | Launch |
| --- | --- | --- | --- |
| Chromium | `chromium@1200` | 143.0.7499.4 | OK |
| Chromium headless shell | `chromium-headless-shell@1200` | (used by Playwright for headless Chromium) | OK |
| Firefox | `firefox@1497` | 144.0.2 | OK |
| WebKit | `webkit@2227` | 26.0 | OK |

Host: macOS 27.3, arm64. All runs headless, local `vite` server on 127.0.0.1:4173.

## Suite coverage — what each gate really proves

| Suite | Command | Engines it drives | Result |
| --- | --- | --- | --- |
| CAD-004 WASM worker (Studio, WebGL) | `npm run test:browser` | **Chromium only** (by platform necessity) | PASS |
| CAD-006 sketch + B-Rep (WebGL) | `npm run test:sketch-browser` | **Chromium only** (by platform necessity) | PASS |
| CAD-007 profile/history/lifecycle (WebGL-free) | `npm run test:profile-browser` | **Chromium, Firefox, WebKit** | PASS x3 |

### Why two of the three gates are Chromium-only — measured, not assumed

`apps/studio/src/main.mjs:15` (CAD-004) and `apps/studio/src/sketch-main.mjs:17` (CAD-006) both
create a WebGL context at module scope via `new THREE.WebGLRenderer(...)`. Headless Firefox and
WebKit on the `ubuntu-latest` CI runner cannot create that context, so module init never completes
and the page's E2E global is never published. Measured on CI:

```
PASS chromium: browser WASM dedicated-worker build + parametric edit + STEP download + dispose
firefox: DOM loaded; checking Worker...
page.waitForFunction: Timeout 60000ms exceeded.        # scripts/test_browser.mjs:27
```

An earlier attempt this round widened both scripts to all three engines and passed **on macOS**
(Firefox/WebKit could create a context there, `webgl=true`), which turned out to be a false green.
The widening was reverted and the measured reason recorded in the scripts' header comments.
`apps/studio/src/profile-main.mjs` does **not** import `three`, which is exactly why CAD-007 is the
only suite that can legitimately cover all three engines.

**Open gap, not a pass:** the CAD-004 and CAD-006 paths have no Firefox/WebKit evidence.
The enabler is an application change (graceful degradation when WebGL is unavailable, still
publishing the E2E global), not a test-script change.

### CAD-004 Studio gate (Chromium only)

```
PASS browser WASM dedicated-worker build + parametric edit + STEP download + dispose
```
Real dedicated Worker, `worker === 'dedicated'`, 1 valid solid at 214492.03552627692 mm³, radius
edit asserted at 212607.079934123 mm³, STEP download with a `.step` filename, then `dispose`
observed by the page.

### CAD-006 sketch gate (Chromium only)

```
PASS Chromium: real planegcs sketch constraints, under/conflict diagnostics, exact OCCT B-Rep and STEP export
```
`fully_constrained` with 0 DOF, 1 solid at 216000 mm³, width change to 270000 mm³,
underconstrained diagnostics with DOF 1, conflicting sketch with `valid === false` while the last
good geometry is preserved, and a STEP download.

### CAD-007 profile E2E (the cross-engine P0 gate)

```
PASS chromium: triangle/concave real WASM, revision undo/redo, STEP export
PASS firefox:  triangle/concave real WASM, revision undo/redo, STEP export
PASS webkit:   triangle/concave real WASM, revision undo/redo, STEP export
```

Per engine, in a real browser: real OCCT WASM inside a real dedicated Worker, real planegcs
solve, triangle preset asserted at 60000 mm³ (tolerance 0.001 mm³), concave preset at
56000 mm³, depth edited to 12 asserted at 67200 mm³, Undo (-> 56000) and Redo (-> 67200),
STEP download produced with a `.step` filename, and `pageerror` collected and asserted empty.

### CAD-004 / CAD-006 gates remain single-engine — root-caused

Was the case at the start of the round: both scripts imported only `chromium`
(`scripts/test_browser.mjs:2`, `scripts/test_sketch_browser.mjs:2`) and only carried a one-line
"Requires Playwright Chromium" comment. The measurement above replaces that folklore with the
actual mechanism (module-scope `THREE.WebGLRenderer` + no WebGL in headless Firefox/WebKit on the
CI runner), and the scripts' header comments now record it.

## Infrastructure deviation — disclosed

`npx playwright install chromium firefox webkit` did **not** complete on this host:

- Default CDN (`cdn.playwright.dev`): the npm-driven downloader stalled at 0% and then
  `Download failure, code=1`; repeated attempts hung in `oopDownloadBrowserMain.js`.
- npmmirror mirror (`PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright`):
  serves Chromium/Firefox/WebKit fine but returns **HTTP 404 for
  `chromium-headless-shell`**, which Playwright 1.57 requires for headless Chromium
  (it lives under `builds/chromium/<rev>/chromium-headless-shell-*.zip`, and the mirror
  path Playwright asks for is not populated). Attempting to kill and restart the installer
  also caused Playwright to roll back already-unpacked browsers.
- Chrome's own multithreaded unzip inside Playwright then sat at ~428 KB of a 167 MB payload
  for >8 minutes with ~1 s CPU, i.e. effectively hung.

Workaround used, so the engines could be exercised at all: the four **official pinned
archives** were fetched directly from the Playwright CDN with `curl`, unpacked into
`~/Library/Caches/ms-playwright/<browser>-<revision>/` exactly matching Playwright's own
layout (including the `INSTALLATION_COMPLETE` marker that
`playwright-core/.../registry/index.js` requires for chromium/firefox/webkit), and the
executables were made executable.

Consequences, stated plainly:
- The binaries are the exact revisions `package.json`/CI pin (`chromium@1200`, `firefox@1497`,
  `webkit@2227`), and their versions were verified by launching them.
- The **installation procedure** deviates from CI's `npx playwright install --with-deps`.
  Therefore this run is evidence about the *browsers*, not proof that CI's install step works
  on a network-restricted machine. CI (GitHub-hosted runners) is expected to install normally.

## Not executed — explicitly NOT covered

| Item | Status | Why |
| --- | --- | --- |
| macOS **Safari on-device** verification | **NOT EXECUTED** | Requires a real Safari/WebKit UI session on macOS hardware; Playwright's WebKit 26.0 is a different build. A pass here is a compatibility *signal*, **not** Safari certification (this matches `docs/28`). |
| Firefox / WebKit for CAD-004 and CAD-006 | **NOT EXECUTED** | Pages create a WebGL context at module scope; headless Firefox/WebKit on the CI runner cannot, so init never completes. Measured on CI this round. Cross-engine P0 evidence is CAD-007 only. |
| WebGL / Three.js viewport rendering | **NOT EXECUTED** | CAD-007's page is intentionally WebGL-free (SVG 2D view); the Studio 3D viewport was not part of this round. |
| Mobile / iOS Safari, Chrome Android | **NOT EXECUTED** | Out of scope. |
| `--with-deps` system library validation | Not applicable | macOS host; Playwright's host-requirement validation is Linux-oriented. |

## Reproduce

```bash
npm install
npx playwright install chromium firefox webkit     # expected to work on CI; see deviation above
npm run build:studio
npm run test:browser
npm run test:sketch-browser
npm run test:profile-browser
node evidence/<RUN_ID>/tools/browser-probe.mjs     # prints launched engine versions
```
