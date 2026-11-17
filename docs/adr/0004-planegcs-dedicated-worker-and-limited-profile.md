# ADR-0004｜Planegcs 单独 Dedicated Worker 与矩形轮廓验收边界

- 状态：Accepted for CAD-006 P0 Spike（不代表完整 G0 放行）
- 日期：2026-11-17
- 决策者：工程代理研究实现，结果以 CI 为准

## Context

CAD-004 已使用 `occt-wasm@5.17.2` 将 B-Rep 放在 Dedicated Worker 中。P0 下一步需要实际求解二维约束，同时避免把求解器、OCCT 和 Three.js 场景混成不可测试的单块。

## Decision

- 引入 `@salusoft89/planegcs@1.3.0`，在另一个 Dedicated Worker 中运行；`sketch.v1.schema.json` 做封闭契约校验。
- 只支持 `point`、`line`、`circle` 和 `horizontal`、`vertical`、`distance`、`coincident`、`radius` 子集；不支持的类型明确拒绝。
- 每次求解创建独立 solver，始终清理本地 WASM 资源。冲突或欠约束不触发 CAD 构建。
- 作为 P0 验证，将完整约束的正交矩形转换为等价 `box`；不会宣称它是通用 B-Rep 拉伸实现。
- DOF 为有限约束子集的 Jacobian 秩估计，必须经过独立数值及 E2E 测试；不可对其他任意图形默许其正确。

## Consequences

优点：职责分离、两类 WASM 单独初始化、约束错误不会污染最近有效的 CAD Shape、性能可独立度量。代价：多一个 WASM 包，必须对 Worker 间 revision 关联、资源释放和 LGPL 分发义务分别测试，后续完成 Canonical 草图特征语义整合。
