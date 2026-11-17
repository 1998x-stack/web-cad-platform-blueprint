import {solveSketch} from './solver.mjs';
import {createPlanegcsSolver} from './planegcs.mjs';
import wasmUrl from '@salusoft89/planegcs/dist/planegcs_dist/planegcs.wasm?url';
let init=null;
self.onmessage=async ({data:m})=>{
  const requestId=m?.requestId;
  if(m?.v!==1||typeof requestId!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(requestId))return;
  try{
    if(m.kind!=='solve')throw Object.assign(new Error('unknown sketch operation'),{code:'PROTOCOL'});
    init??=createPlanegcsSolver(wasmUrl).catch(e=>{init=null;throw e});
    const binding=await init;
    const result=await solveSketch(m.sketch,binding.createWrapper,{successStatus:binding.successStatus});
    self.postMessage({v:1,requestId,kind:'result',result});
  }catch(e){self.postMessage({v:1,requestId,kind:'error',error:{code:e.code||'SOLVER_FAILURE',message:String(e.message||e).slice(0,400)}});}
};
