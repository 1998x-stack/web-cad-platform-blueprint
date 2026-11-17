# 20｜2026-11-17 工程级 Review：P0–P2 缺口、证据与修复优先级

> **范围**：`main` 在 PR #1 合并后的 53 个文件；代码、SQL、文档、CI。此次 Review 是基于已合并快照的静态检查、当前环境重新运行测试和少量独立复现。**不是已完成缺陷修复或浏览器验收。**
>
> **当前基线**：Node 12/12、OCCT Python 11/11、`scripts/verify_blueprint.py` 通过。GitHub `main` CI 已成功。CAD-004 仍只是 native oracle，CAD-005 只完成单零件 STEP Spike。

## 1. 问题分级

- **BLOCKER（P0 阶段门禁阻塞）**：若不修复，不能称同一 CAD 文档在 JS / Native / WASM 中行为一致，或不能宣称浏览器 CAD 内核可用。
- **HIGH（P1/P2 发布阻塞）**：影响数据完整性、模型隐私、用户可编辑性或真实用户闭环。
- **MEDIUM（进入后续阶段前解决）**：质量、可观测性、兼容性、工程效率问题。
- **LOW**：结构和文档债务，不得挤占前述修复资源。

## 2. 可复现发现（不是猜测）

| ID | 分级 | 位置 | 证据/风险 | 下一步可验收的修复 |
|---|---|---|---|---|
| R-01 | BLOCKER | `packages/cad-contracts/schema/transaction.schema.json` `$defs.feature` | JSON Schema `type` 枚举仅 `sketch/extrude/boolean`，而 TS 联合类型和 JS `TYPES` 已支持 `box/cylinder`。同一交易可能在接入 Schema 校验后失败。 | 用一份可版本化的 Document + Transaction Schema 作为规范；对 `samples/*.cad.json` 做 TS/Python/Schema 一致性测试，拒绝额外字段；CI 阻止生成产物漂移。 |
| R-02 | BLOCKER | `command-engine.mjs:validateDocument` 与 `kernel.py:build` | 将 `precision-block.cad.json.features` 逆序：JS 验证**通过**，Python 报 `boolean must reference two existing, distinct earlier features`。两端的 DAG 执行契约不一致。 | 明确 `features` 为无序节点集+独立 UI 顺序；共享确定性拓扑排序语义，或明确要求拓扑排序并在两端一致拒绝。建议选择前者，按 `id` tie-break，输出特征计算轨迹。 |
| R-03 | BLOCKER | `parameter.set`、`CadFeature`、`kernel.py:build` | 参数在 `doc.parameters`，box/cylinder 尺寸是数值字面量。`parameter.set` **不会**驱动尺寸重新计算；现有测试修改的是 `features[1].radiusMm`，不是参数引用。 | 增加类型安全的 `ScalarExpr`/`ParameterRef` 最小子集，规范 mm/rad；更改参数可触发相应特征重建并验证体积。 |
| R-04 | BLOCKER | `packages/cad-geometry/src/adapter.ts` | `NotImplementedKernel` 明确抛错；没有浏览器 Worker、WASM 几何构建/回收、STEP 导出/回导或 WebGL 验证。 | 真实浏览器 Worker 单线程 WASM；精确 B-Rep/体积/box+hole/STEP/独立回读；Playwright Browser CI；运行环境/构建元数据记录。 |
| R-05 | HIGH | `adapter.ts` 与 `docs/06-geometry-and-sketch.md` | 文档要求 `validate`、`generation`、`importStep` 等闭环，代码接口仅 `build/tessellate/exportStep/dispose`；Python 证据结构使用 `solids/volume_mm3/bbox_mm`，TS 使用 `solidCount/volumeMm3/bboxMm`。 | 定义带版本的 `KernelRequest/Response`, `GeometryEvidence`, `MeshPackage`；标准化错误码、顶层输出 Body ID 与多 Solid 策略。 |
| R-06 | HIGH | `kernel.py:_assert_solid`、`build` | 每个特征强制恰好一个有效 Solid；两个分离实体的 `union` 将被拒绝。P0 可接受，但不应宣称已支持一般多体/装配。当前返回最后一个数组元素的形状，无法表达显式最终 Body。 | P0 锁定 single-body 范围；引入 `activeBodyId`/显式输出引用，P2 再引入 multi-body；区分“不支持”和“几何错误”。 |
| R-07 | HIGH | `packages/cad-store/migrations/001_init.sql` | `model_releases` 有 no-update/delete 触发器，但已发布 `release_assets` 行可以删除。测试 SQL 已复现。 | 资产清单以 manifest hash 固化，发布后 `release_assets` 禁止 INSERT/UPDATE/DELETE；发布事务检查所有 asset 的 READY/VALID 状态。 |
| R-08 | HIGH | SQLite FTS5 `tokenize='unicode61'` | 实测中文标题“参数化机械零件”，查询完整标题匹配，但“参数化”或“机械”查询返回空。 | P1 做中文分词 Spike（预处理分词列或 n-gram 倒排）；10k 合成+中文真实条目回归，确定召回率/误报/性能后固化。 |
| R-09 | HIGH | `SketchFeature.entities/constraints: unknown[]` | 无强类型实体 ID、点/线/圆与约束 schema，无法一致导入 planegcs，缺少欠/全/过约束可解释结果。 | P0 先做 2D 求解器隔离层 Spike；P2 固化 `SketchEntity`、`Constraint`、`SolveResult` 及冲突/残差协议。 |
| R-10 | HIGH | `commitLocalPreview` | 已标注本地 POC：`approved=true` 是调用者自报，没有身份/ACL、持久授权、idempotency、DB CAS 或几何验证。 | 不得暴露为远程或 MCP 生产接口；P2 单机提交需要 kernel 证据；远端提交排到 P5 并采用授权+事务 CAS。 |
| R-11 | HIGH | `docs/12-roadmap-and-backlog.md` | P1 `STORE-006` 同时要求 Open in Studio，但 P2 才实现 Studio；P2 `CAD-108` 要求导出而 P3 才有完整 `IO-002`，存在阶段依赖歧义。 | P1 改为“复制固定引用 + 下载已验证资产”；Open in Studio 进入 P2 接口整合；P2 使用 P0 狭义 STEP 导出，生产格式流水线仍是 P3。 |
| R-12 | MEDIUM | `compare_evidence` | 仅比较 solid count、体积与 bbox；不同形状也可能具备相同三个指标。 | 给几何对比增加有效性、表面积、face/shell 数、方向和对称差体积（同内核参考），跨引擎用独立解析与合理容差。 |
| R-13 | MEDIUM | `export_step` / `import_step` | 单位设为全局 `Interface_Static`，传入路径无独立安全策略；尚无大文件/恶意文件资源隔离。 | 服务端独立进程隔离、超时/内存/文件大小预算、临时目录、异常清理；并行导出时避免全局配置相互干扰。 |
| R-14 | MEDIUM | `scripts/verify_blueprint.py`、CI | 现有检查不执行 Schema 与 runtime 一致性、浏览器端构建或 E2E、SQL 并发/不可变关系等关键场景。 | 追加 contract parity、浏览器 smoke、SQL publication invariant、STEP fixture matrix、SBOM/license 扫描。 |
| R-15 | MEDIUM | `README.md` 与 `docs/12`、`17` | P0 技术 Spike 与 P1 产品阶段的命名有时混同优先级；`docs/12` 内有字面量 `\\n\\n` 排版缺陷，首月计划仍写成从零开始的 Sprint 1。 | 引入阶段完成状态、独立下一阶段执行计划、gate checklist；修正文档与事实状态。 |

