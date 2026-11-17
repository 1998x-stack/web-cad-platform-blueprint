# 10｜AI CAD Agent / MCP：协议、工具、授权与可信提交

## 10.1 协议依据（重要版本差异）

截至本次调研，MCP 官方已发布 **2026-07-28** 规范，采用 stateless request/response 核心。新版本不再使用协议级 `initialize` handshake 和 `Mcp-Session-Id`；支持 `server/discover`、每次请求的 `_meta` 与相关 HTTP header。历史 MCP 客户端仍可能使用 2025 版，服务端应通过**官方 SDK 的版本协商**兼容，而不是自行假设协议不变。

官方：https://modelcontextprotocol.io/specification/2026-07-28
发布说明：https://blog.modelcontextprotocol.io/posts/2026-07-28/
TypeScript SDK：https://ts.sdk.modelcontextprotocol.io/v2/protocol-versions

## 10.2 MCP 的定位

MCP 只暴露已有 CAD Domain 能力：`MCP ToolAdapter → AuthorizationPolicy → CommandService → GeometryService → ArtifactService`。**不允许** Agent 通过文本提示直接操作 JS 解释器或数据库。

资源 (`resources`)：公开的模型发布信息、被授权文档的摘要、Schema/帮助文档。

工具 (`tools`)：具名强类型函数。不要将“执行任意 CAD JS 脚本”作为最初接口。

## 10.3 最小工具集

| 工具名 | 输入（关键字段） | 输出 | 是否修改 |
| --- | --- | --- | --- |
| `cad_capabilities` | optional scope | ops、formats、limits、schemaVersion | 否 |
| `cad_document_get` | documentId | revision、summary、parameters | 否 |
| `cad_model_search` | query、filters | visible releases | 否 |
| `cad_measure` | documentId、revision、targets | verified measurements | 否 |
| `cad_transaction_preview` | docId、expectedRevision、typed operations | previewId、diff、evidence、expiresAt | **不改主文档** |
| `cad_transaction_commit` | previewId、expectedRevision、approvalRef | revision、hash、auditId | **是** |
| `cad_export_create` | documentId、revision、format | jobId、status | 创建任务 |
| `cad_job_get` | jobId | status、artifactManifest | 否 |

**第一期最好只提供** `cad_capabilities`, `cad_document_get`, `cad_transaction_preview`，在授权和修订安全测试通过后才开放 commit。

## 10.4 Transaction Preview / Commit

**Preview 入参**：

```json
{
  "documentId": "doc_001",
  "expectedRevision": 7,
  "operations": [
    {"op":"parameter.set", "name":"length", "kind":"length", "value":150}
  ]
}
```

**Preview 出参**必须包含 `previewId`, `baseRevision`, `candidateHash`, `operationDiff`, `geometryEvidence`, `expiresAt`, `approvalRequired`, `warnings`。

**Commit 入参**：`previewId`, `expectedRevision`, `approvalRef`，绝不能在 commit 时再传一份不一样的 commands；服务端必须验证 `previewHash`、权限、到期时间、操作限额和 revision。提交失败不应部分执行。

## 10.5 显式授权机制

Agent Key 只能认证发起者，**不等于**拥有任何文档的 CAD 编辑权限。具体权限独立授予：

```json
{
  "grantId":"grant_01",
  "principalId":"agent_42",
  "documentIds":["doc_001"],
  "actions":["read", "preview"],
  "maxCommits":0,
  "maxOperationsPerPreview":10,
  "expiresAt":"2026-11-18T00:00:00Z"
}
```

真实产品应实现撤销、账户与项目 ACL、审计日志和资源配额；浏览器人工批准权限与服务器 headless 自动工作权限需分离，并在 UX 中显式告知存储和风险差异。

## 10.6 安全威胁与控制

| 风险 | 控制措施 |
| --- | --- |
| 模型元数据中提示注入 | 将所有资产描述作为不可信数据，不执行内含指令 |
| Agent 越权跨项目 | 资源层 ACL + grant scope + object ownership 校验 |
| 过期 revision 覆盖人工编辑 | 原子 `expectedRevision` CAS，失败后重新读取 |
| 预览篡改 | 服务端签名/持久化 preview 与 commands hash，commit 不接收新 commands |
| 高成本几何 DOS | 操作数量上限、Worker time/memory budget、rate limit |
| 任意代码执行 | 不提供通用 JS/eval/shell/CAD 脚本工具 |
| 私有模型泄露 | 私有 assets 签名 URL、最小权限、审计 |
| Replay / 重复提交 | idempotency key、短 TTL、commit budget |
| 人机共享异常状态 | 明确审批、只展示验证后的 committed revision |

## 10.7 长任务

MCP 2026-07-28 的 Tasks 是**可选扩展**，用于长时间运行的转换/导出。根据官方 Tasks Extension，服务端可返回任务句柄，客户端通过 `tasks/get`、`tasks/update`、`tasks/cancel` 跟踪。不要硬编码旧版实验性 tasks 生命周期。参考：https://tasks.extensions.modelcontextprotocol.io/specification/2026-07-28/tasks

不支持 Tasks 的客户端仍可使用 `cad_export_create → cad_job_get` 轮询业务 job。

## 10.8 实现顺序

1. 发布 OpenAPI/JSON Schema，同一命令服务先经 REST 全测。
2. MCP read-only 工具上线（资源权限和数据最小化）。
3. preview-only 试运行，并用人工和程序双重验收几何结果。
4. 实现审批引用（approvalRef）与幂等 commit；验证 race condition。
5. 引入 headless 模式的单独授权与资源配额。
6. 加入版本协商与官方 MCP SDK 的互操作测试，记录 client/server protocol revision。

详细工具 JSON 草案：`packages/cad-mcp/contracts/tools.json`。
