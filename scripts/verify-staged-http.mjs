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
    return transport(requestUrl,{...opts,redirect:'error',headers});
  };
  // Shared review inventory: all historical internal paths, the public manifest,
  // safe invalid-method/input API guards, headers and expected MIME types.
  const report=await verifyHttpSurface({origin,transport:stageTransport});
  return {...report,status:'STAGED_HTTP_SURFACE_PASS_ONLY',origin,
    protectionBypassUsed:hasBypass,
    readOnly:true,stagedDeploymentIdentityVerified:false,
    realBrowserJourneysVerified:false,
    runtimeProviderLocksVerified:false,
    productionPromotionAuthorized:false,
    warning:'HTTP surface only; separate identity, browser, runtime and rollback release gates are still required.'};
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
