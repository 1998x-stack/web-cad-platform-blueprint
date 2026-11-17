# 15｜架构决策记录（ADR）

ADR 用于保存长期可审计决策：背景、替代方案、选择、代价与复审触发器。以下为**建议状态**，不代表团队已签字或已有生产实践。

| ID | 决策 | 状态 | 复审条件 |
| --- | --- | --- | --- |
| ADR-001 | CAD 文档是唯一设计事实来源 | 建议采纳 | 内核/文档建模失配 |
| ADR-002 | Three.js 仅用作渲染层 | 建议采纳 | 产品转向纯 Mesh 编辑器 |
| ADR-003 | OCCT WASM + replicad 为优先 Spike | 待 P0 验证 | 性能/许可/内存不达标 |
| ADR-004 | 初期本地优先 + 单线程 Worker | 建议采纳 | 大模型性能瓶颈或云计算诉求 |
| ADR-005 | SQLite 索引 + S3 类对象存储 | 建议采纳 | 写入吞吐/可用性瓶颈 |
| ADR-006 | Agent 与 UI 共用 Typed Command Service | 建议采纳 | 无替代，属于安全架构不变式 |
| ADR-007 | MCP 2026-07-28 + SDK 兼容协商 | 建议采纳 | SDK 支持/协议升级 |
| ADR-008 | GitHub Pages 只做文档与非商业演示 | 建议采纳 | Pages 政策或产品使用场景变化 |
| ADR-009 | 发布 ModelRelease 不可变 | 建议采纳 | 缓存/许可/用户权益需重新设计 |

## 决策模板

```md
# ADR-NNN 标题
Date / Owner / Status
## Context
## Options considered
## Decision
## Trade-offs and consequences
## Validation evidence
## Revisit triggers
## Related issues and references
```

### 关键 ADR 补充

**ADR-001 + ADR-002**：不能将 Three.js Mesh 作为主 CAD 数据库。对精确几何与特征历史，Mesh 是从 B-Rep 经 tessellation 派生的缓存。

**ADR-006**：AI/人类操作必须通过同一个 command service，否则审批与撤销语义不一致；支持 detached preview、revision CAS 和审计。

**ADR-008**：从发布初期就把公开演示站与正式业务服务分离，避免将静态页面误当作可运营的 Model Store 或 MCP 后端。

## 已创建的具体 ADR 文件

- [0001｜Native OCCT reference → browser WASM](0001-native-occt-reference-then-wasm.md)：P0 Native Spike 已采纳。
- [0002｜Contract parity & phase gates](0002-contract-parity-and-phase-gates.md)：当前为 Proposed，待实现与浏览器证据后才能标为 Accepted。

上表 `ADR-001`…`ADR-009` 是原蓝图的**主题编号**，并非已落实的文件编号或已经完成的决定。实际审计和状态以 `0001`、`0002` 等决策文件为准。

- [0003｜P0 OCCT WASM single-thread Worker](0003-occt-wasm-single-thread-worker.md)：Proposed，待真实 CI / 浏览器兼容证据。

- [ADR-0004 planegcs Dedicated Worker + limited profile](0004-planegcs-dedicated-worker-and-limited-profile.md)
