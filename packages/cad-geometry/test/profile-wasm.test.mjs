/** Real planegcs 1.3.0 + OCCT 5.17.2 in WASM; checks volumes not fake kernel calls. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
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
   await client.dispose(result.geometryId);
  }
 }finally{client.close()}
});
test('100 build+tessellate+dispose cycles reject stale handles and report RSS', {timeout:240_000},async()=>{
 const worker=new Worker(new URL('../src/node-worker.mjs',import.meta.url),{type:'module'}),client=new CadWorkerClient(worker,{timeoutMs:150_000});
 const doc=solvedProfileToCadDocument(file('triangle'),{sketchId:'TriangleSketch',sourceRevision:1,valid:true,status:'fully_constrained',points:file('triangle').points},10);
 const rss0=process.memoryUsage().rss;let finalVolume=0;
 try{
  await client.initialize();
  for(let i=0;i<100;i++){
   const d=structuredClone(doc);d.revision=i+1;
   const b=await client.build(d);finalVolume=b.evidence.volumeMm3;
   const mesh=await client.tessellate(b.geometryId,0.25,0.75);assert.ok(mesh.triangleCount>0);
   await client.dispose(b.geometryId);
   if(i%20===0)await assert.rejects(()=>client.exportStep(b.geometryId),{code:'STALE_GEOMETRY'});
  }
  assert.ok(Math.abs(finalVolume-60000)<0.001);
 }finally{client.close();}
 console.log(`100 CAD-007 lifecycle cycles completed, parent RSS delta: ${(process.memoryUsage().rss-rss0)/1048576} MiB (not a per-WASM heap proof)`);
});
