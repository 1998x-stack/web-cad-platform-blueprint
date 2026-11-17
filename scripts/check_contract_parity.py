#!/usr/bin/env python3
"""Proof of parity on P0 solid subset: JSON Schema, JS transactions, native OCCT.
Does not certify full Sketch/Extrude, browser WASM, or synthetic STEP inputs.
"""
import copy
import json
import subprocess
import sys
from pathlib import Path
from jsonschema import Draft202012Validator

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'packages/cad-geometry-python/src'))
from cad_geometry.kernel import build, evidence, GeometryError, _evaluation_order

base=json.loads((ROOT/'samples/precision-block.cad.json').read_text())
fixtures=[]
def add(name, mutation, valid):
    d=copy.deepcopy(base)
    mutation(d)
    fixtures.append((name,d,valid))
add('base',lambda d:None,True)
add('reversed DAG',lambda d:d['features'].reverse(),True)
add('parameter radius 6',lambda d:d['parameters']['holeRadius'].update(value=6),True)
add('output base',lambda d:d.update(outputBodyId='base'),True)
add('extra unrelated primitive',lambda d:d['features'].append({'id':'zzz','type':'box','inputs':[],'originMm':[300,0,0],'sizeMm':[5,5,5]}),True)
add('missing input',lambda d:d['features'][2].update(inputs=['base','not_found']),False)
add('duplicate feature',lambda d:d['features'][1].update(id='base'),False)
add('cycle',lambda d:d['features'][2].update(inputs=['result','base']),False)
add('wrong length kind',lambda d:d['parameters']['holeRadius'].update(kind='angle'),False)
add('missing parameter',lambda d:d['features'][1].update(radiusMm={'parameterRef':'missing'}),False)
add('nonfinite dimension',lambda d:d['features'][0].update(sizeMm=[120,float('nan'),30]),False)
add('negative dimension',lambda d:d['features'][0].update(sizeMm=[120,-1,30]),False)
add('unknown feature property',lambda d:d['features'][0].update(arbitrary='bad'),False)
add('unknown root property',lambda d:d.update(arbitrary='bad'),False)
add('unknown output',lambda d:d.update(outputBodyId='missing'),False)
add('wrong axis',lambda d:d['features'][1].update(axis='X'),False)
add('unsafe parameter name',lambda d:d['parameters'].update({'__proto__':{'kind':'length','value':4}}),False)

# JSON does not allow NaN: that fixture tests JS/Python finite handling but is
# not serialized via JSON to Node (undefined semantics for JSON NaN).
fixtures=[f for f in fixtures if f[0]!='nonfinite dimension']
docs=[d for _,d,_ in fixtures]
proc=subprocess.run(['node','scripts/inspect_contract.mjs'],input=json.dumps(docs),text=True,capture_output=True,cwd=ROOT)
if proc.returncode:raise RuntimeError(proc.stderr)
js=json.loads(proc.stdout)
schema=json.loads((ROOT/'packages/cad-contracts/schema/document.v1.schema.json').read_text())
Draft202012Validator.check_schema(schema)
v=Draft202012Validator(schema)
results=[]
for (name,doc,expected),j in zip(fixtures,js):
    valid_schema=v.is_valid(doc)
    try:
        shape=build(doc);native=True
    except (GeometryError,ValueError,TypeError):native=False
    if (j['accepted'],native)!=(expected,expected):
        results.append(f'{name}: expected {expected}, JS {j}, native {native}')
    if expected and not valid_schema:results.append(f'{name}: schema rejected accepted document')
    if not expected and not valid_schema and j['accepted']:results.append(f'{name}: validator accepts schema invalid')
    if expected:
        py_order=[f['id'] for f in _evaluation_order(doc['features'])]
        if py_order !=j['order']:results.append(f'{name}: DAG order JS {j["order"]} != Python {py_order}')
if results:raise AssertionError('Contract parity failure:\n'+'\n'.join(results))
print(f'PASS {len(fixtures)} solid fixtures: JS/native semantic parity; JSON Schema accepted all positives')
