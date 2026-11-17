import {parentPort} from 'node:worker_threads';
import {solveSketch} from './solver.mjs';
import {createPlanegcsSolver} from './planegcs.mjs';
let binding=null;
parentPort.on('message',async m=>{
  try{
    if(m.kind!=='solve')throw new Error('unsupported operation');
    binding??=await createPlanegcsSolver();
    const result=await solveSketch(m.sketch,binding.createWrapper,{successStatus:binding.successStatus});
    parentPort.postMessage({v:1,requestId:m.requestId,kind:'result',result});
  }catch(e){parentPort.postMessage({v:1,requestId:m?.requestId,kind:'error',error:{code:e.code||'SOLVER_FAILURE',message:String(e?.message||e).slice(0,400)}});}
});
