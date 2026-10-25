import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stagedDeploymentOrigin,verifyStagedDeploymentIdentity} from '../scripts/check-staged-deployment.mjs';

const sha='897594c027ae175f0d21b514364a8c37da597159';
const token='synthetic-secret-not-a-real-token-123456789';
const host='wayfarer-world-travel-a1b2c3-teldigi5-wq.vercel.app';
const origin='https://'+host;
function deployment(changes={}){
  return {id:'dpl_ABC123def456',name:'wayfarer-world-travel',url:host,
    project:{id:'prj_7wNYs34jlDD6s4IrI1kWSDpbyn7b'},
    target:'production',readyState:'READY',
    meta:{wayfarerApprovedSourceSha:sha},
    alias:[],aliasAssigned:false,...changes};
}
function fetchFixture(value=deployment(),called=[]){
  return async (url,opts)=>{
    const u=new URL(url);
    assert.equal(u.origin,'https://api.vercel.com');
    assert.equal(u.pathname,'/v13/deployments/'+host);
    assert.equal(u.searchParams.get('teamId'),'team_l9Hkxp0VvUgcGjJmTaCdRW1a');
    assert.equal(opts.method,'GET');
    assert.equal(opts.redirect,'error');
    assert.equal(opts.headers.Authorization,'Bearer '+token);
    assert.ok(opts.signal);
    called.push(u.pathname);
    return new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});
  };
}
function verify(value,opts={}){
  return verifyStagedDeploymentIdentity({deploymentUrl:origin,expectedSha:sha,token,
    transport:fetchFixture(value),...opts});
}

test('accepts only exact immutable same-team HTTPS hostname',()=>{
  assert.equal(stagedDeploymentOrigin(origin).hostname,host);
  for(const input of [undefined,'https://wayfarer-world-travel.vercel.app',
    'http://'+host,origin+'/foo',origin+'/?x=1',
    'https://evil.example/',origin+'#x','https://user:pass@'+host,
    'https://wayfarer-world-travel-a1b2c3-teldigi5-wq.vercel.app.evil.org']){
    assert.throws(()=>stagedDeploymentOrigin(input),/BLOCKED/);
  }
});

test('read-only identity verification returns explicitly non-authorizing report',async()=>{
  const called=[];
  const result=await verifyStagedDeploymentIdentity({
    deploymentUrl:origin,expectedSha:sha,token,
    transport:fetchFixture(deployment(),called)
  });
  assert.equal(called.length,1);
  assert.equal(result.status,'STAGED_DEPLOYMENT_IDENTITY_PASS_ONLY');
  assert.equal(result.approvedSourceSha,sha);
  assert.equal(result.deploymentId,'dpl_ABC123def456');
  assert.equal(result.target,'production');
  assert.equal(result.productionPromotionAuthorized,false);
  assert.equal(result.browserSecurityVerified,false);
  assert.equal(result.providerUsageVerified,false);
});

test('wrong project or deployment identity always fails closed',async()=>{
  for(const v of [
    deployment({project:{id:'prj_other'}}),
    deployment({name:'another-project'}),
    deployment({url:'wayfarer-world-travel-other-teldigi5-wq.vercel.app'}),
    deployment({id:'broken-id'})
  ])await assert.rejects(verify(v),/BLOCKED/);
});

test('Preview, failed builds, or mismatched source commit cannot pass',async()=>{
  for(const v of [
    deployment({target:null}),
    deployment({readyState:'ERROR'}),
    deployment({meta:{wayfarerApprovedSourceSha:'f'.repeat(40)}}),
    deployment({meta:{}})
  ])await assert.rejects(verify(v),/BLOCKED/);
});

test('rejects assigned aliases, missing inventory, or unverified assignment',async()=>{
  for(const v of [
    deployment({alias:['wayfarer-world-travel.vercel.app']}),
    deployment({alias:['wayfarer-world-travel-git-main-teldigi5-wq.vercel.app']}),
    deployment({alias:undefined}),
    deployment({aliasAssigned:true})
  ])await assert.rejects(verify(v),/BLOCKED/);
});

test('missing token or invalid reviewed SHA sends no requests',async()=>{
  let calls=0;
  const transport=()=>{calls++;throw Error('never');};
  await assert.rejects(verifyStagedDeploymentIdentity({
    deploymentUrl:origin,expectedSha:'invalid',token,transport
  }),/BLOCKED/);
  await assert.rejects(verifyStagedDeploymentIdentity({
    deploymentUrl:origin,expectedSha:sha,token:'',transport
  }),/BLOCKED/);
  assert.equal(calls,0);
});

test('network/auth and malformed JSON fail without leaking secret',async()=>{
  for(const transport of [
    async()=>{throw Error(token)},
    async()=>new Response(null,{status:403}),
    async()=>new Response('not JSON',{status:200})
  ]){
    await assert.rejects(verifyStagedDeploymentIdentity({
      deploymentUrl:origin,expectedSha:sha,token,transport
    }),e=>{assert.doesNotMatch(e.message,/synthetic-secret/);return true});
  }
});

test('manual workflow tags reviewed SHA and checks deployment before release summary',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/stage-production-no-domain.yml',import.meta.url),'utf8');
  const dollar=String.fromCharCode(36);
  const metadata=workflow.indexOf('--meta "wayfarerApprovedSourceSha='+dollar+'{GITHUB_SHA}"');
  const deploy=workflow.indexOf('id: deploy');
  const identity=workflow.indexOf('run: node scripts/check-staged-deployment.mjs');
  const aliases=workflow.indexOf('name: Prove public alias assignments did not change after staging attempt');
  const summary=workflow.indexOf('name: Record only the staged URL and remaining release gate');
  assert.ok(metadata>deploy&&identity>metadata&&aliases>identity&&summary>aliases);
  assert.ok(workflow.includes('STAGED_URL: '+dollar+'{{ steps.deploy.outputs.url }}'));
  assert.ok(workflow.includes('EXPECTED_SHA: '+dollar+'{{ github.sha }}'));
  assert.ok(workflow.includes("always() && steps.deploy.outcome != 'skipped'"));
  assert.match(workflow,/vercel deploy --prebuilt --prod --skip-domain/);
  assert.match(workflow,/workflow_dispatch:/);
  assert.doesNotMatch(workflow,/^\s+push:\s*$/m);
});
