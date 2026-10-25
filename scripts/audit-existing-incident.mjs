// Incident-specific read-only inspection of an EXISTING production-targeted build.
// NO deployment, alias mutation, rollback, environment retrieval or promotion.
// Verified against run #40190153790: this audit records the alias incident;
// it does NOT waive the no-alias release gate for a future staging workflow.
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {PROJECT_ID,TEAM_ID,EXPECTED_PRODUCTION_DEPLOYMENT} from './check-staging-aliases.mjs';

export const INCIDENT_DEPLOYMENT_ID='dpl_8S1c3YMYJixGPid1i8bdwmz8DXHT';
export const INCIDENT_SOURCE_SHA='4a09d5c8fb98b25f5e8f0d4877ea386e42eb14a0';
export const INCIDENT_HOSTNAME='wayfarer-world-travel-m4ce3pzyx-teldigi5-wq.vercel.app';
export const INCIDENT_ORIGIN='https://'+INCIDENT_HOSTNAME;
export const PRIMARY_ALIAS='wayfarer-world-travel.vercel.app';
export const SECONDARY_ALIAS='wayfarer-world-travel-teldigi5-wq.vercel.app';

async function readMetadata(token,path,transport){
  const uri=new URL(path,'https://api.vercel.com');
  uri.searchParams.set('teamId',TEAM_ID);
  let response;
  try{
    response=await transport(uri.toString(),{
      method:'GET',redirect:'error',signal:AbortSignal.timeout(12000),
      headers:{Authorization:'Bearer '+token,Accept:'application/json'}
    });
  }catch{throw Error('BLOCKED: Vercel incident lookup network/redirect failure');}
  if(response?.status!==200){
    try{await response?.body?.cancel?.()}catch{}
    throw Error('BLOCKED: Vercel incident lookup did not return HTTP 200');
  }
  try{return await response.json()}
  catch{throw Error('BLOCKED: Vercel incident lookup returned invalid JSON');}
}
function requireValue(ok,message){if(!ok)throw Error('BLOCKED: '+message)}

export async function auditExistingIncident({token,transport=fetch}={}){
  requireValue(typeof token==='string'&&token.trim().length>=16,
    'protected Vercel token required');
  const deploy=await readMetadata(token,'/v13/deployments/'+INCIDENT_HOSTNAME,transport);
  requireValue(deploy?.id===INCIDENT_DEPLOYMENT_ID,'unexpected deployment ID');
  requireValue(deploy?.name==='wayfarer-world-travel','unexpected deployment name');
  requireValue(deploy?.project?.id===PROJECT_ID,'unexpected project');
  requireValue(deploy?.url===INCIDENT_HOSTNAME,'immutable deployment URL changed');
  requireValue(deploy?.target==='production','deployment is not production-targeted');
  requireValue(deploy?.readyState==='READY','deployment is not READY');
  requireValue(deploy?.meta?.wayfarerApprovedSourceSha===INCIDENT_SOURCE_SHA,
    'reviewed commit SHA metadata mismatch');
  requireValue(Array.isArray(deploy.alias)&&deploy.alias.length===1&&
    deploy.alias[0]===SECONDARY_ALIAS,
    'incident artifact alias inventory differs from documented state');

  const primary=await readMetadata(token,
    '/v4/aliases/'+encodeURIComponent(PRIMARY_ALIAS),transport);
  const secondary=await readMetadata(token,
    '/v4/aliases/'+encodeURIComponent(SECONDARY_ALIAS),transport);
  requireValue(primary?.alias===PRIMARY_ALIAS&&primary?.projectId===PROJECT_ID&&
    primary?.deploymentId===EXPECTED_PRODUCTION_DEPLOYMENT,
    'primary domain mapping changed: stop and re-review');
  requireValue(secondary?.alias===SECONDARY_ALIAS&&secondary?.projectId===PROJECT_ID&&
    secondary?.deploymentId===INCIDENT_DEPLOYMENT_ID,
    'secondary incident domain mapping changed: stop and re-review');
  return {status:'EXISTING_ARTIFACT_INCIDENT_STATE_VERIFIED_ONLY',
    deploymentId:INCIDENT_DEPLOYMENT_ID,immutableOrigin:INCIDENT_ORIGIN,
    sourceSha:INCIDENT_SOURCE_SHA,productionTarget:true,ready:true,
    mainDomainDeploymentId:EXPECTED_PRODUCTION_DEPLOYMENT,
    secondaryDomainDeploymentId:INCIDENT_DEPLOYMENT_ID,
    unexpectedAliasAssignmentStillPresent:true,readOnly:true,
    browserJourneysVerified:false,productionPromotionAuthorized:false};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    const result=await auditExistingIncident({token:process.env.VERCEL_TOKEN});
    console.log('WAYFARER_INCIDENT_IDENTITY_AUDIT '+JSON.stringify(result));
  }catch(e){
    console.error('WAYFARER_INCIDENT_IDENTITY_AUDIT_FAILED '+String(e?.message||'Blocked'));
    process.exitCode=1;
  }
}
