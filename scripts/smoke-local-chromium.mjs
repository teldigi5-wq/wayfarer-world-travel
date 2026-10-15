/* Real offline Chrome/Chromium smoke with native Node 24 WebSocket/CDP.
   External HTTPS blocked, no providers, npm downloads or Vercel deployment.
   Reports outcomes only: never log DOM, storage values or private responses.
 */
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createStaticServer} from '../server.mjs';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function requireTrue(value,message){if(!value)throw Error(message);}
function findChrome(){
 const choices=[process.env.CHROME_BIN,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable',
   '/usr/bin/chromium','/usr/bin/chromium-browser','google-chrome','chromium'].filter(Boolean);
 for(const exe of choices){
   const x=spawnSync(exe,['--version'],{timeout:4000,encoding:'utf8'});
   if(x.status===0&&/Chrome|Chromium/i.test(x.stdout))return exe;
 }
 throw Error('Chrome is unavailable; the real-browser gate cannot be skipped');
}
async function browserSocket(profile,proc){
 for(let i=0;i<100;i++){
   if(proc.exitCode!==null)throw Error('Chrome exited before browser automation started');
   try{
     const [port]=String(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n');
     const response=await fetch('http://127.0.0.1:'+Number(port)+'/json/list',{
       signal:AbortSignal.timeout(1200)
     });
     const tabs=await response.json();
     const tab=tabs.find(t=>t.type==='page'&&t.webSocketDebuggerUrl);
     if(tab)return tab.webSocketDebuggerUrl;
   }catch{}
   await sleep(110);
 }
 throw Error('Local Chrome DevTools startup timed out');
}
async function connect(target){
 const socket=new WebSocket(target),pending=new Map();
 let sequence=0;
 await new Promise((resolve,reject)=>{
   const limit=setTimeout(()=>reject(Error('Chrome DevTools handshake timed out')),7000);
   socket.addEventListener('open',()=>{clearTimeout(limit);resolve()},{once:true});
   socket.addEventListener('error',()=>{clearTimeout(limit);reject(Error('Chrome DevTools handshake failed'))},{once:true});
 });
 socket.addEventListener('message',evt=>{
   let data;try{data=JSON.parse(evt.data)}catch{return;}
   if(!pending.has(data.id))return;
   const task=pending.get(data.id);
   pending.delete(data.id);clearTimeout(task.timer);
   if(data.error)task.reject(Error('Chrome DevTools command failed: '+task.method));
   else task.resolve(data.result??{});
 });
 const call=(method,params={})=>new Promise((resolve,reject)=>{
   requireTrue(socket.readyState===WebSocket.OPEN,'Chrome DevTools connection dropped');
   const id=++sequence;
   const timer=setTimeout(()=>{pending.delete(id);reject(Error('Chrome DevTools timeout: '+method))},11000);
   pending.set(id,{resolve,reject,timer,method});
   socket.send(JSON.stringify({id,method,params}));
 });
 return {call,close:()=>socket.close()};
}
async function evalBrowser(call,expression){
 const data=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
 if(data.exceptionDetails)throw Error('Chromium page script evaluation failed');
 return data.result?.value;
}
async function waitFor(call,expression,label){
 for(let i=0;i<65;i++){
   try{if(await evalBrowser(call,expression))return;}catch{}
   await sleep(130);
 }
 throw Error('Browser condition not met: '+label);
}
export async function runSmoke(){
 const binary=findChrome(),profile=await mkdtemp(path.join(tmpdir(),'wayfarer-cdp-'));
 const httpServer=createStaticServer();
 let chrome,devtools;
 const done=[];
 try{
   await new Promise((resolve,reject)=>{
     httpServer.once('error',reject);
     httpServer.listen(0,'127.0.0.1',resolve);
   });
   const base='http://127.0.0.1:'+httpServer.address().port;
   const flags=['--headless=new','--disable-gpu','--disable-dev-shm-usage',
     '--disable-extensions','--disable-background-networking','--disable-sync',
     '--no-first-run','--no-default-browser-check','--remote-debugging-port=0',
     '--user-data-dir='+profile,'--window-size=1440,900','about:blank'];
   if(typeof process.getuid==='function'&&process.getuid()===0)flags.unshift('--no-sandbox');
   chrome=spawn(binary,flags,{stdio:'ignore'});
   devtools=await connect(await browserSocket(profile,chrome));
   const {call}=devtools;
   await call('Page.enable');
   await call('Runtime.enable');
   await call('Network.enable');
   await call('Network.setBlockedURLs',{urls:['https://*']});
   await call('Emulation.setEmulatedMedia',{features:[
     {name:'prefers-reduced-motion',value:'reduce'}
   ]});
   await call('Page.navigate',{url:base+'/'});
   await waitFor(call,"document.readyState==='complete' && !!document.getElementById('main-content')",
     'homepage loads');
   requireTrue(String(await evalBrowser(call,'document.title')).includes('Wayfarer'),
     'Wayfarer title not loaded');
   requireTrue(await evalBrowser(call,
     "document.getElementById('discover')?.classList.contains('active')"),
     'Discover inactive on first visit');
   done.push('Desktop Chromium loaded the real homepage and scripts');
   await evalBrowser(call,"document.getElementById('wf-splash-skip')?.click()");
   for(const section of ['studio','arrival','trips','discover']){
     const action="(()=>{const btn=document.querySelector('.nav-links [data-view="+
       JSON.stringify(section)+"]');if(!btn)return false;btn.click();return true})()";
     requireTrue(await evalBrowser(call,action),'No navigation action for '+section);
     await waitFor(call,"document.getElementById("+JSON.stringify(section)+
       ")?.classList.contains('active')",section+' view');
   }
   done.push('Actual click navigation Discover → Studio → Arrival → Trips');
   await call('Emulation.setDeviceMetricsOverride',{
     width:390,height:844,deviceScaleFactor:2,mobile:true
   });
   await sleep(250);
   const size=await evalBrowser(call,
     "({viewport:document.documentElement.clientWidth,content:document.documentElement.scrollWidth})");
   requireTrue(size.content<=size.viewport+4,'390px viewport horizontal overflow');
   requireTrue(await evalBrowser(call,
     "Boolean(document.getElementById('main-content')&&document.querySelector('.nav-links'))"),
     'Mobile navigation or main region not rendered');
   done.push('390px mobile browser: primary navigation present and no horizontal overflow');
   await call('Page.navigate',{url:base+'/data-and-privacy.html'});
   await waitFor(call,"document.readyState==='complete'&&!!document.getElementById('wf-data-open')",
     'browser data page');
   const privacyScript="(()=>{"+
     "localStorage.setItem('wf-trips-v2','synthetic-trip');"+
     "localStorage.setItem('wf-checks-v2','synthetic-checks');"+
     "localStorage.setItem('wf-unrelated-test','keep');"+
     "document.getElementById('wf-data-open').click();"+
     "const armed=!document.getElementById('wf-data-confirmation').hidden&&"+
       "localStorage.getItem('wf-trips-v2')!==null;"+
     "document.getElementById('wf-data-cancel').click();"+
     "const cancelled=localStorage.getItem('wf-trips-v2')!==null;"+
     "document.getElementById('wf-data-open').click();"+
     "document.getElementById('wf-data-confirm').click();"+
     "const deleted=localStorage.getItem('wf-trips-v2')===null&&"+
       "localStorage.getItem('wf-checks-v2')===null;"+
     "const unrelated=localStorage.getItem('wf-unrelated-test')==='keep';"+
     "localStorage.removeItem('wf-unrelated-test');"+
     "return {armed,cancelled,deleted,unrelated};})()";
   const privacy=await evalBrowser(call,privacyScript);
   for(const [test,passed] of Object.entries(privacy??{}))
     requireTrue(passed===true,'Privacy UI failed: '+test);
   requireTrue(Object.keys(privacy??{}).length===4,'Privacy UI was not exercised');
   done.push('Real browser confirmation/cancel, deletion and unrelated-key retention');
   return {status:'PASS',checks:done.length,results:done,
     browser:binary.split('/').at(-1),
     limits:'Offline Chrome with remote HTTPS blocked. No Vercel, external imagery, paid API, Firefox, Safari or screen-reader validation.'};
 }finally{
   try{devtools?.close()}catch{}
   if(chrome&&chrome.exitCode===null)chrome.kill('SIGTERM');
   if(httpServer.listening)await new Promise(resolve=>httpServer.close(()=>resolve()));
   await sleep(220);
   await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:120}).catch(()=>{});
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{process.stdout.write(JSON.stringify(await runSmoke(),null,2)+'\n');}
 catch(e){
   process.stderr.write('BROWSER_SMOKE_FAIL: '+String(e?.message??e).slice(0,220)+'\n');
   process.exitCode=1;
 }
}
