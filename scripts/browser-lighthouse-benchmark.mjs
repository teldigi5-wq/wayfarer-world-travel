import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {performance} from 'node:perf_hooks';

// LOCAL-ONLY Lighthouse baseline. No production traffic, paid APIs, or real accounts.
const origin='http://127.0.0.1:4173/';
const output=resolve('browser-benchmark-reports');
const cli=resolve('node_modules/.bin/lighthouse');
const wait=ms=>new Promise(done=>setTimeout(done,ms));
const server=spawn(process.execPath,['server.mjs'],{stdio:['ignore','pipe','pipe']});
let failure='';server.stderr.on('data',x=>failure+=String(x).slice(-500));
async function siteReady(){
  for(let i=0;i<80;i++){
    if(server.exitCode!==null)throw Error('Static server exited: '+failure);
    try {const r=await fetch(origin,{signal:AbortSignal.timeout(500)});if(r.ok)return}
    catch{}
    await wait(100);
  }
  throw Error('Local page could not be served: '+failure);
}
async function runCli(args){
  const child=spawn(cli,args,{stdio:['ignore','pipe','pipe'],env:{...process.env,CI:'true'}});
  let err='';child.stderr.on('data',b=>{err=(err+String(b)).slice(-5000)});
  return await new Promise((done,reject)=>{
    const timer=setTimeout(()=>{child.kill('SIGTERM');reject(Error('Lighthouse timeout'))},180000);
    child.once('error',error=>{clearTimeout(timer);reject(error)});
    child.once('exit',(code,signal)=>{clearTimeout(timer);if(code===0)done();else reject(Error('Lighthouse failed: '+code+' '+signal+' '+err))});
  });
}
const profiles=[
  {name:'mobile',args:[]},
  {name:'tablet',args:['--form-factor=mobile','--screenEmulation.width=768','--screenEmulation.height=1024','--screenEmulation.deviceScaleFactor=1','--screenEmulation.mobile=true']},
  {name:'desktop',args:['--preset=desktop']}
];
const value=(report,id)=>{
  const row=report.audits?.[id];
  return {value:typeof row?.numericValue==='number'?Number(row.numericValue.toFixed(2)):null,
    unit:row?.numericUnit||null,display:row?.displayValue||null,score:row?.score??null};
};
try {
  await siteReady();
  mkdirSync(output,{recursive:true});
  const results=[];
  for(const profile of profiles){
    const dest=join(output,profile.name+'.json');
    const started=performance.now();
    await runCli([origin,'--quiet','--output=json','--output-path='+dest,
      '--only-categories=performance,accessibility,best-practices,seo',
      '--blocked-url-patterns=https://*',
      '--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage --disable-gpu',
      '--max-wait-for-load=45000',...profile.args]);
    const report=JSON.parse(readFileSync(dest,'utf8'));
    assert.ok(!report.runtimeError,'Lighthouse runtime error for '+profile.name+': '+JSON.stringify(report.runtimeError));
    assert.equal(new URL(report.finalUrl).hostname,'127.0.0.1','Audit must target localhost only');
    assert.ok(report.categories?.performance,'Missing performance category');
    const scores=Object.fromEntries(['performance','accessibility','best-practices','seo']
      .map(name=>[name,report.categories?.[name]?.score==null?null:Math.round(report.categories[name].score*100)]));
    const metrics=Object.fromEntries([
      'first-contentful-paint','largest-contentful-paint',
      'total-blocking-time','cumulative-layout-shift','speed-index','interactive'
    ].map(id=>[id,value(report,id)]));
    const problems=Object.values(report.audits||{})
      .filter(x=>x.score!=null && x.score<0.9 && x.scoreDisplayMode==='numeric')
      .sort((a,b)=>(a.score??1)-(b.score??1))
      .slice(0,7).map(x=>({id:x.id,title:x.title,score:x.score,display:x.displayValue||null}));
    const row={profile:profile.name,requestedEmulation:profile.args,
      actualEmulation:report.configSettings?.screenEmulation||null,
      lighthouseVersion:report.lighthouseVersion,chromeUserAgent:report.userAgent,
      auditWallTimeMs:Math.round(performance.now()-started),scores,metrics,priorityAudits:problems};
    console.log('LIGHTHOUSE_BENCH '+JSON.stringify(row));
    results.push(row);
  }
  const summary={title:'Wayfarer local-only browser Lighthouse baseline',
    scope:'Local static server and GitHub-hosted Chrome; NO production, authentic user accounts, real API calls, booking or paid providers',
    caution:'Simulated Lighthouse scores are runner- and network-dependent; not field Core Web Vitals or a production SLA',
    gitSha:process.env.GITHUB_SHA||'local',node:process.version,
    profileCount:results.length,results};
  writeFileSync(join(output,'summary.json'),JSON.stringify(summary,null,2)+'\n');
  console.log('LIGHTHOUSE_BENCH_SUMMARY '+JSON.stringify({profiles:results.length,
    scores:results.map(r=>({name:r.profile,...r.scores}))}));
}finally{server.kill('SIGTERM')}
