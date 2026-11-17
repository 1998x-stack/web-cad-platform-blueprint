/** CAD-006 real planegcs + OCCT WASM browser E2E on all three engines.
 * Explicitly tests forced loss of WebGL without weakening geometry assertions. */
import {chromium,firefox,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';

const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','apps/studio/vite.config.mjs'],{
  stdio:['ignore','pipe','pipe'],env:{...process.env,CI:'true'}
});
let serverLog='';
server.stdout.on('data',b=>serverLog+=String(b));
server.stderr.on('data',b=>serverLog+=String(b));

async function exercise(engineName,engine,{forceFallback=false}={}){
  const args=engineName==='chromium'?['--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']:undefined;
  const browser=await engine.launch({headless:true,...(args?{args}:{})});
  try{
    const page=await browser.newPage({acceptDownloads:true});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    if(forceFallback){
      await page.addInitScript(()=>{
        const original=HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext=function(kind,...args){
          if(['webgl','experimental-webgl','webgl2'].includes(kind))return null;
          return original.call(this,kind,...args);
        };
      });
    }
    await page.goto('http://127.0.0.1:4173/sketch.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__SKETCH_E2E__?.ready||window.__SKETCH_E2E__?.error,null,{timeout:120000});
    let data=await page.evaluate(()=>window.__SKETCH_E2E__);
    if(data.error)throw new Error(engineName+': '+data.error);
    assert.ok(['webgl','fallback'].includes(data.renderBackend));
    if(forceFallback)assert.equal(data.renderBackend,'fallback');
    if(data.renderBackend==='fallback')assert.ok(await page.getByTestId('webgl-fallback').isVisible());
    assert.equal(data.sketch.status,'fully_constrained');
    assert.equal(data.sketch.degreesOfFreedom,0);
    assert.equal(data.geometry.solidCount,1);
    assert.ok(Math.abs(data.geometry.volumeMm3-216000)<.001);
    await page.locator('#width150').click();
    await page.waitForFunction(()=>window.__SKETCH_E2E__?.geometry?.volumeMm3>260000||window.__SKETCH_E2E__?.error,null,{timeout:120000});
    data=await page.evaluate(()=>window.__SKETCH_E2E__);
    if(data.error)throw new Error(engineName+': '+data.error);
    assert.ok(Math.abs(data.geometry.volumeMm3-270000)<.001);
    await page.locator('#under').click();
    await page.waitForFunction(()=>window.__SKETCH_E2E__?.sketch?.status==='underconstrained'||window.__SKETCH_E2E__?.error,null,{timeout:60000});
    data=await page.evaluate(()=>window.__SKETCH_E2E__);
    assert.equal(data.sketch.degreesOfFreedom,1);
    assert.equal(data.geometry.volumeMm3,270000,'last valid solid must persist');
    await page.locator('#conflict').click();
    await page.waitForFunction(()=>window.__SKETCH_E2E__?.sketch?.status==='conflicting'||window.__SKETCH_E2E__?.error,null,{timeout:60000});
    data=await page.evaluate(()=>window.__SKETCH_E2E__);
    assert.equal(data.sketch.valid,false);
    assert.equal(data.geometry.volumeMm3,270000,'conflicted sketch must not replace last valid solid');
    const [dl]=await Promise.all([page.waitForEvent('download',{timeout:120000}),page.locator('#export').click()]);
    assert.ok(dl.suggestedFilename().endsWith('.step'));
    await page.waitForFunction(()=>window.__SKETCH_E2E__?.stepBytes>1000,null,{timeout:30000});
    assert.deepEqual(errors,[],'uncaught page errors are forbidden');
    console.log('PASS '+engineName+(forceFallback?' (forced no WebGL)':'')+': real planegcs constraints, OCCT solid, negative states, STEP, '+data.renderBackend+' render mode');
  }finally{
    await browser.close();
  }
}

try{
  let online=false;
  for(let i=0;i<60;i++){
    if(server.exitCode!==null)break;
    try{if((await fetch('http://127.0.0.1:4173/sketch.html')).ok){online=true;break}}catch{}
    await sleep(500);
  }
  if(!online)throw new Error('Vite unavailable: '+serverLog.slice(-2000));
  for(const [name,browser] of Object.entries({chromium,firefox,webkit}))await exercise(name,browser);
  await exercise('chromium',chromium,{forceFallback:true});
}finally{
  server.kill('SIGTERM');
}
