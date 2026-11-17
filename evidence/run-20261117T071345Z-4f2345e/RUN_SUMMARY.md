# RUN_SUMMARY — run-20261117T071345Z-4f2345e

## 1. Identity

| Item | Value |
| --- | --- |
| RUN_ID | `run-20261117T071345Z-4f2345e` |
| Repository | `/Users/x/Desktop/codes/web-cad-platform-blueprint` |
| Evaluated baseline SHA | `4f2345e53ce42c5d6ecf0537f81d8aeb24ce383b` (`main`, **equal to `origin/main`**, clean tree at start) |
| Branch for this round | `fix/cad-008-g0-gate-evidence` |
| Working tree at report time | dirty: 8 modified files + `evidence/` (see `changes.md`) |
| Issue scope | CAD-008 / revised **P0 G0** verification: reproducible defects on the P0 gate, real cross-runtime geometry evidence, honest lifecycle memory evidence |
| Environment | see `environment.md` |

Verified at the start of the round, not assumed: local `main` was **exactly** `origin/main`
(`git rev-list --left-right --count origin/main...HEAD` -> `0 0`), the tree was clean, and the
only remote branches were already-merged feature branches plus their PR refs.

Newly installed to reach the gate (none of it present before): `node_modules` (empty),
a local Python 3.12.15 venv with `cadquery-ocp 7.9.3.1.1` as the **independent native oracle**,
and the pinned Playwright browsers.

## 2. Verdict on the P0 G0 gate

**`PASS_WITH_DEVIATIONS`**

Green after this round: cross-runtime contract parity, native exact B-Rep + independent STEP
round-trip, real planegcs WASM solving, exact profile -> Wire -> Face -> Extrude volumes, WASM
STEP re-read by a different OCCT build, 100-cycle lifecycle with a hard retained-handle
invariant, and the WebGL-free CAD-007 suite on all three browser engines.

Deviations that keep this short of an unconditional PASS:

1. macOS **Safari on-device** verification was **NOT executed** (needs a real Safari UI session;
   Playwright WebKit 26.0 is a different build and is only a compatibility signal).
2. The CAD-004 and CAD-006 browser gates still have **no Firefox/WebKit evidence**: those pages
   need a WebGL context at module scope, which headless Firefox/WebKit on the CI runner cannot
   provide. CAD-007 (WebGL-free) is the only cross-engine P0 browser gate. This is a genuine,
   measured shortness of the P0 browser requirement — see D-03.
2. The browser binaries were unpacked **manually** from the official pinned archives because
   `npx playwright install` hung on this host, so this run is evidence about the browsers, not
   proof that CI's install step works on a restricted network (details in `browser-matrix.md`).
3. `npm run test:geometry` / `npm run check:parity` require the native OCCT wheel; they were run
   in a local Python 3.12 venv because the system interpreter is 3.9.6 and
   `pyproject.toml` requires `>=3.11,<3.14`. Pure-`python3` runs of those two scripts fail with
   `ModuleNotFoundError: No module named 'OCP'` — an **environment/dependency** condition, not
   a code defect, and CI installs the wheel in its own 3.12 job.
4. Lifecycle memory evidence is still **not** a proof of absence of WASM heap leaks (see §6).

## 3. Actual test results

All rows below really executed. "npm run check:docs" row reflects the post-fix state.

| Command | Exit | Log |
| --- | --- | --- |
| `npm run test` | 0 | `logs/test.log` |
| `npm run check:contracts` | 0 | `logs/check:contracts.log` |
| `npm run check:catalog` | 0 | `logs/check:catalog.log` |
| `npm run check:docs` | 0 | `logs/final2-check-docs.log` |
| `npm run check` (aggregate) | 0 | `logs/final2-npm-check.log` |
| `npm run check:parity` (native oracle) | 0 | `logs/final-check:parity.log` |
| `scripts/check_sketch_schema.py` | 0 | `logs/check:sketch-schema.log` |
| `scripts/audit_next_milestones.py` | 0 | `logs/check:milestones.log` |
| `npm run test:worker-unit` | 0 | `logs/final-test:worker-unit.log` |
| `npm run test:sketch-unit` | 0 | `logs/final-test:sketch-unit.log` |
| `npm run test:profile-unit` | 0 | `logs/final-test:profile-unit.log` |
| `npm run test:geometry` (native oracle, 18 tests) | 0 | `logs/final-test:geometry.log` |
| `npm run test:wasm` (real WASM worker) | 0 | `logs/final-test:wasm.log` |
| `npm run test:sketch-wasm` (real planegcs) | 0 | `logs/final-test:sketch-wasm.log` |
| `npm run test:profile-wasm` (real WASM + 100 cycles) | 0 | `logs/final-test:profile-wasm.log` |
| `npm run build:studio` | 0 | `logs/final-build:studio.log` |
| `npm run test:browser` (Chromium only) | 0 | `logs/revert-test:browser.log` |
| `npm run test:sketch-browser` (Chromium only) | 0 | `logs/revert-test:sketch-browser.log` |
| `npm run test:profile-browser` (3 engines) | 0 | `logs/verify-test:profile-browser.log` |
| `scripts/verify_wasm_step_with_native.py` `[oracle]` | 0 | `logs/verify-wasm-step-native.log` |

