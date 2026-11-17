/** Browser E2E: real WASM inside a dedicated Worker. Requires Playwright Chromium. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','apps/studio/vite.config.mjs'],{stdio:['ignore','pipe','pipe'],env:{...process.env,CI:'true'}});
let serverLog='';server.stdout.on('data',b=>serverLog+=String(b));server.stderr.on('data',b=>serverLog+=String(b));
let browser;
try {
  let online=false;
  for(let i=0;i<60;i++){
    if(server.exitCode!==null)break;
    try{const r=await fetch('http://127.0.0.1:4173');if(r.ok){online=true;break}}catch{}
    await sleep(500);
  }
  if(!online)throw new Error(`Vite failed to start: ${serverLog.slice(-2000)}`);
  browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({acceptDownloads:true});
  console.log('Browser started; loading Studio...');
  page.on('pageerror',e=>console.error('Page error:',e.message));
  page.on('console',m=>{if(m.type()==='error')console.error('Browser console:',m.text())});
  page.on('requestfailed',r=>console.error('Request failed:',r.url(),r.failure()?.errorText));
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});console.log('DOM loaded; checking Worker...');
  await page.waitForFunction(()=>window.__CAD_E2E__?.ready || window.__CAD_E2E__?.error,null,{timeout:60_000});
  let data=await page.evaluate(()=>window.__CAD_E2E__);
  if(data.error)throw new Error(`Browser WASM error: ${data.error}`);
  assert.equal(data.worker,'dedicated');assert.equal(data.evidence.solidCount,1);
  assert.ok(Math.abs(data.evidence.volumeMm3-214492.03552627692)<.001,`baseline volume ${data.evidence.volumeMm3}`);
  await page.locator('#radius6').click();
  await page.waitForFunction(()=>window.__CAD_E2E__?.evidence?.volumeMm3<213000||window.__CAD_E2E__?.error,null,{timeout:60_000});
  data=await page.evaluate(()=>window.__CAD_E2E__);
  if(data.error)throw new Error(data.error);
  assert.ok(Math.abs(data.evidence.volumeMm3-212607.079934123)<.001,`modified volume ${data.evidence.volumeMm3}`);
  const [download]=await Promise.all([page.waitForEvent('download',{timeout:120_000}),page.locator('#export').click()]);
  assert.ok(download.suggestedFilename().endsWith('.step'));
  await page.waitForFunction(()=>window.__CAD_E2E__?.stepBytes>1000,null,{timeout:30_000});
  await page.locator('#dispose').click();await page.waitForFunction(()=>window.__CAD_E2E__?.ready===false);
  console.log('PASS browser WASM dedicated-worker build + parametric edit + STEP download + dispose');
}finally{await browser?.close();server.kill('SIGTERM')}
