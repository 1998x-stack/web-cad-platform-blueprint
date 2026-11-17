# 06｜精确几何内核、草图求解与性能方案

> CAD-004/005 目前已完成 **native OCCT reference spike**，浏览器 WASM Worker 未完成。参见 [实测证据](19-cad-004-005-evidence.md)。

## 6.1 模型计算分层

`Sketch Geometry` → `Constraint Solver` → `Closed Profile` → `Feature Builder` → `B-Rep Validator` → `Tessellator` → `Three.js Renderer`

草图/约束采用 2D 求解器；实体建模交给 OCCT。把 `Mesh` 作为显示输出，不能作为常规精确实体的唯一源模型。

## 6.2 P0 精确 CAD Spike

1. 初始化 `replicad-opencascadejs`/OpenCascade.js，pin 版本。
2. 创建一个 120×60×30 mm 的盒体；测量 bounding box、体积、有效性。
3. 采用指定基准平面建立一个圆孔并 cut；验证保留单个有效 solid。
4. 将结果 tessellate 至三角网格，用 Three.js 显示；mesh 映射可选 faceId/edgeId。
5. 导出 STEP；在**独立新建的内核实例**导入，比较 bodyCount、volume、bbox（按容差）。
6. 在测试期间监控一次/重复 100 次建模后 WASM 内存趋势；记录是否显式 delete/dispose。

## 6.3 Sketch 约束 MVP

**原语**：line, circle, arc, rectangle（矩形内部拆为四条线），后续加 ellipse/spline。

**约束**：coincident, horizontal, vertical, parallel, perpendicular, equal, tangent, length, radius, angle, fixed。

**诊断**：欠约束（自由度大于 0）、完全约束、过约束/冲突、数值不收敛；尽可能返回冲突约束集合和最终残差。

**建议实现**：`SketchSolverAdapter` 封装 planegcs 或等价可用库，用 JSON schema 隔离依赖；UI 不依赖求解器具体对象结构。每次计算输出可解释的几何变更与约束状态。

## 6.4 KernelAdapter（目标接口）

```ts
interface KernelAdapter {
  initialize(): Promise<{kernelVersion:string}>;
  build(document:CadDocument, options:{generation:number}): Promise<BuildResult>;
  validate(shapeId:string): Promise<GeometryEvidence>;
  tessellate(shapeId:string, options:{linearDeflectionMm:number; angularDeflectionRad:number}): Promise<MeshPackage>;
  exportExact(shapeId:string, format:'STEP'): Promise<Uint8Array>;
  dispose(shapeId:string): Promise<void>;
}
```

`BuildResult` 必须同时记录：构建特征、失败原因、精确几何状态、拓扑映射、可显示网格版本。不要把异常吞掉并返回“空 mesh”当成功。

## 6.5 异步与性能

- 设计单线程 Worker 版本作为起点；官方 OpenCascade.js 多线程 WASM 需要 `SharedArrayBuffer` 和 cross-origin isolation（相关 HTTP 安全响应头与资源兼容性）。
- UI 发出 `generation` 单调递增序列；只接受与当前文档最新 generation 匹配的网格结果。
- 模型拖动期间可减少 tessellation 细度，鼠标释放后恢复高精度；精确实体不随 LOD 改变。
- 计算缓存键含 `documentHash`, `kernelVersion`, `featureId`, `tessellationOptions`，不能只按文件名缓存。
- 内核初始化、WASM 加载和大文件解析均需显式 loading/failure UX，避免冻结页面。

## 6.6 拓扑命名风险

当上游零件特征变化后，底层 B-Rep 面、边的内部顺序可能改变；仅保存 `faces[3]` 不稳定。

采用分层策略：特征来源（provenance）→ 几何签名（surface type、area、centroid、normal）→ 邻接拓扑 → 唯一性检查。遇到多个候选或匹配失败，要求用户重新选择，**禁止盲选第一项**。

## 6.7 几何结果质量门禁

| 类型 | 必需校验 |
| --- | --- |
| Basic primitives | solid count、有效性、bbox、体积 |
| Extrude/Revolve | 轮廓封闭与非自交、方向、体积、上下游引用 |
| Boolean | 操作有效性、body 数量变化、退化体、容差问题 |
| Fillet/Chamfer | 半径合理性、失败位置、拓扑匹配 |
| STEP | 文件可再次导入、体积和 bbox 容差一致 |
| STL/3MF | 网格闭合、水密、正常法向、单位、退化三角形 |

## 6.8 参考

- https://github.com/sgenoud/replicad/blob/main/packages/replicad/README.md （OCCT 初始化、STEP/STL 与 Worker 建议）
- https://ocjs.org/docs/advanced/multi-threading/intro （多线程限制）
- https://github.com/Salusoft89/planegcs （约束求解器）
- https://github.com/xibyte/jsketcher （Feature History 与求解器集成）
