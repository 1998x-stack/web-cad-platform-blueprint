# 09｜HTTP API、格式交换与转换任务

## 9.1 设计规则

- REST URL 版本化 `/v1/`；请求体进行 schema 验证，错误码结构固定。
- 私有模型：访问/导出时均检查 owner/team/agent grant，不仅在网页显示时检查。
- 写操作 `Idempotency-Key` + `expectedRevision`；失败不丢弃上一次有效 CAD 文档。
- 大文件采用直传对象存储（临时签名 URL）、病毒/格式检测与异步处理。
- 对外返回 `artifactManifest`，至少包含格式、hash、bytes、sourceRevision、kernelVersion、验证报告。

## 9.2 端点草案

| 方法 | 路径 | 作用 | 前置检查 |
| --- | --- | --- | --- |
| GET | `/v1/models` | 列表、搜索、筛选 | 公共/当前用户可见 |
| GET | `/v1/models/{id}/releases/{version}` | 模型 release | visibility/ACL |
| POST | `/v1/projects` | 建项目 | 身份与额度 |
| POST | `/v1/documents` | 新建 CAD 文档 | project editor |
| GET | `/v1/documents/{id}` | 当前文档 | viewer |
| GET | `/v1/documents/{id}/revisions/{n}` | 历史快照 | viewer |
| POST | `/v1/documents/{id}/previews` | detached 命令预览 | editor + base revision |
| POST | `/v1/documents/{id}/commits` | 原子提交预览 | editor + valid preview + exact revision |
| POST | `/v1/documents/{id}/exports` | 创建转换任务 | export permission + quota |
| GET | `/v1/jobs/{id}` | 查询进度 | job owner |
| POST | `/v1/jobs/{id}/cancel` | 取消任务 | job owner |
| POST | `/v1/uploads` | 获取上传授权 | file policy + quota |

## 9.3 统一错误语义

```json
{
  "error": {
    "code": "REVISION_CONFLICT",
    "message": "Document changed since preview",
    "details": {"expectedRevision": 4, "actualRevision": 5},
    "requestId": "req-20261117-001"
  }
}
```

建议 HTTP 状态：400/422 输入问题，401 未登录，403 无授权，404 不存在/不可枚举，409 修订冲突，413 超出大小，415 格式不支持，429 配额，503 暂时不可用。

## 9.4 文件能力矩阵

| 源/目标 | 用途 | 能保留 | 主要损失/风险 |
| --- | --- | --- | --- |
| Native CAD JSON → Native | 全历史再编辑 | 特征/参数/约束/引用 | 需要同版本/迁移支持 |
| Native/STEP B-Rep → STEP | 精确几何交换 | 精确曲面/实体拓扑及部分属性（依具体实现） | 不保证原生历史/装配 mate 完整 |
| Native B-Rep → STL | 3D 打印 | 网格近似几何 | 曲面精度、特征树、材料/颜色通常不保留 |
| Native B-Rep → GLB | 网页显示 | 网格/可视化材质 | 原始精确 B-Rep 和特征史不保留 |
| Native → 3MF | 3D 打印生态 | 网格及部分制造属性 | 取决于导出实现与切片器 |
| Sketch/Drawing → DXF | 2D 交换 | 支持子集中的几何与标注 | 版本/实体类型兼容性 |
| GLB/STL → STEP | 反向转换 | 无天然无损路径 | 需要 reverse engineering；**初期不承诺** |

glTF 2.0 定位为运行时 3D 内容交付格式，而非机械 CAD 原生历史格式。官方规范：https://registry.khronos.org/glTF/

## 9.5 Conversion Job

```json
{
  "jobId": "job_01",
  "source": {"documentId":"doc_01", "revision":12},
  "target": {"format":"step", "units":"mm"},
  "status": "validating",
  "progress": 85,
  "manifest": null,
  "errors": []
}
```

状态机：`queued → running → validating → completed | failed | cancelled`。

**导出验证**：STEP 再导入并比较 B-Rep 体积/bbox；STL 检查连通、水密、退化三角形及误差；GLB 检查 glTF schema、缓冲区、材质与 bbox。每种验证均记录工具版本和容差。

## 9.6 安全

- 上传类型双重校验（文件头 + 解析器），文件大小与解压后预算；禁任意网络 URL 抓取以防 SSRF。
- 对第三方 parser 使用资源上限与独立任务进程，抵御恶意几何或压缩炸弹。
- 下载链接短时有效；对象存储桶默认私有；对外公开模型通过独立 CDN 策略。
- 用户文件名不得参与 shell 命令/存储路径拼接；所有异步转换操作使用不可变源 revision。
