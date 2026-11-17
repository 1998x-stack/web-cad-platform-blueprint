# 22｜P0 Contract Freeze：文档、几何 Worker、证据与测试方案

> 本文定义**目标契约与实施门禁**，不表示仓库已经实现。代码入口仍以 `packages/cad-contracts/`、`packages/cad-core/`、`packages/cad-geometry/` 为准。

## 1. 契约首先要解决什么

1. **同一份文档、同一份语义**：JS 事务层、Python native oracle、浏览器 WASM 对同一输入的 accept/reject、依赖解析、单位与最终 Body 一致。
2. **几何证据有具体来源**：只能由已验证的 B-Rep 内核生成，不能让 UI/LLM 自行声明 `valid`。
3. **运行时可以替换**：Worker 协议不暴露 OCCT/Emscripten 句柄；render mesh、STEP bytes、原生几何是不同输出。
4. **精确缓存可失效**：任何文档 hash、kernelVersion、solverVersion、quality 或 generation 变化，旧可视化结果都不能伪装成新结果。

## 2. 唯一权威格式与仓库落地

建议 Schema 2020-12 为唯一权威定义，位置：

```text
packages/cad-contracts/
  schema/
    document.v1.schema.json
    transaction.v1.schema.json
    geometry-evidence.v1.schema.json
    worker-envelope.v1.schema.json
    sketch.v1.schema.json        # P2 最终定义，P0 给最小子集
  src/generated/                 # 从 Schema 生成，不手工改
  fixtures/accept/               # 所有验证器必须接受
  fixtures/reject/               # 所有验证器必须拒绝
  scripts/check-parity.mjs       # Node + Python + 浏览器契约一致性
```

在 P0 选定 Schema→TypeScript 类型生成器、Python JSON Schema validator 并锁版本。CI 自动对比生成产物是否与 Schema 一致；禁止“手工改 TS 接口然后忘记更新 Schema”。

### Document v1 关键字段

| 字段 | 要求 |
|---|---|
| `schemaVersion: 1` | 显式版本，只允许受支持版本 |
| `documentId` | 唯一、规范 ID |
| `revision` | 非负单调递增，预览只产生候选 revision |
| `units` | 内部长度 `mm`，角度 `rad`；显示转换不改精确模型 |
| `parameters` | `{id, kind, value}`，P0 最小支持长度实数；P2 支持安全表达式 AST |
| `features` | ID 唯一、带输入引用的 DAG，不以数组顺序表达依赖执行语义 |
| `outputBodyId` | 显式最终实体引用，不再假设最后一个数组元素 |
| `metadata` | 可选标题等非几何字段；缓存时区分影响几何与非几何 hash |

### 两种严格区分的长度属性

P0 允许：

```json
{"radiusMm":{"parameterRef":"holeRadius"}}
```

或：

```json
{"radiusMm":{"literal":4}}
```

禁止把任意字符串表达式、JS eval、任意内核类名或模型提供的外部脚本传入 Feature。最小 `ScalarValue` 遵守类型/单位一致性；例如 `radiusMm` 只能引用 `kind=length`。后续再扩展白名单 AST 计算，不应在首次 Worker Spike 中做通用表达式执行环境。

## 3. Feature DAG 与重建协议

- 验证唯一 ID、依赖存在、合法类型/数量、环检测；明确 `boolean` 不可引用 sketch，`extrude` 只能引用已闭合的 profile。
- 对 DAG 进行**确定性拓扑排序**：无依赖节点按规范 ID 次序排列；保存独立 UI displayOrder，不参与几何语义。不要 Python 按输入顺序、JS 按 ID 做两套处理。
- 显式 `outputBodyId` 指定计算结果；中间体（如刀具体）可以单独存在，不自动作为最终用户实体。
- 缓存键初版使用 `documentGeometryHash + featureId + kernelBuildId + solverBuildId + unitConvention + toleranceProfileId`；非几何元数据改动不应强制重新算整个实体。
- `parameter.set` 找出使用该参数的特征，计算 downstream closure，按 DAG 顺序重新生成；未完成 geometry validation 前，不改变已提交可见文档。
- 错误必须包括 `featureId`、`code`、`kernelBuildId`、`inputDocumentHash` 与可安全展示的 message。

## 4. Browser Worker Protocol（建议）

```ts
// 设计示例；并非已经实现的 TS 文件
export type WorkerRequest =
  | { v:1; requestId:string; kind:'init'; kernelBuildId:string }
  | { v:1; requestId:string; kind:'build'; revision:number; generation:number; document:CadDocumentV1 }
  | { v:1; requestId:string; kind:'tessellate'; geometryId:string; revision:number;
      generation:number; linearDeflectionMm:number; angularDeflectionRad:number }
  | { v:1; requestId:string; kind:'export-step'; geometryId:string }
  | { v:1; requestId:string; kind:'import-step'; data:ArrayBuffer }
  | { v:1; requestId:string; kind:'dispose'; geometryId:string };

export type WorkerResponse =
  | { v:1; requestId:string; ok:true; kind:string; payload:unknown }
  | { v:1; requestId:string; ok:false; error:{ code:string; featureId?:string; message:string } };
```

