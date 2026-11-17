# Browser matrix — `run-20261117T102046Z-b5f4850`

Real Dedicated-Worker OCCT WASM / planegcs runs. A row is PASS only if exact B-Rep numbers and STEP bytes
were asserted **in that engine**; no engine is skipped and no mesh-only mock is accepted.

- **Render mode** comes from the literal `window.__CAD_E2E__.renderBackend` / `__SKETCH_E2E__.renderBackend`.
- `test:browser` = CAD-004 (exact plate, parametric edit r4→r6, STEP download, dispose).
- `test:sketch-browser` = CAD-006 (planegcs rectangle, under-constrained, conflicting, STEP).
- `test:profile-browser` = CAD-007 (triangle ↔ concave L, thickness edit, revision undo/redo, STEP).

| Engine | Engine version | CAD-004 (`test:browser`) | CAD-006 (`test:sketch-browser`) | CAD-007 (`test:profile-browser`) | Render mode |
|---|---|---|---|---|---|
| Chromium | 143.0.7499.4 | PASS | PASS | PASS | `webgl` |
| Firefox | 144.0.2 | PASS | PASS | PASS | `webgl` |
| WebKit (Playwright) | 26.0 | PASS | PASS | PASS | `webgl` |
| Chromium **forced no-WebGL** (negative control) | 143.0.7499.4 | PASS | PASS | n/a (SVG-only page) | `fallback` |
| Native **Safari.app** | 27.3 (22626.1.12.11.4) | **NOT RUN** | **NOT RUN** | **NOT RUN** | — |

## Forced no-WebGL integrity

The Chromium negative control installs an init script that makes `HTMLCanvasElement.getContext` return
`null` for `webgl`/`webgl2`. The suite then asserts:

- `renderBackend === 'fallback'` and the accessible `[data-testid=webgl-fallback]` overlay is visible,
- the real Worker still returns `solidCount === 1` and the exact volumes (`214492.03552627692`,
  `212607.079934123` mm³ for CAD-004; `216000` → `270000` mm³ for CAD-006),
- under-constrained → DOF 1 and conflicting → `valid:false` keep the last valid solid,
- a genuine STEP download still occurs and `pageerror` list is empty.

Losing WebGL therefore degrades **visualisation only**; B-Rep build, parametric edit, the planegcs solve,
STEP export and Worker dispose all still run.

## Caveats recorded honestly

1. **Native Safari.app = NOT RUN.** `safaridriver` refused to create a session because *Allow Remote
   Automation* is off (a GUI-only preference). WebKit/Playwright is a compatibility signal, not Safari.
2. **One load-related flake observed.** During the single sequential run of all three browser suites,
   `test:sketch-browser` failed on Firefox: `locator.click('#width150')` reached *performing click action*
   then hit the 30 s timeout while several browser/WASM processes were live. Two subsequent isolated
   `npm run test:sketch-browser` runs passed all four scenarios. No test was skipped or loosened; the
   failure is preserved in `logs/final-test-sketch-browser.log`. Follow-up: see `next-iteration.md` (T4).
3. Headless engines use software/Apple GPU WebGL; results may differ on a discrete GPU workstation.
4. `pageerror`, request failures and the `renderBackend` flag are asserted; Playwright traces are only kept
   for failing runs and are not committed.