Full chronology of all 52 wrapped invocations: `commands.md`.

First-party coverage of `verify_blueprint.py` grew as this round's own reports were written:
`42 md / 22 json` right after the D-01 fix, `47 md / 29 json` during the controls, and
`48 md / 29 json` in the final state once `RUN_SUMMARY.md` itself existed — all with
`exit 0` and `43 vendor md / 43 vendor json` present but correctly excluded.
Command classification: **environment errors** = the three `OCP`-missing runs before the oracle
venv existed (rows 5, 9 and the first `check:parity`); **code defects** = D-01/D-01b/D-02/D-03
below. No geometry-kernel numerical failure was observed this round.

## 4. Defects found and fixed

| ID | Severity | Title | Status |
| --- | --- | --- | --- |
| D-01 | **P0 blocker** | `npm run check` fails on any machine with dependencies installed (`verify_blueprint.py` scanned `node_modules`) | Fixed + CI guard added |
| D-01b | P1 | Same checker produced false positives for link syntax printed inside code spans/fences | Fixed |
| D-02 | P0 (evidence validity) | CAD-007 lifecycle memory number measured the wrong process and folded one-time init into the "per-cycle" delta, and was never asserted | Fixed: hard invariant + honest steady-state metric |
| D-03 | P1 (coverage) | `test:browser` and `test:sketch-browser` only ever ran Chromium, contrary to the P0 Chromium/Firefox/WebKit requirement | **Diagnosed + reverted** (not fixed); measured root cause + enabler documented |

Details, root causes, verification and rollback for each: **`changes.md`**.

## 5. Geometry acceptance

Full machine-readable detail: **`geometry-report.json`** (values were *observed* via
`tools/measure-profiles.mjs`, not assumed).

- **Exact profile extrusion (WASM, real planegcs + real OCCT)**, tolerance 0.001 mm³:
  right triangle 60000 mm³, rotated (non-axis-aligned) rectangle 8000 mm³, concave L hexagon
  67200 mm³ — all measured **exactly** on target, each 1 valid solid, faces 5/6/8, STEP output
  starting `ISO-10303-21`, bbox as expected.
  *Caveat carried from `docs/28`:* these three samples fix all points and declare **zero**
  constraints, so `fully_constrained` / 0 DOF is trivial. They prove exact
  loop→Wire→Face→Extrude, **not** parametric solving. Real constraint solving is only exercised
  by `samples/rectangle.sketch.json` (6 constraints) and the browser sketch suite.
- **Native independent oracle**: `precision-block.cad.json` -> 1 valid solid,
  214492.03552627692 mm³, 7 faces, bbox `[-1e-7, -1e-7, -1e-7, 120.0000001, 60.0000001, 30.0000001]`,
  STEP sha256 `d231c8bc…2bd172` (19041 bytes); native re-import volume delta **5.82e-11 mm³**,
  bbox delta **0.0 mm**, face count 7 -> 7.
- **Cross-runtime**: a STEP file written by the **WASM** kernel was re-read by the **native**
  OCCT build (different implementation, separate process): `nativeImportedWasmStep: true`,
  volume delta **5.82e-11 mm³**, bbox max delta **0.0 mm**, area delta 5.09e-11 mm².
