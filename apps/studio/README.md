# apps/studio — planned app boundary

Future React + Vite + TypeScript CAD Studio and 3D Model Gallery. Not implemented in this blueprint.

Intended modules: `app/`, `features/{catalog,sketch,modeling,history,export,agent-review}/`, `viewport/`, `components/`.

UI must communicate through `cad-core` commands and `cad-geometry` worker; Three.js scene is not the authoritative CAD document. See docs/04 and docs/11.


## 2026-11-17 | P0 WASM Proof-of-Concept

`apps/studio/index.html` + `src/main.mjs` 使用真实 `occt-wasm@5.17.2` 的 Dedicated Worker 加载参数化孔板，向 Three.js 提供派生 Mesh；支持修改孔半径、重新构建、下载 STEP 以及释放模型。**仅是 P0 演示，不是草图/特征树/装配体编辑器。**

```sh
npm install --no-audit --no-fund
npm run dev:studio
# http://127.0.0.1:4173
```

详细见 `docs/26-browser-occt-wasm-worker-spike.md`。
