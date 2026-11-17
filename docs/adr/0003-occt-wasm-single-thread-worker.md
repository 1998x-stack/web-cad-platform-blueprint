# ADR-0003 | P0 精确几何引擎选择 occt-wasm 单线程 Worker

- Date: 2026-11-17
- Status: Proposed pending CI and browser compatibility matrix
- Related: CAD-004 #2, G0, ADR-0001/0002

## Context

之前的 `KernelAdapter` 是设计接口。Native `cadquery-ocp` 已验证真实 B-Rep/STEP，但 Web CAD 必须在浏览器中操作真实内核，不能用 JS 几何公式替代真实模型。`occt-wasm` 提供 TypedArray 网格、STEP、原生 B-Rep 算法与 Web Worker 兼容接口，当前 npm 版本固定 5.17.2。

## Options considered

1. OpenCascade.js 传统 Embind 绑定：功能强，但老版本 API/工厂初始化和包体积需要额外封装。
2. replicad + OCCT：上层建模 API 更友好，但 P0 需额外映射当前原生 CAD Feature Contract。
3. `occt-wasm@5.17.2`：P0 直接调用 OCCT primitives、boolean、exact evidence、STEP 和 mesh；对接现有 P0 特征集最直接。

## Decision

P0 Spike 采用选项 3，单线程 Dedicated Worker，显式维护 Kernel 与 ShapeHandle 生命周期。`Worker` 不作为全局可任意访问的几何服务；只有 `CadDocumentV1` 可以驱动计算，页面仅获取 Mesh 和 Evidence 的副本。

## Consequences

- 性能：一次初始化的 WASM 体积/冷启动与大量生成必须测量；以 P0 单 Worker 基线开始。
- 内存：OCCT arena handles 不受 JS GC 自动清理；build 次数增多需 releaseAll，P2 大模型后需增量重建和更细粒度释放。
- 许可证：`occt-wasm` npm 的 TS 包元数据与其编译后 WASM 的 LGPL-2.1-only 义务不同，正式分发需把 WASM 保持可替换、提供相应声明并做许可证合规审查。
- 兼容性：SIMD、WASM tail calls、WASM exceptions 需要现代浏览器；当前 CI 首先用 Chromium，Firefox/Safari 要独立验证。
- 预览：Three.js 只展示三角化后的网格；高精度几何与 STEP 来自内核 ShapeHandle，保证不失去工程语义。

## Acceptance / reopen conditions

只有真实 Worker+跨 Native 数值+STEP 独立 Reader+Chromium CI 全 PASS 才把 Spike 标记为实现完成。仍需 Solver/100-cycle/Fx/Safari 证据才能考虑 G0。若显著内存泄漏、功能缺失、许可证不可接受，重新对比 OpenCascade.js custom build。
