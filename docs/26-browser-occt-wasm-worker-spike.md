# 26 | CAD-004 浏览器真实 OCCT WASM Worker：实现与验收证据

> 状态：实现已提交候选；**最终通过状态以 GitHub Actions 的 `wasm-worker-and-browser` 作业为准**。本报告不将模拟 Kernel 单测视为几何数值证明，也不将本次垂直 Spike 等同 G0 全部通过。

## 1. 为什么改用 `occt-wasm`

- 采用**固定版本 `occt-wasm@5.17.2`**，不允许依赖 `latest` 滚动更新。
- 直接使用 OCCT B-Rep 算法：`makeBox`、`makeCylinder`、`translate`、`cut`、`fuse`、`common`、`getVolume`、`getSurfaceArea`、`getBoundingBox`、`subShapeCount`、`isValid`、`tessellate`、`exportStep`。
- 目前 P0 单线程 Dedicated Web Worker，避免让 Emscripten 在 UI 主线程进行几何计算；Three.js 只接收可释放的三角化副本。
- `occt-wasm` TypeScript 封装采用 MIT/Apache 2.0；**WASM 二进制本身继承 OCCT 的 LGPL-2.1-only**。实际分发、替换 WASM 与许可证声明，须满足相应许可证及合规审核；不应仅根据 npm 包标签判断。
- 不使用 `brepjs` 的更高层功能，以便与当前 Native P0 箱体/圆柱/布尔基准保持一一映射。将来草图约束和 Extrude 再独立审核。

相关源： https://github.com/andymai/occt-wasm ， https://www.npmjs.com/package/occt-wasm

## 2. 已写入的代码

| 文件 | 功能 |
|---|---|
| `packages/cad-geometry/src/evaluator.mjs` | 严格 P0 输入与参数解析、ID 排序的特征依赖 DAG、真实 ShapeHandle、数值证据 |
| `packages/cad-geometry/src/worker-runtime.mjs` | 单活跃几何所有权、generation 防旧结果覆盖、异常代码、Transferable Mesh/STEP、显式释放 |
| `packages/cad-geometry/src/browser-worker.mjs` | 浏览器 Worker 入口，加载 WASM，顺序处理消息 |
| `packages/cad-geometry/src/node-worker.mjs` | 独立 Node Worker 入口，运行相同 WASM runtime 供数字验收 |
| `packages/cad-geometry/src/client.mjs` | Worker 请求关联、超时、错误、过期结果处理与关闭 |
| `apps/studio/src/main.mjs` | 最小 Three.js Web 工作台：改圆孔半径、精确重建、STEP 下载、释放 |
| `scripts/test_browser.mjs` | Playwright Chromium 检验实际 Dedicated Worker、几何数字、参数变更和下载 |
| `scripts/verify_wasm_step_with_native.py` | 用独立 native OCP STEP Reader 回读 WASM 产生的 STEP 文件 |

### 关键资源不变量

1. 一个 Worker 管理一个 `OcctKernel` arena；内核不跨线程共享；每次 build 先清理前一个 arena 里的形状句柄；旧 `geometryId` 永远不再可用。
2. 重建需要严格递增的 `generation`；新一代 build 失败时不保留旧 handle（fail closed）。这是 P0 策略；P2 设计另需保持 UI 的上次成功渲染版本。
3. 三角网格仅作为渲染数据，传输时将 TypedArray 的 `ArrayBuffer` transfer；STEP 为文本编码成 `Uint8Array` transfer。
4. 明确限制：每文档最多 100 个 P0 Features、尺寸上限 10^6 mm、三角面上限 100 万、STEP 文件大小上限 50 MB。未来应引入 Worker 级 CPU 和总体内存预算。
5. `outputBodyId` 必填，`Sketch`/`Extrude` **仍未在 P0 实现**；UnsupportedFeature 必须返回错误。

## 3. 复现命令

```sh
npm install --no-audit --no-fund
npm run test:worker-unit
npm run test:wasm
npm run build:studio
npx playwright install chromium
npm run test:browser
```

在 GitHub Actions 中进一步执行：

```sh
WASM_STEP_OUTPUT=/tmp/wasm-precision.step npm run test:wasm
python -m pip install -e packages/cad-geometry-python
PYTHONPATH=packages/cad-geometry-python/src python scripts/verify_wasm_step_with_native.py /tmp/wasm-precision.step
```

浏览器本地体验：

```sh
npm run dev:studio
# http://127.0.0.1:4173
```

## 4. 数值门禁与完成条件

- 120×60×30 mm、中央半径 4 mm 通孔：期望 `214492.03552627692 mm³`。
- 半径由 4 → 6 mm、Revision +1：期望 `212607.079934123 mm³`。
- Native Oracle 与 WASM 的体积 ≤ `1e-3 mm³`、表面积 ≤ `1e-3 mm²`，BBox 每坐标 ≤ `1e-4 mm`。
- 必须实际 `isValid` 且 `solidCount == 1`；STEP 的 `ISO-10303-21` 头部是必要非充分条件，独立 Reader 回读才是核心验证。
- Worker Test、Node Real WASM Test、Vite 构建、Chromium Playwright Test 需全部通过，失败必须阻止发布。

## 5. 尚未完成，不能宣称 G0 通过

- Firefox/Safari 浏览器 Worker 实测与兼容矩阵。
- 100 次 build/mesh/export/dispose 的留存内存基准及运行时间/包体积实测。
- `planegcs` 或等价的可解释草图约束 Solver Spike。
- 浏览器内 STEP **导入**及 malformed STEP 输入阻断矩阵（本次仅独立 Native STEP 回读）。
- 完整 JSON Schema runtime validator 与 Worker response 的规范化扩展；当前有输入领域校验，但尚不是完整 Schema 对等校验。
- 发布时提供第三方许可证清单、WASM 动态替换方式、SRI/资产校验和 CSP。

**结论：** 这是 CAD-004 的真实 Browser Kernel 垂直实现候选与可复现 CI，不是完整产品或已放行的 G0。
