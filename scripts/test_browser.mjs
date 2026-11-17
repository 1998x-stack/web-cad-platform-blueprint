/** Browser E2E: exact WASM must still work when WebGL rendering is unavailable.
 * Runs on Chromium, Firefox and WebKit, plus a forced WebGL-denial control. */
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
      // Deny just WebGL contexts; real OCCT Worker / planegcs still execute unmodified.
      await page.addInitScript(()=>{
        const original=HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext=function(kind,...args){
          if(['webgl','experimental-webgl','webgl2'].includes(kind))return null;
          return original.call(this,kind,...args);
        };
      });
    }
    await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__CAD_E2E__?.ready||window.__CAD_E2E__?.error,null,{timeout:120000});
    let data=await page.evaluate(()=>window.__CAD_E2E__);
    if(data.error)throw new Error(engineName+': '+data.error);
    assert.equal(data.worker,'dedicated');
    assert.ok(['webgl','fallback'].includes(data.renderBackend),'must report actual render mode');
    if(forceFallback)assert.equal(data.renderBackend,'fallback','WebGL denial must trigger degraded mode');
    if(data.renderBackend==='fallback'){
      assert.ok(await page.getByTestId('webgl-fallback').isVisible(),'fallback message is visible');
    }
    assert.equal(data.evidence.solidCount,1);
    assert.ok(Math.abs(data.evidence.volumeMm3-214492.03552627692)<.001);
    await page.locator('#radius6').click();
    await page.waitForFunction(()=>window.__CAD_E2E__?.evidence?.volumeMm3<213000||window.__CAD_E2E__?.error,null,{timeout:120000});
    data=await page.evaluate(()=>window.__CAD_E2E__);
    if(data.error)throw new Error(engineName+': '+data.error);
    assert.ok(Math.abs(data.evidence.volumeMm3-212607.079934123)<.001);
    const [download]=await Promise.all([page.waitForEvent('download',{timeout:120000}),page.locator('#export').click()]);
    assert.ok(download.suggestedFilename().endsWith('.step'));
    await page.waitForFunction(()=>window.__CAD_E2E__?.stepBytes>1000,null,{timeout:30000});
    await page.locator('#dispose').click();
    await page.waitForFunction(()=>window.__CAD_E2E__?.ready===false,null,{timeout:30000});
    assert.deepEqual(errors,[],'uncaught page errors are forbidden');
    console.log('PASS '+engineName+(forceFallback?' (forced no WebGL)':'')+': real OCCT WASM build / edit / STEP / dispose, '+data.renderBackend+' render mode');
  }finally{
    await browser.close();
  }
}

try{
  let online=false;
  for(let i=0;i<60;i++){
    if(server.exitCode!==null)break;
    try{if((await fetch('http://127.0.0.1:4173/')).ok){online=true;break}}catch{}
    await sleep(500);
  }
  if(!online)throw new Error('Vite unavailable: '+serverLog.slice(-2000));
  for(const [name,browser] of Object.entries({chromium,firefox,webkit}))await exercise(name,browser);
  await exercise('chromium',chromium,{forceFallback:true});
}finally{
  server.kill('SIGTERM');
}
