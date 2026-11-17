/**
 * Local performance harness (NOT a committed test).
 * Measures cold kernel init + first exact build/tessellate/STEP export in the real
 * node worker_threads + WASM path, and reports P50/P95 over several fresh workers.
 *   node evidence/<RUN_ID>/tools/measure-perf.mjs
 */
import {readFileSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import {performance} from 'node:perf_hooks';
import {CadWorkerClient} from '../../../packages/cad-geometry/src/client.mjs';
import {createPlanegcsSolver} from '../../../packages/cad-sketch/src/planegcs.mjs';
import {solveSketch} from '../../../packages/cad-sketch/src/solver.mjs';
import {solvedProfileToCadDocument} from '../../../packages/cad-sketch/src/profile.mjs';

const file = n => JSON.parse(readFileSync(new URL(`../../../samples/${n}.sketch.json`, import.meta.url)));
const binding = await createPlanegcsSolver();
const sketch = file('concave');
const solved = await solveSketch(sketch, binding.createWrapper, {successStatus: binding.successStatus});
const doc = solvedProfileToCadDocument(sketch, solved, 12);

const RUNS = 5;
const samples = [];
for (let i = 0; i < RUNS; i++) {
  const worker = new Worker(new URL('../../../packages/cad-geometry/src/node-worker.mjs', import.meta.url), {type: 'module'});
  const client = new CadWorkerClient(worker, {timeoutMs: 150_000});
  try {
    const t0 = performance.now();
    await client.initialize();
    const t1 = performance.now();
    const built = await client.build(structuredClone(doc));
    const t2 = performance.now();
    await client.tessellate(built.geometryId, 0.1, 0.5);
    const t3 = performance.now();
    await client.exportStep(built.geometryId);
    const t4 = performance.now();
    await client.dispose(built.geometryId);
    samples.push({
      run: i + 1,
      coldInitMs: +(t1 - t0).toFixed(1),
      firstBuildMs: +(t2 - t1).toFixed(1),
      tessellateMs: +(t3 - t2).toFixed(1),
      stepExportMs: +(t4 - t3).toFixed(1),
      totalMs: +(t4 - t0).toFixed(1),
      volumeMm3: built.evidence.volumeMm3,
    });
  } finally {
    client.close();
  }
}
const pct = (key, p) => {
  const v = samples.map(s => s[key]).sort((a, b) => a - b);
  return +v[Math.min(v.length - 1, Math.ceil((p / 100) * v.length) - 1)].toFixed(1);
};
console.log(JSON.stringify({
  harness: 'evidence/<RUN_ID>/tools/measure-perf.mjs (reproducible measurement harness; run from the repository root)',
  measuredUtc: new Date().toISOString(),
  runtime: 'node worker_threads + occt-wasm 5.17.2 WASM',
  device: 'macOS 27.3 arm64, single thread',
  scenario: 'cold worker + cold WASM init, then concave L profile (5600 mm^2) extruded 12 mm, tessellated, STEP exported, disposed',
  runs: RUNS,
  samples,
  summary: {
    coldInitMs: {p50: pct('coldInitMs', 50), p95: pct('coldInitMs', 95)},
    firstBuildMs: {p50: pct('firstBuildMs', 50), p95: pct('firstBuildMs', 95)},
    tessellateMs: {p50: pct('tessellateMs', 50), p95: pct('tessellateMs', 95)},
    stepExportMs: {p50: pct('stepExportMs', 50), p95: pct('stepExportMs', 95)},
    totalMs: {p50: pct('totalMs', 50), p95: pct('totalMs', 95)},
  },
}, null, 2));
