// Read-only Vercel access diagnostic for the explicitly approved GitHub environment.
// No deployment, production env retrieval, personal identity, or secret-body reads.
// This is diagnostic evidence, NOT deployment permission or a CLI compatibility guarantee.
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {PROJECT_ID,TEAM_ID} from './check-staging-aliases.mjs';

const ROOT='https://api.vercel.com';
const ROUTES=Object.freeze([
  ['project','/v9/projects/'+encodeURIComponent(PROJECT_ID)+'?teamId='+encodeURIComponent(TEAM_ID)],
  ['user','/v2/user'],
  ['teamV2','/v2/teams/'+encodeURIComponent(TEAM_ID)],
  // Upstream CLI issue #17506 recorded a request to this legacy URL as well.
  // Include it as independent evidence, not as the documented public team API.
  ['teamCliLegacy','/teams/'+encodeURIComponent(TEAM_ID)]
]);

export async function diagnoseVercelAuth({token,transport=fetch}={}){
  if(typeof token!=='string'||token.trim().length<16){
    throw Error('BLOCKED: protected environment credential is missing or invalid');
  }
  const http={};
  for(const [name,path] of ROUTES){
    let response;
    try{
      response=await transport(ROOT+path,{
        method:'GET',redirect:'error',signal:AbortSignal.timeout(12000),
        headers:{Authorization:'Bearer '+token,Accept:'application/json'}
      });
    }catch{
      http[name]='request_failed';
      continue;
    }
    http[name]=Number.isInteger(response?.status)&&response.status>=100&&response.status<=599
      ?response.status:'invalid_response';
    // Never serialize raw errors or read identity / project response bodies.
    try{await response?.body?.cancel?.()}catch{}
  }
  const project=http.project===200;
  const user=http.user===200;
  const teamV2=http.teamV2===200;
  const legacy=http.teamCliLegacy===200;
  let classification='IDENTITY_ACCESS_INCOMPLETE';
  if(!project)classification='PROJECT_ACCESS_BLOCKED';
  else if(http.user===404)classification='USER_LOOKUP_404_COMPATIBILITY_SUSPECTED';
  else if(!user)classification='USER_LOOKUP_NOT_ACCESSIBLE';
  else if(teamV2&&!legacy)classification='CLI_LEGACY_TEAM_LOOKUP_UNVERIFIED';
  else if(user&&teamV2&&legacy)classification='IDENTITY_API_ACCESSIBLE_CLI_NOT_TESTED';
  const endpoints=Object.fromEntries(Object.entries(http).map(([k,v])=>[k,v]));
  return {classification,endpoints,projectId:PROJECT_ID,readOnly:true,
    actualCredentialScopeKnown:false,vercelCliCompatibilityProven:false,
    stagedDeploymentCreated:false,productionPromotionAuthorized:false};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    const result=await diagnoseVercelAuth({token:process.env.VERCEL_TOKEN});
    // Only literal route labels, bounded HTTP statuses and static project ID.
    console.log('WAYFARER_VERCEL_AUTH_DIAGNOSTIC '+JSON.stringify(result));
    if(result.classification!=='IDENTITY_API_ACCESSIBLE_CLI_NOT_TESTED'){
      console.error('BLOCKED: review credential scope privately before authorizing staging');
      process.exitCode=1;
    }
  }catch{
    console.error('WAYFARER_VERCEL_AUTH_DIAGNOSTIC_FAILED: missing credential or safe diagnostic failure');
    process.exitCode=1;
  }
}
