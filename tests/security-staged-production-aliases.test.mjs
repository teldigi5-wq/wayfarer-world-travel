import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertPublicAliasesUnchanged,PROJECT_ID,TEAM_ID,PUBLIC_ALIASES,
  EXPECTED_PRODUCTION_DEPLOYMENT
} from '../scripts/check-staging-aliases.mjs';

const token='mock-only-token-never-a-real-secret';
function fixture({wrongProject=false,wrongDeployment=false,httpError=false,
  mismatchAlias=false,redirect=false}={}){
  const requests=[];
  async function transport(url,options){
    requests.push({url,options});
    if(redirect)throw Error('redirect not followed');
    if(httpError)return new Response('unavailable',{status:503});
    const parsed=new URL(url);
    const alias=decodeURIComponent(parsed.pathname.split('/').at(-1));
    return new Response(JSON.stringify({
      alias:mismatchAlias?'different.vercel.app':alias,
      projectId:wrongProject?'prj_invalid':PROJECT_ID,
      deploymentId:wrongDeployment?'dpl_unexpected':EXPECTED_PRODUCTION_DEPLOYMENT
    }),{status:200,headers:{'Content-Type':'application/json'}});
  }
  return {transport,requests};
}
test('two exact project aliases are audited read-only without exposing token',async()=>{
  const f=fixture();
  const result=await assertPublicAliasesUnchanged({token,transport:f.transport});
  assert.equal(result.status,'PUBLIC_ALIASES_UNCHANGED');
  assert.deepEqual(result.aliases,PUBLIC_ALIASES);
  assert.equal(result.productionPromotionAuthorized,false);
  assert.equal(f.requests.length,2);
  for(const [i,req] of f.requests.entries()){
    const url=new URL(req.url);
    assert.equal(url.origin,'https://api.vercel.com');
    assert.equal(url.searchParams.get('teamId'),TEAM_ID);
    assert.equal(decodeURIComponent(url.pathname.split('/').at(-1)),PUBLIC_ALIASES[i]);
    assert.equal(req.options.method,'GET');
    assert.equal(req.options.redirect,'error');
    assert.equal(req.options.headers.Authorization,'Bearer '+token);
    assert.equal(req.options.headers.Accept,'application/json');
  }
  assert.ok(!JSON.stringify(result).includes(token));
});
test('absent or unexpectedly changed production baseline fails without network',async()=>{
  const f=fixture();
  await assert.rejects(assertPublicAliasesUnchanged({token:'',transport:f.transport}),
    /scoped Vercel token/);
  await assert.rejects(assertPublicAliasesUnchanged({
    token,transport:f.transport,expectedDeploymentId:'dpl_arbitrary'
  }),/baseline changed/);
  assert.equal(f.requests.length,0);
});
test('alias reassignment or project drift blocks safe staging',async()=>{
  for(const settings of [{wrongProject:true},{wrongDeployment:true},{mismatchAlias:true}]){
    const f=fixture(settings);
    await assert.rejects(assertPublicAliasesUnchanged({token,transport:f.transport}),
      /Alias project|PUBLIC ALIAS MOVED|Unexpected alias identity/);
  }
});
test('alias lookup failure and redirects fail closed',async()=>{
  for(const settings of [{httpError:true},{redirect:true}]){
    const f=fixture(settings);
    await assert.rejects(assertPublicAliasesUnchanged({token,transport:f.transport}),
      /alias lookup failed|did not return HTTP 200/);
  }
});
