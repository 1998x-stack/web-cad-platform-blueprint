import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument, previewTransaction, commitLocalPreview, hashDocument, CadDomainError} from '../src/command-engine.mjs';

const sketch = (id='sketch_1') => ({id, type:'sketch', inputs:[], plane:'XY', entities:[], constraints:[]});
const extrude = (id='extrude_1', input='sketch_1', distanceMm=20) => ({id,type:'extrude', inputs:[input], distanceMm});
const tx = (doc, commands, id='tx_1') => ({transactionId:id,expectedRevision:doc.revision,commands});
function expectCode(fn,code) { assert.throws(fn,err => err instanceof CadDomainError && err.code === code); }

test('creates document with exact initial revision and mm unit', () => {
  const doc=createDocument();
  assert.equal(doc.revision,0);
  assert.equal(doc.units,'mm');
});

test('preview is pure and commit increments revision exactly once', () => {
  const doc=createDocument();
  const p=previewTransaction(doc,tx(doc,[{op:'feature.add',feature:sketch()},{op:'feature.add',feature:extrude()}]));
  assert.equal(doc.features.length,0);
  assert.equal(doc.revision,0);
  assert.equal(p.candidateDocument.features.length,2);
  assert.equal(p.geometryValidated,false);
  expectCode(() => commitLocalPreview(doc,p), 'APPROVAL_REQUIRED');
  const committed=commitLocalPreview(doc,p,{approved:true});
  assert.equal(committed.revision,1);
  assert.equal(committed.features[1].inputs[0],'sketch_1');
  assert.equal(doc.revision,0);
});

test('stale transaction and stale preview cannot commit',()=>{
  const doc=createDocument();
  expectCode(()=>previewTransaction(doc,{transactionId:'tx',expectedRevision:3,commands:[{op:'feature.add',feature:sketch()}]}),'REVISION_CONFLICT');
  const p=previewTransaction(doc,tx(doc,[{op:'feature.add',feature:sketch()}]));
  const next=commitLocalPreview(doc,p,{approved:true});
  expectCode(()=>commitLocalPreview(next,p,{approved:true}),'REVISION_CONFLICT');
});

test('nonexistent dependency causes atomic rejection',()=>{
  const doc=createDocument();
  expectCode(()=>previewTransaction(doc,tx(doc,[{op:'feature.add',feature:extrude()}])),'MISSING_DEPENDENCY');
  assert.equal(doc.features.length,0);
});

test('cannot remove feature with a dependent',()=>{
  const doc=createDocument();
  const p=previewTransaction(doc,tx(doc,[{op:'feature.add',feature:sketch()},{op:'feature.add',feature:extrude()}]));
  const next=commitLocalPreview(doc,p,{approved:true});
  expectCode(()=>previewTransaction(next,tx(next,[{op:'feature.remove',id:'sketch_1'}],'tx_2')),'FEATURE_IN_USE');
});

test('invalid second command rolls entire preview back',()=>{
  const doc=createDocument();
  expectCode(()=>previewTransaction(doc,tx(doc,[
    {op:'feature.add',feature:sketch()},
    {op:'feature.add',feature:extrude('extrude_1','missing')}
  ])),'MISSING_DEPENDENCY');
  assert.equal(doc.revision,0);
  assert.equal(doc.features.length,0);
});

test('cyclic boolean dependency is rejected',()=>{
  const doc=createDocument();
  expectCode(()=>previewTransaction(doc,tx(doc,[
    {op:'feature.add',feature:sketch()},
    {op:'feature.add',feature:extrude()},
    {op:'feature.add',feature:{id:'body_a',type:'boolean',inputs:['extrude_1','body_b'],booleanOp:'union'}},
    {op:'feature.add',feature:{id:'body_b',type:'boolean',inputs:['extrude_1','body_a'],booleanOp:'cut'}}
  ])),'CYCLE_DETECTED');
});

test('invalid types, unsafe parameter names and NaN are rejected',()=>{
  const doc=createDocument();
  expectCode(()=>previewTransaction(doc,tx(doc,[{op:'parameter.set',name:'__proto__',kind:'length',value:10}])),'INVALID_INPUT');
  expectCode(()=>previewTransaction(doc,tx(doc,[{op:'parameter.set',name:'width',kind:'length',value:NaN}])),'INVALID_INPUT');
  expectCode(()=>previewTransaction(doc,tx(doc,[{op:'feature.add',feature:extrude('e','sketch_1',-2)}])),'INVALID_INPUT');
  expectCode(()=>previewTransaction(doc,tx(doc,[{op:'unknown'}])),'UNSUPPORTED_COMMAND');
});

test('candidate document hash is stable under dictionary key order',()=>{
  const a=createDocument(); const b={...a,parameters:{}};
  assert.equal(hashDocument(a),hashDocument(b));
});
