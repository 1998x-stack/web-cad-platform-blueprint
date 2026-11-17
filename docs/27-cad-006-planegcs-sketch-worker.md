# 27｜CAD-006：真实 planegcs WASM 二维草图约束求解 Spike

> 2026-11-17 · 阶段：P0 / G0 · 本文只陈述已实施的代码范围；真实 npm/WASM/Chromium 结果以 GitHub Actions 作业为准。

## 目标与边界

将 FreeCAD 的 PlaneGCS 约束求解器经 `@salusoft89/planegcs@1.3.0` 封装为独立的浏览器 Worker，验证 120×60 mm 的二维矩形约束、欠约束诊断、冲突诊断，并将完全约束的**轴对齐矩形**转换成现有 `CadDocumentV1` 的 `box` 特征，供已通过验收的 `occt-wasm@5.17.2` 精确生成 B-Rep、导出 STEP。

**不是**全功能 CAD Sketcher。尚未完成任意轮廓封闭性、圆弧、通用 Face Extrude、拖拽、参数历史持久化、装配、Safari/Firefox 测试或生产 DOF 求解。`box` 是矩形轮廓的精确等价几何，但此阶段没有把通用草图 feature 作为可编辑历史节点提交。

## 具体文件

| 路径 | 职责 |
| --- | --- |
| `packages/cad-contracts/schema/sketch.v1.schema.json` | 封闭的 SketchDocumentV1 JSON Schema |
| `packages/cad-sketch/src/validation.mjs` | 严格的点、线、圆、约束验证，稳定 ID 到 planegcs 数字 ID 转换 |
| `packages/cad-sketch/src/solver.mjs` | 真正的 planegcs 求解调用，故障诊断、残差检查、局部 Jacobian DOF 估计、矩形到精确实体转换 |
| `packages/cad-sketch/src/planegcs.mjs` | 真实 WASM 加载与独立 solver 生命周期 |
| `packages/cad-sketch/src/browser-worker.mjs` | 浏览器 Dedicated Worker，Vite `?url` 显式定位 WASM |
| `packages/cad-sketch/src/node-worker.mjs` | Node Worker 入口（开发/回归用途） |
| `apps/studio/sketch.html` / `src/sketch-main.mjs` | 2D 草图与 3D OCCT 并列示范页 |
| `samples/rectangle*.sketch.json` | 完全约束、欠约束、冲突样例 |
| `scripts/test_sketch_browser.mjs` | 真实 Chromium Web Worker E2E |

## 求解 / 验证工作流

1. `validateSketch()`：拒绝未知字段、重复 ID、非有限坐标、非法引用、负半径或无限值。
2. `toPlanegcs()`：先点，再线/圆，最后约束；转换为 planegcs 原生可识别的数字 ID。水平/垂直用两个点同一坐标维度的 `equal` 约束，尺寸用 `p2p_distance`，重合用 `p2p_coincident`。
3. 每次创建新的 `GcsWrapper` 与 `GcsSystem`，推送 primitives/constraints，执行真实 `solve()`，读取冲突和冗余 ID。
4. `SolveStatus.Success` 时方可 `apply_solution()`，验证各约束残差 ≤1e-5 mm。独立 Jacobian 秩给出**仅限此约束子集**的自由度估计，不假冒原生 GCS 的通用 DOF 结论。
5. `fully_constrained` 方可将无自交轴对齐矩形转换为精确 `box` CAD 特征，并通过已有 OCCT Worker 执行精确 B-Rep / STL 化预览 / STEP 导出。
6. `underconstrained` / `conflicting` 时不修改现有 B-Rep；每次求解 `finally` 中显式调用 `destroy_gcs_module()`。

## 测试矩阵

| 测试 | 断言 |
| --- | --- |
| `npm run test:sketch-unit` | 严格文档验证、重复 ID/悬挂引用拒绝、自由度秩、无效轮廓拒绝 |
| `npm run test:sketch-wasm` | **真实** planegcs 求解 120×60，DOF=0；移除高度 DOF=1；冲突 fail closed；变更宽度求解到 150 |
| `python scripts/check_sketch_schema.py` | Draft 2020-12 schema 校验三个样例 |
| `npm run test:sketch-browser` | **真实** planegcs Worker + OCCT Worker 双 WASM：求解 120×60×30，体积 216000 mm³；改宽到 150，体积 270000；欠约束、冲突保留已提交实体；真实 STEP 下载 |

## License / Distribution

`@salusoft89/planegcs` 仓库显示 LGPL-2.0-or-later；发布浏览器静态资产时需要明确许可证、WASM 组件可替换性/重链接的合规流程、构建产物对应的版权说明和第三方归属。应与 `occt-wasm` 的许可证分别审查；本次并未复制原库源码或隐去版权声明。参考：<https://github.com/Salusoft89/planegcs>。

## 开发命令

```bash
npm install --no-audit --no-fund
npm run test:sketch-unit
npm run test:sketch-wasm
npm run dev:studio
# open http://127.0.0.1:4173/sketch.html
npm run build:studio
npm run test:sketch-browser
```

## 尚未通过的 G0 门槛

100 次 WASM 生命周期基准、Firefox/Safari 兼容、一般 2D 轮廓及标准化草图特征树仍未完成。上述浏览器实验页不等于 P2 Studio 已完成。建议下一里程碑把 `SketchDocumentV1` 合并进 Canonical Document 版本化特征树，再实现真实 wire/face/extrude，不能用 `box` 映射覆盖所有形状。
