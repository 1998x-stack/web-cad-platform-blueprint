#!/usr/bin/env python3
"""Regenerate self-contained document/transaction schemas from one canonical v1 source.
No external network access or schema generators required. CI asserts generated files equal source.
"""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / 'packages/cad-contracts/schema'
ID = {'type':'string','pattern':'^[A-Za-z][A-Za-z0-9_-]{0,63}$','not': {'enum':['__proto__','constructor','prototype']}}
def obj(properties,required):return {'type':'object','additionalProperties':False,'required':required,'properties':properties}
def ref(s):return {'$ref':f'#/$defs/{s}'}
scalar={'oneOf':[{'type':'number','exclusiveMinimum':0},obj({'parameterRef':ref('id')},['parameterRef'])]}
vector={'type':'array','minItems':3,'maxItems':3,'items':{'type':'number'}}
size={'type':'array','minItems':3,'maxItems':3,'items':ref('lengthScalar')}
inputs={'type':'array','maxItems':2,'items':ref('id')}
parameter=obj({'kind':{'enum':['length','angle','count']},'value':{'type':'number'}},['kind','value'])
parameter['allOf']=[{'if':{'properties':{'kind':{'const':'length'}}},'then':{'properties':{'value':{'exclusiveMinimum':0}}}}, {'if':{'properties':{'kind':{'const':'count'}}},'then':{'properties':{'value':{'type':'integer','minimum':0}}}}]

def feature(kind, props, required):
  return obj({'id':ref('id'),'type':{'const':kind},'inputs':({'type':'array','minItems':0,'maxItems':0} if kind in ('sketch','profile','box','cylinder') else {'type':'array','minItems':1 if kind=='extrude' else 2,'maxItems':1 if kind=='extrude' else 2,'items':ref('id')}),**props},['id','type','inputs',*required])
feats=[
 feature('box',{'originMm':ref('vector3'),'sizeMm':ref('lengthVector3')},['originMm','sizeMm']),
 feature('cylinder',{'originMm':ref('vector3'),'radiusMm':ref('lengthScalar'),'heightMm':ref('lengthScalar'),'axis':{'const':'Z'}},['originMm','radiusMm','heightMm','axis']),
 feature('boolean',{'booleanOp':{'enum':['cut','union','intersect']}},['booleanOp']),
 feature('extrude',{'distanceMm':ref('lengthScalar')},['distanceMm']),
 feature('profile',{'plane':{'const':'XY'},'sourceSketchId':ref('id'),'sourceSketchRevision':{'type':'integer','minimum':0},'pointsMm':{'type':'array','minItems':3,'maxItems':128,'items':{'type':'array','minItems':2,'maxItems':2,'items':{'type':'number'}}}},['plane','sourceSketchId','sourceSketchRevision','pointsMm']),
 feature('sketch',{'plane':{'enum':['XY','XZ','YZ']},'entities':{'type':'array','maxItems':1000},'constraints':{'type':'array','maxItems':1000}},['plane','entities','constraints'])
]
patch=obj({'inputs':inputs,'plane':{'enum':['XY','XZ','YZ']},'entities':{'type':'array','maxItems':1000},'constraints':{'type':'array','maxItems':1000},'distanceMm':ref('lengthScalar'),'booleanOp':{'enum':['cut','union','intersect']},'originMm':ref('vector3'),'sizeMm':ref('lengthVector3'),'radiusMm':ref('lengthScalar'),'heightMm':ref('lengthScalar'),'axis':{'const':'Z'},'pointsMm':{'type':'array','minItems':3,'maxItems':128,'items':{'type':'array','minItems':2,'maxItems':2,'items':{'type':'number'}}},'sourceSketchId':ref('id'),'sourceSketchRevision':{'type':'integer','minimum':0}},[]);patch['minProperties']=1
commands=[
 dict(obj({'op':{'const':'parameter.set'},'name':ref('id'),'kind':{'enum':['length','angle','count']},'value':{'type':'number'}},['op','name','kind','value']), allOf=parameter['allOf']),
 obj({'op':{'const':'feature.add'},'feature':ref('feature')},['op','feature']),
 obj({'op':{'const':'feature.update'},'id':ref('id'),'patch':ref('featurePatch')},['op','id','patch']),
 obj({'op':{'const':'feature.remove'},'id':ref('id')},['op','id']),
 obj({'op':{'const':'output.set'},'featureId':ref('id')},['op','featureId'])
]
document=obj({'schemaVersion':{'const':1},'documentId':ref('id'),'revision':{'type':'integer','minimum':0},'units':{'const':'mm'},'parameters':{'type':'object','maxProperties':2000,'propertyNames':ref('id'),'additionalProperties':ref('parameter')},'features':{'type':'array','maxItems':10000,'items':ref('feature')},'outputBodyId':ref('id')},['schemaVersion','documentId','revision','units','parameters','features'])
transaction=obj({'transactionId':ref('id'),'expectedRevision':{'type':'integer','minimum':0},'commands':{'type':'array','minItems':1,'maxItems':64,'items':ref('command')}},['transactionId','expectedRevision','commands'])
evidence=obj({'schemaVersion':{'const':1},'documentId':ref('id'),
  'documentRevision':{'type':'integer','minimum':0},'kernelBuildId':{'type':'string','minLength':1},
  'valid':{'type':'boolean'},'solidCount':{'type':'integer','minimum':0},
  'volumeMm3':{'type':'number','minimum':0},'bboxMm':{'type':'array','minItems':6,'maxItems':6,'items':{'type':'number'}},
  'surfaceAreaMm2':{'type':'number','minimum':0},'faceCount':{'type':'integer','minimum':0},
  'warnings':{'type':'array','items':{'type':'string'},'maxItems':100}},
  ['schemaVersion','documentId','documentRevision','kernelBuildId','valid','solidCount','volumeMm3','bboxMm','surfaceAreaMm2','faceCount','warnings'])
