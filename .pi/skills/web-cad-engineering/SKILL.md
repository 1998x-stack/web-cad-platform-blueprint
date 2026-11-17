---
name: web-cad-engineering
description: Implement and review Web CAD, 3D Model Store, geometry, file exchange and MCP changes against canonical document, kernel evidence, permissions and regression gates.
---

# Web CAD Engineering Skill

Use this skill when modifying architecture, Sketch Solver, CAD features, model registry, file conversion, Web UI or AI/MCP tools in this repository.

## Required context

Read `README.md`, `AGENTS.md`, and the task-relevant chapters from `docs/00..18`. Prioritize `docs/03-system-architecture.md`, `docs/05-cad-domain-and-commands.md`, `docs/10-mcp-agent.md`, and `docs/13-testing-and-acceptance.md`.

## Procedure

1. Identify issue ID and acceptance criteria in `docs/12-roadmap-and-backlog.md`; state explicit non-goals.
2. Establish current schema version, kernel version and licensing implications.
3. Change contracts/schema before implementation; UI and MCP must use the same canonical commands.
4. Execute operations first in detached preview; do not mutate committed CAD before all checks succeed.
5. Geometry changes: include actual B-Rep validation and numeric fixture evidence; a screenshot/mesh count is insufficient.
6. Security changes: check ACL, resource scope, expected revision, approval, idempotency, output provenance and audit.
7. Run available tests and record commands and outcomes exactly; never mark unimplemented adapters as complete.
8. Update ADR, documentation and fixture when behavior or dependency changes.

## Hard stops

- No `eval` of user/model/agent content.
- No direct manipulation of authoritative data through Three.js meshes.
- No AI bypass of the CommandService / Policy Gate.
- No claims that a STEP/STL/GLB import preserves the original parametric feature history unless specifically demonstrated.
- No use of unapproved or ambiguously licensed third-party models or code.
- No automated merging of security, kernel, or migrations without independent review.

## Evidence format

```text
Issue ID:
Changed contracts:
What is implemented vs placeholder:
Tests actually run:
Kernel/solver version and exact geometry evidence:
Security/authorization tests:
Known limitations:
Rollback plan:
```
