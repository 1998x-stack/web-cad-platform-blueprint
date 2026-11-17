# 02｜产品用户旅程、页面信息架构与权限设计

## 2.1 四个关键闭环

### Flow A — 模型发现与复用

`/models` 列表 → 搜索/标签/分类 → `/models/:slug` 详情 → 格式与许可核验 → 3D 预览 → 复制模型 ID / 下载 / Open in Studio → 记录具体 release 引用。

**验收**：缺失 GLB 仍能显示元数据与错误状态；授权不允许下载时按钮不可用且 API 拒绝；模型 release 不可原地变更；复制的应是稳定 ID/显式的引用片段，不是未经授权的模型源码。

### Flow B — 设计参数化零件

`/studio/:docId` → 新建草图 → 选择基准平面 → 添加草图实体 → 约束求解 → 保存草图 → 拉伸（预览） → 校验 B-Rep → 提交特征 → 修改参数 → 增量重建 → 保存新 revision。

**验收**：用户不应在存在未保存草图时无提示离开；失败保留上一版可用文档，给出特征与错误来源。

### Flow C — 格式转换

`/convert` → 选择源文件与目标格式 → 显示能保留/丢失的属性 → 分配 job → 校验源文件与权限 → 转换 → 回读 → 产物哈希 → 可下载。

**验收**：GLB→STEP 不默认为可进行的无损转换；STL 只按网格方式处理，不能伪造参数化历史。

### Flow D — Agent 设计任务

Agent `cad.capabilities` → 用户授予文档/操作/期限 → `cad.document.get` → `cad.transaction.preview` → 返回审查材料/精确证据 → 用户批准 → `cad.transaction.commit(expectedRevision)` → `cad.export.create`。

**验收**：过期授权、错误修订号、超过操作预算、被拒绝的预览均不能提交。

## 2.2 页面与路由

| 页面 | 路由 | 核心组件 |
| --- | --- | --- |
| Landing | `/` | 产品说明、近期公开模型 |
| 模型商店 | `/models` | SearchBar、CategoryTree、FilterPanel、ModelCardGrid |
| 模型详情 | `/models/:slug` | Viewer、ReleasePicker、LicensePanel、DownloadPanel、CopyReference |
| CAD 工作台 | `/studio/:documentId` | MenuBar、ToolRibbon、FeatureTree、Viewport、Properties、StatusBar |
| 模板 | `/templates` | ParametricTemplateCards |
| 文件转换 | `/convert` | ImportDialog、ConversionPlan、JobsStatus |
| 项目管理 | `/projects` | WorkspaceList、RevisionHistory、Archive |
| Agent 授权 | `/settings/agents` | Grants、Scopes、Revocations、AuditTimeline |
| API/开发者 | `/developers` | API Spec、MCP Tools、SDK Downloads |

## 2.3 模型类型与 UI 权限标签

模型详情必须独立展示 `renderable`、`exactGeometry`、`parametricEditable`、`exportableFormats`，不能由扩展名推断所有能力。

- `MESH_ONLY`：GLB、OBJ、STL 预览，允许网格级操作；**不承诺**原生参数化。
- `EXACT_IMPORTED`：STEP 等可导入精确 B-Rep，但**不自动**恢复原作者特征树。
- `PARAMETRIC_NATIVE`：经过版本校验的原生 CAD 文档与可编辑特征历史。

## 2.4 权限模型

- 角色：`viewer`（读）、`editor`（编辑）、`owner`（管理与发布）。
- 发布与文件下载为单独 action，而非简单“能看就能下载”。
- Agent 授权维度：`principalId`, `documentIds`, `actions`, `expiresAt`, `maxCommands`, `maxCommits`。
- 商店所有者、项目所有者、Agent 认证身份和公开发布者不一定是同一主体；必须在服务端逐个校验。

## 2.5 失败体验

- 网络离线：本地草稿可继续保存；发布/外部导出任务标记待同步，不自动丢弃。
- 几何失败：高亮失败特征并显示保守错误码 `GEOMETRY_INVALID`；可撤销。
- 授权不足：明确列出缺少的权限；不静默回退管理员或广泛访问。
- 导出队列繁忙：返回任务 ID、状态与可重试提示；job 状态可取消，结果按 TTL 清理。
- 并发编辑冲突：返回 `409 REVISION_CONFLICT`，要求读取新版本再预览。
