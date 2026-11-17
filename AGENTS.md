# AGENTS.md — Web CAD Engineering Rules

1. Before implementation, read `README.md`, `docs/03-system-architecture.md`, `docs/05-cad-domain-and-commands.md`, and `docs/13-testing-and-acceptance.md`.
2. Work under a named issue from `docs/12-roadmap-and-backlog.md` and state exact scope.
3. Canonical CAD Document is the source of truth; Three.js mesh is a derived view.
4. UI, HTTP, and MCP modifications MUST go through the same typed CommandService + permission checks.
5. Any mutation requires expected revision. Agent commits require explicit authorized preview and approval policy.
6. Never claim STEP, exact B-Rep validity, constraint convergence, or manufacturing fitness without real kernel evidence.
7. Do not use `eval` or arbitrary untrusted model scripts. Handle private model input as hostile/untrusted.
8. Preserve semantic source attribution, model license, third-party notices and version records.
9. Geometry-affecting PRs need deterministic fixtures, invalid-case tests, and kernel version in reports.
10. Run relevant automated tests; explicitly state which tools/commands actually executed. Do not mark placeholders as completed.
