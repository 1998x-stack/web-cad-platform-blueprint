/** Architecture-only ports. No geometrical capability is implemented here. */
import type { CadDocumentV1, GeometryEvidence } from '../../cad-contracts/src/types';
export interface MeshPackage {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  sourceDocumentRevision: number;
}
export interface GeometryBuildResult {
  geometryId: string;
  evidence: GeometryEvidence;
  failedFeatureIds: string[];
}
export interface KernelAdapter {
  initialize(): Promise<{kernelVersion: string}>;
  build(document: CadDocumentV1): Promise<GeometryBuildResult>;
  tessellate(geometryId: string, deflectionMm: number): Promise<MeshPackage>;
  exportStep(geometryId: string): Promise<Uint8Array>;
  dispose(geometryId: string): Promise<void>;
}
export class NotImplementedKernel implements KernelAdapter {
  async initialize(): Promise<{kernelVersion:string}> {throw new Error('NOT_IMPLEMENTED: OCCT WASM adapter required');}
  async build(_document: CadDocumentV1): Promise<GeometryBuildResult> {throw new Error('NOT_IMPLEMENTED: no B-Rep evaluation');}
  async tessellate(_geometryId: string,_deflectionMm: number): Promise<MeshPackage> {throw new Error('NOT_IMPLEMENTED');}
  async exportStep(_geometryId: string): Promise<Uint8Array> {throw new Error('NOT_IMPLEMENTED');}
  async dispose(_geometryId: string): Promise<void> {throw new Error('NOT_IMPLEMENTED');}
}
