/**
 * Local measurement harness (reproducible measurement harness; run from the repository root).
 * Reuses the repository's real modules to print full-precision measured values so the
 * evidence report contains observed numbers instead of asserted ones. Run with:
 *   node evidence/<RUN_ID>/tools/measure-profiles.mjs
 */
import {readFileSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import {CadWorkerClient} from '../../../packages/cad-geometry/src/client.mjs';
import {createPlanegcsSolver} from '../../../packages/cad-sketch/src/planegcs.mjs';
import {solveSketch} from '../../../packages/cad-sketch/src/solver.mjs';
import {solvedProfileToCadDocument} from '../../../packages/cad-sketch/src/profile.mjs';

const file = n => JSON.parse(readFileSync(new URL(`../../../samples/${n}.sketch.json`, import.meta.url)));
const binding = await createPlanegcsSolver();
const worker = new Worker(new URL('../../../packages/cad-geometry/src/node-worker.mjs', import.meta.url), {type: 'module'});
const client = new CadWorkerClient(worker, {timeoutMs: 150_000});
const out = {kernel: 'occt-wasm 5.17.2 (node worker_threads)', measuredUtc: new Date().toISOString(), cases: []};
try {
  await client.initialize();
  for (const [name, depth, expected] of [['triangle', 10, 60000], ['rotated', 10, 8000], ['concave', 12, 67200]]) {
    const sketch = file(name);
    const solved = await solveSketch(sketch, binding.createWrapper, {successStatus: binding.successStatus});
    const doc = solvedProfileToCadDocument(sketch, solved, depth);
    const built = await client.build(doc);
    const e = built.evidence;
    const step = await client.exportStep(built.geometryId);
    const stats = await client.stats();
    out.cases.push({
      id: name, sketchId: doc.features[0].sourceSketchId,
      solverStatus: solved.status, degreesOfFreedom: solved.degreesOfFreedom,
      constraintCount: (sketch.constraints ?? []).length,
      fixedPoints: sketch.points.filter(p => p.fixed).length,
      totalPoints: sketch.points.length,
      depthMm: depth,
      measuredVolumeMm3: e.volumeMm3, expectedVolumeMm3: expected,
      absErrMm3: Math.abs(e.volumeMm3 - expected),
      measuredSolidCount: e.solidCount, measuredValid: e.valid, measuredFaceCount: e.faceCount,
      measuredBboxMm: e.bboxMm,
      stepBytes: step.byteLength,
      stepIsIso10303: new TextDecoder().decode(step).startsWith('ISO-10303-21'),
      retainedAfterBuild: stats.retainedGeometryCount,
    });
    await client.dispose(built.geometryId);
  }
} finally {
  client.close();
}
console.log(JSON.stringify(out, null, 2));
