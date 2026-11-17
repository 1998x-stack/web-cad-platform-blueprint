/** CAD-004: strict P0 B-Rep evaluator. No mesh is used as a design input. */
const ID = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const MAX_DIMENSION_MM = 1e6;
const MAX_FEATURES = 100;

export class CadGeometryError extends Error {
  constructor(code, message) { super(message); this.name = 'CadGeometryError'; this.code = code; }
}
function fail(code, message) { throw new CadGeometryError(code, message); }
function validId(x) {return typeof x === 'string' && ID.test(x) && !['__proto__','prototype','constructor'].includes(x);}
function finite(x) {return typeof x === 'number' && Number.isFinite(x);}
function vec3(x, name) {
  if (!Array.isArray(x) || x.length !== 3 || !x.every(finite) || x.some(v=>Math.abs(v)>MAX_DIMENSION_MM)) fail('INVALID_DOCUMENT', `${name}: expected bounded finite 3-vector`);
  return x;
}
function lengthOf(x, parameters, name) {
  let v=x;
  if (x && typeof x==='object' && !Array.isArray(x)) {
    if (Object.keys(x).length !== 1 || !validId(x.parameterRef)) fail('INVALID_PARAMETER', `${name}: invalid parameterRef`);
    const p=Object.hasOwn(parameters,x.parameterRef)?parameters[x.parameterRef]:undefined;
    if (!p || p.kind!=='length') fail('INVALID_PARAMETER', `${name}: missing length parameter ${x.parameterRef}`);
    v=p.value;
  }
  if (!finite(v)||v<=0||v>MAX_DIMENSION_MM) fail('INVALID_DIMENSION', `${name}: must be a positive finite mm length <= ${MAX_DIMENSION_MM}`);
  return v;
}
function checkOnly(obj, allowed, label) {
  if (!obj || typeof obj!=='object' || Array.isArray(obj) || Object.keys(obj).some(k=>!allowed.includes(k))) fail('INVALID_DOCUMENT', `${label}: unsupported keys`);
}
export function featureOrder(doc) {
  if (!doc || typeof doc!=='object'||Array.isArray(doc)) fail('INVALID_DOCUMENT','document is not an object');
  checkOnly(doc,['schemaVersion','documentId','revision','units','parameters','features','outputBodyId'],'document');
  if (doc.schemaVersion!==1||doc.units!=='mm'||!validId(doc.documentId)||!Number.isSafeInteger(doc.revision)||doc.revision<0) fail('INVALID_DOCUMENT','requires CadDocumentV1 in mm');
  if (!doc.parameters||typeof doc.parameters!=='object'||Array.isArray(doc.parameters)||Object.keys(doc.parameters).length>2000) fail('INVALID_PARAMETER','invalid parameter table');
  for(const [id,p] of Object.entries(doc.parameters)) {
    if(!validId(id))fail('INVALID_PARAMETER',`invalid parameter name ${id}`);
    checkOnly(p,['kind','value'],`parameter ${id}`);
    if (!['length','angle','count'].includes(p.kind)||!finite(p.value)||(p.kind==='length'&&(p.value<=0||p.value>MAX_DIMENSION_MM))||(p.kind==='count'&&(!Number.isSafeInteger(p.value)||p.value<0))) fail('INVALID_PARAMETER',`invalid parameter ${id}`);
  }
  if (!Array.isArray(doc.features)||doc.features.length<1||doc.features.length>MAX_FEATURES) fail('INVALID_DOCUMENT',`P0 supports 1..${MAX_FEATURES} features`);
  const byId=new Map();
  for (const f of doc.features) {
    if(!f||typeof f!=='object'||Array.isArray(f)||!validId(f.id)||byId.has(f.id)||!Array.isArray(f.inputs)||!f.inputs.every(validId)) fail('INVALID_FEATURE','invalid/duplicate feature or inputs');
    byId.set(f.id,f);
  }
  if(!validId(doc.outputBodyId)||!byId.has(doc.outputBodyId))fail('INVALID_OUTPUT','outputBodyId must reference an existing feature');
  const result=[],active=new Set(),done=new Set();
  function visit(id){
    if(active.has(id))fail('CYCLIC_DEPENDENCY',`cycle at ${id}`);
    if(done.has(id))return;
    const f=byId.get(id);if(!f)fail('MISSING_DEPENDENCY',`missing ${id}`);
    active.add(id);
    for(const dep of [...f.inputs].sort())visit(dep);
    active.delete(id);done.add(id);result.push(f);
  }
  for(const id of [...byId.keys()].sort())visit(id);
  return result;
}
function ensureSolid(kernel, shape, id){
  if (!kernel.isValid(shape)) fail('INVALID_SOLID',`${id}: OCCT shape failed validity check`);
  const count=kernel.subShapeCount(shape,'solid');
  const volume=kernel.getVolume(shape);
  if(count!==1 || !finite(volume)||volume<=0)fail('INVALID_SOLID',`${id}: expected one valid positive-volume solid, got ${count}`);
}
/** @param {any} kernel occt-wasm OcctKernel with arena based ShapeHandle */
export function buildExactSolid(kernel, document) {
  const order=featureOrder(document), shapes=new Map();
  for (const f of order) {
    let s;
    if(f.type==='box'){
      checkOnly(f,['id','type','inputs','originMm','sizeMm'],f.id);
      if(f.inputs.length!==0)fail('INVALID_FEATURE',`${f.id}: box inputs must be empty`);
      const p=vec3(f.originMm,'originMm');
      if(!Array.isArray(f.sizeMm)||f.sizeMm.length!==3)fail('INVALID_DIMENSION','sizeMm must have 3 dimensions');
      const [dx,dy,dz]=f.sizeMm.map((v,i)=>lengthOf(v,document.parameters,`sizeMm[${i}]`));
      s=kernel.makeBox(dx,dy,dz);
      if(p.some(v=>v!==0)){const moved=kernel.translate(s,...p); kernel.release(s);s=moved;}
    }else if(f.type==='cylinder'){
      checkOnly(f,['id','type','inputs','originMm','radiusMm','heightMm','axis'],f.id);
      if(f.inputs.length!==0||f.axis!=='Z')fail('INVALID_FEATURE',`${f.id}: cylinder needs no inputs, axis Z`);
      const p=vec3(f.originMm,'originMm');
      s=kernel.makeCylinder(lengthOf(f.radiusMm,document.parameters,'radiusMm'),lengthOf(f.heightMm,document.parameters,'heightMm'));
      if(p.some(v=>v!==0)){const moved=kernel.translate(s,...p);kernel.release(s);s=moved;}
    }else if(f.type==='boolean'){
      checkOnly(f,['id','type','inputs','booleanOp'],f.id);
      if(f.inputs.length!==2||f.inputs[0]===f.inputs[1]||!f.inputs.every(id=>shapes.has(id)))fail('INVALID_FEATURE',`${f.id}: boolean requires two distinct evaluated inputs`);
      const [a,b]=f.inputs.map(id=>shapes.get(id));
      if(f.booleanOp==='cut')s=kernel.cut(a,b);
      else if(f.booleanOp==='union')s=kernel.fuse(a,b);
      else if(f.booleanOp==='intersect')s=kernel.common(a,b);
      else fail('UNSUPPORTED_FEATURE',`${f.id}: unsupported boolean operation`);
    }else fail('UNSUPPORTED_FEATURE',`${f.id}: ${f.type} not yet supported by P0 geometry runtime`);
    ensureSolid(kernel,s,f.id);
    shapes.set(f.id,s);
  }
  const shape=shapes.get(document.outputBodyId);
  const bbox=kernel.getBoundingBox(shape,{precise:true});
  const bounds=['xmin','ymin','zmin','xmax','ymax','zmax'].map(k=>bbox[k]);
  if(bounds.some(x=>!finite(x)))fail('INVALID_SOLID','OCCT produced nonfinite bounding box');
  const evidence={schemaVersion:1,documentId:document.documentId,documentRevision:document.revision,kernelBuildId:'occt-wasm-5.17.2',valid:true,solidCount:1,volumeMm3:kernel.getVolume(shape),bboxMm:bounds,surfaceAreaMm2:kernel.getSurfaceArea(shape),faceCount:kernel.subShapeCount(shape,'face'),warnings:[]};
  return {shape,evidence,order:order.map(f=>f.id)};
}
