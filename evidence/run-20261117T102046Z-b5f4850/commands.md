# Command ledger — run-20261117T102046Z-b5f4850

Every row is a real invocation. FAIL rows are preserved (no test deleted, no status relabelled).

| # | command | exit | status | log |
|---|---------|------|--------|-----|
| 1 | `npm test` | 0 | PASS | `evidence/run-20261117T102046Z-b5f4850/logs/npm-test.log` |
| 2 | `npm run check:contracts` | 0 | PASS | `evidence/run-20261117T102046Z-b5f4850/logs/check-contracts.log` |
| 3 | `npm run check:catalog` | 0 | PASS | `evidence/run-20261117T102046Z-b5f4850/logs/check-catalog.log` |
| 4 | `npm run check:docs` | 0 | PASS | `evidence/run-20261117T102046Z-b5f4850/logs/check-docs.log` |
| 5 | `npm run test:worker-unit` | 0 | PASS | `evidence/run-20261117T102046Z-b5f4850/logs/final-test-worker-unit.log` |
| 6 | `npm run test:wasm` | 0 | PASS | `evidence/run-20261117T102046Z-b5f4850/logs/final-test-wasm.log` |
| 7 | `npm run test:sketch-unit` | 0 | PASS | `evidence/run-20261117T102046Z-b5f4850/logs/final-test-sketch-unit.log` |
| 8 | `npm run test:sketch-wasm` | 0 | PASS | `evidence/run-20261117T102046Z-b5f4850/logs/final-test-sketch-wasm.log` |
| 9 | `npm run test:profile-unit` | 0 | PASS | `evidence/run-20261117T102046Z-b5f4850/logs/final-test-profile-unit.log` |
| 10 | `env PROFILE_STEP_OUTPUT_DIR=evidence/run-20261117T102046Z-b5f4850/artifacts/profile-steps npm run test:profile-wasm` | 0 | PASS | `evidence/run-20261117T102046Z-b5f4850/logs/final-test-profile-wasm.log` |
| 11 | `npm run check:parity` | 0 | PASS | `evidence/run-20261117T102046Z-b5f4850/logs/final-check-parity.log` |
| 12 | `npm run test:geometry` | 0 | PASS | `evidence/run-20261117T102046Z-b5f4850/logs/final-test-geometry.log` |
| 13 | `python3 scripts/check_sketch_schema.py` | 0 | PASS | `evidence/run-20261117T102046Z-b5f4850/logs/final-check-sketch-schema.log` |
| 14 | `python3 scripts/audit_next_milestones.py` | 0 | PASS | `evidence/run-20261117T102046Z-b5f4850/logs/final-audit-next-milestones.log` |
| 15 | `npm run build:studio` | 0 | PASS | `evidence/run-20261117T102046Z-b5f4850/logs/final-build-studio.log` |
| 16 | `npm run test:browser` | 0 | PASS | `evidence/run-20261117T102046Z-b5f4850/logs/final-test-browser.log` |
| 17 | `npm run test:sketch-browser` | 1 | FAIL(1) | `evidence/run-20261117T102046Z-b5f4850/logs/final-test-sketch-browser.log` |
| 18 | `npm run test:profile-browser` | 0 | PASS | `evidence/run-20261117T102046Z-b5f4850/logs/final-test-profile-browser.log` |
| 19 | `npm run test:worker-memory` | 0 | PASS | `evidence/run-20261117T102046Z-b5f4850/logs/final-test-worker-memory.log` |
| 20 | `PROFILE_STEP_OUTPUT_DIR=... npm run test:profile-wasm` | 0 | PASS | `evidence/run-20261117T102046Z-b5f4850/logs/test-profile-wasm-export.log` |
| 21 | `env PYTHONPATH=packages/cad-geometry-python/src python3 scripts/verify_profile_steps_with_native.py evidence/run-20261117T102046Z-b5f4850/artifacts/profile-steps evidence/run-20261117T102046Z-b5f4850/artifacts/profile-step-native-report.json` | 0 | PASS | `evidence/run-20261117T102046Z-b5f4850/logs/final-verify-profile-steps-native.log` |
| 22 | `npm run test:geometry` | 0 | PASS | `evidence/run-20261117T102046Z-b5f4850/logs/test-geometry-after-fix.log` |
| 23 | `npm run check:parity` | 0 | PASS | `evidence/run-20261117T102046Z-b5f4850/logs/check-parity-after-fix.log` |
| 24 | `npm run test:profile-unit` | 1 | FAIL(1) | `evidence/run-20261117T102046Z-b5f4850/logs/test-profile-unit-after-fix.log` |
| 25 | `npm run test:profile-unit` | 0 | PASS | `evidence/run-20261117T102046Z-b5f4850/logs/test-profile-unit-after-fix2.log` |
| 26 | `npm run check` | 0 | PASS | `evidence/run-20261117T102046Z-b5f4850/logs/final-check.log` |
| 27 | `npm run test:sketch-browser` | 0 | PASS | `evidence/run-20261117T102046Z-b5f4850/logs/rerun-sketch-browser-1.log` |
| 28 | `npm run test:sketch-browser` | 0 | PASS | `evidence/run-20261117T102046Z-b5f4850/logs/rerun-sketch-browser-2.log` |

## Commands executed outside the automated ledger

| command | exit | note |
|---|---|---|
| `npm ci --no-audit --no-fund` | 0 | lockfile install (1.5 s, warm cache) |
| `npx playwright install chromium firefox webkit` | — | browsers already cached: chromium-1255 / firefox-1497 / webkit-2227 |
| `python3.12 -m venv .venv` + `pip install -e packages/cad-geometry-python 'jsonschema>=4.21,<5'` | 0 | OCP 7.9.3.1.1 venv (CPython 3.12.15) |
| `safaridriver -p 4445` + W3C `POST /session` | 1 | `session not created`: 'Allow remote automation' not enabled → native Safari NOT RUN |
| `node ./tmp_browser_versions.mjs` | 0 | recorded engine versions + WebGL renderer strings |

