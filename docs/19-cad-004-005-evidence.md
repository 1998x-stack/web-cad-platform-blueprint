# 19｜CAD-004 / CAD-005：真实 OCCT B-Rep 与 STEP 往返验证

> **实现状态：native OCCT reference spike 已完成并验证；浏览器 WASM Worker 未完成。** 不将原生 Python OCCT 测试解释为 JavaScript/WebAssembly 测试。

## 执行方式

```sh
python3 -m pip install -e './packages/cad-geometry-python'
PYTHONPATH=packages/cad-geometry-python/src python3 -m unittest discover -s packages/cad-geometry-python/tests -v
PYTHONPATH=packages/cad-geometry-python/src python3 -m cad_geometry.cli run \
  samples/precision-block.cad.json \
  --step /tmp/precision-block.step \
  --report /tmp/precision-block.evidence.json
```

## 真实几何场景

`box(120, 60, 30 mm)` 减去贯穿的 `cylinder(radius=4 mm, height=30 mm)`，孔轴线沿 Z 轴，位于 `(60,30,0)`。

**独立解析步骤**：新建 `STEPControl_Reader`，调用 `ReadFile` → `TransferRoots` → `OneShape`；对导出前的精确实体与重导入后实体分别运行 `BRepCheck_Analyzer`、实体数量、BRepGProp 体积和 BRepBndLib bounding box。

| 检测项 | 本地实测值 |
| --- | --- |
| 内核 | OCCT via cadquery-ocp 7.9.3.1.1 |
| B-Rep 有效 | true |
| Solid 数量（前 / 后） | 1 / 1 |
| 预期解析体积 | 216000 − π×4²×30 = 214492.035526... mm³ |
| 导出前体积 | 214492.03552627692 mm³ |
| STEP 导入后体积 | 214492.03552627686 mm³ |
| 体积绝对差 | 5.820766091346741e−11 mm³ |
| bbox 最大坐标差 | 0.0 mm |
| 体积容差 / bbox 容差 | 0.001 mm³ / 0.0001 mm |
| STEP 文件尺寸 | 19041 bytes |
| STEP 格式头 | `ISO-10303-21;` |
| 单元测试 | 11/11 PASS（本地 Python 环境） |

记录于 [`samples/precision-block.evidence.json`](../samples/precision-block.evidence.json)。真实 STEP 文件为 [`samples/precision-block.step`](../samples/precision-block.step)。

## 判断与后续

- **CAD-004：部分完成** — 真实精确 B-Rep、实体计算、有效性检查、布尔切除已通过，**浏览器 OCCT WASM Worker 和 Three.js 网格接口尚未实现**。
- **CAD-005：基准场景完成** — STEP 真实文件导出/读入与几何一致性通过。生产级 STEP 导入/导出还缺多零件、单位、几何畸变、曲面、错误文件的测试矩阵。
- 本例的 primitives 是用于内核验证的 `box` 与 `cylinder`，**不是约束草图求解器**；`Sketch → Extrude` 仍属于后续 CAD-006/CAD-104。
- 把 Python 端作为 oracle / 服务器 worker；Web 产品端将来需要独立实现 `KernelAdapter` 的 WASM 版本并做跨内核数值一致性对比。
- 第三方 OCCT/STEP 可能存在运行时间和内存消耗高的恶意文件；正式服务端需使用资源限制、超时和进程隔离。
- 使用 `cadquery-ocp` wheel 包含 OCCT LGPL 组件；商业交付需审查许可证履行方式，不能只看 Python wrapper license。

## 本轮可验证证据与缺口

本轮本地执行：11 个 Python 几何测试通过，9 个 Node 事务测试通过，文档及 SQLite 检查通过。GitHub Actions 实际结果需要以对应 workflow run 为准，不能拿本地结果替代。STEP 的 SHA-256 与实际环境生成文件对应，但后续不同平台/构建的 STEP Header 可能产生不同字节；几何等价按体积与 bbox 容差判断。
