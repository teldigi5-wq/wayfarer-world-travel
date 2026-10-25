// Read-only, fail-closed inspection of a deliberately staged, immutable Wayfarer
// production-targeted build. It never assigns domains or authorizes promotion.
// Project/user/response bodies and access tokens are never printed.
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {PROJECT_ID,TEAM_ID,PUBLIC_ALIASES} from './check-staging-aliases.mjs';

const NAME='wayfarer-world-travel';
const HOST_RE=/^wayfarer-world-travel-[a-z0-9]+-teldigi5-wq\.vercel\.app$/;

export function stagedDeploymentOrigin(raw){
  if(typeof raw!=='string')throw Error('BLOCKED: exact immutable staged deployment URL required');
  let url;
  try{url=new URL(raw)}catch{throw Error('BLOCKED: invalid staged deployment URL')}
  if(url.protocol!=='https:'||url.username||url.password||url.port||
     url.pathname!=='/'||url.search||url.hash||
     !HOST_RE.test(url.hostname)||url.origin!==raw){
    throw Error('BLOCKED: expected exact Wayfarer immutable HTTPS deployment origin (not a public alias)');
  }
  return url;
}

export async function verifyStagedDeploymentIdentity({
  deploymentUrl,expectedSha,token,transport=fetch
}={}){
  const origin=stagedDeploymentOrigin(deploymentUrl);
  assert.match(expectedSha||'',/^[a-f0-9]{40}$/,'BLOCKED: reviewed 40-character commit SHA required');
  if(typeof token!=='string'||token.trim().length<16){
    throw Error('BLOCKED: protected staging VERCEL_TOKEN required');
  }
  const endpoint=new URL('/v13/deployments/'+encodeURIComponent(origin.hostname),'https://api.vercel.com');
  endpoint.searchParams.set('teamId',TEAM_ID);
  let response;
  try{
    response=await transport(endpoint.toString(),{
      method:'GET',redirect:'error',signal:AbortSignal.timeout(12000),
      headers:{Authorization:'Bearer '+token,Accept:'application/json'}
    });
  }catch{
    throw Error('BLOCKED: staged deployment identity lookup failed or redirected');
  }
  if(response?.status!==200){
    await response?.body?.cancel?.().catch(()=>{});
    throw Error('BLOCKED: staged deployment metadata cannot be verified by authorized GET');
  }
  let deployment;
  try{deployment=await response.json()}catch{
    throw Error('BLOCKED: staged deployment metadata is not valid JSON');
  }
  // Only checked metadata is used; never serialize upstream response or errors.
  assert.ok(deployment&&typeof deployment==='object'&&!Array.isArray(deployment),
    'BLOCKED: missing deployment metadata');
  assert.match(deployment.id||'',/^dpl_[a-zA-Z0-9]+$/,
    'BLOCKED: deployment ID missing or invalid');
  assert.equal(deployment.project?.id,PROJECT_ID,
    'BLOCKED: staging deployment belongs to an unexpected project');
  assert.equal(deployment.name,NAME,'BLOCKED: staging deployment name mismatch');
  assert.equal(deployment.url,origin.hostname,'BLOCKED: staging deployment URL mismatch');
  assert.equal(deployment.target,'production',
    'BLOCKED: must stage a production-targeted build; a Preview is insufficient');
  assert.equal(deployment.readyState,'READY','BLOCKED: staged deployment is not READY');
  assert.equal(deployment.meta?.wayfarerApprovedSourceSha,expectedSha,
    'BLOCKED: reviewed immutable source SHA cannot be linked to staged artifact');
  assert.ok(Array.isArray(deployment.alias),'BLOCKED: alias inventory unavailable');
  assert.deepEqual(deployment.alias,[],
    'BLOCKED: staged build must not have ANY assigned alias');
  assert.ok(deployment.aliasAssigned===false||deployment.aliasAssigned==='false'||
    deployment.aliasAssigned==null,
    'BLOCKED: staged deployment reports assigned aliases');
  for(const alias of PUBLIC_ALIASES){
    assert.notEqual(origin.hostname,alias,'BLOCKED: staged host is a public production alias');
  }
  return {status:'STAGED_DEPLOYMENT_IDENTITY_PASS_ONLY',
    deploymentId:deployment.id,origin:origin.origin,approvedSourceSha:expectedSha,
    projectId:PROJECT_ID,target:'production',state:'READY',aliasCount:0,
    readOnly:true,browserSecurityVerified:false,providerUsageVerified:false,
    productionPromotionAuthorized:false};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    const result=await verifyStagedDeploymentIdentity({
      deploymentUrl:process.env.STAGED_URL,
      expectedSha:process.env.EXPECTED_SHA,
      token:process.env.VERCEL_TOKEN
    });
    console.log('WAYFARER_STAGED_IDENTITY_AUDIT '+JSON.stringify(result));
  }catch(e){
    console.error('WAYFARER_STAGED_IDENTITY_AUDIT_FAILED '+String(e?.message||'Unknown error'));
    process.exitCode=1;
  }
}