- 所有消息必须有 `requestId`；异步重建响应还应回传 `revision/generation`，过期结果被丢弃。
- `geometryId` 是 Worker 本地不透明 handle，页面刷新或 Worker 重启后失效；前端不能伪造 OCCT 指针。
- Worker 初始化和耗时操作走单线程 WASM；取消不保证能中断同步 OCCT 内核，必要时 terminate+recreate Worker，并废弃老 handle。
- `tessellate` 的 ArrayBuffer 通过 transferable 传递，释放 JS 端和 Emscripten 端内存；至少监控活跃 B-Rep 句柄数、网格 buffer bytes、构建时间。
- `export-step/import-step` 明确单位、文件大小限制、格式错误、结构化警告；**不得在导入失败时静默转成 STL**。
- 不默认要求 pthread。若需要 SharedArrayBuffer，再引入 COOP/COEP/跨源隔离，与第三方资源兼容性一起评估。

## 5. GeometryEvidenceV1（规范化目标）

```json
{
  "schemaVersion": 1,
  "documentId": "precision_block_001",
  "revision": 1,
  "documentGeometryHash": "sha256:<calculated>",
  "kernelBuildId": "<exact-build>",
  "runtime": "browser-wasm",
  "outputBodyId": "result",
  "shape": {
    "valid": true,
    "closed": true,
    "solidCount": 1,
    "volumeMm3": 214492.035526,
    "surfaceAreaMm2": null,
    "bboxMm": [0, 0, 0, 120, 60, 30]
  },
  "warnings": [],
  "generatedAt": "<ISO-8601>"
}
```

示例 JSON 里的 hash、kernel ID、时间及表面积是**占位/结构示意**，不能当成实际证据。构建输出应包含 `sourceSha256`、已验证 native/WASM runtime 及固定执行环境；报告仅接受工具真实生成的数值。`SurfaceArea` / Shell / Face count 应在 P0 fixture 中按可用接口逐步实装，不能填伪造的默认值。

## 6. 数值校验矩阵

| Fixture | 输入 | 预期与门禁 | 失败条件 |
|---|---|---|---|
| P0-G01 | 10×20×30 box | 单 Solid 有效，6000 mm³ | 体积/bbox 错误 |
| P0-G02 | Ø10×20 cylinder | 单 Solid 有效，π×5²×20 mm³ | 圆柱方向/单位错误 |
| P0-G03 | 120×60×30 − Ø8 through hole | 1 Solid，有效，214492.035526… mm³ | 无效/网格充数/值超阈值 |
| P0-G04 | 孔径由参数 8→12 mm | volume 改为 `216000−π×6²×30`，有改变的 feature closure | `parameter.set` 不改变体积 |
| P0-G05 | 洗牌 feature 数组 | JS/native/WASM 算出同一 `outputBodyId` | 运行时不一致 |
| P0-G06 | 失效引用/环/负尺寸/NaN | 三端一致拒绝 | 某端接受 |
| P0-S01 | 4 条线+宽高约束矩形 | 水平/垂直/重合/距离残差在阈值内 | 不收敛假成功 |
| P0-S02 | 相同距离的矛盾约束 | 明确报冲突/过约束，原几何不丢失 | 改写尺寸后假成功 |
| P0-I01 | 完整 STEP | 独立回读、几何 evidence 一致 | 仅检查文件扩展名 |
| P0-I02 | 截断或乱码 STEP | 明确 format error；没有有效输出 | 无声转换或崩溃 |
| P0-L01 | 100 次创建、网格化与释放 | 显示 retained memory 绝对值/趋势，句柄清零 | 内存无界持续增长 |

对精确体积和 bbox 的 P0 默认门禁为绝对体积误差 ≤ `1e-3 mm³`、bbox 每坐标 ≤ `1e-4 mm`；后续按照模型尺度与 OCCT 容差设定相对公差。还应核验表面积/face/shell count，必要时用对称差体积而非只有相同 bbox/volume；两个不同的几何可能具有相同体积与包围盒。

## 7. CI 推荐新增作业

```text
contract-parity       # Schema -> TS/Python -> valid/invalid fixture acceptance
native-occt-reference # 当前已有，继续保持不回退
browser-wasm-chromium  # Playwright smoke/Worker/STEP/三角化
browser-wasm-firefox   # worker/geometry smoke
browser-wasm-webkit    # WebKit 兼容测试（不能完全等同 macOS Safari 实机）
solver-spike           # 欠/全/过约束及残差
sql-release-invariants# published release+membership 不可变
perf-nightly           # 100 cycles + 报告，预算超标需 review
```

所有浏览器 CI 应上传截图（仅辅助）、trace、STEP、几何数值 JSON、WASM 版本/build SHA 和失败日志，不能因为测试环境缺库就把作业标为通过。若 WebKit CI 与 macOS Safari 实机不一致，应明确记录差异而不是泛称“已支持 Safari”。

## 8. P0 完成定义（checklist）

- [ ] 文档 Schema/Types/运行时校验不漂移，反序 DAG 测试在三端一致
- [ ] 参数引用在 native/WASM 中真正触发几何重建
- [ ] Worker 实际运行已锁版本的 OCCT WASM
- [ ] Mesh 与 B-Rep 建模结果明确分层，Worker 能清理句柄
- [ ] Browser STEP 导出→独立回读，坏文件失败关闭
- [ ] 草图 solver Spike 及冲突报告真实跑通
- [ ] 浏览器兼容、资源与 100-cycle 数据有证据
- [ ] 许可证与工程构建 ADR 经审核，G0 decision 留档
