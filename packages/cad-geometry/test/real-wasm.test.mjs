/** Real (not mocked) OCCT WASM runs inside a dedicated Node worker; browser E2E separately. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {readFileSync,writeFileSync} from 'node:fs';
import {CadWorkerClient} from '../src/client.mjs';
const base=JSON.parse(readFileSync(new URL('../../../samples/precision-block.cad.json',import.meta.url)));
const reference=JSON.parse(readFileSync(new URL('../../../samples/precision-block.evidence.json',import.meta.url)));
function closeEnough(a,b,tolerance,label){assert.ok(Math.abs(a-b)<=tolerance,`${label}: ${a} vs ${b}, tolerance ${tolerance}`)}
test('real WASM worker: build, compare native, mesh, STEP roundtrip, parametric revision, disposal', {timeout:150_000}, async()=>{
  const worker=new Worker(new URL('../src/node-worker.mjs',import.meta.url),{type:'module'});
  const client=new CadWorkerClient(worker,{timeoutMs:120_000});
  try{
    const init=await client.initialize();assert.equal(init.runtime,'WASM');
    const out=await client.build(base);assert.equal(out.evidence.valid,true);assert.equal(out.evidence.solidCount,1);
    closeEnough(out.evidence.volumeMm3,reference.source.volume_mm3,1e-3,'volume mm3');
    closeEnough(out.evidence.surfaceAreaMm2,2*(120*60+120*30+60*30)-2*Math.PI*4*4+2*Math.PI*4*30,1e-3,'analytical surface area mm2');
    for(let i=0;i<6;i++)closeEnough(out.evidence.bboxMm[i],reference.source.bbox_mm[i],1e-4,`bbox[${i}]`);
    const mesh=await client.tessellate(out.geometryId);assert.ok(mesh.indices.length>12);assert.equal(mesh.sourceDocumentRevision,base.revision);
    const bytes=await client.exportStep(out.geometryId);if(process.env.WASM_STEP_OUTPUT)writeFileSync(process.env.WASM_STEP_OUTPUT,bytes);assert.match(new TextDecoder().decode(bytes).slice(0,200),/ISO-10303-21/);
    const changed=structuredClone(base);changed.revision=base.revision+1;changed.parameters.holeRadius.value=6;
    const newer=await client.build(changed);assert.ok(newer.evidence.volumeMm3<out.evidence.volumeMm3);
    closeEnough(newer.evidence.volumeMm3,212607.079934123,1e-3,'parametric volume');
    await assert.rejects(()=>client.exportStep(out.geometryId),{code:'STALE_GEOMETRY'});
    await client.dispose(newer.geometryId);
    await assert.rejects(()=>client.exportStep(newer.geometryId),{code:'STALE_GEOMETRY'});
  }finally{client.close();}
});
