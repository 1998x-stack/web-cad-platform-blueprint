import * as THREE from 'three';
import {CadWorkerClient} from '../../../packages/cad-geometry/src/client.mjs';
import fixture from '../../../samples/precision-block.cad.json';
import './style.css';
const hole=document.querySelector('#hole'), status=document.querySelector('#status'), metrics=document.querySelector('#metrics');
const indicator=document.querySelector('#indicator'), viewport=document.querySelector('#viewport');
const buttons=[...document.querySelectorAll('button')];
const state={worker:'dedicated',ready:false,evidence:null,stepBytes:0,error:null};
window.__CAD_E2E__=state;
let current=null,solid=null,revision=fixture.revision,working=false;
const worker=new Worker(new URL('../../../packages/cad-geometry/src/browser-worker.mjs',import.meta.url),{type:'module',name:'webcad-occt'});
const client=new CadWorkerClient(worker,{timeoutMs:120_000});
const scene=new THREE.Scene();scene.background=new THREE.Color('#132032');
const camera=new THREE.PerspectiveCamera(42,1,.1,10000);camera.position.set(170,-180,135);camera.up.set(0,0,1);camera.lookAt(60,30,15);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));viewport.appendChild(renderer.domElement);
scene.add(new THREE.AmbientLight(0xffffff,1.5));const light=new THREE.DirectionalLight(0xffffff,2.3);light.position.set(90,-100,220);scene.add(light);
const grid=new THREE.GridHelper(180,18,0x4f7091,0x2e4661);grid.rotation.x=Math.PI/2;grid.position.set(60,30,-.1);scene.add(grid);
let drag=false,lx=0,ly=0,azimuth=-Math.PI/4,elevation=.6,dist=255;
function cameraUpdate(){camera.position.set(60+dist*Math.cos(elevation)*Math.cos(azimuth),30+dist*Math.cos(elevation)*Math.sin(azimuth),15+dist*Math.sin(elevation));camera.lookAt(60,30,15)}
renderer.domElement.addEventListener('pointerdown',e=>{drag=true;lx=e.clientX;ly=e.clientY;renderer.domElement.setPointerCapture(e.pointerId)});
renderer.domElement.addEventListener('pointerup',()=>drag=false);
renderer.domElement.addEventListener('pointermove',e=>{if(!drag)return;azimuth+=(e.clientX-lx)*.007;elevation=Math.max(-1.45,Math.min(1.45,elevation+(e.clientY-ly)*.007));lx=e.clientX;ly=e.clientY;cameraUpdate()});
renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();dist=Math.max(80,Math.min(1000,dist*Math.exp(e.deltaY*.001)));cameraUpdate()},{passive:false});
function resize(){const w=viewport.clientWidth,h=viewport.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()}
new ResizeObserver(resize).observe(viewport);resize();cameraUpdate();function frame(){requestAnimationFrame(frame);renderer.render(scene,camera)}frame();
function setBusy(v){working=v;for(const b of buttons)b.disabled=v}
async function rebuild(radius) {
  if(working)return;setBusy(true);status.textContent='正在执行 OCCT B-Rep...';
  const doc=structuredClone(fixture);doc.revision=++revision;doc.parameters.holeRadius.value=radius;
  try {
    const result=await client.build(doc);
    const mesh=await client.tessellate(result.geometryId,0.1,0.5);
    if(solid){scene.remove(solid);solid.geometry.dispose();solid.material.dispose();solid=null}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(mesh.positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(mesh.normals,3));geometry.setIndex(new THREE.BufferAttribute(mesh.indices,1));
    solid=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0x55b5ee,metalness:.18,roughness:.5,side:THREE.DoubleSide}));scene.add(solid);
    current=result.geometryId;state.ready=true;state.evidence=result.evidence;state.error=null;indicator.textContent='Worker: real OCCT WASM';
    const ev=result.evidence;
    metrics.textContent=`有效实体: ${ev.solidCount} solid\n体积: ${ev.volumeMm3.toFixed(5)} mm³\n表面积: ${ev.surfaceAreaMm2.toFixed(4)} mm²\n面数: ${ev.faceCount}\n孔半径: ${radius} mm\n三角形: ${mesh.triangleCount}\nRevision: ${doc.revision}`;
    status.textContent='精确几何构建成功';
  }catch(e){state.error=String(e);status.textContent=`错误：${e.message}`;console.error(e)}finally{setBusy(false)}
}
(async()=>{try{await client.initialize();await rebuild(4)}catch(e){state.error=String(e);status.textContent=`WASM 初始化失败: ${e.message}`;console.error(e);setBusy(false)}})();
document.querySelector('#rebuild').onclick=()=>{const r=Number(hole.value);if(!Number.isFinite(r)||r<=0||r>20){status.textContent='半径必须位于 (0,20] mm';return}void rebuild(r)};
document.querySelector('#radius6').onclick=()=>{hole.value='6';void rebuild(6)};
document.querySelector('#export').onclick=async()=>{if(!current||working)return;setBusy(true);try{const bytes=await client.exportStep(current);state.stepBytes=bytes.byteLength;const url=URL.createObjectURL(new Blob([bytes],{type:'application/step'}));const a=document.createElement('a');a.href=url;a.download=`precision-block-r${revision}.step`;a.click();setTimeout(()=>URL.revokeObjectURL(url),20_000);status.textContent=`已生成 ${bytes.length} 字节 STEP`}catch(e){state.error=String(e);status.textContent=e.message}finally{setBusy(false)}};
document.querySelector('#dispose').onclick=async()=>{if(!current||working)return;setBusy(true);try{await client.dispose(current);current=null;state.ready=false;if(solid){scene.remove(solid);solid.geometry.dispose();solid.material.dispose();solid=null}status.textContent='几何已释放'}finally{setBusy(false)}};
window.addEventListener('pagehide',()=>{client.close();renderer.dispose()});
