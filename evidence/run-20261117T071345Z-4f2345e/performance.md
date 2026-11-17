# Performance and lifecycle evidence — run-20261117T071345Z-4f2345e

All numbers below are **measured on this host**, not budgets from `docs/13`.
Machine: macOS 27.3, arm64 (Apple Silicon), Node v26.13.1, single thread, local filesystem.
Harnesses are local (not committed tests): `artifacts/measure-perf.mjs` -> `artifacts/perf-measurements.json`.

## 1. Bundle / artifact size (`npm run build:studio`, real output)

| Artifact | Raw | Gzip |
| --- | ---: | ---: |
| `assets/occt-wasm-*.wasm` | 21,345.55 kB | 6,819.19 kB |
| `assets/planegcs-*.wasm` | 484.00 kB | 172.58 kB |
| `assets/occt-wasm-*.js` (glue) | 66.51 kB | — |
| `assets/style-*.js` | 474.92 kB | 117.94 kB |
| `index.html` / `profile.html` / `sketch.html` | 1.48 / 1.89 / 2.27 kB | ≤1.25 kB |

The 21 MB OCCT WASM payload is the dominant first-load cost and is the single biggest
interactive-latency risk for the browser path. It was **not** re-measured over the network
in this run (localhost `vite` only), so no over-the-wire claim is made here.

## 2. Cold worker + cold WASM init, then a full CAD-007 edit (5 fresh workers)

Scenario: brand new `worker_threads` Worker -> `OcctKernel.init()` -> extrude the concave L
profile (area 5600 mm²) by 12 mm -> tessellate -> STEP export -> dispose.
Every run produced `volumeMm3 = 67200` (exact).

| Stage | P50 | P95 | Min | Max |
| --- | ---: | ---: | ---: | ---: |
| Cold init (worker + WASM instantiate) | 75.8 ms | 106.8 ms | 58.3 ms | 106.8 ms |
| First exact build (Wire+Face+Extrude) | 22.7 ms | 26.4 ms | 21.4 ms | 26.4 ms |
| Tessellate | 8.3 ms | 10.3 ms | 7.4 ms | 10.3 ms |
| STEP export | 27.8 ms | 30.9 ms | 27.2 ms | 30.9 ms |
| **Total init -> STEP file** | **133.7 ms** | **173.3 ms** | 114.7 ms | 173.3 ms |

`docs/13` targets "simple part rebuild P95 < 2 s (single-thread WASM, warm start)": measured
P95 total is 173 ms on an M-series host for a small prism, i.e. ~11x inside budget. This says
nothing about large/complex parts, so no general claim is made.

## 3. Lifecycle: 100 x build -> tessellate -> dispose (`npm run test:profile-wasm`)

| Metric | Before this round | After this round |
| --- | --- | --- |
| Metric definition | parent RSS delta sampled **before** `initialize()`, i.e. one-time WASM instantiation + arena warm-up **and** 100 cycles in one number | (a) worker-side retained-handle count asserted **every** cycle; (b) parent RSS drift sampled **after** 20 warm-up cycles |
| Reported value | ~96.28 MiB ("not a per-WASM heap proof") | **0 retained handles in all 100 cycles**; **~1-2 MiB** steady-state parent RSS drift over the last 80 cycles (observed 1.02 / 1.13 / 1.67 / 1.59 MiB across four runs) |
| Falsifiable? | no — the number was never asserted | yes — a positive control proves `stats` counts a live handle (1) and that dispose clears it (0) |

Raw observations:
- `test:profile-wasm` (after fix) reported: `0 retained handles every cycle; parent RSS drift over the last 80 cycles: 1.02 MiB`
- repeat run 1: `1.13 MiB`
- repeat run 2: `1.67 MiB`
- repeat run 3: `1.59 MiB`
- so the steady-state drift is **~1-2 MiB over 80 cycles**, not ~96 MiB, and it was previously
  measured from a pre-init baseline so one-time WASM instantiation was counted as growth.
- Each of the 100 cycles also asserts `exportStep` on the disposed id rejects with `STALE_GEOMETRY`.

**Honest limitation.** The retained-handle invariant covers the OCCT arena ownership that this
repository controls. The RSS figure still measures only the JS/worker boundary of the parent
process; it does not observe the WASM linear memory inside the Worker, and it is
GC/allocator dependent, so no absolute threshold is asserted. **Zero retained handles is not a
proof of absence of WASM heap leaks** (WASM linear memory never shrinks). Browser profiler /
long-duration soak testing remains outstanding, exactly as `docs/28` states.

## 4. Test-suite wall time (this host, cold-ish)

| Command | Seconds |
| --- | ---: |
| `npm run test` (cad-core domain) | 1 |
| `npm run check:contracts` | <1 |
| `npm run check:catalog` (sqlite) | <1 |
| `npm run check:docs` (fixed) | <1 |
| `npm run test:worker-unit` | 1 |
| `npm run test:wasm` (real WASM worker) | 1 |
| `npm run test:sketch-wasm` (real planegcs) | <1 |
| `npm run test:profile-wasm` (real WASM + 100 cycles) | 1 |
| `npm run test:geometry` (native oracle, 18 tests) | 2 |
| `npm run check:parity` (native oracle) | 1 |
| `npm run build:studio` | 2 |
