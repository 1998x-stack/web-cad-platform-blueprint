# 07｜3D 模型商店：资产、搜索、授权、模型复用

## 7.1 “Store” 两层产品含义

P1 先做 **模型目录与复用中心**（Model Library），不处理付款；P6 如要商业交易，再单独规划商品、结算、税务与退款。GitHub Pages 不允许作为主要面向商业交易或 SaaS 的免费托管设施，商业商店需独立平台。

## 7.2 核心对象

- `ModelListing`：面向搜索的稳定实体，标题、描述、分类、作者、可见性。
- `ModelRelease`：不可变版本，对应固定 `documentRevision`, assetManifest, formats, licenseSnapshot。
- `Asset`：内容寻址的文件对象，hash, byte length, format, MIME, units, status。
- `ModelCapability`：`renderable`、`exactGeometry`、`parametricEditable`、`assemblable`，由验证证据决定。
- `Collection/Tags`：用户收藏、分类、标签（初期可选）。

**禁止**：模型详情仅凭 `.step` 扩展名标记“可完整编辑特征”；版本修改覆盖同名对象。

## 7.3 大规模目录（10k→100k→1M）

- 10k：SQLite FTS5 + normalized tags + 普通分页和条件筛选已足够进入性能验证。
- 100k：观测 FTS 召回、Facet 计算和 DB 写锁；必要时索引表、预计算统计。
- 1M：视实际查询与并发考虑独立检索系统与 PostgreSQL。不要以假想体量提前引入多套复杂搜索基础设施。
- 缩略图/GLB 使用 CDN 和按需加载，列表页不预加载全部 3D 场景。
- 数据库只保存资源 metadata 与 hash；大文件放对象存储，不作为 SQLite BLOB 的默认方案。

## 7.4 模型详情页

`ModelViewer` + `title` + `version selector` + `author` + `license` + `editable badge` + `metadata` + `format list` + `copy reference` + `open in studio` + `download`。

复制入口建议提供三种模式，只有目标资产具备相应能力时才可用：

1. **复制引用**：`cad://models/<publicId>@<version>`，用于应用内部或者 MCP 工具解析。
2. **复制模型 Manifest JSON**：稳定元数据、资源 URL/哈希（遵守许可）；不包含秘密或未授权内容。
3. **导入到当前工程**：以 `assembly occurrence` 或 `imported asset` 方式引用选定 Release；不能无声贴入顶层场景且丢失来源。

## 7.5 上架流程

`draft → scanning → validating → review → published → deprecated | quarantined`。

上传验收：文件大小/类型白名单、Magic bytes、GLB 解析边界、压缩炸弹检查、许可证说明、缩略图安全解码、几何健康指标与内容哈希。公开第三方模型需审核版权和再分发权。

## 7.6 搜索与推荐

- P1：精确标题/标签与 FTS5 搜索，按更新时间/热度/格式过滤。
- P2：模型尺寸、材料、适用制造工艺等结构化 Facets。
- P6：相似向量、参数相似度检索；向量检索仅用于召回，最终由精确授权与版本信息决定可操作性。
- 任何 AI 生成描述必须标注来源/审核状态，防止虚构尺寸或可制造性。

## 7.7 API 示例

```http
GET /v1/models?q=bracket&format=step&pageSize=24&cursor=...
GET /v1/models/{publicId}
GET /v1/models/{publicId}/releases
GET /v1/models/{publicId}/releases/{version}/manifest
POST /v1/models/{publicId}/releases/{version}/open-in-project
```

下载前由 API 检查访问权，再提供短时 URL；公开目录的 metadata 公开不代表未公开文件也可直接访问。

## 7.8 商业化边界

引入付费模型时需另建 `entitlements`, `orders`, `payments`, `refunds`, `tax handling`, `payouts`；支付使用合规支付服务商，平台不存卡号。版权申诉、作品下架、退款与反盗版机制不可省略。P1 不在此范围。
