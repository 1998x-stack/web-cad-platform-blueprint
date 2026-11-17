# 13｜自动测试、几何回归、安全与发布门禁

## 13.1 测试金字塔

1. **Domain Unit**：command schema、特征 DAG、参数量纲、revision、撤销、diff、幂等。
2. **Geometry Integration**：Sketch solver、B-Rep validity、精确体积/包围盒、容差、STEP round-trip。
3. **Storage/API**：SQLite FK/FTS、ACL、审计、任务状态、Blob 事务补偿。
4. **MCP Contract**：`tools/list`, input schema, protocol version, authorization, preview/commit race。
5. **E2E Browser**：实际视口操作、草图→实体、刷新恢复、文件下载。
6. **Performance/Soak**：连续重建内存、10k 模型索引、超大 mesh、恶意输入资源限制。

## 13.2 测试 fixture 清单

| Fixture ID | 场景 | 核验 |
| --- | --- | --- |
| GEO-001 | 10×20×30mm 盒体 | 体积 6000mm³、bbox、有效 solid |
| GEO-002 | Ø10mm×20mm 圆柱 | 体积 π×5²×20mm³，容差明确 |
| GEO-003 | 120×60×30mm 板材中心通孔 | 验证单实体与理论差体积 |
| GEO-004 | 切割完全不相交 | 结果体积不变 / 明确警告 |
| GEO-005 | 非法自交草图 | 无效输入拒绝 |
| GEO-006 | 极小圆角 / 零厚度 | 内核不能静默成功 |
| SK-001 | 受约束矩形修改长度 | 约束关系保持 + residual 阈值 |
| SK-002 | 矛盾长度约束 | 冲突状态、不保存坏几何 |
| TOP-001 | 修改上游造成面重排 | 引用正确或 fail-closed |
| IO-001 | STEP export/import | bbox/volume/solid count 检验 |
| IO-002 | STL/GLB export | schema、网格完整性、单位 |
| AUTH-001 | 非授权 Agent 修改 | 403 或 MCP error，无 revision 变化 |
| AUTH-002 | 旧 preview commit | 409，不得提交 |
| AUTH-003 | 重复 transaction ID | 幂等结果或冲突拒绝 |

## 13.3 精度规则

精确模型验收可选相对/绝对双阈值，例如 `|measured-expected| <= max(absTol, relTol*|expected|)`；具体每个 fixture 的 `absTol`/`relTol` 要依据 OCCT 版本、实体尺寸和业务要求标注，**不要把一个经验 epsilon 直接用于所有尺寸**。必须在毫米 / 立方毫米单位下明确计算。

## 13.4 性能预算（目标，不是实测）

| 场景 | 初期预算 | 条件 |
| --- | --- | --- |
| 文档命令校验 | p95 <20ms | 100 个 feature，不含 kernel |
| 10k 元数据搜索 | p95 <300ms | 固定机器、本地/同区域环境 |
| 简单零件重建 | p95 <2s | 指定设备、单线程 WASM、热启动 |
| 首次 kernel 初始化 | 记录 P50/P95/包体积 | 不提前设定无依据阈值 |
| 单页 Viewer 交互 | 目标 30–60 FPS | 指定 GPU/模型三角面数量 |
| Undo/Redo 正确性 | 100% 在 fixture 中一致 | 文档、参数、几何证据均比较 |

## 13.5 CI 流水线

`lint → typecheck → schema validation → domain tests → SQLite migrations → geometry fixture → API contract → browser e2e → dependency/licensing scan → package`。

- PR：快速门禁必须阻断坏 schema 和 domain transaction。
- Nightly：大批量 geometry fuzz / STEP roundtrip / performance regressions。
- Release：固定内核版本和 artifact signature，验证 hash 与重建一致性，生成 SBOM 与第三方许可清单。

## 13.6 特定对抗测试

- 非法 / 循环 Feature DAG、巨量特征、超过预算的深层依赖。
- 浮点 NaN/Inf、极值、除零、极小圆角、不封闭轮廓、退化布尔。
- 注入型模型描述、恶意文件名、外部 URL、超大解析内存、ZIP bomb。
- Agent 伪装授权、过期时间、跨文档 ID、旧 preview、新 commands 与旧 hash 混用。
- HTTP/MCP 多次并发 Commit 和重复请求，DB 更新必须具备原子性。

## 13.7 本包验证

```bash
npm test
python3 scripts/verify_blueprint.py
```

这些仅覆盖**随包的概念引擎/SQL**，不能替代真实 CAD 几何、浏览器 E2E 和生产 MCP 的测试。

## 13.8 2026-11-17 Review 发现的必要新门禁

- **Schema parity**：`box/cylinder` 被 TS、JSON Schema、Python 校验器等价接受；无效 fixtures 三端一致拒绝。
- **DAG parity**：同一份乱序特征文档，所有运行时对 `outputBodyId` 采用一致的稳定拓扑执行语义。
- **参数驱动**：只做 `parameter.set`，数值几何结果必须改变；不能以手工改 `radiusMm` 假装参数化完成。
- **P1 publication invariant**：`model_releases` 的发布清单和 `release_assets` membership 一起不可变，签名 URL 严格授权。
- **中文搜索**：部分词中文召回有固定 fixture，不允许仅测英文全词命中。
- **Browser CI**：真实 Worker/WASM、STEP 回读、连续释放、generation 竞争与 Safari/WebKit 兼容证据。
- **P2 E2E**：草图约束→精确实体→参数重建→保存恢复→STEP 独立回读；截图只作辅助证据。

精确执行表、门禁与建议仓库布局详见 [22｜Contract Freeze](22-contract-freeze-and-verification.md)。
