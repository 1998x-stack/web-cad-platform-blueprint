/** Browser smoke: real sketch WASM and OCCT Worker, no WebGL dependency. */
import {chromium,firefox,webkit} from 'playwright';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {setTimeout as sleep} from 'node:timers/promises';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','apps/studio/vite.config.mjs'],{stdio:['ignore','pipe','pipe'],env:{...process.env,CI:'true'}});
let output='';server.stdout.on('data',v=>output+=v);server.stderr.on('data',v=>output+=v);
try{
 let up=false;for(let i=0;i<70;i++){try{const response=await fetch('http://127.0.0.1:4173/profile.html');if(response.ok){up=true;break}}catch{}await sleep(500)}
 if(!up)throw new Error('Vite unavailable: '+output.slice(-2000));
 for(const [name,tool] of [['chromium',chromium],['firefox',firefox],['webkit',webkit]]){
  const args=name==='chromium'?['--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader']:undefined;
  const browser=await tool.launch({headless:true,...(args?{args}:{})});
  try{
   const page=await browser.newPage({acceptDownloads:true});const errs=[];page.on('pageerror',e=>errs.push(e.message));
   await page.goto('http://127.0.0.1:4173/profile.html',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.__PROFILE_E2E__?.ready||window.__PROFILE_E2E__?.error,null,{timeout:150000});
   let state=await page.evaluate(()=>window.__PROFILE_E2E__);if(state.error)throw new Error(`${name}: ${state.error}`);
   assert.ok(Math.abs(state.geometry.volumeMm3-60000)<0.001,`${name} triangle ${state.geometry.volumeMm3}`);
   await page.locator('#preset').selectOption('concave');await page.waitForFunction(()=>window.__PROFILE_E2E__?.activePreset==='concave'&&Math.abs(window.__PROFILE_E2E__?.geometry?.volumeMm3-56000)<0.001||window.__PROFILE_E2E__?.error,null,{timeout:150000});
   state=await page.evaluate(()=>window.__PROFILE_E2E__);if(state.error)throw new Error(`${name}: ${state.error}`);
   assert.ok(Math.abs(state.geometry.volumeMm3-56000)<0.001);
   await page.locator('#depth').fill('12');await page.locator('#build').click();await page.waitForFunction(()=>Math.abs(window.__PROFILE_E2E__?.geometry?.volumeMm3-67200)<0.001||window.__PROFILE_E2E__?.error,null,{timeout:150000});
   state=await page.evaluate(()=>window.__PROFILE_E2E__);if(state.error)throw new Error(`${name}: ${state.error}`);
   await page.locator('#undo').click();await page.waitForFunction(()=>Math.abs(window.__PROFILE_E2E__?.geometry?.volumeMm3-56000)<0.001,null,{timeout:150000});
   await page.locator('#redo').click();await page.waitForFunction(()=>Math.abs(window.__PROFILE_E2E__?.geometry?.volumeMm3-67200)<0.001,null,{timeout:150000});
   const [download]=await Promise.all([page.waitForEvent('download',{timeout:150000}),page.locator('#export').click()]);assert.ok(download.suggestedFilename().endsWith('.step'));
   assert.deepEqual(errs,[]);console.log(`PASS ${name}: triangle/concave real WASM, revision undo/redo, STEP export`);
  }finally{await browser.close();}
 }
}finally{server.kill('SIGTERM')}