- **Contract parity**: `PASS 16 solid fixtures: JS/native semantic parity; JSON Schema accepted all positives`.
- **Native suite**: 18/18 pass (GEO-001 216000 mm³, GEO-003 `120*60*30 - pi*6²*30`, parameter-only
  edit, disjoint cut staying valid, and fail-closed cases for NaN / negative radius / duplicate
  ids / missing dependencies / non-mm units).
- **Browser geometry**: exact volumes asserted in every engine (see §6).

Not claimed: no B-Rep validity claim for interactive Studio drawing, no fillet/shell/loft/sweep/
arc/spline evidence, no third-party industrial STEP interoperability, no Safari certification.

## 6. Lifecycle, memory and browser compatibility

**Lifecycle (100 x build -> tessellate -> dispose, real WASM)** — `logs/final-test:profile-wasm.log`

- **0 retained geometry handles after every one of the 100 dispose calls**, and `activeGeometryId`
  is `null` each time — a hard assertion that fails the build if a handle is retained.
- A positive control proves the invariant is falsifiable: a live build reports
  `retainedGeometryCount === 1` and the matching id, and dispose clears it to 0.
- Parent RSS drift over the last 80 cycles **after warm-up**: **1.02 / 1.13 / 1.67 / 1.59 MiB** across
  four runs, versus the previously reported "96.28 MiB" that was dominated by one-time WASM
  instantiation and was never asserted.
- Every cycle also asserts `STALE_GEOMETRY` on the disposed id.
- **Honest limit:** RSS is still a JS/worker-boundary signal in the parent process. WASM linear
  memory never shrinks, so **zero retained handles is not a proof of absence of WASM heap
  leaks**; browser profiling and long-duration soak remain outstanding, exactly as `docs/28` says.

**Performance** (detail in `performance.md`): cold worker + cold WASM init P50 **75.8 ms** /
P95 **106.8 ms**; init -> exact build -> tessellate -> STEP export P50 **133.7 ms** /
P95 **173.3 ms** on an M-series arm64 host. Bundle: `occt-wasm` **21,345.55 kB** (gzip
6,819.19 kB), `planegcs` 484.00 kB — the OCCT payload is the dominant first-load cost and was
not measured over a real network.

**Browser matrix** (detail in `browser-matrix.md`): Chromium **143.0.7499.4**,
Firefox **144.0.2**, WebKit **26.0**, all launched and version-verified.

| Suite | Chromium | Firefox | WebKit |
| --- | --- | --- | --- |
| CAD-004 Studio WASM worker (WebGL) | PASS | NOT RUN | NOT RUN |
| CAD-006 sketch constraints + B-Rep (WebGL) | PASS | NOT RUN | NOT RUN |
| CAD-007 profile/history/undo-redo/STEP (WebGL-free) | PASS | PASS | PASS |

An attempt to widen the first two suites to all three engines was made, passed on macOS, and was
**rejected by CI** (headless Firefox cannot create the WebGL context the pages need at module
scope, so init never completes). It was reverted rather than kept; see `browser-matrix.md` and
D-03 in `changes.md`. A local "passes here" result for a platform capability is not evidence about
CI — the CI run was the oracle.

**NOT executed:** macOS Safari on-device; Firefox/WebKit for the CAD-004 and CAD-006 paths;
mobile browsers; long-duration browser memory profiling; WebGL pixel-level rendering assertions.

## 7. GitHub status

