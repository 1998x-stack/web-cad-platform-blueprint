# Commands actually executed — run-20261117T071345Z-4f2345e

Every row was really invoked in this session; a wrapper recorded the exit code and wall time.
`[oracle]` marks runs that used the local Python 3.12.15 venv with the pinned native
`cadquery-ocp 7.9.3.1.1` wheel as an **independent** kernel oracle.

## A. Wrapped matrix runs (chronological)

| # | Command | Exit | Seconds | Log |
| --- | --- | --- | --- | --- |
| 1 | `npm run test` | 0 | 1 | `logs/test.log` |
| 2 | `npm run check:contracts` | 0 | 0 | `logs/check:contracts.log` |
| 3 | `npm run check:catalog` | 0 | 0 | `logs/check:catalog.log` |
| 4 | `npm run check:docs` | 1 | 0 | `logs/check:docs.log` |
| 5 | `npm run check:parity` | 1 | 0 | `logs/check:parity.log` |
| 6 | `npm run test:worker-unit` | 0 | 1 | `logs/test:worker-unit.log` |
| 7 | `npm run test:sketch-unit` | 0 | 0 | `logs/test:sketch-unit.log` |
| 8 | `npm run test:profile-unit` | 0 | 0 | `logs/test:profile-unit.log` |
| 9 | `npm run test:geometry` | 1 | 0 | `logs/test:geometry.log` |
| 10 | `npm run test:wasm` | 0 | 1 | `logs/test:wasm.log` |
| 11 | `npm run test:sketch-wasm` | 0 | 0 | `logs/test:sketch-wasm.log` |
| 12 | `npm run test:profile-wasm` | 0 | 1 | `logs/test:profile-wasm.log` |
| 13 | `npm run build:studio` | 0 | 2 | `logs/build:studio.log` |
| 14 | `npm run check:docs` | 0 | 0 | `logs/check:docs.log` |
| 15 | `env PYTHONPATH=packages/cad-geometry-python/src /tmp/cad-ocp-venv/bin/python -m unittest discover -s packages/cad-geometry-python/tests -v` `[oracle]` | 0 | 2 | `logs/test:geometry.log` |
| 16 | `/tmp/cad-ocp-venv/bin/python scripts/check_contract_parity.py` `[oracle]` | 0 | 1 | `logs/check:parity.log` |
| 17 | `env WASM_STEP_OUTPUT=/Users/x/Desktop/codes/web-cad-platform-blueprint/evidence/run-20261117T071345Z-4f2345e/artifacts/wasm-precision.step npm run test:wasm` | 0 | 2 | `logs/test:wasm-with-output.log` |
| 18 | `env PYTHONPATH=packages/cad-geometry-python/src /tmp/cad-ocp-venv/bin/python scripts/verify_wasm_step_with_native.py /Users/x/Desktop/codes/web-cad-platform-blueprint/evidence/run-20261117T071345Z-4f2345e/artifacts/wasm-precision.step` `[oracle]` | 0 | 2 | `logs/verify-wasm-step-native.log` |
| 19 | `/tmp/cad-ocp-venv/bin/python scripts/check_sketch_schema.py` `[oracle]` | 0 | 0 | `logs/check:sketch-schema.log` |
| 20 | `python3 scripts/audit_next_milestones.py` | 0 | 0 | `logs/check:milestones.log` |
| 21 | `npm run test:profile-wasm` | 0 | 2 | `logs/test:profile-wasm-after-fix.log` |
| 22 | `npm run test:profile-wasm` | 0 | 1 | `logs/test:profile-wasm-final.log` |
| 23 | `npm run check` | 0 | 1 | `logs/recheck-check.log` |
| 24 | `npm run test:worker-unit` | 0 | 1 | `logs/recheck-test:worker-unit.log` |
| 25 | `npm run test:wasm` | 0 | 0 | `logs/recheck-test:wasm.log` |
| 26 | `npm run test:sketch-unit` | 0 | 1 | `logs/recheck-test:sketch-unit.log` |
| 27 | `npm run test:sketch-wasm` | 0 | 0 | `logs/recheck-test:sketch-wasm.log` |
| 28 | `npm run test:profile-unit` | 0 | 0 | `logs/recheck-test:profile-unit.log` |
| 29 | `npm run test:browser` | 0 | 3 | `logs/test:browser.log` |
| 30 | `npm run test:sketch-browser` | 0 | 1 | `logs/test:sketch-browser.log` |
| 31 | `npm run test:profile-browser` | 0 | 6 | `logs/test:profile-browser.log` |
| 32 | `npm run test:sketch-browser` | 0 | 7 | `logs/test:sketch-browser-multiengine.log` |
| 33 | `npm run test:browser` | 0 | 7 | `logs/test:browser-multiengine.log` |
| 34 | `npm run check` | 1 | 1 | `logs/final-check.log` |
| 35 | `npm run test:worker-unit` | 0 | 0 | `logs/final-test:worker-unit.log` |
| 36 | `npm run test:sketch-unit` | 0 | 0 | `logs/final-test:sketch-unit.log` |
| 37 | `npm run test:profile-unit` | 0 | 1 | `logs/final-test:profile-unit.log` |
| 38 | `npm run test:wasm` | 0 | 0 | `logs/final-test:wasm.log` |
| 39 | `npm run test:sketch-wasm` | 0 | 0 | `logs/final-test:sketch-wasm.log` |
| 40 | `npm run test:profile-wasm` | 0 | 1 | `logs/final-test:profile-wasm.log` |
| 41 | `npm run build:studio` | 0 | 2 | `logs/final-build:studio.log` |
| 42 | `env PYTHONPATH=packages/cad-geometry-python/src /tmp/cad-ocp-venv/bin/python -m unittest discover -s packages/cad-geometry-python/tests -v` `[oracle]` | 0 | 2 | `logs/final-test:geometry.log` |
| 43 | `/tmp/cad-ocp-venv/bin/python scripts/check_contract_parity.py` `[oracle]` | 0 | 0 | `logs/final-check:parity.log` |
| 44 | `npm run check` | 0 | 1 | `logs/final2-npm-check.log` |
| 45 | `npm run check:docs` | 0 | 0 | `logs/final2-check-docs.log` |
| 46 | `npm run check` | 0 | 1 | `logs/verify-check.log` |
| 47 | `npm run test:profile-wasm` | 0 | 1 | `logs/verify-test:profile-wasm.log` |
| 48 | `npm run test:browser` | 0 | 6 | `logs/verify-test:browser.log` |
| 49 | `npm run test:sketch-browser` | 0 | 5 | `logs/verify-test:sketch-browser.log` |
| 50 | `npm run test:profile-browser` | 0 | 5 | `logs/verify-test:profile-browser.log` |
| 51 | `env PYTHONPATH=packages/cad-geometry-python/src /tmp/cad-ocp-venv/bin/python -m unittest discover -s packages/cad-geometry-python/tests -v` `[oracle]` | 0 | 1 | `logs/verify-test:geometry.log` |
| 52 | `/tmp/cad-ocp-venv/bin/python scripts/check_contract_parity.py` `[oracle]` | 0 | 0 | `logs/verify-check:parity.log` |

