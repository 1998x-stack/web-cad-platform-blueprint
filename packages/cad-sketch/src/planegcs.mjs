/** Real planegcs 1.3.0 binding. Separate instance per solve to prevent stale constraints/memory. */
export async function createPlanegcsSolver(wasmUrl){
  const {init_planegcs_module,GcsWrapper,SolveStatus}=await import('@salusoft89/planegcs');
  const mod=await init_planegcs_module(wasmUrl?{locateFile:()=>wasmUrl}:undefined);
  return {successStatus:SolveStatus.Success,createWrapper:async()=>new GcsWrapper(new mod.GcsSystem(),mod)};
}
