/** The only browser entrypoint owning the OCCT WASM arena. */
import {OcctKernel} from 'occt-wasm';
import {createCadWorkerRuntime} from './worker-runtime.mjs';
const runtime=createCadWorkerRuntime({loadKernel:()=>OcctKernel.init(),send:(message,transfer=[])=>self.postMessage(message,transfer)});
let queue=Promise.resolve();
self.addEventListener('message',event=>{queue=queue.then(()=>runtime.handle(event.data)).catch(err=>{self.postMessage({v:1,requestId:event.data?.requestId??'Unknown',kind:'error',error:{code:'WORKER_FAILURE',message:String(err)}});});});
self.addEventListener('error',()=>runtime.close());
