// Offline, real-Chrome UI smoke tests against the static site on localhost.
// External requests are aborted. This never authenticates, books, or uses paid APIs.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import {chromium} from 'playwright-core';

const root = 'http://127.0.0.1:4173/';
const output = resolve('browser-e2e-results');
const profiles = [
  {name:'phone-320',width:320,height:720},
  {name:'phone-390',width:390,height:844},
  {name:'tablet-768',width:768,height:1024},
  {name:'desktop-1440',width:1440,height:900}
];
const wait = ms => new Promise(resolve => setTimeout(resolve,ms));
const child=spawn(process.execPath,['server.mjs'],{stdio:['ignore','ignore','pipe']});
let serverError='';
child.stderr.on('data',x=>{serverError=(serverError+String(x)).slice(-1000)});
async function ready() {
  for(let i=0;i<80;i++){
    if(child.exitCode!==null)throw Error('Local server exited: '+serverError);
    try {const r=await fetch(root,{signal:AbortSignal.timeout(800)});if(r.status===200)return}
    catch {}
    await wait(100);
  }
  throw Error('Local Wayfarer server unavailable: '+serverError);
}
function ensure(condition,message){assert.ok(condition,message)}
const failures=[],results=[];
let browser;
try {
  await ready();
  mkdirSync(output,{recursive:true});
  browser=await chromium.launch({
    executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',
    headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']
  });
  for(const profile of profiles){
    const started=performance.now();
    const context=await browser.newContext({
      viewport:{width:profile.width,height:profile.height},
      reducedMotion:'reduce',locale:'en-US'
    });
    let blockedExternal=0,localRequests=0;
    const jsErrors=[];
    const page=await context.newPage();
    page.setDefaultTimeout(17000);
    page.on('pageerror',e=>jsErrors.push(String(e.message||e)));
    await page.route('**/*',async route=>{
      const url=route.request().url();
      if(url.startsWith(root)){localRequests++;await route.continue();}
      else {blockedExternal++;await route.abort('blockedbyclient');}
    });
    const checkFit=async view=>{
      const measures=await page.evaluate(()=>({
        viewport:window.innerWidth,
        document:document.documentElement.scrollWidth,
        body:document.body.scrollWidth,
        active:document.querySelector('.view.active')?.id,
        pageTitle:document.title
      }));
      ensure(measures.document<=measures.viewport+3,
        profile.name+' '+view+' horizontal overflow '+JSON.stringify(measures));
      return measures;
    };
    try {
      const response=await page.goto(root,{waitUntil:'domcontentloaded',timeout:45000});
      assert.equal(response.status(),200);
      await page.locator('#reel .destination').first().waitFor({state:'attached'});
      ensure(await page.locator('#discover').evaluate(el=>el.classList.contains('active')),'Discover must be active');
      ensure(await page.locator('.hero-media').evaluate(img=>img.complete&&img.naturalWidth>0),
        'Hero image must load successfully');
      const heroSrc=await page.locator('.hero-media').evaluate(el=>new URL(el.currentSrc).pathname);
      ensure(heroSrc.endsWith('.webp'),'Optimized hero must be selected');
      const discover=await checkFit('discover');
      await page.screenshot({path:resolve(output,profile.name+'-discover.png'),fullPage:false,animations:'disabled'});

      // Test actual button interaction and the working local itinerary.
      await page.locator('nav.nav-links button[data-view="studio"]').click();
      await page.locator('#studio').waitFor({state:'visible'});
      await page.locator('#itinerary .day').first().waitFor({state:'visible'});
      const studio=await checkFit('studio');
      await page.locator('#save-trip').click();
      const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('wf-trips-v2')||'[]'));
      ensure(saved.some(x=>x.destination==='Kyoto'),'Save journey must persist locally');
      await page.screenshot({path:resolve(output,profile.name+'-studio.png'),animations:'disabled'});

      await page.locator('nav.nav-links button[data-view="arrival"]').click();
      await page.locator('#arrival').waitFor({state:'visible'});
      const arrival=await checkFit('arrival');
      ensure((await page.locator('#arrival-context-destination').innerText()).includes('Kyoto'),
        'Arrival must reflect the planned destination');

      await page.locator('nav.nav-links button[data-view="trips"]').click();
      await page.locator('#trips').waitFor({state:'visible'});
      await page.locator('#journey-count').getByText('1 journey',{exact:true}).waitFor();
      const trips=await checkFit('trips');
      await page.locator('#journey-search').fill('NoMatchDestination');
      ensure((await page.locator('#saved').innerText()).includes('No saved journeys match'),
        'Empty search must communicate no matches');
      await page.locator('#journey-search').fill('Kyoto');
      ensure((await page.locator('#saved').innerText()).includes('Kyoto'),
        'Saved search must recover matching destinations');
      await page.screenshot({path:resolve(output,profile.name+'-journeys.png'),animations:'disabled'});

      // User motion preference is a functional accessibility control.
      const initial=await page.locator('#motion-toggle').getAttribute('aria-pressed');
      await page.locator('#motion-toggle').click();
      const after=await page.locator('#motion-toggle').getAttribute('aria-pressed');
      assert.notEqual(after,initial,'Motion preference toggle must update aria-pressed');
      ensure((await page.evaluate(()=>localStorage.getItem('wf-visual-motion-v1')))===(after==='true'?'on':'off'),
        'Motion preference must persist to local storage');
      assert.deepEqual(jsErrors,[],'No page JavaScript exceptions allowed');

      const row={profile:profile.name,viewport:[profile.width,profile.height],
        result:'pass',elapsedMs:Math.round(performance.now()-started),
        visited:['discover','studio','arrival','trips'],heroFormat:'webp',
        fit:{discover,studio,arrival,trips},blockedExternal,localRequests,
        accountsCreated:0,paidProviderCalls:0,javaScriptErrors:0};
      results.push(row);
      console.log('BROWSER_E2E '+JSON.stringify(row));
    }catch(e){
      const info={profile:profile.name,error:String(e?.stack||e),jsErrors};
      failures.push(info);
      console.error('BROWSER_E2E_FAIL '+JSON.stringify(info));
      await page.screenshot({path:resolve(output,profile.name+'-failure.png'),timeout:6000})
        .catch(()=>{});
    }finally {await context.close()}
  }
}finally {
  if(browser)await browser.close().catch(()=>{});
  child.kill('SIGTERM');
  writeFileSync(resolve(output,'summary.json'),JSON.stringify({
    title:'Wayfarer offline responsive Chrome end-to-end smoke test',
    scope:'Local static server only; outside HTTP blocked; synthetic on-device journeys; no Vercel, provider traffic, Firebase or real bookings',
    gitSha:process.env.GITHUB_SHA||'local',
    node:process.version,profiles:results,failures},null,2)+'\n');
}
console.log('BROWSER_E2E_SUMMARY '+JSON.stringify({
  passed:results.length,failed:failures.length,profiles:profiles.length
}));
if(failures.length)process.exitCode=1;
