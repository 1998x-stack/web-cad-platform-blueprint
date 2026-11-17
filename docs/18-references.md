# 18｜研究来源、证据范围与复核计划

研究时间：2026-11-17。以下均为官方/源仓库入口，仍需在真正编码和发布时对具体 release/tag/license 重新固定版本并复核。

| 主题 | 主来源 | 主要支持的结论 |
| --- | --- | --- |
| PartMode | https://github.com/BOMWiki/partmode | OCCT WASM + replicad + three.js、统一 document、Agent 安全；AGPL-3.0 |
| PartMode architecture | https://github.com/BOMWiki/partmode/blob/main/docs/architecture.md | Canonical Schema、Worker、Agent 权限与 revision gate |
| JSketcher | https://github.com/xibyte/jsketcher | Sketch Solver、feature history、B-Rep 交互 |
| replicad | https://github.com/sgenoud/replicad | OCCT 的高级 CAD API、MIT |
| replicad integration | https://github.com/sgenoud/replicad/blob/main/packages/replicad/README.md | 通过 setOC 注入内核，STEP/STL/mesh，Worker 建议 |
| OpenCascade.js multi-thread | https://ocjs.org/docs/advanced/multi-threading/intro | pthreads、SharedArrayBuffer 与 cross-origin isolation |
| planegcs | https://github.com/Salusoft89/planegcs | FreeCAD Sketch Solver WASM/TS 封装 |
| glTF Registry | https://registry.khronos.org/glTF/ | glTF 2.0 是运行时 3D 资产交付格式 |
| Three.js GLTFExporter | https://github.com/mrdoob/three.js/blob/dev/docs/pages/GLTFExporter.html.md | Three.js glTF/GLB 导出能力 |
| MCP 2026-07-28 Spec | https://modelcontextprotocol.io/specification/2026-07-28 | 2026 规范、无协议级会话、Tools/Resources/Prompts、User Consent |
| MCP 官方 release | https://blog.modelcontextprotocol.io/posts/2026-07-28/ | Stateless、header routing、SDK、兼容升级信息 |
| MCP TypeScript SDK | https://ts.sdk.modelcontextprotocol.io/v2/protocol-versions | legacy 与 modern 协议协商模式 |
| MCP Tasks Extension | https://tasks.extensions.modelcontextprotocol.io/specification/2026-07-28/tasks | 长任务状态、轮询、取消 |
| GitHub Pages 限制 | https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits | 静态托管、1GB/商业 SaaS 限制与带宽限制 |
| SQLite FTS5 | https://www.sqlite.org/fts5.html | 全文检索能力和 external content 设计 |

## 来源可靠性划分

- **规范/官方文档**：可作为接口和部署约束的主要依据，但具体语义要核对版本。
- **项目 README/架构文档**：说明项目自述能力，不代表本研究已经独立实测所有功能。
- **本方案的选型、规划与门禁**：属于建议和工程设计判断，不是上游项目事实。
- **示例代码与 SQL**：只经本包自动测试验证其覆盖的部分；未接入真正 OCCT CAD 实体。

## P0 必须补齐的现场证据

- 锁定 OCCT / replicad / solver 的具体 NPM tag、Git commit、依赖许可证、包大小。
- 对 3 个真实几何 fixture 记录实体有效性、体积、bbox、STEP round-trip。
- 对 Chrome / Safari / Firefox 的 Worker + WASM 兼容记录。
- 对 P0 重点技术决策建立 ADR 与可复现回归命令。

## 2026-11-17 P0–P2 Review 补充核验来源

> 只说明选型依据，不表示依赖包已在本仓库装入浏览器运行；版本和许可证须在实施 PR 锁定。

- [OpenCascade.js：关于项目、WASM 与 beta 文档状态](https://ocjs.org/docs/about)：文档页面针对 beta，P0 必须实测 API/包版本，不可用 README 推定已支持。
- [OpenCascade.js：Custom Builds](https://ocjs.org/docs/app-dev-workflow/custom-builds)：按实际 API 需要裁剪绑定，减小包体积。
- [OpenCascade.js：单线程与多线程介绍](https://ocjs.org/docs/advanced/multi-threading/intro)：默认单线程 WASM；多线程涉及 SharedArrayBuffer/跨源隔离。
- [replicad 作为 library 使用](https://github.com/sgenoud/replicad/blob/main/packages/replicad-docs/docs/use-as-a-library.md)：建议把几何运算放入 Web Worker，显示使用 Three.js helper。
- [planegcs README](https://github.com/Salusoft89/planegcs/blob/main/README.md)：WebAssembly 约束求解器、约束种类、残差/数值迭代能力，需要独立 Spike。
- [MDN：Cross-Origin-Embedder-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy)：跨源隔离与 SharedArrayBuffer 必要前提。
- [MCP 2026-07-28 正式发布说明](https://blog.modelcontextprotocol.io/posts/2026-07-28/)：P5 远程 Agent 需按最新无协议会话与授权规范构建；P0–P2 暂不实现生产 MCP Server。
