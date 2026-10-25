import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const text=readFileSync(new URL('../.github/workflows/stage-production-no-domain.yml',import.meta.url),'utf8');
const stage=text.indexOf('vercel deploy --prebuilt --prod --skip-domain');
test('manual stage workflow has no automatic trigger or promotion command',()=>{
  assert.match(text,/^on:\s*\n\s+workflow_dispatch:/m);
  assert.doesNotMatch(text,/^\s+(?:push|pull_request|pull_request_target|schedule):/m);
  assert.doesNotMatch(text,/\bvercel (?:promote|rollback)\b/i);
  assert.doesNotMatch(text,/mcp__Vercel__request_promote/);
  assert.ok(stage>0,'Must use the CLI staged-production flag');
  assert.match(text,/environment: wayfarer-production-stage/);
  assert.match(text,/STAGING_ENABLED:/);
  assert.match(text,/WAYFARER_PRODUCTION_STAGING_ENABLED/);
});
test('SHA and reviewed project identity are fixed before any production build',()=>{
  assert.match(text,/github\.ref == 'refs\/heads\/main'/);
  assert.match(text,/assert\.equal\(REQUESTED_SHA,ACTUAL_SHA/);
  assert.match(text,/STAGE_WITHOUT_PROMOTION/);
  assert.match(text,/ref: \$\{\{ github\.sha \}\}/);
  assert.match(text,/persist-credentials: false/);
  assert.match(text,/VERCEL_ORG_ID: team_l9Hkxp0VvUgcGjJmTaCdRW1a/);
  assert.match(text,/VERCEL_PROJECT_ID: prj_7wNYs34jlDD6s4IrI1kWSDpbyn7b/);
  assert.match(text,/VERCEL_CLI_VERSION: '65\.1\.0'/);
});
test('public aliases are checked on both sides of the sole deploy operation',()=>{
  const before=text.indexOf('Verify neither existing public alias has moved');
  const after=text.indexOf('Prove public alias assignments did not change after staging');
  assert.ok(before>=0&&before<stage&&after>stage);
  assert.equal(text.split('node scripts/check-staging-aliases.mjs').length-1,2);
  assert.equal(text.split('vercel deploy --prebuilt --prod --skip-domain').length-1,1);
  assert.ok(text.indexOf('npm test')<before,'Offline validation must precede credentials');
});
test('workflow does not enable metered providers or accidentally publish credentials',()=>{
  assert.doesNotMatch(text,/SERPAPI_API_KEY|GROQ_API_KEY|WAYFARER_TRAVEL_ENABLED/);
  assert.doesNotMatch(text,/--token(?:=|\s)/);
  assert.doesNotMatch(text,/vercel env pull --environment=preview/);
  assert.match(text,/VERCEL_TOKEN: \$\{\{ secrets\.VERCEL_TOKEN \}\}/);
  assert.doesNotMatch(text,/upload-artifact/);
});
