import test from 'node:test';import assert from 'node:assert/strict';
import {LocalCadHistory} from '../src/local-history.mjs';
import {readFileSync} from 'node:fs';
const seed=JSON.parse(readFileSync(new URL('../../../samples/precision-block.cad.json',import.meta.url)));
test('immutable revisions, undo/redo, branching and stale write rejection',()=>{
 const h=new LocalCadHistory(seed);const orig=h.current;const next=structuredClone(orig);next.revision++;next.parameters.holeRadius.value=6;
 const committed=h.record(next,{expectedRevision:orig.revision});assert.equal(committed.revision,next.revision);
 next.parameters.holeRadius.value=42;assert.equal(h.current.parameters.holeRadius.value,6);
 const undo=h.undo();undo.parameters.holeRadius.value=99;assert.equal(h.current.parameters.holeRadius.value,4);
 assert.equal(h.redo().parameters.holeRadius.value,6);assert.equal(h.canRedo,false);
 h.undo();const branched=h.current;branched.revision++;branched.parameters.holeRadius.value=5;
 h.record(branched,{expectedRevision:orig.revision});assert.equal(h.canRedo,false);
 assert.throws(()=>h.record(next,{expectedRevision:orig.revision}),{code:'REVISION_CONFLICT'});
});
