import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {extractClosedProfile,solvedProfileToCadDocument,validateClosedProfile} from '../src/profile.mjs';
import {validateDocument} from '../../cad-core/src/command-engine.mjs';
const sample=n=>JSON.parse(readFileSync(new URL(`../../../samples/${n}.sketch.json`,import.meta.url)));
const solution=sk=>({sketchId:sk.sketchId,sourceRevision:sk.revision,valid:true,status:'fully_constrained',points:structuredClone(sk.points)});
test('triangle profile is actual triangle, not bounding rectangle',()=>{
  const s=sample('triangle');const r=extractClosedProfile(s,solution(s));assert.ok(Math.abs(r.areaMm2-6000)<1e-7);
  const doc=solvedProfileToCadDocument(s,solution(s),10);assert.equal(doc.features[0].type,'profile');assert.equal(doc.features[1].type,'extrude');assert.equal(doc.features[1].distanceMm.parameterRef,'extrusionDepth');assert.equal(doc.features[0].pointsMm.length,3);validateDocument(doc);
});
test('concave L profile preserves concavity',()=>{const s=sample('concave');const p=extractClosedProfile(s,solution(s));assert.ok(Math.abs(p.areaMm2-5600)<1e-7);validateDocument(solvedProfileToCadDocument(s,solution(s),12));});
test('rotated rectangle is not snapped to axis aligned bbox',()=>{const s=sample('rotated');const p=extractClosedProfile(s,solution(s));assert.ok(Math.abs(p.areaMm2-800)<1e-5);const doc=solvedProfileToCadDocument(s,solution(s),10);assert.ok(doc.features[0].pointsMm.some(p=>p[0]!==0&&p[1]!==0));});
test('shuffled lines still trace a single closed loop',()=>{const s=sample('concave');s.lines.reverse();assert.ok(Math.abs(extractClosedProfile(s,solution(s)).areaMm2-5600)<1e-7);});
test('reject self crossing and repeated vertices',()=>{assert.throws(()=>validateClosedProfile([[0,0],[4,4],[0,4],[4,0]]),/intersect/);assert.throws(()=>validateClosedProfile([[0,0],[4,0],[4,0],[0,4]]),/zero-length/);});
test('reject multiple contours, open loops, stale and undersolved',()=>{
 const s=sample('triangle');s.lines.pop();assert.throws(()=>extractClosedProfile(s,solution(s)),/cycle|profile|exactly|open|incident|single line/i);
 const fresh=sample('triangle');const stale=solution(fresh);stale.sourceRevision--;assert.throws(()=>extractClosedProfile(fresh,stale),/current fully/);
 const under=solution(fresh);under.status='underconstrained';assert.throws(()=>extractClosedProfile(fresh,under),/current fully/);
});
test('reject concave overlaps and repeated boundary contact',()=>{assert.throws(()=>validateClosedProfile([[0,0],[5,0],[5,5],[3,5],[3,2],[0,2],[0,3],[4,3],[4,4],[0,4]]),/intersect/)});
test('raw profile validation preserves winding sign and near-degenerate area fails closed',()=>{
  const clockwise=[[0,0],[0,4],[4,4],[4,0]];
  const raw=validateClosedProfile(clockwise);
  assert.ok(raw.signedAreaMm2<0,'raw validation must report the signed (here negative) area');
  assert.ok(Math.abs(raw.areaMm2-16)<1e-9);
  // The derived CAD profile is always normalised to CCW for a stable B-Rep face orientation.
  for(const name of ['triangle','rotated','concave']){
    const s=sample(name);const doc=solvedProfileToCadDocument(s,solution(s),10);
    const area=doc.features[0].pointsMm.reduce((a,p,i,arr)=>{const q=arr[(i+1)%arr.length];return a+p[0]*q[1]-p[1]*q[0];},0)/2;
    assert.ok(area>0,`${name}: derived profile must be CCW`);
  }
  // A sub-1e-8 mm^2 sliver must fail closed instead of building a degenerate face.
  assert.throws(()=>validateClosedProfile([[0,0],[4,0],[4,1e-9],[0,1e-9]]),/degenerate|zero-length|intersect/i);
});
