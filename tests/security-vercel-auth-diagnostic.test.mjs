import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {diagnoseVercelAuth} from '../scripts/diagnose-vercel-auth.mjs';

const token='synthetic-token-only-not-real-vercel-123456';
const PROJECT='/v9/projects/prj_7wNYs34jlDD6s4IrI1kWSDpbyn7b';
const USER='/v2/user';
const TEAM='/v2/teams/team_l9Hkxp0VvUgcGjJmTaCdRW1a';
const CLI_TEAM='/teams/team_l9Hkxp0VvUgcGjJmTaCdRW1a';
const routes=[PROJECT,USER,TEAM,CLI_TEAM];
function mock(statuses,seen=[]){
  return async (url,opts)=>{
    const dest=new URL(url);
    assert.equal(dest.origin,'https://api.vercel.com');
    assert.ok(routes.includes(dest.pathname),'unexpected auth endpoint');
    if(dest.pathname===PROJECT)assert.equal(dest.searchParams.get('teamId'),'team_l9Hkxp0VvUgcGjJmTaCdRW1a');
    assert.equal(opts.method,'GET');
    assert.equal(opts.redirect,'error');
    assert.equal(opts.headers.Authorization,'Bearer '+token);
    assert.ok(opts.signal);
    seen.push(dest.pathname);
    const n=routes.indexOf(dest.pathname);
    return new Response(null,{status:statuses[n]});
  };
}

test('auth-only diagnostic identifies four read-only routes without claiming CLI success',async()=>{
  const seen=[];
  const report=await diagnoseVercelAuth({token,transport:mock([200,200,200,200],seen)});
  assert.deepEqual(seen,routes);
  assert.equal(report.classification,'IDENTITY_API_ACCESSIBLE_CLI_NOT_TESTED');
  assert.equal(report.actualCredentialScopeKnown,false);
  assert.equal(report.vercelCliCompatibilityProven,false);
  assert.equal(report.stagedDeploymentCreated,false);
  assert.equal(report.productionPromotionAuthorized,false);
  assert.deepEqual(Object.values(report.endpoints),[200,200,200,200]);
  assert.doesNotMatch(JSON.stringify(report),/synthetic-token/);
});

test('project success but CLI user 404 diagnoses likely scoped-token incompatibility',async()=>{
  const r=await diagnoseVercelAuth({token,transport:mock([200,404,403,403])});
  assert.equal(r.classification,'USER_LOOKUP_404_COMPATIBILITY_SUSPECTED');
  assert.equal(r.endpoints.project,200);
  assert.equal(r.endpoints.user,404);
  assert.equal(r.actualCredentialScopeKnown,false);
});

test('project permissions denied block diagnostics even if other endpoints pass',async()=>{
  const r=await diagnoseVercelAuth({token,transport:mock([403,200,200,200])});
  assert.equal(r.classification,'PROJECT_ACCESS_BLOCKED');
});

test('legacy CLI team route failing remains inconclusive despite documented team API access',async()=>{
  const r=await diagnoseVercelAuth({token,transport:mock([200,200,200,404])});
  assert.equal(r.classification,'CLI_LEGACY_TEAM_LOOKUP_UNVERIFIED');
  assert.equal(r.vercelCliCompatibilityProven,false);
});

test('denied identity without 404 is not mislabeled as a confirmed token scope',async()=>{
  const r=await diagnoseVercelAuth({token,transport:mock([200,403,200,200])});
  assert.equal(r.classification,'USER_LOOKUP_NOT_ACCESSIBLE');
});

test('missing protected token blocks without network calls',async()=>{
  let calls=0;
  await assert.rejects(diagnoseVercelAuth({token:'',transport:()=>{calls++;throw Error('unexpected')}}),/BLOCKED/);
  assert.equal(calls,0);
});

test('network errors and error bodies cannot disclose credential values',async()=>{
  const r=await diagnoseVercelAuth({token,transport:async()=>{throw Error('secret='+token)}});
  assert.equal(r.classification,'PROJECT_ACCESS_BLOCKED');
  assert.ok(Object.values(r.endpoints).every(v=>v==='request_failed'));
  assert.doesNotMatch(JSON.stringify(r),/synthetic-token/);
});

test('diagnostic never parses personal, project or error bodies',async()=>{
  let read=0,cancel=0;
  const transport=async() => ({
    status:200, json:async()=>{read++;throw Error('private profile')},
    text:async()=>{read++;throw Error('private profile')},
    body:{cancel:async()=>{cancel++}}
  });
  const r=await diagnoseVercelAuth({token,transport});
  assert.equal(read,0);
  assert.equal(cancel,4);
  assert.equal(r.classification,'IDENTITY_API_ACCESSIBLE_CLI_NOT_TESTED');
});

test('auth workflow is dispatch-only, immutable-main-gated, protected and contains no deploy action',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/diagnose-vercel-staging-auth.yml',import.meta.url),'utf8');
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/github.ref == 'refs\/heads\/main'/);
  assert.match(workflow,/DIAGNOSE_AUTH_ONLY/);
  assert.match(workflow,/expected_sha/);
  assert.match(workflow,/assert\.equal\(REQUESTED_SHA,ACTUAL_SHA/);
  assert.match(workflow,/environment: wayfarer-production-stage/);
  assert.match(workflow,/persist-credentials: false/);
  assert.match(workflow,/permissions:\s*\n\s+contents: read/);
  assert.match(workflow,/run: node scripts\/diagnose-vercel-auth\.mjs/);
  assert.match(workflow,/secrets\.VERCEL_TOKEN/);
  assert.doesNotMatch(workflow,/^\s+(push|pull_request|schedule):/m);
  assert.doesNotMatch(workflow,/\bvercel\s+(pull|build|deploy|promote|env|alias|rollback)\b/);
});

test('diagnostic script uses GET exclusively and does not persist environment secrets',()=>{
  const source=readFileSync(new URL('../scripts/diagnose-vercel-auth.mjs',import.meta.url),'utf8');
  assert.match(source,/method:'GET',redirect:'error'/);
  assert.doesNotMatch(source,/\b(fetch|transport)\(.+method:'(POST|PUT|PATCH|DELETE)'/);
  assert.doesNotMatch(source,/writeFile|appendFile|execSync|spawn\(/);
});
