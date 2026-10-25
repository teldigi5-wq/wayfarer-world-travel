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
    // Vercel CSP is mirrored by the local server; catch blocked executable code
    // without confusing intentionally-aborted third-party images/fonts with defects.
    await page.addInitScript(()=>{
      window.__wayfarerCspViolations=[];
      document.addEventListener('securitypolicyviolation',event=>{
        const kind=String(event.effectiveDirective||'');
        if(/^(script-src|style-src|connect-src|object-src|base-uri|form-action)/.test(kind)){
          window.__wayfarerCspViolations.push({
            directive:kind,blocked:String(event.blockedURI||'').slice(0,120)
          });
        }
      });
    });
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
      // A valid Wikipedia response without coordinates MUST fall through to
      // the approved public geocoding source; keep both network calls synthetic.
      let primaryQueries=0, fallbackQueries=0;
      const primaryFixture=async route=>{
        primaryQueries++;
        await route.fulfill({status:200,contentType:'application/json',
          body:JSON.stringify({ok:true,provider:'Wikipedia place index',results:[]})});
      };
      const geocodingFixture=async route=>{
        fallbackQueries++;
        await route.fulfill({status:200,contentType:'application/json',
          body:JSON.stringify({results:[{id:987651,name:'WayfarerMockTown',
            country:'Japan',country_code:'JP',admin1:'Test Prefecture',
            latitude:35.0,longitude:135.0,timezone:'Asia/Tokyo'}]})});
      };
      await page.route('**/api/explore?*',primaryFixture);
      await page.route('https://geocoding-api.open-meteo.com/v1/search?*',geocodingFixture);
      await page.locator('#wf-tab-explore').click();
      await page.locator('#world-query').waitFor({state:'visible'});
      assert.equal(await page.locator('#wf-tab-explore').getAttribute('aria-selected'),'true');
      await page.locator('#world-query').fill('WayfarerMockTown');
      await page.locator('#world-form button[type="submit"]').click();
      await page.locator('#world-results .world-result').first().waitFor({state:'visible'});
      ensure((await page.locator('#world-results').innerText()).includes('WayfarerMockTown'),
        'Fallback geocoding must render the mocked worldwide result');
      assert.equal(primaryQueries,1,'Wikipedia lookup should be attempted once');
      assert.equal(fallbackQueries,1,'Geocoding fallback should be attempted once');
      await page.unroute('**/api/explore?*',primaryFixture);
      await page.unroute('https://geocoding-api.open-meteo.com/v1/search?*',geocodingFixture);
      await page.locator('#wf-tab-overview').click();
      await page.locator('#itinerary .day').first().waitFor({state:'visible'});

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
      const motionSelector=profile.width<=650?'#mobile-motion-toggle':'#motion-toggle';
      ensure(await page.locator(motionSelector).isVisible(),'Motion control must be visible');
      const initial=await page.locator(motionSelector).getAttribute('aria-pressed');
      await page.locator(motionSelector).click();
      const after=await page.locator(motionSelector).getAttribute('aria-pressed');
      assert.equal(await page.locator('#motion-toggle').getAttribute('aria-pressed'),after);
      assert.equal(await page.locator('#mobile-motion-toggle').getAttribute('aria-pressed'),after);
      assert.notEqual(after,initial,'Motion preference toggle must update aria-pressed');
      ensure((await page.evaluate(()=>localStorage.getItem('wf-visual-motion-v1')))===(after==='true'?'on':'off'),
        'Motion preference must persist to local storage');
      assert.deepEqual(jsErrors,[],'No page JavaScript exceptions allowed');
      const policyViolations=await page.evaluate(()=>window.__wayfarerCspViolations||[]);
      assert.deepEqual(policyViolations,[],'No executable script/style CSP violations allowed');

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
