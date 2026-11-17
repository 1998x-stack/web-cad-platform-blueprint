# Changes — run-20261117T071345Z-4f2345e

Base: `4f2345e53ce42c5d6ecf0537f81d8aeb24ce383b` (local `main` == `origin/main`, clean tree).
Branch for this round: `fix/cad-008-g0-gate-evidence`.
No changes to: Canonical CAD Document schema, `CommandService`, permissions, migrations,
STEP/geometry math, or any kernel-facing contract semantics.

---

## D-01 (P0 blocker) — `npm run check` fails on any machine that installed dependencies

**Symptom**

```
npm run check:docs   -> exit 1
AssertionError: Missing local links:
node_modules/nanoid/README.md -> ./README.ru.md
node_modules/occt-wasm/README.md -> ./crate/README.md
... (11 issues)
```

**Root cause.** `scripts/verify_blueprint.py` walked the whole repository with
`ROOT.rglob('*.md')` / `ROOT.rglob('*.json')` with no exclusion list. Once `npm install`
had run, it validated 43 vendor markdown files and 41 vendor JSON files that this project
does not own and cannot fix.

**Why CI never caught it.** The first CI job (`contracts-and-sql`) ran `python3
scripts/verify_blueprint.py` **without ever installing npm dependencies**, so `node_modules`
did not exist and the bug was invisible. Job 3 installs dependencies but never runs
`verify_blueprint.py`. The gate therefore passed in CI while being broken for every
developer.

**Fix** — `scripts/verify_blueprint.py`

- Added `IGNORED_DIRS = {'.git', 'node_modules', 'dist', 'build', 'coverage', '.venv', 'venv', '__pycache__', '.pytest_cache'}`.
- Added `iter_first_party(pattern)`, which yields only repository-owned files, and used it
  for both the markdown-link and JSON checks.
- `check_markdown_links()` now returns the number of files actually checked instead of the
  raw glob count, so the printed evidence reflects real coverage.

**Guard against recurrence** — `.github/workflows/blueprint-ci.yml`

- Added an `Install dependencies` step (`npm install --no-audit --no-fund`) to the
  `contracts-and-sql` job so `verify_blueprint.py` now runs under realistic developer
  conditions and this defect class is detectable. YAML validated; job step order confirmed.

**Verification**

- Positive: `npm run check:docs` -> `Markdown files verified: 42`, `JSON files verified: 22`,
  `SQLite migration verified: [(1,), (2,)]`, exit 0. `npm run check` -> exit 0.
- Negative control (proves the checker is not vacuous): appending
  `[broken](./definitely-missing-file.md)` to `docs/00-product-charter.md` still fails with
  `Missing local links: docs/00-product-charter.md -> ./definitely-missing-file.md`, exit 1.
  Log: `logs/negcontrol-docs.log`. The probe file was reverted immediately.

---

## D-02 — the CAD-007 lifecycle memory number was not measuring what it claimed

**Symptom.** `npm run test:profile-wasm` printed:

```
100 CAD-007 lifecycle cycles completed, parent RSS delta: 96.28 MiB (not a per-WASM heap proof)
```

**Root cause.** Three independent problems in the assertion:

1. Wrong process. `process.memoryUsage().rss` was read in the **parent** test process, while
   the OCCT arena lives in the **worker_thread**.
2. Wrong baseline. `rss0` was sampled **before** `client.initialize()`, so the ~21 MB WASM
   module instantiation plus arena warm-up were folded into the "per-cycle" delta — which is
   why the number was ~96 MiB and not ~1 MiB.
3. Not falsifiable. The value was only printed; nothing was asserted, so a real regression
   could not fail the build. `docs/28` limitation #4 already admitted this ("100 次释放压力
   测试不等于严格证明没有 WASM 堆泄漏").

**Fix** — measurable invariant instead of an unfalsifiable number

- `packages/cad-geometry/src/worker-runtime.mjs`: new non-mutating `stats` operation
  returning `{generation, kernelReady, activeGeometryId, retainedGeometryCount}` from the
  existing (previously unreachable) `inspect()` bookkeeping. No kernel call, no state change.
- `packages/cad-geometry/src/client.mjs`: `stats()` accessor on `CadWorkerClient`.
- `packages/cad-geometry/test/profile-wasm.test.mjs`: the lifecycle test now
  - asserts `retainedGeometryCount === 0` and `activeGeometryId === null` **after every one of
    the 100 dispose calls** — a hard invariant that fails the build if a handle is retained;
  - keeps the `STALE_GEOMETRY` rejection checks;
  - includes an explicit **positive control** (build -> `retainedGeometryCount === 1` and id
    matches -> dispose -> `0`), so the invariant is proven falsifiable rather than vacuous;
  - reports parent RSS drift sampled **after** 20 warm-up cycles and labels it honestly as a
    JS/worker-boundary signal that is not a per-WASM-heap leak proof.

**Verification**

| | before | after |
| --- | --- | --- |
| reported metric | ~96.28 MiB (init + 100 cycles, parent, unasserted) | 0 retained handles in all 100 cycles + 1.02 / 1.13 MiB steady-state drift |
| can fail the build | no | yes (per-cycle assertion + positive control) |

Raw: `logs/test:profile-wasm-final.log`.

---

## D-01b — the docs checker produced false positives on link syntax inside code

