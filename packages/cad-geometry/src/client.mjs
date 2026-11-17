/** Worker bridge with request correlation, timeouts and stale-generation suppression. */
export class CadWorkerClient {
  constructor(worker,{timeoutMs=90_000}={}) {
    this.worker=worker;this.pending=new Map();this.sequence=0;this.generation=0;this.latestGeneration=0;this.currentGeometryId=null;this.closed=false;this.timeoutMs=timeoutMs;
    this.onMessage=e=>{
      const msg=e.data??e;const p=this.pending.get(msg.requestId);if(!p)return;
      clearTimeout(p.timer);this.pending.delete(msg.requestId);
      if(msg.kind==='error')p.reject(Object.assign(new Error(msg.error.message),{code:msg.error.code}));
      else if(msg.kind==='result')p.resolve(msg.result);
      else p.reject(new Error('Unknown worker response'));
    };
    this.onFatal=e=>{const reason=new Error(`Worker failed: ${e?.message??String(e)}`);for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(reason)}this.pending.clear();};
    if(worker.addEventListener){worker.addEventListener('message',this.onMessage);worker.addEventListener('error',this.onFatal);}
    else {worker.on('message',this.onMessage);worker.on('error',this.onFatal);}
  }
  request(kind,args={}) {
    if(this.closed)return Promise.reject(new Error('Worker client is closed'));
    const requestId=`Request_${++this.sequence}`;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(requestId);reject(new Error(`Timeout ${kind}`));},this.timeoutMs);
      this.pending.set(requestId,{resolve,reject,timer});
      this.worker.postMessage({v:1,requestId,kind,...args});
    });
  }
  initialize(){return this.request('init',{kernelBuildId:'occt-wasm-5.17.2'});}
  async build(document){
    const generation=++this.generation;this.latestGeneration=generation;
    const built=await this.request('build',{generation,document});
    if(generation!==this.latestGeneration)throw Object.assign(new Error('Obsolete build generation'),{code:'STALE_RESULT'});
    this.currentGeometryId=built.geometryId;return built;
  }
  async tessellate(geometryId,linearDeflectionMm=0.1,angularDeflectionRad=0.5){
    return this.request('tessellate',{geometryId,linearDeflectionMm,angularDeflectionRad});
  }
  async exportStep(geometryId){return (await this.request('export-step',{geometryId})).bytes;}
  async dispose(geometryId){const r=await this.request('dispose',{geometryId});if(this.currentGeometryId===geometryId)this.currentGeometryId=null;return r;}
  /** Worker-side bookkeeping used for lifecycle evidence (no kernel mutation). */
  stats(){return this.request('stats');}
  close(){if(this.closed)return;this.closed=true;this.worker.removeEventListener?.('message',this.onMessage);this.worker.removeEventListener?.('error',this.onFatal);this.worker.off?.('message',this.onMessage);this.worker.off?.('error',this.onFatal);this.worker.terminate();for(const v of this.pending.values()){clearTimeout(v.timer);v.reject(new Error('Worker terminated'));}this.pending.clear();}
}
