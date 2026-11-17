# 04｜Monorepo 文件布局与代码模块边界

## 4.1 目标结构

```text
web-cad-platform/
├── apps/
│   ├── studio/                 # React + Vite, CAD / Gallery UI
│   │   └── src/
│   │       ├── app/            # router, shell, initialization
│   │       ├── features/catalog/
│   │       ├── features/sketch/
│   │       ├── features/modeling/
│   │       ├── features/history/
│   │       ├── features/export/
│   │       ├── features/agent-review/
│   │       ├── components/     # primitives, panels, modal
│   │       └── viewport/       # Three.js scene adapter; no domain state
│   ├── api/                    # project/catalog/files/jobs REST service
│   │   └── src/{routes,services,auth,db,jobs}/
│   └── docs-site/              # public static site; optional
├── packages/
│   ├── cad-contracts/          # DTO, JSON Schema, errors, versioning
│   ├── cad-core/               # document, command, dependency DAG
│   ├── cad-geometry/           # KernelAdapter, OCC worker + sketch solver
│   ├── cad-render/             # render meshes, picks, camera, annotations
│   ├── cad-export/             # STEP/STL/GLB/3MF/DXF capability registry
│   ├── cad-store/              # DB schema, repository, FTS5, migrations
│   ├── cad-mcp/                # tool registry + authorization adapter
│   ├── cad-ui/                 # design system and accessible components
│   └── cad-telemetry/          # traces, metrics, audit redaction
├── workers/
│   ├── conversion/             # file conversion worker
│   ├── tessellation/           # preview/LOD thumbnails
│   └── headless-cad/           # server CAD job environment
├── tests/
│   ├── fixtures/{sketch,brep,formats,agents}/
│   ├── regression/
│   ├── e2e/
│   ├── security/
│   └── benchmark/
├── docs/                     # this numbered blueprint series
├── scripts/                  # verification, benchmark, release
├── infra/                    # compose, Dockerfiles, deployment manifests
├── .github/workflows/        # CI, Pages demo, release
└── AGENTS.md                 # cross-tool engineering rules
```

当前压缩包只创建了部分关键占位目录和可执行的 `cad-core` 参考实现；目标结构不是“这些模块已经完成”的意思。

## 4.2 分包契约

### `cad-contracts`

- `CadDocumentV1`, `CadFeature`, `CadCommand`, `CadTransaction`, `CadError`, `GeometryEvidence`, `AssetManifest`。
- JSON Schema 用于 HTTP/MCP 入站验证；将 `schemaVersion` 与迁移脚本一同维护。
- 对外公开的 Schema 不暴露底层 OCCT 对象引用或无效内存指针。

### `cad-core`

- 封装 `preview(document, commands)` 与 `commit(preview, expectedRevision)` 语义。
- 支持合法顺序与循环依赖检测；扩展时实现 Undo/Redo、Feature DAG 下游重建集合、参数表达式、安全求值。
- 不在命令中执行任意 JS 代码；参数表达式采用白名单 AST。

### `cad-geometry`

- `KernelAdapter`：`initialize`, `evaluate`, `measure`, `validate`, `tessellate`, `exportExact`, `dispose`。
- `SketchSolverAdapter`：`solve`, `degreesOfFreedom`, `conflicts`, `diagnostics`。
- 浏览器/服务端采用同一 DTO；Worker message 加上 `requestId`, `revision`, `kernelVersion`。

### `cad-store`

- Asset 文件内容地址化，数据库中保存元信息与 ACL；下载短时 URL 在 API 授权后签发。
- `document_revisions` 记录提交版本，`model_releases` 指向不可变资产 manifest。

### `cad-mcp`

- 只处理 MCP 协议适配和 tools/resources，不重新实现应用权限；直接调用 `cad-api` 的受控 `CommandService`。

## 4.3 依赖规则

- `contracts` 禁止 import `react`, `three`, `better-sqlite3`, `opencascade`。
- `core` 禁止 import UI/DB，允许 import `contracts`。
- `geometry` 禁止 import `apps`；渲染层只接受可序列化 mesh / pick manifest。
- `api`, `studio`, `mcp` 均可依赖 `core/contracts`，但互不直接依赖应用内部目录。
- 所有跨 Worker/HTTP 数据都必须 JSON/Binary Serialization；不传 JS 运行时内核对象。

## 4.4 提交治理建议

- 每个 PR 对应 Epic/Issue ID，有输入输出与测试证据。
- 新 feature 必须包括：命令 Schema、类型、KernelAdapter 计算、显示映射、保存与恢复、回归 fixture、失败路径。
- 引入新格式必须说明它保留/丢失的信息、依赖许可证和转换质量验证。
- 版本同步由 changeset 或等效版本机制维护，不能仅修改 UI 宣称 API 兼容。
