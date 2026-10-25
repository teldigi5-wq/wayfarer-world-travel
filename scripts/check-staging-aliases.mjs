// Read-only Vercel REST guard for manual, non-promoting production staging.
// Strictly check the two public aliases before AND after --skip-domain.
// Never log bearer token, API response body, or any credential.
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const TEAM_ID='team_l9Hkxp0VvUgcGjJmTaCdRW1a';
export const PROJECT_ID='prj_7wNYs34jlDD6s4IrI1kWSDpbyn7b';
export const EXPECTED_PRODUCTION_DEPLOYMENT='dpl_2oiz1XqGtWSTzswD5DzqEhrvLVuT';
export const PUBLIC_ALIASES=Object.freeze([
  'wayfarer-world-travel.vercel.app',
  'wayfarer-world-travel-teldigi5-wq.vercel.app'
]);

export async function assertPublicAliasesUnchanged({
  token,transport=fetch,expectedDeploymentId=EXPECTED_PRODUCTION_DEPLOYMENT
}={}){
  assert.ok(typeof token==='string'&&token.trim().length>=16,
    'A scoped Vercel token from the protected staging environment is required');
  assert.equal(expectedDeploymentId,EXPECTED_PRODUCTION_DEPLOYMENT,
    'The recorded production baseline changed. Re-review the release plan');
  const verified=[];
  for(const domain of PUBLIC_ALIASES){
    const url=new URL('/v4/aliases/'+encodeURIComponent(domain),'https://api.vercel.com');
    url.searchParams.set('teamId',TEAM_ID);
    let response;
    try{
      response=await transport(url.toString(),{
        method:'GET',redirect:'error',signal:AbortSignal.timeout(12000),
        headers:{Authorization:'Bearer '+token,Accept:'application/json'}
      });
    }catch{
      throw Error('Vercel alias lookup failed for '+domain);
    }
    if(!response||response.status!==200){
      await response?.body?.cancel?.().catch(()=>{});
      throw Error('Vercel alias lookup did not return HTTP 200 for '+domain);
    }
    let data;
    try{data=await response.json()}catch{
      throw Error('Vercel alias lookup returned invalid JSON for '+domain);
    }
    assert.equal(data.projectId,PROJECT_ID,'Alias project does not match for '+domain);
    assert.equal(data.deploymentId,expectedDeploymentId,
      'PUBLIC ALIAS MOVED: '+domain+' no longer points to the reviewed baseline');
    assert.equal(data.alias,domain,'Unexpected alias identity for '+domain);
    verified.push(domain);
  }
  return {status:'PUBLIC_ALIASES_UNCHANGED',aliases:verified,
    projectId:PROJECT_ID,baselineDeploymentId:expectedDeploymentId,
    productionPromotionAuthorized:false};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    const report=await assertPublicAliasesUnchanged({token:process.env.VERCEL_TOKEN});
    console.log('WAYFARER_STAGE_ALIAS_CHECK '+JSON.stringify(report));
  }catch(e){
    console.error('WAYFARER_STAGE_ALIAS_CHECK_FAILED '+String(e?.message||'Unknown error'));
    process.exitCode=1;
  }
}
