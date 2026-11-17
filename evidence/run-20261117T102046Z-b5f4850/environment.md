# Environment — `run-20261117T102046Z-b5f4850`

Captured on macOS 2026-11-17. All numbers below were observed on this machine, not copied from CI.

| Item | Value |
|---|---|
| Host OS | macOS 27.3 (build `26C5035r`), Darwin `27.3.0`, `arm64` (Apple T8142) |
| Verified remote HEAD | `b5f48504f18d57c1b2deffe3d1d68591189646c9` (`origin/main`; PR #16 `1c2a23d` + PR #17 `b5f4850` both MERGED) |
| Working branch | `fix/cad-008-g0-verification` (created from `origin/main`) |
| Node / npm | `v26.13.1` / `11.20.0` |
| System python | `/usr/bin/python3` = 3.9.6 — **not used for OCP** (`requires-python >=3.11,<3.14`) |
| OCP venv | `.venv` = CPython **3.12.15** (`/opt/homebrew/opt/python@3.12`) |
| Native kernel | `cadquery-ocp==7.9.3.1.1` (import module `OCP` 7.9.3.1); numpy 2.5.5; jsonschema 4.26.0 |
| WASM kernel | `occt-wasm@5.17.2` |
| Sketch solver | `@salusoft89/planegcs@1.3.0` |
| Renderer | `three@0.180.0` |
| Bundler / E2E | `vite@7.2.2` / `playwright@1.57.0` |
| Playwright engines | chromium **143.0.7499.4** (build 1255), firefox **144.0.2** (build 1497), webkit **26.0** (build 2227) |
| WebGL renderer (headless) | chromium: `ANGLE (Vulkan 1.3.0 SwiftShader)`; firefox: `Apple M1`; webkit: `Apple GPU` |
| Native Safari.app | **27.3 (22626.1.12.11.4)** — automation blocked, see below |
| git / gh | `2.54.0 (Apple Git-157)` / `gh 2.102.0` |

## Native Safari automation status

`safaridriver --version` → `Included with Safari 27.3`. A supported W3C WebDriver session was attempted:

```
POST http://127.0.0.1:4445/session  {"capabilities":{"alwaysMatch":{"browserName":"safari"}}}
→ {"value":{"error":"session not created",
   "message":"Could not create a session: You must enable 'Allow remote automation'
   in the Developer section of Safari Settings to control Safari via WebDriver."}}
```

Enabling that toggle is a GUI/user action (Safari ▸ Settings ▸ Advanced ▸ Show features for web developers ▸
Developer ▸ Allow Remote Automation) and was **not** performed automatically. Therefore native Safari.app
interaction is reported **NOT RUN**. Playwright WebKit 26.0 is a separate engine and is **not** treated as
Safari certification.

## Reproduce this environment

```bash
git fetch --prune origin && git switch -c fix/cad-008-g0-verification origin/main
npm ci --no-audit --no-fund
/opt/homebrew/bin/python3.12 -m venv .venv && . .venv/bin/activate
python -m pip install -e packages/cad-geometry-python 'jsonschema>=4.21,<5'
npx playwright install chromium firefox webkit
```

Raw logs, STEP files and traces live under `evidence/<RUN_ID>/logs/` and `.../artifacts/` (git-ignored).