Found by accident, then confirmed deliberately: `verify_blueprint.py` scanned raw markdown
with no notion of code spans, so **any documentation that prints a markdown link** (including
this very report, and `docs/` pages that show example link syntax) was reported as a broken
link. The gate was both leaky (scanned vendor files, D-01) and noisy (flagged non-links).

**Fix** — same file: strip fenced code blocks (`FENCED_CODE_RE`, ` ``` ` and `~~~`) and inline
code spans (`INLINE_CODE_RE`) before extracting links.

**Verification (both directions, `logs/negcontrol-docs.log`)**

| Probe | Expected | Observed |
| --- | --- | --- |
| A genuine broken link outside any code span | fail | **exit 1**, `Missing local links: docs/00-product-charter.md -> ./definitely-missing-file.md` |
| The same link inside an inline code span | ignore | **exit 0** |
| Vendor tree present (43 md / 43 json under `node_modules`) | ignore | **exit 0**, `Markdown files verified: 47` at that moment, `JSON files verified: 29` (the markdown count becomes 48 once this report itself is written) |
| No probe (restored tree) | pass | **exit 0** (`npm run check` green) |

So the checker detects strictly more than it used to on real links, and strictly fewer false
positives.

---

## D-03 — two of the three browser gates only ever ran Chromium: DIAGNOSED, then REVERTED

**Symptom.** `scripts/test_browser.mjs` (CAD-004 Studio) and `scripts/test_sketch_browser.mjs`
(CAD-006 sketch) imported `chromium` only, while `scripts/test_profile_browser.mjs` (CAD-007)
looped over Chromium/Firefox/WebKit. The CI step names did not say so, so a green run could be
mistaken for cross-browser coverage of the P0 worker and sketch paths. The scripts only carried
a one-line "Requires Playwright Chromium" comment.

**What I did first — and why it was wrong.** Both scripts were generalized to the same
three-engine loop, after verifying on this macOS host that both pages pass on Firefox and WebKit
(PASS x3 each, `webgl=true`). Locally green. **CI said otherwise:**

```
chromium: DOM loaded; checking Worker...
PASS chromium: browser WASM dedicated-worker build + parametric edit + STEP download + dispose
firefox: DOM loaded; checking Worker...
page.waitForFunction: Timeout 60000ms exceeded.     <- scripts/test_browser.mjs:27
```

**Root cause.** Both pages create a WebGL context at module scope:

- `apps/studio/src/main.mjs:15` — `new THREE.WebGLRenderer({antialias:true,alpha:false,...})`
- `apps/studio/src/sketch-main.mjs:17` — `new THREE.WebGLRenderer({antialias:true,...})`

Headless Firefox and WebKit on the `ubuntu-latest` CI runner cannot create that context, so module
init throws, `window.__CAD_E2E__` / `window.__SKETCH_E2E__` is never assigned, and the readiness
wait times out. On macOS the same engines *can* create a context, which is exactly why the local
experiment passed and produced a false green. `apps/studio/src/profile-main.mjs` does **not**
import `three`, which is precisely why CAD-007 is the one suite that legitimately covers all three
engines.

**Resolution.** The widening was reverted. The scripts keep their Chromium-only behaviour, and the
measured reason is now recorded in their header comments so nobody repeats this. Reverting is the
honest outcome: a gate must not be widened past what the platform actually supports, and a
platform-conditional "skip" would have been a fake green.

**Remaining real gap (now precisely characterised, NOT closed).** The CAD-004 and CAD-006 gates
have no Firefox/WebKit evidence at all. The enabler is in the application, not the test script:
make the Studio and sketch pages degrade gracefully when WebGL is unavailable (catch the
`WebGLRenderer` construction failure, still publish `__CAD_E2E__` with e.g. `webgl:false`, and keep
the Worker/geometry assertions meaningful). Only then can those gates be widened safely. Until
then, cross-engine P0 evidence is CAD-007 only — reported as such in `browser-matrix.md`.

**Lesson worth keeping:** "passes on my machine" for a *platform capability* is not evidence about
CI. The local experiment was necessary but not sufficient; the CI run was the real oracle.

---

## Deliberately NOT changed

- The three browser E2E scripts are unchanged in behaviour: `test_browser.mjs` and
  `test_sketch_browser.mjs` stay Chromium-only (comment-only edit recording the measured
  platform limitation), and `test_profile_browser.mjs` stays multi-engine. Nothing was weakened
  to make this round green; a widening was attempted, CI proved it unsound, and it was reverted.
- No threshold/epsilon was loosened and no test was deleted, skipped or mocked.
- `package-lock.json` appeared after `npm install` (the repository previously tracked none).
  Because `package.json` pins direct dependencies exactly but transitives were floating, the
  lockfile is kept in **its own separate commit** so it can be dropped independently of the
  fixes above.

## Rollback

Each fix is independent and reversible:

- D-01/D-01b: `git revert` the `scripts/verify_blueprint.py` + workflow commit. (Restores the
  original broken-on-local-machines behaviour.)
- D-02: `git revert` the worker/client/test commit. The `stats` operation is additive, so
  reverting the test alone also works.
- D-03: the two scripts are behaviourally identical to `main`; only their header comments
  changed. `git checkout main -- scripts/test_browser.mjs scripts/test_sketch_browser.mjs`
  fully restores the original files.
- Evidence: delete `evidence/<RUN_ID>/`; no repository behaviour depends on it.
