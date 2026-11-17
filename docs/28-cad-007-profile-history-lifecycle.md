# CAD-007 · 精确多边形草图轮廓、版本历史与兼容性

**状态**：实施 PR；CI 是唯一实际 WASM 与跨浏览器结论来源。不可把单元测试里的 trace kernel 当成真实 OCCT 数值证据。

## 实现范围

- CAD-006 的 `planegcs` Worker、`sketch.v1` 契约保持不变。
- `profile.mjs` 将 **已由 planegcs 求解**、完整匹配当前草图修订号、`fully_constrained` 的单个闭合直线环转换为几何轮廓。
- 与“取外接框生成 Box”不同，支持不轴对齐三角形、旋转矩形及凹 L 形：轮廓不允许交叉、顶点重复、零长度边、洞、多环、弧线。
- 新 CAD 特征 `profile` 携带 `sourceSketchId`、`sourceSketchRevision`、`plane: XY`、`pointsMm`；`extrude` 引用 `profile`，支持 `distanceMm: {parameterRef:'extrusionDepth'}`。
- `buildExactSolid` 对 `profile` 调用 OCCT `makeLineEdge → makeWire → makeFace`，对 `extrude` 调用 `extrude(face,0,0,depth)`，对生成实体执行有效性、Solid 数量、体积检查，所有中间 Wire/Edge 句柄都显式释放。
- Worker 每次新构建前释放旧 Arena；构建报错时再次 `releaseAll`，禁止继续引用旧 GeometryId。
- `LocalCadHistory` 提供**进程内**、不可变快照、修订冲突验证、Undo/Redo、分支后清空 Redo。**不是**长期保存、审计日志、多人实时协作、PDM 或自动恢复。
- 新 `/profile.html` 浏览器演示不依赖 WebGL，使用 SVG 查看 2D 轮廓，真实 Worker 完成建模、三角化、STEP 下载；可编辑厚度、Undo/Redo。

## 单元与真实内核验收

| 基准 | 面积 mm² | 拉伸 mm | 理论体积 mm³ |
|---|---:|---:|---:|
| 直角三角形 | 6000 | 10 | 60000 |
| 旋转矩形 | 800 | 10 | 8000 |
| 凹 L 形六边形 | 5600 | 12 | 67200 |

`node --test packages/cad-sketch/test/profile.test.mjs` 包含开口、自交、无效解、旧修订号负例；`npm run test:profile-wasm` 必须在真实 Node WASM 中以 0.001 mm³ 容差校验上述体积，并进行 100 次 Build/Tessellate/Dispose 生命周期测试及 stale handle 拒绝。

`npm run test:profile-browser` 在 Chromium / Firefox / WebKit 各自执行真实 Worker + planegcs、三角形→凹多边形、厚度修改、Undo/Redo、STEP 下载。WebKit/Linux 可作为 Safari WebKit 的**兼容性信号**，不能直接等同于 macOS Safari 真机验收。

`npm run dev:studio` 后访问 http://127.0.0.1:4173/profile.html。

## 有意识保留的限制与风险

1. 未实现通用拖拽编辑器、多轮廓、孔、圆弧/样条、草图投影、装配约束、相切条件。
2. 对没有约束但所有顶点固定的简单图形，planegcs 可返回零 DOF；它属于几何固定位置的构造轮廓，不应宣称已经实现复杂参数化几何关系。
3. 后端验证只执行浅层结构检查 + 轮廓自交检测，跨事务草图溯源、用户签名、权限和服务器状态未实现；`sourceSketchRevision` 不能当作安全证明。
4. 100 次释放压力测试不等于严格证明没有 WASM 堆泄漏，长期稳定性还需要浏览器 profiler 与持久压力测试。
5. 本地 Revision 是快照索引，真正多人/离线同步还需 durable revision store、事务约束、合并策略。
6. 独立第三方 STEP 回读矩阵（含不同工业系统）仍属于后续 CAD-005；本次确认文件由真实 OCCT WASM 导出。

## 后续门槛

完成 CAD-007 后才评估 CAD-008（真正交互草图、面/边拓扑引用与拉伸历史的完整重建），并保留跨浏览器测试回归。G0 P0 全面验收仍需实际浏览器内存证据、异常恢复与 Safari 真机验证。
