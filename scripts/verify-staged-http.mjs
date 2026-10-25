// Read-only, bounded HTTP surface verification against the exact staged build.
// No POST, valid provider search, cookie, redirect, alias assignment or promotion.
// The optional automation bypass header is sent ONLY to the validated immutable host.
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {stagedDeploymentOrigin} from './check-staged-deployment.mjs';
import {verifyHttpSurface} from './verify-production-http.mjs';

export async function verifyStagedHttpSurface({
  deploymentUrl,bypassSecret,transport=fetch
}={}){
  // Validate hostname before preparing any header or making a network call.
  const origin=stagedDeploymentOrigin(deploymentUrl).origin;
  if(bypassSecret!==undefined&&bypassSecret!==''&&
    (typeof bypassSecret!=='string'||bypassSecret.trim().length<16)){
    throw Error('BLOCKED: automation bypass secret is invalid; do not use a partial credential');
  }
  const hasBypass=typeof bypassSecret==='string'&&bypassSecret.length>=16;
  // The incident deployment has seen intermittent 403 edge denials on GETs for
  // internal files while the authorized Vercel fetch returns 404. Reduce the
  // CI scan's request rate, and retry a *single* denied/throttled read once.
  // Do not accept 403/429 as success; the shared verifier still requires 404.
  const liveNetwork=transport===fetch;
  const pause=ms=>liveNetwork?new Promise(done=>setTimeout(done,ms)):
    Promise.resolve();
  let accessDeniedRetries=0;
  const stageTransport=async (requestUrl,opts)=>{
    const request=new URL(requestUrl);
    if(request.origin!==origin||request.username||request.password||
      request.protocol!=='https:'||request.hash){
      throw Error('BLOCKED: staged audit cannot send requests to another origin');
    }
    if(opts?.method!=='GET'&&opts?.method!=='HEAD'){
      throw Error('BLOCKED: staged audit permits only GET and HEAD');
    }
    const headers={...opts.headers};
    if(hasBypass)headers['x-vercel-protection-bypass']=bypassSecret;
    const requestOptions={...opts,redirect:'error',headers};
    // HEAD and Range GETs are sequential, not a burst of parallel probes.
    await pause(250);
    let response=await transport(requestUrl,requestOptions);
    const denied=response?.status===403||response?.status===429;
    if(denied&&!request.pathname.startsWith('/api/')){
      accessDeniedRetries++;
      try{await response.body?.cancel?.()}catch{}
      await pause(2000);
      response=await transport(requestUrl,requestOptions);
    }
    return response;
  };
  // The original strict verifier still rejects any persistent 403/429 as well
  // as 200/206 source responses, and never reads or prints response bodies.
  const report=await verifyHttpSurface({origin,transport:stageTransport});
  return {...report,status:'STAGED_HTTP_SURFACE_PASS_ONLY',origin,
    protectionBypassUsed:hasBypass,
    transientAccessDenialsRetried:accessDeniedRetries,
    readOnly:true,stagedDeploymentIdentityVerified:false,
    realBrowserJourneysVerified:false,
    runtimeProviderLocksVerified:false,
    productionPromotionAuthorized:false,
    warning:accessDeniedRetries>0?
      'HTTP surface passed after transient edge denials; investigate repeatability, identity, browser, runtime and rollback separately.':
      'HTTP surface only; separate identity, browser, runtime and rollback release gates are still required.'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    const report=await verifyStagedHttpSurface({
      deploymentUrl:process.env.STAGED_URL,
      bypassSecret:process.env.VERCEL_AUTOMATION_BYPASS_SECRET
    });
    // Never print secrets, source code, response bodies or raw headers.
    console.log('WAYFARER_STAGED_HTTP_AUDIT '+JSON.stringify(report));
  }catch(e){
    console.error('WAYFARER_STAGED_HTTP_AUDIT_FAILED '+String(e?.message||'Unknown error'));
    process.exitCode=1;
  }
}
