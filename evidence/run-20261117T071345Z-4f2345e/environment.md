# Environment — run-20261117T071345Z-4f2345e

## Host
| Item | Value |
| --- | --- |
| OS | macOS 27.3 (build 26C5035r) |
| Arch | arm64 (Apple Silicon) |
| Node.js | v26.13.1 |
| npm | 11.20.0 |
| System Python | Python 3.9.6 at /usr/bin/python3 |
| Oracle Python | 3.12.15 (/tmp/cad-ocp-venv, local venv) |
| Git | git version 2.54.0 (Apple Git-157) |
| Docker | present (unused) |
| cmake / emcc | NOT INSTALLED (no native OCCT build from source possible) |

## Pinned kernels and libraries
| Component | Version | Runtime | Role |
| --- | --- | --- | --- |
| occt-wasm | 5.17.2 | WASM (browser + node worker_threads) | primary kernel under test |
| cadquery-ocp | 7.9.3.1.1 | native (CPython 3.12 arm64 wheel) | independent oracle |
| @salusoft89/planegcs | 1.3.0 | WASM | sketch constraint solver |
| three | 0.180.0 | browser | derived view only |
| vite | 7.2.2 | build | studio bundler |
| playwright | 1.57.0 | browser | E2E driver |
| jsonschema | 4.26.0 | python | cross-runtime contract parity |

Bundle sizes measured this run (`npm run build:studio`):
- `occt-wasm-*.wasm` = 21,345.55 kB (gzip 6,819.19 kB)
- `planegcs-*.wasm` = 484.00 kB (gzip 172.58 kB)

## Note on Python
`packages/cad-geometry-python/pyproject.toml` requires `>=3.11,<3.14`. The system
interpreter is 3.9.6, so the native oracle was run in a **local** Python 3.12.15 venv
outside the repository. No repository file depends on that venv; CI installs the same
pinned wheel with its own 3.12 setup.
