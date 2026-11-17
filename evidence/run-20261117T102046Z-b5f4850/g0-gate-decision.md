# G0 formal gate decision — `run-20261117T102046Z-b5f4850`

Authority: `docs/21-next-milestones-p0-p2.md` §3 (G0.1/G0.2/G0.3). Each line is classified from **executed**
evidence in this run; `NOT RUN` / `NOT VERIFIED` are stated as such rather than folded into PASS.

## Verdict

> **PASS_WITH_DEVIATIONS — PROPOSED, NOT ACCEPTED.**
> No unconditional PASS: real Safari.app smoke is absent and a native byte-level leak proof does not exist.
> Every deviation below needs an owner, expiry and explicit sign-off before G0 is released.

## G0.1 Domain / schema

| Requirement | Status | Evidence |
|---|---|---|
| Authoritative versioned schemas (document/transaction/geometry-evidence/worker-envelope) + sketch | PASS | `packages/cad-contracts/schema/*.json`; `npm run check:contracts` |
| box/cylinder/boolean/`parameter.set`/`feature.update` accepted/rejected consistently in TS, Python native, browser WASM; cycles/NaN/negatives/unknown fields fail closed | PASS | `npm run check:parity` (16 fixtures, JS↔native↔JSON-Schema); `npm run test:worker-unit`; `command-engine.test.mjs`; `feature.update` tested in `geometry-primitives.test.mjs` |
| Stable topological order + explicit `outputBodyId`; cross-language trace identical | PASS | `test:worker-unit` order test; `test_geometry.py::test_reverse_feature_order_builds_same_valid_output` |
| Hole radius change via **only** `parameter.set` changes native **and** WASM volume; unit/dimension checks | PASS | `test_geometry.py`; `real-wasm.test.mjs`; `create_parameter_revision.mjs` |

## G0.2 Browser geometry

| Requirement | Status | Evidence |
|---|---|---|
| Real single-thread WASM in a Dedicated Worker | PASS | `window.__CAD_E2E__.worker === 'dedicated'` asserted on all engines |
| Chrome + Firefox + Safari stable, real browser CI + one Safari real/controlled smoke | **DEVIATION D1** | Chromium 143 / Firefox 144 / WebKit 26 PASS; **native Safari.app NOT RUN** (safaridriver needs GUI "Allow Remote Automation") |
| Benchmark solid: 1 valid solid, `216000 − π·4²·30 = 214492.03552627692 mm³`, native↔WASM compare, forward/reverse STEP, independent reader | PASS | `geometry-report.json`: native 214492.03552627692 mm³, native re-import of **WASM** STEP Δ=5.8e-11 mm³, bbox Δ=0, faces 7 |
| `tessellate` gives vertices/indices/normals + model revision; mesh never the exact source | PASS | `real-wasm.test.mjs` (`sourceDocumentRevision`); mesh used only for Three.js |
| ≥100 build/tessellate/export/dispose cycles; warm-up 20, net retained ≤64 MiB, measured | **PASS (bounded) / DEVIATION D2** | `memory-report.json`: linear reservation 128 MiB after init=warm=high=last, net 0, slope 0 B/cycle; arena handles 0 every cycle. Native byte-level leak = **NOT VERIFIED** |
| Long tasks don't block main-thread UI; cancel ⇒ old generation cannot overwrite new | PASS | geometry lives in Workers; `STALE_GENERATION` / `STALE_RESULT` tested (`worker-unit`, `real-wasm`) |
| STEP covers plate / no-hole box / other diameters / invalid & truncated STEP; codes traceable | PASS | plate & r6 in `test:wasm`; GEO-001 no-hole box in parity fixtures; invalid/truncated/empty STEP fail closed (`test_geometry.py`, `geometry-report.json.negatives`) |

## G0.3 Solver & governance

| Requirement | Status | Evidence |
|---|---|---|
| planegcs 4-line rectangle; dim/horizontal/vertical/coincident; under/fully/over-constrained/non-convergent states with residual + DOF or diagnostic level | **PASS (subset) / DEVIATION D4** | `test:sketch-unit`, `test:sketch-wasm`, `test:sketch-browser` (fully=0 DOF, under=1, conflicting fail-closed, residual ≤1e-5 mm). DOF = local-Jacobian rank for the tested subset only |
| License/version/BOM/supply-chain locked; OCCT/planegcs license obligations assessed | **DEVIATION D6** | versions pinned (`occt-wasm 5.17.2`, `planegcs 1.3.0`, `cadquery-ocp 7.9.3.1.1`); license notes in `docs/26`, `docs/27`. No generated SBOM/third-party license file yet |
| G0 reviewed by frontend + geometry + data; PASS / PASS WITH ACCEPTED DEVIATION / NO-GO | PROPOSED | this document |

## Deviation register (all PROPOSED, none accepted yet)

| ID | Deviation | Owner | Risk if accepted as-is | Revisit |
|---|---|---|---|---|
| D1 | Native Safari.app smoke NOT RUN (WebKit only) | Frontend/QA | Safari-specific Worker/WebGL/STEP-save behaviour unverified | before G0 sign-off; enable Allow Remote Automation |
| D2 | No native byte-level OCCT leak proof; only linear-memory high-water + arena handle count | Geometry | A C++-heap leak outside the arena would be invisible | when `occt-wasm` exposes an allocation counter, or after an external soak profile |
| D3 | No software 3D preview when WebGL is absent | Frontend | Degraded UX (2D + numbers + STEP only) | product decision |
| D4 | planegcs DOF is a subset Jacobian-rank estimate, not general DOF | Geometry | Misread as a general DOF claim | when a general DOF routine is validated |
| D5 | The 3 CAD-007 polygons are geometrically fixed loops, **not** proof of general parametric sketch constraints | Geometry/Frontend | Over-claiming parametric sketching | at CAD-009 |
| D6 | No formal SBOM / third-party license bundle | Data/Release | LGPL redistribution obligations not yet audited artifact-by-artifact | before any external distribution |
| D7 | WebKit CI is Linux, not macOS Safari; browser CI ≠ Safari certification | QA | Same as D1 | with D1 |
| D8 | STEP support is a narrow P0 subset (no browser STEP **import**; malformed handled only in native oracle) | Geometry | Interop expectation mismatch | CAD-005 follow-up |

## Explicitly not claimed

- No zero-leak guarantee of OCCT internal WASM heap allocations.
- No STEP/B-Rep general-protocol or manufacturing-fitness claim.
- No claim that the polygon examples demonstrate parametric sketch constraints.
- Safari.app is **NOT RUN**, not "passing".
