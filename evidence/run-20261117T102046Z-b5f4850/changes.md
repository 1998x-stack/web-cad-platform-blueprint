# Changes — `run-20261117T102046Z-b5f4850`

Base: `origin/main` @ `b5f4850`. Branch: `fix/cad-008-g0-verification`. 6 files changed, 2 added.
No dependency or schema-version change; no formatting churn.

## Root-caused defects

### P1 — native STEP reader did not fail closed on a parse-corrupt file (FIXED)

- **Repro:** export a valid STEP, replace a keyword (`CARTESIAN_POINT` → `NOT_A_KEYWORD`), call
  `cad_geometry.kernel.import_step`. The reader returned a non-null but empty shape and `evidence()`
  raised the **untyped** `OCP.OCP.Standard.Standard_Failure: Bnd_Box is void` instead of a typed
  `GeometryError`. A malformed STEP therefore escaped the documented fail-closed contract.
- **Fix:** `packages/cad-geometry-python/src/cad_geometry/kernel.py` — `evidence()` now checks
  `bounds.IsVoid()` (after `BRepBndLib.Add_s`) and raises `GeometryError`, so corrupt/empty imports fail
  deterministically.
- **Regression:** `packages/cad-geometry-python/tests/test_geometry.py::test_malformed_step_fails_closed_without_uncaught_kernel_error`
  covers truncated, corrupt-keyword and empty STEP.

### P2 — Firefox browser click flake under concurrent load (DOCUMENTED, no code change)

- One failure in a single back-to-back run of all three browser suites: `test:sketch-browser`, Firefox,
  `locator.click('#width150')` timed out at *performing click action* (element visible/enabled/stable).
  Reproduced 0/2 in isolated re-runs. Not "fixed" because loosening the test could mask a real regression;
  the failure log is preserved. Follow-up in `next-iteration.md`.

## Improvements delivered

| Area | Change | Why |
|---|---|---|
| Worker memory evidence | `worker-runtime.mjs` `stats` now also returns `wasmHeapBytes` (`getRawModule().HEAPU32.buffer.byteLength`) and `rawShapeCount` (`getRawKernel().getShapeCount()`). Additive, read-only. | G0.2 memory budget must be measured from the **Worker**, not parent RSS; `retainedGeometryCount` was logical-only (`active ? 1 : 0`). |
| Worker memory regression | New `packages/cad-geometry/test/worker-memory.test.mjs` + `npm run test:worker-memory`: 20 warm-up + ≥100 build/tessellate/export/dispose cycles, 4 tests, leak-detection negative control, re-init stale-handle probe, machine-readable report. | Makes "arena actually released" and the linear-memory high-water falsifiable and reproducible. |
| Independent polygon STEP re-import | `scripts/verify_profile_steps_with_native.py` re-imports each CAD-007 profile STEP in a separate native OCP process, rebuilds an independent native prism oracle, and runs truncated/corrupt/self-intersecting negatives. `profile-wasm.test.mjs` can now persist real WASM STEP bytes via `PROFILE_STEP_OUTPUT_DIR`. | CAD-007 STEP had never been read back by an independent native reader. |
| Profile winding / degenerate coverage | `profile.test.mjs` asserts raw validation preserves winding sign, derived profiles are CCW, and a sub-1e-8 mm² sliver fails closed. | Locks the orientation + degeneracy contract. |
| CI gates | `.github/workflows/blueprint-ci.yml`: run `test:worker-memory`, export profile STEPs, and run the native profile STEP verifier. | New evidence must gate, not just run locally. |

## Files

```
 M .github/workflows/blueprint-ci.yml
 M package.json
 M packages/cad-geometry-python/src/cad_geometry/kernel.py
 M packages/cad-geometry-python/tests/test_geometry.py
 M packages/cad-geometry/src/worker-runtime.mjs
 M packages/cad-geometry/test/profile-wasm.test.mjs
 M packages/cad-sketch/test/profile.test.mjs
?? packages/cad-geometry/test/worker-memory.test.mjs
?? scripts/verify_profile_steps_with_native.py
```

## Rollback

```bash
git switch main      # this work is isolated on fix/cad-008-g0-verification
# or, on the branch:
git revert <this-commit>          # single reviewable commit
```
The `stats` extension is purely additive; reverting it leaves the earlier logical-only behaviour intact.
