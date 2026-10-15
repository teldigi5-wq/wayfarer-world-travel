/* Read-only, opt-in static HTTPS verification.
 * A deployment hostname must be checked against trusted Vercel metadata by
 * the reviewer. This script cannot independently authenticate project owner
 * or Git SHA. It never accesses any /api endpoint or paid travel provider.
 * Sensitive-path GET probes read no response body and never print content.
 */
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PUBLIC_STATIC_SET} from '../public-static-assets.mjs';

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

export function validateDeploymentUrl(input,{
  allowLoopback=false,expectedHostname=null
}={}){
 let url;
 try{url=new URL(input);}catch{throw Error('A valid deployment URL is required');}
 const host=url.hostname.toLowerCase();
 const local=allowLoopback&&host==='127.0.0.1';
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||
   (url.port&&!local)||(local?url.protocol!=='http:':url.protocol!=='https:'))
   throw Error('Require an exact HTTPS deployment root URL without credentials, paths, queries or fragments');
 if(local)return url.origin;
 if(host==='wayfarer-world-travel.vercel.app'){
   if(expectedHostname&&expectedHostname!==host)
     throw Error('Vercel deployment hostname and supplied project metadata disagree');
   return url.origin;
 }
 // Do not assume that an arbitrary prefix-matching *.vercel.app deployment
 // belongs to Wayfarer. The reviewer must supply the *exact* host obtained
 // from the authenticated Vercel deployment metadata for this project.
 if(!expectedHostname||typeof expectedHostname!=='string'||
   !/^[a-z0-9-]+\.vercel\.app$/.test(expectedHostname)||
   !expectedHostname.startsWith('wayfarer-world-travel-')||
   host!==expectedHostname)
   throw Error('Preview hostname must exactly match separately inspected Vercel metadata');
 return url.origin;
}
const denial=code=>code===404||code===410?'PASS':
  code===401||code===403?'INCONCLUSIVE':'FAIL';

async function probe(origin,pathname,mime,kind,method,fetchFn){
 let response;
 try{
   const options={
     method,redirect:'error',cache:'no-store',credentials:'omit',
     referrerPolicy:'no-referrer',signal:AbortSignal.timeout(8000)
   };
   // A one-byte range is enough to prove whether GET exposes the file.
   // Do not read, inspect, decode or log response bodies, even on failure.
   if(method==='GET')options.headers={Range:'bytes=0-0'};
   response=await fetchFn(origin+pathname,options);
   const status=response.status;
   const type=(response.headers?.get('content-type')??'').toLowerCase();
   const result=kind==='private'?denial(status):
     status===200&&type.includes(mime)?'PASS':
     status===401||status===403?'INCONCLUSIVE':'FAIL';
   const headers=pathname==='/'?Object.fromEntries(
     [...new Set(headerRules.map(([key])=>key))].map(key=>[
       key,response.headers?.get(key)??''
     ])
   ):null;
   return {path:pathname,kind,method,status,result,headers};
 }catch{return {path:pathname,kind,method,status:null,result:'INCONCLUSIVE_NETWORK',headers:null};}
 finally{
   try{await response?.body?.cancel?.()}catch{}
 }
}
export async function inspectDeployment({
  url,fetchFn=fetch,allowLoopback=false,expectedHostname=null
}){
 const origin=validateDeploymentUrl(url,{allowLoopback,expectedHostname});
 const responses=[];
 for(const [pathname,mime,sourceFile] of positive){
   if(pathname!=='/'&&!PUBLIC_STATIC_SET.has(sourceFile??pathname.slice(1)))
     throw Error('Static inspection path is not in reviewed public manifest: '+pathname);
   responses.push(await probe(origin,pathname,mime,'public','HEAD',fetchFn));
 }
 for(const pathname of denied){
   responses.push(await probe(origin,pathname,null,'private','HEAD',fetchFn));
   responses.push(await probe(origin,pathname,null,'private','GET',fetchFn));
 }
 const home=responses[0];
 const headers=headerRules.map(([key,re],i)=>({
   id:key+(i===1?'-frame-ancestors':''),pass:re.test(home.headers?.[key]??'')
 }));
 const statuses=responses.filter(x=>x.status!==401&&x.status!==403);
 const authWall=statuses.length===0;
 const failures=responses.some(x=>x.result==='FAIL');
 const unverified=responses.some(x=>x.result!=='PASS');
 const verdict=authWall?'INCONCLUSIVE_PROTECTED':
   failures||(home.status===200&&headers.some(h=>!h.pass))?'FAIL':
   unverified?'INCONCLUSIVE':'STATIC_HTTP_PASS_ONLY';
 return {
   verdict,origin,
   counts:{
     staticPassed:responses.filter(x=>x.kind==='public'&&x.result==='PASS').length,
     staticTotal:positive.length,
     privateDenied:denied.filter(p=>responses.filter(r=>r.path===p).every(
       x=>x.result==='PASS')).length,
     privateTotal:denied.length,
     requiredHeadersPassed:headers.filter(h=>h.pass).length,
     requiredHeadersTotal:headers.length
   },
   probes:responses.map(({path,kind,method,status,result})=>({path,kind,method,status,result})),
   headers:headers.map(({id,pass})=>({id,pass})),
   metadataHostnameMatched:Boolean(expectedHostname),
   deploymentOwnershipVerified:false,
   exactCommitVerified:false,serverlessApiVerified:false,
   browserBehaviorVerified:false,productionApproval:false,
   caveat:'HEAD and bodyless Range GET static-only evidence. Independently confirm Vercel project ownership and exact SHA; check all eight APIs and browsers.'
 };
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),index=args.indexOf('--url');
 const expected=args.indexOf('--expected-hostname');
 if(index<0||!args[index+1]){
   console.error('Usage: npm run verify:deployment -- --url https://<verified-wayfarer-deployment>.vercel.app/ --expected-hostname <hostname-from-Vercel-metadata>');
   process.exitCode=2;
 }else{
   try{
     const result=await inspectDeployment({
       url:args[index+1],
       expectedHostname:expected<0?null:args[expected+1]
     });
     console.log(JSON.stringify(result,null,2));
     if(result.verdict!=='STATIC_HTTP_PASS_ONLY')process.exitCode=1;
   }catch{
     console.error('Invalid deployment hostname or URL; verify exact hostname using authenticated Vercel project metadata');
     process.exitCode=2;
   }
 }
}
