# ADR-0001｜Native OCCT reference oracle → browser WASM adapter

- **Status:** Accepted for P0 technical spike only
- **Date:** 2026-11-17

## Context

Initial blueprint targets `OpenCascade.js` / `replicad` running in browser Worker. Runtime available for this work has a verified native `cadquery-ocp` installation but cannot resolve npm registry for installing/validating the browser WASM build. Pretending that a browser Worker works would be incorrect.

## Decision

Implement the lowest geometry/STEP boundary using native OCCT first (`packages/cad-geometry-python`), with a strict small feature subset. Keep `KernelAdapter` in TypeScript as browser integration port; **do not** add a fake WebAssembly fallback or claim browser support.

`box` and `cylinder` are deliberately added to Canonical Document schema as P0 primitives. The adapter's output is an independent source of geometric evidence, not the UI's three.js scene.

## Alternatives reviewed

1. `replicad + opencascade.js`: preferred long-term Web CAD authoring facade; package and browser runtime must be tested separately.
2. `occt-wasm`: modern typed WASM facade with direct STEP import/export and Worker capabilities; evaluate version pin, browser support, licensing and operation coverage before integration.
3. Pure JS CSG or mesh generators: rejected as proof for exact STEP B-Rep semantics.

## Consequences

- Positive: real CAD geometry and STEP roundtrip verified now; CI can independently reproduce with pinned wheel.
- Negative: not yet browser-ready; the Python bridge is not a drop-in implementation of TS `KernelAdapter`.
- Next gate: run `.wasm` on Chrome/Safari/Firefox, mesh visualization and cleanup, 100-cycle memory benchmark, compare native vs WASM oracle.
