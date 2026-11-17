import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {createPlanegcsSolver} from '../src/planegcs.mjs';import {solveSketch,solvedRectangleToCadDocument} from '../src/solver.mjs';
const fixture=name=>JSON.parse(readFileSync(new URL(`../../../samples/${name}.sketch.json`,import.meta.url)));
const binding=await createPlanegcsSolver();
test('real planegcs WASM: rectangle 120x60 has zero DOF and creates exact CAD document',async()=>{
  const sketch=fixture('rectangle');const r=await solveSketch(sketch,binding.createWrapper,{successStatus:binding.successStatus});
  assert.equal(r.status,'fully_constrained',JSON.stringify(r));assert.equal(r.degreesOfFreedom,0);assert.ok(r.maxResidualMm<1e-6);
  const cad=solvedRectangleToCadDocument(sketch,r,30);
  assert.ok(Math.abs(cad.features[0].sizeMm[0]-120)<1e-5);assert.ok(Math.abs(cad.features[0].sizeMm[1]-60)<1e-5);assert.equal(cad.features[0].sizeMm[2],30);
});
test('real planegcs WASM: underconstrained sketch is identified',async()=>{
  const sketch=fixture('rectangle-underconstrained');const r=await solveSketch(sketch,binding.createWrapper,{successStatus:binding.successStatus});
  assert.equal(r.status,'underconstrained',JSON.stringify(r));assert.equal(r.degreesOfFreedom,1);assert.throws(()=>solvedRectangleToCadDocument(sketch,r),/fully constrained/);
});
test('real planegcs WASM: contradictory dimension does not produce successful profile',async()=>{
  const sketch=fixture('rectangle-conflict');const r=await solveSketch(sketch,binding.createWrapper,{successStatus:binding.successStatus});
  assert.equal(r.valid,false,JSON.stringify(r));assert.equal(r.status,'conflicting');
});
test('real planegcs WASM: change dimension to 150 updates solved width',async()=>{
  const sketch=fixture('rectangle');sketch.revision=2;sketch.constraints.find(c=>c.id==='Width120').value=150;
  const r=await solveSketch(sketch,binding.createWrapper,{successStatus:binding.successStatus});assert.equal(r.status,'fully_constrained',JSON.stringify(r));
  const cad=solvedRectangleToCadDocument(sketch,r,30);assert.ok(Math.abs(cad.features[0].sizeMm[0]-150)<1e-5);
});
