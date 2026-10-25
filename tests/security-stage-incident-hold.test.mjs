import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('known unsafe staging command cannot execute before incident release hold',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/stage-production-no-domain.yml',import.meta.url),'utf8');
  const incident=workflow.indexOf('name: BLOCKED - protect production aliases after unexpected assignment');
  const exit=workflow.indexOf('          exit 1',incident);
  const checkout=workflow.indexOf('name: Check out only the immutable reviewed main SHA');
  const pull=workflow.indexOf('run: vercel pull --yes --environment=production');
  const deploy=workflow.indexOf('id: deploy');
  assert.ok(incident>=0&&exit>incident&&checkout>exit&&pull>checkout&&deploy>pull,
    'incident hold must stop job before credential-bearing stages');
  assert.match(workflow,/run: \|\n\s+echo 'BLOCKED: staging changed a production alias in run 40190153790\.'/);
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/environment: wayfarer-production-stage/);
  assert.match(workflow,/STAGE_WITHOUT_PROMOTION/);
  assert.match(workflow,/vercel deploy --prebuilt --prod --skip-domain/);
  assert.doesNotMatch(workflow,/^\s+push:\s*$/m);
});

test('no incident gate may silently whitelist a deployment or assign aliases',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/stage-production-no-domain.yml',import.meta.url),'utf8');
  const guard=workflow.slice(workflow.indexOf('- name: BLOCKED - protect'),
    workflow.indexOf('- name: Check out only the immutable'));
  assert.doesNotMatch(guard,/if:|continue-on-error:|\$\{\{|vercel\s+(deploy|promote|alias|rollback)/);
  assert.match(guard,/exit 1/);
});
