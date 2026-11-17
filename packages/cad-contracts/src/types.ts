// Reference-only cross-boundary type contracts. Not yet a published TS package.
export type CadUnit = 'mm';
export type FeatureId = string;
export type Parameter = {kind:'length'|'angle'|'count'; value:number};
export type SketchFeature = {
  id: FeatureId; type:'sketch'; inputs:[]; plane:'XY'|'XZ'|'YZ';
  entities: unknown[]; constraints: unknown[];
};
export type ExtrudeFeature = {
  id: FeatureId; type:'extrude'; inputs:[FeatureId]; distanceMm:number;
};
export type BooleanFeature = {
  id: FeatureId; type:'boolean'; inputs:[FeatureId,FeatureId]; booleanOp:'union'|'cut'|'intersect';
};
export type BoxFeature = {
  id: FeatureId; type:'box'; inputs:[]; originMm:[number,number,number]; sizeMm:[number,number,number];
};
export type CylinderFeature = {
  id: FeatureId; type:'cylinder'; inputs:[]; originMm:[number,number,number];
  radiusMm:number; heightMm:number; axis:'Z';
};
export type CadFeature = SketchFeature | ExtrudeFeature | BooleanFeature | BoxFeature | CylinderFeature;
export interface CadDocumentV1 {
  schemaVersion:1; documentId:string; revision:number; units:CadUnit;
  parameters:Record<string,Parameter>; features:CadFeature[];
}
export type CadCommand =
  | {op:'parameter.set'; name:string; kind:Parameter['kind']; value:number}
  | {op:'feature.add'; feature:CadFeature}
  | {op:'feature.update'; id:FeatureId; patch:Partial<Omit<CadFeature,'id'|'type'>>}
  | {op:'feature.remove'; id:FeatureId};
export interface CadTransaction {transactionId:string; expectedRevision:number; commands:CadCommand[];}
export interface GeometryEvidence {
  documentRevision:number; kernelVersion:string; valid:boolean;
  solidCount:number; volumeMm3:number; bboxMm:[number,number,number,number,number,number];
  topologySignature?:string; warnings:string[];
}
