/**
 * CAD DOCUMENT TRANSACTION PROOF-OF-CONCEPT. NOT A CAD GEOMETRY ENGINE.
 * This module NEVER evaluates B-Rep geometry, solves sketches, or proves
 * geometric validity. It deliberately checks only typed document invariants.
 * Production must add schema authentication, durable idempotency, ACL,
 * topology mapping and real kernel proof before committing a preview.
 */
import { createHash } from 'node:crypto';

export class CadDomainError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CadDomainError';
    this.code = code;
  }
}

const ID = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const PLANES = new Set(['XY', 'XZ', 'YZ']);
const TYPES = new Set(['sketch', 'extrude', 'boolean', 'box', 'cylinder', 'profile']);
const OPS = new Set(['union', 'cut', 'intersect']);
const KINDS = new Set(['length', 'angle', 'count']);
function assertVector3(value, label, positive = false, params = {}) {
  if (!Array.isArray(value) || value.length !== 3) error('INVALID_INPUT', `${label}: expected 3-vector`);
  for (const n of value) {
    if (positive) assertLengthScalar(n, label, params);
    else assertFinite(n, label);
  }
}
const error = (code, message) => { throw new CadDomainError(code, message); };
const validId = (x) => typeof x === 'string' && ID.test(x) && !['__proto__', 'constructor', 'prototype'].includes(x);
const assertId = (x, label) => { if (!validId(x)) error('INVALID_INPUT', `${label}: invalid id`); };
const clone = x => structuredClone(x);

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
export const hashDocument = doc => createHash('sha256').update(stable(doc)).digest('hex');

export function createDocument(documentId = 'doc_001') {
  assertId(documentId, 'documentId');
  return {schemaVersion: 1, documentId, revision: 0, units: 'mm', parameters: {}, features: []};
}

function assertPlainObject(x, label) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) error('INVALID_INPUT', `${label}: expected object`);
}
function assertFinite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) error('INVALID_INPUT', `${label}: finite number required`);
}
function assertPositive(value, label) {
  assertFinite(value, label);
  if (value <= 0) error('INVALID_INPUT', `${label}: must be positive`);
}
function assertAllowedKeys(x, keys, label) {
  for (const key of Object.keys(x)) if (!keys.includes(key)) error('INVALID_INPUT', `${label}: unsupported field ${key}`);
}
function assertParameter(x) {
  assertPlainObject(x, 'parameter');
  assertAllowedKeys(x, ['kind', 'value'], 'parameter');
  if (!KINDS.has(x.kind)) error('INVALID_INPUT', 'parameter: invalid kind');
  assertFinite(x.value, 'parameter.value');
  if (x.kind === 'length' && x.value <= 0) error('INVALID_INPUT', 'length must be positive');
  if (x.kind === 'count' && (!Number.isInteger(x.value) || x.value < 0)) error('INVALID_INPUT', 'count must be non-negative integer');
}
/** Length dimensions are either a positive literal in millimetres or a
 *  typed parameter reference. No strings, expressions, or JS execution. */
function assertLengthScalar(value, label, parameters) {
  if (typeof value === 'number') return assertPositive(value, label);
  assertPlainObject(value, label);
  assertAllowedKeys(value, ['parameterRef'], label);
  assertId(value.parameterRef, `${label}.parameterRef`);
  if (!Object.hasOwn(parameters, value.parameterRef)) error('MISSING_PARAMETER', `${label}: missing ${value.parameterRef}`);
  if (parameters[value.parameterRef].kind !== 'length') error('INVALID_PARAMETER_KIND', `${label}: expected length parameter`);
  assertPositive(parameters[value.parameterRef].value, label);
}

