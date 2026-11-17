/** Real planegcs 1.3.0 + OCCT 5.17.2 in WASM; checks volumes not fake kernel calls. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {join} from 'node:path';import {createHash} from 'node:crypto';
import {Worker} from 'node:worker_threads';import {CadWorkerClient} from '../src/client.mjs';
import {createPlanegcsSolver} from '../../cad-sketch/src/planegcs.mjs';
import {solveSketch} from '../../cad-sketch/src/solver.mjs';
import {solvedProfileToCadDocument} from '../../cad-sketch/src/profile.mjs';
const file=n=>JSON.parse(readFileSync(new URL(`../../../samples/${n}.sketch.json`,import.meta.url)));
const binding=await createPlanegcsSolver();
test('real WASM profile: triangle, rotated rectangle, concave L exact volumes + STEP', {timeout:200_000},async()=>{
 const worker=new Worker(new URL('../src/node-worker.mjs',import.meta.url),{type:'module'}),client=new CadWorkerClient(worker,{timeoutMs:150_000});
 try{
  await client.initialize();
  for(const [name,h,expected] of [['triangle',10,60000],['rotated',10,8000],['concave',12,67200]]){
   const sketch=file(name),solved=await solveSketch(sketch,binding.createWrapper,{successStatus:binding.successStatus});
   assert.equal(solved.status,'fully_constrained',JSON.stringify(solved));assert.equal(solved.degreesOfFreedom,0);
   const doc=solvedProfileToCadDocument(sketch,solved,h);const result=await client.build(doc);
   assert.equal(result.evidence.solidCount,1);assert.ok(Math.abs(result.evidence.volumeMm3-expected)<0.001,`${name}: ${result.evidence.volumeMm3}, expected ${expected}`);
   const tess=await client.tessellate(result.geometryId);assert.ok(tess.triangleCount>0);
   const step=await client.exportStep(result.geometryId);assert.match(new TextDecoder().decode(step).slice(0,80),/ISO-10303-21/);
   // Optional: persist real WASM STEP bytes for an independent native OCP re-import (see
   // scripts/verify_profile_steps_with_native.py). Raw STEP stays out of Git by default.
   if(process.env.PROFILE_STEP_OUTPUT_DIR){
     const bytes=Buffer.from(step);mkdirSync(process.env.PROFILE_STEP_OUTPUT_DIR,{recursive:true});
     writeFileSync(join(process.env.PROFILE_STEP_OUTPUT_DIR,`${name}.step`),bytes);
     writeFileSync(join(process.env.PROFILE_STEP_OUTPUT_DIR,`${name}.evidence.json`),JSON.stringify({
       schemaVersion:1,profile:name,kernelBuildId:'occt-wasm-5.17.2',sketchId:sketch.sketchId,
       documentId:doc.documentId,documentRevision:doc.revision,
       pointsMm:doc.features[0].pointsMm,extrusionDepthMm:h,expectedVolumeMm3:expected,
       wasmEvidence:result.evidence,
       step:{file:`${name}.step`,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}},null,2));
   }
   await client.dispose(result.geometryId);
  }
 }finally{client.close()}
});
test('100 build+tessellate+dispose cycles release every geometry handle (steady-state drift reported)', {timeout:240_000},async()=>{
 const worker=new Worker(new URL('../src/node-worker.mjs',import.meta.url),{type:'module'}),client=new CadWorkerClient(worker,{timeoutMs:150_000});
 const doc=solvedProfileToCadDocument(file('triangle'),{sketchId:'TriangleSketch',sourceRevision:1,valid:true,status:'fully_constrained',points:file('triangle').points},10);
 const WARMUP=20,TOTAL=100;let finalVolume=0,baselineRss=0;
 try{
  await client.initialize();
  // Positive control: the invariant asserted below must be falsifiable, i.e. a live B-Rep
  // handle IS counted and dispose DOES clear it. Without this the loop assertion is vacuous.
  {const probe=structuredClone(doc);probe.revision=1;const built=await client.build(probe);
   const live=await client.stats();
   assert.equal(live.retainedGeometryCount,1,'stats must count a live geometry');
   assert.equal(live.activeGeometryId,built.geometryId,'stats must report the live geometry id');
   await client.dispose(built.geometryId);
   assert.equal((await client.stats()).retainedGeometryCount,0,'dispose must clear the retained count');}
  for(let i=0;i<TOTAL;i++){
   const d=structuredClone(doc);d.revision=i+1;
   const b=await client.build(d);finalVolume=b.evidence.volumeMm3;
   const mesh=await client.tessellate(b.geometryId,0.25,0.75);assert.ok(mesh.triangleCount>0);
   await client.dispose(b.geometryId);
   // Hard invariant: the OCCT arena must hold zero B-Rep handles once disposed. This is
   // checkable evidence; RSS is not.
   const s=await client.stats();
   assert.equal(s.retainedGeometryCount,0,`cycle ${i}: worker retained a geometry after dispose`);
   assert.equal(s.activeGeometryId,null,`cycle ${i}: worker kept an active geometry id`);
   if(i%20===0)await assert.rejects(()=>client.exportStep(b.geometryId),{code:'STALE_GEOMETRY'});
   if(i===WARMUP)baselineRss=process.memoryUsage().rss;
  }
  assert.ok(Math.abs(finalVolume-60000)<0.001);
 }finally{client.close();}
 /* Honest metric, deliberately weaker than "no leak": parent-process RSS sampled AFTER
    WARMUP cycles so one-time WASM instantiation and arena warm-up are excluded. It measures
    the JS/worker boundary drift only; it does NOT observe the OCCT arena inside the Worker,
    and it is JS-GC and allocator dependent, so no absolute threshold is asserted. */
 const driftMiB=(process.memoryUsage().rss-baselineRss)/1048576;
 console.log(`[memory] ${TOTAL} CAD-007 lifecycle cycles: 0 retained handles every cycle; parent RSS drift over the last ${TOTAL-WARMUP} cycles: ${driftMiB.toFixed(2)} MiB (post-init steady state, not a per-WASM-heap leak proof)`);
});
