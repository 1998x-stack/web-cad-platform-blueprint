# RUN SUMMARY — `run-20261117T102046Z-b5f4850`

Role: senior CAD-kernel + web-platform engineer and strict QA reviewer. Scope: CAD-008 (#14, G0) hardening
→ CAD-009 readiness. This is reproducible evidence plus small, safe fixes — **not** an optimistic status
report. The earlier PRs #16 and #17 are already MERGED; nothing is auto-merged here.

## 1. State

| | |
|---|---|
| Verified remote HEAD | `b5f48504f18d57c1b2deffe3d1d68591189646c9` (`origin/main`) |
| Branch | `fix/cad-008-g0-verification` (created from `origin/main`; 1 reviewable commit) |
| Working tree before commit | clean apart from the intended 6 modified + 2 added files |
| Remote PRs | #16 MERGED (`1c2a23d`), #17 MERGED (`b5f4850`) — CI green both |
| OS / toolchain | macOS 27.3 arm64; Node 26.13.1; npm 11.20.0; OCP venv CPython 3.12.15; cadquery-ocp 7.9.3.1.1; occt-wasm 5.17.2; planegcs 1.3.0; Playwright 1.57.0 |

## 2. Commands actually run

Full ledger: `commands.md`. Summary: every **non-browser** gate PASS; all three browser suites PASS for
Chromium/Firefox/WebKit + forced-no-WebGL Chromium; **one** intermittent Firefox failure preserved
(`logs/final-test-sketch-browser.log`, `test:sketch-browser`), not reproducible in 2 isolated re-runs.
Native Safari: **NOT RUN**. No command is reported PASS unless it executed here.

## 3. Root-caused defects

- **P1 (fixed):** native STEP reader leaked an uncaught `OCP…Standard_Failure: Bnd_Box is void` on a
  parse-corrupt STEP instead of failing closed. Fix + regression in
  `packages/cad-geometry-python/src/cad_geometry/kernel.py` and `tests/test_geometry.py`.
- **P2 (documented):** Firefox `#width150` click timeout under concurrent load (1 failure / 3 passes).

## 4. Numerical B-Rep + independent STEP

- Precision plate (CAD-004): native volume **214492.03552627692 mm³**; native re-import of the **WASM**
  STEP Δ = **5.8e-11 mm³**, bbox Δ = 0, 7 faces, all ≤ tolerance (1e-3 mm³ / 1e-4 mm).
- CAD-007 polygons, imported by **native OCP in a separate process** (`geometry-report.json`):
  triangle 60000.00000001 mm³ (5 faces), rotated rectangle 7999.999999998 mm³ (6 faces),
  concave L 67200.0 mm³ (8 faces); Δ vs expected ≤ 1.0e-8 mm³.
- Negatives fail closed: truncated / corrupt / empty STEP, self-intersecting native wire.
- **Distinction:** the polygons are *geometrically fixed* constrained loops — **not** evidence of general
  parametric sketch constraints (see D5). Metric sizes come from the kernel, never from mesh measurements.

## 5. Browser matrix

Chromium 143, Firefox 144, WebKit 26 all PASS CAD-004 / CAD-006 / CAD-007 with `renderBackend=webgl`;
Chromium **forced no-WebGL** PASS with `renderBackend=fallback` and exact Worker geometry + STEP intact.
**Native Safari.app = NOT RUN** (safaridriver needs the GUI *Allow Remote Automation* toggle). Details:
`browser-matrix.md`.

## 6. Worker-local WASM memory

Measured inside the Worker (`memory-report.json`): linear-memory reservation **128 MiB** at init, warm-up,
and after all 100 measured cycles — **net 0, slope 0 B/cycle**; raw OCCT arena handles **0 after every
dispose**; a deliberately unreleased build is correctly detected (leak-control). A native **byte-level**
leak proof does **not** exist → `NOT VERIFIED` (D2). Linear-memory reservation is a high-water figure, not
live bytes; logical `retainedGeometryCount` is `active ? 1 : 0` and is reported separately.

## 7. Formal G0 status

**PASS_WITH_DEVIATIONS — PROPOSED, NOT ACCEPTED.** No unconditional PASS because Safari real smoke is
absent and a native leak proof is missing. Deviation register D1–D8 with owners/expiry in
`g0-gate-decision.md`; each needs explicit acceptance.

## 8. Links, limitations, rollback, next

- Commit/PR: see the PR opened from `fix/cad-008-g0-verification`; CI runs the new
  `test:worker-memory` and the native profile-STEP verifier.
- Known limitations: D1–D8 above.
- Rollback: `git switch main` (work is isolated) or `git revert <commit>`; the `stats` change is additive.
- Next 3–5 tasks: **T1** Safari smoke (blocking), **T2** native leak proof, **T3** CAD-009 interactive
  sketch→constrained points→exact solid, **T4** de-flake `test:sketch-browser`, **T5** SBOM/licences.
  See `next-iteration.md`.