## B. Commands run directly (not wrapped)

| Command | Purpose | Result |
| --- | --- | --- |
| `npm install` | install the pinned WASM/browser dependencies (`node_modules` was absent) | 21 packages, 24 audited; 1 high-severity advisory reported (esbuild dev dependency); install-scripts warning for esbuild |
| `/opt/homebrew/bin/python3.12 -m venv /tmp/cad-ocp-venv` | create the native oracle venv outside the repository | ok |
| `/tmp/cad-ocp-venv/bin/pip install cadquery-ocp==7.9.3.1.1 'jsonschema>=4.21,<5'` | install the independent native OCCT binding + JSON Schema validator | ok (`cp312-macosx_11_0_arm64` wheel) |
| `/tmp/cad-ocp-venv/bin/pip install -e packages/cad-geometry-python` | make `cad_geometry` importable for the parity/geometry tests | ok (generated `*.egg-info` build metadata was deleted again, and `*.egg-info/` is now git-ignored) |
| `PYTHONPATH=packages/cad-geometry-python/src /tmp/cad-ocp-venv/bin/python -m cad_geometry.cli run samples/precision-block.cad.json --step <ev>/artifacts/precision-block.step --report <ev>/artifacts/precision-block.evidence.json` `[oracle]` | reproduce CI's native-oracle step: real native STEP + machine-readable evidence report | exit 0; STEP sha256 recorded in `artifacts/precision-block.evidence.json` |
| `node evidence/<RUN_ID>/tools/measure-profiles.mjs` | observe full-precision per-case geometry numbers (no expected values assumed) | exit 0 -> `artifacts/profile-measurements.json` |
| `node evidence/<RUN_ID>/tools/measure-perf.mjs` | observe cold-init / build / tessellate / STEP latency percentiles | exit 0 -> `artifacts/perf-measurements.json` |
| `node evidence/<RUN_ID>/tools/browser-probe.mjs` | read back the launched browser versions | chromium 143.0.7499.4, firefox 144.0.2, webkit 26.0 |
| `node evidence/<RUN_ID>/artifacts/experiment-sketch-multibrowser.mjs` | decide empirically whether the CAD-006 gate can run on Firefox/WebKit | PASS x3 -> justified generalizing `scripts/test_sketch_browser.mjs` |
| `node evidence/<RUN_ID>/artifacts/experiment-studio-multibrowser.mjs` | decide empirically whether the CAD-004 Studio (WebGL) gate can run on Firefox/WebKit | PASS x3 (webgl=true) -> justified generalizing `scripts/test_browser.mjs` |
| `curl -sL <playwright cdn>/builds/<browser>/<rev>/<archive>` x4 | obtain the pinned browser archives after `npx playwright install` hung (see `browser-matrix.md`) | 200 x4; unpacked into Playwright's own cache layout + `INSTALLATION_COMPLETE` markers; versions verified by launching |
| `python3 scripts/verify_blueprint.py` with probe edits to `docs/00-product-charter.md` | negative + positive controls for D-01/D-01b | see `logs/negcontrol-docs.log`: genuine broken link fails, the same link inside a code span is ignored, vendor tree excluded |
