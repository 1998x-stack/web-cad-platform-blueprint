/** CAD-006 actual planegcs + OCCT WASM in separate browser Workers. */
import {chromium} from 'playwright';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {setTimeout as sleep} from 'node:timers/promises';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','apps/studio/vite.config.mjs'],{stdio:['ignore','pipe','pipe'],env:{...process.env,CI:'true'}});
let log='';server.stdout.on('data',b=>log+=String(b));server.stderr.on('data',b=>log+=String(b));let browser;
try{
  let online=false;for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:4173/sketch.html')).ok){online=true;break}}catch{}await sleep(500)}
  if(!online)throw new Error('Vite unavailable: '+log.slice(-1000));
  browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({acceptDownloads:true});page.on('pageerror',e=>console.error('Page error:',e.message));page.on('console',e=>{if(e.type()==='error')console.error('Browser:',e.text())});
  await page.goto('http://127.0.0.1:4173/sketch.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__SKETCH_E2E__?.ready||window.__SKETCH_E2E__?.error,null,{timeout:120000});
  let st=await page.evaluate(()=>window.__SKETCH_E2E__);if(st.error)throw new Error(st.error);
  assert.equal(st.sketch.status,'fully_constrained');assert.equal(st.sketch.degreesOfFreedom,0);assert.equal(st.geometry.solidCount,1);
  assert.ok(Math.abs(st.geometry.volumeMm3-216000)<.001);
  await page.locator('#width150').click();await page.waitForFunction(()=>window.__SKETCH_E2E__?.geometry?.volumeMm3>260000||window.__SKETCH_E2E__?.error,null,{timeout:120000});
  st=await page.evaluate(()=>window.__SKETCH_E2E__);if(st.error)throw new Error(st.error);assert.ok(Math.abs(st.geometry.volumeMm3-270000)<.001);
  await page.locator('#under').click();await page.waitForFunction(()=>window.__SKETCH_E2E__?.sketch?.status==='underconstrained'||window.__SKETCH_E2E__?.error,null,{timeout:60000});
  st=await page.evaluate(()=>window.__SKETCH_E2E__);assert.equal(st.sketch.degreesOfFreedom,1);assert.equal(st.geometry.volumeMm3,270000);
  await page.locator('#conflict').click();await page.waitForFunction(()=>window.__SKETCH_E2E__?.sketch?.status==='conflicting'||window.__SKETCH_E2E__?.error,null,{timeout:60000});
  st=await page.evaluate(()=>window.__SKETCH_E2E__);assert.equal(st.sketch.valid,false);assert.equal(st.geometry.volumeMm3,270000);
  const [dl]=await Promise.all([page.waitForEvent('download',{timeout:120000}),page.locator('#export').click()]);assert.ok(dl.suggestedFilename().endsWith('.step'));
  console.log('PASS Chromium: real planegcs sketch constraints, under/conflict diagnostics, exact OCCT B-Rep and STEP export');
}finally{await browser?.close();server.kill('SIGTERM')}
