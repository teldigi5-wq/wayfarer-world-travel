import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditExistingIncident,INCIDENT_DEPLOYMENT_ID,INCIDENT_HOSTNAME,
  INCIDENT_SOURCE_SHA,INCIDENT_ORIGIN,PRIMARY_ALIAS,SECONDARY_ALIAS
} from '../scripts/audit-existing-incident.mjs';
import {verifyStagedHttpSurface} from '../scripts/verify-staged-http.mjs';

const token='synthetic-vercel-test-token-not-real-9999999999';
const old='dpl_2oiz1XqGtWSTzswD5DzqEhrvLVuT';
const project='prj_7wNYs34jlDD6s4IrI1kWSDpbyn7b';
const paths=['/v13/deployments/'+INCIDENT_HOSTNAME,
  '/v4/aliases/'+PRIMARY_ALIAS,'/v4/aliases/'+SECONDARY_ALIAS];
function fixture(changes={}){
  return [
    {id:INCIDENT_DEPLOYMENT_ID,name:'wayfarer-world-travel',
      project:{id:project},url:INCIDENT_HOSTNAME,target:'production',
      readyState:'READY',alias:[SECONDARY_ALIAS],
      meta:{wayfarerApprovedSourceSha:INCIDENT_SOURCE_SHA},...changes.deployment},
    {alias:PRIMARY_ALIAS,projectId:project,deploymentId:old,...changes.primary},
    {alias:SECONDARY_ALIAS,projectId:project,deploymentId:INCIDENT_DEPLOYMENT_ID,...changes.secondary}
  ];
}
function stub(values,seen=[]){
  return async(url,opts)=>{
    const u=new URL(url);
    assert.equal(u.origin,'https://api.vercel.com');
    assert.equal(u.searchParams.get('teamId'),'team_l9Hkxp0VvUgcGjJmTaCdRW1a');
    assert.equal(opts.method,'GET');
    assert.equal(opts.redirect,'error');
    assert.ok(opts.signal);
    assert.equal(opts.headers.Authorization,'Bearer '+token);
    const index=paths.indexOf(u.pathname);
    assert.notEqual(index,-1);
    seen.push(u.pathname);
    return new Response(JSON.stringify(values[index]),{status:200,
      headers:{'content-type':'application/json'}});
  };
}

test('reads only exact existing immutable artifact and both aliases without promoting',async()=>{
  const seen=[];
  const r=await auditExistingIncident({token,transport:stub(fixture(),seen)});
  assert.deepEqual(seen,paths);
  assert.equal(r.status,'EXISTING_ARTIFACT_INCIDENT_STATE_VERIFIED_ONLY');
  assert.equal(r.immutableOrigin,INCIDENT_ORIGIN);
  assert.equal(r.sourceSha,INCIDENT_SOURCE_SHA);
  assert.equal(r.unexpectedAliasAssignmentStillPresent,true);
  assert.equal(r.productionPromotionAuthorized,false);
  assert.equal(r.browserJourneysVerified,false);
  assert.doesNotMatch(JSON.stringify(r),/synthetic-vercel-test-token/);
});

test('unexpected source SHA, project, target and readiness fail before any alias access',async()=>{
  for(const deployment of [
    {meta:{wayfarerApprovedSourceSha:'0'.repeat(40)}},
    {project:{id:'prj_other'}},
    {target:null},
    {readyState:'ERROR'},
    {url:'another-project.vercel.app'},
    {id:'dpl_other'},
    {alias:[]},
    {alias:[PRIMARY_ALIAS,SECONDARY_ALIAS]}
  ]){
    const seen=[];
    await assert.rejects(auditExistingIncident({token,
      transport:stub(fixture({deployment}),seen)}),/BLOCKED/);
    assert.deepEqual(seen,[paths[0]]);
  }
});

test('primary old deployment must remain exact or the incident is no longer as recorded',async()=>{
  for(const primary of [{deploymentId:INCIDENT_DEPLOYMENT_ID},
    {projectId:'prj_other'},{alias:'wrong.vercel.app'}]){
    const seen=[];
    await assert.rejects(auditExistingIncident({token,
      transport:stub(fixture({primary}),seen)}),/BLOCKED/);
    assert.deepEqual(seen,paths.slice(0,2));
  }
});

test('secondary alias mismatch blocks incident audit without hiding drift',async()=>{
  for(const secondary of [{deploymentId:old},
    {projectId:'prj_other'},{alias:PRIMARY_ALIAS}]){
    const seen=[];
    await assert.rejects(auditExistingIncident({token,
      transport:stub(fixture({secondary}),seen)}),/BLOCKED/);
    assert.deepEqual(seen,paths);
  }
});

test('missing or malformed protected token sends no network calls',async()=>{
  let calls=0;
  await assert.rejects(auditExistingIncident({token:'',
    transport:async()=>{calls++;throw Error('unexpected');}}),/BLOCKED/);
  assert.equal(calls,0);
});

test('transport, HTTP denial and invalid JSON never reveal upstream body or credential',async()=>{
  for(const transport of [
    async()=>{throw Error('Bearer '+token)},
    async()=>new Response(null,{status:403}),
    async()=>new Response('Bearer '+token,{status:200})
  ]){
    await assert.rejects(auditExistingIncident({token,transport}),
      e=>{assert.match(e.message,/BLOCKED/);
        assert.doesNotMatch(String(e),/synthetic-vercel-test-token/);
        return true;});
  }
});

test('read-only workflow cannot stage, alias, promote, rollback or disable protection',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/audit-existing-wayfarer-incident.yml',import.meta.url),'utf8');
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/github.ref == 'refs\/heads\/main'/);
  assert.match(workflow,/AUDIT_EXISTING_ONLY/);
  assert.match(workflow,/expected_sha/);
  assert.match(workflow,/environment: wayfarer-production-stage/);
  assert.match(workflow,/persist-credentials: false/);
  assert.match(workflow,/run: node scripts\/audit-existing-incident\.mjs/);
  assert.match(workflow,/run: node scripts\/verify-staged-http\.mjs/);
  assert.match(workflow,/secrets\.VERCEL_TOKEN/);
  assert.match(workflow,/secrets\.VERCEL_AUTOMATION_BYPASS_SECRET/);
  assert.doesNotMatch(workflow,/^\s+(push|pull_request|schedule):/m);
  assert.doesNotMatch(workflow,/\bvercel\s+(deploy|pull|build|alias|promote|rollback)\b/i);
  assert.doesNotMatch(workflow,/disable.{0,35}protection/i);
});

test('read-only existing-artifact audit does not remove the emergency staging hold',()=>{
  const stage=readFileSync(new URL('../.github/workflows/stage-production-no-domain.yml',import.meta.url),'utf8');
  const guard=stage.indexOf('name: BLOCKED - protect production aliases after unexpected assignment');
  const checkout=stage.indexOf('name: Check out only the immutable reviewed main SHA');
  assert.ok(guard>=0&&checkout>guard);
  assert.match(stage.slice(guard,checkout),/exit 1/);
  // The separately existing HTTP checker must still require the immutable deployment URL.
  assert.equal(INCIDENT_ORIGIN,'https://'+INCIDENT_HOSTNAME);
  assert.equal(typeof verifyStagedHttpSurface,'function');
});
