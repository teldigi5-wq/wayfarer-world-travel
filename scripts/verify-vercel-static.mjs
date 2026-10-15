/* Read-only HTTP inspection of a specifically supplied Wayfarer deployment.
 * No deployment, cookies, authorization headers, API requests or paid calls.
 * This cannot attest a Git SHA or Vercel serverless route packaging. */
import {pathToFileURL} from 'node:url';
import {PUBLIC_STATIC_SET} from '../public-static-assets.mjs';
import path from 'node:path';

const positive=[
  ['/', 'text/html'],
  ['/data-and-privacy','text/html','data-and-privacy.html'],
  ['/premium-app.js','javascript'],
  ['/browser-data.js','javascript'],
  ['/favicon.svg','image/svg+xml'],
  ['/data.json','application/json'],
  ['/airports-index.json','application/json'],
  ['/country-atlas.json','application/json']
];
const denied=[
 '/server.mjs','/package.json','/vercel.json',
 '/provider-production-lock.mjs','/bounded-source-response.mjs',
 '/flight-selection-token.mjs','/scripts/audit-git-history.mjs',
 '/tests/local-preview-http.test.mjs','/docs/STAGE-50-RELEASE-DECISION.md',
 '/.env','/.git/config'
];
const headerRules=[
 ['content-security-policy',/script-src 'self'(?=;|$)/],
 ['content-security-policy',/frame-ancestors 'none'(?=;|$)/],
 ['x-content-type-options',/^nosniff$/i],
 ['x-frame-options',/^DENY$/i],
 ['referrer-policy',/^strict-origin-when-cross-origin$/i],
 ['strict-transport-security',/max-age=31536000/]
];
export const STATIC_POSITIVE_PATHS=Object.freeze(positive.map(x=>x[0]));
export const STATIC_DENIED_PATHS=Object.freeze(denied);

export function validateDeploymentUrl(input,{allowLoopback=false}={}){
 let url;
 try{url=new URL(input);}catch{throw Error('A valid deployment URL is required');}
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||
   (url.port&&!(allowLoopback&&url.hostname==='127.0.0.1'))||
   url.protocol!==(allowLoopback&&url.hostname==='127.0.0.1'?'http:':'https:'))
   throw Error('Deployment URL must be the exact root origin without credentials, path, query or hash');
 const host=url.hostname.toLowerCase();
 if(!(allowLoopback&&host==='127.0.0.1')&&
    !(host==='wayfarer-world-travel.vercel.app'||
      (host.startsWith('wayfarer-world-travel-')&&host.endsWith('.vercel.app'))))
   throw Error('Only the explicitly identified Wayfarer Vercel deployment hostname is permitted');
 return url.origin;
}
export async function inspectDeployment({url,fetchFn=fetch,allowLoopback=false}){
 const origin=validateDeploymentUrl(url,{allowLoopback});
 const responses=[];
 for(const [pathname,expectedMime,sourceFile] of positive){
   // Only fetch known static paths from this program's fixed allowlist.
   if(pathname!=='/'&&!PUBLIC_STATIC_SET.has(sourceFile??pathname.slice(1)))
     throw Error('Static inspection path is not in approved manifest: '+pathname);
   responses.push(await inspectPath(origin,pathname,expectedMime,'public',fetchFn));
 }
 for(const pathname of denied){
   responses.push(await inspectPath(origin,pathname,null,'private',fetchFn));
 }
 const top=responses[0];
 const headers=headerRules.map(([key,rule],i)=>{
   const actual=top.headers?.[key]??'';
   return {id:key+(i===1?'-frame-ancestors':''),pass:rule.test(actual)};
 });
 const failed=responses.filter(x=>x.result!=='PASS');
 const isProtected=responses.every(x=>x.status===401||x.status===403);
 const verdict=isProtected?'INCONCLUSIVE_PROTECTED':
   failed.length||headers.some(h=>!h.pass)?'FAIL':'STATIC_HTTP_PASS_ONLY';
 return {
   verdict,origin,counts:{
     staticPassed:responses.filter(x=>x.kind==='public'&&x.result==='PASS').length,
     staticTotal:positive.length,
     privateDenied:responses.filter(x=>x.kind==='private'&&x.result==='PASS').length,
     privateTotal:denied.length,
     requiredHeadersPassed:headers.filter(x=>x.pass).length,
     requiredHeadersTotal:headers.length
   },probes:responses.map(({path,kind,status,result})=>({path,kind,status,result})),
   headers:headers.map(({id,pass})=>({id,pass})),
   exactCommitVerified:false,serverlessApiVerified:false,
   browserBehaviorVerified:false,productionApproval:false,
   caveat:'Read-only static HTTP evidence only. Match the hostname and exact SHA via Vercel deployment metadata; check all eight APIs and browsers independently.'
 };
}
async function inspectPath(origin,pathname,mime,kind,fetchFn){
 let response;
 try{
   // HEAD requests do not consume remote response content or provider quotas.
   response=await fetchFn(origin+pathname,{
     method:'HEAD',redirect:'error',cache:'no-store',
     credentials:'omit',signal:AbortSignal.timeout(8000)
   });
   const status=response.status;
   const contentType=(response.headers?.get('content-type')??'').toLowerCase();
   const result=kind==='private'?(status===404||status===410?'PASS':
     status===401||status===403?'INCONCLUSIVE':'FAIL'):
     status===200&&contentType.includes(mime)?'PASS':
     status===401||status===403?'INCONCLUSIVE':'FAIL';
   // Headers are only assessed on the root HTML route; values never printed.
   const headers=pathname==='/'?Object.fromEntries(
     [...new Set(headerRules.map(x=>x[0]))].map(k=>[k,response.headers?.get(k)??''])
   ):null;
   try{await response.body?.cancel?.()}catch{}
   return {path:pathname,kind,status,result,headers};
 }catch{return {path:pathname,kind,status:null,result:'INCONCLUSIVE_NETWORK',headers:null};}
}
if(process.argv[1]&&path.resolve(process.argv[1])===
   path.resolve(new URL(import.meta.url).pathname)){
 const args=process.argv.slice(2),index=args.indexOf('--url');
 if(index<0||!args[index+1]){
   console.error('Usage: node scripts/verify-vercel-static.mjs --url https://wayfarer-world-travel-<deployment>.vercel.app/');
   process.exitCode=2;
 }else{
   try{
     const result=await inspectDeployment({url:args[index+1]});
     console.log(JSON.stringify(result,null,2));
     if(result.verdict!=='STATIC_HTTP_PASS_ONLY')process.exitCode=1;
   }catch{
     console.error('Inspection could not start: invalid or disallowed Wayfarer deployment URL');
     process.exitCode=2;
   }
 }
}
