import * as THREE from 'three';
import {SketchWorkerClient} from '../../../packages/cad-sketch/src/client.mjs';
import {solvedRectangleToCadDocument} from '../../../packages/cad-sketch/src/solver.mjs';
import {CadWorkerClient} from '../../../packages/cad-geometry/src/client.mjs';
import seed from '../../../samples/rectangle.sketch.json';
import './style.css';
const $=id=>document.getElementById(id);
const state={solver:'planegcs-WASM',kernel:'occt-wasm-5.17.2',ready:false,sketch:null,geometry:null,error:null,stepBytes:0};
window.__SKETCH_E2E__=state;
const sketchWorker=new Worker(new URL('../../../packages/cad-sketch/src/browser-worker.mjs',import.meta.url),{type:'module',name:'webcad-sketch-planegcs'});
const cadWorker=new Worker(new URL('../../../packages/cad-geometry/src/browser-worker.mjs',import.meta.url),{type:'module',name:'webcad-sketch-occt'});
const sketchClient=new SketchWorkerClient(sketchWorker,{timeoutMs:60000});
const cadClient=new CadWorkerClient(cadWorker,{timeoutMs:120000});
const panel=$('sketch-solid-view'),status=$('sketch-status'),metrics=$('sketch-metrics'),indicator=$('sketch-indicator');
const scene=new THREE.Scene();scene.background=new THREE.Color('#162235');
const camera=new THREE.PerspectiveCamera(42,1,.1,10000);camera.up.set(0,0,1);camera.position.set(175,-205,145);camera.lookAt(70,30,15);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));panel.appendChild(renderer.domElement);
scene.add(new THREE.AmbientLight(0xffffff,1.5));const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(70,-80,180);scene.add(light);
const grid=new THREE.GridHelper(200,20,0x6984a2,0x294663);grid.rotation.x=Math.PI/2;grid.position.set(70,30,-0.1);scene.add(grid);
function resize(){let w=panel.clientWidth,h=panel.clientHeight;if(w&&h){renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()}}
new ResizeObserver(resize).observe(panel);resize();function animate(){requestAnimationFrame(animate);renderer.render(scene,camera)}animate();
let mesh=null,current=null,revision=0,working=false;
const buttons=['solve','width150','under','conflict','export'].map($);
function busy(v){working=v;buttons.forEach(b=>b.disabled=v)}
function updateSketch(points){
  const svg=$('sketch-view');const by=new Map(points.map(p=>[p.id,p]));const corners=['P0','P1','P2','P3'].map(id=>by.get(id));
  if(corners.some(x=>!x))return;
  const xs=corners.map(p=>p.x),ys=corners.map(p=>p.y),minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys),sx=300/Math.max(1,maxx-minx),sy=180/Math.max(1,maxy-miny);const sc=Math.min(sx,sy);
  const poly=corners.map(p=>`${30+(p.x-minx)*sc},${224-(p.y-miny)*sc}`).join(' ');
  svg.replaceChildren();const ns='http://www.w3.org/2000/svg';const path=document.createElementNS(ns,'polygon');path.setAttribute('points',poly);path.setAttribute('fill','#55b5ee22');path.setAttribute('stroke','#64b5f6');path.setAttribute('stroke-width','2.6');svg.appendChild(path);
  for(const p of corners){const c=document.createElementNS(ns,'circle');c.setAttribute('cx',String(30+(p.x-minx)*sc));c.setAttribute('cy',String(224-(p.y-miny)*sc));c.setAttribute('r','4');c.setAttribute('fill','#e3f5ff');svg.appendChild(c)}
}
async function run(mode='normal'){
  if(working)return;busy(true);status.textContent='求解 planegcs 约束…';state.error=null;
  const width=Number($('width').value),height=Number($('height').value),thickness=Number($('thickness').value);
  if(![width,height,thickness].every(x=>Number.isFinite(x)&&x>0&&x<=1000)){status.textContent='宽、高、厚度必须在 (0,1000] mm 内';busy(false);return}
  const sketch=structuredClone(seed);sketch.revision=++revision;
  sketch.constraints.find(c=>c.id==='Width120').value=width;
  sketch.constraints.find(c=>c.id==='Height60').value=height;
  if(mode==='under')sketch.constraints=sketch.constraints.filter(c=>c.id!=='Height60');
  if(mode==='conflict')sketch.constraints.push({id:'ConflictingWidth',type:'distance',a:'P0',b:'P1',value:width+10});
  try{
    const result=await sketchClient.solve(sketch);state.sketch=result;
    if(!result.valid||result.status!=='fully_constrained'){
      status.textContent=`草图未提交：${result.status} (DOF ${result.degreesOfFreedom??'?'}), conflicting: ${[...result.conflicts,...result.redundantConstraints].join(', ')||'见状态'}`;
      metrics.textContent=JSON.stringify({status:result.status,degreesOfFreedom:result.degreesOfFreedom,conflicts:result.conflicts,redundantConstraints:result.redundantConstraints},null,2);return;
    }
    updateSketch(result.points);
    const doc=solvedRectangleToCadDocument(sketch,result,thickness);
    const built=await cadClient.build(doc);
    const geometry=await cadClient.tessellate(built.geometryId,0.1,0.5);
    if(mesh){scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose()}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(geometry.positions,3));g.setAttribute('normal',new THREE.BufferAttribute(geometry.normals,3));g.setIndex(new THREE.BufferAttribute(geometry.indices,1));
    mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0x5eb4ef,metalness:.1,roughness:.55,side:THREE.DoubleSide}));scene.add(mesh);
    current=built.geometryId;state.geometry=built.evidence;state.ready=true;indicator.textContent='Sketch WASM ✓ · OCCT WASM ✓';
    metrics.textContent=JSON.stringify({solver:result.solverBuildId,status:result.status,dof:result.degreesOfFreedom,maxResidualMm:result.maxResidualMm,widthMm:doc.features[0].sizeMm[0],heightMm:doc.features[0].sizeMm[1],thicknessMm:thickness,volumeMm3:built.evidence.volumeMm3,triangleCount:geometry.triangleCount},null,2);
    status.textContent='草图求解和精确实体构建成功';
  }catch(e){state.error=String(e);status.textContent=`错误：${e.message}`;console.error(e)}finally{busy(false)}
}
$('solve').onclick=()=>void run();
$('width150').onclick=()=>{$('width').value='150';void run()};
$('under').onclick=()=>void run('under');
$('conflict').onclick=()=>void run('conflict');
$('export').onclick=async()=>{if(!current||working)return;busy(true);try{const bytes=await cadClient.exportStep(current);state.stepBytes=bytes.length;const url=URL.createObjectURL(new Blob([bytes],{type:'application/step'}));const a=document.createElement('a');a.href=url;a.download=`rectangle-r${revision}.step`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10_000);status.textContent=`已导出 ${bytes.length} 字节 STEP`}catch(e){state.error=String(e);status.textContent=e.message}finally{busy(false)}};
window.addEventListener('pagehide',()=>{sketchClient.close();cadClient.close();renderer.dispose()});
(async()=>{try{await cadClient.initialize();await run()}catch(e){state.error=String(e);status.textContent=e.message;console.error(e);busy(false)}})();
