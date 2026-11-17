# 01｜开源项目调研、技术选型与许可证风险

调查日期：2026-11-17。主要依据官方产品、项目 README 与协议官方文档。功能声明来自项目文档，**不代表已独立完成全量生产测试**。

## 1.1 技术候选矩阵

| 候选 | 角色 | 已核实信息 | 风险/建议 |
| --- | --- | --- | --- |
| [PartMode](https://github.com/BOMWiki/partmode) | 系统设计参照 | 本地优先、OCCT WASM + replicad + Three.js、人/Agent 共用文档模型；AGPL-3.0 | 研究架构，不直接复制进商业闭源项目；需法律评估 AGPL 网络分发义务 |
| [JSketcher](https://github.com/xibyte/jsketcher) | Sketch + Feature History 参照 | JS/TS 草图约束、特征历史、OpenCascade 布尔 | 需查明全部依赖与准确许可条款及持续维护情况 |
| [replicad](https://github.com/sgenoud/replicad) | 高级 B-Rep API | OCCT 抽象、STEP/STL 支持、Three 网格；MIT | 首选 P0 Spike；验证包版本、内存释放、复杂边界 |
| [OpenCascade.js](https://ocjs.org/) | 精确几何内核 | OCCT 的 WASM 封装；多线程涉及跨源隔离 | 初期单线程 Worker；评估 WASM 构建体积和内存 |
| [planegcs](https://github.com/Salusoft89/planegcs) | 草图求解 | FreeCAD 几何求解器 WASM 封装、JSON primitives | 必须审计此项目/上游 FreeCAD 及绑定许可证；求解冲突 UX 另开发 |
| [Three.js](https://threejs.org/) | 渲染与交互 | GLB 导入导出、网格、相机、拾取 | 不当作 CAD 内核；几何判定来自精确引擎 |
| [MCP](https://modelcontextprotocol.io/specification/2026-07-28) | Agent 集成 | 2026-07-28 版本的无协议会话请求模型 | SDK 需支持新旧协议协商，不能硬编码旧会话流程 |
| [SQLite](https://www.sqlite.org/) | 元数据索引 | 事务、外键、FTS5 | 单机初期合理；多人高并发写入后评估 PostgreSQL |

## 1.2 技术评分（主观架构评估，非基准测试）

权重：精确几何 30%、可插拔性 25%、Web 部署 20%、许可证可控 15%、工程成熟证据 10%。

| 选项 | 精确几何 | 可插拔 | Web 适配 | License 控制 | 当前建议 |
| --- | --- | --- | --- | --- | --- |
| Three.js 单独实现 | 不满足精确 B-Rep | 高 | 高 | 易审计 | 只作为展示层 |
| OCCT WASM + replicad + Three.js | 强 | 高 | 高（需调优） | 分别审计 | **首选基础方案** |
| PartMode 直接 Fork | 功能覆盖大 | 需要适应原架构 | 已有浏览器路径 | AGPL-3.0 | 若接受 AGPL，可评估 fork；否则参照设计 |
| 完全自研 B-Rep 内核 | 理论可做 | 最高 | 可定制 | 可控 | 不建议；成本过高 |
| 远程商业 CAD API | 取决于供应商 | 受外部接口约束 | 高 | 合同/供应商依赖 | P6 可作为高负载替代 |

## 1.3 必做四项技术 Spike

**SP-01：精确零件**：用 OCCT/replicad 生成 120×60×30mm 的板件，并开 Ø8mm 通孔；用 B-Rep 校验实体有效性和预期体积。保存 STEP 并重新导入；记录版本、内存、时间。

**SP-02：草图约束**：建立矩形及尺寸约束；修改长度后应重新求解且保持其他约束。特意构造欠约束/过约束/矛盾约束，验证错误信息。

**SP-03：页面与 WASM**：Vite + Web Worker 单线程加载内核；验证 Pages 静态环境的资源路径、WASM 初始化时间、首次编译缓存与浏览器兼容。多线程单独研究 COOP/COEP 与外部资源兼容。

**SP-04：引用稳定性**：上游特征改变后观察边/面引用；定义持久命名策略与保守失败行为。

## 1.4 授权和开源合规

- PartMode 明确为 **AGPL-3.0**，网络提供修改版服务通常有相应源代码义务。不能通过“只看不复制”之外的实际复制行为规避许可证。
- replicad 的 GitHub 仓库明确为 **MIT**；OpenCascade.js 及其封装的 OCCT、依赖和构建产物仍须独立审计。
- planegcs 来源于 FreeCAD 求解器，必须检验衍生关系、许可证和重新分发条款，不能依据 wrapper 的单一标签就宣布整体可用于任意闭源情形。
- 商店模型的版权、纹理许可、可再分发范围、商业使用权、作者署名等与源码许可证属于不同合规层。
- 切勿复制商业 CAD 的品牌、图标、源代码、专有文件格式实现或未授权样例模型。

## 1.5 方案结论

**选用：** TypeScript + React + Three.js + OCCT WASM/replicad + 可替换 Sketch Solver + IndexedDB + SQLite + 对象存储。人/AI 共用业务 command engine。P1 不依赖完整 CAD 几何功能。P5 MCP 通过 Policy Gate 连接 Command Engine。

**待确认**：目标许可证（是否计划闭源商业化）、目标设备、可接受的客户端 WASM 大小、核心机械设计场景、公差要求、是否必须支持完全离线。这些问题影响后期产品策略，但不阻碍当前架构与文档推进。

## 1.6 证据入口

- [PartMode README](https://github.com/BOMWiki/partmode) / [架构](https://github.com/BOMWiki/partmode/blob/main/docs/architecture.md)
- [JSketcher README](https://github.com/xibyte/jsketcher)
- [replicad README](https://github.com/sgenoud/replicad)
- [replicad package integration](https://github.com/sgenoud/replicad/blob/main/packages/replicad/README.md)
- [OCCT WASM multi-threading](https://ocjs.org/docs/advanced/multi-threading/intro)
- [planegcs README](https://github.com/Salusoft89/planegcs)
- [MCP 2026 official spec](https://modelcontextprotocol.io/specification/2026-07-28)