## 3. 跨阶段关键设计判断

1. **先契约、后 WASM、再 UI**。先修 R-01/R-02/R-03/R-05，防止在新 Worker 中复制错误接口。
2. **原生 OCCT 作为数值 oracle，不是 UI 的生产依赖。** 在浏览器选定同族内核后，允许算法实现差异，但不接受无声的有效性/单位/依赖差异。
3. **P1 的 Gallery 与 P2 的 Studio 可并行，但不互为替代。** P1 真实走完发布、搜索、查看、固定版本引用与下载；P2 真实走完草图、求解、生成实体、修改参数、恢复与导出。
4. **P1 元数据后端必须提前落地。** 不再按旧文档把所有云端功能推迟至 P3；最小 API、权限和资产存储是 P1 的硬依赖。
5. **释放条件以证据包为准。** issue 关闭不能取代实际运行的命令日志、浏览器测试、fixture 对比、CI 链接和版本锁定。

## 4. 不在此次 Review 范围内

没有进行全量类型检查（尚无真正的 TypeScript 工程/打包流水线）、浏览器 WASM 的实际加载、任意 STEP 文件安全审计、真实生产环境压测、模型授权法律审核。以上不得引用本报告作为已通过证明。

## 5. 与后续文档关系

- [`21-next-milestones-p0-p2.md`](21-next-milestones-p0-p2.md)：分阶段路线、执行顺序、工期区间、Gate 和岗位。
- [`22-contract-freeze-and-verification.md`](22-contract-freeze-and-verification.md)：契约冻结、Worker/内核/几何证据定义及测试矩阵。
- [`23-model-store-p1-plan.md`](23-model-store-p1-plan.md)：P1 资产/版本/ACL/搜索/发布闭环。
- [`24-parametric-studio-p2-plan.md`](24-parametric-studio-p2-plan.md)：P2 草图/特征 DAG/UI/恢复的垂直切片。
- [`../planning/p0-p2-next-backlog.csv`](../planning/p0-p2-next-backlog.csv)：可导入任务板的下一阶段细分清单。
