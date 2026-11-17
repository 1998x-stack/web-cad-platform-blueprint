import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateDocument, previewTransaction, CadDomainError } from '../src/command-engine.mjs';

const fixture = JSON.parse(readFileSync(new URL('../../../samples/precision-block.cad.json', import.meta.url),'utf8'));

test('CAD-004 fixture is accepted by canonical document validator', () => {
  assert.equal(validateDocument(fixture), true);
});

test('CAD-004 primitive dimensions must be positive and coordinates finite', () => {
  for (const invalid of [0,-1,Number.NaN]) {
    const doc = structuredClone(fixture);
    doc.features[0].sizeMm[1] = invalid;
    assert.throws(() => validateDocument(doc), e => e instanceof CadDomainError && e.code === 'INVALID_INPUT');
  }
});

test('changing a hole radius is a revisioned typed transaction (not geometry evaluation)', () => {
  const tx = {
    transactionId:'change_hole_radius_1', expectedRevision:1,
    commands:[{op:'feature.update',id:'drill',patch:{radiusMm:6}}]
  };
  const preview = previewTransaction(fixture,tx);
  assert.equal(preview.candidateDocument.features[1].radiusMm,6);
  assert.equal(preview.candidateDocument.revision,2);
  assert.equal(preview.geometryValidated,false);
  assert.deepEqual(fixture.features[1].radiusMm,{parameterRef:'holeRadius'});
});


test('typed parameter.set changes geometry input without mutating feature', () => {
  const p=previewTransaction(fixture,{transactionId:'holeRadius_tx',expectedRevision:1,
    commands:[{op:'parameter.set',name:'holeRadius',kind:'length',value:6}]});
  assert.equal(p.candidateDocument.parameters.holeRadius.value,6);
  assert.deepEqual(p.candidateDocument.features[1].radiusMm,{parameterRef:'holeRadius'});
  assert.equal(fixture.parameters.holeRadius.value,4);
});

test('missing or wrong-kind parameter reference fails closed', () => {
  const missing=structuredClone(fixture);
  missing.features[1].radiusMm={parameterRef:'nonexistent'};
  assert.throws(() => validateDocument(missing),e=>e instanceof CadDomainError && e.code==='MISSING_PARAMETER');
  const wrong=structuredClone(fixture);
  wrong.parameters.holeRadius.kind='angle';
  assert.throws(() => validateDocument(wrong),e=>e instanceof CadDomainError && e.code==='INVALID_PARAMETER_KIND');
});

test('outputBodyId references a valid solid and cannot be removed', () => {
  const bad=structuredClone(fixture);bad.outputBodyId='unknown';
  assert.throws(()=>validateDocument(bad),e=>e instanceof CadDomainError && e.code==='MISSING_DEPENDENCY');
  const tx={transactionId:'rm_body',expectedRevision:1,commands:[{op:'feature.remove',id:'result'}]};
  assert.throws(()=>previewTransaction(fixture,tx),e=>e instanceof CadDomainError && e.code==='FEATURE_IN_USE');
});

test('array order cannot change deterministic dependency evaluation', async () => {
  const {evaluationOrder}=await import('../src/command-engine.mjs');
  const shuffled=structuredClone(fixture);shuffled.features.reverse();
  assert.equal(validateDocument(shuffled),true);
  assert.deepEqual(evaluationOrder(shuffled),evaluationOrder(fixture));
  assert.equal(evaluationOrder(shuffled).at(-1),'result');
});

test('output.set is a revisioned command and valid only for solid body', () => {
  const d=structuredClone(fixture);
  const p=previewTransaction(d,{transactionId:'select_body',expectedRevision:1,commands:[{op:'output.set',featureId:'base'}]});
  assert.equal(p.candidateDocument.outputBodyId,'base');
  assert.equal(d.outputBodyId,'result');
});
