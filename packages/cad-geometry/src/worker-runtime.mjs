import {buildExactSolid, CadGeometryError} from './evaluator.mjs';
/** Owns one OCCT arena and one active B-Rep revision. A new build invalidates the previous handle. */
export function createCadWorkerRuntime({loadKernel, send}) {
  let kernel=null, generation=-1, active=null, initializing=null, busy=false;
  async function ensureKernel(){
    if(kernel)return kernel;
    if(!initializing) initializing=Promise.resolve().then(loadKernel).then(k=>(kernel=k)).catch(e=>{initializing=null;throw e;});
    return initializing;
  }
  function requireGeometry(id){if(!active||active.id!==id)throw new CadGeometryError('STALE_GEOMETRY',`unknown or disposed geometry ${id}`);return active;}
  async function handle(msg) {
    const id=msg?.requestId;
    if(!msg||msg.v!==1||typeof id!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(id))throw new CadGeometryError('PROTOCOL','malformed request envelope');
    if(busy)throw new CadGeometryError('BUSY','worker already handling a request');
    busy=true;
    try {
      let result,transfer=[];
      switch(msg.kind){
        case 'init':{
          if(msg.kernelBuildId!=='occt-wasm-5.17.2')throw new CadGeometryError('KERNEL_BUILD_MISMATCH','pinned WASM kernel version does not match request');
          const k=await ensureKernel();
          result={kernelVersion:'occt-wasm-5.17.2',runtime:'WASM',ready:!!k};break;
        }
        case 'build':{
          if(!Number.isSafeInteger(msg.generation)||msg.generation<0||msg.generation<=generation)throw new CadGeometryError('STALE_GENERATION','generation must be strictly increasing');
          generation=msg.generation;
          const k=await ensureKernel();
          active=null;k.releaseAll();
          const built=buildExactSolid(k,msg.document);
          const geometryId=`Geom_${generation}`;
          active={id:geometryId,shape:built.shape,revision:msg.document.revision,generation};
          result={geometryId,evidence:built.evidence,failedFeatureIds:[],featureOrder:built.order};break;
        }
        case 'tessellate':{
          const a=requireGeometry(msg.geometryId),k=await ensureKernel();
          const lin=msg.linearDeflectionMm,ang=msg.angularDeflectionRad;
          if(!(typeof lin==='number'&&lin>0&&lin<=10&&typeof ang==='number'&&ang>0&&ang<=Math.PI))throw new CadGeometryError('INVALID_MESH_OPTIONS','invalid tessellation tolerances');
          const mesh=k.tessellate(a.shape,{linearDeflection:lin,angularDeflection:ang});
          if(mesh.indices.length>3_000_000)throw new CadGeometryError('MESH_TOO_LARGE','maximum 1,000,000 triangles');
          result={positions:mesh.positions,normals:mesh.normals,indices:mesh.indices,sourceDocumentRevision:a.revision,triangleCount:mesh.triangleCount};
          transfer=[result.positions.buffer,result.normals.buffer,result.indices.buffer];break;
        }
        case 'export-step':{
          const a=requireGeometry(msg.geometryId),text=(await ensureKernel()).exportStep(a.shape);
          const bytes=new TextEncoder().encode(text);
          if(bytes.length>50_000_000)throw new CadGeometryError('STEP_TOO_LARGE','STEP export exceeds 50 MB');
          result={bytes,sourceDocumentRevision:a.revision};transfer=[bytes.buffer];break;
        }
        case 'dispose':{
          requireGeometry(msg.geometryId);
          active=null;(await ensureKernel()).releaseAll();result={disposed:true};break;
        }
        default:throw new CadGeometryError('PROTOCOL',`unknown worker operation ${msg.kind}`);
      }
      send({v:1,requestId:id,kind:'result',result},transfer);
    }catch(err){
      send({v:1,requestId:id,kind:'error',error:{code:err instanceof CadGeometryError?err.code:typeof err?.code==='string'?err.code:'KERNEL_FAILURE',message:String(err?.message||err).slice(0,400)}});
    }finally{busy=false;}
  }
  function close(){active=null;if(kernel){kernel.releaseAll();kernel[Symbol.dispose]?.();kernel=null;}initializing=null;}
  return {handle,close,inspect:()=>({generation,active:active?.id??null,ready:!!kernel})};
}
