#!/usr/bin/env python3
"""Validate review plan/backlog consistency. Not CAD geometry evidence."""
from __future__ import annotations

import csv
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'planning' / 'backlog.csv'
NEXT = ROOT / 'planning' / 'p0-p2-next-backlog.csv'
EXPECTED = {
    'docs/20-deep-review-and-gaps.md',
    'docs/21-next-milestones-p0-p2.md',
    'docs/22-contract-freeze-and-verification.md',
    'docs/23-model-store-p1-plan.md',
    'docs/24-parametric-studio-p2-plan.md',
    'docs/adr/0002-contract-parity-and-phase-gates.md',
}


def read_csv(path):
    with path.open(encoding='utf-8-sig', newline='') as fp:
        return list(csv.DictReader(fp))


def audit():
    orig = read_csv(BASE)
    rows = read_csv(NEXT)
    assert rows and orig, 'empty task list'
    orig_ids = {r['id'] for r in orig}
    tasks = {}
    for r in rows:
        task_id = r['id']
        assert task_id and task_id not in tasks, f'duplicate task id: {task_id}'
        assert r['phase'] in {'P0', 'P1', 'P2'}, task_id
        assert r['milestone'] in {'M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6'}, task_id
        assert r['source_task'] in orig_ids, f'unknown source task for {task_id}'
        assert r['title'] and r['deliverable'] and r['acceptance'], task_id
        assert r['state'] in {'planned', 'in_progress', 'done', 'blocked'}, task_id
        assert int(r['estimate_person_days']) > 0, task_id
        tasks[task_id] = r
    visiting, visited, path_cost = set(), set(), {}

    def depth(tid):
        if tid in visiting:
            raise AssertionError(f'cycle detected via {tid}')
        if tid in visited:
            return path_cost[tid]
        visiting.add(tid)
        deps = [x.strip() for x in tasks[tid]['depends_on'].split(';') if x.strip()]
        assert len(deps) == len(set(deps)), f'duplicate dependencies on {tid}'
        for dep in deps:
            assert dep in tasks, f'unknown dependency {dep} on {tid}'
            assert dep != tid, f'self dependency {tid}'
        longest = max((depth(dep) for dep in deps), default=0)
        visiting.remove(tid)
        visited.add(tid)
        path_cost[tid] = longest + int(tasks[tid]['estimate_person_days'])
        return path_cost[tid]

    for tid in tasks:
        depth(tid)
    for filepath in EXPECTED:
        assert (ROOT / filepath).is_file(), f'missing review doc: {filepath}'
    for gate_id in ['NEXT-011', 'NEXT-020', 'NEXT-029']:
        assert gate_id in tasks, f'missing gate task: {gate_id}'
    by_phase = defaultdict(lambda: [0, 0])
    for row in rows:
        by_phase[row['phase']][0] += 1
        by_phase[row['phase']][1] += int(row['estimate_person_days'])
    # The calculated critical path is only a lower bound on one-worker sequential dependencies,
    # NOT an actual calendar or completion forecast.
    print(f'PASS: {len(rows)} distinct tasks, valid source links, acyclic dependencies, three gates')
    print('Workload person-days (indicative, no concurrency/contingency):', dict(by_phase))
    print('Longest dependent work-chain person-days (planning metric, not schedule):', max(path_cost.values()))
    return tasks


if __name__ == '__main__':
    audit()
