# 14｜部署架构、GitHub Pages 限制与生产运维

## 14.1 Github Pages 的正确使用

官方限制（调查日 2026-11-17）：GitHub Pages 面向静态网站；官方明确不允许将 Pages 用作主要面向商业交易或提供商业软件即服务的免费 Web 托管；站点大小不超过 1GB，建议源仓库不超过 1GB，另有带宽等软限制。详细条款以官网为准：

https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits

因此：

- **可以考虑**：公开文档、非商业示例 Gallery、技术 Demo、小规模静态模型预览。
- **不能以 Pages 代替**：商用付费模型商城、动态登录/权限 API、MCP 服务端、大量模型文件对象存储、支付与私有项目工作区。
- 若希望保留 GitHub Pages 发布入口，可独立创建一个 docs/demo 静态站，真实产品放在符合使用政策的云托管服务上。

## 14.2 推荐环境

| 环境 | 组成 | 用途 |
| --- | --- | --- |
| Local dev | Vite + Node API + SQLite + local object store | 功能开发、单人验证 |
| Preview | 按 PR 隔离的静态前端 + 测试 API | E2E、审查设计与几何差异 |
| Staging | 生产相似的 API + Worker + 数据库 + 对象存储 | 迁移、负载、安全演练 |
| Production | CDN + Web app + API + Job queue + CAD workers + managed database + object storage | 团队化服务 |

初期 SQLite 合理，进一步扩容时由 metrics 决定是否迁移 PostgreSQL。几何计算 Worker 的 CPU/内存/运行时间与普通 API 服务分别限额。

## 14.3 WASM 部署要点

- 支持 `.wasm` 正确 MIME (`application/wasm`) 和版本化资源 URL。
- Vite `base` 根据部署前缀调整；非根路径静态资源不可用是常见故障。
- 先部署单线程版本；如果启用 pthread/SharedArrayBuffer，浏览器页面通常需 cross-origin isolated（COOP/COEP 等），并审计第三方脚本、iframe、图片加载策略。
- 部署后必须在真实域名与 HTTPS 进行 Smoke 测试：内核初始化、Worker 加载、静态资源命中、模型回显和导出。

## 14.4 运行服务与对象存储

API endpoint 通过 HTTP 暴露受控的 project/catalog/exports；MCP endpoint 则调用同一 service，不单独开后门。对象存储默认私有，公开发布经 asset manifest 白名单及独立访问机制。不同环境的密钥必须隔离。

## 14.5 可观测与 SLO（建议）

**技术日志**：`requestId`, `documentId`（匿名化或受控）、`revision`, `commandType`, `durationMs`, `kernelVersion`, `outcome`；不记录 API 密钥、完整私有模型或未经授权的上传原文。

**指标**：模型加载错误、CAD kernel panic、几何重建失败原因、Web Worker 内存、STEP 导出失败率、数据库锁等待、任务队列积压、403/409/429 频率。

初期 SLO 是目标，必须经历生产/模拟负载验证后才对外承诺；对数据库恢复和对象资产一致性定期演练。

## 14.6 升级与回滚

- 前端、API、schema 与 kernel 使用版本兼容矩阵。
- 升级时先在固化几何样本上进行 back-to-back 重建比较，差异通过 review 后上线。
- rollback 不应令旧客户端误读不可逆升级的新文档；采用向前兼容字段和 migration policy。
- 跨境数据、模型知识产权、客户项目保密和备份保留策略需要另做合规决策。
