import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildExactSolid,featureOrder} from '../src/evaluator.mjs';
import {createCadWorkerRuntime} from '../src/worker-runtime.mjs';
const base=JSON.parse(readFileSync(new URL('../../../samples/precision-block.cad.json',import.meta.url)));
const copy=x=>structuredClone(x);
/** Fake dependency only tests orchestration and error boundaries, not geometry precision. */
class FakeKernel {
  next=1; live=new Set(); calls=[];
  shape(v=1){const s={id:this.next++,v};this.live.add(s);return s;}
  makeBox(dx,dy,dz){return this.shape(dx*dy*dz)}
  makeCylinder(r,h){return this.shape(Math.PI*r*r*h)}
  translate(s,x,y,z){this.calls.push(['translate',x,y,z]);return this.shape(s.v)}
  cut(a,b){return this.shape(a.v-b.v)}
  fuse(a,b){return this.shape(a.v+b.v)}
  common(a,b){return this.shape(Math.min(a.v,b.v))}
  isValid(s){return s.v>0}
  getVolume(s){return s.v}
  subShapeCount(s,kind){return kind==='solid'?1:7}
  getBoundingBox(){return {xmin:0,ymin:0,zmin:0,xmax:120,ymax:60,zmax:30}}
  getSurfaceArea(){return 26104}
  tessellate(){return {positions:new Float32Array([0,0,0,1,0,0,0,1,0]),normals:new Float32Array(9),indices:new Uint32Array([0,1,2]),triangleCount:1}}
  exportStep(){return 'ISO-10303-21;\nEND-ISO-10303-21;'}
  release(s){this.live.delete(s)}
  releaseAll(){this.live.clear()}
}
test('order stable under shuffled features',()=>{
  assert.deepEqual(featureOrder(base).map(f=>f.id),['base','drill','result']);
  const d=copy(base);d.features.reverse();assert.deepEqual(featureOrder(d).map(f=>f.id),['base','drill','result']);
});
test('parameterRef changes the evaluated B-Rep volume',()=>{
  const k=new FakeKernel();const original=buildExactSolid(k,base);
  const d=copy(base);d.parameters.holeRadius.value=6;
  const updated=buildExactSolid(k,d);
  assert.ok(original.evidence.volumeMm3 > updated.evidence.volumeMm3);
  assert.ok(Math.abs((original.evidence.volumeMm3-updated.evidence.volumeMm3)-Math.PI*20*30)<0.001);
});
test('invalid references, unknown features, cycles fail closed',()=>{
  const d=copy(base);d.features[2].inputs=['base','missing'];assert.throws(()=>featureOrder(d),/missing/);
  const cyc=copy(base);cyc.features[2].inputs=['result','drill'];assert.throws(()=>featureOrder(cyc),/cycle/);
  const sk=copy(base);sk.features[0].type='sketch';assert.throws(()=>buildExactSolid(new FakeKernel(),sk),/not yet supported/i);
});
test('invalid bound dimension and unsupported fields fail',()=>{
  const d=copy(base);d.parameters.holeRadius.value=0;assert.throws(()=>featureOrder(d),/parameter/);
  const d2=copy(base);d2.features[0].nonsense=true;assert.throws(()=>buildExactSolid(new FakeKernel(),d2),/unsupported keys/);
});
test('runtime builds exact handle, transfers mesh/STEP, staleness and disposal',async()=>{
  const messages=[];const kernel=new FakeKernel();
  const runtime=createCadWorkerRuntime({loadKernel:async()=>kernel,send:(msg,transfers=[])=>messages.push({msg,transfers})});
  async function call(kind,rest={},id=`R_${messages.length+1}`){await runtime.handle({v:1,kind,requestId:id,...rest});const out=messages.at(-1).msg;assert.equal(out.requestId,id);return out;}
  const init=await call('init',{kernelBuildId:'occt-wasm-5.17.2'});assert.equal(init.result.ready,true);
  const built=await call('build',{generation:1,document:base});assert.equal(built.kind,'result');
  const geom=built.result.geometryId;assert.equal(built.result.evidence.solidCount,1);
  const mesh=await call('tessellate',{geometryId:geom,linearDeflectionMm:0.1,angularDeflectionRad:0.5});assert.equal(mesh.result.triangleCount,1);assert.equal(messages.at(-1).transfers.length,3);
  const step=await call('export-step',{geometryId:geom});assert.match(new TextDecoder().decode(step.result.bytes),/ISO-10303-21/);
  const bad=await call('build',{generation:1,document:base});assert.equal(bad.error.code,'STALE_GENERATION');
  const disposed=await call('dispose',{geometryId:geom});assert.equal(disposed.result.disposed,true);
  const after=await call('export-step',{geometryId:geom});assert.equal(after.error.code,'STALE_GEOMETRY');
  runtime.close();
});
test('invalid build invalidates previous arena and cannot leak stale geometry',async()=>{
  const out=[];const k=new FakeKernel();const rt=createCadWorkerRuntime({loadKernel:async()=>k,send:msg=>out.push(msg)});
  await rt.handle({v:1,requestId:'buildA',kind:'build',generation:1,document:base});const old=out.at(-1).result.geometryId;
  const d=copy(base);d.features[2].booleanOp='unknown';await rt.handle({v:1,requestId:'buildB',kind:'build',generation:2,document:d});assert.equal(out.at(-1).kind,'error');
  await rt.handle({v:1,requestId:'exportA',kind:'export-step',geometryId:old});assert.equal(out.at(-1).error.code,'STALE_GEOMETRY');rt.close();
});
