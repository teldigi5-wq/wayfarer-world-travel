// Read-only, fail-closed identity preflight for the manually approved Vercel CLI stage.
// Project-scoped Vercel API access alone does not establish CLI /v2/user access.
// No response bodies, tokens, cookies, environment values, or user profiles are logged.
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {PROJECT_ID, TEAM_ID} from './check-staging-aliases.mjs';

const ENDPOINTS=Object.freeze([
  ['/v9/projects/'+encodeURIComponent(PROJECT_ID)+'?teamId='+encodeURIComponent(TEAM_ID),'project'],
  ['/v2/user','user'],
  ['/teams/'+encodeURIComponent(TEAM_ID),'team']
]);

export async function assertVercelCliIdentityAccess({token,transport=fetch}={}){
  if(typeof token!=='string'||token.trim().length<16){
    throw Error('BLOCKED: Protected staging VERCEL_TOKEN is missing or invalid.');
  }
  const status={};
  for(const [path,name] of ENDPOINTS){
    let response;
    try{
      response=await transport('https://api.vercel.com'+path,{
        method:'GET',redirect:'error',signal:AbortSignal.timeout(12000),
        headers:{Authorization:'Bearer '+token,Accept:'application/json'}
      });
    }catch{
      throw Error('BLOCKED: Vercel '+name+' identity preflight could not complete.');
    }
    status[name]=response?.status;
    // Never inspect API response bodies, including failed requests.
    try{await response?.body?.cancel?.()}catch{}
    if(name==='project'&&status.project!==200){
      throw Error('BLOCKED: Protected token cannot read the expected Wayfarer project. Review project/team permissions without printing the token.');
    }
  }
  if(status.user!==200||status.team!==200){
    throw Error('BLOCKED: Vercel CLI requires user/team identity access but this staging token cannot prove it. '+
      'Project-scoped tokens may pass the project/alias checks yet fail vercel pull with User not found (404). '+
      'Review the token scope and the CLI incompatibility in the release runbook. '+
      'A broader team-scoped token needs explicit security approval; no automatic permission change or deploy.');
  }
  return {status:'VERCEL_CLI_IDENTITY_PREFLIGHT_PASS',projectId:PROJECT_ID,
    identityEndpointsReadOnly:true,productionPromotionAuthorized:false};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    const result=await assertVercelCliIdentityAccess({token:process.env.VERCEL_TOKEN});
    console.log('WAYFARER_VERCEL_CLI_PREFLIGHT '+JSON.stringify(result));
  }catch(e){
    console.error('WAYFARER_VERCEL_CLI_PREFLIGHT_FAILED '+String(e?.message||'Unknown error'));
    process.exitCode=1;
  }
}
