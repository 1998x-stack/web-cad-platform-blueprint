import {SketchWorkerClient} from '../../../packages/cad-sketch/src/client.mjs';
import {CadWorkerClient} from '../../../packages/cad-geometry/src/client.mjs';
import {solvedProfileToCadDocument} from '../../../packages/cad-sketch/src/profile.mjs';
import {LocalCadHistory} from '../../../packages/cad-core/src/local-history.mjs';
import triangle from '../../../samples/triangle.sketch.json';
import rotated from '../../../samples/rotated.sketch.json';
import concave from '../../../samples/concave.sketch.json';
const $=id=>document.getElementById(id);const presets={triangle,rotated,concave};
const state={ready:false,activePreset:null,geometry:null,sketch:null,stepBytes:0,error:null,history:null};window.__PROFILE_E2E__=state;
const sketch=new SketchWorkerClient(new Worker(new URL('../../../packages/cad-sketch/src/browser-worker.mjs',import.meta.url),{type:'module'}),{timeoutMs:100000});
const cad=new CadWorkerClient(new Worker(new URL('../../../packages/cad-geometry/src/browser-worker.mjs',import.meta.url),{type:'module'}),{timeoutMs:150000});
let current=null,history=null,working=false;
function busy(b){working=b;for(const id of ['preset','depth','build','undo','redo','export'])$(id).disabled=b;}
function draw(points){
 const svg=$('profile-svg');svg.replaceChildren();const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys),scale=Math.min(290/Math.max(1,maxx-minx),240/Math.max(1,maxy-miny));
 const poly=document.createElementNS('http://www.w3.org/2000/svg','polygon');poly.setAttribute('points',points.map(p=>`${25+(p[0]-minx)*scale},${265-(p[1]-miny)*scale}`).join(' '));poly.setAttribute('fill','#6dd3b333');poly.setAttribute('stroke','#6dd3b3');poly.setAttribute('stroke-width','3');svg.appendChild(poly);
}
async function renderDoc(doc){
 const result=await cad.build(doc);const mesh=await cad.tessellate(result.geometryId);if(mesh.triangleCount<=0)throw new Error('empty OCCT tessellation');
 current=result.geometryId;state.geometry=result.evidence;state.ready=true;
 draw(doc.features.find(f=>f.type==='profile').pointsMm);
 $('metrics').textContent=JSON.stringify({featureOrder:result.featureOrder,documentRevision:doc.revision,volumeMm3:result.evidence.volumeMm3,surfaceAreaMm2:result.evidence.surfaceAreaMm2,faceCount:result.evidence.faceCount,triangleCount:mesh.triangleCount},null,2);
 $('history').textContent=JSON.stringify(history?.inspect(),null,2);state.history=history?.inspect();
 $('status').textContent='已使用真正的 OCCT Wire → Face → Extrude 构建 B-Rep';
}
async function build(){
 if(working)return;busy(true);state.error=null;
 try{
  const kind=$('preset').value,depth=Number($('depth').value);
  if(!Number.isFinite(depth)||depth<=0||depth>1000)throw new Error('厚度必须位于 (0,1000]');
  const sk=structuredClone(presets[kind]);const same=kind===state.activePreset && history!==null;
  sk.revision=same?history.current.revision+1:1;
  const solved=await sketch.solve(sk);state.sketch=solved;
  if(solved.status!=='fully_constrained'||!solved.valid)throw new Error(`sketch status: ${solved.status}`);
  const doc=solvedProfileToCadDocument(sk,solved,depth);
  if(same)history.record(doc,{expectedRevision:history.current.revision});else history=new LocalCadHistory(doc);
  state.activePreset=kind;await renderDoc(doc);
 }catch(e){state.error=String(e.message||e);$('status').textContent=`错误：${state.error}`;}finally{busy(false);}
}
async function navigate(direction){if(working||!history)return;busy(true);try{const doc=direction==='undo'?history.undo():history.redo();if(doc){$('depth').value=String(doc.parameters.extrusionDepth.value);await renderDoc(doc)}}catch(e){state.error=String(e)}finally{busy(false)}}
$('build').onclick=()=>void build();$('preset').onchange=()=>void build();$('undo').onclick=()=>void navigate('undo');$('redo').onclick=()=>void navigate('redo');
$('export').onclick=async()=>{if(!current||working)return;busy(true);try{const bytes=await cad.exportStep(current);state.stepBytes=bytes.length;const url=URL.createObjectURL(new Blob([bytes],{type:'application/step'}));const a=document.createElement('a');a.href=url;a.download=`${state.activePreset}-profile.step`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}catch(e){state.error=String(e)}finally{busy(false)}};
window.addEventListener('pagehide',()=>{sketch.close();cad.close()});
(async()=>{try{await cad.initialize();await build()}catch(e){state.error=String(e.message||e);$('status').textContent=state.error;busy(false)}})();