| Item | Value |
| --- | --- |
| Branch | `fix/cad-008-g0-gate-evidence` (5 commits: 4 fixes/evidence split, 1 droppable lockfile) |
| PR | [#16](https://github.com/1998x-stack/web-cad-platform-blueprint/pull/16) — **OPEN, not merged** |
| `contracts-and-sql` | **pass** (this is the job whose missing `npm install` hid D-01; it now installs deps) |
| `native-occt-and-step` | **pass** |
| `wasm-worker-and-browser` | **pass** (2m28s / 1m31s across two runs) — this job is the one that caught D-03, and then confirmed the revert |

CI was used as the oracle for the D-03 browser-coverage question, and it contradicted a locally
green result. The failing step was `npm run test:browser` on `ubuntu-latest`:

```
PASS chromium: browser WASM dedicated-worker build + parametric edit + STEP download + dispose
firefox: DOM loaded; checking Worker...
page.waitForFunction: Timeout 60000ms exceeded.
```

The offending widening was reverted (`git checkout main -- scripts/test_browser.mjs
scripts/test_sketch_browser.mjs`; both pass again locally as Chromium-only), and this report plus
the PR description were corrected rather than left claiming cross-engine coverage.

After the revert, **all three jobs pass on the corrected commit**, including the full Linux
browser job: pure worker runtime tests, real planegcs WASM, CAD-007 profile + 100 lifecycle cycles,
real OCCT WASM in a Node worker, independent native STEP re-import of the WASM-written file,
`npm run build:studio`, and the browser suites on **Chromium, Firefox and WebKit** (the CAD-007
multi-engine gate plus the two Chromium-only gates). So the revert is CI-verified, not just
locally green.

**No merge is performed by this round**; the PR must keep an independent review opportunity
because it changes a kernel-facing test invariant and a CI gate.

## 8. Next round, ordered by dependency

1. **CAD-009 interactive parametric Studio, minimal slice** — mouse-drawn closed loop ->
   planegcs constraints -> exact extrude, reusing the now-proven
   `solvedProfileToCadDocument` path. Highest user-visible value, and the geometry route is
   already evidenced.
2. **Real parametric constraint coverage** — the three exact-volume fixtures carry zero
   constraints. Add constrained, dimension-driven fixtures (including a genuine
   over/under-constrained matrix) so "parametric CAD" is not claimed on fixed-point samples.
3. **Durable document persistence** — IndexedDB autosave + reload recovery on top of the
   process-local `LocalCadHistory`, plus real transaction/revision-conflict tests (AUTH-002/003).
4. **Browser memory soak** — in-browser heap profiling over thousands of cycles with a real
   measurement (e.g. WASM linear-memory growth via the module's exported
   `OSD_MemInfo_getModuleHeapLength`), to replace RSS-as-proxy.
5. **Make the Studio/sketch pages survive without WebGL** (catch `WebGLRenderer` construction
   failure, still publish the E2E global, keep geometry assertions meaningful) — this is the
   concrete enabler for closing the CAD-004/CAD-006 Firefox+WebKit coverage gap, and it is also a
   real robustness defect: a CAD app should not hard-crash when WebGL is unavailable.
6. **CI resilience** — mirror Playwright archive hosting or a documented fallback for
   network-restricted runners; make the browser-install failure mode explicit rather than a hang.

## 9. Handoff

- Evidence directory: `evidence/run-20261117T071345Z-4f2345e/`
  - tracked: `RUN_SUMMARY.md`, `environment.md`, `commands.md`, `commands.jsonl`,
    `geometry-report.json`, `browser-matrix.md`, `performance.md`, `changes.md`,
    `tools/browser-probe.mjs`, `tools/measure-profiles.mjs`, `tools/measure-perf.mjs`
  - git-ignored, local-only: `logs/` (raw logs, negative controls), `artifacts/` (generated
    STEP files, measured JSON, one-off experiment scripts)
- No credentials, tokens, personal paths beyond the local workspace, or third-party model data
  are included. Generated STEP files and raw logs were deliberately excluded from the commit.
- Raw measured numbers to hand to the next analysis round:
  `artifacts/profile-measurements.json`, `artifacts/perf-measurements.json`,
  `artifacts/browser-probe.json`, `artifacts/experiment-sketch.json`,
  `artifacts/experiment-studio.json`, `artifacts/precision-block.evidence.json`,
  `logs/verify-wasm-step-native.log`, `logs/negcontrol-docs.log`.

Reproduce:

```bash
npm install
/opt/homebrew/bin/python3.12 -m venv /tmp/cad-ocp-venv
/tmp/cad-ocp-venv/bin/pip install cadquery-ocp==7.9.3.1.1 'jsonschema>=4.21,<5'
/tmp/cad-ocp-venv/bin/pip install -e packages/cad-geometry-python
npm run check
PYTHONPATH=packages/cad-geometry-python/src /tmp/cad-ocp-venv/bin/python scripts/check_contract_parity.py
PYTHONPATH=packages/cad-geometry-python/src /tmp/cad-ocp-venv/bin/python -m unittest discover -s packages/cad-geometry-python/tests -v
npm run test:profile-wasm
npx playwright install chromium firefox webkit && npm run build:studio
npm run test:browser && npm run test:sketch-browser && npm run test:profile-browser
```
