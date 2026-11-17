/** G0 memory evidence: the Worker-local WASM linear heap and the raw OCCT arena handle
 *  count, measured where the kernel actually lives (inside the Worker) — NOT parent RSS.
 *
 *  `retainedGeometryCount` is only logical (`active ? 1 : 0`). This suite additionally reads:
 *   - `wasmHeapBytes`  = Emscripten/WASM linear-memory reservation. It grows and never shrinks,
 *                        so it is reported as a high-water reservation, never as live bytes.
 *   - `rawShapeCount`  = raw OCCT arena handle count (an object count, not bytes). It is the
 *                        real "did the arena actually release" signal.
 *
 *  A deliberately unreleased-geometry control proves the measurement detects a broken lifecycle,
 *  and a fresh-Worker reuse probe proves stale handles fail closed across reinitialization. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {CadWorkerClient} from '../src/client.mjs';

const KERNEL='occt-wasm-5.17.2';
const PAGE=65536;                 // WebAssembly linear-memory page size
const WARMUP=20, MEASURED=100;    // G0.2 asks for >=100 measured build/tessellate/export/dispose cycles
const MiB=1048576;
const base=JSON.parse(readFileSync(new URL('../../../samples/precision-block.cad.json',import.meta.url)));
const freshClient=()=>new CadWorkerClient(new Worker(new URL('../src/node-worker.mjs',import.meta.url),{type:'module'}),{timeoutMs:150_000});
const slope=samples=>{                       // least-squares slope in bytes/cycle
  const n=samples.length;if(n<2)return 0;
  const mx=(n-1)/2,my=samples.reduce((a,b)=>a+b,0)/n;let num=0,den=0;
  for(let i=0;i<n;i++){num+=(i-mx)*(samples[i]-my);den+=(i-mx)**2;}return den?num/den:0;
};

test('stats exposes the real Worker-local WASM heap reservation and arena handle count', {timeout:200_000}, async()=>{
  const client=freshClient();
  try{
    await client.initialize();
    const s=await client.stats();
    assert.ok(Number.isInteger(s.wasmHeapBytes)&&s.wasmHeapBytes>0,'heap bytes must be a positive integer');
    assert.equal(s.wasmHeapBytes%PAGE,0,'WASM linear memory is a whole number of 64 KiB pages');
    assert.equal(s.rawShapeCount,0,'a freshly initialised kernel must hold zero arena handles');
    assert.equal(s.retainedGeometryCount,0);
  }finally{client.close();}
});

test('100+ build/tessellate/export/dispose cycles keep the arena empty and the heap reservation bounded', {timeout:300_000}, async()=>{
  const client=freshClient();
  const heapSamples=[],rawAfterDispose=[];
  let afterInit=0,afterWarmup=0,parentRssAfterWarmup=0;
  try{
    await client.initialize();
    afterInit=(await client.stats()).wasmHeapBytes;
    for(let i=0;i<WARMUP+MEASURED;i++){
      const d=structuredClone(base);d.revision=i+1;
      const built=await client.build(d);
      const mesh=await client.tessellate(built.geometryId,0.25,0.75);
      assert.ok(mesh.triangleCount>0,`cycle ${i}: empty tessellation`);
      const step=await client.exportStep(built.geometryId);
      assert.match(new TextDecoder().decode(step).slice(0,40),/ISO-10303-21/,`cycle ${i}: STEP header`);
      await client.dispose(built.geometryId);
      const s=await client.stats();
      // Logical bookkeeping AND the real arena counter must both return to zero.
      assert.equal(s.retainedGeometryCount,0,`cycle ${i}: logical geometry leaked`);
      assert.equal(s.activeGeometryId,null,`cycle ${i}: active id retained`);
      assert.equal(s.rawShapeCount,0,`cycle ${i}: OCCT arena retained ${s.rawShapeCount} handle(s) after dispose`);
      if(i===WARMUP-1){afterWarmup=s.wasmHeapBytes;parentRssAfterWarmup=process.memoryUsage().rss;}
      if(i>=WARMUP){heapSamples.push(s.wasmHeapBytes);rawAfterDispose.push(s.rawShapeCount);}
    }
    assert.equal(heapSamples.length,MEASURED);
  }finally{client.close();}
  const highWater=Math.max(afterInit,...heapSamples);
  const netAfterWarmup=heapSamples.at(-1)-afterWarmup;             // signed: negative means shrink (should not happen)
  const parentRssDriftMiB=(process.memoryUsage().rss-parentRssAfterWarmup)/MiB;
  const report={
    schemaVersion:1,kernelBuildId:KERNEL,pageSizeBytes:PAGE,
    warmupCycles:WARMUP,measuredCycles:MEASURED,
    heapReservationBytes:{afterInit,afterWarmup,first:heapSamples[0],last:heapSamples.at(-1),
      min:Math.min(...heapSamples),max:Math.max(...heapSamples),highWater,netAfterWarmup,
      slopeBytesPerCycle:Number(slope(heapSamples).toFixed(3))},
    rawArenaHandlesAfterDispose:{max:Math.max(...rawAfterDispose),values:rawAfterDispose},
    parentProcessRssMiB:{afterWarmup:Number((parentRssAfterWarmup/MiB).toFixed(2)),drift:Number(parentRssDriftMiB.toFixed(2))},
    limitations:[
      'wasmHeapBytes is a linear-memory reservation: it grows and never shrinks, so it is a high-water mark, not a live-allocation measurement.',
      'rawShapeCount counts OCCT arena handles (objects), not bytes, and cannot see allocations made on the C++ heap outside the arena.',
      'No native byte-level allocation counter is exposed by occt-wasm 5.17.2; a true "zero native leak" claim is therefore NOT VERIFIED.',
      'parentProcessRssMiB measures the parent JS process only and is GC/allocator dependent; it is reported for contrast, not asserted.']
  };
  if(process.env.WORKER_MEMORY_REPORT){mkdirSync(dirname(process.env.WORKER_MEMORY_REPORT),{recursive:true});writeFileSync(process.env.WORKER_MEMORY_REPORT,JSON.stringify(report,null,2));}
  // Assert only what is actually observable. A ~0 net reservation change over the steady state is
  // a real, checkable fact; it is deliberately weaker than a zero-leak guarantee.
  assert.equal(report.rawArenaHandlesAfterDispose.max,0,'arena must be empty after every dispose');
  assert.ok(netAfterWarmup<=0.05*afterWarmup,`heap reservation grew ${netAfterWarmup} bytes after warm-up`);
  console.log('[worker-memory] heap reservation bytes: init=%d warm=%d high=%d last=%d net(after warm)=%d slope=%s B/cycle; arena handles after dispose: max=%d; parent RSS drift=%s MiB',
    afterInit,afterWarmup,highWater,heapSamples.at(-1),netAfterWarmup,report.heapReservationBytes.slopeBytesPerCycle,report.rawArenaHandlesAfterDispose.max,report.parentProcessRssMiB.drift);
});

test('negative control: the measurement detects an unreleased B-Rep handle and dispose clears it', {timeout:150_000}, async()=>{
  const client=freshClient();
  try{
    await client.initialize();
    // Release-nothing control: build and DO NOT dispose. If dispose/release were broken, the
    // arena counter below would stay elevated and every cycle assertion in the loop test would fail.
    const built=await client.build(structuredClone(base));
    const leaked=await client.stats();
    assert.ok(leaked.rawShapeCount>0,'an undisposed build MUST show live arena handles (proves the counter is falsifiable)');
    assert.equal(leaked.retainedGeometryCount,1,'logical counter must also see the undisposed geometry');
    await client.dispose(built.geometryId);
    const cleared=await client.stats();
    assert.equal(cleared.rawShapeCount,0,'dispose must empty the OCCT arena');
    assert.equal(cleared.retainedGeometryCount,0);
    await assert.rejects(()=>client.exportStep(built.geometryId),{code:'STALE_GEOMETRY'});
  }finally{client.close();}
});

test('reinitialization does not reuse an invalid geometry handle', {timeout:150_000}, async()=>{
  const first=freshClient();
  let staleId;
  try{await first.initialize();staleId=(await first.build(structuredClone(base))).geometryId;}
  finally{first.close();}
  const second=freshClient();
  try{
    await second.initialize();
    const s=await second.stats();
    assert.equal(s.rawShapeCount,0,'a new Worker must start with an empty arena');
    assert.equal(s.activeGeometryId,null);
    // A geometry id minted by a terminated Worker must never resolve in the new one.
    await assert.rejects(()=>second.exportStep(staleId),{code:'STALE_GEOMETRY'});
    await assert.rejects(()=>second.dispose(staleId),{code:'STALE_GEOMETRY'});
    const ok=await second.build(structuredClone(base));
    assert.ok((await second.stats()).rawShapeCount>0);
    await second.dispose(ok.geometryId);
  }finally{second.close();}
});
