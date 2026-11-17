# 16｜Agent 工程开发流程与仓库级协作约束

## 16.1 Agent 不是万能代码生成器

CAD 项目中 LLM 可以帮助实现 UI、命令、测试和分析，但几何有效性必须用真实内核与回归集证明。Agent 的完成报告须明确哪些代码真实运行过，哪些只是设计或占位。

## 16.2 推荐角色

| 角色 | 输入 | 输出 | 禁止 |
| --- | --- | --- | --- |
| Product Planner | 需求与里程碑 | Epic/Issue、验收标准 | 把不支持功能宣称为已完成 |
| Architecture Reviewer | ADR + Contracts | 依赖审查、设计记录 | 绕开单一文档模型 |
| CAD Domain Engineer | Schema + Feature DAG | Typed commands、测试 | 在渲染层直接改 CAD 事实 |
| Geometry Engineer | B-Rep fixtures | 几何实现、内核证据 | 用截图代替精确运算测试 |
| Store/Data Engineer | Schema + permission rules | DB/Storage/API | 将未授权资产公开 |
| MCP/Security Engineer | MCP spec + grants | Tool schemas、preview/commit | 通过 agent key 直接获得文档编辑权 |
| QA/Release Engineer | Fixture + runbook | 测试记录、风险审查 | 跳过失败门禁发版 |

## 16.3 建议放置的技能文件

对 Codex / Pi / Claude，可在 `.codex/skills/web-cad-engineering/SKILL.md`、`.pi/skills/web-cad-engineering/SKILL.md`、`.claude/skills/web-cad-engineering/SKILL.md` 放同一份协作规范，包含：

1. 阅读 `README.md` 与 `docs/03`, `docs/05`, `docs/13`；
2. 明确本次 Issue ID、范围、证据预期；
3. 先改 contracts/schema，再改 domain 和 geometry，最后修改 UI；
4. 为新增几何操作增加真实 B-Rep fixture；
5. 如涉及新依赖，核查许可证与版本；
6. 运行门禁并在 PR 中贴出实际命令结果；
7. 禁止把未执行测试写成“通过”。

本包包含一个可复制的 Agent 规则文件 `AGENTS.md`；是否镜像至具体 agent 配置目录可按你的工作环境调整。

## 16.4 最小 PR 检查

```md
Issue: CAD-104
Changes: typed Extrude command + worker implementation + viewport mapping
Evidence: kernel version, fixture id, valid solid, bbox/volume diff
Failure cases: invalid profile, zero distance, wasm unavailable
Security: no unsandboxed eval, no bypassed CommandService
Tests run: exact commands + result URLs/artifacts
Known limitations: ...
```

## 16.5 禁止自动合并的改动

任何改变内核版本、拓扑命名逻辑、数据迁移、权限模型或签名文件 URL 的 PR，必须先经过明确的人类 review 与部署回滚预案。安全相关变更尤其不能只凭 AI 自评自动合并。
