import test from 'node:test';
import assert from 'node:assert/strict';
import {assertVercelCliIdentityAccess} from '../scripts/check-vercel-cli-auth.mjs';

const token='synthetic-token-only-for-tests-012345';
const routes=['/v9/projects/prj_7wNYs34jlDD6s4IrI1kWSDpbyn7b','/v2/user','/teams/team_l9Hkxp0VvUgcGjJmTaCdRW1a'];
function transportFor(statusCodes,visits){
  return async (url,options)=>{
    const parsed=new URL(url);
    assert.equal(parsed.origin,'https://api.vercel.com');
    assert.equal(options.method,'GET');
    assert.equal(options.redirect,'error');
    assert.equal(options.headers.Authorization,'Bearer '+token);
    assert.ok(options.signal);
    const index=routes.findIndex(path=>parsed.pathname===path);
    assert.notEqual(index,-1);
    if(index===0)assert.equal(parsed.searchParams.get('teamId'),'team_l9Hkxp0VvUgcGjJmTaCdRW1a');
    visits.push(parsed.pathname);
    return new Response(null,{status:statusCodes[index]});
  };
}

test('staging identity preflight passes only when project, user and team are accessible',async()=>{
  const visits=[];
  const r=await assertVercelCliIdentityAccess({token,transport:transportFor([200,200,200],visits)});
  assert.equal(r.status,'VERCEL_CLI_IDENTITY_PREFLIGHT_PASS');
  assert.equal(r.productionPromotionAuthorized,false);
  assert.deepEqual(visits,routes);
});

test('project API success with user/team identity failure blocks CLI staging and redacts token',async()=>{
  const visits=[];
  await assert.rejects(assertVercelCliIdentityAccess({token,transport:transportFor([200,404,403],visits)}),
    e=>{assert.match(e.message,/Project-scoped tokens may pass/);assert.doesNotMatch(e.message,/synthetic-token/);return true;});
  assert.deepEqual(visits,routes);
});

test('incorrect project access fails closed before user/team requests',async()=>{
  const visits=[];
  await assert.rejects(assertVercelCliIdentityAccess({token,transport:transportFor([403,200,200],visits)}),/cannot read the expected Wayfarer project/);
  assert.deepEqual(visits,[routes[0]]);
});

test('missing protected token is rejected without any network calls',async()=>{
  await assert.rejects(assertVercelCliIdentityAccess({token:'',transport:()=>{throw Error('network must not run')}}),/missing or invalid/);
});

test('transport failure never exposes sensitive error data',async()=>{
  await assert.rejects(assertVercelCliIdentityAccess({token,transport:async()=>{throw Error('Bearer '+token)}}),
    e=>{assert.match(e.message,/could not complete/);assert.doesNotMatch(e.message,/synthetic-token/);return true;});
});

test('redirect, missing response or unexpected status cannot pass preflight',async()=>{
  const visits=[];
  await assert.rejects(assertVercelCliIdentityAccess({token,transport:transportFor([302,200,200],visits)}),/cannot read the expected/);
  await assert.rejects(assertVercelCliIdentityAccess({token,transport:async()=>null}),/cannot read the expected/);
});


test('manual workflow performs read-only CLI identity check after alias guard but before pulling config',async()=>{
  const {readFileSync}=await import('node:fs');
  const workflow=readFileSync(new URL('../.github/workflows/stage-production-no-domain.yml',import.meta.url),'utf8');
  const aliasPos=workflow.indexOf('run: node scripts/check-staging-aliases.mjs');
  const preflightPos=workflow.indexOf('run: node scripts/check-vercel-cli-auth.mjs');
  const pullPos=workflow.indexOf('run: vercel pull --yes --environment=production');
  assert.ok(aliasPos>=0&&aliasPos<preflightPos&&preflightPos<pullPos);
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/vercel deploy --prebuilt --prod --skip-domain/);
  assert.doesNotMatch(workflow,/^\s+push:\s*$/m);
});
