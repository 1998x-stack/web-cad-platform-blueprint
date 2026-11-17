# ADR-0005 · 用精确 OCCT Wire → Face → Extrude 替代包围盒替身

**状态**：Accepted for CAD-007 single-loop Spike

## 决策

CAD-007 在 Canonical Document V1 中引入 `profile` 派生特征，保留 `sourceSketchId` / `sourceSketchRevision` 和二维顶点。只接受经由 real planegcs 解算、验证为完全约束的封闭折线环。计算时依次创建 Edge、Wire、Face，再经 extrude 输出 B-Rep，并验证唯一有效 Solid。

## 原因

此前 CAD-006 的精确矩形逻辑把求解出的角点转为 `box`。这对斜线、三角形、凹多边形属于错误几何。直接在设计数据中保存 `profile` 与其实际顶点，使预览与 STEP 使用相同 B-Rep 内核，并保留后续拓扑追踪的扩展空间。

## 范围限制

第一阶段只接受单个、无孔、无自交、无退化边的 XY 直线闭合环，拒绝开口、多个独立环与圆弧。任何不满足条件的图形必须显式报错，不允许退回边界框 Box。

## 开源许可证

使用原仓库已锁定的 occt-wasm 5.17.2 以及 `@salusoft89/planegcs` 1.3.0。发布二进制资产时需遵守各自许可证的版权与 LGPL 分发义务；工程 README 的依赖声明不构成法律意见。
