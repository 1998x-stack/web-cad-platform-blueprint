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
  assert.equal(fixture.features[1].radiusMm,4);
});
