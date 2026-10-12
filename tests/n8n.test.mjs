import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const workflow=JSON.parse(readFileSync(new URL('../n8n/wayfarer-groq-agents.json',import.meta.url),'utf8'));

test('importable n8n workflow contains real Groq requests and an authenticated webhook',()=>{
  assert.equal(workflow.active,false);
  assert.equal(workflow.nodes.length,8);
  const webhook=workflow.nodes.find(n=>n.type==='n8n-nodes-base.webhook');
  assert.equal(webhook.parameters.authentication,'headerAuth');
  assert.equal(webhook.parameters.responseMode,'responseNode');
  const calls=workflow.nodes.filter(n=>n.parameters?.url==='https://api.groq.com/openai/v1/chat/completions');
  assert.equal(calls.length,3);
  for(const call of calls) {
    assert.equal(call.parameters.authentication,'genericCredentialType');
    assert.equal(call.parameters.genericAuthType,'httpHeaderAuth');
    assert.match(call.parameters.jsonBody,/openai\/gpt-oss-20b/);
  }
  assert.equal(JSON.stringify(workflow).includes('gsk_'),false);
  assert.equal(JSON.stringify(workflow).includes('Bearer gsk_'),false);
  assert.equal(workflow.nodes.find(n=>n.name==='Destination Source').continueOnFail,true);
});
test('n8n graph leads from webhook through all three agents to response',()=>{
  const names=workflow.nodes.map(n=>n.name);
  for(let i=0;i<names.length-1;i++) {
    assert.equal(workflow.connections[names[i]].main[0][0].node,names[i+1]);
  }
  assert.equal(names[0],'Incoming Trip');
  assert.equal(names.at(-1),'Return Plan');
});