function validateFeature(feature, parameters) {
  assertPlainObject(feature, 'feature');
  assertAllowedKeys(feature, ['id', 'type', 'inputs', 'plane', 'entities', 'constraints', 'distanceMm', 'booleanOp', 'originMm', 'sizeMm', 'radiusMm', 'heightMm', 'axis', 'pointsMm', 'sourceSketchId', 'sourceSketchRevision'], 'feature');
  assertId(feature.id, 'feature.id');
  if (!TYPES.has(feature.type)) error('INVALID_INPUT', 'unsupported feature type');
  if (!Array.isArray(feature.inputs) || feature.inputs.length > 2 || !feature.inputs.every(validId)) {
    error('INVALID_INPUT', 'feature inputs must be an array of valid IDs');
  }
  if (feature.type === 'box') {
    if (feature.inputs.length !== 0) error('INVALID_INPUT', 'box needs no inputs');
    assertVector3(feature.originMm,'box.originMm');
    assertVector3(feature.sizeMm,'box.sizeMm',true,parameters);
  }
  if (feature.type === 'cylinder') {
    if (feature.inputs.length !== 0 || feature.axis !== 'Z') error('INVALID_INPUT', 'cylinder needs no inputs and Z axis');
    assertVector3(feature.originMm,'cylinder.originMm');
    assertLengthScalar(feature.radiusMm,'cylinder.radiusMm',parameters);
    assertLengthScalar(feature.heightMm,'cylinder.heightMm',parameters);
  }
  if (feature.type === 'sketch') {
    if (!PLANES.has(feature.plane) || feature.inputs.length !== 0) error('INVALID_INPUT', 'sketch requires plane and no inputs');
    if (!Array.isArray(feature.entities) || feature.entities.length > 1000 || !Array.isArray(feature.constraints) || feature.constraints.length > 1000) {
      error('INVALID_INPUT', 'sketch entities/constraints must be bounded arrays');
    }
    // NOTE: geometry / constraint payload validation is intentionally NOT implemented here.
    if (JSON.stringify({entities:feature.entities,constraints:feature.constraints}).length > 65536) error('INVALID_INPUT', 'sketch payload too large');
  }
  if (feature.type === 'profile') {
    if (feature.inputs.length !== 0 || feature.plane !== 'XY') error('INVALID_INPUT', 'profile needs XY and no inputs');
    assertId(feature.sourceSketchId,'profile.sourceSketchId');
    if (!Number.isSafeInteger(feature.sourceSketchRevision) || feature.sourceSketchRevision < 0) error('INVALID_INPUT', 'invalid sketch revision');
    if (!Array.isArray(feature.pointsMm) || feature.pointsMm.length < 3 || feature.pointsMm.length > 128) error('INVALID_INPUT', 'invalid profile point count');
    for (const p of feature.pointsMm) { if (!Array.isArray(p) || p.length !== 2) error('INVALID_INPUT', 'profile point must be XY'); for (const c of p) { assertFinite(c,'profile coordinate'); if (Math.abs(c)>1e6) error('INVALID_INPUT','profile coordinate outside bounds'); } }
    // Geometric self-intersections are validated again at B-Rep execution boundary.
  }
  if (feature.type === 'extrude') {
    if (feature.inputs.length !== 1) error('INVALID_INPUT', 'extrude needs one sketch input');
    assertLengthScalar(feature.distanceMm, 'extrude.distanceMm', parameters);
  }
  if (feature.type === 'boolean') {
    if (feature.inputs.length !== 2 || feature.inputs[0] === feature.inputs[1] || !OPS.has(feature.booleanOp)) {
      error('INVALID_INPUT', 'boolean needs two distinct inputs and valid operation');
    }
  }
}

export function validateDocument(doc) {
  assertPlainObject(doc, 'document');
  assertAllowedKeys(doc, ['schemaVersion','documentId','revision','units','parameters','features','outputBodyId'], 'document');
  if (doc.schemaVersion !== 1 || doc.units !== 'mm' || !Number.isSafeInteger(doc.revision) || doc.revision < 0) {
    error('INVALID_DOCUMENT', 'invalid document schema, units or revision');
  }
  assertId(doc.documentId, 'documentId');
  assertPlainObject(doc.parameters, 'parameters');
  if (Object.keys(doc.parameters).length > 2000) error('INVALID_DOCUMENT', 'too many parameters');
  for (const [k,v] of Object.entries(doc.parameters)) { assertId(k,'parameter name'); assertParameter(v); }
  if (!Array.isArray(doc.features) || doc.features.length > 10000) error('INVALID_DOCUMENT', 'invalid feature collection');
  const nodes = new Map();
  for (const f of doc.features) {
    validateFeature(f, doc.parameters);
    if (nodes.has(f.id)) error('DUPLICATE_FEATURE', `duplicate feature: ${f.id}`);
    nodes.set(f.id, f);
  }
  // Verify input references exist, and don't point forward unless DAG validation later handles order.
  for (const f of doc.features) {
    for (const dep of f.inputs) {
      const input = nodes.get(dep);
      if (!input) error('MISSING_DEPENDENCY', `feature ${f.id} depends on nonexistent ${dep}`);
      if (f.type === 'extrude' && !['sketch','profile'].includes(input.type)) error('INVALID_DEPENDENCY', 'extrude needs a sketch or solved profile');
      if (f.type === 'boolean' && !['extrude','boolean','box','cylinder'].includes(input.type)) error('INVALID_DEPENDENCY', 'boolean needs solid-producing inputs');
    }
  }
  const status = new Map();
  function visit(id) {
    if (status.get(id) === 'active') error('CYCLE_DETECTED', `cycle through ${id}`);
    if (status.get(id) === 'done') return;
    status.set(id, 'active');
    for (const dep of nodes.get(id).inputs) visit(dep);
    status.set(id, 'done');
  }
  for (const id of [...nodes.keys()].sort()) visit(id);
  if (doc.outputBodyId !== undefined) {
    assertId(doc.outputBodyId, 'outputBodyId');
    const output = nodes.get(doc.outputBodyId);
    if (!output) error('MISSING_DEPENDENCY', `outputBodyId ${doc.outputBodyId} does not exist`);
    if (!['box','cylinder','boolean','extrude'].includes(output.type)) error('INVALID_DEPENDENCY', 'outputBodyId must name a solid-producing feature');
  }
  return true;
}

