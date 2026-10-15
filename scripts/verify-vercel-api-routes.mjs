/* Opt-in, rejected-method-only API route inspection.
 * Never call an endpoint's accepted method. In particular, do not execute
 * public research GET routes or private paid-provider POST routes. This is
 * an HTTP routing observation, not live provider/functionality QA.
 */
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateDeploymentUrl} from './verify-vercel-static.mjs';
import {API_METHOD_PROBES} from '../api-method-probes.mjs';

export function validateApiPreview(url,expectedHostname){
  if(!expectedHostname||typeof expectedHostname!=='string')
    throw Error('Authenticated deployment metadata hostname required');
  const origin=validateDeploymentUrl(url,{expectedHostname});
  // The inspector must never probe the actual public Production alias.
  if(new URL(origin).hostname==='wayfarer-world-travel.vercel.app')
    throw Error('Production route inspection is not authorized');
  return origin;
}

export async function inspectApiMethodRoutes({
  url,expectedHostname,fetchFn=fetch
}){
  const origin=validateApiPreview(url,expectedHostname);
  const paths=new Set(),probes=[];
  for(const target of API_METHOD_PROBES){
    if(paths.has(target.path)||target.probe===target.accepted||
      !['GET','POST'].includes(target.probe)||
      !target.path.startsWith('/api/')||
      !/^api\/[a-z-]+\.(?:js|mjs)$/.test(target.source))
      throw Error('Unsafe or duplicate API probe configuration');
    paths.add(target.path);
    let response;
    try{
      response=await fetchFn(origin+target.path,{
        method:target.probe,redirect:'error',cache:'no-store',
        credentials:'omit',referrerPolicy:'no-referrer',
        signal:AbortSignal.timeout(8000)
      });
      const status=response.status;
      const mime=(response.headers?.get('content-type')??'').toLowerCase();
      const nosniff=(response.headers?.get('x-content-type-options')??'').toLowerCase();
      const cache=(response.headers?.get('cache-control')??'').toLowerCase();
      const allow=(response.headers?.get('allow')??'').toUpperCase();
      const protectedStatus=status===401||status===403;
      const pass=status===405&&mime.includes('application/json')&&
        nosniff==='nosniff'&&cache==='no-store'&&
        (!target.allow||allow===target.allow);
      probes.push({path:target.path,method:target.probe,status,
        result:pass?'PASS':protectedStatus?'INCONCLUSIVE':'FAIL'});
    }catch{
      probes.push({path:target.path,method:target.probe,status:null,
        result:'INCONCLUSIVE_NETWORK'});
    }finally{
      try{await response?.body?.cancel?.()}catch{}
    }
  }
  const allProtected=probes.every(x=>x.status===401||x.status===403);
  const failed=probes.some(x=>x.result==='FAIL');
  const incomplete=probes.some(x=>x.result!=='PASS');
  return {
    verdict:allProtected?'INCONCLUSIVE_PROTECTED':
      failed?'FAIL':incomplete?'INCONCLUSIVE':'API_METHOD_GATE_EVIDENCE_ONLY',
    origin,counts:{
      passed:probes.filter(x=>x.result==='PASS').length,total:API_METHOD_PROBES.length
    },
    probes,
    suppliedHostnameMatched:true,
    deploymentOwnershipVerified:false,exactCommitVerified:false,
    acceptedApiMethodsVerified:false,providerCallsVerified:false,
    browserBehaviorVerified:false,productionApproval:false,
    caveat:'Only safe 405 method rejections checked. Does not validate actual accepted API methods, supplier connections, exact commit, protected Preview identity or real browser behavior.'
  };
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  const u=args.indexOf('--url'),h=args.indexOf('--expected-hostname');
  if(u<0||h<0||!args[u+1]||!args[h+1]){
    console.error('Usage: npm run verify:api-routing -- --url https://<reviewed-wayfarer-preview>.vercel.app/ --expected-hostname <same-host-from-Vercel-metadata>');
    process.exitCode=2;
  }else{
    try{
      const report=await inspectApiMethodRoutes({
        url:args[u+1],expectedHostname:args[h+1]
      });
      console.log(JSON.stringify(report,null,2));
      if(report.verdict!=='API_METHOD_GATE_EVIDENCE_ONLY')process.exitCode=1;
    }catch{
      console.error('API verification not started: invalid or unauthorized Preview origin');
      process.exitCode=2;
    }
  }
}
