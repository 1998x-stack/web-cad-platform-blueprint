# 08｜SQLite 数据模型与对象存储策略

## 8.1 实际 Schema

初始迁移：`packages/cad-store/migrations/001_init.sql`，可直接在 SQLite 执行，启用外键和 FTS5。主要实体：

| 表 | 角色 | 关键约束 |
| --- | --- | --- |
| `users` | 用户身份 | 唯一 public_id |
| `projects` | 项目 | owner_id FK、deleted_at |
| `documents` | CAD 文档 | project_id FK、current_revision |
| `document_revisions` | 不可变历史 | `(document_id, revision)` 唯一 |
| `assets` | 文件哈希和 object_key | sha256 唯一、bytes 非负 |
| `model_listings` | 模型目录 | slug 唯一、作者 FK、审核状态 |
| `model_releases` | 不可变发布版本 | `(listing_id, version)` 唯一 |
| `release_assets` | release 与资产关系 | FK 与 format 校验 |
| `tags` / `listing_tags` | 分类/标签 | 唯一 tag slug |
| `jobs` | 转换/导出 | 状态、进度、输入输出 asset |
| `agent_grants` | AI 授权 | actions、scope、到期时间 |
| `agent_previews` | 预览及有效 revision | grant、doc revision、expiry |
| `audit_events` | 审计 | actor、action、result、created_at |
| `model_listings_fts` | 文本检索 | FTS5 external content + triggers |

## 8.2 双重一致性

文档提交属于元数据交易；模型文件/预览输出属于内容对象存储。推荐写入顺序：

1. 先计算并校验对象 hash，上传临时 content-addressed object；
2. 一个数据库事务提交 revision manifest 与资产元数据引用；
3. 事务成功后对象允许成为可访问资产；孤儿临时对象由有界 TTL GC 清理；
4. 读取时验证 metadata 与实际存储一致（按可靠性等级抽样或全量校验）。

**不应**试图把 S3 上传当成 SQLite 单事务的一部分；采用显式补偿与 GC。

## 8.3 幂等与 revision 防并发冲突

```sql
UPDATE documents
SET current_revision = current_revision + 1
WHERE id = :doc_id AND current_revision = :expected_revision;
-- changes() = 1 才能继续插入 document_revisions / 事件（同一 DB 事务）
```

运行时数据库使用 WAL 模式可提高读取体验，但 SQLite 单写者性质不变。需要测量同时保存/发布/转换任务写入峰值，达到瓶颈后迁移更适合高并发写入的服务端数据库。

## 8.4 对象命名

`blobs/sha256/<first2>/<fullhash>`；immutable；下载文件名只用于 Content-Disposition，不用于确定存储键。衍生预览记录 `sourceHash`, `converterVersion`, `configHash` 以便失效缓存。

## 8.5 查询与索引

```sql
SELECT l.id,l.public_id,l.title
FROM model_listings_fts f
JOIN model_listings l ON l.id=f.rowid
WHERE model_listings_fts MATCH 'chair*'
  AND l.visibility='public'
  AND l.status='published'
LIMIT 25;
```

公开搜索务必同时检查 `visibility`、`status` 和 ACL；FTS 表不是权限边界。搜索字符串需合理转义与限制长度，以避免异常查询或资源消耗。

## 8.6 迁移治理

- 永不在生产环境随意删除带业务意义的列；使用可回滚/向前兼容迁移。
- schema 迁移和应用版本以 `schema_migrations` 表记录。
- 每次迁移在干净库和有旧数据的副本库执行；外键和 FTS 重建必测。
- 备份、恢复与迁移演练应纳入 P3 质量门禁。
