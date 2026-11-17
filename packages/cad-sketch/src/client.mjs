export class SketchWorkerClient {
  constructor(worker,{timeoutMs=20000}={}){
    this.worker=worker;this.seq=0;this.pending=new Map();this.timeoutMs=timeoutMs;this.closed=false;
    this.message=e=>{const m=e.data??e,p=this.pending.get(m.requestId);if(!p)return;clearTimeout(p.timer);this.pending.delete(m.requestId);if(m.kind==='error')p.reject(Object.assign(new Error(m.error.message),{code:m.error.code}));else p.resolve(m.result)};
    this.fatal=e=>{for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error(String(e.message||e)))}this.pending.clear()};
    if(worker.addEventListener){worker.addEventListener('message',this.message);worker.addEventListener('error',this.fatal)}else{worker.on('message',this.message);worker.on('error',this.fatal)}
  }
  solve(sketch){if(this.closed)return Promise.reject(new Error('closed sketch Worker'));const requestId=`SketchRequest_${++this.seq}`;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(requestId);reject(new Error('Sketch solve timeout'))},this.timeoutMs);this.pending.set(requestId,{timer,resolve,reject});this.worker.postMessage({v:1,kind:'solve',requestId,sketch})})}
  close(){if(this.closed)return;this.closed=true;this.worker.terminate();for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('closed'))}this.pending.clear()}
}
