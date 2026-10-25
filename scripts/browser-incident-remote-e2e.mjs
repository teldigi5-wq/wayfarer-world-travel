// Browser-only smoke of the exact EXISTING Wayfarer incident artifact.
// Isolate every request: never send a live API query, third-party request,
// credential, POST, sign-in, booking or provider request. No domain mutations.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import {INCIDENT_BROWSER_ORIGIN,PROFILES,
  validateIncidentBrowserOrigin,classifyIncidentBrowserRequest
} from './incident-browser-policy.mjs';

const origin=validateIncidentBrowserOrigin(process.env.WAYFARER_INCIDENT_BROWSER_ORIGIN);
const reports=resolve('incident-browser-evidence');
mkdirSync(reports,{recursive:true});
const results=[],failures=[];
let browser;
try{
  browser=await chromium.launch({
    executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',
    headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']
  });
  for(const profile of PROFILES){
    const start=performance.now();
    const ctx=await browser.newContext({
      viewport:{width:profile.width,height:profile.height},
      reducedMotion:'reduce',locale:'en-US',serviceWorkers:'block',
      acceptDownloads:false,permissions:[]
    });
    const page=await ctx.newPage();
    const jsErrors=[],unexpectedStatuses=[];
    let blockedExternal=0,blockedApi=0,blockedMutation=0,staticRequests=0;
    page.setDefaultTimeout(17000);
    page.on('pageerror',err=>jsErrors.push(String(err.message||err).slice(0,350)));
    // Route installed BEFORE goto. No HTTP requests to providers/real API routes.
    await page.route('**/*',async route=>{
      const request=route.request();
      const kind=classifyIncidentBrowserRequest(request.url(),request.method());
      try{
        if(kind==='allow-static'){
          staticRequests++;
          await route.continue();
        }else{
          if(kind==='block-external')blockedExternal++;
          else if(kind==='block-api')blockedApi++;
          else blockedMutation++;
          await route.abort('blockedbyclient');
        }
      }catch{await route.abort('failed').catch(()=>{});}
    });
    page.on('response',r=>{
      if(r.url().startsWith(origin+'/')&&r.status()>=400){
        unexpectedStatuses.push({path:new URL(r.url()).pathname,status:r.status()});
      }
    });
    await page.addInitScript(()=>{
      window.__wayfarerIncidentCsp=[];
      document.addEventListener('securitypolicyviolation',ev=>{
        if(/^(script-src|style-src|object-src|base-uri|form-action)/.test(String(ev.effectiveDirective||''))){
          window.__wayfarerIncidentCsp.push(String(ev.effectiveDirective||''));
        }
      });
    });
    let stage='homepage';
    try{
      const response=await page.goto(origin+'/',{waitUntil:'domcontentloaded',timeout:45000});
      assert.equal(response?.status(),200,'Deployment must serve homepage (not login/error wall)');
      assert.ok((await page.title()).trim().length>=5,'Missing page title');
      await page.locator('#reel .destination').first().waitFor({state:'attached'});
      await page.locator('.hero-media').waitFor({state:'attached'});
      await page.waitForFunction(()=>document.querySelector('.hero-media')?.naturalWidth>0);
      const hero=await page.locator('.hero-media').evaluate(el=>new URL(el.currentSrc).pathname);
      assert.match(hero,/\.webp$/,'Optimized hero WebP must load');
      const views={};
      async function verifyFit(name){
        const m=await page.evaluate(()=>({
          width:window.innerWidth,
          root:document.documentElement.scrollWidth,
          body:document.body.scrollWidth,
          view:document.querySelector('.view.active')?.id||null
        }));
        assert.ok(m.root<=m.width+3,profile.name+' '+name+' horizontal overflow '+JSON.stringify(m));
        views[name]=m;
      }
      await verifyFit('discover');
      await page.screenshot({path:resolve(reports,profile.name+'-discover.png'),
        fullPage:false,animations:'disabled'});
      for(const view of ['studio','arrival','trips']){
        stage=view;
        await page.locator('nav.nav-links button[data-view="'+view+'"]').click();
        await page.locator('#'+view).waitFor({state:'visible'});
        assert.equal(await page.locator('#'+view).getAttribute('id'),view);
        if(view==='studio'){
          await page.locator('#itinerary .day').first().waitFor({state:'visible'});
          await page.screenshot({path:resolve(reports,profile.name+'-studio.png'),
            fullPage:false,animations:'disabled'});
        }
        await verifyFit(view);
      }
      assert.deepEqual(jsErrors,[],'Unexpected JavaScript page errors');
      const csp=await page.evaluate(()=>window.__wayfarerIncidentCsp||[]);
      assert.deepEqual(csp,[],'Executable CSP violations');
      assert.deepEqual(unexpectedStatuses,[],'Broken first-party static resource');
      assert.ok(staticRequests>0,'No first-party resources loaded');
      const record={profile:profile.name,result:'pass',views:Object.keys(views),
        viewport:[profile.width,profile.height],heroFormat:'webp',
        staticRequests,blockedExternal,blockedApi,blockedMutation,
        serverlessRequestsSent:0,providerRequestsSent:0,jsErrors:0,
        elapsedMs:Math.round(performance.now()-start),fit:views};
      results.push(record);
      console.log('WAYFARER_INCIDENT_BROWSER '+JSON.stringify(record));
    }catch(error){
      const report={profile:profile.name,stage,error:String(error?.message||error).slice(0,600),
        jsErrorCount:jsErrors.length,blockedApi,blockedExternal};
      failures.push(report);
      console.error('WAYFARER_INCIDENT_BROWSER_FAIL '+JSON.stringify(report));
      await page.screenshot({path:resolve(reports,profile.name+'-failure.png'),
        animations:'disabled',timeout:6000}).catch(()=>{});
    }finally{await ctx.close();}
  }
}finally{
  await browser?.close().catch(()=>{});
  writeFileSync(resolve(reports,'summary.json'),JSON.stringify({
    scope:'Immutable existing Wayfarer artifact, browser only; ALL real API and external requests blocked; no provider calls, users, bookings, domain writes or release authorization',
    immutableOrigin:INCIDENT_BROWSER_ORIGIN,
    expectedSourceSha:'4a09d5c8fb98b25f5e8f0d4877ea386e42eb14a0',
    node:process.version,profiles:results,failures,
    productionPromotionAuthorized:false,stagingHoldPreserved:true
  },null,2)+'\n');
}
console.log('WAYFARER_INCIDENT_BROWSER_SUMMARY '+JSON.stringify({
  total:PROFILES.length,passed:results.length,failed:failures.length,
  prodReleaseAuthorized:false
}));
if(failures.length)process.exitCode=1;
