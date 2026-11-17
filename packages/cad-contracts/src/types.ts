// Reference-only cross-boundary type contracts. Not yet a published TS package.
export type CadUnit = 'mm';
export type FeatureId = string;
export type LengthScalar = number | {parameterRef:string};
export type Parameter = {kind:'length'|'angle'|'count'; value:number};
export type SketchFeature = {
  id: FeatureId; type:'sketch'; inputs:[]; plane:'XY'|'XZ'|'YZ';
  entities: unknown[]; constraints: unknown[];
};
export type ExtrudeFeature = {
  id: FeatureId; type:'extrude'; inputs:[FeatureId]; distanceMm:LengthScalar;
};
export type BooleanFeature = {
  id: FeatureId; type:'boolean'; inputs:[FeatureId,FeatureId]; booleanOp:'union'|'cut'|'intersect';
};
export type BoxFeature = {
  id: FeatureId; type:'box'; inputs:[]; originMm:[number,number,number]; sizeMm:[LengthScalar,LengthScalar,LengthScalar];
};
export type CylinderFeature = {
  id: FeatureId; type:'cylinder'; inputs:[]; originMm:[number,number,number];
  radiusMm:LengthScalar; heightMm:LengthScalar; axis:'Z';
};
export type ProfileFeature = {id:FeatureId; type:'profile'; inputs:[]; plane:'XY'; sourceSketchId:string; sourceSketchRevision:number; pointsMm:[number,number][]};
export type CadFeature = SketchFeature | ProfileFeature | ExtrudeFeature | BooleanFeature | BoxFeature | CylinderFeature;
export interface CadDocumentV1 {
  schemaVersion:1; documentId:string; revision:number; units:CadUnit;
  parameters:Record<string,Parameter>; features:CadFeature[]; outputBodyId?:FeatureId;
}
export type CadCommand =
  | {op:'parameter.set'; name:string; kind:Parameter['kind']; value:number}
  | {op:'feature.add'; feature:CadFeature}
  | {op:'feature.update'; id:FeatureId; patch:Partial<Omit<CadFeature,'id'|'type'>>}
  | {op:'feature.remove'; id:FeatureId}
  | {op:'output.set'; featureId:FeatureId};
export interface CadTransaction {transactionId:string; expectedRevision:number; commands:CadCommand[];}
export interface GeometryEvidence {
  schemaVersion:1; documentId:string; documentRevision:number; kernelBuildId:string; valid:boolean;
  solidCount:number; volumeMm3:number; bboxMm:[number,number,number,number,number,number];
  surfaceAreaMm2:number; faceCount:number; warnings:string[];
}
