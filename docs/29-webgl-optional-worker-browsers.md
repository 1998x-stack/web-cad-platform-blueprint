# CAD-008 follow-up: WebGL-independent CAD compute path

**Scope:** Gracefully degrade Studio and Sketch when Three.js cannot initialize WebGL, without weakening real OCCT/planegcs computation, STEP or negative constraint validation. This is a *visual rendering fallback*, not a replacement geometry kernel.

## Behavior

- Attempt to create `THREE.WebGLRenderer` inside a try/catch in each page. On failure, display an accessible fallback overlay; the authoritative B-Rep still lives in the Worker.
- `window.__CAD_E2E__` and `window.__SKETCH_E2E__` publish a literal `renderBackend` of `webgl` or `fallback`. Only GPU mesh allocation and render loops are conditional; worker initialization, geometry validity checks, sketch solver, editing, STEP export and worker dispose **still execute**.
- Tests run actual geometry on Chromium, Firefox and WebKit, plus **forced WebGL denial in Chromium**. Each scenario validates exact solid volume and STEP download, including negative solver states on Sketch. A browser only passes if the real Worker succeeds; there is no skip and no mesh-only mock.
- `npm ci` is used in CI to honor the newly committed lockfile.
- Browser failure fallback is not a 3D display solution; without WebGL the user receives an explicit message and still has the numeric/2D/STEP paths. A software 3D preview can be evaluated later.

## Run

```bash
npm ci
npm run build:studio
npx playwright install chromium firefox webkit
npm run test:browser
npm run test:sketch-browser
npm run test:profile-browser
```

## Acceptance

- Real Node/WASM unit tests and original CAD-007 browser suite remain green.
- Chromium + Firefox + WebKit actual OCCT build/modify/STEP pass for CAD-004, and actual planegcs/OCCT/STEP plus under-/over-constrained cases pass for CAD-006.
- Forced non-WebGL run in Chromium enters `renderBackend=fallback` while exact Worker tests still pass.
- No `pageerror`; no status can be marked green from an absent Worker.
- Native macOS Safari remains a separate verification task. WebKit/Linux alone is not Safari certification.
- This does **not** establish a zero-leak guarantee of OCCT internal WASM heap allocations. Worker `retainedGeometryCount` in PR #16 represents logical active geometry only.
