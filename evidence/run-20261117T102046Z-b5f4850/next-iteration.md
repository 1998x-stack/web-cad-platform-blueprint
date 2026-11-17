# Next iteration — `run-20261117T102046Z-b5f4850`

Ranked. Only **T1/T2** gate G0; the rest are follow-ups or CAD-009 prep.

## T1 — Native Safari.app smoke (closes D1/D7) — *blocking G0 sign-off*

Enable Safari ▸ Settings ▸ Advanced ▸ *Show features for web developers* ▸ Developer ▸ **Allow Remote
Automation**, then run the three browser suites against real Safari (e.g. a small `safaridriver`-driven
harness that loads the built Studio pages and reads `window.__CAD_E2E__` / `__SKETCH_E2E__`). Record the
Safari version and the exact UI actions; keep `NOT RUN` until it actually executes. Do **not** substitute
WebKit.

## T2 — Native leak proof or an explicit remaining gap (closes D2)

Either (a) find/patch a byte-level allocation counter in `occt-wasm` 5.17.2, or (b) run an external soak
(large meshes, long STEP strings, repeated re-init) and compare worker RSS + linear high-water over hours.
Keep native live-allocation claims out of the gate until then; the worker-local reservation and arena-handle
evidence already in `memory-report.json` is the accepted interim.

## T3 — CAD-009 slice: interactive sketch → constrained points → exact solid

Small, independently reviewable PR: point/line/closed-loop drawing → real planegcs constrained
non-fixed points + diagnostics → exact Wire/Face/Extrude → **revisioned canonical document** (through the
typed CommandService + expected revision). IndexedDB durability is a **separate** slice. Do not reuse the
three fixed-position polygons as evidence of parametric constraints (D5).

## T4 — De-flake `test:sketch-browser` (P2)

Root cause the Firefox `#width150` click timeout seen once under load. Options: bound the page's
`requestAnimationFrame` render loop to idle/visibility, or add an explicit actionability retry with a
logged diagnostic. Any retry must still fail loudly if the Worker result is wrong — never convert a
geometry failure into a pass.

## T5 — Supply-chain artefacts (closes D6)

Generate an SBOM and a third-party license bundle covering `occt-wasm` (LGPL-2.1-only WASM),
`@salusoft89/planegcs` (LGPL-2.0-or-later) and `cadquery-ocp` (OCCT), with replacement/relink notes.

## T6 — Browser STEP import + broader interop (D8, CAD-005)

Add browser STEP **import** with a malformed-input matrix and cross-kernel round-trip fixtures before
widening any interoperability claim.