function updateFeature(doc, command) {
  assertId(command.id,'feature.update id');
  assertPlainObject(command.patch,'feature.update patch');
  if (Object.keys(command.patch).length === 0) error('INVALID_INPUT', 'empty update');
  assertAllowedKeys(command.patch, ['inputs','plane','entities','constraints','distanceMm','booleanOp','originMm','sizeMm','radiusMm','heightMm','axis','pointsMm','sourceSketchId','sourceSketchRevision'], 'feature patch');
  const index = doc.features.findIndex(f => f.id === command.id);
  if (index < 0) error('NOT_FOUND','feature not found');
  doc.features[index] = {...doc.features[index], ...clone(command.patch)};
}

function applyCommand(doc, command) {
  assertPlainObject(command,'command');
  if (command.op === 'parameter.set') {
    assertAllowedKeys(command,['op','name','kind','value'],'parameter.set');
    assertId(command.name,'parameter name');
    const p = {kind:command.kind,value:command.value};
    assertParameter(p);
    doc.parameters[command.name] = p;
  } else if (command.op === 'feature.add') {
    assertAllowedKeys(command,['op','feature'],'feature.add');
    validateFeature(command.feature, doc.parameters);
    if (doc.features.some(f => f.id === command.feature.id)) error('DUPLICATE_FEATURE', 'feature already exists');
    doc.features.push(clone(command.feature));
  } else if (command.op === 'feature.update') {
    assertAllowedKeys(command,['op','id','patch'],'feature.update');
    updateFeature(doc,command);
  } else if (command.op === 'output.set') {
    assertAllowedKeys(command, ['op','featureId'], 'output.set');
    assertId(command.featureId,'output.set featureId');
    doc.outputBodyId = command.featureId;
  } else if (command.op === 'feature.remove') {
    assertAllowedKeys(command,['op','id'],'feature.remove');
    assertId(command.id,'feature.remove id');
    const index = doc.features.findIndex(f => f.id === command.id);
    if (index < 0) error('NOT_FOUND','feature not found');
    if (doc.features.some(f => f.inputs.includes(command.id)) || doc.outputBodyId === command.id) error('FEATURE_IN_USE','feature has dependents or is outputBodyId');
    doc.features.splice(index, 1);
  } else {
    error('UNSUPPORTED_COMMAND','unsupported command');
  }
}

export function previewTransaction(doc, transaction) {
  validateDocument(doc);
  assertPlainObject(transaction,'transaction');
  assertAllowedKeys(transaction,['transactionId','expectedRevision','commands'],'transaction');
  assertId(transaction.transactionId,'transactionId');
  if (transaction.expectedRevision !== doc.revision) error('REVISION_CONFLICT',`expected ${transaction.expectedRevision}, found ${doc.revision}`);
  if (!Array.isArray(transaction.commands) || transaction.commands.length === 0 || transaction.commands.length > 64) {
    error('INVALID_INPUT','transaction must contain 1–64 commands');
  }
  const next = clone(doc);
  for (const command of transaction.commands) applyCommand(next,command);
  validateDocument(next); // includes referential integrity and cycle detection
  next.revision += 1;
  const candidateHash = hashDocument(next);
  return {
    transactionId:transaction.transactionId,
    baseRevision:doc.revision,
    sourceHash:hashDocument(doc),
    candidateHash,
    candidateDocument:next,
    // WARNING: no geometry evidence and no secure durable approval token.
    geometryValidated:false,
    commandsCount:transaction.commands.length
  };
}

/** Local demo only. Production: enforce durable preview ID, ACL, approval proof,
 * kernel evidence, signed tokens and database compare-and-swap. */
export function commitLocalPreview(doc, preview, {approved = false} = {}) {
  validateDocument(doc);
  if (!approved) error('APPROVAL_REQUIRED','explicit local approval required');
  if (!preview || typeof preview !== 'object' || doc.revision !== preview.baseRevision || hashDocument(doc) !== preview.sourceHash) {
    error('REVISION_CONFLICT','preview is stale or source changed');
  }
  if (hashDocument(preview.candidateDocument) !== preview.candidateHash) error('PREVIEW_TAMPERED','preview document changed');
  validateDocument(preview.candidateDocument);
  if (preview.candidateDocument.revision !== doc.revision + 1) error('INVALID_PREVIEW','candidate revision invalid');
  return clone(preview.candidateDocument);
}

/** Deterministic dependency-first evaluation. Feature array order is UI only. */
export function evaluationOrder(doc) {
  validateDocument(doc);
  const byId = new Map(doc.features.map(f => [f.id, f]));
  const visited = new Set(), result = [];
  const visit = id => {
    if (visited.has(id)) return;
    for (const dep of [...byId.get(id).inputs].sort()) visit(dep);
    visited.add(id); result.push(id);
  };
  for (const id of [...byId.keys()].sort()) visit(id);
  return result;
}
