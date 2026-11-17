import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {buildExactSolid} from '../src/evaluator.mjs';
import {solvedProfileToCadDocument} from '../../cad-sketch/src/profile.mjs';
const load=n=>JSON.parse(readFileSync(new URL(`../../../samples/${n}.sketch.json`,import.meta.url)));
class TraceKernel {
  calls=[];next=1;live=new Set();
  handle(type,area=0){const s={type,area,id:this.next++};this.live.add(s);return s;}
  makeLineEdge(a,b){this.calls.push(['edge',a,b]);return this.handle('edge')}
  makeWire(edges){this.calls.push(['wire',edges.length]);return this.handle('wire')}
  makeFace(wire){this.calls.push(['face']);return this.handle('face')}
  extrude(face,x,y,z){this.calls.push(['extrude',z]);return this.handle('solid',z)}
  release(s){this.live.delete(s)}
  releaseAll(){this.live.clear()}
  isValid(){return true}
  subShapeCount(s,k){return k==='solid'?(s.type==='solid'?1:0):5}
  getVolume(s){return s.type==='solid'?s.area:0.1}
  getBoundingBox(){return {xmin:0,ymin:0,zmin:0,xmax:100,ymax:120,zmax:10}}
  getSurfaceArea(){return 10}
}
const makeDoc=(name,thick=10)=>{const sk=load(name);return solvedProfileToCadDocument(sk,{sketchId:sk.sketchId,sourceRevision:sk.revision,valid:true,status:'fully_constrained',points:sk.points},thick)};
test('extrude is a real OCCT edge->wire->face->prism chain, never bounding box',()=>{
 const k=new TraceKernel(),r=buildExactSolid(k,makeDoc('triangle'));
 assert.deepEqual(k.calls.map(c=>c[0]),['edge','edge','edge','wire','face','extrude']);
 assert.deepEqual(r.order,['SolvedProfile','ExtrudedSolid']);assert.equal(r.evidence.solidCount,1);
 assert.equal(k.live.size,2,'face and final solid persist until worker releaseAll');
 k.releaseAll();assert.equal(k.live.size,0);
});
test('concave profile uses all edges',()=>{const k=new TraceKernel();buildExactSolid(k,makeDoc('concave'));assert.equal(k.calls.filter(c=>c[0]==='edge').length,6);});
test('invalid profile never enters exact kernel',()=>{const doc=makeDoc('triangle');doc.features[0].pointsMm=[[0,0],[20,20],[0,20],[20,0]];const k=new TraceKernel();assert.throws(()=>buildExactSolid(k,doc),/intersect/);assert.equal(k.calls.length,0);});
