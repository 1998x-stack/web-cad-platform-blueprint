/** Node worker_threads entrypoint: runs the EXACT same WASM runtime for CI oracle tests. */
import {parentPort} from 'node:worker_threads';
import {OcctKernel} from 'occt-wasm';
import {createCadWorkerRuntime} from './worker-runtime.mjs';
if(!parentPort)throw new Error('Must run in a node:worker_threads Worker');
const runtime=createCadWorkerRuntime({loadKernel:()=>OcctKernel.init(),send:(msg,transfer=[])=>parentPort.postMessage(msg,transfer)});
let queue=Promise.resolve();
parentPort.on('message',message=>{queue=queue.then(()=>runtime.handle(message)).catch(err=>{parentPort.postMessage({v:1,requestId:message?.requestId??'Unknown',kind:'error',error:{code:'WORKER_FAILURE',message:String(err)}});});});
parentPort.on('close',()=>runtime.close());