worker_request={'oneOf':[
  obj({'v':{'const':1},'requestId':ref('id'),'kind':{'const':'init'},'kernelBuildId':{'type':'string','minLength':1}},['v','requestId','kind','kernelBuildId']),
  obj({'v':{'const':1},'requestId':ref('id'),'kind':{'const':'build'},'generation':{'type':'integer','minimum':0},'document':ref('document')},['v','requestId','kind','generation','document']),
  obj({'v':{'const':1},'requestId':ref('id'),'kind':{'const':'export-step'},'geometryId':ref('id')},['v','requestId','kind','geometryId']),
  obj({'v':{'const':1},'requestId':ref('id'),'kind':{'const':'dispose'},'geometryId':ref('id')},['v','requestId','kind','geometryId']),
  obj({'v':{'const':1},'requestId':ref('id'),'kind':{'const':'tessellate'},'geometryId':ref('id'),'linearDeflectionMm':{'type':'number','exclusiveMinimum':0},'angularDeflectionRad':{'type':'number','exclusiveMinimum':0}},['v','requestId','kind','geometryId','linearDeflectionMm','angularDeflectionRad'])
]}
defs={'id':ID,'lengthScalar':scalar,'vector3':vector,'lengthVector3':size,'parameter':parameter,'feature':{'oneOf':feats},'featurePatch':patch,'command':{'oneOf':commands},'document':document}


def main():
  import argparse
  ap=argparse.ArgumentParser();ap.add_argument('--check',action='store_true');args=ap.parse_args()
  targets={'document.v1.schema.json':document,'transaction.schema.json':transaction,'geometry-evidence.v1.schema.json':evidence,'worker-envelope.v1.schema.json':worker_request}
  for filename,root in targets.items():
    value={'$schema':'https://json-schema.org/draft/2020-12/schema','$id':f'https://example.invalid/webcad/{filename}','title':filename,'$defs':defs,**root}
    content=json.dumps(value,indent=2,ensure_ascii=False)+'\n'
    path=SCHEMA / filename
    if args.check:
      if not path.exists() or path.read_text()!=content:raise SystemExit(f'SCHEMA_DRIFT {filename}')
    else:path.write_text(content)
  print('PASS: four contract schemas generated from shared definitions')
if __name__=='__main__':main()
