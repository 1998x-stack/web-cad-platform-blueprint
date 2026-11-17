# 25｜P0 合同收敛 + Native OCCT 参数驱动 + P1 Catalog 防漂移（v1.2）

> 状态：**已经实现并由本地单元测试验证的参考实现**。此文**不声称 G0 / G1 / G2 已通过**：没有可用的浏览器 OCCT WASM Worker，没有端到端 HTTP API ACL，没有 Studio UI 或 2D 草图求解器。

## 1. Review 修复对照

| Review | 本轮可验证改动 | 仍待完成 |
|---|---|---|
| R-01 | 四份 v1 Schema 从 `scripts/generate_contracts.py` 共享定义生成，CLI `--check` 防止漂移；`box/cylinder`、`output.set`、`parameterRef` 被纳入交易规范 | TypeScript 自动生成器、浏览器运行时真实 Schema 校验 |
| R-02 | JS `evaluationOrder()` + Python `_evaluation_order()` 使用依赖优先、ID 排序；输入数组顺序不决定输出形状 | 在 WASM 内执行同一文档 |
| R-03 | `LengthScalar=literal|{parameterRef}`，只允许长度参数引用；`parameter.set` 改半径，不改特征字面量；真实 OCCT 体积随之变化 | 增量几何缓存和 WASM 重建 |
| R-05 | `GeometryEvidence` 统一成 camelCase v1 DTO、schema；增加表面积、面数 | Worker envelope 完整实现、浏览器 Mesh/STEP 证明 |
| R-07 | SQLite 002 迁移为 staging→published，锁定 release / `release_assets` / 被发布资产三种可变入口；发布服务计算 SHA256 manifest | 私有 blob 实际 hash 校验、远端 ACL、审核/撤销流程 |
| R-08 | `search_public_listings` 对中文采用有界 `instr` 子串回退；对英文走参数化 FTS5 literal 查询；10k 合成数据基准 | 大规模分词索引、多字段混合检索、可观测性与流量真实压测 |
| R-12 | STEP 回读比较增加 `surfaceAreaMm2` 与 `faceCount` 记录，要求表面积误差阈值 | 外部异构 CAD 解析、对称差体积等更强等价验证 |
| R-14 | CI 增加 schema drift、16 组固体验收 parity、发布不变性测试 | Chrome/Firefox/WebKit Worker E2E 与恶意文件 fuzz |

## 2. 精确参数修改：可运行的端到端 CLI 案例

基准样例 [`../samples/precision-block.cad.json`](../samples/precision-block.cad.json)：

```json
"parameters": {"holeRadius":{"kind":"length","value":4}},
"features": [
  {"id":"drill","type":"cylinder","inputs":[],"originMm":[60,30,0],
   "radiusMm":{"parameterRef":"holeRadius"},"heightMm":30,"axis":"Z"}
],
"outputBodyId": "result"
```

上方仅显示参数/单一特征及输出字段，不是独立有效的完整文档。

1. JS `previewTransaction` 应用 `parameter.set('holeRadius', length, 6)`，生成 revision 2；原始特征 JSON 保持参数引用，不直接改 radius 字面量。
2. Python OCCT 使用同一 revision 2 文档构建 `box − cylinder`，BRepCheck 判定有效、1 个 Solid。
3. 导出真正 STEP 到 [`../samples/precision-block-r6.step`](../samples/precision-block-r6.step)，重新创建 `STEPControl_Reader` 读回，以体积、bbox、表面积数值核验。

| 指标 | 基准 8 mm 孔 | 参数改为 12 mm 孔 |
|---|---|---|
| 解析体积 | `216000−π×4²×30 ≈ 214492.035526 mm³` | `216000−π×6²×30 ≈ 212607.079934 mm³` |
| 实测参考 B-Rep 体积 | `214492.03552627692 mm³` | `212607.079934123 mm³` |
| STEP 回读体积差 | ~5.82×10⁻¹¹ mm³（旧基准） | ~1.16×10⁻¹⁰ mm³ |
| STEP 回读面积差 | 旧样例没有面积字段 | ~7.64×10⁻¹¹ mm² |
| Solid 数量 | 1 | 1 |

**注意**：这些是本环境的 Native OCCT 结果，无法证明浏览器端 WASM 与原生数值一致，也不构成任意几何的拓扑等价证明。

## 3. P1 不可变 Release：事务和威胁边界

- `001_init.sql` 历史数据迁移到 v2 后作为 `published` 保留，不删除既有 release。
- 新 Release 必须 `state='staging'`；发布服务检查存在 source 资产，验证所有元数据标记为 `valid`，生成按角色及 SHA256 排序的 canonical manifest，更新 hash 与状态。
- 发布后禁止修改/删除 Release，禁止增删改 Release 与资产的映射，禁止修改/删除被 Release 引用的 Asset 行；新增新版本时以新的 staging Release 完成。
- SQLite trigger 无法独立证明对象存储字节与资产 SHA256 一致，**仍需服务端上传时对真实字节计算 hash + 授权**；本轮只证明 SQL 元数据层。
- `catalog.connect()` 检查 `schema_migrations`，可重开数据库而不会重复执行 v2 `ALTER TABLE`。

## 4. 中文查询回退：范围与基准

- `unicode61` 无法可靠对中文复合标题中的双字词检索；新增 Python SQLite 查询器将包含汉字的 ≤80 字符查询做 `instr()` 子串匹配，保留 `visibility=public AND status=published` 过滤。普通拉丁查询使用 FTS5 literal `MATCH`，不允许客户端注入 FTS grammar。
- **不是分词系统、不是正式搜索服务**：字符串扫描不适合无限扩大数据规模，也不支持复杂中文 query parsing / 排序；当 10k 目录延迟出现问题时应换 ngram 或真正分词索引。
- 本地环境 Python 3.13、SQLite 3.46.1、Linux、10k 合成目录、每查询 10 次热身+75 次连续测量（单进程热缓存）：中文“机械” p95 约 2.28 ms；“参数化”约 2.24 ms；英文 Bracket p95 约 2.80 ms。**仅供受控对比**，不是生产 SLA 或实时性能承诺。

## 5. 已跑测试与命令

```bash
npm run check                         # Node 17；SQLite Catalog 6；文档/Schema/SQL
python scripts/generate_contracts.py --check
python scripts/check_contract_parity.py   # JS / Python solid 子集 16 fixtures
PYTHONPATH=packages/cad-geometry-python/src python -m unittest discover -s packages/cad-geometry-python/tests -v # 18 tests
python scripts/benchmark_catalog_search.py
```

## 6. Gate 决策

- **G0：NO-GO** — 缺浏览器真正 WASM Worker、三浏览器测试、STEP 双运行时、约束求解器、100-cycle 内存证据。
- **G1：NO-GO** — 缺上传审查、对象文件授权、可用 HTTP API、Gallery/GLB Viewer；仅元数据发布防漂移/中文子串的部分能力。
- **G2：NO-GO** — 缺草图、特征重建 UI、IndexedDB 恢复、Undo/Redo 与 Browser E2E。

### 下一最短关键路径

1. 为浏览器锁定 OCCT WASM 实现/许可证与发布文件；实现专用 Worker 的 init/build/tessellate/export/dispose。
2. 给 Worker 添加与本次 reference 相同的 JSON fixtures，并运行浏览器 CI 和 100-cycle 生命周期基准。
3. 单独推进 P1 上传时的真实 blob hash/身份验证；再开发模型 Gallery。
4. 通过 P0 的 Worker + Solver Gate 后启动 P2 交互闭环。
