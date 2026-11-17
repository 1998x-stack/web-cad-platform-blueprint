# 17｜第一月任务执行计划（四个 Sprint）

> **2026-11-17 调整：**原首月 Sprint 1–2 中的 native OCCT/STEP Spike 已经完成，不能从零重新计数；浏览器 WASM、跨运行时协议、planegcs 和真实性能仍未实现。本文保留为**初始路线历史快照**，不再作为当前执行周计划。新计划请以 [21｜下一阶段里程碑](21-next-milestones-p0-p2.md) 和 [`planning/p0-p2-next-backlog.csv`](../planning/p0-p2-next-backlog.csv) 为准。

## Sprint 1 — 明确“能做 CAD”的最低证明

目标：确定许可证、Document Schema、CommandEngine 基础测试，并运行 OCCT WASM 的第一个精确盒体。

任务：`CAD-001`, `CAD-002`, `CAD-003`, `CAD-004`；提交成果：ADR、可运行示例、geometry fixture 的首个真实运行日志。此压缩包已经提供 Domain 文档级示例，但真实 OCCT Worker 尚待实现。

## Sprint 2 — 用实际模型证明内核

目标：Sketch Solver 接入实验、Cylinder/Boolean、STEP round-trip、Browser Worker 性能测试。

任务：`CAD-005`, `CAD-006`, `CAD-007`, `CAD-008`；提交成果：B-Rep 测试报告、内存趋势、是否可以进入 P1/P2 的 go/no-go 评审。

## Sprint 3 — 模型商店可浏览

目标：SQLite migration、初版 10k 条合成元数据生成器、Gallery/Filter/Model Detail、GLB Viewer；不需要先拥有 10k 个真实模型。

任务：`STORE-001`, `STORE-003`, `STORE-004`；提交成果：不依赖商业数据的公开测试 Gallery、搜索性能报告。

## Sprint 4 — 商店端到端闭环

目标：将对象存储、模型 Release 和 Copy Reference / Open in Studio 接入一条最小路径。

任务：`STORE-002`, `STORE-005`, `STORE-006`；完成：找到一个模型，能查看许可、版本、预览，复制稳定引用，并按权限下载真实文件。

## 周度评审格式

```text
Goals vs Evidence:
- Issue IDs closed:
- Tests actually run:
- Geometry evidence:
- Security / permission evidence:
- Performance data (machine, dataset, p50/p95):
- Open risks:
- Next dependencies:
```

## 第一个真正的工程演示

优先选择通用板件而非复杂人体模型：盒体 → 草图开孔 → 修改长宽厚和孔径 → 实体校验 → STEP 导出→回读；其几何结果可量化、易回归，是最能检验 CAD 基础架构的样例。
