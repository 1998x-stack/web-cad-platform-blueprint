import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateSketch,toPlanegcs,SketchError} from '../src/validation.mjs';
import {sketchDegreesOfFreedom,solvedRectangleToCadDocument} from '../src/solver.mjs';
const fixture=JSON.parse(readFileSync(new URL('../../../samples/rectangle.sketch.json',import.meta.url)));
test('validate canonical sketch and stable numeric IDs',()=>{
  const x=structuredClone(fixture);const v=validateSketch(x);assert.equal(v.points.size,4);
  const p=toPlanegcs(x);assert.equal(p.primitives.length,14);assert.deepEqual(p.primitives.at(-2),{id:'13',type:'p2p_distance',p1_id:'1',p2_id:'2',distance:120});assert.equal(p.reverse.get('14'),'Height60');
});
test('reject malformed sketch before solver is started',()=>{
  for(const change of [s=>s.points.push({...s.points[0]}),s=>s.points[1].x=Infinity,s=>s.lines[0].end='Unknown',s=>s.constraints[0].foo='unsafe',s=>s.constraints[1].line='constructor',s=>s.constraints[0].type='unsupported']){
    const s=structuredClone(fixture);change(s);assert.throws(()=>validateSketch(s),SketchError);
  }
});
test('independent rank check: rectangle has zero DOF and removing height gives 1',()=>{
  const pts=new Map(fixture.points.map(p=>[p.id,p]));const cs=new Map();
  assert.equal(sketchDegreesOfFreedom(fixture,pts,cs).degreesOfFreedom,0);
  const under=structuredClone(fixture);under.constraints.pop();assert.equal(sketchDegreesOfFreedom(under,pts,cs).degreesOfFreedom,1);
});
test('closed profile converter rejects invalid/outdated/underconstrained geometry',()=>{
  const s=structuredClone(fixture);const result={status:'fully_constrained',valid:true,sourceRevision:s.revision,points:[{id:'P0',x:0,y:0},{id:'P1',x:120,y:0},{id:'P2',x:120,y:60},{id:'P3',x:0,y:60}]};
  const cad=solvedRectangleToCadDocument(s,result,30);assert.deepEqual(cad.features[0].sizeMm,[120,60,30]);
  assert.throws(()=>solvedRectangleToCadDocument(s,{...result,status:'underconstrained'},30),/fully constrained/);
  assert.throws(()=>solvedRectangleToCadDocument(s,{...result,sourceRevision:10},30),/fully constrained/);
  assert.throws(()=>solvedRectangleToCadDocument(s,{...result,points:[...result.points.slice(0,3),{id:'P3',x:40,y:50}]},30),/orthogonal/);
  const crossed=[{id:'P0',x:0,y:0},{id:'P1',x:120,y:60},{id:'P2',x:120,y:0},{id:'P3',x:0,y:60}];
  assert.throws(()=>solvedRectangleToCadDocument(s,{...result,points:crossed},30),/diagonals/);
});
